// src/features/game/world/locations/tower/floors/basement/systems/BasementSceneSetup.ts
import * as THREE from "three";
import { EquirectangularReflectionMapping } from "three";
import { ResourceManager } from "../../../../../../core/ResourceManager";
import type { Basement } from "../Basement";
import { createProceduralPortal, type ProceduralPortal } from "../utils/proceduralPortal";

export function setupBasementSky(
    floor: Basement,
    rm: ResourceManager,
    onReady: (skySphere: THREE.Group) => void,
    isDisposed: () => boolean = () => false
) {
    const cosmosData = rm.getModel("cosmos");
    const nebulaTexture = rm.getTexture("nebula-sky");

    const setupSky = (data: any, tex: THREE.Texture) => {
        const skySphere = data.scene as THREE.Group;
        skySphere.scale.set(3600, 3600, 3600);
        skySphere.position.set(0, 0, 0);
        skySphere.renderOrder = -1000;

        skySphere.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mat = new THREE.MeshBasicMaterial({
                    map: tex,
                    color: 0xffffff,
                    side: THREE.BackSide,
                    depthTest: true,
                    depthWrite: false,
                    toneMapped: false
                });
                mesh.material = mat;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                mesh.renderOrder = -1000;
            }
        });

        floor.scene.add(skySphere);

        const applyEnvironment = () => {
            if (isDisposed()) return;
            const envTexture = rm.getTexture("nebula-env");
            if (!envTexture) return;

            envTexture.mapping = EquirectangularReflectionMapping;
            floor.scene.environment = envTexture;
            (floor.scene as any).environmentIntensity = 0.55;
        };

        if (rm.getTexture("nebula-env")) {
            applyEnvironment();
        } else {
            rm.onTextureLoaded("nebula-env", applyEnvironment);
        }

        onReady(skySphere);
    };

    if (cosmosData && nebulaTexture) {
        setupSky(cosmosData, nebulaTexture);
    } else {
        console.warn("[Basement] Cosmos or nebula not loaded yet, waiting for lazy load...");

        let cData = cosmosData;
        let nTex = nebulaTexture;

        const trySetup = () => {
            if (isDisposed()) return;

            if (!cData) cData = rm.getModel("cosmos");
            if (!nTex) nTex = rm.getTexture("nebula-sky");

            if (cData && nTex) {
                setupSky(cData, nTex);
            }
        };

        if (!cosmosData) {
            rm.onModelLoaded("cosmos", () => {
                cData = rm.getModel("cosmos");
                trySetup();
            });
        }
        if (!nebulaTexture) {
            rm.onTextureLoaded("nebula-sky", () => {
                nTex = rm.getTexture("nebula-sky");
                trySetup();
            });
        }
    }
}

export function setupBasementFloor(floor: Basement, rm: ResourceManager, isDisposed: () => boolean = () => false) {
    const floorColor = rm.getTexture("floor-color");
    const floorNormal = rm.getTexture("floor-normal");
    const floorRough = rm.getTexture("floor-roughness");

    if (floorColor) floorColor.repeat.set(20, 20);
    if (floorNormal) floorNormal.repeat.set(20, 20);
    if (floorRough) floorRough.repeat.set(20, 20);

    const floorMat = new THREE.MeshStandardMaterial({
        roughness: 0.82,
        metalness: 0.08,
    });
    if (floorColor) floorMat.map = floorColor;
    if (floorNormal) floorMat.normalMap = floorNormal;
    if (floorRough) floorMat.roughnessMap = floorRough;

    if (!floorColor) {
        rm.onTextureLoaded("floor-color", () => {
            if (isDisposed()) return;
            const tex = rm.getTexture("floor-color");
            if (!tex) return;
            tex.repeat.set(20, 20);
            floorMat.map = tex;
            floorMat.needsUpdate = true;
        });
    }
    if (!floorNormal) {
        rm.onTextureLoaded("floor-normal", () => {
            if (isDisposed()) return;
            const tex = rm.getTexture("floor-normal");
            if (!tex) return;
            tex.repeat.set(20, 20);
            floorMat.normalMap = tex;
            floorMat.needsUpdate = true;
        });
    }
    if (!floorRough) {
        rm.onTextureLoaded("floor-roughness", () => {
            if (isDisposed()) return;
            const tex = rm.getTexture("floor-roughness");
            if (!tex) return;
            tex.repeat.set(20, 20);
            floorMat.roughnessMap = tex;
            floorMat.needsUpdate = true;
        });
    }

    const radius = 90;
    const holeRadius = 3.6;

    const outerFloor = new THREE.Mesh(
        new THREE.RingGeometry(holeRadius, radius, 64),
        floorMat
    );
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = 0;
    outerFloor.receiveShadow = true;
    floor.scene.add(outerFloor);

    const wellDepth = Math.abs(floor.SINK_Y) + 1;
    const wellGeo = new THREE.CylinderGeometry(
        holeRadius,
        holeRadius,
        wellDepth,
        64,
        1,
        true
    );

    const wellMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 1,
        metalness: 0,
        side: THREE.BackSide
    });

    const well = new THREE.Mesh(wellGeo, wellMat);
    well.position.y = -wellDepth / 2;
    well.receiveShadow = false;
    well.castShadow = false;
    floor.scene.add(well);

    floor.collisionGrid.insertCylinder(
        new THREE.Vector3(0, 0, 0),
        3.8,
        4
    );

    const floorSegments = 32;
    for (let i = 0; i < floorSegments; i++) {
        const angle1 = (i / floorSegments) * Math.PI * 2;
        const angle2 = ((i + 1) / floorSegments) * Math.PI * 2;
        const pts = [
            new THREE.Vector3(Math.cos(angle1) * holeRadius, 0, Math.sin(angle1) * holeRadius),
            new THREE.Vector3(Math.cos(angle2) * holeRadius, 0, Math.sin(angle2) * holeRadius),
            new THREE.Vector3(Math.cos(angle1) * radius, 0, Math.sin(angle1) * radius),
            new THREE.Vector3(Math.cos(angle2) * radius, 0, Math.sin(angle2) * radius)
        ];
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.z < minZ) minZ = p.z;
            if (p.z > maxZ) maxZ = p.z;
        }
        floor.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(minX, -0.2, minZ),
            new THREE.Vector3(maxX, 0, maxZ)
        ));
    }

    return { radius, holeRadius };
}

export interface BasementPortals {
    source: ProceduralPortal;
    sink: ProceduralPortal;
}

export function setupBasementPortals(floor: Basement): BasementPortals {
    const source = createProceduralPortal({
        radius: 8.6,
        inner: 0xd8f4ff,
        outer: 0x1f6bd8,
        ringColor: 0x8fd8ff,
        facing: "down",
        withBeam: true,
    });
    source.group.position.set(0, floor.HOLE_Y, 0);
    floor.scene.add(source.group);

    const sink = createProceduralPortal({
        radius: 3.6,
        inner: 0x6ce0ff,
        outer: 0x0b2a5a,
        ringColor: 0x3aa8ff,
        facing: "up",
    });
    sink.group.position.set(0, floor.SINK_Y, 0);
    floor.scene.add(sink.group);

    return { source, sink };
}
