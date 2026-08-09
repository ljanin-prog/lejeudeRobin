// =============================================================================
//  verif_arenes.js — PEUT-ON VRAIMENT ENTRER DANS LES SIX ARÈNES ?
//
//  LE BUG QUI A MOTIVÉ CE FICHIER (rapporté par Robin) : « je n'arrive pas à
//  rentrer dans l'arène foudre » (Ambrelune, région sylve).
//
//  Sur le modèle de .claude/verif_pnj.js : on exécute les VRAIS modules 3D hors
//  navigateur, on génère la carte de chaque région, on localise la tuile
//  ARENA_DOOR, et on marche jusqu'à elle en largeur d'abord (BFS) depuis le
//  point d'apparition du joueur, EXACTEMENT avec la règle de déplacement du
//  jeu : 4 directions, `regions.isWalkable(x, y)`.
//
//  Si le BFS n'atteint pas la porte, l'arène est inaccessible — et le joueur ne
//  peut rien y faire, quelle que soit la qualité du combat qui l'attend.
// =============================================================================
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function ctx2d() {
  const grad = { addColorStop() {} };
  return {
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {},
    fillText() {}, strokeText() {}, putImageData() {},
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {},
    set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
    set globalCompositeOperation(v) {},
  };
}
function fakeElement(tag) {
  return {
    tagName: String(tag || '').toUpperCase(), width: 128, height: 128,
    style: {}, dataset: {}, children: [], value: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    getContext: () => ctx2d(),
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {}, addEventListener() {}, removeEventListener() {},
    setAttribute() {}, getAttribute: () => null,
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }),
  };
}
const store = {
  _d: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};
const sandbox = {
  console, performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  document: {
    createElement: fakeElement, createElementNS: fakeElement,
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, readyState: 'complete', body: fakeElement('body'),
  },
  location: { hash: '', href: '', reload() {} },
  localStorage: store, navigator: { userAgent: 'node' }, Image: function () {}, self: null,
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  Blob: function () {}, FileReader: function () {}, alert() {},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function charger(f) {
  try { vm.runInContext(lire(f), sandbox, { filename: f, timeout: 30000 }); }
  catch (e) { console.error('ÉCHEC ' + f + ' : ' + e.message); process.exit(1); }
}

[
  'js3d/vendor/three.min.js', 'js3d/core3d.js', 'js3d/tiles3d.js', 'js3d/types3d.js',
  'js3d/moves3d.js', 'js3d/dex3d.js', 'js3d/creatures3d.lib.js',
  'js3d/creatures3d.p1.js', 'js3d/creatures3d.p2.js', 'js3d/creatures3d.p3.js',
  'js3d/creatures3d.p4.js', 'js3d/creatures3d.p5.js',
  'js3d/legendlib3d.js', 'js3d/legend3d.p1.js', 'js3d/legend3d.p2.js', 'js3d/legend3d.p3.js',
  'js3d/evolve3d.js', 'js3d/team3d.js', 'js3d/quest3d.js', 'js3d/tera3d.js',
  'js3d/shop3d.js', 'js3d/cities3d.js', 'js3d/arenas3d.js', 'js3d/regions3d.js',
].forEach(charger);

vm.runInContext('globalThis.__R3 = R3;', sandbox);
const R3 = sandbox.__R3;
const regions = R3.get('regions');
const cities = R3.get('cities');
const arenas = R3.get('arenas');

let echecs = 0;
function verifie(nom, ok, detail) {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + nom + (detail ? ' — ' + detail : ''));
  if (!ok) echecs++;
}

const RID = ['val', 'sylve', 'saphir', 'givre', 'braise', 'aurore'];

// ===========================================================================
//  Marche à pied : le BFS du joueur, 4 directions, règles du jeu.
// ===========================================================================
//  `bloquees` : les cases occupées par un PNJ. game3d.placeLibre() les refuse
//  au même titre qu'un mur — les ignorer, c'est précisément ce qui a laissé
//  passer le bug de l'arène foudre.
function marcheDepuis(sx, sy, w, h, bloquees) {
  const vus = new Set();
  const clef = (x, y) => y * 4096 + x;
  const file = [[sx, sy]];
  vus.add(clef(sx, sy));
  for (let k = 0; k < file.length; k++) {
    const x = file[k][0], y = file[k][1];
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (let m = 0; m < 4; m++) {
      const nx = nb[m][0], ny = nb[m][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const c = clef(nx, ny);
      if (vus.has(c)) continue;
      if (!regions.isWalkable(nx, ny)) continue;
      if (bloquees && bloquees.has(c)) continue;
      vus.add(c);
      file.push([nx, ny]);
    }
  }
  return vus;
}

console.log('\n=== 1. La porte de chaque arène existe et est atteignable à pied ===');

const DIM = 256;   // regions3d travaille sur une grille carrée ; on la balaie large

for (const rid of RID) {
  const rd = regions.load(rid);
  if (!rd) { verifie(rid + ' : région chargée', false, 'regions.load a renvoyé null'); continue; }

  // 1. Où sont les tuiles ARENA_DOOR réellement posées sur la carte ?
  const portes = [];
  for (let y = 0; y < DIM; y++) {
    for (let x = 0; x < DIM; x++) {
      if (regions.tileAt(x, y) === 'ARENA_DOOR') portes.push({ x, y });
    }
  }

  // 2. Ce que cities3d PRÉTEND (def.arena) — c'est ce que lit le reste du jeu.
  const cd = (cities && cities.get) ? cities.get(rid) : null;
  const annonce = cd && cd.arena ? cd.arena : null;

  const a = arenas.get(rid);
  const nom = (a && a.name) || rid;

  verifie(nom + ' : une tuile ARENA_DOOR sur la carte',
    portes.length >= 1,
    portes.length ? portes.map(p => '(' + p.x + ',' + p.y + ')').join(' ') : 'AUCUNE');

  if (annonce) {
    const t = regions.tileAt(annonce.x, annonce.y);
    verifie(nom + ' : def.arena pointe bien sur la porte',
      t === 'ARENA_DOOR',
      'def.arena=(' + annonce.x + ',' + annonce.y + ') est une tuile ' + t);
  }

  if (!portes.length) continue;

  // 3. Peut-on y aller à pied depuis le point d'apparition du joueur ?
  const sp = regions.spawnOf(rid);
  const spawnOk = regions.isWalkable(sp.x, sp.y);
  verifie(nom + ' : le point d\'apparition est marchable', spawnOk,
    '(' + sp.x + ',' + sp.y + ') = ' + regions.tileAt(sp.x, sp.y));
  if (!spawnOk) continue;

  // Les PNJ sont des obstacles pleins : on marche AVEC eux sur la carte.
  const bloquees = new Set();
  for (const n of (regions.npcsOf(rid) || [])) {
    if (n && typeof n.x === 'number') bloquees.add(n.y * 4096 + n.x);
  }
  const accessibles = marcheDepuis(sp.x, sp.y, DIM, DIM, bloquees);
  const atteintes = portes.filter(p => accessibles.has(p.y * 4096 + p.x));
  verifie(nom + ' : on peut MARCHER jusqu\'à la porte (PNJ compris)',
    atteintes.length >= 1,
    atteintes.length
      ? atteintes.map(p => '(' + p.x + ',' + p.y + ')').join(' ')
      : 'porte(s) ' + portes.map(p => '(' + p.x + ',' + p.y + ')').join(' ') + ' HORS D\'ATTEINTE');

  // 4. Diagnostic : la porte est-elle bordée d'au moins une case marchable ?
  for (const p of portes) {
    const voisins = [[p.x + 1, p.y], [p.x - 1, p.y], [p.x, p.y + 1], [p.x, p.y - 1]]
      .map(v => ({ x: v[0], y: v[1], t: regions.tileAt(v[0], v[1]), w: regions.isWalkable(v[0], v[1]) }));
    const libres = voisins.filter(v => v.w);
    if (!libres.length) {
      verifie(nom + ' : la porte (' + p.x + ',' + p.y + ') a un voisin marchable', false,
        'murée de tous côtés : ' + voisins.map(v => v.t).join(' / '));
    }
  }
}

// ===========================================================================
//  2. LE CHAMPION NE DOIT PAS BOUCHER SA PROPRE PORTE
//  arenas3d place le PNJ champion à (porte.x, porte.y + 1). Selon le côté de
//  la façade, cette case est soit le parvis, soit l'intérieur du bâtiment.
// ===========================================================================
//  On interroge la région, pas arenas3d : `championNpc()` ne donne que la place
//  SOUHAITÉE, c'est `regions3d` qui pose le PNJ pour de bon. Vérifier la
//  première reviendrait à relire l'intention au lieu du résultat.
console.log('\n=== 2. Le champion se tient sur une case valable ===');
for (const rid of RID) {
  regions.load(rid);
  const a = arenas.get(rid);
  const nom = (a && a.name) || rid;
  const attendu = arenas.championNpc(rid);
  const npc = (regions.npcsOf(rid) || []).find(n => n && n.isChampion);
  if (!npc || npc.x == null) { verifie(nom + ' : champion posé sur la carte', false, 'introuvable'); continue; }
  const t = regions.tileAt(npc.x, npc.y);
  verifie(nom + ' : ' + npc.name + ' est sur une case marchable',
    regions.isWalkable(npc.x, npc.y),
    '(' + npc.x + ',' + npc.y + ') = ' + t);

  // Et il reste devant SON arène : un champion relégué à dix cases de sa porte
  // ne se laisse plus trouver.
  const d = attendu ? (Math.abs(npc.x - attendu.x) + Math.abs(npc.y - attendu.y)) : 99;
  verifie(nom + ' : ' + npc.name + ' reste devant sa porte', d <= 3,
    'à ' + d + ' case(s) du parvis');
}

// ===========================================================================
//  3. PERSONNE NE BOUCHE LA PORTE
//  Les PNJ sont solides : un dresseur, un badaud ou le champion lui-même posé
//  SUR la tuile ARENA_DOOR — ou sur son unique case d'approche — rend l'arène
//  impossible à atteindre alors que la carte, elle, est parfaite.
// ===========================================================================
console.log('\n=== 3. Aucun PNJ ne bouche la porte ni son parvis ===');
for (const rid of RID) {
  regions.load(rid);
  const a = arenas.get(rid);
  const nom = (a && a.name) || rid;
  const cd = (cities && cities.get) ? cities.get(rid) : null;
  if (!cd || !cd.arena) continue;
  const px = cd.arena.x, py = cd.arena.y;

  // Le parvis : les cases marchables qui touchent la porte.
  const parvis = [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]
    .filter(v => regions.isWalkable(v[0], v[1]));

  const npcs = regions.npcsOf(rid) || [];
  const surPorte = npcs.filter(n => n && n.x === px && n.y === py);
  verifie(nom + ' : la tuile de la porte est libre',
    surPorte.length === 0,
    surPorte.length ? surPorte.map(n => n.name + ' (' + n.id + ')').join(', ')
                    : 'porte (' + px + ',' + py + ')');

  const occupes = parvis.filter(v => npcs.some(n => n && n.x === v[0] && n.y === v[1]));
  verifie(nom + ' : il reste au moins une case libre devant la porte',
    parvis.length > occupes.length,
    parvis.length + ' case(s) d\'approche, ' + occupes.length + ' occupée(s) par un PNJ');
}

console.log('\n' + (echecs === 0
  ? '✓ TOUT EST BON : les six arènes sont accessibles.'
  : '✗ ' + echecs + ' problème(s). Voir les lignes ✗ ci-dessus.'));
process.exit(echecs === 0 ? 0 : 1);
