use std::path::Path;

use tauri::AppHandle;

use crate::asset_paths;
use crate::commands::secrets;
use rhema_stt::{DeepgramClient, SttConfig, SttProvider, VoskProvider};

pub(crate) fn missing_vosk_model_error(model_path: &Path) -> String {
    format!(
        "Vosk model not found at {}. Reinstall the app, or place the small English Vosk model in <app data>\\models\\vosk\\{} (or set SABBATHCUE_VOSK_MODEL_DIR).",
        model_path.display(),
        asset_paths::VOSK_MODEL_DIRNAME
    )
}

pub(crate) fn missing_vosk_worker_error(worker_path: &Path) -> String {
    format!(
        "Vosk worker not found at {}. Reinstall the app to restore scripts\\vosk_worker.exe.",
        worker_path.display()
    )
}

pub(crate) async fn build_stt_provider(
    provider_name: &str,
    app: &AppHandle,
    device_id: Option<&str>,
    gain: Option<f32>,
) -> Result<Box<dyn SttProvider>, String> {
    match provider_name {
        "vosk" | "whisper" => {
            let model_path = asset_paths::vosk_model_path(app);
            if !model_path.exists() {
                let error = missing_vosk_model_error(&model_path);
                log::error!("[STT-vosk] {error}");
                return Err(error);
            }
            let worker_path = asset_paths::vosk_worker_path(app);
            if !worker_path.exists() {
                let error = missing_vosk_worker_error(&worker_path);
                log::error!("[STT-vosk] {error}");
                return Err(error);
            }

            log::info!(
                "Starting Vosk transcription: model={}, worker={}, device_id={device_id:?}",
                model_path.display(),
                worker_path.display()
            );

            let preflight = VoskProvider::new(model_path.clone(), worker_path.clone());
            tauri::async_runtime::spawn_blocking(move || preflight.check_ready())
                .await
                .map_err(|e| {
                    let error = format!("Vosk startup check task failed: {e}");
                    log::error!("[STT-vosk] {error}");
                    error
                })?
                .map_err(|e| {
                    let error = format!("Vosk startup check failed: {e}");
                    log::error!("[STT-vosk] {error}");
                    error
                })?;

            Ok(Box::new(VoskProvider::new(model_path, worker_path)))
        }
        #[cfg(feature = "whisper")]
        "legacy-whisper" => {
            let model_path = asset_paths::vosk_model_path(app);
            Err(format!(
                "Legacy Whisper is no longer the local provider. Use Vosk; expected Vosk model at {}.",
                model_path.display()
            ))
        }
        "faster-whisper" => Err("faster-whisper has been removed. Choose Vosk or Deepgram.".into()),
        _ => {
            let resolved_api_key = secrets::get_deepgram_api_key_or_empty()?;

            if resolved_api_key.is_empty() {
                return Err("No Deepgram API key configured. Set it in Settings.".into());
            }

            log::info!(
                "Starting Deepgram transcription: api_key_configured=true, device_id={device_id:?}, gain={gain:?}"
            );

            let stt_config = SttConfig {
                api_key: resolved_api_key,
                model: "nova-3".to_string(),
                sample_rate: 16_000,
                encoding: "linear16".to_string(),
                language: Some("en-US".to_string()),
            };

            Ok(Box::new(DeepgramClient::new(stt_config)))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn missing_model_error_mentions_path_and_recovery_steps() {
        let error = missing_vosk_model_error(&PathBuf::from("C:\\app\\models\\vosk\\missing"));
        assert!(error.contains("C:\\app\\models\\vosk\\missing"));
        assert!(error.contains("SABBATHCUE_VOSK_MODEL_DIR"));
        assert!(error.contains(asset_paths::VOSK_MODEL_DIRNAME));
    }

    #[test]
    fn vosk_errors_do_not_hardcode_a_user_profile_path() {
        // A previous build baked a developer-machine Downloads path into the
        // user-facing error, which sent users to a location that does not
        // exist on their machine.
        let model_error = missing_vosk_model_error(&PathBuf::from("C:\\anywhere"));
        let worker_error = missing_vosk_worker_error(&PathBuf::from("C:\\anywhere"));
        for error in [model_error, worker_error] {
            assert!(
                !error.contains("Users\\fanel") && !error.contains("Downloads"),
                "error message must not reference a developer machine path: {error}"
            );
        }
    }

    #[test]
    fn missing_worker_error_mentions_path() {
        let error =
            missing_vosk_worker_error(&PathBuf::from("C:\\app\\scripts\\vosk_worker.exe"));
        assert!(error.contains("vosk_worker.exe"));
    }
}
