// src/features/game/world/locations/MainWorld.ts
import * as THREE from "three";
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Location, Portal } from "../Location";
import { ResourceManager } from "../../core/ResourceManager";
import { TerrainChunkManager } from "../TerrainChunkManager";
import { GridSystem } from "../GridSystem";
import { CollisionGrid } from "../CollisionGrid";

interface FogParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  baseY: number;
}

export class MainWorld extends Location {
  public readonly size = 1000;
  public terrain: TerrainChunkManager;
  public gridSystem: GridSystem;
  public collisionGrid: CollisionGrid;
  public terrainCollisionGrid: CollisionGrid;

  private treeInstances: Map<string, THREE.InstancedMesh> = new Map();
  private rockInstances: Map<string, THREE.InstancedMesh> = new Map();

  private treeGeometry: THREE.BufferGeometry | null = null;
  private treeMaterial: THREE.Material | null = null;
  private rockGeometry: THREE.BufferGeometry | null = null;
  private rockMaterial: THREE.Material | null = null;

  private sun: THREE.DirectionalLight | null = null;
  private sunTarget: THREE.Object3D | null = null;

  private streamingRadius: number = 2;
  private loadedChunkKeys: Set<string> = new Set();

  private portalMesh: THREE.Object3D | null = null;
  private portalCollider: THREE.Box3 | null = null;
  private fogParticles: FogParticle[] = [];
  private fogGeometry: THREE.SphereGeometry | null = null;
  private fogMaterial: THREE.MeshBasicMaterial | null = null;
  private readonly FOG_PARTICLE_COUNT = 300;
  private readonly FOG_RADIUS = 1;
  private readonly FOG_HEIGHT = 3;
  private portalPosition: THREE.Vector3 | null = null;
  private portalLight: THREE.PointLight | null = null;

  private grassGeometry: THREE.BufferGeometry | null = null;
  private grassMaterial: THREE.Material | null = null;
  private grassInstances: Map<string, THREE.InstancedMesh> = new Map();

  private readonly DECORATION_DRAW_DISTANCE = 100;

  private sky: Sky | null = null;
  private sunPosition: THREE.Vector3 = new THREE.Vector3();
  private dayTime: number = 0.25;

  private sunMesh: THREE.Mesh | null = null;
  private moonMesh: THREE.Mesh | null = null;
  private stars: THREE.Points | null = null;
  private clouds: THREE.Mesh | null = null;
  private cloudTexture: THREE.Texture | null = null;

  constructor() {
    super("main-world", "TANJO World");

    const portalX = 50;
    const portalZ = 0;
    const portalRadius = 8;

    const heightFunction = (x: number, z: number): number => {
      const distFromCenter = Math.sqrt(x * x + z * z);
      if (distFromCenter < 40) return 0;

      const distFromPortal = Math.sqrt(
        Math.pow(x - portalX, 2) +
        Math.pow(z - portalZ, 2)
      );
      if (distFromPortal < portalRadius) return 0;

      return (
        Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2 +
        Math.sin(x * 0.1 + 1.5) * Math.cos(z * 0.08 + 0.7) * 1.5 +
        Math.sin(x * 0.02) * Math.cos(z * 0.03) * 3
      );
    };

    this.terrain = new TerrainChunkManager(
      {
        chunkSize: 100,
        segmentsPerChunk: 64,
        worldSize: this.size,
      },
      heightFunction
    );

    this.gridSystem = new GridSystem(this.size, 5);
    this.collisionGrid = new CollisionGrid(20);
    this.terrainCollisionGrid = new CollisionGrid(100);
  }

  create(rm: ResourceManager) {
    this.createSky();
    this.createCelestialBodies();
    this.createAtmosphere();

    const chunks = this.terrain.generateAll(rm);
    for (const chunk of chunks) {
      this.scene.add(chunk.mesh);
      chunk.mesh.visible = true;
      this.loadedChunkKeys.add(`${chunk.chunkX},${chunk.chunkZ}`);
    }

    this.gridSystem.createVisualization(this.scene);

    this.prepareVegetationAssets(rm);
    this.prepareDecorationAssets(rm);
    this.createVegetationByChunks(rm);
    this.createRocksByChunks(rm);
    this.createDecorationsByChunks(rm);

    this.buildCollisionGrid();
    this.buildTerrainCollisionGrid();
    this.createLighting();
    this.createCaveEntrance(rm);
  }

  private buildTerrainCollisionGrid() {
    this.terrainCollisionGrid.clear();

    this.terrain.chunks.forEach(chunk => {
      const box = new THREE.Box3(
        new THREE.Vector3(chunk.worldX - chunk.chunkSize / 2, -10, chunk.worldZ - chunk.chunkSize / 2),
        new THREE.Vector3(chunk.worldX + chunk.chunkSize / 2, 10, chunk.worldZ + chunk.chunkSize / 2)
      );
      this.terrainCollisionGrid.insert(box);
    });

    this.terrain.chunks.forEach(chunk => {
      for (const collider of chunk.colliders) {
        this.terrainCollisionGrid.insert(collider);
      }
    });
  }

  private createAtmosphere() {
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.002);
  }

  private hash2D(x: number, z: number): number {
    let n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  private smoothNoise(x: number, z: number): number {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;

    const ux = fx * fx * (3.0 - 2.0 * fx);
    const uz = fz * fz * (3.0 - 2.0 * fz);

    const a = this.hash2D(ix, iz);
    const b = this.hash2D(ix + 1, iz);
    const c = this.hash2D(ix, iz + 1);
    const d = this.hash2D(ix + 1, iz + 1);

    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }

  private fbm(x: number, z: number): number {
    let value = 0.0;
    let amplitude = 0.5;
    let frequency = 1.0;
    for (let i = 0; i < 3; i++) {
      value += amplitude * this.smoothNoise(x * frequency, z * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  private createGrassBladeGeometry(): THREE.BufferGeometry {
    const w = 0.12;
    const h = 0.4;

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const angles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];

    angles.forEach((angle, idx) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const v0 = [-w * cos, 0, -w * sin];
      const v1 = [w * cos, 0, w * sin];
      const v2 = [w * cos, h, w * sin];
      const v3 = [-w * cos, h, -w * sin];

      positions.push(...v0, ...v1, ...v2, ...v3);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

      const baseIdx = idx * 4;
      indices.push(
        baseIdx, baseIdx + 1, baseIdx + 2,
        baseIdx, baseIdx + 2, baseIdx + 3
      );
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private createGrassMaterial(baseMaterial: THREE.MeshStandardMaterial): THREE.Material {
    const mat = baseMaterial.clone();
    mat.side = THREE.DoubleSide;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uPlayerPos = { value: new THREE.Vector3() };
      shader.uniforms.uWindStrength = { value: 1.0 };
      shader.uniforms.uColorBottom = { value: new THREE.Color(0x2a5d1b) };
      shader.uniforms.uColorTop = { value: new THREE.Color(0x8bc34a) };
      shader.uniforms.uDrawDistance = { value: 100.0 };

      shader.vertexShader = `
              uniform float uTime;
              uniform vec3 uPlayerPos;
              uniform float uWindStrength;
              uniform vec3 uColorBottom;
              uniform vec3 uColorTop;
              uniform float uDrawDistance;
              varying vec2 vGrassUv;
              varying float vGrassHeight;
              varying float vGrassDist;
              varying vec3 vWorldPos;
          ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
              #include <begin_vertex>
              
              vGrassUv = uv;
              vGrassHeight = uv.y;
              
              vec3 instancePos = vec3(0.0);
              #ifdef USE_INSTANCING
                  instancePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
                  vWorldPos = instancePos;
                  
                  vec3 right = vec3(instanceMatrix[0][0], instanceMatrix[1][0], instanceMatrix[2][0]);
                  vec3 forward = vec3(instanceMatrix[0][2], instanceMatrix[1][2], instanceMatrix[2][2]);
                  
                  float wind1 = sin(uTime * 0.8 + instancePos.x * 0.1 + instancePos.z * 0.1);
                  float wind2 = sin(uTime * 0.4 + instancePos.x * 0.05 + instancePos.z * 0.05) * 0.5;
                  float wind3 = cos(uTime * 1.2 + instancePos.x * 0.15 + instancePos.z * 0.15) * 0.3;
                  float totalWind = wind1 + wind2 + wind3;
                  
                  vec3 worldWind = vec3(totalWind * 0.15, 0.0, totalWind * 0.1);
                  
                  vec3 toPlayer = instancePos - uPlayerPos;
                  float distToPlayer = length(toPlayer.xz);
                  float interactionRadius = 2.0;
                  vec3 pushDir = normalize(vec3(toPlayer.x, 0.0, toPlayer.z) + vec3(0.001));
                  float pushStrength = (1.0 - smoothstep(0.0, interactionRadius, distToPlayer)) * 1.0;
                  vec3 worldPush = pushDir * pushStrength;
                  
                  vec3 localWind = vec3(
                      dot(worldWind, right),
                      0.0,
                      dot(worldWind, forward)
                  );
                  vec3 localPush = vec3(
                      dot(worldPush, right),
                      0.0,
                      dot(worldPush, forward)
                  );
                  
                  float bend = uv.y * uv.y * 0.1;
                  transformed.x += bend;
                  
                  float heightFactor = uv.y * uv.y;
                  
                  transformed.x += (localWind.x + localPush.x) * heightFactor * uWindStrength;
                  transformed.z += (localWind.z + localPush.z) * heightFactor * uWindStrength;
                  
                  vGrassDist = distance(instancePos, uPlayerPos);
              #endif
              `
      );

      shader.fragmentShader = `
              uniform vec3 uColorBottom;
              uniform vec3 uColorTop;
              uniform float uDrawDistance;
              varying vec2 vGrassUv;
              varying float vGrassHeight;
              varying float vGrassDist;
              varying vec3 vWorldPos;
          ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
              #include <color_fragment>
              
              vec3 grassColor = mix(uColorBottom, uColorTop, vGrassHeight);
              
              float colorNoise = sin(vWorldPos.x * 0.2 + vWorldPos.z * 0.2) * 0.5 + 0.5;
              grassColor *= 0.8 + colorNoise * 0.4;
              
              float detailNoise = sin(vWorldPos.x * 1.5 + vWorldPos.z * 1.3) * 0.5 + 0.5;
              grassColor *= 0.9 + detailNoise * 0.2;
              
              diffuseColor.rgb = grassColor;
              `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <output_fragment>',
        `
              #include <output_fragment>
              
              vec2 screenPos = gl_FragCoord.xy;
              float dither = fract(sin(dot(screenPos, vec2(12.9898, 78.233))) * 43758.5453);
              
              float fadeStart = uDrawDistance * 0.7;
              float fadeEnd = uDrawDistance;
              float alphaFade = 1.0 - smoothstep(fadeStart, fadeEnd, vGrassDist);
              
              alphaFade *= smoothstep(0.0, 0.2, vGrassHeight);
              
              if (alphaFade < dither) discard;
              `
      );

      mat.userData.shader = shader;
    };

    return mat;
  }

  private createSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(450000);
    this.scene.add(this.sky);

    const uniforms = this.sky.material.uniforms;

    uniforms['turbidity'].value = 10;
    uniforms['rayleigh'].value = 2.2;
    uniforms['mieCoefficient'].value = 0.006;
    uniforms['mieDirectionalG'].value = 0.85;

    this.updateSunPosition(this.dayTime);
  }

  private createCelestialBodies() {
    const sunGeo = new THREE.SphereGeometry(50, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xffdd88,
      fog: false
    });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

    const moonGeo = new THREE.SphereGeometry(30, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xddddee,
      fog: false
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.scene.add(this.moonMesh);

    const starsGeo = new THREE.BufferGeometry();
    const starCount = 5000;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const r = 2000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      transparent: true,
      opacity: 0,
      fog: false,
      sizeAttenuation: false
    });

    this.stars = new THREE.Points(starsGeo, starsMat);
    this.scene.add(this.stars);

    this.cloudTexture = this.createCloudTexture();
    const cloudGeo = new THREE.PlaneGeometry(2000, 2000);
    const cloudMat = new THREE.MeshBasicMaterial({
      map: this.cloudTexture,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });
    this.clouds = new THREE.Mesh(cloudGeo, cloudMat);
    this.clouds.position.y = 300;
    this.clouds.rotation.x = -Math.PI / 2;
    this.scene.add(this.clouds);
  }

  private createCloudTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 512, 512);

    for (let i = 0; i < 30; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const radius = 30 + Math.random() * 80;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  private updateSunPosition(timeOfDay: number) {
    if (!this.sky) return;

    const elevation = Math.sin(timeOfDay * Math.PI * 2 - Math.PI / 2) * 90;
    const azimuth = 180;

    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);

    this.sunPosition.setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms['sunPosition'].value.copy(this.sunPosition);

    const uniforms = this.sky.material.uniforms;

    if (elevation > 20) {
      uniforms['turbidity'].value = 8;
      uniforms['rayleigh'].value = 2;
      uniforms['mieCoefficient'].value = 0.003;
      uniforms['mieDirectionalG'].value = 0.7;
    } else if (elevation > 0) {
      const t = elevation / 20;
      uniforms['turbidity'].value = THREE.MathUtils.lerp(12, 8, t);
      uniforms['rayleigh'].value = THREE.MathUtils.lerp(1.5, 2, t);
      uniforms['mieCoefficient'].value = THREE.MathUtils.lerp(0.01, 0.003, t);
      uniforms['mieDirectionalG'].value = THREE.MathUtils.lerp(0.9, 0.7, t);
    } else {
      uniforms['rayleigh'].value = 0.2;
      uniforms['turbidity'].value = 20;
    }

    if (this.sun) {
      this.sun.position.copy(this.sunPosition).multiplyScalar(300);

      const sunIntensity = Math.max(0, elevation / 90);
      this.sun.intensity = 0.5 + sunIntensity * 1.5;

      if (elevation > 20) {
        this.sun.color.setHex(0xfff0d0);
      } else if (elevation > 0) {
        this.sun.color.setHex(0xff8844);
      } else {
        this.sun.color.setHex(0x4466aa);
      }
    }

    if (this.scene.fog instanceof THREE.FogExp2) {
      if (elevation > 20) {
        this.scene.fog.color.setHex(0x87ceeb);
      } else if (elevation > 0) {
        this.scene.fog.color.setHex(0xff9966);
      } else {
        this.scene.fog.color.setHex(0x1a2a4a);
      }
    }

    if (this.sunMesh) {
      this.sunMesh.position.copy(this.sunPosition).multiplyScalar(2000);

      if (elevation > 20) {
        (this.sunMesh.material as THREE.MeshBasicMaterial).color.setHex(0xffdd88);
      } else if (elevation > 0) {
        (this.sunMesh.material as THREE.MeshBasicMaterial).color.setHex(0xff8844);
      }

      this.sunMesh.visible = elevation > -5;
    }

    if (this.moonMesh) {
      this.moonMesh.position.copy(this.sunPosition).multiplyScalar(-2000);
      this.moonMesh.visible = elevation < 10;
    }

    if (this.stars) {
      const starsOpacity = THREE.MathUtils.smoothstep(-elevation, 0, 20);
      (this.stars.material as THREE.PointsMaterial).opacity = starsOpacity;
      this.stars.visible = starsOpacity > 0.01;
    }
  }

  private createCaveEntrance(rm: ResourceManager) {
    const caveX = 50;
    const caveZ = 0;
    const caveY = 0;
    const PORTAL_SINK = 0.5;

    this.portalPosition = new THREE.Vector3(caveX, caveY, caveZ);

    const portalData = rm.getModel("portal");
    if (portalData) {
      this.portalMesh = portalData.scene;

      const box = new THREE.Box3().setFromObject(this.portalMesh);
      const size = box.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.z);
      const targetMaxSize = 12;

      if (maxDimension > targetMaxSize) {
        const scale = targetMaxSize / maxDimension;
        this.portalMesh.scale.setScalar(scale);
      }

      this.scene.add(this.portalMesh);
      this.portalMesh.position.set(0, 0, 0);

      const scaledBox = new THREE.Box3().setFromObject(this.portalMesh);
      const center = scaledBox.getCenter(new THREE.Vector3());

      this.portalMesh.position.set(
        caveX - center.x,
        caveY - scaledBox.min.y - PORTAL_SINK,
        caveZ - center.z
      );

      this.portalMesh.updateMatrixWorld(true);

      this.clearVegetationAroundPortal(caveX, caveZ, 8);

      this.portalMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const name = child.name.toLowerCase();

          if (name.includes('base') || name.includes('плита') || name.includes('plate')) {
            child.updateMatrixWorld(true);
            const childBox = new THREE.Box3().setFromObject(child);
            const surfaceY = childBox.max.y;

            const platformBox = new THREE.Box3(
              new THREE.Vector3(childBox.min.x, surfaceY - 0.01, childBox.min.z),
              new THREE.Vector3(childBox.max.x, surfaceY, childBox.max.z)
            );

            this.collisionGrid.insert(platformBox);
          }
          else if (name.includes('monolith') || name.includes('stone') || name.includes('камень')) {
            child.updateMatrixWorld(true);
            const childBox = new THREE.Box3().setFromObject(child);
            const surfaceY = childBox.max.y;

            const platformBox = new THREE.Box3(
              new THREE.Vector3(childBox.min.x, surfaceY - 0.01, childBox.min.z),
              new THREE.Vector3(childBox.max.x, surfaceY, childBox.max.z)
            );

            this.collisionGrid.insert(platformBox);
          }
        }
      });
    } else {
      const archGeo = new THREE.TorusGeometry(3, 0.5, 8, 16, Math.PI);
      const archMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
      this.portalMesh = new THREE.Mesh(archGeo, archMat);
      this.portalMesh.position.set(caveX, caveY - PORTAL_SINK, caveZ);
      this.portalMesh.rotation.x = Math.PI;
      this.scene.add(this.portalMesh);
    }

    this.portalLight = new THREE.PointLight(0x4488ff, 2, 15);
    this.portalLight.position.set(caveX, caveY + 2 - PORTAL_SINK, caveZ);
    this.scene.add(this.portalLight);

    this.createFogParticles(caveX, caveY - PORTAL_SINK, caveZ);

    this.addPortal({
      id: "main-to-cave",
      position: new THREE.Vector3(caveX, caveY, caveZ),
      radius: 3,
      targetLocationId: "cave",
      targetSpawnPoint: new THREE.Vector3(0, 0, 0),
      mesh: this.portalMesh,
    });
  }

  private clearVegetationAroundPortal(centerX: number, centerZ: number, radius: number) {
    let treesRemoved = 0;
    let rocksRemoved = 0;

    this.terrain.chunks.forEach((chunk, key) => {
      const trees = this.treeInstances.get(key);
      if (trees) {
        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3();

        for (let i = 0; i < trees.count; i++) {
          trees.getMatrixAt(i, matrix);
          pos.setFromMatrixPosition(matrix);

          const dist = Math.sqrt(
            Math.pow(pos.x - centerX, 2) +
            Math.pow(pos.z - centerZ, 2)
          );

          if (dist <= radius) {
            matrix.makeScale(0, 0, 0);
            trees.setMatrixAt(i, matrix);
            treesRemoved++;
          }
        }

        if (treesRemoved > 0) {
          trees.instanceMatrix.needsUpdate = true;
        }
      }

      const rocks = this.rockInstances.get(key);
      if (rocks) {
        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3();

        for (let i = 0; i < rocks.count; i++) {
          rocks.getMatrixAt(i, matrix);
          pos.setFromMatrixPosition(matrix);

          const dist = Math.sqrt(
            Math.pow(pos.x - centerX, 2) +
            Math.pow(pos.z - centerZ, 2)
          );

          if (dist <= radius) {
            matrix.makeScale(0, 0, 0);
            rocks.setMatrixAt(i, matrix);
            rocksRemoved++;
          }
        }

        if (rocksRemoved > 0) {
          rocks.instanceMatrix.needsUpdate = true;
        }
      }
    });
  }

  private createFogParticles(centerX: number, centerY: number, centerZ: number) {
    this.fogGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    this.fogMaterial = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });

    for (let i = 0; i < this.FOG_PARTICLE_COUNT; i++) {
      const mesh = new THREE.Mesh(this.fogGeometry, this.fogMaterial);

      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * this.FOG_RADIUS;
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius;

      const y = centerY + (i / this.FOG_PARTICLE_COUNT) * this.FOG_HEIGHT;

      mesh.position.set(x, y, z);
      mesh.visible = true;
      this.scene.add(mesh);

      const maxLife = 4 + Math.random() * 2;

      this.fogParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          0.4 + Math.random() * 0.2,
          (Math.random() - 0.5) * 0.1
        ),
        life: (i / this.FOG_PARTICLE_COUNT) * maxLife,
        maxLife,
        baseY: centerY,
      });
    }
  }

  private updateFogParticles(delta: number) {
    if (!this.portalPosition || !this.fogParticles.length) return;

    for (const particle of this.fogParticles) {
      particle.life += delta;

      if (particle.life >= particle.maxLife) {
        particle.life = 0;

        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.FOG_RADIUS;
        particle.mesh.position.set(
          this.portalPosition.x + Math.cos(angle) * radius,
          particle.baseY,
          this.portalPosition.z + Math.sin(angle) * radius
        );

        particle.velocity.set(
          (Math.random() - 0.5) * 0.1,
          0.4 + Math.random() * 0.2,
          (Math.random() - 0.5) * 0.1
        );

        particle.maxLife = 4 + Math.random() * 2;
      }

      particle.mesh.position.x += particle.velocity.x * delta;
      particle.mesh.position.y += particle.velocity.y * delta;
      particle.mesh.position.z += particle.velocity.z * delta;

      const lifeRatio = particle.life / particle.maxLife;
      let opacity = 0.25;

      if (lifeRatio < 0.1) {
        opacity = (lifeRatio / 0.1) * 0.25;
      }
      else if (lifeRatio > 0.85) {
        opacity = ((1 - lifeRatio) / 0.15) * 0.25;
      }

      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;

      const scale = 1.0 + lifeRatio * 0.5;
      particle.mesh.scale.setScalar(scale);
    }
  }

  private prepareVegetationAssets(rm: ResourceManager) {
    const treeData = rm.getModel("tree");
    if (treeData) {
      const treeMesh = this.findFirstMesh(treeData.scene);
      if (treeMesh && treeMesh.geometry) {
        const { geometry, material } = this.cloneAndRotateGeometry(treeMesh);
        this.treeGeometry = geometry;
        this.treeMaterial = material;
      }
    }

    const rockData = rm.getModel("rock");
    if (rockData) {
      const rockMesh = this.findFirstMesh(rockData.scene);
      if (rockMesh && rockMesh.geometry) {
        const { geometry, material } = this.cloneAndRotateGeometry(rockMesh);
        this.rockGeometry = geometry;
        this.rockMaterial = material;
      }
    }
  }

  private prepareDecorationAssets(rm: ResourceManager) {
    console.log(`\n=== PREPARING DECORATION ASSETS ===\n`);

    const grassData = rm.getModel("grass");
    if (grassData) {
      this.grassGeometry = this.createGrassBladeGeometry();

      const mesh = this.findFirstMesh(grassData.scene);
      let baseMat = new THREE.MeshStandardMaterial({ color: 0x4a8f2a });
      if (mesh && mesh.material) {
        let mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          baseMat = mat;
        } else if ((mat as any).color) {
          baseMat = new THREE.MeshStandardMaterial({ color: (mat as any).color });
        }
      }

      this.grassMaterial = this.createGrassMaterial(baseMat);
    }

    console.log(`=== END DECORATION ASSETS ===\n`);
  }

  private createVegetationByChunks(rm: ResourceManager) {
    if (!this.treeGeometry || !this.treeMaterial) return;

    const treesPerChunk = 60;
    const clearZoneRadius = 50;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    this.terrain.chunks.forEach((chunk, key) => {
      const treeInstances = new THREE.InstancedMesh(
        this.treeGeometry!,
        this.treeMaterial!,
        treesPerChunk
      );
      treeInstances.castShadow = true;
      treeInstances.receiveShadow = true;

      let treePlaced = 0;
      for (let i = 0; i < treesPerChunk; i++) {
        let worldX: number, worldZ: number;
        let attempts = 0;

        do {
          const localX = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
          const localZ = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
          worldX = chunk.worldX + localX;
          worldZ = chunk.worldZ + localZ;
          attempts++;
        } while (this.isInSafeZone(worldX, worldZ) && attempts < 10);

        if (this.isInSafeZone(worldX, worldZ)) continue;

        const terrainHeight = this.terrain.getHeightAt(worldX, worldZ);
        const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
        if (dist < clearZoneRadius) continue;

        position.set(worldX, terrainHeight, worldZ);
        rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));

        const baseSize = 0.8 + Math.random() * 0.6;
        const heightMultiplier = 2.5 + Math.random() * 1.5;
        const thicknessMultiplier = Math.sqrt(heightMultiplier);

        const scaleXZ = baseSize * thicknessMultiplier;
        const scaleY = baseSize * heightMultiplier;
        scale.set(scaleXZ, scaleY, scaleXZ);

        matrix.compose(position, rotation, scale);
        treeInstances.setMatrixAt(treePlaced, matrix);

        const treeHeight = 4 * heightMultiplier;
        const treeRadius = 0.5 * thicknessMultiplier;

        chunk.colliders.push(new THREE.Box3(
          new THREE.Vector3(worldX - treeRadius, terrainHeight, worldZ - treeRadius),
          new THREE.Vector3(worldX + treeRadius, terrainHeight + treeHeight, worldZ + treeRadius)
        ));

        treePlaced++;
      }

      treeInstances.count = treePlaced;
      treeInstances.instanceMatrix.needsUpdate = true;
      this.scene.add(treeInstances);
      this.treeInstances.set(key, treeInstances);
    });
  }

  private createRocksByChunks(rm: ResourceManager) {
    if (!this.rockGeometry || !this.rockMaterial) return;

    const rocksPerChunk = 6;
    const clearZoneRadius = 50;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    this.terrain.chunks.forEach((chunk, key) => {
      const instances = new THREE.InstancedMesh(
        this.rockGeometry!,
        this.rockMaterial!,
        rocksPerChunk
      );
      instances.castShadow = true;
      instances.receiveShadow = true;

      let placed = 0;
      for (let i = 0; i < rocksPerChunk; i++) {
        let worldX: number, worldZ: number;
        let attempts = 0;

        do {
          const localX = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
          const localZ = -this.terrain.config.chunkSize / 2 + Math.random() * this.terrain.config.chunkSize;
          worldX = chunk.worldX + localX;
          worldZ = chunk.worldZ + localZ;
          attempts++;
        } while (this.isInSafeZone(worldX, worldZ) && attempts < 10);

        if (this.isInSafeZone(worldX, worldZ)) continue;

        const terrainHeight = this.terrain.getHeightAt(worldX, worldZ);
        const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
        if (dist < clearZoneRadius) continue;

        position.set(worldX, terrainHeight, worldZ);
        rotation.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
        const s = 0.6 + Math.random() * 1.2;
        scale.set(s, s, s);

        matrix.compose(position, rotation, scale);
        instances.setMatrixAt(placed, matrix);

        chunk.colliders.push(new THREE.Box3(
          new THREE.Vector3(worldX - 1, terrainHeight, worldZ - 1),
          new THREE.Vector3(worldX + 1, terrainHeight + 2, worldZ + 1)
        ));

        placed++;
      }

      instances.count = placed;
      instances.instanceMatrix.needsUpdate = true;
      this.scene.add(instances);
      this.rockInstances.set(key, instances);
    });
  }

  private createDecorationsByChunks(rm: ResourceManager) {
    const maxGrassPerChunk = 10000;
    const clearZoneRadius = 30;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    this.terrain.chunks.forEach((chunk, key) => {
      if (this.grassGeometry && this.grassMaterial) {
        const grassInstances = new THREE.InstancedMesh(
          this.grassGeometry!,
          this.grassMaterial!,
          maxGrassPerChunk
        );
        grassInstances.castShadow = false;
        grassInstances.receiveShadow = true;
        grassInstances.frustumCulled = true;

        let grassPlaced = 0;
        const gridSize = 120;
        const cellSize = this.terrain.config.chunkSize / gridSize;

        for (let gx = 0; gx < gridSize; gx++) {
          for (let gz = 0; gz < gridSize; gz++) {
            const localX = -this.terrain.config.chunkSize / 2 + (gx + 0.5) * cellSize;
            const localZ = -this.terrain.config.chunkSize / 2 + (gz + 0.5) * cellSize;

            const worldX = chunk.worldX + localX;
            const worldZ = chunk.worldZ + localZ;

            const density = this.fbm(worldX * 0.05, worldZ * 0.05) * 1.2;

            if (density < 0.08) continue;

            const jitterX = (this.hash2D(gx * 1.1, gz * 2.2) - 0.5) * cellSize * 0.8;
            const jitterZ = (this.hash2D(gx * 3.3, gz * 4.4) - 0.5) * cellSize * 0.8;

            const finalX = worldX + jitterX;
            const finalZ = worldZ + jitterZ;

            if (this.isInSafeZone(finalX, finalZ)) continue;
            const dist = Math.sqrt(finalX * finalX + finalZ * finalZ);
            if (dist < clearZoneRadius) continue;

            const terrainHeight = this.terrain.getHeightAt(finalX, finalZ);
            position.set(finalX, terrainHeight, finalZ);

            const rotY = this.hash2D(finalX * 10, finalZ * 10) * Math.PI * 2;
            rotation.setFromEuler(new THREE.Euler(0, rotY, 0));

            const distFromChunkCenter = Math.sqrt(localX * localX + localZ * localZ);
            const lodFactor = 1.0 - smoothstep(30, 50, distFromChunkCenter);

            const s = (0.7 + density * 0.6) * lodFactor;
            const hScale = (s + this.hash2D(finalX, finalZ) * 0.4) * lodFactor;
            scale.set(s, hScale, s);

            matrix.compose(position, rotation, scale);
            grassInstances.setMatrixAt(grassPlaced, matrix);
            grassPlaced++;

            if (grassPlaced >= maxGrassPerChunk) break;
          }
          if (grassPlaced >= maxGrassPerChunk) break;
        }

        grassInstances.count = grassPlaced;
        grassInstances.instanceMatrix.needsUpdate = true;
        this.scene.add(grassInstances);
        this.grassInstances.set(key, grassInstances);
      }
    });
  }

  private buildCollisionGrid() {
    this.collisionGrid.clear();
    this.terrain.chunks.forEach(chunk => {
      for (const collider of chunk.colliders) {
        this.collisionGrid.insert(collider);
      }
    });
  }

  private findFirstMesh(scene: THREE.Group): THREE.Mesh | null {
    let foundMesh: THREE.Mesh | null = null;

    scene.traverse((child) => {
      if (foundMesh) return;
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        foundMesh = child as THREE.Mesh;
      }
    });

    return foundMesh;
  }

  private cloneAndRotateGeometry(sourceMesh: THREE.Mesh): { geometry: THREE.BufferGeometry; material: THREE.Material } {
    const geometry = sourceMesh.geometry.clone();
    const material = Array.isArray(sourceMesh.material)
      ? sourceMesh.material[0]
      : sourceMesh.material;

    geometry.rotateX(-Math.PI / 2);

    return { geometry, material };
  }

  private isInSafeZone(x: number, z: number): boolean {
    const dist = Math.sqrt(x * x + z * z);
    return dist < 45;
  }

  private createLighting() {
  const hemi = new THREE.HemisphereLight(0xbde0ff, 0x4a6b3a, 1.2);
  this.scene.add(hemi);

  this.sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
  this.sun.castShadow = true;

  this.sun.shadow.mapSize.set(4096, 4096);
  this.sun.shadow.camera.near = 0.5;
  this.sun.shadow.camera.far = 500;
  
  const d = 200;
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

  this.scene.add(this.sun);
  this.scene.add(this.sunTarget);
}

  public update(playerPosition: THREE.Vector3, delta: number) {
    this.dayTime += delta * 0.01;
    if (this.dayTime > 1) this.dayTime -= 1;
    this.updateSunPosition(this.dayTime);

    if (this.clouds) {
      this.clouds.rotation.z += delta * 0.01;
    }

    if (this.sun && this.sun.shadow && this.sunTarget) {
      const shadowCam = this.sun.shadow.camera as THREE.OrthographicCamera;

      const shadowSize = 150;

      shadowCam.position.set(
        playerPosition.x,
        playerPosition.y + 150,
        playerPosition.z
      );

      this.sunTarget.position.copy(playerPosition);

      shadowCam.updateProjectionMatrix();

      this.sunTarget.updateMatrixWorld();
    }

    this.updateStreaming(playerPosition.x, playerPosition.z);
    this.updateDecorationVisibility(playerPosition);
    this.updateFogParticles(delta);

    if (this.grassMaterial && (this.grassMaterial as any).userData.shader) {
      const shader = (this.grassMaterial as any).userData.shader;
      shader.uniforms.uTime.value += delta;
      shader.uniforms.uPlayerPos.value.copy(playerPosition);
    }
  }

  private updateDecorationVisibility(playerPosition: THREE.Vector3) {
    const drawDistanceSq = this.DECORATION_DRAW_DISTANCE * this.DECORATION_DRAW_DISTANCE;

    this.loadedChunkKeys.forEach(key => {
      const chunk = this.terrain.chunks.get(key);
      if (!chunk) return;

      const dx = chunk.worldX - playerPosition.x;
      const dz = chunk.worldZ - playerPosition.z;
      const distSq = dx * dx + dz * dz;

      const isVisible = distSq <= drawDistanceSq;

      const grass = this.grassInstances.get(key);
      if (grass) grass.visible = isVisible;
    });
  }

  private updateStreaming(playerX: number, playerZ: number) {
    const playerChunk = this.terrain.getChunkAtWorldPos(playerX, playerZ);
    if (!playerChunk) return;

    const toShow: string[] = [];
    const toHide: string[] = [];

    for (let dx = -this.streamingRadius; dx <= this.streamingRadius; dx++) {
      for (let dz = -this.streamingRadius; dz <= this.streamingRadius; dz++) {
        const cx = playerChunk.chunkX + dx;
        const cz = playerChunk.chunkZ + dz;
        const key = `${cx},${cz}`;
        const chunk = this.terrain.chunks.get(key);
        if (chunk && !this.loadedChunkKeys.has(key)) {
          toShow.push(key);
        }
      }
    }

    this.loadedChunkKeys.forEach(key => {
      const chunk = this.terrain.chunks.get(key);
      if (!chunk) return;
      const dx = Math.abs(chunk.chunkX - playerChunk.chunkX);
      const dz = Math.abs(chunk.chunkZ - playerChunk.chunkZ);

      if (dx > this.streamingRadius || dz > this.streamingRadius) {
        toHide.push(key);
      }
    });

    for (const key of toShow) {
      const chunk = this.terrain.chunks.get(key);
      if (chunk) {
        chunk.mesh.visible = true;
        const trees = this.treeInstances.get(key);
        if (trees) trees.visible = true;
        const rocks = this.rockInstances.get(key);
        if (rocks) rocks.visible = true;

        this.loadedChunkKeys.add(key);
      }
    }

    for (const key of toHide) {
      const chunk = this.terrain.chunks.get(key);
      if (chunk) {
        chunk.mesh.visible = false;
        const trees = this.treeInstances.get(key);
        if (trees) trees.visible = false;
        const rocks = this.rockInstances.get(key);
        if (rocks) rocks.visible = false;

        this.loadedChunkKeys.delete(key);
      }
    }
  }

  public getCollidersInRadius(center: THREE.Vector3, radius: number): THREE.Box3[] {
    return this.collisionGrid.query(center, new THREE.Vector3(radius * 2, radius * 2, radius * 2));
  }

  getSpawnPoint(): THREE.Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const r = 10 + Math.random() * 15;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = this.terrain.getHeightAt(x, z);
    return new THREE.Vector3(x, y, z);
  }

  dispose() {
    this.terrain.dispose();
    this.gridSystem.dispose();

    this.treeInstances.forEach(instances => {
      this.scene.remove(instances);
      instances.dispose();
    });
    this.treeInstances.clear();

    this.rockInstances.forEach(instances => {
      this.scene.remove(instances);
      instances.dispose();
    });
    this.rockInstances.clear();

    this.grassInstances.forEach(instances => {
      this.scene.remove(instances);
      instances.dispose();
    });
    this.grassInstances.clear();

    if (this.treeGeometry) {
      this.treeGeometry.dispose();
      this.treeGeometry = null;
    }
    if (this.treeMaterial) {
      this.treeMaterial.dispose();
      this.treeMaterial = null;
    }
    if (this.rockGeometry) {
      this.rockGeometry.dispose();
      this.rockGeometry = null;
    }
    if (this.rockMaterial) {
      this.rockMaterial.dispose();
      this.rockMaterial = null;
    }

    if (this.grassGeometry) {
      this.grassGeometry.dispose();
      this.grassGeometry = null;
    }
    if (this.grassMaterial) {
      this.grassMaterial.dispose();
      this.grassMaterial = null;
    }

    for (const particle of this.fogParticles) {
      this.scene.remove(particle.mesh);
    }
    this.fogParticles = [];

    if (this.fogGeometry) {
      this.fogGeometry.dispose();
      this.fogGeometry = null;
    }
    if (this.fogMaterial) {
      this.fogMaterial.dispose();
      this.fogMaterial = null;
    }

    if (this.portalMesh) {
      this.scene.remove(this.portalMesh);
      this.portalMesh = null;
    }

    if (this.portalLight) {
      this.scene.remove(this.portalLight);
      this.portalLight = null;
    }

    if (this.sunMesh) {
      this.scene.remove(this.sunMesh);
      this.sunMesh.geometry.dispose();
      (this.sunMesh.material as THREE.Material).dispose();
      this.sunMesh = null;
    }

    if (this.moonMesh) {
      this.scene.remove(this.moonMesh);
      this.moonMesh.geometry.dispose();
      (this.moonMesh.material as THREE.Material).dispose();
      this.moonMesh = null;
    }

    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars.geometry.dispose();
      (this.stars.material as THREE.Material).dispose();
      this.stars = null;
    }

    if (this.clouds) {
      this.scene.remove(this.clouds);
      this.clouds.geometry.dispose();
      (this.clouds.material as THREE.Material).dispose();
      this.clouds = null;
    }

    if (this.cloudTexture) {
      this.cloudTexture.dispose();
      this.cloudTexture = null;
    }

    if (this.sky) {
      this.scene.remove(this.sky);
      this.sky.geometry.dispose();
      (this.sky.material as THREE.Material).dispose();
      this.sky = null;
    }

    if (this.scene.background instanceof THREE.Texture) {
      this.scene.background.dispose();
    }
    this.scene.background = null;
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}