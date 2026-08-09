// =============================================================================
//  verif_legends.js — PUISSANCE, TAILLE, DIMENSIONS ET RIVALITÉS
//
//  Trois demandes de Robin, le 9 août 2026 :
//    · « je voudrais que les légendaires soient extrêmement puissants »
//    · « je voudrais qu'il y ait des conflits entre les légendaires »
//    · « je voudrais que quelques légendaires aient des dimensions »
//
//  Ce harnais exécute les vrais modules hors navigateur et vérifie que les
//  trois demandes sont TENUES — pas seulement écrites quelque part :
//   1. les 36 légendaires sont réellement plus forts, et pas deux fois ;
//   2. le combat reste GAGNABLE : on le simule tour par tour, six créatures
//      contre une, et on compte qui tombe ;
//   3. les six dimensions ont un décor que battle3d sait réellement dessiner ;
//   4. les rivalités se lisent dans les deux sens et ne bouclent pas ;
//   5. la fureur d'un légendaire survit à la sauvegarde.
// =============================================================================
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const sandbox = {
  console, performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  document: {
    createElement: () => ({ style: {}, getContext: () => null, appendChild() {}, addEventListener() {} }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, readyState: 'complete', body: { appendChild() {} },
  },
  location: { hash: '', href: '', reload() {} },
  localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
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
  'js3d/core3d.js', 'js3d/types3d.js', 'js3d/moves3d.js', 'js3d/dex3d.js',
  'js3d/evolve3d.js', 'js3d/dexk3d.js', 'js3d/legends3d.js', 'js3d/team3d.js',
].forEach(charger);

vm.runInContext('globalThis.__R3 = R3;', sandbox);
const R3 = sandbox.__R3;
const dex = R3.get('dex');
const team = R3.get('team');
const moves = R3.get('moves');
const LG = R3.get('legends');

let echecs = 0;
function verifie(nom, ok, detail) {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + nom + (detail ? ' — ' + detail : ''));
  if (!ok) echecs++;
}

// ===========================================================================
//  1. LA PUISSANCE
// ===========================================================================
console.log('\n=== 1. Les légendaires sont bien plus forts qu\'avant ===');
verifie('legends3d s\'est enregistré', !!LG);
verifie('les 36 légendaires ont reçu le renfort', LG && LG.boostes === 36,
  LG ? LG.boostes + ' renforcé(s)' : '—');

// Les valeurs d'AVANT, relevées dans dex3d avant l'application du renfort.
// Si quelqu'un rejoue le renfort une seconde fois, elles doublent : c'est
// exactement ce que ce test attrape.
const AVANT = { pyrathos: [150, 110, 95, 85], aureol: [145, 112, 98, 100], astralis: [170, 118, 110, 70] };
const doubles = [];
for (const id of Object.keys(AVANT)) {
  const sp = dex.get(id);
  const seigneur = LG.estSeigneur(id);
  const k = {
    hp: LG.BOOST.hp * (seigneur ? LG.BOOST_SEIGNEUR.hp : 1),
    atk: LG.BOOST.atk * (seigneur ? LG.BOOST_SEIGNEUR.atk : 1),
    def: LG.BOOST.def * (seigneur ? LG.BOOST_SEIGNEUR.def : 1),
    speed: LG.BOOST.speed * (seigneur ? LG.BOOST_SEIGNEUR.speed : 1),
  };
  const attendu = [
    Math.round(AVANT[id][0] * k.hp), Math.round(AVANT[id][1] * k.atk),
    Math.round(AVANT[id][2] * k.def), Math.round(AVANT[id][3] * k.speed),
  ];
  const reel = [sp.baseHp, sp.atk, sp.def, sp.speed];
  if (reel.join(',') !== attendu.join(',')) {
    doubles.push(sp.name + ' : ' + reel.join('/') + ' au lieu de ' + attendu.join('/'));
  }
}
verifie('le renfort est appliqué UNE seule fois', doubles.length === 0,
  doubles.join(' ; ') || 'Groudon ' + dex.get('pyrathos').baseHp + ' PV, Arceus ' + dex.get('aureol').baseHp + ' PV');

// LES COLÈRES — c'est là que se joue la vraie difficulté (voir legends3d §1 bis).
console.log('\n=== 1 bis. Chaque légendaire a sa capacité de colère ===');
verifie('les colères sont entrées au catalogue des capacités',
  !!moves.MOVES.rageDuVolcan && !!moves.MOVES.jugementOriginel,
  Object.keys(LG.RAGES).length + ' colères de type, ' +
  Object.keys(LG.RAGES_SEIGNEUR).length + ' colères de seigneur');

const sansColere = dex.LEGENDS.filter(s => {
  const rage = LG.rageOf(s.id);
  return !rage || s.moveIds.indexOf(rage) < 0;
});
verifie('les 36 en ont bien reçu une', sansColere.length === 0,
  sansColere.map(s => s.name).join(' ') || LG.coleres + ' distribuées');

// Elles doivent dépasser tout ce que le jeu connaissait : c'est leur raison d'être.
const plusFortAvant = 50;
const molles = dex.LEGENDS.filter(s => {
  const mv = moves.MOVES[LG.rageOf(s.id)];
  return !mv || !mv.power || mv.power[1] <= plusFortAvant;
});
verifie('chacune frappe plus fort que la meilleure capacité du jeu (50)',
  molles.length === 0,
  molles.map(s => s.name).join(' ') || 'de 62-84 (gardiens) à 84-108 (seigneurs)');

// Et personne d'autre ne doit y avoir droit.
const voleurs = dex.BASE.filter(s =>
  s.moveIds.some(m => moves.MOVES[m] && moves.MOVES[m].power && moves.MOVES[m].power[1] > plusFortAvant));
verifie('aucune créature ordinaire n\'a mis la main dessus', voleurs.length === 0,
  voleurs.map(s => s.name).join(' ') || dex.BASE.length + ' espèces vérifiées');

// Le soin de l'adversaire ne doit JAMAIS avoir été sacrifié au profit de la colère :
// un boss sans soin s'écroule en fin de combat sans rien pouvoir tenter.
const prives = dex.LEGENDS.filter(s =>
  !s.moveIds.some(m => moves.MOVES[m] && moves.MOVES[m].heal));
verifie('aucun n\'a perdu son soin dans l\'opération', prives.length === 0,
  prives.map(s => s.name).join(' ') || '36 légendaires, 36 soins intacts');

// ===========================================================================
//  2. LE COMBAT RESTE GAGNABLE
//
//  « extrêmement puissant » ne doit pas vouloir dire « impossible ». On simule
//  un vrai combat : six créatures de niveau 50 contre le légendaire, chacune
//  frappant avec sa meilleure capacité, le légendaire ripostant avec la
//  sienne. On lit le nombre de tours et l'issue.
// ===========================================================================
console.log('\n=== 2. Le combat reste gagnable (simulation tour par tour) ===');

//  LES PP SONT COMPTÉS, et c'est essentiel : sans eux, la simulation conclut
//  qu'un joueur qui se soigne à l'infini gagne toujours, et on croit à tort
//  qu'on peut gonfler un boss sans limite. Ce sont les PP qui font qu'un
//  combat de cent tours n'est pas « difficile » mais infaisable.
const LUTTE = { power: [6, 10], type: null, acc: 1 };

function slotUtile(mon, cible, veutSoin) {
  let best = null;
  for (const slot of (mon.moves || [])) {
    if ((slot.pp | 0) <= 0) continue;
    const mv = moves.MOVES[slot.id];
    if (!mv) continue;
    if (veutSoin ? !mv.heal : !!mv.heal) continue;
    if (veutSoin) return slot;
    const r = moves.compute(mon, cible, mv);       // dégâts RÉELS, types compris
    if (!best || (r.dmg || 0) > best.s) best = { slot, s: r.dmg || 0 };
  }
  return best ? best.slot : null;
}

/** Six créatures contre le légendaire, un joueur qui vise juste et se soigne. */
function simule(legendId, niveauJoueur) {
  const equipe = ['flamdrakix', 'goutellix', 'feuillix', 'dracaufeu', 'tortank', 'florizarre']
    .map(id => team.create(id, niveauJoueur)).filter(Boolean);
  const boss = team.create(legendId, 50);
  if (!boss || !equipe.length) return null;

  let i = 0, tours = 0;
  while (tours < 400) {
    tours++;
    const moi = equipe[i];
    if (!moi) break;

    let slot = (moi.hp < moi.maxHp * 0.35) ? slotUtile(moi, boss, true) : null;
    if (slot) {
      slot.pp--;
      const r = moves.compute(moi, boss, moves.MOVES[slot.id]);
      moi.hp = Math.min(moi.maxHp, moi.hp + (r.heal || 0));
    } else {
      slot = slotUtile(moi, boss, false);
      if (slot) slot.pp--;
      const r = moves.compute(moi, boss, slot ? moves.MOVES[slot.id] : LUTTE);
      boss.hp -= (r.dmg || 0);
      if (boss.hp <= 0) return { issue: 'gagne', tours, restants: equipe.filter(m => m.hp > 0).length };
    }

    const s2 = slotUtile(boss, moi, false);
    if (s2) s2.pp--;
    const r2 = moves.compute(boss, moi, s2 ? moves.MOVES[s2.id] : LUTTE);
    moi.hp -= (r2.dmg || 0);
    if (moi.hp <= 0) { i++; if (i >= equipe.length) return { issue: 'perdu', tours, restants: 0 }; }
  }
  return { issue: 'interminable', tours: 400, restants: 0 };
}

function bilan(id, niveau, N) {
  let gagnes = 0, tours = 0, restants = 0;
  for (let k = 0; k < N; k++) {
    const r = simule(id, niveau);
    if (!r) continue;
    if (r.issue === 'gagne') { gagnes++; tours += r.tours; restants += r.restants; }
  }
  return {
    taux: Math.round(gagnes / N * 100),
    tours: gagnes ? Math.round(tours / gagnes) : 999,
    restants: gagnes ? restants / gagnes : 0,
  };
}

for (const id of ['pyrathos', 'aureol', 'astralis']) {
  const sp = dex.get(id);
  const b = bilan(id, 50, 100);
  verifie(sp.name + ' : une équipe de niveau 50 en vient à bout',
    b.taux >= 60,
    b.taux + ' % de victoires, ' + b.tours + ' tours, ' + b.restants.toFixed(1) + ' créature(s) debout');
  // Et il doit COÛTER quelque chose : un boss qu'on bat sans une égratignure
  // n'est pas un boss. (Groudon reste le plus abordable des trois : c'est le
  // premier légendaire de la Caldeira, pas le dernier du jeu.)
  verifie(sp.name + ' : le combat ne dure pas éternellement', b.tours <= 110,
    b.tours + ' tours en moyenne');
}

const dur = bilan('aureol', 40, 100);
verifie('à niveau 40, Arceus coûte presque toute l\'équipe',
  dur.restants <= 2.5,
  dur.taux + ' % de victoires, ' + dur.restants.toFixed(1) + ' créature(s) debout — il faut monter en niveau');

// ===========================================================================
//  3. LES DIMENSIONS
// ===========================================================================
console.log('\n=== 3. Les six dimensions existent vraiment ===');
const seigneurs = LG.seigneurs();
verifie('six légendaires ont leur dimension', seigneurs.length === 6, seigneurs.join(' '));

const sansEspece = seigneurs.filter(id => !dex.get(id));
verifie('chacun est un vrai légendaire du Pokédex', sansEspece.length === 0,
  sansEspece.join(' ') || seigneurs.map(id => LG.nomDe(id)).join(', '));

const nonLegend = seigneurs.filter(id => !dex.isLegendary(id));
verifie('et tous sont bien marqués « légendaire »', nonLegend.length === 0, nonLegend.join(' ') || '6 vérifiés');

// Le décor doit exister dans battle3d, sinon la dimension retombe en silence
// sur une prairie ensoleillée — l'exact contraire de l'effet recherché.
const src = lire('js3d/battle3d.js');
const decorsManquants = seigneurs.filter(id => {
  const b = LG.biomeOf(id);
  return src.indexOf(b + ':') < 0;
});
verifie('battle3d sait dessiner chacun de ces décors', decorsManquants.length === 0,
  decorsManquants.map(id => LG.biomeOf(id)).join(' ') ||
  seigneurs.map(id => LG.biomeOf(id)).join(' '));
verifie('l\'arrière-plan « rift » des dimensions est bien écrit',
  src.indexOf("a.backdrop === 'rift'") > 0, 'îles brisées et anneaux');

const textesCourts = seigneurs.filter(id => {
  const d = LG.dimensionOf(id);
  return !d.nom || !d.entree || !d.sortie || d.entree.length < 30;
});
verifie('chacune a son nom, son entrée et sa sortie', textesCourts.length === 0,
  textesCourts.join(' ') || seigneurs.map(id => LG.dimensionOf(id).nom).join(' · '));

console.log('\n=== 4. Les titans sont énormes ===');
const titans = Object.keys(LG.TITANS);
verifie('neuf légendaires sont des titans', titans.length === 9, titans.length + ' titans');
verifie('les six seigneurs de dimension en font partie',
  seigneurs.every(id => LG.scaleOf(id) > 1),
  seigneurs.map(id => LG.nomDe(id) + '×' + LG.scaleOf(id)).join(' '));
const maigres = titans.filter(id => LG.scaleOf(id) < 1.8);
verifie('aucun titan n\'est timide (×1,8 minimum)', maigres.length === 0,
  maigres.join(' ') || 'de ×' + Math.min(...titans.map(id => LG.scaleOf(id))) +
  ' à ×' + Math.max(...titans.map(id => LG.scaleOf(id))));
const inconnus = titans.filter(id => !dex.get(id));
verifie('tous les titans existent au Pokédex', inconnus.length === 0, inconnus.join(' ') || 'ids vérifiés');

// ===========================================================================
//  5. LES RIVALITÉS
// ===========================================================================
console.log('\n=== 5. Les conflits entre légendaires tiennent debout ===');
verifie('huit couples ennemis', LG.RIVALITES.length === 8, LG.RIVALITES.length + ' couples');

const malFormes = [];
const vus = {};
for (const duo of LG.RIVALITES) {
  if (!dex.get(duo.a)) malFormes.push(duo.a + ' inconnu');
  if (!dex.get(duo.b)) malFormes.push(duo.b + ' inconnu');
  if (duo.a === duo.b) malFormes.push(duo.a + ' est son propre ennemi');
  if (vus[duo.a]) malFormes.push(duo.a + ' a deux ennemis');
  if (vus[duo.b]) malFormes.push(duo.b + ' a deux ennemis');
  vus[duo.a] = vus[duo.b] = true;
  if (!duo.motif || !duo.cri) malFormes.push(duo.a + ' sans motif ni cri');
}
verifie('chaque couple est net : deux vrais légendaires, un seul ennemi chacun',
  malFormes.length === 0, malFormes.join(' ; ') || '16 légendaires engagés');

const asymetries = LG.RIVALITES.filter(d =>
  LG.rivalOf(d.a) !== d.b || LG.rivalOf(d.b) !== d.a);
verifie('la haine se lit dans les deux sens', asymetries.length === 0,
  asymetries.map(d => d.a + '/' + d.b).join(' ') ||
  LG.RIVALITES.map(d => LG.nomDe(d.a) + '⚡' + LG.nomDe(d.b)).join(', '));

// Un légendaire sans rival ne doit RIEN déclencher — pas d'ennemi inventé.
const sansRival = dex.LEGENDS.filter(s => !LG.rivalOf(s.id));
verifie('les autres légendaires n\'ont pas d\'ennemi inventé',
  sansRival.length === dex.LEGENDS.length - 16,
  sansRival.length + ' légendaires sans rivalité, ' + (dex.LEGENDS.length - sansRival.length) + ' avec');

// ===========================================================================
//  6. LA MÉCANIQUE DE LA VENGEANCE, DANS LE CODE
//     roamers3d et game3d ne s'exécutent pas ici (ils demandent une scène 3D
//     et un DOM) : on vérifie que les branchements sont bien en place, ce qui
//     attrape le cas où une moitié du mécanisme aurait été oubliée.
// ===========================================================================
console.log('\n=== 6. La vengeance est branchée de bout en bout ===');
const roam = lire('js3d/roamers3d.js');
const jeu = lire('js3d/game3d.js');
const branchements = [
  ['roamers3d expose « enrager »', roam.indexOf('enrager:') > 0],
  ['roamers3d fait surgir les furieux', roam.indexOf('chasseFurieuse') > 0],
  ['roamers3d sait poser un rival pour le duel', roam.indexOf('tenterDuel') > 0],
  ['roamers3d grossit les titans sur la carte', roam.indexOf('LG.scaleOf') > 0],
  ['game3d met le rival en fureur à la capture', jeu.indexOf('texteVengeance') > 0],
  ['game3d range la rancune dans la sauvegarde', jeu.indexOf('furieux: (state.furieux') > 0],
  ['game3d la relit au chargement', jeu.indexOf("'setFurieux'") > 0],
  ['game3d ouvre le combat dans la dimension', jeu.indexOf('dimBiome') > 0],
  ['game3d raconte l\'entrée dans la dimension', jeu.indexOf('dim.entree') > 0],
  ['game3d raconte le retour', jeu.indexOf('dimF.sortie') > 0],
];
for (const [nom, ok] of branchements) verifie(nom, ok);

console.log('\n' + (echecs === 0
  ? '✓ TOUT EST BON : les légendaires sont des monstres, ils se détestent, et six ont leur monde.'
  : '✗ ' + echecs + ' problème(s). Voir les lignes ✗ ci-dessus.'));
process.exit(echecs === 0 ? 0 : 1);
