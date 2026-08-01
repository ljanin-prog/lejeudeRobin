// =============================================================================
//  moves3d.js — LES CAPACITÉS et le CALCUL DE COMBAT
// =============================================================================
//  Contenu (CONTRAT2 §7) :
//    · un socle NEUTRE (Charge, Repos…) utilisable par n'importe qui, plus
//      toutes les capacités historiques du jeu 2D (js/creatures.js) reprises
//      AVEC LEUR ID ET LEUR NOM FRANÇAIS — Robin les connaît par cœur, on n'y
//      touche pas ;
//    · 9 capacités pour chacun des 12 types : 2 faibles, 3 moyennes, 2 fortes,
//      1 signature légendaire et 1 soin thématique.
//
//  Une capacité :
//    { id, name, type, power, acc, heal, pp, fx, desc, priority, legendary }
//      power    [min, max] de dégâts de base, ou 0 pour un soin
//      heal     PV rendus : nombre absolu, ou { frac: 0.45 } des PV max
//      acc      précision 0.75 .. 1.0
//      pp       nombre d'utilisations (20 faible … 5 signature)
//      fx       effet visuel demandé à battle3d.js — parmi FX_ALLOWED
//      type     null = « neutre » : ni STAB ni table de types (voir plus bas)
//
//  Pourquoi des capacités sans type ? Les 12 types du contrat sont tous
//  élémentaires ; « Griffe », « Morsure » ou « Assaut » n'appartiennent à aucun.
//  Plutôt que de les forcer dans une case absurde (une Griffe de type Terre ?),
//  elles restent neutres : multiplicateur 1 contre tout le monde, pas de STAB.
//  hud3d.js affichera la pastille « ◇ Normal » que types3d.js renvoie déjà pour
//  un type inconnu.
//
//  Le catalogue porte AUSSI, sous le nom exact que `dex3d.js` leur donne, la
//  signature légendaire et le soin thématique de chacun des 12 types, plus les
//  attaques que le Pokédex distribue aux 62 espèces. Quelques capacités écrites
//  avant que ces noms ne soient fixés font maintenant double emploi : elles
//  restent définies (aucun id ne disparaît jamais) mais sont marquées
//  `legacy: true` — voir la section « IDS DOUBLONS » plus bas.
//
//  Dépendance unique et FACULTATIVE : R3.get('types'). Sans lui, tous les
//  multiplicateurs valent 1 et le combat reste jouable.
// =============================================================================

(function () {
  'use strict';

  // Les 18 effets visuels que battle3d.js sait jouer. N'en inventez pas d'autre :
  // un fx inconnu = une attaque sans animation à l'écran.
  const FX_ALLOWED = [
    'slash', 'beam', 'ball', 'wave', 'burst', 'heal', 'storm', 'quake', 'ice',
    'star', 'void', 'time', 'leaf', 'flame', 'bubble', 'bolt', 'wind', 'rock',
  ];

  const MOVES = Object.create(null);

  // ---------------------------------------------------------------------------
  // Fabriques — attaque et soin. Elles remplissent tous les champs pour que le
  // reste du jeu n'ait jamais à tester l'existence d'une propriété.
  // ---------------------------------------------------------------------------
  function M(id, name, type, power, acc, pp, fx, desc, extra) {
    const m = {
      id: id, name: name, type: type || null,
      power: power, acc: acc, heal: 0, pp: pp,
      fx: fx, desc: desc, priority: 0, legendary: false,
    };
    if (extra) Object.assign(m, extra);
    MOVES[id] = m;
    return m;
  }

  function H(id, name, type, heal, pp, desc) {
    const m = {
      id: id, name: name, type: type || null,
      power: 0, acc: 1.0, heal: heal, pp: pp,
      fx: 'heal', desc: desc, priority: 0, legendary: false,
    };
    MOVES[id] = m;
    return m;
  }

  // Marque des ids « doublons ». Une capacité plus récente — celle que dex3d.js
  // demande par son nom — occupe désormais exactement la même case (même type,
  // même rôle, mêmes chiffres). L'ancien id continue de fonctionner pour ne
  // casser aucun module, mais il ne compte plus dans les quotas du §7 (une
  // seule signature et un seul soin thématique par type) et n'apparaît plus
  // dans byType(), pour que le catalogue présenté au jeu reste propre.
  function legacy() {
    for (let i = 0; i < arguments.length; i++) {
      const m = MOVES[arguments[i]];
      if (m) m.legacy = true;
    }
  }

  // ===========================================================================
  //  SOCLE NEUTRE — pour tout le monde
  // ===========================================================================
  M('charge',        'Charge',        null, [10, 15], 1.00, 20, 'slash',
    "Un bon coup d'épaule : simple, mais ça marche toujours.");
  M('vitesse',       'Coup véloce',   null, [9, 13],  1.00, 20, 'wind',
    "Si rapide qu'on frappe avant l'adversaire.", { priority: 1 });
  M('esquive',       'Esquive',       null, [8, 12],  1.00, 20, 'wind',
    "Une feinte, un pas de côté, et un petit coup bien placé.", { priority: 1 });
  H('repos',         'Repos',         null, { frac: 0.40 }, 10,
    "Une bonne sieste : rend 40 % des PV maximum.");
  H('concentration', 'Concentration', null, { frac: 0.25 }, 10,
    "Ferme les yeux, respire, et retrouve un peu de forces.");

  // --- Capacités historiques du jeu 2D, sans type élémentaire ---------------
  M('vite',       'Coup rapide',      null, [8, 12],  1.00, 20, 'slash',
    "Une frappe éclair, difficile à voir venir.", { priority: 1 });
  M('assaut',     'Assaut',           null, [14, 19], 0.95, 15, 'slash',
    "Fonce tête baissée sur l'adversaire.");
  M('force',      'Grand coup',       null, [24, 31], 0.90, 8,  'burst',
    "Toute la puissance de la créature dans un seul coup.");
  M('griffe',     'Griffe',           null, [9, 14],  1.00, 20, 'slash',
    "Trois coups de griffes bien nets.");
  M('pince',      'Pincement',        null, [10, 14], 0.95, 20, 'slash',
    "Une pince qui se referme d'un coup sec.");
  M('morsure',    'Morsure',          null, [14, 19], 0.95, 15, 'slash',
    "Un coup de dents surprise.");
  M('roulade',    'Roulade',          null, [16, 22], 0.95, 15, 'burst',
    "Se met en boule et roule sur l'adversaire.");
  M('rebond',     'Super rebond',     null, [16, 21], 0.95, 15, 'burst',
    "Rebondit très haut puis retombe de tout son poids.");
  M('dragon',     'Souffle dragon',   null, [16, 22], 0.95, 15, 'beam',
    "Le souffle ancien des dragons, chaud et grondant.");
  M('dragonRage', 'Colère du dragon', null, [25, 34], 0.90, 8,  'burst',
    "Le dragon se fâche pour de bon : mieux vaut s'écarter.");
  // Les six soins hérités du jeu 2D rendaient un nombre FIXE de PV. C'était
  // juste au niveau 6 (10 PV sur 67), ridicule au niveau 50 (10 PV sur 400) :
  // la capacité devenait une case perdue au moment où on en a le plus besoin.
  // Ils rendent maintenant une FRACTION des PV maximum, calée pour rendre à peu
  // près la même chose qu'avant au niveau où on les apprend, et rester utile
  // ensuite. Aucun ne dépasse 25 % : ils restent volontairement plus faibles
  // que `repos` (40 %) et que les soins typés (45 %), qui coûtent, eux, deux
  // fois moins de PP. Voir CONTRACT2 §9.
  H('soin1',   'Repos léger',    null, { frac: 0.15 }, 20,
    "Une petite pause : rend 15 % des PV maximum.");
  H('soin2',   'Soin',           null, { frac: 0.22 }, 15,
    "Se soigne tranquillement : rend 22 % des PV maximum.");
  H('calin',   'Câlin soin',     null, { frac: 0.20 }, 15,
    "Un gros câlin qui fait beaucoup de bien : rend 20 % des PV maximum.");
  H('ronron',  'Ronron soignant',null, { frac: 0.22 }, 15,
    "Un ronronnement doux qui referme les bobos : rend 22 % des PV maximum.");

  // ===========================================================================
  //  FEU 🔥
  // ===========================================================================
  M('etincelle',    'Étincelle',           'feu', [8, 13],  1.00, 20, 'flame',
    "Une petite étincelle qui pique le bout du nez.");
  M('griffeBraise', 'Griffe de braise',    'feu', [10, 14], 0.95, 20, 'slash',
    "Des griffes brûlantes qui laissent une trace rouge.");
  M('flamme',       'Flamme',              'feu', [14, 20], 0.95, 15, 'flame',
    "Un jet de flammes droit devant.");
  M('crocBraise',   'Croc de braise',      'feu', [15, 21], 0.95, 15, 'slash',
    "Un coup de crocs chauffés à blanc : ça mord et ça brûle en même temps.");
  M('jetDeLave',    'Jet de lave',         'feu', [16, 22], 0.95, 15, 'flame',
    "Crache un jet de lave bien épais, comme un petit volcan de poche.");
  M('bouleFeu',     'Boule de feu',        'feu', [15, 21], 0.95, 15, 'ball',
    "Une boule de feu bien ronde, lancée en cloche.");
  M('souffleCendre','Souffle de cendres',  'feu', [14, 19], 0.90, 15, 'burst',
    "Un nuage de cendres brûlantes en pleine figure.");
  M('inferno',      'Inferno',             'feu', [24, 33], 0.90, 8,  'burst',
    "Un brasier immense qui monte jusqu'au ciel.");
  M('laveFondue',   'Coulée de lave',      'feu', [26, 34], 0.85, 8,  'wave',
    "Une vague de lave épaisse qui roule lentement sur l'adversaire.");
  M('souffleDuVolcan', 'Souffle du Volcan','feu', [38, 50], 0.85, 5,  'flame',
    "Le volcan tout entier expire d'un coup : le ciel devient rouge.", { legendary: true });
  M('souffleMagma', 'Souffle du Magma',    'feu', [38, 50], 0.85, 5,  'flame',
    "Pyrathos ouvre la gueule, et le volcan lui répond.", { legendary: true });
  H('coconBraise',  'Cocon de braise',     'feu', { frac: 0.45 }, 10,
    "S'enroule dans des braises douces et récupère des PV.");

  // ===========================================================================
  //  EAU 💧
  // ===========================================================================
  M('jetEau',    "Jet d'eau",         'eau', [10, 14], 1.00, 20, 'bubble',
    "Un jet d'eau bien net, droit dans la figure.");
  M('bulle',     "Bulle d'eau",       'eau', [9, 14],  1.00, 20, 'bubble',
    "Envoie une grosse bulle qui éclate à l'impact.");
  M('nageoire',  'Coup de nageoire',  'eau', [14, 19], 0.95, 15, 'wave',
    "Une gifle de nageoire qui claque comme un fouet.");
  M('tentacule', 'Tentacule',         'eau', [14, 20], 0.95, 15, 'wave',
    "Un tentacule souple qui vient cueillir l'adversaire.");
  M('pluieBattante','Pluie battante', 'eau', [15, 22], 0.90, 15, 'storm',
    "Une averse glaciale qui tombe d'un seul coup.");
  M('torrent',   'Torrent',           'eau', [16, 22], 0.95, 15, 'wave',
    "Un torrent de montagne dévale la pente et emporte tout sur son passage.");
  M('hydro',     'Hydromoteur',       'eau', [24, 32], 0.90, 8,  'wave',
    "Un torrent lancé à toute puissance.");
  M('vagueDeferlante','Vague déferlante','eau', [26, 34], 0.85, 8, 'wave',
    "Une vague énorme qui recouvre tout le terrain.");
  M('deferlanteAbyssale','Déferlante Abyssale','eau', [38, 50], 0.85, 5, 'wave',
    "Le fond de l'océan se soulève : une vague noire recouvre tout le terrain.",
    { legendary: true });
  M('fureurAbysses','Fureur des Abysses','eau', [38, 50], 0.85, 5, 'wave',
    "Abyssalor appelle l'océan tout entier à la rescousse.", { legendary: true });
  H('sourceVive',  'Source vive',     'eau', { frac: 0.45 }, 10,
    "Une source jaillit du sol : quelques gorgées et les forces reviennent.");
  H('sourceClaire','Source claire',   'eau', { frac: 0.45 }, 10,
    "Boit à une source fraîche et retrouve des PV.");

  // ===========================================================================
  //  PLANTE 🌿
  // ===========================================================================
  M('gland',    'Coup de gland',        'plante', [9, 14],  1.00, 20, 'leaf',
    "Lance un gland dur comme du bois.");
  M('poudre',   'Poudre dodo',          'plante', [8, 13],  0.90, 20, 'leaf',
    "Une poudre endormante qui fait piquer du nez.");
  M('feuille',  'Lame feuille',         'plante', [14, 20], 0.95, 15, 'leaf',
    "Des feuilles tranchantes comme des lames.");
  M('petale',   'Tempête de pétales',   'plante', [16, 22], 0.95, 15, 'leaf',
    "Un tourbillon de pétales, joli mais redoutable.");
  M('bambou',   'Coup de bambou',       'plante', [15, 21], 0.95, 15, 'slash',
    "Un grand bâton de bambou qui siffle dans l'air.");
  M('lianeFouet','Fouet de liane',      'plante', [15, 21], 0.95, 15, 'leaf',
    "Une liane claque comme un fouet et revient aussitôt.");
  M('pluieDeGraines','Pluie de graines','plante', [14, 20], 0.95, 15, 'leaf',
    "Des centaines de graines dures tombent d'un coup, comme de la grêle verte.");
  M('soleil',   'Rayon solaire',        'plante', [24, 32], 0.90, 8,  'beam',
    "Concentre la lumière du soleil en un rayon vert.");
  M('lianesGeantes','Lianes géantes',   'plante', [25, 34], 0.85, 8,  'leaf',
    "Des lianes énormes jaillissent du sol et attrapent l'adversaire.");
  M('foretPrimordiale','Forêt Primordiale','plante', [38, 50], 0.85, 5, 'leaf',
    "La toute première forêt du monde repousse d'un coup et referme ses branches.",
    { legendary: true });
  M('reveilForet','Réveil de la Forêt', 'plante', [38, 50], 0.85, 5,  'leaf',
    "Sylvaros réveille les arbres : la forêt entière attaque.", { legendary: true });
  H('roseeGuerisseuse','Rosée guérisseuse','plante', { frac: 0.45 }, 10,
    "Une rosée du matin qui referme toutes les blessures.");

  // ===========================================================================
  //  FOUDRE ⚡
  // ===========================================================================
  M('picotement', 'Picotement',        'foudre', [8, 13],  1.00, 20, 'bolt',
    "De petites décharges qui font sursauter.");
  M('crepitement','Crépitement',       'foudre', [9, 14],  1.00, 20, 'bolt',
    "Le poil se hérisse : ça crépite de partout.");
  M('etincelleVive','Étincelle vive',  'foudre', [10, 14], 1.00, 20, 'bolt',
    "Une étincelle bleue si vive qu'on la voit encore les yeux fermés.");
  M('eclair',     'Éclair',            'foudre', [16, 22], 0.95, 15, 'bolt',
    "Un éclair rapide comme… un éclair.");
  M('arcElectrique','Arc électrique',  'foudre', [15, 21], 0.95, 15, 'bolt',
    "Un arc bleu qui saute d'un bout à l'autre du terrain.");
  M('filetVolts', 'Filet de volts',    'foudre', [14, 20], 0.90, 15, 'storm',
    "Un filet électrique qui se referme sur l'adversaire.");
  M('tonnerre',   'Tonnerre',          'foudre', [25, 34], 0.90, 8,  'storm',
    "Le ciel gronde et la foudre tombe.");
  M('foudroiement','Foudroiement',     'foudre', [24, 32], 0.85, 8,  'bolt',
    "Une décharge énorme, droit du nuage à l'adversaire.");
  M('orageCeleste','Orage Céleste',    'foudre', [38, 50], 0.85, 5,  'storm',
    "Tous les orages du ciel se donnent rendez-vous au même endroit, au même instant.",
    { legendary: true });
  M('eclairPrimordial','Éclair Primordial','foudre', [38, 50], 0.85, 5, 'storm',
    "Fulguron déchire le ciel d'un seul battement d'ailes.", { legendary: true });
  H('rechargeVive', 'Recharge vive',   'foudre', { frac: 0.45 }, 10,
    "Aspire l'électricité de l'air et se recharge comme une pile toute neuve.");
  H('rechargeOrage','Recharge d\'orage','foudre', { frac: 0.45 }, 10,
    "Se recharge dans l'orage et retrouve son énergie.");

  // ===========================================================================
  //  GLACE ❄️
  // ===========================================================================
  M('flocon',      'Flocon piquant',   'glace', [8, 13],  1.00, 20, 'ice',
    "Un flocon minuscule, mais glacé comme un glaçon.");
  M('souffleFroid','Souffle froid',    'glace', [10, 14], 0.95, 20, 'ice',
    "Un souffle qui givre le bout des moustaches.");
  M('lameGivre',   'Lame de givre',    'glace', [14, 20], 0.95, 15, 'slash',
    "Une lame de glace taillée en un clin d'œil.");
  M('grelons',     'Averse de grêlons','glace', [15, 21], 0.90, 15, 'storm',
    "Des grêlons gros comme des billes tombent du ciel.");
  M('grelon',      'Grêlon géant',     'glace', [15, 21], 0.95, 15, 'ice',
    "Un seul grêlon, mais gros comme un ballon de foot.");
  M('soufflePolaire','Souffle polaire','glace', [16, 22], 0.95, 15, 'ice',
    "Le vent du pôle en pleine figure : on en a les moustaches gelées.");
  M('brumeGelee',  'Brume gelée',      'glace', [16, 22], 0.90, 15, 'ice',
    "Une brume glaciale qui engourdit tout ce qu'elle touche.");
  M('pieuGlace',   'Pieu de glace',    'glace', [24, 32], 0.90, 8,  'ice',
    "Un pieu de glace pointu lancé comme une flèche.");
  M('blizzard',    'Blizzard',         'glace', [26, 34], 0.85, 8,  'storm',
    "Une tempête de neige à ne plus rien voir devant soi.");
  M('hiverEternel','Souffle de l\'Hiver Éternel','glace', [38, 50], 0.85, 5, 'ice',
    "Un seul souffle, et l'hiver s'installe pour mille ans : tout devient cristal.",
    { legendary: true });
  H('haleineDeGivre','Haleine de givre','glace', { frac: 0.45 }, 10,
    "Respire lentement l'air glacé : chaque bouffée referme une blessure.");
  H('sommeilGivre','Sommeil de givre', 'glace', { frac: 0.45 }, 10,
    "S'endort sous une couette de neige et récupère des PV.");

  // ===========================================================================
  //  AIR 💨
  // ===========================================================================
  M('bec',        'Coup de bec',       'air', [8, 13],  1.00, 20, 'wind',
    "Un coup de bec vif et précis.");
  M('brise',      'Petite brise',      'air', [9, 14],  1.00, 20, 'wind',
    "Un courant d'air taquin qui pousse l'adversaire.");
  M('aile',       "Coup d'aile",       'air', [14, 20], 0.95, 15, 'wind',
    "Un grand battement d'ailes en plein visage.");
  M('plumes',     'Plumes tourbillon', 'air', [16, 22], 0.95, 15, 'wind',
    "Un tourbillon de plumes coupantes.");
  M('serre',      'Serre acérée',      'air', [15, 21], 0.95, 15, 'slash',
    "Fond du ciel et attrape l'adversaire dans ses serres.");
  M('rafale',     'Rafale',            'air', [9, 14],  1.00, 20, 'wind',
    "Une bourrasque courte et sèche, juste assez pour déséquilibrer.");
  M('tourbillon', 'Tourbillon',        'air', [16, 22], 0.95, 15, 'wind',
    "Un entonnoir d'air qui fait tourner l'adversaire jusqu'au vertige.");
  M('bourrasque', 'Bourrasque',        'air', [24, 32], 0.90, 8,  'wind',
    "Un coup de vent à décoiffer une montagne.");
  M('tornade',    'Tornade',           'air', [26, 34], 0.85, 8,  'storm',
    "Une tornade qui emporte tout sur son passage.");
  M('tempeteDeVent','Tempête de vent', 'air', [25, 33], 0.85, 8,  'storm',
    "Le vent se lève de partout à la fois : impossible de tenir debout.");
  M('ouraganMajeur','Ouragan Majeur',  'air', [38, 50], 0.85, 5,  'storm',
    "Un ouragan grand comme une région se lève et emporte tout jusqu'aux nuages.",
    { legendary: true });
  M('souffleCimes','Souffle des Cimes','air', [38, 50], 0.85, 5,  'wind',
    "Bourrasca appelle le vent des plus hauts sommets.", { legendary: true });
  H('chant',      'Chant apaisant',    'air', { frac: 0.22 }, 15,
    "Une mélodie douce portée par le vent : rend 22 % des PV maximum.");
  H('brisePaisible','Brise paisible',  'air', { frac: 0.45 }, 10,
    "Une brise tiède fait le tour de la créature et la remet d'aplomb.");

  // ===========================================================================
  //  TERRE 🍂
  // ===========================================================================
  M('motteTerre', 'Motte de terre',    'terre', [9, 14],  1.00, 20, 'quake',
    "Déterre une grosse motte et la lance.");
  M('jetSable',   'Jet de sable',      'terre', [8, 13],  1.00, 20, 'wind',
    "Envoie du sable dans les yeux de l'adversaire.");
  M('secousse',   'Secousse',          'terre', [14, 20], 0.95, 15, 'quake',
    "Tape le sol : tout tremble autour.");
  M('bourbier',   'Bourbier',          'terre', [15, 21], 0.90, 15, 'quake',
    "Le sol devient une boue collante dont on ne sort plus.");
  M('sableMouvant','Sable mouvant',    'terre', [10, 14], 0.95, 20, 'quake',
    "Le sol devient mou d'un coup : on s'enfonce jusqu'aux genoux.");
  M('ruadeTerre', 'Ruade de terre',    'terre', [16, 22], 0.95, 15, 'rock',
    "Une ruade qui projette la terre et les cailloux.");
  M('coupDeTerre','Coup de terre',     'terre', [15, 21], 0.95, 15, 'quake',
    "Frappe le sol des deux pattes : la terre se soulève sous l'adversaire.");
  M('crevasse',   'Crevasse',          'terre', [24, 32], 0.90, 8,  'quake',
    "Ouvre une longue fissure sous les pieds de l'adversaire.");
  M('seisme',     'Séisme',            'terre', [26, 34], 0.85, 8,  'quake',
    "Un tremblement de terre qui secoue tout le terrain.");
  M('failleTitanesque','Faille Titanesque','terre', [38, 50], 0.85, 5, 'quake',
    "Le sol s'ouvre d'un bout à l'autre de la région et avale tout ce qui traîne.",
    { legendary: true });
  M('colereMontagne','Colère de la Montagne','terre', [38, 50], 0.85, 5, 'quake',
    "Géomastre pose une patte, et la montagne se soulève.", { legendary: true });
  H('terreNourriciere','Terre nourricière','terre', { frac: 0.45 }, 10,
    "S'allonge sur la bonne terre chaude, qui rend tout ce qu'elle a reçu.");
  H('racinesNourricieres','Racines nourricières','terre', { frac: 0.45 }, 10,
    "Plonge ses racines dans le sol et se nourrit de la terre.");

  // ===========================================================================
  //  ROCHE 🪨
  // ===========================================================================
  M('caillou',    'Jet de caillou',    'roche', [9, 14],  1.00, 20, 'rock',
    "Un caillou bien lancé, ça fait toujours mal.");
  M('galet',      'Ricochet de galet', 'roche', [8, 13],  1.00, 20, 'rock',
    "Un galet plat qui rebondit deux fois avant de toucher.");
  M('jetDePierre','Jet de pierre',     'roche', [10, 14], 1.00, 20, 'rock',
    "Ramasse une pierre bien pointue et la lance de toutes ses forces.");
  M('eclatPierre','Éclat de pierre',   'roche', [14, 20], 0.95, 15, 'rock',
    "Fait éclater une pierre et en projette les morceaux.");
  M('eclatRocheux','Éclat rocheux',    'roche', [16, 22], 0.95, 15, 'rock',
    "Un éclat de roche tranchant comme un couteau de pierre.");
  M('pierresRoulantes','Pierres roulantes','roche', [15, 21], 0.95, 15, 'rock',
    "Des pierres dévalent la pente en grondant.");
  M('massuePierre','Massue de pierre', 'roche', [16, 22], 0.90, 15, 'burst',
    "Un énorme bloc brandi comme une massue.");
  M('poingGranit','Poing de granit',   'roche', [24, 32], 0.90, 8,  'burst',
    "Un poing dur comme du granit, lourd comme une enclume.");
  M('avalancheDePierres','Avalanche de pierres','roche', [26, 34], 0.85, 8, 'rock',
    "Toute la falaise dégringole d'un coup.");
  M('avalanchePierres','Éboulement',   'roche', [26, 34], 0.85, 8,  'rock',
    "Les rochers du haut de la pente partent tous en même temps.");
  M('chuteDeMenhirs','Chute des Menhirs','roche', [38, 50], 0.85, 5, 'rock',
    "Des menhirs gros comme des tours tombent du ciel, l'un après l'autre.",
    { legendary: true });
  M('chuteMenhirs','Pluie de menhirs', 'roche', [38, 50], 0.85, 5,  'rock',
    "Monolithe fait tomber ses pierres géantes du haut du ciel.", { legendary: true });
  H('carapaceDePierre','Carapace de pierre','roche', { frac: 0.45 }, 10,
    "Se referme dans une carapace de pierre, le temps que tout se répare.");
  H('carapacePierre','Coquille de granit','roche', { frac: 0.45 }, 10,
    "Se referme dans une coquille de granit et récupère des PV.");

  // ===========================================================================
  //  LUMIÈRE ✨
  // ===========================================================================
  M('feerie',     'Éclat fée',         'lumiere', [10, 14], 1.00, 20, 'star',
    "Une pluie d'étincelles roses et dorées.");
  M('etoile',     "Coup d'étoile",     'lumiere', [9, 14],  1.00, 20, 'star',
    "Lance une petite étoile pointue.");
  M('magie',      'Baguette magique',  'lumiere', [16, 22], 0.95, 15, 'beam',
    "Un coup de baguette et hop : de la lumière plein les yeux.");
  M('rayonDore',  'Rayon doré',        'lumiere', [15, 21], 0.95, 15, 'beam',
    "Un rayon chaud et doré, comme un matin d'été.");
  M('eclatMiroir','Éclat de miroir',   'lumiere', [14, 20], 0.95, 15, 'burst',
    "Renvoie la lumière d'un coup, en plein dans les yeux.");
  M('rayonDeLumiere','Rayon de lumière','lumiere', [16, 22], 0.95, 15, 'beam',
    "Un rayon blanc et net, tracé comme au règle en travers du terrain.");
  M('eclatDore',  'Éclat doré',        'lumiere', [15, 21], 0.95, 15, 'star',
    "Une gerbe d'or qui éclate en plein vol, comme un petit soleil.");
  M('etoileEx',   "Explosion d'étoiles",'lumiere', [24, 32], 0.90, 8, 'star',
    "Un feu d'artifice d'étoiles filantes.");
  M('lanceLumiere','Lance de lumière', 'lumiere', [26, 34], 0.85, 8,  'beam',
    "Une lance de pure lumière, lancée comme un javelot.");
  M('jugementSolaire','Jugement Solaire','lumiere', [38, 50], 0.85, 5, 'beam',
    "Le soleil se penche pour regarder l'adversaire de très, très près.",
    { legendary: true });
  M('couronneAurore','Couronne d\'Aurore','lumiere', [38, 50], 0.85, 5, 'beam',
    "Auréol déploie son auréole : le jour se lève d'un seul coup.", { legendary: true });
  H('soinMagie',  'Soin magique',      'lumiere', { frac: 0.25 }, 15,
    "Un sort tout doux : rend 25 % des PV maximum.");
  H('lueurBienfaisante','Lueur bienfaisante','lumiere', { frac: 0.45 }, 10,
    "Une lumière tiède se pose sur les blessures et les efface une à une.");

  // ===========================================================================
  //  OMBRE 🌑
  // ===========================================================================
  M('ombrePiquante','Ombre piquante',  'ombre', [9, 14],  1.00, 20, 'void',
    "Son ombre s'allonge et vient pincer l'adversaire.");
  M('frisson',    'Petit frisson',     'ombre', [8, 13],  1.00, 20, 'void',
    "Un souffle froid dans le dos : brrr.");
  M('griffeNoire','Griffe noire',      'ombre', [14, 20], 0.95, 15, 'slash',
    "Des griffes de fumée noire qui traversent tout.");
  M('voileObscur','Voile obscur',      'ombre', [15, 21], 0.90, 15, 'void',
    "La nuit tombe d'un coup sur l'adversaire.");
  M('griffeSombre','Griffe d\'ombre',  'ombre', [10, 14], 1.00, 20, 'slash',
    "Une petite griffe d'ombre qui sort de nulle part et repart aussitôt.");
  M('spectreRieur','Spectre rieur',    'ombre', [16, 22], 0.90, 15, 'void',
    "Un fantôme moqueur qui surgit en ricanant.");
  M('voileNoir',  'Voile noir',        'ombre', [15, 21], 0.90, 15, 'void',
    "Jette un grand drap d'ombre sur l'adversaire, qui ne voit plus rien.");
  M('morsureSombre','Morsure sombre',  'ombre', [16, 22], 0.95, 15, 'slash',
    "Des crocs d'ombre se referment sans le moindre bruit.");
  M('luneEclat',  'Éclat lunaire',     'ombre', [24, 32], 0.90, 8,  'beam',
    "Un rayon de lune argenté, froid et tranchant.");
  M('gouffreNoir','Gouffre noir',      'ombre', [26, 34], 0.85, 8,  'void',
    "Un trou d'ombre s'ouvre sous les pattes de l'adversaire.");
  M('abimeSombre','Abîme sombre',      'ombre', [25, 33], 0.85, 8,  'void',
    "L'ombre s'ouvre en grand et n'a plus l'air d'avoir de fond.");
  M('nuitSansFin','Nuit Sans Fin',     'ombre', [38, 50], 0.85, 5,  'void',
    "La nuit tombe et refuse de repartir : plus une seule étoile au ciel.",
    { legendary: true });
  M('morsureTenebres','Morsure des Ténèbres','ombre', [38, 50], 0.85, 5, 'void',
    "Nyxaroth surgit de ta propre ombre et referme les crocs.", { legendary: true });
  H('voileReparateur','Voile réparateur','ombre', { frac: 0.45 }, 10,
    "Un voile d'ombre douce recoud tout ce qui est abîmé.");
  H('voileNuit',  'Voile de nuit',     'ombre', { frac: 0.45 }, 10,
    "S'enveloppe dans la nuit et récupère des PV en silence.");

  // ===========================================================================
  //  TEMPS ⏳
  // ===========================================================================
  M('grainSable', 'Grain de sable',    'temps', [8, 13],  1.00, 20, 'time',
    "Un grain de sable de sablier, minuscule et très vieux.");
  M('tictac',     'Tic-tac',           'temps', [9, 14],  1.00, 20, 'time',
    "Un tic-tac agaçant qui donne mal à la tête.");
  M('sablier',    'Sablier renversé',  'temps', [14, 20], 0.95, 15, 'time',
    "Retourne le sablier : l'adversaire perd le fil.");
  M('retourEclair','Retour éclair',    'temps', [15, 21], 0.95, 15, 'time',
    "Revient une seconde en arrière pour frapper en premier.", { priority: 1 });
  M('retourArriere','Retour en arrière','temps', [15, 21], 0.95, 15, 'time',
    "Recule de trois secondes et frappe là où l'adversaire était déjà.",
    { priority: 1 });
  M('ridesDuTemps','Rides du temps',   'temps', [16, 22], 0.90, 15, 'time',
    "Le temps passe trop vite d'un seul coup : ça fatigue.");
  M('ralentissement','Ralentissement', 'temps', [16, 22], 0.90, 15, 'time',
    "Le temps s'épaissit comme du miel : chaque geste devient très lourd.");
  M('boucleSansFin','Boucle sans fin', 'temps', [24, 32], 0.90, 8,  'time',
    "Enferme l'adversaire dans la même seconde, encore et encore.");
  M('arretDuTemps','Arrêt du temps',   'temps', [26, 34], 0.85, 8,  'time',
    "Tout se fige, sauf celui qui a lancé l'attaque.");
  M('tempeteDuTemps','Tempête du temps','temps', [25, 33], 0.85, 8, 'time',
    "Toutes les heures de la journée tombent en même temps sur l'adversaire.");
  M('fractureTemporelle','Fracture Temporelle','temps', [38, 50], 0.85, 5, 'time',
    "L'instant se fend en deux : mille ans passent d'un seul coup.",
    { legendary: true });
  M('fissureTemps','Fissure du Temps', 'temps', [38, 50], 0.85, 5,  'time',
    "Chronoss fend l'instant : mille ans passent d'un coup.", { legendary: true });
  H('remonterLeTemps','Remonter le temps','temps', { frac: 0.50 }, 10,
    "Revient juste avant d'avoir été blessé : rend la moitié des PV.");
  H('remonterTemps','Rembobiner',      'temps', { frac: 0.50 }, 10,
    "Rembobine la minute qui vient de passer et efface les dégâts reçus.");

  // ===========================================================================
  //  ESPACE 🌌
  // ===========================================================================
  M('poussiereEtoiles','Poussière d\'étoiles','espace', [9, 14], 1.00, 20, 'star',
    "Une poignée de poussière d'étoiles jetée en l'air.");
  M('petitMeteore','Petit météore',    'espace', [10, 14], 0.95, 20, 'ball',
    "Un caillou venu du ciel, tout chaud du voyage.");
  M('ondeCosmique','Onde cosmique',    'espace', [15, 21], 0.95, 15, 'beam',
    "Une onde venue du fond de l'univers.");
  M('cometeFilante','Comète filante',  'espace', [16, 22], 0.95, 15, 'star',
    "Une comète traverse le terrain en laissant une traînée.");
  M('poussiereStellaire','Poussière stellaire','espace', [10, 14], 1.00, 20, 'star',
    "Une pincée de poussière d'étoile qui pique comme du sable très chaud.");
  M('meteore',    'Météore',           'espace', [16, 22], 0.95, 15, 'ball',
    "Un vrai météore, choisi dans le ciel et lancé droit sur la cible.");
  M('gravite',    'Gravité',           'espace', [15, 21], 0.90, 15, 'void',
    "La gravité double d'un coup : l'adversaire s'écrase contre le sol.");
  M('apesanteur', 'Apesanteur',        'espace', [14, 20], 0.90, 15, 'void',
    "L'adversaire décolle du sol et ne sait plus où il est.");
  M('trouNoir',   'Petit trou noir',   'espace', [24, 32], 0.90, 8,  'void',
    "Un trou noir gros comme une bille, qui aspire tout.");
  M('pluieDeMeteores','Pluie de météores','espace', [26, 34], 0.85, 8, 'ball',
    "Le ciel entier se met à tomber en morceaux brûlants.");
  M('pluieMeteores','Averse d\'étoiles filantes','espace', [26, 34], 0.85, 8, 'ball',
    "Une averse d'étoiles filantes qui n'a rien d'un joli spectacle.");
  M('effondrementStellaire','Effondrement Stellaire','espace', [38, 50], 0.85, 5, 'star',
    "Toutes les étoiles du ciel s'effondrent ensemble en un point minuscule.",
    { legendary: true });
  M('spiraleGalaxie','Spirale de la Galaxie','espace', [38, 50], 0.85, 5, 'star',
    "Vortexis déroule sa spirale d'étoiles autour de l'adversaire.", { legendary: true });
  H('nebuleuseReparatrice','Nébuleuse réparatrice','espace', { frac: 0.45 }, 10,
    "Un nuage d'étoiles enveloppe la créature et recolle tous les morceaux.");
  H('berceauEtoiles','Berceau d\'étoiles','espace', { frac: 0.45 }, 10,
    "Se blottit dans un berceau d'étoiles et retrouve des PV.");

  // ===========================================================================
  //  IDS DOUBLONS — conservés, mais hors quota
  // ===========================================================================
  //  Ces capacités ont été écrites avant que `dex3d.js` ne fixe le nom exact de
  //  la signature et du soin de chaque type. Elles font DOUBLE EMPLOI avec la
  //  capacité juste au-dessus d'elles dans leur bloc : mêmes chiffres, même
  //  rôle, même type. On ne les supprime pas — un module écrit en parallèle
  //  peut les nommer — mais elles ne comptent plus comme « la » signature ni
  //  comme « le » soin du type, et byType() ne les propose plus.
  legacy(
    // signatures remplacées par l'id attendu par le Pokédex
    'souffleMagma', 'fureurAbysses', 'reveilForet', 'eclairPrimordial',
    'souffleCimes', 'colereMontagne', 'chuteMenhirs', 'couronneAurore',
    'morsureTenebres', 'fissureTemps', 'spiraleGalaxie',
    // soins thématiques remplacés
    'sourceClaire', 'rechargeOrage', 'sommeilGivre', 'racinesNourricieres',
    'carapacePierre', 'voileNuit', 'remonterTemps', 'berceauEtoiles',
    // attaques fortes en double
    'avalanchePierres', 'pluieMeteores'
  );

  // ===========================================================================
  //  ACCÈS
  // ===========================================================================
  function get(id) { return MOVES[id] || MOVES.charge; }

  /** Toutes les capacités d'un type, de la plus faible à la plus forte. */
  function byType(type) {
    const out = [];
    for (const id in MOVES) {
      if (MOVES[id].type === type && !MOVES[id].legacy) out.push(MOVES[id]);
    }
    out.sort(function (a, b) { return avgPower(a) - avgPower(b); });
    return out;
  }

  function avgPower(m) {
    return (m && m.power && m.power.length) ? (m.power[0] + m.power[1]) / 2 : 0;
  }

  function isHeal(m) { return !!(m && m.heal); }

  // ===========================================================================
  //  CALCUL DE COMBAT
  // ===========================================================================
  function typesApi() {
    // Résolu à chaque appel : moves3d peut être chargé avant types3d.
    return (typeof R3 !== 'undefined' && R3 && R3.get) ? R3.get('types') : null;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function randIn(power) {
    const lo = power[0], hi = power[1];
    return lo + Math.random() * (hi - lo);
  }

  /**
   * Résout un usage de capacité.
   * -> { missed, dmg, heal, mult, crit, text }
   *    `text` ne porte QUE le message d'efficacité (ou null) : les phrases de
   *    raté / de soin appartiennent au HUD, qui connaît les surnoms.
   */
  function compute(attacker, defender, move) {
    const res = { missed: false, dmg: 0, heal: 0, mult: 1, crit: false, text: null };
    const a = attacker || {};
    const d = defender || {};
    const m = move || MOVES.charge;

    // 1. Précision -------------------------------------------------------------
    const acc = (typeof m.acc === 'number') ? m.acc : 1;
    if (acc < 1 && Math.random() > acc) {
      res.missed = true;
      return res;
    }

    // 2. Soin ------------------------------------------------------------------
    if (m.heal) {
      const maxHp = (typeof a.maxHp === 'number' && a.maxHp > 0) ? a.maxHp : 60;
      let h;
      if (typeof m.heal === 'number') h = m.heal;
      else if (typeof m.heal.frac === 'number') h = maxHp * m.heal.frac;
      else h = 0;
      h = Math.max(1, Math.round(h));
      // On ne rend jamais plus que ce qui manque : le HUD affiche le vrai gain.
      if (typeof a.hp === 'number') h = Math.max(0, Math.min(h, maxHp - a.hp));
      res.heal = h;
      return res;
    }

    // 3. Dégâts ----------------------------------------------------------------
    const power = (m.power && m.power.length === 2) ? m.power : [10, 15];
    const base = randIn(power);

    const lvlA = (typeof a.level === 'number') ? a.level : 5;
    const lvlD = (typeof d.level === 'number') ? d.level : 5;
    const niveau = clamp(1 + (lvlA - lvlD) * 0.03, 0.7, 1.4);

    const atk = (typeof a.atk === 'number' && a.atk > 0) ? a.atk : 10;
    const def = (typeof d.def === 'number' && d.def > 0) ? d.def : 10;
    const stats = clamp(atk / def, 0.6, 1.7);

    const aTypes = Array.isArray(a.types) ? a.types : (a.types ? [a.types] : []);
    const stab = (m.type && aTypes.indexOf(m.type) !== -1) ? 1.25 : 1;

    const T = typesApi();
    const mult = (T && T.effectiveness) ? T.effectiveness(m.type, d.types) : 1;
    res.mult = mult;
    res.text = (T && T.message) ? T.message(mult) : null;

    const crit = Math.random() < 0.08;
    res.crit = crit;

    res.dmg = Math.max(1, Math.round(base * niveau * stats * stab * mult * (crit ? 1.5 : 1)));
    return res;
  }

  // ===========================================================================
  //  IA
  // ===========================================================================
  /**
   * Liste des capacités réellement utilisables par ce Mon (PP > 0).
   * Accepte les trois formes qu'on croise dans le jeu :
   *   [{ id, pp, ppMax }]  (team3d)   ·   ['flamme', …]   ·   [move]
   */
  function usableMoves(mon) {
    const out = [];
    const list = (mon && mon.moves) ? mon.moves : [];
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      if (!entry) continue;
      let id, pp;
      if (typeof entry === 'string') { id = entry; pp = 1; }
      else { id = entry.id; pp = (typeof entry.pp === 'number') ? entry.pp : 1; }
      const m = MOVES[id];
      if (!m) continue;
      if (pp <= 0) continue;
      out.push(m);
    }
    return out;
  }

  /**
   * Choix de l'IA — assez maligne pour surprendre Robin, assez simple pour
   * rester lisible :
   *   1. sous 30 % de PV, elle se soigne (si elle a un soin avec des PP) ;
   *   2. sinon elle note ses attaques (puissance × efficacité × STAB) et prend
   *      la meilleure, avec un grain d'aléatoire pour ne pas être prévisible ;
   *   3. jamais de capacité sans PP.
   */
  function pickAI(mon, foe, state) {
    const list = usableMoves(mon);
    if (!list.length) return MOVES.charge;   // plus un seul PP : on charge

    const heals = list.filter(isHeal);
    const attacks = list.filter(function (m) { return !isHeal(m) && m.power; });

    // 1. Se soigner quand ça va mal (pas systématique : sinon c'est agaçant).
    const maxHp = (mon && mon.maxHp) || 0;
    const hp = (mon && typeof mon.hp === 'number') ? mon.hp : maxHp;
    if (heals.length && maxHp > 0 && hp / maxHp < 0.30 && Math.random() < 0.8) {
      return heals[(Math.random() * heals.length) | 0];
    }

    if (!attacks.length) return list[(Math.random() * list.length) | 0];

    // 2. Un coup de folie de temps en temps : l'IA reste imprévisible.
    if (Math.random() < 0.12) return attacks[(Math.random() * attacks.length) | 0];

    const T = typesApi();
    const foeTypes = (foe && foe.types) || null;
    const myTypes = (mon && Array.isArray(mon.types)) ? mon.types : [];

    let best = attacks[0], bestScore = -Infinity;
    for (let i = 0; i < attacks.length; i++) {
      const m = attacks[i];
      const eff = (T && T.effectiveness) ? T.effectiveness(m.type, foeTypes) : 1;
      const stab = (m.type && myTypes.indexOf(m.type) !== -1) ? 1.25 : 1;
      const acc = (typeof m.acc === 'number') ? m.acc : 1;
      // 0.85..1.20 : de quoi départager deux capacités proches sans jamais
      // faire choisir une attaque manifestement mauvaise.
      const alea = 0.85 + Math.random() * 0.35;
      const score = avgPower(m) * eff * stab * acc * alea;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Auto-vérification du catalogue (silencieuse si tout va bien).
  // ---------------------------------------------------------------------------
  (function selfCheck() {
    try {
      const problems = [];
      const seenNames = Object.create(null);
      const perType = Object.create(null);
      for (const id in MOVES) {
        const m = MOVES[id];
        if (m.id !== id) problems.push(id + ' : champ id incohérent');
        if (FX_ALLOWED.indexOf(m.fx) === -1) problems.push(id + ' : fx inconnu « ' + m.fx + ' »');
        if (!m.desc) problems.push(id + ' : pas de description');
        if (seenNames[m.name]) problems.push('nom en double : ' + m.name);
        seenNames[m.name] = true;
        if (m.heal && m.power) problems.push(id + ' : soin ET dégâts');
        if (!m.heal && !(m.power && m.power.length === 2)) problems.push(id + ' : power invalide');
        if (m.acc < 0.75 || m.acc > 1) problems.push(id + ' : précision hors bornes');
        if (m.type) {
          const t = perType[m.type] || (perType[m.type] = { n: 0, heal: 0, sign: 0 });
          t.n++;
          // Les doublons ci-dessus existent pour la compatibilité : ils ne
          // prennent la place de personne dans les quotas du §7.
          if (m.legacy) continue;
          if (m.heal) t.heal++;
          if (m.legendary) t.sign++;
        }
      }
      for (const t in perType) {
        const c = perType[t];
        if (c.n < 8) problems.push(t + ' : seulement ' + c.n + ' capacités');
        // Au moins un soin : « air » et « lumière » en ont deux, car le soin
        // historique du jeu 2D (Chant apaisant, Soin magique) cohabite avec le
        // soin thématique que le Pokédex réclame.
        if (c.heal < 1) problems.push(t + ' : aucune capacité de soin');
        if (c.sign !== 1) problems.push(t + ' : ' + c.sign + ' signature(s) (attendu 1)');
      }
      if (problems.length && typeof console !== 'undefined' && console.warn) {
        console.warn('[moves3d] catalogue incohérent :\n  - ' + problems.join('\n  - '));
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[moves3d] auto-vérification impossible', e);
      }
    }
  })();

  // ---------------------------------------------------------------------------
  const API = { MOVES: MOVES, get: get, byType: byType, compute: compute, pickAI: pickAI };

  if (typeof R3 !== 'undefined' && R3 && R3.register) R3.register('moves', API);
  else if (typeof globalThis !== 'undefined') globalThis.MOVES3D = API;   // repli
})();
