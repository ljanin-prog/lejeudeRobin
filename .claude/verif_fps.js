// =============================================================================
//  verif_fps.js — la marche en vue subjective se comporte-t-elle bien ?
//
//  Sur le modèle de .claude/verif_save.js : game3d.js n'est pas chargeable ici
//  (il construit une scène WebGL et un HUD), alors on DÉCOUPE le vrai bloc de
//  la marche libre dans le fichier réel et on l'exécute avec un monde de test.
//  Ce qui est vérifié est donc bien le code du jeu, pas une copie qui pourrait
//  diverger.
//
//  CE QUI A MOTIVÉ CE FICHIER : le déplacement FPS partait et s'arrêtait d'un
//  coup (vitesse en tout-ou-rien), la rotation mélangeait deux gestes — un
//  appui bref déclenchait un quart de tour qui partait tout seul — et le
//  gabarit carré accrochait aux angles. On a repris le système du jeu de
//  Clélia : rampe d'accélération, rotation continue, collision par cercle avec
//  glissement. Ces sept épreuves disent si c'est bien ce qui se passe.
// =============================================================================
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js3d/game3d.js'), 'utf8');

// ---------------------------------------------------------------------------
//  DÉCOUPE DU VRAI CODE
// ---------------------------------------------------------------------------
function bloc(depuis, jusqua) {
  const a = src.indexOf(depuis);
  const b = src.indexOf(jusqua, a);
  if (a < 0 || b < 0) {
    console.error('ÉCHEC : repère introuvable dans game3d.js (« '
      + (a < 0 ? depuis : jusqua) + ' »). Le fichier a été réorganisé ?');
    process.exit(1);
  }
  return src.slice(a, b);
}

// Les constantes de réglage, prises une à une dans leur ligne de déclaration.
const CONSTANTES = ['FPS_TURN_SPEED', 'FPS_SPEED', 'FPS_ACCEL', 'FPS_FREIN',
  'FPS_RECUL', 'FPS_RADIUS', 'FPS_PAS'];
const reglages = CONSTANTES.map(function (nom) {
  const m = src.match(new RegExp('^\\s*const ' + nom + '\\s*=\\s*([-\\d.]+)\\s*;', 'm'));
  if (!m) { console.error('ÉCHEC : constante ' + nom + ' introuvable.'); process.exit(1); }
  return 'const ' + nom + ' = ' + m[1] + ';';
}).join('\n');

// Tout le bloc de la vue subjective : des conventions d'angle à la bascule.
const marche = bloc('const YAW_DIRS =', 'function updateWorld(');

// ---------------------------------------------------------------------------
//  LE MONDE DE TEST
//  Un plateau 40×40 entièrement praticable, dans lequel on plante des murs.
// ---------------------------------------------------------------------------
const murs = new Set();
const pnjs = new Set();
const cle = (x, y) => x + ',' + y;

const journal = { pas: 0, tuiles: [] };

const sandbox = {
  console,
  murs: murs, pnjs: pnjs, cle: cle, journal: journal,
  state: {
    input: { up: false, down: false, left: false, right: false },
    player: {
      dir: 'down', fpsYaw: 0, moving: false, moveProgress: 0,
      tileX: 20, tileY: 20, moveFromX: 20, moveFromY: 20, moveToX: 20, moveToY: 20,
      freeMove: false, freeX: 20, freeZ: 20,
    },
  },
  isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= 40 || y >= 40) return false;
    return !murs.has(cle(x, y));
  },
  npcAt(x, y) { return pnjs.has(cle(x, y)); },
  sfx(nom) { if (nom === 'footstep') journal.pas++; },
  onStepFinished() { journal.tuiles.push([sandbox.state.player.tileX, sandbox.state.player.tileY]); },
  refreshCompass() {},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

vm.runInContext(
  reglages + '\n' + marche + '\n'
  + 'globalThis.API = {\n'
  + '  updateFpsTurn: updateFpsTurn, updateFpsMove: updateFpsMove,\n'
  + '  syncFpsPosition: syncFpsPosition, fpsYaw: fpsYaw, poseYaw: poseYaw,\n'
  + '  vitesse: function () { return libreVitesse; },\n'
  + '  REGLAGES: { FPS_SPEED: FPS_SPEED, FPS_ACCEL: FPS_ACCEL, FPS_FREIN: FPS_FREIN,\n'
  + '    FPS_RECUL: FPS_RECUL, FPS_TURN_SPEED: FPS_TURN_SPEED, FPS_PAS: FPS_PAS },\n'
  + '};\n',
  sandbox, { filename: 'marche-fps', timeout: 10000 });

const API = sandbox.API;
const P = sandbox.state.player;
const IN = sandbox.state.input;
const R = API.REGLAGES;

// ---------------------------------------------------------------------------
//  OUTILS
// ---------------------------------------------------------------------------
let echecs = 0;
function verifie(nom, ok, detail) {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + nom + (detail ? ' — ' + detail : ''));
  if (!ok) echecs++;
}
const arrondi = (v, n) => Math.round(v * Math.pow(10, n || 2)) / Math.pow(10, n || 2);
const deg = (r) => arrondi(r * 180 / Math.PI, 1);

/** Une image de jeu : on tourne PUIS on avance, comme `updateWorld`. */
function image(ms) {
  API.updateFpsTurn(ms);
  API.updateFpsMove(ms);
}
function images(n, ms) { for (let i = 0; i < n; i++) image(ms === undefined ? 16 : ms); }
function touches(o) {
  IN.up = !!o.up; IN.down = !!o.down; IN.left = !!o.left; IN.right = !!o.right;
}
/** Remet le joueur à neuf au milieu du plateau, à l'arrêt, regardant vers +z. */
function depart(x, y, yaw) {
  murs.clear(); pnjs.clear();
  journal.pas = 0; journal.tuiles.length = 0;
  touches({});
  P.dir = 'down'; P.moving = false; P.moveProgress = 0;
  P.tileX = x; P.tileY = y; P.freeMove = false;
  P.freeX = x; P.freeZ = y; P.fpsYaw = yaw || 0;
  API.syncFpsPosition(true);      // entre en vue subjective : élan remis à zéro
  P.fpsYaw = yaw || 0;
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LA MARCHE EN VUE SUBJECTIVE — code réel de game3d.js        ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('  réglages : vitesse ' + R.FPS_SPEED + ' — accél. ' + R.FPS_ACCEL
  + ' — frein ' + R.FPS_FREIN + ' — rotation ' + R.FPS_TURN_SPEED + ' rad/s');

// ===========================================================================
//  1. LA VITESSE MONTE — elle ne bascule pas
//  C'est LE point du portage : avant, la première image se faisait déjà à
//  pleine vitesse, ce qui donnait une secousse à chaque appui.
// ===========================================================================
console.log('\n=== 1. La vitesse monte progressivement ===');
depart(20, 20, 0);
touches({ up: true });
image(16);
const v1 = API.vitesse();
verifie('la première image n\'est pas déjà à pleine vitesse',
  v1 > 0 && v1 < R.FPS_SPEED * 0.15,
  arrondi(v1) + ' sur ' + R.FPS_SPEED + ' unités/s');

let t = 16;
while (API.vitesse() < R.FPS_SPEED * 0.99 && t < 2000) { image(16); t += 16; }
verifie('la vitesse de croisière est atteinte en ~0,3 s',
  t >= 200 && t <= 400, t + ' ms');

// ===========================================================================
//  2. LE FREINAGE EST FRANC, MAIS PAS BRUTAL
// ===========================================================================
console.log('\n=== 2. Le freinage : net, sans arrêt net ===');
const xAvantFrein = P.freeX, zAvantFrein = P.freeZ;
touches({});
let tf = 0;
while (API.vitesse() > 0.0005 && tf < 2000) { image(16); tf += 16; }
const glisse = Math.hypot(P.freeX - xAvantFrein, P.freeZ - zAvantFrein);
verifie('à pleine vitesse, l\'arrêt demande ~0,2 s', tf >= 130 && tf <= 280, tf + ' ms');
verifie('on parcourt encore un tiers de tuile en s\'arrêtant',
  glisse > 0.15 && glisse < 0.55, arrondi(glisse) + ' tuile');
verifie('à l\'arrêt, `moving` est faux', P.moving === false);

// ===========================================================================
//  3. ON RECULE MOINS VITE QU'ON N'AVANCE
// ===========================================================================
console.log('\n=== 3. Le recul est plus lent ===');
depart(20, 20, 0);
touches({ down: true });
images(60);
const vRecul = Math.abs(API.vitesse());
verifie('la marche arrière plafonne à ' + Math.round(R.FPS_RECUL * 100) + ' % de la vitesse',
  Math.abs(vRecul - R.FPS_SPEED * R.FPS_RECUL) < 0.05,
  arrondi(vRecul) + ' contre ' + R.FPS_SPEED + ' en avant');

// ===========================================================================
//  4. ON VA EXACTEMENT LÀ OÙ L'ON REGARDE
//  Convention §1.4 : 'down' (yaw 0) = +z, 'right' (yaw +π/2) = +x.
// ===========================================================================
console.log('\n=== 4. Le cap réel est le cap visé ===');
const CAPS = [0, Math.PI / 4, Math.PI / 2, -Math.PI / 3, Math.PI];
const ecarts = [];
CAPS.forEach(function (yaw) {
  depart(20, 20, yaw);
  touches({ up: true });
  images(90);
  const dx = P.freeX - 20, dz = P.freeZ - 20;
  const capReel = Math.atan2(dx, dz);             // sin -> x, cos -> z
  let d = capReel - yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  ecarts.push(Math.abs(d));
});
const pireCap = Math.max.apply(null, ecarts);
verifie('sur ' + CAPS.length + ' caps, le trajet suit le regard au degré près',
  pireCap < Math.PI / 180, 'écart maximal ' + deg(pireCap) + '°');

// ===========================================================================
//  5. ON GLISSE LE LONG DES MURS
//  Un mur plein nord, une marche en biais : on doit continuer vers l'est au
//  lieu de rester collé. C'était la moitié de la sensation de blocage.
// ===========================================================================
console.log('\n=== 5. Le glissement le long des murs ===');
depart(20, 20, 0);
for (let x = 15; x <= 25; x++) murs.add(cle(x, 22));   // un mur plein est-ouest
P.fpsYaw = Math.PI / 4;                                // on marche en biais vers lui
touches({ up: true });
images(120);
verifie('le mur arrête bien la progression vers lui', P.freeZ < 21.7,
  'z = ' + arrondi(P.freeZ));
verifie('mais on glisse le long du mur au lieu d\'y rester collé',
  P.freeX > 22, 'x = ' + arrondi(P.freeX) + ' (départ 20)');
verifie('on ne traverse jamais le mur', !murs.has(cle(Math.round(P.freeX), Math.round(P.freeZ))));

// Un PNJ bloque exactement comme un mur.
depart(20, 20, 0);
pnjs.add(cle(20, 21));
touches({ up: true });
images(60);
verifie('un PNJ planté devant bloque le passage', P.freeZ < 20.7,
  'z = ' + arrondi(P.freeZ));

// ===========================================================================
//  6. LA TUILE SUIT LA POSITION CONTINUE
//  Tout le jeu (portes, biomes, quêtes, sauvegarde) en dépend.
// ===========================================================================
console.log('\n=== 6. La grille reste synchronisée ===');
depart(20, 20, 0);
touches({ up: true });
images(180);                                    // ~2,9 s plein sud
verifie('tileX/tileY collent à la position continue',
  P.tileX === Math.round(P.freeX) && P.tileY === Math.round(P.freeZ),
  'tuile ' + P.tileX + ',' + P.tileY + ' pour ' + arrondi(P.freeX) + ',' + arrondi(P.freeZ));
verifie('onStepFinished() est appelé une fois par tuile franchie',
  journal.tuiles.length === Math.abs(P.tileY - 20),
  journal.tuiles.length + ' appels pour ' + Math.abs(P.tileY - 20) + ' tuiles');
const doublons = journal.tuiles.filter(function (p, i) {
  return i > 0 && p[0] === journal.tuiles[i - 1][0] && p[1] === journal.tuiles[i - 1][1];
});
verifie('aucune tuile n\'est annoncée deux fois de suite', doublons.length === 0);
verifie('les bruits de pas suivent la distance parcourue',
  journal.pas >= 3 && Math.abs(journal.pas - Math.abs(P.freeZ - 20) / R.FPS_PAS) < 1.5,
  journal.pas + ' pas pour ' + arrondi(Math.abs(P.freeZ - 20)) + ' tuiles');

// La bascule vers une vue de dos recale sur la tuile la plus proche.
API.syncFpsPosition(false);
verifie('en quittant la vue subjective, on se recale sur une tuile entière',
  P.freeMove === false && Number.isInteger(P.tileX) && Number.isInteger(P.tileY)
  && P.moving === false);

// ===========================================================================
//  7. LA ROTATION EST CONTINUE — et rien ne part tout seul
//  L'ancien double geste (appui bref = quart de tour mené à son terme) faisait
//  pivoter la vue APRÈS le relâchement : c'est ce qu'on ne veut plus.
// ===========================================================================
console.log('\n=== 7. La rotation : continue, et seulement sur commande ===');
depart(20, 20, 0);
touches({ right: true });
images(10);                                     // 160 ms de rotation
const apresAppui = API.fpsYaw();
touches({});
images(30);                                     // une demi-seconde sans rien
verifie('la flèche droite fait bien tourner à droite (yaw décroissant)',
  apresAppui < -0.01, deg(apresAppui) + '° après 160 ms');
verifie('rien ne continue de tourner une fois la touche relâchée',
  Math.abs(API.fpsYaw() - apresAppui) < 1e-9,
  'yaw stable à ' + deg(API.fpsYaw()) + '°');

depart(20, 20, 0);
touches({ left: true });
images(4, 16);                                  // un appui vraiment bref : 64 ms
const bref = API.fpsYaw();
verifie('un appui bref de 64 ms fait tout de même tourner de plusieurs degrés',
  bref > 0.05, deg(bref) + '°');

depart(20, 20, 0);
touches({ left: true });
let tr = 0;
while (API.fpsYaw() < Math.PI / 2 - 0.01 && tr < 3000) { image(16); tr += 16; }
verifie('un quart de tour maintenu prend ~0,6 s', tr >= 500 && tr <= 700, tr + ' ms');
verifie('la direction cardinale suit le regard', P.dir === 'right',
  'dir = ' + P.dir + ' à ' + deg(API.fpsYaw()) + '°');

depart(20, 20, 0);
touches({ left: true, right: true });
images(30);
verifie('les deux flèches ensemble s\'annulent', Math.abs(API.fpsYaw()) < 1e-9);

// On tourne EN MARCHANT : la trajectoire doit être un arc régulier, pas un
// escalier. C'est le reproche d'origine de Robin (« c'est chaotique »).
depart(20, 20, 0);
touches({ up: true, left: true });
images(40);                                     // on lance la marche et le virage
const traces = [];
for (let i = 0; i < 30; i++) {
  const ax = P.freeX, az = P.freeZ;
  image(16);
  traces.push(Math.hypot(P.freeX - ax, P.freeZ - az));
}
const mini = Math.min.apply(null, traces), maxi = Math.max.apply(null, traces);
verifie('en tournant tout en marchant, le pas reste régulier',
  maxi - mini < 0.004, 'segments de ' + arrondi(mini, 3) + ' à ' + arrondi(maxi, 3) + ' unité');

// ===========================================================================
console.log('\n' + (echecs === 0
  ? '✅ Tout est conforme : la marche subjective se comporte comme prévu.'
  : '❌ ' + echecs + ' épreuve(s) en échec.'));
process.exit(echecs === 0 ? 0 : 1);
