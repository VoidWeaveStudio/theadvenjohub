// src/features/game/world/locations/tower/floors/TokenGatesFloor.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { GateLayoutSystem, HALL_HALF } from "./token-gates/systems/GateLayoutSystem";
import { GateDisplaySystem } from "./token-gates/systems/GateDisplaySystem";
import { StewardSystem } from "./token-gates/systems/StewardSystem";
import type { FactionGateData } from "../../../../network/NetworkManager";

export class TokenGatesFloor extends TowerFloor {
    public readonly layout: GateLayoutSystem;
    public readonly display: GateDisplaySystem;
    public readonly steward: StewardSystem;

    constructor() {
        super('tower-token-gates', 'Token Gates');
        this.layout = new GateLayoutSystem(this);
        this.display = new GateDisplaySystem(this);
        this.steward = new StewardSystem(this);
    }

    create(rm: ResourceManager): void {
        const skyColor = 0x87ceeb;
        const groundColor = 0xc2b280;
        this.scene.add(new THREE.HemisphereLight(skyColor, groundColor, 0.85));
        this.scene.background = new THREE.Color(skyColor);

        const sun = new THREE.DirectionalLight(0xfff1d0, 1.25);
        sun.position.set(80, 120, 60);
        sun.target.position.set(0, 0, 0);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -HALL_HALF;
        sun.shadow.camera.right = HALL_HALF;
        sun.shadow.camera.top = HALL_HALF;
        sun.shadow.camera.bottom = -HALL_HALF;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 300;
        this.scene.add(sun);
        this.scene.add(sun.target);

        this.scene.fog = new THREE.FogExp2(0xe6d5b8, 0.004);

        this.layout.create();
        this.steward.create(rm);
        this.createCentralCrystal();
        this.display.start();
    }

    public handleFactionGatesState(list: FactionGateData[]) {
        this.display.handleFactionGatesState(list);
    }

    public addLocalGate(data: FactionGateData) {
        this.display.addLocalGate(data);
    }

    public getFactionGateInfo(factionId: string): FactionGateData | undefined {
        return this.display.getFactionGateInfo(factionId);
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        this.steward.update(delta);
        this.display.update(delta);

        if (this.layout.exitZone.containsPoint(playerPosition)) {
            this.pendingTeleport = 'open-world-canyon';
        }
    }

    public override getInteractables(): THREE.Object3D[] {
        const interactables = [...super.getInteractables(), ...this.display.getInteractables()];
        if (this.steward.npc) interactables.push(this.steward.npc.group);
        return interactables;
    }

    dispose() {
        this.steward.dispose();
        this.display.dispose();
        this.layout.dispose();
        super.dispose();
    }
}
