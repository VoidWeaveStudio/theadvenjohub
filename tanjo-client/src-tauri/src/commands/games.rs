//tanjo-client\src-tauri\src\commands\games.rs
use tauri::command;
use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use std::process::Command;
use dirs;

#[derive(Serialize, Deserialize)]
pub struct GameInstallInfo {
    pub slug: String,
    pub version: String,
    pub install_path: String,
    pub executable: String,
}

#[derive(Serialize)]
pub struct UpdateCheckResult {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub download_url: Option<String>,
    pub changelog: Option<String>,
}

#[command]
pub async fn launch_game(slug: String) -> Result<(), String> {
    if !slug.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') || slug.is_empty() {
        return Err("Invalid game slug format".to_string());
    }

    let games_dir = get_games_directory()?;
    let game_path = games_dir.join(&slug);
    
    #[cfg(target_os = "windows")]
    let exe_name = "Game.exe";
    #[cfg(target_os = "macos")]
    let exe_name = "Game.app/Contents/MacOS/Game";
    #[cfg(target_os = "linux")]
    let exe_name = "Game";
    
    let exe_path = game_path.join(exe_name);
    
    if !exe_path.exists() {
        return Err(format!("Game executable not found: {}", exe_path.display()));
    }
    
    Command::new(&exe_path)
        .current_dir(&game_path)
        .spawn()
        .map_err(|e| format!("Failed to launch game: {}", e))?;
    
    Ok(())
}

#[command]
pub async fn check_game_updates(_slug: String) -> Result<UpdateCheckResult, String> {
    Ok(UpdateCheckResult {
        has_update: false,
        current_version: "1.0.0".to_string(),
        latest_version: "1.0.0".to_string(),
        download_url: None,
        changelog: None,
    })
}

#[command]
pub async fn get_installed_games() -> Result<Vec<GameInstallInfo>, String> {
    let games_dir = get_games_directory()?;
    let mut games = Vec::new();
    
    if games_dir.exists() {
        for entry in std::fs::read_dir(&games_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            
            if path.is_dir() {
                let _slug = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                
                let config_path = path.join("install.json");
                if config_path.exists() {
                    if let Ok(config) = std::fs::read_to_string(&config_path) {
                        if let Ok(info) = serde_json::from_str::<GameInstallInfo>(&config) {
                            games.push(info);
                        }
                    }
                }
            }
        }
    }
    
    Ok(games)
}

#[command]
pub async fn mark_game_installed(info: GameInstallInfo) -> Result<(), String> {
    let games_dir = get_games_directory()?;
    let game_path = games_dir.join(&info.slug);
    
    std::fs::create_dir_all(&game_path).map_err(|e| e.to_string())?;
    
    let config_path = game_path.join("install.json");
    let config = serde_json::to_string_pretty(&info).map_err(|e| e.to_string())?;
    
    std::fs::write(config_path, config).map_err(|e| e.to_string())?;
    
    Ok(())
}

fn get_games_directory() -> Result<PathBuf, String> {
    Ok(dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("TANJO")
        .join("games"))
}