// =============================================================================
//  verif_chaos.js — LES CATACLYSMES, LES DÉRÈGLEMENTS ET LES DEUX MÉCHANTS
//
//  Demandes de Robin du 9 août 2026 :
//    · « des séismes, des tsunamis, des tremblements de terre aléatoires, et
//       que ça détruise des choses sur la carte » ;
//    · « quand les Pokémon légendaires se battent, tout se dérègle » ;
//    · « le méchant Spinel… qu'il hypnotise tout le monde » ;
//    · « il peut faire alliance avec Veccus ».
//
//  LE TEST QUI COMPTE VRAIMENT est le n° 3 : un cataclysme ne doit JAMAIS
//  pouvoir enfermer Robin ni condamner une porte. On déclenche donc des
//  centaines de catastrophes sur une vraie carte et on vérifie, après chacune,
//  qu'on peut toujours marcher partout où l'on pouvait marcher avant.
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
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { userAgent: 'node' }, Image: function () {}, self: null,
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
  'js3d/moves3d.js', 'js3d/dex3d.js', 'js3d/evolve3d.js', 'js3d/dexk3d.js',
  'js3d/legends3d.js', 'js3d/team3d.js', 'js3d/quest3d.js', 'js3d/tera3d.js',
  'js3d/shop3d.js', 'js3d/cities3d.js', 'js3d/arenas3d.js', 'js3d/regions3d.js',
  'js3d/cataclysme3d.js', 'js3d/mechants3d.js',
].forEach(charger);

vm.runInContext('globalThis.__R3 = R3;', sandbox);
const R3 = sandbox.__R3;
const regions = R3.get('regions');
const cata = R3.get('cataclysme');
const mech = R3.get('mechants');
const dex = R3.get('dex');
const LG = R3.get('legends');

let echecs = 0;
function verifie(nom, ok, detail) {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + nom + (detail ? ' — ' + detail : ''));
  if (!ok) echecs++;
}

const RID = ['val', 'sylve', 'saphir', 'givre', 'braise', 'aurore'];

// ===========================================================================
//  1. LES CATASTROPHES EXISTENT ET ABÎMENT VRAIMENT
// ===========================================================================
console.log('\n=== 1. Les catastrophes abîment la carte ===');
verifie('cataclysme3d s\'est enregistré', !!cata);
verifie('quatre catastrophes déclarées', cata && cata.CATASTROPHES.length === 4,
  cata ? cata.CATASTROPHES.map(k => k.nom).join(', ') : '—');

regions.load('val');
const spawn = regions.spawnOf('val');
let totalTuiles = 0;
for (let i = 0; i < 12; i++) {
  const r = cata.declencher('seisme', spawn.x + (i % 5) * 3, spawn.y + (i % 4) * 3, {});
  if (r) totalTuiles += r.tuiles;
}
verifie('un séisme change réellement des tuiles', totalTuiles > 0,
  totalTuiles + ' tuiles abîmées en 12 secousses');

// Chaque catastrophe doit savoir transformer quelque chose.
const steriles = cata.CATASTROPHES.filter(k => Object.keys(k.change).length < 5);
verifie('chacune sait transformer au moins cinq sortes de tuiles', steriles.length === 0,
  steriles.map(k => k.nom).join(' ') ||
  cata.CATASTROPHES.map(k => k.id + ':' + Object.keys(k.change).length).join(' '));

// ===========================================================================
//  2. ON NE POSE JAMAIS UNE TUILE INFRANCHISSABLE
// ===========================================================================
console.log('\n=== 2. Aucune catastrophe ne peut dresser un mur ===');
//  On interroge `tiles3d` directement : c'est la source de vérité sur la
//  marchabilité. Un test qui se rabattrait sur « je ne sais pas, donc c'est
//  bon » ne vaudrait rien — c'est précisément ici qu'un mur pourrait naître.
const tiles = R3.get('tiles');
const TT = tiles && tiles.TILES;
verifie('tiles3d répond (sans lui, ce test ne prouverait rien)', !!TT,
  TT ? Object.keys(TT).length + ' tuiles au catalogue' : 'ABSENT');

const dur = [], inconnues = [];
if (TT) {
  for (const k of cata.CATASTROPHES) {
    for (const depuis in k.change) {
      const vers = k.change[depuis];
      if (!TT[depuis]) inconnues.push(k.id + ' : ' + depuis + ' (départ inconnu)');
      if (!TT[vers]) { inconnues.push(k.id + ' : ' + vers + ' (arrivée inconnue)'); continue; }
      if (!TT[vers].walkable) dur.push(k.id + ' : ' + depuis + ' -> ' + vers);
    }
  }
}
verifie('toutes les tuiles d\'arrivée sont marchables', dur.length === 0,
  dur.join(' ; ') || 'les quatre tables vérifiées');
verifie('aucune table ne cite une tuile qui n\'existe pas', inconnues.length === 0,
  inconnues.join(' ; ') || 'départs et arrivées tous connus de tiles3d');

// ===========================================================================
//  3. LE TEST QUI COMPTE : ROBIN N'EST JAMAIS ENFERMÉ
//
//  On mesure ce qu'il peut atteindre à pied AVANT, on déchaîne cent
//  catastrophes sur toute la région, et on revérifie APRÈS. Une seule case
//  devenue inaccessible ferait échouer ce test.
// ===========================================================================
console.log('\n=== 3. Après cent catastrophes, tout reste accessible ===');

function marche(sx, sy) {
  const vus = new Set();
  const file = [[sx, sy]];
  vus.add(sy * 4096 + sx);
  for (let k = 0; k < file.length; k++) {
    const x = file[k][0], y = file[k][1];
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (let m = 0; m < 4; m++) {
      const nx = nb[m][0], ny = nb[m][1];
      if (nx < 0 || ny < 0 || nx > 255 || ny > 255) continue;
      const c = ny * 4096 + nx;
      if (vus.has(c) || !regions.isWalkable(nx, ny)) continue;
      vus.add(c); file.push([nx, ny]);
    }
  }
  return vus;
}

for (const rid of RID) {
  regions.load(rid);
  const sp = regions.spawnOf(rid);
  const avant = marche(sp.x, sp.y);

  // Les lieux vitaux de la région : ils doivent survivre à tout.
  const cities = R3.get('cities');
  const cd = (cities && cities.get) ? cities.get(rid) : null;
  const vitaux = [];
  if (cd) {
    if (cd.arena) vitaux.push(['la porte de l\'arène', cd.arena]);
    if (cd.heal) vitaux.push(['le centre de soins', cd.heal]);
    if (cd.shop) vitaux.push(['la boutique', cd.shop]);
  }

  const kinds = cata.CATASTROPHES.map(k => k.id);
  for (let i = 0; i < 100; i++) {
    const k = kinds[i % kinds.length];
    const x = 20 + Math.floor(Math.random() * 200);
    const y = 20 + Math.floor(Math.random() * 200);
    cata.declencher(k, x, y, {});
  }

  const apres = marche(sp.x, sp.y);
  const perdues = [];
  avant.forEach(c => { if (!apres.has(c)) perdues.push(c); });
  verifie(rid + ' : aucune case atteignable n\'a été perdue', perdues.length === 0,
    perdues.length ? perdues.length + ' cases coupées !' :
      avant.size + ' cases avant, ' + apres.size + ' après');

  const casses = vitaux.filter(v => regions.tileAt(v[1].x, v[1].y) === 'GRASS' ||
    !apres.has(v[1].y * 4096 + v[1].x));
  verifie(rid + ' : les lieux vitaux tiennent toujours', casses.length === 0,
    casses.map(v => v[0]).join(', ') ||
    vitaux.map(v => v[0]).join(', ') || 'aucun lieu à surveiller');
}

// ===========================================================================
//  4. LES DÉRÈGLEMENTS SUIVENT LE TYPE DU LÉGENDAIRE
// ===========================================================================
console.log('\n=== 4. « Celui du temps dérègle le temps » ===');
regions.load('val');
const attendus = [
  ['chronoss', 'Dialga', 'temps'],
  ['abyssalor', 'Kyogre', 'eau'],
  ['pyrathos', 'Groudon', 'feu'],
  ['cryonix', 'Kyurem', 'glace'],
  ['vortexis', 'Palkia', 'espace'],
];
const rates = [];
for (const [id, nom, type] of attendus) {
  const r = cata.deregler(id, 60, 60);
  if (!r) { rates.push(nom + ' ne dérègle rien'); continue; }
  if (r.texte.indexOf(nom.toUpperCase()) < 0) rates.push(nom + ' n\'est pas nommé dans le texte');
  const sp = dex.get(id);
  if (sp.types[0] !== type) rates.push(nom + ' n\'est plus de type ' + type);
}
verifie('chaque grand légendaire dérègle ce qui lui ressemble', rates.length === 0,
  rates.join(' ; ') || attendus.map(a => a[1] + '→' + a[2]).join(', '));

// Tous les légendaires doivent dérégler QUELQUE CHOSE : un gardien dont le
// passage ne change rien n'aurait pas l'air d'un gardien.
const muets = dex.LEGENDS.filter(s => !cata.deregler(s.id, 60, 60));
verifie('les 36 légendaires dérèglent tous quelque chose', muets.length === 0,
  muets.map(s => s.name).join(' ') || dex.LEGENDS.length + ' vérifiés');

// Et une créature ordinaire ne doit RIEN dérégler du tout.
verifie('un Pikachu ne fait pas trembler la terre', !cata.deregler('pikachu', 60, 60));

// ===========================================================================
//  5. SPINEL, VECCUS ET LES SEPT ACTES
// ===========================================================================
console.log('\n=== 5. L\'histoire tient debout ===');
verifie('mechants3d s\'est enregistré', !!mech);
verifie('sept actes', mech && mech.ACTES.length === 7,
  mech ? mech.ACTES.map(a => a.n + ':' + a.titre).join(' · ') : '—');

// La tension doit MONTER, jamais redescendre : le monde va de mal en pis.
let monte = true, prec = -1;
for (const a of mech.ACTES) { if (a.tension < prec) monte = false; prec = a.tension; }
verifie('la tension du monde monte d\'acte en acte', monte,
  mech.ACTES.map(a => a.tension).join(' → '));

// Chaque acte à partir du 1 doit avoir son texte d'entrée.
const sansTexte = mech.ACTES.filter(a => a.n > 0 && (!a.entree || a.entree.length < 40));
verifie('chaque acte s\'annonce par un vrai texte', sansTexte.length === 0,
  sansTexte.map(a => a.n).join(' ') || '6 entrées écrites');

// Les deux méchants apparaissent, et finissent par se battre.
let vuSpinel = false, vuVeccus = false, combatS = false, combatV = false;
for (let b = 0; b <= 6; b++) {
  for (const rid of RID) {
    const p = mech.pnjDeLaRegion(rid, b);
    if (!p) continue;
    if (p.villainId === 'spinel') { vuSpinel = true; if (p.isTrainer) combatS = true; }
    if (p.villainId === 'veccus') { vuVeccus = true; if (p.isTrainer) combatV = true; }
  }
}
verifie('Spinel se montre puis se bat', vuSpinel && combatS);
verifie('Veccus arrive puis se bat', vuVeccus && combatV);

// Leurs équipes doivent exister pour de vrai dans le Pokédex.
const equipesCassees = [];
for (const who of ['spinel', 'veccus']) {
  for (let a = 0; a <= 6; a++) {
    const e = mech.equipeDe(who, a);
    if (!e) continue;
    for (const m of e) if (!dex.get(m.id)) equipesCassees.push(who + '@' + a + ' : ' + m.id);
  }
}
verifie('leurs créatures existent toutes', equipesCassees.length === 0,
  equipesCassees.join(' ; ') || 'équipes de Spinel et de Veccus vérifiées');

console.log('\n=== 6. L\'hypnose touche les habitants, pas les champions ===');
const pnjVal = (regions.npcsOf('val') || []).map(n => n.id);
const compte = [];
for (let b = 0; b <= 6; b++) compte.push(pnjVal.filter(id => mech.estHypnotise(id, b)).length);
verifie('personne n\'est hypnotisé au tout début', compte[0] === 0, compte.join(' → '));
verifie('l\'hypnose gagne du terrain ensuite', compte[3] >= 2,
  compte[3] + ' habitants endormis sur ' + pnjVal.length + ' à trois badges');

const champions = pnjVal.filter(id => id.indexOf('champion') >= 0);
verifie('aucun champion d\'arène n\'est hypnotisé',
  champions.every(id => !mech.estHypnotise(id, 6)),
  champions.length + ' champion(s) vérifié(s) — une arène doit rester jouable');

// Toujours la même réponse pour le même habitant : sinon le village aurait
// l'air schizophrène, et Robin ne pourrait jamais dire « lui, il est bizarre ».
const stable = pnjVal.every(id => {
  const a = mech.estHypnotise(id, 4);
  for (let k = 0; k < 20; k++) if (mech.estHypnotise(id, 4) !== a) return false;
  return true;
});
verifie('un habitant endormi le reste', stable);

console.log('\n' + (echecs === 0
  ? '✓ TOUT EST BON : le monde tremble, se dérègle, et personne n\'y est enfermé.'
  : '✗ ' + echecs + ' problème(s). Voir les lignes ✗ ci-dessus.'));
process.exit(echecs === 0 ? 0 : 1);
