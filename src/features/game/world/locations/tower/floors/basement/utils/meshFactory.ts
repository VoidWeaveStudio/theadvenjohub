// src/features/game/world/locations/tower/floors/basement/utils/meshFactory.ts
import * as THREE from "three";

export function createFallbackCoinTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#FFF8DC';
    ctx.beginPath();
    ctx.arc(64, 64, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#DAA520';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MEME', 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function createGlowTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 204, 102, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 204, 102, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function createGlowSphere(radius: number, color: number, opacity: number, sizeMultiplier: number = 1.4): THREE.Mesh {
    const geo = new THREE.SphereGeometry(radius * sizeMultiplier, 24, 16);
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            glowColor: { value: new THREE.Color(color) },
            uOpacity: { value: opacity }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewDir = normalize(-mvPosition.xyz);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            uniform float uOpacity;
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
                float facing = max(dot(vNormal, vViewDir), 0.0);
                float intensity = pow(facing, 2.0);
                gl_FragColor = vec4(glowColor, intensity * uOpacity);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        side: THREE.FrontSide
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isGlow = true;
    return mesh;
}

export function createCoinMesh(
    texture: THREE.Texture,
    radius: number = 0.4,
    isColumn: boolean = false,
    isOrbit: boolean = false,
    glowType: "none" | "silver" | "gold" = "silver"
): THREE.Group {
    const group = new THREE.Group();
    const thickness = isColumn ? radius * 0.08 : (isOrbit ? radius * 0.35 : radius * 0.4);
    const segments = radius > 1 ? 96 : 64;

    let mainMesh: THREE.Mesh;

    if (isOrbit) {
        const geo = new THREE.CylinderGeometry(radius, radius, radius * 0.35, 96);
        const sideMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0x332200,
            emissiveIntensity: 0.6,
            metalness: 1.0,
            roughness: 0.25,
            envMapIntensity: 2.5
        });

        const faceMat = new THREE.MeshStandardMaterial({
            map: texture,
            emissiveMap: texture,
            emissive: 0xffffff,
            emissiveIntensity: 0.7,
            metalness: 0.0,
            roughness: 0.3,
            envMapIntensity: 2.0,
            toneMapped: false
        });

        const materials = [sideMat, faceMat, faceMat];
        mainMesh = new THREE.Mesh(geo, materials);
        mainMesh.rotation.x = Math.PI / 2;
        mainMesh.castShadow = false;
        mainMesh.receiveShadow = false;
        group.add(mainMesh);

    } else {
        const geo = new THREE.CylinderGeometry(radius, radius, thickness, segments);
        const sideMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.8,
            roughness: 0.3,
            envMapIntensity: 2.0
        });

        const faceMat = new THREE.MeshStandardMaterial({
            map: texture,
            emissiveMap: texture,
            emissive: 0xffffff,
            emissiveIntensity: 0.7,
            metalness: 0.0,
            roughness: 0.3,
            envMapIntensity: 2.0,
            toneMapped: false
        });

        const materials = [sideMat, faceMat, faceMat];
        mainMesh = new THREE.Mesh(geo, materials);
        mainMesh.rotation.x = Math.PI / 2;
        mainMesh.castShadow = false;
        mainMesh.receiveShadow = false;
        group.add(mainMesh);
    }

    const rimThickness = thickness * 1.05;
    const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, rimThickness, 64),
        new THREE.MeshBasicMaterial({
            color: 0xffd700,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide,
            depthWrite: false
        })
    );
    rim.rotation.x = Math.PI / 2;
    group.add(rim);

    let glowColor = 0xffffff;
    let glowOpacity = 0.25;

    if (glowType === "none") {
        glowOpacity = 0.0;
    } else if (glowType === "silver") {
        glowColor = 0xcceeff;
        glowOpacity = 0.25;
    } else if (glowType === "gold") {
        glowColor = 0xffd700;
        glowOpacity = 0.35;
    }

    if (glowOpacity > 0.0) {
        const glowMesh = createGlowSphere(radius, glowColor, glowOpacity, 1.3);
        group.add(glowMesh);
    }

    if (isOrbit) {
        const trailCount = 20;
        const positions = new Float32Array(trailCount * 3);
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const trailMat = new THREE.LineBasicMaterial({
            color: 0x66ccff,
            transparent: true,
            opacity: 0.4
        });

        const trailLine = new THREE.Line(trailGeo, trailMat);
        group.add(trailLine);

        (group as any).trail = {
            line: trailLine,
            positions: positions
        };
    }

    return group;
}
