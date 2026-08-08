// =============================================================================
//  verif_legendaires.js — les 36 gardiens portent-ils le bon nom, et n'y en
//  a-t-il vraiment qu'UN de chaque ?
//
//  Sur le modèle de .claude/verif_pnj.js : on exécute les VRAIS modules 3D hors
//  navigateur et on les interroge. Deux chantiers du 2026-08-08 sont couverts.
//
//  1. LES NOMS (demande du parent). Les 36 légendaires inventés portent
//     désormais de vrais noms de Pokémon, comme dans le jeu de Clélia. Les IDS
//     n'ont pas bougé — c'est ce qui protège la sauvegarde de Robin — et les
//     surnoms figés dans une partie commencée avant sont réparés à la relecture.
//
//  2. UN SEUL EXEMPLAIRE (retour de Robin : « 1 seul de chaque et pas le même
//     légendaire partout »). Un autel dont le gardien est capturé s'éteint POUR
//     DE BON, et l'état survit à une sauvegarde.
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
const dex = R3.get('dex');
const quest = R3.get('quest');
const team = R3.get('team');
const regions = R3.get('regions');

let echecs = 0;
function verifie(nom, ok, detail) {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + nom + (detail ? ' — ' + detail : ''));
  if (!ok) echecs++;
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LES 36 LÉGENDAIRES — noms réels et exemplaire unique        ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// ===========================================================================
//  1. LES 36 PORTENT UN VRAI NOM DE POKÉMON
// ===========================================================================
console.log('\n=== 1. Les noms ===');

const LEGENDS = dex.LEGENDS || [];
verifie('le Pokédex compte bien 36 légendaires', LEGENDS.length === 36, LEGENDS.length + ' trouvés');

// La table attendue : id (jamais changé) -> nom affiché (nouveau).
const ATTENDU = {
  pyrathos: 'Groudon', emberyx: 'Ho-Oh', fournalis: 'Entei',
  abyssalor: 'Kyogre', ondinae: 'Suicune', marea: 'Lugia',
  sylvaros: 'Xerneas', florabelle: 'Shaymin', racinor: 'Regigigas',
  fulguron: 'Électhor', voltaris: 'Raikou', orageon: 'Boréas',
  cryonix: 'Kyurem', givrea: 'Blizzeval', banquisor: 'Regice',
  bourrasca: 'Fulguris', zephyrion: 'Rayquaza', aelune: 'Cresselia',
  geomastre: 'Terapagos', terracor: 'Démétéros', limonis: 'Regirock',
  monolithe: 'Registeel', cristallia: 'Diancie', obsidion: 'Mewtwo',
  aureol: 'Arceus', solaria: 'Sulfura', prismee: 'Jirachi',
  nyxaroth: 'Zacian', penombra: 'Marshadow', eclipsion: 'Yveltal',
  chronoss: 'Dialga', eternia: 'Celebi', sablion: 'Giratina',
  vortexis: 'Palkia', astralis: 'Eternatus', nebulon: 'Lunala',
};
const faux = [];
for (const id in ATTENDU) {
  const s = dex.get(id);
  if (!s) { faux.push(id + ' : ABSENT du Pokédex'); continue; }
  if (s.name !== ATTENDU[id]) faux.push(id + ' -> « ' + s.name +' » (attendu « ' + ATTENDU[id] + ' »)');
}
verifie('chaque id porte le nom prévu', faux.length === 0,
  faux.length ? faux.slice(0, 4).join(' ; ') : '36 ids vérifiés');

// Les six légendaires du jeu de Clélia sont bien tous là — c'était la demande.
const CLELIA = ['Mewtwo', 'Rayquaza', 'Lugia', 'Ho-Oh', 'Arceus', 'Terapagos'];
const noms = LEGENDS.map(s => s.name);
const absents = CLELIA.filter(n => noms.indexOf(n) < 0);
verifie('les 6 légendaires du jeu de Clélia figurent tous dans celui de Robin',
  absents.length === 0, absents.length ? 'manquent : ' + absents.join(', ') : CLELIA.join(', '));

// Aucun doublon : deux gardiens du même nom seraient exactement le reproche
// de Robin, « le même légendaire partout ».
const vus = {}, doublons = [];
noms.forEach(function (n) { if (vus[n]) doublons.push(n); vus[n] = true; });
verifie('aucun nom n\'est porté par deux légendaires', doublons.length === 0,
  doublons.length ? doublons.join(', ') : noms.length + ' noms distincts');

// Plus aucun nom inventé ne traîne.
const ANCIENS = ['Pyrathos', 'Sylvaros', 'Cryonix', 'Auréol', 'Nyxaroth', 'Vortexis',
  'Abyssalor', 'Monolithe', 'Chronoss', 'Bourrasca', 'Géomastre', 'Fournalis'];
const restants = ANCIENS.filter(n => noms.indexOf(n) >= 0);
verifie('aucun ancien nom inventé ne subsiste', restants.length === 0,
  restants.length ? restants.join(', ') : 'vérifié sur ' + ANCIENS.length + ' échantillons');

// Chacun garde son titre, et le titre a suivi le nouveau nom.
const sansTitre = LEGENDS.filter(s => !s.title);
verifie('les 36 ont un titre', sansTitre.length === 0,
  sansTitre.length ? sansTitre.map(s => s.id).join(', ') : 'ex. : ' + dex.get('sylvaros').name
    + ', ' + dex.get('sylvaros').title);

// ===========================================================================
//  2. LES IDS N'ONT PAS BOUGÉ — la sauvegarde de Robin doit survivre
// ===========================================================================
console.log('\n=== 2. Les ids, les modèles 3D et les autels ===');

const sansModele = LEGENDS.filter(function (s) {
  const b = R3.CREATURE_BUILDERS || {};
  return typeof b[s.id] !== 'function';
});
verifie('les 36 ids ont toujours leur modèle 3D dessiné', sansModele.length === 0,
  sansModele.length ? sansModele.map(s => s.id).join(', ') : '36 modèles enregistrés');

// Un autel par légendaire, un légendaire par autel, dans les six régions.
const autels = [];
(quest.ORDER || []).forEach(function (rid) {
  const r = regions.get(rid);
  (r && r.altars ? r.altars : []).forEach(function (a) { autels.push(a.id); });
});
const autelsUniques = new Set(autels);
verifie('36 autels, tous distincts', autels.length === 36 && autelsUniques.size === 36,
  autels.length + ' autels, ' + autelsUniques.size + ' ids distincts');
const orphelins = LEGENDS.filter(s => autelsUniques.has(s.id) === false);
verifie('chaque légendaire a son propre autel', orphelins.length === 0,
  orphelins.length ? orphelins.map(s => s.id).join(', ') : 'appariement complet');

// ===========================================================================
//  3. UN SEUL EXEMPLAIRE DE CHAQUE
//  C'est le retour de Robin. Avant, l'autel se reposait dix minutes après la
//  capture… puis rallumait le MÊME gardien.
// ===========================================================================
console.log('\n=== 3. « 1 seul de chaque » ===');

quest.reset();
const RID = 'val';
const q = quest.get(RID);
const cible = q.legendaires[0];

quest.hear(RID); quest.open(RID);
verifie('sanctuaire ouvert : le gardien est éveillé', quest.isLegendAwake(cible) === true,
  dex.get(cible).name + ' attend à son autel');

quest.onLegendCaught(cible);
verifie('une fois capturé, son autel s\'éteint', quest.isLegendAwake(cible) === false,
  dex.get(cible).name + ' est dans la boîte de Robin');
verifie('quest.isLegendCaught() le confirme', quest.isLegendCaught(cible) === true);
verifie('les AUTRES gardiens de la région restent éveillés',
  q.legendaires.slice(1).every(id => quest.isLegendAwake(id) === true),
  (q.legendaires.length - 1) + ' autres autels toujours actifs');

const eveilles = quest.awakeLegends(RID);
verifie('awakeLegends() ne propose plus le gardien capturé',
  eveilles.indexOf(cible) < 0 && eveilles.length === q.legendaires.length - 1,
  eveilles.length + ' proposés sur ' + q.legendaires.length);

// L'extinction survit à une sauvegarde : sans ça, il suffisait de recharger la
// partie pour retrouver le même légendaire sur son autel.
const sauvegarde = JSON.parse(JSON.stringify(quest.serialize()));
quest.reset();
quest.deserialize(sauvegarde);
verifie('après sauvegarde et rechargement, l\'autel reste éteint',
  quest.isLegendAwake(cible) === false,
  'état relu : ' + (quest.isLegendCaught(cible) ? 'capturé' : 'PERDU'));

// Une espèce hors quête n'est jamais bridée par ce verrou.
verifie('une créature ordinaire n\'est pas concernée',
  quest.isLegendAwake('flamiche') !== false && quest.isLegendCaught('flamiche') === false);

// Personne d'autre n'aligne deux légendaires à la fois. « Qu'il n'y ait à
// chaque fois qu'un Pokémon s'il est légendaire » : les champions d'arène en
// ont un seul, leur as, jamais deux.
const arenas = R3.get('arenas');
const trop = [];
(arenas && arenas.list ? arenas.list() : []).forEach(function (ch) {
  const eq = (ch && ch.team) ? ch.team : [];
  const legs = eq.filter(function (m) { return dex.isLegendary(m.id); });
  if (legs.length > 1) trop.push(ch.name + ' : ' + legs.map(m => dex.get(m.id).name).join(' + '));
});
verifie('aucun champion n\'aligne deux légendaires à la fois', trop.length === 0,
  trop.length ? trop.join(' ; ') : 'les 6 arènes vérifiées');

// ===========================================================================
//  4. LES PARTIES COMMENCÉES AVANT LE CHANGEMENT DE NOM
//  `nick` est figé à la capture : sans réparation, la boîte dirait « Pyrathos »
//  et le Pokédex « Groudon », dans la même partie.
// ===========================================================================
console.log('\n=== 4. Les surnoms d\'une partie déjà commencée ===');

verifie('dex.isLegacyName() reconnaît un ancien nom',
  dex.isLegacyName('pyrathos', 'Pyrathos') === true
  && dex.isLegacyName('pyrathos', 'Groudon') === false
  && dex.isLegacyName('pyrathos', 'Croquette') === false);

team.deserialize({
  team: [
    { id: 'pyrathos', level: 50, nick: 'Pyrathos' },     // jamais renommé
    { id: 'sylvaros', level: 50, nick: 'Croquette' },    // renommé par Robin
    { id: 'marea', level: 50, nick: 'Maréa' },           // ancien nom accentué
  ],
  box: [],
});
const equipe = team.team.slice();
const parId = {};
equipe.forEach(function (m) { parId[m.id] = m; });
verifie('un légendaire jamais renommé reprend son nouveau nom',
  parId.pyrathos && parId.pyrathos.nick === 'Groudon',
  parId.pyrathos ? '« Pyrathos » ➜ « ' + parId.pyrathos.nick + ' »' : 'créature perdue');
verifie('un ancien nom accentué est reconnu lui aussi',
  parId.marea && parId.marea.nick === 'Lugia',
  parId.marea ? '« Maréa » ➜ « ' + parId.marea.nick + ' »' : 'créature perdue');
verifie('le surnom choisi par Robin est INTOUCHABLE',
  parId.sylvaros && parId.sylvaros.nick === 'Croquette',
  parId.sylvaros ? '« ' + parId.sylvaros.nick + ' » conservé' : 'créature perdue');

// ===========================================================================
console.log('\n' + (echecs === 0
  ? '✅ Tout est conforme : 36 vrais noms, un seul exemplaire de chacun.'
  : '❌ ' + echecs + ' épreuve(s) en échec.'));
process.exit(echecs === 0 ? 0 : 1);
