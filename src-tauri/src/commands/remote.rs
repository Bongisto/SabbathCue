use std::sync::{Arc, Mutex};

use serde::Deserialize as _;
use tauri::{AppHandle, Emitter, State};

use rhema_api::{
    new_shared_status, start_http_server, start_osc_listener, start_osc_listener_with_token,
    update_shared_http_token, CommandError, CommandSink, HttpConfig, HttpHandle, OscConfig,
    OscHandle, SharedHttpToken, SharedStatus,
};

use super::validation::{
    bounded_text, valid_confidence_threshold, valid_port, MAX_QUEUE_LENGTH, MAX_STATUS_TEXT_BYTES,
};
use crate::commands::secrets;

/// Tauri-aware implementation of `CommandSink`.
///
/// Routes frontend-bound commands as Tauri events (`app.emit()`)
/// and backend-bound commands as Tauri command invocations.
struct TauriSink {
    app: AppHandle,
}

fn map_backend_remote_action(action: &str) -> Result<(&'static str, bool), CommandError> {
    match action {
        "show_broadcast" => Ok(("remote:show", false)),
        "hide_broadcast" => Ok(("remote:hide", false)),
        "set_confidence" => Ok(("remote:confidence", true)),
        _ => Err(CommandError::DispatchFailed(format!(
            "Unknown backend action: {action}"
        ))),
    }
}

impl CommandSink for TauriSink {
    fn emit_event(&self, event: &str, payload: &str) -> Result<(), CommandError> {
        self.app
            .emit(event, payload.to_string())
            .map_err(|e| CommandError::DispatchFailed(format!("Tauri emit failed: {e}")))
    }

    fn invoke_backend(&self, action: &str, args: &str) -> Result<(), CommandError> {
        let (event, uses_args) = map_backend_remote_action(action)?;
        if action == "show_broadcast" {
            log::info!("Remote control: show broadcast");
        } else if action == "hide_broadcast" {
            log::info!("Remote control: hide broadcast");
        }
        let payload = if uses_args {
            args.to_string()
        } else {
            "{}".to_string()
        };
        self.app
            .emit(event, payload)
            .map_err(|e| CommandError::DispatchFailed(e.to_string()))
    }
}

// --- OSC Runtime ---

/// Managed state for the OSC runtime.
pub struct OscRuntime {
    handle: Option<OscHandle>,
    bound_port: Option<u16>,
    token: Option<SharedHttpToken>,
}

impl OscRuntime {
    pub fn new() -> Self {
        Self {
            handle: None,
            bound_port: None,
            token: None,
        }
    }
}

impl Default for OscRuntime {
    fn default() -> Self {
        Self::new()
    }
}

/// Start the OSC listener on the given port.
#[tauri::command]
pub async fn start_osc(
    app: AppHandle,
    state: State<'_, Mutex<OscRuntime>>,
    http_state: State<'_, Mutex<HttpRuntime>>,
    port: Option<u16>,
) -> Result<u16, String> {
    // Reuse the HTTP runtime's live token cell when HTTP is already running so
    // both servers share the exact same Arc<RwLock<String>>. Drop the HTTP lock
    // before acquiring the OSC lock to avoid any lock-ordering cycle.
    let shared_http_token = {
        let http_runtime = http_state.lock().map_err(|e| e.to_string())?;
        http_runtime.shared_token()
    };

    let mut runtime = state.lock().map_err(|e| e.to_string())?;

    if runtime.handle.is_some() {
        return Err("OSC listener is already running".into());
    }

    // Source the shared remote-control token (same secret as the HTTP API)
    // so the OSC surface authenticates like HTTP does.
    let token = (|| -> Result<String, String> {
        secrets::ensure_remote_http_token_exists()?;
        secrets::get_remote_http_token()
    })()?;

    let config = OscConfig {
        port: valid_port(port, 8000)?,
        host: "127.0.0.1".into(),
        token: Some(token),
    };

    let sink = Arc::new(TauriSink { app });
    let result = if let Some(shared_token) = shared_http_token {
        start_osc_listener_with_token(&config, sink, shared_token)
    } else {
        start_osc_listener(config, sink)
    }
    .map_err(|e| e.to_string())?;

    let bound_port = result.bound_port;
    runtime.handle = Some(result.handle);
    runtime.bound_port = Some(bound_port);
    runtime.token = Some(result.token);

    log::info!("OSC listener started on port {bound_port}");
    Ok(bound_port)
}

/// Stop the OSC listener.
#[tauri::command]
pub async fn stop_osc(state: State<'_, Mutex<OscRuntime>>) -> Result<(), String> {
    let mut handle = {
        let mut runtime = state.lock().map_err(|e| e.to_string())?;
        match runtime.handle.take() {
            Some(handle) => {
                runtime.bound_port = None;
                runtime.token = None;
                handle
            }
            None => return Err("OSC listener is not running".into()),
        }
    };

    // Join the listener thread off the async worker: stop() blocks up to
    // one read-timeout (100 ms), which must not stall unrelated tasks.
    tauri::async_runtime::spawn_blocking(move || handle.stop())
        .await
        .map_err(|e| e.to_string())?;

    log::info!("OSC listener stopped");
    Ok(())
}

/// Get the current OSC listener status.
#[tauri::command]
pub async fn get_osc_status(state: State<'_, Mutex<OscRuntime>>) -> Result<OscStatus, String> {
    let runtime = state.lock().map_err(|e| e.to_string())?;

    Ok(OscStatus {
        running: runtime
            .handle
            .as_ref()
            .is_some_and(rhema_api::OscHandle::is_active),
        port: runtime.bound_port,
    })
}

#[derive(serde::Serialize)]
pub struct OscStatus {
    pub running: bool,
    pub port: Option<u16>,
}

// --- HTTP Runtime ---

/// Managed state for the HTTP API runtime.
pub struct HttpRuntime {
    handle: Option<HttpHandle>,
    bound_port: Option<u16>,
    status: SharedStatus,
    token: Option<SharedHttpToken>,
    starting: bool,
}

impl HttpRuntime {
    pub fn new() -> Self {
        Self {
            handle: None,
            bound_port: None,
            status: new_shared_status(),
            token: None,
            starting: false,
        }
    }

    pub fn shared_status(&self) -> SharedStatus {
        self.status.clone()
    }

    fn shared_token(&self) -> Option<SharedHttpToken> {
        self.token.clone()
    }
}

impl Default for HttpRuntime {
    fn default() -> Self {
        Self::new()
    }
}

/// Start the HTTP API server on the given port.
#[tauri::command]
pub async fn start_http(
    app: AppHandle,
    state: State<'_, Mutex<HttpRuntime>>,
    port: Option<u16>,
) -> Result<u16, String> {
    let port = valid_port(port, 8080)?;
    let status = {
        let mut runtime = state.lock().map_err(|e| e.to_string())?;
        if runtime.handle.is_some() || runtime.starting {
            return Err("HTTP API server is already running".into());
        }
        runtime.starting = true;
        runtime.shared_status()
    };

    let token = match (|| -> Result<String, String> {
        let _created = secrets::ensure_remote_http_token_exists()?;
        secrets::get_remote_http_token()
    })() {
        Ok(token) => token,
        Err(error) => {
            let mut runtime = state.lock().map_err(|e| e.to_string())?;
            runtime.starting = false;
            return Err(error);
        }
    };

    let config = HttpConfig {
        port,
        host: "127.0.0.1".into(),
        token,
    };

    let sink = Arc::new(TauriSink { app });
    let result = match start_http_server(config, sink, status).await {
        Ok(result) => result,
        Err(error) => {
            let mut runtime = state.lock().map_err(|e| e.to_string())?;
            runtime.starting = false;
            return Err(error.to_string());
        }
    };

    let bound_port = result.bound_port;

    {
        let mut runtime = state.lock().map_err(|e| e.to_string())?;
        runtime.handle = Some(result.handle);
        runtime.bound_port = Some(bound_port);
        runtime.token = Some(result.token);
        runtime.starting = false;
    }

    log::info!("HTTP API server started on port {bound_port}");
    Ok(bound_port)
}

/// Stop the HTTP API server.
#[tauri::command]
pub async fn stop_http(state: State<'_, Mutex<HttpRuntime>>) -> Result<(), String> {
    let mut runtime = state.lock().map_err(|e| e.to_string())?;

    match runtime.handle.take() {
        Some(mut handle) => {
            handle.stop();
            runtime.bound_port = None;
            runtime.token = None;
            log::info!("HTTP API server stopped");
            Ok(())
        }
        None => Err("HTTP API server is not running".into()),
    }
}

/// Rotate the remote control token and apply it to any running HTTP and OSC servers.
#[tauri::command]
pub async fn rotate_remote_http_token(
    state: State<'_, Mutex<HttpRuntime>>,
    osc_state: State<'_, Mutex<OscRuntime>>,
) -> Result<String, String> {
    let token = secrets::rotate_remote_http_token()?;
    let http_token = {
        let runtime = state.lock().map_err(|e| e.to_string())?;
        runtime.token.clone()
    };
    let osc_token = {
        let runtime = osc_state.lock().map_err(|e| e.to_string())?;
        runtime.token.clone()
    };

    if let Some(shared_token) = http_token.as_ref() {
        update_shared_http_token(shared_token, token.clone()).await;
    }
    if let Some(shared_token) = osc_token.as_ref() {
        let same_cell = http_token
            .as_ref()
            .is_some_and(|http| Arc::ptr_eq(http, shared_token));
        if !same_cell {
            update_shared_http_token(shared_token, token.clone()).await;
        }
    }

    Ok(token)
}

/// Get the current HTTP API server status.
#[tauri::command]
pub async fn get_http_status(state: State<'_, Mutex<HttpRuntime>>) -> Result<HttpStatus, String> {
    let runtime = state.lock().map_err(|e| e.to_string())?;

    Ok(HttpStatus {
        running: runtime
            .handle
            .as_ref()
            .is_some_and(rhema_api::HttpHandle::is_active),
        port: runtime.bound_port,
    })
}

fn deserialize_optional_nullable_string<'de, D>(
    deserializer: D,
) -> Result<Option<Option<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    serde::Deserialize::deserialize(deserializer).map(Some)
}

#[derive(Debug, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteStatusUpdate {
    #[serde(default, alias = "on_air")]
    on_air: Option<bool>,
    #[serde(
        default,
        alias = "active_theme",
        deserialize_with = "deserialize_optional_nullable_string"
    )]
    active_theme: Option<Option<String>>,
    #[serde(
        default,
        alias = "live_verse",
        deserialize_with = "deserialize_optional_nullable_string"
    )]
    live_verse: Option<Option<String>>,
    #[serde(default, alias = "queue_length")]
    queue_length: Option<usize>,
    #[serde(default, alias = "confidence_threshold")]
    confidence_threshold: Option<f32>,
}

fn apply_remote_status_update(
    snapshot: &mut rhema_api::StatusSnapshot,
    update: RemoteStatusUpdate,
) -> Result<(), String> {
    if let Some(v) = update.on_air {
        snapshot.on_air = v;
    }
    if let Some(v) = update.active_theme {
        match v {
            Some(theme) => {
                bounded_text(&theme, "active_theme", MAX_STATUS_TEXT_BYTES)?;
                snapshot.active_theme = Some(theme);
            }
            None => snapshot.active_theme = None,
        }
    }
    if let Some(v) = update.live_verse {
        match v {
            Some(verse) => {
                bounded_text(&verse, "live_verse", MAX_STATUS_TEXT_BYTES)?;
                snapshot.live_verse = Some(verse);
            }
            None => snapshot.live_verse = None,
        }
    }
    if let Some(v) = update.queue_length {
        if v > MAX_QUEUE_LENGTH {
            return Err(format!("queue_length must be <= {MAX_QUEUE_LENGTH}"));
        }
        snapshot.queue_length = v;
    }
    if let Some(v) = update.confidence_threshold {
        snapshot.confidence_threshold = valid_confidence_threshold(v)?;
    }

    Ok(())
}

/// Update the status snapshot from the frontend.
#[tauri::command]
pub async fn update_remote_status(
    state: State<'_, Mutex<HttpRuntime>>,
    request: tauri::ipc::Request<'_>,
) -> Result<(), String> {
    let update = match request.body() {
        tauri::ipc::InvokeBody::Json(value) => RemoteStatusUpdate::deserialize(value)
            .map_err(|e| format!("Invalid remote status payload: {e}"))?,
        tauri::ipc::InvokeBody::Raw(_) => {
            return Err("update_remote_status expects a JSON body".to_string());
        }
    };

    let status = {
        let runtime = state.lock().map_err(|e| e.to_string())?;
        runtime.shared_status()
    };

    let mut snapshot = status.write().await;
    apply_remote_status_update(&mut snapshot, update)
}

#[derive(serde::Serialize)]
pub struct HttpStatus {
    pub running: bool,
    pub port: Option<u16>,
}

#[cfg(test)]
mod tests {
    use super::{apply_remote_status_update, map_backend_remote_action, RemoteStatusUpdate};
    use rhema_api::{CommandError, StatusSnapshot};
    use serde::Deserialize as _;

    #[test]
    fn maps_show_and_hide_actions() {
        assert_eq!(
            map_backend_remote_action("show_broadcast").unwrap(),
            ("remote:show", false)
        );
        assert_eq!(
            map_backend_remote_action("hide_broadcast").unwrap(),
            ("remote:hide", false)
        );
    }

    #[test]
    fn maps_confidence_action_with_args() {
        assert_eq!(
            map_backend_remote_action("set_confidence").unwrap(),
            ("remote:confidence", true)
        );
    }

    #[test]
    fn rejects_unknown_backend_action() {
        let err = map_backend_remote_action("toggle_lasers").unwrap_err();
        assert!(
            matches!(err, CommandError::DispatchFailed(message) if message.contains("Unknown backend action"))
        );
    }

    #[test]
    fn update_remote_status_preserves_omitted_and_clears_explicit_null() {
        let mut snapshot = StatusSnapshot::default();

        let initial_json = serde_json::json!({
            "onAir": true,
            "activeTheme": "Classic Dark",
            "liveVerse": "John 3:16",
            "queueLength": 2,
            "confidenceThreshold": 0.75
        });
        let initial = RemoteStatusUpdate::deserialize(&initial_json).unwrap();
        apply_remote_status_update(&mut snapshot, initial).unwrap();
        assert!(snapshot.on_air);
        assert_eq!(snapshot.active_theme.as_deref(), Some("Classic Dark"));
        assert_eq!(snapshot.live_verse.as_deref(), Some("John 3:16"));

        // Omitted optional fields must preserve existing values.
        let omitted_json = serde_json::json!({
            "onAir": false
        });
        let omitted = RemoteStatusUpdate::deserialize(&omitted_json).unwrap();
        apply_remote_status_update(&mut snapshot, omitted).unwrap();
        assert!(!snapshot.on_air);
        assert_eq!(snapshot.active_theme.as_deref(), Some("Classic Dark"));
        assert_eq!(snapshot.live_verse.as_deref(), Some("John 3:16"));

        // Explicit JSON null must clear live_verse and active_theme.
        let cleared_json = serde_json::json!({
            "onAir": false,
            "activeTheme": null,
            "liveVerse": null,
            "queueLength": 0,
            "confidenceThreshold": 0.75
        });
        let cleared = RemoteStatusUpdate::deserialize(&cleared_json).unwrap();
        apply_remote_status_update(&mut snapshot, cleared).unwrap();
        assert_eq!(snapshot.active_theme, None);
        assert_eq!(snapshot.live_verse, None);
    }
}
