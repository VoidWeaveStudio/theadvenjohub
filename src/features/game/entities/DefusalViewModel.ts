// src/features/game/entities/DefusalViewModel.ts
import * as THREE from "three";
import { ARSENAL_BY_ID } from "../data/defusalArsenal";
import { buildDefusalWeapon, disposeWeaponRig, WeaponRig } from "./defusalWeaponModels";

const HIP = new THREE.Vector3(0.13, -0.115, -0.28);
const ADS = new THREE.Vector3(0, -0.052, -0.2);
const SCOPED = new THREE.Vector3(0, -0.045, -0.34);

const RECOIL_RECOVERY = 11;
const SWAY_LIMIT = 0.035;

// Hands are blocked-out gloves rather than a rigged mesh — enough to read as
// arms at the bottom of the screen without dragging a skinned model in. Both
// sit on the rig's own grip anchors, so every weapon is held where it actually
// has a handle.
function buildHands(rig: WeaponRig, offset: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const glove = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.82, metalness: 0.06 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.78, metalness: 0.02 });

    const makeHand = (at: THREE.Vector3, rake: number, mirror: number) => {
        const hand = new THREE.Group();
        hand.position.copy(at);
        hand.rotation.set(-0.35 - rake, mirror * 0.22, mirror * 0.18);

        const palm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.034, 0.058), glove);
        hand.add(palm);

        for (let i = 0; i < 4; i++) {
            const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, 0.03, 3, 6), glove);
            finger.position.set(-0.016 + i * 0.0105, -0.012, -0.024);
            finger.rotation.x = 1.35;
            hand.add(finger);
        }

        const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0075, 0.026, 3, 6), glove);
        thumb.position.set(mirror * 0.023, 0.006, -0.014);
        thumb.rotation.set(1.15, 0, mirror * -0.7);
        hand.add(thumb);

        const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.22, 10), skin);
        forearm.position.set(mirror * 0.03, -0.05, 0.11);
        forearm.rotation.set(Math.PI / 2 - 0.42, 0, mirror * -0.16);
        hand.add(forearm);

        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.032, 10), glove);
        cuff.position.set(mirror * 0.008, -0.014, 0.036);
        cuff.rotation.x = Math.PI / 2 - 0.2;
        hand.add(cuff);

        return hand;
    };

    const rear = rig.rearGrip.position.clone().add(offset);
    group.add(makeHand(rear, rig.gripRake, 1));

    if (!rig.oneHanded) {
        const front = rig.frontGrip.position.clone().add(offset).add(new THREE.Vector3(0, -0.024, 0.01));
        group.add(makeHand(front, 0.15, -1));
    }

    return group;
}

export class DefusalViewModel {
    private root = new THREE.Group();
    private recoilNode = new THREE.Group();
    private swayNode = new THREE.Group();
    private rig: WeaponRig | null = null;
    private hands: THREE.Group | null = null;

    private itemId: string | null = null;
    private elapsed = 0;
    private bobPhase = 0;
    private recoil = 0;
    private recoilPitch = 0;
    private drawProgress = 1;
    private reloadProgress = 0;
    private reloadDuration = 0;
    private swing = 0;
    private sway = new THREE.Vector2();
    private aim = 0;
    private scopeBlend = 0;
    private readonly rigOffset = new THREE.Vector3();
    private readonly rigEuler = new THREE.Euler();
    private muzzleFlash: THREE.PointLight | null = null;
    private flashUntil = 0;

    public visible = false;

    constructor(private readonly camera: THREE.Camera) {
        this.swayNode.add(this.recoilNode);
        this.root.add(this.swayNode);
        this.root.renderOrder = 20;
        camera.add(this.root);
        this.root.visible = false;

        this.muzzleFlash = new THREE.PointLight(0xffd9a0, 0, 6, 2);
        this.root.add(this.muzzleFlash);
    }

    public readonly handOffset = new THREE.Vector3();

    getWorldMuzzle(target = new THREE.Vector3()): THREE.Vector3 | null {
        if (!this.rig || !this.root.visible) return null;
        return this.rig.muzzle.getWorldPosition(target);
    }

    setRigTransform(offset: THREE.Vector3, euler: THREE.Euler) {
        this.rigOffset.copy(offset);
        this.rigEuler.copy(euler);
        if (this.rig) {
            this.rig.group.position.copy(offset);
            this.rig.group.rotation.copy(euler);
        }
    }

    setHandOffset(offset: THREE.Vector3) {
        this.handOffset.copy(offset);
        this.rebuildHands();
    }

    private rebuildHands() {
        if (!this.rig) return;
        this.hands?.removeFromParent();
        this.hands = buildHands(this.rig, this.handOffset);
        this.recoilNode.add(this.hands);
    }

    setWeapon(itemId: string | null) {
        if (this.itemId === itemId) return;
        this.itemId = itemId;

        if (this.rig) {
            disposeWeaponRig(this.rig);
            this.rig = null;
        }
        if (this.hands) {
            this.hands.removeFromParent();
            this.hands = null;
        }

        if (!itemId) {
            this.root.visible = false;
            return;
        }

        this.rig = buildDefusalWeapon(itemId);
        this.rig.group.position.copy(this.rigOffset);
        this.rig.group.rotation.copy(this.rigEuler);
        this.rig.group.traverse((node) => {
            node.renderOrder = 20;
            const mesh = node as THREE.Mesh;
            if (mesh.isMesh && mesh.material) {
                const material = mesh.material as THREE.Material;
                material.depthTest = true;
            }
        });
        this.recoilNode.add(this.rig.group);

        this.rebuildHands();

        this.drawProgress = 0;
        this.root.visible = this.visible;
    }

    setVisible(visible: boolean) {
        this.visible = visible;
        this.root.visible = visible && this.rig !== null;
    }

    setScoped(scoped: boolean) {
        this.scopeBlend = scoped ? 1 : 0;
    }

    onFire() {
        const item = this.itemId ? ARSENAL_BY_ID.get(this.itemId) : null;
        const kick = item?.scoped ? 0.075 : item?.slot === "primary" ? 0.03 : 0.022;

        this.recoil = Math.min(0.12, this.recoil + kick);
        this.recoilPitch = Math.min(0.22, this.recoilPitch + kick * 1.6);
        this.flashUntil = this.elapsed + 0.05;
    }

    onSwing() {
        this.swing = 1;
    }

    onReload(durationMs: number) {
        this.reloadDuration = Math.max(0.2, durationMs / 1000);
        this.reloadProgress = 0;
    }

    onLook(deltaX: number, deltaY: number) {
        this.sway.x = THREE.MathUtils.clamp(this.sway.x - deltaX * 0.00012, -SWAY_LIMIT, SWAY_LIMIT);
        this.sway.y = THREE.MathUtils.clamp(this.sway.y - deltaY * 0.00012, -SWAY_LIMIT, SWAY_LIMIT);
    }

    update(delta: number, speed: number, grounded: boolean, aiming: boolean) {
        if (!this.rig || !this.root.visible) return;

        this.elapsed += delta;
        this.aim = THREE.MathUtils.lerp(this.aim, aiming ? 1 : 0, Math.min(1, delta * 12));

        const moving = speed > 0.4 && grounded;
        this.bobPhase += delta * (moving ? 6 + Math.min(speed, 9) * 0.7 : 2);

        const bobScale = moving ? 0.012 * (1 - this.aim * 0.7) : 0.0025;
        const bobX = Math.sin(this.bobPhase) * bobScale;
        const bobY = Math.abs(Math.cos(this.bobPhase)) * bobScale * 0.8;

        this.sway.multiplyScalar(1 - Math.min(1, delta * 6));

        const scoped = this.scopeBlend > 0.5 && this.aim > 0.5;
        const target = scoped ? SCOPED : this.aim > 0.02 ? ADS : HIP;
        const hipTarget = this.aim > 0.02 ? target : HIP;

        const restX = THREE.MathUtils.lerp(HIP.x, hipTarget.x, this.aim);
        const restY = THREE.MathUtils.lerp(HIP.y, hipTarget.y, this.aim);
        const restZ = THREE.MathUtils.lerp(HIP.z, hipTarget.z, this.aim);

        if (this.drawProgress < 1) this.drawProgress = Math.min(1, this.drawProgress + delta * 3.2);
        const drawDrop = (1 - this.drawProgress) * 0.22;
        const drawRoll = (1 - this.drawProgress) * 0.6;

        let reloadDrop = 0;
        let reloadRoll = 0;
        if (this.reloadDuration > 0) {
            this.reloadProgress = Math.min(1, this.reloadProgress + delta / this.reloadDuration);
            const wave = Math.sin(this.reloadProgress * Math.PI);
            reloadDrop = wave * 0.11;
            reloadRoll = wave * 0.9;
            if (this.reloadProgress >= 1) this.reloadDuration = 0;
        }

        this.recoil = Math.max(0, this.recoil - delta * RECOIL_RECOVERY * 0.1);
        this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, Math.min(1, delta * RECOIL_RECOVERY));

        this.swayNode.position.set(
            restX + bobX + this.sway.x,
            restY + bobY + this.sway.y - drawDrop - reloadDrop,
            restZ
        );
        this.swayNode.rotation.set(
            this.sway.y * 1.6 - drawRoll * 0.3,
            -this.sway.x * 1.6,
            drawRoll + reloadRoll
        );

        // A swing arcs the whole rig across and down, then snaps back.
        if (this.swing > 0) {
            this.swing = Math.max(0, this.swing - delta * 3.4);
            const arc = Math.sin((1 - this.swing) * Math.PI);
            this.recoilNode.position.x = -arc * 0.16;
            this.recoilNode.rotation.y = arc * 0.9;
            this.recoilNode.rotation.z = -arc * 0.7;
        } else {
            this.recoilNode.position.x = 0;
            this.recoilNode.rotation.y = 0;
            this.recoilNode.rotation.z = 0;
        }

        this.recoilNode.position.z = this.recoil;
        this.recoilNode.rotation.x = this.recoilPitch - (this.swing > 0 ? Math.sin((1 - this.swing) * Math.PI) * 0.5 : 0);

        if (this.rig.scopeLens) {
            this.rig.scopeLens.visible = !scoped;
        }

        if (this.muzzleFlash && this.rig) {
            const flashing = this.elapsed < this.flashUntil;
            this.muzzleFlash.intensity = flashing ? 14 : 0;
            if (flashing) {
                this.rig.muzzle.getWorldPosition(this.muzzleFlash.position);
                this.root.worldToLocal(this.muzzleFlash.position);
            }
        }
    }

    dispose() {
        if (this.rig) disposeWeaponRig(this.rig);
        this.hands?.removeFromParent();
        this.root.removeFromParent();
        this.rig = null;
        this.hands = null;
    }
}
