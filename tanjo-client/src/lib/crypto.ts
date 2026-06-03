// src/lib/crypto.ts
import { invoke } from '@tauri-apps/api/core';
import { logger } from './logger'; 

const SENSITIVE_KEYS = ['auth_token', 'auth_wallet', 'refresh_token', 'wallet'];

export async function encryptSensitive(value: string): Promise<string> {
    try {
        return await invoke<string>('encrypt_data', { plaintext: value });
    } catch (error) {
        logger.error('Encryption failed:', error);
        throw new Error('Failed to encrypt data');
    }
}

export async function decryptSensitive(encrypted: string): Promise<string> {
    if (!encrypted.startsWith('enc:')) return encrypted;
    
    try {
        return await invoke<string>('decrypt_data', { encrypted });
    } catch (error) {
        logger.error('Decryption failed:', error);
        throw new Error('Failed to decrypt data');
    }
}

export function isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEYS.includes(key);
}