//src\features\game\world\locations\main-world\utils\grass.ts
import * as THREE from "three";

export function createGrassBladeGeometry(): THREE.BufferGeometry {
  const blades = 6;
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  for (let i = 0; i < blades; i++) {
    const angle = (i / blades) * Math.PI * 2;
    const offsetX = (Math.random() - 0.5) * 0.15;
    const offsetZ = (Math.random() - 0.5) * 0.15;
    const w = 0.05 + Math.random() * 0.05;
    const h = 0.3 + Math.random() * 0.4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const v0 = [-w * cos + offsetX, 0, -w * sin + offsetZ];
    const v1 = [w * cos + offsetX, 0, w * sin + offsetZ];
    const v2 = [w * cos + offsetX, h, w * sin + offsetZ];
    const v3 = [-w * cos + offsetX, h, -w * sin + offsetZ];

    positions.push(...v0, ...v1, ...v2, ...v3);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(indexOffset, indexOffset + 1, indexOffset + 2, indexOffset, indexOffset + 2, indexOffset + 3);
    indexOffset += 4;
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function createGrassMaterial(baseMaterial: THREE.MeshStandardMaterial): THREE.Material {
  const mat = baseMaterial.clone();
  mat.side = THREE.FrontSide;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uPlayerPos = { value: new THREE.Vector3() };
    shader.uniforms.uWindStrength = { value: 1.0 };
    shader.uniforms.uColorBottom = { value: new THREE.Color(0x2a5d1b) };
    shader.uniforms.uColorTop = { value: new THREE.Color(0x8bc34a) };
    shader.uniforms.uDrawDistance = { value: 100.0 };

    shader.vertexShader = `
      uniform float uTime; uniform vec3 uPlayerPos; uniform float uWindStrength;
      uniform vec3 uColorBottom; uniform vec3 uColorTop; uniform float uDrawDistance;
      varying vec2 vGrassUv; varying float vGrassHeight; varying float vGrassDist;
      varying vec3 vWorldPos; varying float vColorVar; varying vec3 vGrassNormal;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vGrassUv = uv; vGrassHeight = uv.y;
      #ifdef USE_INSTANCING
        vec3 instancePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        vWorldPos = instancePos;
        float colorVar = fract(sin(dot(instancePos.xz, vec2(12.9898,78.233))) * 43758.5453);
        vColorVar = colorVar;
        float wind = sin(uTime * 0.8 + instancePos.x * 0.1 + instancePos.z * 0.1);
        vec2 toPlayer = instancePos.xz - uPlayerPos.xz;
        float distToPlayer = length(toPlayer);
        float interactionRadius = 2.0;
        float pushStrength = max(0.0, 1.0 - distToPlayer / interactionRadius);
        vec2 pushDir = (distToPlayer > 0.001) ? toPlayer / distToPlayer : vec2(0.0);
        float heightFactor = pow(uv.y, 2.5);
        transformed.x += wind * 0.15 * heightFactor * uWindStrength;
        transformed.z += wind * 0.1 * heightFactor * uWindStrength;
        float bend = pushStrength * heightFactor;
        vec3 bendDir = normalize(vec3(pushDir.x, 0.0, pushDir.y));
        transformed.xyz += bendDir * bend * 0.3;
        transformed.y -= bend * 0.2;
        transformed.x += (sin(instancePos.x) * 0.1) * uv.y;
        transformed.z += (cos(instancePos.z) * 0.1) * uv.y;
        vec3 grassNormal = vec3(0.0, 1.0, 0.0);
        grassNormal.x += sin(instancePos.x) * 0.1;
        grassNormal.z += cos(instancePos.z) * 0.1;
        vGrassNormal = normalize(normalMatrix * grassNormal);
        float dist = distance(instancePos, uPlayerPos);
        float lodFactor = smoothstep(20.0, 80.0, dist);
        transformed *= (1.0 - lodFactor * 0.7);
        vGrassDist = dist;
      #endif
    `);

    shader.fragmentShader = `
      uniform vec3 uColorBottom; uniform vec3 uColorTop; uniform float uDrawDistance;
      varying vec2 vGrassUv; varying float vGrassHeight; varying float vGrassDist;
      varying vec3 vWorldPos; varying float vColorVar; varying vec3 vGrassNormal;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 grassColor = mix(uColorBottom, uColorTop, vGrassHeight);
      grassColor *= 0.8 + vColorVar * 0.4;
      float light = dot(normalize(vGrassNormal), normalize(vec3(0.3, 1.0, 0.2)));
      grassColor *= 0.6 + light * 0.4;
      diffuseColor.rgb = grassColor;
    `);

    shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `
      #include <output_fragment>
      vec2 screenPos = gl_FragCoord.xy;
      float dither = fract(sin(dot(screenPos, vec2(12.9898, 78.233))) * 43758.5453);
      float fadeStart = uDrawDistance * 0.7;
      float fadeEnd = uDrawDistance;
      float alphaFade = 1.0 - smoothstep(fadeStart, fadeEnd, vGrassDist);
      alphaFade *= smoothstep(0.0, 0.2, vGrassHeight);
      if (alphaFade < dither) discard;
    `);

    mat.userData.shader = shader;
  };
  return mat;
}