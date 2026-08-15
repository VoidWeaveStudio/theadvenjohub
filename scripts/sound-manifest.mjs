import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SFX_DIR = path.join(HERE, '..', 'public', 'sounds', 'sfx');
const OUTPUT = path.join(SFX_DIR, 'manifest.json');

const PLAYABLE = new Set(['.ogg', '.flac', '.mp3', '.wav']);
const PRIORITY = ['.ogg', '.mp3', '.wav', '.flac'];

if (!fs.existsSync(SFX_DIR)) {
    console.error(`нет папки ${SFX_DIR}`);
    process.exit(1);
}

const found = new Map();

for (const file of fs.readdirSync(SFX_DIR)) {
    const extension = path.extname(file).toLowerCase();
    if (!PLAYABLE.has(extension)) continue;

    const name = path.basename(file, extension);
    const current = found.get(name);
    if (current && PRIORITY.indexOf(current) <= PRIORITY.indexOf(extension)) continue;

    found.set(name, extension);
}

const manifest = {};
for (const name of [...found.keys()].sort()) {
    manifest[name] = found.get(name).slice(1);
}

fs.writeFileSync(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`записано ${Object.keys(manifest).length} звуков в ${path.relative(process.cwd(), OUTPUT)}`);
