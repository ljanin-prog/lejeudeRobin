// =============================================================================
//  mechants3d.js — SPINEL, VECCUS, ET LE MONDE QUI BASCULE
// =============================================================================
//
//  Demandé par Robin le 9 août 2026 :
//    « il y a le méchant Spinel de Pokémon Horizons, qu'il soit fou et qu'il
//      veuille hypnotiser tout le monde, y compris le personnage principal. »
//    « le méchant Spinel peut faire alliance avec Veccus. Veccus est un méchant
//      dans le monde des WINX. Il veut tout détruire et est zinzin, machiavélique. »
//    « modifie l'histoire pour que tout ça reste cohérent. »
//
// -----------------------------------------------------------------------------
//  L'HISTOIRE, ET POURQUOI ELLE TIENT DEBOUT
// -----------------------------------------------------------------------------
//  Le jeu avait déjà tout ce qu'il fallait, sans le savoir. Il y avait :
//    · trente-six légendaires endormis, chacun à son autel ;
//    · huit couples d'ennemis jurés (legends3d.js) ;
//    · six dimensions ;
//    · et depuis aujourd'hui, des séismes et des tsunamis.
//
//  Ces quatre choses étaient là côte à côte, sans lien. L'histoire de Spinel est
//  exactement le fil qui les relie, et elle ne demande RIEN de neuf :
//
//    Spinel réveille les légendaires de force et les monte les uns contre les
//    autres. C'est POUR ÇA qu'ils se déchirent (les duels), c'est POUR ÇA que
//    le monde se dérègle (les cataclysmes), et c'est en ouvrant la Faille de
//    l'Espace de Palkia qu'il fait entrer Veccus, qui vient d'un autre monde.
//
//  Rien n'a été retiré au jeu : les six arènes, les badges et les quêtes des
//  conteurs continuent exactement comme avant. L'histoire se GREFFE dessus, au
//  rythme des badges — c'est le seul repère de progression que Robin possède
//  déjà, et il n'a donc rien de nouveau à comprendre.
//
// -----------------------------------------------------------------------------
//  LES SEPT ACTES
// -----------------------------------------------------------------------------
//    0 badge  · le monde va bien.
//    1 badge  · des habitants parlent bizarrement, les yeux dans le vide.
//    2 badges · Spinel se montre. Il rit, il explique, il ne cache rien.
//    3 badges · les légendaires se déchirent, la terre tremble pour de bon.
//    4 badges · la Faille s'ouvre. Veccus entre. Alliance.
//    5 badges · Spinel s'en prend à Robin lui-même. Premier combat.
//    6 badges · Veccus veut tout effacer. Dernier combat.
//
//  ⚠️ ON NE BLOQUE JAMAIS LA ROUTE. Aucun acte n'empêche d'aller quelque part,
//  de gagner un badge ou d'attraper une créature. Robin peut ignorer toute
//  l'histoire et finir son Pokédex tranquillement : les méchants sont un
//  spectacle qui se déroule à côté de lui, pas un péage.
// =============================================================================

(function () {
  'use strict';

  var R3ref = (typeof R3 !== 'undefined' && R3) ? R3 : null;
  if (!R3ref || typeof R3ref.register !== 'function') return;

  function mod(n) { return (R3ref.get && R3ref.get(n)) || null; }

  // ==========================================================================
  //  1. LES DEUX MÉCHANTS
  // ==========================================================================

  var SPINEL = {
    id: 'spinel',
    nom: 'Spinel',
    titre: 'l\'Hypnotiseur',
    colorMap: { j: 'n', l: 'z' },      // pâle, vêtu de violet sombre
    accessory: null,
    // Son équipe grandit avec l'histoire (voir `equipeDe`). Il n'utilise que
    // des créatures d'ombre et de psy : ce sont celles qui endorment.
    equipes: {
      5: [{ id: 'hibouchear', level: 46 }, { id: 'meduzia', level: 46 },
          { id: 'penombra', level: 50 }],
      6: [{ id: 'hibouchear', level: 52 }, { id: 'fantominus', level: 52 },
          { id: 'nyxaroth', level: 56 }, { id: 'penombra', level: 58 }],
    },
  };

  var VECCUS = {
    id: 'veccus',
    nom: 'Veccus',
    titre: 'le Dévoreur de Mondes',
    colorMap: { j: '0', l: 'u' },      // sombre, veiné de rouge
    accessory: null,
    equipes: {
      6: [{ id: 'eclipsion', level: 58 }, { id: 'sablion', level: 60 },
          { id: 'astralis', level: 62 }],
    },
  };

  // ==========================================================================
  //  2. LES ACTES
  //
  //  `entree` : ce qui s'affiche quand l'acte commence (une seule fois).
  //  `tension` : ce que vaut le monde pour cataclysme3d (0 = calme).
  //  `hypnose` : la part des habitants sous emprise, de 0 à 1.
  //  `qui` : le méchant présent sur la carte, ou null.
  // ==========================================================================

  var ACTES = [
    {
      n: 0, badges: 0, titre: 'Le monde va bien',
      tension: 0, hypnose: 0, qui: null, entree: null,
    },
    {
      n: 1, badges: 1, titre: 'Les yeux vides',
      tension: 0.05, hypnose: 0.25, qui: null,
      entree: '😶 Quelque chose ne va pas.\n' +
        'Dans les villages, des gens répètent la même phrase en boucle, ' +
        'les yeux grands ouverts, sans te voir.\n' +
        'Personne ne sait depuis quand.',
    },
    {
      n: 2, badges: 2, titre: 'Spinel',
      tension: 0.15, hypnose: 0.4, qui: 'spinel',
      entree: '🌀 Un homme t\'attend au bord du chemin.\n' +
        'Il sourit. Il ne se cache pas du tout.\n' +
        '« Spinel. Enchanté. Tu vas adorer ce que je prépare. »',
    },
    {
      n: 3, badges: 3, titre: 'Les gardiens se déchirent',
      tension: 0.45, hypnose: 0.5, qui: 'spinel',
      entree: '⚔️ Les légendaires se réveillent tous en même temps.\n' +
        'Ils ne se réveillent pas de bonne humeur : ils se jettent les uns ' +
        'sur les autres.\n' +
        'La terre tremble, la mer se dresse. Spinel applaudit.',
    },
    {
      n: 4, badges: 4, titre: 'La Faille',
      tension: 0.7, hypnose: 0.6, qui: 'veccus',
      entree: '🕳️ Le ciel s\'est fendu au-dessus du Plateau d\'Aurore.\n' +
        'Quelque chose est passé de l\'autre côté. Quelque chose qui ne vient ' +
        'pas d\'ici.\n' +
        '« Je m\'appelle Veccus. Et votre monde est très joli. Ce serait ' +
        'dommage qu\'il reste entier. »',
    },
    {
      n: 5, badges: 5, titre: 'À ton tour',
      tension: 0.85, hypnose: 0.75, qui: 'spinel',
      entree: '👁️ Spinel te cherche.\n' +
        'Il a hypnotisé des villages entiers. Il dit que tu es le dernier ' +
        'à le regarder droit dans les yeux.\n' +
        '« Et ça, vois-tu, je ne peux pas le supporter. »',
    },
    {
      n: 6, badges: 6, titre: 'Tout effacer',
      tension: 1, hypnose: 0.55, qui: 'veccus',
      entree: '🌑 Veccus n\'a plus besoin de Spinel.\n' +
        'Il n\'a jamais eu besoin de personne. Il veut juste que plus rien ' +
        'n\'existe — les villes, les créatures, les légendaires, tout.\n' +
        'Il t\'attend là où le ciel s\'est ouvert.',
    },
  ];

  // ==========================================================================
  //  3. CE QU'ILS DISENT
  //
  //  Un méchant qui explique son plan est un méchant qu'on comprend. Spinel dit
  //  TOUT, tout de suite, parce qu'il trouve ça drôle — c'est ce qui le rend
  //  inquiétant, pas le mystère. Veccus, lui, ne s'adresse presque pas à Robin :
  //  il parle du monde comme d'un objet.
  // ==========================================================================

  var DIALOGUES = {
    spinel: {
      2: [
        'Ah, te voilà. J\'espérais bien te croiser.',
        'Spinel. Je fais des rêves aux gens. De très longs rêves.',
        'Regarde ce monsieur, là-bas. Il croit qu\'il compte ses moutons. ' +
        'Il n\'a jamais eu de moutons.',
        'Ne fais pas cette tête ! Personne ne souffre. Ils sont juste… ailleurs.',
        'Continue tes petits badges, va. Moi, j\'ai des gardiens à réveiller.',
      ],
      3: [
        'TU AS SENTI ÇA ? Le sol ! Il a bougé !',
        'C\'est moi. Enfin — c\'est eux, mais c\'est moi qui les ai réveillés.',
        'Tu savais qu\'ils se détestent ? Groudon et Kyogre, Dialga et Palkia…',
        'Il a suffi de les réveiller en même temps. Ils font le reste tout seuls.',
        'Un monde qui se casse tout seul, c\'est tellement plus élégant.',
      ],
      4: [
        'Tu as vu le ciel ? Je l\'ai ouvert. Avec l\'aide de Palkia, disons.',
        'Il y avait quelqu\'un derrière. Il s\'appelle Veccus.',
        'Nous nous sommes très bien entendus. Lui veut tout détruire, moi je ' +
        'veux que tout le monde dorme.',
        'Au fond, c\'est presque la même chose. En plus reposant de mon côté.',
      ],
      5: [
        'Toi. Tu es le seul qui me regarde encore en face.',
        'Des villages entiers rêvent, et toi tu marches, tu attrapes tes ' +
        'créatures, tu gagnes tes badges. Comme si de rien n\'était.',
        'C\'est très impoli.',
        'Alors on va arranger ça. Regarde-moi bien, petit dresseur.',
        'REGARDE-MOI.',
      ],
      6: [
        'Il ne m\'écoute plus, tu sais. Veccus.',
        'Je voulais un monde endormi. Lui veut un monde vide. Ce n\'est PAS ' +
        'la même chose. Dans un monde vide, il n\'y a plus personne à endormir.',
        '…Je ne dis pas que je suis de ton côté. Je dis que je suis très vexé.',
        'Va le voir. Moi, je vais aller me reposer un peu.',
      ],
      vaincu: [
        'Oh. Tu ne t\'es pas endormi.',
        'Personne ne fait ça. Personne.',
        '…Tu m\'as réveillé, en fait. C\'est très désagréable.',
      ],
    },
    veccus: {
      4: [
        'Ce monde a des couleurs. Beaucoup trop.',
        'D\'où je viens, il n\'y a plus rien. J\'ai été très appliqué.',
        'Ton ami à la voix douce croit se servir de moi. C\'est charmant.',
        'Continue de jouer, petit. Je commence par les montagnes.',
      ],
      6: [
        'Tu es venu. Bien. Ça ira plus vite.',
        'Je n\'ai rien contre toi. Je n\'ai rien contre personne — c\'est ' +
        'justement le problème de tout le monde.',
        'Les villes, les créatures, les gardiens, le ciel : tout ça peut ' +
        'très bien ne pas exister. Ça n\'a jamais été obligatoire.',
        'Alors j\'efface. Et je commence par ce que tu aimes.',
      ],
      vaincu: [
        '…Non.',
        'Ce monde tient debout. Il tient debout parce que quelqu\'un ' +
        's\'est mis devant.',
        'Je n\'avais pas prévu ça. Je ne prévois jamais ça.',
      ],
    },
  };

  // Ce que dit un habitant sous hypnose. Volontairement doux et absurde :
  // c'est plus troublant qu'effrayant, et c'est le bon dosage à dix ans.
  var HYPNOTISE = [
    'Tout va très bien. Tout va très bien. Tout va très bien.',
    'Je compte mes moutons. J\'en ai mille. J\'en ai mille. J\'en ai…',
    'Quelqu\'un m\'a dit de sourire, alors je souris. Je ne sais plus qui.',
    'C\'est un très joli rêve. Tu devrais essayer. Tout le monde essaie.',
    'Le monsieur violet a dit de ne pas s\'inquiéter. Alors je ne m\'inquiète pas.',
    '…quelle heure il est ? …quelle heure il est ? …quelle heure il est ?',
  ];

  // ==========================================================================
  //  4. L'ÉTAT
  // ==========================================================================

  var _acteVu = 0;        // dernier acte dont l'entrée a été racontée
  var _vaincus = {};      // spinel / veccus -> true

  /** L'acte courant, déduit du nombre de badges. */
  function acteDe(badges) {
    var b = Math.max(0, Math.min(6, badges | 0));
    for (var i = ACTES.length - 1; i >= 0; i--) if (b >= ACTES[i].badges) return ACTES[i];
    return ACTES[0];
  }

  /**
   * Un PNJ est-il hypnotisé ? Déterministe : le même villageois est TOUJOURS
   * hypnotisé ou toujours lucide, tant que l'acte ne change pas. Un tirage au
   * sort à chaque phrase donnerait un village schizophrène — et Robin ne
   * pourrait jamais dire « lui, il est bizarre depuis hier ».
   */
  function estHypnotise(npcId, badges) {
    if (!npcId) return false;
    var a = acteDe(badges);
    if (a.hypnose <= 0) return false;
    // Ni les champions, ni les dresseurs, ni les méchants : seulement les gens
    // ordinaires. Un champion d'arène hypnotisé rendrait son arène incompréhensible.
    if (npcId.indexOf('champion') >= 0 || npcId.indexOf('_t_') >= 0) return false;
    if (npcId === 'spinel' || npcId === 'veccus') return false;
    return (hash(npcId, 0) % 1000) / 1000 < a.hypnose;
  }

  /**
   * FNV-1a. Le premier essai multipliait par 31 modulo 1000 — un classique, et
   * un mauvais choix ici : sur les onze identifiants d'une région, qui se
   * ressemblent tous (`val_sage`, `val_enfant`, `val_jardiniere`…), il les
   * envoyait presque tous dans le même coin. Résultat mesuré dans le vrai jeu :
   * UN habitant endormi sur onze, alors que l'acte en demandait la moitié.
   * FNV-1a disperse correctement des chaînes voisines, ce qui est exactement le
   * problème posé.
   */
  function hash(txt, graine) {
    var h = (2166136261 ^ (graine || 0)) >>> 0;
    for (var i = 0; i < txt.length; i++) {
      h ^= txt.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function repliqueHypnotise(npcId) {
    return HYPNOTISE[hash(npcId, 7) % HYPNOTISE.length];
  }

  // ==========================================================================
  //  5. LES MÉCHANTS SUR LA CARTE
  //
  //  Un seul est présent à la fois, dans UNE région, et il change de place
  //  d'un acte à l'autre : Spinel suit Robin de région en région (il le suit
  //  vraiment, c'est le propos), Veccus reste au Plateau d'Aurore, là où le
  //  ciel s'est ouvert.
  // ==========================================================================

  var OU = {
    spinel: { 2: 'sylve', 3: 'saphir', 5: 'braise', 6: 'givre' },
    veccus: { 4: 'aurore', 6: 'aurore' },
  };

  /**
   * Le PNJ méchant à poser dans cette région, ou null.
   * Format `regions3d` : game3d l'ajoute simplement à la liste des PNJ.
   */
  function pnjDeLaRegion(regionId, badges) {
    var a = acteDe(badges);
    if (!a.qui) return null;
    var m = (a.qui === 'spinel') ? SPINEL : VECCUS;
    if (_vaincus[m.id] && a.n < 6) return null;      // battu : il se fait discret
    var attendu = (OU[m.id] || {})[a.n];
    if (attendu !== regionId) return null;

    var combat = (a.n >= 5 && !!m.equipes[a.n] && !_vaincus[m.id]);
    return {
      id: m.id,
      name: m.nom,
      x: null, y: null,               // posé par game3d près du joueur
      dir: 'down',
      colorMap: m.colorMap,
      accessory: m.accessory,
      region: regionId,
      isVillain: true,
      villainId: m.id,
      acte: a.n,
      dialog: dialogueDe(m.id, a.n),
      // À partir de l'acte 5, lui parler DÉCLENCHE le combat : on réutilise le
      // mécanisme des dresseurs, que game3d sait déjà mener de bout en bout.
      isTrainer: combat,
      party: combat ? m.equipes[a.n].map(function (e) { return e.id; }) : null,
      team: combat ? m.equipes[a.n].slice() : null,
      level: combat ? m.equipes[a.n][m.equipes[a.n].length - 1].level : 1,
      dialogDefeated: DIALOGUES[m.id].vaincu,
    };
  }

  function dialogueDe(who, acte) {
    var d = DIALOGUES[who];
    if (!d) return ['…'];
    // On redescend jusqu'au dernier acte où il avait quelque chose à dire.
    for (var n = acte; n >= 0; n--) if (d[n]) return d[n].slice();
    return ['…'];
  }

  function equipeDe(who, acte) {
    var m = (who === 'spinel') ? SPINEL : (who === 'veccus') ? VECCUS : null;
    if (!m) return null;
    for (var n = acte; n >= 0; n--) if (m.equipes[n]) return m.equipes[n].slice();
    return null;
  }

  // ==========================================================================
  //  6. LA PROGRESSION
  // ==========================================================================

  /**
   * À appeler quand le nombre de badges change (ou au chargement d'une partie).
   * -> le texte d'entrée du nouvel acte, ou null s'il n'y a rien de neuf.
   * Applique aussi la tension au monde : plus l'histoire avance, plus la terre
   * tremble souvent.
   */
  function majActe(badges) {
    var a = acteDe(badges);
    var cata = mod('cataclysme');
    if (cata && cata.setTension) {
      try { cata.setTension(a.tension); } catch (e) { /* pas grave */ }
    }
    if (a.n <= _acteVu) return null;
    _acteVu = a.n;
    return a.entree || null;
  }

  function marquerVaincu(who) {
    if (who) _vaincus[who] = true;
  }

  // ==========================================================================
  //  7. SAUVEGARDE
  // ==========================================================================

  function serialize() { return { acteVu: _acteVu, vaincus: Object.keys(_vaincus) }; }

  function deserialize(d) {
    _acteVu = (d && typeof d.acteVu === 'number') ? d.acteVu : 0;
    _vaincus = {};
    if (d && d.vaincus && d.vaincus.length) {
      for (var i = 0; i < d.vaincus.length; i++) _vaincus[d.vaincus[i]] = true;
    }
  }

  // ==========================================================================
  //  8. API
  // ==========================================================================

  var API = {
    ACTES: ACTES,
    SPINEL: SPINEL,
    VECCUS: VECCUS,
    DIALOGUES: DIALOGUES,
    acteDe: acteDe,
    majActe: majActe,
    pnjDeLaRegion: pnjDeLaRegion,
    dialogueDe: dialogueDe,
    equipeDe: equipeDe,
    estHypnotise: estHypnotise,
    repliqueHypnotise: repliqueHypnotise,
    marquerVaincu: marquerVaincu,
    estVaincu: function (who) { return !!_vaincus[who]; },
    acteVu: function () { return _acteVu; },
    serialize: serialize,
    deserialize: deserialize,
  };

  R3ref.register('mechants', API);
  if (typeof window !== 'undefined') window.MECHANTS3D = API;
})();
