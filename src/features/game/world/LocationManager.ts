//src\features\game\world\LocationManager.ts
import * as THREE from "three";
import { Location, Portal } from "./Location";
import { ResourceManager } from "../core/ResourceManager";
import { MainWorld } from "./locations/MainWorld";
import { Cave } from "./locations/Cave";

export class LocationManager {
    private locations: Map<string, Location> = new Map();
    private currentLocation: Location | null = null;
    private renderer: THREE.WebGLRenderer;
    private activeCamera: THREE.Camera;

    public onLocationChange?: (locationId: string) => void;
    public onPortalApproach?: (portal: Portal | null) => void;

    constructor(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
        this.renderer = renderer;
        this.activeCamera = camera;
    }

    registerLocations(rm: ResourceManager) {
        const main = new MainWorld();
        main.create(rm);
        this.locations.set(main.id, main);

        const cave = new Cave();
        cave.create(rm);
        this.locations.set(cave.id, cave);
    }

    async loadLocation(locationId: string): Promise<Location | null> {
        const location = this.locations.get(locationId);
        if (!location) {
            console.error(`[LocationManager] Location not found: ${locationId}`);
            return null;
        }
        this.currentLocation = location;
        this.onLocationChange?.(locationId);
        return location;
    }

    getCurrentLocation(): Location | null {
        return this.currentLocation;
    }

    checkPortals(playerPosition: THREE.Vector3): Portal | null {
        if (!this.currentLocation) return null;

        for (const portal of this.currentLocation.portals) {
            const dist = playerPosition.distanceTo(portal.position);
            if (dist <= portal.radius) {
                return portal;
            }
        }
        return null;
    }

    async teleportTo(portal: Portal, player: any): Promise<boolean> {
        const target = this.locations.get(portal.targetLocationId);
        if (!target) return false;

        this.currentLocation = target;
        player.mesh.position.copy(portal.targetSpawnPoint);
        this.onLocationChange?.(target.id);
        return true;
    }

    render() {
        if (!this.currentLocation) return;
        this.renderer.render(this.currentLocation.scene, this.activeCamera);
    }

    dispose() {
        this.locations.forEach((loc) => loc.dispose());
        this.locations.clear();
    }
}