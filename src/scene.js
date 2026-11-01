import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Mesh,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

const PALETTE = {
  bg: "#05030c",
  red: "#ff2d55",
  purple: "#b44dff",
  blue: "#4a72ff",
  cyan: "#00e5ff",
  orange: "#ff9b26",
};

const NOISE = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
      mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      s += a * vnoise(p);
      p = p * 2.03 + 17.1;
      a *= 0.5;
    }
    return s;
  }
`;

const color = (hex) => new Color(hex);

function createSky(fog) {
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uTop: { value: color("#020107") },
      uMid: { value: color("#0b0524") },
      uHorizon: { value: color("#2a0b45") },
      uGlow: { value: color("#7d1a63") },
      uFog: { value: fog },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform vec3 uFog;
      varying vec3 vDir;
      ${NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.2, h));
        col = mix(col, uTop, smoothstep(0.16, 0.7, h));
        col += uGlow * exp(-abs(h) * 16.0) * 0.9;
        col = mix(col, uFog, smoothstep(0.01, -0.01, h));

        vec2 sp = vec2(atan(d.x, -d.z), h) * 90.0;
        vec2 id = floor(sp);
        float r = hash12(id);
        float star = step(0.985, r) * smoothstep(0.16, 0.0, length(fract(sp) - 0.5));
        star *= smoothstep(0.08, 0.35, h) * (0.5 + 0.5 * sin(uTime * (0.8 + r * 3.0) + r * 60.0));
        col += vec3(0.7, 0.8, 1.0) * star;

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new Mesh(new SphereGeometry(600, 32, 16), material);
  mesh.renderOrder = -2;
  return mesh;
}

function createSun() {
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uTopCol: { value: color(PALETTE.orange) },
      uBottomCol: { value: color("#ff1f6d") },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uTopCol;
      uniform vec3 uBottomCol;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float d = length(p);
        float r = 0.24;
        float y = p.y / r;
        float disc = 1.0 - smoothstep(r - 0.002, r + 0.002, d);
        float bands = fract(y * 5.0 + uTime * 0.12);
        float gap = clamp((0.3 - y) * 0.3, 0.0, 0.62);
        disc *= step(gap, bands);
        vec3 col = mix(uBottomCol, uTopCol, smoothstep(-0.9, 0.8, y));
        float glow = exp(-max(d - r, 0.0) * 11.0) * 0.55 + exp(-d * 5.0) * 0.22;
        glow *= 1.0 - smoothstep(0.32, 0.5, d);
        vec3 c = col * disc * 1.1 + mix(uBottomCol, uTopCol, 0.55) * glow * (1.0 - disc);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.scale.setScalar(300);
  mesh.position.set(0, 26, -470);
  mesh.renderOrder = -1;
  return mesh;
}

function createTerrain(fog, small) {
  const geometry = new PlaneGeometry(340, 220, small ? 110 : 170, small ? 72 : 110);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -95);

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOffset: { value: 0 },
      uBase: { value: color("#070418") },
      uNear: { value: color(PALETTE.cyan) },
      uFar: { value: color(PALETTE.purple) },
      uPeak: { value: color(PALETTE.red) },
      uAccent: { value: color(PALETTE.cyan) },
      uAccentMix: { value: 0 },
      uFog: { value: fog },
    },
    vertexShader: /* glsl */ `
      uniform float uOffset;
      varying vec3 vWorld;
      varying vec2 vGrid;
      varying float vHeight;
      ${NOISE}
      float terrain(vec2 p) {
        float side = smoothstep(9.0, 46.0, abs(p.x));
        float n = fbm(p * 0.028);
        float ridge = 1.0 - abs(vnoise(p * 0.017 + 4.0) * 2.0 - 1.0);
        return (pow(n, 1.6) * 34.0 + ridge * ridge * 12.0) * side;
      }
      void main() {
        vec3 pos = position;
        vec2 g = vec2(pos.x, pos.z - uOffset);
        float h = terrain(g);
        pos.y += h;
        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorld = world.xyz;
        vGrid = g;
        vHeight = h;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uBase;
      uniform vec3 uNear;
      uniform vec3 uFar;
      uniform vec3 uPeak;
      uniform vec3 uAccent;
      uniform float uAccentMix;
      uniform vec3 uFog;
      varying vec3 vWorld;
      varying vec2 vGrid;
      varying float vHeight;
      void main() {
        vec2 coord = vGrid / 3.0;
        vec2 fw = max(fwidth(coord), vec2(1e-4));
        vec2 g = abs(fract(coord - 0.5) - 0.5) / fw;
        float d = min(g.x, g.y);
        float line = 1.0 - smoothstep(0.0, 1.3, d);
        float glow = exp(-d * 0.3) * 0.32;
        float aa = 1.0 - smoothstep(0.3, 1.0, max(fw.x, fw.y));

        float dist = length(vWorld.xz - cameraPosition.xz);
        vec3 lineCol = mix(uNear, uFar, smoothstep(6.0, 130.0, dist));
        lineCol = mix(lineCol, uPeak, smoothstep(3.0, 30.0, vHeight) * 0.8);
        lineCol = mix(lineCol, uAccent, uAccentMix);

        float pulse = smoothstep(0.94, 1.0, fract(vGrid.y * 0.011 + uTime * 0.2));
        float intensity = (line * 1.5 + glow) * aa * (1.0 + pulse * 1.8);

        vec3 col = uBase * (1.0 + vHeight * 0.03) + lineCol * intensity;
        col = mix(col, uFog, smoothstep(60.0, 175.0, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  return new Mesh(geometry, material);
}

function createCity(fog, small) {
  const count = small ? 80 : 150;
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);

  const neon = [PALETTE.cyan, PALETTE.purple, PALETTE.red, PALETTE.blue, PALETTE.cyan].map(color);
  const seeds = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const dummy = new Object3D();

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBuilding: { value: color("#0a0620") },
      uWarm: { value: color(PALETTE.orange) },
      uFog: { value: fog },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute vec3 aColor;
      varying vec3 vLocal;
      varying vec3 vScale;
      varying vec3 vN;
      varying float vSeed;
      varying vec3 vColor;
      varying vec3 vWorld;
      void main() {
        vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vLocal = position;
        vN = normal;
        vSeed = aSeed;
        vColor = aColor;
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uBuilding;
      uniform vec3 uWarm;
      uniform vec3 uFog;
      varying vec3 vLocal;
      varying vec3 vScale;
      varying vec3 vN;
      varying float vSeed;
      varying vec3 vColor;
      varying vec3 vWorld;
      ${NOISE}
      void main() {
        float side = step(abs(vN.y), 0.5);
        vec2 face = abs(vN.z) > 0.5
          ? vec2(vLocal.x * vScale.x, vLocal.y * vScale.y)
          : vec2(vLocal.z * vScale.z, vLocal.y * vScale.y);
        vec2 q = face / vec2(1.5, 2.1);
        vec2 f = fract(q);
        float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.75);
        float r = hash12(floor(q) + vSeed * 91.7);
        float lit = step(0.79, r) * win * side;
        lit *= 1.0 - smoothstep(0.5, 1.2, max(fwidth(q.x), fwidth(q.y)));
        float flick = 0.65 + 0.35 * sin(uTime * (0.4 + r * 2.0) + r * 80.0);
        vec3 wc = mix(vColor, uWarm, step(0.6, fract(r * 17.0)));

        vec3 col = uBuilding * (0.45 + 0.55 * vLocal.y);
        col += wc * lit * flick;

        float roof = smoothstep(vScale.y - 0.7, vScale.y, vLocal.y * vScale.y) * side;
        col += vColor * roof * 1.6;

        float stripe = step(0.82, fract(vSeed * 13.7)) * (1.0 - smoothstep(0.15, 0.45, abs(face.x))) * side;
        col += vColor * stripe * (0.7 + 0.3 * sin(uTime * 3.0 + vSeed * 20.0));

        float haze = 1.0 - smoothstep(0.0, 26.0, vWorld.y);
        col = mix(col, uFog, haze * 0.85 + 0.12);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new InstancedMesh(geometry, material, count);
  for (let i = 0; i < count; i++) {
    const back = i % 2 === 0;
    const x = MathUtils.randFloatSpread(620);
    const z = back ? MathUtils.randFloat(-290, -255) : MathUtils.randFloat(-245, -205);
    const centre = 0.3 + 0.7 * MathUtils.smoothstep(Math.abs(x), 8, 95);
    const h = (back ? MathUtils.randFloat(34, 105) : MathUtils.randFloat(14, 60)) * centre;
    dummy.position.set(x, 0, z);
    dummy.scale.set(MathUtils.randFloat(7, 19), h, MathUtils.randFloat(7, 16));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    seeds[i] = Math.random();
    neon[i % neon.length].toArray(colors, i * 3);
  }
  geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
  geometry.setAttribute("aColor", new InstancedBufferAttribute(colors, 3));
  mesh.frustumCulled = false;
  return mesh;
}

function createRain(small, pixelRatio) {
  const count = small ? 380 : 900;
  const fieldH = 46;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const kinds = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const rainColors = [PALETTE.cyan, PALETTE.cyan, PALETTE.blue, PALETTE.purple, PALETTE.red].map(color);
  const emberColors = [PALETTE.orange, PALETTE.red].map(color);

  for (let i = 0; i < count; i++) {
    const ember = Math.random() < 0.16;
    positions[i * 3] = MathUtils.randFloatSpread(150);
    positions[i * 3 + 1] = Math.random() * fieldH;
    positions[i * 3 + 2] = MathUtils.randFloat(-150, 8);
    speeds[i] = MathUtils.randFloat(12, 30);
    sizes[i] = ember ? MathUtils.randFloat(1.8, 3.6) : MathUtils.randFloat(6, 13);
    kinds[i] = ember ? 1 : 0;
    const palette = ember ? emberColors : rainColors;
    palette[i % palette.length].toArray(colors, i * 3);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSpeed", new BufferAttribute(speeds, 1));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("aKind", new BufferAttribute(kinds, 1));
  geometry.setAttribute("aColor", new BufferAttribute(colors, 3));

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uFieldH: { value: fieldH },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uFieldH;
      attribute float aSpeed;
      attribute float aSize;
      attribute float aKind;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vKind;
      varying float vSize;
      void main() {
        vec3 p = position;
        if (aKind < 0.5) {
          p.y = mod(p.y - uTime * aSpeed, uFieldH) - 2.0;
        } else {
          p.y = mod(p.y + uTime * aSpeed * 0.1, uFieldH) - 2.0;
          p.x += sin(uTime * 0.7 + p.z) * 1.6;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float depth = -mv.z;
        vSize = clamp(aSize * uPixelRatio * (90.0 / max(depth, 1.0)), 1.0, 128.0);
        gl_PointSize = vSize;
        vColor = aColor;
        vKind = aKind;
        vAlpha = smoothstep(150.0, 25.0, depth) * smoothstep(1.0, 5.0, depth)
          * smoothstep(-2.0, 1.0, p.y) * (1.0 - smoothstep(uFieldH - 8.0, uFieldH - 2.0, p.y));
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vKind;
      varying float vSize;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a;
        if (vKind < 0.5) {
          float core = 1.0 - smoothstep(0.0, 1.2 / vSize, abs(c.x));
          float tail = smoothstep(-0.5, 0.45, c.y) * (1.0 - smoothstep(0.44, 0.5, c.y));
          a = core * tail * 0.55;
        } else {
          a = smoothstep(0.5, 0.0, length(c));
          a *= a;
        }
        a *= vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * a, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

/**
 * Mounts the WebGL background. Returns a small control API, or null if WebGL is unavailable.
 */
export function initScene({ motion = true } = {}) {
  const canvas = document.createElement("canvas");
  canvas.id = "bg-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (error) {
    canvas.remove();
    console.warn("WebGL unavailable; keeping the CSS background.", error);
    return null;
  }

  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const maxRatio = small ? 1.5 : 1.75;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, maxRatio);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(PALETTE.bg, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(62, 1, 0.1, 1400);
  camera.position.set(0, 3.2, 12);

  const fog = color("#2a0b45").add(color("#7d1a63").multiplyScalar(0.9));
  const sky = createSky(fog);
  const sun = createSun();
  const terrain = createTerrain(fog, small);
  const city = createCity(fog, small);
  const rain = createRain(small, pixelRatio);
  scene.add(sky, sun, city, terrain, rain);

  const animated = [sky, sun, terrain, city, rain].map((o) => o.material.uniforms);
  const terrainU = terrain.material.uniforms;
  const lookTarget = new Vector3();
  const accentTarget = color(PALETTE.cyan);
  let accentMixTarget = 0;

  const pointer = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0, scroll: 0, boost: 0 };
  let offset = 0;
  let lastScroll = window.scrollY;
  let elapsed = 0;

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 72 : 62;
    camera.updateProjectionMatrix();
  };

  const update = (dt) => {
    elapsed += dt;
    const scrollY = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const velocity = Math.abs(scrollY - lastScroll) / Math.max(dt, 1 / 120);
    lastScroll = scrollY;

    const k = 1 - Math.exp(-dt * 3);
    smooth.x += (pointer.x - smooth.x) * k;
    smooth.y += (pointer.y - smooth.y) * k;
    smooth.scroll += (scrollY / maxScroll - smooth.scroll) * k;
    smooth.boost += (Math.min(velocity * 0.03, 55) - smooth.boost) * (1 - Math.exp(-dt * 4));

    offset += (7 + smooth.boost) * dt;

    camera.position.x = smooth.x * 2.4;
    camera.position.y = 3.2 + smooth.y * 0.8 + smooth.scroll * 3;
    lookTarget.set(smooth.x * 7, MathUtils.lerp(14, -6, smooth.scroll) + smooth.y * 2, -100);
    camera.lookAt(lookTarget);
    const baseFov = camera.aspect < 0.8 ? 72 : 62;
    camera.fov = baseFov + smooth.boost * 0.22;
    camera.updateProjectionMatrix();

    for (const u of animated) u.uTime.value = elapsed;
    terrainU.uOffset.value = offset;
    terrainU.uAccent.value.lerp(accentTarget, 1 - Math.exp(-dt * 5));
    terrainU.uAccentMix.value += (accentMixTarget - terrainU.uAccentMix.value) * (1 - Math.exp(-dt * 4));
  };

  let last = performance.now();
  let slow = 0;
  let frames = 0;

  const frame = (now = performance.now()) => {
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
    last = now;
    update(dt);
    renderer.render(scene, camera);

    // Adaptive resolution: drop the pixel ratio if we consistently miss ~40fps
    frames++;
    if (dt > 1 / 40) slow++;
    if (frames >= 90) {
      if (slow > 45 && pixelRatio > 0.75) {
        pixelRatio = Math.max(0.75, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        rain.material.uniforms.uPixelRatio.value = pixelRatio;
        resize();
      }
      frames = 0;
      slow = 0;
    }
  };

  const renderStatic = () => {
    update(0);
    renderer.render(scene, camera);
  };

  const start = () => {
    last = performance.now();
    renderer.setAnimationLoop(frame);
  };
  const stop = () => renderer.setAnimationLoop(null);

  new ResizeObserver(() => {
    resize();
    if (!motion) renderStatic();
  }).observe(canvas);
  resize();

  if (motion) {
    window.addEventListener(
      "pointermove",
      (event) => {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
      },
      { passive: true }
    );
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    start();
  } else {
    renderStatic();
  }

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stop();
    canvas.classList.remove("is-ready");
  });

  requestAnimationFrame(() => canvas.classList.add("is-ready"));

  return {
    canvas,
    setAccent(css) {
      if (css) {
        accentTarget.set(css);
        accentMixTarget = 0.85;
      } else {
        accentMixTarget = 0;
      }
    },
  };
}
