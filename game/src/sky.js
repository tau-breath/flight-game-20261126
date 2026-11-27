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

function makeStreakTexture() {
  return canvasTexture(512, (context, size) => {
    const gradient = context.createLinearGradient(0, 0, size, 0);
    gradient.addColorStop(0, 'rgba(255,230,168,0)');
    gradient.addColorStop(0.12, 'rgba(255,225,158,0.035)');
    gradient.addColorStop(0.34, 'rgba(255,229,172,0.20)');
    gradient.addColorStop(0.5, 'rgba(255,246,214,0.92)');
    gradient.addColorStop(0.66, 'rgba(255,229,172,0.20)');
    gradient.addColorStop(0.88, 'rgba(255,225,158,0.035)');
    gradient.addColorStop(1, 'rgba(255,230,168,0)');
    context.fillStyle = gradient;
    context.fillRect(0, size * 0.44, size, size * 0.12);
  });
}


function makeCloudTexture(random) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  const puffCount = 30 + Math.floor(random() * 16);
  for (let index = 0; index < puffCount; index += 1) {
    const radius = 10 + random() * 45;
    let x;
    let y;
    do {
      x = radius + random() * (256 - radius * 2);
      y = radius + random() * (160 - radius * 2);
    } while (((x - 128) / 108) ** 2 + ((y - 80) / 44) ** 2 > 1);
    const alpha = 0.10 + random() * 0.12;
    const gradient = context.createRadialGradient(
      x - radius * 0.18, y - radius * 0.24, radius * 0.05,
      x, y, radius,
    );
    gradient.addColorStop(0, `rgba(255,247,230,${alpha})`);
    gradient.addColorStop(0.52, `rgba(255,247,230,${alpha * 0.68})`);
    gradient.addColorStop(1, 'rgba(255,247,230,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  for (let index = 0; index < 12; index += 1) {
    const x = 55 + random() * 146;
    const y = 107 + random() * 19;
    const radius = 12 + random() * 22;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(201,183,156,0.10)');
    gradient.addColorStop(0.5, 'rgba(201,183,156,0.06)');
    gradient.addColorStop(1, 'rgba(201,183,156,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  const edgeCount = 8 + Math.floor(random() * 5);
  context.globalCompositeOperation = 'destination-out';
  context.strokeStyle = '#000';
  for (let index = 0; index < edgeCount; index += 1) {
    const angle = random() * Math.PI * 2;
    const x = 128 + Math.cos(angle) * (108 + random() * 6);
    const y = 80 + Math.sin(angle) * (44 + random() * 4);
    const start = random() * Math.PI * 2;
    context.globalAlpha = 0.5 + random() * 0.5;
    context.lineWidth = 2 + random() * 3;
    context.beginPath();
    context.arc(x, y, 4 + random() * 6, start, start + 0.4 + random() * 0.8);
    context.stroke();
  }
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCirrusTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const strands = [
    [55, 82, 180, 0.26], [26, 94, 148, 0.30], [170, 65, 190, 0.25],
    [292, 78, 188, 0.24], [108, 48, 224, 0.20], [218, 94, 262, 0.28],
    [24, 42, 112, 0.23], [376, 52, 126, 0.22], [334, 104, 146, 0.26],
  ];
  for (const [x, y, width, alpha] of strands) {
    const gradient = context.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, 'rgba(255,248,232,0)');
    gradient.addColorStop(0.24, `rgba(255,248,232,${alpha})`);
    gradient.addColorStop(0.52, `rgba(255,253,242,${alpha * 1.25})`);
    gradient.addColorStop(0.78, `rgba(255,248,232,${alpha * 0.7})`);
    gradient.addColorStop(1, 'rgba(255,248,232,0)');
    context.strokeStyle = gradient;
    context.lineWidth = 12;
    context.lineCap = 'round';
    context.filter = 'blur(0.8px)';
    context.beginPath();
    context.moveTo(x, y + 6);
    context.bezierCurveTo(x + width * 0.3, y - 14, x + width * 0.7, y + 14, x + width, y - 8);
    context.stroke();
  }
  context.filter = 'none';
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
      uZenith: { value: new THREE.Color('#255F9E') },
      uMid: { value: new THREE.Color(PALETTE.skyMid) },
      uPeach: { value: new THREE.Color('#EFC79C') },
      uHorizon: { value: new THREE.Color('#F7D9AE') },
      uHaze: { value: new THREE.Color('#EFDCC0') },
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
      uniform vec3 uPeach;
      uniform vec3 uHorizon;
      uniform vec3 uHaze;
      varying vec3 vDirection;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      void main() {
        float height = clamp(vDirection.y, 0.0, 1.0);
        vec3 colour = mix(uHorizon, uPeach, smoothstep(0.0, 0.055, height));
        colour = mix(colour, uMid, smoothstep(0.055, 0.27, height));
        colour = mix(colour, uZenith, smoothstep(0.30, 0.96, height));
        float haze = 1.0 - smoothstep(0.0, 0.06, height);
        colour = mix(colour, uHaze, haze * 0.52);
        colour += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
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

function createIslands(scene, random) {
  const islands = new THREE.Group();
  islands.name = 'Distant island chain';
  const material = new THREE.MeshLambertMaterial({
    color: '#D9D2C0', fog: true, flatShading: true,
  });
  const count = 7;
  for (let index = 0; index < count; index += 1) {
    const distance = 7600 + random() * 1000;
    const angle = THREE.MathUtils.degToRad(270 + index * (90 / (count - 1)) + random() * 4);
    const height = 180 + random() * 200;
    const width = 180 + random() * 150;
    const geometry = new THREE.ConeGeometry(width, height, 7, 2);
    const positions = geometry.attributes.position;
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const y = positions.getY(vertex);
      if (y < height * 0.45) positions.setX(vertex, positions.getX(vertex) * 1.55);
    }
    geometry.computeVertexNormals();
    const island = new THREE.Mesh(geometry, material);
    island.position.set(
      Math.sin(angle) * distance,
      height * 0.36 - 10,
      -Math.cos(angle) * distance,
    );
    island.rotation.y = random() * Math.PI;
    island.scale.z = 0.35 + random() * 0.35;
    islands.add(island);
  }
  scene.add(islands);
  return islands;
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

  const streak = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeStreakTexture(), color: '#FFE6B4', transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  streak.name = 'Anamorphic sun streak';
  streak.position.copy(sunDirection).multiplyScalar(8000);
  streak.scale.set(6400, 150, 1);
  scene.add(streak);

  const random = createRandom(seed ^ 0x5f3759df);
  const cloudMap = makeCloudTexture(random);
  const clouds = [];
  for (let index = 0; index < 30; index += 1) {
    const material = new THREE.SpriteMaterial({
      map: cloudMap,
      color: index % 5 < 2 ? '#FFF6E4' : '#FFFFFF',
      transparent: true,
      opacity: 0.62 + (index % 5) * 0.06,
      depthWrite: false,
      fog: true,
    });
    const cloud = new THREE.Sprite(material);
    const angle = index * 2.399963;
    const radius = 2200 + ((index * 631) % 4300);
    cloud.position.set(
      2400 + Math.cos(angle) * radius,
      950 + ((index * 419) % 1150),
      300 + Math.sin(angle) * radius,
    );
    const width = 750 + ((index * 271) % 850);
    cloud.scale.set(width, width * 0.52, 1);
    cloud.name = `Cloud ${index + 1}`;
    scene.add(cloud);
    clouds.push(cloud);
  }

  const cirrusMap = makeCirrusTexture();
  const cirrus = [];
  for (let index = 0; index < 10; index += 1) {
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cirrusMap, color: '#FFF9EC', transparent: true,
      opacity: 0.22 + random() * 0.12, depthWrite: false, fog: true,
    }));
    const angle = random() * Math.PI * 2;
    const distance = 4000 + random() * 2000;
    cloud.position.set(
      Math.sin(angle) * distance,
      2600 + random() * 800,
      -Math.cos(angle) * distance,
    );
    cloud.scale.set(2000 + random() * 2000, 300 + random() * 300, 1);
    scene.add(cloud);
    cirrus.push(cloud);
  }

  const islands = createIslands(scene, random);
  const skyDirection = new THREE.Vector3();
  return {
    dome,
    sun,
    sunDirection,
    clouds,
    update(dt) {
      for (let index = 0; index < clouds.length; index += 1) {
        const cloud = clouds[index];
        cloud.position.x += SKY.cloudDrift * dt * (0.7 + (index % 4) * 0.12);
        if (cloud.position.x > 8000) cloud.position.x = -8000;
      }
      for (let index = 0; index < cirrus.length; index += 1) {
        const cloud = cirrus[index];
        cloud.position.x += 0.32 * dt * (0.7 + (index % 3) * 0.15);
        const limit = Math.sqrt(Math.max(0, 6000 ** 2 - cloud.position.z ** 2));
        if (cloud.position.x > limit) cloud.position.x = -limit;
      }
      const camera = scene.children.find((child) => child.isCamera);
      if (!camera) return;
      skyDirection.copy(sunDirection).multiplyScalar(8000).add(camera.position);
      streak.position.copy(skyDirection);
      sun.position.copy(skyDirection);
      glow.position.copy(skyDirection);
    },
  };
}
