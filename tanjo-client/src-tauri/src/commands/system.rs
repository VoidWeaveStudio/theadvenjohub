// src-tauri/src/commands/system.rs
use tauri::command;
use serde::Serialize;
use dirs;
use uuid::Uuid;
use std::fs;
use std::path::PathBuf;
use serde_json;

#[derive(Serialize)]
pub struct DeviceInfo {
    pub device_id: String,
    pub hostname: String,
    pub app_data_path: String,
}

fn get_device_id_path() -> Result<PathBuf, String> {
    let app_data = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("TANJO");
    
    fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    
    Ok(app_data.join("device_id.json"))
}

fn get_or_create_device_id() -> Result<String, String> {
    let path = get_device_id_path()?;
    
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(id) = data["device_id"].as_str() {
                    return Ok(id.to_string());
                }
            }
        }
    }
    
    let hostname = get_hostname_internal()?;
    let device_id = format!("{}_{}", hostname, Uuid::new_v4().to_string()[..8].to_string());
    
    let data = serde_json::json!({
        "device_id": &device_id,
        "created_at": chrono::Utc::now().to_rfc3339()
    });
    
    fs::write(&path, serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Failed to save device_id: {}", e))?;
    
    Ok(device_id)
}

#[command]
pub async fn get_device_info() -> Result<DeviceInfo, String> {
    let hostname = get_hostname_internal()?;
    let device_id = get_or_create_device_id()?;
    
    let app_data_path = dirs::data_dir()
        .ok_or("Failed to get app data directory")?
        .join("TANJO")
        .to_string_lossy()
        .to_string();
    
    Ok(DeviceInfo {
        device_id,
        hostname,
        app_data_path,
    })
}

#[command]
pub fn get_hostname() -> Result<String, String> {
    get_hostname_internal()
}

fn get_hostname_internal() -> Result<String, String> {
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .ok_or_else(|| "Failed to get hostname".to_string())
}

#[command]
pub fn get_app_data_path() -> Result<String, String> {
    let path = dirs::data_dir()
        .ok_or("Failed to get data dir")?
        .join("TANJO");
    
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    
    Ok(path.to_string_lossy().to_string())
}