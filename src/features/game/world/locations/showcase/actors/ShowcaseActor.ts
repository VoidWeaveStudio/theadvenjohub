// src/features/game/world/locations/showcase/actors/ShowcaseActor.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../core/ResourceManager";
import { CharacterAnimator } from "../../../../entities/CharacterAnimator";
import { findHandBone, reparentPreservingWorldScale, scaleAndCenterModel } from "../../../../entities/characterModel";
import { BODY_REGIONS, buildRegionIndex } from "../../../../entities/characterRegions";
import { getRegionSkinTexture } from "../../../../entities/characterSkinTexture";
import { buildDefusalWeapon, disposeWeaponRig, remoteWeaponTransformFor, WeaponRig } from "../../../../entities/defusalWeaponModels";
import { BoneKey, BodyAxis, CENTER_BONES, CenterBoneKey, PoseBend, PoseId, POSES, SIDE_BONES, SideBoneKey } from "./poses";
import { ActorVariant, buildHat } from "./variants";
import { buildHeldItem, HeldItemId } from "./heldItems";
import { buildFace, FaceRig } from "./face";
import { CollisionGrid } from "../../../CollisionGrid";

const MODEL_HEIGHT = 1.8;
const WALK_SPEED = 1.35;
const RUN_SPEED = 4.2;
const TURN_RATE = 4.5;
const ARRIVE_EPSILON = 0.12;
const CHEST_HEIGHT = 1.15;

const BREATH_AMPLITUDE = 0.006;
const BREATH_RATE = 1.35;

const POSE_BLEND_RATE = 6;

const COLLIDER_WIDTH = 0.7;
const COLLIDER_HEIGHT = 1.8;
const _colliderSize = new THREE.Vector3(COLLIDER_WIDTH, COLLIDER_HEIGHT, COLLIDER_WIDTH);
const _colliderProbe = new THREE.Vector3();

// A straight-line walker has no pathfinding, so a destination on the far side of an
// obstacle (a sandbag mound, a wreck) otherwise just presses into it forever. After a
// short stuck window, sidestep perpendicular to the blocked direction instead — clears
// most cover-sized obstacles without needing a real navmesh.
const STUCK_THRESHOLD = 0.3;
const DODGE_COMMIT = 0.9;
const STUCK_GIVE_UP = 6;

const FIRING_CLIP_WEAPON_PITCH = -0.46;

export type ActorMotion = "idle" | "walk" | "run";

export interface WalkSpec {
    path: THREE.Vector3[];
    speed?: number;
    mode?: "loop" | "pingpong" | "cycle";
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
    blended: boolean;
}

type OverlayKind = "aim" | "crouch" | "recoil" | "flinch";

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

// Taking a round: the torso snaps back and the arms fly up and out. Kept apart from the
// recoil overlay so a shooter's kick never turns into this, and applied whether or not
// the actor is holding a weapon.
const FLINCH_BENDS: Array<{ bone: BoneKey; axis: BodyAxis; factor: number }> = [
    { bone: "spineUpper", axis: "right", factor: -0.5 },
    { bone: "spineLower", axis: "right", factor: -0.22 },
    { bone: "neck", axis: "right", factor: -0.55 },
    { bone: "upperArmL", axis: "forward", factor: -1.5 },
    { bone: "upperArmR", axis: "forward", factor: 1.5 },
    { bone: "upperArmL", axis: "right", factor: -0.5 },
    { bone: "upperArmR", axis: "right", factor: -0.5 },
    { bone: "lowerArmL", axis: "forward", factor: -0.5 },
    { bone: "lowerArmR", axis: "forward", factor: 0.5 },
];

const FLINCH_DECAY = 2.6;

const CROUCH_DROP = 0.42;

const _axis = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();
const _bendQuat = new THREE.Quaternion();
const _scaleProbe = new THREE.Vector3();
const _bodyQuat = new THREE.Quaternion();
const _headVertex = new THREE.Vector3();

const headBoundsCache = new WeakMap<THREE.BufferGeometry, THREE.Box3 | null>();

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
    private flinchAmount = 0;

    private destination: THREE.Vector3 | null = null;
    private destinationSpeed = RUN_SPEED;
    private facingTarget: number | null = null;
    private stuckTimer = 0;
    private dodgeSign = 1;
    private dodgeHold = 0;

    private groundAt: ((x: number, z: number) => number) | null = null;
    private collisionGrid: CollisionGrid | null = null;

    private face: FaceRig | null = null;
    private poseBlend = 1;
    private skinnedMesh: THREE.SkinnedMesh | null = null;
    private headLocalBounds: THREE.Box3 | null = null;
    private hatObject: THREE.Object3D | null = null;

    constructor(private readonly spec: ActorSpec) {
        this.clock = spec.phase ?? 0;
        this.facing = spec.facing ?? 0;
        this.walk = spec.walk ?? null;
        this.scale = spec.scale ?? 1;
        this.dodgeSign = Math.sin((spec.phase ?? 0) * 12.9898) > 0 ? 1 : -1;
    }

    public setGroundProvider(provider: ((x: number, z: number) => number) | null) {
        this.groundAt = provider;
    }

    public setCollisionGrid(grid: CollisionGrid | null) {
        this.collisionGrid = grid;
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
        this.computeHeadBounds();

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
        this.attachFace(bin);
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
        this.skinnedMesh = mesh;

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
        if (hat) {
            head.add(hat);
            this.hatObject = hat;
        }
    }

    private computeHeadBounds(): void {
        const mesh = this.skinnedMesh;
        const head = this.bones.get("head");
        const skeleton = mesh?.skeleton;
        if (!mesh || !head || !skeleton) return;

        const cached = headBoundsCache.get(mesh.geometry);
        if (cached !== undefined) {
            this.headLocalBounds = cached;
            return;
        }

        const regions = buildRegionIndex(mesh);
        const headBoneIndex = skeleton.bones.indexOf(head as THREE.Bone);
        if (!regions || headBoneIndex < 0) {
            headBoundsCache.set(mesh.geometry, null);
            return;
        }

        const headRegion = BODY_REGIONS.indexOf("head");
        const boneInverse = skeleton.boneInverses[headBoneIndex];
        const position = mesh.geometry.getAttribute("position");
        const box = new THREE.Box3();

        for (let i = 0; i < position.count; i++) {
            if (regions[i] !== headRegion) continue;
            _headVertex.fromBufferAttribute(position, i);
            _headVertex.applyMatrix4(mesh.bindMatrix);
            _headVertex.applyMatrix4(boneInverse);
            box.expandByPoint(_headVertex);
        }

        const result = box.isEmpty() ? null : box;
        headBoundsCache.set(mesh.geometry, result);
        this.headLocalBounds = result;
    }

    private attachFace(bin: Bin) {
        const head = this.bones.get("head");
        if (!head) return;

        this.face = buildFace(this.spec.variant, bin, this.spec.phase ?? 0, this.headLocalBounds, this.hatObject);
        head.add(this.face.group);
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

        // Same seating as OtherPlayer: the mount starts under the unscaled outer group so
        // reparentPreservingWorldScale carries the bone's world scale into it.
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

        // The shared seating is tuned against the plain rifle clips; the firing ones carry
        // the hand 26° further back, which points the barrel up across the face. Corrected
        // here rather than in REMOTE_WEAPON_CLIP_TRANSFORMS so the player and Dust 2 keep
        // the seating they already have. The hip-fire pose already rotates the arm by the
        // same amount, so applying both would tip the barrel into the ground.
        if (this.clip.includes("firing") && this.spec.pose !== "hipFire") {
            this.weaponMount.rotation.x += FIRING_CLIP_WEAPON_PITCH;
        }
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
        this.poseBlend = 0;
        this.compilePose();
    }

    public setTalking(talking: boolean, text?: string) {
        this.face?.setTalking(talking, text);
    }

    public scream(active: boolean) {
        this.face?.scream(active);
    }

    // For an actor spawned already dead/dying (e.g. the cradle scene) — closing the eyes
    // without going through die() leaves its pose bends intact instead of wiping them.
    public setEyesClosed(closed: boolean) {
        if (closed) this.face?.close();
        else this.face?.open();
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

    public setWalkIndex(index: number) {
        if (!this.walk || this.walk.path.length === 0) return;
        this.walkIndex = ((index % this.walk.path.length) + this.walk.path.length) % this.walk.path.length;
        this.walkDirection = 1;
        this.waitLeft = 0;
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
        this.face?.close();
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
        this.poseBlend = 0;
        this.compilePose();
        this.face?.open();
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

        const chest = ensure("spineUpper");
        if (chest) {
            chest.bends.push({
                axis: "right",
                angle: 0,
                sway: BREATH_AMPLITUDE,
                rate: BREATH_RATE,
                phase: this.spec.phase ?? 0,
                blended: false,
            });
        }

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
                    blended: true,
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

        for (const entry of FLINCH_BENDS) {
            const target = ensure(entry.bone);
            if (!target) continue;
            target.overlays.push({ axis: entry.axis, kind: "flinch", factor: entry.factor });
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
                const weight = bend.blended ? this.poseBlend : 1;
                const angle = bend.sway !== 0
                    ? (bend.angle + Math.sin(this.clock * bend.rate + bend.phase) * bend.sway) * weight
                    : bend.angle * weight;
                this.bendBone(target.bone, bend.axis, angle);
            }

            for (const overlay of target.overlays) {
                const amount = overlay.kind === "aim"
                    ? this.aim
                    : overlay.kind === "crouch"
                        ? this.crouch
                        : overlay.kind === "flinch"
                            ? this.flinchAmount
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

    public flinch(strength = 1) {
        if (this.dead) return;
        this.flinchAmount = Math.min(1.2, this.flinchAmount + strength);
    }

    private turnTowards(angle: number, delta: number) {
        let diff = angle - this.facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.facing += diff * Math.min(1, TURN_RATE * delta);
        this.group.rotation.y = this.facing;
    }

    private collides(x: number, z: number): boolean {
        if (!this.collisionGrid) return false;
        const y = this.groundAt ? this.groundAt(x, z) : this.group.position.y;
        _colliderProbe.set(x, y + COLLIDER_HEIGHT / 2, z);
        return this.collisionGrid.checkCollisionHorizontal(_colliderProbe, _colliderSize);
    }

    private resolveStep(fromX: number, fromZ: number, stepX: number, stepZ: number): { x: number; z: number; moved: boolean } {
        const tryX = fromX + stepX;
        const tryZ = fromZ + stepZ;

        if (!this.collides(tryX, tryZ)) return { x: tryX, z: tryZ, moved: true };
        if (stepX !== 0 && !this.collides(tryX, fromZ)) return { x: tryX, z: fromZ, moved: true };
        if (stepZ !== 0 && !this.collides(fromX, tryZ)) return { x: fromX, z: tryZ, moved: true };

        return { x: fromX, z: fromZ, moved: false };
    }

    // Shared by advanceWalk/advanceDestination: walks straight at the target normally,
    // but once resolveStep has failed to make progress for STUCK_THRESHOLD seconds, steps
    // perpendicular to the blocked direction instead (flipping sides every DODGE_SWITCH
    // seconds if that's blocked too) until it clears whatever it was pressed against.
    private stepToward(dx: number, dz: number, distance: number, step: number, delta: number): boolean {
        const dodging = this.dodgeHold > 0;
        let dirX = dx / distance;
        let dirZ = dz / distance;

        // Committing to the sidestep for a while matters: a one-frame nudge just
        // oscillates against the wall, holding it long enough actually travels along
        // the wall until a gap opens up.
        if (dodging) {
            dirX = (-dz / distance) * this.dodgeSign;
            dirZ = (dx / distance) * this.dodgeSign;
            this.dodgeHold -= delta;
            if (this.dodgeHold <= 0) this.stuckTimer = 0;
        }

        const resolved = this.resolveStep(this.group.position.x, this.group.position.z, dirX * step, dirZ * step);
        this.group.position.x = resolved.x;
        this.group.position.z = resolved.z;

        if (this.groundAt) {
            this.group.position.y = this.groundAt(this.group.position.x, this.group.position.z);
        }

        if (resolved.moved) {
            if (!dodging) this.stuckTimer = 0;
            return true;
        }

        this.stuckTimer += delta;
        if (dodging) {
            this.dodgeSign = -this.dodgeSign;
            this.dodgeHold = DODGE_COMMIT;
        } else if (this.stuckTimer > STUCK_THRESHOLD) {
            this.dodgeHold = DODGE_COMMIT;
        }

        return false;
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
            } else if (walk.mode === "cycle" && this.walkIndex === walk.path.length - 1) {
                const start = walk.path[0];
                const y = this.groundAt ? this.groundAt(start.x, start.z) : start.y;
                this.group.position.set(start.x, y, start.z);
                this.walkIndex = 1 % walk.path.length;
            } else {
                this.walkIndex = (this.walkIndex + 1) % walk.path.length;
            }
            this.moving = false;
            return;
        }

        const speed = walk.speed ?? (walk.run ? RUN_SPEED : WALK_SPEED);
        const step = Math.min(distance, speed * delta);
        this.moving = this.stepToward(dx, dz, distance, step, delta);
        this.turnTowards(Math.atan2(dx, dz), delta);
    }

    private advanceDestination(delta: number) {
        const target = this.destination;
        if (!target) return false;

        const dx = target.x - this.group.position.x;
        const dz = target.z - this.group.position.z;
        const distance = Math.hypot(dx, dz);

        if (distance < 0.35) {
            this.destination = null;
            this.stuckTimer = 0;
            this.dodgeHold = 0;
            return false;
        }

        const step = Math.min(distance, this.destinationSpeed * delta);
        const moved = this.stepToward(dx, dz, distance, step, delta);
        this.turnTowards(Math.atan2(dx, dz), delta);

        // Nothing here can path around a large obstacle. Rather than press into it
        // forever, give the destination up and let the caller pick a new one.
        if (this.stuckTimer > STUCK_GIVE_UP) {
            this.destination = null;
            this.stuckTimer = 0;
            this.dodgeHold = 0;
        }

        return moved;
    }

    public update(delta: number) {
        this.clock += delta;

        if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - delta * 7);
        if (this.flinchAmount > 0) this.flinchAmount = Math.max(0, this.flinchAmount - delta * FLINCH_DECAY);

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
        this.poseBlend = Math.min(1, this.poseBlend + POSE_BLEND_RATE * delta);
        this.applyPose();
        this.face?.update(delta);
    }

    public dispose() {
        if (this.weaponRig) {
            disposeWeaponRig(this.weaponRig);
            this.weaponRig = null;
            this.weaponMount = null;
        }
        this.face = null;

        this.group.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh || !mesh.geometry) return;
            if (mesh.geometry.userData?.sharedAsset) return;
            mesh.geometry.dispose();
        });

        this.group.removeFromParent();
    }
}
