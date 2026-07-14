//src\features\game\world\locations\Tower.ts
import * as THREE from "three";
import { Location } from "../Location";
import { ResourceManager } from "../../core/ResourceManager";
import { CollisionGrid } from "../CollisionGrid";

export class Tower extends Location {
    public collisionGrid: CollisionGrid;
    private mainLight: THREE.PointLight | null = null;
    private time: number = 0;

    constructor() {
        super("tower", "Gloomy Tower Interior");
        this.collisionGrid = new CollisionGrid(20);
    }

    create(rm: ResourceManager) {
        this.scene.background = new THREE.Color(0x08080c);
        this.scene.fog = new THREE.FogExp2(0x08080c, 0.015);

        const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.1 });
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

        const floor1 = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMat);
        floor1.rotation.x = -Math.PI / 2;
        floor1.position.y = 0;
        floor1.receiveShadow = true;
        this.scene.add(floor1);
        this.collisionGrid.insert(new THREE.Box3(new THREE.Vector3(-50, -0.1, -50), new THREE.Vector3(50, 0.1, 50)));

        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), wallMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 30;
        ceiling.receiveShadow = true;
        this.scene.add(ceiling);

        this.createWall(40, 30, -30, 15, 50, wallMat); 
        this.createWall(40, 30, 30, 15, 50, wallMat);  
        this.createWall(20, 10, 0, 25, 50, wallMat);    
        
        this.createWall(100, 30, 0, 15, -50, wallMat);  
        this.createWall(30, 100, -50, 15, 0, wallMat);  
        this.createWall(30, 100, 50, 15, 0, wallMat);  

        const pillarGeo = new THREE.BoxGeometry(4, 30, 4);
        const pillarPositions: [number, number, number][] = [
            [-40, 15, -40], [40, 15, -40],
            [-40, 15, 40],  [40, 15, 40]
        ];
        pillarPositions.forEach(pos => {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(pos[0], pos[1], pos[2]);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            this.scene.add(pillar);
            this.collisionGrid.insert(new THREE.Box3().setFromObject(pillar));
        });

        const stepDepth = 2;
        const stepHeight = 1;
        const stepWidth = 16;
        for (let i = 0; i < 20; i++) {
            const stepGeo = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth);
            const stepMesh = new THREE.Mesh(stepGeo, floorMat);
            stepMesh.position.set(0, -i * stepHeight, -10 - i * stepDepth);
            stepMesh.receiveShadow = true;
            stepMesh.castShadow = true;
            this.scene.add(stepMesh);
            this.collisionGrid.insert(new THREE.Box3().setFromObject(stepMesh));
        }
        this.createWall(2, 20, -9, -10, -30, wallMat);
        this.createWall(2, 20, 9, -10, -30, wallMat);

        const floor2 = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMat);
        floor2.rotation.x = -Math.PI / 2;
        floor2.position.y = -20;
        floor2.receiveShadow = true;
        this.scene.add(floor2);
        this.collisionGrid.insert(new THREE.Box3(new THREE.Vector3(-50, -20.1, -50), new THREE.Vector3(50, -19.9, 50)));

        this.createWall(100, 20, 0, -10, -50, wallMat);
        this.createWall(100, 20, 0, -10, 50, wallMat);
        this.createWall(20, 100, -50, -10, 0, wallMat);
        this.createWall(20, 100, 50, -10, 0, wallMat);

        const ambient = new THREE.AmbientLight(0x222233, 0.6);
        this.scene.add(ambient);
        
        this.mainLight = new THREE.PointLight(0x8a2be2, 5, 80, 1.5); 
        this.mainLight.position.set(0, 20, 0);
        this.mainLight.castShadow = true;
        this.mainLight.shadow.mapSize.width = 1024;
        this.mainLight.shadow.mapSize.height = 1024;
        this.mainLight.shadow.bias = -0.0001;
        this.scene.add(this.mainLight);

        this.createTorch(-45, 12, 0, 0xff6600);
        this.createTorch(45, 12, 0, 0xff6600);
        this.createTorch(0, 12, -45, 0xff6600);

        const basementLight = new THREE.PointLight(0xff4400, 3, 60, 1.5);
        basementLight.position.set(0, -10, -30);
        basementLight.castShadow = true;
        this.scene.add(basementLight);

        const altarBase = new THREE.Mesh(
            new THREE.CylinderGeometry(5, 7, 3, 8), 
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 })
        );
        altarBase.position.set(0, -18.5, -30);
        altarBase.receiveShadow = true;
        altarBase.castShadow = true;
        this.scene.add(altarBase);
        this.collisionGrid.insert(new THREE.Box3().setFromObject(altarBase));

        const altarGlow = new THREE.Mesh(
            new THREE.SphereGeometry(1.5, 16, 16), 
            new THREE.MeshBasicMaterial({ color: 0xff3300 })
        );
        altarGlow.position.set(0, -16, -30);
        this.scene.add(altarGlow);
    }

    private createWall(width: number, height: number, x: number, y: number, z: number, material: THREE.Material) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, 2), material);
        wall.position.set(x, y, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene.add(wall);
        this.collisionGrid.insert(new THREE.Box3().setFromObject(wall));
    }

    private createTorch(x: number, y: number, z: number, color: number) {
        const torchGeo = new THREE.CylinderGeometry(0.2, 0.2, 2, 6);
        const torchMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const torch = new THREE.Mesh(torchGeo, torchMat);
        torch.position.set(x, y, z);
        this.scene.add(torch);

        const light = new THREE.PointLight(color, 2, 30, 1.5); 
        light.position.set(x, y + 1.5, z);
        this.scene.add(light);
    }

    update(playerPosition: THREE.Vector3, delta: number) {
        this.time += delta;
        if (this.mainLight) {
            const flicker = Math.sin(this.time * 3) * 0.3 + Math.sin(this.time * 7.5) * 0.15;
            this.mainLight.intensity = 5 + flicker;
        }
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, 1, 45);
    }

    dispose() {
        this.collisionGrid.clear();
        this.scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m: THREE.Material) => m.dispose());
                } else if (mesh.material) {
                    mesh.material.dispose();
                }
            }
        });
        this.mainLight = null;
    }
}