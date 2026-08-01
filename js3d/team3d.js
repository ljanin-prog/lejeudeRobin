// =============================================================================
//  team3d.js — L'ÉQUIPE DE 6  (demande n°4 de Robin)
// =============================================================================
//  « Il faut que je puisse utiliser les pokémon que j'ai attrapés,
//    6 places pour les choisir. »
//
//  Ce module possède les CRÉATURES DU JOUEUR. Il ne dessine rien, il ne lit
//  aucune touche : il tient les données et les règles de progression.
//
//  DISTINCTION CAPITALE — `species` vs `Mon` :
//    • `species`  = l'ESPÈCE (Flamdrak en général). Fournie par `dex3d.js`,
//                   partagée, immuable, jamais modifiée ici.
//    • `Mon`      = UN INDIVIDU (le Flamdrak de Robin, capturé mardi, niveau 14,
//                   surnommé « Braise », à qui il reste 3 PP sur Inferno).
//    Deux Flamdrak capturés sont DEUX `Mon` distincts avec deux `uid` distincts.
//    Ne jamais écrire dans un `species` : ce serait modifier tous les Flamdrak
//    du monde d'un coup.
//
//  DÉPENDANCES (toutes facultatives — dégradation gracieuse obligatoire) :
//    R3.get('dex')   -> les 62 espèces      | repli : table interne + CREATURES 2D
//    R3.get('moves') -> le catalogue de PP  | repli : 20 PP par capacité
//  Aucune de ces absences ne doit lever d'exception : le jeu doit rester
//  jouable même si un module voisin n'a pas chargé.
// =============================================================================

(function () {
  'use strict';

  // Socle. On garde un repli muet pour que le fichier reste chargeable seul
  // (test hors navigateur, ou core3d.js absent) sans jamais lever d'exception.
  const R3ref = (typeof R3 !== 'undefined' && R3) ? R3 : {
    get: function () { return undefined; },
    register: function (n, api) { return api; },
  };

  // ---------------------------------------------------------------------------
  //  CONSTANTES D'ÉQUILIBRAGE
  // ---------------------------------------------------------------------------

  const MAX_TEAM = 6;      // les 6 places demandées par Robin
  const MAX_LEVEL = 60;    // niveau maximum (contrat §11)
  const MAX_BOX = 200;     // garde-fou : une sauvegarde ne doit pas enfler sans fin

  // Statistiques de repli quand l'espèce est inconnue : une créature moyenne,
  // ni ridicule ni imbattable.
  const FALLBACK_STATS = { baseHp: 45, atk: 30, def: 28, speed: 30 };

  // Capacités neutres du §7, connues de tout le monde : le repli sûr quand on
  // ne sait rien des capacités d'une espèce.
  const FALLBACK_MOVES = ['charge', 'vitesse', 'repos', 'concentration'];

  // Types des 26 créatures d'origine — et d'elles SEULES : les 36 légendaires et
  // les formes évoluées n'y figurent pas et retombent sur ['plante'].
  // Sert UNIQUEMENT si `dex3d.js` est absent : sans cette table, un repli
  // donnerait des types au hasard et la table d'efficacité renverrait n'importe
  // quoi en plein combat.
  //
  // RECOPIÉE MOT POUR MOT du champ `types:` de `BASE_DATA` (dex3d.js), ORDRE
  // COMPRIS : `types[0]` décide de la couleur de la carte, du type Téra par
  // défaut et du soin choisi par `dex3d.resolveMoves()`. Onze entrées se
  // contredisaient avec le dex (lapinou était plante au lieu de terre, miaouche
  // ombre au lieu de lumière) : le repli fabriquait alors une créature aux
  // faiblesses inversées. dex3d fait foi, jamais l'inverse (CONTRACT3 §3).
  const FALLBACK_TYPES = {
    feuillou: ['plante'], petalia: ['plante', 'lumiere'], goutella: ['eau'], bullini: ['eau'],
    etincelo: ['foudre'], meduzia: ['eau', 'ombre'], coralou: ['eau', 'roche'], fluffly: ['air'],
    glanou: ['plante', 'terre'], papillon: ['air', 'plante'], cygnik: ['eau', 'air'],
    lotira: ['plante', 'eau'], lapinou: ['terre'], hibouche: ['air', 'ombre'],
    etoilamer: ['eau', 'lumiere'], crabilino: ['eau', 'roche'], nuagette: ['air', 'lumiere'],
    miaouche: ['lumiere'], pandouki: ['plante', 'terre'], koronette: ['lumiere'],
    stellini: ['lumiere', 'espace'], doudoune: ['air'], flamdrak: ['feu', 'air'],
    glydrak: ['glace', 'air'], aquadrak: ['eau', 'air'], tonnedrak: ['foudre', 'air'],
  };

  // ---------------------------------------------------------------------------
  //  PETITS OUTILS
  // ---------------------------------------------------------------------------

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /** Nombre fini, sinon la valeur par défaut. Toute la tolérance aux vieilles
   *  sauvegardes repose sur cette fonction : un champ absent, `null`, `"12"` ou
   *  `NaN` ne doit jamais contaminer les statistiques. */
  function num(v, def) {
    const n = (typeof v === 'string') ? parseFloat(v) : v;
    return (typeof n === 'number' && isFinite(n)) ? n : def;
  }

  function str(v, def) {
    return (typeof v === 'string' && v.length) ? v : def;
  }

  /** Normalise un champ « types » venu de n'importe où en tableau de 1 ou 2 ids. */
  function normTypes(t, fallback) {
    if (typeof t === 'string' && t) return [t];
    if (Array.isArray(t)) {
      const out = t.filter(function (x) { return typeof x === 'string' && x; }).slice(0, 2);
      if (out.length) return out;
    }
    return (fallback && fallback.slice) ? fallback.slice(0, 2) : ['plante'];
  }

  // --- Identifiants uniques -------------------------------------------------
  // Un `uid` identifie CET individu pour toute sa vie : il sert à le retrouver
  // dans l'équipe ou la boîte, à le déplacer, à le renommer. Il doit rester
  // unique même après rechargement d'une sauvegarde.
  let _uidSeq = 0;
  const _usedUids = Object.create(null);

  function newUid() {
    let id;
    do {
      _uidSeq++;
      id = 'm' + _uidSeq.toString(36) + '-' + Math.floor(Math.random() * 1679616).toString(36);
    } while (_usedUids[id]);
    _usedUids[id] = true;
    return id;
  }

  /** Réserve un uid venu d'une sauvegarde, ou en fabrique un neuf s'il est
   *  absent ou déjà pris (sauvegarde bricolée à la main, fusion de parties…). */
  function claimUid(candidate) {
    if (typeof candidate === 'string' && candidate && !_usedUids[candidate]) {
      _usedUids[candidate] = true;
      return candidate;
    }
    return newUid();
  }

  // ---------------------------------------------------------------------------
  //  ACCÈS AUX MODULES VOISINS (toujours à la volée : l'ordre de chargement
  //  ne doit jamais nous piéger, et un module peut s'enregistrer plus tard)
  // ---------------------------------------------------------------------------

  function dexModule() {
    try { return R3ref.get('dex'); } catch (e) { return undefined; }
  }
  function movesModule() {
    try { return R3ref.get('moves'); } catch (e) { return undefined; }
  }

  /** Espèce de repli reconstruite à partir du jeu 2D (`CREATURES`) ou, à défaut,
   *  d'une créature moyenne. Ne sert que si `dex3d.js` manque à l'appel. */
  function fallbackSpecies(id) {
    let c = null;
    try {
      if (typeof CREATURES !== 'undefined' && CREATURES && CREATURES.find) {
        c = CREATURES.find(function (x) { return x && x.id === id; }) || null;
      }
    } catch (e) { c = null; }

    const rate = c ? num(c.catchRate, 0.7) : 0.5;
    // Plus une créature est dure à capturer, plus elle est puissante : c'est la
    // seule information de rareté dont on dispose dans le jeu 2D.
    const rare = clamp(1 - rate, 0, 1);
    return {
      id: id,
      name: (c && c.name) || String(id || 'Créature'),
      types: FALLBACK_TYPES[id] || ['plante'],
      legendary: false,
      catchRate: rate,
      baseHp: Math.round(FALLBACK_STATS.baseHp + rare * 55),
      atk: Math.round(FALLBACK_STATS.atk + rare * 40),
      def: Math.round(FALLBACK_STATS.def + rare * 38),
      speed: Math.round(FALLBACK_STATS.speed + rare * 40),
      moveIds: FALLBACK_MOVES.slice(),
      learnset: [],
      color: (c && c.color) || '#d896ff',
      description: (c && c.description) || '',
      minLevel: 3, maxLevel: 12,
      _fallback: true,
    };
  }

  /** L'espèce d'un id, JAMAIS null. C'est le seul point d'entrée vers `dex3d`. */
  function speciesOf(id) {
    const dex = dexModule();
    if (dex && typeof dex.get === 'function') {
      try {
        const s = dex.get(id);
        if (s) return s;
      } catch (e) { /* dex cassé : on continue sur le repli */ }
    }
    return fallbackSpecies(id);
  }

  /** Vrai si `dex3d` connaît réellement cette espèce (sert à `deserialize` pour
   *  distinguer « module absent » de « espèce supprimée du jeu »). */
  function dexKnows(id) {
    const dex = dexModule();
    if (!dex || typeof dex.get !== 'function') return null;   // null = on ne sait pas
    try { return !!dex.get(id); } catch (e) { return null; }
  }

  /** Définition d'une capacité, jamais null (repli : 20 PP). */
  function moveDef(id) {
    const mv = movesModule();
    if (mv && typeof mv.get === 'function') {
      try {
        const m = mv.get(id);
        if (m) return m;
      } catch (e) { /* repli */ }
    }
    return { id: id, name: String(id || 'Charge'), pp: 20 };
  }

  function ppOf(id) {
    return Math.max(1, Math.round(num(moveDef(id).pp, 20)));
  }

  // ---------------------------------------------------------------------------
  //  FORMULES DE PROGRESSION  (contrat §11 — à ne pas modifier sans le contrat)
  // ---------------------------------------------------------------------------

  /** XP nécessaire pour passer du niveau `level` au suivant. */
  function xpNeeded(level) {
    const l = clamp(Math.round(num(level, 1)), 1, MAX_LEVEL);
    return 20 + l * l * 4;
  }

  function statHp(base, level) { return Math.max(1, Math.round(num(base, FALLBACK_STATS.baseHp) * (1 + level * 0.06))); }
  function statOther(base, level, def) { return Math.max(1, Math.round(num(base, def) * (1 + level * 0.05))); }

  /**
   * (Re)calcule les statistiques d'un individu depuis son espèce et son niveau.
   * N'AGIT PAS sur les PV courants : c'est l'appelant qui décide comment les
   * reporter (montée de niveau = on conserve la proportion, voir `gainXp`).
   */
  function recomputeStats(mon, species) {
    const sp = species || speciesOf(mon.id);
    mon.maxHp = statHp(sp.baseHp, mon.level);
    mon.atk = statOther(sp.atk, mon.level, FALLBACK_STATS.atk);
    mon.def = statOther(sp.def, mon.level, FALLBACK_STATS.def);
    mon.speed = statOther(sp.speed, mon.level, FALLBACK_STATS.speed);
    mon.xpNext = xpNeeded(mon.level);
    return mon;
  }

  // ---------------------------------------------------------------------------
  //  CAPACITÉS
  // ---------------------------------------------------------------------------

  /** Normalise une entrée de `learnset` : on tolère plusieurs orthographes,
   *  car ces tables sont écrites à la main dans `dex3d.js`. */
  function normLearn(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') return { level: 1, moveId: entry };
    const lvl = Math.round(num(entry.level !== undefined ? entry.level : entry.lvl, 1));
    const mid = str(entry.moveId || entry.move || entry.id, null);
    if (!mid) return null;
    return { level: clamp(lvl, 1, MAX_LEVEL), moveId: mid };
  }

  function learnsetOf(species) {
    const raw = (species && Array.isArray(species.learnset)) ? species.learnset : [];
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      const e = normLearn(raw[i]);
      if (e) out.push(e);
    }
    out.sort(function (a, b) { return a.level - b.level; });
    return out;
  }

  function knowsMove(mon, moveId) {
    for (let i = 0; i < mon.moves.length; i++) if (mon.moves[i].id === moveId) return true;
    return false;
  }

  function makeMoveSlot(id) {
    const pp = ppOf(id);
    return { id: id, pp: pp, ppMax: pp };
  }

  /** Vrai si cette capacité rend des PV. Sans le catalogue `moves3d`, le repli
   *  de `moveDef` n'a pas de champ `heal` : on répond « non », ce qui ramène
   *  simplement à l'ancien oubli premier-entré-premier-sorti. Jamais d'exception. */
  function isHealMove(id) {
    return !!num(moveDef(id).heal, 0);
  }

  /**
   * Emplacement à effacer quand une 5ᵉ capacité arrive : la plus ancienne,
   * SAUF si c'est le dernier soin de la créature — dans ce cas on efface la
   * plus ancienne des autres.
   *
   * `dex3d.js` garantit que CHAQUE espèce possède une capacité de soin (elle en
   * réécrit une au besoin dans `moveIds`). L'oubli purement premier-entré-
   * premier-sorti la jetait la première, puisqu'elle occupe un emplacement de
   * base : 23 espèces sur 62 finissaient sans aucun moyen de se soigner dès
   * qu'on les créait à un niveau assez haut (Feuillou dès le niveau 27).
   */
  function slotToForget(known, incomingId) {
    let heals = 0;
    for (let i = 0; i < known.length; i++) if (isHealMove(known[i])) heals++;
    // Le nouveau venu soigne, ou il reste un autre soin : rien à protéger.
    if (heals !== 1 || isHealMove(incomingId)) return 0;
    for (let i = 0; i < known.length; i++) if (!isHealMove(known[i])) return i;
    return 0;   // que des soins : inatteignable puisque heals === 1
  }

  /**
   * Jeu de capacités d'une créature CRÉÉE au niveau `level` (sauvage, dresseur,
   * champion). On part des 4 capacités de base, puis on applique le `learnset`
   * dans l'ordre : au-delà de 4, la plus ancienne s'efface — mais jamais son
   * unique soin (voir `slotToForget`).
   *
   * Pourquoi cet oubli automatique ici, alors que `gainXp` ne l'autorise jamais ?
   * Parce qu'ici personne n'a choisi ces capacités : sans cela, un légendaire de
   * niveau 50 arriverait au combat sans sa capacité signature.
   */
  function movesForLevel(species, level) {
    const base = Array.isArray(species.moveIds) ? species.moveIds.filter(function (m) { return typeof m === 'string' && m; }) : [];
    const known = base.slice(0, 4);
    const learn = learnsetOf(species);
    for (let i = 0; i < learn.length; i++) {
      const e = learn[i];
      if (e.level > level) break;
      if (known.indexOf(e.moveId) >= 0) continue;
      if (known.length < 4) known.push(e.moveId);
      else { known.splice(slotToForget(known, e.moveId), 1); known.push(e.moveId); }
    }
    if (!known.length) known.push(FALLBACK_MOVES[0]);
    return known.map(makeMoveSlot);
  }

  // ---------------------------------------------------------------------------
  //  ÉTAT DU MODULE
  //  `team` et `box` sont exposés tels quels : on les MUTE toujours en place,
  //  jamais de réaffectation, sinon les modules qui gardent une référence
  //  (hud3d, battle3d) travailleraient sur un tableau fantôme.
  // ---------------------------------------------------------------------------

  const team = [];
  const box = [];
  let activeIndex = 0;   // créature envoyée en premier au combat

  // ---------------------------------------------------------------------------
  //  CRÉATION
  // ---------------------------------------------------------------------------

  /**
   * Crée un NOUVEL individu.
   * @param {string} speciesId  id d'espèce (dex3d)
   * @param {number} level      niveau, borné à [1, 60]
   * @param {object} [opts]     { nick, caughtAt:{regionId,x,y}, hp } — extension
   *                            hors contrat, purement facultative.
   * @returns {Mon}             jamais null, jamais d'exception
   */
  function create(speciesId, level, opts) {
    opts = opts || {};
    const sp = speciesOf(speciesId);
    const lvl = clamp(Math.round(num(level, 5)), 1, MAX_LEVEL);

    const mon = {
      uid: newUid(),
      id: str(speciesId, sp.id || 'inconnu'),
      nick: str(opts.nick, sp.name || String(speciesId)),
      level: lvl,
      xp: 0,
      xpNext: xpNeeded(lvl),
      hp: 1, maxHp: 1, atk: 1, def: 1, speed: 1,
      types: normTypes(sp.types, ['plante']),
      moves: movesForLevel(sp, lvl),
      caughtAt: opts.caughtAt || null,
    };
    recomputeStats(mon, sp);
    mon.hp = clamp(Math.round(num(opts.hp, mon.maxHp)), 0, mon.maxHp);
    return mon;
  }

  // ---------------------------------------------------------------------------
  //  ÉQUIPE & BOÎTE
  // ---------------------------------------------------------------------------

  /** Ajoute un individu. -> 'team' si une place était libre, 'box' sinon. */
  function add(mon) {
    if (!mon || typeof mon !== 'object') return 'box';
    if (!mon.uid) mon.uid = newUid();
    if (team.length < MAX_TEAM) { team.push(mon); return 'team'; }
    box.push(mon);
    if (box.length > MAX_BOX) box.shift();   // garde-fou anti-sauvegarde obèse
    return 'box';
  }

  function indexOfUid(list, uid) {
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].uid === uid) return i;
    return -1;
  }

  /** Retrouve un individu par son uid, dans l'équipe ou la boîte. */
  function mon(uid) {
    let i = indexOfUid(team, uid);
    if (i >= 0) return team[i];
    i = indexOfUid(box, uid);
    return i >= 0 ? box[i] : null;
  }

  /** Retire définitivement un individu. -> le Mon retiré, ou null. */
  function remove(uid) {
    let i = indexOfUid(team, uid);
    if (i >= 0) {
      const m = team.splice(i, 1)[0];
      if (activeIndex >= team.length) activeIndex = 0;
      return m;
    }
    i = indexOfUid(box, uid);
    if (i >= 0) return box.splice(i, 1)[0];
    return null;
  }

  /** Échange deux emplacements de l'équipe (réorganisation par Robin). */
  function swap(i, j) {
    if (i === j) return false;
    if (i < 0 || j < 0 || i >= team.length || j >= team.length) return false;
    const t = team[i]; team[i] = team[j]; team[j] = t;
    if (activeIndex === i) activeIndex = j;
    else if (activeIndex === j) activeIndex = i;
    return true;
  }

  /**
   * Sort une créature de la boîte pour l'équipe.
   * @param {number} boxIndex
   * @param {number} [teamIndex]  si l'équipe est pleine, emplacement à échanger
   *                              (celui qui s'y trouvait part à la boîte).
   */
  function toTeam(boxIndex, teamIndex) {
    if (boxIndex < 0 || boxIndex >= box.length) return false;
    if (team.length < MAX_TEAM) {
      team.push(box.splice(boxIndex, 1)[0]);
      return true;
    }
    const ti = Math.round(num(teamIndex, -1));
    if (ti < 0 || ti >= team.length) return false;   // équipe pleine, pas d'échange demandé
    const out = team[ti];
    team[ti] = box.splice(boxIndex, 1)[0];
    box.push(out);
    return true;
  }

  /** Range une créature de l'équipe dans la boîte.
   *  Refuse de vider l'équipe : Robin sans créature, c'est un jeu bloqué. */
  function toBox(teamIndex) {
    if (teamIndex < 0 || teamIndex >= team.length) return false;
    if (team.length <= 1) return false;
    box.push(team.splice(teamIndex, 1)[0]);
    if (box.length > MAX_BOX) box.shift();
    if (activeIndex >= team.length) activeIndex = 0;
    return true;
  }

  // ---------------------------------------------------------------------------
  //  COMBAT — vie, PV, PP
  // ---------------------------------------------------------------------------

  function isAlive(m) { return !!m && num(m.hp, 0) > 0; }

  /** La créature à envoyer au combat : celle choisie par Robin si elle tient
   *  debout, sinon la première vivante, sinon null. */
  function active() {
    if (activeIndex >= 0 && activeIndex < team.length && isAlive(team[activeIndex])) return team[activeIndex];
    for (let i = 0; i < team.length; i++) if (isAlive(team[i])) { activeIndex = i; return team[i]; }
    return null;
  }

  function setActive(index) {
    const i = Math.round(num(index, -1));
    if (i < 0 || i >= team.length || !isAlive(team[i])) return false;
    activeIndex = i;
    return true;
  }

  function alive() { return team.filter(isAlive); }

  /** Vrai seulement s'il Y A une équipe et qu'elle est entièrement K.O.
   *  (une équipe vide n'est pas « K.O. » : c'est l'écran de choix du starter). */
  function allFainted() {
    if (!team.length) return false;
    for (let i = 0; i < team.length; i++) if (isAlive(team[i])) return false;
    return true;
  }

  /** Rend tous les PV et tous les PP de tout le monde (centre de soins). */
  function healAll() {
    const all = team.concat(box);
    for (let i = 0; i < all.length; i++) {
      const m = all[i];
      if (!m) continue;
      m.hp = m.maxHp;
      restorePP(m);
    }
    activeIndex = 0;
    return all.length;
  }

  /** Inflige `n` dégâts. -> dégâts réellement infligés. */
  function damage(m, n) {
    if (!m) return 0;
    const before = clamp(num(m.hp, 0), 0, m.maxHp);
    m.hp = clamp(before - Math.max(0, Math.round(num(n, 0))), 0, m.maxHp);
    return before - m.hp;
  }

  /** Rend `n` PV. Ne ressuscite pas une créature K.O. (c'est le rôle du centre
   *  de soins ou d'un objet dédié). -> PV réellement rendus. */
  function heal(m, n) {
    if (!m) return 0;
    const before = clamp(num(m.hp, 0), 0, m.maxHp);
    if (before <= 0) return 0;
    m.hp = clamp(before + Math.max(0, Math.round(num(n, 0))), 0, m.maxHp);
    return m.hp - before;
  }

  /** Rend tous les PP d'une créature. */
  function restorePP(m) {
    if (!m || !Array.isArray(m.moves)) return false;
    for (let i = 0; i < m.moves.length; i++) {
      const s = m.moves[i];
      if (s) s.pp = num(s.ppMax, ppOf(s.id));
    }
    return true;
  }

  /** Consomme 1 PP. -> false si la capacité est épuisée (extension pratique
   *  pour battle3d / game3d : évite de dupliquer ce calcul ailleurs). */
  function spendPP(m, moveId) {
    if (!m || !Array.isArray(m.moves)) return false;
    for (let i = 0; i < m.moves.length; i++) {
      const s = m.moves[i];
      if (s && s.id === moveId) {
        if (num(s.pp, 0) <= 0) return false;
        s.pp = Math.max(0, Math.round(num(s.pp, 0)) - 1);
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  //  EXPÉRIENCE
  // ---------------------------------------------------------------------------

  /**
   * Donne de l'XP et gère AUTANT de montées de niveau que nécessaire — battre un
   * légendaire peut faire gagner 3 niveaux d'un coup, et le jeu doit le montrer.
   *
   * Les PV sont reportés EN PROPORTION : monter de niveau ne soigne pas à fond
   * (sinon on ferait exprès de finir les combats à 1 PV), mais ne tue jamais
   * (une créature debout reste debout, avec au moins 1 PV).
   *
   * @returns {{leveled:number, level:number, learned:string[],
   *            pendingLearn:Array<{moveId:string, level:number}>, xpGained:number}}
   *   `leveled` est le NOMBRE de niveaux gagnés (0 si aucun) : il s'utilise
   *   aussi bien comme booléen (`if (r.leveled)`) que comme compteur.
   *   `pendingLearn` : capacités qui n'ont pas pu être apprises faute de place.
   *   ON NE REMPLACE JAMAIS TOUT SEUL une capacité choisie par Robin :
   *   `game3d.js` / `hud3d.js` lui poseront la question.
   */
  function gainXp(m, amount) {
    const res = { leveled: 0, level: m ? m.level : 1, learned: [], pendingLearn: [], xpGained: 0 };
    if (!m) return res;

    const sp = speciesOf(m.id);
    const learn = learnsetOf(sp);

    m.level = clamp(Math.round(num(m.level, 1)), 1, MAX_LEVEL);
    m.xp = Math.max(0, Math.round(num(m.xp, 0)));
    m.xpNext = xpNeeded(m.level);

    const gain = Math.max(0, Math.round(num(amount, 0)));
    res.xpGained = gain;
    if (m.level >= MAX_LEVEL) { m.xp = 0; res.level = m.level; return res; }
    if (gain <= 0) { res.level = m.level; return res; }

    // Proportion de PV AVANT recalcul : c'est elle qu'on reporte.
    const ratio = m.maxHp > 0 ? clamp(num(m.hp, 0) / m.maxHp, 0, 1) : 1;

    m.xp += gain;
    while (m.level < MAX_LEVEL && m.xp >= m.xpNext) {
      m.xp -= m.xpNext;
      m.level++;
      res.leveled++;

      // Capacités apprises pile à ce niveau.
      for (let i = 0; i < learn.length; i++) {
        const e = learn[i];
        if (e.level !== m.level) continue;
        if (knowsMove(m, e.moveId)) continue;
        if (m.moves.length < 4) {
          m.moves.push(makeMoveSlot(e.moveId));
          res.learned.push(e.moveId);
        } else {
          res.pendingLearn.push({ moveId: e.moveId, level: m.level });
        }
      }
      m.xpNext = xpNeeded(m.level);
    }
    if (m.level >= MAX_LEVEL) { m.level = MAX_LEVEL; m.xp = 0; }
    m.xpNext = xpNeeded(m.level);

    if (res.leveled > 0) {
      recomputeStats(m, sp);
      // Debout avant, debout après : au moins 1 PV. K.O. avant : reste K.O.
      m.hp = (ratio > 0) ? clamp(Math.max(1, Math.round(m.maxHp * ratio)), 1, m.maxHp) : 0;
    }
    res.level = m.level;
    return res;
  }

  /**
   * XP gagnée en battant `defeatedMon`.
   *
   * Calibrage : ~3 combats contre une créature de son propre niveau pour monter
   * d'un niveau, du début à la fin du jeu (xpNeeded(L) ≈ 4L², on en donne le
   * tiers). Un légendaire vaut 2,5 fois plus : le battre doit être un événement,
   * et c'est ce qui permet les 3 niveaux d'un coup.
   *
   * @param {Mon|object} defeatedMon
   * @param {object} [opts] { trainer:true } — créature de dresseur : ×1.5
   *                        (extension hors contrat, facultative)
   */
  function xpFor(defeatedMon, opts) {
    if (!defeatedMon) return 0;
    const lvl = clamp(Math.round(num(defeatedMon.level, 5)), 1, MAX_LEVEL);
    let xp = 8 + lvl * lvl * 1.4;

    let legend = !!defeatedMon.legendary;
    if (!legend) {
      const sp = speciesOf(defeatedMon.id);
      legend = !!(sp && sp.legendary);
    }
    if (legend) xp *= 2.5;
    if (opts && opts.trainer) xp *= 1.5;
    return Math.max(1, Math.round(xp));
  }

  // ---------------------------------------------------------------------------
  //  CAPTURE
  // ---------------------------------------------------------------------------

  /**
   * Chance de capture, entre 0.03 et 0.97 (contrat §11).
   * Volontairement GÉNÉREUSE : un enfant de 10 ans ne doit pas rater dix fois
   * de suite. `ballBonus` : Pokéball 1.0 · Super Ball 1.5 · Hyper Ball 2.2 ·
   * Ball Maîtresse 99.
   */
  function catchChance(m, species, ballBonus) {
    const sp = species || (m ? speciesOf(m.id) : null) || fallbackSpecies('inconnu');
    const base = clamp(num(sp.catchRate, 0.5), 0.01, 1);
    const maxHp = m ? Math.max(1, num(m.maxHp, 1)) : 1;
    const hp = m ? clamp(num(m.hp, maxHp), 0, maxHp) : maxHp;
    const soin = 1 + (1 - hp / maxHp) * 1.6;   // affaiblie = bien plus facile
    const bonus = Math.max(0, num(ballBonus, 1));
    return clamp(base * soin * bonus, 0.03, 0.97);
  }

  // ---------------------------------------------------------------------------
  //  CONFORT POUR L'INTERFACE
  // ---------------------------------------------------------------------------

  /** Renomme un individu. Un surnom vide remet le nom de l'espèce. */
  function rename(uid, nick) {
    const m = mon(uid);
    if (!m) return false;
    const clean = (typeof nick === 'string') ? nick.trim().slice(0, 14) : '';
    m.nick = clean || (speciesOf(m.id).name || m.id);
    return true;
  }

  /**
   * Vue allégée de l'équipe, prête à afficher (écran ÉQUIPE, menu de combat).
   * On y met tout ce dont l'interface a besoin pour NE PAS avoir à interroger
   * `dex3d` elle-même à chaque frame.
   */
  function partySummary() {
    const act = active();
    return team.map(function (m, i) {
      const sp = speciesOf(m.id);
      return {
        index: i,
        uid: m.uid,
        id: m.id,
        name: sp.name || m.id,
        nick: m.nick || sp.name || m.id,
        level: m.level,
        hp: m.hp,
        maxHp: m.maxHp,
        hpRatio: m.maxHp > 0 ? clamp(m.hp / m.maxHp, 0, 1) : 0,
        xp: m.xp,
        xpNext: m.xpNext,
        xpRatio: m.xpNext > 0 ? clamp(m.xp / m.xpNext, 0, 1) : 0,
        types: m.types.slice(),
        color: sp.color || '#d896ff',
        legendary: !!sp.legendary,
        fainted: !isAlive(m),
        active: !!act && act.uid === m.uid,
        moves: m.moves.map(function (s) { return { id: s.id, pp: s.pp, ppMax: s.ppMax }; }),
      };
    });
  }

  // ---------------------------------------------------------------------------
  //  SAUVEGARDE  (§20 — champs `team` et `box`)
  //  Format stable et volontairement bavard : on préfère quelques octets de plus
  //  à une partie perdue. À la relecture, les statistiques sont RECALCULÉES
  //  depuis l'espèce et le niveau, pour qu'un rééquilibrage du jeu profite aux
  //  parties déjà commencées.
  // ---------------------------------------------------------------------------

  function packMon(m) {
    return {
      uid: m.uid,
      id: m.id,
      nick: m.nick,
      level: m.level,
      xp: m.xp,
      hp: m.hp,
      types: m.types.slice(),
      moves: m.moves.map(function (s) { return { id: s.id, pp: s.pp, ppMax: s.ppMax }; }),
      caughtAt: m.caughtAt || null,
    };
  }

  /**
   * Relit un individu. -> Mon, ou null si l'espèce n'existe plus (l'entrée est
   * alors simplement ignorée : mieux vaut perdre une créature que la partie).
   */
  function unpackMon(o) {
    if (!o || typeof o !== 'object') return null;
    const id = str(o.id || o.speciesId, null);
    if (!id) return null;

    // `dexKnows` renvoie null si dex3d est absent : dans ce cas on garde la
    // créature et on se repliera sur les valeurs enregistrées.
    if (dexKnows(id) === false) return null;

    const sp = speciesOf(id);
    const m = {
      uid: claimUid(o.uid),
      id: id,
      nick: str(o.nick, sp.name || id),
      level: clamp(Math.round(num(o.level, 5)), 1, MAX_LEVEL),
      xp: Math.max(0, Math.round(num(o.xp, 0))),
      xpNext: 0,
      hp: 0, maxHp: 1, atk: 1, def: 1, speed: 1,
      types: normTypes(o.types, normTypes(sp.types, ['plante'])),
      moves: [],
      caughtAt: (o.caughtAt && typeof o.caughtAt === 'object') ? {
        regionId: str(o.caughtAt.regionId, null),
        x: num(o.caughtAt.x, 0),
        y: num(o.caughtAt.y, 0),
      } : null,
    };
    recomputeStats(m, sp);
    if (m.xp >= m.xpNext && m.level >= MAX_LEVEL) m.xp = 0;

    // Capacités : on tolère aussi bien ['charge'] que [{id,pp,ppMax}].
    const raw = Array.isArray(o.moves) ? o.moves : [];
    for (let i = 0; i < raw.length && m.moves.length < 4; i++) {
      const e = raw[i];
      const mid = (typeof e === 'string') ? e : (e && str(e.id || e.moveId, null));
      if (!mid || knowsMove(m, mid)) continue;
      const ppMax = Math.max(1, Math.round(num(e && e.ppMax, ppOf(mid))));
      m.moves.push({ id: mid, pp: clamp(Math.round(num(e && e.pp, ppMax)), 0, ppMax), ppMax: ppMax });
    }
    if (!m.moves.length) m.moves = movesForLevel(sp, m.level);

    // PV : on borne, et une créature enregistrée sans PV du tout est considérée
    // en pleine forme (sauvegarde partielle d'une version antérieure).
    m.hp = clamp(Math.round(num(o.hp, m.maxHp)), 0, m.maxHp);
    return m;
  }

  function serialize() {
    return {
      team: team.map(packMon),
      box: box.map(packMon),
      activeIndex: activeIndex,
    };
  }

  /**
   * Recharge l'équipe. Tolérant à tout : `null`, objet vide, tableau nu
   * (interprété comme l'équipe), champs manquants, espèces disparues.
   * -> nombre de créatures effectivement restaurées.
   */
  function deserialize(o) {
    team.length = 0;
    box.length = 0;
    activeIndex = 0;
    // On repart d'un registre d'uid vierge : `deserialize` REMPLACE l'état
    // courant, donc les uid de l'état jeté ne sont plus réservés. Sans cette
    // remise à zéro, recharger une sauvegarde dans une session qui avait déjà
    // créé ces créatures renumérotait tout le monde — et les uid ne survivaient
    // pas à un aller-retour sauvegarde/chargement, alors que c'est justement ce
    // qu'on leur demande.
    for (const k in _usedUids) delete _usedUids[k];
    _uidSeq = 0;
    if (!o || typeof o !== 'object') return 0;

    const rawTeam = Array.isArray(o) ? o : (Array.isArray(o.team) ? o.team : []);
    const rawBox = (!Array.isArray(o) && Array.isArray(o.box)) ? o.box : [];

    for (let i = 0; i < rawTeam.length; i++) {
      const m = unpackMon(rawTeam[i]);
      if (!m) continue;
      if (team.length < MAX_TEAM) team.push(m); else box.push(m);
    }
    for (let i = 0; i < rawBox.length && box.length < MAX_BOX; i++) {
      const m = unpackMon(rawBox[i]);
      if (m) box.push(m);
    }

    const ai = Math.round(num(!Array.isArray(o) ? o.activeIndex : 0, 0));
    activeIndex = (ai >= 0 && ai < team.length) ? ai : 0;
    return team.length + box.length;
  }

  // ---------------------------------------------------------------------------
  //  REPRISE DE L'ANCIENNE PARTIE  (hors contrat, appelé UNE SEULE FOIS par
  //  game3d.js au tout premier lancement de la version 3D)
  // ---------------------------------------------------------------------------

  /**
   * Reconstruit une équipe de départ à partir de la sauvegarde du jeu 2D
   * (clé `robinGame_v2`). Robin a déjà joué : il ne doit pas repartir de zéro.
   *
   *   • le starter au niveau 5, avec ses PV reportés (l'ancien max était 40) ;
   *   • jusqu'à 5 créatures de sa collection dans l'équipe, à des niveaux
   *     plausibles — un peu plus bas que le starter, un peu plus haut s'il avait
   *     déjà battu des dresseurs ;
   *   • tout le reste (doublons compris) part à la boîte.
   *
   * @param {object} save2d {playerName, starterId, starterHp, collection,
   *                         defeatedTrainers, tileX, tileY}
   * @returns {{team:number, box:number, names:string[]}}
   */
  function importFromV2(save2d) {
    const report = { team: 0, box: 0, names: [] };
    if (!save2d || typeof save2d !== 'object') return report;

    try {
      const collection = (save2d.collection && typeof save2d.collection === 'object') ? save2d.collection : {};
      const defeated = (save2d.defeatedTrainers && typeof save2d.defeatedTrainers === 'object') ? save2d.defeatedTrainers : {};
      const nbDefeated = Object.keys(defeated).length;
      const caughtAt = {
        regionId: 'val',
        x: num(save2d.tileX, 24),
        y: num(save2d.tileY, 30),
      };

      // Niveau « plausible » des compagnons : 3 au départ, +1 par dresseur battu,
      // plafonné à 9 pour que le Val d'Émeraude reste un début de partie.
      const baseLevel = clamp(3 + nbDefeated, 3, 9);

      // 1) Le starter, niveau 5 (le contrat de la mission le fixe explicitement).
      const starterId = str(save2d.starterId, null);
      if (starterId) {
        const s = create(starterId, 5, { caughtAt: caughtAt });
        // PV reportés : l'ancien starter avait 40 PV max.
        const oldHp = num(save2d.starterHp, 40);
        const ratio = clamp(oldHp / 40, 0, 1);
        s.hp = clamp(Math.max(1, Math.round(s.maxHp * (ratio > 0 ? ratio : 1))), 1, s.maxHp);
        add(s);
        report.names.push(s.nick);
      }

      // 2) La collection, dans l'ordre de la sauvegarde, doublons compris.
      const ids = Object.keys(collection);
      let slot = 0;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (id === starterId) continue;
        if (dexKnows(id) === false) continue;          // espèce disparue : on saute
        const count = clamp(Math.round(num(collection[id], 1)), 0, 9);
        for (let k = 0; k < count; k++) {
          // Variation ±1 pour que l'équipe ne soit pas un bloc uniforme.
          const lvl = clamp(baseLevel + (slot % 3) - 1, 2, MAX_LEVEL);
          const m = create(id, lvl, { caughtAt: caughtAt });
          const where = add(m);
          if (where === 'team') report.names.push(m.nick);
          slot++;
          if (team.length + box.length >= MAX_BOX) break;
        }
        if (team.length + box.length >= MAX_BOX) break;
      }

      // 3) Aucune créature reprise (sauvegarde vide) : on ne fabrique rien,
      //    game3d.js montrera l'écran de choix du starter.
      activeIndex = 0;
    } catch (e) {
      // Une vieille sauvegarde exotique ne doit jamais empêcher de jouer.
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[team3d] import de la sauvegarde 2D impossible :', e);
      }
    }

    report.team = team.length;
    report.box = box.length;
    return report;
  }

  // ---------------------------------------------------------------------------
  //  API — signature exacte du contrat §11, plus les extensions documentées.
  // ---------------------------------------------------------------------------

  const API = {
    MAX_TEAM: MAX_TEAM,
    MAX_LEVEL: MAX_LEVEL,
    team: team,
    box: box,

    create: create,
    add: add,
    remove: remove,
    swap: swap,
    toTeam: toTeam,
    toBox: toBox,

    active: active,
    setActive: setActive,
    alive: alive,
    allFainted: allFainted,
    healAll: healAll,
    damage: damage,
    heal: heal,

    gainXp: gainXp,
    xpFor: xpFor,
    catchChance: catchChance,

    serialize: serialize,
    deserialize: deserialize,

    // --- extensions (hors contrat, réclamées par l'interface) ---
    mon: mon,
    rename: rename,
    restorePP: restorePP,
    spendPP: spendPP,
    partySummary: partySummary,
    importFromV2: importFromV2,
    speciesOf: speciesOf,
    xpNeeded: xpNeeded,
    recomputeStats: recomputeStats,
    get activeIndex() { return activeIndex; },
  };

  R3ref.register('team', API);

  // Confort de débogage dans la console du navigateur.
  if (typeof window !== 'undefined') window.TEAM3D = API;
})();
