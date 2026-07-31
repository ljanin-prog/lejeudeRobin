/* =============================================================================
 *  music3d.js — LA MUSIQUE POP-ROCK CALME  (remplace la mélodie de js/audio.js)
 * -----------------------------------------------------------------------------
 *  Retour de Robin : « il faudrait une musique plus réelle, type pop-rock calme.
 *  La musique ordinateur c'est usant à la longue. »
 *
 *  Ce qui rendait l'ancienne musique fatigante (js/audio.js, MUSIC_TRACKS) :
 *  une SEULE voix, une onde triangle nue, aucun rythme, aucun accord, et une
 *  boucle de quelques secondes qui revient toujours à l'identique. L'oreille
 *  attrape le motif en dix secondes et ne le lâche plus.
 *
 *  Ce qui est fait ici, sans le moindre fichier audio (§1 du contrat : tout est
 *  procédural, le jeu doit tourner en double-cliquant index3d.html) :
 *
 *    • GUITARE en KARPLUS-STRONG — une vraie corde pincée. On remplit un buffer
 *      de bruit de la longueur d'une période, puis on le parcourt en moyennant
 *      chaque échantillon avec le suivant : le bruit se transforme tout seul en
 *      note qui s'éteint, avec les harmoniques d'une corde. C'est CE point qui
 *      fait la différence entre « un jeu » et « un ordinateur qui bipe » — un
 *      oscillateur, même bien enveloppé, ne sonne jamais comme une corde.
 *    • BASSE ronde (triangle + passe-bas qui se referme), BATTERIE (grosse
 *      caisse sinus descendante, caisse claire et charleston en bruit filtré).
 *    • RÉVERBE à convolution, dont la réponse impulsionnelle est elle aussi
 *      générée ici (bruit qui décroît). C'est elle qui donne l'impression d'une
 *      pièce réelle plutôt que d'un haut-parleur.
 *    • Une GRILLE D'ACCORDS pop (I–V–vi–IV et variantes), 8 mesures, avec des
 *      variations d'arpège et de batterie pour que ça ne tourne pas en rond.
 *
 *  Planification : un ordonnanceur à fenêtre glissante (on programme 0,4 s à
 *  l'avance toutes les 60 ms). Les minuteries de JavaScript sont trop
 *  imprécises pour poser une note à l'oreille ; l'horloge d'AudioContext, elle,
 *  est à l'échantillon près. Rien n'est jamais programmé depuis la boucle de
 *  rendu : la musique ne coûte donc aucune milliseconde de frame.
 *
 *  API — R3.register('music', { init, setBiome, stop, setMuted, isPlaying,
 *                               setVolume, mood })
 * ========================================================================== */

(function () {
  'use strict';

  // `core3d.js` déclare `const R3` au premier niveau d'un <script> classique :
  // ce n'est PAS une propriété de window. On lit l'identifiant global tel quel.
  var RR = (typeof R3 !== 'undefined' && R3) ? R3 : null;

  // ---------------------------------------------------------------------------
  //  RÉGLAGES
  // ---------------------------------------------------------------------------
  // Musique de fond : elle ne doit jamais couvrir les bruitages ni fatiguer.
  // Mesuré à la sonde `level()` : 0,22 donnait un RMS de crête de 0,027, soit
  // presque rien à l'oreille. 0,55 place les crêtes autour de 0,07 — présent
  // mais discret, ce qu'on veut pour des heures de jeu.
  var VOLUME = 0.55;
  var LOOKAHEAD_MS = 60;      // période de l'ordonnanceur
  var FENETRE = 0.40;         // on programme toujours 0,4 s d'avance

  // Notes -> fréquences. 69 = La3 = 440 Hz (norme MIDI).
  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  // ---------------------------------------------------------------------------
  //  LES AMBIANCES
  //  Une par grande famille de lieux. Chacune a sa tonalité, sa grille, son
  //  tempo et sa couleur — c'est ce qui fait qu'on « entend » qu'on a changé de
  //  région, sans jamais changer de style.
  //
  //  Les accords sont donnés en demi-tons depuis la fondamentale, avec la basse
  //  en premier. Tout est en majeur ou en mineur naturel : rien de savant, on
  //  écrit pour un enfant de 10 ans.
  // ---------------------------------------------------------------------------
  var AMBIANCES = {
    // Plaines, forêts, villages : la couleur par défaut du jeu.
    douce: {
      tonique: 62,            // Ré
      tempo: 84,
      grille: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]],   // D  A  Bm G
      brillance: 2600, batterie: 0.75, arpege: 'doux',
    },
    // Mer, plages, ciel : plus aéré, plus lumineux, batterie plus discrète.
    lumineuse: {
      tonique: 64,            // Mi
      tempo: 78,
      grille: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]],    // E  A  B  A
      brillance: 3200, batterie: 0.45, arpege: 'large',
    },
    // Villes : un peu plus de nerf, la grille avance plus vite.
    ville: {
      tonique: 60,            // Do
      tempo: 92,
      grille: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]],   // C  Am F  G
      brillance: 2900, batterie: 1.0, arpege: 'pulse',
    },
    // Volcans, grottes, marais : mineur, plus grave, plus lent.
    grave: {
      tonique: 57,            // La
      tempo: 72,
      grille: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 10, 14]],    // Am Dm F  Em
      brillance: 1900, batterie: 0.6, arpege: 'lent',
    },
    // Glaciers, neige : notes hautes et espacées, presque pas de batterie.
    cristal: {
      tonique: 67,            // Sol
      tempo: 70,
      grille: [[0, 4, 7], [9, 12, 16], [2, 5, 9], [7, 11, 14]],    // G  Em Am D
      brillance: 3600, batterie: 0.3, arpege: 'large',
    },
  };

  // Quel biome joue quelle ambiance. Tout ce qui manque tombe sur « douce ».
  var BIOME_AMBIANCE = {
    plain: 'douce', grass: 'douce', forest: 'douce', jungle: 'douce',
    park: 'douce', village: 'douce', flower: 'douce',
    beach: 'lumineuse', sea: 'lumineuse', lake: 'lumineuse',
    coast: 'lumineuse', celestial: 'lumineuse', sky: 'lumineuse',
    city: 'ville', city2: 'ville', town: 'ville', road: 'ville',
    volcano: 'grave', cave: 'grave', swamp: 'grave', ruin: 'grave',
    desert: 'grave', mountain: 'grave',
    glacier: 'cristal', snow: 'cristal', ice: 'cristal', tundra: 'cristal',
  };

  // ---------------------------------------------------------------------------
  //  ÉTAT
  // ---------------------------------------------------------------------------
  var ctx = null;             // AudioContext
  var sortie = null;          // gain général
  var bus = null;             // gain « sec »
  var reverb = null;          // ConvolverNode
  var busRev = null;          // gain vers la réverbe
  var minuteur = null;
  var ambiance = null;        // l'objet AMBIANCES en cours
  var nomAmbiance = null;
  var prochainTemps = 0;      // date audio du prochain temps à programmer
  var mesure = 0;             // compteur de mesures depuis le début
  var temps = 0;              // 0..3 dans la mesure
  var muet = false;
  var cachePinces = {};       // buffers de cordes déjà calculés
  var analyseur = null;       // sonde de niveau (voir level())
  var _pcm = null;

  function dispo() { return !!ctx; }

  // ---------------------------------------------------------------------------
  //  RÉVEIL DU CONTEXTE AUDIO
  //  Les navigateurs créent tout AudioContext à l'état « suspended » et refusent
  //  de le démarrer tant que l'utilisateur n'a pas agi. Un `resume()` appelé au
  //  mauvais moment échoue en silence : le module croit jouer, l'horloge reste à
  //  zéro et pas un son ne sort — c'est exactement ce qui s'est produit ici.
  //  On tente donc le réveil tout de suite, ET on arme un filet sur la première
  //  vraie interaction, quelle qu'elle soit.
  // ---------------------------------------------------------------------------
  var filetArme = false;

  function reveille() {
    if (!ctx) return;
    if (ctx.state === 'running') return;
    try { ctx.resume(); } catch (e) { /* on retentera au prochain geste */ }
    if (filetArme) return;
    filetArme = true;
    var essaie = function () {
      if (!ctx) return;
      try { ctx.resume(); } catch (e) { /* rien */ }
      if (ctx.state === 'running') {
        window.removeEventListener('pointerdown', essaie, true);
        window.removeEventListener('keydown', essaie, true);
        window.removeEventListener('touchstart', essaie, true);
        filetArme = false;
      }
    };
    window.addEventListener('pointerdown', essaie, true);
    window.addEventListener('keydown', essaie, true);
    window.addEventListener('touchstart', essaie, true);
  }

  // ---------------------------------------------------------------------------
  //  RÉVERBE — réponse impulsionnelle générée : bruit qui décroît.
  //  Deux canaux légèrement différents : c'est ce décalage qui donne la largeur
  //  stéréo, et donc l'impression d'espace.
  // ---------------------------------------------------------------------------
  function fabriqueReverb(duree, chute) {
    var n = Math.floor(ctx.sampleRate * duree);
    var buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < n; i++) {
        // Les toutes premières millisecondes montent au lieu de partir plein
        // pot : sinon on entend un « clac » au début de chaque note.
        var attaque = Math.min(1, i / (ctx.sampleRate * 0.006));
        d[i] = (Math.random() * 2 - 1) * attaque * Math.pow(1 - i / n, chute);
      }
    }
    var conv = ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  // ---------------------------------------------------------------------------
  //  LA CORDE PINCÉE (Karplus-Strong)
  //  On part d'une période de bruit, puis chaque échantillon devient la moyenne
  //  du précédent et de celui d'il y a une période. Le bruit se range de
  //  lui-même en harmoniques, les aiguës s'éteignent avant les graves — soit
  //  exactement ce que fait une corde. `amorti` sous 1 raccourcit la note.
  // ---------------------------------------------------------------------------
  function bufferCorde(freq, duree, amorti) {
    var cle = Math.round(freq) + '_' + Math.round(duree * 100) + '_' + Math.round(amorti * 1000);
    if (cachePinces[cle]) return cachePinces[cle];

    var sr = ctx.sampleRate;
    var n = Math.max(1, Math.floor(sr * duree));
    var periode = Math.max(2, Math.round(sr / freq));
    var buf = ctx.createBuffer(1, n, sr);
    var d = buf.getChannelData(0);

    // Le bruit de départ est adouci : une corde de guitare pincée au doigt n'a
    // pas d'aigus infinis. Sans ça le début « crache ».
    var file = new Float32Array(periode);
    var prec = 0;
    for (var i = 0; i < periode; i++) {
      var b = Math.random() * 2 - 1;
      prec = prec * 0.55 + b * 0.45;
      file[i] = prec;
    }

    var idx = 0;
    for (var j = 0; j < n; j++) {
      var v = file[idx];
      var suiv = file[(idx + 1) % periode];
      d[j] = v;
      file[idx] = (v + suiv) * 0.5 * amorti;
      idx = (idx + 1) % periode;
    }

    // Fondu de fin, sinon on entend une coupure nette.
    var fondu = Math.min(n, Math.floor(sr * 0.05));
    for (var k = 0; k < fondu; k++) d[n - 1 - k] *= k / fondu;

    cachePinces[cle] = buf;
    return buf;
  }

  function corde(freq, quand, duree, volume, brillance) {
    var src = ctx.createBufferSource();
    src.buffer = bufferCorde(freq, duree, 0.996);
    var g = ctx.createGain();
    g.gain.value = volume;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = brillance || 2600;
    src.connect(f).connect(g);
    g.connect(bus);
    g.connect(busRev);
    src.start(quand);
    src.stop(quand + duree + 0.05);
  }

  // ---------------------------------------------------------------------------
  //  BASSE — triangle, passe-bas qui se referme, attaque douce.
  // ---------------------------------------------------------------------------
  function basse(freq, quand, duree, volume) {
    var osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, quand);
    f.frequency.exponentialRampToValueAtTime(380, quand + duree * 0.8);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, quand);
    g.gain.exponentialRampToValueAtTime(volume, quand + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, quand + duree);
    osc.connect(f).connect(g).connect(bus);
    osc.start(quand);
    osc.stop(quand + duree + 0.02);
  }

  // ---------------------------------------------------------------------------
  //  BATTERIE
  // ---------------------------------------------------------------------------
  function bruitCourt(duree) {
    var n = Math.max(1, Math.floor(ctx.sampleRate * duree));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  var bufBruit = null;
  function bruit() { if (!bufBruit) bufBruit = bruitCourt(1); return bufBruit; }

  function grosseCaisse(quand, volume) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, quand);
    osc.frequency.exponentialRampToValueAtTime(44, quand + 0.11);
    var g = ctx.createGain();
    g.gain.setValueAtTime(volume, quand);
    g.gain.exponentialRampToValueAtTime(0.0001, quand + 0.24);
    osc.connect(g).connect(bus);
    osc.start(quand);
    osc.stop(quand + 0.26);
  }

  function caisseClaire(quand, volume) {
    var src = ctx.createBufferSource();
    src.buffer = bruit();
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 0.7;
    var g = ctx.createGain();
    g.gain.setValueAtTime(volume, quand);
    g.gain.exponentialRampToValueAtTime(0.0001, quand + 0.17);
    src.connect(f).connect(g);
    g.connect(bus);
    g.connect(busRev);          // la claire dans la réverbe : ça « ouvre » le morceau
    src.start(quand);
    src.stop(quand + 0.2);
  }

  function charleston(quand, volume, ouvert) {
    var src = ctx.createBufferSource();
    src.buffer = bruit();
    var f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7200;
    var g = ctx.createGain();
    var d = ouvert ? 0.16 : 0.045;
    g.gain.setValueAtTime(volume, quand);
    g.gain.exponentialRampToValueAtTime(0.0001, quand + d);
    src.connect(f).connect(g).connect(bus);
    src.start(quand);
    src.stop(quand + d + 0.02);
  }

  // ---------------------------------------------------------------------------
  //  L'ARRANGEMENT — ce qui se joue sur un temps donné.
  //
  //  On avance temps par temps (noire). `mesure` sert à faire varier : la
  //  batterie s'étoffe après l'intro, l'arpège change de dessin toutes les
  //  4 mesures, et une mesure sur 8 respire (moins de notes). C'est ce qui
  //  évite l'effet « boucle de 4 secondes » de l'ancienne musique.
  // ---------------------------------------------------------------------------
  function programmeTemps(quand) {
    var A = ambiance;
    var noire = 60 / A.tempo;
    var croche = noire / 2;
    var accord = A.grille[mesure % A.grille.length];
    var intro = mesure < 2;                   // on entre en douceur
    var respire = (mesure % 8) === 7;         // une mesure sur huit s'aère
    var vol = intro ? 0.55 : 1;

    // --- basse : fondamentale sur 1 et 3, quinte sur 4 --------------------
    if (!respire || temps === 0) {
      if (temps === 0 || temps === 2) {
        basse(hz(A.tonique - 12 + accord[0]), quand, noire * 0.9, 0.30 * vol);
      } else if (temps === 3 && !intro) {
        basse(hz(A.tonique - 12 + accord[0] + 7), quand, noire * 0.5, 0.22 * vol);
      }
    }

    // --- batterie ---------------------------------------------------------
    var b = A.batterie * (intro ? 0.4 : 1) * (respire ? 0.5 : 1);
    if (b > 0.05) {
      if (temps === 0 || temps === 2) grosseCaisse(quand, 0.42 * b);
      if (temps === 1 || temps === 3) caisseClaire(quand, 0.20 * b);
      // charleston en croches, celle du contretemps plus discrète
      charleston(quand, 0.075 * b, false);
      if (!respire) charleston(quand + croche, 0.045 * b, temps === 3);
    }

    // --- guitare ----------------------------------------------------------
    var base = A.tonique + accord[0];
    var notes = [base, A.tonique + accord[1], A.tonique + accord[2], base + 12];
    var br = A.brillance;

    if (temps === 0) {
      // Accord plaqué en début de mesure, cordes légèrement décalées : un vrai
      // gratté n'est jamais parfaitement simultané, et c'est ce retard minuscule
      // qui le rend crédible.
      for (var i = 0; i < notes.length; i++) {
        corde(hz(notes[i]), quand + i * 0.012, noire * 2.2, 0.16 * vol, br);
      }
    } else if (!respire) {
      var dessin;
      switch (A.arpege) {
        case 'large': dessin = [notes[3], notes[2]]; break;
        case 'pulse': dessin = [notes[1], notes[3]]; break;
        case 'lent':  dessin = [notes[2]]; break;
        default:      dessin = [notes[2], notes[1]];
      }
      // Le dessin tourne d'une mesure à l'autre pour ne pas se figer.
      var d0 = dessin[(mesure + temps) % dessin.length];
      corde(hz(d0), quand, noire * 1.4, 0.10 * vol, br);
      if (A.arpege !== 'lent' && temps === 2) {
        corde(hz(notes[3]), quand + croche, noire, 0.07 * vol, br);
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  ORDONNANCEUR — fenêtre glissante sur l'horloge audio.
  // ---------------------------------------------------------------------------
  function tourne() {
    if (!ctx || !ambiance) return;
    var noire = 60 / ambiance.tempo;
    while (prochainTemps < ctx.currentTime + FENETRE) {
      programmeTemps(prochainTemps);
      prochainTemps += noire;
      temps++;
      if (temps > 3) { temps = 0; mesure++; }
    }
  }

  // ---------------------------------------------------------------------------
  //  API
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

      // Sonde de niveau : on ne peut pas « écouter » depuis un script de test,
      // et une musique muette ou saturée ne se voit nulle part ailleurs.
      // `level()` donne le RMS instantané ; brancher l'analyseur en dérivation
      // ne coûte rien et n'altère pas le son.
      analyseur = ctx.createAnalyser();
      analyseur.fftSize = 1024;
      sortie.connect(analyseur);

      bus = ctx.createGain();
      bus.gain.value = 1;
      bus.connect(sortie);

      reverb = fabriqueReverb(1.9, 2.6);
      var retour = ctx.createGain();
      retour.gain.value = 0.85;
      reverb.connect(retour).connect(sortie);

      busRev = ctx.createGain();
      busRev.gain.value = 0.30;      // envoi discret : on veut de l'air, pas une cathédrale
      busRev.connect(reverb);

      reveille();
      return true;
    } catch (e) {
      try { console.warn('[music3d] audio indisponible :', e); } catch (e2) { /* rien */ }
      ctx = null;
      return false;
    }
  }

  /** Choisit l'ambiance qui va avec un biome et (re)démarre la boucle. */
  function setBiome(biome) {
    var nom = BIOME_AMBIANCE[biome] || 'douce';
    if (nom === nomAmbiance && minuteur) return;    // déjà en train de jouer
    if (!init()) return;

    // L'ancienne musique de js/audio.js et celle-ci ne doivent jamais jouer
    // ensemble. On coupe la première sans toucher à son fichier (§1.2).
    try {
      if (typeof Audio_ !== 'undefined' && Audio_.stopMusic) Audio_.stopMusic();
    } catch (e) { /* pas grave */ }

    // Chrome suspend le contexte tant qu'il n'y a pas eu de geste utilisateur.
    reveille();

    var repartDeZero = !minuteur;
    nomAmbiance = nom;
    ambiance = AMBIANCES[nom];
    if (repartDeZero) {
      mesure = 0; temps = 0;
      prochainTemps = ctx.currentTime + 0.12;
      minuteur = setInterval(tourne, LOOKAHEAD_MS);
      tourne();
    }
    // Si la boucle tournait déjà, on garde le tempo en cours : changer de
    // région ne doit pas casser la mesure, juste la couleur. Le nouveau tempo
    // s'appliquera au temps suivant, ce qui suffit à faire la transition.
  }

  function stop() {
    if (minuteur) { clearInterval(minuteur); minuteur = null; }
    ambiance = null;
    nomAmbiance = null;
  }

  function setMuted(v) {
    muet = !!v;
    if (sortie) {
      try {
        sortie.gain.setTargetAtTime(muet ? 0 : VOLUME, ctx.currentTime, 0.05);
      } catch (e) { sortie.gain.value = muet ? 0 : VOLUME; }
    }
  }

  function setVolume(v) {
    VOLUME = Math.max(0, Math.min(1, Number(v) || 0));
    if (sortie && !muet) sortie.gain.value = VOLUME;
  }

  function isPlaying() { return !!minuteur; }
  function mood() { return nomAmbiance; }

  /** État interne, pour diagnostiquer depuis la console. */
  function debug() {
    return {
      contexte: ctx ? ctx.state : 'absent',
      muet: muet, volume: VOLUME,
      gainSortie: sortie ? sortie.gain.value : null,
      ambiance: nomAmbiance, mesure: mesure, temps: temps,
      horloge: ctx ? +ctx.currentTime.toFixed(2) : null,
      prochainTemps: +prochainTemps.toFixed(2),
      minuteur: !!minuteur,
    };
  }

  /** Niveau sonore instantané (RMS, 0..1). -1 si la sonde n'existe pas. */
  function level() {
    if (!analyseur) return -1;
    if (!_pcm || _pcm.length !== analyseur.fftSize) _pcm = new Float32Array(analyseur.fftSize);
    analyseur.getFloatTimeDomainData(_pcm);
    var s = 0;
    for (var i = 0; i < _pcm.length; i++) s += _pcm[i] * _pcm[i];
    return Math.sqrt(s / _pcm.length);
  }

  var API = {
    init: init,
    setBiome: setBiome,
    stop: stop,
    setMuted: setMuted,
    setVolume: setVolume,
    isPlaying: isPlaying,
    mood: mood,
    level: level,
    debug: debug,
    AMBIANCES: AMBIANCES,
  };

  try {
    if (RR && RR.register) RR.register('music', API);
  } catch (e) { /* jamais bloquant */ }
  if (typeof globalThis !== 'undefined') globalThis.MUSIC3D = API;
})();
