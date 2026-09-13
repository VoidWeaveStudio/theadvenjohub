// src/features/game/world/locations/showcase/actors/ShowcaseActor.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../core/ResourceManager";
import { CharacterAnimator } from "../../../../entities/CharacterAnimator";
import { scaleAndCenterModel } from "../../../../entities/characterModel";
import { buildRegionIndex } from "../../../../entities/characterRegions";
import { getRegionSkinTexture } from "../../../../entities/characterSkinTexture";
import { BONE_NAMES, BoneKey, BodyAxis, PoseBend, PoseId, POSES } from "./poses";
import { ActorVariant, buildHat } from "./variants";
import { buildHeldItem, HeldItemId } from "./heldItems";

const MODEL_HEIGHT = 1.8;
const WALK_SPEED = 1.35;
const RUN_SPEED = 4.2;
const TURN_RATE = 4.5;
const ARRIVE_EPSILON = 0.12;

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

interface PoseTarget {
    bone: THREE.Object3D;
    depth: number;
    bends: CompiledBend[];
    lastIn: THREE.Quaternion;
    lastOut: THREE.Quaternion;
    primed: boolean;
}

const _axis = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();
const _bendQuat = new THREE.Quaternion();
const _scaleProbe = new THREE.Vector3();
const _forward = new THREE.Vector3();
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

    private spin = new THREE.Group();
    private tilt = new THREE.Group();
    private animator = new CharacterAnimator();
    private bones = new Map<BoneKey, THREE.Object3D>();
    private targets: PoseTarget[] = [];
    private clock: number;

    private walk: WalkSpec | null = null;
    private walkIndex = 0;
    private walkDirection = 1;
    private waitLeft = 0;
    private facing: number;
    private moving = false;

    private groundAt: ((x: number, z: number) => number) | null = null;

    constructor(private readonly spec: ActorSpec) {
        this.clock = spec.phase ?? 0;
        this.facing = spec.facing ?? 0;
        this.walk = spec.walk ?? null;
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
        scaleAndCenterModel(root, MODEL_HEIGHT * (this.spec.scale ?? 1), 0);

        this.applyLook(root, bin, materials);
        this.collectBones(root);

        const modelYaw = this.measureModelYaw();

        this.animator.setup(root, data.animations);
        this.animator.play(this.walk ? "walk" : "idle", false);
        this.animator.update(0.25);

        root.updateMatrixWorld(true);
        const rest = new THREE.Box3().setFromObject(root, true);
        if (Number.isFinite(rest.min.y)) root.position.y -= rest.min.y;

        this.spin.rotation.y = -modelYaw;
        this.spin.add(root);
        this.tilt.rotation.x = this.spec.tilt ?? 0;
        this.tilt.add(this.spin);
        this.group.add(this.tilt);

        this.group.position.copy(this.spec.position);
        if (this.spec.lookAt) this.facing = Math.atan2(this.spec.lookAt.x - this.spec.position.x, this.spec.lookAt.z - this.spec.position.z);
        this.group.rotation.y = this.facing;

        this.animator.update(this.clock % 1.3);

        this.attachHat(bin);
        this.attachHeld(bin);
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
        const wanted = new Map<string, BoneKey>();
        for (const key of Object.keys(BONE_NAMES) as BoneKey[]) {
            wanted.set(BONE_NAMES[key].toLowerCase(), key);
        }

        root.traverse((child) => {
            const key = wanted.get(child.name.toLowerCase().replace(/[._\s]/g, ""));
            if (key && !this.bones.has(key)) this.bones.set(key, child);
        });
    }

    private measureModelYaw(): number {
        const head = this.bones.get("head");
        if (!head) return 0;

        head.updateWorldMatrix(true, false);
        _forward.set(0, 0, 1).applyQuaternion(head.getWorldQuaternion(_worldQuat));
        if (Math.abs(_forward.x) < 1e-5 && Math.abs(_forward.z) < 1e-5) return 0;
        return Math.atan2(_forward.x, _forward.z);
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
    }

    private compilePose() {
        const poseId: PoseId | undefined = this.spec.pose;
        if (!poseId) return;

        const bends: PoseBend[] = POSES[poseId] ?? [];
        const byBone = new Map<BoneKey, PoseTarget>();

        for (const bend of bends) {
            const bone = this.bones.get(bend.bone);
            if (!bone) continue;

            let target = byBone.get(bend.bone);
            if (!target) {
                target = {
                    bone,
                    depth: boneDepth(bone),
                    bends: [],
                    lastIn: new THREE.Quaternion(),
                    lastOut: new THREE.Quaternion(),
                    primed: false,
                };
                byBone.set(bend.bone, target);
            }

            target.bends.push({
                axis: bend.axis,
                angle: bend.angle,
                sway: bend.sway ?? 0,
                rate: bend.rate ?? 1,
                phase: (bend.phase ?? 0) + this.clock,
            });
        }

        this.targets = Array.from(byBone.values()).sort((a, b) => a.depth - b.depth);
    }

    private applyPose() {
        if (this.targets.length === 0) return;

        this.spin.updateWorldMatrix(true, false);
        this.spin.getWorldQuaternion(_bodyQuat);

        for (const target of this.targets) {
            if (target.primed && target.bone.quaternion.equals(target.lastOut)) {
                target.bone.quaternion.copy(target.lastIn);
            }
            target.lastIn.copy(target.bone.quaternion);

            for (const bend of target.bends) {
                const angle = bend.sway !== 0
                    ? bend.angle + Math.sin(this.clock * bend.rate + bend.phase) * bend.sway
                    : bend.angle;

                if (bend.axis === "right") _axis.set(1, 0, 0);
                else if (bend.axis === "up") _axis.set(0, 1, 0);
                else _axis.set(0, 0, 1);

                _axis.applyQuaternion(_bodyQuat);
                _axis.applyQuaternion(target.bone.getWorldQuaternion(_worldQuat).invert()).normalize();

                target.bone.quaternion.multiply(_bendQuat.setFromAxisAngle(_axis, angle));
                target.bone.updateMatrixWorld(true);
            }

            target.lastOut.copy(target.bone.quaternion);
            target.primed = true;
        }
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

        const wanted = Math.atan2(dx, dz);
        let diff = wanted - this.facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.facing += diff * Math.min(1, TURN_RATE * delta);
        this.group.rotation.y = this.facing;
        this.moving = true;
    }

    public update(delta: number) {
        this.clock += delta;

        if (this.walk) {
            this.advanceWalk(delta);
            this.animator.play(this.moving ? (this.walk.run ? "run" : "walk") : "idle", false);
        }

        this.animator.update(delta);
        this.applyPose();
    }
}
