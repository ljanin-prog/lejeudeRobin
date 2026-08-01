/* =============================================================================
 *  sfx3d.js — LES BRUITAGES QUI MANQUAIENT À LA 3D   (complète js/audio.js)
 * -----------------------------------------------------------------------------
 *  Le catalogue de bruitages du jeu vit dans `js/audio.js` (objet `SFX`) et
 *  contient NEUF sons : footstep, encounter, throwBall, hit, shake, catch,
 *  escape, menu, rare. La version 3D en appelle deux de plus, qui n'ont jamais
 *  existé :
 *
 *    · `heal`      — game3d.js `useItemOnMon()` : soigner une créature depuis
 *                    l'écran Équipe ne faisait AUCUN bruit. Et en silence, sans
 *                    la moindre erreur en console : le helper `sfx(nom)` teste
 *                    `Audio_.sfx[nom]` avant d'appeler, un nom inconnu ne fait
 *                    donc rien du tout. Un son fantôme ne se voit jamais.
 *    · `legendary` — roamers3d.js, apparition d'un légendaire à son autel. Le
 *                    code tentait `legendary || encounter || levelUp || catch_`
 *                    et retombait toujours sur `encounter`, le petit jingle de
 *                    rencontre ordinaire : le moment le plus rare du jeu
 *                    sonnait comme n'importe quelle rencontre.
 *
 *  `js/audio.js` est le jeu 2D d'origine : le contrat interdit d'y toucher
 *  (CONTRACT §1 règle 2, CONTRACT2 §1 règle 2). On ÉTEND donc le catalogue
 *  depuis ici, sans rien modifier là-bas.
 *
 *  CONSÉQUENCE, et c'est le seul point délicat : `js/audio.js` garde son
 *  `AudioContext` et ses gains pour lui (variables privées de sa fermeture).
 *  Impossible de se brancher sur sa chaîne audio — ce module a donc son PROPRE
 *  contexte, exactement comme `music3d.js`. Il y a donc TROIS sources de son
 *  dans le jeu, et le bouton ♪ doit couper les trois : `Audio_.toggleMute()`,
 *  `music.setMuted()` et `sfx.setMuted()` (voir `toggleMute()` de game3d.js).
 *
 *  Tout est synthétisé, aucun fichier externe : le jeu doit rester jouable en
 *  double-cliquant index3d.html (CONTRACT §1 règle 1).
 *
 *  API — R3.register('sfx', { init, play, has, names, setMuted, isMuted })
 *
 *  `play(nom)` renvoie `true` s'il a pris le son en charge, `false` si le nom
 *  ne fait pas partie de CETTE extension. C'est ce booléen qui permet aux
 *  appelants d'enchaîner sur `Audio_.sfx[nom]` pour les neuf sons d'origine :
 *
 *      var s = R3.get('sfx');
 *      if (s && s.play && s.play(nom)) return;      // son 3D
 *      if (Audio_.sfx[nom]) Audio_.sfx[nom]();      // son 2D
 *
 *  Ce motif est écrit tel quel dans le helper `sfx()` de game3d.js, roamers3d.js
 *  et battle3d.js. Un son ajouté ici porte donc partout, sans autre changement.
 * ========================================================================== */

(function () {
  'use strict';

  // `core3d.js` déclare `const R3` au premier niveau d'un <script> classique :
  // ce n'est PAS une propriété de window. On lit l'identifiant global tel quel.
  var RR = (typeof R3 !== 'undefined' && R3) ? R3 : null;

  // Volume général de l'extension. `js/audio.js` sort à 0,7 (masterGain) pour
  // des notes à 0,05-0,18 : on se cale sur le même étage pour que les nouveaux
  // sons ne dominent pas les anciens.
  var VOLUME = 0.7;

  var ctx = null;        // notre AudioContext, distinct de celui de js/audio.js
  var sortie = null;     // gain général, coupé par le bouton ♪
  var muet = false;

  // ---------------------------------------------------------------------------
  //  CONTEXTE AUDIO
  //  Les navigateurs créent tout AudioContext « suspended » et refusent de le
  //  démarrer avant un geste de l'utilisateur. On tente le réveil à chaque son :
  //  un bruitage n'arrive jamais qu'après un clic ou une touche, le réveil
  //  aboutit donc dès le premier.
  // ---------------------------------------------------------------------------
  function init() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      sortie = ctx.createGain();
      sortie.gain.value = muet ? 0 : VOLUME;
      sortie.connect(ctx.destination);
      return true;
    } catch (e) {
      try { console.warn('[sfx3d] audio indisponible :', e); } catch (e2) { /* rien */ }
      ctx = null;
      return false;
    }
  }

  function reveille() {
    if (!ctx || ctx.state === 'running') return;
    try { ctx.resume(); } catch (e) { /* on retentera au son suivant */ }
  }

  // ---------------------------------------------------------------------------
  //  PRIMITIVES — même esprit que `blip` / `sweep` / `sequence` de js/audio.js,
  //  avec deux choses en plus dont les nouveaux sons ont besoin : une date de
  //  départ (pour poser plusieurs voix les unes après les autres) et une
  //  attaque douce (sans elle, une note qui démarre à plein volume claque).
  // ---------------------------------------------------------------------------

  /** Une note tenue. `quand` = décalage en secondes depuis maintenant. */
  function note(freq, quand, duree, type, vol, attaque) {
    var t = ctx.currentTime + (quand || 0);
    var a = (attaque === undefined) ? 0.012 : attaque;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    osc.connect(g).connect(sortie);
    osc.start(t);
    osc.stop(t + duree + 0.02);
  }

  /** Une note qui glisse d'une hauteur à l'autre. */
  function glisse(depuis, vers, quand, duree, type, vol) {
    var t = ctx.currentTime + (quand || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(depuis, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, vers), t + duree);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.08, duree * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    osc.connect(g).connect(sortie);
    osc.start(t);
    osc.stop(t + duree + 0.02);
  }

  /** Une suite de notes, chacune posée après la précédente. */
  function suite(notes, quand, type, vol) {
    var t = quand || 0;
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].freq > 0) {
        note(notes[i].freq, t, notes[i].dur * 1.6, type, notes[i].vol || vol, 0.008);
      }
      t += notes[i].dur;
    }
  }

  // ---------------------------------------------------------------------------
  //  LE CATALOGUE
  //  Un son = une fonction sans argument, comme dans `SFX` de js/audio.js.
  //  Pour en ajouter un : une entrée ici, et il est aussitôt jouable par
  //  `sfx('nom')` depuis game3d, battle3d et roamers3d.
  // ---------------------------------------------------------------------------
  var SONS = {

    // SOIN — une potion, une baie, un objet qui remet d'aplomb. Le contraire
    // d'un coup : rien de percussif, une nappe qui monte et trois notes
    // cristallines par-dessus. La quinte tenue (392/587) donne la douceur ;
    // sans elle, les trois notes sonnent comme un menu qui s'ouvre.
    heal: function () {
      glisse(392, 784, 0, 0.42, 'sine', 0.07);
      note(392, 0.02, 0.40, 'sine', 0.045, 0.06);
      note(587, 0.08, 0.36, 'sine', 0.040, 0.06);
      suite([
        { freq: 784, dur: 0.075 },
        { freq: 988, dur: 0.075 },
        { freq: 1319, dur: 0.20 },
      ], 0.10, 'triangle', 0.055);
    },

    // LÉGENDAIRE — l'apparition à l'autel. Trois étages : un grondement grave
    // qui descend (on sent quelque chose de gros arriver), une quinte tenue en
    // dessous, puis seulement une fanfare qui monte. C'est l'ORDRE qui fait la
    // solennité : un jingle qui monte tout de suite sonne « bonne nouvelle »,
    // alors qu'ici on veut « attention, ça sort de l'ordinaire ».
    legendary: function () {
      glisse(120, 55, 0, 0.95, 'sawtooth', 0.055);
      note(110, 0.05, 0.90, 'triangle', 0.050, 0.10);
      note(165, 0.05, 0.90, 'triangle', 0.038, 0.14);
      suite([
        { freq: 440, dur: 0.13 },
        { freq: 659, dur: 0.13 },
        { freq: 880, dur: 0.13 },
      ], 0.34, 'triangle', 0.060);
      // La note finale est doublée à l'octave et légèrement désaccordée : deux
      // oscillateurs qui battent l'un contre l'autre, ça « brille » là où un
      // seul reste plat.
      note(1319, 0.73, 0.75, 'triangle', 0.055, 0.03);
      note(1324, 0.73, 0.75, 'triangle', 0.030, 0.03);
      note(2637, 0.75, 0.55, 'sine', 0.022, 0.05);
    },
  };

  // ---------------------------------------------------------------------------
  //  API
  // ---------------------------------------------------------------------------

  /** Ce nom fait-il partie de l'extension ? (les neuf sons de js/audio.js : non) */
  function has(nom) { return typeof SONS[nom] === 'function'; }

  /** Les noms ajoutés par la 3D, pour diagnostiquer depuis la console. */
  function names() { return Object.keys(SONS); }

  /**
   * Joue un son de l'extension.
   * @returns {boolean} true si le son a été pris en charge ICI (l'appelant ne
   *   doit alors PAS enchaîner sur `Audio_.sfx`), false si le nom lui est
   *   inconnu ou si l'audio est indisponible.
   */
  function play(nom) {
    if (!has(nom)) return false;
    if (muet) return true;          // pris en charge, mais on se tait
    if (!init()) return false;
    reveille();
    try { SONS[nom](); } catch (e) { return false; }
    return true;
  }

  function setMuted(v) {
    muet = !!v;
    if (sortie) {
      try { sortie.gain.value = muet ? 0 : VOLUME; } catch (e) { /* rien */ }
    }
  }

  function isMuted() { return muet; }

  var API = {
    init: init,
    play: play,
    has: has,
    names: names,
    setMuted: setMuted,
    isMuted: isMuted,
  };

  try {
    if (RR && RR.register) RR.register('sfx', API);
  } catch (e) { /* jamais bloquant */ }
  if (typeof globalThis !== 'undefined') globalThis.SFX3D = API;
})();
