// src/features/game/world/locations/main-world/utils/radialFog.ts
import * as THREE from "three";

export interface RadialFogUniforms {
    uRadialFogRange: { value: THREE.Vector2 };
    uRadialFogStrength: { value: number };
}

const VERTEX_INJECTION = /* glsl */`
    #include <project_vertex>

    vec4 radialFogLocal = vec4(transformed, 1.0);

    #ifdef USE_BATCHING
        radialFogLocal = batchingMatrix * radialFogLocal;
    #endif

    #ifdef USE_INSTANCING
        radialFogLocal = instanceMatrix * radialFogLocal;
    #endif

    vRadialFogPos = (modelMatrix * radialFogLocal).xz;
`;

const FRAGMENT_INJECTION = /* glsl */`
    #include <fog_fragment>

    #ifdef USE_FOG
        float radialFog = smoothstep(uRadialFogRange.x, uRadialFogRange.y, length(vRadialFogPos)) * uRadialFogStrength;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, radialFog);
    #endif
`;

export function applyRadialFog(material: THREE.Material, uniforms: RadialFogUniforms) {
    const previous = material.onBeforeCompile;
    const baseKey = previous ? previous.toString() : "";

    material.onBeforeCompile = function (this: THREE.Material, shader, renderer) {
        previous?.call(this, shader, renderer);

        shader.uniforms.uRadialFogRange = uniforms.uRadialFogRange;
        shader.uniforms.uRadialFogStrength = uniforms.uRadialFogStrength;

        shader.vertexShader = "varying vec2 vRadialFogPos;\n" +
            shader.vertexShader.replace("#include <project_vertex>", VERTEX_INJECTION);

        shader.fragmentShader = `
            uniform vec2 uRadialFogRange;
            uniform float uRadialFogStrength;
            varying vec2 vRadialFogPos;
        ` + shader.fragmentShader.replace("#include <fog_fragment>", FRAGMENT_INJECTION);
    };

    material.customProgramCacheKey = () => `radialFog|${baseKey}`;
    material.needsUpdate = true;
}

export function applyRadialFogAll(target: THREE.Object3D, uniforms: RadialFogUniforms) {
    const seen = new Set<THREE.Material>();

    target.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;

        const material = mesh.material;
        const list = Array.isArray(material) ? material : [material];

        for (const entry of list) {
            if (!entry || seen.has(entry)) continue;
            seen.add(entry);
            if ((entry as THREE.ShaderMaterial).isShaderMaterial) continue;
            applyRadialFog(entry, uniforms);
        }
    });
}
