// src/features/game/world/LocationManager.ts
import * as THREE from "three";
import { Location, Portal } from "./Location";
import { ResourceManager } from "../core/ResourceManager";
import { MainWorld } from "./locations/main-world/MainWorld";
import { Cave } from "./locations/Cave";
import { ALL_LOCATIONS } from "./locations/tower/TowerRegistry";

export class LocationManager {
    private locations: Map<string, Location> = new Map();
    private locationFactories: Map<string, () => Location> = new Map();
    private currentLocation: Location | null = null;
    private readonly persistentLocationIds = new Set(["main-world"]);
    private renderer: THREE.WebGLRenderer;
    private activeCamera: THREE.Camera;
    private resourceManager: ResourceManager | null = null;

    public onLocationChange?: (locationId: string) => void;
    public onPortalApproach?: (portal: Portal | null) => void;

    constructor(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
        this.renderer = renderer;
        this.activeCamera = camera;
    }

    registerLocations(rm: ResourceManager) {
    this.resourceManager = rm;
    this.locationFactories.set("cave", () => new Cave());

    ALL_LOCATIONS.forEach(floor => {
        this.locationFactories.set(floor.id, () => floor.locationClass());
    });
}

    async loadLocation(locationId: string): Promise<Location | null> {
        let location = this.locations.get(locationId);
        if (!location) {
            const factory = this.locationFactories.get(locationId);
            if (!factory) {
                throw new Error(`Location not found: ${locationId}`);
            }
            location = factory();
            if (this.resourceManager) {
                location.create(this.resourceManager);
            }
            this.locations.set(locationId, location);
        }
        this.currentLocation = location;
        this.onLocationChange?.(locationId);
        return location;
    }

    getCurrentLocation(): Location | null {
        return this.currentLocation;
    }

    evictLocation(locationId: string) {
        if (this.persistentLocationIds.has(locationId)) return;
        if (this.currentLocation?.id === locationId) return;

        const location = this.locations.get(locationId);
        if (!location) return;

        location.dispose();
        this.locations.delete(locationId);
    }

    checkPortals(playerPosition: THREE.Vector3): Portal | null {
        if (!this.currentLocation) return null;
        for (const portal of this.currentLocation.portals) {
            if (playerPosition.distanceTo(portal.position) <= portal.radius) {
                return portal;
            }
        }
        return null;
    }

    async teleportTo(portal: Portal, player: any): Promise<boolean> {
        const previousLocation = this.currentLocation;
        const target = await this.loadLocation(portal.targetLocationId);
        if (!target) return false;

        this.currentLocation = target;
        player.mesh.position.copy(portal.targetSpawnPoint);

        if ('getHeightAt' in target) {
            player.mesh.position.y = (target as any).getHeightAt(player.mesh.position.x, player.mesh.position.z);
        }

        if (previousLocation) {
            this.evictLocation(previousLocation.id);
        }

        this.onLocationChange?.(target.id);
        return true;
    }

    async teleportToLocation(locationId: string, player: any): Promise<boolean> {
        const target = await this.loadLocation(locationId);
        if (!target) return false;
        player.teleportTo(target.getSpawnPoint());
        this.onLocationChange?.(target.id);
        return true;
    }

    render() {
        if (!this.currentLocation || !this.currentLocation.scene) return;
        this.renderer.render(this.currentLocation.scene, this.activeCamera);
    }

    dispose() {
        this.locations.forEach((loc) => loc.dispose());
        this.locations.clear();
    }
}