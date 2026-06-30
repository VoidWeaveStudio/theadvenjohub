// src/features/game/lobby/LobbyEnvironment.ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface LobbyAnimatables {
    crystals: THREE.Mesh[];
    particles: THREE.Points | null;
    stars: THREE.Points | null;
    portalRing: THREE.Mesh | null;
    portalInnerRing: THREE.Mesh | null;
    portalSphere: THREE.Mesh | null;
    platformRing: THREE.Mesh | null;
    innerRing: THREE.Mesh | null;
}


export function createAtmosphericEnvironment(scene: THREE.Scene): LobbyAnimatables {
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 500;
    const starsPositions = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
        const radius = 200 + Math.random() * 300;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        starsPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        starsPositions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) + 20;
        starsPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));

    const stars = new THREE.Points(
        starsGeometry,
        new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.2,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
        }),
    );
    scene.add(stars);

    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 40;
    const particlesPositions = new Float32Array(particlesCount * 3);
    const particlesColors = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount; i++) {
        particlesPositions[i * 3] = (Math.random() - 0.5) * 60;
        particlesPositions[i * 3 + 1] = Math.random() * 12 + 1;
        particlesPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;

        const colorChoice = Math.random();
        if (colorChoice < 0.33) {
            particlesColors[i * 3] = 0.5;
            particlesColors[i * 3 + 1] = 1;
            particlesColors[i * 3 + 2] = 1;
        } else if (colorChoice < 0.66) {
            particlesColors[i * 3] = 0.7;
            particlesColors[i * 3 + 1] = 0.5;
            particlesColors[i * 3 + 2] = 1;
        } else {
            particlesColors[i * 3] = 0.5;
            particlesColors[i * 3 + 1] = 0.7;
            particlesColors[i * 3 + 2] = 1;
        }
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlesPositions, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(particlesColors, 3));

    const particles = new THREE.Points(
        particlesGeometry,
        new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
        }),
    );
    scene.add(particles);

    const columnPositions = [
        { x: -25, z: -25 }, { x: 25, z: -25 },
        { x: -25, z: 25 }, { x: 25, z: 25 },
        { x: -35, z: 0 }, { x: 35, z: 0 },
        { x: 0, z: -35 }, { x: 0, z: 35 },
    ];

    const columnGeometries: THREE.BufferGeometry[] = [];
    const crystals: THREE.Mesh[] = [];

    const columnMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a6e,
        metalness: 0.5,
        roughness: 0.5,
        flatShading: true,
    });

    columnPositions.forEach((pos, i) => {
        const columnGeo = new THREE.CylinderGeometry(0.9, 1.1, 11, 8);
        columnGeo.translate(pos.x, 5.5, pos.z);
        columnGeometries.push(columnGeo);

        const crystalGeometry = new THREE.OctahedronGeometry(0.6, 0);
        const crystalColor = i % 2 === 0 ? 0x00ffff : 0xff66ff;
        const crystalMaterial = new THREE.MeshStandardMaterial({
            color: crystalColor,
            emissive: crystalColor,
            emissiveIntensity: 2.5,
            metalness: 0.8,
            roughness: 0.2,
            flatShading: true,
        });
        const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
        crystal.position.set(pos.x, 11.5, pos.z);
        scene.add(crystal);
        crystals.push(crystal);
    });

    if (columnGeometries.length > 0) {
        const mergedColumns = mergeGeometries(columnGeometries, false);
        if (mergedColumns) {
            const columnsMesh = new THREE.Mesh(mergedColumns, columnMaterial);
            columnsMesh.castShadow = false;
            columnsMesh.receiveShadow = true;
            scene.add(columnsMesh);
        }
        columnGeometries.forEach(g => g.dispose());
    }

    const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(15, 16, 0.5, 24),
        new THREE.MeshStandardMaterial({
            color: 0x3a3a5e,
            metalness: 0.6,
            roughness: 0.4,
            flatShading: true,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
        }),
    );
    platform.position.set(0, -0.25, 0);
    platform.receiveShadow = true;
    scene.add(platform);

    const platformRing = new THREE.Mesh(
        new THREE.TorusGeometry(15.5, 0.15, 6, 32),
        new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 1.5,
            flatShading: true,
        }),
    );
    platformRing.rotation.x = Math.PI / 2;
    platformRing.position.y = 0.1;
    scene.add(platformRing);

    const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(8, 0.1, 6, 24),
        new THREE.MeshStandardMaterial({
            color: 0xff66ff,
            emissive: 0xff66ff,
            emissiveIntensity: 1.2,
            flatShading: true,
        }),
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.06;
    scene.add(innerRing);

    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const line = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.05, 6),
            new THREE.MeshStandardMaterial({
                color: 0x00ffff,
                emissive: 0x00ffff,
                emissiveIntensity: 0.8,
                flatShading: true,
            }),
        );
        line.position.set(Math.cos(angle) * 11, 0.08, Math.sin(angle) * 11);
        line.rotation.y = angle + Math.PI / 2;
        scene.add(line);
    }

    scene.fog = new THREE.Fog(0x2a2a4e, 10, 120);

    const mountainGeometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const distance = 100 + Math.random() * 20;
        const height = 25 + Math.random() * 20;

        const mountainGeometry = new THREE.ConeGeometry(18, height, 4);
        mountainGeometry.translate(
            Math.cos(angle) * distance,
            height / 2 - 5,
            Math.sin(angle) * distance,
        );
        mountainGeometries.push(mountainGeometry);
    }

    if (mountainGeometries.length > 0) {
        const mergedMountains = mergeGeometries(mountainGeometries, false);
        if (mergedMountains) {
            const mountainsMesh = new THREE.Mesh(
                mergedMountains,
                new THREE.MeshStandardMaterial({
                    color: 0x1a1a3e,
                    flatShading: true,
                }),
            );
            scene.add(mountainsMesh);
        }
        mountainGeometries.forEach(g => g.dispose());
    }

    return {
        crystals,
        particles,
        stars,
        portalRing: null,
        portalInnerRing: null,
        portalSphere: null,
        platformRing,
        innerRing,
    };
}


export function createPortal(scene: THREE.Scene): {
    group: THREE.Group;
    portalRing: THREE.Mesh;
    innerRing: THREE.Mesh;
    sphere: THREE.Mesh;
} {
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, 0, -15);

    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(4, 4.5, 0.5, 16),
        new THREE.MeshStandardMaterial({
            color: 0x4a4a6e,
            metalness: 0.6,
            roughness: 0.4,
            flatShading: true,
        }),
    );
    base.position.y = 0.25;
    base.receiveShadow = true;
    portalGroup.add(base);

    const portalRing = new THREE.Mesh(
        new THREE.TorusGeometry(3, 0.3, 8, 32),
        new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 2,
            metalness: 0.8,
            roughness: 0.2,
            flatShading: true,
        }),
    );
    portalRing.position.y = 3.5;
    portalGroup.add(portalRing);

    const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.3, 0.15, 8, 32),
        new THREE.MeshStandardMaterial({
            color: 0xff66ff,
            emissive: 0xff66ff,
            emissiveIntensity: 1.5,
            metalness: 0.8,
            roughness: 0.2,
            flatShading: true,
        }),
    );
    innerRing.position.y = 3.5;
    portalGroup.add(innerRing);

    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(2, 16, 16),
        new THREE.MeshBasicMaterial({
            color: 0x66ffff,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
        }),
    );
    sphere.position.y = 3.5;
    portalGroup.add(sphere);

    const pillarGeometry = new THREE.BoxGeometry(0.8, 7, 0.8);
    const pillarMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a6e,
        metalness: 0.5,
        roughness: 0.5,
        flatShading: true,
    });

    const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    leftPillar.position.set(-3.5, 3.5, 0);
    portalGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    rightPillar.position.set(3.5, 3.5, 0);
    portalGroup.add(rightPillar);

    const glowGeometry = new THREE.BoxGeometry(0.2, 5, 0.2);
    const glowMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 2,
        flatShading: true,
    });

    const leftGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    leftGlow.position.set(-3.5, 3.5, 0.4);
    portalGroup.add(leftGlow);

    const rightGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    rightGlow.position.set(3.5, 3.5, 0.4);
    portalGroup.add(rightGlow);

    const arch = new THREE.Mesh(
        new THREE.BoxGeometry(7.8, 0.8, 0.8),
        pillarMaterial,
    );
    arch.position.set(0, 7, 0);
    portalGroup.add(arch);

    const portalLight = new THREE.PointLight(0x66ffff, 2, 20);
    portalLight.position.set(0, 3.5, 0);
    portalGroup.add(portalLight);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
        const gradient = context.createLinearGradient(0, 0, 512, 0);
        gradient.addColorStop(0, '#00ffff');
        gradient.addColorStop(0.5, '#ffffff');
        gradient.addColorStop(1, '#ff66ff');

        context.fillStyle = gradient;
        context.font = 'bold 80px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = '#00ffff';
        context.shadowBlur = 20;
        context.fillText('QUEUE', 256, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true }),
    );
    sprite.position.set(0, 9, 0);
    sprite.scale.set(8, 2, 1);
    portalGroup.add(sprite);

    scene.add(portalGroup);
    return { group: portalGroup, portalRing, innerRing, sphere };
}


export function updateLobbyAnimations(
    animatables: LobbyAnimatables,
    elapsedTime: number,
    frame: number,
): void {
    const { crystals, particles, stars, portalRing, portalInnerRing, portalSphere, platformRing, innerRing } = animatables;

    if (portalRing) portalRing.rotation.z = elapsedTime * 0.5;
    if (portalInnerRing) portalInnerRing.rotation.z = -elapsedTime * 0.8;
    if (portalSphere) {
        const scale = 1 + Math.sin(elapsedTime * 2) * 0.1;
        portalSphere.scale.set(scale, scale, scale);
    }

    for (const crystal of crystals) {
        crystal.rotation.y = elapsedTime * 1.5;
        crystal.rotation.x = Math.sin(elapsedTime * 2) * 0.3;
    }

    if (platformRing) platformRing.rotation.z = elapsedTime * 0.2;
    if (innerRing) innerRing.rotation.z = -elapsedTime * 0.3;

    if (particles && frame % 3 === 0) {
        const positions = particles.geometry.attributes.position.array as Float32Array;
        const count = positions.length / 3;
        for (let i = 0; i < count; i++) {
            positions[i * 3 + 1] += Math.sin(elapsedTime + i) * 0.01;
            positions[i * 3] += Math.cos(elapsedTime * 0.5 + i) * 0.006;

            if (positions[i * 3 + 1] > 16) positions[i * 3 + 1] = 1;
            if (positions[i * 3 + 1] < 1) positions[i * 3 + 1] = 15;
        }
        particles.geometry.attributes.position.needsUpdate = true;
    }

    if (stars && frame % 2 === 0) {
        stars.rotation.y = elapsedTime * 0.01;
    }
}