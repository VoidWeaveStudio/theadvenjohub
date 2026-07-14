//src\features\game\world\locations\main-world\systems\AtmosphereSystem.ts
import * as THREE from "three";
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { MainWorld } from "../MainWorld";

export class AtmosphereSystem {
    private sky: Sky | null = null;
    private sunPosition: THREE.Vector3 = new THREE.Vector3();
    private dayTime: number = 0.25;
    private sunMesh: THREE.Mesh | null = null;
    private moonMesh: THREE.Mesh | null = null;
    private stars: THREE.Points | null = null;
    private clouds: THREE.Mesh | null = null;
    private cloudTexture: THREE.Texture | null = null;

    public sun: THREE.DirectionalLight | null = null;
    public sunTarget: THREE.Object3D | null = null;

    constructor(private world: MainWorld) { }

    init() {
        this.createSky();
        this.createCelestialBodies();
        this.createAtmosphere();
    }

    createLighting(isLowEnd: boolean) {
        const hemi = new THREE.HemisphereLight(0xbde0ff, 0x4a6b3a, 1.2);
        this.world.scene.add(hemi);

        this.sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
        this.sun.castShadow = true;
        const shadowRes = isLowEnd ? 1024 : 2048;
        this.sun.shadow.mapSize.set(shadowRes, shadowRes);
        this.sun.shadow.camera.near = 0.5;
        this.sun.shadow.camera.far = 500;
        const d = 100;
        this.sun.shadow.camera.left = -d;
        this.sun.shadow.camera.right = d;
        this.sun.shadow.camera.top = d;
        this.sun.shadow.camera.bottom = -d;
        this.sun.shadow.bias = -0.0001;
        this.sun.shadow.normalBias = 0.02;
        this.sun.shadow.radius = 2;

        this.sunTarget = new THREE.Object3D();
        this.sun.target = this.sunTarget;
        this.sunTarget.position.set(0, 0, 0);
        this.world.scene.add(this.sun);
        this.world.scene.add(this.sunTarget);
    }

    private createAtmosphere() {
        this.world.scene.fog = new THREE.FogExp2(0x2a3a4a, 0.0035);
        this.world.scene.background = new THREE.Color(0x2a3a4a);
    }

    private createCloudTexture(): THREE.Texture {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, 512, 512);
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * 512, y = Math.random() * 512, radius = 30 + Math.random() * 80;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    private createSky() {
        this.sky = new Sky();
        this.sky.scale.setScalar(450000);
        this.world.scene.add(this.sky);
        const uniforms = this.sky.material.uniforms;
        uniforms['turbidity'].value = 10;
        uniforms['rayleigh'].value = 2.2;
        uniforms['mieCoefficient'].value = 0.006;
        uniforms['mieDirectionalG'].value = 0.85;
        this.updateSunPosition(this.dayTime);
    }

    private createCelestialBodies() {
        this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffdd88, fog: false }));
        this.world.scene.add(this.sunMesh);

        this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 16), new THREE.MeshBasicMaterial({ color: 0xddddee, fog: false }));
        this.world.scene.add(this.moonMesh);

        const starsGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(5000 * 3);
        for (let i = 0; i < 5000; i++) {
            const r = 2000, theta = Math.random() * Math.PI * 2, phi = Math.acos((Math.random() * 2) - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        }
        starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0, fog: false, sizeAttenuation: false }));
        this.world.scene.add(this.stars);

        this.cloudTexture = this.createCloudTexture();
        const cloudGeo = new THREE.SphereGeometry(2500, 64, 32);
        cloudGeo.scale(-1, 1, 1);
        this.clouds = new THREE.Mesh(cloudGeo, new THREE.MeshBasicMaterial({ map: this.cloudTexture, transparent: true, opacity: 0.6, depthWrite: false, fog: false, side: THREE.BackSide }));
        this.world.scene.add(this.clouds);
    }

    private updateSunPosition(timeOfDay: number) {
        if (!this.sky) return;
        const elevation = Math.sin(timeOfDay * Math.PI * 2 - Math.PI / 2) * 90;
        const phi = THREE.MathUtils.degToRad(90 - elevation);
        const theta = THREE.MathUtils.degToRad(180);
        this.sunPosition.setFromSphericalCoords(1, phi, theta);
        this.sky.material.uniforms['sunPosition'].value.copy(this.sunPosition);

        const u = this.sky.material.uniforms;
        if (elevation > 20) { u['turbidity'].value = 8; u['rayleigh'].value = 2; u['mieCoefficient'].value = 0.003; u['mieDirectionalG'].value = 0.7; }
        else if (elevation > 0) {
            const t = elevation / 20;
            u['turbidity'].value = THREE.MathUtils.lerp(12, 8, t); u['rayleigh'].value = THREE.MathUtils.lerp(1.5, 2, t);
            u['mieCoefficient'].value = THREE.MathUtils.lerp(0.01, 0.003, t); u['mieDirectionalG'].value = THREE.MathUtils.lerp(0.9, 0.7, t);
        } else { u['rayleigh'].value = 0.2; u['turbidity'].value = 20; }

        if (this.sun) {
            this.sun.position.copy(this.sunPosition).multiplyScalar(300);
            this.sun.intensity = 0.5 + Math.max(0, elevation / 90) * 1.5;
            this.sun.color.setHex(elevation > 20 ? 0xfff0d0 : elevation > 0 ? 0xff8844 : 0x4466aa);
        }

        if (this.world.scene.fog instanceof THREE.FogExp2) {
            this.world.scene.fog.color.setHex(elevation > 20 ? 0x87ceeb : elevation > 0 ? 0xff9966 : 0x1a2a4a);
        }
        if (this.sunMesh) {
            this.sunMesh.position.copy(this.sunPosition).multiplyScalar(2000);
            (this.sunMesh.material as THREE.MeshBasicMaterial).color.setHex(elevation > 20 ? 0xffdd88 : 0xff8844);
            this.sunMesh.visible = elevation > -5;
        }
        if (this.moonMesh) { this.moonMesh.position.copy(this.sunPosition).multiplyScalar(-2000); this.moonMesh.visible = elevation < 10; }
        if (this.stars) {
            const opacity = THREE.MathUtils.smoothstep(-elevation, 0, 20);
            (this.stars.material as THREE.PointsMaterial).opacity = opacity;
            this.stars.visible = opacity > 0.01;
        }
    }

    update(delta: number, playerPosition: THREE.Vector3) {
        this.dayTime += delta * 0.01;
        if (this.dayTime > 1) this.dayTime -= 1;
        this.updateSunPosition(this.dayTime);
        if (this.clouds) this.clouds.rotation.z += delta * 0.01;

        if (this.sun && this.sun.shadow && this.sunTarget) {
            const shadowCam = this.sun.shadow.camera as THREE.OrthographicCamera;
            shadowCam.position.set(playerPosition.x, playerPosition.y + 150, playerPosition.z);
            this.sunTarget.position.copy(playerPosition);
            shadowCam.updateProjectionMatrix();
            this.sunTarget.updateMatrixWorld();
        }
    }

    dispose() {
        if (this.sky) { this.world.scene.remove(this.sky); this.sky.geometry.dispose(); (this.sky.material as THREE.Material).dispose(); this.sky = null; }
        if (this.sunMesh) { this.world.scene.remove(this.sunMesh); this.sunMesh.geometry.dispose(); (this.sunMesh.material as THREE.Material).dispose(); this.sunMesh = null; }
        if (this.moonMesh) { this.world.scene.remove(this.moonMesh); this.moonMesh.geometry.dispose(); (this.moonMesh.material as THREE.Material).dispose(); this.moonMesh = null; }
        if (this.stars) { this.world.scene.remove(this.stars); this.stars.geometry.dispose(); (this.stars.material as THREE.Material).dispose(); this.stars = null; }
        if (this.clouds) { this.world.scene.remove(this.clouds); this.clouds.geometry.dispose(); (this.clouds.material as THREE.Material).dispose(); this.clouds = null; }
        if (this.cloudTexture) { this.cloudTexture.dispose(); this.cloudTexture = null; }
    }
}