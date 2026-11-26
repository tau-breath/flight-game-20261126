// Painted-poster sky: a gradient dome, warm sun and glow, and canvas-generated cloud billboards.
import * as THREE from 'three';
import { PALETTE, SKY } from './config.js';
import { createRandom } from './mathutil.js';

function canvasTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  paint(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSunTexture() {
  return canvasTexture(128, (context, size) => {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, '#fffdf1');
    gradient.addColorStop(0.68, PALETTE.sun);
    gradient.addColorStop(0.88, '#ffe6ab');
    gradient.addColorStop(1, 'rgba(255,230,171,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });
}

function makeGlowTexture() {
  return canvasTexture(256, (context, size) => {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,244,207,0.72)');
    gradient.addColorStop(0.2, 'rgba(255,228,160,0.34)');
    gradient.addColorStop(0.55, 'rgba(255,211,132,0.10)');
    gradient.addColorStop(1, 'rgba(255,205,120,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });
}

function makeCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const puffs = [
    [48, 79, 37], [86, 55, 45], [127, 66, 52], [170, 52, 42], [206, 78, 34],
  ];
  for (const [x, y, radius] of puffs) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(255,250,235,0.92)');
    gradient.addColorStop(0.48, 'rgba(250,242,225,0.68)');
    gradient.addColorStop(1, 'rgba(240,232,216,0)');
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createDome(scene) {
  const geometry = new THREE.SphereGeometry(SKY.radius, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color(PALETTE.skyZenith) },
      uMid: { value: new THREE.Color(PALETTE.skyMid) },
      uHorizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      varying vec3 vDirection;
      void main() {
        float height = clamp(vDirection.y, 0.0, 1.0);
        vec3 colour = mix(uHorizon, uMid, smoothstep(0.0, 0.32, height));
        colour = mix(colour, uZenith, smoothstep(0.25, 0.92, height));
        gl_FragColor = vec4(colour, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const dome = new THREE.Mesh(geometry, material);
  dome.name = 'Poster sky';
  dome.renderOrder = -20;
  scene.add(dome);
  return dome;
}

export function createSky(scene, seed = 1729) {
  scene.fog = new THREE.Fog(PALETTE.fog, SKY.fogNear, SKY.fogFar);
  const dome = createDome(scene);
  const azimuth = SKY.sunAzimuth;
  const elevation = SKY.sunElevation;
  const sunDirection = new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
  ).normalize();

  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSunTexture(), color: 0xffffff, transparent: true, depthWrite: false, fog: false,
  }));
  sun.name = 'Sun disc';
  sun.position.copy(sunDirection).multiplyScalar(8200);
  sun.scale.set(SKY.sunDiscSize, SKY.sunDiscSize, 1);
  scene.add(sun);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: PALETTE.sun, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  glow.name = 'Sun glow';
  glow.position.copy(sunDirection).multiplyScalar(8100);
  glow.scale.set(SKY.glowSize, SKY.glowSize, 1);
  scene.add(glow);

  const random = createRandom(seed ^ 0x5f3759df);
  const cloudMap = makeCloudTexture();
  const clouds = [];
  for (let index = 0; index < SKY.cloudCount; index += 1) {
    const material = new THREE.SpriteMaterial({
      map: cloudMap, color: index % 3 === 0 ? '#ffe8c6' : '#fff8e9',
      transparent: true, opacity: 0.62 + random() * 0.2, depthWrite: false, fog: true,
    });
    const cloud = new THREE.Sprite(material);
    const scale = SKY.cloudMinScale + random() * (SKY.cloudMaxScale - SKY.cloudMinScale);
    cloud.scale.set(scale, scale * 0.5, 1);
    cloud.position.set(
      (random() - 0.5) * 10500,
      SKY.cloudMinHeight + random() * (SKY.cloudMaxHeight - SKY.cloudMinHeight),
      (random() - 0.5) * 10500,
    );
    cloud.name = `Cloud ${index + 1}`;
    scene.add(cloud);
    clouds.push(cloud);
  }

  return {
    dome,
    sun,
    sunDirection,
    clouds,
    update(dt) {
      for (let index = 0; index < clouds.length; index += 1) {
        const cloud = clouds[index];
        cloud.position.x += SKY.cloudDrift * dt * (0.7 + (index % 4) * 0.12);
        if (cloud.position.x > 6200) cloud.position.x = -6200;
      }
    },
  };
}
