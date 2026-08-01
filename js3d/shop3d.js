// =============================================================================
//  shop3d.js — CENTRE POKÉMON, BOUTIQUE ET MONNAIE   (demande n°8 de Robin)
// =============================================================================
//  « Un centre Pokémon par région pour acheter des Pokéballs, des potions
//    et plein d'autres choses. »
//
//  CE QUE FAIT CE FICHIER
//    · Il tient le CATALOGUE (ce qui existe, ce que ça coûte, ce que ça fait).
//    · Il tient les RÈGLES D'ARGENT : combien on gagne après un combat,
//      combien coûte un achat, combien rapporte une revente.
//    · Il APPLIQUE les objets sur une créature (potions, rappels, pierres…).
//    · Il fournit les PETITS MOTS DE L'INFIRMIÈRE, que Robin lira à chaque
//      passage au Centre. Ils comptent autant que le code.
//
//  CE QU'IL NE FAIT PAS — volontairement :
//    · Il ne dessine RIEN. Zéro draw call, zéro géométrie, zéro matériau.
//      Le bâtiment du Centre est construit par `citybuild3d.js`.
//    · Il n'affiche aucun écran : il RENVOIE des textes, c'est `hud3d.js`
//      qui décide de les montrer.
//    · Il ne possède pas la sauvegarde : l'argent vit dans `state.money`
//      (`game3d.js`), ce module travaille sur un « porte-monnaie » qu'on lui
//      passe. C'est ce qui lui permet de rester testable et sans état caché.
//
//  LE PORTE-MONNAIE (« wallet »)
//    C'est n'importe quel objet de la forme :
//        { money: 500, items: { pokeball: 20, potion: 5, … } }
//    L'objet `state` de `game3d.js` a exactement cette forme une fois le champ
//    `money` ajouté (§12 du contrat v3) : on peut donc lui passer `state` tel
//    quel. Si on ne passe rien, on retombe sur un porte-monnaie interne — le
//    module reste utilisable seul, sans jamais lever d'exception.
//
//  DÉPENDANCES (toutes FACULTATIVES — dégradation gracieuse obligatoire) :
//    R3.get('team')   -> healAll / heal / restorePP / gainXp  | repli : calcul direct
//    R3.get('evolve') -> applyStone (pierres d'évolution)     | repli : message honnête
//    R3.get('tera')   -> reset (recharge au Centre)           | repli : on l'ignore
//    R3.get('types')  -> color (couleur des pierres)          | repli : couleur écrite ici
//  Aucune de ces absences ne doit gêner Robin : au pire un message gentil.
//
//  ESPRIT — public 10 ans :
//    · On ne perd JAMAIS d'argent en perdant un combat.
//    · Un objet inutile (potion sur une créature en pleine forme) n'est pas
//      consommé : on le dit gentiment, on ne le gaspille pas.
//    · Les prix sont ronds, les gains sont généreux, la boutique s'enrichit
//      région après région pour que progresser se SENTE.
//    · TOUTE PIERRE VENDUE FAIT ÉVOLUER QUELQUE CHOSE (corrigé le 2026-07-31,
//      lot I-C : cinq des six pierres du catalogue étaient décoratives et les
//      deux pierres indispensables manquaient — voir la section « LES PIERRES
//      D'ÉVOLUTION » du catalogue). Une pierre qui ne peut rien faire sur la
//      créature choisie le dit gentiment, et n'est NI consommée NI payée.
// =============================================================================

(function () {
  'use strict';

  // Socle. Repli muet : le fichier doit rester chargeable même si `core3d.js`
  // n'a pas encore été évalué (ordre de <script> bousculé, test hors navigateur).
  const R3ref = (typeof R3 !== 'undefined' && R3) ? R3 : {
    get: function () { return undefined; },
    register: function (n, api) { return api; },
  };

  /** Accès tolérant à un module voisin : jamais d'exception, jamais de crash. */
  function mod(name) {
    try {
      const m = R3ref.get(name);
      return (m && typeof m === 'object') ? m : null;
    } catch (e) { return null; }
  }

  /** Appel protégé d'une fonction d'un module voisin. -> `def` si ça tourne mal.
   *  Pourquoi : un module écrit en parallèle peut avoir un bug ; il n'a pas le
   *  droit d'emporter la boutique avec lui. */
  function safe(fn, def) {
    try {
      const v = fn();
      return (v === undefined) ? def : v;
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[shop3d] appel voisin échoué :', e && e.message);
      return def;
    }
  }

  function num(v, def) {
    const n = (typeof v === 'string') ? parseFloat(v) : v;
    return (typeof n === 'number' && isFinite(n)) ? n : def;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /** Entier positif borné — sert partout pour les quantités venues de l'interface. */
  function qtyOf(v) {
    return clamp(Math.round(num(v, 1)), 1, 99);
  }

  // ===========================================================================
  //  1. LA MONNAIE
  // ===========================================================================

  /** Robin commence avec 500 pièces (§6 du contrat v3) : de quoi s'offrir tout
   *  de suite deux Pokéballs, ou une Potion et une Baie. Jamais les mains vides. */
  const START_MONEY = 500;

  /** Nom et symbole de la monnaie, pour que l'interface n'invente rien. */
  const MONEY_NAME = 'pièces';
  const MONEY_ICON = '🪙';

  // Porte-monnaie de repli : utilisé seulement si personne ne nous en passe un.
  // Il évite que `buy()` explose quand l'interface appelle avant que `game3d`
  // ait fini de charger la sauvegarde.
  const _fallbackWallet = { money: START_MONEY, items: {} };

  // Porte-monnaie « officiel », branché une fois pour toutes par le lot
  // Intégration : `shop.bindWallet(state)`. Ensuite, buy/sell/useFrom peuvent
  // être appelés sans troisième argument.
  let _bound = null;

  function bindWallet(w) {
    _bound = (w && typeof w === 'object') ? w : null;
    if (_bound) normalizeWallet(_bound);
    return _bound;
  }

  /** Ramène n'importe quel objet à la forme attendue, sans rien écraser
   *  d'existant. Une vieille sauvegarde sans `money` reçoit ses 500 pièces. */
  function normalizeWallet(w) {
    if (!w || typeof w !== 'object') return _fallbackWallet;
    if (!w.items || typeof w.items !== 'object') w.items = {};
    if (typeof w.money !== 'number' || !isFinite(w.money)) w.money = START_MONEY;
    if (w.money < 0) w.money = 0;
    return w;
  }

  /** Le porte-monnaie à utiliser pour cet appel : celui passé, sinon le branché,
   *  sinon le repli interne. */
  function walletOf(w) {
    if (w && typeof w === 'object') return normalizeWallet(w);
    if (_bound) return normalizeWallet(_bound);
    return normalizeWallet(_fallbackWallet);
  }

  function money(w) { return walletOf(w).money | 0; }

  /** Ajoute (ou retire) de l'argent. Ne descend jamais sous zéro : même en
   *  bricolant, le jeu ne doit pas afficher une dette à un enfant de 10 ans. */
  function addMoney(amount, w) {
    const wal = walletOf(w);
    wal.money = Math.max(0, Math.round(wal.money + num(amount, 0)));
    return wal.money;
  }

  function countOf(itemId, w) {
    const wal = walletOf(w);
    return Math.max(0, wal.items[itemId] | 0);
  }

  function addItem(itemId, qty, w) {
    const wal = walletOf(w);
    const n = Math.round(num(qty, 1));
    wal.items[itemId] = Math.max(0, (wal.items[itemId] | 0) + n);
    return wal.items[itemId];
  }

  // ===========================================================================
  //  2. LE CATALOGUE
  // ===========================================================================
  //
  //  Schéma d'une entrée (§6) :
  //    { id, name, icon, price, kind:'ball'|'soin'|'pierre'|'objet',
  //      power, description }
  //
  //  Champs ajoutés (extensions documentées, sans danger pour qui les ignore) :
  //    color     -> couleur d'accent pour la vignette du HUD
  //    buyable   -> false = ne se vend pas en boutique (Ball Maîtresse)
  //    sellable  -> false = ne se revend pas
  //    usable    -> false = ne s'applique pas sur une créature
  //    effect    -> étiquette lisible de l'effet, pour brancher côté game3d
  //    tagline   -> une phrase de vendeur, en français, pour l'écran d'achat
  //
  //  Le prix des pierres est le même pour toutes (2500) : Robin n'a pas à
  //  calculer, il choisit la couleur qui lui plaît.
  // ---------------------------------------------------------------------------

  const STONE_PRICE = 2500;

  const CATALOG = [

    // --- LES BALLS ----------------------------------------------------------
    {
      id: 'pokeball', name: 'Pokéball', icon: '🔴', price: 200, kind: 'ball',
      power: 1.0, color: '#ff5a5a', usable: false,
      description: 'La Ball de tous les jours. Chances de capture normales.',
      tagline: 'Le classique ! On en a toujours besoin.',
      effect: 'catch',
    },
    {
      id: 'superball', name: 'Super Ball', icon: '🔵', price: 600, kind: 'ball',
      power: 1.5, color: '#41a6f6', usable: false,
      description: 'Une Ball perfectionnée : une fois et demie plus efficace.',
      tagline: 'Pour les créatures qui se débattent un peu trop.',
      effect: 'catch',
    },
    {
      id: 'hyperball', name: 'Hyper Ball', icon: '🟡', price: 1200, kind: 'ball',
      power: 2.2, color: '#f1c40f', usable: false,
      description: 'La meilleure Ball du commerce : plus de deux fois plus efficace.',
      tagline: 'Chère, mais elle ne déçoit jamais.',
      effect: 'catch',
    },
    {
      // NE SE VEND PAS (§6) : elle se gagne en accomplissant une quête (§5).
      // Elle reste au catalogue pour que l'interface connaisse son nom, son
      // icône et son bonus — sinon le sac afficherait « objet inconnu ».
      id: 'ballmaitresse', name: 'Ball Maîtresse', icon: '🟣', price: 0, kind: 'ball',
      power: 99, color: '#b45cd8', buyable: false, sellable: false, usable: false,
      description: 'Elle ne rate jamais. Aucune boutique n\'en vend : elle se mérite.',
      tagline: 'Celle-là, l\'argent ne l\'achète pas.',
      effect: 'catch',
    },

    // --- LES SOINS ----------------------------------------------------------
    {
      id: 'baiedouce', name: 'Baie Douce', icon: '🍓', price: 100, kind: 'soin',
      power: 15, color: '#ff8fa3',
      description: 'Une petite baie sucrée. Rend 15 PV.',
      tagline: 'Pas cher, et ça remonte le moral.',
      effect: 'heal',
    },
    {
      id: 'potion', name: 'Potion', icon: '🧪', price: 300, kind: 'soin',
      power: 30, color: '#7ee787',
      description: 'Le soin de base. Rend 30 PV à une créature debout.',
      tagline: 'Le premier achat de tous les dresseurs.',
      effect: 'heal',
    },
    {
      id: 'superpotion', name: 'Super Potion', icon: '🧴', price: 700, kind: 'soin',
      power: 80, color: '#38b764',
      description: 'Une potion concentrée. Rend 80 PV.',
      tagline: 'Quand la Potion ne suffit plus.',
      effect: 'heal',
    },
    {
      id: 'hyperpotion', name: 'Hyper Potion', icon: '🏺', price: 1500, kind: 'soin',
      power: 9999, color: '#2fae7d',
      description: 'Remplit les PV AU MAXIMUM, d\'un seul coup.',
      tagline: 'Le grand luxe. Garde-la pour le champion.',
      effect: 'healfull',
    },
    {
      id: 'rappel', name: 'Rappel', icon: '⭐', price: 1000, kind: 'soin',
      power: 0.5, color: '#ffd166',
      description: 'Réveille une créature K.O. avec la moitié de ses PV.',
      tagline: 'Une deuxième chance, ça n\'a pas de prix… enfin, si : 1000.',
      effect: 'revive',
    },
    {
      id: 'rappelmax', name: 'Rappel Max', icon: '🌟', price: 2500, kind: 'soin',
      power: 1.0, color: '#ffe066',
      description: 'Réveille une créature K.O. avec TOUS ses PV.',
      tagline: 'Debout, et en pleine forme !',
      effect: 'revive',
    },
    {
      id: 'elixir', name: 'Élixir', icon: '🥤', price: 800, kind: 'soin',
      power: 0, color: '#a8e6ff',
      description: 'Recharge tous les PP de toutes les capacités d\'une créature.',
      tagline: 'Pour ceux qui ont trop utilisé leur attaque préférée.',
      effect: 'pp',
    },

    // --- LES PIERRES D'ÉVOLUTION --------------------------------------------
    // Une par grande famille. Elles délèguent à `evolve3d.applyStone()` : ici,
    // on ne sait pas QUI évolue avec quoi, et c'est très bien ainsi.
    //
    // INTÉGRATION DU 2026-07-31 (lot I-C) — CES HUIT PIERRES SERVENT TOUTES.
    // Ce catalogue et les chaînes d'`evolve3d.js` avaient été écrits en
    // parallèle : cinq de ces pierres ne faisaient rien du tout, et les deux
    // pierres indispensables (Lune, Nuit) n'étaient nulle part. Payer 2500
    // pièces pour un objet dont la description promet une évolution, et qu'il
    // ne se passe rien, c'est mentir à un enfant. Les deux manquantes sont donc
    // ajoutées ici, et `evolve3d.js` rattache une famille d'évolutions à
    // chacune des six autres. La règle, la même pour toutes : « une pierre fait
    // évoluer tout de suite une créature de sa famille ».
    {
      id: 'pierre_feu', name: 'Pierre Feu', icon: '🔥', price: STONE_PRICE, kind: 'pierre',
      power: 0, color: '#ff6b3d', family: 'feu',
      description: 'Une pierre brûlante. Fait évoluer certaines créatures de Feu.',
      tagline: 'Elle est encore tiède, attention aux doigts !',
      effect: 'stone',
    },
    {
      id: 'pierre_eau', name: 'Pierre Eau', icon: '💧', price: STONE_PRICE, kind: 'pierre',
      power: 0, color: '#41a6f6', family: 'eau',
      description: 'Une pierre où l\'océan bouge encore. Fait évoluer certaines créatures d\'Eau.',
      tagline: 'Colle-la à ton oreille : on entend les vagues.',
      effect: 'stone',
    },
    {
      id: 'pierre_plante', name: 'Pierre Plante', icon: '🌿', price: STONE_PRICE, kind: 'pierre',
      power: 0, color: '#38b764', family: 'plante',
      description: 'Une pierre couverte de mousse vivante. Fait évoluer certaines créatures Plante.',
      tagline: 'Elle sent la forêt après la pluie.',
      effect: 'stone',
    },
    {
      id: 'pierre_electrique', name: 'Pierre Foudre', icon: '⚡', price: STONE_PRICE, kind: 'pierre',
      power: 0, color: '#f1c40f', family: 'electrique',
      description: 'Une pierre qui crépite. Fait évoluer certaines créatures Électrique.',
      tagline: 'Elle fait grésiller les cheveux. C\'est normal.',
      effect: 'stone',
    },
    {
      id: 'pierre_glace', name: 'Pierre Glace', icon: '❄️', price: STONE_PRICE, kind: 'pierre',
      power: 0, color: '#a8e6ff', family: 'glace',
      description: 'Une pierre qui ne fond jamais. Fait évoluer certaines créatures de Glace.',
      tagline: 'Elle garde le froid de la montagne pour toujours.',
      effect: 'stone',
    },
    {
      id: 'pierre_lumiere', name: 'Pierre Lumière', icon: '✨', price: STONE_PRICE, kind: 'pierre',
      power: 0, color: '#ffe066', family: 'lumiere',
      description: 'Une pierre qui brille toute seule. Fait évoluer certaines créatures de Lumière.',
      tagline: 'La plus rare de toutes. On dit qu\'elle vient d\'une étoile.',
      effect: 'stone',
    },
    {
      // EXIGÉE par Koronette (et par elle seule) : sans cette pierre au
      // catalogue, l'évolution la plus jolie du jeu était inatteignable.
      id: 'pierre_lune', name: 'Pierre de Lune', icon: '🌙', price: STONE_PRICE, kind: 'pierre',
      power: 0, color: '#ffb3d9', family: 'fee',
      description: 'Une pierre pâle qui garde la lumière de la nuit. Fait évoluer les créatures Fée.',
      tagline: 'Regarde-la de près : il y a des cratères dedans.',
      effect: 'stone',
    },
    {
      // EXIGÉE par Méduzia. Elle réveille aussi les créatures Spectre.
      id: 'pierre_nuit', name: 'Pierre de Nuit', icon: '🌑', price: STONE_PRICE, kind: 'pierre',
      power: 0, color: '#7a5cbf', family: 'spectre',
      description: 'Une pierre plus noire que le noir. Fait évoluer les créatures Spectre et Poison.',
      tagline: 'On ne voit pas son reflet dedans. C\'est normal, paraît-il.',
      effect: 'stone',
    },

    // --- LES OBJETS DE CONFORT ----------------------------------------------
    {
      id: 'repulsif', name: 'Répulsif', icon: '🌫️', price: 400, kind: 'objet',
      power: 200, color: '#b0bec5', usable: true,
      // La description promettait d'éloigner les rencontres en hautes herbes —
      // or il n'y a plus de rencontre surprise dans ce jeu (ENCOUNTER_CHANCE
      // vaut 0 depuis la révision du 2026-07-30) : l'objet ne faisait donc
      // rien du tout. Il agit désormais sur ce qu'on voit VRAIMENT : les
      // créatures posées sur la carte. Les petites s'écartent, ce qui laisse
      // la place aux plus rares.
      description: 'Pendant 200 pas, les créatures faibles ne viennent plus s’installer autour de toi.',
      tagline: 'Pour chercher les créatures rares tranquille.',
      effect: 'repel',
    },
    {
      id: 'charmechance', name: 'Charme Chance', icon: '🍀', price: 2000, kind: 'objet',
      power: 1.2, color: '#7ee787', usable: false, sellable: false,
      description: 'Dans ton sac, il te fait gagner 20 % d\'argent en plus après chaque combat.',
      tagline: 'On ne l\'achète qu\'une fois, il travaille pour toujours.',
      effect: 'money',
    },
    {
      id: 'bonbonxp', name: 'Bonbon Malin', icon: '🍬', price: 1200, kind: 'objet',
      power: 1, color: '#ff6b9d',
      description: 'Fait monter une créature d\'un niveau, tout de suite.',
      tagline: 'Sucré, et étonnamment instructif.',
      effect: 'level',
    },
  ];

  // Index id -> item. Construit une seule fois : `item()` est appelé à chaque
  // vignette de l'écran d'achat, il n'a pas le droit de parcourir un tableau.
  const BY_ID = Object.create(null);
  for (let i = 0; i < CATALOG.length; i++) BY_ID[CATALOG[i].id] = CATALOG[i];

  // Objet « inconnu » : renvoyé plutôt que `null` pour que l'interface puisse
  // toujours afficher quelque chose (une vieille sauvegarde peut contenir un id
  // qui n'existe plus).
  const UNKNOWN = {
    id: '?', name: 'Objet mystère', icon: '❔', price: 0, kind: 'objet',
    power: 0, color: '#94b0c2', buyable: false, sellable: false, usable: false,
    description: 'Personne ne sait à quoi ça sert.',
    tagline: '', effect: null,
  };

  function item(id) {
    return BY_ID[id] || UNKNOWN;
  }

  function priceOf(id) {
    const it = BY_ID[id];
    return it ? Math.max(0, it.price | 0) : 0;
  }

  /** Prix de rachat : la moitié, arrondie à l'inférieur (§6). */
  function sellPriceOf(id) {
    const it = BY_ID[id];
    if (!it || it.sellable === false || it.buyable === false) return 0;
    return Math.floor(priceOf(id) / 2);
  }

  function isStone(id) {
    const it = BY_ID[id];
    if (it) return it.kind === 'pierre';
    // Tolérance : si `evolve3d` invente une pierre que la boutique ne connaît
    // pas encore, la convention de nommage suffit à la reconnaître.
    return typeof id === 'string' && id.indexOf('pierre_') === 0;
  }

  function isBall(id) {
    const it = BY_ID[id];
    return !!it && it.kind === 'ball';
  }

  /** Bonus de capture d'une Ball — même table que `BALL_BONUS` de `game3d.js`.
   *  Exposé ici pour que le sélecteur de Ball (§11.2) ait UNE source lisible. */
  function ballPower(id) {
    const it = BY_ID[id];
    return (it && it.kind === 'ball') ? num(it.power, 1) : 1;
  }

  // ===========================================================================
  //  3. L'OFFRE, RÉGION PAR RÉGION
  // ===========================================================================
  //
  //  Le stock est CUMULATIF : le Centre de la Caldeira vend tout ce que vendait
  //  celui du Val, plus ses nouveautés. Pourquoi ? Parce qu'un enfant qui
  //  revient en arrière ne doit jamais perdre l'accès à une Potion, et parce
  //  qu'arriver dans une nouvelle région doit donner envie d'entrer au Centre.
  // ---------------------------------------------------------------------------

  const REGION_ORDER = ['val', 'sylve', 'saphir', 'givre', 'braise', 'aurore'];

  const NEW_STOCK = {
    val:    ['pokeball', 'baiedouce', 'potion', 'repulsif'],
    sylve:  ['superball', 'superpotion', 'pierre_plante', 'pierre_electrique'],
    // Chaque pierre arrive dans la région où vit la famille qu'elle réveille :
    // la Pierre de Nuit à Port-Saphir (Méduzia), la Pierre de Lune sur la
    // banquise — assez tôt pour que Koronette évolue avant la fin du jeu.
    saphir: ['rappel', 'elixir', 'pierre_eau', 'pierre_nuit'],
    givre:  ['hyperball', 'charmechance', 'pierre_glace', 'pierre_lune'],
    braise: ['hyperpotion', 'bonbonxp', 'pierre_feu'],
    aurore: ['rappelmax', 'pierre_lumiere'],
  };

  // Stocks pré-calculés : `stockFor()` est appelé à l'ouverture de l'écran
  // d'achat, il ne doit rien allouer ni recalculer.
  const STOCK_CACHE = Object.create(null);
  (function buildStocks() {
    const cumul = [];
    for (let i = 0; i < REGION_ORDER.length; i++) {
      const rid = REGION_ORDER[i];
      const add = NEW_STOCK[rid] || [];
      for (let j = 0; j < add.length; j++) {
        if (BY_ID[add[j]] && cumul.indexOf(add[j]) < 0) cumul.push(add[j]);
      }
      STOCK_CACHE[rid] = cumul.slice();
    }
  })();

  /** -> [itemId] vendus au Centre de cette région. Une région inconnue reçoit
   *  l'offre de départ : mieux vaut une boutique modeste qu'une boutique vide. */
  function stockFor(regionId) {
    const s = STOCK_CACHE[regionId];
    return s ? s.slice() : STOCK_CACHE[REGION_ORDER[0]].slice();
  }

  /** Confort pour le HUD : le stock déjà résolu en objets complets. */
  function stockItems(regionId) {
    return stockFor(regionId).map(item);
  }

  /** Ce qu'on peut revendre : tout ce qu'on possède et qui a une valeur. */
  function sellableFrom(w) {
    const wal = walletOf(w);
    const out = [];
    for (let i = 0; i < CATALOG.length; i++) {
      const it = CATALOG[i];
      if (sellPriceOf(it.id) > 0 && (wal.items[it.id] | 0) > 0) out.push(it.id);
    }
    return out;
  }

  // ===========================================================================
  //  4. ACHETER ET VENDRE
  // ===========================================================================

  /** Signature du contrat : `money` est un NOMBRE, pas un porte-monnaie. */
  function canBuy(itemId, money_, qty) {
    const it = BY_ID[itemId];
    if (!it || it.buyable === false) return false;
    const n = qtyOf(qty);
    return num(money_, 0) >= priceOf(itemId) * n;
  }

  /**
   * Achat. -> { ok, spent, message } (+ `qty`, `left`, `money` en extension).
   * Le message est écrit pour être affiché tel quel à Robin.
   */
  function buy(itemId, qty, wallet) {
    const wal = walletOf(wallet);
    const it = BY_ID[itemId];
    const n = qtyOf(qty);

    if (!it) {
      return { ok: false, spent: 0, qty: 0, left: wal.money, money: wal.money,
        message: 'Ça, on n\'en vend pas ici.' };
    }
    if (it.buyable === false) {
      // La Ball Maîtresse : on refuse, mais on donne l'indice. Un refus doit
      // toujours apprendre quelque chose.
      return { ok: false, spent: 0, qty: 0, left: wal.money, money: wal.money,
        message: it.id === 'ballmaitresse'
          ? 'La Ball Maîtresse ne se vend pas.\nOn dit qu\'elle attend au bout d\'une légende…'
          : it.name + ' ne se vend pas en boutique.' };
    }

    const total = priceOf(itemId) * n;
    if (wal.money < total) {
      const manque = total - wal.money;
      return { ok: false, spent: 0, qty: 0, left: wal.money, money: wal.money,
        message: 'Il te manque ' + manque + ' ' + MONEY_NAME + ' ' + MONEY_ICON +
          ' pour ' + (n > 1 ? (n + ' ' + it.name) : ('une ' + it.name)) + '.' };
    }

    wal.money -= total;
    addItem(itemId, n, wal);

    return {
      ok: true, spent: total, qty: n, left: wal.money, money: wal.money,
      message: it.icon + ' ' + (n > 1 ? (n + '× ' + it.name) : it.name) +
        ' — merci beaucoup !\nIl te reste ' + wal.money + ' ' + MONEY_NAME + ' ' + MONEY_ICON + '.',
    };
  }

  /**
   * Revente, à la moitié du prix (§6).
   * -> { ok, earned, message } (+ `qty`, `money`).
   */
  function sell(itemId, qty, wallet) {
    const wal = walletOf(wallet);
    const it = BY_ID[itemId];
    const n = qtyOf(qty);

    if (!it) {
      return { ok: false, earned: 0, qty: 0, money: wal.money,
        message: 'Je ne connais pas cet objet, désolé !' };
    }
    if (sellPriceOf(itemId) <= 0) {
      return { ok: false, earned: 0, qty: 0, money: wal.money,
        message: it.id === 'ballmaitresse'
          ? 'Vendre une Ball Maîtresse ? Jamais de la vie !'
          : 'Je ne rachète pas ' + it.name + '.' };
    }
    const have = countOf(itemId, wal);
    if (have < n) {
      return { ok: false, earned: 0, qty: 0, money: wal.money,
        message: have > 0
          ? 'Tu n\'en as que ' + have + ' dans ton sac.'
          : 'Tu n\'as pas de ' + it.name + ' à me vendre.' };
    }

    const gain = sellPriceOf(itemId) * n;
    wal.items[itemId] = have - n;
    wal.money = Math.max(0, wal.money + gain);

    return {
      ok: true, earned: gain, qty: n, money: wal.money,
      message: 'Marché conclu ! +' + gain + ' ' + MONEY_NAME + ' ' + MONEY_ICON +
        '.\nTu as maintenant ' + wal.money + ' ' + MONEY_NAME + '.',
    };
  }

  // ===========================================================================
  //  5. UTILISER UN OBJET
  // ===========================================================================
  //
  //  `useItem(itemId, mon)` N'ENLÈVE PAS l'objet du sac : elle ne connaît pas
  //  le porte-monnaie. Elle renvoie `consumed: true` quand l'appelant doit
  //  décrémenter. Pour tout faire d'un coup, utiliser `useFrom(id, mon, wallet)`.
  // ---------------------------------------------------------------------------

  function teamApi() { return mod('team'); }

  function isKO(m) { return !m || num(m.hp, 0) <= 0; }

  function maxHpOf(m) { return Math.max(1, Math.round(num(m && m.maxHp, 1))); }

  function nameOf(m) { return (m && (m.nick || m.id)) || 'Ta créature'; }

  /** Rend des PV en passant par `team3d` si possible (il connaît les bornes),
   *  sinon en calculant ici. -> PV réellement rendus. */
  function healHp(m, amount) {
    const team = teamApi();
    if (team && team.heal) {
      const done = safe(function () { return team.heal(m, amount); }, null);
      if (typeof done === 'number') return done;
    }
    const before = clamp(num(m.hp, 0), 0, maxHpOf(m));
    if (before <= 0) return 0;
    m.hp = clamp(before + Math.max(0, Math.round(num(amount, 0))), 0, maxHpOf(m));
    return m.hp - before;
  }

  function restorePP(m) {
    const team = teamApi();
    if (team && team.restorePP) {
      const done = safe(function () { return team.restorePP(m); }, null);
      if (done) return true;
    }
    if (!m || !Array.isArray(m.moves)) return false;
    for (let i = 0; i < m.moves.length; i++) {
      const s = m.moves[i];
      if (s) s.pp = Math.max(num(s.pp, 0), num(s.ppMax, 20));
    }
    return true;
  }

  /**
   * Applique un objet sur une créature.
   * -> { ok, message, consumed } (+ `healed`, `evolved` selon le cas).
   * Ne lève jamais. Un refus est toujours expliqué gentiment.
   */
  function useItem(itemId, mon) {
    const it = BY_ID[itemId];

    if (!it) return { ok: false, consumed: false, message: 'Cet objet ne fait rien de spécial.' };

    // Le Répulsif agit sur le MONDE, pas sur une créature : il se traite avant
    // qu'on exige une cible. C'est game3d qui applique l'effet (il seul connaît
    // les pas parcourus et les créatures de la carte) ; ici on se contente de
    // dire ce qu'il faut faire.
    if (it.effect === 'repel') {
      return {
        ok: true, consumed: true, effect: 'repel', power: num(it.power, 200),
        message: 'Un nuage odorant se répand autour de toi 🌫️\n'
          + 'Les créatures faibles vont te laisser tranquille pendant '
          + num(it.power, 200) + ' pas.',
      };
    }

    if (!mon || typeof mon !== 'object') {
      return { ok: false, consumed: false, message: 'Choisis d\'abord une créature.' };
    }
    if (it.usable === false || it.kind === 'ball') {
      return {
        ok: false, consumed: false,
        message: it.kind === 'ball'
          ? 'Les Balls se lancent sur les créatures sauvages, pas sur les tiennes !'
          : it.name + ' ne s\'utilise pas sur une créature.',
      };
    }

    const nom = nameOf(mon);

    // --- Réveiller une créature K.O. ---------------------------------------
    if (it.effect === 'revive') {
      if (!isKO(mon)) {
        return { ok: false, consumed: false,
          message: nom + ' est déjà debout ! Garde ton ' + it.name + ' pour plus tard.' };
      }
      const part = clamp(num(it.power, 0.5), 0.1, 1);
      mon.hp = Math.max(1, Math.round(maxHpOf(mon) * part));
      if (part >= 1) restorePP(mon);
      return { ok: true, consumed: true, healed: mon.hp,
        message: nom + ' rouvre les yeux ! ✦\nIl remonte à ' + mon.hp + ' PV.' };
    }

    // À partir d'ici, la créature doit être debout : soigner un K.O. avec une
    // potion ne marche pas, et c'est important de le DIRE (sinon Robin croit
    // que le jeu est cassé).
    if (isKO(mon) && (it.effect === 'heal' || it.effect === 'healfull' ||
                      it.effect === 'stone' || it.effect === 'level')) {
      return { ok: false, consumed: false,
        message: nom + ' est K.O. : il lui faut un Rappel ⭐, ou un passage au Centre.' };
    }

    // --- Soins --------------------------------------------------------------
    if (it.effect === 'heal' || it.effect === 'healfull') {
      if (num(mon.hp, 0) >= maxHpOf(mon)) {
        return { ok: false, consumed: false,
          message: nom + ' est déjà en pleine forme ! On ne gaspille pas.' };
      }
      const rendu = (it.effect === 'healfull')
        ? healHp(mon, maxHpOf(mon))
        : healHp(mon, num(it.power, 20));
      return { ok: true, consumed: true, healed: rendu,
        message: nom + ' récupère ' + rendu + ' PV ! ❤️\n' + mon.hp + ' / ' + maxHpOf(mon) + ' PV.' };
    }

    // --- PP -----------------------------------------------------------------
    if (it.effect === 'pp') {
      restorePP(mon);
      return { ok: true, consumed: true,
        message: nom + ' retrouve toutes ses attaques ! ✦' };
    }

    // --- Niveau -------------------------------------------------------------
    if (it.effect === 'level') {
      const team = teamApi();
      const maxLvl = (team && num(team.MAX_LEVEL, 0)) || 60;
      if (num(mon.level, 1) >= maxLvl) {
        return { ok: false, consumed: false,
          message: nom + ' est déjà au niveau maximum ! Impossible de faire mieux.' };
      }
      if (!team || !team.gainXp) {
        return { ok: false, consumed: false,
          message: 'Le bonbon ne fait rien pour l\'instant… Réessaie plus tard !' };
      }
      // Juste ce qu'il faut d'XP pour franchir le palier : un bonbon = un niveau.
      const manque = Math.max(1, Math.round(num(mon.xpNext, 100) - num(mon.xp, 0)));
      const res = safe(function () { return team.gainXp(mon, manque); }, null);
      if (!res || !res.leveled) {
        return { ok: false, consumed: false,
          message: 'Hum… il ne s\'est rien passé. Garde ton bonbon !' };
      }
      let txt = nom + ' passe au niveau ' + res.level + ' ! 🎉';
      if (res.learned && res.learned.length) txt += '\nNouvelle capacité apprise !';
      // `res.pendingLearn` était ignoré : le bonbon faisait franchir le palier
      // d'une capacité que la créature ne pouvait pas prendre, et personne ne le
      // disait. Même règle qu'en combat — on ne cache pas ce qui n'a pas eu lieu.
      if (res.pendingLearn && res.pendingLearn.length) {
        txt += '\n' + nom + ' garde ses 4 capacités : la nouvelle n\'a pas trouvé de place.';
      }
      return { ok: true, consumed: true, message: txt, leveled: true };
    }

    // --- Pierres d'évolution ------------------------------------------------
    if (it.effect === 'stone') {
      const evolve = mod('evolve');
      if (!evolve || !evolve.applyStone) {
        // Message HONNÊTE : on ne prétend pas que ça a marché, et on ne
        // consomme pas la pierre. `evolve3d.js` est peut-être absent.
        return { ok: false, consumed: false,
          message: 'La pierre s\'illumine… puis s\'éteint.\nLes évolutions ne sont pas encore possibles ici.' };
      }
      const res = safe(function () { return evolve.applyStone(mon, itemId); }, null);
      if (!res) {
        // Cas normal et fréquent : cette créature-là n'évolue pas avec CETTE
        // pierre. Ce n'est pas une erreur, c'est un essai — donc NI la pierre
        // NI l'argent ne sont consommés (`consumed: false`). Et on DIT ce qu'il
        // faudrait : un refus muet donnerait l'impression d'un jeu cassé.
        const indice = (evolve.stoneHint)
          ? safe(function () { return evolve.stoneHint(mon, itemId); }, null) : null;
        return { ok: false, consumed: false,
          message: nom + ' regarde la ' + it.name + ' avec curiosité…\nmais il ne se passe rien.' +
            (indice ? '\n' + indice : '') };
      }
      // `toName` d'abord : `to` est un identifiant technique (« feuillonix »),
      // Robin doit lire le NOM (« Feuillix »).
      const nouveau = (res && (res.toName || res.to)) || nameOf(mon);
      return { ok: true, consumed: true, evolved: res,
        message: 'La ' + it.name + ' brille très fort…\n' + nom + ' évolue en ' + nouveau + ' ! ✦' };
    }

    return { ok: false, consumed: false, message: it.name + ' ne fait rien pour le moment.' };
  }

  /**
   * Version « tout compris » pour l'interface : vérifie le sac, applique
   * l'objet, et ne le décrémente QUE s'il a servi.
   * -> même résultat que `useItem`, avec `left` (ce qu'il reste).
   */
  function useFrom(itemId, mon, wallet) {
    const wal = walletOf(wallet);
    if (countOf(itemId, wal) <= 0) {
      return { ok: false, consumed: false, left: 0,
        message: 'Tu n\'as pas de ' + item(itemId).name + ' dans ton sac.' };
    }
    const res = useItem(itemId, mon);
    if (res.ok && res.consumed) wal.items[itemId] = Math.max(0, countOf(itemId, wal) - 1);
    res.left = countOf(itemId, wal);
    return res;
  }

  // ===========================================================================
  //  6. LES GAINS DE COMBAT
  // ===========================================================================
  //
  //  Barème du §6 :  sauvage ≈ 4 × niveau | dresseur ≈ 12 × niveau
  //                  champion = 500 + 40 × niveau
  //  Ordre de grandeur voulu : battre quelques dresseurs de niveau 10 doit
  //  suffire à s'offrir une Super Ball. Un champion doit payer une pierre.
  //
  //  RÈGLE ABSOLUE : on ne perd JAMAIS d'argent. Perdre un combat rapporte 0,
  //  jamais un nombre négatif. Le jeu n'est pas punitif.
  // ---------------------------------------------------------------------------

  const REWARD_RULES = {
    wild:      function (l) { return 4 * l; },
    trainer:   function (l) { return 12 * l; },
    champion:  function (l) { return 500 + 40 * l; },
    // Un légendaire n'est pas un combat comme un autre : le souvenir vaut cher.
    legendary: function (l) { return 20 * l + 200; },
  };

  // Alias : les autres modules parlent parfois français, parfois anglais.
  const KIND_ALIAS = {
    sauvage: 'wild', wild: 'wild',
    dresseur: 'trainer', trainer: 'trainer', npc: 'trainer',
    champion: 'champion', arene: 'champion', gym: 'champion',
    legendaire: 'legendary', legendary: 'legendary', legend: 'legendary',
  };

  function normalizeKind(k) {
    if (typeof k !== 'string') return 'wild';
    return KIND_ALIAS[k] || KIND_ALIAS[k.toLowerCase()] || 'wild';
  }

  /**
   * Argent gagné après un combat GAGNÉ.
   * @param {string} battleKind 'wild' | 'trainer' | 'champion' | 'legendary'
   * @param {number} level      niveau de l'adversaire
   * -> entier >= 1, jamais négatif.
   */
  function rewardFor(battleKind, level) {
    const kind = normalizeKind(battleKind);
    const lvl = clamp(Math.round(num(level, 5)), 1, 100);
    const rule = REWARD_RULES[kind] || REWARD_RULES.wild;

    let gain = rule(lvl);

    // Une petite variation (±10 %) : deux combats identiques ne rapportent pas
    // exactement pareil, ça rend les gains vivants sans changer l'équilibre.
    gain = gain * (0.9 + Math.random() * 0.2);

    // Le Charme Chance travaille tout seul, tant qu'il est dans le sac.
    if (countOf('charmechance') > 0) gain *= num(item('charmechance').power, 1.2);

    return Math.max(1, Math.round(gain));
  }

  /**
   * Confort pour `game3d.js` : calcule le gain, le verse, et renvoie la ligne
   * à afficher dans le texte de victoire. Un seul appel à brancher.
   * -> { gain, money, text }
   */
  function payReward(battleKind, level, wallet) {
    const wal = walletOf(wallet);
    const gain = rewardFor(battleKind, level);
    wal.money = Math.max(0, wal.money + gain);
    return {
      gain: gain,
      money: wal.money,
      text: 'Tu gagnes ' + gain + ' ' + MONEY_NAME + ' ' + MONEY_ICON + ' !',
    };
  }

  /** Défaite : zéro. Existe pour que personne n'ait besoin d'y réfléchir. */
  function penaltyFor() { return 0; }

  // ===========================================================================
  //  7. LE CENTRE POKÉMON
  // ===========================================================================
  //
  //  Les mots de l'infirmière. Robin va les lire des dizaines de fois : ils
  //  doivent être courts, chaleureux, et un peu différents à chaque passage.
  //  C'est la partie du fichier qu'il verra le plus. Elle compte autant que
  //  le reste.
  // ---------------------------------------------------------------------------

  const HEAL_TEXTS = [
    'Bonjour ! ✦\nJe m\'occupe de tout le monde… Voilà !\nToute ton équipe est en pleine forme.',
    'Ah, te revoilà !\nTes créatures avaient bien besoin d\'un repos.\nElles sont comme neuves. ✦',
    'Pose ton sac, respire un peu.\nTout le monde est soigné, PV et attaques !\nBonne route, dresseur. ✦',
    'Oh, celui-là s\'est bien battu…\nVoilà, plus une égratignure ! ✦\nPrends soin d\'eux, ils t\'adorent.',
    'Soins terminés ! ✦\nEt entre nous : ton équipe a l\'air fière de toi.',
    'Un petit passage au Centre et hop !\nTout le monde repart au maximum. ✦\nÀ très vite !',
    'Bienvenue au Centre Pokémon !\nRepos, PV, PP : tout est remis à neuf. ✦\nC\'est gratuit, bien sûr.',
    'Tes créatures dormaient debout…\nMaintenant elles trépignent d\'y retourner ! ✦',
  ];

  // On évite de répéter deux fois de suite le même mot : la répétition est ce
  // qui fait qu'un texte cesse d'être lu.
  let _lastHeal = -1;

  function healText() {
    if (HEAL_TEXTS.length <= 1) return HEAL_TEXTS[0] || 'Ton équipe est soignée ! ✦';
    let i = _lastHeal;
    while (i === _lastHeal) i = Math.floor(Math.random() * HEAL_TEXTS.length);
    _lastHeal = i;
    return HEAL_TEXTS[i];
  }

  const SHOP_WELCOME = [
    'Bienvenue à la boutique ! 🛍️\nQu\'est-ce qui te ferait plaisir ?',
    'Regarde bien : on a reçu de la marchandise fraîche !',
    'Un bon dresseur, ça a toujours des Balls en réserve. 🔴',
    'Prends ton temps, rien ne presse ici.',
    'Ah, un client ! Fais comme chez toi.',
  ];

  function shopWelcome() {
    return SHOP_WELCOME[Math.floor(Math.random() * SHOP_WELCOME.length)];
  }

  /**
   * LE passage au Centre, en une seule fonction — c'est ce que la tuile
   * `HEAL_DOOR` doit appeler.
   *   1. soin gratuit de toute l'équipe (et de la boîte),
   *   2. rechargement de la Téracristallisation (§7),
   *   3. le petit mot de l'infirmière.
   * -> { ok, healed, tera, text }
   */
  function healAtCenter() {
    let healed = 0;
    const team = teamApi();
    if (team && team.healAll) {
      const n = safe(function () { return team.healAll(); }, 0);
      healed = num(n, 0);
    }

    // La Téra se recharge au Centre (§7). Si `tera3d.js` n'est pas là, tant pis :
    // c'est un bonus, pas une condition.
    let tera = false;
    const t = mod('tera');
    if (t && t.reset) tera = !!safe(function () { t.reset(); return true; }, false);

    let text = healText();
    if (tera) text += '\n\n(Ta Téracristallisation est rechargée. ✦)';

    return { ok: true, healed: healed, tera: tera, text: text };
  }

  // ===========================================================================
  //  8. AUTO-VÉRIFICATION
  // ===========================================================================
  //  Elle `console.warn`, elle ne lève jamais. Elle sert à attraper une faute
  //  de frappe dans le catalogue avant que Robin ne tombe dessus.
  // ---------------------------------------------------------------------------

  function selfCheck() {
    const probs = [];
    const vus = Object.create(null);

    for (let i = 0; i < CATALOG.length; i++) {
      const it = CATALOG[i];
      if (!it.id) { probs.push('objet sans id à l\'index ' + i); continue; }
      if (vus[it.id]) probs.push('id en double : ' + it.id);
      vus[it.id] = true;
      if (!it.name || !it.icon) probs.push(it.id + ' : nom ou icône manquant');
      if (it.buyable !== false && !(it.price > 0)) probs.push(it.id + ' : prix invalide');
      if (['ball', 'soin', 'pierre', 'objet'].indexOf(it.kind) < 0) probs.push(it.id + ' : kind inconnu (' + it.kind + ')');
    }

    // Les prix imposés par le contrat §6 : s'ils bougent, il faut le savoir.
    const IMPOSES = {
      pokeball: 200, superball: 600, hyperball: 1200,
      potion: 300, superpotion: 700, hyperpotion: 1500, rappel: 1000,
    };
    for (const id in IMPOSES) {
      if (priceOf(id) !== IMPOSES[id]) probs.push(id + ' : prix ' + priceOf(id) + ' au lieu de ' + IMPOSES[id]);
    }

    if (BY_ID.ballmaitresse && BY_ID.ballmaitresse.buyable !== false) {
      probs.push('la Ball Maîtresse ne doit PAS être achetable');
    }
    for (let r = 0; r < REGION_ORDER.length; r++) {
      const s = stockFor(REGION_ORDER[r]);
      if (s.indexOf('ballmaitresse') >= 0) probs.push('ballmaitresse en stock dans ' + REGION_ORDER[r]);
      if (!s.length) probs.push('stock vide pour ' + REGION_ORDER[r]);
    }

    if (probs.length && typeof console !== 'undefined' && console.warn) {
      console.warn('[shop3d] catalogue :', probs.join(' | '));
    }
    return probs;
  }

  selfCheck();

  // ===========================================================================
  //  9. API — signature exacte du §6, plus les extensions documentées.
  // ===========================================================================

  const API = {
    // --- contrat §6 ---------------------------------------------------------
    CATALOG: CATALOG,
    item: item,
    priceOf: priceOf,
    canBuy: canBuy,
    buy: buy,
    sell: sell,
    stockFor: stockFor,
    useItem: useItem,
    rewardFor: rewardFor,
    healText: healText,

    // --- monnaie (extensions : le lot Intégration en a besoin) --------------
    START_MONEY: START_MONEY,
    MONEY_NAME: MONEY_NAME,
    MONEY_ICON: MONEY_ICON,
    bindWallet: bindWallet,      // shop.bindWallet(state) une fois au démarrage
    money: money,
    addMoney: addMoney,
    countOf: countOf,
    addItem: addItem,
    payReward: payReward,        // calcule + verse + renvoie la ligne à afficher
    penaltyFor: penaltyFor,      // toujours 0 : on ne perd jamais d'argent

    // --- confort pour l'interface -------------------------------------------
    sellPriceOf: sellPriceOf,
    stockItems: stockItems,
    sellableFrom: sellableFrom,
    useFrom: useFrom,            // vérifie le sac, applique, décrémente
    isStone: isStone,
    isBall: isBall,
    ballPower: ballPower,
    shopWelcome: shopWelcome,
    healAtCenter: healAtCenter,  // à appeler sur la tuile HEAL_DOOR
    REGION_ORDER: REGION_ORDER,
    selfCheck: selfCheck,
  };

  R3ref.register('shop', API);

  // Confort de débogage dans la console du navigateur.
  if (typeof window !== 'undefined') window.SHOP3D = API;
})();
