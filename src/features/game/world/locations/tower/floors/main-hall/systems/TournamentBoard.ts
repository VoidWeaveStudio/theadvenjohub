// src/features/game/world/locations/tower/floors/main-hall/systems/TournamentBoard.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../../../CollisionGrid";
import type { TournamentSummary } from "@/core/lib/tournaments";
import { AssetBin } from "../utils/assetBin";
import { GeometryBatch } from "../utils/geometryBatch";
import { insertLocalBox } from "../utils/collision";
import { onLanguageChange } from "@/core/i18n";
import { getAnisotropy } from "../utils/textureQuality";
import type { ShellMaterials } from "./HallShell";
import { PRIZE_BOARD_HEIGHT, PRIZE_BOARD_WIDTH, drawTournamentBoard } from "../utils/boards";
import {
    TOURNAMENT_BOARD_ANGLE,
    TOURNAMENT_BOARD_INTERACTION,
    TOURNAMENT_BOARD_BOTTOM,
    TOURNAMENT_BOARD_HEIGHT,
    TOURNAMENT_BOARD_RADIUS,
    TOURNAMENT_BOARD_WIDTH,
    inwardRotation,
    localToWorld,
} from "../layout";

const MAST_THICKNESS = 1.1;
const CONSOLE_FORWARD = 3.6;
const CONSOLE_HEIGHT = 1.15;
const INTERACTION_RADIUS = 7;
// The countdown on the panel only ever moves in whole minutes, so redrawing the
// canvas more often than that buys nothing.
const CLOCK_REPAINT_SECONDS = 30;

export class TournamentBoard {
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private texture!: THREE.CanvasTexture;

    private console: THREE.Mesh | null = null;
    private beacon: THREE.Mesh | null = null;
    private tournaments: TournamentSummary[] = [];
    private time = 0;
    private repaintTimer = 0;

    private stopLanguageWatch: (() => void) | null = null;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly collisionGrid: CollisionGrid,
        private readonly bin: AssetBin
    ) { }

    create(materials: ShellMaterials) {
        const angle = TOURNAMENT_BOARD_ANGLE;
        const radius = TOURNAMENT_BOARD_RADIUS;
        const rotation = inwardRotation(angle);
        const at = (lx: number, ly: number, lz: number) => localToWorld(angle, radius, lx, ly, lz);

        this.canvas = document.createElement("canvas");
        this.canvas.width = PRIZE_BOARD_WIDTH;
        this.canvas.height = PRIZE_BOARD_HEIGHT;
        this.ctx = this.canvas.getContext("2d")!;

        this.texture = this.bin.texture(new THREE.CanvasTexture(this.canvas));
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.anisotropy = getAnisotropy();

        const frameBatch = new GeometryBatch();
        const brassBatch = new GeometryBatch();
        const panelBatch = new GeometryBatch();

        const box = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const plane = this.bin.geometry(new THREE.PlaneGeometry(1, 1));

        const centerY = TOURNAMENT_BOARD_BOTTOM + TOURNAMENT_BOARD_HEIGHT / 2;
        const topY = TOURNAMENT_BOARD_BOTTOM + TOURNAMENT_BOARD_HEIGHT;

        const backing = at(0, centerY, -0.45);
        frameBatch.addScaled(
            box,
            backing[0],
            backing[1],
            backing[2],
            TOURNAMENT_BOARD_WIDTH + 1.6,
            TOURNAMENT_BOARD_HEIGHT + 1.6,
            0.9,
            rotation
        );

        for (const side of [-1, 1]) {
            const mastX = side * (TOURNAMENT_BOARD_WIDTH / 2 - 0.3);

            const mast = at(mastX, TOURNAMENT_BOARD_BOTTOM / 2, -0.45);
            frameBatch.addScaled(box, mast[0], mast[1], mast[2], MAST_THICKNESS, TOURNAMENT_BOARD_BOTTOM, MAST_THICKNESS, rotation);

            const foot = at(mastX, 0.3, -0.45);
            brassBatch.addScaled(box, foot[0], foot[1], foot[2], MAST_THICKNESS + 1.2, 0.6, MAST_THICKNESS + 1.2, rotation);

            insertLocalBox(
                this.collisionGrid,
                angle,
                radius,
                mastX,
                -0.45,
                MAST_THICKNESS + 1.2,
                MAST_THICKNESS + 1.2,
                0,
                TOURNAMENT_BOARD_BOTTOM
            );
        }

        for (const [y, depth] of [[topY + 0.85, -0.2], [TOURNAMENT_BOARD_BOTTOM - 0.85, -0.2]] as const) {
            const trim = at(0, y, depth);
            brassBatch.addScaled(box, trim[0], trim[1], trim[2], TOURNAMENT_BOARD_WIDTH + 2.4, 0.34, 1.1, rotation);
        }

        const panelAt = at(0, centerY, 0.08);
        panelBatch.addPanel(
            plane,
            panelAt[0],
            panelAt[1],
            panelAt[2],
            TOURNAMENT_BOARD_WIDTH,
            TOURNAMENT_BOARD_HEIGHT,
            rotation,
            { scaleU: 1, scaleV: 1, offsetU: 0, offsetV: 0 }
        );

        const frame = frameBatch.build(materials.darkTrim, { castShadow: true, receiveShadow: true });
        if (frame) this.scene.add(frame);

        const brass = brassBatch.build(materials.brass, { castShadow: true, receiveShadow: true });
        if (brass) this.scene.add(brass);

        const panel = panelBatch.build(this.bin.material(new THREE.MeshStandardMaterial({
            map: this.texture,
            emissiveMap: this.texture,
            emissive: 0xffffff,
            emissiveIntensity: 0.8,
            roughness: 0.28,
            metalness: 0.05,
        })));
        if (panel) this.scene.add(panel);

        this.buildConsole(at, rotation, angle, radius);

        // No wash light here on purpose. The hall already carries two
        // RectAreaLights for the big boards, and rect lights are among the most
        // expensive per-fragment lights three.js has — this hall measures as
        // fragment-bound. The panel material is emissive, so it reads as lit
        // without adding a third one.

        this.paint();

        this.stopLanguageWatch = onLanguageChange(() => this.paint());
    }

    // A waist-high lectern in front of the panel. It is what the player actually
    // presses E on, so the prompt fires at a sane distance instead of anywhere
    // within reach of a 20-unit-wide billboard.
    private buildConsole(
        at: (lx: number, ly: number, lz: number) => [number, number, number],
        rotation: number,
        angle: number,
        radius: number
    ) {
        const base = at(0, CONSOLE_HEIGHT / 2, CONSOLE_FORWARD);

        const console = new THREE.Mesh(
            this.bin.geometry(new THREE.CylinderGeometry(0.75, 0.95, CONSOLE_HEIGHT, 16)),
            this.bin.material(new THREE.MeshStandardMaterial({
                color: 0x1b1f2a,
                roughness: 0.5,
                metalness: 0.4,
            }))
        );
        console.position.set(base[0], base[1], base[2]);
        console.rotation.y = rotation;
        console.castShadow = true;
        console.receiveShadow = true;
        console.userData.interactionId = TOURNAMENT_BOARD_INTERACTION;
        console.userData.interactionRadius = INTERACTION_RADIUS;
        this.scene.add(console);
        this.console = console;

        const beacon = new THREE.Mesh(
            this.bin.geometry(new THREE.OctahedronGeometry(0.34, 0)),
            this.bin.material(new THREE.MeshStandardMaterial({
                color: 0xffd166,
                emissive: 0xffd166,
                emissiveIntensity: 3,
                toneMapped: false,
            }))
        );
        beacon.position.set(base[0], base[1] + CONSOLE_HEIGHT / 2 + 0.55, base[2]);
        this.scene.add(beacon);
        this.beacon = beacon;

        this.collisionGrid.insertCylinder(
            new THREE.Vector3(base[0], CONSOLE_HEIGHT / 2, base[2]),
            0.95,
            CONSOLE_HEIGHT
        );

        // Keeps a player from walking into the panel itself from the front.
        insertLocalBox(this.collisionGrid, angle, radius, 0, -0.45, TOURNAMENT_BOARD_WIDTH, 1.2, 0, 1.5);
    }

    private paint() {
        if (!this.ctx) return;
        drawTournamentBoard(this.ctx, this.tournaments);
        this.texture.needsUpdate = true;
    }

    setTournaments(list: TournamentSummary[]) {
        this.tournaments = list;
        this.repaintTimer = CLOCK_REPAINT_SECONDS;
        this.paint();
    }

    getInteractable(): THREE.Object3D | null {
        return this.console;
    }

    update(delta: number) {
        this.time += delta;

        if (this.beacon) {
            this.beacon.rotation.y += delta * 0.9;
            this.beacon.position.y += Math.sin(this.time * 1.6) * delta * 0.35;
        }

        this.repaintTimer -= delta;
        if (this.repaintTimer <= 0) {
            this.repaintTimer = CLOCK_REPAINT_SECONDS;
            if (this.tournaments.length > 0) this.paint();
        }
    }

    dispose() {
        this.stopLanguageWatch?.();
        this.stopLanguageWatch = null;
        this.console = null;
        this.beacon = null;
        this.tournaments = [];
    }
}
