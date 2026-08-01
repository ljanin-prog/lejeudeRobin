// =============================================================================
//  regions3d.js — LES SIX RÉGIONS ET L'API MONDE  (contrat v2, §9)
// =============================================================================
//  Ce module REMPLACE js/world.js pour la 3D. Toute la carte passe par lui.
//
//  Six régions de 384 × 224 tuiles (86 016 tuiles, ~10× la carte 2D d'origine),
//  générées à la volée, de façon PROCÉDURALE et DÉTERMINISTE (même graine, même
//  monde), mises en cache (au plus 2 régions gardées en mémoire).
//
//  LA RÈGLE D'OR : un enfant coincé, c'est un jeu cassé.
//  Après chaque génération, un parcours en largeur part du point d'apparition et
//  doit atteindre : la ville, l'arène, le centre de soins, la boutique, chaque
//  porte de région, le port aérien et les six autels de légendaire. Tout ce qui
//  n'est pas atteint est RELIÉ DE FORCE en creusant le chemin le moins coûteux
//  (parcours 0-1). Le joueur ne peut donc jamais se retrouver enfermé.
//
//  STOCKAGE : la carte est un Uint16Array d'INDICES vers une table de noms de
//  types. 86 016 chaînes de caractères par région coûteraient bien trop cher en
//  mémoire et en temps de comparaison ; un index tient sur 2 octets et sert
//  directement de clé dans les tables « marchable / rencontre / couleur ».
//
//  DÉPENDANCES (toutes facultatives, repli systématique) :
//    R3            (core3d.js)   — registre, rng
//    R3.get('tiles')             — table des tuiles ; repli local plus bas
//    R3.get('cities')            — plans des six villes ; repli : petit bourg
//    R3.get('arenas')            — champion d'arène ajouté aux PNJ
//    R3.get('airship')           — enregistrement du port aérien au chargement
// =============================================================================

(function () {
  'use strict';

  var R = (typeof R3 !== 'undefined' && R3) ? R3 : null;

  // Dimensions figées par le §3 du contrat.
  var W = 384, H = 224;
  var BORDER = 3;          // épaisseur de l'anneau de bordure infranchissable

  // ==========================================================================
  //  1. ALÉATOIRE DÉTERMINISTE
  //     R3.hash(x, y) ne prend pas de graine (il reproduit hashPos du jeu 2D) :
  //     on a besoin d'un hachage à trois entrées pour que deux régions n'aient
  //     pas exactement le même relief. On le définit donc ici, en gardant
  //     R3.rng pour tout ce qui est séquentiel.
  // ==========================================================================

  function ihash(seed, x, y) {
    var n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    n = ((n ^ (n >>> 13)) * 1274126177) | 0;
    n = (n ^ (n >>> 16)) >>> 0;
    return n / 4294967296;
  }

  /** Bruit de valeur lissé (smoothstep) — la brique de tout le relief. */
  function vnoise(seed, x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    var a = ihash(seed, xi, yi), b = ihash(seed, xi + 1, yi);
    var c = ihash(seed, xi, yi + 1), d = ihash(seed, xi + 1, yi + 1);
    var t = a + (b - a) * fx;
    var u = c + (d - c) * fx;
    return t + (u - t) * fy;
  }

  /** Bruit fractal : 3 octaves suffisent pour un terrain lisible. */
  function fbm(seed, x, y) {
    return vnoise(seed, x, y) * 0.55 +
           vnoise(seed + 101, x * 2.1, y * 2.1) * 0.29 +
           vnoise(seed + 202, x * 4.3, y * 4.3) * 0.16;
  }

  /** Bruit « en crêtes » : c'est ce qui donne des arêtes de montagne nettes. */
  function ridged(seed, x, y) {
    var n = Math.abs(fbm(seed, x, y) - 0.5) * 2;
    return 1 - n;
  }

  function rngOf(seed) {
    if (R && typeof R.rng === 'function') return R.rng(seed);
    var s = (seed | 0) || 1;
    return function () {
      s = (s ^ (s << 13)) | 0;
      s = (s ^ (s >>> 17)) | 0;
      s = (s ^ (s << 5)) | 0;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  // ==========================================================================
  //  2. TABLE DES TUILES — avec repli complet
  //     tiles3d.js fait autorité s'il est chargé. Sinon on utilise la table
  //     compacte ci-dessous, qui reprend exactement ses valeurs : le module
  //     reste testable et jouable tout seul (règle n°7 du contrat).
  //     Format : NOM:drapeaux:biome:couleur   (w = marchable, e = rencontre)
  // ==========================================================================

  var FALLBACK_SPEC = [
    'GRASS:w:forest:#63b846 TALL_GRASS:we:forest:#4a9c36 FLOWERS:w:forest:#63b846 TREE::forest:#559f3c',
    'WATER::lake:#1b3f78 SHALLOW:we:lake:#3d86bd SAND:w:beach:#e3c68d SEA::sea:#132f5c',
    'WAVES:we:sea:#2f7fb8 PATH:w:plain:#c19a6b PLAIN:w:plain:#84c45c TALL_PLAIN:we:plain:#4f9e3f',
    'ROCK::plain:#6fb84a HOUSE_RED::city:#a5aab0 HOUSE_BLUE::city:#a5aab0 HOUSE_YELLOW::city:#a5aab0',
    'CITY_PATH:w:city:#8c98a6 CITY_GROUND:w:city:#a5aab0 FOUNTAIN::city:#a5aab0',
    'PARK_GRASS:w:park:#6cc04c PARK_TALL:we:park:#4a9c36 PARK_FLOWER:w:park:#6cc04c',
    'PARK_PATH:w:park:#d9be89 PARK_TREE::park:#6cc04c POND::park:#1b3f78 POND_EDGE:we:lake:#4f9e3f',
    'BENCH::park:#6cc04c MOUNTAIN::mountain:#6a727e MTN_PATH:w:mountain:#8a9199',
    'MTN_GRASS:we:mountain:#5b7a58 SNOW:we:mountain:#e6f1f7 VLG_HOUSE::village:#63b846',
    'VLG_PATH:w:village:#c08c62 VLG_TALL:we:village:#4a9c36 CITY2_PATH:w:city2:#8c98a6',
    'CITY2_GROUND:w:city2:#a5aab0 HOUSE2_RED::city2:#a5aab0 HOUSE2_BLUE::city2:#a5aab0',
    'HOUSE2_YELLOW::city2:#a5aab0 FOUNTAIN2::city2:#a5aab0 JUNGLE_GRASS:w:jungle:#2f8b3c',
    'JUNGLE_TALL:we:jungle:#236f2e JUNGLE_TREE::jungle:#2a7a34 JUNGLE_CANOPY::jungle:#1d5e2a',
    'VINE_TREE::jungle:#2b7b3a FERN:we:jungle:#357f38 SWAMP_GRASS:we:swamp:#5f7a35',
    'SWAMP_WATER::swamp:#2f4a33 MUD:w:swamp:#5b4630 LILY_PAD::swamp:#2f4a33 MANGROVE::swamp:#3d5a3a',
    'RUIN_MOSS::swamp:#4b6b46 LAVA::volcano:#8e2b12 LAVA_CRUST:w:volcano:#43261f',
    'BASALT:w:volcano:#3b3945 ASH:we:volcano:#584f56 CRACKED_EARTH:w:volcano:#8a5a3c',
    'EMBER_GRASS:we:volcano:#6e5a2c OBSIDIAN::volcano:#1a1c2c GEYSER::volcano:#6b5a4a',
    'DESERT_SAND:w:desert:#d8b46a DUNE::desert:#cfa85e CACTUS::desert:#d8b46a',
    'DRY_BONE:we:desert:#cbb083 ICE:w:glacier:#8ecbe0 ICE_CRACK::glacier:#6fb0cf',
    'GLACIER::glacier:#cfe9f5 DEEP_SNOW:we:glacier:#dfeef7 FROZEN_LAKE:w:glacier:#7cb8d8',
    'ICE_SPIKE::glacier:#a8dcef PINE_SNOW::glacier:#dfeef7 ICE_CAVE:we:glacier:#5f8fb0',
    'PLATEAU_GRASS:w:celestial:#5aa27a PLATEAU_TALL:we:celestial:#4d8f6b',
    'RUIN_STONE:w:celestial:#b9b3c6 RUIN_PILLAR::celestial:#b9b3c6 STAR_PATH:w:celestial:#6a5fa8',
    'CLOUD_STONE:w:celestial:#e6e1f5 OBSERVATORY_FLOOR:w:celestial:#cdd3e8',
    'CRYSTAL_SPIRE::celestial:#b9a8e0 OBSERVATORY::celestial:#cdd3e8 CLIFF::coast:#a67f57',
    'CLIFF_EDGE:w:coast:#b89467 PALM::coast:#e0c489 CORAL_SAND:we:coast:#f0cfae DOCK:w:coast:#8a6440',
    'BOAT::coast:#2f7fb8 LIGHTHOUSE_BASE::coast:#c9c3b4 REEF::coast:#2f7fb8',
    'PAVED_ROAD:w:citadel:#9aa3ad PLAZA:w:citadel:#b6b0a4 PLAZA_GRAND:w:citadel:#c9c2b2',
    'WALL::citadel:#8e8b84 WALL_TOWER::citadel:#8e8b84 GATE_ARCH:w:citadel:#a09a90',
    'CASTLE::citadel:#8e8b84 CASTLE_TOWER::citadel:#8e8b84 CASTLE_GATE:w:citadel:#a09a90',
    'CHURCH::citadel:#b3ab9c CHURCH_TOWER::citadel:#b3ab9c MANOR::citadel:#a89f92',
    'TOWNHOUSE_A::citadel:#a5a09a TOWNHOUSE_B::citadel:#a5a09a TOWNHOUSE_C::citadel:#a5a09a',
    'MARKET_STALL::citadel:#b6b0a4 GRAND_FOUNTAIN::citadel:#c9c2b2 STATUE::citadel:#c9c2b2',
    'LAMP_POST::citadel:#9aa3ad BANNER_POLE::citadel:#9aa3ad HEDGE::citadel:#5ea84a',
    'ROSE_BED::citadel:#5ea84a BRIDGE:w:citadel:#8a6440 ARENA_WALL::citadel:#9c9488',
    'ARENA_DOOR:w:citadel:#b6b0a4 HEAL_CENTER::citadel:#a5a09a HEAL_DOOR:w:citadel:#b6b0a4',
    'SHOP::citadel:#a5a09a SHOP_DOOR:w:citadel:#b6b0a4 PORTAL:w:plain:#6a5fa8 SIGN::plain:#c19a6b',
    'LEGEND_ALTAR::celestial:#5a4f8c VOID::sea:#132f5c',
    // Le port aérien du §17 bis. tiles3d.js ne les déclare pas (encore) : on
    // les définit ici et on les lui greffe plus bas, sans rien écraser.
    'AIRSHIP_PLATFORM:w:citadel:#b08050 AIRSHIP_DOCK:w:citadel:#c89a62 AIRSHIP_MAST::citadel:#8a6440',
  ];

  var FB = {};
  (function buildFallback() {
    var all = FALLBACK_SPEC.join(' ').split(' ');
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      if (!s) continue;
      var p = s.split(':');
      FB[p[0]] = {
        walkable: p[1].indexOf('w') >= 0,
        encounter: p[1].indexOf('e') >= 0,
        biome: p[2],
        ground: p[3],
      };
    }
  })();

  var MODT = (R && typeof R.get === 'function') ? R.get('tiles') : null;
  if (!MODT && typeof window !== 'undefined' && window.TILES3D) MODT = window.TILES3D;
  else if (!MODT && typeof globalThis !== 'undefined' && globalThis.TILES3D) MODT = globalThis.TILES3D;

  // --- Greffe des tuiles du port aérien -------------------------------------
  // Le §17 bis les exige, tiles3d.js ne les fournit pas. On les ajoute sans
  // remplacer quoi que ce soit : si un jour tiles3d.js les déclare, ce bloc ne
  // fait plus rien. C'est le seul endroit où ce module touche à un autre.
  (function grafferPortAerien() {
    if (!MODT || !MODT.TILES) return;
    var defs = {
      AIRSHIP_PLATFORM: { walkable: true, encounter: false, biome: 'citadel', ground: '#b08050', h: 0.35, deco: null, label: 'Plateforme du port aérien' },
      AIRSHIP_DOCK: { walkable: true, encounter: false, biome: 'citadel', ground: '#c89a62', h: 0.35, deco: 'airshipDock', label: 'Embarcadère' },
      AIRSHIP_MAST: { walkable: false, encounter: false, biome: 'citadel', ground: '#8a6440', h: 0.4, deco: 'airshipMast', label: "Mât d'amarrage" },
    };
    try {
      for (var k in defs) {
        if (!Object.prototype.hasOwnProperty.call(defs, k)) continue;
        if (!MODT.TILES[k]) MODT.TILES[k] = defs[k];
        if (MODT.NAMES && MODT.NAMES.indexOf(k) < 0) MODT.NAMES.push(k);
        var d = defs[k];
        var st = { ground: d.ground, h: d.h, deco: d.deco, roof: null };
        if (MODT.STYLE && !MODT.STYLE[k]) MODT.STYLE[k] = st;
        if (R && R.TILE_STYLE && !R.TILE_STYLE[k]) R.TILE_STYLE[k] = st;
      }
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('regions3d : greffe des tuiles du port aérien impossible —', e);
    }
  })();

  /** Définition d'une tuile : tiles3d en priorité, repli local sinon. */
  function tdef(name) {
    if (MODT && MODT.TILES && MODT.TILES[name]) return MODT.TILES[name];
    return FB[name] || FB.GRASS;
  }

  function groundOf(name) {
    if (MODT && MODT.TILES && MODT.TILES[name]) {
      if (MODT.TILES[name].ground) return MODT.TILES[name].ground;
      if (typeof MODT.style === 'function') {
        var st = MODT.style(name);
        if (st && st.ground) return st.ground;
      }
    }
    return (FB[name] || FB.GRASS).ground;
  }

  // ==========================================================================
  //  3. TABLE D'INDICES — le cœur de la performance
  //     Tous les noms connus sont enregistrés UNE FOIS au chargement, donc les
  //     tables « marchable / rencontre / biome / couleur » sont figées et
  //     s'indexent directement par l'entier stocké dans la carte.
  // ==========================================================================

  var NAMES = [];
  var INDEX = Object.create(null);

  function idx(name) {
    var i = INDEX[name];
    if (i !== undefined) return i;
    i = NAMES.length;
    NAMES.push(name);
    INDEX[name] = i;
    return i;
  }

  (function enregistrerTousLesNoms() {
    idx('GRASS');                                     // index 0 = repli
    var k;
    if (MODT && MODT.NAMES) for (k = 0; k < MODT.NAMES.length; k++) idx(MODT.NAMES[k]);
    for (k in FB) if (Object.prototype.hasOwnProperty.call(FB, k)) idx(k);
  })();

  var N_TYPES = NAMES.length;
  var WALKI = new Uint8Array(N_TYPES);
  var ENCI = new Uint8Array(N_TYPES);
  var BIOMEI = new Array(N_TYPES);
  var COLI = new Array(N_TYPES);
  (function buildTables() {
    for (var i = 0; i < N_TYPES; i++) {
      var d = tdef(NAMES[i]);
      WALKI[i] = d.walkable ? 1 : 0;
      ENCI[i] = d.encounter ? 1 : 0;
      BIOMEI[i] = d.biome || 'plain';
      var g = groundOf(NAMES[i]) || '#63b846';
      COLI[i] = [parseInt(g.substr(1, 2), 16), parseInt(g.substr(3, 2), 16), parseInt(g.substr(5, 2), 16)];
    }
  })();

  var BIOME_LABELS = {
    forest: 'Forêt magique', lake: 'Lac scintillant', plain: 'Plaine ensoleillée',
    beach: 'Plage dorée', sea: 'Haute mer', park: 'Grand parc', city: 'Ville',
    mountain: 'Montagnes', village: 'Village', city2: 'Grande cité',
    jungle: 'Jungle d\'Ambre', swamp: 'Marécage brumeux', volcano: 'Terres de lave',
    desert: 'Désert de cendre', glacier: 'Glacier éternel', celestial: 'Plateau céleste',
    coast: 'Côte de Saphir', citadel: 'Cité majestueuse',
  };

  // ==========================================================================
  //  4. LA TABLE FIGÉE DES SIX RÉGIONS  (§3, §4, §17 bis)
  //     Tout ce qui est ici est STATIQUE : connu sans avoir généré la région.
  //     C'est ce qui permet aux portes d'être cohérentes dans les deux sens
  //     sans jamais générer les deux régions en même temps.
  // ==========================================================================

  // Emprise des villes — doit correspondre à cities3d.js. Sert de repli et de
  // zone d'exclusion pour les dangers (lave, gouffres, mer).
  var CITY_BOX = {
    val: { x: 26, y: 14, w: 48, h: 38 },
    sylve: { x: 150, y: 64, w: 46, h: 36 },
    saphir: { x: 62, y: 132, w: 52, h: 38 },
    givre: { x: 210, y: 48, w: 46, h: 36 },
    braise: { x: 104, y: 150, w: 46, h: 36 },
    aurore: { x: 152, y: 86, w: 64, h: 48 },
  };

  // Où l'on se retrouve quand on arrive par une porte : 2 tuiles VERS L'INTÉRIEUR
  // de la carte, pour ne pas repartir aussitôt en marchant sur le portail.
  var APPROACH = { N: [0, 2], S: [0, -2], W: [2, 0], E: [-2, 0] };

  var SPECS = [
    {
      id: 'val', name: "Val d'Émeraude", seed: 11011,
      theme: 'forêt, plaine, lac, parc, village',
      music: 'forest', cityId: 'bourg-emeraude', arenaType: 'plante', recommendedLevel: 5,
      biomes: ['forest', 'plain', 'lake', 'park', 'village', 'mountain'],
      legends: ['sylvaros', 'florabelle', 'racinor', 'bourrasca', 'prismee', 'penombra'],
      border: 'TREE', road: 'PATH', bridge: 'BRIDGE',
      grass: ['TALL_GRASS', 'TALL_PLAIN', 'PARK_TALL'],
      spawn: { x: 24, y: 30 },
      port: { x: 79, y: 46, name: "Escale d'Émeraude" },
      gates: [
        { x: 96, y: 10, edge: 'N', toRegion: 'givre', label: 'Col des Brumes' },
        { x: 373, y: 150, edge: 'E', toRegion: 'sylve', label: 'Pont de la Rivière' },
      ],
      altars: [
        { id: 'sylvaros', x: 36, y: 100, label: 'Clairière des Bois Anciens' },
        { id: 'florabelle', x: 152, y: 62, label: 'Prairie aux Mille Pétales' },
        { id: 'racinor', x: 72, y: 146, label: 'Cœur des Racines' },
        { id: 'bourrasca', x: 300, y: 13, label: 'Aiguille des Vents' },
        { id: 'prismee', x: 272, y: 54, label: 'Île du Lac' },
        { id: 'penombra', x: 330, y: 196, label: 'Bosquet des Murmures' },
      ],
    },
    {
      id: 'sylve', name: "Sylve d'Ambre", seed: 22022,
      theme: 'jungle dense, marécage, ruines envahies',
      music: 'forest', cityId: 'ambrelune', arenaType: 'foudre', recommendedLevel: 12,
      biomes: ['jungle', 'swamp', 'forest', 'plain'],
      legends: ['fulguron', 'voltaris', 'geomastre', 'limonis', 'nyxaroth', 'sablion'],
      border: 'JUNGLE_CANOPY', road: 'MUD', bridge: 'BRIDGE',
      grass: ['JUNGLE_TALL', 'FERN', 'SWAMP_GRASS'],
      spawn: null,
      port: { x: 200, y: 82, name: "Ponton d'Ambrelune" },
      gates: [
        { x: 10, y: 150, edge: 'W', toRegion: 'val', label: 'Pont de la Rivière' },
        { x: 180, y: 10, edge: 'N', toRegion: 'aurore', label: 'Escalier des Anciens' },
        { x: 373, y: 170, edge: 'E', toRegion: 'saphir', label: "Delta d'Ambre" },
      ],
      altars: [
        { id: 'fulguron', x: 176, y: 24, label: 'Temple du Tonnerre' },
        { id: 'voltaris', x: 60, y: 56, label: 'Canopée Étincelante' },
        { id: 'geomastre', x: 302, y: 58, label: 'Dos de la Montagne' },
        { id: 'limonis', x: 252, y: 148, label: 'Fosse de Glaise' },
        { id: 'nyxaroth', x: 88, y: 192, label: 'Marais des Ombres' },
        { id: 'sablion', x: 332, y: 194, label: 'Bancs de Sable du Delta' },
      ],
    },
    {
      id: 'saphir', name: 'Côte de Saphir', seed: 33033,
      theme: 'plage, mer, falaises, îles, port',
      music: 'sea', cityId: 'port-saphir', arenaType: 'eau', recommendedLevel: 20,
      biomes: ['coast', 'beach', 'sea', 'plain', 'forest'],
      legends: ['abyssalor', 'ondinae', 'marea', 'orageon', 'zephyrion', 'nebulon'],
      border: 'SEA', road: 'SAND', bridge: 'BRIDGE',
      grass: ['CORAL_SAND', 'TALL_PLAIN', 'WAVES'],
      spawn: null,
      port: { x: 120, y: 152, name: 'Amarre du Phare' },
      gates: [
        { x: 10, y: 170, edge: 'W', toRegion: 'sylve', label: "Delta d'Ambre" },
        { x: 200, y: 10, edge: 'N', toRegion: 'braise', label: 'Côte de Cendre' },
      ],
      altars: [
        { id: 'abyssalor', x: 306, y: 190, label: 'Île du Léviathan' },
        { id: 'ondinae', x: 238, y: 172, label: "Île de l'Écume" },
        { id: 'marea', x: 350, y: 148, label: 'Récif des Marées' },
        { id: 'orageon', x: 152, y: 42, label: 'Colline des Orages' },
        { id: 'zephyrion', x: 40, y: 58, label: 'Falaise du Vent' },
        { id: 'nebulon', x: 330, y: 58, label: 'Cap des Nébuleuses' },
      ],
    },
    {
      id: 'givre', name: 'Massif de Givre', seed: 44044,
      theme: 'montagnes, neige, glaciers, grottes de glace',
      music: 'mountain', cityId: 'cimefroide', arenaType: 'glace', recommendedLevel: 28,
      biomes: ['glacier', 'mountain', 'forest'],
      legends: ['cryonix', 'givrea', 'banquisor', 'aelune', 'cristallia', 'eclipsion'],
      border: 'MOUNTAIN', road: 'ICE', bridge: 'BRIDGE',
      grass: ['DEEP_SNOW', 'SNOW', 'ICE_CAVE'],
      spawn: null,
      port: { x: 262, y: 42, name: 'Mât de Cimefroide' },
      gates: [
        { x: 96, y: 213, edge: 'S', toRegion: 'val', label: 'Col des Brumes' },
        { x: 373, y: 120, edge: 'E', toRegion: 'aurore', label: 'Arête de Glace' },
      ],
      altars: [
        { id: 'cryonix', x: 58, y: 40, label: 'Trône de Glace' },
        { id: 'givrea', x: 148, y: 152, label: 'Vallon des Bois de Cristal' },
        { id: 'banquisor', x: 302, y: 182, label: 'Banquise du Sud' },
        { id: 'aelune', x: 332, y: 30, label: 'Voile des Cimes' },
        { id: 'cristallia', x: 120, y: 100, label: 'Grotte aux Prismes' },
        { id: 'eclipsion', x: 202, y: 190, label: "Cirque de l'Éclipse" },
      ],
    },
    {
      id: 'braise', name: 'Caldeira de Braise', seed: 55055,
      theme: 'volcan, désert, lave, terres craquelées',
      music: 'plain', cityId: 'fournaise', arenaType: 'feu', recommendedLevel: 36,
      biomes: ['volcano', 'desert', 'mountain'],
      legends: ['pyrathos', 'emberyx', 'fournalis', 'terracor', 'obsidion', 'solaria'],
      border: 'OBSIDIAN', road: 'BASALT', bridge: 'BRIDGE',
      grass: ['EMBER_GRASS', 'ASH', 'DRY_BONE'],
      spawn: null,
      port: { x: 168, y: 132, name: 'Pont de Fournaise' },
      gates: [
        { x: 10, y: 100, edge: 'W', toRegion: 'aurore', label: 'Faille du Couchant' },
        { x: 200, y: 213, edge: 'S', toRegion: 'saphir', label: 'Côte de Cendre' },
      ],
      altars: [
        { id: 'pyrathos', x: 218, y: 84, label: 'Cœur de la Caldeira' },
        { id: 'emberyx', x: 306, y: 36, label: 'Nid de Braise' },
        { id: 'fournalis', x: 150, y: 58, label: 'Antre du Lion' },
        { id: 'terracor', x: 58, y: 58, label: 'Dunes Creusées' },
        { id: 'obsidion', x: 306, y: 178, label: "Champ d'Obsidienne" },
        { id: 'solaria', x: 58, y: 190, label: 'Miroir du Soleil' },
      ],
    },
    {
      id: 'aurore', name: "Plateau d'Aurore", seed: 66066,
      theme: 'hauts plateaux, ruines célestes, observatoire',
      music: 'city', cityId: 'aurore-cite', arenaType: 'lumiere', recommendedLevel: 45,
      biomes: ['celestial', 'plain', 'mountain'],
      legends: ['monolithe', 'aureol', 'chronoss', 'eternia', 'vortexis', 'astralis'],
      border: 'VOID', road: 'STAR_PATH', bridge: 'BRIDGE',
      grass: ['PLATEAU_TALL'],
      spawn: null,
      port: { x: 224, y: 96, name: 'Quai des Nuées' },
      gates: [
        { x: 10, y: 120, edge: 'W', toRegion: 'givre', label: 'Arête de Glace' },
        { x: 180, y: 213, edge: 'S', toRegion: 'sylve', label: 'Escalier des Anciens' },
        { x: 373, y: 100, edge: 'E', toRegion: 'braise', label: 'Faille du Couchant' },
      ],
      altars: [
        { id: 'monolithe', x: 78, y: 48, label: 'Cercle des Menhirs' },
        { id: 'aureol', x: 306, y: 40, label: 'Terrasse du Soleil' },
        { id: 'chronoss', x: 58, y: 182, label: 'Cadran Oublié' },
        { id: 'eternia', x: 334, y: 180, label: 'Salle des Sabliers' },
        { id: 'vortexis', x: 252, y: 192, label: 'Spirale Étoilée' },
        { id: 'astralis', x: 100, y: 118, label: 'Rive des Constellations' },
      ],
    },
  ];

  var SPEC_BY_ID = {};
  for (var si = 0; si < SPECS.length; si++) SPEC_BY_ID[SPECS[si].id] = SPECS[si];

  // --- Cohérence aller-retour des portes ------------------------------------
  // Deux portes qui portent le même NOM DE PASSAGE sont les deux bouts du même
  // chemin. On calcule ici, une fois pour toutes, le point d'arrivée de chaque
  // porte : la tuile juste devant la porte jumelle, côté intérieur de la carte.
  (function relierLesPortes() {
    for (var i = 0; i < SPECS.length; i++) {
      var s = SPECS[i];
      for (var g = 0; g < s.gates.length; g++) {
        var gate = s.gates[g];
        var t = SPEC_BY_ID[gate.toRegion];
        var back = null;
        if (t) {
          for (var k = 0; k < t.gates.length; k++) {
            if (t.gates[k].label === gate.label && t.gates[k].toRegion === s.id) { back = t.gates[k]; break; }
          }
        }
        if (back) {
          var a = APPROACH[back.edge] || [0, 0];
          gate.toX = back.x + a[0];
          gate.toY = back.y + a[1];
        } else {
          gate.toX = gate.x; gate.toY = gate.y;
        }
      }
      // Point d'apparition par défaut : celui du §3 pour val, sinon devant la
      // porte principale de la ville (calculé après le plan de ville).
      if (!s.spawn) {
        var b = CITY_BOX[s.id];
        s.spawn = { x: Math.round(b.x + b.w / 2), y: b.y + b.h + 4 };
      }
      // Le port aérien : plateforme 5×5, mât au centre, embarcadère au sud.
      s.airship = {
        x: s.port.x, y: s.port.y,
        dockX: s.port.x, dockY: s.port.y + 2,
        name: s.port.name, regionId: s.id,
      };
    }
  })();

  // ==========================================================================
  //  5. LES SIX regionDef — statiques, disponibles sans génération
  // ==========================================================================

  var REGIONS = SPECS.map(function (s) {
    return {
      id: s.id, name: s.name, w: W, h: H, theme: s.theme, seed: s.seed,
      biomes: s.biomes.slice(),
      music: s.music,
      cityId: s.cityId,
      arenaType: s.arenaType,
      legends: s.legends.slice(),
      gates: s.gates.map(function (g) {
        return { x: g.x, y: g.y, toRegion: g.toRegion, toX: g.toX, toY: g.toY, label: g.label, edge: g.edge };
      }),
      spawn: { x: s.spawn.x, y: s.spawn.y },
      recommendedLevel: s.recommendedLevel,
      airship: { x: s.airship.x, y: s.airship.y, dockX: s.airship.dockX, dockY: s.airship.dockY, name: s.airship.name },
      city: null,       // rempli au premier chargement (plan de cities3d)
      altars: s.altars.map(function (a) { return { id: a.id, x: a.x, y: a.y, label: a.label, accessX: a.x, accessY: a.y + 2 }; }),
    };
  });

  var REGION_BY_ID = {};
  for (var ri = 0; ri < REGIONS.length; ri++) REGION_BY_ID[REGIONS[ri].id] = REGIONS[ri];

  function get(id) { return REGION_BY_ID[id] || null; }
  function list() { return REGIONS.slice(); }

  // ==========================================================================
  //  6. ÉCRITURE DE LA CARTE — petits outils bas niveau
  // ==========================================================================

  /** Pose une tuile par son NOM (jamais son index) : plus lisible, un peu plus
   *  lent — mais on ne l'appelle jamais dans la boucle chaude du relief. */
  function setTile(grid, x, y, name) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    grid[y * W + x] = idx(name);
  }

  // Tuiles considérées comme de l'eau (ou assimilé : lave, glace fissurée) au
  // sens « on pose un PONT plutôt qu'une route si on doit creuser ici ».
  var WATERISH = {
    WATER: 1, SHALLOW: 1, SEA: 1, WAVES: 1, POND: 1, POND_EDGE: 1,
    SWAMP_WATER: 1, LILY_PAD: 1, MANGROVE: 1, LAVA: 1, ICE_CRACK: 1,
    FROZEN_LAKE: 1, REEF: 1, BOAT: 1, VOID: 1,
  };
  function isWaterish(name) { return !!WATERISH[name]; }

  function inBox(b, x, y) { return b && x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h; }

  function regionName(id) { var s = SPEC_BY_ID[id]; return s ? s.name : id; }
  function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // ==========================================================================
  //  7. RELIEF — une fonction de peinture par région : c'est ELLE qui donne à
  //     chacune des six cartes son identité (§3). Toutes partagent les mêmes
  //     briques de bruit (fbm/ridged, §1) mais avec des seuils et des tuiles
  //     entièrement différents : on ne doit jamais confondre deux régions au
  //     premier coup d'œil, même en rendu ASCII grossier.
  //
  //     Chaque fonction ne s'occupe QUE du terrain « naturel » : la ville, les
  //     portes, les autels et le port aérien sont posés par-dessus ensuite,
  //     dans cet ordre précis (§9), ce qui leur garantit toujours le dernier mot.
  // ==========================================================================

  // --- Champs de bruit précalculés sur une grille grossière puis interpolés
  //     bilinéairement (§9 : « génération sous 150 ms »). Calculer fbm/ridged
  //     à CHAQUE tuile (86 016 fois, avec 3 octaves = ~12 hachages chacun)
  //     coûtait plus de 800 ms par région. Le bruit varie lentement (longueur
  //     d'onde 10 à 50 tuiles selon les échelles utilisées ici) : l'échantillonner
  //     tous les 3 tuiles puis interpoler est visuellement indiscernable du
  //     plein-résolution, pour un coût ~9× moindre — largement sous le budget.
  var FIELD_STEP = 3;

  function makeSampler(coarse, gw, gh, step) {
    return function (x, y) {
      var fx = x / step, fy = y / step;
      var gx0 = fx | 0, gy0 = fy | 0;
      if (gx0 >= gw - 1) gx0 = gw - 2;
      if (gy0 >= gh - 1) gy0 = gh - 2;
      var tx = fx - gx0, ty = fy - gy0;
      var i00 = gy0 * gw + gx0, i10 = i00 + 1, i01 = i00 + gw, i11 = i01 + 1;
      var a = coarse[i00] + (coarse[i10] - coarse[i00]) * tx;
      var b = coarse[i01] + (coarse[i11] - coarse[i01]) * tx;
      return a + (b - a) * ty;
    };
  }
  function buildFbmField(seed, scale, step) {
    var gw = Math.ceil(W / step) + 2, gh = Math.ceil(H / step) + 2;
    var arr = new Float32Array(gw * gh);
    for (var gy = 0; gy < gh; gy++) for (var gx = 0; gx < gw; gx++) arr[gy * gw + gx] = fbm(seed, gx * step * scale, gy * step * scale);
    return makeSampler(arr, gw, gh, step);
  }
  function buildRidgedField(seed, scale, step) {
    var gw = Math.ceil(W / step) + 2, gh = Math.ceil(H / step) + 2;
    var arr = new Float32Array(gw * gh);
    for (var gy = 0; gy < gh; gy++) for (var gx = 0; gx < gw; gx++) arr[gy * gw + gx] = ridged(seed, gx * step * scale, gy * step * scale);
    return makeSampler(arr, gw, gh, step);
  }

  // Quels champs chaque région utilise, avec leur décalage de graine et leur
  // échelle — c'est la traduction directe des anciens appels fbm()/ridged()
  // inline, juste précalculés une fois par région au lieu d'une fois par tuile.
  var FIELD_SPECS = {
    val:    { m: [500, 0.03], d: [1200, 0.09], r: [900, 0.02, 'ridged'] },
    sylve:  { e: [0, 0.018], m: [500, 0.025], d: [1200, 0.10], ruin: [1700, 0.05] },
    saphir: { land: [0, 0.012], isl: [2200, 0.035], d: [1200, 0.09], m: [500, 0.03] },
    givre:  { r: [0, 0.02, 'ridged'], m: [500, 0.025], d: [1200, 0.10] },
    braise: { d: [1200, 0.10], m: [500, 0.03], dune: [2200, 0.02] },
    aurore: { e: [0, 0.02], d: [1200, 0.09], ruin: [1700, 0.04] },
  };

  function buildFields(spec) {
    var specF = FIELD_SPECS[spec.id] || {};
    var F = {};
    for (var key in specF) {
      if (!Object.prototype.hasOwnProperty.call(specF, key)) continue;
      var def = specF[key];
      F[key] = (def[2] === 'ridged')
        ? buildRidgedField(spec.seed + def[0], def[1], FIELD_STEP)
        : buildFbmField(spec.seed + def[0], def[1], FIELD_STEP);
    }
    return F;
  }

  // --- 1. Val d'Émeraude — forêt, plaine, lac, parc, village, contreforts ---
  function paintVal(spec, x, y, F) {
    var m = F.m(x, y);   // humidité -> forêt / plaine
    var d = F.d(x, y);   // mouchetage fin
    var r = F.r(x, y);

    // Le lac autour de l'Île du Lac (autel de Prismée, 272,54).
    var dLake = Math.hypot(x - 272, y - 58);
    if (dLake < 15) {
      if (dLake < 4) return 'GRASS';
      return dLake < 12 ? 'WATER' : 'SHALLOW';
    }

    // Contreforts au nord, vers le Col des Brumes (givre).
    if (y < 46) {
      var rn = r * (1 - y / 50);
      if (rn > 0.60) return 'MOUNTAIN';
      if (rn > 0.48) return (d > 0.5 ? 'MTN_GRASS' : 'MTN_PATH');
      if (rn > 0.38) return 'SNOW';
    }

    // Un grand parc tout autour de Bourg-Émeraude.
    var cb = CITY_BOX.val;
    var dCity = Math.hypot(x - (cb.x + cb.w / 2), y - (cb.y + cb.h / 2));
    if (dCity < 30) {
      if (d > 0.64) return 'PARK_TREE';
      if (m > 0.58) return 'PARK_TALL';
      if (d > 0.42) return 'PARK_FLOWER';
      return 'PARK_GRASS';
    }

    // Plaine ouverte si sec, forêt dense si humide.
    if (m < 0.36) {
      if (d > 0.70) return 'ROCK';
      return (d > 0.52) ? 'TALL_PLAIN' : 'PLAIN';
    }
    if (d > 0.66) return 'TREE';
    if (m > 0.62 && d > 0.40) return 'TALL_GRASS';
    if (d > 0.60) return 'FLOWERS';
    return 'GRASS';
  }

  // --- 2. Sylve d'Ambre — jungle dense, marécage, ruines envahies ---
  function paintSylve(spec, x, y, F) {
    var e = F.e(x, y);        // relief général (bas = marais)
    var m = F.m(x, y);
    var d = F.d(x, y);
    var ruin = F.ruin(x, y);

    if (e < 0.40) {
      if (d > 0.74) return 'MANGROVE';
      if (d > 0.62) return 'LILY_PAD';
      if (m < 0.30) return 'SWAMP_WATER';
      if (d > 0.46) return 'SWAMP_GRASS';
      return 'MUD';
    }
    if (ruin > 0.76 && d > 0.5) return 'RUIN_MOSS';
    if (d > 0.70) return (m > 0.5 ? 'JUNGLE_CANOPY' : 'JUNGLE_TREE');
    if (d > 0.60) return 'VINE_TREE';
    if (m > 0.56 && d > 0.35) return 'JUNGLE_TALL';
    if (d > 0.50) return 'FERN';
    return 'JUNGLE_GRASS';
  }

  // --- 3. Côte de Saphir — plage, mer, falaises, îles, port ---
  function paintSaphir(spec, x, y, F) {
    var land = F.land(x, y);     // masse continentale
    var isl = F.isl(x, y);       // îles éparses
    var d = F.d(x, y);
    var m = F.m(x, y);

    var islandZone = (x > 210 && y > 110) && isl > 0.60;
    var isLand = land > 0.47 || islandZone;

    if (!isLand) return (isl > 0.60) ? 'REEF' : ((d > 0.55) ? 'WAVES' : 'SEA');

    var coastBand = !islandZone && land > 0.41 && land < 0.51;
    if (coastBand) return (d > 0.58) ? 'CLIFF' : 'CLIFF_EDGE';

    if (land < 0.55 || islandZone) {
      if (d > 0.74) return 'PALM';
      if (d > 0.52) return 'CORAL_SAND';
      return 'SAND';
    }
    if (m > 0.60 && d > 0.5) return 'TALL_PLAIN';
    if (d > 0.68) return 'TREE';
    return 'PLAIN';
  }

  // --- 4. Massif de Givre — montagnes, neige, glaciers, grottes de glace ---
  function paintGivre(spec, x, y, F) {
    var r = F.r(x, y);       // crêtes
    var m = F.m(x, y);
    var d = F.d(x, y);

    // ridged() est délibérément asymétrique (c'est ce qui dessine des ARÊTES
    // nettes plutôt qu'un patchwork) : sa médiane tourne autour de 0,8 et non
    // 0,5. Des seuils pensés pour une distribution uniforme auraient rendu
    // 93 % de la carte infranchissable (mesuré) — les seuils ci-dessous sont
    // calés sur les centiles réels de ridged() pour garder une majorité de
    // neige ouverte, praticable, avec des pics spectaculaires mais rares.
    if (r > 0.95) return 'GLACIER';
    if (r > 0.88) return 'MOUNTAIN';
    if (r > 0.78) {
      if (d > 0.62) return 'ICE_CAVE';
      return (m > 0.5) ? 'ICE' : 'MTN_PATH';
    }
    if (d > 0.72) return 'ICE_SPIKE';
    if (d > 0.62) return 'PINE_SNOW';
    if (m < 0.26 && d > 0.4) return 'FROZEN_LAKE';
    if (m < 0.20) return 'ICE_CRACK';
    if (d > 0.50) return 'DEEP_SNOW';
    return 'SNOW';
  }

  // --- 5. Caldeira de Braise — volcan, désert, lave, terres craquelées ---
  function paintBraise(spec, x, y, F) {
    var dc = Math.hypot(x - 190, y - 100) / 70;          // distance à la caldeira
    var d = F.d(x, y);
    var m = F.m(x, y);
    var dune = F.dune(x, y);

    if (dc < 0.35) {
      if (d > 0.56) return 'OBSIDIAN';
      return (m < 0.42) ? 'LAVA' : 'LAVA_CRUST';
    }
    if (dc < 0.55) {
      if (d > 0.68) return 'GEYSER';
      return (d > 0.5) ? 'BASALT' : 'CRACKED_EARTH';
    }
    if (dc < 0.85) {
      if (d > 0.64) return 'EMBER_GRASS';
      return (m > 0.55) ? 'ASH' : 'CRACKED_EARTH';
    }
    if (dune > 0.62) return 'DUNE';
    if (d > 0.70) return 'CACTUS';
    if (d > 0.52) return 'DRY_BONE';
    return 'DESERT_SAND';
  }

  // --- 6. Plateau d'Aurore — hauts plateaux, ruines célestes, observatoire ---
  function paintAurore(spec, x, y, F) {
    var e = F.e(x, y);
    var d = F.d(x, y);
    var ruin = F.ruin(x, y);

    if (e < 0.32) return (d > 0.52) ? 'CLOUD_STONE' : 'PLATEAU_TALL';
    if (ruin > 0.72) return (d > 0.58) ? 'RUIN_PILLAR' : 'RUIN_STONE';
    if (d > 0.70) return 'CRYSTAL_SPIRE';
    if (d > 0.56) return 'PLATEAU_TALL';
    if (e > 0.55 && d > 0.36) return 'STAR_PATH';
    // Repli : plutôt que de tout renvoyer sur PLATEAU_GRASS (ce qui rendait
    // le plateau monotone à plus de 65 % de sa surface), on partage encore le
    // reste avec des hautes herbes — généreuses en rencontres, comme demandé
    // au §9 (« zones de hautes herbes / rencontres généreuses »).
    return (d > 0.44) ? 'PLATEAU_TALL' : 'PLATEAU_GRASS';
  }

  var PAINTERS = {
    val: paintVal, sylve: paintSylve, saphir: paintSaphir,
    givre: paintGivre, braise: paintBraise, aurore: paintAurore,
  };

  /** Peint tout le relief naturel d'une région, sauf l'emprise de sa ville
   *  (que `cities3d` recouvrira de toute façon juste après). */
  function paintTerrain(spec, grid) {
    var fn = PAINTERS[spec.id] || paintVal;
    var F = buildFields(spec);
    var box = CITY_BOX[spec.id];
    for (var y = BORDER; y < H - BORDER; y++) {
      for (var x = BORDER; x < W - BORDER; x++) {
        if (inBox(box, x, y)) continue;
        grid[y * W + x] = idx(fn(spec, x, y, F));
      }
    }
  }

  /** L'anneau infranchissable qui ferme la carte (§9 : « hors carte : type de
   *  bordure infranchissable » — ici on le matérialise en dur sur les derniers
   *  tuiles jouables, ce qui revient au même pour le joueur). */
  function paintBorder(spec, grid) {
    var b = idx(spec.border);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        if (x < BORDER || y < BORDER || x >= W - BORDER || y >= H - BORDER) grid[y * W + x] = b;
      }
    }
  }

  // ==========================================================================
  //  8. LA VILLE — délègue à cities3d.js, avec un repli complet si absent
  // ==========================================================================

  function citiesApi() {
    if (R && typeof R.get === 'function') { var c = R.get('cities'); if (c) return c; }
    if (typeof window !== 'undefined' && window.CITIES3D) return window.CITIES3D;
    if (typeof globalThis !== 'undefined' && globalThis.CITIES3D) return globalThis.CITIES3D;
    return null;
  }

  function stampCity(spec, grid) {
    var put = function (x, y, t) { setTile(grid, x, y, t); };
    var api = citiesApi();
    var def = null;
    if (api && typeof api.stamp === 'function') {
      try { def = api.stamp(spec.id, put); } catch (e) { warnStep('ville (cities3d)', spec.id, e); def = null; }
    }
    if (!def) def = stampFallbackCity(spec, put);
    return def;
  }

  /** Petit bourg de secours : pas de rempart, mais tout ce qu'il faut pour
   *  jouer (fontaine, quelques maisons, arène, soins, boutique, une porte). */
  function stampFallbackCity(spec, put) {
    var b = CITY_BOX[spec.id];
    var cx = b.x + (b.w >> 1), cy = b.y + (b.h >> 1);
    for (var y = b.y; y < b.y + b.h; y++) for (var x = b.x; x < b.x + b.w; x++) put(x, y, 'CITY_GROUND');
    for (var xr = b.x; xr < b.x + b.w; xr++) put(xr, cy, 'CITY_PATH');
    for (var yr = b.y; yr < b.y + b.h; yr++) put(cx, yr, 'CITY_PATH');
    put(cx, cy, 'FOUNTAIN');

    var houses = ['HOUSE_RED', 'HOUSE_BLUE', 'HOUSE_YELLOW'];
    var n = 0;
    for (var yy = b.y + 2; yy < b.y + b.h - 2; yy += 3) {
      for (var xx = b.x + 2; xx < b.x + b.w - 2; xx += 3) {
        if (Math.abs(xx - cx) < 3 && Math.abs(yy - cy) < 3) continue;
        if (((xx + yy) & 1) === 0) { put(xx, yy, houses[n % 3]); n++; }
      }
    }

    var ar = { x: b.x + 3, y: b.y + 3 };
    put(ar.x, ar.y, 'ARENA_WALL'); put(ar.x, ar.y + 1, 'ARENA_DOOR');
    var hc = { x: b.x + b.w - 4, y: b.y + 3 };
    put(hc.x, hc.y, 'HEAL_CENTER'); put(hc.x, hc.y + 1, 'HEAL_DOOR');
    var sh = { x: b.x + 3, y: b.y + b.h - 4 };
    put(sh.x, sh.y, 'SHOP'); put(sh.x, sh.y + 1, 'SHOP_DOOR');

    return {
      id: 'secours-' + spec.id, regionId: spec.id, name: spec.name + ' (bourg de secours)',
      x: b.x, y: b.y, w: b.w, h: b.h, style: 'secours',
      gates: [{ x: cx, y: b.y, dir: 'up', label: 'Entrée' }],
      plaza: { x: cx - 2, y: cy - 2, w: 5, h: 5 },
      castle: null, church: null,
      arena: { x: ar.x, y: ar.y + 1 }, heal: { x: hc.x, y: hc.y + 1 }, shop: { x: sh.x, y: sh.y + 1 },
      fountain: { x: cx, y: cy }, landmarks: [], houses: n,
    };
  }

  // ==========================================================================
  //  9. AUTELS, PORT AÉRIEN, PORTAILS — posés APRÈS la ville, pour garder le
  //     dernier mot (règle §9 : « après la génération de base »).
  // ==========================================================================

  var ALTAR_RING = {
    val: 'PARK_PATH', sylve: 'RUIN_MOSS', saphir: 'CORAL_SAND',
    givre: 'ICE', braise: 'BASALT', aurore: 'RUIN_STONE',
  };

  // Le port aérien : cities3d.js (mis à jour en parallèle) construit désormais
  // le sien, intégré au rempart de chaque ville (§17 bis : « terrasse accolée
  // au rempart »), et le rapporte dans `cityDef.airship`. C'est nettement
  // mieux intégré que planter une plateforme isolée en pleine campagne — donc
  // quand la ville en fournit un, on s'en sert et on NE construit PAS le
  // nôtre par-dessus (`hasCityAirship`) : un seul port aérien par région,
  // jamais deux structures qui se dupliquent.
  function stampFeatures(spec, grid, hasCityAirship) {
    var i;
    for (i = 0; i < spec.gates.length; i++) setTile(grid, spec.gates[i].x, spec.gates[i].y, 'PORTAL');

    var ring = ALTAR_RING[spec.id] || 'PATH';
    for (i = 0; i < spec.altars.length; i++) {
      var a = spec.altars[i];
      for (var yy = a.y - 3; yy <= a.y + 3; yy++) {
        for (var xx = a.x - 3; xx <= a.x + 3; xx++) {
          if (Math.hypot(xx - a.x, yy - a.y) > 3.2) continue;
          setTile(grid, xx, yy, ring);
        }
      }
      setTile(grid, a.x, a.y, 'LEGEND_ALTAR');
    }

    if (!hasCityAirship) {
      var p = spec.port;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setTile(grid, p.x + dx, p.y + dy, 'AIRSHIP_PLATFORM');
      setTile(grid, p.x, p.y, 'AIRSHIP_MAST');
      setTile(grid, p.x, p.y + 2, 'AIRSHIP_DOCK');
    }
  }

  var SIGN_OFFSET = { N: { x: 2, y: 0 }, S: { x: 2, y: 0 }, E: { x: 0, y: 2 }, W: { x: 0, y: 2 } };

  function buildSigns(spec, grid, cityDef) {
    var signs = [];
    function addSign(x, y, label, text) {
      setTile(grid, x, y, 'SIGN');
      signs.push({ x: x, y: y, label: label, text: text });
    }
    var sp = spec.spawn;
    addSign(sp.x + 2, sp.y, 'Panneau', 'Bienvenue dans ' + spec.name + ' — ' + capFirst(spec.theme) + '.');
    for (var i = 0; i < spec.gates.length; i++) {
      var g = spec.gates[i];
      var off = SIGN_OFFSET[g.edge] || { x: 2, y: 0 };
      addSign(g.x + off.x, g.y + off.y, 'Panneau', 'Vers ' + regionName(g.toRegion) + ' — ' + g.label);
    }
    if (cityDef && cityDef.gates && cityDef.gates[0]) {
      var cg = cityDef.gates[0];
      var sy = (cg.y - 2 >= 0) ? cg.y - 2 : cg.y + 2;
      addSign(cg.x, sy, 'Panneau', (cityDef.name || spec.name) + ' — Arène de type ' + capFirst(spec.arenaType) + '.');
    }
    return signs;
  }

  // ==========================================================================
  //  10. PNJ — au moins 10 par région dont 4 dresseurs (§9), en français,
  //      chaleureux. Chaque entrée est ancrée à un lieu connu (spawn, ville,
  //      une porte, un autel) puis « accrochée » à la tuile marchable la plus
  //      proche une fois le terrain généré : le contenu ne dépend jamais du
  //      hasard du relief.
  // ==========================================================================

  function anchorPoint(spec, anchor) {
    if (anchor === 'spawn') return spec.spawn;
    if (anchor === 'city') { var b = CITY_BOX[spec.id]; return { x: b.x + (b.w >> 1), y: b.y + (b.h >> 1) }; }
    if (anchor.indexOf('gate') === 0) { var gi = parseInt(anchor.slice(4), 10) || 0; return spec.gates[gi] || spec.gates[0]; }
    if (anchor.indexOf('altar') === 0) { var ai = parseInt(anchor.slice(5), 10) || 0; return spec.altars[ai] || spec.altars[0]; }
    if (anchor === 'port') return spec.port;
    return spec.spawn;
  }

  function walkableRaw(grid, x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    return WALKI[grid[y * W + x]] === 1;
  }

  /** Cherche en spirale la tuile marchable la plus proche — c'est ce qui
   *  garantit qu'un PNJ placé « à l'aveugle » finit toujours sur une case où
   *  le joueur peut réellement venir lui parler. */
  function nearestWalkable(grid, x, y, maxR) {
    maxR = maxR || 24;
    if (walkableRaw(grid, x, y)) return { x: x, y: y };
    for (var r = 1; r <= maxR; r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var nx = x + dx, ny = y + dy;
          if (nx < BORDER || ny < BORDER || nx >= W - BORDER || ny >= H - BORDER) continue;
          if (walkableRaw(grid, nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    var cx = Math.max(BORDER, Math.min(W - BORDER - 1, x));
    var cy = Math.max(BORDER, Math.min(H - BORDER - 1, y));
    return { x: cx, y: cy };
  }

  // ==========================================================================
  //  LES PNJ DE CHAQUE RÉGION — ET LA VRAIE TABLE DES DRESSEURS
  //
  //  ⚠️ C'EST ICI QUE VIVENT LES DRESSEURS QUE ROBIN RENCONTRE, nulle part
  //  ailleurs. `arenas3d.TRAINERS` existe, est joliment rempli… et n'est
  //  consommé par PERSONNE : `game3d.talkToNPC()` appelle `startTrainerBattle`
  //  avec le PNJ issu de `npcsOf()`, donc d'ici, et `makeTrainerBattle()`
  //  reconstruit l'équipe adverse depuis le `party` ci-dessous. Une correction
  //  d'équilibrage appliquée à arenas3d.TRAINERS ne change RIEN en jeu — c'est
  //  arrivé au chantier 2.5, voir CONTRACT2 §12.
  //
  //  `party: ['id']` — ces PNJ n'ont pas de niveau propre :
  //  `startTrainerBattle()` leur pose `def.recommendedLevel` (5 · 12 · 20 · 28
  //  · 36 · 45). Les plafonds du §12 sont donc respectés d'office.
  //
  //  FORMES ÉVOLUÉES à partir de Givre (chantier 2.5) : au Massif de Givre,
  //  Robin n'a plus une seule forme de base dans son équipe (les évolutions
  //  d'`evolve3d.js` tombent entre 16 et 36). Un dresseur Nv 45 qui envoyait
  //  encore une Nuagette de base offrait un examen déjà passé. Val, Sylve et
  //  Saphir gardent leurs formes de base, et c'est volontaire.
  //  PIÈGE DES IDENTIFIANTS : `evolve3d.js` concatène STRICTEMENT `base+suffixe`
  //  (Koronette -> `koronetteon`, le NOM affiché « Koronetton » n'est pas l'id ;
  //  Doudoune -> `doudouneon` nommé « Doudounon » ; Étincelo -> `etinceloix`
  //  nommé « Étincelix »). Un id inexistant ne lève AUCUNE erreur : la créature
  //  devient un repli générique de 48 PV. Vérifier chaque id contre
  //  `CHAIN_DATA` d'evolve3d.js, jamais de mémoire.
  // ==========================================================================
  var NPC_TEMPLATES = {
    val: [
      { id: 'garde', name: 'Garde Forestier Elian', anchor: 'spawn', dx: 4, dy: 1, dir: 'down', colorMap: { j: 'g', l: '6' }, accessory: 'hat-ranger',
        dialog: ["Bienvenue dans le Val d'Émeraude, petit dresseur !", "Reste près des hautes herbes, les créatures y sont nombreuses et amicales."] },
      { id: 'jardiniere', name: 'Jardinière Odile', anchor: 'altar0', dx: -3, dy: 3, dir: 'right', colorMap: { j: 'd', l: 'a' },
        dialog: ["Cette clairière est sacrée, on raconte qu'un cerf-forêt millénaire y veille.", "Approche doucement, et ouvre grand les yeux."] },
      { id: 'sage', name: 'Vieux Sage Mathis', anchor: 'city', dx: -10, dy: -6, dir: 'down', colorMap: { j: 'd', l: 'c' },
        dialog: ["Bourg-Émeraude est le cœur du Val.", "Notre arène est de type Plante : rien ne pousse aussi patiemment que la victoire."] },
      { id: 'enfant', name: 'Petite Iris', anchor: 'city', dx: 8, dy: 6, dir: 'left', colorMap: { j: 'j', l: '2' },
        dialog: ["Salut ! Tu es nouveau ?", "Moi je collectionne les fleurs... et un peu les créatures aussi, en fait !"] },
      { id: 'pecheur', name: 'Pêcheur Noan', anchor: 'altar4', dx: 2, dy: -3, dir: 'up', colorMap: { j: 'F', l: '9' }, accessory: 'hat-fisher',
        dialog: ["L'île au milieu du lac cache quelque chose de spécial.", "On dit qu'une lumière arc-en-ciel y danse la nuit."] },
      { id: 'marchande', name: 'Marchande Lucie', anchor: 'gate0', dx: -3, dy: 2, dir: 'down', colorMap: { j: 'g', l: '7' },
        dialog: ["Le Col des Brumes mène au Massif de Givre.", "Prends une potion avant de partir, il y fait un froid glacial !"] },
      { id: 't_foret', name: 'Dresseur Léo', anchor: 'spawn', dx: -6, dy: 5, dir: 'right', colorMap: { j: 'j', l: '6' }, accessory: 'hat-ranger',
        isTrainer: true, party: ['feuillou'], dialog: ["Je garde ce chemin ! Mon Feuillou ne perd jamais deux fois !"], dialogDefeated: ["Bravo... j'ai encore à apprendre de mes feuilles."] },
      { id: 't_lac', name: 'Dresseuse Ines', anchor: 'altar4', dx: -4, dy: 4, dir: 'left', colorMap: { j: 'F', l: 'a' }, accessory: 'hat-fisher',
        isTrainer: true, party: ['cygnik'], dialog: ["Mon Cygnik glisse plus vite que le vent !"], dialogDefeated: ["Incroyable... tu nages bien mieux que moi !"] },
      { id: 't_plaine', name: 'Dresseur Marco', anchor: 'city', dx: 14, dy: -4, dir: 'up', colorMap: { j: 'g', l: '3' },
        isTrainer: true, party: ['lapinou'], dialog: ["Mon Lapinou adore les défis ! Prêt à jouer ?"], dialogDefeated: ["Il court moins vite que ta victoire, dis donc !"] },
      { id: 't_village', name: 'Dresseuse Clara', anchor: 'gate1', dx: 3, dy: -3, dir: 'down', colorMap: { j: 'l', l: 'l' },
        isTrainer: true, party: ['miaouche'], dialog: ["Mon Miaouche est le plus mignon ET le plus fort !"], dialogDefeated: ["Tu as gagné... mais il reste adorable !"] },
    ],
    sylve: [
      { id: 'guide', name: 'Guide Jungle Théo', anchor: 'spawn', dx: 3, dy: 2, dir: 'down', colorMap: { j: 'g', l: '6' }, accessory: 'hat-ranger',
        dialog: ["La Sylve d'Ambre est dense, reste sur les pontons de boue tracés.", "Attention aux marécages, on s'y enlise vite !"] },
      { id: 'chamane', name: 'Chamane Yara', anchor: 'altar4', dx: -2, dy: 3, dir: 'right', colorMap: { j: 'd', l: '2' },
        dialog: ["Le marais des ombres cache Nyxaroth, le loup des ténèbres.", "Ne le dérange qu'avec respect."] },
      { id: 'batelier', name: 'Batelier Ossian', anchor: 'gate2', dx: -3, dy: 2, dir: 'up', colorMap: { j: 'F', l: '9' }, accessory: 'hat-sailor',
        dialog: ["Le Delta d'Ambre mène à la Côte de Saphir.", "Suis les pontons, l'eau salée n'est plus très loin."] },
      { id: 'exploratrice', name: 'Exploratrice Wina', anchor: 'city', dx: -12, dy: 5, dir: 'left', colorMap: { j: 'j', l: 'a' },
        dialog: ["Ambrelune est bâtie sur pilotis, magnifique non ?", "L'arène ici est de type Foudre : ça décoiffe !"] },
      { id: 'ecolier', name: 'Écolier Sam', anchor: 'city', dx: 9, dy: -4, dir: 'down', colorMap: { j: 'j', l: '3' },
        dialog: ["Les ruines envahies sont pleines de mousse et de secrets.", "J'ai vu un golem de glaise une fois, promis !"] },
      { id: 'herboriste', name: 'Herboriste Faune', anchor: 'altar1', dx: 2, dy: -2, dir: 'down', colorMap: { j: 'd', l: 'c' },
        dialog: ["La canopée étincelante scintille au lever du jour.", "Voltaris y chasse, dit-on, avec sa crinière électrique."] },
      { id: 't_jungle', name: 'Dresseur Enzo', anchor: 'spawn', dx: -5, dy: 6, dir: 'right', colorMap: { j: 'j', l: '6' },
        isTrainer: true, party: ['papillon'], dialog: ["Mon Papillon vole plus vite que tes réflexes !"], dialogDefeated: ["Wow... tu as l'œil du chasseur !"] },
      { id: 't_marais', name: 'Dresseuse Maya', anchor: 'altar3', dx: 3, dy: -3, dir: 'left', colorMap: { j: 'F', l: 'a' },
        isTrainer: true, party: ['crabilino'], dialog: ["Mon Crabilino pince fort dans la glaise !"], dialogDefeated: ["Aïe... bien joué, dresseur !"] },
      { id: 't_pont', name: 'Dresseur Guy', anchor: 'gate0', dx: 3, dy: 3, dir: 'up', colorMap: { j: 'g', l: '7' },
        isTrainer: true, party: ['glanou'], dialog: ["Ce pont est à moi tant que tu ne m'as pas battu !"], dialogDefeated: ["File, le pont est libre !"] },
      { id: 't_ambre', name: 'Dresseuse Nao', anchor: 'city', dx: -8, dy: 10, dir: 'up', colorMap: { j: 'l', l: 'l' },
        isTrainer: true, party: ['hibouche'], dialog: ["Mon Hibouché voit dans le noir, tu ne m'échapperas pas !"], dialogDefeated: ["Bien vu... littéralement !"] },
    ],
    saphir: [
      { id: 'marin', name: 'Marin Théo', anchor: 'spawn', dx: 2, dy: 2, dir: 'down', colorMap: { j: 'F', l: 'c' }, accessory: 'hat-sailor',
        dialog: ["Port-Saphir sent bon le sel et l'aventure !", "Marche dans les vagues pour croiser des créatures d'eau."] },
      { id: 'phare', name: 'Gardien du Phare Igor', anchor: 'city', dx: 8, dy: 19, dir: 'up', colorMap: { j: 'd', l: '9' },
        dialog: ["Le phare guide les bateaux depuis cent ans.", "Par nuit claire, on voit scintiller les récifs au loin."] },
      { id: 'plongeuse', name: 'Plongeuse Alia', anchor: 'altar0', dx: 2, dy: -2, dir: 'down', colorMap: { j: 'l', l: 'a' },
        dialog: ["L'Île du Léviathan est gardée par Abyssalor.", "Personne n'a encore osé nager jusqu'au bout du récif."] },
      { id: 'commercante', name: 'Commerçante Yasmine', anchor: 'city', dx: -14, dy: -2, dir: 'right', colorMap: { j: 'g', l: '7' },
        dialog: ["Nos poissons sont les plus frais de toute la côte !", "L'arène de Port-Saphir est de type Eau, bien sûr."] },
      { id: 'enfant_plage', name: 'Petit Timéo', anchor: 'gate1', dx: -2, dy: 3, dir: 'down', colorMap: { j: 'j', l: '3' },
        dialog: ["Là-haut, c'est la Côte de Cendre, vers Fournaise.", "Il paraît qu'il y fait une chaleur infernale !"] },
      { id: 'capitaine', name: 'Capitaine Rosa', anchor: 'gate0', dx: 3, dy: 0, dir: 'right', colorMap: { j: 'F', l: '2' }, accessory: 'hat-sailor',
        dialog: ["Le Delta d'Ambre est juste à l'ouest.", "Bon vent, jeune dresseur !"] },
      { id: 't_plage', name: 'Surfeur Éric', anchor: 'spawn', dx: -4, dy: 5, dir: 'up', colorMap: { j: 'j', l: 'c' }, accessory: 'hat-sailor',
        isTrainer: true, party: ['bullini'], dialog: ["Les vagues m'ont tout appris ! Mon Bullini va t'éclabousser !"], dialogDefeated: ["Wahou, t'es increvable !"] },
      { id: 't_recif', name: 'Dresseuse Coralie', anchor: 'altar2', dx: -3, dy: 3, dir: 'left', colorMap: { j: 'd', l: 'a' },
        isTrainer: true, party: ['coralou'], dialog: ["Mon Coralou connaît chaque récif par cœur !"], dialogDefeated: ["Belle plongée dans la victoire !"] },
      { id: 't_falaise', name: 'Grimpeuse Nora', anchor: 'gate0', dx: -4, dy: -3, dir: 'down', colorMap: { j: 'd', l: '2' },
        isTrainer: true, party: ['etoilamer'], dialog: ["Ces falaises n'ont aucun secret pour moi !"], dialogDefeated: ["Tu grimpes plus haut que moi, bravo !"] },
      { id: 't_criee', name: 'Poissonnier Dan', anchor: 'city', dx: -16, dy: 6, dir: 'right', colorMap: { j: 'g', l: '9' },
        isTrainer: true, party: ['meduzia'], dialog: ["Ma Méduzia flotte, pique, et gagne !"], dialogDefeated: ["Aïe ! Bien joué, jeune dresseur."] },
    ],
    givre: [
      { id: 'guide_montagne', name: 'Guide Igor', anchor: 'spawn', dx: 2, dy: 2, dir: 'down', colorMap: { j: 'F', l: '9' },
        dialog: ["Le Massif de Givre est magnifique mais glacial.", "Couvre-toi, et suis les chemins de pierre déneigés."] },
      { id: 'ermite', name: 'Ermite Solveig', anchor: 'altar4', dx: 2, dy: -2, dir: 'down', colorMap: { j: 'd', l: 'c' },
        dialog: ["La Grotte aux Prismes chante quand le vent souffle.", "Cristallia y façonne des bois de cristal, dit-on."] },
      { id: 'maire', name: 'Maire Torvald', anchor: 'city', dx: -4, dy: 12, dir: 'up', colorMap: { j: 'd', l: '2' },
        dialog: ["Cimefroide résiste à l'hiver depuis des siècles.", "Notre arène de type Glace refroidit les plus téméraires."] },
      { id: 'skieur', name: 'Skieuse Elke', anchor: 'gate0', dx: 3, dy: -3, dir: 'up', colorMap: { j: 'l', l: 'a' },
        dialog: ["Le Col des Brumes redescend vers le Val d'Émeraude.", "C'est plus chaud là-bas, tu vas adorer !"] },
      { id: 'forgeron', name: 'Forgeron Bjorn', anchor: 'city', dx: 10, dy: -6, dir: 'left', colorMap: { j: 'g', l: '7' },
        dialog: ["Mes outils sont forgés dans la glace éternelle.", "Une lame qui ne fond jamais, ça a son charme."] },
      { id: 'enfant_neige', name: 'Petite Frigg', anchor: 'city', dx: -10, dy: -6, dir: 'right', colorMap: { j: 'j', l: 'l' },
        dialog: ["On fait des bonhommes de neige toute l'année ici !", "Tu veux voir ma collection de flocons ?"] },
      { id: 't_pic', name: 'Grimpeur Axel', anchor: 'spawn', dx: -4, dy: 5, dir: 'down', colorMap: { j: 'F', l: '9' },
        isTrainer: true, party: ['pandoukion'], dialog: ["Pour passer, il faut battre mon Pandoukion !"], dialogDefeated: ["Tu grimpes haut, dresseur !"] },
      { id: 't_glacier', name: 'Dresseuse Ylva', anchor: 'altar0', dx: -3, dy: 3, dir: 'left', colorMap: { j: 'd', l: '2' },
        isTrainer: true, party: ['glydrakon'], dialog: ["Mon Glydrakon plane sur les vents glacés !"], dialogDefeated: ["Impressionnant... comme le vent du sommet."] },
      { id: 't_lac_gele', name: 'Dresseur Finn', anchor: 'gate1', dx: -3, dy: 2, dir: 'left', colorMap: { j: 'g', l: '6' },
        isTrainer: true, party: ['doudouneon'], dialog: ["Mon Doudounon est tout doux mais très costaud !"], dialogDefeated: ["Doux mais costaud, tu as raison !"] },
      { id: 't_grotte', name: 'Dresseuse Siri', anchor: 'altar4', dx: -2, dy: 2, dir: 'up', colorMap: { j: 'l', l: 'a' },
        isTrainer: true, party: ['stellinion'], dialog: ["Mon Stellinion brille dans le noir des grottes !"], dialogDefeated: ["Tu brilles encore plus, bravo !"] },
    ],
    braise: [
      { id: 'guide_volcan', name: 'Guide Ember', anchor: 'spawn', dx: 2, dy: 2, dir: 'down', colorMap: { j: 'd', l: '3' },
        dialog: ["Bienvenue dans la Caldeira de Braise !", "Ne marche jamais sur la lave, même en courant."] },
      { id: 'forgeronne', name: 'Forgeronne Sarah', anchor: 'city', dx: -4, dy: 10, dir: 'up', colorMap: { j: 'g', l: '7' },
        dialog: ["Fournaise forge les meilleures armures du royaume.", "Notre arène est de type Feu, évidemment !"] },
      { id: 'nomade', name: 'Nomade Kaled', anchor: 'gate1', dx: 2, dy: -3, dir: 'up', colorMap: { j: 'F', l: '9' },
        dialog: ["La Côte de Cendre mène jusqu'à Port-Saphir.", "Prends de l'eau, la traversée est longue et sèche."] },
      { id: 'geologue', name: 'Géologue Petra', anchor: 'altar4', dx: 2, dy: -2, dir: 'down', colorMap: { j: 'd', l: '2' },
        dialog: ["Le champ d'obsidienne coupe comme du verre.", "Obsidion y rôde, silencieux comme une ombre noire."] },
      { id: 'enfant_desert', name: 'Petit Rami', anchor: 'gate0', dx: -2, dy: 3, dir: 'right', colorMap: { j: 'j', l: 'l' },
        dialog: ["J'ai trouvé des ossements bizarres près des dunes !", "Ma mère dit de ne pas les toucher."] },
      { id: 'marchand_epices', name: 'Marchand Nassim', anchor: 'city', dx: 10, dy: -4, dir: 'left', colorMap: { j: 'g', l: 'a' },
        dialog: ["Mes épices viennent des cendres les plus fines.", "Un peu de piquant ne fait jamais de mal !"] },
      { id: 't_lave', name: 'Dresseuse Nora', anchor: 'spawn', dx: -5, dy: 5, dir: 'down', colorMap: { j: 'd', l: '2' },
        isTrainer: true, party: ['flamdrakix'], dialog: ["Mon Flamdrakix est la terreur de ces terres !"], dialogDefeated: ["Je n'y crois pas... tu es remarquable !"] },
      { id: 't_dune', name: 'Dresseur Aziz', anchor: 'altar3', dx: -3, dy: -3, dir: 'left', colorMap: { j: 'F', l: '9' },
        isTrainer: true, party: ['pandoukion'], dialog: ["Mon Pandoukion creuse les dunes en un instant !"], dialogDefeated: ["Bien creusé... dans ma défense !"] },
      { id: 't_cendre', name: 'Dresseuse Lina', anchor: 'gate1', dx: -3, dy: 3, dir: 'up', colorMap: { j: 'l', l: 'a' },
        isTrainer: true, party: ['etinceloix'], dialog: ["Mon Étincelix crépite comme les braises !"], dialogDefeated: ["Ça, c'était électrique !"] },
      { id: 't_obsidienne', name: 'Dresseur Malo', anchor: 'altar4', dx: -2, dy: 2, dir: 'right', colorMap: { j: 'd', l: 'l' },
        isTrainer: true, party: ['tonnedrakon'], dialog: ["Mon Tonnedrakon fend l'obsidienne d'un cri !"], dialogDefeated: ["Tu résistes à tout, bravo !"] },
    ],
    aurore: [
      { id: 'guide_ciel', name: 'Guide Séraphine', anchor: 'spawn', dx: 2, dy: 2, dir: 'down', colorMap: { j: 'l', l: 'a' },
        dialog: ["Bienvenue sur le Plateau d'Aurore, le toit du monde.", "Chaque ruine ici raconte une légende oubliée."] },
      { id: 'astronome', name: 'Astronome Elian', anchor: 'city', dx: 6, dy: -14, dir: 'down', colorMap: { j: 'd', l: 'c' },
        dialog: ["L'observatoire d'Aurore-Cité voit jusqu'aux étoiles.", "Notre arène de type Lumière illumine les nuits de combat."] },
      { id: 'archeologue', name: 'Archéologue Nadia', anchor: 'altar0', dx: 2, dy: -2, dir: 'down', colorMap: { j: 'g', l: '7' },
        dialog: ["Le Cercle des Menhirs est plus ancien que la cité elle-même.", "Monolithe veille ici depuis des temps immémoriaux."] },
      { id: 'moine', name: 'Moine Elyas', anchor: 'gate1', dx: 2, dy: -3, dir: 'up', colorMap: { j: 'd', l: '2' },
        dialog: ["L'Escalier des Anciens descend vers la Sylve d'Ambre.", "Marche avec respect, ces marches sont sacrées."] },
      { id: 'gardienne_faille', name: 'Gardienne Yun', anchor: 'gate2', dx: -3, dy: 0, dir: 'left', colorMap: { j: 'l', l: 'l' },
        dialog: ["La Faille du Couchant plonge vers la Caldeira de Braise.", "Attention à la chaleur en bas, c'est un choc !"] },
      { id: 'enfant_etoiles', name: 'Petite Luna', anchor: 'city', dx: -10, dy: 4, dir: 'right', colorMap: { j: 'j', l: 'a' },
        dialog: ["Je compte les étoiles filantes chaque soir.", "On dit que Vortexis en fait tomber exprès pour nous !"] },
      { id: 't_menhir', name: 'Championne Zara', anchor: 'spawn', dx: -4, dy: 5, dir: 'down', colorMap: { j: 'd', l: '7' },
        isTrainer: true, party: ['tonnedrakon'], dialog: ["Je suis la gardienne de ce plateau ! Affronte-moi !"], dialogDefeated: ["Extraordinaire... tu es digne de ces cieux !"] },
      { id: 't_ruine', name: 'Dresseur Tao', anchor: 'altar2', dx: -3, dy: 3, dir: 'left', colorMap: { j: 'g', l: '6' },
        isTrainer: true, party: ['koronetteon'], dialog: ["Ma Koronetton porte la lumière des ruines !"], dialogDefeated: ["Tu brilles autant qu'elle, bravo !"] },
      { id: 't_nuages', name: 'Dresseuse Aube', anchor: 'gate0', dx: 3, dy: 2, dir: 'right', colorMap: { j: 'l', l: 'a' },
        isTrainer: true, party: ['nuagette'], dialog: ["Ma Nuagette flotte plus haut que tes espoirs !"], dialogDefeated: ["Tu redescends sur terre en vainqueur !"] },
      { id: 't_observatoire', name: 'Dresseur Milo', anchor: 'city', dx: 12, dy: 6, dir: 'left', colorMap: { j: 'd', l: '9' },
        isTrainer: true, party: ['stellinion'], dialog: ["Mon Stellinion a compté chaque étoile du ciel !"], dialogDefeated: ["Un vrai combat stellaire, bravo !"] },
    ],
  };

  function buildNpcs(spec, grid) {
    var raws = NPC_TEMPLATES[spec.id] || [];
    var out = [];
    for (var i = 0; i < raws.length; i++) {
      var t = raws[i];
      var base = anchorPoint(spec, t.anchor);
      var p = nearestWalkable(grid, base.x + (t.dx || 0), base.y + (t.dy || 0), 26);
      var npc = {
        id: spec.id + '_' + t.id, name: t.name, x: p.x, y: p.y, dir: t.dir || 'down',
        colorMap: t.colorMap || {}, accessory: t.accessory || null,
        dialog: t.dialog, region: spec.id,
      };
      if (t.isTrainer) { npc.isTrainer = true; npc.party = t.party; npc.dialogDefeated = t.dialogDefeated; }
      out.push(npc);
    }

    // Le champion d'arène (fourni par arenas3d.js — §9, dernier de la liste).
    var arenasApi = (R && typeof R.get === 'function') ? R.get('arenas') : null;
    if (arenasApi && typeof arenasApi.championNpc === 'function') {
      try {
        var champ = arenasApi.championNpc(spec.id);
        if (champ) {
          if (champ.x == null || champ.y == null) {
            var b = CITY_BOX[spec.id];
            champ.x = b.x + (b.w >> 1); champ.y = b.y + 3;
          }
          var pc = nearestWalkable(grid, champ.x, champ.y, 26);
          champ.x = pc.x; champ.y = pc.y;
          out.push(champ);
        }
      } catch (e) { warnStep('champion (arenas3d)', spec.id, e); }
    }
    return out;
  }

  // ==========================================================================
  //  11. CONNECTIVITÉ GARANTIE — LA RÈGLE D'OR DU MODULE
  //      Un parcours en largeur depuis le spawn ; tout ce qui n'est pas
  //      atteint est relié de force par le chemin le moins coûteux (0-1 BFS) :
  //      on emprunte les tuiles déjà marchables gratuitement, et on ne
  //      « paie » qu'en traversant un obstacle — c'est ce qui produit des
  //      routes qui suivent le terrain plutôt que de le charcuter en ligne
  //      droite, tout en garantissant TOUJOURS une solution.
  // ==========================================================================

  // Les quatre fonctions de parcours ci-dessous évitent délibérément toute
  // allocation dans la boucle chaude (pas de littéral de tableau par nœud
  // visité) : avec jusqu'à 86 016 nœuds et jusqu'à une vingtaine de parcours
  // par région, un tableau alloué par nœud se chiffrait en dizaines de milliers
  // d'allocations superflues — mesurable sur le budget de 150 ms (§9).
  function computeReachable(grid, sx, sy) {
    var seen = new Uint8Array(W * H);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return seen;
    var n = W * H;
    var qx = new Int32Array(n), qy = new Int32Array(n);
    var qn = 0;
    seen[sy * W + sx] = 1; qx[qn] = sx; qy[qn] = sy; qn++;
    var qi = 0, cx, cy, nx, ny, ni;
    while (qi < qn) {
      cx = qx[qi]; cy = qy[qi]; qi++;
      nx = cx + 1; if (nx < W) { ni = cy * W + nx; if (!seen[ni] && WALKI[grid[ni]] === 1) { seen[ni] = 1; qx[qn] = nx; qy[qn] = cy; qn++; } }
      nx = cx - 1; if (nx >= 0) { ni = cy * W + nx; if (!seen[ni] && WALKI[grid[ni]] === 1) { seen[ni] = 1; qx[qn] = nx; qy[qn] = cy; qn++; } }
      ny = cy + 1; if (ny < H) { ni = ny * W + cx; if (!seen[ni] && WALKI[grid[ni]] === 1) { seen[ni] = 1; qx[qn] = cx; qy[qn] = ny; qn++; } }
      ny = cy - 1; if (ny >= 0) { ni = ny * W + cx; if (!seen[ni] && WALKI[grid[ni]] === 1) { seen[ni] = 1; qx[qn] = cx; qy[qn] = ny; qn++; } }
    }
    return seen;
  }

  /** Relie (tx,ty) à l'ensemble déjà connecté `seen`, en creusant le chemin
   *  le moins coûteux si besoin (0-1 BFS). Met `seen` à jour en place. */
  /** `buf` regroupe les tampons réutilisés d'un appel à l'autre (§9 : budget
   *  de 150 ms). Ré-allouer et remettre à zéro des `Int32Array` de 86 016
   *  cases à CHAQUE porte/autel/PNJ (jusqu'à une vingtaine de fois par région)
   *  était la seconde plus grosse dépense du module. Le compteur de version
   *  (`buf.ver`) simule une remise à zéro en O(1) : une case n'est « connue »
   *  que si sa marque de version correspond à l'appel en cours. */
  function makeCarveBuffers() {
    var n = W * H;
    return {
      distVer: new Int32Array(n), distVal: new Int32Array(n), prev: new Int32Array(n),
      dq: new Int32Array(n * 4 + 16), ver: 0,
    };
  }

  function carveTo(spec, grid, seen, tx, ty, buf) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return;
    var ti = ty * W + tx;
    if (seen[ti]) return;

    var n = W * H;
    buf.ver++;
    var ver = buf.ver;
    var distVer = buf.distVer, distVal = buf.distVal, prev = buf.prev, dq = buf.dq;
    var cap = dq.length, mid = cap >> 1, head = mid, tail = mid;

    for (var i = 0; i < n; i++) {
      if (seen[i]) { distVer[i] = ver; distVal[i] = 0; dq[tail++] = i; }
    }
    if (tail === head) { distVer[ti] = ver; distVal[ti] = 0; dq[tail++] = ti; }   // garde-fou

    var found = false;
    while (head < tail) {
      var c = dq[head++];
      var cd = distVal[c];
      if (c === ti) { found = true; break; }
      var cx = c % W, cy = (c / W) | 0;
      var nx, ny, ni, w, nd, known;

      nx = cx + 1;
      if (nx < W) {
        ni = cy * W + nx; w = (WALKI[grid[ni]] === 1) ? 0 : 1; nd = cd + w;
        known = (distVer[ni] === ver) ? distVal[ni] : 0x3fffffff;
        if (nd < known) { distVer[ni] = ver; distVal[ni] = nd; prev[ni] = c; if (w === 0) { dq[--head] = ni; } else { dq[tail++] = ni; } }
      }
      nx = cx - 1;
      if (nx >= 0) {
        ni = cy * W + nx; w = (WALKI[grid[ni]] === 1) ? 0 : 1; nd = cd + w;
        known = (distVer[ni] === ver) ? distVal[ni] : 0x3fffffff;
        if (nd < known) { distVer[ni] = ver; distVal[ni] = nd; prev[ni] = c; if (w === 0) { dq[--head] = ni; } else { dq[tail++] = ni; } }
      }
      ny = cy + 1;
      if (ny < H) {
        ni = ny * W + cx; w = (WALKI[grid[ni]] === 1) ? 0 : 1; nd = cd + w;
        known = (distVer[ni] === ver) ? distVal[ni] : 0x3fffffff;
        if (nd < known) { distVer[ni] = ver; distVal[ni] = nd; prev[ni] = c; if (w === 0) { dq[--head] = ni; } else { dq[tail++] = ni; } }
      }
      ny = cy - 1;
      if (ny >= 0) {
        ni = ny * W + cx; w = (WALKI[grid[ni]] === 1) ? 0 : 1; nd = cd + w;
        known = (distVer[ni] === ver) ? distVal[ni] : 0x3fffffff;
        if (nd < known) { distVer[ni] = ver; distVal[ni] = nd; prev[ni] = c; if (w === 0) { dq[--head] = ni; } else { dq[tail++] = ni; } }
      }
    }
    var tiDist = (distVer[ti] === ver) ? distVal[ti] : 0x3fffffff;
    if (!found && tiDist >= 0x3fffffff) return;   // ne devrait jamais arriver (grille pleine)

    // Creusement : on revient de la cible vers la source, en posant une route
    // (ou un pont, sur l'eau/la lave/la glace) sur chaque case non marchable.
    var c2 = ti, guard = 0;
    while (c2 !== -1 && guard++ < n) {
      if (!seen[c2]) {
        if (WALKI[grid[c2]] !== 1) {
          var replacement = isWaterish(NAMES[grid[c2]]) ? spec.bridge : spec.road;
          grid[c2] = idx(replacement);
        }
        seen[c2] = 1;
      }
      if (distVal[c2] === 0 && distVer[c2] === ver) break;
      c2 = prev[c2];
    }
  }

  function ensureConnectivity(spec, grid, cityDef, npcs, airshipLoc) {
    var sp = spec.spawn;
    if (WALKI[grid[sp.y * W + sp.x]] !== 1) grid[sp.y * W + sp.x] = idx(spec.road);
    var seen = computeReachable(grid, sp.x, sp.y);
    var buf = makeCarveBuffers();

    var targets = [];
    if (cityDef) {
      if (cityDef.gates) for (var i = 0; i < cityDef.gates.length; i++) targets.push(cityDef.gates[i]);
      if (cityDef.plaza) targets.push({ x: cityDef.plaza.x + ((cityDef.plaza.w || 1) >> 1), y: cityDef.plaza.y + ((cityDef.plaza.h || 1) >> 1) });
      if (cityDef.arena) targets.push(cityDef.arena);
      if (cityDef.heal) targets.push(cityDef.heal);
      if (cityDef.shop) targets.push(cityDef.shop);
      if (cityDef.castle) targets.push(cityDef.castle);
      if (cityDef.fountain) targets.push(cityDef.fountain);
    }
    for (var g = 0; g < spec.gates.length; g++) targets.push({ x: spec.gates[g].x, y: spec.gates[g].y });
    for (var a = 0; a < spec.altars.length; a++) targets.push({ x: spec.altars[a].x, y: spec.altars[a].y + 2 });
    targets.push(airshipLoc || { x: spec.port.x, y: spec.port.y + 2 });
    for (var n = 0; n < npcs.length; n++) targets.push({ x: npcs[n].x, y: npcs[n].y });

    for (var t = 0; t < targets.length; t++) {
      var tg = targets[t];
      if (!tg || tg.x == null || tg.y == null) continue;
      carveTo(spec, grid, seen, tg.x, tg.y, buf);
    }
  }

  // ==========================================================================
  //  12. GÉNÉRATION D'UNE RÉGION — assemble tout ce qui précède, avec un
  //      repli à chaque étape (règle n°7 du contrat : jamais d'exception).
  // ==========================================================================

  function warnStep(step, id, e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[regions3d] ' + id + ' — étape « ' + step + ' » a échoué :', e && e.message ? e.message : e);
    }
  }

  /** Filet de sécurité ultime : une carte plate, entièrement marchable, avec
   *  juste portails/autels/port aérien posés. Ne peut structurellement pas
   *  laisser le joueur coincé. N'est utilisé que si generateRegion() explose
   *  malgré tous ses propres try/catch internes. */
  function generateFallbackFlat(spec) {
    var grid = new Uint16Array(W * H);
    var base = idx('PLAIN');
    for (var i = 0; i < grid.length; i++) grid[i] = base;
    var b = idx(spec.border);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        if (x < BORDER || y < BORDER || x >= W - BORDER || y >= H - BORDER) grid[y * W + x] = b;
      }
    }
    for (var g = 0; g < spec.gates.length; g++) setTile(grid, spec.gates[g].x, spec.gates[g].y, 'PORTAL');
    for (var a = 0; a < spec.altars.length; a++) setTile(grid, spec.altars[a].x, spec.altars[a].y, 'LEGEND_ALTAR');
    setTile(grid, spec.port.x, spec.port.y, 'AIRSHIP_MAST');
    setTile(grid, spec.port.x, spec.port.y + 2, 'AIRSHIP_DOCK');
    var airshipFallback = { x: spec.port.x, y: spec.port.y + 2, name: spec.port.name };
    return { grid: grid, cityDef: null, npcs: [], signs: [], airship: airshipFallback, genMs: 0 };
  }

  function generateRegion(spec) {
    var t0 = now();
    var grid = new Uint16Array(W * H);

    try { paintTerrain(spec, grid); } catch (e) { warnStep('relief', spec.id, e); }
    paintBorder(spec, grid);

    var cityDef = null;
    try { cityDef = stampCity(spec, grid); } catch (e) { warnStep('ville', spec.id, e); }

    // cities3d.js construit désormais son propre port aérien, intégré au
    // rempart (§17 bis) : on s'en sert s'il existe plutôt que de planter une
    // seconde plateforme isolée à la coordonnée statique de secours (SPECS).
    var cityAirship = (cityDef && cityDef.airship && typeof cityDef.airship.x === 'number') ? cityDef.airship : null;
    var airshipLoc = cityAirship
      ? { x: cityAirship.x, y: cityAirship.y, name: cityAirship.name || spec.port.name }
      : { x: spec.port.x, y: spec.port.y + 2, name: spec.port.name };

    var signs = [];
    try {
      stampFeatures(spec, grid, !!cityAirship);
      signs = buildSigns(spec, grid, cityDef);
    } catch (e) { warnStep('décors (autels/port aérien/panneaux)', spec.id, e); }

    var npcs = [];
    try { npcs = buildNpcs(spec, grid); } catch (e) { warnStep('PNJ', spec.id, e); }

    try { ensureConnectivity(spec, grid, cityDef, npcs, airshipLoc); } catch (e) { warnStep('connectivité', spec.id, e); }

    return { grid: grid, cityDef: cityDef, npcs: npcs, signs: signs, airship: airshipLoc, genMs: now() - t0 };
  }

  // ==========================================================================
  //  13. CACHE — au plus 2 régions gardées en mémoire (LRU simple)
  // ==========================================================================

  var CACHE = {};
  var CACHE_ORDER = [];

  function touchCache(id) {
    var at = CACHE_ORDER.indexOf(id);
    if (at >= 0) CACHE_ORDER.splice(at, 1);
    CACHE_ORDER.push(id);
    while (CACHE_ORDER.length > 2) {
      var old = CACHE_ORDER.shift();
      if (old !== id) delete CACHE[old];
    }
  }

  function ensureGenerated(id) {
    var spec = SPEC_BY_ID[id];
    if (!spec) return null;
    if (CACHE[id]) { touchCache(id); return CACHE[id]; }
    var result;
    try { result = generateRegion(spec); }
    catch (e) { warnStep('génération complète', id, e); result = generateFallbackFlat(spec); }
    CACHE[id] = result;
    touchCache(id);
    var rd = REGION_BY_ID[id];
    if (rd) rd.city = result.cityDef;   // §9 : « rempli au premier chargement »
    return result;
  }

  // ==========================================================================
  //  14. ÉTAT ACTIF ET API PUBLIQUE
  // ==========================================================================

  var activeIdValue = null;
  var activeSpec = null;
  var activeGrid = null;
  var activeNpcs = [];
  var activeSigns = [];
  var activeAirship = null;
  var loadListeners = [];

  function load(id) {
    var spec = SPEC_BY_ID[id];
    if (!spec) return null;
    var entry = ensureGenerated(id);
    if (!entry) return null;

    activeIdValue = id;
    activeSpec = spec;
    activeGrid = entry.grid;
    activeNpcs = entry.npcs;
    activeSigns = entry.signs;
    activeAirship = entry.airship || spec.airship;

    var airshipApi = (R && typeof R.get === 'function') ? R.get('airship') : null;
    if (airshipApi && typeof airshipApi.registerPort === 'function') {
      try { airshipApi.registerPort(id, activeAirship.x, activeAirship.y, activeAirship.name); }
      catch (e) { warnStep('registerPort (airship3d)', id, e); }
    }

    var rd = REGION_BY_ID[id];
    // §9 : « rempli au premier chargement » — comme `city`, on précise la
    // position réelle du port aérien une fois la ville (et son propre port,
    // désormais construit par cities3d.js) effectivement générée.
    if (rd && entry.airship) {
      rd.airship = { x: entry.airship.x, y: entry.airship.y, dockX: entry.airship.x, dockY: entry.airship.y, name: entry.airship.name };
    }
    for (var i = 0; i < loadListeners.length; i++) {
      try { loadListeners[i](rd); } catch (e) { warnStep('onLoad listener', id, e); }
    }
    return rd;
  }

  function activeIdFn() { return activeIdValue; }
  function activeFn() { return activeIdValue ? REGION_BY_ID[activeIdValue] : null; }

  function tileAt(x, y) {
    if (!activeSpec) return 'VOID';
    if (!activeGrid || x < 0 || y < 0 || x >= W || y >= H) return activeSpec.border;
    return NAMES[activeGrid[y * W + x]];
  }
  function isWalkableFn(x, y) {
    if (!activeGrid || x < 0 || y < 0 || x >= W || y >= H) return false;
    return WALKI[activeGrid[y * W + x]] === 1;
  }
  function isEncounterFn(x, y) {
    if (!activeGrid || x < 0 || y < 0 || x >= W || y >= H) return false;
    return ENCI[activeGrid[y * W + x]] === 1;
  }
  function biomeAtFn(x, y) {
    if (!activeGrid || x < 0 || y < 0 || x >= W || y >= H) return 'plain';
    return BIOMEI[activeGrid[y * W + x]];
  }
  function labelOfFn(biome) { return BIOME_LABELS[biome] || biome; }

  function gateAt(x, y) {
    if (!activeSpec) return null;
    for (var i = 0; i < activeSpec.gates.length; i++) {
      var g = activeSpec.gates[i];
      if (g.x === x && g.y === y) return { toRegion: g.toRegion, toX: g.toX, toY: g.toY, label: g.label };
    }
    return null;
  }

  function poiAt(x, y) {
    if (!activeSpec) return null;
    var i;
    for (i = 0; i < activeSpec.gates.length; i++) {
      var g = activeSpec.gates[i];
      if (g.x === x && g.y === y) {
        return { kind: 'portal', label: g.label, x: x, y: y, regionId: activeSpec.id, data: { toRegion: g.toRegion, toX: g.toX, toY: g.toY } };
      }
    }
    for (i = 0; i < activeSpec.altars.length; i++) {
      var a = activeSpec.altars[i];
      if (x === a.x && y === a.y) {
        return { kind: 'legend', label: a.label, x: a.x, y: a.y, regionId: activeSpec.id, data: { legendId: a.id } };
      }
    }
    var p = activeAirship;
    if (p && p.x === x && p.y === y) {
      return { kind: 'landmark', label: p.name, x: p.x, y: p.y, regionId: activeSpec.id, data: { entry: 'airship' } };
    }
    for (i = 0; i < activeSigns.length; i++) {
      var s = activeSigns[i];
      if (s.x === x && s.y === y) return { kind: 'sign', label: s.label, x: s.x, y: s.y, regionId: activeSpec.id, data: { text: s.text } };
    }
    var api = citiesApi();
    if (api && typeof api.poiAt === 'function') {
      try { var cp = api.poiAt(activeSpec.id, x, y); if (cp) return cp; } catch (e) { /* repli silencieux : cities3d est optionnel */ }
    }
    return null;
  }

  function npcsOf(id) {
    var entry = ensureGenerated(id);
    return entry ? entry.npcs.slice() : [];
  }

  function spawnOf(id) {
    var r = get(id);
    return r ? { x: r.spawn.x, y: r.spawn.y } : { x: 24, y: 30 };
  }

  function onLoad(fn) { if (typeof fn === 'function') loadListeners.push(fn); }

  function minimap(id, canvas) {
    if (typeof document === 'undefined' || !canvas || typeof canvas.getContext !== 'function') return;
    var entry = ensureGenerated(id);
    if (!entry) return;
    var ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    var cw = canvas.width || 256, ch = canvas.height || 150;
    try {
      var img = ctx2d.createImageData(cw, ch);
      var data = img.data;
      var grid = entry.grid;
      for (var py = 0; py < ch; py++) {
        for (var px = 0; px < cw; px++) {
          var sx = (px / cw * W) | 0, sy = (py / ch * H) | 0;
          var ti = grid[sy * W + sx];
          var col = COLI[ti] || COLI[0];
          var o = (py * cw + px) * 4;
          data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
        }
      }
      ctx2d.putImageData(img, 0, 0);

      var spec = SPEC_BY_ID[id];
      if (spec) {
        var dot = function (x, y, color, r) {
          var qx = (x / W) * cw, qy = (y / H) * ch;
          ctx2d.fillStyle = color;
          ctx2d.beginPath(); ctx2d.arc(qx, qy, r || 2, 0, Math.PI * 2); ctx2d.fill();
        };
        var i;
        for (i = 0; i < spec.gates.length; i++) dot(spec.gates[i].x, spec.gates[i].y, '#ffe066', 2.5);
        for (i = 0; i < spec.altars.length; i++) dot(spec.altars[i].x, spec.altars[i].y, '#7a5cbf', 2);
        var portDot = entry.airship || spec.port;
        dot(portDot.x, portDot.y, '#41a6f6', 2.5);
        var b = CITY_BOX[id];
        if (b) dot(b.x + b.w / 2, b.y + b.h / 2, '#ffffff', 3);
      }
    } catch (e) { warnStep('minimap', id, e); }
  }

  // ==========================================================================
  //  15. ENREGISTREMENT — signature EXACTE du contrat (§9)
  // ==========================================================================

  var API = {
    REGIONS: REGIONS,
    list: list,
    get: get,
    load: load,
    activeId: activeIdFn,
    active: activeFn,
    tileAt: tileAt,
    isWalkable: isWalkableFn,
    isEncounter: isEncounterFn,
    biomeAt: biomeAtFn,
    labelOf: labelOfFn,
    gateAt: gateAt,
    poiAt: poiAt,
    npcsOf: npcsOf,
    spawnOf: spawnOf,
    onLoad: onLoad,
    minimap: minimap,
  };
  Object.defineProperty(API, 'W', { get: function () { return W; }, enumerable: true });
  Object.defineProperty(API, 'H', { get: function () { return H; }, enumerable: true });

  try {
    if (R && typeof R.register === 'function') R.register('regions', API);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[regions3d] enregistrement auprès de R3 impossible :', e);
  }
  if (typeof window !== 'undefined') window.REGIONS3D = API;
  else if (typeof globalThis !== 'undefined') globalThis.REGIONS3D = API;
})();
