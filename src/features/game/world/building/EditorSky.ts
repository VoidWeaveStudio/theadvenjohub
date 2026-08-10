// src/features/game/world/building/EditorSky.ts
import * as THREE from "three";

const vertexShader = /* glsl */`
    uniform vec3 sunPosition;
    uniform float rayleigh;
    uniform float turbidity;
    uniform float mieCoefficient;
    uniform vec3 up;

    varying vec3 vWorldPosition;
    varying vec3 vSunDirection;
    varying float vSunfade;
    varying vec3 vBetaR;
    varying vec3 vBetaM;
    varying float vSunE;

    const float e = 2.71828182845904523536028747135266249775724709369995957;
    const float pi = 3.141592653589793238462643383279502884197169;

    const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );
    const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

    const float cutoffAngle = 1.6110731556870734;
    const float steepness = 1.5;
    const float EE = 1000.0;

    float sunIntensity( float zenithAngleCos ) {
        zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
        return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
    }

    vec3 totalMie( float T ) {
        float c = ( 0.2 * T ) * 10E-18;
        return 0.434 * c * MieConst;
    }

    void main() {
        vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
        vWorldPosition = worldPosition.xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        gl_Position.z = gl_Position.w;

        vSunDirection = normalize( sunPosition );
        vSunE = sunIntensity( dot( vSunDirection, up ) );
        vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );

        float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );
        vBetaR = totalRayleigh * rayleighCoefficient;
        vBetaM = totalMie( turbidity ) * mieCoefficient;
    }
`;

const fragmentShader = /* glsl */`
    varying vec3 vWorldPosition;
    varying vec3 vSunDirection;
    varying vec3 vBetaR;
    varying vec3 vBetaM;
    varying float vSunE;

    uniform float mieDirectionalG;
    uniform vec3 up;
    uniform float cloudScale;
    uniform float cloudSpeed;
    uniform float cloudCoverage;
    uniform float cloudDensity;
    uniform float cloudElevation;
    uniform float showSunDisc;
    uniform float time;
    uniform float auroraStrength;
    uniform vec3 auroraColor;
    uniform vec3 spaceTint;
    uniform float spaceAmount;

    const float pi = 3.141592653589793238462643383279502884197169;
    const float rayleighZenithLength = 8.4E3;
    const float mieZenithLength = 1.25E3;
    const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;
    const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
    const float ONE_OVER_FOURPI = 0.07957747154594767;

    float hash( vec2 p ) {
        return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
    }

    float noise( vec2 p ) {
        vec2 i = floor( p );
        vec2 f = fract( p );
        f = f * f * ( 3.0 - 2.0 * f );
        float a = hash( i );
        float b = hash( i + vec2( 1.0, 0.0 ) );
        float c = hash( i + vec2( 0.0, 1.0 ) );
        float d = hash( i + vec2( 1.0, 1.0 ) );
        return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
    }

    float fbm( vec2 p ) {
        float value = 0.0;
        float amplitude = 0.5;
        for ( int i = 0; i < 5; i ++ ) {
            value += amplitude * noise( p );
            p *= 2.02;
            amplitude *= 0.5;
        }
        return value;
    }

    float rayleighPhase( float cosTheta ) {
        return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
    }

    float hgPhase( float cosTheta, float g ) {
        float g2 = pow( g, 2.0 );
        float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
        return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
    }

    void main() {
        vec3 direction = normalize( vWorldPosition - cameraPosition );

        float zenithAngle = acos( max( 0.0, dot( up, direction ) ) );
        float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
        float sR = rayleighZenithLength * inverse;
        float sM = mieZenithLength * inverse;

        vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );

        float cosTheta = dot( direction, vSunDirection );

        float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
        vec3 betaRTheta = vBetaR * rPhase;

        float mPhase = hgPhase( cosTheta, mieDirectionalG );
        vec3 betaMTheta = vBetaM * mPhase;

        vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
        Lin *= mix(
            vec3( 1.0 ),
            pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ),
            clamp( pow( 1.0 - dot( up, vSunDirection ), 5.0 ), 0.0, 1.0 )
        );

        vec3 L0 = vec3( 0.1 ) * Fex;

        float sundisc = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta ) * showSunDisc;
        L0 += ( vSunE * 19000.0 * Fex ) * sundisc;

        vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

        if ( spaceAmount > 0.001 ) {
            vec2 spaceUv = vec2( atan( direction.z, direction.x ), asin( clamp( direction.y, -1.0, 1.0 ) ) );
            float cloudsFar = fbm( spaceUv * 2.6 + 11.0 );
            float cloudsNear = fbm( spaceUv * 6.1 - 4.0 );
            float nebula = smoothstep( 0.45, 0.95, cloudsFar * 0.7 + cloudsNear * 0.4 );
            texColor = mix( texColor, spaceTint * ( 0.35 + nebula * 1.6 ), spaceAmount );
        }

        if ( auroraStrength > 0.001 && direction.y > 0.0 ) {
            vec2 auroraUv = direction.xz / max( direction.y, 0.08 );
            float band = fbm( auroraUv * 0.55 + vec2( time * 0.02, time * 0.008 ) );
            float curtain = smoothstep( 0.42, 0.85, band ) * smoothstep( 0.0, 0.35, direction.y );
            float stripes = 0.55 + 0.45 * sin( auroraUv.x * 3.1 + band * 6.0 + time * 0.35 );
            texColor += auroraColor * curtain * stripes * auroraStrength;
        }

        if ( direction.y > 0.0 && cloudCoverage > 0.0 ) {
            float elevation = mix( 1.0, 0.1, cloudElevation );
            vec2 cloudUV = direction.xz / ( direction.y * elevation );
            cloudUV *= cloudScale;
            cloudUV += time * cloudSpeed;

            float cloudNoise = fbm( cloudUV * 1000.0 );
            cloudNoise += 0.5 * fbm( cloudUV * 2000.0 + 3.7 );
            cloudNoise = cloudNoise * 0.5 + 0.5;

            float cloudMask = smoothstep( 1.0 - cloudCoverage, 1.0 - cloudCoverage + 0.28, cloudNoise );
            float horizonFade = smoothstep( 0.0, 0.1 + 0.2 * cloudElevation, direction.y );
            cloudMask *= horizonFade;

            float shade = smoothstep( 0.35, 0.95, fbm( cloudUV * 1400.0 + 17.0 ) );
            float sunInfluence = dot( direction, vSunDirection ) * 0.5 + 0.5;
            float daylight = max( 0.0, vSunDirection.y * 2.0 );

            vec3 atmosphereColor = Lin * 0.04;
            vec3 cloudColor = mix( vec3( 0.26 ), vec3( 1.0 ), daylight );
            cloudColor = mix( cloudColor, atmosphereColor + vec3( 1.0 ), sunInfluence * 0.5 );
            cloudColor *= mix( 0.72, 1.0, shade );
            cloudColor *= vSunE * 0.00002;

            texColor = mix( texColor, cloudColor, cloudMask * cloudDensity );
        }

        gl_FragColor = vec4( texColor, 1.0 );

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

export class EditorSky extends THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial> {
    constructor() {
        const material = new THREE.ShaderMaterial({
            name: "EditorSkyShader",
            uniforms: {
                turbidity: { value: 2 },
                rayleigh: { value: 1 },
                mieCoefficient: { value: 0.005 },
                mieDirectionalG: { value: 0.8 },
                sunPosition: { value: new THREE.Vector3() },
                up: { value: new THREE.Vector3(0, 1, 0) },
                cloudScale: { value: 0.0002 },
                cloudSpeed: { value: 0.0001 },
                cloudCoverage: { value: 0.4 },
                cloudDensity: { value: 0.4 },
                cloudElevation: { value: 0.5 },
                showSunDisc: { value: 1 },
                time: { value: 0 },
                auroraStrength: { value: 0 },
                auroraColor: { value: new THREE.Color(0x4dffc3) },
                spaceTint: { value: new THREE.Color(0x3b2a6b) },
                spaceAmount: { value: 0 },
            },
            vertexShader,
            fragmentShader,
            side: THREE.BackSide,
            depthWrite: false,
        });

        super(new THREE.BoxGeometry(1, 1, 1), material);
    }
}
