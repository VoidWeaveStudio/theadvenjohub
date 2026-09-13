// src/features/game/world/locations/showcase/actors/heldItems.ts
import * as THREE from "three";

export type HeldItemId =
    | "cocktail"
    | "candle"
    | "rifle"
    | "book"
    | "sign"
    | "basket"
    | "cash"
    | "chips"
    | "flag"
    | "rose"
    | "lantern"
    | "wrench"
    | "bag"
    | "chalice";

export interface HeldItem {
    object: THREE.Object3D;
    offset: THREE.Vector3;
    rotation: THREE.Euler;
    light?: THREE.PointLight;
}

type Bin = <T extends THREE.Material>(material: T) => T;

function matte(bin: Bin, color: number, roughness = 0.78, metalness = 0.05): THREE.MeshStandardMaterial {
    return bin(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
}

function glow(bin: Bin, color: number, opacity = 0.85): THREE.MeshBasicMaterial {
    return bin(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, toneMapped: false, depthWrite: false }));
}

export function buildHeldItem(id: HeldItemId, bin: Bin, accent: number, withLight = true): HeldItem {
    const group = new THREE.Group();
    const offset = new THREE.Vector3(0, -0.02, 0.04);
    const rotation = new THREE.Euler();
    let light: THREE.PointLight | undefined;

    switch (id) {
        case "cocktail": {
            const bowl = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.085, 12, 1, true), bin(new THREE.MeshStandardMaterial({
                color: 0xdff3ff,
                roughness: 0.06,
                metalness: 0.02,
                transparent: true,
                opacity: 0.45,
                side: THREE.DoubleSide,
            })));
            bowl.rotation.x = Math.PI;
            bowl.position.y = 0.105;
            group.add(bowl);

            const drink = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.06, 12), matte(bin, accent, 0.25));
            drink.rotation.x = Math.PI;
            drink.position.y = 0.098;
            group.add(drink);

            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), matte(bin, 0xdff3ff, 0.2, 0.1));
            stem.position.y = 0.035;
            group.add(stem);

            const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.008, 12), matte(bin, 0xdff3ff, 0.2, 0.1));
            group.add(foot);

            const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 6), matte(bin, 0xff6f61, 0.6));
            straw.position.set(0.018, 0.15, 0);
            straw.rotation.z = -0.4;
            group.add(straw);

            const slice = new THREE.Mesh(new THREE.CircleGeometry(0.024, 12), matte(bin, 0xffc44f, 0.5));
            slice.position.set(-0.052, 0.13, 0);
            slice.rotation.y = Math.PI / 2;
            group.add(slice);
            break;
        }
        case "chalice": {
            const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.08, 12), matte(bin, 0xd8b46a, 0.28, 0.85));
            cup.position.y = 0.1;
            group.add(cup);

            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8), matte(bin, 0xd8b46a, 0.28, 0.85));
            stem.position.y = 0.04;
            group.add(stem);

            const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.01, 12), matte(bin, 0xd8b46a, 0.28, 0.85));
            group.add(foot);
            break;
        }
        case "candle": {
            const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.16, 8), matte(bin, 0xf4ead2, 0.85));
            wax.position.y = 0.08;
            group.add(wax);

            const flame = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.055, 8), glow(bin, 0xffc06a, 0.95));
            flame.position.y = 0.19;
            group.add(flame);

            if (withLight) {
                light = new THREE.PointLight(0xffb45a, 2.4, 3.4, 2);
                light.position.y = 0.2;
                group.add(light);
            }
            break;
        }
        case "rifle": {
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.52), matte(bin, 0x23262c, 0.6, 0.4));
            body.position.z = 0.12;
            group.add(body);

            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 8), matte(bin, 0x16181d, 0.5, 0.6));
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(0, 0.02, 0.5);
            group.add(barrel);

            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.2), matte(bin, 0x3a2d22, 0.8));
            stock.position.set(0, -0.02, -0.18);
            group.add(stock);

            const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.06), matte(bin, 0x1b1e24, 0.65, 0.3));
            mag.position.set(0, -0.1, 0.1);
            mag.rotation.x = 0.2;
            group.add(mag);

            const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.12), matte(bin, 0x1b1e24, 0.5, 0.4));
            sight.position.set(0, 0.07, 0.18);
            group.add(sight);

            offset.set(0, -0.03, 0.1);
            break;
        }
        case "book": {
            const cover = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.26), matte(bin, 0x5a2f2f, 0.75));
            group.add(cover);

            const pages = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.028, 0.245), matte(bin, 0xf2e6cc, 0.9));
            pages.position.y = 0.006;
            group.add(pages);

            const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), matte(bin, accent, 0.3, 0.7));
            emblem.rotation.x = -Math.PI / 2;
            emblem.position.y = 0.022;
            group.add(emblem);

            rotation.set(0, 0, 0.2);
            break;
        }
        case "sign": {
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 8), matte(bin, 0x8a6a42, 0.85));
            handle.position.y = 0.22;
            group.add(handle);

            const board = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.02), matte(bin, 0xf2e6cc, 0.8));
            board.position.y = 0.58;
            group.add(board);

            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.01), matte(bin, accent, 0.4));
            stripe.position.set(0, 0.62, 0.015);
            group.add(stripe);

            const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.01), matte(bin, accent, 0.4));
            stripe2.position.set(-0.02, 0.54, 0.015);
            group.add(stripe2);
            break;
        }
        case "basket": {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.14, 12, 1, true), matte(bin, 0xb08048, 0.9));
            body.position.y = 0.08;
            group.add(body);

            const base = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), matte(bin, 0x9a6c3c, 0.9));
            base.rotation.x = -Math.PI / 2;
            base.position.y = 0.012;
            group.add(base);

            for (let i = 0; i < 5; i++) {
                const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), matte(bin, i % 2 === 0 ? accent : 0xe0684a, 0.55));
                fruit.position.set((i % 3 - 1) * 0.05, 0.15, (Math.floor(i / 3) - 0.5) * 0.06);
                group.add(fruit);
            }

            offset.set(0, -0.14, 0.12);
            break;
        }
        case "cash": {
            for (let i = 0; i < 5; i++) {
                const note = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.004, 0.08), matte(bin, i % 2 === 0 ? 0x6fbf73 : 0x8fd694, 0.8));
                note.position.set(0, i * 0.006, 0);
                note.rotation.y = (i - 2) * 0.16;
                group.add(note);
            }
            rotation.set(0, 0, 0.35);
            break;
        }
        case "chips": {
            for (let i = 0; i < 6; i++) {
                const chip = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16),
                    matte(bin, [0xd94f4f, 0x1f2a38, 0xf2c53d, 0x4f7fd8][i % 4], 0.5)
                );
                chip.position.y = 0.012 + i * 0.011;
                group.add(chip);
            }
            offset.set(0, -0.05, 0.06);
            break;
        }
        case "flag": {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.9, 8), matte(bin, 0xcdd4de, 0.35, 0.75));
            pole.position.y = 0.4;
            group.add(pole);

            const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26, 8, 4), bin(new THREE.MeshStandardMaterial({
                color: accent,
                roughness: 0.7,
                side: THREE.DoubleSide,
            })));
            cloth.position.set(0.2, 0.76, 0);
            group.add(cloth);
            break;
        }
        case "rose": {
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6), matte(bin, 0x3f7a3a, 0.85));
            stem.position.y = 0.15;
            group.add(stem);

            const bud = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), matte(bin, accent, 0.6));
            bud.scale.set(1, 1.2, 1);
            bud.position.y = 0.31;
            group.add(bud);

            for (let i = 0; i < 3; i++) {
                const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.032, 8), matte(bin, 0x4f8f46, 0.85));
                leaf.position.set(0, 0.12 + i * 0.05, 0);
                leaf.rotation.set(-Math.PI / 2.4, (i / 3) * Math.PI * 2, 0);
                group.add(leaf);
            }
            rotation.set(0, 0, -0.25);
            break;
        }
        case "lantern": {
            const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.14, 8, 1, true), matte(bin, 0x3a3129, 0.7, 0.4));
            cage.position.y = -0.09;
            group.add(cage);

            const core = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), glow(bin, accent, 0.9));
            core.position.y = -0.09;
            group.add(core);

            const cap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.05, 8), matte(bin, 0x3a3129, 0.7, 0.4));
            cap.position.y = -0.005;
            group.add(cap);

            const hook = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 6, 12, Math.PI), matte(bin, 0x3a3129, 0.7, 0.4));
            hook.rotation.y = Math.PI / 2;
            hook.position.y = 0.02;
            group.add(hook);

            if (withLight) {
                light = new THREE.PointLight(accent, 3.2, 6, 2);
                light.position.y = -0.09;
                group.add(light);
            }

            offset.set(0, -0.02, 0.03);
            break;
        }
        case "wrench": {
            const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.3, 0.02), matte(bin, 0x9aa3ad, 0.4, 0.8));
            shaft.position.y = 0.15;
            group.add(shaft);

            const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 12, Math.PI * 1.4), matte(bin, 0x9aa3ad, 0.4, 0.8));
            jaw.position.y = 0.31;
            group.add(jaw);
            break;
        }
        case "bag":
        default: {
            const sack = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), matte(bin, 0xc9a86a, 0.85));
            sack.scale.set(1, 1.15, 1);
            sack.position.y = -0.12;
            group.add(sack);

            const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.06, 10), matte(bin, 0xb08048, 0.85));
            neck.position.y = -0.02;
            group.add(neck);

            const mark = new THREE.Mesh(new THREE.CircleGeometry(0.045, 14), matte(bin, accent, 0.4, 0.5));
            mark.position.set(0, -0.12, 0.108);
            group.add(mark);

            offset.set(0, -0.04, 0.06);
            break;
        }
    }

    group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = true;
    });

    return { object: group, offset, rotation, light };
}
