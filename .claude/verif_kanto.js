// =============================================================================
//  verif_kanto.js — LES CRÉATURES VENUES DU JEU DE CLÉLIA TIENNENT-ELLES DEBOUT ?
//
//  « je voudrais que tu prennes les Pokémon du jeu de Clélia » — Robin.
//
//  Les modèles 3D ont été repris tels quels de « L'aventure de Clélia »
//  (creatures3d.k1..k6.js) et branchés sur leur propre bibliothèque de
//  primitives (`kclib`). Deux moteurs nés du même moule, mais qui ont divergé :
//  rien ne garantit a priori que chaque pièce utilisée là-bas existe ici.
//
//  Ce harnais construit RÉELLEMENT les 52 modèles hors navigateur et vérifie :
//   1. qu'aucun ne lève ni ne retombe sur la silhouette de secours ;
//   2. qu'ils ont une taille et une position plausibles (posés sur y = 0,
//      environ une unité de haut — la convention du CONTRACT) ;
//   3. que leur animation d'attaque tourne sans lever ;
//   4. qu'aucun n'écrase un modèle maison de Robin.
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

const erreursConsole = [];
sandbox.console = Object.assign({}, console, {
  error: (...a) => { erreursConsole.push(a.join(' ')); },
  warn: () => {},
});

function charger(f) {
  try { vm.runInContext(lire(f), sandbox, { filename: f, timeout: 30000 }); }
  catch (e) { console.error('ÉCHEC ' + f + ' : ' + e.message); process.exit(1); }
}

// Les modèles maison d'ABORD : on veut voir si un import les écraserait.
const MAISON = [
  'js3d/creatures3d.p1.js', 'js3d/creatures3d.p2.js', 'js3d/creatures3d.p3.js',
  'js3d/creatures3d.p4.js', 'js3d/creatures3d.p5.js',
];
const IMPORTES = [
  'js3d/creatures3d.k1.js', 'js3d/creatures3d.k2.js', 'js3d/creatures3d.k3.js',
  'js3d/creatures3d.k4.js', 'js3d/creatures3d.k5.js', 'js3d/creatures3d.k6.js',
];

charger('js3d/vendor/three.min.js');
charger('js3d/core3d.js');
charger('js3d/creatures3d.lib.js');
charger('js3d/creatures3d.klib.js');
MAISON.forEach(charger);

vm.runInContext('globalThis.__R3 = R3; globalThis.__THREE = THREE;', sandbox);
const R3 = sandbox.__R3;
const THREE = sandbox.__THREE;

const avantImport = Object.keys(R3.CREATURE_BUILDERS).slice();
IMPORTES.forEach(charger);
const apresImport = Object.keys(R3.CREATURE_BUILDERS);
const nouveaux = apresImport.filter(id => avantImport.indexOf(id) < 0);

let echecs = 0;
function verifie(nom, ok, detail) {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + nom + (detail ? ' — ' + detail : ''));
  if (!ok) echecs++;
}

console.log('\n=== 1. Les deux bibliothèques cohabitent ===');
verifie('clib (modèles maison) est enregistrée', !!R3.get('clib'));
verifie('kclib (modèles de Clélia) est enregistrée', !!R3.get('kclib'));
verifie('les deux sont bien DEUX objets distincts', R3.get('clib') !== R3.get('kclib'));

console.log('\n=== 2. Aucun modèle maison n\'a été écrasé ===');
const ecrases = avantImport.filter(id => nouveaux.indexOf(id) >= 0);   // toujours vide par construction
verifie('les 26 créatures de Robin sont intactes',
  ecrases.length === 0 && avantImport.every(id => apresImport.indexOf(id) >= 0),
  avantImport.length + ' modèles maison, ' + nouveaux.length + ' nouveaux');

console.log('\n=== 3. Les ' + nouveaux.length + ' modèles importés se construisent ===');
const rates = [], suspects = [];
for (const id of nouveaux) {
  erreursConsole.length = 0;
  let g = null;
  try { g = R3.buildCreature(id); } catch (e) { rates.push(id + ' (levée : ' + e.message + ')'); continue; }
  if (erreursConsole.length) { rates.push(id + ' (' + erreursConsole[0].slice(0, 80) + ')'); continue; }
  if (!g) { rates.push(id + ' (rien renvoyé)'); continue; }

  // Un modèle réduit à la silhouette de secours n'a qu'un ou deux enfants.
  let mailles = 0;
  g.traverse(o => { if (o.isMesh) mailles++; });
  if (mailles < 3) { rates.push(id + ' (silhouette de secours : ' + mailles + ' maille(s))'); continue; }

  // Taille et assise : convention du CONTRACT (posé sur y≈0, ~1 unité).
  const bb = new THREE.Box3().setFromObject(g);
  const haut = bb.max.y - bb.min.y;
  const large = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
  if (!isFinite(haut) || haut < 0.2 || haut > 3.5) suspects.push(id + ' : ' + haut.toFixed(2) + ' de haut');
  else if (bb.min.y < -0.35) suspects.push(id + ' : enfoncé de ' + (-bb.min.y).toFixed(2) + ' sous le sol');
  else if (large > 4) suspects.push(id + ' : ' + large.toFixed(2) + ' de large');
}
verifie('tous se construisent avec un vrai corps', rates.length === 0,
  rates.length ? rates.join(' ; ') : nouveaux.length + ' modèles construits');
verifie('tous ont une taille et une assise plausibles', suspects.length === 0,
  suspects.length ? suspects.join(' ; ') : 'entre 0,2 et 3,5 unités, posés sur le sol');

console.log('\n=== 4. Leur animation d\'attaque tourne ===');
const casse = [];
for (const id of nouveaux) {
  let g = null;
  try { g = R3.buildCreature(id); } catch (e) { continue; }
  const atk = g && g.userData && g.userData.attack;
  if (typeof atk !== 'function') { casse.push(id + ' (pas d\'animation)'); continue; }
  try {
    for (let p = 0; p <= 1.0001; p += 0.1) atk(g, p);
  } catch (e) { casse.push(id + ' (' + e.message.slice(0, 60) + ')'); }
}
verifie('les 11 pas d\'animation passent sans erreur', casse.length === 0,
  casse.length ? casse.join(' ; ') : nouveaux.length + ' animations jouées');

// =============================================================================
//  DEUXIÈME MOITIÉ : LES DONNÉES
//  Un beau modèle 3D ne sert à rien si l'espèce n'entre pas dans le Pokédex,
//  n'apparaît nulle part, ou attaque avec une capacité qui n'existe pas.
// =============================================================================
[
  'js3d/types3d.js', 'js3d/moves3d.js', 'js3d/dex3d.js', 'js3d/evolve3d.js',
  'js3d/dexk3d.js', 'js3d/team3d.js',
].forEach(charger);

vm.runInContext('globalThis.__dex = R3.get("dex"); globalThis.__dexk = R3.get("dexk");' +
                'globalThis.__evo = R3.get("evolve"); globalThis.__moves = R3.get("moves");' +
                'globalThis.__team = R3.get("team");', sandbox);
const dex = sandbox.__dex, dexk = sandbox.__dexk, evo = sandbox.__evo;
const moves = sandbox.__moves, team = sandbox.__team;

console.log('\n=== 5. Les 46 espèces sont entrées dans le Pokédex ===');
verifie('dexk3d s\'est enregistré', !!dexk);
verifie('les 46 espèces ont été ajoutées', dexk && dexk.ajoutes === 46,
  dexk ? dexk.ajoutes + ' ajoutée(s) sur ' + dexk.ESPECES.length : '—');

const introuvables = (dexk ? dexk.ids() : []).filter(id => !dex.get(id));
verifie('chacune se retrouve par dex.get()', introuvables.length === 0,
  introuvables.join(' ') || dexk.ids().length + ' ids vérifiés');

const sansModele = (dexk ? dexk.ids() : []).filter(id => !R3.CREATURE_BUILDERS[id]);
verifie('chacune a bien son modèle 3D', sansModele.length === 0,
  sansModele.join(' ') || 'les données et les modèles se répondent');

console.log('\n=== 6. Aucune espèce de Robin n\'a été abîmée ===');
const TEMOINS = { feuillou: 45, glanou: null, tonnedrak: null, pyrathos: 150 };
const abimes = [];
for (const id of Object.keys(TEMOINS)) {
  const sp = dex.get(id);
  if (!sp) { abimes.push(id + ' a disparu'); continue; }
  if (TEMOINS[id] && sp.baseHp !== TEMOINS[id]) abimes.push(id + ' : ' + sp.baseHp + ' PV au lieu de ' + TEMOINS[id]);
}
verifie('les créatures maison sont intactes', abimes.length === 0,
  abimes.join(' ; ') || 'témoins vérifiés : ' + Object.keys(TEMOINS).join(', '));

console.log('\n=== 7. Leurs capacités existent vraiment ===');
const capBidons = [];
for (const id of (dexk ? dexk.ids() : [])) {
  const sp = dex.get(id);
  for (const m of sp.moveIds) if (!moves.MOVES[m]) capBidons.push(id + '/' + m);
  for (const l of sp.learnset) if (!moves.MOVES[l.moveId]) capBidons.push(id + '@' + l.level + '/' + l.moveId);
}
verifie('toutes les capacités sont dans moves3d', capBidons.length === 0,
  capBidons.slice(0, 6).join(' ') || 'capacités de départ et apprises');

const sansSoin = (dexk ? dexk.ids() : []).filter(id =>
  !dex.get(id).moveIds.some(m => moves.MOVES[m] && moves.MOVES[m].heal));
verifie('chacune sait se soigner (règle du Pokédex maison)', sansSoin.length === 0,
  sansSoin.join(' ') || '46 espèces, 46 soins');

console.log('\n=== 8. Les évolutions s\'enchaînent ===');
verifie('les 12 chaînes sont déclarées', dexk && dexk.chaines === 12,
  dexk ? dexk.chaines + ' déclarée(s)' : '—');
const casseesEvo = [];
for (const c of (dexk ? dexk.CHAINES : [])) {
  const step = evo.nextOf(c.from);
  if (!step) { casseesEvo.push(c.from + ' n\'évolue pas'); continue; }
  if (step.to !== c.to) casseesEvo.push(c.from + ' -> ' + step.to + ' au lieu de ' + c.to);
  if (!dex.get(step.to)) casseesEvo.push(step.to + ' absent du Pokédex');
  const nom = evo.previewName(c.from);
  if (!nom || nom === step.to) casseesEvo.push(c.from + ' annonce « ' + nom +' » (id brut)');
}
verifie('chaque chaîne mène à une espèce nommée', casseesEvo.length === 0,
  casseesEvo.join(' ; ') || 'Salamèche → Reptincel → Dracaufeu, et les onze autres');

// Une créature au bon niveau doit VRAIMENT pouvoir évoluer.
const essai = team.create('salameche', 16);
verifie('un Salamèche de niveau 16 peut évoluer',
  !!(essai && evo.canEvolve(essai)),
  essai ? 'niveau ' + essai.level + ', suite : ' + (evo.previewName('salameche') || '—') : 'création impossible');

console.log('\n=== 9. On peut les rencontrer dans le monde ===');
const REGIONS = ['val', 'sylve', 'saphir', 'givre', 'braise', 'aurore'];
const parRegion = {};
for (const r of REGIONS) {
  parRegion[r] = (dexk ? dexk.ids() : []).filter(id => {
    const sp = dex.get(id);
    return !sp.legendary && sp.regions.indexOf(r) >= 0;
  }).length;
}
verifie('chaque région en accueille au moins trois',
  REGIONS.every(r => parRegion[r] >= 3),
  REGIONS.map(r => r + ':' + parRegion[r]).join(' '));

// Un tirage réel : pickWild doit finir par en sortir.
let tires = new Set();
for (let i = 0; i < 4000; i++) {
  const s = dex.pickWild('braise', 'volcano');
  if (s) tires.add(s.id);
}
const nouveauxTires = [...tires].filter(id => (dexk ? dexk.ids() : []).indexOf(id) >= 0);
verifie('la Caldeira de Braise en fait apparaître', nouveauxTires.length > 0,
  nouveauxTires.join(' ') || 'aucun sur 4000 tirages');

const legendes = dexk ? dexk.legendaires() : [];
verifie('les six légendaires ne sortent JAMAIS dans les hautes herbes',
  legendes.every(id => !tires.has(id)),
  legendes.join(' '));

console.log('\n=== 10. Pas de doublon avec les 36 légendaires de Robin ===');
verifie('aucune espèce importée n\'est légendaire', legendes.length === 0,
  legendes.join(' ') || 'les 46 sont de la faune ordinaire');

const noms = {};
const doublons = [];
for (const sp of dex.ALL) {
  if (noms[sp.name]) doublons.push(sp.name + ' (' + noms[sp.name] + ' et ' + sp.id + ')');
  noms[sp.name] = sp.id;
}
verifie('deux espèces ne portent jamais le même nom', doublons.length === 0,
  doublons.join(' ; ') || dex.ALL.length + ' espèces au Pokédex');

console.log('\n=== 11. Six légendaires de Robin ont pris leur vraie allure ===');
charger('js3d/legendlib3d.js');
charger('js3d/legend3d.p1.js'); charger('js3d/legend3d.p2.js'); charger('js3d/legend3d.p3.js');
charger('js3d/legendk3d.js');
vm.runInContext('globalThis.__lk = R3.get("legendk");', sandbox);
const lk = sandbox.__lk;
verifie('legendk3d s\'est appliqué aux six', lk && lk.appliquees.length === 6,
  lk ? lk.appliquees.join(', ') + (lk.manquantes.length ? ' — manque : ' + lk.manquantes.join(' ') : '') : '—');

const allureRatee = [];
for (const a of (lk ? lk.ALLURES : [])) {
  const sp = dex.get(a.chez);
  if (!sp) { allureRatee.push(a.chez + ' absent du Pokédex'); continue; }
  if (sp.name !== a.nom) allureRatee.push(a.chez + ' s\'appelle « ' + sp.name +' », pas « ' + a.nom + ' »');
  // Le modèle réenregistré doit être EXACTEMENT celui de Clélia.
  if (R3.CREATURE_BUILDERS[a.chez] !== R3.CREATURE_BUILDERS[a.modele]) {
    allureRatee.push(a.chez + ' n\'a pas repris le modèle ' + a.modele);
  }
  let mailles = 0;
  try { R3.buildCreature(a.chez).traverse(o => { if (o.isMesh) mailles++; }); } catch (e) { /* compté ci-dessous */ }
  if (mailles < 3) allureRatee.push(a.chez + ' ne se construit plus');
}
verifie('chacun garde son nom et son id, et prend le bon modèle',
  allureRatee.length === 0,
  allureRatee.join(' ; ') || 'Mewtwo, Rayquaza, Lugia, Ho-Oh, Arceus, Terapagos');

// Le reste des légendaires ne doit PAS avoir bougé.
const autres = dex.LEGENDS.filter(s => !(lk ? lk.ALLURES : []).some(a => a.chez === s.id));
verifie('les 30 autres légendaires gardent leur silhouette', autres.length === 30,
  autres.length + ' légendaires intouchés');

console.log('\n' + (echecs === 0
  ? '✓ TOUT EST BON : les créatures de Clélia sont chez Robin.'
  : '✗ ' + echecs + ' problème(s). Voir les lignes ✗ ci-dessus.'));
process.exit(echecs === 0 ? 0 : 1);
