//tanjo-client\src-tauri\src\commands\updater.rs
use tauri::command;
use tauri_plugin_updater::UpdaterExt;
use serde::Serialize;

#[derive(Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub current_version: String,
    pub body: Option<String>,
    pub date: Option<String>,
}

#[command]
pub async fn check_app_update(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    
    match updater.check().await {
        Ok(Some(update)) => {
            #[cfg(debug_assertions)]
            println!("Update available: {} -> {}", update.current_version, update.version);
            
            Ok(UpdateInfo {
                available: true,
                version: Some(update.version.clone()),
                current_version: update.current_version.clone(),
                body: update.body.clone(),
                date: update.date.map(|d| d.to_string()),
            })
        }
        Ok(None) => {
            #[cfg(debug_assertions)]
            println!("No updates available, current version: {}", env!("CARGO_PKG_VERSION"));
            
            Ok(UpdateInfo {
                available: false,
                version: None,
                current_version: env!("CARGO_PKG_VERSION").to_string(),
                body: None,
                date: None,
            })
        }
        Err(e) => {
            #[cfg(debug_assertions)]
            println!("Update check failed: {}", e);
            
            Err(format!("Update check failed: {}", e))
        }
    }
}

#[command]
pub async fn install_app_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    
    let update = updater.check().await
        .map_err(|e| e.to_string())?
        .ok_or("No update available")?;
    
    let mut downloaded = 0usize;
    
    let bytes = update.download(
    |chunk_length, content_length| {
        downloaded += chunk_length;
        let total = content_length.unwrap_or(0);
        
        let _progress = if total > 0 {
            (downloaded as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        
        #[cfg(debug_assertions)]
        println!("Download progress: {:.1}%", _progress);
    },
    || {
        #[cfg(debug_assertions)]
        println!("Download completed");
    }
).await.map_err(|e| e.to_string())?;
    
    update.install(&bytes).map_err(|e| e.to_string())?;
    
    #[cfg(debug_assertions)]
    println!("Update installed, restarting...");
    
    app.restart();
}