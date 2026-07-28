// src/features/game/world/locations/main-world/systems/TowerParticles.ts
import * as THREE from "three";
import { createProceduralTexture } from "./TowerExteriorBuilder";

export class TowerParticles {
    private smokeParticleSystem: THREE.Points | null = null;
    private sparkParticleSystem: THREE.Points | null = null;
    private smokeUniforms: any = null;

    create(parent: THREE.Group, doorZ: number) {
        const smokeTex = createProceduralTexture('smoke');

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
        for (let i = 0; i < sparkCount; i++) {
            spPos[i * 3] = (Math.random() - 0.5) * 40;
            spPos[i * 3 + 1] = Math.random() * 20;
            spPos[i * 3 + 2] = doorZ + (Math.random() - 0.5) * 15;
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

    update(delta: number) {
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
}
