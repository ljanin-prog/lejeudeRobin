// =============================================================================
//  verif_evolution.js — évoluer, apprendre, et surtout NE PAS BLOQUER.
//  Le 4ᵉ harnais du projet, après verif_fx, verif_save et verif_pnj.
//
//  LE BUG QUI A MOTIVÉ CE FICHIER (rapporté par Robin) : « chaque fois que ça
//  évolue le jeu bloque, on ne peut plus rien faire ». `runEvolutions` levait
//  le drapeau `evolving` pour que rien n'interrompe l'animation, puis affichait
//  « X apprend Y ! » — une boîte de dialogue qui ne s'avance qu'à l'Espace. Or
//  le gestionnaire clavier de game3d avalait TOUTES les touches tant que
//  `evolving` était vrai, et `evolving` ne retombait qu'après ce message.
//  Blocage définitif, sans le moindre message d'erreur.
//
//  On rejoue donc ici la chaîne complète avec le VRAI code de game3d.js, y
//  compris la condition exacte du gestionnaire clavier, extraite du fichier.
// =============================================================================
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const src = lire('js3d/game3d.js');
const srcHud = lire('js3d/hud3d.js');

let echecs = 0;
function verifie(nom, ok, detail) {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + nom + (detail ? ' — ' + detail : ''));
  if (!ok) echecs++;
}

/** Le corps d'une fonction, pris tel quel dans le fichier source. */
function extrait(texte, nom) {
  const i = texte.indexOf('function ' + nom + '(');
  if (i < 0) throw new Error('introuvable : ' + nom);
  let p = 0;
  for (let k = texte.indexOf('{', i); k < texte.length; k++) {
    if (texte[k] === '{') p++;
    else if (texte[k] === '}') { p--; if (p === 0) return texte.slice(i, k + 1); }
  }
  throw new Error('accolades : ' + nom);
}

// ===========================================================================
//  1. `team3d.learnMove()` — le point d'écriture qui manquait
//  Testé contre le VRAI module, pas une imitation.
// ===========================================================================
console.log('\n=== 1. Apprendre une capacité (vrai team3d) ===');

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
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
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
const charger = (f) => {
  try { vm.runInContext(lire(f), sandbox, { filename: f, timeout: 30000 }); }
  catch (e) { console.error('ÉCHEC ' + f + ' : ' + e.message); process.exit(1); }
};
[
  'js3d/vendor/three.min.js', 'js3d/core3d.js', 'js3d/tiles3d.js', 'js3d/types3d.js',
  'js3d/moves3d.js', 'js3d/dex3d.js', 'js3d/creatures3d.lib.js',
  'js3d/creatures3d.p1.js', 'js3d/creatures3d.p2.js', 'js3d/creatures3d.p3.js',
  'js3d/creatures3d.p4.js', 'js3d/creatures3d.p5.js',
  'js3d/legendlib3d.js', 'js3d/legend3d.p1.js', 'js3d/legend3d.p2.js', 'js3d/legend3d.p3.js',
  'js3d/evolve3d.js', 'js3d/team3d.js',
].forEach(charger);
vm.runInContext('globalThis.__R3 = R3;', sandbox);
const R3 = sandbox.__R3;
const team = R3.get('team');
const evolve = R3.get('evolve');
const moves = R3.get('moves');

const cible = team.create('feuillou', 30);
const avant = cible.moves.map(s => s.id);
verifie('une créature a bien quatre capacités', avant.length === 4, avant.join(', '));

// Une capacité qui n'est PAS dans les quatre : on la prend dans le catalogue.
const nouvelle = Object.keys(moves.MOVES).filter(id => avant.indexOf(id) < 0)[0];
const r1 = team.learnMove(cible, nouvelle, 1);
verifie('remplacer l\'emplacement 2 marche', r1.ok === true && r1.forgot === avant[1],
  'oubliée : ' + r1.forgot + ' -> apprise : ' + nouvelle);
verifie('la capacité est bien en place', cible.moves[1].id === nouvelle);
verifie('elle a ses PP à fond', cible.moves[1].pp > 0 && cible.moves[1].pp === cible.moves[1].ppMax,
  cible.moves[1].pp + '/' + cible.moves[1].ppMax);
verifie('les trois autres n\'ont pas bougé',
  cible.moves[0].id === avant[0] && cible.moves[2].id === avant[2] && cible.moves[3].id === avant[3]);
verifie('on ne l\'apprend pas deux fois', team.learnMove(cible, nouvelle, 0).ok === false);
verifie('toujours quatre capacités, jamais cinq', cible.moves.length === 4);

const troue = team.create('feuillou', 30);
troue.moves = troue.moves.slice(0, 2);
const r2 = team.learnMove(troue, nouvelle);
verifie('sans index, ça s\'ajoute quand il reste de la place',
  r2.ok === true && r2.forgot === null && troue.moves.length === 3);
const plein = team.create('feuillou', 30);
verifie('sans index et sans place, on ne remplace rien tout seul',
  team.learnMove(plein, nouvelle).ok === false);

// ===========================================================================
//  2. LE BLOCAGE DE ROBIN — la chaîne d'évolution jouée en entier
//  On exécute le VRAI `runEvolutions` / `runLearnQueue` de game3d.js, avec un
//  faux HUD, une fausse boîte de dialogue… et la VRAIE condition du clavier,
//  extraite du fichier. Si quelqu'un remet `if (evolving)`, ce test échoue.
// ===========================================================================
console.log('\n=== 2. Évoluer sans bloquer le jeu ===');

const COND = src.match(/if \((evolving[^)]*)\) \{ e\.preventDefault\(\); return; \}/);
verifie('la condition du clavier a bien été trouvée dans game3d.js', !!COND,
  COND ? COND[1] : 'motif introuvable');

const DECOR = `
  let evolving = false;
  const state = { collection: {}, messages: [] };
  const _messagesVus = [];
  let _saves = 0;

  // La boîte de dialogue, au plus près du vrai game3d : un message ne s'efface
  // que si on APPUIE, et on n'appuie que si le clavier laisse passer la touche.
  function showMessage(text, onComplete) { state.messages.push({ text: text, onComplete: onComplete }); }
  function showMessages(textes, onDone) {
    if (!textes || !textes.length) { if (onDone) onDone(); return; }
    for (let i = 0; i < textes.length; i++) {
      showMessage(textes[i], (i === textes.length - 1) ? onDone : undefined);
    }
  }
  function advanceMessage() {
    const m = state.messages.shift();
    if (m) { _messagesVus.push(m.text); if (m.onComplete) m.onComplete(); }
  }
  // LA condition du vrai gestionnaire clavier de game3d.js, extraite du fichier.
  function clavierAvale() { return (${COND ? COND[1] : 'evolving'}); }
  /** Robin appuie sur Espace. -> 'avalee' | 'avance' | 'rien'. */
  function appuiEspace() {
    if (clavierAvale()) return 'avalee';
    if (state.messages.length) { advanceMessage(); return 'avance'; }
    return 'rien';
  }

  function safeCall(n, f) { try { return f(); } catch (e) { console.warn(n, e); return null; } }
  function sfx() {}
  function markSeen() {}
  function refreshHudCounters() {}
  function saveGame() { _saves++; }
  function moveOf(id) { return (globalThis.__moves.get(id)) || { name: id }; }
  function teamApi() { return globalThis.__team; }
  function playerTeamList() { return globalThis.__equipe; }
  function mod(n) { return globalThis.__mods[n] || null; }
`;

const BLOC = DECOR
  + extrait(src, 'moveNames') + '\n'
  + extrait(src, 'pendingLearnLine') + '\n'
  + extrait(src, 'queueLearn') + '\n'
  + extrait(src, 'runLearnQueue') + '\n'
  + extrait(src, 'runEvolutions') + '\n'
  + 'globalThis.EVO = { runEvolutions, runLearnQueue, queueLearn, state,'
  + ' appuiEspace, evolue: function () { return evolving; },'
  + ' vus: function () { return _messagesVus.slice(); },'
  + ' remise: function () { evolving = false; state.messages.length = 0; _messagesVus.length = 0;'
  + '   _learnQueue.length = 0; } };\n';   // la file survit d'un scénario à l'autre

// `_learnQueue` est déclaré au niveau du module : on le rejoue à l'identique.
vm.runInContext('(function(){ let _learnQueue = [];\n' + BLOC + '})();', sandbox,
  { filename: 'bloc-evolution' });
const EVO = sandbox.EVO;
sandbox.__moves = moves;
sandbox.__team = team;

/** Un faux HUD dont l'écran d'évolution rend la main comme le vrai (2,5 s plus
 *  tard dans le jeu, tout de suite ici). */
function hudFaux(opts) {
  const o = opts || {};
  return {
    showEvolution: function (p) { if (p && p.onDone) p.onDone(); },
    showLearnMove: o.learn || null,
  };
}

// -- 2a. Une évolution qui fait apprendre une capacité : LE cas de Robin -----
// Le message n'apparaît QUE si l'évolution apprend quelque chose — et c'est ce
// message qui bloquait tout. On lui fait donc de la place, pour que la nouvelle
// forme ait forcément une capacité à lui donner : le cas est ainsi reproduit à
// coup sûr, sans dépendre du learnset du jour.
const heros = team.create('feuillou', 40);
heros.moves = heros.moves.slice(0, 1);
sandbox.__equipe = [heros];
sandbox.__mods = { evolve: evolve, hud: hudFaux() };
EVO.remise();
let fini = false;
EVO.runEvolutions(function () { fini = true; });

verifie('la créature a bien évolué', heros.id !== 'feuillou', 'feuillou -> ' + heros.id);
verifie('un message attend d\'être validé', EVO.state.messages.length > 0,
  EVO.state.messages.length + ' message(s)');
// C'EST ICI QUE LE JEU BLOQUAIT.
verifie('l\'Espace n\'est PAS avalé quand un message attend',
  EVO.appuiEspace() !== 'avalee',
  'evolving = ' + EVO.evolue());
// On vide la boîte de dialogue comme le ferait Robin.
let coups = 0;
while (EVO.state.messages.length && coups < 20) { EVO.appuiEspace(); coups++; }
verifie('tous les messages se sont laissé passer', EVO.state.messages.length === 0,
  coups + ' appui(s) sur Espace');
verifie('la chaîne d\'évolution est allée jusqu\'au bout', fini === true);
verifie('le clavier est rendu à la fin', EVO.evolue() === false);

// -- 2b. Deux évolutions d'affilée (un saut de plusieurs niveaux) ------------
const a = team.create('feuillou', 40), b = team.create('flamdrak', 40);
sandbox.__equipe = [a, b];
EVO.remise();
let fini2 = false;
EVO.runEvolutions(function () { fini2 = true; });
let coups2 = 0;
while (EVO.state.messages.length && coups2 < 60) {
  if (EVO.appuiEspace() === 'avalee') break;
  coups2++;
}
verifie('deux créatures enchaînent sans jamais bloquer',
  fini2 === true && EVO.state.messages.length === 0,
  'fini = ' + fini2 + ', restant = ' + EVO.state.messages.length);
verifie('les deux ont bien évolué', a.id !== 'feuillou' && b.id !== 'flamdrak',
  a.id + ' · ' + b.id);

// -- 2c. La question « quelle capacité oublier ? » est bien posée ------------
const quatre = team.create('feuillou', 30);
const avantQ = quatre.moves.map(s => s.id);
const aApprendre = Object.keys(moves.MOVES).filter(id => avantQ.indexOf(id) < 0)[0];
let demande = null;
sandbox.__mods = {
  evolve: evolve,
  hud: hudFaux({
    learn: function (p) { demande = p; p.onChoose(2); },   // Robin oublie la 3ᵉ
  }),
};
EVO.remise();
EVO.queueLearn(quatre, [aApprendre]);
let finiQ = false;
EVO.runLearnQueue(function () { finiQ = true; });
verifie('l\'écran a bien été ouvert', !!demande,
  demande ? 'on propose ' + demande.moveId : 'jamais ouvert');
verifie('il reçoit les quatre capacités actuelles',
  !!demande && demande.moves.length === 4);
verifie('le choix de Robin est appliqué', quatre.moves[2].id === aApprendre,
  quatre.moves.map(s => s.id).join(', '));
while (EVO.state.messages.length) EVO.appuiEspace();
verifie('la file se termine', finiQ === true);
verifie('le message dit ce qui s\'est passé',
  EVO.vus().some(t => /oublie/.test(t) && /apprend/.test(t)),
  EVO.vus().join(' | '));

// -- 2d. « Ne rien oublier » : la capacité est refusée, rien n'est cassé -----
const garde = team.create('feuillou', 30);
const gardeAvant = garde.moves.map(s => s.id);
sandbox.__mods = { evolve: evolve, hud: hudFaux({ learn: function (p) { p.onChoose(-1); } }) };
EVO.remise();
EVO.queueLearn(garde, [aApprendre]);
let finiN = false;
EVO.runLearnQueue(function () { finiN = true; });
while (EVO.state.messages.length) EVO.appuiEspace();
verifie('refuser ne change aucune capacité',
  JSON.stringify(garde.moves.map(s => s.id)) === JSON.stringify(gardeAvant));
verifie('refuser laisse quand même la partie continuer', finiN === true);

// -- 2e. Sans HUD, on ne bloque pas non plus (repli) -------------------------
const sansHud = team.create('feuillou', 30);
sandbox.__mods = { evolve: evolve, hud: null };
EVO.remise();
EVO.queueLearn(sansHud, [aApprendre]);
let finiR = false;
EVO.runLearnQueue(function () { finiR = true; });
while (EVO.state.messages.length) EVO.appuiEspace();
verifie('sans HUD, la file se termine quand même (et le dit)',
  finiR === true && EVO.vus().length > 0, EVO.vus().join(' | '));

// -- 2f. La même capacité proposée deux fois n'est demandée qu'une fois ------
const double = team.create('feuillou', 30);
let compte = 0;
sandbox.__mods = { evolve: evolve, hud: hudFaux({ learn: function (p) { compte++; p.onChoose(-1); } }) };
EVO.remise();
EVO.queueLearn(double, [aApprendre]);
EVO.queueLearn(double, [aApprendre]);
EVO.runLearnQueue(function () {});
while (EVO.state.messages.length) EVO.appuiEspace();
verifie('une capacité proposée deux fois n\'est demandée qu\'une fois', compte === 1,
  compte + ' question(s)');

// ===========================================================================
//  3. L'ÉCRAN DU HUD — choisir ne valide pas, Échap ne casse rien
// ===========================================================================
console.log('\n=== 3. L\'écran « quelle capacité oublier ? » ===');

const PRELUDE_HUD = `
  const noeuds = [];
  function noeud(tag) {
    const n = { tag: tag, className: '', textContent: '', type: '', disabled: false,
      enfants: [], _ecoute: {}, style: { setProperty: function () {} },
      set innerHTML(v) { n.enfants.length = 0; }, get innerHTML() { return ''; },
      classList: {
        add: function (c) { if (n.className.split(' ').indexOf(c) < 0) n.className += ' ' + c; },
        remove: function (c) { n.className = n.className.split(' ').filter(function (x) { return x && x !== c; }).join(' '); },
        contains: function (c) { return n.className.split(' ').indexOf(c) >= 0; },
        toggle: function (c, v) { if (v) n.classList.add(c); else n.classList.remove(c); },
      },
      addEventListener: function (t, f) { n._ecoute[t] = f; },
      clic: function () { if (n._ecoute.click) n._ecoute.click(); },
      appendChild: function (c) { n.enfants.push(c); return c; },
    };
    noeuds.push(n);
    return n;
  }
  function el(tag, cls, parent, text) {
    const e = noeud(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const hudRoot = noeud('div');
  const ui = {};
  function show(e) { if (e) e.classList.remove('hidden'); }
  function hide(e) { if (e) e.classList.add('hidden'); }
  function clamp(v, lo, hi) { v = v | 0; return v < lo ? lo : (v > hi ? hi : v); }
  function replayAnim() {}
  function showCompass() {}
  function moveInfo(id) { const m = globalThis.__moves.get(id); return m || { name: id, type: 'normal', pp: 10 }; }
  function typeInfo() { return { color: '#fff' }; }
  function typeBadge() { return noeud('span'); }
  function moveShortDesc() { return ''; }
`;

const BLOC_HUD = PRELUDE_HUD
  + srcHud.match(/const learnState = \{[^}]+\};/)[0] + '\n'
  + extrait(srcHud, 'buildLearnOverlay') + '\n'
  + extrait(srcHud, 'showLearnMove') + '\n'
  + extrait(srcHud, 'carteCapacite') + '\n'
  + extrait(srcHud, 'setLearnCursor') + '\n'
  + extrait(srcHud, 'validerLearn') + '\n'
  + extrait(srcHud, 'closeLearnMove') + '\n'
  + extrait(srcHud, 'learnBusy') + '\n'
  + extrait(srcHud, 'onLearnKey') + '\n'
  + 'globalThis.HUD = { buildLearnOverlay, showLearnMove, onLearnKey, learnBusy, ui, learnState };\n';
vm.runInContext('(function(){' + BLOC_HUD + '})();', sandbox, { filename: 'bloc-hud-learn' });
const HUD = sandbox.HUD;

HUD.buildLearnOverlay();
const monMoves = team.create('feuillou', 30).moves;
let choix = null;
HUD.showLearnMove({
  monName: 'Feuillou', moveId: aApprendre, moves: monMoves,
  onChoose: function (i) { choix = i; },
});
verifie('l\'écran s\'ouvre et prend le clavier', HUD.learnBusy() === true);
verifie('les quatre capacités sont affichées', HUD.ui.learnCells.length === 4);
verifie('le curseur part sur la première', HUD.learnState.cursor === 0);

// Cliquer une carte NE valide pas : c'est le bouton du bas qui décide.
HUD.ui.learnCells[3].clic();
verifie('cliquer une carte ne valide rien', choix === null && HUD.learnBusy() === true);
verifie('mais le curseur a suivi', HUD.learnState.cursor === 3);
verifie('le bouton du bas annonce ce qui va se passer',
  /Oublier .+ et apprendre /.test(HUD.ui.learnGo.textContent), HUD.ui.learnGo.textContent);

HUD.onLearnKey({ key: 'ArrowRight' });
HUD.onLearnKey({ key: 'ArrowRight' });
verifie('les flèches atteignent « Ne rien oublier »', HUD.learnState.cursor === 4);
verifie('et le bouton change de phrase',
  /Ne pas apprendre/.test(HUD.ui.learnGo.textContent), HUD.ui.learnGo.textContent);

HUD.onLearnKey({ key: '2' });
verifie('les chiffres 1 à 4 choisissent directement', HUD.learnState.cursor === 1);
HUD.onLearnKey({ key: ' ' });
verifie('Espace valide le choix affiché', choix === 1, 'choix = ' + choix);
verifie('l\'écran se referme et rend le clavier', HUD.learnBusy() === false);

// Échap = ne rien oublier, jamais un blocage.
choix = null;
HUD.showLearnMove({
  monName: 'Feuillou', moveId: aApprendre, moves: monMoves,
  onChoose: function (i) { choix = i; },
});
HUD.onLearnKey({ key: 'Escape' });
verifie('Échap répond « ne rien oublier »', choix === -1, 'choix = ' + choix);
verifie('et referme bien l\'écran', HUD.learnBusy() === false);

// Deux ouvertures d'affilée : la première rend toujours la main.
let premier = null, second = null;
HUD.showLearnMove({ monName: 'A', moveId: aApprendre, moves: monMoves, onChoose: function (i) { premier = i; } });
HUD.showLearnMove({ monName: 'B', moveId: aApprendre, moves: monMoves, onChoose: function (i) { second = i; } });
verifie('une question laissée en plan rend quand même la main', premier === -1,
  'premier = ' + premier);
HUD.onLearnKey({ key: 'Escape' });
verifie('et la seconde répond normalement', second === -1);

console.log(echecs === 0 ? '\nTOUT EST BON — évoluer et apprendre ne bloquent plus rien.'
                         : '\n' + echecs + ' PROBLÈME(S).');
process.exit(echecs === 0 ? 0 : 1);
