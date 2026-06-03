//tanjo-client\src-tauri\src\commands\crypto.rs
use tauri::command;
use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use rand::RngCore;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use dirs;

#[derive(Serialize, Deserialize)]
struct EncryptionMeta {
    key: String,
    created_at: String,
}

fn get_encryption_key_path() -> Result<PathBuf, String> {
    let app_data = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("TANJO");
    
    fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    Ok(app_data.join(".encryption_key"))
}

#[cfg(target_os = "windows")]
fn set_secure_permissions(_path: &PathBuf) -> Result<(), String> {
    Ok(())
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn set_secure_permissions(path: &PathBuf) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    
    let mut perms = fs::metadata(path)
        .map_err(|e| e.to_string())?
        .permissions();
    perms.set_mode(0o600);
    fs::set_permissions(path, perms)
        .map_err(|e| format!("Failed to set permissions: {}", e))?;
    
    Ok(())
}

fn get_or_create_encryption_key() -> Result<Vec<u8>, String> {
    let path = get_encryption_key_path()?;
    
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let meta: EncryptionMeta = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        return BASE64.decode(&meta.key).map_err(|e| e.to_string());
    }
    
    let mut key = vec![0u8; 32];
    OsRng.fill_bytes(&mut key);
    
    let meta = EncryptionMeta {
        key: BASE64.encode(&key),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    
    fs::write(&path, serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Failed to save encryption key: {}", e))?;
    
    set_secure_permissions(&path)?;
    
    Ok(key)
}

#[command]
pub async fn encrypt_data(plaintext: String) -> Result<String, String> {
    let key_bytes = get_or_create_encryption_key()?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);
    
    Ok(format!("enc:{}", BASE64.encode(&combined)))
}

#[command]
pub async fn decrypt_data(encrypted: String) -> Result<String, String> {
    if !encrypted.starts_with("enc:") {
        return Ok(encrypted);
    }
    
    let key_bytes = get_or_create_encryption_key()?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    
    let combined = BASE64.decode(&encrypted[4..]).map_err(|e| e.to_string())?;
    
    if combined.len() < 12 {
        return Err("Invalid encrypted data".to_string());
    }
    
    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let plaintext = cipher.decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    
    String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8: {}", e))
}