// scripts/optimize-assets.js
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { glob } from "glob";

const WEBP_OPTIONS = { quality: 90, effort: 6 };
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

async function convertGlb(file) {
    const before = fs.statSync(file).size;
    const doc = await io.read(file);
    doc.createExtension(EXTTextureWebP);
    let changed = false;
    for (const tex of doc.getRoot().listTextures()) {
        if (tex.getMimeType() === "image/webp") continue;
        const image = tex.getImage();
        if (!image) continue;
        const webpBuf = await sharp(Buffer.from(image)).webp(WEBP_OPTIONS).toBuffer();
        tex.setImage(new Uint8Array(webpBuf));
        tex.setMimeType("image/webp");
        changed = true;
    }
    if (!changed) return;
    const glb = await io.writeBinary(doc);
    fs.writeFileSync(file, Buffer.from(glb));
    const after = fs.statSync(file).size;
    console.log(`${path.relative(process.cwd(), file)}: ${before} -> ${after} (${Math.round((100 * after) / before)}%)`);
}

async function convertStandaloneImage(file) {
    const before = fs.statSync(file).size;
    const out = file.replace(/\.(jpe?g|png)$/i, ".webp");
    await sharp(file).webp(WEBP_OPTIONS).toFile(out);
    const after = fs.statSync(out).size;
    console.log(`${path.relative(process.cwd(), file)} -> ${path.relative(process.cwd(), out)}: ${before} -> ${after} (${Math.round((100 * after) / before)}%)`);
}

async function main() {
    const root = process.argv[2] || "public/models";

    const glbFiles = await glob(`${root}/**/*.glb`);
    for (const file of glbFiles) {
        await convertGlb(file);
    }

    const imageFiles = await glob(`${root}/**/*.{jpg,jpeg,png}`);
    for (const file of imageFiles) {
        await convertStandaloneImage(file);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
