// src/features/game/entities/DefusalViewModel.ts
import * as THREE from "three";
import { ARSENAL_BY_ID } from "../data/defusalArsenal";
import { buildDefusalWeapon, disposeWeaponRig, WeaponRig } from "./defusalWeaponModels";
import { buildViewHand } from "./viewHands";
import { applyPose, poseFor } from "./viewModelPoses";

const HIP = new THREE.Vector3(0.16, -0.2, -0.46);
const ADS = new THREE.Vector3(0, -0.11, -0.4);
const SCOPED = new THREE.Vector3(0, -0.1, -0.48);

const RECOIL_RECOVERY = 11;
const SWAY_LIMIT = 0.035;

export interface TunedTransform {
    position: THREE.Vector3;
    euler: THREE.Euler;
    scale: number;
}

export function makeTransform(
    position = new THREE.Vector3(),
    euler = new THREE.Euler(),
    scale = 1
): TunedTransform {
    return { position, euler, scale };
}

function applyTransform(object: THREE.Object3D, transform: TunedTransform) {
    object.position.copy(transform.position);
    object.rotation.copy(transform.euler);
    object.scale.setScalar(transform.scale);
}

// Each hand is built around a grip rod on its local X axis, so seating one is a
// single rotation: line that axis up with whatever the weapon is held by — the
// raked pistol grip at the back, the handguard running down the barrel in front.
export interface HandRig {
    group: THREE.Group;
    left: THREE.Group;
    right: THREE.Group | null;
}

// Right hand on the pistol grip and trigger, left hand out on the handguard.
// Each sits under a base group holding the solved seating, so the tunable
// transform on the hand itself starts from a correct pose instead of zero.
function buildHands(rig: WeaponRig): HandRig {
    const group = new THREE.Group();
    const glove = new THREE.MeshStandardMaterial({ color: 0x53585f, roughness: 0.8, metalness: 0.05 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc09274, roughness: 0.76, metalness: 0.02 });

    const leftBase = new THREE.Group();
    leftBase.position.copy(rig.rearGrip.position).add(new THREE.Vector3(0.022, 0, 0.006));
    leftBase.rotation.set(0.35, 0, -Math.PI / 2 + rig.gripRake);
    group.add(leftBase);

    const left = buildViewHand(glove, skin, 1);
    leftBase.add(left);

    let right: THREE.Group | null = null;
    if (!rig.oneHanded) {
        const rightBase = new THREE.Group();
        rightBase.position.copy(rig.frontGrip.position).add(new THREE.Vector3(-0.024, -0.018, 0));
        rightBase.rotation.set(2.6, Math.PI / 2, 0);
        group.add(rightBase);

        right = buildViewHand(glove, skin, -1);
        rightBase.add(right);
    }

    return { group, left, right };
}

export class DefusalViewModel {
    private root = new THREE.Group();
    private recoilNode = new THREE.Group();
    private swayNode = new THREE.Group();
    private rig: WeaponRig | null = null;
    private hands: THREE.Group | null = null;
    private handRig: HandRig | null = null;
    public heldItemId: string | null = null;

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
    private scopeActive = false;
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

    public readonly weaponTransform = makeTransform();
    public readonly handsTransform = makeTransform();
    public readonly leftHandTransform = makeTransform();
    public readonly rightHandTransform = makeTransform();

    getWorldMuzzle(target = new THREE.Vector3()): THREE.Vector3 | null {
        if (!this.rig || !this.root.visible) return null;
        return this.rig.muzzle.getWorldPosition(target);
    }

    applyTunedTransforms() {
        if (this.rig) applyTransform(this.rig.group, this.weaponTransform);
        if (!this.handRig) return;

        applyTransform(this.handRig.group, this.handsTransform);
        applyTransform(this.handRig.left, this.leftHandTransform);
        if (this.handRig.right) applyTransform(this.handRig.right, this.rightHandTransform);
    }

    private rebuildHands() {
        if (!this.rig) return;
        this.handRig?.group.removeFromParent();
        this.handRig = buildHands(this.rig);
        this.hands = this.handRig.group;
        this.recoilNode.add(this.handRig.group);
        this.applyTunedTransforms();
    }

    setWeapon(itemId: string | null) {
        if (this.itemId === itemId) return;
        this.itemId = itemId;
        this.heldItemId = itemId;

        if (this.rig) {
            disposeWeaponRig(this.rig);
            this.rig = null;
        }
        if (this.hands) {
            this.hands.removeFromParent();
            this.hands = null;
            this.handRig = null;
        }

        if (!itemId) {
            this.root.visible = false;
            return;
        }

        const pose = poseFor(itemId);
        applyPose(this.weaponTransform, pose.weapon);
        applyPose(this.handsTransform, pose.hands);
        applyPose(this.leftHandTransform, pose.left);
        applyPose(this.rightHandTransform, pose.right);

        this.rig = buildDefusalWeapon(itemId);
        applyTransform(this.rig.group, this.weaponTransform);
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
        this.applyVisibility();
    }

    setVisible(visible: boolean) {
        this.visible = visible;
        this.applyVisibility();
    }

    // Down the scope the model is out of the way entirely, the overlay is the
    // whole sight picture — the same as the game this borrows from.
    setScopeActive(active: boolean) {
        this.scopeActive = active;
        this.applyVisibility();
    }

    private applyVisibility() {
        this.root.visible = this.visible && this.rig !== null && !this.scopeActive;
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

        // A bat swing, not a rifle butt: wind up back and right, sweep flat
        // across the screen to the left, then drift back to the ready pose.
        if (this.swing > 0) {
            this.swing = Math.max(0, this.swing - delta * 2.6);

            const t = 1 - this.swing;
            const wind = Math.min(1, t / 0.26);
            const strike = THREE.MathUtils.clamp((t - 0.26) / 0.3, 0, 1);
            const recover = THREE.MathUtils.clamp((t - 0.56) / 0.44, 0, 1);
            const blend = 1 - recover * recover;
            const swept = strike * strike * (3 - 2 * strike);

            this.recoilNode.position.x = (wind * 0.12 - swept * 0.34) * blend;
            this.recoilNode.position.y = (wind * 0.05 - swept * 0.03) * blend;
            this.recoilNode.position.z = this.recoil + (wind * 0.08 - swept * 0.14) * blend;
            this.recoilNode.rotation.y = (wind * 0.42 - swept * 1.75) * blend;
            this.recoilNode.rotation.z = (wind * 0.55 - swept * 1.2) * blend;
            this.recoilNode.rotation.x = this.recoilPitch + (wind * 0.34 - swept * 0.28) * blend;
        } else {
            this.recoilNode.position.x = 0;
            this.recoilNode.position.y = 0;
            this.recoilNode.position.z = this.recoil;
            this.recoilNode.rotation.y = 0;
            this.recoilNode.rotation.z = 0;
            this.recoilNode.rotation.x = this.recoilPitch;
        }

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
