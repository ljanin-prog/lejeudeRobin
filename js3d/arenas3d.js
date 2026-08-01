// ============================================================================
//  arenas3d.js — LES SIX ARÈNES, LEURS CHAMPIONS ET LES BADGES        (§12)
// ============================================================================
//
//  Une arène par région, dans l'ordre de progression du §3 :
//     val → sylve → saphir → givre → braise → aurore
//
//  Ce module ne construit AUCUN décor : l'arène n'a pas d'intérieur séparé.
//  C'est un bâtiment posé sur la carte par `cities3d.js` ; le joueur marche sur
//  la tuile `ARENA_DOOR`, `game3d.js` nous interroge, un dialogue s'ouvre, puis
//  le combat de champion démarre. Gagner donne le badge et beaucoup d'XP.
//
//  Il n'y a ici que des DONNÉES (champions, équipes, dialogues, badges,
//  dresseurs) et deux fabriques : `championNpc()` qui produit un PNJ au format
//  de `js/npcs.js`, et `makeBattle()` qui produit un `battleState` du §17.
//
//  Dépendances, toutes facultatives (règle n°7 — dégradation gracieuse) :
//    - `R3.get('team')`   pour instancier les créatures (`create(id, level)`) ;
//    - `R3.get('dex')`    pour connaître types et stats de repli ;
//    - `R3.get('cities')` pour savoir OÙ se trouve la porte de l'arène.
//  Si l'un manque, on produit un repli jouable et on continue sans lever.
//
//  Pourquoi les équipes sont écrites à la main plutôt que tirées au sort :
//  Robin doit pouvoir apprendre de sa défaite. Un champion qui change d'équipe
//  à chaque tentative rend la préparation inutile — et la préparation, c'est
//  précisément ce qu'on veut lui apprendre.
// ============================================================================

(function () {
  'use strict';

  // Socle : on ne suppose jamais que core3d.js est là (fichier ouvert seul,
  // script de vérification, ordre de chargement bousculé…).
  var R3ref = (typeof R3 !== 'undefined' && R3) ? R3 : {
    register: function (n, api) { this.modules = this.modules || {}; this.modules[n] = api; return api; },
    get: function (n) { return (this.modules || {})[n]; },
  };

  // ==========================================================================
  //  1. LES SIX BADGES
  //     Un par région. L'icône est un emoji : elle s'affiche telle quelle dans
  //     le HUD, sans image à charger (contrainte file://).
  // ==========================================================================

  var BADGES = {
    val:    { id: 'feuille', name: 'Badge Feuille', icon: '🍃', color: '#38b764',
              region: 'val',    order: 1, motto: 'Pour qui sait écouter pousser les arbres.' },
    sylve:  { id: 'eclair',  name: 'Badge Éclair',  icon: '⚡', color: '#f1c40f',
              region: 'sylve',  order: 2, motto: 'Pour qui frappe vite et juste.' },
    saphir: { id: 'vague',   name: 'Badge Vague',   icon: '🌊', color: '#41a6f6',
              region: 'saphir', order: 3, motto: 'Pour qui ne se laisse pas emporter.' },
    givre:  { id: 'flocon',  name: 'Badge Flocon',  icon: '❄️', color: '#a8e6ff',
              region: 'givre',  order: 4, motto: 'Pour qui garde la tête froide.' },
    braise: { id: 'flamme',  name: 'Badge Flamme',  icon: '🔥', color: '#ff6b3d',
              region: 'braise', order: 5, motto: 'Pour qui ne recule pas devant le feu.' },
    aurore: { id: 'etoile',  name: 'Badge Étoile',  icon: '✨', color: '#ffe066',
              region: 'aurore', order: 6, motto: 'Pour qui a traversé les six régions.' },
  };

  // ==========================================================================
  //  2. LES SIX ARÈNES
  //
  //  Courbe de difficulté (§12) : niveaux moyens ≈ 10 · 18 · 26 · 34 · 42 · 50.
  //  À l'intérieur d'une équipe, les niveaux montent aussi : la dernière
  //  créature est toujours la plus forte, pour que le combat ait un sommet.
  //  Les trois dernières arènes (givre, braise, aurore) comportent au moins un
  //  légendaire — c'est le moment du jeu où Robin en a lui-même croisé.
  //
  //  Le choix des espèces est contraint par `dex3d` : chaque id cité ici existe
  //  vraiment. Quand un type n'a presque pas de représentant commun (le feu et
  //  la glace n'en ont qu'un chacun), on complète avec des créatures du BIOME
  //  de la région — c'est ce que les dialogues expliquent au joueur.
  //
  //  --------------------------------------------------------------------
  //  À ARMES ÉGALES — pourquoi les arènes 4 à 6 alignent des formes ÉVOLUÉES
  //  --------------------------------------------------------------------
  //  Les évolutions (`evolve3d.js`) arrivent entre les niveaux 16 et 36. À
  //  partir de l'arène 4, le joueur n'a donc plus une seule forme de base dans
  //  son équipe, alors que les champions en alignaient encore : Astréa opposait
  //  une Koronette 47 à un enfant qui arrivait avec un Koronetton, soit 1,55
  //  fois ses statistiques. Les trois dernières arènes et les dresseurs des
  //  trois dernières régions emploient donc les identifiants ÉVOLUÉS.
  //
  //  Les NIVEAUX n'ont pas bougé d'un point : les plafonds du §12 (12 · 20 · 28
  //  · 36 · 45 · 55) sont conservés tels quels. C'est l'espèce qui change, pas
  //  la courbe.
  //
  //  PIÈGE DES IDENTIFIANTS. `evolve3d.js` fabrique l'id par concaténation
  //  STRICTE `base + suffixe` : Koronette donne `koronetteon` (et non
  //  « koronetton », qui n'est que son NOM affiché), Crabilino donne
  //  `crabilinoon`, Miaouche donne `miaouchear`. Un id inexistant ne lève
  //  AUCUNE erreur : `makeMon()` retombe en silence sur `fallbackMon()` et le
  //  champion devient une créature générique de 48 PV. Toujours vérifier un id
  //  contre `CHAIN_DATA` d'evolve3d.js, jamais de mémoire.
  //
  //  Deux espèces ne s'évoluent pas et restent écrites en clair : `nuagette`
  //  (Astréa) et `papillon` (dresseurs), toutes deux dans `NO_EVOLUTION`.
  // ==========================================================================

  var ARENAS = [

    // ---------------------------------------------------------------- 1. VAL
    {
      regionId: 'val',
      name: 'Arène de Bourg-Émeraude',
      cityName: 'Bourg-Émeraude',
      type: 'plante',
      order: 1,
      levelCap: 12,
      recommendedLevel: 10,
      xpReward: 320,
      champion: {
        id: 'champion_val',
        name: 'Sylvain',
        title: 'Gardien des Feuilles',
        // Un vieux jardinier tranquille. Il ne cherche pas à gagner, il cherche
        // à voir si l'enfant en face aime ses créatures. Premier champion :
        // son rôle est de rassurer.
        team: [
          { id: 'feuillou', level: 9 },
          { id: 'glanou',   level: 10 },
          { id: 'lotira',   level: 10 },
          { id: 'petalia',  level: 12 },
        ],
        aceIndex: 3,
        colorMap: { 'j': 'g', 'l': '6' },
        accessory: 'hat-ranger',
        dialogIntro: [
          "Ah, te voilà ! Je t'ai vu arriver par le sentier des noisetiers.",
          "Je suis Sylvain, Gardien des Feuilles. Je m'occupe de cette arène depuis… oh, très longtemps.",
          "Une plante, ça ne se presse pas. Ça pousse, tranquillement, et un beau jour c'est un arbre.",
          "Montre-moi ce que tes créatures et toi avez déjà fait pousser !",
        ],
        dialogWin: [
          "Ha ha ! Mes feuilles sont toutes retournées !",
          "Tu ne t'es pas contenté d'attaquer : tu as écouté tes créatures. Ça se voit tout de suite.",
          "Tiens, le Badge Feuille est à toi. Le premier est celui dont on se souvient toute sa vie.",
          "Va donc vers la Sylve d'Ambre, à l'est. Et repasse me raconter, hein !",
        ],
        dialogLose: [
          "Voilà, c'est fini… et ce n'est pas grave du tout.",
          "Tu sais, un jardin ne pousse jamais du premier coup. On recommence, on arrose, on attend.",
          "Va soigner tes créatures au centre de soins, gagne deux ou trois niveaux dans les hautes herbes.",
          "Je t'attends ici. Je ne bouge pas — je suis un arbre, après tout !",
        ],
      },
      badge: BADGES.val,
      signText: "Arène de Bourg-Émeraude — Type Plante — Champion : Sylvain, Gardien des Feuilles.",
    },

    // -------------------------------------------------------------- 2. SYLVE
    {
      regionId: 'sylve',
      name: "Arène d'Ambrelune",
      cityName: 'Ambrelune',
      type: 'foudre',
      order: 2,
      levelCap: 20,
      recommendedLevel: 18,
      xpReward: 560,
      champion: {
        id: 'champion_sylve',
        name: 'Orana',
        title: 'Voix de l\'Orage',
        // Vive, bruyante, elle parle par exclamations et coupe ses propres
        // phrases. Elle adore l'orage et elle le fait sentir.
        team: [
          { id: 'etincelo', level: 16 },
          { id: 'fluffly',  level: 17 },
          { id: 'nuagette', level: 18 },
          { id: 'tonnedrak', level: 20 },
        ],
        aceIndex: 3,
        colorMap: { 'j': 's', 'l': '9' },
        accessory: null,
        dialogIntro: [
          "TU AS ENTENDU ÇA ?! Non ? Attends… VOILÀ ! Le tonnerre ! Il arrive toujours quand je me bats !",
          "Orana ! Voix de l'Orage ! C'est moi ! Enfin, c'est mon titre, mais j'aime bien le dire en entier.",
          "Ici, dans la jungle, l'air est chargé. Mes créatures adorent ça. Elles pétillent !",
          "Alors ? On y va ? On y va ! Attention à tes cheveux, ça décoiffe !",
        ],
        dialogWin: [
          "AAAH ! Court-circuit ! Complet ! Total !",
          "Tu as attendu que mes attaques ratent, et PAF. Malin. Très malin.",
          "Le Badge Éclair, il est à toi. Accroche-le bien, il pique un peu au début.",
          "Descends vers la Côte de Saphir maintenant. Marine t'attend, elle est… beaucoup plus calme que moi.",
        ],
        dialogLose: [
          "Ouille ouille ouille ! L'orage a été plus rapide que toi cette fois !",
          "Mais tu as bien failli avoir mon Tonnedrak. J'ai eu chaud ! Enfin, chaud et électrique !",
          "Un conseil : la foudre déteste la terre. Cherche une créature bien enracinée, tu verras.",
          "Reviens vite ! Je reste branchée !",
        ],
      },
      badge: BADGES.sylve,
      signText: "Arène d'Ambrelune — Type Foudre — Championne : Orana, Voix de l'Orage.",
    },

    // ------------------------------------------------------------- 3. SAPHIR
    {
      regionId: 'saphir',
      name: 'Arène de Port-Saphir',
      cityName: 'Port-Saphir',
      type: 'eau',
      order: 3,
      levelCap: 28,
      recommendedLevel: 26,
      xpReward: 840,
      champion: {
        id: 'champion_saphir',
        name: 'Marine',
        title: 'Capitaine des Marées',
        // Ancienne navigatrice. Parle posément, en métaphores de mer. Première
        // équipe de cinq créatures : le combat devient long, il faut gérer ses PP.
        team: [
          { id: 'bullini',   level: 24 },
          { id: 'etoilamer', level: 24 },
          { id: 'crabilino', level: 25 },
          { id: 'coralou',   level: 26 },
          { id: 'aquadrak',  level: 28 },
        ],
        aceIndex: 4,
        colorMap: { 'j': '9', 'l': 'a' },
        accessory: 'hat-sailor',
        dialogIntro: [
          "Bienvenue à bord. Ici, c'est mon arène, mais c'est surtout la mer qui décide.",
          "Je m'appelle Marine. J'ai navigué vingt ans avant de m'amarrer ici.",
          "La mer ne t'attaque pas : elle monte, lentement, et un jour tu as de l'eau jusqu'aux genoux.",
          "Mes cinq créatures vont monter comme la marée. Tiendras-tu debout jusqu'à la dernière ?",
        ],
        dialogWin: [
          "La marée est redescendue. Et tu es toujours debout.",
          "Tu as tenu la distance : c'est ça, le vrai talent. Beaucoup abandonnent à la troisième vague.",
          "Le Badge Vague est à toi, dresseur. Il te va bien.",
          "Prends de quoi te couvrir avant d'aller au Massif de Givre. Là-haut, Borée ne fait pas de cadeau… mais il en fait quand même un peu.",
        ],
        dialogLose: [
          "Voilà. La vague est passée par-dessus. Ça arrive à tous les marins, crois-moi.",
          "Ce n'est pas ton équipe qui a manqué de force : elle a manqué de souffle. Cinq créatures, c'est long.",
          "Emporte des potions, garde tes meilleures capacités pour la fin, et reviens.",
          "La mer sera là demain. Moi aussi.",
        ],
      },
      badge: BADGES.saphir,
      signText: 'Arène de Port-Saphir — Type Eau — Championne : Marine, Capitaine des Marées.',
    },

    // -------------------------------------------------------------- 4. GIVRE
    //  Première arène avec un légendaire (Banquisor, ours des glaciers).
    {
      regionId: 'givre',
      name: 'Arène de Cimefroide',
      cityName: 'Cimefroide',
      type: 'glace',
      order: 4,
      levelCap: 36,
      recommendedLevel: 34,
      xpReward: 1180,
      champion: {
        id: 'champion_givre',
        name: 'Borée',
        title: 'Sentinelle des Glaciers',
        // Bourru, économe de mots, secrètement très gentil. Ses phrases sont
        // courtes ; c'est le contraste avec Orana qui le rend mémorable.
        // FORMES ÉVOLUÉES (voir « À ARMES ÉGALES », plus haut) : à 32-35, le
        // joueur n'a plus une seule forme de base dans son équipe.
        team: [
          { id: 'cygnikon',   level: 32 },
          { id: 'pandoukion', level: 33 },
          { id: 'glydrakon',  level: 35 },
          { id: 'banquisor',  level: 36 },   // légendaire de glace
        ],
        aceIndex: 3,
        colorMap: { 'j': 'c', 'l': 'd' },
        accessory: null,
        dialogLegendWarn: 'Un légendaire des glaces se dresse devant toi !',
        dialogIntro: [
          "Ferme la porte. Il fait froid.",
          "Borée. Sentinelle des Glaciers. Je garde ce col depuis trente hivers.",
          "Ici, on ne gagne pas en criant. On gagne en tenant.",
          "Et ne t'étonne pas de ce que tu vas voir en dernier. Il vit ici bien avant moi.",
        ],
        dialogWin: [
          "… (Borée te regarde un long moment sans rien dire.)",
          "Bien. Vraiment bien.",
          "Tu as vu un légendaire en face de toi et tu n'as pas reculé. Peu de gens font ça.",
          "Le Badge Flocon. Prends-le. Et prends aussi ça : une écharpe. Il fait froid dehors.",
          "La Caldeira de Braise est chaude. Trop chaude. Fais attention à toi, gamin.",
        ],
        dialogLose: [
          "La montagne t'a repoussé. Ce n'est pas une honte : elle repousse tout le monde d'abord.",
          "Ton équipe est bonne. Elle est juste un peu jeune.",
          "Reviens quand tes créatures auront trois ou quatre niveaux de plus. Pas dix. Trois ou quatre.",
          "Je serai là. Je suis toujours là.",
        ],
      },
      badge: BADGES.givre,
      signText: 'Arène de Cimefroide — Type Glace — Champion : Borée, Sentinelle des Glaciers.',
    },

    // ------------------------------------------------------------- 5. BRAISE
    {
      regionId: 'braise',
      name: 'Arène de Fournaise',
      cityName: 'Fournaise',
      type: 'feu',
      order: 5,
      levelCap: 45,
      recommendedLevel: 42,
      xpReward: 1600,
      champion: {
        id: 'champion_braise',
        name: 'Ignis',
        title: 'Forgeur de Flammes',
        // Forgeron. Grande voix, grand rire, vocabulaire de l'atelier : il
        // parle des dresseurs comme d'une lame qu'on chauffe et qu'on martèle.
        // FORMES ÉVOLUÉES. `flamdrakix` est le 3ᵉ stade (36) : à 43, le joueur
        // qui a pris Flamdrak comme starter a exactement la même créature.
        team: [
          { id: 'lapinouon',   level: 39 },
          { id: 'crabilinoon', level: 40 },
          { id: 'tonnedrakon', level: 41 },
          { id: 'flamdrakix',  level: 43 },
          { id: 'fournalis',   level: 45 },   // légendaire de feu
        ],
        aceIndex: 4,
        colorMap: { 'j': '2', 'l': 'u' },
        accessory: null,
        dialogLegendWarn: 'Le lion de lave Fournalis entre dans l\'arène !',
        dialogIntro: [
          "APPROCHE ! N'aie pas peur de la chaleur, elle ne mord que les timides !",
          "Ignis, Forgeur de Flammes. Avant d'être champion, j'ai forgé des épées pendant vingt ans.",
          "Et une épée, tu sais comment ça se fait ? On chauffe. On tape. On recommence. Mille fois.",
          "Toi, tu as déjà été chauffé quatre fois par quatre champions. Voyons si tu tiens le marteau !",
        ],
        dialogWin: [
          "HA ! HA ! HA ! Ma forge est éteinte ! Par un gamin !",
          "Tu as encaissé Fournalis. FOURNALIS ! Le lion de lave ! Et tu es encore debout !",
          "Le Badge Flamme, tiens. Je l'ai forgé moi-même, il est encore un peu tiède.",
          "Il ne t'en reste qu'un. Là-haut, sur le Plateau d'Aurore. Astréa.",
          "Elle est… différente de nous. Tu comprendras.",
        ],
        dialogLose: [
          "OUH ! La lame a cassé ! Ça arrive, ça arrive à toutes les lames !",
          "Écoute-moi bien : ce n'est pas toi qui as manqué. C'est le métal qui n'était pas encore prêt.",
          "Retourne t'entraîner. Les créatures d'eau et de roche adorent éteindre mes flammes, souviens-t'en.",
          "Et reviens ! J'aime les gens qui reviennent ! Ce sont les seuls qui gagnent !",
        ],
      },
      badge: BADGES.braise,
      signText: 'Arène de Fournaise — Type Feu — Champion : Ignis, Forgeur de Flammes.',
    },

    // ------------------------------------------------------------- 6. AURORE
    //  Dernière arène : deux légendaires, cinq créatures, niveaux 47 → 53.
    //  C'est le sommet du jeu — mais Astréa reste douce, et sa défaite du
    //  joueur ne se termine jamais sur un reproche.
    {
      regionId: 'aurore',
      name: "Arène d'Aurore-Cité",
      cityName: 'Aurore-Cité',
      type: 'lumiere',
      order: 6,
      levelCap: 55,
      recommendedLevel: 50,
      xpReward: 2400,
      champion: {
        id: 'champion_aurore',
        name: 'Astréa',
        title: 'Gardienne de l\'Aube',
        // Astronome. Elle parle bas, lentement, comme quelqu'un qui a passé
        // beaucoup de nuits seule à regarder le ciel. Elle vouvoie personne :
        // elle parle à Robin comme à un égal, ce qui est le vrai cadeau final.
        // FORMES ÉVOLUÉES. `nuagette` reste telle quelle : elle est dans la
        // liste `NO_EVOLUTION` d'evolve3d.js, elle n'a pas de forme évoluée.
        team: [
          { id: 'koronetteon', level: 47 },
          { id: 'stellinion',  level: 48 },
          { id: 'nuagette',    level: 49 },
          { id: 'prismee',     level: 51 },   // légendaire de lumière
          { id: 'aureol',      level: 53 },   // légendaire de lumière — l'ace
        ],
        aceIndex: 4,
        colorMap: { 'j': 'E', 'l': 's' },
        accessory: null,
        dialogLegendWarn: 'Auréol, le griffon solaire, déploie ses ailes !',
        dialogIntro: [
          "Chut. Écoute une seconde… Tu entends ? Non. Personne n'entend. C'est ça, le silence d'ici.",
          "Je m'appelle Astréa. Je regarde le ciel depuis l'observatoire, en haut. Toutes les nuits.",
          "Cinq champions t'ont laissé passer. Cinq. Ils ne laissent pas passer n'importe qui.",
          "Alors je ne vais pas te ménager. Ce serait te manquer de respect.",
          "Ouvre grand les yeux : voici la lumière.",
        ],
        dialogWin: [
          "…Oh. Vraiment ?",
          "Auréol est tombé. Auréol. Il n'était jamais tombé.",
          "Tu sais ce que je vois, là, maintenant ? Je vois quelqu'un qui a commencé avec une seule créature dans le Val d'Émeraude.",
          "Le Badge Étoile est à toi. Le sixième. Le dernier.",
          "Le monde est ouvert, maintenant. Va où tu veux — et reviens me raconter ce que tu auras vu.",
        ],
        dialogLose: [
          "La lumière t'a ébloui. C'est normal : elle éblouit tout le monde la première fois.",
          "Ne baisse pas la tête. Tu es arrivé jusqu'ici, et très peu de dresseurs y arrivent.",
          "Repose tes créatures. Fais-en monter deux ou trois de plus. Prends ton temps — j'en ai beaucoup.",
          "Le ciel ne bouge pas si vite. Je t'attendrai sous les étoiles.",
        ],
      },
      badge: BADGES.aurore,
      signText: "Arène d'Aurore-Cité — Type Lumière — Championne : Astréa, Gardienne de l'Aube.",
    },
  ];

  // Index par région, pour un accès en O(1) depuis game3d.
  var BY_REGION = {};
  for (var ai = 0; ai < ARENAS.length; ai++) BY_REGION[ARENAS[ai].regionId] = ARENAS[ai];

  // ==========================================================================
  //  3. LES 24 DRESSEURS  —  4 par région
  //
  //  Format `js/npcs.js` : { id, name, x, y, dir, colorMap, accessory, dialog,
  //  isTrainer, party }. Deux précisions :
  //
  //   • `x` / `y` valent `null` : c'est `regions3d.js` qui POSITIONNE ces PNJ,
  //     le long des routes de sa région. Il lit `place` (indication de lieu) et
  //     `dist` (distance approximative à la ville, en tuiles) pour choisir.
  //     Un dresseur sans coordonnées ne doit jamais être posé tel quel : s'il
  //     reste à null, on ne l'affiche pas — mieux vaut pas de dresseur qu'un
  //     dresseur planté dans un mur.
  //   • `party` reste un tableau d'ids (compatibilité avec le format 2D), et
  //     `team` donne le détail { id, level } dont le combat a besoin.
  //
  //  Les niveaux suivent la région : val 6-8, sylve 12-16, saphir 20-24,
  //  givre 28-32, braise 36-40, aurore 44-48. Toujours un peu en dessous du
  //  champion : les dresseurs sont l'entraînement, pas l'examen.
  //
  //  Les dresseurs des TROIS DERNIÈRES régions (givre, braise, aurore) alignent
  //  eux aussi des formes évoluées, pour la raison exposée dans « À ARMES
  //  ÉGALES » plus haut. Val, sylve et saphir gardent leurs formes de base :
  //  jusqu'au niveau 24, c'est aussi ce que le joueur a dans son équipe.
  // ==========================================================================

  /** Petite fabrique : évite 24 objets écrits à la main avec les mêmes clés. */
  function trainer(regionId, id, name, place, dist, dir, colorMap, accessory, team, dialog, dialogDefeated) {
    var party = [];
    for (var i = 0; i < team.length; i++) party.push(team[i].id);
    var lvl = 0;
    for (var j = 0; j < team.length; j++) if (team[j].level > lvl) lvl = team[j].level;
    return {
      id: id, name: name,
      x: null, y: null,             // ← posé par regions3d.js (voir commentaire ci-dessus)
      dir: dir || 'down',
      colorMap: colorMap, accessory: accessory || null,
      isTrainer: true,
      region: regionId,
      place: place,                 // indication pour regions3d : 'route', 'forest', 'beach'…
      dist: dist,                   // distance conseillée à la ville, en tuiles
      party: party,                 // ids seuls — format historique
      team: team,                   // [{ id, level }] — ce que lit makeTrainerBattle
      level: lvl,
      dialog: dialog,
      dialogDefeated: dialogDefeated,
      reward: 40 + lvl * 12,        // XP bonus versé par game3d à la victoire
    };
  }

  var TRAINERS = {

    // ------------------------------------------------------------------ VAL
    val: [
      trainer('val', 'dr_val_sentier', 'Dresseur Léo', 'route', 10, 'down',
        { 'j': 'j', 'l': '6' }, 'hat-ranger',
        [{ id: 'feuillou', level: 6 }],
        ["Hé, toi ! Tu débutes aussi ? Moi j'ai commencé la semaine dernière !",
         "Mon Feuillou et moi, on s'entraîne tous les jours. On y va ?"],
        ["Bravo ! Tu as gagné pour de vrai. Je vais m'entraîner encore plus !"]),

      trainer('val', 'dr_val_lac', 'Pêcheuse Inès', 'lake', 18, 'left',
        { 'j': 'F', 'l': 'a' }, 'hat-fisher',
        [{ id: 'goutella', level: 6 }, { id: 'bullini', level: 7 }],
        ["Chut… ça mord. Enfin, ça mordait, avant que tu arrives !",
         "Bon, tant pis pour la pêche : deux créatures d'eau contre toi !"],
        ["Bien joué. Allez, je retourne à mes lignes… et à mon silence."]),

      trainer('val', 'dr_val_bosquet', 'Scoute Nina', 'forest', 22, 'right',
        { 'j': 'd', 'l': 'C' }, null,
        [{ id: 'petalia', level: 7 }, { id: 'papillon', level: 7 }],
        ["J'ai repéré tes traces depuis le grand chêne ! Je suis douée, hein ?",
         "Un vrai scout ne recule jamais devant un défi. En garde !"],
        ["Tu m'as eue ! Je note ça dans mon carnet : « ne pas sous-estimer les nouveaux »."]),

      trainer('val', 'dr_val_verger', 'Grand-père Marcel', 'village', 14, 'down',
        { 'j': 'c', 'l': 'h' }, null,
        [{ id: 'glanou', level: 8 }, { id: 'pandouki', level: 8 }],
        ["Ho ho ! Un jeune dresseur dans mon verger !",
         "Mon Pandouki dort au soleil toute la journée. Réveille-le, tu verras ce que ça donne."],
        ["Il s'est rendormi… Tu as bien mérité une pomme, petit."]),
    ],

    // ---------------------------------------------------------------- SYLVE
    sylve: [
      trainer('sylve', 'dr_sylve_canopee', 'Explorateur Tao', 'jungle', 16, 'down',
        { 'j': 'j', 'l': '7' }, 'hat-ranger',
        [{ id: 'etincelo', level: 12 }, { id: 'papillon', level: 13 }],
        ["La jungle, c'est humide, ça pique, et j'adore ça !",
         "Mon Étincelo éclaire mieux qu'une lampe. Il va t'éclairer les idées !"],
        ["Ouille ! Bon… au moins j'ai de la lumière pour retrouver mon chemin."]),

      trainer('sylve', 'dr_sylve_marais', 'Botaniste Lila', 'swamp', 24, 'left',
        { 'j': 'g', 'l': '5' }, null,
        [{ id: 'lotira', level: 12 }, { id: 'feuillou', level: 13 }, { id: 'petalia', level: 14 }],
        ["Ne marche pas là ! Tu écrases une espèce très rare !",
         "Trois plantes, trois caractères. Tu vas voir : elles se défendent toutes seules."],
        ["Fascinant… Tu as trouvé leur point faible plus vite que moi. Note-le, je t'en prie."]),

      trainer('sylve', 'dr_sylve_ruines', 'Pisteur Ravi', 'ruins', 30, 'up',
        { 'j': 'F', 'l': 'f' }, null,
        [{ id: 'hibouche', level: 14 }, { id: 'meduzia', level: 14 }],
        ["Ces ruines sont pleines de créatures d'ombre. Elles me suivent partout.",
         "Elles m'aiment bien. Toi, je ne sais pas encore. On va voir !"],
        ["Elles t'aiment bien aussi, on dirait. Prends soin d'elles quand tu en croiseras."]),

      trainer('sylve', 'dr_sylve_orage', 'Dompteuse Zoé', 'route', 34, 'right',
        { 'j': 's', 'l': '8' }, null,
        [{ id: 'fluffly', level: 14 }, { id: 'tonnedrak', level: 16 }],
        ["Tu vas voir Orana ? Alors il faut me battre d'abord. C'est la règle. Ma règle.",
         "Mon Tonnedrak n'a jamais perdu. Jamais. Enfin… presque."],
        ["« Presque », c'était donc aujourd'hui. Va, Orana va t'adorer."]),
    ],

    // --------------------------------------------------------------- SAPHIR
    saphir: [
      trainer('saphir', 'dr_saphir_plage', 'Surfeur Éric', 'beach', 14, 'up',
        { 'j': 'j', 'l': 'b' }, 'hat-sailor',
        [{ id: 'bullini', level: 20 }, { id: 'etoilamer', level: 21 }],
        ["Ouaaah, la vague était PARFAITE ! …Oh, salut !",
         "Tu veux te mesurer à moi ? Cool ! Mon Étoilamer fait des figures incroyables."],
        ["Wipeout total ! T'es trop fort, mec. Respect."]),

      trainer('saphir', 'dr_saphir_jetee', 'Marin Bastien', 'dock', 8, 'left',
        { 'j': 'F', 'l': '9' }, 'hat-sailor',
        [{ id: 'crabilino', level: 21 }, { id: 'coralou', level: 22 }],
        ["Attention où tu marches, les cordages, ça glisse.",
         "Mes deux carapaces sont dures comme la coque de mon bateau. Essaie donc de les fendre."],
        ["Fendues. Les deux. Tu as un sacré coup de marteau, toi."]),

      trainer('saphir', 'dr_saphir_recif', 'Plongeuse Maïa', 'reef', 26, 'down',
        { 'j': 'n', 'l': 'q' }, null,
        [{ id: 'meduzia', level: 21 }, { id: 'goutella', level: 22 }, { id: 'cygnik', level: 23 }],
        ["Sous l'eau, tout est plus lent, plus calme. Ici aussi, alors respire.",
         "Trois créatures. Prends ton temps. Moi je peux rester en apnée très longtemps."],
        ["Belle plongée. Tu remontes avec la victoire — et moi avec des coquillages."]),

      trainer('saphir', 'dr_saphir_falaise', 'Capitaine Solène', 'cliff', 32, 'right',
        { 'j': 'd', 'l': 'v' }, 'hat-sailor',
        [{ id: 'nuagette', level: 22 }, { id: 'aquadrak', level: 24 }],
        ["Du haut de cette falaise, on voit toute la côte. Et on voit les dresseurs arriver.",
         "Je t'ai vu venir depuis une heure. Mon Aquadrak aussi. En position !"],
        ["Beau combat. Marine va t'apprécier — elle m'a formée, tu sais."]),
    ],

    // ---------------------------------------------------------------- GIVRE
    givre: [
      trainer('givre', 'dr_givre_col', 'Grimpeur Axel', 'mountain', 20, 'down',
        { 'j': 'F', 'l': '3' }, null,
        [{ id: 'pandoukion', level: 28 }, { id: 'lapinouon', level: 29 }],
        ["Le col est fermé par la neige. Enfin… fermé par moi, surtout.",
         "Bats-moi et je te laisse passer. C'est plus rapide que de déneiger !"],
        ["Passe, passe ! Et couvre-toi, il fait -12 là-haut."]),

      trainer('givre', 'dr_givre_lac', 'Patineuse Elsa', 'glacier', 26, 'left',
        { 'j': 'c', 'l': 'D' }, null,
        [{ id: 'cygnikon', level: 29 }, { id: 'bullinion', level: 30 }],
        ["Le lac est gelé sur trente centimètres. On peut danser dessus !",
         "Mes créatures glissent mieux que toi. Prouve-moi le contraire !"],
        ["Une chute, ça arrive même aux championnes. Bien joué !"]),

      trainer('givre', 'dr_givre_refuge', 'Guide Björn', 'route', 14, 'right',
        { 'j': 'y', 'l': 'e' }, null,
        [{ id: 'doudouneon', level: 29 }, { id: 'flufflyon', level: 30 }, { id: 'hibouchear', level: 30 }],
        ["Entre, il y a du feu et de la soupe. …Après le combat, évidemment.",
         "Trois créatures bien au chaud sous leur duvet. Elles ne craignent rien."],
        ["Tu l'as bien méritée, cette soupe. Assieds-toi."]),

      trainer('givre', 'dr_givre_aurores', 'Chasseuse d\'aurores Nadia', 'mountain', 36, 'up',
        { 'j': 'E', 'l': '1' }, null,
        [{ id: 'stellinion', level: 30 }, { id: 'glydrakon', level: 32 }],
        ["Je photographie les aurores boréales depuis quinze ans. Ce soir, elles seront magnifiques.",
         "Mais avant : mon Glydrakon veut se dégourdir les ailes."],
        ["Regarde le ciel, vite ! …Voilà. C'était ton cadeau de victoire."]),
    ],

    // --------------------------------------------------------------- BRAISE
    braise: [
      trainer('braise', 'dr_braise_forge', 'Forgeron Hugo', 'village', 10, 'down',
        { 'j': '2', 'l': 'f' }, null,
        [{ id: 'crabilinoon', level: 36 }, { id: 'lapinouon', level: 37 }],
        ["Attends, je finis de tremper cette lame… Voilà. À nous !",
         "J'apprends chez Ignis. Un jour je serai champion. Un jour !"],
        ["Ce jour n'est pas aujourd'hui. Mais je progresse, hein ? Avoue que je progresse."]),

      trainer('braise', 'dr_braise_desert', 'Vagabonde Sahra', 'desert', 32, 'left',
        { 'j': 'F', 'l': 'k' }, null,
        [{ id: 'papillon', level: 36 }, { id: 'stellinion', level: 37 }, { id: 'doudouneon', level: 38 }],
        ["Le désert n'est pas vide. Il est juste discret.",
         "Trois créatures y vivent avec moi. Elles n'ont peur ni du soleil ni de toi."],
        ["Bien. Bois de l'eau et repars vers le nord. La caldeira t'attend."]),

      trainer('braise', 'dr_braise_geyser', 'Vulcanologue Otto', 'volcano', 24, 'right',
        { 'j': 'd', 'l': '4' }, null,
        [{ id: 'etinceloix', level: 37 }, { id: 'tonnedrakon', level: 39 }],
        ["Ne t'approche pas du geyser ! Il crache toutes les onze minutes ! …Il en reste neuf.",
         "Ça nous laisse largement le temps d'un combat. En garde !"],
        ["Neuf minutes, pile. Tu es aussi ponctuel qu'efficace."]),

      trainer('braise', 'dr_braise_caldeira', 'Dompteur Rafa', 'volcano', 38, 'up',
        { 'j': '0', 'l': 'u' }, null,
        [{ id: 'hibouchear', level: 38 }, { id: 'flamdrakix', level: 40 }],
        ["Mon Flamdrakix vole au-dessus de la lave sans jamais se brûler. Regarde bien.",
         "Personne ne l'a battu depuis deux ans. Personne."],
        ["Deux ans, et c'est toi. Va voir Ignis. Il va t'adorer, ce vieux fou."]),
    ],

    // --------------------------------------------------------------- AURORE
    aurore: [
      trainer('aurore', 'dr_aurore_escalier', 'Astronome Céleste', 'route', 16, 'down',
        { 'j': 'n', 'l': 'r' }, null,
        [{ id: 'stellinion', level: 44 }, { id: 'nuagette', level: 45 }],
        ["Tu montes vers l'observatoire ? Bonne idée. On voit tout, de là-haut.",
         "Mais on ne monte pas ici sans montrer ce qu'on vaut. Petite formalité !"],
        ["Formalité accomplie. Monte, l'escalier est à toi."]),

      trainer('aurore', 'dr_aurore_temple', 'Moine Élian', 'ruins', 24, 'left',
        { 'j': 'c', 'l': 'z' }, null,
        [{ id: 'koronetteon', level: 45 }, { id: 'petaliaon', level: 46 }],
        ["Ces ruines ont mille ans. Elles ont vu passer beaucoup de dresseurs.",
         "Elles t'ont vu arriver, elles aussi. Fais-leur honneur."],
        ["Elles se souviendront de toi. Moi aussi."]),

      trainer('aurore', 'dr_aurore_jardins', 'Gardienne Wanda', 'plateau', 20, 'right',
        { 'j': 'g', 'l': 'H' }, null,
        [{ id: 'miaoucheix', level: 45 }, { id: 'papillon', level: 45 }, { id: 'lapinouon', level: 46 }],
        ["Trois petites créatures toutes simples. Rien d'impressionnant.",
         "…C'est exactement ce que tout le monde dit avant de perdre."],
        ["Ha ! Tu ne t'es pas laissé avoir par les apparences. J'aime ça."]),

      trainer('aurore', 'dr_aurore_nuees', 'Voyageur Kaïs', 'plateau', 34, 'up',
        { 'j': 'f', 'l': '8' }, null,
        [{ id: 'tonnedrakon', level: 46 }, { id: 'glydrakon', level: 48 }],
        ["J'ai traversé les six régions à pied. Toutes. Comme toi, j'imagine.",
         "Alors on se comprend. Pas de discours : deux dragons, et que le meilleur gagne."],
        ["On se comprend, oui. Va voir Astréa. Tu es prêt — je le vois."]),
    ],
  };

  // ==========================================================================
  //  4. FABRIQUE DE CRÉATURES  —  avec repli complet
  //
  //  Normalement `team3d.create(id, level)` fait tout. Mais ce module doit
  //  rester utilisable si `team3d.js` ou `dex3d.js` manquent (§1 règle 7) :
  //  on reconstruit alors un Mon minimal mais VALIDE, pour que `battle3d.js`
  //  et `hud3d.js` n'aient jamais à tester la présence de leurs champs.
  // ==========================================================================

  var _uidSeq = 0;
  function fallbackUid() { _uidSeq++; return 'arn' + _uidSeq + '_' + (Date.now() % 100000); }

  /** Mon de secours, construit sans team3d — jamais null, jamais NaN. */
  function fallbackMon(speciesId, level) {
    var dex = R3ref.get('dex');
    var sp = (dex && typeof dex.get === 'function') ? dex.get(speciesId) : null;
    var lvl = Math.max(1, Math.min(60, Math.round(level || 5)));
    var baseHp = (sp && sp.baseHp) || 48;
    var atk = (sp && sp.atk) || 40;
    var def = (sp && sp.def) || 38;
    var spd = (sp && sp.speed) || 38;
    var maxHp = Math.round(baseHp * (1 + lvl * 0.06));
    var moves = [];
    var ids = (sp && sp.moveIds) || ['assaut'];
    var mv = R3ref.get('moves');
    for (var i = 0; i < ids.length && i < 4; i++) {
      var m = (mv && typeof mv.get === 'function') ? mv.get(ids[i]) : null;
      var pp = (m && m.pp) || 15;
      moves.push({ id: ids[i], pp: pp, ppMax: pp });
    }
    if (!moves.length) moves.push({ id: 'assaut', pp: 20, ppMax: 20 });
    return {
      uid: fallbackUid(),
      id: speciesId,
      nick: (sp && sp.name) || speciesId,
      level: lvl,
      xp: 0, xpNext: 20 + lvl * lvl * 4,
      hp: maxHp, maxHp: maxHp,
      atk: Math.round(atk * (1 + lvl * 0.05)),
      def: Math.round(def * (1 + lvl * 0.05)),
      speed: Math.round(spd * (1 + lvl * 0.05)),
      types: (sp && sp.types && sp.types.slice()) || ['plante'],
      moves: moves,
      caughtAt: null,
    };
  }

  /** Instancie une créature au niveau demandé, par team3d si possible. */
  function makeMon(speciesId, level) {
    var team = R3ref.get('team');
    if (team && typeof team.create === 'function') {
      try {
        var m = team.create(speciesId, level);
        if (m && typeof m === 'object' && m.maxHp > 0) return m;
      } catch (e) {
        console.warn('[arenas3d] team.create a échoué pour', speciesId, e);
      }
    }
    return fallbackMon(speciesId, level);
  }

  /** Construit l'équipe complète d'un champion (ou d'un dresseur). */
  function buildTeam(spec) {
    var out = [];
    for (var i = 0; i < spec.length; i++) {
      var m = makeMon(spec[i].id, spec[i].level);
      if (m) out.push(m);
    }
    // Filet de sécurité : un combat sans adversaire serait un jeu bloqué.
    if (!out.length) out.push(fallbackMon('feuillou', 5));
    return out;
  }

  // ==========================================================================
  //  5. LE PNJ DU CHAMPION
  //
  //  Placé juste devant la porte de l'arène quand `cities3d.js` sait où elle
  //  est, sinon x/y à null et c'est `regions3d.js` qui décide. Le champion
  //  n'est PAS un dresseur ordinaire (`isTrainer: false`) : le combat se
  //  déclenche par la tuile `ARENA_DOOR`, pas en lui parlant — sinon Robin
  //  pourrait lancer le défi sans l'avoir voulu, en passant à côté.
  // ==========================================================================

  function arenaDoorOf(regionId) {
    var cities = R3ref.get('cities');
    if (!cities || typeof cities.get !== 'function') return null;
    try {
      var c = cities.get(regionId);
      if (c && c.arena && typeof c.arena.x === 'number') return { x: c.arena.x, y: c.arena.y };
    } catch (e) { /* ville indisponible : on laissera regions3d placer le PNJ */ }
    return null;
  }

  function championNpc(regionId) {
    var a = BY_REGION[regionId];
    if (!a) return null;
    var ch = a.champion;
    var door = arenaDoorOf(regionId);
    return {
      id: ch.id,
      name: ch.name,
      // Une tuile SOUS la porte : le champion tourne le dos au bâtiment et
      // fait face au joueur qui arrive de la place.
      x: door ? door.x : null,
      y: door ? door.y + 1 : null,
      dir: 'down',
      colorMap: ch.colorMap,
      accessory: ch.accessory || null,
      isTrainer: false,          // voir le commentaire ci-dessus
      isChampion: true,
      region: regionId,
      arenaType: a.type,
      title: ch.title,
      badge: a.badge,
      // Ce qu'il raconte quand on lui parle HORS combat : il présente l'arène
      // et invite à entrer, sans jamais déclencher le défi.
      dialog: [
        ch.name + ', ' + ch.title + '. Bienvenue à l’' + a.name.replace(/^Arène /, 'arène ') + '.',
        'Le défi se lance à la porte, juste là. Entre quand tu te sentiras prêt.',
        'Ici, on se bat en type ' + typeLabel(a.type) + '. Prépare ton équipe en conséquence !',
      ],
      party: partyIds(ch.team),
      team: ch.team.slice(),
      level: ch.team[ch.team.length - 1].level,
    };
  }

  function partyIds(team) {
    var out = [];
    for (var i = 0; i < team.length; i++) out.push(team[i].id);
    return out;
  }

  function typeLabel(id) {
    var types = R3ref.get('types');
    if (types && typeof types.label === 'function') {
      var l = types.label(id);
      if (l) return l;
    }
    return id;
  }

  // ==========================================================================
  //  6. LE COMBAT DE CHAMPION  —  `battleState` du §17
  //
  //  Le format doit être juste AU CHAMP PRÈS : `battle3d.js` et `hud3d.js` le
  //  lisent tous les deux sans jamais vérifier qu'un champ existe.
  // ==========================================================================

  /** Récupère l'équipe du joueur : argument explicite, sinon module team3d. */
  function resolvePlayerTeam(playerTeam) {
    if (Array.isArray(playerTeam) && playerTeam.length) return playerTeam;
    if (playerTeam && Array.isArray(playerTeam.team) && playerTeam.team.length) return playerTeam.team;
    var team = R3ref.get('team');
    if (team && Array.isArray(team.team) && team.team.length) return team.team;
    // Dernier recours : une créature de départ, pour que l'écran de combat
    // s'ouvre quand même au lieu de planter sur un `undefined.hp`.
    return [makeMon('feuillou', 5)];
  }

  /** Premier membre encore debout, ou le premier tout court. */
  function firstAlive(list) {
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].hp > 0) return { mon: list[i], index: i };
    return { mon: list[0] || null, index: 0 };
  }

  /**
   * Construit l'état de combat contre le champion d'une région.
   * @param {string} regionId
   * @param {Array|object} [playerTeam]  équipe du joueur ([Mon] ou module team
   *                                     ou rien : on lit alors `team3d`)
   * @returns {object|null} battleState conforme au §17, ou null si la région
   *                        n'a pas d'arène (jamais le cas pour les 6 du §3).
   */
  function makeBattle(regionId, playerTeam) {
    var a = BY_REGION[regionId];
    if (!a) return null;

    var ch = a.champion;
    var foeTeam = buildTeam(ch.team);
    var pTeam = resolvePlayerTeam(playerTeam);
    var p = firstAlive(pTeam);
    var f = firstAlive(foeTeam);

    // Fiche du dresseur adverse, telle que `hud3d.js` l'affiche en haut de
    // l'écran de combat et que `game3d.js` relit pour les dialogues de fin.
    var trainerCard = {
      id: ch.id,
      name: ch.name,
      title: ch.title,
      kind: 'champion',
      regionId: regionId,
      arenaName: a.name,
      arenaType: a.type,
      badge: a.badge,
      colorMap: ch.colorMap,
      accessory: ch.accessory || null,
      dialogIntro: ch.dialogIntro.slice(),
      dialogWin: ch.dialogWin.slice(),
      dialogLose: ch.dialogLose.slice(),
      legendWarn: ch.dialogLegendWarn || null,
      teamSize: foeTeam.length,
      xpReward: a.xpReward,
      rewardText: rewardText(regionId),
    };

    return {
      kind: 'champion',
      regionId: regionId,
      biome: 'citadel',                 // l'arène est dans la ville : ambiance « cité »
      player: { mon: p.mon, team: pTeam, index: p.index },
      foe:    { mon: f.mon, team: foeTeam, index: f.index, trainer: trainerCard },
      phase: 'intro',
      menuCursor: 0,
      moveCursor: 0,
      monCursor: 0,
      bagCursor: 0,
      result: null,
      anim: { seq: 0, side: null, moveId: null, fx: null, progress: 0 },
      ball: { active: false, progress: 0, shakeIndex: 0, result: null },
      canFlee: false,                   // on n'abandonne pas un champion
      canCatch: false,                  // et on ne capture pas ses créatures
    };
  }

  /**
   * Même chose pour un des 24 dresseurs (extension hors §12, mais `game3d.js`
   * en a besoin et le format est identique à un `kind: 'trainer'` près).
   * @param {object|string} npcOrId  le PNJ renvoyé par TRAINERS, ou son id.
   */
  function makeTrainerBattle(npcOrId, playerTeam, regionId) {
    var npc = npcOrId;
    if (typeof npcOrId === 'string') npc = findTrainer(npcOrId);
    if (!npc) return null;
    var spec = npc.team || [];
    if (!spec.length && npc.party) {
      spec = [];
      for (var i = 0; i < npc.party.length; i++) spec.push({ id: npc.party[i], level: npc.level || 5 });
    }
    var foeTeam = buildTeam(spec);
    var pTeam = resolvePlayerTeam(playerTeam);
    var p = firstAlive(pTeam);
    var f = firstAlive(foeTeam);
    return {
      kind: 'trainer',
      regionId: regionId || npc.region || null,
      biome: npc.place === 'beach' ? 'beach' : (npc.place === 'jungle' ? 'jungle' : 'plain'),
      player: { mon: p.mon, team: pTeam, index: p.index },
      foe: {
        mon: f.mon, team: foeTeam, index: f.index,
        trainer: {
          id: npc.id, name: npc.name, title: null, kind: 'trainer',
          regionId: npc.region || null,
          colorMap: npc.colorMap, accessory: npc.accessory || null,
          dialogIntro: (npc.dialog || []).slice(),
          dialogWin: (npc.dialogDefeated || []).slice(),
          dialogLose: ['Ce sera pour la prochaine fois ! Va soigner tes créatures.'],
          teamSize: foeTeam.length,
          xpReward: npc.reward || 60,
        },
      },
      phase: 'intro',
      menuCursor: 0, moveCursor: 0, monCursor: 0, bagCursor: 0,
      result: null,
      anim: { seq: 0, side: null, moveId: null, fx: null, progress: 0 },
      ball: { active: false, progress: 0, shakeIndex: 0, result: null },
      canFlee: false,
      canCatch: false,
    };
  }

  function findTrainer(id) {
    for (var r in TRAINERS) {
      if (!Object.prototype.hasOwnProperty.call(TRAINERS, r)) continue;
      var list = TRAINERS[r];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    }
    return null;
  }

  // ==========================================================================
  //  7. RÉCOMPENSE
  // ==========================================================================

  function badgeOf(regionId) {
    var a = BY_REGION[regionId];
    return a ? a.badge : null;
  }

  /** Phrase affichée quand Robin remporte le badge. */
  function rewardText(regionId) {
    var a = BY_REGION[regionId];
    if (!a) return '';
    var b = a.badge;
    return a.champion.name + ' te remet le ' + b.name + ' ' + b.icon + ' !\n' +
           b.motto + '\n' +
           'Toute ton équipe gagne ' + a.xpReward + ' points d’expérience !';
  }

  // ==========================================================================
  //  8. API — signature exacte du §12, plus quelques extensions documentées.
  // ==========================================================================

  var API = {
    ARENAS: ARENAS,
    get: function (regionId) { return BY_REGION[regionId] || null; },
    championNpc: championNpc,
    makeBattle: makeBattle,
    badgeOf: badgeOf,
    TRAINERS: TRAINERS,
    rewardText: rewardText,

    // --- extensions (hors contrat, réclamées par game3d / hud3d) ------------
    BADGES: BADGES,
    badges: function () {            // les 6 badges dans l'ordre de progression
      var out = [];
      for (var i = 0; i < ARENAS.length; i++) out.push(ARENAS[i].badge);
      return out;
    },
    order: function (regionId) { var a = BY_REGION[regionId]; return a ? a.order : 0; },
    trainersOf: function (regionId) { return TRAINERS[regionId] ? TRAINERS[regionId].slice() : []; },
    findTrainer: findTrainer,
    makeTrainerBattle: makeTrainerBattle,
    championTeam: function (regionId) {
      var a = BY_REGION[regionId];
      return a ? buildTeam(a.champion.team) : [];
    },
  };

  R3ref.register('arenas', API);

  // Confort de débogage dans la console du navigateur.
  if (typeof window !== 'undefined') window.ARENAS3D = API;
})();
