// =============================================================================
//  verif_fx.js — exécute les VRAIS modules 3D hors navigateur pour vérifier que
//  chaque effet de capacité se joue, se termine et libère ses objets.
//  Aucun rendu WebGL n'est nécessaire : battle3d ne construit qu'une scène.
// =============================================================================
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = 'C:/Users/Janin/Desktop/Projects/lejeudeRobin';
const lire = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// --- Faux canvas 2D : de quoi dessiner les textures d'effets ----------------
function ctx2d() {
  const grad = { addColorStop() {} };
  return {
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {},
    fillText() {}, strokeText() {}, putImageData() {},
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    set fillStyle(v) {}, get fillStyle() { return '#000'; },
    set strokeStyle(v) {}, get strokeStyle() { return '#000'; },
    set globalCompositeOperation(v) {}, get globalCompositeOperation() { return 'source-over'; },
    set lineWidth(v) {}, get lineWidth() { return 1; },
    set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
  };
}

function fakeElement(tag) {
  const el = {
    tagName: String(tag || '').toUpperCase(),
    width: 128, height: 128, style: {}, dataset: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    getContext: () => ctx2d(),
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {}, addEventListener() {}, removeEventListener() {},
    setAttribute() {}, getAttribute: () => null,
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }),
  };
  return el;
}

const sandbox = {
  console,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
  document: {
    createElement: fakeElement,
    createElementNS: fakeElement,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, readyState: 'complete',
    body: fakeElement('body'),
  },
  location: { hash: '', href: '' },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { userAgent: 'node' },
  Image: function () {},
  self: null,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function charger(f) {
  try {
    vm.runInContext(lire(f), sandbox, { filename: f, timeout: 20000 });
  } catch (e) {
    console.error('ÉCHEC de chargement de ' + f + ' :', e.message);
    process.exit(1);
  }
}

charger('js3d/vendor/three.min.js');
charger('js3d/core3d.js');
charger('js3d/tiles3d.js');
charger('js3d/types3d.js');
charger('js3d/creatures3d.lib.js');
charger('js3d/battle3d.js');

// R3 est une liaison LEXICALE (const de haut niveau) : on va la chercher ainsi.
vm.runInContext('globalThis.__R3 = (typeof R3 !== "undefined") ? R3 : undefined;', sandbox);
const R3 = sandbox.__R3;
if (!R3) { console.error('R3 introuvable'); process.exit(1); }
const B = R3.get('battle');
if (!B) { console.error('module battle introuvable'); process.exit(1); }

// --- Un état de combat minimal ---------------------------------------------
const mon = (id, lvl) => ({
  id: id, uid: id + lvl, nick: id, level: lvl, hp: 50, maxHp: 50,
  types: ['feu'], moves: [{ id: 'flamme', pp: 10, ppMax: 10 }],
});
const bs = {
  kind: 'wild', phase: 'choose', biome: 'plain',
  player: { mon: mon('miaouche', 5), team: [mon('miaouche', 5)], index: 0 },
  foe: { mon: mon('papillon', 6) },
  anim: {},
};

B.enter(bs, 'plain');
console.log('enter() OK — objets dans la scène :', B.scene.children.length);
const base = B.scene.children.length;

const IDS = ['slash', 'beam', 'ball', 'wave', 'burst', 'storm', 'quake', 'ice',
  'star', 'void', 'time', 'leaf', 'flame', 'bubble', 'bolt', 'wind', 'rock'];

let echecs = 0;
for (const fx of IDS) {
  const t0 = Date.now();
  let pic = 0;
  try {
    B.playFx('player', { id: 'test', name: 'Test', fx: fx, type: 'feu', power: 40 });
    // 3 secondes de jeu simulées : largement de quoi tout terminer.
    for (let i = 0; i < 180; i++) {
      B.update(0.0167, bs);
      const n = B.scene.children.length;
      if (n > pic) pic = n;
      if (Date.now() - t0 > 8000) throw new Error('BOUCLE : plus de 8 s sur une seule capacité');
    }
  } catch (e) {
    console.log('  ✗ ' + fx + ' — ' + e.message);
    echecs++;
    continue;
  }
  const reste = B.scene.children.length - base;
  const ms = Date.now() - t0;
  console.log('  ' + (reste === 0 ? '✓' : '⚠') + ' ' + fx.padEnd(6) +
    ' pic ' + String(pic - base).padStart(3) + ' objets, reste ' + reste + ', ' + ms + ' ms');
  if (reste !== 0) echecs++;
}

// --- Le soin, traité à part dans playFx() -----------------------------------
try {
  B.playFx('player', { id: 'soin', name: 'Soin', fx: 'heal', heal: 10, type: 'plante' });
  for (let i = 0; i < 180; i++) B.update(0.0167, bs);
  console.log('  ' + (B.scene.children.length === base ? '✓' : '⚠') + ' heal   reste ' + (B.scene.children.length - base));
} catch (e) { console.log('  ✗ heal — ' + e.message); echecs++; }

// --- Enchaînement brutal : 30 capacités d'affilée sans laisser respirer ------
try {
  const t0 = Date.now();
  for (let k = 0; k < 30; k++) {
    B.playFx(k % 2 ? 'foe' : 'player', { id: 'x', fx: IDS[k % IDS.length], type: 'feu' });
    for (let i = 0; i < 12; i++) B.update(0.0167, bs);
    if (Date.now() - t0 > 15000) throw new Error('BOUCLE sur l\'enchaînement');
  }
  for (let i = 0; i < 300; i++) B.update(0.0167, bs);
  const reste = B.scene.children.length - base;
  console.log((reste === 0 ? '✓' : '⚠') + ' enchaînement de 30 capacités : reste ' + reste + ' objets, ' + (Date.now() - t0) + ' ms');
  if (reste !== 0) echecs++;
} catch (e) { console.log('✗ enchaînement — ' + e.message); echecs++; }

B.exit();
console.log(echecs === 0 ? '\nTOUT EST BON.' : '\n' + echecs + ' PROBLÈME(S).');
process.exit(echecs === 0 ? 0 : 1);
