// =============================================================================
//  dex3d.js — Le Pokédex complet du « Monde légendaire » (26 + 36 = 62 espèces)
// =============================================================================
//
//  Ce module est la source de vérité sur les CRÉATURES : types élémentaires,
//  statistiques, régions et biomes de rencontre, capacités connues, fourchette
//  de niveau. Tout le reste du jeu (team3d, roamers3d, arenas3d, battle3d,
//  hud3d) lit ses espèces ici et nulle part ailleurs.
//
//  Deux familles :
//
//   • les 26 créatures d'origine, LUES depuis la globale `CREATURES`
//     (js/creatures.js) et ENRICHIES par fusion. On ne recopie pas leur dessin,
//     leur nom, leur description ni leur taux de capture : si Robin retouche
//     `js/creatures.js`, le Pokédex 3D suit tout seul. `js/` n'est jamais modifié.
//     Un repli complet est fourni ici pour que le module reste chargeable seul
//     (test hors navigateur, ordre de scripts inattendu…).
//
//   • les 36 légendaires du §4 du CONTRACT2 : ids, noms, types et régions
//     repris à l'identique, 3 par type élémentaire, 6 par région.
//
//  ---------------------------------------------------------------------------
//  CAPACITÉS ATTENDUES DE `moves3d.js`  (écrit par un autre agent, en parallèle)
//  ---------------------------------------------------------------------------
//  Ce fichier référence les capacités par leur id. Deux catégories :
//
//  A. Les 40 ids HISTORIQUES de js/creatures.js, garantis par le contrat :
//     vite assaut force soin1 soin2 feuille soleil jetEau hydro flamme inferno
//     eclair tonnerre feerie luneEclat magie soinMagie dragon dragonRage aile
//     pince griffe morsure serre ronron calin bambou roulade rebond tentacule
//     poudre chant petale gland etoile etoileEx bec plumes nageoire bulle
//
//  B. Les ids NOUVEAUX que nous espérons trouver dans moves3d.js. Ils suivent
//     la convention du §7 (français, imagé, camelCase). Si l'autre agent les a
//     nommés autrement, `resolveMoves()` (plus bas) retombe automatiquement sur
//     une capacité du BON TYPE et du BON RÔLE via `moves.byType()` — un seul
//     console.warn, jamais d'exception. La liste, par type :
//
//     neutres : charge vitesse repos concentration esquive
//     feu     : crocBraise jetDeLave · coconBraise (soin) · souffleDuVolcan (signature)
//     eau     : torrent vagueDeferlante · sourceVive · deferlanteAbyssale
//     plante  : lianeFouet pluieDeGraines · roseeGuerisseuse · foretPrimordiale
//     foudre  : arcElectrique etincelleVive · rechargeVive · orageCeleste
//     glace   : flocon soufflePolaire grelon blizzard · haleineDeGivre · hiverEternel
//     air     : rafale tourbillon tempeteDeVent · brisePaisible · ouraganMajeur
//     terre   : coupDeTerre sableMouvant secousse seisme · terreNourriciere · failleTitanesque
//     roche   : jetDePierre eclatRocheux avalancheDePierres · carapaceDePierre · chuteDeMenhirs
//     lumiere : rayonDeLumiere eclatDore · lueurBienfaisante · jugementSolaire
//     ombre   : griffeSombre voileNoir morsureSombre abimeSombre · voileReparateur · nuitSansFin
//     temps   : sablier retourArriere ralentissement tempeteDuTemps · remonterLeTemps · fractureTemporelle
//     espace  : poussiereStellaire meteore gravite pluieDeMeteores · nebuleuseReparatrice · effondrementStellaire
//
//  Règle de conception : CHAQUE espèce possède au moins une capacité de soin
//  parmi ses 4 — Robin doit toujours pouvoir se soigner en combat.
// =============================================================================

(function () {
  'use strict';

  var ROOT = (typeof window !== 'undefined') ? window
           : (typeof globalThis !== 'undefined') ? globalThis : this;
  // Piège : `core3d.js` déclare `const R3 = ...;` au premier niveau d'un
  // <script> classique. Ce genre de déclaration NE devient JAMAIS une
  // propriété de `window`/`globalThis` (ni dans un vrai navigateur, ni sous
  // Node) — c'est une liaison purement lexicale, partagée uniquement avec
  // les <script> suivants de la même page (ou les chargements successifs
  // d'un même contexte `vm`). `ROOT.R3` est donc TOUJOURS `undefined` : il ne
  // faut jamais déclarer de variable locale nommée `R3` dans ce fichier (elle
  // masquerait par hoisting la vraie liaison), et la retrouver seulement via
  // `typeof R3 !== 'undefined' && R3`, comme le fait le reste de js3d/*.
  var R3mod = (typeof R3 !== 'undefined' && R3) ? R3 : null;

  // --- Les 12 types du §2 (aucun autre n'est autorisé) -----------------------
  var TYPE_IDS = ['feu', 'eau', 'plante', 'foudre', 'glace', 'air',
                  'terre', 'roche', 'lumiere', 'ombre', 'temps', 'espace'];

  // --- Les 6 régions du §3, avec la fourchette de niveau des rencontres ------
  // Elle sert à déduire minLevel/maxLevel de chaque espèce : une créature
  // présente dans plusieurs régions couvre l'union de leurs fourchettes.
  var REGION_LEVELS = {
    val:    [3, 8],
    sylve:  [9, 15],
    saphir: [16, 23],
    givre:  [24, 31],
    braise: [32, 40],
    aurore: [40, 50],
  };
  var REGION_IDS = ['val', 'sylve', 'saphir', 'givre', 'braise', 'aurore'];

  // ===========================================================================
  //  Table de secours des capacités : id -> "type role"
  //  `role` ∈ weak | mid | strong | signature | heal ; `type` ∈ les 12 + neutre.
  //  Elle sert uniquement quand moves3d.js ne connaît pas un id : on cherche
  //  alors une capacité équivalente du même type et du même rôle.
  // ===========================================================================
  var MOVE_SPEC = {
    // -- neutres --------------------------------------------------------------
    charge: 'neutre mid', vitesse: 'neutre weak', repos: 'neutre heal',
    concentration: 'neutre weak', esquive: 'neutre weak',
    // -- historiques (js/creatures.js) ---------------------------------------
    vite: 'neutre weak', assaut: 'neutre mid', force: 'neutre strong',
    soin1: 'neutre heal', soin2: 'neutre heal',
    griffe: 'neutre weak', morsure: 'neutre mid',
    ronron: 'neutre heal', calin: 'neutre heal', chant: 'neutre heal',
    feuille: 'plante mid', soleil: 'plante strong', bambou: 'plante mid',
    petale: 'plante mid', gland: 'plante weak', poudre: 'plante weak',
    jetEau: 'eau mid', hydro: 'eau strong', bulle: 'eau weak',
    nageoire: 'eau weak', tentacule: 'eau weak',
    flamme: 'feu mid', inferno: 'feu strong',
    eclair: 'foudre mid', tonnerre: 'foudre strong',
    feerie: 'lumiere mid', magie: 'lumiere mid', luneEclat: 'lumiere strong',
    soinMagie: 'lumiere heal', etoile: 'lumiere mid', etoileEx: 'lumiere strong',
    aile: 'air mid', serre: 'air mid', plumes: 'air mid', bec: 'air weak',
    rebond: 'air mid', dragon: 'air mid', dragonRage: 'air strong',
    pince: 'roche weak', roulade: 'roche mid',
    // -- nouvelles : feu ------------------------------------------------------
    crocBraise: 'feu mid', jetDeLave: 'feu mid',
    coconBraise: 'feu heal', souffleDuVolcan: 'feu signature',
    // -- nouvelles : eau ------------------------------------------------------
    torrent: 'eau mid', vagueDeferlante: 'eau mid',
    sourceVive: 'eau heal', deferlanteAbyssale: 'eau signature',
    // -- nouvelles : plante ---------------------------------------------------
    lianeFouet: 'plante mid', pluieDeGraines: 'plante mid',
    roseeGuerisseuse: 'plante heal', foretPrimordiale: 'plante signature',
    // -- nouvelles : foudre ---------------------------------------------------
    arcElectrique: 'foudre mid', etincelleVive: 'foudre weak',
    rechargeVive: 'foudre heal', orageCeleste: 'foudre signature',
    // -- nouvelles : glace ----------------------------------------------------
    flocon: 'glace weak', soufflePolaire: 'glace mid', grelon: 'glace mid',
    blizzard: 'glace strong', haleineDeGivre: 'glace heal',
    hiverEternel: 'glace signature',
    // -- nouvelles : air ------------------------------------------------------
    rafale: 'air weak', tourbillon: 'air mid', tempeteDeVent: 'air strong',
    brisePaisible: 'air heal', ouraganMajeur: 'air signature',
    // -- nouvelles : terre ----------------------------------------------------
    coupDeTerre: 'terre mid', sableMouvant: 'terre weak', secousse: 'terre mid',
    seisme: 'terre strong', terreNourriciere: 'terre heal',
    failleTitanesque: 'terre signature',
    // -- nouvelles : roche ----------------------------------------------------
    jetDePierre: 'roche weak', eclatRocheux: 'roche mid',
    avalancheDePierres: 'roche strong', carapaceDePierre: 'roche heal',
    chuteDeMenhirs: 'roche signature',
    // -- nouvelles : lumière --------------------------------------------------
    rayonDeLumiere: 'lumiere mid', eclatDore: 'lumiere mid',
    lueurBienfaisante: 'lumiere heal', jugementSolaire: 'lumiere signature',
    // -- nouvelles : ombre ----------------------------------------------------
    griffeSombre: 'ombre weak', voileNoir: 'ombre mid', morsureSombre: 'ombre mid',
    abimeSombre: 'ombre strong', voileReparateur: 'ombre heal',
    nuitSansFin: 'ombre signature',
    // -- nouvelles : temps ----------------------------------------------------
    sablier: 'temps weak', retourArriere: 'temps mid', ralentissement: 'temps mid',
    tempeteDuTemps: 'temps strong', remonterLeTemps: 'temps heal',
    fractureTemporelle: 'temps signature',
    // -- nouvelles : espace ---------------------------------------------------
    poussiereStellaire: 'espace weak', meteore: 'espace mid', gravite: 'espace mid',
    pluieDeMeteores: 'espace strong', nebuleuseReparatrice: 'espace heal',
    effondrementStellaire: 'espace signature',
  };

  // ===========================================================================
  //  LES 26 D'ORIGINE — enrichissement
  //  `fb` (fallback) ne sert QUE si `CREATURES` est absent : sinon nom,
  //  description, catchRate, couleur et draw viennent de js/creatures.js.
  // ===========================================================================
  var BASE_DATA = [
    {
      id: 'feuillou', types: ['plante'],
      regions: ['val', 'sylve'], biomes: ['forest', 'jungle', 'park'],
      hp: 45, atk: 35, def: 38, speed: 30,
      moveIds: ['assaut', 'feuille', 'soin1', 'soleil'],
      learnset: [{ level: 9, moveId: 'lianeFouet' }, { level: 17, moveId: 'petale' },
                 { level: 27, moveId: 'pluieDeGraines' }],
      fb: { name: 'Feuillou', color: '#38b764', catchRate: 0.85,
            description: 'Une feuille vivante toute mignonne.' },
    },
    {
      id: 'petalia', types: ['plante', 'lumiere'],
      regions: ['val', 'sylve', 'aurore'],
      biomes: ['forest', 'plain', 'park', 'jungle', 'celestial'],
      hp: 42, atk: 38, def: 32, speed: 40,
      moveIds: ['vite', 'petale', 'soin1', 'feerie'],
      learnset: [{ level: 11, moveId: 'rayonDeLumiere' }, { level: 20, moveId: 'lianeFouet' },
                 { level: 30, moveId: 'soleil' }],
      fb: { name: 'Pétalia', color: '#ffaad8', catchRate: 0.85,
            description: 'Une petite fleur magique qui sourit.' },
    },
    {
      id: 'goutella', types: ['eau'],
      regions: ['val', 'sylve', 'saphir', 'givre'],
      biomes: ['lake', 'swamp', 'beach', 'sea', 'glacier'],
      hp: 44, atk: 36, def: 34, speed: 38,
      moveIds: ['jetEau', 'assaut', 'soin1', 'hydro'],
      learnset: [{ level: 10, moveId: 'bulle' }, { level: 19, moveId: 'torrent' },
                 { level: 29, moveId: 'vagueDeferlante' }],
      fb: { name: 'Goutella', color: '#41a6f6', catchRate: 0.8,
            description: "Une goutte d'eau pleine de joie." },
    },
    {
      id: 'bullini', types: ['eau'],
      regions: ['val', 'sylve', 'saphir', 'givre'],
      biomes: ['lake', 'sea', 'swamp'],
      hp: 40, atk: 34, def: 30, speed: 45,
      moveIds: ['nageoire', 'bulle', 'soin1', 'hydro'],
      learnset: [{ level: 12, moveId: 'jetEau' }, { level: 22, moveId: 'torrent' }],
      fb: { name: 'Bullini', color: '#73eff7', catchRate: 0.8,
            description: 'Un petit poisson bulle facétieux.' },
    },
    {
      id: 'etincelo', types: ['foudre'],
      regions: ['val', 'sylve', 'braise', 'aurore'],
      biomes: ['plain', 'park', 'jungle', 'volcano', 'desert', 'celestial'],
      hp: 38, atk: 42, def: 28, speed: 52,
      moveIds: ['eclair', 'assaut', 'soin1', 'tonnerre'],
      learnset: [{ level: 9, moveId: 'etincelleVive' }, { level: 18, moveId: 'arcElectrique' },
                 { level: 31, moveId: 'force' }],
      fb: { name: 'Étincelo', color: '#f1c40f', catchRate: 0.75,
            description: 'Une étincelle dorée qui scintille.' },
    },
    {
      id: 'meduzia', types: ['eau', 'ombre'],
      regions: ['sylve', 'saphir'], biomes: ['sea', 'swamp'],
      hp: 46, atk: 40, def: 34, speed: 36,
      moveIds: ['tentacule', 'assaut', 'soin2', 'force'],
      learnset: [{ level: 14, moveId: 'voileNoir' }, { level: 24, moveId: 'jetEau' },
                 { level: 34, moveId: 'abimeSombre' }],
      fb: { name: 'Méduzia', color: '#d896ff', catchRate: 0.7,
            description: 'Une méduse rose qui flotte gracieusement.' },
    },
    {
      id: 'coralou', types: ['eau', 'roche'],
      regions: ['saphir'], biomes: ['sea', 'beach', 'coast'],
      hp: 48, atk: 38, def: 46, speed: 24,
      moveIds: ['pince', 'jetEau', 'soin1', 'force'],
      learnset: [{ level: 15, moveId: 'jetDePierre' }, { level: 25, moveId: 'eclatRocheux' },
                 { level: 35, moveId: 'avalancheDePierres' }],
      fb: { name: 'Coralou', color: '#fc7460', catchRate: 0.7,
            description: 'Un petit corail dansant.' },
    },
    {
      id: 'fluffly', types: ['air'],
      regions: ['val', 'sylve', 'saphir', 'givre', 'braise', 'aurore'],
      biomes: ['plain', 'forest', 'park', 'jungle', 'mountain', 'desert', 'beach'],
      hp: 50, atk: 36, def: 34, speed: 42,
      moveIds: ['vite', 'morsure', 'calin', 'rebond'],
      learnset: [{ level: 12, moveId: 'rafale' }, { level: 23, moveId: 'tourbillon' },
                 { level: 33, moveId: 'tempeteDeVent' }],
      fb: { name: 'Fluffly', color: '#fcef8d', catchRate: 0.85,
            description: 'Une boule de poil qui rebondit.' },
    },
    {
      id: 'glanou', types: ['plante', 'terre'],
      regions: ['val', 'sylve'], biomes: ['forest', 'jungle'],
      hp: 52, atk: 38, def: 48, speed: 22,
      moveIds: ['gland', 'feuille', 'soin1', 'soleil'],
      learnset: [{ level: 13, moveId: 'secousse' }, { level: 24, moveId: 'coupDeTerre' },
                 { level: 34, moveId: 'seisme' }],
      fb: { name: 'Glanou', color: '#8b5a2b', catchRate: 0.85,
            description: 'Un petit gland avec un chapeau rigolo.' },
    },
    {
      id: 'papillon', types: ['air', 'plante'],
      regions: ['val', 'sylve', 'braise', 'aurore'],
      biomes: ['forest', 'plain', 'park', 'jungle', 'desert', 'celestial'],
      hp: 40, atk: 36, def: 30, speed: 50,
      moveIds: ['aile', 'poudre', 'soin2', 'feerie'],
      learnset: [{ level: 12, moveId: 'rafale' }, { level: 21, moveId: 'petale' },
                 { level: 32, moveId: 'tempeteDeVent' }],
      fb: { name: 'Papillon', color: '#d896ff', catchRate: 0.7,
            description: 'Un papillon aux ailes rose et violet.' },
    },
    {
      id: 'cygnik', types: ['eau', 'air'],
      regions: ['val', 'saphir', 'givre'], biomes: ['lake', 'sea', 'glacier'],
      hp: 52, atk: 44, def: 40, speed: 44,
      moveIds: ['aile', 'serre', 'chant', 'hydro'],
      learnset: [{ level: 14, moveId: 'tourbillon' }, { level: 26, moveId: 'vagueDeferlante' },
                 { level: 36, moveId: 'tempeteDeVent' }],
      fb: { name: 'Cygnik', color: '#f4f4f4', catchRate: 0.65,
            description: "Un cygne gracieux qui glisse sur l'eau." },
    },
    {
      id: 'lotira', types: ['plante', 'eau'],
      regions: ['val', 'sylve'], biomes: ['lake', 'swamp'],
      hp: 46, atk: 34, def: 42, speed: 30,
      moveIds: ['petale', 'jetEau', 'soin2', 'soleil'],
      learnset: [{ level: 13, moveId: 'lianeFouet' }, { level: 25, moveId: 'torrent' }],
      fb: { name: 'Lotira', color: '#ffaad8', catchRate: 0.8,
            description: 'Un nénuphar enchanté tout rose.' },
    },
    {
      id: 'lapinou', types: ['terre'],
      regions: ['val', 'givre', 'braise', 'aurore'],
      biomes: ['plain', 'park', 'glacier', 'desert', 'celestial'],
      hp: 44, atk: 34, def: 32, speed: 54,
      moveIds: ['vite', 'assaut', 'calin', 'rebond'],
      learnset: [{ level: 11, moveId: 'sableMouvant' }, { level: 22, moveId: 'secousse' },
                 { level: 33, moveId: 'seisme' }],
      fb: { name: 'Lapinou', color: '#f4f4f4', catchRate: 0.85,
            description: 'Un petit lapin tout doux avec de grandes oreilles.' },
    },
    {
      id: 'hibouche', types: ['air', 'ombre'],
      regions: ['val', 'sylve', 'givre', 'braise', 'aurore'],
      biomes: ['forest', 'plain', 'park', 'jungle', 'mountain', 'desert', 'celestial'],
      hp: 50, atk: 44, def: 38, speed: 42,
      moveIds: ['assaut', 'serre', 'soin1', 'force'],
      learnset: [{ level: 13, moveId: 'griffeSombre' }, { level: 24, moveId: 'tourbillon' },
                 { level: 35, moveId: 'abimeSombre' }],
      fb: { name: 'Hibouché', color: '#8b5a2b', catchRate: 0.75,
            description: 'Un hibou aux yeux immenses.' },
    },
    {
      id: 'etoilamer', types: ['eau', 'lumiere'],
      regions: ['saphir'], biomes: ['sea', 'beach', 'coast'],
      hp: 42, atk: 36, def: 40, speed: 28,
      moveIds: ['etoile', 'pince', 'soin1', 'etoileEx'],
      learnset: [{ level: 16, moveId: 'jetEau' }, { level: 27, moveId: 'rayonDeLumiere' }],
      fb: { name: 'Étoilamer', color: '#ff6b9d', catchRate: 0.85,
            description: 'Une étoile de mer souriante.' },
    },
    {
      id: 'crabilino', types: ['eau', 'roche'],
      regions: ['saphir', 'braise'], biomes: ['sea', 'beach', 'coast', 'volcano'],
      hp: 50, atk: 46, def: 50, speed: 26,
      moveIds: ['pince', 'assaut', 'soin1', 'force'],
      learnset: [{ level: 17, moveId: 'jetDePierre' }, { level: 28, moveId: 'bulle' },
                 { level: 38, moveId: 'avalancheDePierres' }],
      fb: { name: 'Crabilino', color: '#e74c3c', catchRate: 0.7,
            description: 'Un crabe rouge qui fait clic-clac.' },
    },
    {
      id: 'nuagette', types: ['air', 'lumiere'],
      regions: ['val', 'sylve', 'saphir', 'givre', 'braise', 'aurore'],
      biomes: ['forest', 'plain', 'lake', 'park', 'sea', 'beach', 'jungle',
               'swamp', 'mountain', 'glacier', 'volcano', 'desert', 'celestial'],
      hp: 55, atk: 48, def: 42, speed: 50,
      moveIds: ['feerie', 'assaut', 'soin2', 'luneEclat'],
      learnset: [{ level: 15, moveId: 'rafale' }, { level: 26, moveId: 'rayonDeLumiere' },
                 { level: 38, moveId: 'tempeteDeVent' }],
      fb: { name: 'Nuagette', color: '#f4f4f4', catchRate: 0.5,
            description: '✦ Un esprit nuage très très rare ! ✦' },
    },
    {
      id: 'miaouche', types: ['lumiere'],
      regions: ['val', 'sylve', 'saphir', 'givre', 'braise', 'aurore'],
      biomes: ['village', 'city', 'city2', 'citadel', 'plain', 'park'],
      hp: 44, atk: 40, def: 32, speed: 48,
      moveIds: ['griffe', 'morsure', 'ronron', 'force'],
      learnset: [{ level: 12, moveId: 'eclatDore' }, { level: 23, moveId: 'feerie' },
                 { level: 34, moveId: 'etoileEx' }],
      fb: { name: 'Miaouche', color: '#f4f4f4', catchRate: 0.85,
            description: 'Un adorable petit chat aux yeux immenses.' },
    },
    {
      id: 'pandouki', types: ['plante', 'terre'],
      regions: ['val', 'sylve', 'givre'], biomes: ['forest', 'mountain', 'jungle'],
      hp: 60, atk: 46, def: 50, speed: 26,
      moveIds: ['assaut', 'bambou', 'calin', 'roulade'],
      learnset: [{ level: 14, moveId: 'secousse' }, { level: 25, moveId: 'lianeFouet' },
                 { level: 36, moveId: 'seisme' }],
      fb: { name: 'Pandouki', color: '#f4f4f4', catchRate: 0.8,
            description: 'Un panda tout rond et doux.' },
    },
    {
      id: 'koronette', types: ['lumiere'],
      regions: ['val', 'aurore'], biomes: ['park', 'forest', 'plain', 'celestial'],
      hp: 48, atk: 46, def: 38, speed: 46,
      moveIds: ['feerie', 'magie', 'soinMagie', 'luneEclat'],
      learnset: [{ level: 14, moveId: 'rayonDeLumiere' }, { level: 26, moveId: 'eclatDore' },
                 { level: 40, moveId: 'etoileEx' }],
      fb: { name: 'Koronette', color: '#d896ff', catchRate: 0.7,
            description: 'Une fée couronnée qui répand des étoiles magiques.' },
    },
    {
      id: 'stellini', types: ['lumiere', 'espace'],
      regions: ['val', 'givre', 'braise', 'aurore'],
      biomes: ['plain', 'park', 'village', 'celestial', 'glacier', 'desert'],
      hp: 46, atk: 42, def: 34, speed: 50,
      moveIds: ['etoile', 'feerie', 'soin1', 'etoileEx'],
      learnset: [{ level: 15, moveId: 'poussiereStellaire' }, { level: 27, moveId: 'meteore' },
                 { level: 40, moveId: 'pluieDeMeteores' }],
      fb: { name: 'Stellini', color: '#f1c40f', catchRate: 0.75,
            description: 'Un lapin-étoile tout doré et scintillant.' },
    },
    {
      id: 'doudoune', types: ['air'],
      regions: ['val', 'saphir', 'givre', 'braise', 'aurore'],
      biomes: ['forest', 'plain', 'village', 'beach', 'mountain'],
      hp: 42, atk: 32, def: 34, speed: 36,
      moveIds: ['bec', 'plumes', 'chant', 'assaut'],
      learnset: [{ level: 12, moveId: 'rafale' }, { level: 24, moveId: 'tourbillon' },
                 { level: 35, moveId: 'tempeteDeVent' }],
      fb: { name: 'Doudoune', color: '#f1c40f', catchRate: 0.85,
            description: 'Un poussin duveteux tout rond et tout doux.' },
    },
    // --- les 4 dragons : plus forts, plus rares ------------------------------
    {
      id: 'flamdrak', types: ['feu', 'air'],
      regions: ['braise'], biomes: ['volcano', 'mountain'],
      hp: 75, atk: 62, def: 52, speed: 54,
      moveIds: ['flamme', 'morsure', 'soin1', 'inferno'],
      learnset: [{ level: 20, moveId: 'crocBraise' }, { level: 32, moveId: 'aile' },
                 { level: 44, moveId: 'jetDeLave' }],
      fb: { name: 'Flamdrak', color: '#e74c3c', catchRate: 0.55,
            description: '✦ Un petit dragon de feu aux cornes fières. ✦' },
    },
    {
      id: 'glydrak', types: ['glace', 'air'],
      regions: ['givre', 'braise', 'aurore'],
      biomes: ['mountain', 'glacier', 'celestial'],
      hp: 82, atk: 68, def: 56, speed: 60,
      moveIds: ['aile', 'dragon', 'soin1', 'dragonRage'],
      learnset: [{ level: 22, moveId: 'flocon' }, { level: 34, moveId: 'soufflePolaire' },
                 { level: 46, moveId: 'blizzard' }],
      fb: { name: 'Glydrak', color: '#5d275d', catchRate: 0.4,
            description: '✦ Un dragon ailé au regard perçant et mystérieux. ✦' },
    },
    {
      id: 'aquadrak', types: ['eau', 'air'],
      regions: ['val', 'saphir'], biomes: ['lake', 'sea'],
      hp: 78, atk: 60, def: 58, speed: 52,
      moveIds: ['jetEau', 'dragon', 'soin2', 'hydro'],
      learnset: [{ level: 18, moveId: 'torrent' }, { level: 30, moveId: 'tourbillon' },
                 { level: 42, moveId: 'vagueDeferlante' }],
      fb: { name: 'Aquadrak', color: '#1abc9c', catchRate: 0.5,
            description: '✦ Un dragon des eaux aux écailles turquoise. ✦' },
    },
    {
      id: 'tonnedrak', types: ['foudre', 'air'],
      regions: ['sylve', 'braise', 'aurore'],
      biomes: ['mountain', 'plain', 'jungle', 'volcano', 'celestial'],
      hp: 80, atk: 66, def: 54, speed: 64,
      moveIds: ['eclair', 'dragon', 'soin1', 'dragonRage'],
      learnset: [{ level: 20, moveId: 'arcElectrique' }, { level: 33, moveId: 'tourbillon' },
                 { level: 45, moveId: 'tonnerre' }],
      fb: { name: 'Tonnedrak', color: '#f1c40f', catchRate: 0.4,
            description: '✦ Un dragon électrique aux crêtes en éclair ! ✦' },
    },
  ];

  // ===========================================================================
  //  LES 36 LÉGENDAIRES — table du §4, reprise à l'identique
  //  (ids, noms accentués, type unique, région : ne rien changer ici sans
  //   changer le contrat, les 3 lots legend3d.pN.js s'alignent dessus.)
  //  Chacun porte, comme 4ᵉ capacité, la SIGNATURE de son type.
  // ===========================================================================
  var L = function (id, name, type, region, biomes, color, catchRate,
                    hp, atk, def, speed, mid, description) {
    return { id: id, name: name, types: [type], region: region, biomes: biomes,
             color: color, catchRate: catchRate, hp: hp, atk: atk, def: def,
             speed: speed, mid: mid, description: description };
  };

  // ===========================================================================
  //  LE TITRE DE CHAQUE LÉGENDAIRE
  //  « XERNEAS, le Cerf de Vie » au lieu de « Xerneas ». Les IDS, eux, ne
  //  bougent JAMAIS : ce sont ceux du contrat, ils sont écrits dans la
  //  sauvegarde de Robin, et les 36 modèles 3D de `legend3d.pN.js` s'y
  //  enregistrent. Un titre à part permet de nommer sans toucher aux ids.
  //  Les mots restent ceux des descriptions ci-dessous et des indices de quête
  //  de quest3d.js (« une fée-fleur, un colosse de racines, un griffon des
  //  cimes… ») : un enfant qui lit l'indice doit reconnaître la créature.
  //
  //  ⚠️ 2026-08-08 — LES NOMS SONT DEVENUS DE VRAIS NOMS DE POKÉMON, comme
  //  dans le jeu de Clélia. Le nom d'affichage a changé, l'id n'a pas bougé :
  //  `pyrathos` s'appelle Groudon, `sylvaros` s'appelle Xerneas, etc. Le choix
  //  de chaque nom suit L'APPARENCE DÉJÀ DESSINÉE en 3D avant le type, parce
  //  que c'est le modèle que Robin voit : le cerf est Xerneas, la panthère est
  //  Mewtwo, le long ruban de vent est Rayquaza. La table complète des
  //  anciens noms vit dans `LEGACY_NAMES` ci-dessous — elle sert à réparer les
  //  surnoms figés dans une partie commencée avant ce changement.
  // ===========================================================================
  var LEGEND_TITLES = {
    // feu — Caldeira de Braise
    pyrathos: 'le Colosse du Magma',
    emberyx: 'le Phénix Arc-en-ciel',
    fournalis: 'le Lion de Feu',
    // eau — Côte de Saphir
    abyssalor: 'le Léviathan des Abysses',
    ondinae: 'le Vent du Nord',
    marea: 'le Gardien des Marées',
    // plante — Val d'Émeraude
    sylvaros: 'le Cerf de Vie',
    florabelle: 'la Fleur des Prairies',
    racinor: 'le Colosse Endormi',
    // foudre
    fulguron: "l'Oiseau de Foudre",
    voltaris: 'le Félin de Foudre',
    orageon: "le Génie de l'Orage",
    // glace — Massif de Givre
    cryonix: 'le Dragon des Glaces',
    givrea: 'la Monture des Neiges',
    banquisor: 'le Colosse de Banquise',
    // air
    bourrasca: 'le Génie des Cimes',
    zephyrion: 'le Ruban du Ciel',
    aelune: 'le Croissant de Lune',
    // terre
    geomastre: 'la Tortue de Cristal',
    terracor: 'le Titan des Terres',
    limonis: 'le Golem de Pierre',
    // roche
    monolithe: 'le Gardien des Menhirs',
    cristallia: 'la Princesse de Cristal',
    obsidion: 'la Panthère la Plus Puissante',
    // lumière — Plateau d'Aurore
    aureol: "le Cercle d'Or",
    solaria: 'l\'Oiseau de Flamme',
    prismee: "l'Étoile aux Souhaits",
    // ombre
    nyxaroth: 'le Loup des Ténèbres',
    penombra: 'le Petit Fantôme',
    eclipsion: "l'Oiseau d'Éclipse",
    // temps
    chronoss: 'le Maître du Temps',
    eternia: 'la Voyageuse du Temps',
    sablion: "le Serpent de l'Autre Monde",
    // espace
    vortexis: "le Maître de l'Espace",
    astralis: 'le Dragon Infini',
    nebulon: 'le Voile de Nébuleuse',
  };

  // ===========================================================================
  //  LES ANCIENS NOMS (avant le 2026-08-08)
  //  Ils ne servent qu'à UNE chose : `team3d.js` fige le nom de la créature
  //  dans son `nick` au moment de la capture. Un légendaire attrapé avant ce
  //  changement s'appellerait donc encore « Pyrathos » dans l'équipe et dans la
  //  boîte, alors que le Pokédex, lui, dirait « Groudon » — deux noms pour la
  //  même bête, dans la même partie. `team3d.deserialize()` consulte cette
  //  table pour rebaptiser SEULEMENT les créatures qui n'ont jamais été
  //  renommées à la main : un surnom choisi par Robin reste intouchable.
  // ===========================================================================
  var LEGACY_NAMES = {
    pyrathos: ['Pyrathos'], emberyx: ['Emberyx'], fournalis: ['Fournalis'],
    abyssalor: ['Abyssalor'], ondinae: ['Ondinaë'], marea: ['Maréa'],
    sylvaros: ['Sylvaros'], florabelle: ['Florabelle'], racinor: ['Racinor'],
    fulguron: ['Fulguron'], voltaris: ['Voltaris'], orageon: ['Orageon'],
    cryonix: ['Cryonix'], givrea: ['Givréa'], banquisor: ['Banquisor'],
    bourrasca: ['Bourrasca'], zephyrion: ['Zéphyrion'], aelune: ['Aélune'],
    geomastre: ['Géomastre'], terracor: ['Terracor'], limonis: ['Limonis'],
    monolithe: ['Monolithe'], cristallia: ['Cristallia'], obsidion: ['Obsidion'],
    aureol: ['Auréol'], solaria: ['Solaria'], prismee: ['Prismée'],
    nyxaroth: ['Nyxaroth'], penombra: ['Pénombra'], eclipsion: ['Éclipsion'],
    chronoss: ['Chronoss'], eternia: ['Éternia'], sablion: ['Sablion'],
    vortexis: ['Vortexis'], astralis: ['Astralis'], nebulon: ['Nébulon'],
  };

  /** Ce surnom est-il simplement l'ancien nom de cette espèce ? */
  function isLegacyName(speciesId, nick) {
    var anciens = LEGACY_NAMES[speciesId];
    if (!anciens || !nick) return false;
    return anciens.indexOf(String(nick)) >= 0;
  }

  // Pour chaque type : [attaque forte, soin, signature] + la liste des 3 mid
  // utilisées à tour de rôle par les 3 légendaires (pour qu'ils ne se
  // ressemblent pas tous en combat).
  var TYPE_KIT = {
    feu:     { strong: 'inferno',            heal: 'coconBraise',          sign: 'souffleDuVolcan' },
    eau:     { strong: 'hydro',              heal: 'sourceVive',           sign: 'deferlanteAbyssale' },
    plante:  { strong: 'soleil',             heal: 'roseeGuerisseuse',     sign: 'foretPrimordiale' },
    foudre:  { strong: 'tonnerre',           heal: 'rechargeVive',         sign: 'orageCeleste' },
    glace:   { strong: 'blizzard',           heal: 'haleineDeGivre',       sign: 'hiverEternel' },
    air:     { strong: 'tempeteDeVent',      heal: 'brisePaisible',        sign: 'ouraganMajeur' },
    terre:   { strong: 'seisme',             heal: 'terreNourriciere',     sign: 'failleTitanesque' },
    roche:   { strong: 'avalancheDePierres', heal: 'carapaceDePierre',     sign: 'chuteDeMenhirs' },
    lumiere: { strong: 'etoileEx',           heal: 'lueurBienfaisante',    sign: 'jugementSolaire' },
    ombre:   { strong: 'abimeSombre',        heal: 'voileReparateur',      sign: 'nuitSansFin' },
    temps:   { strong: 'tempeteDuTemps',     heal: 'remonterLeTemps',      sign: 'fractureTemporelle' },
    espace:  { strong: 'pluieDeMeteores',    heal: 'nebuleuseReparatrice', sign: 'effondrementStellaire' },
  };
  // Capacité « moyenne » de repli quand on veut varier : une par légendaire.
  var TYPE_MIDS = {
    feu:     ['jetDeLave', 'crocBraise', 'flamme'],
    eau:     ['torrent', 'jetEau', 'vagueDeferlante'],
    plante:  ['lianeFouet', 'petale', 'pluieDeGraines'],
    foudre:  ['arcElectrique', 'etincelleVive', 'eclair'],
    glace:   ['soufflePolaire', 'flocon', 'grelon'],
    air:     ['rafale', 'tourbillon', 'aile'],
    terre:   ['secousse', 'coupDeTerre', 'sableMouvant'],
    roche:   ['jetDePierre', 'eclatRocheux', 'roulade'],
    lumiere: ['rayonDeLumiere', 'eclatDore', 'etoile'],
    ombre:   ['griffeSombre', 'voileNoir', 'morsureSombre'],
    temps:   ['ralentissement', 'sablier', 'retourArriere'],
    espace:  ['gravite', 'meteore', 'poussiereStellaire'],
  };

  var LEGEND_DATA = [
    // --- feu (Caldeira de Braise) -------------------------------------------
    L('pyrathos', 'Groudon', 'feu', 'braise', ['volcano', 'mountain'], '#c0392b', 0.05,
      150, 110, 95, 85, 0,
      "On raconte qu'il dort au cœur du volcan et que chaque éruption n'est qu'un de ses bâillements. Ses ailes de braise éclairent la nuit comme un second soleil."),
    L('emberyx', 'Ho-Oh', 'feu', 'braise', ['volcano', 'ash', 'mountain'], '#ff8c42', 0.06,
      120, 105, 80, 110, 1,
      "Tous les cent ans, Ho-Oh brûle entièrement et renaît de ses cendres. Sa traîne de sept couleurs dessine dans le ciel la route des voyageurs perdus."),
    L('fournalis', 'Entei', 'feu', 'braise', ['desert', 'volcano'], '#e25822', 0.07,
      135, 108, 90, 88, 2,
      "Son rugissement fait trembler toute la caldeira. Sa crinière de lave ne s'éteint jamais, pas même sous les pluies d'orage."),
    // --- eau (Côte de Saphir) -----------------------------------------------
    L('abyssalor', 'Kyogre', 'eau', 'saphir', ['sea', 'coast'], '#123a6b', 0.05,
      155, 108, 100, 80, 0,
      "Il vit si profond que personne ne l'a jamais vu en entier. Les marins jurent que les grandes vagues ne sont que ses soupirs."),
    L('ondinae', 'Suicune', 'eau', 'saphir', ['coast', 'beach', 'sea'], '#73eff7', 0.08,
      115, 95, 85, 112, 1,
      "Né de l'écume d'une tempête, il court sur les vagues et calme la mer d'un simple regard. Là où il passe, l'eau redevient claire."),
    L('marea', 'Lugia', 'eau', 'saphir', ['sea', 'coast'], '#2f7fb8', 0.07,
      130, 98, 92, 100, 2,
      "C'est lui qui règne sur les marées : quand il bat des ailes, l'océan se retire, puis revient sur la pointe des pieds."),
    // --- plante (Val d'Émeraude) --------------------------------------------
    L('sylvaros', 'Xerneas', 'plante', 'val', ['forest', 'park'], '#1e8449', 0.06,
      145, 100, 105, 75, 0,
      "Le plus vieux cerf du monde. On dit que chaque arbre du Val d'Émeraude a poussé dans l'empreinte d'un de ses pas."),
    L('florabelle', 'Shaymin', 'plante', 'val', ['park', 'forest', 'plain'], '#ff6b9d', 0.09,
      110, 92, 82, 108, 1,
      "Là où elle passe, les fleurs s'ouvrent même au cœur de l'hiver. Sa robe de pétales ne se fane jamais."),
    L('racinor', 'Regigigas', 'plante', 'val', ['forest'], '#5c3a1e', 0.06,
      160, 105, 115, 55, 2,
      "Un colosse de racines tressées qui dort mille ans d'affilée, puis se lève une seule journée pour replanter les forêts brûlées."),
    // --- foudre (Sylve d'Ambre + Côte de Saphir) ----------------------------
    L('fulguron', 'Électhor', 'foudre', 'sylve', ['jungle', 'forest'], '#f1c40f', 0.06,
      125, 110, 85, 120, 0,
      "Ses ailes sont deux éclairs arrêtés en plein vol. Un seul battement, et l'orage éclate au-dessus de la jungle."),
    L('voltaris', 'Raikou', 'foudre', 'sylve', ['jungle', 'swamp'], '#f1c40f', 0.07,
      120, 112, 82, 118, 1,
      "Il court plus vite que la foudre — en vérité, c'est la foudre qui essaie de le rattraper."),
    L('orageon', 'Boréas', 'foudre', 'saphir', ['sea', 'coast'], '#566c86', 0.07,
      135, 105, 95, 95, 2,
      "Ce nuage à visage suit les bateaux de pêche et laisse tomber de grosses gouttes tièdes sur les enfants sages."),
    // --- glace (Massif de Givre) --------------------------------------------
    L('cryonix', 'Kyurem', 'glace', 'givre', ['glacier', 'mountain'], '#a8e6ff', 0.05,
      150, 112, 100, 85, 0,
      "Son souffle a creusé toutes les grottes de glace du Massif. Ses ailes de cristal chantent quand le vent les traverse."),
    L('givrea', 'Blizzeval', 'glace', 'givre', ['glacier'], '#e8f4f8', 0.09,
      115, 92, 88, 110, 1,
      "Monture de givre aux bois de cristal : elle laisse derrière elle un sentier de flocons tous parfaitement identiques."),
    L('banquisor', 'Regice', 'glace', 'givre', ['glacier', 'mountain'], '#f4f4f4', 0.06,
      165, 105, 118, 58, 2,
      "Il porte la banquise sur son dos. Quand il se retourne dans son sommeil, les glaciers craquent d'un bout à l'autre du Massif."),
    // --- air (Val, Saphir, Givre) -------------------------------------------
    L('bourrasca', 'Fulguris', 'air', 'val', ['mountain', 'plain'], '#bfe3f2', 0.08,
      125, 102, 88, 115, 0,
      "Génie des cimes, il a bâti son nid dans le vent lui-même. On raconte qu'il n'a jamais posé une seule patte au sol."),
    L('zephyrion', 'Rayquaza', 'air', 'saphir', ['coast', 'beach'], '#cfe8f3', 0.08,
      118, 95, 82, 125, 1,
      "Long ruban de vent, il fait le tour de la côte en une nuit pour rapporter les nouvelles aux mouettes."),
    L('aelune', 'Cresselia', 'air', 'givre', ['mountain', 'glacier'], '#e6f1f7', 0.08,
      122, 94, 90, 112, 2,
      "Croissant de lune au voile translucide, elle nage dans le ciel des nuits claires comme d'autres nagent dans la mer."),
    // --- terre (Sylve, Braise) ----------------------------------------------
    L('geomastre', 'Terapagos', 'terre', 'sylve', ['swamp', 'jungle'], '#7a5c3a', 0.06,
      168, 100, 125, 50, 0,
      "Sa carapace est un plateau où poussent des arbres entiers. Certains villages en ont fait une carte, puis se sont perdus quand il a bougé."),
    L('terracor', 'Démétéros', 'terre', 'braise', ['desert', 'volcano'], '#c08c4a', 0.06,
      150, 115, 105, 65, 1,
      "Titan des terres craquelées : on dit que ses galeries relient secrètement les six régions entre elles."),
    L('limonis', 'Regirock', 'terre', 'sylve', ['swamp', 'jungle'], '#a97b50', 0.09,
      140, 95, 108, 60, 2,
      "Golem de pierre né d'un marécage très patient. Chaque printemps, il répare les berges que les orages ont emportées."),
    // --- roche (Aurore, Givre, Braise) --------------------------------------
    L('monolithe', 'Registeel', 'roche', 'aurore', ['celestial', 'mountain'], '#8a9199', 0.05,
      160, 108, 130, 48, 0,
      "Douze menhirs tournent autour de lui depuis la nuit des temps. On pense qu'ils comptent les années à sa place."),
    L('cristallia', 'Diancie', 'roche', 'givre', ['glacier', 'mountain'], '#d896ff', 0.07,
      130, 98, 112, 80, 1,
      "Princesse de cristal du Massif : quand le soleil traverse ses bois, la neige tout entière se couvre d'arcs-en-ciel."),
    L('obsidion', 'Mewtwo', 'roche', 'braise', ['volcano', 'mountain'], '#1a1c2c', 0.06,
      135, 118, 100, 95, 2,
      "Panthère d'obsidienne aux veines de lave. Elle chasse dans le noir complet, et l'on jure que le noir a peur d'elle."),
    // --- lumière (Aurore, Braise, Val) --------------------------------------
    L('aureol', 'Arceus', 'lumiere', 'aurore', ['celestial', 'mountain'], '#ffe066', 0.05,
      145, 112, 98, 100, 0,
      "Gardien du Plateau d'Aurore. Son cercle d'or se lève chaque matin quelques minutes avant le soleil, pour lui montrer le chemin."),
    L('solaria', 'Sulfura', 'lumiere', 'braise', ['volcano', 'desert'], '#fff4d6', 0.06,
      130, 115, 90, 105, 1,
      "Oiseau de lumière pure : ses plumes sont de vrais rayons. Là où il se pose, les ombres s'écartent poliment."),
    L('prismee', 'Jirachi', 'lumiere', 'val', ['forest', 'park', 'plain'], '#f4f4f4', 0.10,
      105, 88, 80, 115, 2,
      "Étoile aux souhaits du Val d'Émeraude. Chacune de ses ailes contient un arc-en-ciel entier, soigneusement plié en huit."),
    // --- ombre (Sylve, Val, Givre) ------------------------------------------
    L('nyxaroth', 'Zacian', 'ombre', 'sylve', ['jungle', 'swamp'], '#2a2438', 0.05,
      138, 118, 92, 105, 0,
      "Loup des ténèbres de la Sylve. La fumée à ses pattes efface ses traces avant même qu'il ait fini de les laisser."),
    L('penombra', 'Marshadow', 'ombre', 'val', ['forest', 'village', 'park'], '#4a3d6b', 0.12,
      100, 85, 78, 112, 1,
      "Petit fantôme du Val d'Émeraude. Il se cache dans les ombres et rassure, sans un bruit, les voyageurs qui se sont perdus en forêt."),
    L('eclipsion', 'Yveltal', 'ombre', 'givre', ['mountain', 'glacier'], '#1a1c2c', 0.07,
      128, 105, 90, 108, 2,
      "Oiseau d'éclipse : quand il déploie l'anneau noir de son dos, le jour s'accorde une minute de nuit."),
    // --- temps (Aurore, Sylve) ----------------------------------------------
    L('chronoss', 'Dialga', 'temps', 'aurore', ['celestial'], '#d896ff', 0.05,
      155, 105, 120, 55, 0,
      "Maître du temps du Plateau. Il avance d'un pas par heure, et l'heure, patiemment, l'attend."),
    L('eternia', 'Celebi', 'temps', 'aurore', ['celestial', 'mountain'], '#e3c68d', 0.04,
      148, 112, 105, 90, 1,
      "Voyageuse du temps aux sabliers suspendus. Elle pose une question par siècle, et connaît déjà la réponse depuis le siècle d'avant."),
    L('sablion', 'Giratina', 'temps', 'sylve', ['swamp', 'jungle'], '#e3c68d', 0.08,
      132, 102, 95, 98, 2,
      "Serpent de l'autre monde dont le corps s'écoule sans jamais s'épuiser, exactement comme le temps. On l'aperçoit surtout au crépuscule."),
    // --- espace (Aurore, Saphir) --------------------------------------------
    L('vortexis', 'Palkia', 'espace', 'aurore', ['celestial'], '#4b62d9', 0.05,
      140, 115, 95, 105, 0,
      "Maître de l'espace : la spirale d'étoiles sur son dos est une véritable galaxie, en tout petit. À moins que ce ne soit nous qui soyons petits."),
    L('astralis', 'Eternatus', 'espace', 'aurore', ['celestial', 'mountain'], '#29366f', 0.04,
      170, 118, 110, 70, 1,
      "Dragon infini qui traverse lentement le ciel d'Aurore. Les constellations dessinées sur son dos changent toutes les nuits."),
    L('nebulon', 'Lunala', 'espace', 'saphir', ['sea', 'coast'], '#7a5cbf', 0.08,
      126, 100, 92, 104, 2,
      "Voile de nébuleuse dérivant au-dessus de la mer de Saphir : son manteau de gaz coloré éclaire les nuits sans lune."),
  ];

  // ===========================================================================
  //  Construction des espèces
  // ===========================================================================

  // Récupère la table 2D d'origine, si elle est chargée.
  function sourceCreatures() {
    var arr = null;
    if (typeof CREATURES !== 'undefined' && CREATURES) arr = CREATURES;
    else if (ROOT && ROOT.CREATURES) arr = ROOT.CREATURES;
    if (!arr || typeof arr.length !== 'number') return null;
    var byId = {};
    for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].id) byId[arr[i].id] = arr[i];
    return byId;
  }

  // Fourchette de niveaux déduite des régions où l'espèce apparaît.
  function levelRange(regions) {
    var lo = 99, hi = 1;
    for (var i = 0; i < regions.length; i++) {
      var r = REGION_LEVELS[regions[i]];
      if (!r) continue;
      if (r[0] < lo) lo = r[0];
      if (r[1] > hi) hi = r[1];
    }
    if (lo > hi) { lo = 3; hi = 8; }
    return [lo, hi];
  }

  function buildBase() {
    var src = sourceCreatures();
    var out = [];
    for (var i = 0; i < BASE_DATA.length; i++) {
      var d = BASE_DATA[i];
      var o = src ? src[d.id] : null;      // l'original 2D, s'il existe
      var lr = levelRange(d.regions);
      out.push({
        id: d.id,
        // Nom / description / catchRate / couleur / dessin viennent du jeu 2D
        // quand il est là : c'est lui qui fait foi, pour ne jamais diverger.
        name: (o && o.name) || d.fb.name,
        description: (o && o.description) || d.fb.description,
        catchRate: (o && typeof o.catchRate === 'number') ? o.catchRate : d.fb.catchRate,
        color: (o && o.color) || d.fb.color,
        draw: (o && typeof o.draw === 'function') ? o.draw : null,
        types: d.types.slice(),
        legendary: false,
        rare: !!(o && o.rare),
        dragon: !!(o && o.dragon),
        kawaii: !!(o && o.kawaii),
        regions: d.regions.slice(),
        biomes: d.biomes.slice(),
        baseHp: d.hp, atk: d.atk, def: d.def, speed: d.speed,
        moveIds: d.moveIds.slice(),
        learnset: d.learnset.map(function (e) { return { level: e.level, moveId: e.moveId }; }),
        minLevel: lr[0], maxLevel: lr[1],
      });
    }
    return out;
  }

  function buildLegends() {
    var out = [];
    for (var i = 0; i < LEGEND_DATA.length; i++) {
      var d = LEGEND_DATA[i];
      var type = d.types[0];
      var kit = TYPE_KIT[type];
      var mids = TYPE_MIDS[type];
      var mid = mids[d.mid % mids.length];
      var other = mids[(d.mid + 1) % mids.length];
      var rl = REGION_LEVELS[d.region] || [40, 50];
      // On rencontre un légendaire un peu au-dessus du niveau de sa région.
      var lo = rl[1] + 4, hi = Math.min(60, rl[1] + 9);
      out.push({
        id: d.id, name: d.name,
        // Titre honorifique, affiché à côté du nom (combat, Pokédex, journal).
        // Vide pour une créature ordinaire : seuls les 36 en ont un.
        title: LEGEND_TITLES[d.id] || '',
        types: [type],
        legendary: true,
        rare: true, dragon: false, kawaii: false,
        regions: [d.region],
        biomes: d.biomes.slice(),
        description: d.description,
        catchRate: d.catchRate,
        baseHp: d.hp, atk: d.atk, def: d.def, speed: d.speed,
        // [attaque du type, attaque forte, soin du type, SIGNATURE]
        moveIds: [mid, kit.strong, kit.heal, kit.sign],
        learnset: [
          { level: lo + 3, moveId: 'concentration' },
          { level: lo + 9, moveId: other },
          { level: Math.min(60, lo + 16), moveId: 'force' },
        ],
        color: d.color,
        draw: null,                 // pas de dessin 2D : vignette rendue en 3D
        minLevel: lo, maxLevel: hi,
      });
    }
    return out;
  }

  var BASE = buildBase();
  var LEGENDS = buildLegends();
  var ALL = BASE.concat(LEGENDS);

  var BY_ID = {};
  for (var i0 = 0; i0 < ALL.length; i0++) BY_ID[ALL[i0].id] = ALL[i0];

  // ===========================================================================
  //  Vérification des capacités au chargement
  //  moves3d.js est écrit par un autre agent : si un id nous manque, on ne
  //  plante pas — on cherche l'équivalent le plus proche (même type, même
  //  rôle), et on prévient UNE seule fois dans la console.
  // ===========================================================================
  var warned = false;

  function specOf(id) {
    var s = MOVE_SPEC[id];
    if (!s) return { type: 'neutre', role: 'mid' };
    var p = s.split(' ');
    return { type: p[0], role: p[1] || 'mid' };
  }

  function powerOf(m) {
    if (!m) return 0;
    if (Array.isArray(m.power)) return m.power[1] || m.power[0] || 0;
    return m.power || 0;
  }

  function neutralFor(role, MOVES) {
    var wish = (role === 'heal') ? ['repos', 'soin1', 'soin2', 'calin']
             : (role === 'weak') ? ['vitesse', 'vite', 'charge']
             : (role === 'strong' || role === 'signature') ? ['force', 'charge', 'assaut']
             : ['charge', 'assaut', 'vite'];
    for (var i = 0; i < wish.length; i++) if (MOVES[wish[i]]) return wish[i];
    for (var k in MOVES) if (Object.prototype.hasOwnProperty.call(MOVES, k)) return k;
    return null;
  }

  // Cherche dans moves3d une capacité du bon type et du bon rôle.
  function pickByRole(api, type, role) {
    var list = [];
    if (typeof api.byType === 'function') list = api.byType(type) || [];
    if (!list.length) {
      for (var k in api.MOVES) {
        if (!Object.prototype.hasOwnProperty.call(api.MOVES, k)) continue;
        if (api.MOVES[k] && api.MOVES[k].type === type) list.push(api.MOVES[k]);
      }
    }
    if (!list.length) return null;
    var heals = [], atk = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].heal) heals.push(list[i]); else atk.push(list[i]);
    }
    if (role === 'heal') return heals.length ? (heals[0].id || null) : null;
    if (!atk.length) return null;
    atk.sort(function (a, b) { return powerOf(a) - powerOf(b); });
    if (role === 'signature') return atk[atk.length - 1].id || null;
    var lim = (role === 'weak') ? 14 : (role === 'mid') ? 22 : 36;
    for (var j = 0; j < atk.length; j++) if (powerOf(atk[j]) <= lim) {
      // on prend la plus forte qui respecte le plafond
      var best = atk[j];
      for (var q = j; q < atk.length; q++) if (powerOf(atk[q]) <= lim) best = atk[q];
      return best.id || null;
    }
    return atk[0].id || null;
  }

  function resolveMoves() {
    var api = (R3mod && typeof R3mod.get === 'function') ? R3mod.get('moves') : null;
    if (!api || !api.MOVES) return;           // moves3d absent : on garde nos ids
    var MOVES = api.MOVES;
    var has = function (id) {
      return !!id && Object.prototype.hasOwnProperty.call(MOVES, id) && !!MOVES[id];
    };

    function resolve(id, ownTypes) {
      if (has(id)) return id;
      var sp = specOf(id);
      var type = (sp.type === 'neutre') ? null : sp.type;
      var found = type ? pickByRole(api, type, sp.role) : null;
      // Rien de ce type ? on essaie le type principal de la créature.
      if (!found && ownTypes && ownTypes.length) found = pickByRole(api, ownTypes[0], sp.role);
      if (!found) found = neutralFor(sp.role, MOVES);
      if (!warned) {
        warned = true;
        console.warn('[dex3d] capacité inconnue de moves3d.js (« ' + id +
                     ' ») — repli automatique sur une capacité équivalente.');
      }
      return found || id;
    }

    for (var i = 0; i < ALL.length; i++) {
      var sp = ALL[i], j;
      var healSlot = -1;
      for (j = 0; j < sp.moveIds.length; j++) {
        if (specOf(sp.moveIds[j]).role === 'heal') { healSlot = j; break; }
      }
      for (j = 0; j < sp.moveIds.length; j++) {
        sp.moveIds[j] = resolve(sp.moveIds[j], sp.types);
      }
      // Filet de sécurité : Robin doit TOUJOURS pouvoir se soigner.
      var hasHeal = false;
      for (j = 0; j < sp.moveIds.length; j++) {
        if (MOVES[sp.moveIds[j]] && MOVES[sp.moveIds[j]].heal) { hasHeal = true; break; }
      }
      if (!hasHeal) {
        var slot = (healSlot >= 0) ? healSlot : sp.moveIds.length - 1;
        var h = pickByRole(api, sp.types[0], 'heal') || neutralFor('heal', MOVES);
        if (h) sp.moveIds[slot] = h;
      }
      // Doublons éventuels après repli : on les remplace par du neutre.
      for (j = 1; j < sp.moveIds.length; j++) {
        for (var q = 0; q < j; q++) {
          if (sp.moveIds[j] === sp.moveIds[q]) {
            var alt = neutralFor(specOf(sp.moveIds[j]).role, MOVES);
            if (alt && sp.moveIds.indexOf(alt) < 0) sp.moveIds[j] = alt;
          }
        }
      }
      for (j = 0; j < sp.learnset.length; j++) {
        sp.learnset[j].moveId = resolve(sp.learnset[j].moveId, sp.types);
      }
    }
  }

  try { resolveMoves(); }
  catch (e) { console.warn('[dex3d] vérification des capacités impossible :', e); }

  // ===========================================================================
  //  API publique (§8)
  // ===========================================================================

  function get(id) { return BY_ID[id] || null; }

  function isLegendary(id) {
    var s = BY_ID[id];
    return !!(s && s.legendary);
  }

  function byRegion(regionId) {
    return ALL.filter(function (s) { return s.regions.indexOf(regionId) >= 0; });
  }

  // Sans les légendaires : c'est la faune ordinaire, celle qui se balade.
  function byBiome(biome) {
    return BASE.filter(function (s) { return s.biomes.indexOf(biome) >= 0; });
  }

  function legendOf(regionId) {
    return LEGENDS.filter(function (s) { return s.regions.indexOf(regionId) >= 0; });
  }

  // Poids de rencontre : les rares et les dragons sortent beaucoup moins.
  function weightOf(s) {
    if (s.dragon) return s.rare ? 1 : 3;
    if (s.rare) return 1;
    return 10;
  }

  function pickIn(list) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += weightOf(list[i]);
    var r = Math.random() * total;
    for (i = 0; i < list.length; i++) {
      r -= weightOf(list[i]);
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  // JAMAIS un légendaire : ils n'apparaissent qu'à leur autel (roamers3d).
  function pickWild(regionId, biome) {
    var inRegion = BASE.filter(function (s) { return s.regions.indexOf(regionId) >= 0; });
    var list = inRegion.filter(function (s) { return s.biomes.indexOf(biome) >= 0; });
    if (!list.length) list = inRegion;            // biome inconnu : toute la région
    if (!list.length) list = byBiome(biome);      // région inconnue : tout le biome
    if (!list.length) list = BASE;                // dernier recours
    return pickIn(list);
  }

  var API = {
    ALL: ALL,
    BASE: BASE,
    LEGENDS: LEGENDS,
    get: get,
    isLegendary: isLegendary,
    byRegion: byRegion,
    byBiome: byBiome,
    pickWild: pickWild,
    legendOf: legendOf,
    count: ALL.length,
    // Les légendaires ont changé de nom le 2026-08-08 : `team3d` s'en sert pour
    // rebaptiser les créatures d'une partie commencée avant.
    isLegacyName: isLegacyName,
    // Extras utiles au reste du jeu (Pokédex de hud3d.js, minimap…)
    TYPE_IDS: TYPE_IDS,
    REGION_IDS: REGION_IDS,
    REGION_LEVELS: REGION_LEVELS,
  };

  if (R3mod && typeof R3mod.register === 'function') R3mod.register('dex', API);
  ROOT.DEX3D = API;   // repli : le module reste utilisable même sans socle R3
})();
