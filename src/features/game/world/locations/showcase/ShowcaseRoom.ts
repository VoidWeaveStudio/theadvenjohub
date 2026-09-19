// src/features/game/world/locations/showcase/ShowcaseRoom.ts
import * as THREE from "three";
import { TowerFloor } from "../tower/TowerFloor";
import { ResourceManager } from "../../../core/ResourceManager";
import { AssetBin } from "../../AssetBin";
import { ShowcaseCrowd } from "./actors/ShowcaseCrowd";
import { SECOND_WORLD_ID, ShowcaseInfo } from "./config";
import { ShowcaseTextures, surfaceMaterial } from "./textures";
import { speechTexture, Story, StoryStep } from "./story";
import type { HeightProvider } from "../../Location";
import { t } from "@/core/i18n";
import type { ShowcaseActor } from "./actors/ShowcaseActor";
import { areCaptionsHidden } from "./captionVisibility";

const EXIT_RANGE = 7.5;

export function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

export abstract class ShowcaseRoom extends TowerFloor {
    protected readonly bin = new AssetBin();
    protected readonly random: () => number;
    protected readonly info: ShowcaseInfo;
    protected readonly crowd: ShowcaseCrowd;
    protected readonly tex: ShowcaseTextures;
    protected elapsed = 0;
    private stories: Story[] = [];
    private captionMaterials: THREE.SpriteMaterial[] = [];
    private talkers: Array<{ sprite: THREE.Sprite; speaker: ShowcaseActor; text: string }> = [];
    private readonly activeTalkerText = new Map<ShowcaseActor, string>();
    private readonly processedTalkers = new Set<ShowcaseActor>();

    public terrain: HeightProvider = { getHeightAt: (x, z) => this.groundHeight(x, z) };

    protected exitPosition = new THREE.Vector3(0, 0, 0);
    protected exitFacing = 0;

    // Where the exit gate leads. A set reached from the Second World hub sends the
    // player back there; the same set standing in for a faction's bubble has to return
    // to the galaxy instead, like every other room entered from Basement.
    public exitTarget: string = SECOND_WORLD_ID;
    protected spawnPosition = new THREE.Vector3(0, 0, 6);
    protected spawnFacing = 0;

    private exitVeil: THREE.MeshBasicMaterial | null = null;
    private exitLight: THREE.PointLight | null = null;

    constructor(info: ShowcaseInfo, seed: number, roomRadius: number) {
        super(info.id, info.nameKey);
        this.info = info;
        this.random = makeRandom(seed);
        this.crowd = new ShowcaseCrowd(this.scene, this.bin, this.random);
        this.tex = new ShowcaseTextures(this.bin, this.random);
        this.maxPlayerRadius = roomRadius;
        this.cameraBounds = { radius: roomRadius + 6, minY: -40, maxY: 220 };
    }

    protected matte(color: number, roughness = 0.85, metalness = 0.04): THREE.MeshStandardMaterial {
        return this.bin.material(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    }

    protected textured(
        map: THREE.Texture,
        options: { roughness?: number; metalness?: number; bump?: number; color?: number; emissive?: number; emissiveIntensity?: number } = {}
    ): THREE.MeshStandardMaterial {
        return surfaceMaterial(this.bin, map, options);
    }

    protected bubble(
        text: string,
        accent: string,
        options: { width?: number; tone?: "say" | "shout" | "think"; y?: number; speaker?: ShowcaseActor } = {}
    ): THREE.Sprite {
        const texture = speechTexture(this.bin, text, accent, options.tone ?? "say");
        const material = this.bin.material(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
        const sprite = new THREE.Sprite(material);
        const width = options.width ?? 2.6;
        sprite.scale.set(width, width * 0.375, 1);
        sprite.position.y = options.y ?? 2.9;
        sprite.visible = false;
        sprite.renderOrder = 6;

        this.captionMaterials.push(material);
        if (options.speaker) this.talkers.push({ sprite, speaker: options.speaker, text });

        return sprite;
    }

    protected addStory(steps: StoryStep[]): Story {
        const story = new Story(steps);
        this.stories.push(story);
        return story;
    }

    protected decal(
        map: THREE.Texture,
        options: { roughness?: number; metalness?: number; color?: number; emissive?: number; emissiveIntensity?: number } = {}
    ): THREE.MeshStandardMaterial {
        const material = surfaceMaterial(this.bin, map, options);
        material.polygonOffset = true;
        material.polygonOffsetFactor = -4;
        material.polygonOffsetUnits = -8;
        material.side = THREE.FrontSide;
        return material;
    }

    protected board(
        map: THREE.Texture,
        width: number,
        height: number,
        position?: [number, number, number],
        rotationY = 0,
        options: { roughness?: number; metalness?: number; color?: number; emissive?: number; emissiveIntensity?: number; segments?: number; oneSided?: boolean; offset?: number } = {}
    ): THREE.Group {
        const group = new THREE.Group();
        const material = this.decal(map, options);
        const segments = options.segments ?? 1;
        const offset = options.offset ?? 0.015;

        const front = new THREE.Mesh(this.bin.geometry(new THREE.PlaneGeometry(width, height, segments, segments)), material);
        front.position.z = offset;
        front.castShadow = false;
        front.receiveShadow = false;
        group.add(front);

        if (!options.oneSided) {
            const back = new THREE.Mesh(this.bin.geometry(new THREE.PlaneGeometry(width, height, segments, segments)), material);
            back.position.z = -offset;
            back.rotation.y = Math.PI;
            back.castShadow = false;
            back.receiveShadow = false;
            group.add(back);
        }

        if (position) group.position.set(position[0], position[1], position[2]);
        group.rotation.y = rotationY;
        return group;
    }

    protected waveBoard(group: THREE.Group, time: number, amplitude: number, index = 0) {
        for (let i = 0; i < group.children.length; i++) {
            const mesh = group.children[i] as THREE.Mesh;
            const attribute = (mesh.geometry as THREE.PlaneGeometry).getAttribute("position") as THREE.BufferAttribute;
            if (!attribute) continue;
            const array = attribute.array as Float32Array;
            const flip = mesh.rotation.y === 0 ? 1 : -1;
            for (let v = 0; v < array.length; v += 3) {
                const along = array[v] * flip;
                array[v + 2] = flip * Math.sin(time * 2.1 + along * 2.4 + index) * amplitude * (along + 1.4);
            }
            attribute.needsUpdate = true;
        }
    }

    protected metal(color: number, roughness = 0.34, metalness = 0.88): THREE.MeshStandardMaterial {
        return this.bin.material(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    }

    protected lit(color: number, intensity = 1.6): THREE.MeshStandardMaterial {
        return this.bin.material(new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: intensity,
            roughness: 0.4,
            metalness: 0.1,
        }));
    }

    protected glow(color: number, opacity = 0.6, additive = true): THREE.MeshBasicMaterial {
        return this.bin.material(new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            toneMapped: false,
        }));
    }

    protected mesh(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        position?: [number, number, number],
        rotation?: [number, number, number]
    ): THREE.Mesh {
        const created = new THREE.Mesh(this.bin.geometry(geometry), material);
        if (position) created.position.set(position[0], position[1], position[2]);
        if (rotation) created.rotation.set(rotation[0], rotation[1], rotation[2]);
        created.castShadow = true;
        created.receiveShadow = true;
        return created;
    }

    protected addSolidBox(
        parent: THREE.Object3D,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        position: [number, number, number],
        rotationY = 0,
        size?: [number, number, number]
    ): THREE.Mesh {
        const created = this.mesh(geometry, material, position, [0, rotationY, 0]);
        parent.add(created);

        if (size) {
            this.collisionGrid.insertOrientedBox(
                position[0],
                position[2],
                size[0],
                size[2],
                rotationY,
                position[1] - size[1] / 2,
                position[1] + size[1] / 2
            );
        }

        return created;
    }

    protected groundHeight(_x: number, _z: number): number {
        return 0;
    }

    create(rm: ResourceManager): void {
        this.collisionGrid.clear();
        this.crowd.setGroundProvider((x, z) => this.groundHeight(x, z));
        this.buildAtmosphere();
        this.decorate(rm);
        this.buildExitGate();
        this.crowd.create(rm, this.collisionGrid);
    }

    protected abstract buildAtmosphere(): void;
    protected abstract decorate(rm: ResourceManager): void;

    protected tick(_delta: number): void { }

    protected buildExitGate(): void {
        const group = new THREE.Group();
        group.position.copy(this.exitPosition);
        group.rotation.y = this.exitFacing;

        const stone = this.matte(this.info.gateStone, 0.76, 0.14);
        const trim = this.metal(0xd8b46a, 0.3, 0.9);

        for (const side of [-1, 1]) {
            const jamb = this.mesh(new THREE.BoxGeometry(1.1, 7.2, 1.3), stone, [side * 2.6, 3.6, 0]);
            group.add(jamb);

            const base = this.mesh(new THREE.BoxGeometry(1.7, 0.5, 1.9), trim, [side * 2.6, 0.25, 0]);
            group.add(base);
        }

        const arch = this.mesh(new THREE.TorusGeometry(2.6, 0.58, 10, 24, Math.PI), stone, [0, 7.2, 0]);
        group.add(arch);

        const keystone = this.mesh(new THREE.OctahedronGeometry(0.75, 0), trim, [0, 9.9, 0]);
        group.add(keystone);

        this.exitVeil = this.glow(this.info.accent, 0.42);
        const veil = new THREE.Mesh(this.bin.geometry(new THREE.PlaneGeometry(5.1, 7.2)), this.exitVeil);
        veil.position.set(0, 3.6, 0);
        veil.renderOrder = 4;
        group.add(veil);

        const dome = new THREE.Mesh(this.bin.geometry(new THREE.CircleGeometry(2.55, 22, 0, Math.PI)), this.exitVeil);
        dome.position.set(0, 7.2, 0);
        group.add(dome);

        const step = this.mesh(new THREE.BoxGeometry(7.4, 0.28, 2.6), trim, [0, 0.14, 1.4]);
        group.add(step);

        this.exitLight = new THREE.PointLight(this.info.accent, 18, 30, 2);
        this.exitLight.position.set(0, 4.4, 1.2);
        group.add(this.exitLight);

        this.scene.add(group);

        this.collisionGrid.insertOrientedBox(
            this.exitPosition.x,
            this.exitPosition.z,
            7.4,
            1.6,
            this.exitFacing,
            this.exitPosition.y,
            this.exitPosition.y + 8
        );
    }

    public getInteractionPrompt(playerPosition: THREE.Vector3): string | null {
        if (playerPosition.distanceTo(this.exitPosition) > EXIT_RANGE) return null;
        return t("g.showcase.exit");
    }

    private updateTalkers(): void {
        if (this.talkers.length === 0) return;

        this.activeTalkerText.clear();
        for (const talker of this.talkers) {
            if (talker.sprite.visible) this.activeTalkerText.set(talker.speaker, talker.text);
        }

        this.processedTalkers.clear();
        for (const talker of this.talkers) {
            if (this.processedTalkers.has(talker.speaker)) continue;
            this.processedTalkers.add(talker.speaker);
            const text = this.activeTalkerText.get(talker.speaker);
            talker.speaker.setTalking(text !== undefined, text);
        }
    }

    override update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean): void {
        this.elapsed += delta;
        this.crowd.update(delta);
        for (let i = 0; i < this.stories.length; i++) this.stories[i].update(delta);

        this.updateTalkers();

        const opacity = areCaptionsHidden() ? 0 : 1;
        for (let i = 0; i < this.captionMaterials.length; i++) this.captionMaterials[i].opacity = opacity;

        this.tick(delta);

        if (this.exitVeil) this.exitVeil.opacity = 0.36 + Math.sin(this.elapsed * 1.7) * 0.09;
        if (this.exitLight) this.exitLight.intensity = 16 + Math.sin(this.elapsed * 2.3) * 4;

        if (isEPressed && playerPosition.distanceTo(this.exitPosition) <= EXIT_RANGE) {
            this.pendingTeleport = this.exitTarget;
        }
    }

    getSpawnPoint(): THREE.Vector3 {
        return this.spawnPosition.clone();
    }

    dispose(): void {
        this.stories = [];
        this.captionMaterials = [];
        this.talkers = [];
        this.exitVeil = null;
        this.exitLight = null;
        this.crowd.dispose();
        super.dispose();
        this.bin.dispose();
    }
}
