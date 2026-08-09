// =============================================================================
//  cataclysme3d.js — LE MONDE SE DÉRÈGLE
// =============================================================================
//
//  Deux demandes de Robin, le 9 août 2026 :
//    · « je veux aussi qu'il y ait des séismes, des tsunamis, des tremblements
//       de terre aléatoires et que ça détruise des choses sur la carte »
//    · « quand les Pokémon légendaires se battent, tout se dérègle. Exemple :
//       le Pokémon du temps dérègle le temps, celui de l'eau, l'eau… »
//
//  Les deux sont le même mécanisme vu de deux côtés, d'où un seul module :
//  un cataclysme, c'est une secousse, un message, et une carte qui change
//  vraiment. Ce qui diffère, c'est la CAUSE — le hasard, ou un légendaire en
//  colère dont le type décide de ce qui se dérègle.
//
// -----------------------------------------------------------------------------
//  CE QU'ON NE FAIT JAMAIS  —  les trois règles de sûreté
// -----------------------------------------------------------------------------
//  1. ON NE BLOQUE PERSONNE. `regions3d.abimer()` refuse de poser une tuile
//     infranchissable : un séisme peut coucher un arbre (le passage s'ouvre),
//     jamais dresser un mur. Robin ne peut donc pas se retrouver enfermé.
//  2. ON NE CASSE RIEN D'ESSENTIEL. Portes d'arène, de soins, de boutique,
//     portails entre régions, ponton du dirigeable, autels : intouchables.
//     Une catastrophe qui efface un portail couperait une région pour toujours.
//  3. ON NE FRAPPE PAS DANS LE DOS. Jamais pendant un combat, jamais pendant
//     un dialogue, jamais dans les vingt premières secondes d'une région, et
//     jamais deux fois de suite sans un long répit. Un jeu qui tremble sans
//     arrêt n'est pas inquiétant : il est fatigant.
//
//  Les dégâts vivent dans la grille EN MÉMOIRE. Recharger la région la
//  régénère intacte : une catastrophe marque la partie en cours, elle ne défigure
//  pas le monde pour toujours. C'est voulu — à dix ans, on doit pouvoir souffler.
// =============================================================================

(function () {
  'use strict';

  var R3ref = (typeof R3 !== 'undefined' && R3) ? R3 : null;
  if (!R3ref || typeof R3ref.register !== 'function') return;

  function mod(n) { return (R3ref.get && R3ref.get(n)) || null; }

  // ==========================================================================
  //  1. LES CATASTROPHES
  //
  //  `change` : ce que devient chaque tuile touchée. Toutes les tuiles
  //  d'arrivée sont MARCHABLES — c'est la règle n°1, et `regions3d.abimer()`
  //  la fait respecter de toute façon.
  //  `partout` : la catastrophe peut-elle frapper hors de son biome d'origine ?
  // ==========================================================================

  var SEISME = {
    id: 'seisme',
    nom: 'TREMBLEMENT DE TERRE',
    icone: '🌋',
    annonce: 'Le sol se met à trembler !',
    recit: 'La terre s\'ouvre. Des arbres tombent, des murs se fendent.',
    force: 0.30, duree: 3.4, rayon: 9, sfx: 'legendary',
    regions: null,                     // partout
    change: {
      TREE: 'CRACKED_EARTH', JUNGLE_TREE: 'CRACKED_EARTH', PARK_TREE: 'CRACKED_EARTH',
      PINE_SNOW: 'CRACKED_EARTH', VINE_TREE: 'CRACKED_EARTH', PALM: 'CRACKED_EARTH',
      ROCK: 'CRACKED_EARTH', CACTUS: 'CRACKED_EARTH',
      GRASS: 'CRACKED_EARTH', PLAIN: 'CRACKED_EARTH', TALL_GRASS: 'CRACKED_EARTH',
      TALL_PLAIN: 'CRACKED_EARTH', FLOWERS: 'CRACKED_EARTH', PARK_GRASS: 'CRACKED_EARTH',
      JUNGLE_GRASS: 'CRACKED_EARTH', PLATEAU_GRASS: 'CRACKED_EARTH',
      PATH: 'CRACKED_EARTH', PARK_PATH: 'CRACKED_EARTH', MTN_PATH: 'CRACKED_EARTH',
      // La ville souffre aussi : c'est là que ça se voit le plus.
      HOUSE_RED: 'RUIN_STONE', HOUSE_BLUE: 'RUIN_STONE', HOUSE_YELLOW: 'RUIN_STONE',
      VLG_HOUSE: 'RUIN_STONE', TOWNHOUSE_A: 'RUIN_STONE', TOWNHOUSE_B: 'RUIN_STONE',
      TOWNHOUSE_C: 'RUIN_STONE', MARKET_STALL: 'RUIN_STONE', HEDGE: 'RUIN_STONE',
      LAMP_POST: 'RUIN_STONE', BANNER_POLE: 'RUIN_STONE', STATUE: 'RUIN_STONE',
      RUIN_PILLAR: 'RUIN_STONE',
    },
  };

  var TSUNAMI = {
    id: 'tsunami',
    nom: 'TSUNAMI',
    icone: '🌊',
    annonce: 'La mer se retire d\'un coup… puis elle revient !',
    recit: 'Une vague énorme passe par-dessus la côte et laisse tout trempé.',
    force: 0.26, duree: 4.0, rayon: 11, sfx: 'legendary',
    regions: ['saphir', 'val', 'sylve'],   // il faut une côte pour un raz-de-marée
    change: {
      SAND: 'SHALLOW', CORAL_SAND: 'SHALLOW', DOCK: 'SHALLOW', BOAT: 'SHALLOW',
      GRASS: 'MUD', PLAIN: 'MUD', TALL_GRASS: 'MUD', FLOWERS: 'MUD',
      PATH: 'MUD', PARK_GRASS: 'MUD', PARK_PATH: 'MUD', SWAMP_GRASS: 'MUD',
      PALM: 'MUD', TREE: 'MUD', REEF: 'SHALLOW',
      HOUSE_RED: 'RUIN_STONE', HOUSE_BLUE: 'RUIN_STONE', HOUSE_YELLOW: 'RUIN_STONE',
      MARKET_STALL: 'MUD', BENCH: 'MUD',
    },
  };

  var ERUPTION = {
    id: 'eruption',
    nom: 'ÉRUPTION',
    icone: '🔥',
    annonce: 'Le volcan gronde et crache le ciel en rouge !',
    recit: 'Des cendres tombent partout. Le sol devient noir et chaud.',
    force: 0.28, duree: 3.6, rayon: 8, sfx: 'legendary',
    regions: ['braise'],
    change: {
      TREE: 'ASH', EMBER_GRASS: 'ASH', GRASS: 'ASH', PLAIN: 'ASH',
      DESERT_SAND: 'ASH', CRACKED_EARTH: 'LAVA_CRUST', PATH: 'LAVA_CRUST',
      BASALT: 'LAVA_CRUST', ROCK: 'BASALT', DRY_BONE: 'ASH', CACTUS: 'ASH',
    },
  };

  var BLIZZARD = {
    id: 'blizzard',
    nom: 'BLIZZARD',
    icone: '❄️',
    annonce: 'Le vent se lève et le ciel disparaît sous la neige !',
    recit: 'Tout est enseveli. On ne reconnaît plus rien.',
    force: 0.18, duree: 4.2, rayon: 10, sfx: 'legendary',
    regions: ['givre'],
    change: {
      GRASS: 'DEEP_SNOW', PLAIN: 'DEEP_SNOW', TALL_GRASS: 'DEEP_SNOW',
      SNOW: 'DEEP_SNOW', MTN_GRASS: 'DEEP_SNOW', PATH: 'DEEP_SNOW',
      MTN_PATH: 'DEEP_SNOW', PINE_SNOW: 'DEEP_SNOW', ICE: 'DEEP_SNOW',
      TREE: 'DEEP_SNOW', ROCK: 'DEEP_SNOW',
    },
  };

  var CATASTROPHES = [SEISME, TSUNAMI, ERUPTION, BLIZZARD];
  var PAR_ID = {};
  for (var c0 = 0; c0 < CATASTROPHES.length; c0++) PAR_ID[CATASTROPHES[c0].id] = CATASTROPHES[c0];

  // ==========================================================================
  //  2. LES DÉRÈGLEMENTS  —  « quand les légendaires se battent, tout se
  //     dérègle : celui du temps dérègle le temps, celui de l'eau, l'eau… »
  //
  //  À chaque type élémentaire son désordre. Ce n'est pas la même chose qu'une
  //  catastrophe de hasard : ici, le monde réagit à ce qui vient de se passer,
  //  et Robin doit pouvoir faire le lien tout seul entre la créature et le
  //  dégât. D'où un texte qui NOMME le coupable à chaque fois.
  // ==========================================================================

  var DEREGLEMENTS = {
    terre:   { via: 'seisme',   phrase: 'la terre elle-même se soulève' },
    roche:   { via: 'seisme',   phrase: 'la montagne se met à rouler' },
    eau:     { via: 'tsunami',  phrase: 'toute l\'eau du monde se dresse d\'un coup' },
    glace:   { via: 'blizzard', phrase: 'l\'air gèle en plein jour' },
    feu:     { via: 'eruption', phrase: 'le sol s\'ouvre et le feu monte' },
    // Les quatre suivants n'abîment PAS la carte : ils dérèglent le CIEL et le
    // TEMPS QUI PASSE. Un Dialga qui se bat ne casse pas des maisons — il fait
    // repasser la même heure trois fois. C'est plus étrange, et bien plus juste.
    temps:   { ciel: 'temps',   phrase: 'les heures se mélangent, midi revient deux fois' },
    espace:  { ciel: 'espace',  phrase: 'le ciel se déchire et montre ce qu\'il y a derrière' },
    lumiere: { ciel: 'jour',    phrase: 'le jour se lève d\'un coup, en pleine nuit' },
    ombre:   { ciel: 'nuit',    phrase: 'la nuit tombe en plein midi' },
    foudre:  { ciel: 'orage',   phrase: 'le ciel se remplit d\'éclairs' },
    air:     { ciel: 'orage',   phrase: 'le vent se met à tourner en rond' },
    plante:  { via: 'seisme',   phrase: 'les racines remontent et fendent le sol' },
    fee:     { ciel: 'jour',    phrase: 'tout devient trop clair, trop doux' },
    psy:     { ciel: 'nuit',    phrase: 'on ne sait plus très bien où on est' },
  };

  // ==========================================================================
  //  3. L'ÉTAT
  // ==========================================================================

  var _actif = true;
  var _regionId = null;
  var _depuisRegion = 0;        // secondes depuis l'arrivée dans la région
  var _prochain = 0;            // délai avant le prochain tirage
  var _dernier = null;          // dernier cataclysme joué (pour le récit)
  var _compteur = 0;            // combien depuis le début de la partie
  var _tension = 0;             // 0 = monde calme ; monte avec l'histoire

  // Réglages. Les catastrophes de HASARD sont rares : c'est ce qui leur garde
  // leur effet. Les catastrophes CAUSÉES (légendaires, méchants) ne passent pas
  // par ce minuteur — elles arrivent quand l'histoire le décide.
  var CALME_ARRIVEE = 25;       // s après l'entrée dans une région
  var DELAI_MIN = 150;          // s entre deux tirages
  var DELAI_MAX = 300;
  var CHANCE = 0.28;            // et même là, ce n'est pas systématique

  function alea(a, b) { return a + Math.random() * (b - a); }

  // ==========================================================================
  //  4. FRAPPER
  // ==========================================================================

  /** Les catastrophes possibles dans cette région. */
  function possibles(regionId) {
    var out = [];
    for (var i = 0; i < CATASTROPHES.length; i++) {
      var k = CATASTROPHES[i];
      if (k.regions && k.regions.indexOf(regionId) < 0) continue;
      out.push(k);
    }
    return out;
  }

  /**
   * Abîme la carte autour de (cx, cy). -> nombre de tuiles changées.
   *
   * Le disque n'est pas plein : plus on s'éloigne du centre, moins il y a de
   * chances qu'une tuile soit touchée. Une zone entièrement rasée jusqu'à une
   * frontière nette ne ressemble à rien ; un dégât qui s'estompe sur les bords,
   * si.
   */
  function abimerAutour(kind, cx, cy) {
    var R = mod('regions');
    if (!R || !R.abimer) return 0;
    var r = kind.rayon, n = 0;
    var xmin = cx - r, xmax = cx + r, ymin = cy - r, ymax = cy + r;
    for (var y = ymin; y <= ymax; y++) {
      for (var x = xmin; x <= xmax; x++) {
        var dx = x - cx, dy = y - cy;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        // 90 % au centre, presque rien sur le bord.
        if (Math.random() > 0.9 * (1 - d / r) + 0.1) continue;
        var actuel = R.nomTuile ? R.nomTuile(x, y) : null;
        var devient = actuel ? kind.change[actuel] : null;
        if (!devient) continue;
        if (R.abimer(x, y, devient)) n++;
      }
    }
    if (n) {
      var W = mod('world');
      if (W && W.refreshArea) W.refreshArea(xmin, ymin, xmax, ymax);
    }
    return n;
  }

  /**
   * Déclenche une catastrophe.
   * @param {string} id     'seisme' | 'tsunami' | 'eruption' | 'blizzard'
   * @param {number} cx,cy  centre, en tuiles (par défaut : autour du joueur)
   * @param {object} opts   { cause: 'texte', force: 0..0.6, silencieux: bool }
   * -> { id, tuiles, texte } ou null si rien n'a pu se produire.
   */
  function declencher(id, cx, cy, opts) {
    opts = opts || {};
    var kind = PAR_ID[id];
    if (!kind) return null;

    var cam = mod('camera');
    if (cam && cam.shake) cam.shake(opts.force || kind.force, kind.duree);

    var tuiles = (typeof cx === 'number' && typeof cy === 'number')
      ? abimerAutour(kind, Math.round(cx), Math.round(cy)) : 0;

    _dernier = { id: kind.id, tuiles: tuiles, t: Date.now() };
    _compteur++;

    var texte = kind.icone + ' ' + kind.nom + ' !\n' + kind.annonce;
    if (opts.cause) texte += '\n' + opts.cause;
    if (tuiles > 0) texte += '\n' + kind.recit;

    return { id: kind.id, tuiles: tuiles, texte: texte, icone: kind.icone, kind: kind };
  }

  /**
   * Le monde réagit à un légendaire — « celui du temps dérègle le temps ».
   * @param {string} speciesId  le légendaire en cause
   * @param {number} cx,cy      où ça se passe
   * -> { texte, cataclysme } ou null si son type ne dérègle rien.
   */
  function deregler(speciesId, cx, cy) {
    var dex = mod('dex');
    var sp = (dex && dex.get) ? dex.get(speciesId) : null;
    if (!sp || !sp.legendary) return null;
    var type = (sp.types && sp.types[0]) || null;
    var reg = type ? DEREGLEMENTS[type] : null;
    if (!reg) return null;

    var nom = sp.name || speciesId;
    var cause = '✦ ' + nom.toUpperCase() + ' se déchaîne : ' + reg.phrase + '.';

    // Un dérèglement du ciel : pas de dégât sur la carte, mais le monde change
    // d'aspect sous les yeux du joueur.
    if (reg.ciel) {
      var res = derangerLeCiel(reg.ciel);
      var cam = mod('camera');
      if (cam && cam.shake) cam.shake(0.12, 2.2);
      return {
        texte: '🌀 LE MONDE SE DÉRÈGLE\n' + cause + '\n' + res,
        cataclysme: null, ciel: reg.ciel,
      };
    }

    var k = declencher(reg.via, cx, cy, { cause: cause });
    if (!k) return null;
    return { texte: '🌀 LE MONDE SE DÉRÈGLE\n' + k.texte, cataclysme: k.id, ciel: null };
  }

  /**
   * LE CIEL SE DÉRANGE.
   *
   * `sky3d` n'a pas de cycle jour/nuit — il ne connaît que des AMBIANCES, une
   * par biome, et il sait passer doucement de l'une à l'autre. On lui donne
   * donc une ambiance qui n'est pas un lieu : `chaos_nuit`, `chaos_orage`…
   * (déclarées dans `core3d.BIOME_MOOD`). Il l'affiche sans rien avoir à
   * apprendre, et sa transition habituelle devient gratuitement la bascule du
   * dérèglement.
   *
   * Le ciel revient tout seul au bout de `CIEL_DUREE` secondes : c'est
   * `update()` qui le remet d'aplomb. Un ciel resté noir pour toujours parce
   * qu'un légendaire s'est battu une fois serait une punition, pas un effet.
   */
  var CIEL_DUREE = 26;
  var _cielRestant = 0;
  var _cielAvant = null;

  var CIEL_TEXTES = {
    nuit:   ['chaos_nuit',   'La nuit tombe d\'un coup, en plein après-midi.'],
    jour:   ['chaos_jour',   'Le soleil se rallume comme une lampe. Tout devient blanc.'],
    temps:  ['chaos_temps',  'L\'heure a sauté. Impossible de dire s\'il est midi ou minuit.'],
    espace: ['chaos_espace', 'Les étoiles apparaissent alors qu\'il fait encore jour.'],
    orage:  ['chaos_orage',  'Le ciel devient noir et se remplit d\'éclairs.'],
  };

  function derangerLeCiel(quoi) {
    var d = CIEL_TEXTES[quoi];
    if (!d) return 'Quelque chose ne tourne pas rond.';
    var sky = mod('sky');
    if (sky && typeof sky.setBiome === 'function') {
      try {
        // On mémorise le VRAI biome une seule fois : deux dérèglements de suite
        // ne doivent pas faire mémoriser `chaos_nuit` comme état normal.
        if (_cielRestant <= 0 && typeof sky.currentBiome === 'function') {
          _cielAvant = sky.currentBiome();
        }
        sky.setBiome(d[0], false);
        _cielRestant = CIEL_DUREE;
      } catch (e) { /* ciel indisponible : le texte suffit */ }
    }
    return d[1];
  }

  /** Remet le ciel d'aplomb quand le dérèglement a assez duré. */
  function majCiel(dt) {
    if (_cielRestant <= 0) return;
    _cielRestant -= (dt || 0);
    if (_cielRestant > 0) return;
    _cielRestant = 0;
    var sky = mod('sky');
    if (sky && typeof sky.setBiome === 'function' && _cielAvant) {
      try { sky.setBiome(_cielAvant, false); } catch (e) { /* tant pis */ }
    }
    _cielAvant = null;
  }

  // ==========================================================================
  //  5. LE HASARD  —  appelé par game3d à chaque image
  //
  //  `contexte` doit dire si le joueur est disponible : on ne fait JAMAIS
  //  trembler la terre pendant un combat ou une phrase de PNJ.
  // ==========================================================================

  function setRegion(id) {
    _regionId = id;
    _depuisRegion = 0;
    _prochain = alea(DELAI_MIN, DELAI_MAX);
  }

  /**
   * -> le cataclysme déclenché ce tick, ou null (le cas courant, de loin).
   * @param {number} dt   secondes écoulées
   * @param {object} ctx  { x, y, libre: bool }
   */
  function update(dt, ctx) {
    // Le ciel se remet d'aplomb même pendant un combat ou un dialogue : c'est
    // une remise en ordre, pas un événement. La bloquer ici laisserait le monde
    // dans le noir tant que Robin parle à quelqu'un.
    majCiel(dt);

    if (!_actif || !ctx || !ctx.libre) return null;
    _depuisRegion += (dt || 0);
    if (_depuisRegion < CALME_ARRIVEE) return null;

    _prochain -= (dt || 0);
    if (_prochain > 0) return null;
    _prochain = alea(DELAI_MIN, DELAI_MAX);

    // La tension monte avec l'histoire : plus le monde va mal, plus la terre
    // tremble. À tension 0, le jeu reste celui que Robin connaît.
    var chance = CHANCE + _tension * 0.25;
    if (Math.random() > chance) return null;

    var liste = possibles(_regionId);
    if (!liste.length) return null;
    var kind = liste[(Math.random() * liste.length) | 0];

    // Jamais sur le joueur : à quelques pas, pour qu'il VOIE le sol s'ouvrir.
    var ang = Math.random() * Math.PI * 2;
    var d = 7 + Math.random() * 6;
    var cx = Math.round(ctx.x + Math.cos(ang) * d);
    var cy = Math.round(ctx.y + Math.sin(ang) * d);
    return declencher(kind.id, cx, cy, {});
  }

  // ==========================================================================
  //  6. API
  // ==========================================================================

  var API = {
    CATASTROPHES: CATASTROPHES,
    DEREGLEMENTS: DEREGLEMENTS,
    setRegion: setRegion,
    update: update,
    declencher: declencher,
    deregler: deregler,
    derangerLeCiel: derangerLeCiel,
    /** Monte ou descend la tension du monde (0 = calme, 1 = fin du monde). */
    setTension: function (v) { _tension = Math.max(0, Math.min(1, Number(v) || 0)); },
    tension: function () { return _tension; },
    setActif: function (v) { _actif = !!v; },
    actif: function () { return _actif; },
    dernier: function () { return _dernier; },
    compteur: function () { return _compteur; },
    /** Les types de légendaires qui dérèglent quelque chose. */
    typesDereglants: function () {
      var out = [];
      for (var k in DEREGLEMENTS) if (Object.prototype.hasOwnProperty.call(DEREGLEMENTS, k)) out.push(k);
      return out;
    },
  };

  R3ref.register('cataclysme', API);
  if (typeof window !== 'undefined') window.CATACLYSME3D = API;
})();
