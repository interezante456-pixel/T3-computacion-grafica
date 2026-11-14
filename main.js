// ==========================================================================
// OPERACIÓN EXTRACCIÓN - VIDEOJUEGO FPS 3D
// Universidad Privada del Norte (UPN) - Computación Gráfica y Visual
// Evaluación T3 (Semana 13)
//
// Estructura modular y pedagógica según las directrices del curso:
// 1. ESCENA, CÁMARA Y RENDERIZADOR
// 2. AMBIENTACIÓN, NIEBLA E ILUMINACIÓN
// 3. CONSTRUCCIÓN DEL ESCENARIO 3D Y COLISIONES CON DESLIZAMIENTO
// 4. SISTEMA DE AUDIO PROCEDURAL (WEB AUDIO API)
// 5. CARGA ASÍNCRONA DE MODELOS GLB (loadAsync) Y AJUSTE DE POV
// 6. CÁMARA EN PRIMERA PERSONA Y MOVIMIENTO FLUIDO (WASD + POINTERLOCK)
// 7. SISTEMA DE ARMAS, RECARGA TÁCTICA (R) Y GESTIÓN DE MUNICIONES
// 8. INTELIGENCIA ARTIFICIAL DE ZOMBIS (DETECCIÓN, PERSECUCIÓN Y DAÑO)
// 9. CONDICIONES DE JUEGO: SALUD, COLECCIONABLES, VICTORIA Y GAME OVER
// 10. BUCLE DE ACTUALIZACIÓN Y RENDERIZADO
// ==========================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --------------------------------------------------------------------------
// ESTADO GLOBAL DEL JUEGO (Declarado al inicio para evitar TDZ)
// --------------------------------------------------------------------------
let partidaTerminada = false;
let saludJugador = 100;
let armaActual = 1;
let estaRecargando = false;
let retrocesoZ = 0;
let retrocesoRotX = 0;
let tiempoUltimoDisparo = 0;
let disparosRealizados = 0;
let zombisEliminadosTotal = 0;
let cajasRecolectadasTotal = 0;

const zombis = [];
const mallasZombisActivos = [];
const cajasColeccionables = [];

const municiones = {
  1: {
    nombre: 'Pistola 9mm',
    cargadorMax: 15,
    cargador: 15,
    reserva: 30
  },
  2: {
    nombre: 'Rifle M4',
    cargadorMax: 15,
    cargador: 15,
    reserva: 30
  }
};

// --------------------------------------------------------------------------
// 1. ESCENA, CÁMARA Y RENDERIZADOR
// --------------------------------------------------------------------------

const stage = document.getElementById('game-stage');

const escena = new THREE.Scene();
escena.background = new THREE.Color(0x0a0f16);
escena.fog = new THREE.FogExp2(0x0a0f16, 0.022);

const camara = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  150
);
const POSICION_INICIAL = new THREE.Vector3(0, 1.7, 0);
camara.position.copy(POSICION_INICIAL);
escena.add(camara);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
stage.appendChild(renderer.domElement);

const controls = new PointerLockControls(camara, document.body);

// --------------------------------------------------------------------------
// 2. AMBIENTACIÓN, NIEBLA E ILUMINACIÓN
// --------------------------------------------------------------------------

const luzAmbiente = new THREE.HemisphereLight(0x40556b, 0x161a22, 1.3);
escena.add(luzAmbiente);

const sol = new THREE.DirectionalLight(0xaac4db, 1.6);
sol.position.set(0, 20, -50);
sol.castShadow = true;
sol.shadow.mapSize.set(1024, 1024);
sol.shadow.camera.left = -30;
sol.shadow.camera.right = 30;
sol.shadow.camera.top = 30;
sol.shadow.camera.bottom = -30;
sol.shadow.camera.near = 0.5;
sol.shadow.camera.far = 120;
sol.shadow.bias = -0.0001;
escena.add(sol);

const linterna = new THREE.SpotLight(0xfffaed, 2.8, 28, Math.PI / 5, 0.45, 1.2);
linterna.position.set(0, 0, 0);
linterna.target.position.set(0, 0, -5);
camara.add(linterna);
camara.add(linterna.target);

// --------------------------------------------------------------------------
// 3. CONSTRUCCIÓN DEL ESCENARIO 3D Y COLISIONES
// --------------------------------------------------------------------------

const colisionadores = [];

const matPared = new THREE.MeshStandardMaterial({
  color: 0x222d38,
  roughness: 0.85,
  metalness: 0.15
});

const matParedAlerta = new THREE.MeshStandardMaterial({
  color: 0x3a2c28,
  roughness: 0.75,
  metalness: 0.25
});

const matSuelo = new THREE.MeshStandardMaterial({
  color: 0x181f27,
  roughness: 0.9,
  metalness: 0.1
});

const matTecho = new THREE.MeshStandardMaterial({
  color: 0x0f151c,
  roughness: 0.95
});

const matObstaculo = new THREE.MeshStandardMaterial({
  color: 0x3d4b58,
  roughness: 0.6,
  metalness: 0.4
});

const matZonaExtraccion = new THREE.MeshStandardMaterial({
  color: 0x165b33,
  emissive: 0x0d381e,
  roughness: 0.4,
  metalness: 0.5
});

function crearMuro(x, y, z, ancho, alto, profundidad, material = matPared) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, profundidad), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  escena.add(mesh);

  const box = new THREE.Box3().setFromObject(mesh);
  colisionadores.push(box);
  return mesh;
}

const sueloGlobal = new THREE.Mesh(new THREE.PlaneGeometry(120, 220), matSuelo);
sueloGlobal.rotation.x = -Math.PI / 2;
sueloGlobal.position.set(0, 0, -70);
sueloGlobal.receiveShadow = true;
escena.add(sueloGlobal);

const techoBunker = new THREE.Mesh(new THREE.PlaneGeometry(60, 150), matTecho);
techoBunker.rotation.x = Math.PI / 2;
techoBunker.position.set(0, 4.2, -50);
escena.add(techoBunker);

function crearLampara(x, y, z, color = 0xffe2aa, intensidad = 2.5) {
  const luz = new THREE.PointLight(color, intensidad, 16);
  luz.position.set(x, y, z);
  escena.add(luz);

  const foco = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: color })
  );
  foco.position.set(x, y, z);
  escena.add(foco);
}

// SECTOR 1: SALA DE INICIO / CUARENTENA (Z: 5 a -15, X: -7 a 7)
crearMuro(0, 2.1, 6, 14, 4.2, 1);
crearMuro(-7, 2.1, -4.5, 1, 4.2, 21);
crearMuro(7, 2.1, -4.5, 1, 4.2, 21);
crearMuro(-4.5, 2.1, -15, 6, 4.2, 1);
crearMuro(4.5, 2.1, -15, 6, 4.2, 1);
crearLampara(0, 3.8, 0, 0x88bbff, 2.2);

// SECTOR 2: PASILLO ALFA Y ALMACÉN (Z: -15 a -45, X: -4 a 4)
crearMuro(-4, 2.1, -30, 1, 4.2, 30);
crearMuro(4, 2.1, -30, 1, 4.2, 30);
crearLampara(0, 3.8, -25, 0xffa055, 2.0);
crearLampara(0, 3.8, -40, 0xffa055, 2.0);
crearMuro(-1.6, 0.6, -26, 1.6, 1.2, 1.2, matObstaculo);
crearMuro(1.8, 0.7, -35, 1.4, 1.4, 1.4, matObstaculo);

// SECTOR 3: LABORATORIO CENTRAL INFESTADO (Z: -45 a -85, X: -14 a 14)
crearMuro(-9, 2.1, -45, 11, 4.2, 1);
crearMuro(9, 2.1, -45, 11, 4.2, 1);
crearMuro(-14, 2.1, -65, 1, 4.2, 40);
crearMuro(14, 2.1, -65, 1, 4.2, 40);
crearMuro(-9, 2.1, -85, 11, 4.2, 1);
crearMuro(9, 2.1, -85, 11, 4.2, 1);

for (const x of [-6, 6]) {
  for (const z of [-55, -75]) {
    crearMuro(x, 2.1, z, 1.6, 4.2, 1.6, matObstaculo);
  }
}
crearLampara(-5, 3.8, -65, 0x48e68b, 2.5);
crearLampara(5, 3.8, -65, 0x48e68b, 2.5);

// SECTOR 4: TÚNEL DE EMERGENCIA Y DESCONTAMINACIÓN (Z: -85 a -115, X: -4 a 4)
crearMuro(-4, 2.1, -100, 1, 4.2, 30, matParedAlerta);
crearMuro(4, 2.1, -100, 1, 4.2, 30, matParedAlerta);
crearLampara(0, 3.8, -95, 0xff3322, 3.0);
crearLampara(0, 3.8, -108, 0xff3322, 3.0);
crearMuro(1.5, 0.5, -96, 1.3, 1.0, 1.3, matObstaculo);
crearMuro(-1.5, 0.6, -105, 1.3, 1.2, 1.3, matObstaculo);

// SECTOR 5: ZONA EXTERIOR DE EXTRACCIÓN / HELIPUERTO (Z: -115 a -150, X: -16 a 16)
crearMuro(-16, 2.5, -132.5, 1, 5.0, 35);
crearMuro(16, 2.5, -132.5, 1, 5.0, 35);
crearMuro(0, 2.5, -150, 32, 5.0, 1);
crearMuro(-10, 2.5, -115, 13, 5.0, 1);
crearMuro(10, 2.5, -115, 13, 5.0, 1);

const POS_EXTRACCION = new THREE.Vector3(0, 0.05, -136);
const RADIO_EXTRACCION = 4.8;

const plataforma = new THREE.Mesh(
  new THREE.CylinderGeometry(RADIO_EXTRACCION, RADIO_EXTRACCION + 0.3, 0.1, 48),
  matZonaExtraccion
);
plataforma.position.copy(POS_EXTRACCION);
plataforma.receiveShadow = true;
escena.add(plataforma);

const aroBaliza = new THREE.Mesh(
  new THREE.TorusGeometry(RADIO_EXTRACCION - 0.2, 0.08, 8, 48),
  new THREE.MeshBasicMaterial({ color: 0x33ff77 })
);
aroBaliza.rotation.x = Math.PI / 2;
aroBaliza.position.set(POS_EXTRACCION.x, 0.15, POS_EXTRACCION.z);
escena.add(aroBaliza);

const hazLuz = new THREE.Mesh(
  new THREE.CylinderGeometry(0.12, 0.12, 14, 16),
  new THREE.MeshBasicMaterial({ color: 0x33ff88, transparent: true, opacity: 0.65 })
);
hazLuz.position.set(POS_EXTRACCION.x, 7, POS_EXTRACCION.z);
escena.add(hazLuz);

const luzExtraccion = new THREE.PointLight(0x33ff77, 4.0, 25);
luzExtraccion.position.set(POS_EXTRACCION.x, 3.5, POS_EXTRACCION.z);
escena.add(luzExtraccion);

// --------------------------------------------------------------------------
// 4. SISTEMA DE AUDIO PROCEDURAL (WEB AUDIO API)
// --------------------------------------------------------------------------

let audioCtx = null;

function iniciarAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function reproducirSonidoPistola() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(440, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.14);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

function reproducirSonidoRifle() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(260, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(45, audioCtx.currentTime + 0.20);
  gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.22);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.23);
}

function reproducirSonidoVacio() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(900, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

function reproducirSonidoRecarga() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(550, t);
  osc1.frequency.exponentialRampToValueAtTime(180, t + 0.11);
  gain1.gain.setValueAtTime(0.22, t);
  gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.13);
  osc1.connect(gain1);
  gain1.connect(audioCtx.destination);
  osc1.start(t);
  osc1.stop(t + 0.14);

  setTimeout(() => {
    if (!audioCtx) return;
    const t2 = audioCtx.currentTime;
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(320, t2);
    osc2.frequency.exponentialRampToValueAtTime(750, t2 + 0.13);
    gain2.gain.setValueAtTime(0.28, t2);
    gain2.gain.exponentialRampToValueAtTime(0.01, t2 + 0.15);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(t2);
    osc2.stop(t2 + 0.16);
  }, 170);
}

function reproducirSonidoImpacto() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.16);
  gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.19);
}

function reproducirSonidoMuerteZombi() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(110, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 0.35);
  gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.37);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.39);
}

function reproducirSonidoDanioJugador() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(130, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(45, audioCtx.currentTime + 0.22);
  gain.gain.setValueAtTime(0.45, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.24);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.25);
}

function reproducirSonidoColeccionable() {
  if (!audioCtx) return;
  const tiempo = audioCtx.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(freq, tiempo + idx * 0.08);
    gain.gain.setValueAtTime(0.2, tiempo + idx * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, tiempo + idx * 0.08 + 0.18);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(tiempo + idx * 0.08);
    osc.stop(tiempo + idx * 0.08 + 0.2);
  });
}

function reproducirSonidoVictoria() {
  if (!audioCtx) return;
  const tiempo = audioCtx.currentTime;
  [392.00, 523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(freq, tiempo + idx * 0.13);
    gain.gain.setValueAtTime(0.3, tiempo + idx * 0.13);
    gain.gain.exponentialRampToValueAtTime(0.01, tiempo + idx * 0.13 + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(tiempo + idx * 0.13);
    osc.stop(tiempo + idx * 0.13 + 0.4);
  });
}

// --------------------------------------------------------------------------
// 5. CARGA ASÍNCRONA DE MODELOS GLB (loadAsync) Y AJUSTE DE POV
// --------------------------------------------------------------------------

const loader = new GLTFLoader();

const armaContenedor = new THREE.Group();
camara.add(armaContenedor);

let modeloPistola = null;
let modeloRifle = null;
let modeloZombiePrototipo = null;
let modeloCajaPrototipo = null;

const luzDisparo = new THREE.PointLight(0xffaa44, 0, 8);
armaContenedor.add(luzDisparo);

function normalizarModelo(objeto, alturaDeseada) {
  const cajaOrig = new THREE.Box3().setFromObject(objeto);
  const tamano = cajaOrig.getSize(new THREE.Vector3());
  const factor = alturaDeseada / tamano.y;
  objeto.scale.setScalar(factor);

  const caja = new THREE.Box3().setFromObject(objeto);
  objeto.position.set(
    -(caja.min.x + caja.max.x) / 2,
    -caja.min.y,
    -(caja.min.z + caja.max.z) / 2
  );
  return objeto;
}

async function cargarRecursosGLB() {
  try {
    const gltfPistola = await loader.loadAsync('./models/pistola.glb');
    modeloPistola = new THREE.Group();
    const meshPistola = normalizarModelo(gltfPistola.scene, 0.15);
    meshPistola.traverse((n) => { if (n.isMesh) { n.castShadow = true; } });
    modeloPistola.add(meshPistola);
    modeloPistola.position.set(0.24, -0.30, -0.42);
    modeloPistola.rotation.set(0.04, -0.05, 0.02);
    armaContenedor.add(modeloPistola);

    const gltfRifle = await loader.loadAsync('./models/rifle.glb');
    modeloRifle = new THREE.Group();
    const meshRifle = normalizarModelo(gltfRifle.scene, 0.20);
    meshRifle.traverse((n) => { if (n.isMesh) { n.castShadow = true; } });
    modeloRifle.add(meshRifle);
    modeloRifle.position.set(0.24, -0.32, -0.50);
    modeloRifle.rotation.set(0.02, -0.04, 0.01);
    modeloRifle.visible = false;
    armaContenedor.add(modeloRifle);

    const gltfZombie = await loader.loadAsync('./models/zombie.glb');
    modeloZombiePrototipo = normalizarModelo(gltfZombie.scene, 1.85);
    modeloZombiePrototipo.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });

    const gltfCaja = await loader.loadAsync('./models/caja_municion.glb');
    modeloCajaPrototipo = normalizarModelo(gltfCaja.scene, 0.45);
    modeloCajaPrototipo.traverse((n) => { if (n.isMesh) { n.castShadow = true; } });

    generarEnemigosZombis();
    generarCajasMunicion();

    actualizarHUD();
    console.log('✓ Modelos GLB cargados y posicionados en POV adecuado');
  } catch (err) {
    console.error('Error al cargar modelos GLB:', err);
  }
}

// --------------------------------------------------------------------------
// 6. CÁMARA EN PRIMERA PERSONA Y MOVIMIENTO FLUIDO (WASD + POINTERLOCK)
// --------------------------------------------------------------------------

const estadoTeclas = {
  KeyW: false,
  KeyS: false,
  KeyA: false,
  KeyD: false
};

const VELOCIDAD_JUGADOR = 6.8;
let tiempoAnterior = performance.now();

window.addEventListener('keydown', (e) => {
  if (e.code in estadoTeclas) {
    estadoTeclas[e.code] = true;
  }
  if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
    seleccionarArma(1);
  } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
    seleccionarArma(2);
  } else if (e.key === 'r' || e.key === 'R' || e.code === 'KeyR') {
    recargarArma();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code in estadoTeclas) {
    estadoTeclas[e.code] = false;
  }
});

function verificarColisionJugador(posicionFutura) {
  const radio = 0.32;
  const cajaJugador = new THREE.Box3(
    new THREE.Vector3(posicionFutura.x - radio, 0, posicionFutura.z - radio),
    new THREE.Vector3(posicionFutura.x + radio, 2.0, posicionFutura.z + radio)
  );

  for (const colisionador of colisionadores) {
    if (cajaJugador.intersectsBox(colisionador)) {
      return true;
    }
  }
  return false;
}

// --------------------------------------------------------------------------
// 7. SISTEMA DE ARMAS, RECARGA TÁCTICA (R) Y GESTIÓN DE MUNICIONES
// --------------------------------------------------------------------------

function actualizarHUD() {
  const datosArma = municiones[armaActual];
  const elCurrent = document.getElementById('current-ammo');
  const elMax = document.getElementById('max-ammo');

  if (elCurrent && elMax && datosArma) {
    elCurrent.textContent = String(datosArma.cargador).padStart(2, '0');
    elMax.textContent = String(datosArma.reserva).padStart(2, '0');

    if (datosArma.cargador === 0) {
      elCurrent.style.color = '#ff4757';
    } else {
      elCurrent.style.color = '#ffffff';
    }
  }

  const slot1 = document.getElementById('slot-1-indicator');
  const slot2 = document.getElementById('slot-2-indicator');
  if (slot1) slot1.classList.toggle('active', armaActual === 1);
  if (slot2) slot2.classList.toggle('active', armaActual === 2);

  const barSalud = document.getElementById('health-bar');
  const txtSalud = document.getElementById('health-text');
  if (barSalud && txtSalud) {
    barSalud.style.width = `${saludJugador}%`;
    txtSalud.textContent = `SALUD: ${saludJugador}%`;
    if (saludJugador > 60) {
      barSalud.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
      txtSalud.style.color = '#2ecc71';
    } else if (saludJugador > 30) {
      barSalud.style.background = 'linear-gradient(90deg, #f1c40f, #e67e22)';
      txtSalud.style.color = '#f1c40f';
    } else {
      barSalud.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
      txtSalud.style.color = '#e74c3c';
    }
  }

  const elZombies = document.getElementById('zombie-count');
  if (elZombies) {
    const vivos = zombis.filter((z) => z.vivo).length;
    elZombies.textContent = String(vivos).padStart(2, '0');
  }
}

// Actualizar HUD una vez cargado el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', actualizarHUD);
} else {
  actualizarHUD();
}

function seleccionarArma(numero) {
  if (numero === armaActual) return;
  armaActual = numero;

  if (modeloPistola && modeloRifle) {
    modeloPistola.visible = armaActual === 1;
    modeloRifle.visible = armaActual === 2;
  }
  mostrarMensajeFlotante(`Equipado: ${municiones[armaActual].nombre}`);
  actualizarHUD();
}

function recargarArma() {
  if (partidaTerminada || estaRecargando) return;

  const arma = municiones[armaActual];

  if (arma.cargador >= arma.cargadorMax) {
    mostrarMensajeFlotante(`Cargador completo (${arma.cargador}/${arma.reserva})`);
    return;
  }

  if (arma.reserva <= 0) {
    reproducirSonidoVacio();
    mostrarMensajeFlotante('¡Sin balas en reserva! Busca cajas de suministros');
    return;
  }

  estaRecargando = true;
  iniciarAudio();
  reproducirSonidoRecarga();

  retrocesoRotX = 0.25;
  retrocesoZ = 0.10;
  mostrarMensajeFlotante('Recargando cargador...');

  setTimeout(() => {
    const faltantes = arma.cargadorMax - arma.cargador;
    const transferir = Math.min(faltantes, arma.reserva);

    arma.cargador += transferir;
    arma.reserva -= transferir;

    estaRecargando = false;
    actualizarHUD();
    mostrarMensajeFlotante(`Recarga lista: ${arma.cargador} / ${arma.reserva}`);
  }, 400);
}

window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && controls.isLocked && !partidaTerminada) {
    iniciarAudio();
    ejecutarDisparo();
  }
});

const raycaster = new THREE.Raycaster();
const centroPantalla = new THREE.Vector2(0, 0);

function ejecutarDisparo() {
  if (estaRecargando) return;

  const ahora = performance.now();
  if (ahora - tiempoUltimoDisparo < 180) return;
  tiempoUltimoDisparo = ahora;

  const arma = municiones[armaActual];

  if (arma.cargador <= 0) {
    reproducirSonidoVacio();
    if (arma.reserva > 0) {
      mostrarMensajeFlotante('¡Cargador vacío! Presiona [R] para recargar');
    } else {
      mostrarMensajeFlotante('¡SIN MUNICIÓN TOTAL! Busca cajas en el mapa');
    }
    return;
  }

  arma.cargador--;
  disparosRealizados++;
  actualizarHUD();

  if (armaActual === 1) {
    reproducirSonidoPistola();
  } else {
    reproducirSonidoRifle();
  }

  retrocesoZ = armaActual === 1 ? 0.06 : 0.10;
  retrocesoRotX = armaActual === 1 ? 0.07 : 0.12;

  const flashOverlay = document.getElementById('muzzle-flash');
  if (flashOverlay) {
    flashOverlay.classList.add('active');
    luzDisparo.intensity = 4.0;
    setTimeout(() => {
      flashOverlay.classList.remove('active');
      luzDisparo.intensity = 0;
    }, 40);
  }

  raycaster.setFromCamera(centroPantalla, camara);
  const impactos = raycaster.intersectObjects(mallasZombisActivos, false);

  if (impactos.length > 0) {
    const primerImpacto = impactos[0];
    const zombiImpactado = primerImpacto.object.userData.zombiRef;

    if (zombiImpactado && zombiImpactado.vivo) {
      zombiImpactado.vida--;
      reproducirSonidoImpacto();

      for (const m of zombiImpactado.mallas) {
        if (m.material && m.material.color) {
          const colOrig = m.material.color.getHex();
          m.material.color.setHex(0xff3333);
          setTimeout(() => {
            if (m.material && m.material.color) {
              m.material.color.setHex(colOrig);
            }
          }, 90);
        }
      }

      if (zombiImpactado.vida <= 0) {
        eliminarZombi(zombiImpactado);
      }
    }
  }
}

// --------------------------------------------------------------------------
// 8. INTELIGENCIA ARTIFICIAL DE ZOMBIS (DETECCIÓN, PERSECUCIÓN Y DAÑO)
// --------------------------------------------------------------------------

const DISTANCIA_DETECCION_CONFIGURABLE = 15.0;

const CONFIG_ZOMBIS = [
  { x: -1.2, z: -28 },
  { x: 1.5, z: -38 },
  { x: -5, z: -55 },
  { x: 5, z: -60 },
  { x: -8, z: -72 },
  { x: 7, z: -76 },
  { x: 0, z: -80 },
  { x: -1.5, z: -94 },
  { x: 1.2, z: -103 },
  { x: 0, z: -111 },
  { x: -4, z: -122 },
  { x: 4, z: -125 }
];

function generarEnemigosZombis() {
  if (!modeloZombiePrototipo) return;
  mallasZombisActivos.length = 0;

  for (const pos of CONFIG_ZOMBIS) {
    const grupo = modeloZombiePrototipo.clone(true);
    grupo.position.set(pos.x, 0, pos.z);
    escena.add(grupo);

    const zombiObj = {
      grupo: grupo,
      vivo: true,
      vida: 2,
      activo: false,
      velocidad: 2.15 + Math.random() * 0.4,
      anguloMuerte: 0,
      ultimoAtaque: 0,
      mallas: []
    };

    grupo.traverse((hijo) => {
      if (hijo.isMesh) {
        hijo.userData.zombiRef = zombiObj;
        zombiObj.mallas.push(hijo);
        mallasZombisActivos.push(hijo);
      }
    });

    zombis.push(zombiObj);
  }
  actualizarHUD();
}

function eliminarZombi(zombi) {
  zombi.vivo = false;
  zombi.activo = false;
  zombisEliminadosTotal++;

  for (const m of zombi.mallas) {
    const idx = mallasZombisActivos.indexOf(m);
    if (idx !== -1) mallasZombisActivos.splice(idx, 1);
  }

  reproducirSonidoMuerteZombi();
  actualizarHUD();
  mostrarMensajeFlotante('Zombi neutralizado');
}

function actualizarZombis(delta) {
  const posJugador = camara.position;

  for (const z of zombis) {
    if (!z.vivo) {
      if (z.anguloMuerte < Math.PI / 2) {
        z.anguloMuerte += delta * 4;
        z.grupo.rotation.x = z.anguloMuerte;
        z.grupo.position.y = Math.max(0.1, z.grupo.position.y - delta * 0.8);
      }
      continue;
    }

    const distHorizontal = Math.hypot(
      posJugador.x - z.grupo.position.x,
      posJugador.z - z.grupo.position.z
    );

    if (!z.activo) {
      if (distHorizontal <= DISTANCIA_DETECCION_CONFIGURABLE) {
        z.activo = true;
      }
    }

    if (z.activo) {
      z.grupo.lookAt(posJugador.x, z.grupo.position.y, posJugador.z);

      const dir = new THREE.Vector3()
        .subVectors(posJugador, z.grupo.position)
        .setY(0)
        .normalize();

      z.grupo.position.addScaledVector(dir, z.velocidad * delta);

      if (distHorizontal <= 1.30 && !partidaTerminada) {
        const ahora = performance.now();
        if (ahora - z.ultimoAtaque > 850) {
          z.ultimoAtaque = ahora;
          recibirDanio(25);
        }
      }
    }
  }
}

// --------------------------------------------------------------------------
// 9. CONDICIONES DE JUEGO: SALUD, COLECCIONABLES, VICTORIA Y GAME OVER
// --------------------------------------------------------------------------

function recibirDanio(puntos) {
  if (partidaTerminada || saludJugador <= 0) return;

  saludJugador = Math.max(0, saludJugador - puntos);
  actualizarHUD();
  reproducirSonidoDanioJugador();

  const vignette = document.getElementById('damage-vignette');
  if (vignette) {
    vignette.classList.add('active');
    setTimeout(() => {
      if (!partidaTerminada) vignette.classList.remove('active');
    }, 240);
  }

  camara.position.x += (Math.random() - 0.5) * 0.12;
  camara.position.z += (Math.random() - 0.5) * 0.12;

  mostrarMensajeFlotante(`¡HERIDO! -${puntos}% Salud`);

  if (saludJugador <= 0) {
    activarGameOver();
  }
}

const POSICIONES_CAJAS = [
  new THREE.Vector3(2.2, 0.25, -31),
  new THREE.Vector3(-9.5, 0.25, -67),
  new THREE.Vector3(0, 0.25, -101)
];

function generarCajasMunicion() {
  if (!modeloCajaPrototipo) return;

  for (const pos of POSICIONES_CAJAS) {
    const grupo = modeloCajaPrototipo.clone(true);
    grupo.position.copy(pos);
    escena.add(grupo);

    const halo = new THREE.PointLight(0xffcc44, 1.8, 4.5);
    halo.position.set(pos.x, pos.y + 0.6, pos.z);
    escena.add(halo);

    cajasColeccionables.push({
      grupo: grupo,
      halo: halo,
      recogida: false,
      baseY: pos.y
    });
  }
}

function actualizarColeccionables(tiempo) {
  const posJugador = camara.position;

  for (const caja of cajasColeccionables) {
    if (caja.recogida) continue;

    caja.grupo.rotation.y += 0.02;
    caja.grupo.position.y = caja.baseY + Math.sin(tiempo * 3) * 0.08;

    const distCaja = Math.hypot(
      posJugador.x - caja.grupo.position.x,
      posJugador.z - caja.grupo.position.z
    );

    if (distCaja < 1.8) {
      caja.recogida = true;
      cajasRecolectadasTotal++;
      escena.remove(caja.grupo);
      escena.remove(caja.halo);

      municiones[1].reserva += 30;
      municiones[2].reserva += 25;

      reproducirSonidoColeccionable();
      actualizarHUD();
      mostrarMensajeFlotante('+30 Balas 9mm · +25 Balas M4 recogidas');
    }
  }
}

function verificarZonaExtraccion() {
  if (partidaTerminada) return;

  const distExtraccion = Math.hypot(
    camara.position.x - POS_EXTRACCION.x,
    camara.position.z - POS_EXTRACCION.z
  );

  if (distExtraccion <= RADIO_EXTRACCION) {
    activarVictoria();
  }
}

function activarVictoria() {
  partidaTerminada = true;
  controls.unlock();
  reproducirSonidoVictoria();

  const elVicKills = document.getElementById('vic-kills');
  const elVicShots = document.getElementById('vic-shots');
  const elVicCrates = document.getElementById('vic-crates');
  const elVicScreen = document.getElementById('victory-screen');

  if (elVicKills) elVicKills.textContent = zombisEliminadosTotal;
  if (elVicShots) elVicShots.textContent = disparosRealizados;
  if (elVicCrates) elVicCrates.textContent = cajasRecolectadasTotal;
  if (elVicScreen) elVicScreen.classList.add('active');
}

function activarGameOver() {
  partidaTerminada = true;
  controls.unlock();

  const blood = document.getElementById('damage-vignette');
  if (blood) blood.classList.add('active');

  const elGoKills = document.getElementById('go-kills');
  const elGoShots = document.getElementById('go-shots');
  const elGoScreen = document.getElementById('game-over-screen');

  if (elGoKills) elGoKills.textContent = zombisEliminadosTotal;
  if (elGoShots) elGoShots.textContent = disparosRealizados;
  if (elGoScreen) elGoScreen.classList.add('active');
}

function reiniciarPartida() {
  partidaTerminada = false;
  saludJugador = 100;
  estaRecargando = false;

  const goScreen = document.getElementById('game-over-screen');
  const vicScreen = document.getElementById('victory-screen');
  const blood = document.getElementById('damage-vignette');

  if (goScreen) goScreen.classList.remove('active');
  if (vicScreen) vicScreen.classList.remove('active');
  if (blood) blood.classList.remove('active');

  camara.position.copy(POSICION_INICIAL);

  municiones[1].cargador = 15;
  municiones[1].reserva = 30;
  municiones[2].cargador = 15;
  municiones[2].reserva = 30;
  disparosRealizados = 0;
  zombisEliminadosTotal = 0;
  cajasRecolectadasTotal = 0;

  mallasZombisActivos.length = 0;
  for (let i = 0; i < zombis.length; i++) {
    const z = zombis[i];
    const pos = CONFIG_ZOMBIS[i];
    z.vivo = true;
    z.vida = 2;
    z.activo = false;
    z.anguloMuerte = 0;
    z.ultimoAtaque = 0;
    z.grupo.position.set(pos.x, 0, pos.z);
    z.grupo.rotation.set(0, 0, 0);

    for (const m of z.mallas) {
      mallasZombisActivos.push(m);
    }
  }

  for (let i = 0; i < cajasColeccionables.length; i++) {
    const caja = cajasColeccionables[i];
    if (caja.recogida) {
      caja.recogida = false;
      escena.add(caja.grupo);
      escena.add(caja.halo);
    }
  }

  actualizarHUD();
  controls.lock();
}

function mostrarMensajeFlotante(texto) {
  const el = document.getElementById('action-message');
  if (!el) return;
  el.textContent = texto;
  el.classList.add('visible');
  clearTimeout(el.dataset.timer);
  el.dataset.timer = setTimeout(() => {
    el.classList.remove('visible');
  }, 2200);
}

// --------------------------------------------------------------------------
// 10. BUCLE DE ACTUALIZACIÓN Y RENDERIZADO
// --------------------------------------------------------------------------

const btnStart = document.getElementById('btn-start');
if (btnStart) {
  btnStart.addEventListener('click', () => {
    iniciarAudio();
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.classList.remove('active');
    controls.lock();
  });
}

// Permitir volver a fijar la vista si se hace clic en la pantalla con el juego activo
stage.addEventListener('click', () => {
  const startScreen = document.getElementById('start-screen');
  const goScreen = document.getElementById('game-over-screen');
  const vicScreen = document.getElementById('victory-screen');

  const hayModalActivo = (startScreen && startScreen.classList.contains('active')) ||
                         (goScreen && goScreen.classList.contains('active')) ||
                         (vicScreen && vicScreen.classList.contains('active'));

  if (!partidaTerminada && !controls.isLocked && !hayModalActivo) {
    controls.lock();
  }
});

const btnRestartGo = document.getElementById('btn-restart-go');
if (btnRestartGo) {
  btnRestartGo.addEventListener('click', reiniciarPartida);
}

const btnRestartVic = document.getElementById('btn-restart-vic');
if (btnRestartVic) {
  btnRestartVic.addEventListener('click', reiniciarPartida);
}

window.addEventListener('resize', () => {
  camara.aspect = window.innerWidth / window.innerHeight;
  camara.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animar() {
  requestAnimationFrame(animar);

  const tiempoActual = performance.now();
  const delta = Math.min((tiempoActual - tiempoAnterior) / 1000, 0.1);
  tiempoAnterior = tiempoActual;

  if (controls.isLocked && !partidaTerminada) {
    const velocidad = VELOCIDAD_JUGADOR * delta;
    const prevX = camara.position.x;
    const prevZ = camara.position.z;

    if (estadoTeclas.KeyW) controls.moveForward(velocidad);
    if (estadoTeclas.KeyS) controls.moveForward(-velocidad);
    if (estadoTeclas.KeyA) controls.moveRight(-velocidad);
    if (estadoTeclas.KeyD) controls.moveRight(velocidad);

    const targetX = camara.position.x;
    const targetZ = camara.position.z;

    camara.position.x = targetX;
    camara.position.z = prevZ;
    if (verificarColisionJugador(camara.position)) {
      camara.position.x = prevX;
    }

    camara.position.z = targetZ;
    if (verificarColisionJugador(camara.position)) {
      camara.position.z = prevZ;
    }

    camara.position.y = POSICION_INICIAL.y;

    if (retrocesoZ > 0) {
      retrocesoZ = Math.max(0, retrocesoZ - delta * 1.4);
      retrocesoRotX = Math.max(0, retrocesoRotX - delta * 1.6);
    }

    const estaMoviendose = estadoTeclas.KeyW || estadoTeclas.KeyS || estadoTeclas.KeyA || estadoTeclas.KeyD;
    const balanceoX = estaMoviendose ? Math.sin(tiempoActual * 0.007) * 0.005 : 0;
    const balanceoY = estaMoviendose ? Math.abs(Math.sin(tiempoActual * 0.014)) * 0.004 : 0;

    armaContenedor.position.set(balanceoX, balanceoY, -retrocesoZ);
    armaContenedor.rotation.x = retrocesoRotX;

    actualizarZombis(delta);
    actualizarColeccionables(tiempoActual * 0.001);
    verificarZonaExtraccion();
  }

  renderer.render(escena, camara);
}

// Iniciar carga de recursos y ciclo de render
cargarRecursosGLB().then(() => {
  actualizarHUD();
});

animar();
