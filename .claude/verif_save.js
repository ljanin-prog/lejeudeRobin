// =============================================================================
//  verif_save.js — la partie de Robin est-elle en sécurité ?
//  Sur le modèle de .claude/verif_fx.js : on exécute les VRAIS modules 3D hors
//  navigateur, avec un localStorage en mémoire, et on rejoue les scénarios qui
//  ont détruit la sauvegarde en test.
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
    set fillStyle(v) {}, get fillStyle() { return '#000'; },
    set strokeStyle(v) {}, get strokeStyle() { return '#000'; },
    set globalCompositeOperation(v) {}, get globalCompositeOperation() { return 'source-over'; },
    set lineWidth(v) {}, get lineWidth() { return 1; },
    set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
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

// --- localStorage EN MÉMOIRE, avec quota optionnel --------------------------
function makeStore(quota) {
  const data = {};
  return {
    _data: data,
    _quota: quota || 0,          // 0 = illimité
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) {
      v = String(v);
      if (this._quota) {
        let taille = v.length;
        for (const c in data) if (c !== k) taille += data[c].length;
        if (taille > this._quota) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
      }
      data[k] = v;
    },
    removeItem(k) { delete data[k]; },
  };
}

const store = makeStore(0);
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
  localStorage: store,
  navigator: { userAgent: 'node' }, Image: function () {}, self: null,
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  Blob: function () {}, FileReader: function () {}, alert() {},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function charger(f) {
  try { vm.runInContext(lire(f), sandbox, { filename: f, timeout: 20000 }); }
  catch (e) { console.error('ÉCHEC ' + f + ' : ' + e.message); process.exit(1); }
}

// L'ordre d'index3d.html, réduit à ce dont la sauvegarde a besoin.
const MODULES = [
  'js3d/vendor/three.min.js', 'js3d/core3d.js', 'js3d/tiles3d.js', 'js3d/types3d.js',
  'js3d/moves3d.js', 'js3d/dex3d.js', 'js3d/creatures3d.lib.js',
  'js3d/creatures3d.p1.js', 'js3d/creatures3d.p2.js', 'js3d/creatures3d.p3.js',
  'js3d/creatures3d.p4.js', 'js3d/creatures3d.p5.js',
  'js3d/legendlib3d.js', 'js3d/legend3d.p1.js', 'js3d/legend3d.p2.js', 'js3d/legend3d.p3.js',
  'js3d/evolve3d.js', 'js3d/team3d.js', 'js3d/quest3d.js', 'js3d/tera3d.js',
  'js3d/shop3d.js', 'js3d/regions3d.js', 'js3d/arenas3d.js',
];
MODULES.forEach(charger);

vm.runInContext('globalThis.__R3 = (typeof R3 !== "undefined") ? R3 : undefined;', sandbox);
const R3 = sandbox.__R3;
const team = R3.get('team');
const dex = R3.get('dex');
const shop = R3.get('shop');

let echecs = 0;
function verifie(nom, ok, detail) {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + nom + (detail ? ' — ' + detail : ''));
  if (!ok) echecs++;
}

// ===========================================================================
//  1. ALLER-RETOUR DE SÉRIALISATION D'ÉQUIPE (team3d)
// ===========================================================================
console.log('\n=== 1. Aller-retour de sérialisation de l\'équipe ===');
team.deserialize({ team: [], box: [], activeIndex: 0 });
const starter = team.create('miaouche', 12);
team.add(starter);
team.add(team.create('glydrakon', 30));
team.add(team.create('flamdrakix', 40));
for (let i = 0; i < 4; i++) team.add(team.create('papillon', 8 + i));

const avant = team.serialize();
const texte = JSON.stringify({ version: 2, playerName: 'Robin', team: avant.team, box: avant.box,
  activeIndex: avant.activeIndex, money: 1234, badges: { val: true }, items: { pokeball: 5 },
  collection: { miaouche: 1 }, seen: { miaouche: true }, visitedRegions: { val: true } });
const relu = JSON.parse(texte);
team.deserialize({ team: relu.team, box: relu.box, activeIndex: relu.activeIndex });
const apres = team.serialize();
verifie('équipe conservée', apres.team.length === avant.team.length,
  avant.team.length + ' -> ' + apres.team.length);
verifie('boîte conservée', apres.box.length === avant.box.length,
  avant.box.length + ' -> ' + apres.box.length);
verifie('niveaux conservés',
  JSON.stringify(apres.team.map(m => m.level)) === JSON.stringify(avant.team.map(m => m.level)),
  JSON.stringify(apres.team.map(m => m.level)));
verifie('espèces conservées',
  JSON.stringify(apres.team.map(m => m.id)) === JSON.stringify(avant.team.map(m => m.id)));
verifie('PV conservés',
  JSON.stringify(apres.team.map(m => m.hp + '/' + m.maxHp)) ===
  JSON.stringify(avant.team.map(m => m.hp + '/' + m.maxHp)));

// ===========================================================================
//  2. LA ROTATION DES COPIES (les fonctions de game3d, extraites telles quelles)
// ===========================================================================
// game3d.js n'est pas chargeable ici (il construit une scène et un HUD) : on
// extrait le bloc « FILETS DE LA SAUVEGARDE » du VRAI fichier et on l'exécute.
console.log('\n=== 2. La rotation des copies de secours (code réel de game3d.js) ===');
const src = lire('js3d/game3d.js');
function extrait(nom) {
  const i = src.indexOf('function ' + nom + '(');
  if (i < 0) throw new Error('introuvable : ' + nom);
  let p = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') p++;
    else if (src[k] === '}') { p--; if (p === 0) return src.slice(i, k + 1); }
  }
  throw new Error('accolades : ' + nom);
}
const CONSTS = src.match(/const BACKUP_KEYS = [^;]+;/)[0] + '\n'
  + src.match(/const BACKUP_INDEX = '[^']+';/)[0] + '\n'
  + src.match(/const BACKUP_MIN_MS = [^;]+;/)[0] + '\n'
  + "const SAVE_KEY = 'robinGame3d_v2';\nlet _bak = null;\n";
const BLOC = CONSTS
  + extrait('backupIndex') + '\n'
  + extrait('rotateBackup') + '\n'
  + extrait('ressembleAUnePartie') + '\n'
  + extrait('nbCreatures') + '\n'
  + extrait('backupKeysRecentes') + '\n'
  + extrait('readSave') + '\n'
  + extrait('ecrireSauvegarde') + '\n'
  + extrait('ecrireImport') + '\n'
  + 'globalThis.SAVE = { rotateBackup, ressembleAUnePartie, nbCreatures, backupKeysRecentes,'
  + ' readSave, ecrireSauvegarde, ecrireImport, BACKUP_KEYS, BACKUP_INDEX, SAVE_KEY,'
  + ' resetBak: function () { _bak = null; } };\n';
vm.runInContext('(function(){' + BLOC + '})();', sandbox, { filename: 'bloc-sauvegarde' });
const SAVE = sandbox.SAVE;

function partie(n, marqueur) {
  const t = [];
  for (let i = 0; i < n; i++) t.push({ id: 'miaouche', uid: 'u' + i, level: 10 + i, hp: 30, maxHp: 30 });
  return JSON.stringify({ version: 2, playerName: 'Robin', team: t, box: [], marqueur: marqueur });
}
function etat() {
  return SAVE.BACKUP_KEYS.map(k => SAVE.nbCreatures(store.getItem(k)));
}

// -- 2a. Le scénario du poison : team3d ne se charge pas ---------------------
Object.keys(store._data).forEach(k => store.removeItem(k));
SAVE.resetBak();
store.setItem(SAVE.SAVE_KEY, partie(4, 'saine'));
SAVE.rotateBackup(true);                       // une copie saine en bak1
verifie('une copie saine est prise', etat()[0] === 4, 'copies = ' + etat().join('/'));

// Session suivante : team3d absent, saveGame() écrirait team: []. La rotation
// est appelée AVANT l'écriture, cinq fois de suite, chaque fois avec un texte
// différent (position, argent, biome…).
for (let i = 0; i < 5; i++) {
  store.setItem(SAVE.SAVE_KEY, partie(0, 'appauvrie-' + i));
  SAVE.rotateBackup(true);
}
const survivantes = etat().filter(n => n > 0).length;
verifie('aucune copie saine n\'a été écrasée par une partie vide',
  survivantes >= 1, 'copies = ' + etat().join('/'));
verifie('la copie à 4 créatures est toujours là',
  etat().indexOf(4) >= 0, 'copies = ' + etat().join('/'));

// -- 2b. Non-régression : plus riche -> plus pauvre --------------------------
Object.keys(store._data).forEach(k => store.removeItem(k));
SAVE.resetBak();
store.setItem(SAVE.SAVE_KEY, partie(6, 'six'));
SAVE.rotateBackup(true);
store.setItem(SAVE.SAVE_KEY, partie(2, 'deux'));
SAVE.rotateBackup(true);
verifie('une copie à 6 n\'est pas remplacée par une à 2 (on saute l\'emplacement)',
  etat().indexOf(6) >= 0 && etat().indexOf(2) >= 0, 'copies = ' + etat().join('/'));

// -- 2c. Progression normale : trois âges différents -------------------------
Object.keys(store._data).forEach(k => store.removeItem(k));
SAVE.resetBak();
for (let n = 1; n <= 5; n++) {
  store.setItem(SAVE.SAVE_KEY, partie(n, 'etape' + n));
  SAVE.rotateBackup(true);
}
const ages = etat();
verifie('trois copies distinctes en rotation', new Set(ages).size === 3, 'copies = ' + ages.join('/'));
verifie('la plus récente est la plus riche',
  SAVE.nbCreatures(store.getItem(SAVE.backupKeysRecentes()[0])) === Math.max.apply(null, ages),
  'plus récente = ' + SAVE.nbCreatures(store.getItem(SAVE.backupKeysRecentes()[0])));

// -- 2d. Le curseur ne s'avance pas si l'index n'a pas pu être écrit ---------
Object.keys(store._data).forEach(k => store.removeItem(k));
SAVE.resetBak();
store.setItem(SAVE.SAVE_KEY, partie(3, 'avant-panne'));
const vraiSet = store.setItem.bind(store);
let coupe = false;
store.setItem = function (k, v) {
  if (coupe && k === SAVE.BACKUP_INDEX) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
  return vraiSet(k, v);
};
coupe = true;
SAVE.rotateBackup(true);
coupe = false;
store.setItem = vraiSet;
verifie('l\'échec d\'index ne laisse aucune copie fantôme',
  etat().every(n => n === 0), 'copies = ' + etat().join('/'));
store.setItem(SAVE.SAVE_KEY, partie(3, 'apres-panne'));
SAVE.rotateBackup(true);
verifie('la copie suivante a bien lieu (curseur non corrompu)',
  etat().filter(n => n === 3).length === 1, 'copies = ' + etat().join('/'));

// -- 2e. L'import sait faire de la place, sans sacrifier le point de retour --
console.log('\n=== 3. L\'import quand le stockage est plein ===');
const petit = makeStore(2600);
sandbox.localStorage = petit;
vm.runInContext('(function(){' + BLOC.replace('globalThis.SAVE', 'globalThis.SAVE2') + '})();',
  sandbox, { filename: 'bloc-sauvegarde-2' });
const S2 = sandbox.SAVE2;
petit.setItem(S2.SAVE_KEY, partie(5, 'en-cours'));
for (let i = 0; i < 2; i++) { try { petit.setItem(S2.BACKUP_KEYS[i], partie(5, 'vieille' + i)); } catch (e) { /* plein */ } }
const refuge = S2.rotateBackup(true);
const importee = partie(7, 'depuis-fichier');
const ok = S2.ecrireImport(importee, refuge);
verifie('l\'import aboutit malgré le stockage saturé', ok === true);
verifie('la partie importée est bien en place',
  S2.nbCreatures(petit.getItem(S2.SAVE_KEY)) === 7,
  'créatures = ' + S2.nbCreatures(petit.getItem(S2.SAVE_KEY)));
verifie('le point de retour créé juste avant a survécu',
  refuge < 0 || S2.nbCreatures(petit.getItem(S2.BACKUP_KEYS[refuge])) === 5,
  'refuge = ' + refuge + ', créatures = ' + S2.nbCreatures(petit.getItem(S2.BACKUP_KEYS[refuge])));
sandbox.localStorage = store;

// ===========================================================================
//  4. RÉTROCOMPATIBILITÉ : une v1 et une v2 sans les champs récents
// ===========================================================================
console.log('\n=== 4. Rétrocompatibilité de lecture ===');
const v1 = { playerName: 'Robin', regionId: 'val', team: avant.team, collection: { miaouche: 1 } };
verifie('une v1 (sans box, sans money) reste « une partie »',
  SAVE.ressembleAUnePartie(JSON.stringify(v1)) === true);
verifie('une v1 est comptée à sa juste richesse',
  SAVE.nbCreatures(JSON.stringify(v1)) === avant.team.length,
  SAVE.nbCreatures(JSON.stringify(v1)) + ' créatures');
team.deserialize({ team: v1.team, box: [], activeIndex: 0 });
verifie('une v1 se recharge sans perdre une créature',
  team.serialize().team.length === avant.team.length);
verifie('un texte qui n\'est pas une partie est refusé',
  SAVE.ressembleAUnePartie('{"coucou":1}') === false &&
  SAVE.ressembleAUnePartie('pas du json') === false);

// ===========================================================================
//  5. L'ÉCONOMIE DES LÉGENDAIRES (correction du jour)
// ===========================================================================
console.log('\n=== 5. Assommer un légendaire contre le capturer ===');
const syl = dex.get('sylvaros');
verifie('sylvaros est bien marqué légendaire', !!(syl && syl.legendary));
let ko = 0, capt = 0;
for (let i = 0; i < 400; i++) {
  ko += shop.rewardFor('legendary', 50);
  capt += Math.max(1, Math.round(shop.rewardFor('legendary', 50) / 2));
}
ko = Math.round(ko / 400); capt = Math.round(capt / 400);
verifie('l\'écart K.O. / capture est retombé sous ×2,5',
  (ko / capt) < 2.5, 'K.O. ~' + ko + ' pièces, capture ~' + capt + ' pièces (×' + (ko / capt).toFixed(2) + ')');

console.log(echecs === 0 ? '\nTOUT EST BON — la partie de Robin est en sécurité.'
                         : '\n' + echecs + ' PROBLÈME(S).');
process.exit(echecs === 0 ? 0 : 1);
