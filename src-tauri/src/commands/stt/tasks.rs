//! Background task spawning helpers for the STT pipeline: panic-guarded
//! task wrappers, the latest-wins semantic detection worker loop, and the
//! shared live input gain handle.

use std::panic::AssertUnwindSafe;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use futures_util::FutureExt;
use tauri::{AppHandle, Emitter};
use tokio::sync::Notify;

use rhema_audio::{new_gain_handle, GainHandle};
use rhema_stt::{SttProvider, TranscriptEvent};

use super::detection_jobs::{take_semantic_job, SemanticJob};
use super::live_session::run_semantic_detection;

static LIVE_INPUT_GAIN: OnceLock<GainHandle> = OnceLock::new();

pub(super) fn live_input_gain() -> GainHandle {
    LIVE_INPUT_GAIN.get_or_init(|| new_gain_handle(1.0)).clone()
}

pub(super) fn spawn_stt_task<F>(
    name: &'static str,
    future: F,
) -> tauri::async_runtime::JoinHandle<()>
where
    F: std::future::Future<Output = ()> + Send + 'static,
{
    spawn_stt_task_with_on_panic(name, future, || {})
}

pub(super) async fn run_panic_guarded<F, P>(name: &'static str, future: F, on_panic: P)
where
    F: std::future::Future<Output = ()> + Send + 'static,
    P: FnOnce() + Send + 'static,
{
    if AssertUnwindSafe(future).catch_unwind().await.is_err() {
        log::error!("[STT] Task {name} panicked");
        on_panic();
    } else {
        log::debug!("[STT] Task {name} exited");
    }
}

pub(super) fn spawn_stt_task_with_on_panic<F, P>(
    name: &'static str,
    future: F,
    on_panic: P,
) -> tauri::async_runtime::JoinHandle<()>
where
    F: std::future::Future<Output = ()> + Send + 'static,
    P: FnOnce() + Send + 'static,
{
    tauri::async_runtime::spawn(run_panic_guarded(name, future, on_panic))
}

pub(super) fn is_current_session(session_generation: &AtomicU64, generation: u64) -> bool {
    session_generation.load(Ordering::SeqCst) == generation
}

#[derive(Clone)]
pub(super) struct ProviderSessionContext {
    pub(super) stt_active: Arc<AtomicBool>,
    pub(super) audio_active: Arc<AtomicBool>,
    pub(super) session_generation: Arc<AtomicU64>,
    pub(super) generation: u64,
}

impl ProviderSessionContext {
    fn is_current(&self) -> bool {
        is_current_session(&self.session_generation, self.generation)
    }

    fn clear_active_if_current(&self) {
        if self.is_current() {
            self.stt_active.store(false, Ordering::SeqCst);
            self.audio_active.store(false, Ordering::SeqCst);
        }
    }

    fn into_guard(self) -> ProviderSessionGuard {
        ProviderSessionGuard { ctx: self }
    }
}

/// RAII guard that resets `stt_active` and `audio_active` whenever the
/// provider task exits, unwinds from a panic, or is cancelled — without
/// clobbering a newer session that has already claimed a later generation.
pub(super) struct ProviderSessionGuard {
    ctx: ProviderSessionContext,
}

impl Drop for ProviderSessionGuard {
    fn drop(&mut self) {
        self.ctx.clear_active_if_current();
    }
}

pub(super) fn spawn_provider_task(
    app: AppHandle,
    stt_provider: Box<dyn SttProvider>,
    audio_send_rx: crossbeam_channel::Receiver<Vec<i16>>,
    event_tx: tokio::sync::mpsc::Sender<TranscriptEvent>,
    session: ProviderSessionContext,
) -> tauri::async_runtime::JoinHandle<()> {
    let provider_log_name = stt_provider.name().to_string();
    let panic_app = app.clone();
    let panic_session = session.clone();
    let panic_provider_name = provider_log_name.clone();

    spawn_stt_task_with_on_panic(
        "provider",
        async move {
            let session_guard = session.into_guard();
            let result = stt_provider.start(audio_send_rx, event_tx).await;
            if let Err(e) = result {
                log::error!("[STT-{provider_log_name}] Provider failed: {e}");
                if session_guard.ctx.is_current() {
                    let _ = app.emit("stt_error", e.to_string());
                    let _ = app.emit("stt_disconnected", ());
                }
            }
            session_guard.ctx.clear_active_if_current();
            log::info!("[STT-{provider_log_name}] Provider task exited");
        },
        move || {
            if panic_session.is_current() {
                panic_session.clear_active_if_current();
                let _ = panic_app.emit(
                    "stt_error",
                    format!("Speech-to-text provider {panic_provider_name} panicked unexpectedly"),
                );
                let _ = panic_app.emit("stt_disconnected", ());
            }
        },
    )
}

pub(super) fn spawn_latest_wins_semantic_worker(
    task_name: &'static str,
    job_label: &'static str,
    app: AppHandle,
    latest_seq: Arc<AtomicU64>,
    egw_cue_at_ms: Arc<AtomicU64>,
    job_slot: Arc<Mutex<Option<SemanticJob>>>,
    notify: Arc<Notify>,
) -> tauri::async_runtime::JoinHandle<()> {
    spawn_stt_task(task_name, async move {
        loop {
            notify.notified().await;

            while let Some(job) = take_semantic_job(&job_slot, job_label) {
                let SemanticJob {
                    seq,
                    text,
                    egw_text,
                    stt_confidence,
                    is_final,
                    utterance_id,
                    request_hint,
                } = job;
                let check_seq = latest_seq.load(Ordering::Acquire);
                if seq < check_seq {
                    log::debug!(
                        "[DET-SEMANTIC] Skipping stale {job_label} job seq={seq} latest={check_seq}",
                    );
                    continue;
                }

                let app_clone = app.clone();
                let latest_seq = latest_seq.clone();
                let egw_cue_at_ms = egw_cue_at_ms.clone();
                let _ = tokio::task::spawn_blocking(move || {
                    run_semantic_detection(
                        &app_clone,
                        seq,
                        &latest_seq,
                        &egw_cue_at_ms,
                        &text,
                        &egw_text,
                        stt_confidence,
                        is_final,
                        utterance_id,
                        request_hint,
                    );
                })
                .await;
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use std::panic::AssertUnwindSafe;
    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
    use std::sync::Arc;

    use super::{run_panic_guarded, ProviderSessionContext};

    #[tokio::test]
    async fn run_panic_guarded_invokes_on_panic_when_future_panics() {
        let called = Arc::new(AtomicBool::new(false));
        let called_flag = called.clone();

        let handle = tokio::spawn(run_panic_guarded(
            "test-panic",
            async {
                panic!("simulated provider panic");
            },
            move || {
                called_flag.store(true, Ordering::SeqCst);
            },
        ));

        let _ = handle.await;
        assert!(called.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn run_panic_guarded_skips_on_panic_on_normal_exit() {
        let called = Arc::new(AtomicBool::new(false));
        let called_flag = called.clone();

        let handle = tokio::spawn(run_panic_guarded(
            "test-ok",
            async {},
            move || {
                called_flag.store(true, Ordering::SeqCst);
            },
        ));

        let _ = handle.await;
        assert!(!called.load(Ordering::SeqCst));
    }

    #[test]
    fn provider_session_guard_clears_active_flags_on_panic_unwind() {
        let stt_active = Arc::new(AtomicBool::new(true));
        let audio_active = Arc::new(AtomicBool::new(true));
        let generation = Arc::new(AtomicU64::new(3));

        let guard = ProviderSessionContext {
            stt_active: stt_active.clone(),
            audio_active: audio_active.clone(),
            session_generation: generation,
            generation: 3,
        }
        .into_guard();
        let result = std::panic::catch_unwind(AssertUnwindSafe(move || {
            let _guard = guard;
            panic!("boom");
        }));

        assert!(result.is_err());
        assert!(!stt_active.load(Ordering::SeqCst));
        assert!(!audio_active.load(Ordering::SeqCst));
    }

    #[test]
    fn provider_session_guard_does_not_clobber_newer_session_on_drop() {
        let stt_active = Arc::new(AtomicBool::new(true));
        let audio_active = Arc::new(AtomicBool::new(true));
        let generation = Arc::new(AtomicU64::new(3));

        let guard = ProviderSessionContext {
            stt_active: stt_active.clone(),
            audio_active: audio_active.clone(),
            session_generation: generation.clone(),
            generation: 3,
        }
        .into_guard();
        // Simulate a newer session taking over before the old provider finishes dropping.
        generation.store(4, Ordering::SeqCst);
        drop(guard);

        assert!(stt_active.load(Ordering::SeqCst));
        assert!(audio_active.load(Ordering::SeqCst));
    }
}
