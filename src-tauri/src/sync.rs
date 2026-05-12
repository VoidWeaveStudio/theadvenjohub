use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};
use reqwest;
use tokio;

#[derive(Serialize, Deserialize, Debug)]
pub struct LibraryItem {
    pub game_id: String,
    pub game_slug: String,
    pub game_title: String,
    pub purchased_at: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct InventoryItem {
    pub lot_id: Option<String>,
    pub item_name: Option<String>,
    pub item_type: Option<String>,
    pub game_id: Option<String>,
    pub status: String,
    pub acquired_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SyncResponse {
    pub library: Vec<LibraryItem>,
    pub inventory: Vec<InventoryItem>,
    pub user: UserInfo,
    pub sync_timestamp: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UserInfo {
    pub wallet: String,
}

#[derive(Serialize)]
pub struct SyncResult {
    pub success: bool,
}

fn get_auth_token(app: &AppHandle) -> Result<String, String> {
    app.state::<String>()
        .get("auth_token")
        .cloned()
        .ok_or_else(|| "Auth token not found".into())
}

fn save_to_local_store<T: Serialize>(
    app: &AppHandle, 
    key: &str, 
    data: &T
) -> Result<(), String> {
    app.emit("data_saved", serde_json::json!({ "key": key }))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sync_library(app: AppHandle) -> Result<SyncResult, String> {
    let token = get_auth_token(&app)?;
    let api_url = std::env::var("API_URL")
        .unwrap_or_else(|_| "https://api.tanjo.store".to_string());
    
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/api/client/sync", api_url))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if !res.status().is_success() {
        return Err(format!("API error: {}", res.status()));
    }
    
    let sync_data: SyncResponse = res
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;
    
    save_to_local_store(&app, "library", &sync_data.library)?;
    save_to_local_store(&app, "inventory", &sync_data.inventory)?;
    
    app.emit("library_updated", &sync_data)
        .map_err(|e| format!("Emit error: {}", e))?;
    
    Ok(SyncResult { success: true })
}