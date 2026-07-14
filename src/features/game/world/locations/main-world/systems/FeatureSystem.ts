// src\features\game\world\locations\main-world\systems\FeatureSystem.ts
import * as THREE from "three";
import { MainWorld } from "../MainWorld";

export class FeatureSystem {
    private leftDoorGroup: THREE.Group | null = null;
    private rightDoorGroup: THREE.Group | null = null;
    private towerPortalMesh: THREE.Mesh | null = null; // Новый меш портала
    
    private isDoorOpening = false;
    private doorOpenProgress = 0;
    private readonly towerEntrancePos = new THREE.Vector3(300, 0, 0);
    public readonly towerClearZone = 180;
    
    private towerLights: THREE.Light[] = [];
    private smokeParticleSystem: THREE.Points | null = null;
    private sparkParticleSystem: THREE.Points | null = null;
    private smokeUniforms: any = null;

    constructor(private world: MainWorld) { }

    private createProceduralTexture(type: 'noise' | 'smoke'): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d')!;

        if (type === 'smoke') {
            const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
            grad.addColorStop(0, 'rgba(200, 200, 200, 1)');
            grad.addColorStop(0.4, 'rgba(150, 150, 150, 0.4)');
            grad.addColorStop(1, 'rgba(100, 100, 100, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 256, 256);
        } else {
            for (let i = 0; i < 40000; i++) {
                ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`;
                ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
            }
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    private createNoisyCylinder(topRad: number, botRad: number, height: number, segments: number, noiseAmp: number): THREE.BufferGeometry {
        const geo = new THREE.CylinderGeometry(topRad, botRad, height, segments, 8, true);
        const pos = geo.attributes.position;
        
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const y = pos.getY(i);
            
            const noise = Math.sin(x * 0.3) * Math.cos(z * 0.3) * Math.sin(y * 0.15) * noiseAmp + 
                          (Math.random() - 0.5) * noiseAmp * 0.8;
            
            const angle = Math.atan2(z, x);
            const currentRad = Math.sqrt(x * x + z * z);
            const newRad = Math.max(0.1, currentRad + noise);
            
            pos.setX(i, Math.cos(angle) * newRad);
            pos.setZ(i, Math.sin(angle) * newRad);
        }
        geo.computeVertexNormals();
        return geo;
    }

    createGloomyTower() {
        const towerX = 300, towerZ = 0;
        const groundY = this.world.terrain.getHeightAt(towerX, towerZ);
        
        const towerGroup = new THREE.Group();
        towerGroup.position.set(towerX, groundY, towerZ);

        const dir = new THREE.Vector3(-towerX, 0, -towerZ).normalize();
        towerGroup.rotation.y = Math.atan2(dir.x, dir.z);

        const noiseTex = this.createProceduralTexture('noise');
        
        const createStoneMat = (color: number, rough: number, metal: number) => {
            const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
            if (!mat.map) {
                mat.aoMap = noiseTex;
                mat.aoMapIntensity = 0.5;
            }
            return mat;
        };

        const matBase = createStoneMat(0x62656B, 0.9, 0.05);
        const matDark = createStoneMat(0x494C52, 0.95, 0.1);
        const matDirt = createStoneMat(0x303236, 1.0, 0.0);
        const matMoss = createStoneMat(0x394132, 0.95, 0.0);
        const matIron = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.8 });
        
        const matWood = new THREE.MeshStandardMaterial({ 
            color: 0x3d2817, 
            roughness: 0.9, 
            metalness: 0.0,
            emissive: 0x331a00,
            emissiveIntensity: 0.15
        });
        
        const matRoof = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.4, metalness: 0.6 });

        const sections = [
            { name: 'base', topR: 75, botR: 78, height: 80, y: 40, mat: matBase },
            { name: 'belt1', topR: 77, botR: 75, height: 4, y: 82, mat: matDark },
            { name: 'middle', topR: 65, botR: 65, height: 100, y: 134, mat: matBase },
            { name: 'belt2', topR: 68, botR: 65, height: 4, y: 186, mat: matDark },
            { name: 'upper', topR: 55, botR: 55, height: 80, y: 228, mat: matMoss },
            { name: 'gallery_base', topR: 75, botR: 55, height: 12, y: 274, mat: matDark },
        ];

        sections.forEach(sec => {
            const mesh = new THREE.Mesh(this.createNoisyCylinder(sec.topR, sec.botR, sec.height, 32, 0.5), sec.mat);
            mesh.position.y = sec.y;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            towerGroup.add(mesh);
        });

        const isEntranceSector = (angle: number) => {
            let a = angle;
            while (a > Math.PI) a -= Math.PI * 2;
            while (a < -Math.PI) a += Math.PI * 2;
            return Math.abs(a) < 0.5;
        };

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            if (isEntranceSector(angle)) continue;

            const buttress = new THREE.Mesh(new THREE.BoxGeometry(6, 100, 12), matBase);
            buttress.position.set(Math.cos(angle) * 77, 50, Math.sin(angle) * 77);
            buttress.rotation.y = -angle;
            buttress.castShadow = true;
            towerGroup.add(buttress);
            
            if (i % 2 === 0) {
                const debris = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 10), matDark);
                debris.position.set(Math.cos(angle) * 78, 2.5, Math.sin(angle) * 78);
                debris.rotation.y = -angle + (Math.random() - 0.5) * 0.2;
                towerGroup.add(debris);
            }
        }

        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            if (isEntranceSector(angle)) continue;

            const yLevel = 140;
            const emissiveInt = 0.3 + Math.random() * 0.5;
            
            const recess = new THREE.Mesh(new THREE.BoxGeometry(9, 18, 6), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }));
            recess.position.set(Math.cos(angle) * 65, yLevel, Math.sin(angle) * 65);
            recess.rotation.y = -angle;
            towerGroup.add(recess);

            const grille = new THREE.Mesh(new THREE.BoxGeometry(7, 16, 1), new THREE.MeshStandardMaterial({ 
                color: 0x5a4a6a, emissive: 0xffaa44, emissiveIntensity: emissiveInt 
            }));
            grille.position.set(Math.cos(angle) * 65.5, yLevel, Math.sin(angle) * 65.5);
            grille.rotation.y = -angle;
            towerGroup.add(grille);

            const windowLight = new THREE.PointLight(0xffaa44, emissiveInt * 1.5, 15);
            windowLight.position.set(Math.cos(angle) * 62, yLevel, Math.sin(angle) * 62);
            towerGroup.add(windowLight);
            this.towerLights.push(windowLight);
        }

        const crenellationsCount = 32;
        for (let i = 0; i < crenellationsCount; i++) {
            const angle = (i / crenellationsCount) * Math.PI * 2;
            if (isEntranceSector(angle)) continue;

            const tooth = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), matDark);
            tooth.position.set(Math.cos(angle) * 75, 278, Math.sin(angle) * 75);
            tooth.rotation.y = -angle;
            tooth.castShadow = true;
            towerGroup.add(tooth);

            if (i % 3 === 0) {
                const chip = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3), matDirt);
                chip.position.set(Math.cos(angle) * 74, 273, Math.sin(angle) * 74);
                towerGroup.add(chip);
            }
        }

        const spireBase = new THREE.Mesh(this.createNoisyCylinder(22, 45, 60, 16, 0.4), matRoof);
        spireBase.position.y = 280 + 30;
        spireBase.castShadow = true;
        towerGroup.add(spireBase);

        const spireTop = new THREE.Mesh(new THREE.ConeGeometry(10, 80, 8), matIron);
        spireTop.position.y = 280 + 60 + 40;
        spireTop.castShadow = true;
        towerGroup.add(spireTop);

        const spireGlow = new THREE.PointLight(0x88bbff, 3, 80);
        spireGlow.position.y = 380;
        towerGroup.add(spireGlow);
        this.towerLights.push(spireGlow);

        const doorZ = 88;
        const doorWidth = 24;
        const doorHeight = 48;
        const doorDepth = 4;

        const wallPatch = new THREE.Mesh(
            new THREE.BoxGeometry(60, 60, 2),
            matBase
        );
        wallPatch.position.set(0, 30, 80);
        wallPatch.castShadow = true;
        wallPatch.receiveShadow = true;
        towerGroup.add(wallPatch);

        const frame1 = new THREE.Mesh(
            new THREE.CylinderGeometry(28, 28, 56, 16, 1, true, 0, Math.PI), 
            matDark
        );
        frame1.rotation.y = Math.PI / 2;
        frame1.position.set(0, 28, 95);
        frame1.castShadow = true;
        towerGroup.add(frame1);

        const frame2 = new THREE.Mesh(
            new THREE.CylinderGeometry(26, 26, 54, 16, 1, true, 0, Math.PI), 
            matDark
        );
        frame2.rotation.y = Math.PI / 2;
        frame2.position.set(0, 27, 93);
        frame2.castShadow = true;
        towerGroup.add(frame2);

        const frame3 = new THREE.Mesh(
            new THREE.CylinderGeometry(24, 24, 52, 16, 1, true, 0, Math.PI), 
            matDark
        );
        frame3.rotation.y = Math.PI / 2;
        frame3.position.set(0, 26, 91);
        frame3.castShadow = true;
        towerGroup.add(frame3);

        const pillarGeo = new THREE.BoxGeometry(6, 56, 12);
        const leftPillar = new THREE.Mesh(pillarGeo, matDark);
        leftPillar.position.set(-16, 28, 92); 
        leftPillar.castShadow = true;
        leftPillar.receiveShadow = true;
        towerGroup.add(leftPillar);

        const rightPillar = new THREE.Mesh(pillarGeo, matDark);
        rightPillar.position.set(16, 28, 92);
        rightPillar.castShadow = true;
        rightPillar.receiveShadow = true;
        towerGroup.add(rightPillar);

        this.leftDoorGroup = new THREE.Group();
        this.leftDoorGroup.position.set(-doorWidth / 2, doorHeight / 2, doorZ);
        
        const leftDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth), matWood);
        leftDoorMesh.position.set(doorWidth / 2, 0, 0); 
        leftDoorMesh.castShadow = true;
        
        const leftHinge = new THREE.Mesh(new THREE.BoxGeometry(3, 12, 6), matIron);
        leftHinge.position.set(0, 12, 0);
        const leftRing = new THREE.Mesh(new THREE.TorusGeometry(2, 0.4, 8, 16), matIron);
        leftRing.position.set(doorWidth - 4, 0, 2.5); 
        
        this.leftDoorGroup.add(leftDoorMesh, leftHinge, leftRing);
        towerGroup.add(this.leftDoorGroup);

        this.rightDoorGroup = new THREE.Group();
        this.rightDoorGroup.position.set(doorWidth / 2, doorHeight / 2, doorZ);
        
        const rightDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth), matWood);
        rightDoorMesh.position.set(-doorWidth / 2, 0, 0); 
        rightDoorMesh.castShadow = true;

        const rightHinge = new THREE.Mesh(new THREE.BoxGeometry(3, 12, 6), matIron);
        rightHinge.position.set(0, 12, 0);
        const rightRing = new THREE.Mesh(new THREE.TorusGeometry(2, 0.4, 8, 16), matIron);
        rightRing.position.set(-(doorWidth - 4), 0, 2.5); 

        this.rightDoorGroup.add(rightDoorMesh, rightHinge, rightRing);
        towerGroup.add(this.rightDoorGroup);

        // ==========================================
        // === ЧЕРНЫЙ ПОРТАЛ МЕЖДУ ДВЕРЬМИ ===
        // ==========================================
        const portalGeo = new THREE.BoxGeometry(doorWidth - 2, doorHeight - 4, 1);
        const portalMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        this.towerPortalMesh = new THREE.Mesh(portalGeo, portalMat);
        // Размещаем ровно по центру между дверьми
        this.towerPortalMesh.position.set(0, doorHeight / 2, doorZ);
        this.towerPortalMesh.visible = false; // Скрыт по умолчанию
        towerGroup.add(this.towerPortalMesh);
        // ==========================================

        const leftFire = new THREE.PointLight(0xff8844, 6, 40);
        leftFire.position.set(-20, 30, 98);
        towerGroup.add(leftFire);
        this.towerLights.push(leftFire);

        const rightFire = new THREE.PointLight(0xff8844, 6, 40);
        rightFire.position.set(20, 30, 98);
        towerGroup.add(rightFire);
        this.towerLights.push(rightFire);

        const doorSpotLight = new THREE.SpotLight(0xffddaa, 10, 60, 0.5, 0.8, 1);
        doorSpotLight.position.set(0, 50, 105);
        doorSpotLight.target.position.set(0, 24, 88);
        towerGroup.add(doorSpotLight);
        towerGroup.add(doorSpotLight.target);
        this.towerLights.push(doorSpotLight);

        const spotLight = new THREE.SpotLight(0x88bbff, 5, 100, 0.6, 0.5, 1);
        spotLight.position.set(0, 20, 110); 
        spotLight.target.position.set(0, 35, 90);
        towerGroup.add(spotLight);
        towerGroup.add(spotLight.target);
        this.towerLights.push(spotLight);

        this.scatterDebris(towerGroup, matBase, matDark);
        this.createAdvancedParticles(towerGroup, doorZ);

        this.world.scene.add(towerGroup);
        towerGroup.updateMatrixWorld(true);

        // Точка входа для проверки расстояния (Y = groundY + 2, чтобы 2D-расстояние работало идеально)
        const doorWorldPos = new THREE.Vector3(0, groundY + 2, 100);
        doorWorldPos.applyMatrix4(towerGroup.matrixWorld);
        this.towerEntrancePos.copy(doorWorldPos);

        this.world.vegetation.clearVegetationAroundPortal(towerX, towerZ, this.towerClearZone);

        const towerBox = new THREE.Box3(
            new THREE.Vector3(towerX - 110, groundY, towerZ - 110),
            new THREE.Vector3(towerX + 110, groundY + 400, towerZ + 120)
        );
        this.world.colliders.push(towerBox);
        this.world.terrainCollisionGrid.insert(towerBox);
    }

    private scatterDebris(parent: THREE.Group, mat1: THREE.Material, mat2: THREE.Material) {
        for (let i = 0; i < 16; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 40 + Math.random() * 60;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            const isColumn = Math.random() > 0.5;
            const geo = isColumn 
                ? new THREE.CylinderGeometry(2, 3, 10 + Math.random() * 15, 8)
                : new THREE.DodecahedronGeometry(4 + Math.random() * 6, 0);
            
            const mesh = new THREE.Mesh(geo, Math.random() > 0.5 ? mat1 : mat2);
            mesh.position.set(x, 3, z);
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            parent.add(mesh);
        }
    }

    private createAdvancedParticles(parent: THREE.Group, doorZ: number) {
        const smokeTex = this.createProceduralTexture('smoke');

        const smokeVertexShader = `
            attribute float size;
            attribute float opacity;
            attribute float speed;
            varying float vOpacity;
            uniform float uTime;
            void main() {
                vOpacity = opacity;
                vec3 pos = position;
                pos.x += sin(uTime * 0.5 + pos.y * 0.1) * 2.0;
                pos.z += cos(uTime * 0.3 + pos.y * 0.1) * 2.0;
                pos.y += uTime * speed;
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `;

        const smokeFragmentShader = `
            uniform sampler2D uTexture;
            varying float vOpacity;
            void main() {
                vec4 texColor = texture2D(uTexture, gl_PointCoord);
                if (texColor.a < 0.1) discard;
                gl_FragColor = vec4(0.3, 0.3, 0.35, texColor.a * vOpacity);
            }
        `;

        this.smokeUniforms = {
            uTime: { value: 0 },
            uTexture: { value: smokeTex }
        };

        const smokeCount = 150;
        const smokeGeo = new THREE.BufferGeometry();
        const sPos = new Float32Array(smokeCount * 3);
        const sSize = new Float32Array(smokeCount);
        const sOpacity = new Float32Array(smokeCount);
        const sSpeed = new Float32Array(smokeCount);

        for (let i = 0; i < smokeCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 15 + Math.random() * 20;
            sPos[i * 3] = Math.cos(angle) * r;
            sPos[i * 3 + 1] = Math.random() * 15;
            sPos[i * 3 + 2] = Math.sin(angle) * r + doorZ;
            sSize[i] = 20 + Math.random() * 25;
            sOpacity[i] = Math.random() * 0.4;
            sSpeed[i] = 1.5 + Math.random() * 2.0;
        }

        smokeGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
        smokeGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1));
        smokeGeo.setAttribute('opacity', new THREE.BufferAttribute(sOpacity, 1));
        smokeGeo.setAttribute('speed', new THREE.BufferAttribute(sSpeed, 1));

        const smokeMat = new THREE.ShaderMaterial({
            uniforms: this.smokeUniforms,
            vertexShader: smokeVertexShader,
            fragmentShader: smokeFragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending
        });

        this.smokeParticleSystem = new THREE.Points(smokeGeo, smokeMat);
        parent.add(this.smokeParticleSystem);

        const sparkCount = 80;
        const sparkGeo = new THREE.BufferGeometry();
        const spPos = new Float32Array(sparkCount * 3);
        for(let i = 0; i < sparkCount; i++) {
            spPos[i*3] = (Math.random() - 0.5) * 40;
            spPos[i*3+1] = Math.random() * 20;
            spPos[i*3+2] = doorZ + (Math.random() - 0.5) * 15;
        }
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
        const sparkMat = new THREE.PointsMaterial({
            color: 0xffaa44,
            size: 1.0,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.sparkParticleSystem = new THREE.Points(sparkGeo, sparkMat);
        parent.add(this.sparkParticleSystem);
    }

    // === МАКСИМАЛЬНО ПРОСТАЯ ЛОГИКА UPDATE ===
    update(delta: number, playerPosition: THREE.Vector3, isEPressed: boolean) {
        const dx = playerPosition.x - this.towerEntrancePos.x;
        const dz = playerPosition.z - this.towerEntrancePos.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);

        // 1. Анимация дверей (открываются при приближении < 30м)
        if (dist2D < 30) {
            this.isDoorOpening = true;
        } else if (dist2D > 35) {
            this.isDoorOpening = false;
        }

        const animSpeed = 2.5;
        if (this.isDoorOpening && this.doorOpenProgress < 1) {
            this.doorOpenProgress += delta * animSpeed;
            if (this.doorOpenProgress > 1) this.doorOpenProgress = 1;
        } else if (!this.isDoorOpening && this.doorOpenProgress > 0) {
            this.doorOpenProgress -= delta * animSpeed;
            if (this.doorOpenProgress < 0) this.doorOpenProgress = 0;
        }

        if (this.leftDoorGroup) {
            this.leftDoorGroup.rotation.y = -(Math.PI / 2.5) * this.doorOpenProgress;
        }
        if (this.rightDoorGroup) {
            this.rightDoorGroup.rotation.y = (Math.PI / 2.5) * this.doorOpenProgress;
        }

        // 2. Управление видимостью портала: виден только когда двери открыты > 50%
        if (this.towerPortalMesh) {
            this.towerPortalMesh.visible = this.doorOpenProgress > 0.5;
        }

        // 3. АВТОМАТИЧЕСКАЯ ТЕЛЕПОРТАЦИЯ: если игрок вошел в портал (расстояние < 3м) и двери открыты
        if (dist2D < 3.0 && this.doorOpenProgress > 0.8) {
            this.world.pendingTeleport = "tower";
        }

        // 4. Анимация освещения и частиц (без изменений)
        const time = Date.now() * 0.001;
        this.towerLights.forEach((light, index) => {
            if (light.color.getHex() === 0xff8844 || light.color.getHex() === 0xffddaa) {
                const flicker = Math.sin(time * 8 + index * 5) * 0.4 + Math.cos(time * 15 + index) * 0.2;
                light.intensity = Math.max(2.0, (light.intensity || 6) + flicker);
            } else {
                light.intensity = 3 + Math.sin(time * 2) * 0.5;
            }
        });

        if (this.smokeParticleSystem && this.smokeUniforms) {
            this.smokeUniforms.uTime.value += delta;
            const positions = this.smokeParticleSystem.geometry.attributes.position.array as Float32Array;
            const opacities = this.smokeParticleSystem.geometry.attributes.opacity.array as Float32Array;
            
            for (let i = 0; i < positions.length / 3; i++) {
                if (positions[i * 3 + 1] > 30) {
                    positions[i * 3 + 1] = 0;
                    const angle = Math.random() * Math.PI * 2;
                    const r = 15 + Math.random() * 20;
                    positions[i * 3] = Math.cos(angle) * r;
                    const originalZ = positions[i * 3 + 2] - Math.sin(angle) * r; 
                    positions[i * 3 + 2] = Math.sin(angle) * r + originalZ;
                    opacities[i] = 0.1 + Math.random() * 0.3;
                }
            }
            this.smokeParticleSystem.geometry.attributes.position.needsUpdate = true;
            this.smokeParticleSystem.geometry.attributes.opacity.needsUpdate = true;
        }

        if (this.sparkParticleSystem) {
            const positions = this.sparkParticleSystem.geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < positions.length / 3; i++) {
                positions[i * 3 + 1] += delta * (5 + Math.random() * 5);
                positions[i * 3] += (Math.random() - 0.5) * delta * 2;
                
                if (positions[i * 3 + 1] > 25) {
                    positions[i * 3 + 1] = 20 + Math.random() * 5;
                    positions[i * 3] = (Math.random() - 0.5) * 40;
                    positions[i * 3 + 2] = 88 + (Math.random() - 0.5) * 15;
                }
            }
            this.sparkParticleSystem.geometry.attributes.position.needsUpdate = true;
        }
    }

    // === ПРОСТАЯ ПОДСКАЗКА ===
    public getInteractionPrompt(playerPosition: THREE.Vector3): string | null {
        const dx = playerPosition.x - this.towerEntrancePos.x;
        const dz = playerPosition.z - this.towerEntrancePos.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);
        
        if (dist2D < 15 && this.doorOpenProgress > 0.3) {
            return "Walk into the portal";
        }
        return null;
    }

    createOcean() {
        const waterLevel = -5, mapSize = this.world.size, waterWidth = 1500, halfMap = mapSize / 2;
        const material = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.4, depthWrite: false });

        const createPlane = (w: number, h: number, x: number, z: number) => {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
            mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, waterLevel, z); mesh.receiveShadow = true;
            this.world.scene.add(mesh);
        };

        createPlane(mapSize + waterWidth * 2, waterWidth, 0, halfMap + waterWidth / 2);
        createPlane(mapSize + waterWidth * 2, waterWidth, 0, -halfMap - waterWidth / 2);
        createPlane(waterWidth, mapSize + waterWidth * 2, -halfMap - waterWidth / 2, 0);
        createPlane(waterWidth, mapSize + waterWidth * 2, halfMap + waterWidth / 2, 0);
    }

    createBoundaryColliders() {
        const limit = 240, height = 50, thickness = 20;
        const walls = [
            new THREE.Box3(new THREE.Vector3(-limit, -10, -limit - thickness), new THREE.Vector3(limit, height, -limit)),
            new THREE.Box3(new THREE.Vector3(-limit, -10, limit), new THREE.Vector3(limit, height, limit + thickness)),
            new THREE.Box3(new THREE.Vector3(-limit - thickness, -10, -limit), new THREE.Vector3(-limit, height, limit)),
            new THREE.Box3(new THREE.Vector3(limit, -10, -limit), new THREE.Vector3(limit + thickness, height, limit)),
        ];
        walls.forEach(wall => {
            this.world.colliders.push(wall);
            this.world.terrainCollisionGrid.insert(wall);
        });
    }
}