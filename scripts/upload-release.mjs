// scripts/upload-release.mjs
import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bundleDir = path.join(__dirname, '..', '..', 'tanjo-client', 'src-tauri', 'target', 'release', 'bundle', 'nsis');

const files = [
  { 
    source: 'TANJO Game Store_0.1.3_x64-setup.exe', 
    dest: 'TANJO-Client-latest.exe' 
  },
  { 
    source: 'TANJO Game Store_0.1.3_x64-setup.exe.sig', 
    dest: 'TANJO-Client-latest.exe.sig' 
  },
];

async function uploadFiles() {
  console.log('📤 Загрузка на Vercel Blob (Public)...\n');
  console.log(`📁 Папка: ${bundleDir}\n`);

  if (!fs.existsSync(bundleDir)) {
    console.error(`❌ Папка не найдена: ${bundleDir}`);
    return;
  }

  for (const file of files) {
    const filePath = path.join(bundleDir, file.source);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Не найден: ${file.source}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const blobPath = `releases/${file.dest}`;

    try {
      const blob = await put(blobPath, fileBuffer, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true, 
      });

      console.log(`✅ Загружен: ${file.dest}`);
      console.log(`   URL: ${blob.url}`);
      console.log(`   Размер: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);
    } catch (error) {
      console.error(`❌ Ошибка загрузки ${file.dest}:`, error.message);
    }
  }

  console.log('🎉 Готово!');
}

uploadFiles();