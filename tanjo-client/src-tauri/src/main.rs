//tanjo-client\src-tauri\src\main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_deep_link::DeepLinkExt;
use tauri::Emitter;
use tauri::Manager; 

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            #[cfg(debug_assertions)]
            println!("Second instance started, focusing first instance");
            
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                
                if !argv.is_empty() {
                    if let Some(url) = argv.iter().find(|arg| arg.starts_with("tanjo://")) {
                        let _ = window.emit("deep-link-received", url);
                    }
                }
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            commands::crypto::encrypt_data,
            commands::crypto::decrypt_data,
            commands::games::launch_game,
            commands::games::check_game_updates,
            commands::games::get_installed_games,
            commands::games::mark_game_installed,
            commands::system::get_device_info,
            commands::system::get_hostname,
            commands::system::get_app_data_path,
            commands::auth::open_phantom_sign_window,
            commands::auth::emit_signature_callback,
            commands::updater::check_app_update,
            commands::updater::install_app_update,
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.deep_link().register("tanjo")?;
                
                let handle = app.handle().clone();
                
                app.deep_link().on_open_url(move |event| {
    for url in event.urls() {
        let url_string = url.to_string();
        
        let _safe_url = url_string.split('?').next().unwrap_or(&url_string);
        
        #[cfg(debug_assertions)]
        println!("🚀 Deep link received: {}", _safe_url);
        
        let _ = handle.emit("deep-link-received", url_string);
    }
});
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}