//scripts\copy-release.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tauriBundleDir = path.join(__dirname, '..', 'tanjo-client', 'src-tauri', 'target', 'release', 'bundle');
const releasesDir = path.join(__dirname, '..', 'releases');

if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true });
}

const platforms = [
  { bundle: 'nsis', pattern: /\.exe$/, target: 'TANJO-Client-latest.exe' },
  { bundle: 'msi', pattern: /\.msi$/, target: 'TANJO-Client-latest.msi' },
  { bundle: 'dmg', pattern: /\.dmg$/, target: 'TANJO-Client-latest.dmg' },
  { bundle: 'appimage', pattern: /\.AppImage$/, target: 'TANJO-Client-latest.AppImage' },
];

let copiedCount = 0;

platforms.forEach(({ bundle, pattern, target }) => {
  const bundlePath = path.join(tauriBundleDir, bundle);
  
  if (!fs.existsSync(bundlePath)) {
    console.log(`⚠️  Bundle directory not found: ${bundle}`);
    return;
  }

  const files = fs.readdirSync(bundlePath);
  
  const installer = files.find(f => pattern.test(f));
  
  if (installer) {
    const sourcePath = path.join(bundlePath, installer);
    const targetPath = path.join(releasesDir, target);
    
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`✅ Copied ${installer} → ${target}`);
    copiedCount++;

    const sigFile = installer + '.sig';
    const sigSourcePath = path.join(bundlePath, sigFile);
    if (fs.existsSync(sigSourcePath)) {
      const sigTargetPath = targetPath + '.sig';
      fs.copyFileSync(sigSourcePath, sigTargetPath);
      console.log(`✅ Copied signature: ${sigFile}`);
    } else {
      console.log(`⚠️  Signature file not found: ${sigFile}`);
    }
  }
});

if (copiedCount === 0) {
  console.error('❌ No installer files found. Run `npm run tauri build` first.');
  process.exit(1);
}

console.log(`\n🎉 Successfully copied ${copiedCount} file(s) to releases/`);