// scripts/prepare-nature-pack.mjs
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, prune } from "@gltf-transform/functions";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const INSPECT_ONLY = process.argv.includes("--inspect");
const SOURCE_DIR = process.argv[2];
const OUT_DIR = path.join(process.cwd(), "public", "models", "nature");


const PROPS = [
    { file: "stylized_tree_1.glb", name: "tree-a", height: 8.5 },
    { file: "low_poly_shrub_-_small_texture.glb", name: "bush-a", height: 1.8 },
    { file: "stylized_yellow_bush.glb", name: "bush-b", height: 1.4 },
    { file: "low_poly_shrub_or_grass_clover.glb", name: "clover-a", height: 0.38 },
    { file: "grass_green.glb", name: "grass-a", height: 0.9 },
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function measure(document) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    let triangles = 0;

    for (const mesh of document.getRoot().listMeshes()) {
        for (const primitive of mesh.listPrimitives()) {
            const position = primitive.getAttribute("POSITION");
            const array = position.getArray();

            for (let i = 0; i < array.length; i += 3) {
                for (let axis = 0; axis < 3; axis++) {
                    const value = array[i + axis];
                    if (value < min[axis]) min[axis] = value;
                    if (value > max[axis]) max[axis] = value;
                }
            }

            const indices = primitive.getIndices();
            triangles += (indices ? indices.getCount() : position.getCount()) / 3;
        }
    }

    return { min, max, triangles: Math.round(triangles) };
}

function transformPositions(document, matrix) {
    const seen = new Set();

    for (const mesh of document.getRoot().listMeshes()) {
        for (const primitive of mesh.listPrimitives()) {
            for (const name of ["POSITION", "NORMAL"]) {
                const accessor = primitive.getAttribute(name);
                if (!accessor || seen.has(accessor)) continue;
                seen.add(accessor);

                const array = accessor.getArray();
                const isNormal = name === "NORMAL";

                for (let i = 0; i < array.length; i += 3) {
                    const point = matrix(array[i], array[i + 1], array[i + 2], isNormal);
                    array[i] = point[0];
                    array[i + 1] = point[1];
                    array[i + 2] = point[2];
                }

                accessor.setArray(array);
            }
        }
    }
}

function bakeWorldTransforms(document) {
    const meshUsage = new Map();

    for (const node of document.getRoot().listNodes()) {
        const mesh = node.getMesh();
        if (mesh) meshUsage.set(mesh, (meshUsage.get(mesh) ?? 0) + 1);
    }

    const baked = new Set();

    for (const node of document.getRoot().listNodes()) {
        const mesh = node.getMesh();
        if (!mesh || baked.has(mesh)) continue;
        if ((meshUsage.get(mesh) ?? 0) > 1) continue;

        const m = node.getWorldMatrix();
        baked.add(mesh);

        const seen = new Set();
        for (const primitive of mesh.listPrimitives()) {
            const position = primitive.getAttribute("POSITION");
            if (position && !seen.has(position)) {
                seen.add(position);
                const array = position.getArray();
                for (let i = 0; i < array.length; i += 3) {
                    const x = array[i];
                    const y = array[i + 1];
                    const z = array[i + 2];
                    array[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
                    array[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
                    array[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
                }
                position.setArray(array);
            }

            const normal = primitive.getAttribute("NORMAL");
            if (normal && !seen.has(normal)) {
                seen.add(normal);
                const array = normal.getArray();
                for (let i = 0; i < array.length; i += 3) {
                    const x = array[i];
                    const y = array[i + 1];
                    const z = array[i + 2];
                    const nx = m[0] * x + m[4] * y + m[8] * z;
                    const ny = m[1] * x + m[5] * y + m[9] * z;
                    const nz = m[2] * x + m[6] * y + m[10] * z;
                    const length = Math.hypot(nx, ny, nz) || 1;
                    array[i] = nx / length;
                    array[i + 1] = ny / length;
                    array[i + 2] = nz / length;
                }
                normal.setArray(array);
            }
        }

        node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    }
}

async function load(file) {
    const document = await io.read(file);
    await document.transform(flatten());
    bakeWorldTransforms(document);
    return document;
}

async function inspect() {
    for (const prop of PROPS) {
        const file = path.join(SOURCE_DIR, prop.file);
        if (!fs.existsSync(file)) {
            console.log(`${prop.file} — MISSING`);
            continue;
        }

        const document = await load(file);
        const { min, max, triangles } = measure(document);
        const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];

        const textures = document.getRoot().listTextures().map((texture) => {
            const image = texture.getImage();
            return `${texture.getMimeType()?.replace("image/", "") ?? "?"}:${image ? Math.round(image.byteLength / 1024) : 0}KB`;
        });

        console.log(
            prop.file.padEnd(38),
            `tris ${String(triangles).padStart(6)}`,
            `size ${size.map((v) => v.toFixed(2)).join(" x ")}`.padEnd(28),
            `meshes ${document.getRoot().listMeshes().length}`,
            `mats ${document.getRoot().listMaterials().length}`,
            `tex [${textures.join(" ")}]`
        );
    }
}

async function build(prop) {
    const source = path.join(SOURCE_DIR, prop.file);
    const document = await load(source);

    const before = measure(document);
    const height = before.max[1] - before.min[1];
    const scale = height > 0 ? prop.height / height : 1;
    const offsetX = -(before.min[0] + before.max[0]) / 2;
    const offsetZ = -(before.min[2] + before.max[2]) / 2;
    const offsetY = -before.min[1];

    transformPositions(document, (x, y, z, isNormal) =>
        isNormal ? [x, y, z] : [(x + offsetX) * scale, (y + offsetY) * scale, (z + offsetZ) * scale]
    );

    await document.transform(prune(), dedup());

    const after = measure(document);
    const outPath = path.join(OUT_DIR, `${prop.name}.glb`);
    await io.write(outPath, document);

    console.log(
        `${prop.name}.glb`.padEnd(16),
        `tris ${String(after.triangles).padStart(6)}`,
        `meshes ${document.getRoot().listMeshes().length}`,
        `mats ${document.getRoot().listMaterials().length}`,
        `height ${(after.max[1] - after.min[1]).toFixed(2)}m`,
        `${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`
    );
}

async function main() {
    if (!SOURCE_DIR || !fs.existsSync(SOURCE_DIR)) {
        console.error("usage: node scripts/prepare-nature-pack.mjs <source-dir> [--inspect]");
        process.exit(1);
    }

    if (INSPECT_ONLY) {
        await inspect();
        return;
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const prop of PROPS) {
        if (!fs.existsSync(path.join(SOURCE_DIR, prop.file))) {
            console.log(`${prop.file} — MISSING, skipped`);
            continue;
        }
        await build(prop);
    }

    console.log("\nconverting textures...");
    execFileSync(process.execPath, [path.join("scripts", "optimize-assets.js"), "public/models/nature"], {
        stdio: "inherit",
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
