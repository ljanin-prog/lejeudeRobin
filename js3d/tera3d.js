// =============================================================================
//  tera3d.js — LA TÉRACRISTALLISATION            (CONTRAT v3 §7 — demande n° 10)
// =============================================================================
//  « Une académie pour apprendre la Terracristallisation — pouvoir activer le
//    mode cristal sur mon Pokémon. »   — Robin, 10 ans
//
//  CE QUE FAIT CE FICHIER
//  ----------------------
//  1. La RÈGLE DU JEU : une seule cristallisation par combat, sur une seule
//     créature, rechargée au Centre Pokémon. La créature prend son type Téra
//     (en défense ET en STAB), ses attaques de ce type passent à ×1.5, et elle
//     gagne +20 % de défense jusqu'à la fin du combat.
//  2. LE SPECTACLE : une couronne de cristal facettée qui flotte au-dessus de sa
//     tête, et un éclat de cristaux qui jaillit à l'activation. C'est censé être
//     le plus beau moment du jeu, alors il est mis en scène en TROIS ACTES,
//     comme les capacités du §25 de v2 : l'appel, la frappe, la révélation.
//
//  POURQUOI DES `InstancedMesh`
//  ----------------------------
//  Une couronne, c'est huit cristaux ; un éclat, c'est vingt éclats plus une
//  poussière d'étincelles. En meshes séparés, cela ferait ~45 draw calls à lui
//  tout seul — un tiers du budget global du jeu, pour un effet qui dure deux
//  secondes. `THREE.InstancedMesh` dessine les huit cristaux de la couronne en
//  UN SEUL draw call tout en laissant animer chaque cristal individuellement
//  (une matrice par instance). D'où :
//
//      couronne  = 4 draw calls   (anneau · cristaux · cœur · halo)
//      éclat     = 6 draw calls   (coque · flash · onde · colonne · éclats ·
//                                  étincelles)
//      géode     = 5 draw calls   (llib.crystalCluster, transitoire ~1,3 s)
//      ------------------------------------------------------------------
//      PIC MESURÉ = 15 draw calls,  RÉGIME PERMANENT = 4  (voir drawCalls())
//
//  Repli : si `THREE.InstancedMesh` manque (three antérieur à r109), on retombe
//  sur `R3.get('llib').crystalCluster()` s'il est là, puis sur des cônes
//  `R3.mat()` tout simples — avec moins de pointes et moins d'éclats, et sans
//  géode, pour rester sous les 20 (mesuré : 20 avec llib, 19 sans). Le jeu ne
//  casse jamais, il devient seulement un peu moins somptueux.
//
//  DEUX PIÈGES QUI ONT DICTÉ LE CODE
//  ---------------------------------
//  1) ON N'ANIME JAMAIS UN MATÉRIAU. Ceux de `R3.mat()` sont PARTAGÉS : faire
//     baisser `material.opacity` pour éteindre le flash éteindrait du même coup
//     toutes les auras de la même teinte. Toutes les apparitions et disparitions
//     d'ici passent donc par des `scale` (et `visible`), jamais par la couleur.
//  2) UN `InstancedMesh` GARDE LA SPHÈRE ENGLOBANTE DE SA GÉOMÉTRIE DE BASE,
//     centrée en (0,0,0). Dès qu'on écarte les instances, le moteur croit
//     l'objet hors champ et le fait purement disparaître. D'où
//     `frustumCulled = false` partout ici : ces objets sont minuscules et peu
//     nombreux, le culling ne rapportait rien de toute façon.
//
//  MUTATION DE `mon` — CE QUI EST TOUCHÉ, ET COMMENT ON LE REND
//  ------------------------------------------------------------
//  `activate()` écrit sur la créature :  `mon.tera = true`, `mon.teraType`,
//  `mon.types = [typeTéra]` (c'est ce qui lui donne la défense du type Téra sans
//  toucher à `moves3d.js`) et `mon.def ×= 1.2`.
//  `deactivate()` rend TOUT à l'identique. `team3d.packMon()` ne sauvegarde ni
//  `def` (recalculé au chargement) ni `teraType` — d'où le `serialize()` d'ici,
//  qui garde aussi les types d'origine des créatures cristallisées : si la
//  partie était sauvegardée en plein combat, `deserialize()` répare.
//
//  Aucune dépendance obligatoire : `types3d`, `llib`, `team3d` et `THREE` sont
//  tous facultatifs. Le module se charge sans exception même seul au monde.
// =============================================================================

(function () {
  'use strict';

  const HAS_THREE = (typeof THREE !== 'undefined' && !!THREE);
  const HAS_R3 = (typeof R3 !== 'undefined' && !!R3 && typeof R3.register === 'function');

  // ===========================================================================
  //  0. Petits utilitaires tolérants
  // ===========================================================================

  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function clampf(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function nameOf(mon) {
    if (!mon) return 'Ta créature';
    return mon.nick || mon.name || mon.id || 'Ta créature';
  }
  /** Accès tolérant à un module : jamais d'exception, jamais de plantage. */
  function mod(name) {
    try { return HAS_R3 ? R3.get(name) : undefined; } catch (e) { return undefined; }
  }
  /** Horloge de référence. On anime sur R3.clock.t (secondes de JEU) : quand le
   *  jeu se met en pause, l'effet se fige au lieu de se dérouler dans le vide. */
  function now() {
    if (HAS_R3 && R3.clock && typeof R3.clock.t === 'number') return R3.clock.t;
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now() / 1000 : Date.now() / 1000;
  }

  // ===========================================================================
  //  1. LES 18 TYPES — table de repli
  // ===========================================================================
  //  `types3d.js` passe à 18 types en ce moment même (§2 de v3). On code contre
  //  la table CIBLE, pas contre celle qui est chargée : tant que l'autre lot n'a
  //  pas atterri, `R3.get('types')` ne connaît que 12 ids et renverrait la
  //  couleur « neutre » grise pour Dragon ou Fée — ce qui donnerait une couronne
  //  grise, exactement le contraire de l'effet recherché. On garde donc ici une
  //  copie de secours des 18 entrées, utilisée UNIQUEMENT pour les types que
  //  types3d ne connaît pas encore.
  // ---------------------------------------------------------------------------

  const FALLBACK_TYPES = {
    feu:        { label: 'Feu',        color: '#ff6b3d', icon: '🔥' },
    eau:        { label: 'Eau',        color: '#41a6f6', icon: '💧' },
    plante:     { label: 'Plante',     color: '#38b764', icon: '🌿' },
    electrique: { label: 'Électrique', color: '#f1c40f', icon: '⚡' },
    glace:      { label: 'Glace',      color: '#a8e6ff', icon: '❄️' },
    air:        { label: 'Air',        color: '#bfe3f2', icon: '💨' },
    terre:      { label: 'Terre',      color: '#c08c4a', icon: '🍂' },
    roche:      { label: 'Roche',      color: '#9aa0a6', icon: '🪨' },
    lumiere:    { label: 'Lumière',    color: '#ffe066', icon: '✨' },
    spectre:    { label: 'Spectre',    color: '#7a5cbf', icon: '👻' },
    temps:      { label: 'Temps',      color: '#d896ff', icon: '⏳' },
    espace:     { label: 'Espace',     color: '#4b62d9', icon: '🌌' },
    psy:        { label: 'Psy',        color: '#ff6b9d', icon: '🔮' },
    fee:        { label: 'Fée',        color: '#ffb3d9', icon: '🧚' },
    acier:      { label: 'Acier',      color: '#b8c4d0', icon: '⚙️' },
    dragon:     { label: 'Dragon',     color: '#6a4fd8', icon: '🐉' },
    poison:     { label: 'Poison',     color: '#b45cd8', icon: '☠️' },
    combat:     { label: 'Combat',     color: '#e8622c', icon: '🥊' },
    normal:     { label: 'Normal',     color: '#d8d0c4', icon: '◻️' },
  };

  // L'ordre EXACT du §2.2 de v3 : c'est l'ordre d'affichage du sélecteur de
  // l'Académie. (19 entrées dans la table ci-dessus, 19 ici : le tableau du
  // contrat liste bien 19 lignes, `normal` compris.)
  const ORDER = ['feu', 'eau', 'plante', 'electrique', 'glace', 'air',
    'terre', 'roche', 'lumiere', 'spectre', 'temps', 'espace',
    'psy', 'fee', 'acier', 'dragon', 'poison', 'combat', 'normal'];

  // Renommages du §2.1. Les sauvegardes, `dex3d` et `moves3d` contiennent encore
  // les anciens ids : on les normalise à l'entrée de tout.
  const ALIAS = { foudre: 'electrique', ombre: 'spectre' };

  const DEFAULT_TYPE = 'lumiere';   // dernier repli, jamais gris

  function typesApi() { return mod('types'); }

  /** Normalise un id de type (alias v2 -> v3). Délègue à types3d s'il sait le
   *  faire, sinon applique la table d'alias locale. */
  function normType(id) {
    if (!id || typeof id !== 'string') return null;
    const T = typesApi();
    if (T && typeof T.normalize === 'function') {
      try {
        const n = T.normalize(id);
        if (n && typeof n === 'string') return n;
      } catch (e) { /* on continue avec le repli */ }
    }
    return ALIAS[id] || id;
  }

  /** Vrai si types3d connaît réellement ce type (et pas juste son « neutre »). */
  function typesKnows(id) {
    const T = typesApi();
    return !!(T && T.TYPES && T.TYPES[id]);
  }

  function typeInfo(id) {
    const n = normType(id) || DEFAULT_TYPE;
    const T = typesApi();
    if (typesKnows(n)) {
      const t = T.TYPES[n];
      return {
        id: n,
        label: t.label || (FALLBACK_TYPES[n] && FALLBACK_TYPES[n].label) || n,
        color: t.color || (FALLBACK_TYPES[n] && FALLBACK_TYPES[n].color) || '#ffe066',
        icon: t.icon || (FALLBACK_TYPES[n] && FALLBACK_TYPES[n].icon) || '💎',
      };
    }
    const f = FALLBACK_TYPES[n] || FALLBACK_TYPES[DEFAULT_TYPE];
    return { id: n, label: f.label, color: f.color, icon: f.icon };
  }

  function typeColor(id) { return typeInfo(id).color; }

  /**
   * Les types proposés à l'Académie, dans l'ordre d'affichage du jeu.
   * On suit `types3d.ORDER` dès qu'il est complet : c'est LUI la source de
   * vérité (le tableau du §2.2 en liste 19 lignes alors que le titre en annonce
   * 18 — plutôt que d'arbitrer, on s'aligne sur ce que le lot Types a livré).
   * Tant qu'il n'a pas atterri, on se rabat sur l'ordre écrit ici.
   */
  function typeChoices() {
    const T = typesApi();
    let list = ORDER;
    if (T && Array.isArray(T.ORDER) && T.ORDER.length >= 18) list = T.ORDER;
    const out = [];
    const vus = Object.create(null);
    for (let i = 0; i < list.length; i++) {
      const id = normType(list[i]);
      if (!id || vus[id]) continue;
      vus[id] = true;
      out.push(typeInfo(id));
    }
    return out;
  }

  // ===========================================================================
  //  2. ÉTAT DU MODULE
  // ===========================================================================
  //  Tout est indexé par `uid` de créature, jamais par référence : les Mon sont
  //  reconstruits à chaque chargement de partie, les uid, eux, survivent.
  // ---------------------------------------------------------------------------

  const state = {
    unlocked: false,      // l'Académie a-t-elle formé le joueur ?
    charged: true,        // la cristallisation est-elle prête ? (rechargée au Centre)
    types: Object.create(null),   // uid -> typeId choisi à l'Académie
    changed: Object.create(null), // uid -> true : déjà changé pendant CETTE visite
    usedIn: null,         // référence de l'objet `battle` où l'on a cristallisé
  };

  // Créatures actuellement cristallisées : uid -> { mon, types, def }
  // (`types` et `def` sont les valeurs D'ORIGINE, à rendre en fin de combat.)
  const ACTIVE = Object.create(null);

  function uidOf(mon) {
    if (!mon) return null;
    if (mon.uid) return mon.uid;
    // Une créature sauvage n'a pas toujours d'uid : on lui en donne un, sinon
    // elle ne pourrait jamais être désactivée proprement.
    if (mon.id) { mon.uid = 'tera-' + mon.id + '-' + Math.floor(Math.random() * 1e9); return mon.uid; }
    return null;
  }

  // ===========================================================================
  //  3. RÈGLES DU JEU
  // ===========================================================================

  function isUnlocked() { return !!state.unlocked; }

  /** Appelé par l'Académie quand le joueur a suivi la formation. */
  function unlock() {
    state.unlocked = true;
    state.charged = true;
    return true;
  }

  /** Extension : refermer l'accès (nouvelle partie). */
  function lock() {
    state.unlocked = false;
    deactivateAll();
  }

  /** Le type Téra de CET individu. Par défaut : son premier type. */
  function teraTypeOf(mon) {
    if (!mon) return DEFAULT_TYPE;
    const uid = uidOf(mon);
    let t = uid ? state.types[uid] : null;
    if (!t && typeof mon.teraType === 'string') t = normType(mon.teraType);
    if (!t) {
      // Repli : le premier type de la créature. On regarde `types` d'origine si
      // elle est déjà cristallisée (sinon on lirait le type Téra lui-même).
      const rec = uid ? ACTIVE[uid] : null;
      const list = (rec && rec.types) || (Array.isArray(mon.types) ? mon.types : []);
      t = normType(list[0]) || DEFAULT_TYPE;
    }
    if (!FALLBACK_TYPES[t] && !typesKnows(t)) t = DEFAULT_TYPE;
    // On le pose sur la créature : le HUD le lit directement, et il part dans la
    // sauvegarde d'ici (team3d.packMon() ne recopie pas ce champ).
    mon.teraType = t;
    if (uid) state.types[uid] = t;
    return t;
  }

  /** Le type Téra « naturel », avant tout choix à l'Académie. */
  function defaultTeraTypeOf(mon) {
    const uid = mon ? uidOf(mon) : null;
    const rec = uid ? ACTIVE[uid] : null;
    const list = (rec && rec.types) || ((mon && Array.isArray(mon.types)) ? mon.types : []);
    return normType(list[0]) || DEFAULT_TYPE;
  }

  /** Une seule modification par créature et par visite à l'Académie. */
  function canSetTeraType(mon) {
    const uid = mon ? uidOf(mon) : null;
    if (!uid) return false;
    return !state.changed[uid];
  }

  /**
   * Choix du type Téra à l'Académie.
   * -> { ok, typeId, message }
   */
  function setTeraType(mon, typeId) {
    const t = normType(typeId);
    if (!mon || !t || (!FALLBACK_TYPES[t] && !typesKnows(t))) {
      return { ok: false, typeId: teraTypeOf(mon), message: "Ce type-là n'existe pas." };
    }
    const uid = uidOf(mon);
    if (!uid) return { ok: false, typeId: t, message: "Cette créature ne peut pas être formée." };
    if (state.changed[uid]) {
      return {
        ok: false, typeId: teraTypeOf(mon),
        message: nameOf(mon) + ' a déjà changé de type Téra aujourd’hui. Reviens la prochaine fois !',
      };
    }
    state.types[uid] = t;
    state.changed[uid] = true;
    mon.teraType = t;
    // Si elle est cristallisée à l'instant même, on lui applique tout de suite
    // son nouveau type (cas de figure improbable, mais l'incohérence se verrait).
    const rec = ACTIVE[uid];
    if (rec) mon.types = [t];
    const info = typeInfo(t);
    return {
      ok: true, typeId: t,
      message: 'Le type Téra de ' + nameOf(mon) + ' devient ' + info.icon + ' ' + info.label + ' !',
    };
  }

  /** Nouvelle visite à l'Académie : chacun peut de nouveau changer une fois. */
  function beginAcademyVisit() {
    state.changed = Object.create(null);
  }

  /** La cristallisation est-elle disponible pour CE combat ? */
  function canUse(battle) {
    if (!state.unlocked) return false;
    if (!state.charged) return false;
    // Garde-fou : même rechargée par erreur en plein combat, on ne cristallise
    // pas deux fois dans la même bataille.
    if (battle && state.usedIn === battle) return false;
    return true;
  }

  /** Petit texte d'état pour griser le bouton Téra avec une explication. */
  function statusText(battle) {
    if (!state.unlocked) return "Va d'abord à l'Académie pour apprendre la Téracristallisation !";
    if (!canUse(battle)) return 'La Téracristallisation se rechargera au Centre Pokémon.';
    return 'Prêt à cristalliser !';
  }

  function isCharged() { return !!state.charged; }
  function isActive(mon) {
    const uid = mon ? uidOf(mon) : null;
    return !!(uid && ACTIVE[uid]);
  }
  /** -> le Mon actuellement cristallisé, ou null. */
  function activeMon() {
    for (const uid in ACTIVE) { if (ACTIVE[uid]) return ACTIVE[uid].mon; }
    return null;
  }

  /**
   * LA CRISTALLISATION. MUTE la créature.
   * -> { ok, typeId, message }
   */
  function activate(mon, battle) {
    if (!mon) return { ok: false, typeId: null, message: 'Personne à cristalliser.' };
    if (!state.unlocked) {
      return { ok: false, typeId: teraTypeOf(mon), message: statusText(battle) };
    }
    if (!canUse(battle)) {
      return { ok: false, typeId: teraTypeOf(mon), message: statusText(battle) };
    }
    const uid = uidOf(mon);
    if (uid && ACTIVE[uid]) {
      return { ok: false, typeId: teraTypeOf(mon), message: nameOf(mon) + ' brille déjà de mille cristaux !' };
    }
    // Une seule créature cristallisée à la fois : si une autre l'était encore
    // (combat précédent mal refermé), on la rend d'abord à son état normal.
    deactivateAll();

    const t = teraTypeOf(mon);
    const info = typeInfo(t);

    ACTIVE[uid] = {
      mon: mon,
      types: Array.isArray(mon.types) ? mon.types.slice() : [],
      def: num(mon.def, null),
    };

    mon.tera = true;
    mon.teraType = t;
    // La créature PREND le type Téra : c'est cette ligne qui lui donne la
    // défense du type Téra sans que `moves3d.damage()` ait à connaître ce
    // module. Le STAB suit tout seul (et `bonus()` corrige le compte, plus bas).
    mon.types = [t];
    if (typeof mon.def === 'number' && mon.def > 0) {
      mon.def = Math.max(1, Math.round(mon.def * 1.2));
    }

    state.charged = false;
    state.usedIn = battle || null;

    return {
      ok: true, typeId: t,
      message: nameOf(mon) + ' se téracristallise ! Son type Téra ' + info.icon + ' ' + info.label + ' s’éveille !',
    };
  }

  /** Fin de combat : on rend la créature à son état d'origine. */
  function deactivate(mon) {
    if (!mon) return false;
    const uid = uidOf(mon);
    const rec = uid ? ACTIVE[uid] : null;
    mon.tera = false;
    if (!rec) return false;
    if (rec.types && rec.types.length) mon.types = rec.types.slice();
    if (rec.def !== null && rec.def !== undefined) mon.def = rec.def;
    delete ACTIVE[uid];
    return true;
  }

  /** Extension : tout rendre d'un coup (fin de combat, fuite, K.O., chargement). */
  function deactivateAll() {
    for (const uid in ACTIVE) {
      const rec = ACTIVE[uid];
      if (rec && rec.mon) deactivate(rec.mon);
      else delete ACTIVE[uid];
    }
  }

  /**
   * Multiplicateur de dégâts à appliquer EN PLUS de ce que `moves3d.damage()`
   * a déjà calculé.
   *
   * POURQUOI CE CALCUL A L'AIR BIZARRE
   * ----------------------------------
   * `moves3d.damage()` applique un STAB de ×1.25 quand le type de l'attaque
   * figure dans `mon.types`. Or, pendant la cristallisation, `mon.types` vaut
   * `[typeTéra]`. Donc :
   *   · attaque du type Téra    -> moves3d a mis ×1.25, on veut ×1.5  -> ×1.2
   *   · attaque d'un type D'ORIGINE (perdu le temps du combat)
   *                             -> moves3d a mis ×1,    on veut ×1.25 -> ×1.25
   *     (on lui REND son STAB d'origine : perdre ses attaques habituelles en se
   *      cristallisant serait une punition, et ce jeu n'en inflige pas.)
   *   · le reste                -> ×1
   */
  function bonus(mon, move) {
    if (!mon || !mon.tera) return 1;
    const uid = uidOf(mon);
    const rec = uid ? ACTIVE[uid] : null;
    if (!rec) return 1;                       // drapeau orphelin : on ne bonifie rien

    let mt = null;
    if (typeof move === 'string') mt = normType(move);
    else if (move && typeof move.type === 'string') mt = normType(move.type);
    if (!mt) return 1;

    const t = teraTypeOf(mon);
    if (mt === t) return 1.2;                 // 1.25 × 1.2 = 1.5 tout rond
    if (rec.types && rec.types.length) {
      for (let i = 0; i < rec.types.length; i++) {
        if (normType(rec.types[i]) === mt) return 1.25;
      }
    }
    return 1;
  }

  /** Rechargement au Centre Pokémon (ou après un repos). */
  function reset() {
    state.charged = true;
    state.usedIn = null;
    // Une nuit de repos, c'est aussi une nouvelle chance de changer de type
    // Téra à l'Académie : plus généreux, et personne ne peut se retrouver bloqué.
    state.changed = Object.create(null);
    deactivateAll();
    return true;
  }

  // ===========================================================================
  //  4. SAUVEGARDE
  // ===========================================================================
  //  §12 de v3 prévoit `tera: { unlocked: false }`. On garde ce champ tel quel et
  //  on en ajoute d'autres — un ancien fichier se relit sans perte, un nouveau
  //  se relit par une version qui ne connaîtrait que `unlocked` aussi.
  // ---------------------------------------------------------------------------

  function serialize() {
    const base = Object.create(null);
    const activeUids = [];
    for (const uid in ACTIVE) {
      const rec = ACTIVE[uid];
      if (!rec) continue;
      activeUids.push(uid);
      base[uid] = (rec.types || []).slice();
    }
    return {
      unlocked: !!state.unlocked,
      charged: !!state.charged,
      types: Object.assign({}, state.types),
      // Filet de sécurité : si la partie est sauvegardée EN PLEIN COMBAT, la
      // créature a `types = [typeTéra]` et `team3d` recopie ce tableau tel quel.
      // On garde ses vrais types ici pour pouvoir réparer au chargement.
      active: activeUids,
      base: base,
    };
  }

  function deserialize(o) {
    deactivateAll();
    state.types = Object.create(null);
    state.changed = Object.create(null);
    state.usedIn = null;
    if (!o || typeof o !== 'object') {
      state.unlocked = false;
      state.charged = true;
      return;
    }
    state.unlocked = !!o.unlocked;
    state.charged = (o.charged === undefined) ? true : !!o.charged;
    if (o.types && typeof o.types === 'object') {
      for (const uid in o.types) {
        const t = normType(o.types[uid]);
        if (t) state.types[uid] = t;
      }
    }
    repair(o.base);
  }

  /**
   * Répare les créatures sauvegardées en pleine cristallisation : on leur rend
   * leurs types d'origine et on éteint le drapeau. Une partie de Robin ne se
   * perd jamais, et surtout : une créature ne reste jamais coincée mono-type.
   *
   * ON NE PEUT PAS SE FIER À `m.tera` : `team3d.packMon()` n'enregistre pas ce
   * drapeau (uniquement uid, id, nick, level, xp, hp, types, moves, caughtAt).
   * Après un rechargement il vaut donc toujours `undefined`, et le filet ne
   * s'exécutait jamais — la créature gardait `types = [typeTéra]` à vie, avec
   * les faiblesses de ce seul type. C'est arrivable pour de bon : `saveGame()`
   * est appelé AVANT `endBattle()` dans `onCaughtInBattle`, `onTrainerDefeated`
   * et `onPlayerFainted`, et il suffit de fermer l'onglet sur l'un de ces
   * messages.
   *
   * La bonne source, c'est `base` : `serialize()` y a rangé les vrais types de
   * chaque créature cristallisée, précisément pour ce cas. Une entrée dans
   * `base` VAUT le drapeau, et suffit à déclencher la réparation.
   *
   * Il n'y a que `types` à réparer : le +20 % de défense d'`activate()` se
   * dissout tout seul, `team3d.unpackMon()` recalculant `def` depuis l'espèce
   * et le niveau.
   */
  function repair(base) {
    const team = mod('team');
    if (!team) return;
    const lists = [];
    if (Array.isArray(team.team)) lists.push(team.team);
    if (Array.isArray(team.box)) lists.push(team.box);
    for (let l = 0; l < lists.length; l++) {
      const list = lists[l];
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (!m) continue;
        // TOUJOURS avant le `continue` : le type Téra choisi à l'Académie
        // appartient aussi aux créatures qui n'ont jamais cristallisé.
        if (state.types[m.uid]) m.teraType = state.types[m.uid];
        const saved = base && base[m.uid];
        if (!m.tera && !saved) continue;
        m.tera = false;
        if (Array.isArray(saved) && saved.length) m.types = saved.slice();
      }
    }
  }

  // ===========================================================================
  //  5. LE SPECTACLE — matériaux
  // ===========================================================================

  /** Cristal facetté, opaque et légèrement lumineux : la matière de la couronne. */
  function crystalMat(color) {
    return R3.mat(color, {
      flat: true, rough: 0.18, metal: 0.12,
      emissive: color, emissiveIntensity: 0.55,
    });
  }

  /** Verre coloré : coques, onde de choc, colonne de lumière.
   *  `depthWrite: false` sinon ces surfaces creusent des trous dans la créature
   *  qu'elles entourent. */
  function glassMat(color, opacity) {
    return R3.mat(color, {
      transparent: true, opacity: Math.round(clampf(opacity, 0.05, 1) * 100) / 100,
      rough: 0.15, emissive: color, emissiveIntensity: 1.15,
      side: HAS_THREE ? THREE.DoubleSide : undefined, depthWrite: false,
    });
  }

  /** Blanc de flash — la seule couleur qui ne dépend pas du type. */
  function flashMat() {
    return R3.mat('#ffffff', {
      transparent: true, opacity: 0.85, rough: 0.1,
      emissive: '#ffffff', emissiveIntensity: 2.2, depthWrite: false,
    });
  }

  // --- outils InstancedMesh --------------------------------------------------

  const HAS_INSTANCED = HAS_THREE && typeof THREE.InstancedMesh === 'function';

  // Objets de travail réutilisés : AUCUNE allocation dans la boucle de rendu.
  const _m4 = HAS_THREE ? new THREE.Matrix4() : null;
  const _q = HAS_THREE ? new THREE.Quaternion() : null;
  const _e = HAS_THREE ? new THREE.Euler() : null;
  const _p = HAS_THREE ? new THREE.Vector3() : null;
  const _s = HAS_THREE ? new THREE.Vector3() : null;

  function instanced(geometry, material, count) {
    const im = new THREE.InstancedMesh(geometry, material, count);
    if (im.instanceMatrix && im.instanceMatrix.setUsage && THREE.DynamicDrawUsage !== undefined) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    im.castShadow = false;
    im.receiveShadow = false;
    // Voir le piège n° 2 du bandeau : sans ceci, l'objet disparaît dès que les
    // instances s'écartent de l'origine.
    im.frustumCulled = false;
    return im;
  }

  function setInstance(im, i, px, py, pz, rx, ry, rz, sx, sy, sz) {
    _p.set(px, py, pz);
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _s.set(sx, sy, sz);
    _m4.compose(_p, _q, _s);
    im.setMatrixAt(i, _m4);
  }

  // ===========================================================================
  //  6. LA COURONNE DE CRISTAL
  // ===========================================================================
  //  Ancrage : origine AU CENTRE de la couronne. `attach()` la pose à la bonne
  //  hauteur au-dessus du modèle ; posée telle quelle, elle s'installe à y = 0.
  //
  //  Coût : 4 draw calls (anneau · cristaux instanciés · cœur · halo).
  //  Repli sans InstancedMesh : llib.crystalCluster (n+2), puis cônes simples.
  // ---------------------------------------------------------------------------

  const CROWN_SPIKES = 8;
  const CROWN_R = 0.30;

  function crown(mon, opts) {
    if (!HAS_THREE || !HAS_R3) return null;
    const o = opts || {};
    const t = mon ? teraTypeOf(mon) : (o.typeId || DEFAULT_TYPE);
    const col = o.color || typeColor(t);
    const scale = num(o.scale, 1);

    const g = new THREE.Group();
    const d = { kind: 'crown', color: col, born: now(), spikes: null, ring: null, core: null, halo: null };

    // --- 1. L'anneau porteur : un tore couché à plat, facetté ----------------
    const ring = new THREE.Mesh(R3.geo.torus(CROWN_R, 0.030, 16), crystalMat(col));
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = false; ring.receiveShadow = false;
    g.add(ring);
    d.ring = ring;

    // --- 2. Les huit pointes de cristal --------------------------------------
    // Cône à 5 côtés : c'est le nombre de facettes qui donne le « taillé »
    // sans montrer d'arête franchement plate de face.
    const spikeGeo = R3.geo.cone(0.062, 0.30, 5);
    const spikeMat = crystalMat(col);
    if (HAS_INSTANCED) {
      const im = instanced(spikeGeo, spikeMat, CROWN_SPIKES);
      g.add(im);
      d.spikes = { im: im, n: CROWN_SPIKES };
      layoutCrownSpikes(d, 0);
    } else {
      // Repli 1 : la grappe de la bibliothèque des légendaires. Cinq pointes et
      // pas huit : sans instanciation chaque pointe coûte un draw call, et le
      // budget de 20 prime sur la richesse de la couronne.
      const LL = mod('llib');
      if (LL && typeof LL.crystalCluster === 'function') {
        const cl = LL.crystalCluster(col, 5, 0.26, { base: false, glow: false, opacity: 1, spread: 1.6 });
        if (cl) { g.add(cl); d.cluster = cl; }
      } else {
        // Repli 2 : cinq cônes tout simples, mais toujours des R3.mat().
        const list = [];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const m = new THREE.Mesh(spikeGeo, spikeMat);
          m.position.set(Math.cos(a) * CROWN_R, 0.15, Math.sin(a) * CROWN_R);
          m.castShadow = false;
          list.push(m);
          g.add(m);
        }
        d.simple = list;
      }
    }

    // --- 3. Le cœur : une petite lueur au centre de la couronne ---------------
    const core = new THREE.Mesh(R3.geo.sphere(0.11, 10), glassMat(col, 0.45));
    core.castShadow = false; core.receiveShadow = false;
    core.renderOrder = 2;
    g.add(core);
    d.core = core;

    // --- 4. Le halo : un anneau fin, incliné, qui tourne à l'envers -----------
    // Deux rotations en sens contraire : l'œil lit « ça tourne » beaucoup plus
    // vite qu'avec un seul mouvement, pour un seul mesh de plus.
    const halo = new THREE.Mesh(R3.geo.torus(0.46, 0.010, 20), glassMat(col, 0.55));
    halo.rotation.x = Math.PI / 2 - 0.42;
    halo.castShadow = false; halo.receiveShadow = false;
    g.add(halo);
    d.halo = halo;

    g.userData.tera = d;
    g.userData.teraScale = scale;
    // Naissance : la couronne se pose en 0,55 s, en tournant. On part de zéro.
    g.scale.setScalar(0.001);

    register(g);
    return g;
  }

  /** Dispose (ou anime) les huit pointes. `t` = temps écoulé, pour la respiration. */
  function layoutCrownSpikes(d, t) {
    const sp = d.spikes;
    if (!sp) return;
    for (let i = 0; i < sp.n; i++) {
      const a = (i / sp.n) * Math.PI * 2;
      // Une vraie couronne alterne grandes et petites pointes.
      const grande = (i % 2 === 0);
      const h = grande ? 1 : 0.62;
      // Respiration minérale : très légère, sinon le cristal a l'air en mousse.
      const resp = 1 + Math.sin(t * 2.1 + i * 0.8) * 0.06;
      const px = Math.cos(a) * CROWN_R;
      const pz = Math.sin(a) * CROWN_R;
      setInstance(sp.im, i,
        px, 0.15 * h * resp, pz,
        // Les pointes s'écartent du centre : une gerbe, pas une palissade.
        Math.sin(a) * 0.16, 0, -Math.cos(a) * 0.16,
        1, h * resp, 1);
    }
    sp.im.instanceMatrix.needsUpdate = true;
  }

  function animCrown(g, d, t) {
    const age = t - d.born;
    const target = g.userData.teraScale || 1;
    // Acte final de l'activation : la couronne descend et se pose.
    if (age < 0.55) {
      const k = R3.easeOut ? R3.easeOut(age / 0.55) : (age / 0.55);
      g.scale.setScalar(Math.max(0.001, target * (0.2 + 0.8 * k)));
      g.rotation.y = (1 - k) * 4.2;
    } else {
      g.scale.setScalar(target);
      g.rotation.y = (t - d.born) * 0.55;
    }
    // Lévitation calme.
    g.position.y = (g.userData.teraBaseY || 0) + Math.sin(t * 1.7) * 0.028;
    if (d.spikes) layoutCrownSpikes(d, t);
    if (d.core) d.core.scale.setScalar(1 + Math.sin(t * 2.6) * 0.16);
    if (d.halo) {
      d.halo.rotation.z = -t * 1.15;
      d.halo.scale.setScalar(1 + Math.sin(t * 1.9 + 1.1) * 0.05);
    }
    if (d.cluster) d.cluster.rotation.y = -t * 0.4;
    if (d.simple) {
      for (let i = 0; i < d.simple.length; i++) {
        d.simple[i].scale.y = 1 + Math.sin(t * 2.1 + i * 0.8) * 0.08;
      }
    }
  }

  /**
   * Extension très pratique pour le lot Intégration : pose la couronne au-dessus
   * du modèle, à la bonne hauteur, en une ligne.
   *   R3.get('tera').attach(modeleDeLaCreature, mon)
   * -> le Group de la couronne, ou null.
   */
  function attach(model, mon, opts) {
    if (!model || !HAS_THREE) return null;
    detach(model);
    const g = crown(mon, opts);
    if (!g) return null;
    let h = 1.1;
    try {
      // La hauteur du modèle décide de celle de la couronne : un colosse ne la
      // porte pas au même endroit qu'une petite créature.
      const bb = new THREE.Box3().setFromObject(model);
      if (isFinite(bb.max.y) && bb.max.y > 0.2) h = bb.max.y;
      const largeur = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
      if (isFinite(largeur) && largeur > 0.1) {
        // On ne touche QUE la taille cible : l'échelle courante reste à zéro,
        // c'est l'animation de naissance qui la fait grandir (sinon la couronne
        // apparaîtrait en grand pendant une frame avant de repartir de zéro).
        g.userData.teraScale = clampf(largeur * 0.9, 0.55, 2.4);
      }
    } catch (e) { /* pas de boîte englobante : on garde la hauteur par défaut */ }
    const y = h + 0.22 * (g.userData.teraScale || 1);
    g.userData.teraBaseY = y;
    g.position.y = y;
    model.add(g);
    model.userData.teraCrown = g;
    return g;
  }

  /** Retire la couronne d'un modèle et la sort de la boucle d'animation. */
  function detach(model) {
    if (!model || !model.userData) return false;
    const g = model.userData.teraCrown;
    if (!g) return false;
    unregister(g);
    if (g.parent) g.parent.remove(g);
    model.userData.teraCrown = null;
    return true;
  }

  // ===========================================================================
  //  7. L'ÉCLAT DE CRISTAUX — mise en scène en trois actes
  // ===========================================================================
  //  ACTE I  — L'APPEL      (0 → 0,42 s) : la lumière se rassemble, la colonne
  //            monte, la géode pousse du sol, les étincelles convergent.
  //  ACTE II — LA FRAPPE    (0,42 → 0,62 s) : flash blanc, la coque de cristal
  //            gonfle d'un coup puis VOLE EN ÉCLATS, l'onde part au sol.
  //  ACTE III— LA RÉVÉLATION(0,62 → 1,90 s) : les éclats retombent en tournant,
  //            l'onde s'élargit, la colonne s'épanouit puis s'efface, et la
  //            couronne se pose (voir animCrown).
  //
  //  Coût : 6 draw calls + 5 pour la géode de llib = 11, pendant 1,9 s.
  //  Tous les fondus se font à l'ÉCHELLE — on ne touche jamais un matériau
  //  partagé (piège n° 1 du bandeau).
  // ---------------------------------------------------------------------------

  const T_FRAPPE = 0.42;
  const T_ECLAT = 0.62;
  const T_FIN = 1.90;

  const BURST_SHARDS = 20;
  const BURST_MOTES = 14;

  function burst(scene, position, color) {
    if (!HAS_THREE || !HAS_R3 || !scene || !scene.add) return null;
    const col = color || typeColor(activeMon() ? teraTypeOf(activeMon()) : DEFAULT_TYPE);

    const g = new THREE.Group();
    if (position) {
      if (position.isVector3) g.position.copy(position);
      else g.position.set(num(position.x, 0), num(position.y, 0), num(position.z, 0));
    }

    const d = { kind: 'burst', born: now(), color: col, dead: false, root: g };

    // --- La coque : une bulle de cristal qui enferme la créature une seconde --
    const shell = new THREE.Mesh(R3.geo.sphere(0.62, 12), glassMat(col, 0.34));
    shell.position.y = 0.55;
    shell.castShadow = false; shell.receiveShadow = false;
    shell.scale.setScalar(0.001);
    shell.renderOrder = 1;
    g.add(shell); d.shell = shell;

    // --- Le flash blanc de la frappe -----------------------------------------
    const flash = new THREE.Mesh(R3.geo.sphere(0.5, 10), flashMat());
    flash.position.y = 0.55;
    flash.castShadow = false; flash.visible = false;
    flash.renderOrder = 3;
    g.add(flash); d.flash = flash;

    // --- L'onde de choc au sol ------------------------------------------------
    const wave = new THREE.Mesh(R3.geo.torus(1, 0.055, 24), glassMat(col, 0.5));
    wave.rotation.x = Math.PI / 2;
    wave.position.y = 0.05;
    wave.castShadow = false; wave.visible = false;
    g.add(wave); d.wave = wave;

    // --- La colonne de lumière ------------------------------------------------
    const column = new THREE.Mesh(R3.geo.cyl(0.30, 0.46, 3.4, 14), glassMat(col, 0.22));
    column.position.y = 1.7;
    column.castShadow = false;
    column.scale.set(0.001, 0.02, 0.001);
    column.renderOrder = 1;
    g.add(column); d.column = column;

    // --- Les éclats qui jaillissent -------------------------------------------
    d.shards = makeShards(g, col, BURST_SHARDS, 0.075, 0.32, false);
    // --- La poussière d'étincelles (plus claire, plus vive) --------------------
    d.motes = makeShards(g, col, BURST_MOTES, 0.035, 0.11, true);

    // --- La géode : des cristaux qui poussent du sol ---------------------------
    // C'est ici qu'on réutilise la bibliothèque des légendaires : la même matière
    // que les cristaux de Cristallia et de Banquisor, pour que le monde ait l'air
    // fait d'une seule main. Cinq draw calls, transitoires — mais on y renonce
    // si l'instanciation manque : le reste de l'effet a déjà mangé le budget.
    const LL = HAS_INSTANCED ? mod('llib') : null;
    if (LL && typeof LL.crystalCluster === 'function') {
      try {
        const geode = LL.crystalCluster(col, 4, 0.34, {
          base: false, glow: true, opacity: 0.9, spread: 2.1, flat: true,
        });
        if (geode) {
          geode.scale.setScalar(0.001);
          g.add(geode);
          d.geode = geode;
        }
      } catch (e) { /* la géode est un bonus : son absence ne se voit pas */ }
    }

    scene.add(g);
    register(g, d);
    return g;
  }

  /**
   * Fabrique un jet d'éclats : un seul InstancedMesh (1 draw call) dont chaque
   * instance a sa trajectoire. Repli : autant de petits cônes qu'il en faut,
   * mais en nombre réduit — mieux vaut moins d'éclats qu'un jeu qui rame.
   */
  function makeShards(parent, col, n, r, h, clair) {
    const geoS = R3.geo.cone(r, h, 4);
    const mtl = clair ? glassMat(col, 0.75) : crystalMat(col);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (i % 3) * 0.37;
      const haut = 0.35 + ((i * 7) % 11) / 11 * 1.15;
      const vitesse = 2.0 + ((i * 5) % 9) / 9 * 2.6;
      parts.push({
        a: a,
        vx: Math.cos(a) * vitesse,
        vz: Math.sin(a) * vitesse,
        vy: 2.4 + haut * 1.9,
        spin: 5 + ((i * 3) % 7),
        r0: 0.9 + ((i * 11) % 5) / 5 * 1.0,   // distance de départ (acte I)
        taille: 0.7 + ((i * 13) % 6) / 6 * 0.7,
      });
    }
    if (HAS_INSTANCED) {
      const im = instanced(geoS, mtl, n);
      parent.add(im);
      return { im: im, n: n, parts: parts, meshes: null };
    }
    // Repli : quatre à cinq fois moins d'éclats, en meshes séparés. Moins joli,
    // mais un effet magnifique qui fait ramer le jeu est un effet raté.
    const meshes = [];
    const half = Math.max(3, Math.round(n / 5));
    for (let i = 0; i < half; i++) {
      const m = new THREE.Mesh(geoS, mtl);
      m.castShadow = false;
      parent.add(m);
      meshes.push(m);
    }
    return { im: null, n: half, parts: parts, meshes: meshes };
  }

  function placeShard(sh, i, px, py, pz, rx, ry, rz, s) {
    if (sh.im) { setInstance(sh.im, i, px, py, pz, rx, ry, rz, s, s, s); return; }
    const m = sh.meshes[i];
    if (!m) return;
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, rz);
    m.scale.setScalar(s);
  }

  function flushShards(sh) {
    if (sh.im) sh.im.instanceMatrix.needsUpdate = true;
  }

  function animBurst(g, d, t) {
    const age = t - d.born;
    if (age >= T_FIN) { killBurst(g, d); return; }

    // ---- ACTE I : l'appel ---------------------------------------------------
    if (age < T_FRAPPE) {
      const k = age / T_FRAPPE;
      const ease = k * k;                       // ça se précipite vers la frappe
      // La coque gonfle jusqu'à envelopper la créature.
      d.shell.scale.setScalar(0.15 + ease * 1.05);
      d.shell.rotation.y = age * 2.4;
      // La colonne s'allume, fine.
      d.column.scale.set(0.10 + k * 0.22, 0.15 + k * 0.55, 0.10 + k * 0.22);
      // La géode pousse du sol.
      if (d.geode) d.geode.scale.setScalar(0.001 + ease * 1.1);
      // Les éclats CONVERGENT vers le centre : ils viennent de loin et se
      // rassemblent — c'est ce qui rend la frappe inévitable.
      for (let i = 0; i < d.shards.n; i++) {
        const p = d.shards.parts[i];
        const dist = p.r0 * (1 - ease) + 0.25 * ease;
        placeShard(d.shards, i,
          Math.cos(p.a) * dist, 0.55 + Math.sin(p.a * 2.1) * 0.35 * (1 - ease), Math.sin(p.a) * dist,
          p.a, age * p.spin * 0.3, 0, 0.35 + ease * 0.5);
      }
      flushShards(d.shards);
      for (let i = 0; i < d.motes.n; i++) {
        const p = d.motes.parts[i];
        const dist = (p.r0 + 0.9) * (1 - ease) + 0.15 * ease;
        const yy = 0.2 + (1 - ease) * 1.5 * ((i % 3) / 3 + 0.2);
        placeShard(d.motes, i,
          Math.cos(p.a * 1.7) * dist, yy, Math.sin(p.a * 1.7) * dist,
          0, age * 6 + i, p.a, 0.5 + ease * 0.9);
      }
      flushShards(d.motes);
      return;
    }

    // ---- ACTE II : la frappe ------------------------------------------------
    if (age < T_ECLAT) {
      const k = (age - T_FRAPPE) / (T_ECLAT - T_FRAPPE);
      d.shell.visible = false;                 // la coque a volé en éclats
      d.flash.visible = true;
      // Le flash gonfle puis s'éteint EN RÉTRÉCISSANT (jamais en opacité :
      // le matériau blanc est partagé avec tout le reste du jeu).
      const f = Math.sin(k * Math.PI);
      d.flash.scale.setScalar(0.3 + f * 2.6);
      d.wave.visible = true;
      d.wave.scale.set(0.4 + k * 1.6, 0.4 + k * 1.6, 1.2);
      d.column.scale.set(0.9 + k * 0.5, 1 + k * 0.15, 0.9 + k * 0.5);
      if (d.geode) d.geode.scale.setScalar(1.1 + k * 0.15);
      explodeShards(d, (age - T_FRAPPE));
      return;
    }

    // ---- ACTE III : la révélation -------------------------------------------
    const k = (age - T_ECLAT) / (T_FIN - T_ECLAT);
    const reste = 1 - k;
    d.flash.scale.setScalar(Math.max(0.001, 2.9 * reste * reste));
    if (k > 0.35) d.flash.visible = false;
    // L'onde s'élargit et s'aplatit : elle « part » au lieu de disparaître.
    d.wave.scale.set(2.0 + k * 4.2, 2.0 + k * 4.2, Math.max(0.001, 1.2 * reste));
    // La colonne s'épanouit puis s'efface par le bas.
    const c = Math.max(0.001, reste);
    d.column.scale.set(1.4 * c, 1.15, 1.4 * c);
    d.column.rotation.y = age * 0.8;
    if (d.geode) {
      // La géode reste plantée un instant, puis s'enfonce.
      d.geode.scale.setScalar(Math.max(0.001, 1.25 * (k < 0.55 ? 1 : (1 - (k - 0.55) / 0.45))));
      d.geode.rotation.y = age * 0.5;
    }
    explodeShards(d, (age - T_FRAPPE));
  }

  /** Trajectoire balistique des éclats, commune aux actes II et III. */
  function explodeShards(d, dt) {
    const G = 5.6;
    for (let i = 0; i < d.shards.n; i++) {
      const p = d.shards.parts[i];
      const x = p.vx * dt * 0.55;
      const z = p.vz * dt * 0.55;
      const y = 0.55 + p.vy * dt - 0.5 * G * dt * dt;
      const vie = clampf(1 - dt / (T_FIN - T_FRAPPE), 0, 1);
      placeShard(d.shards, i, x, Math.max(0.04, y), z,
        p.a + dt * p.spin * 0.5, dt * p.spin, p.a * 0.5,
        Math.max(0.001, p.taille * vie));
    }
    flushShards(d.shards);
    for (let i = 0; i < d.motes.n; i++) {
      const p = d.motes.parts[i];
      // Les étincelles montent au lieu de retomber : elles s'évaporent.
      const x = Math.cos(p.a * 1.7) * (0.3 + p.vx * dt * 0.35);
      const z = Math.sin(p.a * 1.7) * (0.3 + p.vz * dt * 0.35);
      const y = 0.35 + dt * (1.4 + (i % 4) * 0.5);
      const vie = clampf(1 - dt / (T_FIN - T_FRAPPE), 0, 1);
      placeShard(d.motes, i, x, y, z, 0, dt * 7 + i, p.a,
        Math.max(0.001, (0.5 + p.taille * 0.6) * vie));
    }
    flushShards(d.motes);
  }

  function killBurst(g, d) {
    d.dead = true;
    unregister(g);
    if (g.parent) g.parent.remove(g);
    // Rien à libérer : géométries et matériaux viennent tous des caches de R3 et
    // resserviront à la prochaine cristallisation.
  }

  // ===========================================================================
  //  8. BOUCLE D'ANIMATION
  // ===========================================================================
  //  Le contrat ne prévoit pas de `update(dt)` pour ce module : la couronne doit
  //  donc s'animer TOUTE SEULE, sinon elle resterait figée si le lot Intégration
  //  oublie de la brancher. On tient une petite liste d'objets vivants et une
  //  boucle `requestAnimationFrame` qui ne tourne QUE tant que cette liste n'est
  //  pas vide — au repos, ce module ne coûte rigoureusement rien.
  //
  //  `update()` reste exposé pour qui veut piloter depuis sa propre boucle : le
  //  double appel est sans danger parce que TOUTES les animations d'ici sont des
  //  fonctions du temps ABSOLU (R3.clock.t), jamais des accumulateurs. Animer
  //  deux fois la même frame donne exactement le même résultat qu'une seule.
  // ---------------------------------------------------------------------------

  const LIVE = [];
  let rafId = 0;

  function register(g, d) {
    if (!g) return;
    if (d) g.userData.tera = d;
    if (LIVE.indexOf(g) === -1) LIVE.push(g);
    startLoop();
  }

  function unregister(g) {
    const i = LIVE.indexOf(g);
    if (i >= 0) LIVE.splice(i, 1);
  }

  function tick() {
    const t = now();
    // On parcourt un instantané : un effet qui meurt se retire de LIVE.
    for (let i = LIVE.length - 1; i >= 0; i--) {
      const g = LIVE[i];
      const d = g && g.userData && g.userData.tera;
      if (!d) { LIVE.splice(i, 1); continue; }
      try {
        if (d.kind === 'crown') animCrown(g, d, t);
        else if (d.kind === 'burst') animBurst(g, d, t);
      } catch (e) {
        // Une animation ne casse jamais une frame : on la retire, c'est tout.
        LIVE.splice(i, 1);
      }
    }
  }

  function startLoop() {
    if (rafId || !LIVE.length) return;
    if (typeof requestAnimationFrame !== 'function') return;
    const boucle = function () {
      rafId = 0;
      tick();
      if (LIVE.length) rafId = requestAnimationFrame(boucle);
    };
    rafId = requestAnimationFrame(boucle);
  }

  /** Extension : le lot Intégration peut appeler ceci depuis sa propre boucle
   *  (battle3d.update / game3d). Sans danger même en plus de la boucle interne
   *  — voir le commentaire du bandeau de cette section. */
  function update() { tick(); }

  // ===========================================================================
  //  9. BUDGET — mesuré, pas estimé
  // ===========================================================================
  /**
   * Compte les draw calls réellement produits. Un InstancedMesh = 1 draw call
   * quel que soit son nombre d'instances ; les Group n'en coûtent aucun.
   * -> { crown, burst, peak, limite }
   */
  function drawCalls() {
    if (!HAS_THREE || !HAS_R3) return { crown: 0, burst: 0, peak: 0, limite: 20 };
    function compte(obj) {
      let n = 0;
      if (!obj) return 0;
      obj.traverse(function (o) { if (o.isMesh || o.isInstancedMesh || o.isPoints) n++; });
      return n;
    }
    let c = 0, b = 0;
    try {
      const k = crown(null, { typeId: DEFAULT_TYPE });
      c = compte(k);
      unregister(k);
    } catch (e) { /* rien */ }
    try {
      const faux = new THREE.Scene();
      const e2 = burst(faux, { x: 0, y: 0, z: 0 }, typeColor(DEFAULT_TYPE));
      b = compte(e2);
      if (e2 && e2.userData.tera) killBurst(e2, e2.userData.tera);
    } catch (e) { /* rien */ }
    return { crown: c, burst: b, peak: c + b, limite: 20 };
  }

  // ===========================================================================
  //  10. Auto-vérification silencieuse
  // ===========================================================================
  (function selfCheck() {
    try {
      const problems = [];
      for (let i = 0; i < ORDER.length; i++) {
        if (!FALLBACK_TYPES[ORDER[i]]) problems.push('type de repli manquant : ' + ORDER[i]);
      }
      for (const a in ALIAS) {
        if (!FALLBACK_TYPES[ALIAS[a]]) problems.push('alias ' + a + ' -> type inconnu ' + ALIAS[a]);
      }
      if (problems.length && typeof console !== 'undefined' && console.warn) {
        console.warn('[tera3d] table de repli incohérente :\n  - ' + problems.join('\n  - '));
      }
    } catch (e) { /* une vérification ne casse jamais un chargement */ }
  })();

  // ===========================================================================
  //  11. API — signature EXACTE du §7 de v3, plus des extensions documentées
  // ===========================================================================

  const API = {
    // --- contrat §7 ---
    isUnlocked: isUnlocked,
    unlock: unlock,
    teraTypeOf: teraTypeOf,
    setTeraType: setTeraType,
    canUse: canUse,
    activate: activate,
    deactivate: deactivate,
    bonus: bonus,
    crown: crown,
    burst: burst,
    reset: reset,

    // --- extensions (hors contrat, pour le lot Intégration) ---
    lock: lock,                       // nouvelle partie
    deactivateAll: deactivateAll,     // fin de combat, sans connaître le Mon
    isCharged: isCharged,
    isActive: isActive,
    activeMon: activeMon,
    statusText: statusText,           // texte du bouton Téra grisé
    typeChoices: typeChoices,         // les 18 types pour l'écran de l'Académie
    defaultTeraTypeOf: defaultTeraTypeOf,
    canSetTeraType: canSetTeraType,
    beginAcademyVisit: beginAcademyVisit,
    attach: attach,                   // pose la couronne sur un modèle
    detach: detach,
    update: update,                   // facultatif : pilotage externe
    serialize: serialize,
    deserialize: deserialize,
    drawCalls: drawCalls,
    ORDER: ORDER,
    ALIAS: ALIAS,
  };

  if (HAS_R3) R3.register('tera', API);
  else if (typeof globalThis !== 'undefined') globalThis.TERA3D = API;   // repli
  if (typeof window !== 'undefined') window.TERA3D = API;                // débogage
})();
