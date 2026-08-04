// =============================================================================
//  verif_pnj.js — les PNJ disent-ils la bonne chose ?
//  Sur le modèle de .claude/verif_fx.js et .claude/verif_save.js : on exécute
//  les VRAIS modules 3D hors navigateur, on demande à regions3d la liste RÉELLE
//  des PNJ de chaque région, et on écoute ce que quest3d leur fait dire.
//
//  LE BUG QUI A MOTIVÉ CE FICHIER (rapporté par Robin) : « quand je parle au
//  vieux sage, il me dit d'aller voir le vieux sage ». regions3d préfixe ses
//  PNJ par leur région (« val_sage »), alors que les tables de rôles de quest3d
//  sont écrites avec l'id du modèle (« sage ») : les 66 PNJ du jeu retombaient
//  sur le rôle « villageois », dont la réplique est justement « va voir
//  {ancien} ». Plus personne ne racontait sa légende.
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

// L'ordre d'index3d.html, réduit à ce dont les dialogues ont besoin.
// cities3d AVANT regions3d (il greffe les tuiles de l'Académie), arenas3d aussi
// (regions3d lui demande le champion de chaque ville).
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
const quest = R3.get('quest');
const regions = R3.get('regions');

let echecs = 0;
function verifie(nom, ok, detail) {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + nom + (detail ? ' — ' + detail : ''));
  if (!ok) echecs++;
}

const RID = quest.QUESTS.map(q => q.regionId);
const PNJ = {};                       // regionId -> [npc réels]
RID.forEach(rid => { PNJ[rid] = (regions.npcsOf(rid) || []).filter(n => n && n.id); });

// ===========================================================================
//  1. CHAQUE PNJ A UN VRAI RÔLE
//  « villageois » est le repli : il existe pour les cas imprévus, jamais pour
//  les 66 PNJ écrits à la main. Un seul suffirait à faire réapparaître le bug.
// ===========================================================================
console.log('\n=== 1. Chaque PNJ joue bien son rôle ===');
const retombes = [];
let total = 0;
RID.forEach(function (rid) {
  PNJ[rid].forEach(function (n) {
    total++;
    if (quest.roleOf(n.id) === 'villageois') retombes.push(n.id + ' (' + n.name + ')');
  });
});
verifie('aucun PNJ ne retombe sur le rôle de repli « villageois »',
  retombes.length === 0,
  retombes.length ? retombes.join(', ') : total + ' PNJ vérifiés');

// Les rôles clés, nommément : un décapage d'id trop gourmand les casserait.
const ATTENDUS = {
  val_sage: 'ancien', sylve_chamane: 'ancien', saphir_phare: 'ancien',
  givre_maire: 'ancien', braise_forgeronne: 'ancien', aurore_astronome: 'ancien',
  champion_val: 'champion', val_t_foret: 'dresseur', val_enfant: 'enfant',
  saphir_enfant_plage: 'enfant', givre_guide_montagne: 'guide',
  givre_forgeron: 'marchand', val_jardiniere: 'savant',
};
const faux = [];
for (const id in ATTENDUS) {
  const r = quest.roleOf(id);
  if (r !== ATTENDUS[id]) faux.push(id + ' -> ' + r + ' (attendu : ' + ATTENDUS[id] + ')');
}
verifie('les rôles clés sont les bons', faux.length === 0,
  faux.length ? faux.join(' ; ') : Object.keys(ATTENDUS).length + ' ids vérifiés');

// ===========================================================================
//  2. PERSONNE NE S'ENVOIE CHERCHER SOI-MÊME
//  C'est LE symptôme rapporté par Robin. On parle à chaque PNJ, dans chaque
//  état de quête, et on refuse toute réplique qui le nomme lui-même après un
//  « va voir » / « va écouter » / « c'est … qui le raconte ».
// ===========================================================================
console.log('\n=== 2. Personne ne conseille d\'aller se voir soi-même ===');

/** Les mots du nom d'un PNJ qui l'identifient vraiment (« Mathis », « Yara ») :
 *  on ignore les titres, partagés par plusieurs personnages. */
const TITRES = /^(le|la|les|l'|vieux|vieille|sage|gardien|gardienne|du|de|des|maire|forgeron|forgeronne|astronome|chamane|phare|guide|petit|petite|dresseur|dresseuse)$/i;
function motsPropres(nom) {
  return String(nom || '').split(/[\s'’]+/).filter(m => m.length > 2 && !TITRES.test(m));
}

const coupables = [];
RID.forEach(function (rid) {
  PNJ[rid].forEach(function (n) {
    const propres = motsPropres(n.name);
    if (!propres.length) return;
    ['inconnue', 'entendue', 'ouverte', 'accomplie'].forEach(function (etat) {
      // On force l'état de la quête, puis on écoute.
      const st = {}; st[rid] = {
        heard: etat !== 'inconnue',
        open: etat === 'ouverte' || etat === 'accomplie',
        caught: [], done: etat === 'accomplie',
      };
      quest.deserialize(st);
      const lignes = quest.dialogFor(n.id, rid) || [];
      lignes.forEach(function (l) {
        if (!/va (voir|donc écouter|écouter)|qui le raconte|qui les a/i.test(l)) return;
        propres.forEach(function (m) {
          if (l.indexOf(m) >= 0) coupables.push(n.name + ' [' + etat + '] : « ' + l + ' »');
        });
      });
    });
  });
});
verifie('aucun PNJ ne renvoie vers lui-même', coupables.length === 0,
  coupables.length ? coupables.slice(0, 3).join(' | ') : total + ' PNJ × 4 états écoutés');

// ===========================================================================
//  3. LE CONTEUR RACONTE VRAIMENT SA LÉGENDE
//  Lui parler doit livrer l'histoire ET faire passer la quête à « entendue » :
//  c'est ce qui débloque la consigne suivante sous la boussole.
// ===========================================================================
console.log('\n=== 3. Le conteur de chaque région raconte sa légende ===');
RID.forEach(function (rid) {
  const q = quest.get(rid);
  quest.deserialize({});                       // quête inconnue partout
  const id = rid + '_' + q.conteur;
  const present = PNJ[rid].some(n => n.id === id);
  verifie('le conteur ' + q.conteurNom + ' existe bien dans ' + rid, present, id);
  const lignes = quest.dialogFor(id, rid) || [];
  verifie('il raconte l\'histoire, pas un renvoi',
    lignes.length > 0 && lignes[0] === q.legende[0],
    '« ' + String(lignes[0] || '').slice(0, 60) + '… »');
  verifie('lui parler fait passer la quête à « entendue »',
    quest.state(rid) === 'entendue', 'état = ' + quest.state(rid));
});

// ===========================================================================
//  4. LA CONSIGNE SOUS LA BOUSSOLE NOMME QUELQU'UN QUI EXISTE
// ===========================================================================
console.log('\n=== 4. La consigne de départ envoie vers une vraie personne ===');
quest.deserialize({});
RID.forEach(function (rid) {
  const q = quest.get(rid);
  const ligne = quest.hint(rid);
  const npc = PNJ[rid].filter(n => n.id === rid + '_' + q.conteur)[0];
  verifie('« ' + ligne.slice(0, 58) + '… » nomme un PNJ présent',
    !!npc && !!q.conteurNom && npc.name.split(' ').every(m => q.conteurNom.indexOf(m) >= 0),
    npc ? npc.name : 'conteur absent');
});

console.log(echecs === 0 ? '\nTOUT EST BON — les PNJ disent ce qu\'il faut.'
                         : '\n' + echecs + ' PROBLÈME(S).');
process.exit(echecs === 0 ? 0 : 1);
