// src/features/game/entities/OtherPlayer.ts
import * as THREE from "three";
import { Entity } from "./Entity";
import { ResourceManager } from "../core/ResourceManager";
import { CharacterAnimator } from "./CharacterAnimator";
import { buildDefusalWeapon, disposeWeaponRig, type WeaponRig } from "./defusalWeaponModels";
import { buildWeaponVisual, weaponGripOffset } from "./Weapon";
import { disposeWeaponTierAttachments, updateWeaponTierAttachments, WeaponKind } from "./weaponTiers";
import { disposeStaff } from "./Staff";
import { scaleAndCenterModel, alignModelToGround, findBoneFirst, findBoneLast, reparentPreservingWorldScale } from "./characterModel";
import { CosmeticRig } from "./CosmeticRig";
import { CosmeticId } from "../data/cosmetics";
import { TIERS } from "../data/progression";
import { findPaintableMesh, clonePaintableMaterial, applySkinTextureUrl, disposePaintableMaterial } from "./characterPaint";
import type { PlayerNetData } from "../network/NetworkManager";
import { EnergyWisp } from "./EnergyWisp";

const TIERS_BY_ID = new Map(TIERS.map((t) => [t.id, t]));

export class OtherPlayer extends Entity {
    public nickname: string;
    private isAdmin: boolean;
    private isFactionCreator: boolean;
    private factionSymbol: string | null;
    private factionImage: string | null;
    private factionImageEl: HTMLImageElement | null = null;
    private nameCanvas: HTMLCanvasElement | null = null;
    private nameCtx: CanvasRenderingContext2D | null = null;
    private nameTexture: THREE.CanvasTexture | null = null;
    private targetPosition: THREE.Vector3 = new THREE.Vector3();
    private targetRotation: number = 0;
    private targetPitch: number = 0;
    private targetState: 'idle' | 'walk' | 'sprint' | 'jump' = 'idle';
    private nameSprite: THREE.Sprite | null = null;
    private headBone: THREE.Object3D | null = null;
    private hipsBone: THREE.Object3D | null = null;
    private rightHand: THREE.Object3D | null = null;
    private defusalWeaponId: string | null = null;
    private defusalRig: WeaponRig | null = null;
    private initialized: boolean = false;
    private time: number = 0;

    private dead: boolean = false;
    private health: number = 100;
    private hidden: boolean = false;
    private created: boolean = false;
    private pendingJoinData: PlayerNetData | null = null;

    private hitbox: THREE.Mesh;

    private weaponMesh: THREE.Group | null = null;
    private nicknameOverride: string | null = null;
    private resourceManager: ResourceManager | null = null;
    private weaponKind: WeaponKind = "rifle";
    private weaponTier: number = 1;
    private weaponElapsed: number = 0;
    private weaponEquipped: boolean = true;
    private paintableMaterial: THREE.Material | null = null;
    private cosmeticRig: CosmeticRig | null = null;
    private posedAnimation: string | null = null;

    private animator = new CharacterAnimator();

    private static readonly _wispVelocity = new THREE.Vector3();
    private static readonly _targetQuat = new THREE.Quaternion();
    private static readonly _targetEuler = new THREE.Euler();

    private characterModel: THREE.Object3D | null = null;
    private shieldMesh: THREE.Mesh | null = null;
    private shieldElapsed: number = 0;
    private wisp: EnergyWisp | null = null;
    private wispMode: boolean = false;
    private lastWispPosition = new THREE.Vector3();
    private level: number = 1;
    private tierEmoji: string | null = null;

    constructor(
        id: string,
        nickname: string,
        factionSymbol: string | null = null,
        factionImage: string | null = null,
        isAdmin: boolean = false,
        isFactionCreator: boolean = false
    ) {
        super(id);
        this.nickname = nickname;
        this.factionSymbol = factionSymbol;
        this.factionImage = factionImage;
        this.isAdmin = isAdmin;
        this.isFactionCreator = isFactionCreator;

        const hitboxGeometry = new THREE.BoxGeometry(0.8, 1.8, 0.8);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
        });
        this.hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        this.hitbox.position.set(0, 0.9, 0);
        this.hitbox.userData.playerId = id;
    }

    create(scene: THREE.Scene, resourceManager: ResourceManager) {
        const data = resourceManager.getModel("player");
        if (!data) {
            throw new Error("Player model not found. Cannot initialize other player.");
        }

        scaleAndCenterModel(data.scene, 1.8, 0);

        this.mesh.add(data.scene);
        this.characterModel = data.scene;

        this.wisp = new EnergyWisp({ withTrail: false, withLight: false });
        this.wisp.attach(this.mesh, null);
        this.wisp.setActive(this.wispMode);
        this.characterModel.visible = !this.wispMode;

        const paintableMesh = findPaintableMesh(data.scene);
        this.paintableMaterial = paintableMesh ? clonePaintableMaterial(paintableMesh) : null;
        this.cosmeticRig = new CosmeticRig(data.scene, this.paintableMaterial);

        this.headBone = findBoneLast(data.scene, (name) => name.includes('head') && !name.endsWith('_end'));
        this.hipsBone = findBoneFirst(data.scene, (name) =>
            name === 'hips' || name === 'pelvis' || name.includes('hips')
        );
        this.rightHand = findBoneFirst(data.scene, (name) =>
            name === 'handr' || name === 'hand.r' ||
            (name.includes('right') && name.includes('hand')) ||
            name === 'r_hand' || name === 'rhand' ||
            name.includes('righthand') || name.includes('rightarm')
        );

        this.animator.setup(data.scene, data.animations);
        this.animator.play('idle', this.weaponEquipped);
        this.animator.update(0.25);
        alignModelToGround(data.scene);

        this.resourceManager = resourceManager;
        this.mountWeapon();

        this.nameSprite = this.createNameTag(this.nickname);
        this.mesh.add(this.nameSprite);

        scene.add(this.hitbox);
        scene.add(this.mesh);
        this.created = true;
    }

    public isCreated(): boolean {
        return this.created;
    }

    public setPendingJoinData(data: PlayerNetData) {
        this.pendingJoinData = data;
         this.nickname = data.nickname;
        this.factionSymbol = data.factionSymbol ?? null;
        this.factionImage = data.factionImage ?? null;
    }

    public getPendingJoinData(): PlayerNetData | null {
        return this.pendingJoinData;
    }

    private createNameTag(name: string): THREE.Sprite {
        const hasFaction = !!this.factionSymbol;
        const baseWidth = hasFaction ? 640 : 512;
        const extraWidth = this.isAdmin ? 200 : 0;
        const canvas = document.createElement("canvas");
        canvas.width = baseWidth + extraWidth;
        canvas.height = hasFaction ? 128 : 96;
        this.nameCanvas = canvas;
        this.nameCtx = canvas.getContext("2d")!;

        this.drawNameTag(name);

        const tex = new THREE.CanvasTexture(canvas);
        this.nameTexture = tex;
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.position.y = 2.8;
        const baseScaleX = hasFaction ? 2.6 : 2;
        sprite.scale.set(baseScaleX * (canvas.width / baseWidth), hasFaction ? 0.52 : 0.4, 1);

        if (this.factionImage) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                this.factionImageEl = img;
                this.drawNameTag(name);
                if (this.nameTexture) this.nameTexture.needsUpdate = true;
            };
            img.src = this.factionImage;
        }

        return sprite;
    }

    private nicknameColor(): string {
        if (this.isAdmin) return "#FFD700";
        if (this.isFactionCreator) return "#EF4444";
        return "#ffffff";
    }

    private displayName(name: string): string {
        const rank = this.tierEmoji ? `${this.tierEmoji} ${this.level}  ` : "";
        return this.isAdmin ? `${rank}${name}  [ADMIN]` : `${rank}${name}`;
    }

    public setProgression(level: number, tier: string | null) {
        const emoji = tier ? TIERS_BY_ID.get(tier)?.emoji ?? null : null;
        if (this.level === level && this.tierEmoji === emoji) return;

        this.level = level;
        this.tierEmoji = emoji;
        this.drawNameTag(this.nickname);
        if (this.nameTexture) this.nameTexture.needsUpdate = true;
    }

    public getWeaponTier(): number {
        return this.weaponTier;
    }

    public setWeaponLoadout(kind: WeaponKind, tier: number) {
        if (this.weaponKind === kind && this.weaponTier === tier) return;

        this.weaponKind = kind;
        this.weaponTier = tier;
        this.mountWeapon();
    }

    // Inside a defusal match the arsenal replaces the progression weapon entirely.
    public setDefusalWeapon(itemId: string | null) {
        if (this.defusalWeaponId === itemId) return;
        this.defusalWeaponId = itemId;
        this.mountWeapon();
    }

    private mountWeapon() {
        if (!this.resourceManager) return;

        const wasVisible = this.weaponMesh ? this.weaponMesh.visible : this.weaponEquipped;
        this.disposeWeapon();

        if (this.defusalWeaponId) {
            const rig = buildDefusalWeapon(this.defusalWeaponId);
            this.defusalRig = rig;
            this.weaponMesh = rig.group;
            this.weaponMesh.visible = wasVisible;
            this.weaponMesh.scale.setScalar(1.6);
            this.weaponMesh.position.set(0.14, 0.02, -0.18);
            this.rightHand?.add(this.weaponMesh);
            return;
        }

        const visual = buildWeaponVisual(this.weaponKind, this.weaponTier, this.resourceManager);
        if (!visual) return;

        const weaponMount = new THREE.Group();
        weaponMount.add(visual);
        weaponMount.position.copy(weaponGripOffset(this.weaponKind));
        weaponMount.visible = wasVisible;

        this.mesh.add(weaponMount);
        if (this.rightHand) {
            reparentPreservingWorldScale(weaponMount, this.rightHand);
        }
        this.weaponMesh = weaponMount;
    }

    private disposeWeapon() {
        if (this.defusalRig) {
            disposeWeaponRig(this.defusalRig);
            this.defusalRig = null;
            this.weaponMesh = null;
            return;
        }
        if (!this.weaponMesh) return;

        const disposable: THREE.Group[] = [];
        this.weaponMesh.traverse((child) => {
            if (child.name === "weapon-tier" || child.name === "staff") disposable.push(child as THREE.Group);
        });

        for (const group of disposable) {
            if (group.name === "weapon-tier") disposeWeaponTierAttachments(group);
            else disposeStaff(group);
        }

        this.weaponMesh.removeFromParent();
        this.weaponMesh = null;
    }

    private drawNameTag(name: string) {
        const ctx = this.nameCtx;
        const canvas = this.nameCanvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const color = this.nicknameColor();
        const label = this.displayName(name);

        if (!this.factionSymbol) {
            ctx.fillStyle = color;
            ctx.font = "bold 48px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, canvas.width / 2, canvas.height / 2);
            return;
        }

        const imgSize = 96;
        const imgX = 16;
        const imgY = (canvas.height - imgSize) / 2;

        if (this.factionImageEl) {
            ctx.drawImage(this.factionImageEl, imgX, imgY, imgSize, imgSize);
        } else {
            ctx.fillStyle = "rgba(255,255,255,0.15)";
            ctx.fillRect(imgX, imgY, imgSize, imgSize);
        }

        const textX = imgX + imgSize + 24;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#4FD1FF";
        ctx.font = "bold 34px Arial";
        ctx.fillText(`$${this.factionSymbol}`, textX, 56);

        ctx.fillStyle = color;
        ctx.font = "bold 42px Arial";
        ctx.fillText(label, textX, 104);
    }

    public setNickname(nickname: string) {
        this.nickname = nickname;
        this.drawNameTag(this.nicknameOverride ?? nickname);
        if (this.nameTexture) this.nameTexture.needsUpdate = true;
    }

    public setNicknameOverride(override: string | null) {
        if (this.nicknameOverride === override) return;

        this.nicknameOverride = override;
        this.drawNameTag(override ?? this.nickname);
        if (this.nameTexture) this.nameTexture.needsUpdate = true;
    }

    public setBadges(isAdmin: boolean, isFactionCreator: boolean) {
        if (this.isAdmin === isAdmin && this.isFactionCreator === isFactionCreator) return;
        this.isAdmin = isAdmin;
        this.isFactionCreator = isFactionCreator;
        this.drawNameTag(this.nickname);
        if (this.nameTexture) this.nameTexture.needsUpdate = true;
    }

    public setFactionIdentity(symbol: string | null, image: string | null, isFactionCreator: boolean) {
        const nextSymbol = symbol || null;
        const nextImage = image || null;

        if (this.factionSymbol === nextSymbol && this.factionImage === nextImage && this.isFactionCreator === isFactionCreator) {
            return;
        }

        const hadFaction = !!this.factionSymbol;
        this.factionSymbol = nextSymbol;
        this.factionImage = nextImage;
        this.isFactionCreator = isFactionCreator;

        if (nextImage === null) this.factionImageEl = null;

        if (!this.created || !this.nameSprite) return;

        if (hadFaction !== !!nextSymbol) {
            this.mesh.remove(this.nameSprite);
            this.disposeNameTag();
            this.nameSprite = this.createNameTag(this.nickname);
            this.mesh.add(this.nameSprite);
            return;
        }

        if (nextImage && this.factionImageEl?.src !== nextImage) {
            this.factionImageEl = null;
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                this.factionImageEl = img;
                this.drawNameTag(this.nickname);
                if (this.nameTexture) this.nameTexture.needsUpdate = true;
            };
            img.src = nextImage;
        }

        this.drawNameTag(this.nickname);
        if (this.nameTexture) this.nameTexture.needsUpdate = true;
    }

    private disposeNameTag() {
        if (!this.nameSprite) return;
        const material = this.nameSprite.material as THREE.SpriteMaterial;
        material.map?.dispose();
        material.dispose();
        this.nameTexture = null;
        this.nameCanvas = null;
        this.nameCtx = null;
        this.nameSprite = null;
    }

    public setSkinTexture(url: string | null) {
        applySkinTextureUrl(this.paintableMaterial, url);
    }

    public setDead(dead: boolean) {
        this.dead = dead;
        if (dead) {
            this.animator.play('death', this.weaponEquipped);
        }
    }

    public isDead(): boolean {
        return this.dead;
    }

    public setHidden(hidden: boolean) {
        this.hidden = hidden;
        this.mesh.visible = !hidden;
        this.hitbox.visible = !hidden;
    }

    public isHidden(): boolean {
        return this.hidden;
    }

    public setHealth(health: number) {
        this.health = health;
    }

    public getHealth(): number {
        return this.health;
    }

    public getHitbox(): THREE.Mesh {
        return this.hitbox;
    }

    public setWeaponVisible(visible: boolean) {
        this.weaponEquipped = visible;
        if (this.weaponMesh) {
            this.weaponMesh.visible = visible;
        }
    }

    public setShielded(active: boolean) {
        if (active === !!this.shieldMesh) return;

        if (!active) {
            this.shieldMesh!.removeFromParent();
            this.shieldMesh!.geometry.dispose();
            (this.shieldMesh!.material as THREE.Material).dispose();
            this.shieldMesh = null;
            return;
        }

        this.shieldMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.95, 20, 14),
            new THREE.MeshBasicMaterial({
                color: 0x4fd1ff,
                transparent: true,
                opacity: 0.22,
                depthWrite: false,
                side: THREE.DoubleSide,
            })
        );
        this.shieldMesh.position.y = 0.95;
        this.shieldElapsed = 0;
        this.mesh.add(this.shieldMesh);
    }

    public setWispMode(active: boolean) {
        if (this.wispMode === active) return;
        this.wispMode = active;
        if (active) this.lastWispPosition.copy(this.mesh.position);
        if (this.characterModel) this.characterModel.visible = !active;
        this.wisp?.setActive(active);
        if (this.weaponMesh) this.weaponMesh.visible = !active && this.weaponEquipped;
    }

    update(delta: number) {
        if (this.hidden) return;
        this.cosmeticRig?.update(delta);
        if (this.dead) {
            this.animator.update(delta);
            return;
        }

        this.time += delta;
        this.mesh.position.lerp(this.targetPosition, Math.min(1, delta * 12));

        if (this.weaponMesh && this.weaponMesh.visible) {
            this.weaponElapsed += delta;
            updateWeaponTierAttachments(this.weaponMesh, this.weaponElapsed, delta);
        }

        if (this.shieldMesh) {
            this.shieldElapsed += delta;
            const material = this.shieldMesh.material as THREE.MeshBasicMaterial;
            material.opacity = 0.18 + Math.abs(Math.sin(this.shieldElapsed * 2.4)) * 0.14;
            this.shieldMesh.scale.setScalar(1 + Math.sin(this.shieldElapsed * 3.1) * 0.03);
        }

        if (this.wispMode && this.wisp) {
            OtherPlayer._wispVelocity.subVectors(this.mesh.position, this.lastWispPosition);
            const travelled = OtherPlayer._wispVelocity.length();
            this.lastWispPosition.copy(this.mesh.position);
            const speed = delta > 0 ? travelled / delta : 0;
            if (delta > 0) OtherPlayer._wispVelocity.multiplyScalar(1 / delta);
            this.wisp.update(delta, speed / 90, speed > 55, OtherPlayer._wispVelocity);
        }

        this.hitbox.position.copy(this.mesh.position);
        this.hitbox.position.y += 0.9;

        OtherPlayer._targetEuler.set(0, this.targetRotation, 0);
        OtherPlayer._targetQuat.setFromEuler(OtherPlayer._targetEuler);
        this.mesh.quaternion.slerp(OtherPlayer._targetQuat, Math.min(1, delta * 12));
        this.hitbox.quaternion.copy(this.mesh.quaternion);

        if (this.headBone) {
            OtherPlayer._targetEuler.set(this.targetPitch, 0, 0);
            OtherPlayer._targetQuat.setFromEuler(OtherPlayer._targetEuler);
            this.headBone.quaternion.slerp(OtherPlayer._targetQuat, Math.min(1, delta * 12));
        }

        if (this.posedAnimation) {
            this.animator.play(this.posedAnimation, false);
        } else if (this.targetState === 'jump') {
            this.animator.play('jump', this.weaponEquipped);
        } else if (this.targetState === 'sprint') {
            this.animator.play('run', this.weaponEquipped);
        } else if (this.targetState === 'walk') {
            this.animator.play('walk', this.weaponEquipped);
        } else {
            this.animator.play('idle', this.weaponEquipped);
        }

        this.animator.update(delta);

        if (this.hipsBone) {
            this.hipsBone.rotation.x = 0;
            this.hipsBone.rotation.z = 0;
            this.hipsBone.position.x = 0;
            this.hipsBone.position.z = 0;
        }
    }

    updateFromNetwork(data: any) {
        this.targetPosition.fromArray(data.position);

        if (!this.initialized) {
            this.mesh.position.copy(this.targetPosition);
            this.hitbox.position.copy(this.targetPosition);
            this.hitbox.position.y += 0.9;
            this.initialized = true;
        }

        this.targetRotation = data.rotation;
        this.targetPitch = data.pitch || 0;
        this.targetState = (data.state as any) || 'idle';

        if (data.weaponEquipped !== undefined) {
            this.setWeaponVisible(data.weaponEquipped);
        }

        if (data.alive !== undefined) {
            this.setDead(!data.alive);
        }
        if (data.health !== undefined) {
            this.setHealth(data.health);
        }
        if (typeof data.level === "number") {
            this.setProgression(data.level, data.tier ?? null);
        }
        if (data.shielded !== undefined) {
            this.setShielded(!!data.shielded);
        }
    }

    public isMoving(): boolean {
        return this.targetState !== 'idle';
    }

    public playPose(name: string | null) {
        this.posedAnimation = name;
        if (name) this.animator.play(name, false);
    }

    applyCosmetics(skinId: CosmeticId | null, accessoryId: CosmeticId | null) {
        this.cosmeticRig?.apply(skinId, accessoryId);
    }

    dispose(scene: THREE.Scene) {
        this.cosmeticRig?.dispose();
        this.setShielded(false);
        super.dispose(scene);
        scene.remove(this.hitbox);
        this.hitbox.geometry.dispose();
        (this.hitbox.material as THREE.Material).dispose();

        if (this.nameSprite) {
            const mat = this.nameSprite.material as THREE.SpriteMaterial;
            mat.map?.dispose();
            mat.dispose();
        }

        disposePaintableMaterial(this.paintableMaterial);
    }
}
