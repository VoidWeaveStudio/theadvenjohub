// src/features/game/world/locations/tower/floors/FactionHeart.ts
import * as THREE from "three";
import { tokenTextureCache } from "../../../../utils/TokenTextureCache";
import { factionTint } from "../../../../utils/factionTint";
import { buildMcFrame, disposeMcFrame, mcFrameSpec } from "../../../../utils/mcFrame";

export const FACTION_HEART_INTERACTION = "faction-heart";

const SHARD_COUNT = 6;
const WOUND_COLOUR = new THREE.Color(0xff2b2b);
const FLASH_COLOUR = new THREE.Color(0xffffff);
const CORE_Y = 3.4;
const LOGO_Y = 6.6;
const BEAM_HEIGHT = 260;

export class FactionHeart {
    public readonly group: THREE.Group;

    private readonly core: THREE.Mesh;
    private readonly shards: THREE.Mesh[] = [];
    private readonly plinth: THREE.Mesh;
    private frame: THREE.Sprite | null = null;
    private readonly logo: THREE.Sprite;
    private readonly beam: THREE.Mesh;
    private readonly light: THREE.PointLight;
    public readonly hitbox: THREE.Mesh;

    private readonly crystalMaterial: THREE.MeshStandardMaterial;
    private readonly stoneMaterial: THREE.MeshStandardMaterial;

    private readonly beamMaterial: THREE.MeshBasicMaterial;
    private readonly logoMaterial: THREE.SpriteMaterial;

    private readonly coreGeometry: THREE.OctahedronGeometry;
    private readonly shardGeometry: THREE.OctahedronGeometry;
    private readonly plinthGeometry: THREE.CylinderGeometry;

    private readonly beamGeometry: THREE.CylinderGeometry;

    private readonly hitboxGeometry: THREE.BoxGeometry;
    private readonly hitboxMaterial: THREE.MeshBasicMaterial;

    private healthRatio = 1;
    private shownRatio = 1;
    private besieged = false;
    private hurtFlash = 0;

    private tint = new THREE.Color(0x6fd8ff);
    private target = new THREE.Color(0x6fd8ff);
    private tier = 0;
    private level = 1;
    private time = 0;
    private viewerDistance = 120;

    constructor() {
        this.group = new THREE.Group();
        this.group.name = "faction-heart";
        this.group.userData.interactionId = FACTION_HEART_INTERACTION;
        this.group.userData.interactionRadius = 7;

        this.crystalMaterial = new THREE.MeshStandardMaterial({
            color: 0x151426,
            emissive: 0x6fd8ff,
            emissiveIntensity: 1.4,
            roughness: 0.22,
            metalness: 0.1,
            transparent: true,
            opacity: 0.92,
            flatShading: true,
        });

        this.stoneMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a3444,
            roughness: 0.72,
            metalness: 0.3,
            flatShading: true,
        });

        this.coreGeometry = new THREE.OctahedronGeometry(1.7, 0);
        this.core = new THREE.Mesh(this.coreGeometry, this.crystalMaterial);
        this.core.position.y = CORE_Y;
        this.group.add(this.core);

        this.shardGeometry = new THREE.OctahedronGeometry(0.5, 0);
        for (let i = 0; i < SHARD_COUNT; i++) {
            const shard = new THREE.Mesh(this.shardGeometry, this.crystalMaterial);
            shard.scale.y = 1.8 + (i % 3) * 0.5;
            this.shards.push(shard);
            this.group.add(shard);
        }

        this.plinthGeometry = new THREE.CylinderGeometry(2.6, 3.4, 1.6, 8);
        this.plinth = new THREE.Mesh(this.plinthGeometry, this.stoneMaterial);
        this.plinth.position.y = 0.8;
        this.group.add(this.plinth);

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 0.3), this.stoneMaterial);
            arm.position.set(Math.cos(angle) * 2.2, 2.4, Math.sin(angle) * 2.2);
            arm.rotation.z = Math.cos(angle) * 0.2;
            arm.rotation.x = -Math.sin(angle) * 0.2;
            this.group.add(arm);
        }

        this.logoMaterial = new THREE.SpriteMaterial({
            color: 0xffffff,
            transparent: true,
            depthWrite: false,
            fog: false,
            toneMapped: false,
            opacity: 0,
        });
        this.logo = new THREE.Sprite(this.logoMaterial);
        this.logo.position.y = LOGO_Y;
        this.logo.scale.setScalar(2.6);
        this.logo.renderOrder = 4;
        this.group.add(this.logo);

        this.beamMaterial = new THREE.MeshBasicMaterial({
            color: 0x6fd8ff,
            transparent: true,
            opacity: 0.08,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
            toneMapped: false,
        });
        this.beamGeometry = new THREE.CylinderGeometry(0.5, 1.7, BEAM_HEIGHT, 12, 1, true);
        this.beam = new THREE.Mesh(this.beamGeometry, this.beamMaterial);
        this.beam.position.y = BEAM_HEIGHT / 2;
        this.beam.renderOrder = 5;
        this.beam.frustumCulled = false;
        this.group.add(this.beam);

        this.light = new THREE.PointLight(0x6fd8ff, 10, 52, 2);
        this.light.position.y = CORE_Y;
        this.group.add(this.light);

        this.hitboxGeometry = new THREE.BoxGeometry(4.4, 5.2, 4.4);
        this.hitboxMaterial = new THREE.MeshBasicMaterial({ visible: false });
        this.hitbox = new THREE.Mesh(this.hitboxGeometry, this.hitboxMaterial);
        this.hitbox.position.y = CORE_Y - 0.4;
        this.hitbox.visible = false;
        this.group.add(this.hitbox);
    }

    public setHealth(hp: number, maxHp: number) {
        const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 1;
        if (ratio < this.healthRatio) this.hurtFlash = 1;

        this.healthRatio = ratio;
        this.besieged = maxHp > 0 && ratio < 1;
        this.hitbox.visible = maxHp > 0;
    }

    public clearHealth() {
        this.healthRatio = 1;
        this.shownRatio = 1;
        this.besieged = false;
        this.hurtFlash = 0;
        this.hitbox.visible = false;
    }

    public applyFaction(factionId: string, image: string | null, level: number, tier: number) {
        this.level = Math.max(1, Math.min(20, Math.round(level)));
        this.tier = Math.max(0, Math.round(tier));
        this.target.setHex(factionTint(factionId));

        disposeMcFrame(this.frame);
        this.frame = buildMcFrame(this.tier, 3.7);
        if (this.frame) {
            this.frame.position.y = LOGO_Y;
            this.group.add(this.frame);
        }

        if (!image) {
            this.logoMaterial.opacity = 0;
            return;
        }

        tokenTextureCache.load(image, (texture) => {
            this.logoMaterial.map = texture;
            this.logoMaterial.opacity = 1;
            this.logoMaterial.needsUpdate = true;
        });
    }

    public setViewerDistance(distance: number) {
        this.viewerDistance = distance;
    }

    public update(delta: number) {
        this.time += delta;
        this.tint.lerp(this.target, Math.min(1, delta * 2.2));

        this.shownRatio += (this.healthRatio - this.shownRatio) * Math.min(1, delta * 4);
        this.hurtFlash = Math.max(0, this.hurtFlash - delta * 2.6);

        const wounded = 1 - this.shownRatio;
        const panic = this.besieged ? 1 + wounded * 2.4 : 1;
        const pulse = 0.68 + 0.32 * Math.sin(this.time * 1.1 * panic);
        const grown = (0.6 + (this.level / 20) * 0.7) * (this.besieged ? 0.55 + this.shownRatio * 0.45 : 1);
        const frame = mcFrameSpec(this.tier);

        this.crystalMaterial.emissive.copy(this.tint);
        if (this.besieged) this.crystalMaterial.emissive.lerp(WOUND_COLOUR, wounded * 0.8);
        if (this.hurtFlash > 0) this.crystalMaterial.emissive.lerp(FLASH_COLOUR, this.hurtFlash * 0.7);
        this.crystalMaterial.emissiveIntensity = 0.7 + pulse * 1.7 * grown + this.hurtFlash * 2.4;

        this.light.color.copy(this.tint);
        this.light.intensity = 5 + pulse * 11 * grown;
        this.light.distance = 34 + grown * 26;

        const far = THREE.MathUtils.clamp((this.viewerDistance - 18) / 90, 0, 1);
        this.beamMaterial.color.copy(this.tint);
        this.beamMaterial.opacity = (0.02 + pulse * 0.05) * grown * far;
        this.beam.visible = far > 0.01;

        this.core.rotation.y += delta * 0.3;
        this.core.rotation.x += delta * 0.11;
        this.core.position.y = CORE_Y + Math.sin(this.time * 0.9) * 0.2;
        this.core.scale.setScalar(grown);

        for (let i = 0; i < this.shards.length; i++) {
            const shard = this.shards[i];
            const phase = (i / this.shards.length) * Math.PI * 2 + this.time * 0.3;
            const radius = 2.6 + Math.sin(this.time * 0.7 + i) * 0.3;

            shard.position.set(Math.cos(phase) * radius, CORE_Y - 0.6 + Math.sin(this.time + i * 1.4) * 0.5, Math.sin(phase) * radius);
            shard.rotation.y = phase * 1.5;
            shard.scale.setScalar(grown);
        }

        this.logo.position.y = LOGO_Y + Math.sin(this.time * 0.8) * 0.14;

        if (this.frame) {
            this.frame.position.y = this.logo.position.y;
            this.frame.material.rotation += delta * frame.spin;
            this.frame.material.opacity = 0.5 + frame.glow * 0.35 * pulse;
        }
    }

    public dispose() {
        this.group.removeFromParent();
        disposeMcFrame(this.frame);
        this.frame = null;

        this.hitboxGeometry.dispose();
        this.hitboxMaterial.dispose();
        this.coreGeometry.dispose();
        this.shardGeometry.dispose();
        this.plinthGeometry.dispose();
        this.beamGeometry.dispose();

        this.crystalMaterial.dispose();
        this.stoneMaterial.dispose();
        this.beamMaterial.dispose();
        this.logoMaterial.dispose();

        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh && child !== this.core && !this.shards.includes(child)) {
                child.geometry.dispose();
            }
        });
    }
}
