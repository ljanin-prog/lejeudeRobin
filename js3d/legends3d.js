// =============================================================================
//  legends3d.js — LES LÉGENDAIRES : PUISSANCE, TAILLE, DIMENSIONS, RIVALITÉS
// =============================================================================
//
//  Trois demandes de Robin, le 9 août 2026 :
//    · « je voudrais que les légendaires soient extrêmement puissants »
//    · « je voudrais qu'il y ait des conflits entre les légendaires »
//    · « je voudrais que quelques légendaires aient des dimensions »
//      (interrogé, Robin a précisé : un monde à eux ET une taille énorme)
//
//  Ce module ne dessine rien et n'anime rien. Il DÉCIDE, et les autres lisent :
//    · `dex3d`     reçoit les statistiques rehaussées, au chargement ;
//    · `battle3d`  demande l'échelle d'un titan et le décor d'une dimension ;
//    · `roamers3d` demande l'échelle sur la carte et qui poursuit le joueur ;
//    · `game3d`    demande les textes de la mise en scène et garde l'état.
//
//  Tout est facultatif : si ce fichier n'est pas chargé, le jeu retrouve
//  exactement le comportement qu'il avait avant (§1 règle 7).
//
// -----------------------------------------------------------------------------
//  POURQUOI CES MULTIPLICATEURS-LÀ, ET PAS « TOUT ×3 »
// -----------------------------------------------------------------------------
//  La formule de dégâts (`moves3d.compute`) borne le rapport attaque/défense
//  entre 0,6 et 1,7. Une fois ce plafond atteint, MONTER L'ATTAQUE NE FAIT
//  PLUS RIEN — un Arceus à 400 d'attaque et un Arceus à 1200 frappent
//  exactement pareil sur la même créature. C'est la découverte qui a dicté ces
//  chiffres :
//
//    · les PV et la DÉFENSE comptent linéairement -> ×1,45. C'est là que se
//      gagne la vraie difficulté : le combat devient long, il faut tenir ;
//    · l'ATTAQUE monte moins (×1,35) : au-delà, elle serait dépensée en pure
//      perte contre le plafond ;
//    · la VITESSE (×1,20) décide qui frappe en premier — le vrai luxe.
//
//  Le résultat, mesuré : un légendaire passe de ~1,8 fois l'équipe de fin de
//  jeu à ~2,8 fois. Robin arrive à six créatures contre une : le combat dure
//  quinze à vingt tours, il faut soigner, changer de créature et viser les
//  faiblesses. C'est dur. Ce n'est pas injuste.
// =============================================================================

(function () {
  'use strict';

  var R3ref = (typeof R3 !== 'undefined' && R3) ? R3 : null;
  if (!R3ref || typeof R3ref.get !== 'function') return;

  // ==========================================================================
  //  1. LA PUISSANCE
  // ==========================================================================

  //  LES PV NE BOUGENT PAS — et c'est le résultat le plus contre-intuitif de
  //  toute cette histoire. Mesuré : +25 % de PV sur Arceus, et le combat passe
  //  de 27 à 105 tours pour exactement le même dénouement. Un enfant de dix ans
  //  n'ira pas au bout de 105 tours, et il n'aura plus un seul PP au trentième.
  //  Gonfler les PV d'un boss ne le rend pas dangereux : ça rend le joueur
  //  impatient. La difficulté vient des COLÈRES (voir §1 bis) — ce qu'il
  //  encaisse, pas ce qu'il faut lui arracher.
  //
  //  Reste la VITESSE, largement rehaussée : passer devant, c'est frapper le
  //  premier, et sur un coup à 84 de puissance, cela change tout.
  var BOOST = { hp: 1.00, atk: 1.15, def: 1.05, speed: 1.30 };

  // Les six seigneurs de dimension ont droit à un peu plus de tout — mais
  // toujours pas de PV en rab, pour la raison ci-dessus.
  var BOOST_SEIGNEUR = { hp: 1.00, atk: 1.10, def: 1.10, speed: 1.05 };

  // ==========================================================================
  //  1 bis. LA COLÈRE DES GARDIENS  —  là où se joue VRAIMENT la difficulté
  //
  //  Première tentative : monter fortement les PV et la défense. Résultat
  //  mesuré par simulation (.claude/verif_legends.js) : le combat passait de
  //  26 à 106 tours et le joueur gagnait toujours à 100 %. Plus long, pas plus
  //  dur — le pire des deux mondes, et impossible à finir avec les PP qu'on a.
  //
  //  La raison tient en une ligne de `moves3d.compute` : le rapport
  //  attaque/défense est borné à 1,7 et le bonus de niveau à 1,4. Les dégâts
  //  d'un légendaire plafonnaient donc autour de 110 par coup, quand une
  //  créature de fin de jeu a 300 à 460 PV et se rend 45 % de sa vie d'un seul
  //  soin. Il ne pouvait tout simplement PAS percer : aucune statistique, si
  //  haute soit-elle, n'y aurait changé quoi que ce soit.
  //
  //  Le seul terme de la formule qui n'est pas plafonné, c'est la PUISSANCE DE
  //  LA CAPACITÉ. D'où ces attaques : une par type élémentaire, à 62-84 de
  //  puissance là où la plus violente du jeu montait à 50. Elles ne sont
  //  données qu'aux légendaires, et elles changent tout — le soin ne suffit
  //  plus à annuler un coup.
  //
  //  Et c'est bien plus intéressant qu'un multiplicateur invisible : Robin VOIT
  //  arriver « Colère de la Terre », il en comprend la conséquence, et le jour
  //  où il capture le gardien, l'attaque devient sienne.
  // ==========================================================================

  var RAGES = {
    feu:     ['rageDuVolcan',   'Colère du Volcan',    'La montagne se fend et tout le feu du monde en sort.'],
    eau:     ['rageDesAbysses', 'Colère des Abysses',  'La mer se retire d\'un coup… puis revient tout entière.'],
    plante:  ['rageDeLaForet',  'Colère de la Forêt',  'Chaque racine du monde remonte à la surface en même temps.'],
    foudre:  ['rageDuCiel',     'Colère du Ciel',      'Mille éclairs tombent au même endroit, à la même seconde.'],
    glace:   ['rageDesGlaces',  'Colère des Glaces',   'L\'air devient si froid qu\'il se casse comme du verre.'],
    air:     ['rageDesVents',   'Colère des Vents',    'Le ciel se met à tourner. Tout ce qui n\'est pas enraciné s\'envole.'],
    terre:   ['rageDeLaTerre',  'Colère de la Terre',  'Le sol se soulève comme une couverture qu\'on secoue.'],
    roche:   ['rageDesPierres', 'Colère des Pierres',  'La montagne entière se met à tomber, et elle vise.'],
    lumiere: ['rageDuSoleil',   'Colère du Soleil',    'Une lumière si blanche qu\'on ne voit plus rien du tout.'],
    ombre:   ['rageDesTenebres', 'Colère des Ténèbres', 'L\'ombre se détache du sol et se referme sur toi.'],
    temps:   ['rageDesSiecles', 'Colère des Siècles',  'Mille ans passent d\'un coup — et repartent en arrière.'],
    espace:  ['rageDesEtoiles', 'Colère des Étoiles',  'Le ciel se déchire et laisse tomber ce qu\'il y a derrière.'],
  };

  // Les six seigneurs frappent encore plus fort, et chacun à sa façon : à ce
  // niveau du jeu, une attaque doit se reconnaître à son nom.
  var RAGES_SEIGNEUR = {
    vortexis: ['brisureDEspace',  'Brisure d\'Espace',   'espace', 'Palkia referme la main : l\'espace se plie en deux avec tout ce qu\'il contient.'],
    chronoss: ['arretDefinitif',  'Arrêt Définitif',     'temps',  'Dialga arrête le temps — et te laisse dedans.'],
    sablion:  ['renversement',    'Renversement',        'temps',  'Giratina retourne le monde. Le sol passe au-dessus de ta tête.'],
    astralis: ['finDeTouteChose', 'Fin de Toute Chose',  'espace', 'Eternatus ouvre le vide. Il n\'y a rien de l\'autre côté.'],
    nebulon:  ['nuitAbsolue',     'Nuit Absolue',        'ombre',  'Lunala avale la lumière, la dernière comprise.'],
    aureol:   ['jugementOriginel', 'Jugement Originel',  'lumiere', 'Arceus décide. Ce qu\'il décide arrive, tout simplement.'],
  };

  // ==========================================================================
  //  2. LES DIMENSIONS
  //
  //  Six légendaires ne se battent PAS dans le monde de Robin : ils l'aspirent
  //  dans le leur. Ce sont les six dont la légende le dit déjà — ceux du temps,
  //  de l'espace, de la lumière et du vide.
  //
  //  `biome` est un décor de combat déclaré par `battle3d.js` (§ ARENA). Il ne
  //  s'agit pas d'une région jouable : on n'y marche pas, on y COMBAT. C'est
  //  ce qui permet à la dimension d'exister sans réécrire la carte du monde.
  // ==========================================================================

  var DIMENSIONS = {
    vortexis: {                                   // Palkia — l'espace
      nom: 'la Faille de l\'Espace',
      biome: 'dim_espace',
      entree: 'L\'air se plie en deux. Le sol n\'est plus là.\nTu tombes dans un ciel de nacre où flottent des îles brisées.',
      sortie: 'La faille se referme derrière toi. Tu es de retour, un peu tremblant.',
    },
    chronoss: {                                   // Dialga — le temps
      nom: 'le Couloir du Temps',
      biome: 'dim_temps',
      entree: 'Tout s\'arrête. Les oiseaux restent en l\'air.\nPuis tout repart À L\'ENVERS, et tu n\'es plus nulle part.',
      sortie: 'Le temps se remet à couler dans le bon sens. Enfin.',
    },
    sablion: {                                    // Giratina — le monde renversé
      nom: 'le Monde Renversé',
      biome: 'dim_renverse',
      entree: 'Le ciel passe sous tes pieds.\nIci, tout est à l\'envers — et quelque chose te regarde depuis le plafond.',
      sortie: 'Le monde se remet à l\'endroit. Ton estomac, presque.',
    },
    astralis: {                                   // Eternatus — le vide
      nom: 'le Vide Éternel',
      biome: 'dim_vide',
      entree: 'Il n\'y a plus de sol, plus de ciel, plus de couleurs.\nJuste toi, et une chose immense qui n\'en finit pas.',
      sortie: 'Les couleurs reviennent une à une. Tu respires.',
    },
    nebulon: {                                    // Lunala — la nuit sans fin
      nom: 'la Nuit sans Fin',
      biome: 'dim_nuit',
      entree: 'La nuit tombe d\'un coup, en plein midi.\nDes milliers d\'étoiles s\'allument — et l\'une d\'elles ouvre un œil.',
      sortie: 'Le jour se rallume comme si de rien n\'était.',
    },
    aureol: {                                     // Arceus — l'origine
      nom: 'la Salle de l\'Origine',
      biome: 'dim_origine',
      entree: 'Il n\'y a rien. Pas encore.\nPuis un anneau d\'or tourne, et le monde commence à exister autour de toi.',
      sortie: 'Le monde se replie doucement. Tu reviens là où tu étais.',
    },
  };

  // ==========================================================================
  //  3. LES TITANS  —  « qu'ils soient ÉNORMES »
  //
  //  L'échelle multiplie celle que `battle3d` et `roamers3d` appliquent déjà
  //  aux légendaires (1,18 en combat). Trois rangs :
  //    · 2,6 pour les six seigneurs de dimension — ils remplissent l'écran ;
  //    · 2,0 pour les trois colosses du monde (Groudon, Kyogre, Rayquaza) ;
  //    · rien pour les autres : si tout est énorme, plus rien ne l'est.
  // ==========================================================================

  var TITANS = {
    vortexis: 2.6, chronoss: 2.6, sablion: 2.6,
    astralis: 2.6, nebulon: 2.6, aureol: 2.6,
    pyrathos: 2.0, abyssalor: 2.0, zephyrion: 2.0,
  };

  // ==========================================================================
  //  4. LES RIVALITÉS  —  « qu'il y ait des conflits entre les légendaires »
  //
  //  Huit couples ennemis. Chacun est une vraie opposition, pas un tirage au
  //  sort : la terre contre la mer, le temps contre l'espace, la vie contre la
  //  fin. Les ids sont ceux du Pokédex de Robin ; les noms affichés sont ceux
  //  que le jeu leur donne déjà.
  //
  //  Deux choses en découlent, l'une visible tout de suite, l'autre plus tard :
  //
  //   · LE DUEL. Quand un légendaire apparaît sur son autel, son rival peut
  //     surgir à côté de lui. Robin les trouve en train de se déchirer et
  //     choisit : aider l'un (il affronte l'autre) ou les affronter tous les
  //     deux, l'un après l'autre.
  //
  //   · LA VENGEANCE. Capturer un légendaire rend son rival FURIEUX. Il quitte
  //     son autel et cherche Robin partout dans le monde — il peut surgir
  //     n'importe où, sans prévenir, jusqu'à ce qu'il soit battu ou capturé.
  // ==========================================================================

  var RIVALITES = [
    { a: 'pyrathos',  b: 'abyssalor', motif: 'la terre contre la mer',
      cri: 'La terre se soulève, la mer se dresse. Ils se détestent depuis toujours.' },
    { a: 'chronoss',  b: 'vortexis',  motif: 'le temps contre l\'espace',
      cri: 'L\'un veut tout figer, l\'autre veut tout déplacer. Le monde tremble entre les deux.' },
    { a: 'emberyx',   b: 'marea',     motif: 'le feu du ciel contre le gardien des mers',
      cri: 'L\'arc-en-ciel et la tempête se disputent le ciel depuis mille ans.' },
    { a: 'sylvaros',  b: 'eclipsion', motif: 'la vie contre la fin',
      cri: 'L\'un fait pousser, l\'autre fait tomber. Ils ne peuvent pas exister au même endroit.' },
    { a: 'nyxaroth',  b: 'astralis',  motif: 'l\'épée contre l\'infini',
      cri: 'Une lame contre une chose sans fin. Le combat n\'a jamais eu de vainqueur.' },
    { a: 'solaria',   b: 'cryonix',   motif: 'le soleil contre le gel',
      cri: 'Là où ils se croisent, l\'air brûle et gèle en même temps.' },
    { a: 'fournalis', b: 'ondinae',   motif: 'le feu qui court contre l\'eau qui lave',
      cri: 'Le premier allume, la seconde éteint. Ils courent l\'un après l\'autre sans fin.' },
    { a: 'aureol',    b: 'sablion',   motif: 'le créateur contre le banni',
      cri: 'L\'un a fait le monde, l\'autre en a été chassé. Ils ne se sont jamais pardonné.' },
  ];

  // Index : id -> id du rival. Une rivalité se lit dans les deux sens.
  var RIVAL_DE = {};
  var CONFLIT_DE = {};
  for (var r = 0; r < RIVALITES.length; r++) {
    var duo = RIVALITES[r];
    RIVAL_DE[duo.a] = duo.b;
    RIVAL_DE[duo.b] = duo.a;
    CONFLIT_DE[duo.a] = duo;
    CONFLIT_DE[duo.b] = duo;
  }

  // ==========================================================================
  //  5. APPLICATION AU POKÉDEX
  //
  //  On modifie les objets du Pokédex EN PLACE, une seule fois. `_boostLegend`
  //  sert de marque : recharger le module (harnais, page rouverte) ne double
  //  jamais la mise.
  // ==========================================================================

  function arrondi(v, k) { return Math.max(1, Math.round((v || 1) * k)); }

  /**
   * Inscrit les colères au catalogue de `moves3d`, puis en donne une à chaque
   * légendaire.
   *
   * ON REMPLACE LA CAPACITÉ LA PLUS FAIBLE, jamais le soin : la règle du
   * Pokédex — « chacun sait se soigner » — vaut aussi pour les adversaires,
   * sinon un légendaire acculé n'aurait plus rien à faire de ses derniers
   * tours. Et si le légendaire connaît déjà une capacité de son type, c'est
   * celle-là qu'on remplace : deux attaques de feu sur quatre, ça ne sert à
   * rien quand l'une écrase l'autre.
   */
  function appliquerColeres(moves) {
    if (!moves || !moves.MOVES) return 0;
    var M = moves.MOVES;

    // 1. Le catalogue. `legendary: true` les range avec les signatures, et
    //    `acc: 0.9` leur laisse une petite chance de manquer : un boss qui ne
    //    rate jamais ne laisse aucune place au soulagement.
    for (var t in RAGES) {
      if (!Object.prototype.hasOwnProperty.call(RAGES, t)) continue;
      var d = RAGES[t];
      if (M[d[0]]) continue;
      M[d[0]] = {
        id: d[0], name: d[1], type: t, power: [62, 84], acc: 0.9, heal: 0,
        pp: 6, fx: 'beam', desc: d[2], priority: 0, legendary: true,
      };
    }
    for (var id in RAGES_SEIGNEUR) {
      if (!Object.prototype.hasOwnProperty.call(RAGES_SEIGNEUR, id)) continue;
      var s = RAGES_SEIGNEUR[id];
      if (M[s[0]]) continue;
      M[s[0]] = {
        id: s[0], name: s[1], type: s[2], power: [84, 108], acc: 0.88, heal: 0,
        pp: 5, fx: 'beam', desc: s[3], priority: 0, legendary: true,
      };
    }

    // 2. La distribution.
    var dex = R3ref.get('dex');
    if (!dex || !dex.LEGENDS) return 0;
    var n = 0;
    for (var i = 0; i < dex.LEGENDS.length; i++) {
      var sp = dex.LEGENDS[i];
      if (!sp || sp._colere) continue;
      var seign = RAGES_SEIGNEUR[sp.id];
      var rage = seign ? seign[0] : (RAGES[sp.types[0]] ? RAGES[sp.types[0]][0] : null);
      if (!rage || !M[rage]) continue;
      if (sp.moveIds.indexOf(rage) >= 0) { sp._colere = true; continue; }

      // La cible du remplacement : d'abord une attaque du même type, sinon la
      // moins puissante. Jamais un soin.
      var cible = -1, pireScore = Infinity;
      for (var j = 0; j < sp.moveIds.length; j++) {
        var mv = M[sp.moveIds[j]];
        if (!mv || mv.heal) continue;
        var p = (mv.power && mv.power.length === 2) ? (mv.power[0] + mv.power[1]) / 2 : 0;
        var score = (mv.type === M[rage].type) ? p - 1000 : p;   // même type = priorité absolue
        if (score < pireScore) { pireScore = score; cible = j; }
      }
      if (cible < 0) continue;
      sp.moveIds[cible] = rage;
      sp._colere = true;
      n++;
    }
    return n;
  }

  function appliquerPuissance() {
    var dex = R3ref.get('dex');
    if (!dex || !dex.LEGENDS) return 0;
    var n = 0;
    for (var i = 0; i < dex.LEGENDS.length; i++) {
      var sp = dex.LEGENDS[i];
      if (!sp || sp._boostLegend) continue;
      var seigneur = !!DIMENSIONS[sp.id];
      var kh = BOOST.hp * (seigneur ? BOOST_SEIGNEUR.hp : 1);
      var ka = BOOST.atk * (seigneur ? BOOST_SEIGNEUR.atk : 1);
      var kd = BOOST.def * (seigneur ? BOOST_SEIGNEUR.def : 1);
      var kv = BOOST.speed * (seigneur ? BOOST_SEIGNEUR.speed : 1);
      sp.baseHp = arrondi(sp.baseHp, kh);
      sp.atk = arrondi(sp.atk, ka);
      sp.def = arrondi(sp.def, kd);
      sp.speed = arrondi(sp.speed, kv);
      sp._boostLegend = true;
      sp.seigneur = seigneur;
      n++;
    }
    return n;
  }

  var boostes = appliquerPuissance();
  var coleres = appliquerColeres(R3ref.get('moves'));

  // ==========================================================================
  //  6. API
  // ==========================================================================

  var API = {
    BOOST: BOOST,
    BOOST_SEIGNEUR: BOOST_SEIGNEUR,
    DIMENSIONS: DIMENSIONS,
    TITANS: TITANS,
    RIVALITES: RIVALITES,
    RAGES: RAGES,
    RAGES_SEIGNEUR: RAGES_SEIGNEUR,
    boostes: boostes,
    coleres: coleres,

    /** L'id de la capacité de colère de ce légendaire, ou null. */
    rageOf: function (id) {
      if (RAGES_SEIGNEUR[id]) return RAGES_SEIGNEUR[id][0];
      var dex = R3ref.get('dex');
      var sp = (dex && dex.get) ? dex.get(id) : null;
      if (!sp || !sp.legendary) return null;
      var d = RAGES[sp.types[0]];
      return d ? d[0] : null;
    },

    /** La dimension de ce légendaire, ou null s'il se bat dans notre monde. */
    dimensionOf: function (id) { return DIMENSIONS[id] || null; },

    /** Le biome de combat à employer pour lui — sinon `null`. */
    biomeOf: function (id) { return DIMENSIONS[id] ? DIMENSIONS[id].biome : null; },

    /** Combien de fois plus grand que la normale SUR LA CARTE (1 = normal). */
    scaleOf: function (id) { return TITANS[id] || 1; },

    // EN COMBAT, ce n'est PAS un multiplicateur qui s'applique : `battle3d`
    // amène tous les titans à une hauteur commune, parce que leurs modèles vont
    // du simple au double (Eternatus 4,41 unités, Dialga 2,10). Un facteur réglé
    // pour l'un décapite l'autre. Voir `TITAN_HAUTEUR` dans battle3d.js.
    // Ici, `scaleOf` ne concerne donc que la carte du monde.
    estTitan: function (id) { return !!TITANS[id]; },
    estSeigneur: function (id) { return !!DIMENSIONS[id]; },

    /** L'id du légendaire qui déteste celui-ci, ou null. */
    rivalOf: function (id) { return RIVAL_DE[id] || null; },

    /** Le couple complet (avec son motif et son cri), ou null. */
    conflitOf: function (id) { return CONFLIT_DE[id] || null; },

    /** Tous les ids qui ont une dimension. */
    seigneurs: function () {
      var out = [];
      for (var k in DIMENSIONS) if (Object.prototype.hasOwnProperty.call(DIMENSIONS, k)) out.push(k);
      return out;
    },

    /** Le nom affiché d'un légendaire, via le Pokédex (repli : son id). */
    nomDe: function (id) {
      var dex = R3ref.get('dex');
      var sp = (dex && dex.get) ? dex.get(id) : null;
      return (sp && sp.name) || id;
    },
  };

  R3ref.register('legends', API);
  if (typeof window !== 'undefined') window.LEGENDS3D = API;
})();
