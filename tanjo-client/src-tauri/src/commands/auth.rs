//tanjo-client\src-tauri\src\commands\auth.rs
use tauri::{command, Window, Emitter};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct SignMessageRequest {
    pub message: String,
    pub wallet: String,
}

#[allow(dead_code)]
#[derive(Serialize)]
pub struct SignMessageResponse {
    pub signature: String,
}

#[command]
pub async fn open_phantom_sign_window(
    window: Window,
    request: SignMessageRequest,
) -> Result<(), String> {
    let _ = window.emit("phantom_sign_request", &request);
    Ok(())
}

#[command]
pub async fn emit_signature_callback(
    window: Window,
    signature: String,
) -> Result<(), String> {
    let _ = window.emit("phantom_signature_received", signature);
    Ok(())
}