import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const releasesDir = path.join(__dirname, '..', 'releases');

const files = [
  'TANJO-Client-latest.exe',
  'TANJO-Client-latest.msi',
];

async function uploadFiles() {
  console.log('📤 Загрузка файлов в Vercel Blob (Private)...\n');

  for (const filename of files) {
    const filePath = path.join(releasesDir, filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Файл не найден: ${filename}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const blobPath = `releases/${filename}`;

    try {
      const blob = await put(blobPath, fileBuffer, {
        access: 'private',
        addRandomSuffix: false,
      });

      console.log(`✅ Загружен: ${filename}`);
      console.log(`   Pathname: ${blob.pathname}`);
      console.log(`   URL: ${blob.url}`);
      console.log(`   Размер: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);
    } catch (error) {
      console.error(`❌ Ошибка загрузки ${filename}:`, error.message);
    }
  }

  console.log('🎉 Загрузка завершена!');
}

uploadFiles();