// Molar 3D del hero: mitad cerámica, mitad malla digital, separadas por un plano de escaneo.
import * as THREE from './assets/vendor/three-0.170.0.module.min.js';
import { RoomEnvironment } from './assets/vendor/room-environment-0.170.0.js';

const canvas = document.getElementById('tooth3d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const bump = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / r);

// Molar como una sola superficie: cara oclusal con cúspides, corona, cuello y dos raíces.
function toothPoint(u, v, out) {
  const th = u * Math.PI * 2;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const Rc = 1;
  const vt = 0.16; // cara oclusal
  const vc = 0.38; // fin de la corona
  const vn = 0.5; // cuello
  let r;
  let y;
  if (v < vt) {
    const f = v / vt;
    r = f * Rc * 0.92;
    const x = r * c;
    const z = r * sn * 0.9;
    const cusps = bump(x, z, 0.42, 0.34, 0.07) + bump(x, z, -0.42, 0.34, 0.07)
      + bump(x, z, 0.42, -0.34, 0.07) + bump(x, z, -0.4, -0.34, 0.07) * 0.8;
    const fossa = bump(x, z, 0, 0, 0.05);
    const grooves = Math.exp(-(x * x) / 0.005) * 0.6 + Math.exp(-(z * z) / 0.005) * 0.4;
    y = 0.56 + 0.2 * cusps - 0.14 * fossa - 0.05 * grooves * f - 0.16 * f ** 8;
  } else if (v < vc) {
    const f = (v - vt) / (vc - vt);
    y = 0.4 - f * 0.55;
    r = Rc * (0.92 + 0.08 * Math.sin(Math.min(f * 1.6, 1) * Math.PI / 2)) * (1 - 0.06 * f * f);
  } else if (v < vn) {
    const f = (v - vc) / (vn - vc);
    y = -0.15 - f * 0.4;
    r = Rc * (0.94 - 0.2 * smooth(0, 1, f));
  } else {
    // Raíces: la sección pasa de una elipse (tronco) a dos círculos que se afinan hasta el ápice.
    const t = (v - vn) / (1 - vn);
    y = -0.55 - t * 1.8;
    const trunkR = 0.74 - 0.08 * t;
    const ex = trunkR * c;
    const ez = trunkR * sn * 0.9;
    const side = c >= 0 ? 1 : -1;
    const phi = Math.atan2(sn, Math.abs(c)) * 2; // cada mitad recorre un círculo completo
    const rr = 0.4 * (1 - t) ** 0.85 + 0.012;
    const sep = 0.33 + 0.16 * t * t;
    const cx = side * (sep + rr * Math.cos(phi)) ;
    const cz = rr * Math.sin(phi) * 0.95;
    const m = smooth(0.05, 0.42, t);
    out.set(ex + (cx - ex) * m, y, ez + (cz - ez) * m);
    return;
  }
  out.set(r * c, y, r * sn * 0.9);
}

function toothGeometry(nu, nv) {
  const pos = [];
  const idx = [];
  const p = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i < nu; i++) {
      toothPoint(i / nu, j / nv, p);
      pos.push(p.x, p.y, p.z);
    }
  }
  const side = (i) => Math.cos((i / nu) * Math.PI * 2) >= 0;
  const zAt = (k) => Math.abs(pos[k * 3 + 2]);
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * nu + i;
      const b = j * nu + ((i + 1) % nu);
      const c = a + nu;
      const d = b + nu;
      // Entre las dos raíces no hay superficie: se omite la banda que las uniría.
      const web = side(i) !== side((i + 1) % nu) && j / nv > 0.5
        && Math.max(zAt(a), zAt(b), zAt(c), zAt(d)) < 0.09;
      if (!web) idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(232,205,150,.55)');
  grad.addColorStop(0.55, 'rgba(212,183,126,.18)');
  grad.addColorStop(0.9, 'rgba(212,183,126,.9)');
  grad.addColorStop(1, 'rgba(212,183,126,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: canvas.hasAttribute('data-still') });
  } catch {
    document.documentElement.classList.add('no-webgl');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.5, 8.5);
  camera.lookAt(0, -0.1, 0);

  const rim = new THREE.DirectionalLight(0xd4b77e, 3.2);
  rim.position.set(-3, 2, -3);
  scene.add(rim);
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 4, 4);
  scene.add(key);

  const cutSolid = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const cutWire = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const ceramic = new THREE.MeshPhysicalMaterial({
    color: 0xf1e9dc, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.08,
    sheen: 0.5, sheenColor: 0xfff6e6, clippingPlanes: [cutSolid],
  });
  const inner = new THREE.MeshBasicMaterial({ color: 0xb8975a, side: THREE.BackSide, clippingPlanes: [cutSolid] });
  const wire = new THREE.MeshBasicMaterial({
    color: 0xd4b77e, wireframe: true, transparent: true, opacity: 0.55, clippingPlanes: [cutWire],
  });
  const dots = new THREE.PointsMaterial({ color: 0xf0d9a8, size: 0.035, transparent: true, opacity: 0.9, clippingPlanes: [cutWire] });

  const solid = toothGeometry(160, 180);
  const low = toothGeometry(30, 34);
  const tooth = new THREE.Group();
  tooth.add(new THREE.Mesh(solid, ceramic), new THREE.Mesh(solid, inner));
  tooth.add(new THREE.Mesh(low, wire), new THREE.Points(low, dots));
  tooth.position.y = 0.42;
  tooth.rotation.set(0.28, -0.6, 0.12);

  const scanRing = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 64),
    new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  scanRing.rotation.x = -Math.PI / 2;

  const rig = new THREE.Group();
  rig.add(tooth, scanRing);
  rig.scale.setScalar(1.15);
  scene.add(rig);

  // Órbita dorada alrededor de la pieza
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(2.05, 0.004, 8, 180),
    new THREE.MeshBasicMaterial({ color: 0xb8975a, transparent: true, opacity: 0.45 }),
  );
  orbit.rotation.set(1.25, 0, 0.3);
  scene.add(orbit);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const pointer = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  const setScan = (level) => {
    const y = level * rig.scale.y + rig.position.y;
    cutSolid.constant = y;
    cutWire.constant = -y;
    scanRing.position.y = level;
  };

  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(canvas);

  const clock = new THREE.Clock();
  const frame = () => {
    const t = clock.getElapsedTime();
    tooth.rotation.y = -0.6 + t * 0.35;
    rig.rotation.x += (pointer.y * 0.25 - rig.rotation.x) * 0.04;
    rig.rotation.z += (-pointer.x * 0.15 - rig.rotation.z) * 0.04;
    rig.position.y = Math.sin(t * 0.8) * 0.06;
    orbit.rotation.z = 0.3 + t * 0.1;
    setScan(-0.2 + Math.sin(t * 0.55) * 0.95);
    renderer.render(scene, camera);
  };

  if (reduceMotion || canvas.hasAttribute('data-still')) {
    setScan(Number(canvas.dataset.scan ?? 0.15));
    renderer.render(scene, camera);
    canvas.classList.add('is-ready');
    return;
  }
  frame();
  renderer.setAnimationLoop(() => {
    if (visible && !document.hidden) frame();
  });
  canvas.classList.add('is-ready');
}

if (canvas) init();
