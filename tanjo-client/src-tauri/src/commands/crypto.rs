//tanjo-client\src-tauri\src\commands\crypto.rs
use tauri::command;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[cfg(target_os = "windows")]
mod platform {
    use std::ptr;
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
    };

    pub fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
        unsafe {
            let mut in_blob = CRYPT_INTEGER_BLOB {
                cbData: data.len() as u32,
                pbData: data.as_ptr() as *mut u8,
            };
            let mut out_blob: CRYPT_INTEGER_BLOB = std::mem::zeroed();

            let ok = CryptProtectData(
                &mut in_blob,
                ptr::null(),
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob,
            );

            if ok == 0 || out_blob.pbData.is_null() {
                return Err("CryptProtectData failed".to_string());
            }

            let result =
                std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec();
            LocalFree(out_blob.pbData as *mut core::ffi::c_void);
            Ok(result)
        }
    }

    pub fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
        unsafe {
            let mut in_blob = CRYPT_INTEGER_BLOB {
                cbData: data.len() as u32,
                pbData: data.as_ptr() as *mut u8,
            };
            let mut out_blob: CRYPT_INTEGER_BLOB = std::mem::zeroed();

            let ok = CryptUnprotectData(
                &mut in_blob,
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob,
            );

            if ok == 0 || out_blob.pbData.is_null() {
                return Err("CryptUnprotectData failed (data may belong to a different Windows user/machine, or be from an older app version)".to_string());
            }

            let result =
                std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec();
            LocalFree(out_blob.pbData as *mut core::ffi::c_void);
            Ok(result)
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    use aes_gcm::aead::{Aead, KeyInit, OsRng};
    use aes_gcm::{Aes256Gcm, Key, Nonce};
    use rand::RngCore;
    use serde::{Deserialize, Serialize};
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::path::PathBuf;

    #[derive(Serialize, Deserialize)]
    struct EncryptionMeta {
        key: String,
        created_at: String,
    }

    fn key_path() -> Result<PathBuf, String> {
        let app_data = dirs::data_dir()
            .ok_or("Failed to get data directory")?
            .join("TANJO");
        fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
        Ok(app_data.join(".encryption_key"))
    }

    fn get_or_create_key() -> Result<Vec<u8>, String> {
        let path = key_path()?;

        if path.exists() {
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let meta: EncryptionMeta =
                serde_json::from_str(&content).map_err(|e| e.to_string())?;
            return BASE64.decode(&meta.key).map_err(|e| e.to_string());
        }

        let mut key = vec![0u8; 32];
        OsRng.fill_bytes(&mut key);

        let meta = EncryptionMeta {
            key: BASE64.encode(&key),
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        fs::write(
            &path,
            serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?,
        )
        .map_err(|e| format!("Failed to save encryption key: {}", e))?;

        let mut perms = fs::metadata(&path).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o600);
        fs::set_permissions(&path, perms)
            .map_err(|e| format!("Failed to set permissions: {}", e))?;

        Ok(key)
    }

    use super::BASE64;

    pub fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
        let key_bytes = get_or_create_key()?;
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, data)
            .map_err(|e| format!("Encryption failed: {}", e))?;

        let mut combined = Vec::with_capacity(12 + ciphertext.len());
        combined.extend_from_slice(&nonce_bytes);
        combined.extend_from_slice(&ciphertext);
        Ok(combined)
    }

    pub fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
        if data.len() < 12 {
            return Err("Invalid encrypted data".to_string());
        }
        let key_bytes = get_or_create_key()?;
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);

        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| format!("Decryption failed: {}", e))
    }
}

#[cfg(target_os = "windows")]
pub fn cleanup_legacy_key_file() {
    if let Some(app_data) = dirs::data_dir() {
        let _ = std::fs::remove_file(app_data.join("TANJO").join(".encryption_key"));
    }
}

#[cfg(not(target_os = "windows"))]
pub fn cleanup_legacy_key_file() {}

#[command]
pub async fn encrypt_data(plaintext: String) -> Result<String, String> {
    let protected = platform::protect(plaintext.as_bytes())?;
    Ok(format!("enc:{}", BASE64.encode(&protected)))
}

#[command]
pub async fn decrypt_data(encrypted: String) -> Result<String, String> {
    if !encrypted.starts_with("enc:") {
        return Ok(encrypted);
    }

    let combined = BASE64.decode(&encrypted[4..]).map_err(|e| e.to_string())?;
    let plaintext = platform::unprotect(&combined)?;
    String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8: {}", e))
}
