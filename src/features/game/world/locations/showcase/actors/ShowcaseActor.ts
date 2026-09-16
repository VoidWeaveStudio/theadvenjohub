// src/features/game/world/locations/showcase/actors/ShowcaseActor.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../core/ResourceManager";
import { CharacterAnimator } from "../../../../entities/CharacterAnimator";
import { findHandBone, reparentPreservingWorldScale, scaleAndCenterModel } from "../../../../entities/characterModel";
import { buildRegionIndex } from "../../../../entities/characterRegions";
import { getRegionSkinTexture } from "../../../../entities/characterSkinTexture";
import { buildDefusalWeapon, disposeWeaponRig, remoteWeaponTransformFor, WeaponRig } from "../../../../entities/defusalWeaponModels";
import { BoneKey, BodyAxis, CENTER_BONES, CenterBoneKey, PoseBend, PoseId, POSES, SIDE_BONES, SideBoneKey } from "./poses";
import { ActorVariant, buildHat } from "./variants";
import { buildHeldItem, HeldItemId } from "./heldItems";

const MODEL_HEIGHT = 1.8;
const WALK_SPEED = 1.35;
const RUN_SPEED = 4.2;
const TURN_RATE = 4.5;
const ARRIVE_EPSILON = 0.12;
const CHEST_HEIGHT = 1.15;

export type ActorMotion = "idle" | "walk" | "run";

export interface WalkSpec {
    path: THREE.Vector3[];
    speed?: number;
    mode?: "loop" | "pingpong";
    pause?: number;
    run?: boolean;
}

export interface ActorSpec {
    position: THREE.Vector3;
    facing?: number;
    pose?: PoseId;
    variant: ActorVariant;
    variantKey: string;
    held?: HeldItemId;
    heldHand?: "right" | "left";
    heldLight?: boolean;
    weapon?: string;
    accent?: number;
    tilt?: number;
    scale?: number;
    walk?: WalkSpec;
    phase?: number;
    lookAt?: THREE.Vector3;
}

type Bin = <T extends THREE.Material>(material: T) => T;

interface CompiledBend {
    axis: BodyAxis;
    angle: number;
    sway: number;
    rate: number;
    phase: number;
}

type OverlayKind = "aim" | "crouch" | "recoil";

interface OverlayBend {
    axis: BodyAxis;
    kind: OverlayKind;
    factor: number;
}

interface PoseTarget {
    bone: THREE.Object3D;
    depth: number;
    bends: CompiledBend[];
    overlays: OverlayBend[];
    lastIn: THREE.Quaternion;
    lastOut: THREE.Quaternion;
    primed: boolean;
}

const OVERLAY_BENDS: Array<{ bone: BoneKey; axis: BodyAxis; kind: OverlayKind; factor: number }> = [
    { bone: "spineUpper", axis: "right", kind: "aim", factor: -0.9 },
    { bone: "neck", axis: "right", kind: "aim", factor: -0.45 },
    { bone: "spineUpper", axis: "right", kind: "recoil", factor: -0.26 },
    { bone: "neck", axis: "right", kind: "recoil", factor: -0.16 },
    { bone: "spineLower", axis: "right", kind: "crouch", factor: 0.42 },
    { bone: "upperLegL", axis: "right", kind: "crouch", factor: -0.95 },
    { bone: "upperLegR", axis: "right", kind: "crouch", factor: -0.95 },
    { bone: "lowerLegL", axis: "right", kind: "crouch", factor: 1.35 },
    { bone: "lowerLegR", axis: "right", kind: "crouch", factor: 1.35 },
];

const CROUCH_DROP = 0.42;

const _axis = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();
const _bendQuat = new THREE.Quaternion();
const _scaleProbe = new THREE.Vector3();
const _bodyQuat = new THREE.Quaternion();

function boneDepth(bone: THREE.Object3D): number {
    let depth = 0;
    let current: THREE.Object3D | null = bone.parent;
    while (current) {
        depth++;
        current = current.parent;
    }
    return depth;
}

export class ShowcaseActor {
    public readonly group = new THREE.Group();

    private tilt = new THREE.Group();
    private animator = new CharacterAnimator();
    private bones = new Map<BoneKey, THREE.Object3D>();
    private targets: PoseTarget[] = [];
    private clock: number;
    private scale: number;

    private walk: WalkSpec | null = null;
    private walkIndex = 0;
    private walkDirection = 1;
    private waitLeft = 0;
    private facing: number;
    private moving = false;

    private weaponRig: WeaponRig | null = null;
    private weaponMount: THREE.Group | null = null;
    private weaponBaseScale = 1;
    private armed = false;

    private motion: ActorMotion = "idle";
    private firing = false;
    private dead = false;
    private clip = "";

    private modelRoot: THREE.Object3D | null = null;
    private rootRestY = 0;
    private heldObject: THREE.Object3D | null = null;
    private aim = 0;
    private crouch = 0;
    private recoil = 0;

    private destination: THREE.Vector3 | null = null;
    private destinationSpeed = RUN_SPEED;
    private facingTarget: number | null = null;

    private groundAt: ((x: number, z: number) => number) | null = null;

    constructor(private readonly spec: ActorSpec) {
        this.clock = spec.phase ?? 0;
        this.facing = spec.facing ?? 0;
        this.walk = spec.walk ?? null;
        this.scale = spec.scale ?? 1;
    }

    public setGroundProvider(provider: ((x: number, z: number) => number) | null) {
        this.groundAt = provider;
    }

    public get position(): THREE.Vector3 {
        return this.group.position;
    }

    public create(rm: ResourceManager, bin: Bin, materials: Map<string, THREE.Material>): boolean {
        const data = rm.getModel("player");
        if (!data) return false;

        const root = data.scene;
        scaleAndCenterModel(root, MODEL_HEIGHT * this.scale, 0);

        this.applyLook(root, bin, materials);
        this.collectBones(root);

        this.animator.setup(root, data.animations);
        this.armed = !!this.spec.weapon;
        this.playClip();
        this.animator.update(0.25);

        root.updateMatrixWorld(true);
        const rest = new THREE.Box3().setFromObject(root, true);
        if (Number.isFinite(rest.min.y)) root.position.y -= rest.min.y;
        this.modelRoot = root;
        this.rootRestY = root.position.y;

        this.tilt.rotation.x = this.spec.tilt ?? 0;
        this.tilt.add(root);
        this.group.add(this.tilt);

        this.group.position.copy(this.spec.position);
        if (this.spec.lookAt) this.facing = Math.atan2(this.spec.lookAt.x - this.spec.position.x, this.spec.lookAt.z - this.spec.position.z);
        this.group.rotation.y = this.facing;

        this.animator.update(this.clock % 1.3);

        this.attachHat(bin);
        this.attachHeld(bin);
        this.attachWeapon(root);
        this.compilePose();

        root.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
        });

        return true;
    }

    private applyLook(root: THREE.Object3D, bin: Bin, materials: Map<string, THREE.Material>) {
        let skinned: THREE.SkinnedMesh | null = null;
        root.traverse((child) => {
            const mesh = child as THREE.SkinnedMesh;
            if (!skinned && mesh.isSkinnedMesh) skinned = mesh;
            const plain = child as THREE.Mesh;
            if (plain.isMesh && plain.geometry) plain.geometry.userData.sharedAsset = true;
        });

        const mesh = skinned as THREE.SkinnedMesh | null;
        if (!mesh) return;

        const cached = materials.get(this.spec.variantKey);
        if (cached) {
            mesh.material = cached;
            return;
        }

        const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const material = bin(source.clone() as THREE.MeshStandardMaterial);
        material.vertexColors = false;
        material.color.set(0xffffff);

        const regionIndex = buildRegionIndex(mesh);
        if (regionIndex) {
            const texture = getRegionSkinTexture(
                `showcase-${this.spec.variantKey}`,
                mesh.geometry,
                regionIndex,
                this.spec.variant.palette
            );
            if (texture) material.map = texture;
        } else {
            material.color.set(this.spec.variant.palette.torso);
        }

        material.needsUpdate = true;
        mesh.material = material;
        materials.set(this.spec.variantKey, material);
    }

    private collectBones(root: THREE.Object3D) {
        const byName = new Map<string, THREE.Object3D>();
        root.traverse((child) => {
            const key = child.name.toLowerCase().replace(/[._\s]/g, "");
            if (!byName.has(key)) byName.set(key, child);
        });

        for (const key of Object.keys(CENTER_BONES) as CenterBoneKey[]) {
            const bone = byName.get(CENTER_BONES[key]);
            if (bone) this.bones.set(key as BoneKey, bone);
        }

        root.updateMatrixWorld(true);
        const probe = new THREE.Vector3();

        for (const key of Object.keys(SIDE_BONES) as SideBoneKey[]) {
            const [nameA, nameB] = SIDE_BONES[key];
            const boneA = byName.get(nameA);
            const boneB = byName.get(nameB);
            if (!boneA || !boneB) continue;

            const xA = boneA.getWorldPosition(probe).x;
            const xB = boneB.getWorldPosition(probe).x;

            const right = xA > xB ? boneA : boneB;
            const left = right === boneA ? boneB : boneA;

            this.bones.set(`${key}R` as BoneKey, right);
            this.bones.set(`${key}L` as BoneKey, left);
        }
    }

    private attachHat(bin: Bin) {
        const head = this.bones.get("head");
        if (!head) return;

        const hat = buildHat(this.spec.variant.hat, this.spec.variant.hatColor, this.spec.variant.hatAccent, bin);
        if (hat) head.add(hat);
    }

    private attachHeld(bin: Bin) {
        if (!this.spec.held) return;

        const side = this.spec.heldHand ?? "right";
        const hand = this.bones.get(side === "right" ? "handR" : "handL");
        if (!hand) return;

        const item = buildHeldItem(this.spec.held, bin, this.spec.accent ?? 0xffc06a, this.spec.heldLight === true);

        hand.updateWorldMatrix(true, false);
        hand.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), _scaleProbe);
        const unit = _scaleProbe.x > 1e-6 ? 1 / _scaleProbe.x : 1;

        item.object.scale.setScalar(unit);
        item.object.position.copy(item.offset).multiplyScalar(unit);
        item.object.rotation.copy(item.rotation);
        hand.add(item.object);
        this.heldObject = item.object;
    }

    private attachWeapon(root: THREE.Object3D) {
        if (!this.spec.weapon) return;

        const gripBone = findHandBone(root, "right");
        if (!gripBone) return;

        const rig = buildDefusalWeapon(this.spec.weapon);
        const mount = new THREE.Group();
        mount.add(rig.group);
        rig.group.position.copy(rig.rearGrip.position).multiplyScalar(-1);

        this.group.add(mount);
        reparentPreservingWorldScale(mount, gripBone);

        this.weaponBaseScale = mount.scale.x || 1;
        this.weaponRig = rig;
        this.weaponMount = mount;
        this.applyWeaponTransform();

        mount.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) mesh.castShadow = true;
        });
    }

    private applyWeaponTransform() {
        if (!this.weaponMount) return;

        const transform = remoteWeaponTransformFor(this.clip);
        this.weaponMount.position.copy(transform.position);
        this.weaponMount.rotation.copy(transform.euler);
        this.weaponMount.scale.setScalar(this.weaponBaseScale * transform.scale);
    }

    private playClip() {
        const name = this.dead
            ? "death"
            : this.firing && this.armed
                ? `${this.motion}-firing`
                : this.motion;

        this.animator.play(name, this.armed && !this.dead);

        const current = this.animator.getCurrentKey();
        if (current !== this.clip) {
            this.clip = current;
            this.applyWeaponTransform();
        }
    }

    public setPose(pose: PoseId | undefined) {
        if (this.dead || this.spec.pose === pose) return;
        this.spec.pose = pose;
        this.compilePose();
    }

    public setHeldVisible(visible: boolean) {
        if (this.heldObject) this.heldObject.visible = visible;
    }

    public hasHeld(): boolean {
        return this.heldObject !== null;
    }

    public setTilt(tilt: number) {
        this.tilt.rotation.x = tilt;
    }

    public moveTo(x: number, y: number, z: number) {
        this.group.position.set(x, y, z);
    }

    public setFacing(facing: number) {
        this.facing = facing;
        this.facingTarget = null;
        this.group.rotation.y = facing;
    }

    public setMotion(motion: ActorMotion) {
        if (this.dead || this.motion === motion) return;
        this.motion = motion;
        this.playClip();
    }

    public setFiring(firing: boolean) {
        if (this.dead || this.firing === firing) return;
        this.firing = firing;
        this.playClip();
    }

    public isDead(): boolean {
        return this.dead;
    }

    public die() {
        if (this.dead) return;
        this.dead = true;
        this.firing = false;
        this.destination = null;
        this.targets = [];
        this.playClip();
    }

    public revive(position: THREE.Vector3, facing: number) {
        this.dead = false;
        this.aim = 0;
        this.recoil = 0;
        this.setCrouch(0);
        this.motion = "idle";
        this.firing = false;
        this.destination = null;
        this.group.position.copy(position);
        this.facing = facing;
        this.facingTarget = null;
        this.group.rotation.y = facing;
        this.playClip();
        this.compilePose();
    }

    public setDestination(point: THREE.Vector3 | null, speed = RUN_SPEED) {
        if (this.dead) return;
        this.destination = point ? point.clone() : null;
        this.destinationSpeed = speed;
    }

    public hasDestination(): boolean {
        return this.destination !== null;
    }

    public faceTowards(point: THREE.Vector3) {
        if (this.dead) return;
        this.facingTarget = Math.atan2(point.x - this.group.position.x, point.z - this.group.position.z);
    }

    public chestWorld(out: THREE.Vector3): THREE.Vector3 {
        return out.set(
            this.group.position.x,
            this.group.position.y + CHEST_HEIGHT * this.scale,
            this.group.position.z
        );
    }

    public muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
        if (this.weaponRig) {
            this.weaponRig.muzzle.updateWorldMatrix(true, false);
            return this.weaponRig.muzzle.getWorldPosition(out);
        }
        return this.chestWorld(out);
    }

    private compilePose() {
        this.targets = [];
        if (this.dead) return;

        const byBone = new Map<BoneKey, PoseTarget>();

        const ensure = (key: BoneKey): PoseTarget | null => {
            const bone = this.bones.get(key);
            if (!bone) return null;

            let target = byBone.get(key);
            if (!target) {
                target = {
                    bone,
                    depth: boneDepth(bone),
                    bends: [],
                    overlays: [],
                    lastIn: new THREE.Quaternion(),
                    lastOut: new THREE.Quaternion(),
                    primed: false,
                };
                byBone.set(key, target);
            }
            return target;
        };

        const poseId: PoseId | undefined = this.spec.pose;
        if (poseId) {
            for (const bend of POSES[poseId] ?? []) {
                const target = ensure(bend.bone);
                if (!target) continue;

                target.bends.push({
                    axis: bend.axis,
                    angle: bend.angle,
                    sway: bend.sway ?? 0,
                    rate: bend.rate ?? 1,
                    phase: (bend.phase ?? 0) + this.clock,
                });
            }
        }

        if (this.armed) {
            for (const entry of OVERLAY_BENDS) {
                const target = ensure(entry.bone);
                if (!target) continue;
                target.overlays.push({ axis: entry.axis, kind: entry.kind, factor: entry.factor });
            }
        }

        this.targets = Array.from(byBone.values()).sort((a, b) => a.depth - b.depth);
    }

    private applyPose() {
        if (this.targets.length === 0) return;

        this.tilt.updateWorldMatrix(true, false);
        this.tilt.getWorldQuaternion(_bodyQuat);

        for (const target of this.targets) {
            if (target.primed && target.bone.quaternion.equals(target.lastOut)) {
                target.bone.quaternion.copy(target.lastIn);
            }
            target.lastIn.copy(target.bone.quaternion);

            for (const bend of target.bends) {
                const angle = bend.sway !== 0
                    ? bend.angle + Math.sin(this.clock * bend.rate + bend.phase) * bend.sway
                    : bend.angle;
                this.bendBone(target.bone, bend.axis, angle);
            }

            for (const overlay of target.overlays) {
                const amount = overlay.kind === "aim"
                    ? this.aim
                    : overlay.kind === "crouch"
                        ? this.crouch
                        : this.recoil;
                if (Math.abs(amount) < 1e-4) continue;
                this.bendBone(target.bone, overlay.axis, overlay.factor * amount);
            }

            target.lastOut.copy(target.bone.quaternion);
            target.primed = true;
        }
    }

    private bendBone(bone: THREE.Object3D, axis: BodyAxis, angle: number) {
        if (axis === "right") _axis.set(1, 0, 0);
        else if (axis === "up") _axis.set(0, 1, 0);
        else _axis.set(0, 0, 1);

        _axis.applyQuaternion(_bodyQuat);
        _axis.applyQuaternion(bone.getWorldQuaternion(_worldQuat).invert()).normalize();

        bone.quaternion.multiply(_bendQuat.setFromAxisAngle(_axis, angle));
        bone.updateMatrixWorld(true);
    }

    public setAim(pitch: number) {
        this.aim = THREE.MathUtils.clamp(pitch, -0.9, 1.2);
    }

    public setCrouch(amount: number) {
        this.crouch = THREE.MathUtils.clamp(amount, 0, 1);
        if (this.modelRoot) this.modelRoot.position.y = this.rootRestY - CROUCH_DROP * this.crouch * this.scale;
    }

    public kick(strength = 1) {
        this.recoil = Math.min(1.4, this.recoil + strength);
    }

    private turnTowards(angle: number, delta: number) {
        let diff = angle - this.facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.facing += diff * Math.min(1, TURN_RATE * delta);
        this.group.rotation.y = this.facing;
    }

    private advanceWalk(delta: number) {
        const walk = this.walk;
        if (!walk || walk.path.length < 2) {
            this.moving = false;
            return;
        }

        if (this.waitLeft > 0) {
            this.waitLeft -= delta;
            this.moving = false;
            return;
        }

        const target = walk.path[this.walkIndex];
        const dx = target.x - this.group.position.x;
        const dz = target.z - this.group.position.z;
        const distance = Math.hypot(dx, dz);

        if (distance < ARRIVE_EPSILON) {
            this.waitLeft = walk.pause ?? 0;
            if (walk.mode === "pingpong") {
                if (this.walkIndex + this.walkDirection >= walk.path.length || this.walkIndex + this.walkDirection < 0) {
                    this.walkDirection *= -1;
                }
                this.walkIndex += this.walkDirection;
            } else {
                this.walkIndex = (this.walkIndex + 1) % walk.path.length;
            }
            this.moving = false;
            return;
        }

        const speed = walk.speed ?? (walk.run ? RUN_SPEED : WALK_SPEED);
        const step = Math.min(distance, speed * delta);
        this.group.position.x += (dx / distance) * step;
        this.group.position.z += (dz / distance) * step;

        if (this.groundAt) {
            this.group.position.y = this.groundAt(this.group.position.x, this.group.position.z);
        }

        this.turnTowards(Math.atan2(dx, dz), delta);
        this.moving = true;
    }

    private advanceDestination(delta: number) {
        const target = this.destination;
        if (!target) return false;

        const dx = target.x - this.group.position.x;
        const dz = target.z - this.group.position.z;
        const distance = Math.hypot(dx, dz);

        if (distance < 0.35) {
            this.destination = null;
            return false;
        }

        const step = Math.min(distance, this.destinationSpeed * delta);
        this.group.position.x += (dx / distance) * step;
        this.group.position.z += (dz / distance) * step;

        if (this.groundAt) {
            this.group.position.y = this.groundAt(this.group.position.x, this.group.position.z);
        }

        this.turnTowards(Math.atan2(dx, dz), delta);
        return true;
    }

    public update(delta: number) {
        this.clock += delta;

        if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - delta * 7);

        if (this.dead) {
            this.animator.update(delta);
            return;
        }

        if (this.destination) {
            const moved = this.advanceDestination(delta);
            this.setMotion(moved ? (this.destinationSpeed > WALK_SPEED * 1.6 ? "run" : "walk") : "idle");
        } else if (this.walk) {
            this.advanceWalk(delta);
            this.setMotion(this.moving ? (this.walk.run ? "run" : "walk") : "idle");
        } else {
            this.setMotion("idle");
            if (this.facingTarget !== null) this.turnTowards(this.facingTarget, delta);
        }

        this.animator.update(delta);
        this.applyPose();
    }

    public dispose() {
        if (this.weaponRig) {
            disposeWeaponRig(this.weaponRig);
            this.weaponRig = null;
            this.weaponMount = null;
        }

        this.group.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh || !mesh.geometry) return;
            if (mesh.geometry.userData?.sharedAsset) return;
            mesh.geometry.dispose();
        });

        this.group.removeFromParent();
    }
}
