// ============================================================================
//  tiles3d.js — LE CATALOGUE DES TUILES DU MONDE LÉGENDAIRE
// ----------------------------------------------------------------------------
//  Ce module est la SEULE source de vérité sur les tuiles pour toute la 3D.
//  Il remplace à la fois :
//    - TILE_TYPES de js/world.js  (walkable / encounter / biome)
//    - R3.TILE_STYLE de core3d.js (ground / h / deco / roof / water)
//  et il les fusionne en une seule définition par tuile, pour qu'il n'y ait
//  plus jamais deux tables à tenir synchronisées.
//
//  Pourquoi une seule table ? Parce qu'en v1 une tuile ajoutée dans world.js
//  et oubliée dans core3d.js apparaissait en vert vif à plat : le bug était
//  invisible tant qu'on ne marchait pas dessus. Ici, une tuile incomplète est
//  détectée au chargement et réparée avec un repli.
//
//  Les 40 tuiles d'origine sont reprises À L'IDENTIQUE (mêmes noms, mêmes
//  propriétés, mêmes couleurs) : le monde du jeu 2D doit rester reconnaissable.
//  S'y ajoutent ~80 tuiles pour les six régions du CONTRACT2 : jungle,
//  marécage, volcan, désert, glacier, plateau céleste, côte, cité majestueuse.
//
//  Conventions de couleur : les `ground` sont des ALBÉDOS, volontairement un
//  peu plus profonds que les couleurs 2D — l'éclairage 3D (soleil + hémisphère)
//  les éclaircit d'environ 20 %. Chaque biome a sa propre famille chromatique,
//  chatoyante et un peu saturée : le monde de Robin n'est jamais gris et triste.
//
//  Conventions de hauteur (`h`, AVANT lissage par world3d.js) : l'eau et la
//  lave sont en creux, les routes et les places sont plates, les bâtiments sont
//  posés sur un léger socle, les montagnes / falaises / glaciers montent.
//
//  Aucune dépendance : le fichier se charge même si R3 est absent ou incomplet.
// ============================================================================

(function () {
  'use strict';

  // R3 peut manquer si l'ordre de chargement a été bousculé : on ne lève jamais
  // d'exception, on se contente de publier la table sur window et de sortir.
  var R = (typeof R3 !== 'undefined' && R3) ? R3 : null;

  // ==========================================================================
  //  1. LES DÉCORS
  //     Tout nom de `deco` posé sur une tuile DOIT figurer ici, sinon
  //     world3d.js ne saura pas quoi instancier.
  // ==========================================================================

  // Décors de la v1 — construits (instanciés) par world3d.js.
  var DECOS_V1 = [
    'tree', 'flowers', 'tallgrass', 'rock', 'bench', 'fountain',
    'house', 'house2', 'vlghouse', 'mountain', 'reeds', 'snowtuft',
    'shell', 'mowline',
  ];

  // Nouveaux décors naturels (CONTRACT2 §15) — instanciés par world3d.js.
  var DECOS_NATURE = [
    'jungletree', 'vinetree', 'fern', 'mangrove', 'palm', 'cactus',
    'pinesnow', 'icespike', 'crystalspire', 'ruinpillar', 'lavarock',
    'geyser', 'drybone', 'lilypad', 'dune', 'cliff', 'reef', 'mossruin',
  ];

  // Décors MONUMENTAUX (CONTRACT2 §14) — construits à l'unité par
  // citybuild3d.js via build(kind, opts), jamais instanciés.
  var DECOS_MONUMENT = [
    'wall', 'wallTower', 'gateArch',
    'castle', 'castleTower', 'castleGate',
    'church', 'churchTower',
    'manor', 'townhouse', 'marketStall',
    'grandFountain', 'statue', 'lamp', 'banner', 'hedge', 'roseBed',
    'arena', 'healCenter', 'shop', 'portal',
    'lighthouse', 'observatory', 'dock', 'bridge', 'signpost', 'legendAltar',
    'airshipMast', 'airshipDock',
    // L'Académie-château (contrat v3 §8.2) : un seul bâtiment dans tout le
    // monde, construit à l'unité par citybuild3d.build('academy').
    'academy',
  ];

  var DECOS = DECOS_V1.concat(DECOS_NATURE, DECOS_MONUMENT);

  // Ensemble des décors confiés à citybuild3d.js.
  var MONUMENTS = {};
  for (var iM = 0; iM < DECOS_MONUMENT.length; iM++) MONUMENTS[DECOS_MONUMENT[iM]] = true;

  // Sous-ensemble des GRANDS monuments : ceux qui débordent largement de leur
  // tuile et qui doivent être construits UNE SEULE FOIS pour tout un bloc de
  // tuiles contiguës (un château de 6×5 tuiles = un seul château, pas 30).
  // world3d.js / cities3d.js s'en servent pour dédupliquer.
  var GRAND_MONUMENTS = {
    wall: true, wallTower: true, gateArch: true,
    castle: true, castleTower: true, castleGate: true,
    church: true, churchTower: true, manor: true,
    arena: true, grandFountain: true, statue: true,
    healCenter: true, shop: true, portal: true,
    lighthouse: true, observatory: true, academy: true,
    // Le mât d'amarrage est haut et déborde très au-dessus de sa tuile : c'est
    // le repère qui signale le port aérien de loin, il ne se construit qu'une fois.
    airshipMast: true,
  };

  // ==========================================================================
  //  2. LES BIOMES — libellé français + ambiance (ciel, brouillard, soleil…)
  //     Même format que R3.BIOME_MOOD. Les 10 biomes d'origine sont rappelés
  //     ici pour que labelOf() soit complet, mais SEULS les nouveaux sont
  //     poussés dans R3.BIOME_MOOD (on ne réécrit pas ce qui marche déjà).
  // ==========================================================================

  // Ambiances d'origine (copie de core3d.js, pour le repli si R3 manque).
  var MOOD_V1 = {
    forest:   { sky: '#8fd3f4', fog: '#a8dcf0', sun: '#fff3d6', ground: '#63b846', ambient: 0.55, particles: 'pollen' },
    lake:     { sky: '#9fdcf7', fog: '#bfe8f7', sun: '#ffffff', ground: '#3d86bd', ambient: 0.60, particles: 'sparkle' },
    plain:    { sky: '#8ed0f7', fog: '#c3e6f5', sun: '#fff6e0', ground: '#84c45c', ambient: 0.60, particles: 'pollen' },
    beach:    { sky: '#a6ddf7', fog: '#ecdcb4', sun: '#fff0c8', ground: '#e3c68d', ambient: 0.65, particles: 'sparkle' },
    sea:      { sky: '#7cc4ef', fog: '#a9d6ea', sun: '#ffffff', ground: '#2f7fb8', ambient: 0.62, particles: 'spray' },
    park:     { sky: '#9ad9f7', fog: '#c8ebf5', sun: '#fff8e4', ground: '#6cc04c', ambient: 0.58, particles: 'pollen' },
    city:     { sky: '#a8d4ea', fog: '#cfdde6', sun: '#fff4e2', ground: '#a5aab0', ambient: 0.60, particles: null },
    mountain: { sky: '#b6dcf2', fog: '#d5e6ef', sun: '#f4f8ff', ground: '#8a9199', ambient: 0.52, particles: 'snow' },
    village:  { sky: '#95d4f2', fog: '#c9e4ee', sun: '#ffeec4', ground: '#63b846', ambient: 0.58, particles: 'pollen' },
    city2:    { sky: '#a0cfe8', fog: '#ccdae4', sun: '#fff2dc', ground: '#a5aab0', ambient: 0.60, particles: null },
  };

  var LABEL_V1 = {
    forest: 'Forêt magique',
    lake: 'Lac scintillant',
    plain: 'Plaine fleurie',
    beach: 'Plage dorée',
    sea: 'Bord de mer',
    park: 'Grand parc',
    city: 'Petite ville',
    mountain: 'Montagnes majestueuses',
    village: 'Petit village douillet',
    city2: 'Grande cité marchande',
  };

  // Ambiances des NOUVEAUX biomes.
  //   particles : on n'utilise que les quatre familles que sky3d.js sait
  //   fabriquer ('pollen', 'sparkle', 'snow', 'spray'). Une valeur inventée
  //   ('ash', 'firefly'…) retomberait sur null côté sky3d, donc pas de
  //   particules du tout — un volcan sans braises en suspension serait bien
  //   plus triste qu'un volcan aux « sparkle » orangés.
  var MOOD_NEW = {
    jungle:    { sky: '#7ecfd8', fog: '#9fd9b6', sun: '#ffeec0', ground: '#2f8b3c', ambient: 0.50, particles: 'pollen' },
    swamp:     { sky: '#9fc4bb', fog: '#b9c7a2', sun: '#f4efc9', ground: '#4c6238', ambient: 0.46, particles: 'pollen' },
    volcano:   { sky: '#e08a5a', fog: '#c96a44', sun: '#ffd9a0', ground: '#4a2a20', ambient: 0.42, particles: 'sparkle' },
    desert:    { sky: '#8fc9ef', fog: '#e8cf9a', sun: '#fff2c4', ground: '#d8b46a', ambient: 0.70, particles: 'pollen' },
    glacier:   { sky: '#bfe4f6', fog: '#dcecf6', sun: '#f6fbff', ground: '#cfe9f5', ambient: 0.55, particles: 'snow' },
    celestial: { sky: '#9a8ce0', fog: '#c3b6ee', sun: '#fff3d0', ground: '#6a5fa8', ambient: 0.58, particles: 'sparkle' },
    coast:     { sky: '#8fd4f4', fog: '#c9e6ef', sun: '#fff3d6', ground: '#e0c489', ambient: 0.66, particles: 'spray' },
    citadel:   { sky: '#a8d4ea', fog: '#d3dee6', sun: '#fff4e2', ground: '#b6b0a4', ambient: 0.62, particles: null },
  };

  var LABEL_NEW = {
    jungle: 'Jungle luxuriante',
    swamp: 'Marécage brumeux',
    volcano: 'Caldeira ardente',
    desert: 'Désert brûlant',
    glacier: 'Glacier éternel',
    celestial: 'Plateau céleste',
    coast: 'Côte battue par les vents',
    citadel: 'Cité majestueuse',
  };

  // BIOMES = { biome: { label, mood } } — tous les biomes, anciens et nouveaux.
  var BIOMES = {};
  (function buildBiomes() {
    var b;
    for (b in MOOD_V1) {
      if (!Object.prototype.hasOwnProperty.call(MOOD_V1, b)) continue;
      // Si le socle est là, on référence SON objet d'ambiance : ainsi une
      // retouche de core3d.js reste visible ici, et inversement.
      var m0 = (R && R.BIOME_MOOD && R.BIOME_MOOD[b]) || MOOD_V1[b];
      BIOMES[b] = { label: LABEL_V1[b], mood: m0 };
    }
    for (b in MOOD_NEW) {
      if (!Object.prototype.hasOwnProperty.call(MOOD_NEW, b)) continue;
      BIOMES[b] = { label: LABEL_NEW[b], mood: MOOD_NEW[b] };
    }
  })();

  // ==========================================================================
  //  3. LA TABLE DES TUILES
  //     def = { walkable, encounter, biome, ground, h, deco, roof, water, label }
  //     Les champs deco / roof / water absents sont normalisés à null plus bas.
  // ==========================================================================

  var TILES = {

    // ------------------------------------------------------------------
    //  A. LES 40 TUILES D'ORIGINE — reprises à l'identique de js/world.js
    //     (walkable/encounter/biome) et de R3.TILE_STYLE (ground/h/deco/roof).
    //     Ne rien y changer : c'est le monde que Robin connaît déjà.
    // ------------------------------------------------------------------

    // --- Forêt ---
    GRASS:        { walkable: true,  encounter: false, biome: 'forest', ground: '#63b846', h: 0.00, deco: null,        label: 'Herbe' },
    TALL_GRASS:   { walkable: true,  encounter: true,  biome: 'forest', ground: '#4a9c36', h: 0.00, deco: 'tallgrass', label: 'Hautes herbes' },
    FLOWERS:      { walkable: true,  encounter: false, biome: 'forest', ground: '#63b846', h: 0.00, deco: 'flowers',   label: 'Fleurs' },
    TREE:         { walkable: false, encounter: false, biome: 'forest', ground: '#559f3c', h: 0.05, deco: 'tree',      label: 'Arbre' },

    // --- Lac ---
    WATER:        { walkable: false, encounter: false, biome: 'lake',  ground: '#1b3f78', h: -0.50, deco: null, water: 'lake',    label: 'Eau profonde' },
    SHALLOW:      { walkable: true,  encounter: true,  biome: 'lake',  ground: '#3d86bd', h: -0.16, deco: null, water: 'shallow', label: 'Bas-fonds' },

    // --- Plage / mer ---
    SAND:         { walkable: true,  encounter: false, biome: 'beach', ground: '#e3c68d', h: 0.00,  deco: 'shell', label: 'Sable' },
    SEA:          { walkable: false, encounter: false, biome: 'sea',   ground: '#132f5c', h: -0.70, deco: null, water: 'sea',   label: 'Haute mer' },
    WAVES:        { walkable: true,  encounter: true,  biome: 'sea',   ground: '#2f7fb8', h: -0.14, deco: null, water: 'waves', label: 'Vagues' },

    // --- Plaine ---
    PATH:         { walkable: true,  encounter: false, biome: 'plain', ground: '#c19a6b', h: 0.02, deco: null,        label: 'Sentier' },
    PLAIN:        { walkable: true,  encounter: false, biome: 'plain', ground: '#84c45c', h: 0.00, deco: null,        label: 'Plaine' },
    TALL_PLAIN:   { walkable: true,  encounter: true,  biome: 'plain', ground: '#4f9e3f', h: 0.00, deco: 'tallgrass', label: 'Herbes de la plaine' },
    ROCK:         { walkable: false, encounter: false, biome: 'plain', ground: '#6fb84a', h: 0.04, deco: 'rock',      label: 'Rocher' },

    // --- Petite ville ---
    HOUSE_RED:    { walkable: false, encounter: false, biome: 'city', ground: '#a5aab0', h: 0.03, deco: 'house', roof: '#d1483f', label: 'Maison rouge' },
    HOUSE_BLUE:   { walkable: false, encounter: false, biome: 'city', ground: '#a5aab0', h: 0.03, deco: 'house', roof: '#3355b8', label: 'Maison bleue' },
    HOUSE_YELLOW: { walkable: false, encounter: false, biome: 'city', ground: '#a5aab0', h: 0.03, deco: 'house', roof: '#dbab18', label: 'Maison jaune' },
    CITY_PATH:    { walkable: true,  encounter: false, biome: 'city', ground: '#8c98a6', h: 0.03, deco: null,     label: 'Rue pavée' },
    CITY_GROUND:  { walkable: true,  encounter: false, biome: 'city', ground: '#a5aab0', h: 0.03, deco: null,     label: 'Place de la ville' },
    FOUNTAIN:     { walkable: false, encounter: false, biome: 'city', ground: '#a5aab0', h: 0.03, deco: 'fountain', label: 'Fontaine' },

    // --- Parc ---
    PARK_GRASS:   { walkable: true,  encounter: false, biome: 'park', ground: '#6cc04c', h: 0.00,  deco: 'mowline',   label: 'Pelouse du parc' },
    PARK_TALL:    { walkable: true,  encounter: true,  biome: 'park', ground: '#4a9c36', h: 0.00,  deco: 'tallgrass', label: 'Herbes du parc' },
    PARK_FLOWER:  { walkable: true,  encounter: false, biome: 'park', ground: '#6cc04c', h: 0.00,  deco: 'flowers',   label: 'Parterre de fleurs' },
    PARK_PATH:    { walkable: true,  encounter: false, biome: 'park', ground: '#d9be89', h: 0.02,  deco: null,        label: 'Allée du parc' },
    PARK_TREE:    { walkable: false, encounter: false, biome: 'park', ground: '#6cc04c', h: 0.05,  deco: 'tree',      label: 'Arbre du parc' },
    POND:         { walkable: false, encounter: false, biome: 'park', ground: '#1b3f78', h: -0.38, deco: null, water: 'pond', label: 'Mare' },
    POND_EDGE:    { walkable: true,  encounter: true,  biome: 'lake', ground: '#4f9e3f', h: -0.02, deco: 'reeds',     label: 'Bord de mare' },
    BENCH:        { walkable: false, encounter: false, biome: 'park', ground: '#6cc04c', h: 0.00,  deco: 'bench',     label: 'Banc' },

    // --- Montagnes ---
    MOUNTAIN:     { walkable: false, encounter: false, biome: 'mountain', ground: '#6a727e', h: 1.30, deco: 'mountain', label: 'Montagne' },
    MTN_PATH:     { walkable: true,  encounter: false, biome: 'mountain', ground: '#8a9199', h: 0.55, deco: null,       label: 'Chemin de montagne' },
    MTN_GRASS:    { walkable: true,  encounter: true,  biome: 'mountain', ground: '#5b7a58', h: 0.60, deco: 'tallgrass',label: 'Herbes d’altitude' },
    SNOW:         { walkable: true,  encounter: true,  biome: 'mountain', ground: '#e6f1f7', h: 1.15, deco: 'snowtuft', label: 'Neige' },

    // --- Village ---
    VLG_HOUSE:    { walkable: false, encounter: false, biome: 'village', ground: '#63b846', h: 0.03, deco: 'vlghouse', label: 'Chaumière' },
    VLG_PATH:     { walkable: true,  encounter: false, biome: 'village', ground: '#c08c62', h: 0.02, deco: null,       label: 'Chemin du village' },
    VLG_TALL:     { walkable: true,  encounter: true,  biome: 'village', ground: '#4a9c36', h: 0.00, deco: 'tallgrass',label: 'Herbes du village' },

    // --- Grande cité ---
    CITY2_PATH:   { walkable: true,  encounter: false, biome: 'city2', ground: '#8c98a6', h: 0.03, deco: null, label: 'Grande rue' },
    CITY2_GROUND: { walkable: true,  encounter: false, biome: 'city2', ground: '#a5aab0', h: 0.03, deco: null, label: 'Esplanade' },
    HOUSE2_RED:   { walkable: false, encounter: false, biome: 'city2', ground: '#a5aab0', h: 0.03, deco: 'house2', roof: '#d1483f', label: 'Immeuble rouge' },
    HOUSE2_BLUE:  { walkable: false, encounter: false, biome: 'city2', ground: '#a5aab0', h: 0.03, deco: 'house2', roof: '#3355b8', label: 'Immeuble bleu' },
    HOUSE2_YELLOW:{ walkable: false, encounter: false, biome: 'city2', ground: '#a5aab0', h: 0.03, deco: 'house2', roof: '#dbab18', label: 'Immeuble jaune' },
    FOUNTAIN2:    { walkable: false, encounter: false, biome: 'city2', ground: '#a5aab0', h: 0.03, deco: 'fountain', label: 'Grande fontaine de la cité' },

    // ------------------------------------------------------------------
    //  B. JUNGLE — Sylve d'Ambre. Verts profonds et saturés, un peu bleutés
    //     dans l'ombre : la jungle doit paraître DENSE et vivante.
    // ------------------------------------------------------------------
    JUNGLE_GRASS: { walkable: true,  encounter: false, biome: 'jungle', ground: '#2f8b3c', h: 0.00, deco: null,         label: 'Sous-bois de jungle' },
    JUNGLE_TALL:  { walkable: true,  encounter: true,  biome: 'jungle', ground: '#236f2e', h: 0.00, deco: 'tallgrass',  label: 'Hautes herbes de jungle' },
    JUNGLE_TREE:  { walkable: false, encounter: false, biome: 'jungle', ground: '#2a7a34', h: 0.08, deco: 'jungletree', label: 'Arbre de jungle' },
    // La canopée est le même arbre, mais plus haut et plus sombre : c'est ce
    // qui donne l'impression d'un plafond de feuilles au-dessus du joueur.
    JUNGLE_CANOPY:{ walkable: false, encounter: false, biome: 'jungle', ground: '#1d5e2a', h: 0.14, deco: 'jungletree', label: 'Canopée' },
    VINE_TREE:    { walkable: false, encounter: false, biome: 'jungle', ground: '#2b7b3a', h: 0.08, deco: 'vinetree',   label: 'Arbre à lianes' },
    FERN:         { walkable: true,  encounter: true,  biome: 'jungle', ground: '#357f38', h: 0.02, deco: 'fern',       label: 'Fougères' },

    // ------------------------------------------------------------------
    //  C. MARÉCAGE — verts olive et bruns. L'eau y est trouble (water:'swamp')
    //     et le sol légèrement en creux : on sent qu'on patauge.
    // ------------------------------------------------------------------
    SWAMP_GRASS:  { walkable: true,  encounter: true,  biome: 'swamp', ground: '#5f7a35', h: -0.02, deco: 'reeds',   label: 'Herbes du marais' },
    SWAMP_WATER:  { walkable: false, encounter: false, biome: 'swamp', ground: '#2f4a33', h: -0.35, deco: null,      water: 'swamp', label: 'Eau croupie' },
    MUD:          { walkable: true,  encounter: false, biome: 'swamp', ground: '#5b4630', h: -0.08, deco: null,      label: 'Boue' },
    LILY_PAD:     { walkable: false, encounter: false, biome: 'swamp', ground: '#2f4a33', h: -0.30, deco: 'lilypad', water: 'swamp', label: 'Nénuphars' },
    MANGROVE:     { walkable: false, encounter: false, biome: 'swamp', ground: '#3d5a3a', h: -0.06, deco: 'mangrove',water: 'swamp', label: 'Palétuvier' },
    RUIN_MOSS:    { walkable: false, encounter: false, biome: 'swamp', ground: '#4b6b46', h: 0.06,  deco: 'mossruin',label: 'Ruine envahie' },

    // ------------------------------------------------------------------
    //  D. VOLCAN — Caldeira de Braise. Noirs chauds (jamais des gris neutres)
    //     réchauffés d'orange. La lave est en CREUX : elle doit couler dans
    //     des rigoles, pas flotter au-dessus du sol.
    // ------------------------------------------------------------------
    LAVA:         { walkable: false, encounter: false, biome: 'volcano', ground: '#8e2b12', h: -0.30, deco: null, water: 'lava', label: 'Lave en fusion' },
    LAVA_CRUST:   { walkable: true,  encounter: false, biome: 'volcano', ground: '#43261f', h: 0.00,  deco: null,      label: 'Croûte de lave' },
    BASALT:       { walkable: true,  encounter: false, biome: 'volcano', ground: '#3b3945', h: 0.20,  deco: null,      label: 'Dalle de basalte' },
    ASH:          { walkable: true,  encounter: true,  biome: 'volcano', ground: '#584f56', h: 0.00,  deco: null,      label: 'Champ de cendres' },
    CRACKED_EARTH:{ walkable: true,  encounter: false, biome: 'volcano', ground: '#8a5a3c', h: 0.02,  deco: null,      label: 'Terre craquelée' },
    EMBER_GRASS:  { walkable: true,  encounter: true,  biome: 'volcano', ground: '#6e5a2c', h: 0.00,  deco: 'tallgrass', label: 'Herbes de braise' },
    OBSIDIAN:     { walkable: false, encounter: false, biome: 'volcano', ground: '#1a1c2c', h: 0.30,  deco: 'lavarock', label: 'Obsidienne' },
    GEYSER:       { walkable: false, encounter: false, biome: 'volcano', ground: '#6b5a4a', h: 0.05,  deco: 'geyser',   label: 'Geyser' },

    // ------------------------------------------------------------------
    //  E. DÉSERT — ocres dorés. Les dunes sont infranchissables : elles
    //     servent de relief naturel pour dessiner les chemins.
    // ------------------------------------------------------------------
    DESERT_SAND:  { walkable: true,  encounter: false, biome: 'desert', ground: '#d8b46a', h: 0.00, deco: null,      label: 'Sable du désert' },
    DUNE:         { walkable: false, encounter: false, biome: 'desert', ground: '#cfa85e', h: 0.70, deco: 'dune',    label: 'Dune' },
    CACTUS:       { walkable: false, encounter: false, biome: 'desert', ground: '#d8b46a', h: 0.02, deco: 'cactus',  label: 'Cactus' },
    // Les ossements sont posés à plat : on marche entre eux, et c'est LA tuile
    // à rencontres du désert (sans elle, le désert serait vide de créatures).
    DRY_BONE:     { walkable: true,  encounter: true,  biome: 'desert', ground: '#cbb083', h: 0.01, deco: 'drybone', label: 'Ossements' },

    // ------------------------------------------------------------------
    //  F. GLACIER — Massif de Givre. Bleus pâles lumineux. Le glacier monte
    //     très haut (h 1.9) pour barrer l'horizon comme une montagne.
    // ------------------------------------------------------------------
    ICE:          { walkable: true,  encounter: false, biome: 'glacier', ground: '#8ecbe0', h: 0.04,  deco: null,      label: 'Glace' },
    // Glace fissurée : l'eau affleure dessous, donc on ne passe pas.
    ICE_CRACK:    { walkable: false, encounter: false, biome: 'glacier', ground: '#6fb0cf', h: 0.00,  deco: null, water: 'ice', label: 'Glace fissurée' },
    GLACIER:      { walkable: false, encounter: false, biome: 'glacier', ground: '#cfe9f5', h: 1.90,  deco: null,      label: 'Glacier' },
    DEEP_SNOW:    { walkable: true,  encounter: true,  biome: 'glacier', ground: '#dfeef7', h: 0.25,  deco: 'snowtuft',label: 'Neige profonde' },
    FROZEN_LAKE:  { walkable: true,  encounter: false, biome: 'glacier', ground: '#7cb8d8', h: -0.06, deco: null, water: 'ice', label: 'Lac gelé' },
    ICE_SPIKE:    { walkable: false, encounter: false, biome: 'glacier', ground: '#a8dcef', h: 0.20,  deco: 'icespike',label: 'Pic de glace' },
    PINE_SNOW:    { walkable: false, encounter: false, biome: 'glacier', ground: '#dfeef7', h: 0.10,  deco: 'pinesnow',label: 'Sapin enneigé' },
    ICE_CAVE:     { walkable: true,  encounter: true,  biome: 'glacier', ground: '#5f8fb0', h: 0.10,  deco: null,      label: 'Grotte de glace' },

    // ------------------------------------------------------------------
    //  G. PLATEAU CÉLESTE — Plateau d'Aurore. Violets et lavandes, pierre
    //     claire nacrée, chemins d'étoiles. Le biome le plus « magique ».
    // ------------------------------------------------------------------
    PLATEAU_GRASS:    { walkable: true,  encounter: false, biome: 'celestial', ground: '#5aa27a', h: 0.00, deco: null,          label: 'Herbe du plateau' },
    PLATEAU_TALL:     { walkable: true,  encounter: true,  biome: 'celestial', ground: '#4d8f6b', h: 0.00, deco: 'tallgrass',   label: 'Herbes hautes du plateau' },
    RUIN_STONE:       { walkable: true,  encounter: false, biome: 'celestial', ground: '#b9b3c6', h: 0.06, deco: null,          label: 'Dalles anciennes' },
    RUIN_PILLAR:      { walkable: false, encounter: false, biome: 'celestial', ground: '#b9b3c6', h: 0.08, deco: 'ruinpillar',  label: 'Colonne en ruine' },
    STAR_PATH:        { walkable: true,  encounter: false, biome: 'celestial', ground: '#6a5fa8', h: 0.04, deco: null,          label: 'Chemin d’étoiles' },
    CLOUD_STONE:      { walkable: true,  encounter: false, biome: 'celestial', ground: '#e6e1f5', h: 0.30, deco: null,          label: 'Pierre-nuage' },
    OBSERVATORY_FLOOR:{ walkable: true,  encounter: false, biome: 'celestial', ground: '#cdd3e8', h: 0.08, deco: null,          label: 'Sol de l’observatoire' },
    CRYSTAL_SPIRE:    { walkable: false, encounter: false, biome: 'celestial', ground: '#b9a8e0', h: 0.20, deco: 'crystalspire',label: 'Flèche de cristal' },
    // Ajout hors liste du §5 : sans elle, le décor monumental 'observatory'
    // du §14 n'aurait aucune tuile porteuse.
    OBSERVATORY:      { walkable: false, encounter: false, biome: 'celestial', ground: '#cdd3e8', h: 0.30, deco: 'observatory', label: 'Observatoire' },

    // ------------------------------------------------------------------
    //  H. CÔTE — Côte de Saphir. Sables clairs, pierre ocre des falaises,
    //     turquoise des récifs. Les falaises montent haut : elles ferment
    //     l'horizon côté terre.
    // ------------------------------------------------------------------
    CLIFF:        { walkable: false, encounter: false, biome: 'coast', ground: '#a67f57', h: 1.40,  deco: 'cliff',      label: 'Falaise' },
    CLIFF_EDGE:   { walkable: true,  encounter: false, biome: 'coast', ground: '#b89467', h: 0.90,  deco: null,         label: 'Bord de falaise' },
    PALM:         { walkable: false, encounter: false, biome: 'coast', ground: '#e0c489', h: 0.02,  deco: 'palm',       label: 'Palmier' },
    CORAL_SAND:   { walkable: true,  encounter: true,  biome: 'coast', ground: '#f0cfae', h: 0.00,  deco: 'shell',      label: 'Sable corallien' },
    DOCK:         { walkable: true,  encounter: false, biome: 'coast', ground: '#8a6440', h: 0.05,  deco: 'dock',       label: 'Ponton' },
    // Écart assumé : il n'existe pas de décor 'boat' au contrat. Plutôt que
    // d'inventer un nom que world3d ne saurait pas construire (et qui ne
    // dessinerait donc RIEN), la barque réutilise le décor 'dock' amarré.
    BOAT:         { walkable: false, encounter: false, biome: 'coast', ground: '#2f7fb8', h: -0.12, deco: 'dock', water: 'shallow', label: 'Barque' },
    LIGHTHOUSE_BASE:{ walkable: false, encounter: false, biome: 'coast', ground: '#c9c3b4', h: 0.30, deco: 'lighthouse',label: 'Phare' },
    REEF:         { walkable: false, encounter: false, biome: 'coast', ground: '#2f7fb8', h: -0.20, deco: 'reef', water: 'shallow', label: 'Récif' },

    // ------------------------------------------------------------------
    //  I. CITÉ MAJESTUEUSE — pierre chaude et pavés clairs. Les couleurs
    //     restent neutres EXPRÈS : ce sont les toits, les bannières et le
    //     style de ville (citybuild3d.js) qui apportent la couleur.
    //     Tout ce qui est pavé est parfaitement PLAT (h 0.03) : une place
    //     bosselée ruinerait l'effet « ville monumentale ».
    // ------------------------------------------------------------------
    PAVED_ROAD:   { walkable: true,  encounter: false, biome: 'citadel', ground: '#9aa3ad', h: 0.03, deco: null, label: 'Rue pavée' },
    PLAZA:        { walkable: true,  encounter: false, biome: 'citadel', ground: '#b6b0a4', h: 0.03, deco: null, label: 'Place' },
    PLAZA_GRAND:  { walkable: true,  encounter: false, biome: 'citadel', ground: '#c9c2b2', h: 0.03, deco: null, label: 'Grande place' },

    WALL:         { walkable: false, encounter: false, biome: 'citadel', ground: '#8e8b84', h: 0.40, deco: 'wall',       label: 'Rempart' },
    WALL_TOWER:   { walkable: false, encounter: false, biome: 'citadel', ground: '#8e8b84', h: 0.45, deco: 'wallTower',  label: 'Tour du rempart' },
    GATE_ARCH:    { walkable: true,  encounter: false, biome: 'citadel', ground: '#a09a90', h: 0.10, deco: 'gateArch',   label: 'Porte de la ville' },

    CASTLE:       { walkable: false, encounter: false, biome: 'citadel', ground: '#8e8b84', h: 0.50, deco: 'castle',     label: 'Château' },
    CASTLE_TOWER: { walkable: false, encounter: false, biome: 'citadel', ground: '#8e8b84', h: 0.55, deco: 'castleTower',label: 'Tour du château' },
    CASTLE_GATE:  { walkable: true,  encounter: false, biome: 'citadel', ground: '#a09a90', h: 0.12, deco: 'castleGate', label: 'Herse du château' },

    CHURCH:       { walkable: false, encounter: false, biome: 'citadel', ground: '#b3ab9c', h: 0.35, deco: 'church',      label: 'Église' },
    CHURCH_TOWER: { walkable: false, encounter: false, biome: 'citadel', ground: '#b3ab9c', h: 0.40, deco: 'churchTower', label: 'Clocher' },

    MANOR:        { walkable: false, encounter: false, biome: 'citadel', ground: '#a89f92', h: 0.25, deco: 'manor',     roof: '#5a4a7a', label: 'Manoir' },
    TOWNHOUSE_A:  { walkable: false, encounter: false, biome: 'citadel', ground: '#a5a09a', h: 0.20, deco: 'townhouse', roof: '#d1483f', label: 'Maison de ville rouge' },
    TOWNHOUSE_B:  { walkable: false, encounter: false, biome: 'citadel', ground: '#a5a09a', h: 0.20, deco: 'townhouse', roof: '#3355b8', label: 'Maison de ville bleue' },
    TOWNHOUSE_C:  { walkable: false, encounter: false, biome: 'citadel', ground: '#a5a09a', h: 0.20, deco: 'townhouse', roof: '#dbab18', label: 'Maison de ville jaune' },
    MARKET_STALL: { walkable: false, encounter: false, biome: 'citadel', ground: '#b6b0a4', h: 0.06, deco: 'marketStall', roof: '#e0783c', label: 'Étal du marché' },

    GRAND_FOUNTAIN:{ walkable: false, encounter: false, biome: 'citadel', ground: '#c9c2b2', h: 0.05, deco: 'grandFountain', label: 'Grande fontaine' },
    STATUE:       { walkable: false, encounter: false, biome: 'citadel', ground: '#c9c2b2', h: 0.06, deco: 'statue',  label: 'Statue' },
    LAMP_POST:    { walkable: false, encounter: false, biome: 'citadel', ground: '#9aa3ad', h: 0.04, deco: 'lamp',    label: 'Réverbère' },
    BANNER_POLE:  { walkable: false, encounter: false, biome: 'citadel', ground: '#9aa3ad', h: 0.04, deco: 'banner',  label: 'Mât à bannière' },
    HEDGE:        { walkable: false, encounter: false, biome: 'citadel', ground: '#5ea84a', h: 0.05, deco: 'hedge',   label: 'Haie taillée' },
    ROSE_BED:     { walkable: false, encounter: false, biome: 'citadel', ground: '#5ea84a', h: 0.04, deco: 'roseBed', label: 'Massif de roses' },
    BRIDGE:       { walkable: true,  encounter: false, biome: 'citadel', ground: '#8a6440', h: 0.10, deco: 'bridge',  label: 'Pont' },

    ARENA_WALL:   { walkable: false, encounter: false, biome: 'citadel', ground: '#9c9488', h: 0.45, deco: 'arena',      label: 'Arène' },
    ARENA_DOOR:   { walkable: true,  encounter: false, biome: 'citadel', ground: '#b6b0a4', h: 0.06, deco: null,         label: 'Entrée de l’arène' },
    HEAL_CENTER:  { walkable: false, encounter: false, biome: 'citadel', ground: '#a5a09a', h: 0.22, deco: 'healCenter', roof: '#f06a8a', label: 'Centre de soins' },
    HEAL_DOOR:    { walkable: true,  encounter: false, biome: 'citadel', ground: '#b6b0a4', h: 0.06, deco: null,         label: 'Porte du centre de soins' },
    SHOP:         { walkable: false, encounter: false, biome: 'citadel', ground: '#a5a09a', h: 0.22, deco: 'shop',       roof: '#3aa6d8', label: 'Boutique' },
    SHOP_DOOR:    { walkable: true,  encounter: false, biome: 'citadel', ground: '#b6b0a4', h: 0.06, deco: null,         label: 'Porte de la boutique' },

    // --- L'Académie du Cristal (contrat v3 §8.2, demandes 10 et 10 bis) ------
    // Un seul château dans tout le monde. `cities3d.js` greffait déjà ces deux
    // tuiles au chargement pour ne pas dépendre de nous ; les déclarer ici rend
    // sa greffe inopérante (elle n'écrase jamais une tuile existante) et fait
    // exister la tuile même si cities3d venait à manquer.
    ACADEMY_WALL: { walkable: false, encounter: false, biome: 'citadel', ground: '#8e8b84', h: 0.55, deco: 'academy',    label: 'Académie du Cristal' },
    ACADEMY_DOOR: { walkable: true,  encounter: false, biome: 'citadel', ground: '#a09a90', h: 0.06, deco: null,         label: 'Portail de l’Académie' },

    // --- Port aérien (CONTRACT2 §17 bis) ------------------------------------
    // La plateforme est surélevée : un port aérien se voit d'en bas, et ça
    // évite que le plancher de bois se noie dans le pavé de la ville.
    AIRSHIP_PLATFORM: { walkable: true,  encounter: false, biome: 'citadel', ground: '#9c6b3f', h: 0.22, deco: null,          label: 'Plateforme du port aérien' },
    AIRSHIP_DOCK:     { walkable: true,  encounter: false, biome: 'citadel', ground: '#b07a46', h: 0.22, deco: 'airshipDock', label: 'Embarcadère du dirigeable' },
    AIRSHIP_MAST:     { walkable: false, encounter: false, biome: 'citadel', ground: '#8a5c36', h: 0.22, deco: 'airshipMast', label: 'Mât d’amarrage' },

    // ------------------------------------------------------------------
    //  J. TUILES SPÉCIALES
    // ------------------------------------------------------------------
    // Le portail est marchable : on marche dessus et la région change. Son
    // biome est 'plain' (neutre) exprès — un biome exotique ferait clignoter
    // le ciel juste avant le fondu de transition.
    PORTAL:       { walkable: true,  encounter: false, biome: 'plain',     ground: '#6a5fa8', h: 0.06, deco: 'portal',      label: 'Portail' },
    // Panneau et autel ne sont PAS marchables : leur biome n'est donc jamais
    // celui « sous les pieds » du joueur, on peut le choisir librement.
    SIGN:         { walkable: false, encounter: false, biome: 'plain',     ground: '#c19a6b', h: 0.02, deco: 'signpost',    label: 'Panneau' },
    LEGEND_ALTAR: { walkable: false, encounter: false, biome: 'celestial', ground: '#5a4f8c', h: 0.25, deco: 'legendAltar', label: 'Autel du légendaire' },

    // Ajout hors liste : bordure de carte. regions3d.js a besoin d'un type
    // infranchissable à renvoyer hors des limites (§9) ; sans lui, le repli
    // sur GRASS rendrait le hors-carte… marchable.
    VOID:         { walkable: false, encounter: false, biome: 'sea', ground: '#132f5c', h: -1.20, deco: null, water: 'sea', label: 'Horizon' },
  };

  // ==========================================================================
  //  4. NORMALISATION ET GARDE-FOUS
  //     On complète les champs manquants et on répare (sans planter) toute
  //     définition douteuse : une tuile cassée doit rester jouable.
  // ==========================================================================

  var HEX = /^#[0-9a-fA-F]{6}$/;
  var FALLBACK_GROUND = '#63b846';
  var WATER_KINDS = { lake: 1, sea: 1, waves: 1, shallow: 1, pond: 1, lava: 1, swamp: 1, ice: 1 };

  var NAMES = [];
  var STYLE = {};        // table de style pure, compatible R3.TILE_STYLE
  var DECO_SET = {};
  for (var iD = 0; iD < DECOS.length; iD++) DECO_SET[DECOS[iD]] = true;

  (function normalize() {
    for (var k in TILES) {
      if (!Object.prototype.hasOwnProperty.call(TILES, k)) continue;
      var d = TILES[k];
      d.type = k;
      d.walkable = !!d.walkable;
      d.encounter = !!d.encounter;
      // Une tuile non marchable ne peut pas déclencher de rencontre : le
      // joueur n'y met jamais les pieds. On corrige plutôt que de piéger.
      if (!d.walkable) d.encounter = false;
      if (typeof d.biome !== 'string' || !BIOMES[d.biome]) {
        if (R && R.quality) console.warn('[tiles3d] biome inconnu sur', k, '->', 'plain');
        d.biome = 'plain';
      }
      if (typeof d.ground !== 'string' || !HEX.test(d.ground)) d.ground = FALLBACK_GROUND;
      if (typeof d.h !== 'number' || !isFinite(d.h)) d.h = 0;
      if (d.deco === undefined) d.deco = null;
      if (d.deco !== null && !DECO_SET[d.deco]) {
        console.warn('[tiles3d] décor inconnu sur', k, ':', d.deco);
        d.deco = null;
      }
      if (d.roof === undefined || !HEX.test(String(d.roof))) d.roof = d.roof === undefined ? null : null;
      if (d.water === undefined || !WATER_KINDS[d.water]) d.water = d.water === undefined ? null : null;
      if (typeof d.label !== 'string' || !d.label) d.label = k;
      // Repère pratique : ce décor est-il confié à citybuild3d.js ?
      d.monument = !!(d.deco && MONUMENTS[d.deco]);

      // Objet de style figé, réutilisé à chaque appel de style() : world3d
      // interroge la table pour 86 016 tuiles, il ne faut allouer PERSONNE.
      STYLE[k] = { ground: d.ground, h: d.h, deco: d.deco, roof: d.roof, water: d.water };
      NAMES.push(k);
    }
  })();

  // ==========================================================================
  //  5. API
  // ==========================================================================

  var DEFAULT = TILES.GRASS;
  var DEFAULT_STYLE = STYLE.GRASS;

  /** Définition d'une tuile. Ne renvoie JAMAIS null : repli sur GRASS. */
  function getTile(type) { return TILES[type] || DEFAULT; }

  /** Style compatible R3.tileStyle : { ground, h, deco, roof, water }. */
  function styleOf(type) { return STYLE[type] || DEFAULT_STYLE; }

  function isWalkable(type) { var d = TILES[type]; return d ? d.walkable : false; }
  function isEncounter(type) { var d = TILES[type]; return d ? d.encounter : false; }
  function biomeOf(type) { return (TILES[type] || DEFAULT).biome; }
  function labelOf(type) { return (TILES[type] || DEFAULT).label; }
  function isWater(type) { return !!(TILES[type] && TILES[type].water); }

  /** Libellé français d'un biome (« Jungle luxuriante »). */
  function biomeLabel(biome) {
    var b = BIOMES[biome];
    return b ? b.label : 'Contrée inconnue';
  }

  /** Ambiance d'un biome, au format R3.BIOME_MOOD. Jamais null. */
  function biomeMoodOf(biome) {
    var b = BIOMES[biome];
    return (b && b.mood) || MOOD_V1.plain;
  }

  /** Ce décor est-il construit à l'unité par citybuild3d.js ? */
  function isMonument(deco) { return !!MONUMENTS[deco]; }

  /** Ce décor doit-il n'être construit QU'UNE FOIS pour tout un bloc de
   *  tuiles contiguës (château, église, rempart…) ? */
  function isGrandMonument(deco) { return !!GRAND_MONUMENTS[deco]; }

  var API = {
    // --- contrat §5, signature exacte ---
    TILES: TILES,
    get: getTile,
    style: styleOf,
    isWalkable: isWalkable,
    isEncounter: isEncounter,
    biomeOf: biomeOf,
    DECOS: DECOS,
    BIOMES: BIOMES,
    // --- ajouts (en plus, jamais en remplacement) ---
    NAMES: NAMES,                     // tous les noms de tuiles, dans l'ordre
    count: NAMES.length,
    STYLE: STYLE,                     // table de style brute (= R3.TILE_STYLE)
    MONUMENTS: MONUMENTS,             // { deco: true } confiés à citybuild3d
    GRAND_MONUMENTS: GRAND_MONUMENTS, // sous-ensemble à construire une seule fois
    isMonument: isMonument,
    isGrandMonument: isGrandMonument,
    labelOf: labelOf,
    isWater: isWater,
    biomeLabel: biomeLabel,
    biomeMood: biomeMoodOf,
    BIOMES_MOOD: MOOD_NEW,            // ce qui est poussé dans R3.BIOME_MOOD
  };

  // ==========================================================================
  //  6. ENREGISTREMENT ET PATCH DU SOCLE
  //     C'est ce patch qui permet à tout le code déjà écrit (world3d, sky3d,
  //     hud3d, battle3d…) de continuer à fonctionner sans une seule retouche :
  //     il continue d'appeler R3.tileStyle() et R3.biomeMood(), qui connaissent
  //     désormais les 120 tuiles et les 18 biomes.
  // ==========================================================================

  try {
    if (R) {
      R.register('tiles', API);

      // R3.tileStyle : redirigé vers notre table.
      R.tileStyle = function (type) { return styleOf(type); };

      // R3.TILE_STYLE : certains modules la lisent DIRECTEMENT (world3d.js).
      // On la complète sur place plutôt que de la remplacer, pour ne pas
      // casser une référence déjà capturée par un autre module.
      if (R.TILE_STYLE) {
        for (var kS in STYLE) {
          if (Object.prototype.hasOwnProperty.call(STYLE, kS)) R.TILE_STYLE[kS] = STYLE[kS];
        }
      }

      // R3.BIOME_MOOD : on ajoute les nouveaux biomes. biomeMood() étant une
      // fermeture sur cet objet, l'ajout est immédiatement visible partout.
      if (R.BIOME_MOOD) {
        for (var kB in MOOD_NEW) {
          if (Object.prototype.hasOwnProperty.call(MOOD_NEW, kB)) R.BIOME_MOOD[kB] = MOOD_NEW[kB];
        }
      }
    }
  } catch (e) {
    console.warn('[tiles3d] patch du socle impossible :', e);
  }

  // Toujours accessible même si R3 manque (débogage en console, et repli pour
  // un module qui se chargerait avant core3d.js).
  if (typeof window !== 'undefined') window.TILES3D = API;
  else if (typeof globalThis !== 'undefined') globalThis.TILES3D = API;
})();
