//src\features\game\entities\LootDrop.ts
import * as THREE from "three";
import { LootTokenData } from "../network/NetworkManager";
import { tokenTextureCache } from "../utils/TokenTextureCache";

interface Coin {
    mesh: THREE.Mesh;
    faceMaterial: THREE.MeshStandardMaterial;
    baseY: number;
    bobPhase: number;
    spinRate: THREE.Vector3;
}

const COIN_RADIUS = 0.28;
const COIN_THICKNESS = 0.06;
const CLUSTER_RADIUS = 0.32;
const FLOAT_HEIGHT = 0.45;
const FLOAT_BOB = 0.1;

let sharedGeometry: THREE.CylinderGeometry | null = null;
let sharedSideMaterial: THREE.MeshStandardMaterial | null = null;

function getSharedGeometry(): THREE.CylinderGeometry {
    if (!sharedGeometry) {
        sharedGeometry = new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, COIN_THICKNESS, 32);
    }
    return sharedGeometry;
}

function getSharedSideMaterial(): THREE.MeshStandardMaterial {
    if (!sharedSideMaterial) {
        sharedSideMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.8,
            roughness: 0.3,
        });
    }
    return sharedSideMaterial;
}

export class LootDrop {
    public mesh: THREE.Group;
    public id: string;
    public tokens: LootTokenData[];

    private coins: Coin[] = [];

    constructor(id: string, tokens: LootTokenData[]) {
        this.id = id;
        this.tokens = tokens;
        this.mesh = new THREE.Group();

        const count = Math.max(1, tokens.length);
        tokens.forEach((token, i) => {
            const angle = (i / count) * Math.PI * 2;
            const r = count > 1 ? CLUSTER_RADIUS : 0;
            const coin = this.createCoin(token);
            coin.mesh.position.set(Math.cos(angle) * r, FLOAT_HEIGHT, Math.sin(angle) * r);
            coin.baseY = coin.mesh.position.y;
            this.mesh.add(coin.mesh);
            this.coins.push(coin);
        });

        const light = new THREE.PointLight(0xffcc44, 2, 5);
        light.position.y = FLOAT_HEIGHT;
        this.mesh.add(light);
    }

    private createCoin(token: LootTokenData): Coin {
        const faceMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0x664400,
            emissiveIntensity: 0.5,
            metalness: 0.2,
            roughness: 0.4,
            toneMapped: false,
        });

        const mesh = new THREE.Mesh(
            getSharedGeometry(),
            [getSharedSideMaterial(), faceMaterial, faceMaterial]
        );
        mesh.castShadow = true;

        if (token.image) {
            const url = token.image.startsWith("data:")
                ? token.image
                : `/api/image-proxy?url=${encodeURIComponent(token.image)}`;
            tokenTextureCache.load(url, (tex) => {
                faceMaterial.map = tex;
                faceMaterial.emissiveMap = tex;
                faceMaterial.needsUpdate = true;
            });
        }

        return {
            mesh,
            faceMaterial,
            baseY: 0,
            bobPhase: Math.random() * Math.PI * 2,
            spinRate: new THREE.Vector3(
                0.6 + Math.random() * 0.6,
                1.0 + Math.random() * 0.8,
                0.4 + Math.random() * 0.5
            ),
        };
    }

    public update(delta: number, getGroundHeight: (x: number, z: number) => number) {
        this.mesh.position.y = getGroundHeight(this.mesh.position.x, this.mesh.position.z);

        for (const coin of this.coins) {
            coin.mesh.rotation.x += delta * coin.spinRate.x;
            coin.mesh.rotation.y += delta * coin.spinRate.y;
            coin.mesh.rotation.z += delta * coin.spinRate.z;
            coin.bobPhase += delta * 1.6;
            coin.mesh.position.y = coin.baseY + Math.sin(coin.bobPhase) * FLOAT_BOB;
        }
    }

    dispose(scene: THREE.Scene) {
        for (const coin of this.coins) {
            coin.faceMaterial.dispose();
        }
        scene.remove(this.mesh);
    }
}
