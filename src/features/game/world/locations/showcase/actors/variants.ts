// src/features/game/world/locations/showcase/actors/variants.ts
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { RegionPalette } from "../../../../entities/characterRegions";

export const HEAD_TOP_Y = 2.22;
export const HEAD_CENTRE_Y = 1.08;


export type HatKind =
    | "none"
    | "cap"
    | "hood"
    | "helmet"
    | "tophat"
    | "beanie"
    | "halo"
    | "bucket"
    | "visor"
    | "crown"
    | "fishbowl"
    | "wreath"
    | "veil"
    | "turban"
    | "bandana";

export interface ActorVariant {
    palette: RegionPalette;
    hat: HatKind;
    hatColor: number;
    hatAccent?: number;
}

export type VariantSetId =
    | "crowd"
    | "flock"
    | "clergy"
    | "soldierRed"
    | "soldierBlue"
    | "chill"
    | "highRoller"
    | "spacer"
    | "trader"
    | "mourner";

function palette(head: number, torso: number, arms: number, hands: number, legs: number, feet: number): RegionPalette {
    return { head, torso, arms, hands, legs, feet };
}

const SKIN_TONES = [0xe8b48a, 0xd2a071, 0xc98a63, 0x8d5a3b, 0xf0c9a6, 0x6f4630];

function skin(index: number): number {
    return SKIN_TONES[index % SKIN_TONES.length];
}

export const VARIANT_SETS: Record<VariantSetId, ActorVariant[]> = {
    crowd: [
        { palette: palette(skin(0), 0x3f6fd8, 0x3f6fd8, skin(0), 0x2a3350, 0x1a1d26), hat: "cap", hatColor: 0xd94f4f },
        { palette: palette(skin(1), 0xd8d2c4, 0xd8d2c4, skin(1), 0x4a4436, 0x2c241c), hat: "none", hatColor: 0 },
        { palette: palette(skin(2), 0x2e8f6b, 0xe6e2d8, skin(2), 0x39414f, 0x20242c), hat: "beanie", hatColor: 0xf0a63c },
        { palette: palette(skin(3), 0x8a3fd8, 0x8a3fd8, skin(3), 0x2b2b38, 0x181820), hat: "none", hatColor: 0 },
        { palette: palette(skin(4), 0xe0684a, 0xf0c9a6, skin(4), 0x5a4a3a, 0x33291f), hat: "bucket", hatColor: 0x86a95e },
        { palette: palette(skin(5), 0x1f2a38, 0x1f2a38, skin(5), 0x1f2a38, 0x0f1218), hat: "cap", hatColor: 0x1f2a38 },
        { palette: palette(skin(0), 0xf2c53d, 0xf2c53d, skin(0), 0x36507a, 0x22262e), hat: "none", hatColor: 0 },
        { palette: palette(skin(2), 0xcf4d8c, 0xe8dce4, skin(2), 0x37323f, 0x241f28), hat: "bandana", hatColor: 0x2fbf6a },
    ],
    flock: [
        { palette: palette(skin(0), 0x6a5a48, 0x6a5a48, skin(0), 0x4a3f32, 0x2a231c), hat: "hood", hatColor: 0x6a5a48 },
        { palette: palette(skin(3), 0x8c7352, 0x8c7352, skin(3), 0x5b4a34, 0x2f2a20), hat: "none", hatColor: 0 },
        { palette: palette(skin(4), 0x9c8f7a, 0x9c8f7a, skin(4), 0x5e5546, 0x332e26), hat: "veil", hatColor: 0xd9cdb6 },
        { palette: palette(skin(1), 0x4f5b6b, 0x4f5b6b, skin(1), 0x343c48, 0x1d222a), hat: "hood", hatColor: 0x4f5b6b },
        { palette: palette(skin(2), 0xb8a184, 0xb8a184, skin(2), 0x6b5c46, 0x393225), hat: "none", hatColor: 0 },
        { palette: palette(skin(5), 0x74604a, 0x74604a, skin(5), 0x4d3f30, 0x2b241c), hat: "bandana", hatColor: 0xd9b46a },
    ],
    clergy: [
        { palette: palette(skin(4), 0xf6e7c4, 0xf6e7c4, skin(4), 0xe7d5ab, 0x6b5636), hat: "halo", hatColor: 0xffdd88, hatAccent: 0xfff3c4 },
        { palette: palette(skin(1), 0xe8dbb4, 0xe8dbb4, skin(1), 0xd6c69c, 0x5d4a2e), hat: "hood", hatColor: 0xf1e4bd },
    ],
    soldierRed: [
        { palette: palette(skin(0), 0x6b3a2c, 0x5a3226, skin(0), 0x4d3325, 0x241a14), hat: "helmet", hatColor: 0x5c3226 },
        { palette: palette(skin(3), 0x7a4433, 0x63382a, skin(3), 0x553a29, 0x271b15), hat: "helmet", hatColor: 0x69392a },
        { palette: palette(skin(5), 0x5f3428, 0x502c21, skin(5), 0x452e21, 0x1f1611), hat: "bandana", hatColor: 0xa8392c },
    ],
    soldierBlue: [
        { palette: palette(skin(1), 0x2f3f5c, 0x27354e, skin(1), 0x232d40, 0x12161f), hat: "helmet", hatColor: 0x2b3950 },
        { palette: palette(skin(2), 0x36486a, 0x2c3a57, skin(2), 0x27324a, 0x141923), hat: "helmet", hatColor: 0x31465e, hatAccent: 0x9ec6ff },
        { palette: palette(skin(4), 0x283850, 0x223046, skin(4), 0x1e2838, 0x10141c), hat: "bandana", hatColor: 0x4f7fd8 },
    ],
    chill: [
        { palette: palette(skin(4), 0x5ad2c4, 0xf0c9a6, skin(4), 0xf2f2ea, 0xd9cdb6), hat: "bucket", hatColor: 0xffd166 },
        { palette: palette(skin(0), 0xff8fb1, 0xe8b48a, skin(0), 0xfff3e0, 0xe8d9c2), hat: "wreath", hatColor: 0x7ce8a8, hatAccent: 0xff8fb1 },
        { palette: palette(skin(2), 0xffe066, 0xc98a63, skin(2), 0x67c9ff, 0xf2f2ea), hat: "visor", hatColor: 0xff6f61 },
        { palette: palette(skin(3), 0x9be870, 0x8d5a3b, skin(3), 0xfdf6e3, 0xe0d5c0), hat: "none", hatColor: 0 },
        { palette: palette(skin(1), 0x67c9ff, 0xd2a071, skin(1), 0xffe9c4, 0xe8d9c2), hat: "wreath", hatColor: 0xffb3c7, hatAccent: 0xffe066 },
    ],
    highRoller: [
        { palette: palette(skin(0), 0x14161f, 0x14161f, skin(0), 0x14161f, 0x0a0b10), hat: "tophat", hatColor: 0x14161f, hatAccent: 0xffd166 },
        { palette: palette(skin(3), 0x2a1f3d, 0x2a1f3d, skin(3), 0x2a1f3d, 0x120d1c), hat: "crown", hatColor: 0xffd166 },
        { palette: palette(skin(4), 0x7a1f3d, 0x7a1f3d, skin(4), 0x2b1420, 0x160a10), hat: "visor", hatColor: 0xff4fd8 },
        { palette: palette(skin(1), 0xd8d2c4, 0x14161f, skin(1), 0x14161f, 0x0a0b10), hat: "tophat", hatColor: 0x4a1f3d, hatAccent: 0xff4fd8 },
    ],
    spacer: [
        { palette: palette(skin(0), 0xe8edf5, 0xe8edf5, 0xcfd6e2, 0xe8edf5, 0xb8c2d0), hat: "fishbowl", hatColor: 0xbfe6ff, hatAccent: 0xffd166 },
        { palette: palette(skin(2), 0xd6dce8, 0xd6dce8, 0xc0c8d6, 0xd6dce8, 0xa8b2c2), hat: "fishbowl", hatColor: 0xbfe6ff, hatAccent: 0x7ce8a8 },
        { palette: palette(skin(4), 0xf2f4f8, 0xf2f4f8, 0xd8dee8, 0xf2f4f8, 0xc2cad8), hat: "fishbowl", hatColor: 0xcfe9ff, hatAccent: 0xff8f5a },
    ],
    trader: [
        { palette: palette(skin(3), 0xc9682c, 0xe0a36a, skin(3), 0x6b4a2a, 0x3a2717), hat: "turban", hatColor: 0xf0d9a8, hatAccent: 0xc94f2c },
        { palette: palette(skin(5), 0x2f7a5a, 0xd9c9a8, skin(5), 0x4a3a26, 0x2a2016), hat: "bandana", hatColor: 0xf2c53d },
        { palette: palette(skin(1), 0x8c3f6b, 0xd9b98a, skin(1), 0x513a52, 0x2a1f2c), hat: "bucket", hatColor: 0x6b3fd8 },
        { palette: palette(skin(0), 0xd8b44a, 0xe8c9a0, skin(0), 0x5a4326, 0x2f2416), hat: "cap", hatColor: 0x2f7a5a },
    ],
    mourner: [
        { palette: palette(skin(4), 0x1a1a20, 0x1a1a20, skin(4), 0x16161c, 0x0d0d12), hat: "veil", hatColor: 0x16161c },
        { palette: palette(skin(1), 0x22222a, 0x22222a, skin(1), 0x1b1b22, 0x101014), hat: "hood", hatColor: 0x22222a },
        { palette: palette(skin(2), 0x2b2b34, 0x2b2b34, skin(2), 0x1f1f26, 0x121216), hat: "none", hatColor: 0 },
    ],
};

function matte(color: number, roughness = 0.82): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.06 });
}

type Bin = <T extends THREE.Material>(material: T) => T;

export function buildHat(kind: HatKind, color: number, accent: number | undefined, bin: Bin): THREE.Object3D | null {
    if (kind === "none") return null;

    const group = new THREE.Group();
    const cloth: THREE.Material = bin(matte(color));

    switch (kind) {
        case "cap": {
            const dome = new THREE.Mesh(new THREE.SphereGeometry(1.02, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), cloth);
            dome.position.y = HEAD_TOP_Y - 0.75;
            group.add(dome);

            const brim = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18, 0, Math.PI), cloth);
            brim.rotation.x = -Math.PI / 2;
            brim.rotation.z = Math.PI;
            brim.position.set(0, HEAD_TOP_Y - 0.78, 0.18);
            group.add(brim);
            break;
        }
        case "beanie": {
            const dome = new THREE.Mesh(new THREE.SphereGeometry(1.06, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), cloth);
            dome.position.y = HEAD_TOP_Y - 0.86;
            group.add(dome);

            const band = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.34, 16, 1, true), cloth);
            band.position.y = HEAD_TOP_Y - 0.86;
            group.add(band);
            break;
        }
        case "hood": {
            const shell = new THREE.Mesh(new RoundedBoxGeometry(2.12, 2.5, 1.98, 4, 0.9), cloth);
            shell.position.set(0, HEAD_CENTRE_Y + 0.02, -0.38);
            group.add(shell);

            const peak = new THREE.Mesh(new RoundedBoxGeometry(1.06, 0.86, 0.86, 3, 0.34), cloth);
            peak.position.set(0, HEAD_CENTRE_Y + 1.18, -1.12);
            peak.rotation.x = -0.42;
            group.add(peak);
            break;
        }
        case "helmet": {
            const shell = new THREE.Mesh(new THREE.SphereGeometry(1.24, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), cloth);
            shell.position.y = HEAD_TOP_Y - 1.02;
            group.add(shell);

            const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 8, 20), cloth);
            rim.rotation.x = Math.PI / 2;
            rim.position.y = HEAD_TOP_Y - 1.02;
            group.add(rim);
            break;
        }
        case "tophat": {
            const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 0.98, 1.5, 18), cloth);
            crown.position.y = HEAD_TOP_Y + 0.4;
            group.add(crown);

            const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 20), cloth);
            brim.position.y = HEAD_TOP_Y - 0.32;
            group.add(brim);

            if (accent !== undefined) {
                const band = new THREE.Mesh(
                    new THREE.CylinderGeometry(1.0, 1.0, 0.28, 18),
                    bin(matte(accent, 0.4))
                );
                band.position.y = HEAD_TOP_Y - 0.12;
                group.add(band);
            }
            break;
        }
        case "crown": {
            const band = new THREE.Mesh(
                new THREE.CylinderGeometry(1.04, 1.04, 0.34, 16, 1, true),
                bin(new THREE.MeshStandardMaterial({ color, roughness: 0.24, metalness: 0.92 }))
            );
            band.position.y = HEAD_TOP_Y - 0.2;
            group.add(band);

            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const spike = new THREE.Mesh(
                    new THREE.ConeGeometry(0.16, 0.5, 6),
                    bin(new THREE.MeshStandardMaterial({ color, roughness: 0.24, metalness: 0.92 }))
                );
                spike.position.set(Math.cos(angle) * 1.0, HEAD_TOP_Y + 0.2, Math.sin(angle) * 1.0);
                group.add(spike);
            }
            break;
        }
        case "bucket": {
            const dome = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.12, 0.86, 16), cloth);
            dome.position.y = HEAD_TOP_Y - 0.42;
            group.add(dome);

            const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 0.08, 20), cloth);
            brim.position.y = HEAD_TOP_Y - 0.84;
            group.add(brim);
            break;
        }
        case "visor": {
            const band = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.06, 0.32, 16, 1, true), cloth);
            band.position.y = HEAD_TOP_Y - 0.62;
            group.add(band);

            const shade = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16, 0, Math.PI), cloth);
            shade.rotation.x = -Math.PI / 2.2;
            shade.rotation.z = Math.PI;
            shade.position.set(0, HEAD_TOP_Y - 0.66, 0.42);
            group.add(shade);
            break;
        }
        case "halo": {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.9, 0.09, 10, 26),
                bin(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, toneMapped: false }))
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.y = HEAD_TOP_Y + 0.62;
            group.add(ring);

            if (accent !== undefined) {
                const glow = new THREE.PointLight(accent, 6, 6, 2);
                glow.position.y = HEAD_TOP_Y + 0.5;
                group.add(glow);
            }
            break;
        }
        case "fishbowl": {
            const bowl = new THREE.Mesh(
                new THREE.SphereGeometry(1.42, 18, 14),
                bin(new THREE.MeshStandardMaterial({
                    color,
                    roughness: 0.08,
                    metalness: 0.1,
                    transparent: true,
                    opacity: 0.32,
                }))
            );
            bowl.position.y = HEAD_CENTRE_Y + 0.06;
            group.add(bowl);

            const collar = new THREE.Mesh(
                new THREE.CylinderGeometry(1.1, 1.18, 0.34, 18),
                bin(matte(accent ?? 0xd0d6e0, 0.4))
            );
            collar.position.y = HEAD_CENTRE_Y - 1.16;
            group.add(collar);
            break;
        }
        case "wreath": {
            for (let i = 0; i < 9; i++) {
                const angle = (i / 9) * Math.PI * 2;
                const petal = new THREE.Mesh(
                    new THREE.SphereGeometry(0.22, 8, 6),
                    bin(matte(i % 2 === 0 ? color : accent ?? color, 0.7))
                );
                petal.scale.set(1, 0.6, 1);
                petal.position.set(Math.cos(angle) * 1.02, HEAD_TOP_Y - 0.58, Math.sin(angle) * 1.02);
                group.add(petal);
            }
            break;
        }
        case "veil": {
            const shell = new THREE.Mesh(new RoundedBoxGeometry(2.08, 2.42, 1.92, 4, 0.88), cloth);
            shell.position.set(0, HEAD_CENTRE_Y + 0.06, -0.42);
            group.add(shell);

            const drape = new THREE.Mesh(new RoundedBoxGeometry(1.86, 1.42, 0.62, 3, 0.3), cloth);
            drape.position.set(0, HEAD_CENTRE_Y - 0.92, -1.12);
            group.add(drape);
            break;
        }
        case "turban": {
            for (let i = 0; i < 3; i++) {
                const wrap = new THREE.Mesh(new THREE.TorusGeometry(1.0 - i * 0.1, 0.26, 8, 20), cloth);
                wrap.rotation.x = Math.PI / 2;
                wrap.rotation.z = i * 0.4;
                wrap.position.y = HEAD_TOP_Y - 0.72 + i * 0.34;
                group.add(wrap);
            }

            if (accent !== undefined) {
                const jewel = new THREE.Mesh(
                    new THREE.OctahedronGeometry(0.2, 0),
                    bin(new THREE.MeshStandardMaterial({ color: accent, roughness: 0.2, metalness: 0.8 }))
                );
                jewel.position.set(0, HEAD_TOP_Y - 0.5, 0.96);
                group.add(jewel);
            }
            break;
        }
        case "bandana":
        default: {
            const band = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.4, 16, 1, true), cloth);
            band.position.y = HEAD_TOP_Y - 0.72;
            group.add(band);

            const knot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), cloth);
            knot.position.set(0, HEAD_TOP_Y - 0.78, -1.02);
            group.add(knot);
            break;
        }
    }

    group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = true;
    });

    return group;
}
