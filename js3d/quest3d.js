/* =============================================================================
 *  quest3d.js — L'HISTOIRE DES LÉGENDAIRES  (lot Q, CONTRACT3.md §5)
 * -----------------------------------------------------------------------------
 *  Demande n° 3 de Robin : « j'aimerai qu'il y ait une histoire pour trouver
 *  les Pokémon légendaires ».
 *
 *  Six quêtes, une par région, et TOUJOURS le même fil — parce qu'à 10 ans, une
 *  histoire qu'on comprend du premier coup est une histoire qu'on a envie de
 *  finir :
 *
 *      on entend la légende (un ancien du village)
 *          → on gagne le badge de l'arène
 *          → le sanctuaire s'ouvre
 *          → les six légendaires de la région se réveillent
 *          → on les capture
 *          → texte de fin
 *
 *  Ce module ne dessine RIEN et ne consomme aucun draw call : c'est du texte et
 *  de l'état. Tout ce qui s'affiche est décidé par game3d/hud3d ; ici on se
 *  contente de dire quoi raconter, et quand.
 *
 *  POURQUOI `isLegendAwake()` existe : sans lui, roamers3d fait apparaître un
 *  légendaire sur son autel dès la première minute de jeu, et la légende ne veut
 *  plus rien dire. Tant que le sanctuaire est fermé, la région dort.
 *  MAIS : si ce fichier n'est pas chargé, les appelants doivent considérer que
 *  tout est éveillé (comportement d'avant). On ne bloque JAMAIS le jeu.
 *
 *  Aucune dépendance obligatoire : le module fonctionne même si regions3d,
 *  dex3d et arenas3d sont absents (les données du contrat sont recopiées ici).
 * ========================================================================== */

(function () {
  'use strict';

  var R3 = window.R3;

  // Accès tolérant aux autres modules : ils peuvent parfaitement manquer.
  function mod(name) {
    try { return (R3 && typeof R3.get === 'function') ? R3.get(name) : null; }
    catch (e) { return null; }
  }

  // ===========================================================================
  //  LES SIX QUÊTES
  //  Ordre = ordre de progression du §3 de CONTRACT2 : val → sylve → saphir
  //  → givre → braise → aurore.
  //
  //  Le sanctuaire de chaque région est posé sur l'autel du légendaire « chef »
  //  de la région (coordonnées reprises telles quelles de regions3d.js).
  //  POURQUOI : regions3d creuse déjà autour de chaque autel un disque de rayon
  //  3 en tuiles marchables et le relie aux routes. Y poser le sanctuaire garantit
  //  qu'il est accessible à pied, sans qu'on ait à toucher au générateur — et ça
  //  raconte quelque chose de simple : le plus grand des six dort au sanctuaire,
  //  les cinq autres veillent depuis leurs autels, plus loin dans la région.
  // ===========================================================================

  var QUESTS = [

    // ---------------------------------------------------------------- VAL ---
    {
      regionId: 'val',
      ordre: 1,
      titre: 'La Légende des Feuilles',
      ville: "Bourg-Émeraude",
      regionName: "Val d'Émeraude",
      // Les articles sont stockés à la main : « les légendaires de Val d'Émeraude »
      // sonne faux, et un enfant qui lit le remarque tout de suite.
      grammaire: { de: "du Val d'Émeraude", dans: "dans le Val d'Émeraude", la: "le Val d'Émeraude" },
      champion: 'Sylvain',
      areneType: 'plante',
      badge: { id: 'feuille', name: 'Badge Feuille', icon: '🍃', color: '#38b764' },
      conteur: 'sage',                   // id du PNJ de regions3d qui raconte
      condition: 'badge',

      legende: [
        "Les anciens de Bourg-Émeraude racontent tous la même histoire, mot pour mot. Avant le village, avant les chemins, il y avait un cerf grand comme un arbre.",
        "Partout où il posait un pied, une forêt poussait. Puis un matin il s'est couché dans une clairière, et il s'est endormi.",
        "On dit qu'il dort encore. Et que cinq autres gardiens veillent sur son sommeil, cachés aux quatre coins du Val."
      ],

      indices: [
        "Le sommeil du grand cerf est gardé par le Badge Feuille. Bats Sylvain à l'arène de Bourg-Émeraude, et la clairière te reconnaîtra.",
        "La clairière s'est ouverte ! Le Sanctuaire du Bois Dormant t'attend droit au sud du village. Emporte des Balls, tu vas en avoir besoin.",
        "Cinq autres gardiens se sont réveillés avec lui : une fée-fleur, un colosse de racines, un griffon des cimes, un papillon d'arc-en-ciel et un chat de brume. Cherche leurs autels."
      ],

      sanctuaire: { x: 36, y: 100, name: 'Sanctuaire du Bois Dormant', lieu: 'Clairière des Bois Anciens' },
      legendaires: ['sylvaros', 'florabelle', 'racinor', 'bourrasca', 'prismee', 'penombra'],

      final: "Le grand cerf a relevé la tête et, pour la première fois depuis mille ans, il a regardé quelqu'un dans les yeux. Tout le Val d'Émeraude bruisse de joie : ses six gardiens sont réveillés, et c'est toi qui l'as fait.",

      // La Ball Maîtresse ne se vend pas (§6) : elle se gagne ici, à la toute
      // première quête accomplie, pour aider Robin sur les cinq régions suivantes.
      reward: {
        money: 2000,
        items: [{ id: 'ballmaitresse', qty: 1 }],
        text: "Les anciens t'offrent une Ball Maîtresse — celle qui ne rate jamais. « Garde-la pour une légende qui te tient vraiment à cœur. »"
      }
    },

    // -------------------------------------------------------------- SYLVE ---
    {
      regionId: 'sylve',
      ordre: 2,
      titre: 'La Légende du Tonnerre',
      ville: 'Ambrelune',
      regionName: "Sylve d'Ambre",
      grammaire: { de: "de la Sylve d'Ambre", dans: "dans la Sylve d'Ambre", la: "la Sylve d'Ambre" },
      champion: 'Orana',
      areneType: 'foudre',
      badge: { id: 'eclair', name: 'Badge Éclair', icon: '⚡', color: '#f1c40f' },
      conteur: 'chamane',
      condition: 'badge',

      legende: [
        "À Ambrelune, personne ne dort quand l'orage passe. Les anciens disent que ce n'est pas la pluie qui gronde : c'est un oiseau.",
        "Ses deux ailes sont des éclairs arrêtés en plein vol. Il s'est posé un jour sur un temple, et la jungle a tout recouvert.",
        "Depuis, le temple attend. Entre deux coups de tonnerre, très loin au nord, on l'entend respirer."
      ],

      indices: [
        "Le temple ne s'ouvre qu'à celui qui n'a pas peur de la foudre. Va décrocher le Badge Éclair chez Orana, à l'arène d'Ambrelune.",
        "Les lianes se sont écartées ! Le Sanctuaire du Temple Foudroyé t'attend tout au nord de la jungle. Suis les éclairs, ils ne se trompent jamais.",
        "Le tonnerre a réveillé toute la Sylve : un félin électrique, une tortue-montagne, un golem de glaise, un loup d'ombre et un serpent de sable ont quitté leurs autels."
      ],

      sanctuaire: { x: 176, y: 24, name: 'Sanctuaire du Temple Foudroyé', lieu: 'Temple du Tonnerre' },
      legendaires: ['fulguron', 'voltaris', 'geomastre', 'limonis', 'nyxaroth', 'sablion'],

      final: "L'oiseau-tonnerre a ouvert les ailes, et pendant une seconde il a fait jour en pleine nuit. Ambrelune n'oubliera jamais ce matin-là — ni le dresseur qui était là.",

      reward: {
        money: 3000,
        items: [{ id: 'hyperball', qty: 5 }, { id: 'hyperpotion', qty: 2 }],
        text: "La chamane te confie cinq Hyper Balls et deux Hyper Potions. « La jungle te doit bien ça. »"
      }
    },

    // ------------------------------------------------------------- SAPHIR ---
    {
      regionId: 'saphir',
      ordre: 3,
      titre: 'La Légende des Grandes Marées',
      ville: 'Port-Saphir',
      regionName: 'Côte de Saphir',
      grammaire: { de: 'de la Côte de Saphir', dans: 'sur la Côte de Saphir', la: 'la Côte de Saphir' },
      champion: 'Marine',
      areneType: 'eau',
      badge: { id: 'vague', name: 'Badge Vague', icon: '🌊', color: '#41a6f6' },
      conteur: 'phare',
      condition: 'badge',

      legende: [
        "Les marins de Port-Saphir ne disent jamais « la mer est calme ». Ils disent « il dort ».",
        "Sous la côte vit un léviathan si long que personne ne l'a jamais vu en entier. Quand il soupire, les vagues se lèvent.",
        "Tout à l'est, une île se découvre à marée basse. C'est là qu'il remonte respirer — une fois par siècle, pas plus."
      ],

      indices: [
        "La mer ne laisse passer que ceux qui ne se laissent pas emporter. Gagne le Badge Vague contre Marine, à l'arène du port.",
        "La marée s'est retirée ! Le Sanctuaire des Grandes Marées est apparu tout à l'est de la côte. Marche vite : la mer revient toujours.",
        "Cinq autres se sont montrés avec lui : un esprit d'écume, une raie des marées, un nuage d'orage, un ruban de vent et une méduse d'étoiles. Longe le rivage, ils y sont."
      ],

      sanctuaire: { x: 306, y: 190, name: 'Sanctuaire des Grandes Marées', lieu: 'Île du Léviathan' },
      legendaires: ['abyssalor', 'ondinae', 'marea', 'orageon', 'zephyrion', 'nebulon'],

      final: "Le léviathan est remonté, et l'océan tout entier s'est écarté pour lui faire de la place. À Port-Saphir, on racontera ton nom pendant cent ans.",

      reward: {
        money: 4000,
        items: [{ id: 'hyperball', qty: 5 }, { id: 'hyperpotion', qty: 3 }],
        text: "Le gardien du phare te remplit le sac d'Hyper Balls et de potions. « La mer récompense les patients. »"
      }
    },

    // -------------------------------------------------------------- GIVRE ---
    {
      regionId: 'givre',
      ordre: 4,
      titre: 'La Légende du Trône de Glace',
      ville: 'Cimefroide',
      regionName: 'Massif de Givre',
      grammaire: { de: 'du Massif de Givre', dans: 'dans le Massif de Givre', la: 'le Massif de Givre' },
      champion: 'Borée',
      areneType: 'glace',
      badge: { id: 'flocon', name: 'Badge Flocon', icon: '❄️', color: '#a8e6ff' },
      conteur: 'maire',
      condition: 'badge',

      legende: [
        "À Cimefroide, on apprend aux enfants à ne pas crier dans la montagne. Ce n'est pas à cause des avalanches.",
        "Tout à l'ouest se dresse un trône taillé dans un seul bloc de glace. Un dragon y est assis, et il n'a pas bougé depuis mille hivers.",
        "Son souffle a creusé toutes les grottes du Massif. Ses ailes de cristal chantent quand le vent les traverse."
      ],

      indices: [
        "On n'approche pas d'un dragon de glace en tremblant. Va chercher le Badge Flocon chez Borée, à l'arène de Cimefroide.",
        "Le blizzard s'est ouvert en deux ! Le Sanctuaire du Trône de Glace t'attend à l'ouest du Massif. Couvre-toi bien.",
        "Le Massif entier s'est réveillé : une biche de givre, un ours de banquise, une raie céleste, un cerf de cristal et un corbeau d'éclipse. Chaque autel brille sous la neige."
      ],

      sanctuaire: { x: 58, y: 40, name: 'Sanctuaire du Trône de Glace', lieu: 'Trône de Glace' },
      legendaires: ['cryonix', 'givrea', 'banquisor', 'aelune', 'cristallia', 'eclipsion'],

      final: "Le dragon a ouvert un œil, puis les deux. Puis il a incliné la tête. Un dragon de glace ne salue personne — sauf une fois, et c'était toi.",

      reward: {
        money: 5000,
        items: [{ id: 'hyperball', qty: 6 }, { id: 'hyperpotion', qty: 3 }],
        text: "Le maire fait sonner la cloche de Cimefroide en ton honneur, et t'offre de quoi repartir à l'aventure."
      }
    },

    // ------------------------------------------------------------- BRAISE ---
    {
      regionId: 'braise',
      ordre: 5,
      titre: 'La Légende du Cœur de Braise',
      ville: 'Fournaise',
      regionName: 'Caldeira de Braise',
      grammaire: { de: 'de la Caldeira de Braise', dans: 'dans la Caldeira de Braise', la: 'la Caldeira de Braise' },
      champion: 'Ignis',
      areneType: 'feu',
      badge: { id: 'flamme', name: 'Badge Flamme', icon: '🔥', color: '#ff6b3d' },
      conteur: 'forgeronne',
      condition: 'badge',

      legende: [
        "À Fournaise, on ne dit pas que le volcan est en colère. On dit qu'il rêve.",
        "Tout au fond de la caldeira dort un dragon de magma. Chaque éruption n'est qu'un de ses bâillements.",
        "Ses ailes de braise éclairent la nuit comme un second soleil. Personne n'est jamais descendu si bas et remonté pour le raconter."
      ],

      indices: [
        "Le volcan ne laisse passer que ceux qui ne reculent pas devant le feu. Gagne le Badge Flamme contre Ignis, à l'arène de Fournaise.",
        "Les coulées de lave se sont écartées ! Le Sanctuaire du Cœur de Braise s'est ouvert au nord-est, tout au fond de la caldeira.",
        "Toute la Caldeira s'est levée : un phénix, un lion à crinière de lave, une taupe-titan, une panthère d'obsidienne et un phénix de lumière pure. Six autels, six flammes."
      ],

      sanctuaire: { x: 218, y: 84, name: 'Sanctuaire du Cœur de Braise', lieu: 'Cœur de la Caldeira' },
      legendaires: ['pyrathos', 'emberyx', 'fournalis', 'terracor', 'obsidion', 'solaria'],

      final: "Le dragon de magma s'est déplié, et la caldeira s'est éclairée comme en plein jour. À Fournaise, on a cru à une éruption. Ce n'était qu'un bonjour.",

      reward: {
        money: 6000,
        items: [{ id: 'hyperball', qty: 6 }, { id: 'hyperpotion', qty: 4 }],
        text: "La forgeronne martèle une plaque de basalte à ton nom et l'accroche au mur de l'atelier. Puis elle remplit ton sac, sans un mot."
      }
    },

    // ------------------------------------------------------------- AURORE ---
    {
      regionId: 'aurore',
      ordre: 6,
      titre: "La Légende de l'Aube Première",
      ville: 'Aurore-Cité',
      regionName: "Plateau d'Aurore",
      grammaire: { de: "du Plateau d'Aurore", dans: "sur le Plateau d'Aurore", la: "le Plateau d'Aurore" },
      champion: 'Astréa',
      areneType: 'lumiere',
      badge: { id: 'etoile', name: 'Badge Étoile', icon: '✨', color: '#ffe066' },
      conteur: 'astronome',
      condition: 'badge',

      legende: [
        "Aurore-Cité est bâtie tout en haut, là où le ciel commence. Les astronomes y guettent la même chose depuis toujours.",
        "Chaque matin, une auréole se lève quelques minutes avant le soleil, pour lui montrer le chemin. Ce n'est pas une étoile : c'est un griffon.",
        "On l'appelle le gardien du Plateau. Il attend, dit-on, celui qui aura traversé les six régions."
      ],

      indices: [
        "Le gardien ne se montre qu'au dresseur des six badges. Le dernier s'appelle Badge Étoile : va le gagner contre Astréa, à l'arène d'Aurore-Cité.",
        "Le ciel s'est ouvert au nord-est ! Le Sanctuaire de l'Aube Première t'attend sur la terrasse la plus haute du monde.",
        "Les gardiens du ciel se sont éveillés : un colosse de menhirs, une tortue-horloge, un sphinx du temps, une raie-galaxie et une baleine d'étoiles. Le Plateau entier scintille."
      ],

      sanctuaire: { x: 306, y: 40, name: "Sanctuaire de l'Aube Première", lieu: 'Terrasse du Soleil' },
      legendaires: ['monolithe', 'aureol', 'chronoss', 'eternia', 'vortexis', 'astralis'],

      final: "Le griffon solaire s'est envolé, et l'aube s'est levée en avance rien que pour toi. Six régions, six sanctuaires : le monde entier connaît ton nom, dresseur.",

      reward: {
        money: 8000,
        items: [{ id: 'ballmaitresse', qty: 1 }, { id: 'hyperpotion', qty: 5 }],
        text: "L'astronome grave ton nom sur la grande carte du ciel, entre deux constellations. « Voilà. Maintenant, tu es une légende toi aussi. »"
      }
    }
  ];

  // Texte du tout dernier écran : les six quêtes accomplies.
  var GRAND_FINAL =
    "Les trente-six légendaires du monde marchent désormais à tes côtés. " +
    "Il ne reste plus une seule légende que tu n'aies pas vécue — alors les anciens " +
    "en inventeront de nouvelles, et elles parleront de toi.";

  // ===========================================================================
  //  INDEX
  // ===========================================================================

  var BY_REGION = {};                 // regionId -> quest
  var REGION_OF_LEGEND = {};          // speciesId -> regionId
  var ORDER = [];                     // ['val', 'sylve', …]
  var i, j;

  for (i = 0; i < QUESTS.length; i++) {
    var q = QUESTS[i];
    BY_REGION[q.regionId] = q;
    ORDER.push(q.regionId);
    for (j = 0; j < q.legendaires.length; j++) REGION_OF_LEGEND[q.legendaires[j]] = q.regionId;
  }

  // ===========================================================================
  //  ÉTAT  —  c'est exactement ce que serialize() rend
  //  { regionId: { heard, open, caught: [ids], done } }
  // ===========================================================================

  var ST = {};

  function blank() {
    var s = {};
    for (var k = 0; k < ORDER.length; k++) {
      s[ORDER[k]] = { heard: false, open: false, caught: [], done: false };
    }
    return s;
  }

  ST = blank();

  function stOf(regionId) {
    // Repli silencieux : une région inconnue ne doit jamais faire planter le HUD.
    return ST[regionId] || { heard: false, open: false, caught: [], done: false };
  }

  // ===========================================================================
  //  PETITS OUTILS
  // ===========================================================================

  // Remplace les jetons {ville}, {badge}, {sanctuaire}… dans un texte.
  // POURQUOI : les répliques génériques des PNJ (guides, enfants, marchands)
  // sont écrites une seule fois et se colorent toutes seules selon la région.
  function fill(text, q) {
    if (!q || typeof text !== 'string') return text || '';
    var g = q.grammaire || { de: 'de ' + q.regionName, dans: 'dans ' + q.regionName, la: q.regionName };
    return text
      .replace(/\{ville\}/g, q.ville)
      .replace(/\{region\}/g, q.regionName)
      .replace(/\{de\}/g, g.de)
      .replace(/\{dans\}/g, g.dans)
      .replace(/\{la\}/g, g.la)
      .replace(/\{badge\}/g, q.badge.name)
      .replace(/\{icone\}/g, q.badge.icon)
      .replace(/\{champion\}/g, q.champion)
      .replace(/\{sanctuaire\}/g, q.sanctuaire.name)
      .replace(/\{lieu\}/g, q.sanctuaire.lieu)
      .replace(/\{chef\}/g, nameOf(q.legendaires[0]))
      .replace(/\{titre\}/g, q.titre);
  }

  // Nom affichable d'une espèce : on demande au dex s'il est là, sinon on
  // rend l'id avec une majuscule — jamais « undefined » sous les yeux de Robin.
  function nameOf(speciesId) {
    if (!speciesId) return 'la créature';
    var dex = mod('dex');
    if (dex && typeof dex.get === 'function') {
      try {
        var sp = dex.get(speciesId);
        if (sp && sp.name) return sp.name;
      } catch (e) { /* le dex n'est pas prêt : on continue */ }
    }
    return speciesId.charAt(0).toUpperCase() + speciesId.slice(1);
  }

  function pick(list, seedText) {
    // Choix stable : le même PNJ dit toujours la même phrase, ça évite
    // l'impression de « machine à texte » quand on lui reparle.
    if (!list || !list.length) return '';
    var h = 0, s = String(seedText || '');
    for (var k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) & 0x7fffffff;
    return list[h % list.length];
  }

  // ===========================================================================
  //  ÉTAT D'UNE QUÊTE
  // ===========================================================================

  function state(regionId) {
    var s = stOf(regionId);
    if (s.done) return 'accomplie';
    if (s.open) return 'ouverte';
    if (s.heard) return 'entendue';
    return 'inconnue';
  }

  function progress(regionId) {
    var q = BY_REGION[regionId];
    var s = stOf(regionId);
    return { caught: s.caught.length, total: q ? q.legendaires.length : 0 };
  }

  // Marque la légende comme entendue. Appelé quand on parle au conteur de la
  // ville, mais exposé aussi pour que game3d puisse le faire depuis un panneau.
  function hear(regionId) {
    var s = ST[regionId];
    if (!s || s.heard) return false;
    s.heard = true;
    return true;
  }

  // ===========================================================================
  //  LE BADGE OUVRE LE SANCTUAIRE
  // ===========================================================================

  function onBadge(regionId) {
    var q = BY_REGION[regionId];
    var s = ST[regionId];
    if (!q || !s) return { opened: false, text: '' };
    if (s.open) return { opened: false, regionId: regionId, text: '' };

    // Generosité volontaire : même si Robin n'a jamais parlé au conteur, le
    // badge ouvre le sanctuaire. On ne bloque jamais un enfant sur un PNJ raté.
    s.heard = true;
    s.open = true;

    return {
      opened: true,
      regionId: regionId,
      titre: q.titre,
      sanctuaire: q.sanctuaire.name,
      text: "Le " + q.badge.name + " s'est mis à briller… " + q.sanctuaire.name +
            " vient de s'ouvrir ! Les légendaires " + q.grammaire.de + " se réveillent.",
      hint: q.indices[1]
    };
  }

  // Ouverture directe, sans passer par un badge (triche de test, ou scénario
  // futur). Même effet, message identique.
  function open(regionId) { return onBadge(regionId); }

  // ===========================================================================
  //  CAPTURE D'UN LÉGENDAIRE
  // ===========================================================================

  function onLegendCaught(speciesId) {
    var regionId = REGION_OF_LEGEND[speciesId];
    if (!regionId) return null;                 // pas un légendaire d'une quête

    var q = BY_REGION[regionId];
    var s = ST[regionId];
    if (!q || !s) return null;

    if (s.caught.indexOf(speciesId) < 0) s.caught.push(speciesId);

    // Capturer un légendaire suffit à considérer la légende comme entendue et
    // le sanctuaire comme ouvert : l'état ne doit jamais être incohérent.
    s.heard = true;
    s.open = true;

    var total = q.legendaires.length;
    var got = s.caught.length;
    var reste = total - got;
    var justDone = false;

    if (reste <= 0 && !s.done) { s.done = true; justDone = true; }

    var text;
    if (justDone) {
      text = q.final;
    } else if (reste === 1) {
      text = nameOf(speciesId) + " te rejoint ! Il ne reste plus qu'un seul gardien à réveiller " + q.grammaire.dans + ".";
    } else {
      text = nameOf(speciesId) + " te rejoint ! Encore " + reste + " gardiens à trouver " + q.grammaire.dans + ".";
    }

    return {
      questDone: justDone,
      regionId: regionId,
      titre: q.titre,
      text: text,
      caught: got,
      total: total,
      reward: justDone ? q.reward : null,
      allDone: justDone && allDone() ? GRAND_FINAL : null
    };
  }

  function allDone() {
    for (var k = 0; k < ORDER.length; k++) if (!stOf(ORDER[k]).done) return false;
    return true;
  }

  // ===========================================================================
  //  LES LÉGENDAIRES DORMENT TANT QUE LE SANCTUAIRE EST FERMÉ
  // ===========================================================================

  function isLegendAwake(speciesId) {
    var regionId = REGION_OF_LEGEND[speciesId];
    // Une espèce qui n'est pas dans une quête (créature commune, forme évoluée,
    // légendaire ajouté plus tard) n'a aucune raison d'être bridée par nous.
    if (!regionId) return true;
    return !!stOf(regionId).open;
  }

  // Liste pratique pour roamers3d : les légendaires éveillés d'une région.
  function awakeLegends(regionId) {
    var q = BY_REGION[regionId];
    if (!q) return [];
    if (!stOf(regionId).open) return [];
    return q.legendaires.slice();
  }

  // ===========================================================================
  //  LE SANCTUAIRE
  // ===========================================================================

  function sanctuary(regionId) {
    var q = BY_REGION[regionId];
    if (!q) return null;
    var s = stOf(regionId);
    return {
      x: q.sanctuaire.x,
      y: q.sanctuaire.y,
      name: q.sanctuaire.name,
      lieu: q.sanctuaire.lieu,
      open: !!s.open,
      regionId: regionId,
      legendaires: q.legendaires.slice(),
      // De quoi poser un repère sur la carte sans rien recalculer.
      icon: '⛩️',
      color: q.badge.color
    };
  }

  function sanctuaries() {
    var out = [];
    for (var k = 0; k < ORDER.length; k++) out.push(sanctuary(ORDER[k]));
    return out;
  }

  // ===========================================================================
  //  L'INDICE COURANT  (c'est LA ligne que Robin lit dans son journal)
  // ===========================================================================

  function hint(regionId) {
    var q = BY_REGION[regionId];
    if (!q) return '';
    var s = stOf(regionId);

    if (s.done) return "Quête accomplie ! Les six gardiens " + q.grammaire.de + " sont à tes côtés.";
    if (s.open) {
      // Une fois qu'on en a attrapé un, on parle des cinq autres.
      return s.caught.length > 0 ? q.indices[2] : q.indices[1];
    }
    if (s.heard) return q.indices[0];
    return "Quelqu'un, à " + q.ville + ", connaît une vieille histoire. Va lui parler.";
  }

  // ===========================================================================
  //  LE JOURNAL  (touche J, côté hud3d)
  // ===========================================================================

  function journal() {
    var out = [];
    for (var k = 0; k < ORDER.length; k++) {
      var rid = ORDER[k];
      var q = BY_REGION[rid];
      var s = stOf(rid);
      var p = progress(rid);
      out.push({
        region: rid,
        regionName: q.regionName,
        titre: q.titre,
        ligne: hint(rid),
        fait: !!s.done,
        etat: state(rid),
        icone: q.badge.icon,
        couleur: q.badge.color,
        sanctuaire: q.sanctuaire.name,
        captures: p.caught,
        total: p.total,
        ordre: q.ordre
      });
    }
    return out;
  }

  // ===========================================================================
  //  CE QUE RACONTENT LES PNJ
  //  dialogFor(npcRole, regionId) -> [string]
  //
  //  npcRole accepte AUSSI l'id brut des PNJ de regions3d ('sage', 'chamane',
  //  'plongeuse'…) : le lot Intégration peut donc passer `npc.id` directement,
  //  sans table de correspondance de son côté.
  // ===========================================================================

  // id de PNJ (regions3d) -> rôle narratif
  var ROLE_OF_NPC = {
    // val
    sage: 'ancien', jardiniere: 'savant', garde: 'guide', pecheur: 'guide',
    enfant: 'enfant', marchande: 'marchand',
    // sylve
    chamane: 'ancien', herboriste: 'savant', exploratrice: 'savant',
    guide: 'guide', batelier: 'guide', ecolier: 'enfant',
    // saphir
    phare: 'ancien', plongeuse: 'savant', marin: 'guide', capitaine: 'guide',
    enfant_plage: 'enfant', commercante: 'marchand',
    // givre
    maire: 'ancien', ermite: 'savant', guide_montagne: 'guide', skieur: 'guide',
    enfant_neige: 'enfant', forgeron: 'marchand',
    // braise
    forgeronne: 'ancien', geologue: 'savant', guide_volcan: 'guide', nomade: 'guide',
    enfant_desert: 'enfant', marchand_epices: 'marchand',
    // aurore
    astronome: 'ancien', archeologue: 'savant', moine: 'savant',
    guide_ciel: 'guide', gardienne_faille: 'guide', enfant_etoiles: 'enfant'
  };

  // Synonymes acceptés, pour que l'appelant n'ait pas à deviner le mot exact.
  var ROLE_ALIAS = {
    conteur: 'ancien', vieux: 'ancien', ancienne: 'ancien', sage: 'ancien',
    savante: 'savant', chercheur: 'savant', chercheuse: 'savant',
    gardien: 'guide', gardienne: 'guide', ranger: 'guide',
    enfant_: 'enfant', gamin: 'enfant', petite: 'enfant', petit: 'enfant',
    marchande: 'marchand', vendeur: 'marchand', vendeuse: 'marchand',
    dresseuse: 'dresseur', trainer: 'dresseur',
    championne: 'champion',
    infirmier: 'infirmiere', soigneur: 'infirmiere'
  };

  function roleOf(npcRole) {
    var r = String(npcRole || '').toLowerCase();
    if (ROLE_OF_NPC[r]) return ROLE_OF_NPC[r];
    if (ROLE_ALIAS[r]) return ROLE_ALIAS[r];
    if (r === 'ancien' || r === 'savant' || r === 'guide' || r === 'enfant' ||
        r === 'marchand' || r === 'dresseur' || r === 'champion' || r === 'infirmiere') return r;
    // Les dresseurs de regions3d s'appellent tous « t_quelquechose ».
    if (r.indexOf('t_') === 0) return 'dresseur';
    if (r.indexOf('enfant') === 0 || r.indexOf('petit') === 0) return 'enfant';
    return 'villageois';
  }

  // Répliques génériques, par rôle puis par état de la quête.
  // Deux ou trois phrases maximum : c'est un enfant de 10 ans qui lit.
  var LINES = {
    savant: {
      inconnue: [
        ["Tu as vu le vieux panneau, près de {lieu} ? Personne ne sait plus qui l'a planté là.",
         "Va donc écouter les anciens de {ville}. Eux, ils savent."],
        ["Il y a quelque chose d'endormi dans cette région, j'en suis sûre.",
         "Demande à {ville} : les vieilles histoires y sont mieux gardées que dans mes livres."]
      ],
      entendue: [
        ["Alors on t'a raconté ? Bien. Maintenant, prouve que tu mérites d'entrer.",
         "Le {badge} de l'arène de {ville}, voilà ta clé."],
        ["J'ai relevé les mesures : le {lieu} bouge, très lentement. Il attend.",
         "Il attend quelqu'un qui porte le {badge}, si tu veux mon avis."]
      ],
      ouverte: [
        ["C'est arrivé ! {sanctuaire} s'est ouvert cette nuit, j'ai tout noté.",
         "Va-y, mais prends des Balls. Beaucoup de Balls."],
        ["Six auras réveillées d'un coup, dans toute la région. Du jamais vu.",
         "{chef} est au sanctuaire. Les cinq autres t'attendent à leurs autels."]
      ],
      accomplie: [
        ["Six légendaires. Six. Je vais devoir réécrire tout mon livre.",
         "Merci, dresseur. Vraiment."]
      ]
    },
    guide: {
      inconnue: [
        ["Fais attention en t'éloignant des chemins, il y a des coins étranges par ici.",
         "Si tu veux comprendre pourquoi, va parler aux anciens de {ville}."],
        ["Cette région garde un secret, et moi je ne fais qu'indiquer la route.",
         "Le secret, c'est à {ville} qu'on le raconte."]
      ],
      entendue: [
        ["Le chemin du {lieu} ? Il est là, mais il ne s'ouvrira pas pour toi.",
         "Reviens avec le {badge}, et on en reparle."],
        ["Tu cherches {sanctuaire} ? Tout le monde le cherche.",
         "Bats {champion} d'abord. Après, la région te laissera passer."]
      ],
      ouverte: [
        ["Le passage est ouvert, je n'ai jamais vu ça de ma vie.",
         "{sanctuaire} est droit devant. Bonne chance, petit."],
        ["Regarde le ciel au-dessus du {lieu} : il a changé de couleur.",
         "C'est par là. Ne traîne pas."]
      ],
      accomplie: [
        ["Tu es allé jusqu'au bout. Toute la région le sait, maintenant.",
         "Repose-toi un peu, tu l'as bien mérité."]
      ]
    },
    enfant: {
      inconnue: [
        ["Dis, tu crois aux légendes, toi ?",
         "Moi oui ! Mais on me dit toujours que je raconte n'importe quoi."],
        ["Mon grand-père connaît une histoire qui fait un peu peur.",
         "Il ne la raconte qu'aux dresseurs. Toi, tu en es un ?"]
      ],
      entendue: [
        ["J'ai entendu l'histoire moi aussi ! Tu vas y aller, hein ? Hein ?",
         "Il te faut le {badge} d'abord. Moi je n'en ai aucun…"],
        ["Quand tu auras le {badge}, tu m'emmèneras au {lieu} ?",
         "Bon… d'accord, je resterai ici. Mais tu me raconteras tout !"]
      ],
      ouverte: [
        ["MAMAN ! Le sanctuaire s'est ouvert ! Je l'avais dit !",
         "Vas-y vite, je veux savoir à quoi il ressemble !"],
        ["J'ai vu une lumière au-dessus du {lieu} ! Une vraie !",
         "Tu me montreras {chef} après, promis ?"]
      ],
      accomplie: [
        ["Tu les as TOUS trouvés ?! Tous les six ?!",
         "Quand je serai grand, je serai comme toi."]
      ]
    },
    marchand: {
      inconnue: [
        ["Des Balls ? J'en ai. Des potions ? J'en ai aussi.",
         "Et des histoires, à {ville}, on en a plus que de marchandises."]
      ],
      entendue: [
        ["Tu pars chercher la légende ? Alors achète des Balls. Beaucoup.",
         "Un légendaire, ça ne se rattrape pas si ça s'enfuit."],
        ["Le {badge} d'abord, les Balls ensuite. Dans cet ordre.",
         "Enfin… tu peux aussi acheter les Balls maintenant, je ne suis pas contre."]
      ],
      ouverte: [
        ["{sanctuaire} est ouvert et tout le monde veut des Hyper Balls d'un coup !",
         "J'en garde quelques-unes pour toi. Reviens vite."],
        ["Six légendaires réveillés, six clients paniqués. Une belle journée !",
         "Tiens, prends des potions aussi. Ils tapent fort, paraît-il."]
      ],
      accomplie: [
        ["Le dresseur des six gardiens, dans ma boutique ! Je peux avoir un autographe ?",
         "Sur cette Ball, là. Merci !"]
      ]
    },
    dresseur: {
      inconnue: [
        ["On dit qu'il y a quelque chose d'énorme caché dans cette région.",
         "Moi je m'entraîne, au cas où."]
      ],
      entendue: [
        ["Alors comme ça tu vises la légende ? Entraîne-toi d'abord sur moi.",
         "{champion} ne te fera aucun cadeau, tu sais."]
      ],
      ouverte: [
        ["J'y suis allé. J'ai vu {chef}. J'ai fait demi-tour en courant.",
         "Toi, tu es plus courageux que moi. Vas-y."]
      ],
      accomplie: [
        ["Tu as réveillé les six gardiens… et tu veux encore te battre ?",
         "D'accord. Mais sois gentil."]
      ]
    },
    champion: {
      inconnue: [
        ["Beaucoup de dresseurs passent ici sans savoir ce qui dort dehors.",
         "Écoute les anciens de {ville} avant de me défier."]
      ],
      entendue: [
        ["Tu veux le {badge} ? Bien. Sache qu'il n'ouvre pas qu'une porte d'arène.",
         "Il ouvre {sanctuaire}. Alors je ne te le donnerai pas facilement."]
      ],
      ouverte: [
        ["Tu portes mon badge, et le sanctuaire s'est ouvert. Va voir {chef}.",
         "Et reviens me raconter — j'ai attendu ça toute ma vie."]
      ],
      accomplie: [
        ["Les six gardiens {de} t'ont choisi. Je m'incline.",
         "Un jour, on racontera ton histoire comme on racontait la leur."]
      ]
    },
    infirmiere: {
      inconnue: [
        ["Tes créatures sont comme neuves ! Bonne route.",
         "Et méfie-toi des vieilles histoires de {ville}… elles sont souvent vraies."]
      ],
      entendue: [
        ["Repose-les bien avant d'aller à l'arène.",
         "Le {badge}, c'est le début de quelque chose de bien plus grand."]
      ],
      ouverte: [
        ["Tu vas au sanctuaire ? Je te les soigne à fond, alors.",
         "Un légendaire affaibli se capture mieux — mais le tien doit tenir debout !"]
      ],
      accomplie: [
        ["Six légendaires à soigner… c'est un honneur, tu sais.",
         "Reviens quand tu veux, dresseur."]
      ]
    },
    villageois: {
      inconnue: [
        ["Bonjour ! Belle journée {dans}, non ?",
         "On raconte des choses, ici. Va voir les anciens de {ville}."]
      ],
      entendue: [
        ["Tout le monde parle de cette légende depuis que tu es arrivé.",
         "Gagne le {badge}, et on verra bien si c'est vrai."]
      ],
      ouverte: [
        ["{sanctuaire} s'est ouvert ! Mon grand-père disait que ça arriverait.",
         "Il avait raison. Il avait toujours raison."]
      ],
      accomplie: [
        ["C'est toi ! Le dresseur des six gardiens !",
         "Merci d'avoir réveillé {la}."]
      ]
    }
  };

  function dialogFor(npcRole, regionId) {
    var q = BY_REGION[regionId];
    if (!q) return [];
    var role = roleOf(npcRole);
    var st = state(regionId);

    // L'ANCIEN est celui qui raconte la légende : lui parler, c'est l'entendre.
    // POURQUOI ici plutôt que dans game3d : le contrat ne prévoit pas d'appel
    // « hear() » côté intégration, et il ne faut surtout pas que Robin puisse
    // écouter l'histoire sans que le journal se mette à jour.
    if (role === 'ancien') {
      var lines;
      if (st === 'inconnue') {
        lines = q.legende.slice();
        lines.push(q.indices[0]);
        hear(regionId);                      // c'est fait : la légende est connue
      } else if (st === 'entendue') {
        lines = [
          "Tu te souviens de l'histoire ? Alors va la vérifier toi-même.",
          q.indices[0]
        ];
      } else if (st === 'ouverte') {
        lines = [
          "Je n'aurais jamais cru voir ça de mon vivant. " + q.sanctuaire.name + " est ouvert.",
          stOf(regionId).caught.length > 0 ? q.indices[2] : q.indices[1]
        ];
      } else {
        lines = [q.final, "Merci, dresseur. La légende continue, et c'est toi qui l'écris."];
      }
      return lines.map(function (t) { return fill(t, q); });
    }

    var table = LINES[role] || LINES.villageois;
    var bucket = table[st] || table.inconnue || [];
    var chosen = pick(bucket, String(npcRole) + regionId + st) || [];
    return chosen.map(function (t) { return fill(t, q); });
  }

  // ===========================================================================
  //  SAUVEGARDE
  // ===========================================================================

  function serialize() {
    var out = {};
    for (var k = 0; k < ORDER.length; k++) {
      var rid = ORDER[k], s = stOf(rid);
      out[rid] = {
        heard: !!s.heard,
        open: !!s.open,
        caught: s.caught.slice(),
        done: !!s.done
      };
    }
    return out;
  }

  function deserialize(o) {
    ST = blank();
    if (!o || typeof o !== 'object') return;
    for (var k = 0; k < ORDER.length; k++) {
      var rid = ORDER[k];
      var src = o[rid];
      if (!src || typeof src !== 'object') continue;
      var dst = ST[rid];
      dst.heard = !!src.heard;
      dst.open = !!src.open;
      dst.done = !!src.done;
      if (Object.prototype.toString.call(src.caught) === '[object Array]') {
        // On refiltre : une sauvegarde bricolée ne doit pas fausser le compteur.
        var seen = {};
        for (var m = 0; m < src.caught.length; m++) {
          var id = src.caught[m];
          if (REGION_OF_LEGEND[id] === rid && !seen[id]) { seen[id] = 1; dst.caught.push(id); }
        }
      }
      // Cohérence : 6 captures => quête accomplie, quoi qu'ait dit la sauvegarde.
      var q = BY_REGION[rid];
      if (q && dst.caught.length >= q.legendaires.length) dst.done = true;
      if (dst.done || dst.caught.length > 0) { dst.open = true; dst.heard = true; }
      if (dst.open) dst.heard = true;
    }
  }

  function reset() { ST = blank(); }

  // ===========================================================================
  //  API
  // ===========================================================================

  var API = {
    // --- contrat v3 §5 ------------------------------------------------------
    QUESTS: QUESTS,
    get: function (regionId) { return BY_REGION[regionId] || null; },
    state: state,
    hint: hint,
    onBadge: onBadge,
    onLegendCaught: onLegendCaught,
    sanctuary: sanctuary,
    isLegendAwake: isLegendAwake,
    dialogFor: dialogFor,
    journal: journal,
    serialize: serialize,
    deserialize: deserialize,

    // --- compléments utiles au lot Intégration ------------------------------
    ORDER: ORDER,                       // ['val','sylve','saphir','givre','braise','aurore']
    list: function () { return QUESTS.slice(); },
    sanctuaries: sanctuaries,           // les 6 repères, pour la carte
    awakeLegends: awakeLegends,         // [speciesId] éveillés d'une région
    regionOfLegend: function (id) { return REGION_OF_LEGEND[id] || null; },
    isQuestLegend: function (id) { return !!REGION_OF_LEGEND[id]; },
    progress: progress,                 // { caught, total }
    allDone: allDone,
    grandFinal: function () { return GRAND_FINAL; },
    hear: hear,                         // marquer la légende comme entendue
    open: open,                         // ouvrir un sanctuaire sans badge
    tellerOf: function (regionId) {     // quel PNJ raconte la légende
      var q = BY_REGION[regionId];
      return q ? q.conteur : null;
    },
    roleOf: roleOf,                     // 'sage' -> 'ancien'
    reset: reset
  };

  // Enregistrement — jamais d'exception, même si R3 n'est pas là.
  try {
    if (R3 && typeof R3.register === 'function') R3.register('quest', API);
    else window.Quest3D = API;
  } catch (e) {
    try { console.warn('[quest3d] enregistrement impossible :', e); } catch (e2) { /* rien */ }
    window.Quest3D = API;
  }

  // Toujours accessible pour déboguer depuis la console, même enregistré.
  window.Quest3D = window.Quest3D || API;

})();
