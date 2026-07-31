// =============================================================================
//  roamers3d.js — LES CRÉATURES QUI SE BALADENT SUR LA CARTE      (CONTRACT2 §16)
// =============================================================================
//  C'est la demande n°6 de Robin, telle quelle : « il faut que je puisse voir
//  les pokémon qui se baladent sur la carte avec possibilité de jeter une
//  pokeball dessus pour les capturer ». Ce module gère :
//    · une population vivante de 8 à 14 créatures ordinaires (moins en qualité
//      basse) qui marchent de tuile en tuile autour du joueur, respawnées en
//      permanence dans un anneau de 12 à 28 tuiles ;
//    · UN légendaire à la fois par région, posé immobile sur son autel, qui
//      fuit s'il n'est pas affronté dans les 90 secondes ;
//    · le lancer de Pokéball EN MONDE OUVERT (pas d'écran de combat), avec
//      exactement les timings du jeu 2D / de battle3d.js :
//          0    → 600 ms   lancer en parabole
//          600  → 1800 ms  3 secousses de 400 ms
//          1800 ms          résultat (capture ou échec)
//    · le viseur (`aimed`) utilisé par hud3d.js et la touche B de game3d.js ;
//    · les rencontres non voulues (`onEncounter`), quand un roamer touche le
//      joueur — comme marcher dans les hautes herbes.
//
//  POLITIQUE DE RÉAPPARITION DES LÉGENDAIRES (le contrat laisse le choix,
//  §16 : « documente ta politique de réapparition ») :
//    - Un altar avec un légendaire ACTIF n'en propose pas d'autre : un seul à
//      la fois dans TOUTE la région (donc dans tout le jeu, une seule région
//      étant chargée à la fois).
//    - Le légendaire s'active quand le joueur s'approche à moins de 42 tuiles
//      de son autel (assez loin pour qu'on le voie venir grâce à son aura).
//    - S'il n'est ni capturé ni vaincu (remove() jamais appelé) dans les 90
//      secondes qui suivent, il fuit tout seul : il disparaît de list() et son
//      autel entre en repos pendant 10 minutes de jeu (LEGEND_COOLDOWN_S)
//      avant de pouvoir proposer un nouveau légendaire — le sien ou un autre.
//    - Capturé ou vaincu (remove() appelé par game3d après un combat gagné ou
//      une capture), même cooldown : on ne fait pas réapparaître un légendaire
//      qu'on vient d'attraper sous le nez du joueur.
//
//  DÉPENDANCES — TOUTES FACULTATIVES (dégradation gracieuse obligatoire) :
//    R3.get('regions')  -> tuiles, marchabilité, biomes, autels de légendaire.
//                          Absent : aucun roamer n'est posé, le monde reste
//                          jouable (list() renvoie toujours [], throwBall()
//                          répond 'escaped' proprement).
//    R3.get('dex')      -> quelles espèces vivent sur quel biome / région.
//    R3.get('llib')     -> aura des légendaires (sinon : pas d'aura, juste un
//                          modèle un peu plus grand si c'est un repli).
//    R3.buildCreature(id), R3.idleCreature(g,t,phase)  -> toujours définis par
//                          core3d.js (repli intégré si l'espèce n'a pas de
//                          modèle dédié).
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined') {
    if (typeof console !== 'undefined') {
      console.warn('[roamers3d] core3d.js est absent : aucune créature ne sera posée sur la carte.');
    }
    return;
  }
  var THREE_OK = (typeof THREE !== 'undefined');

  function warn(step, e) {
    if (typeof console !== 'undefined') console.warn('[roamers3d] ' + step + ' —', e);
  }

  // --- Dépendances facultatives, résolues À L'USAGE (elles peuvent se charger
  //     après nous dans l'ordre du §21, ou pas du tout). ------------------------
  function regionsApi() { return R3.get('regions') || null; }
  function dexApi() { return R3.get('dex') || null; }
  function llibApi() { return R3.get('llib') || null; }
  function questApi() { return R3.get('quest') || null; }
  function actorsApi() { return R3.get('actors') || null; }

  /**
   * Construit le modèle 3D d'une espèce EN PASSANT PAR `evolve.fallbackModel()`.
   * Les formes évoluées (evolve3d.js) sont modélisées par un autre lot : tant
   * qu'un modèle manque, `fallbackModel()` renvoie l'id de la forme précédente
   * ou de la forme de base. Sans ce détour, une créature évoluée croisée sur la
   * carte s'afficherait en silhouette grise de secours au lieu de ressembler,
   * au moins, à ce qu'elle était avant.
   * Renvoie null (jamais d'exception) si la construction échoue.
   */
  function buildModel(speciesId, quoi) {
    var id = speciesId;
    var EV = R3.get('evolve');
    if (EV && typeof EV.fallbackModel === 'function') {
      try {
        var alt = EV.fallbackModel(speciesId);
        if (typeof alt === 'string' && alt) id = alt;
      } catch (e) { /* le repli n'est qu'un confort : on garde l'id demandé */ }
    }
    try { return R3.buildCreature(id) || null; }
    catch (e) { warn('construction ' + (quoi || '') + ' « ' + speciesId + ' »', e); return null; }
  }

  /** Les PNJ alentour s'étonnent de voir un légendaire (contrat v3 §10).
   *  À appeler À CHAQUE IMAGE tant qu'il est là : c'est ce qui permet aux PNJ
   *  de le suivre du regard et de se calmer quand il s'éloigne. */
  function signalLegend() {
    if (!_legendary) return;
    var A = actorsApi();
    if (!A || typeof A.reactToLegend !== 'function') return;
    // Le NOM D'ESPÈCE est la clé du verrou anti-spam de 30 s côté actors3d :
    // une chaîne vide ferait partager le même verrou à tous les légendaires,
    // et le deuxième n'étonnerait plus personne.
    var nom = _legendary._nom || _legendary.speciesId || 'Légendaire';
    try { A.reactToLegend(_legendary.group.position, nom); }
    catch (e) { /* l'étonnement des PNJ est un bonus, jamais bloquant */ }
  }

  /** Plus aucun légendaire en vue : tout le monde se calme. */
  function calmActors() {
    var A = actorsApi();
    if (!A || typeof A.clearReactions !== 'function') return;
    try { A.clearReactions(); } catch (e) { /* jamais bloquant */ }
  }

  // ===========================================================================
  //  CONSTANTES
  // ===========================================================================

  var MOVE_MS = 320;                 // durée d'un pas, comme le joueur (actors3d)
  var PAUSE_MIN_MS = 500, PAUSE_MAX_MS = 2200;   // pause entre deux pas
  var RETRY_MS = 250;                // nouvel essai si aucune direction n'est libre

  var RING_MIN = 12, RING_MAX = 28;  // anneau de spawn autour du joueur (tuiles)
  var DESPAWN_DIST = 36;             // au-delà : le roamer est recyclé ailleurs
  var SPAWN_TRIES = 8;               // tentatives de tuile par créature posée
  var SPAWN_PER_TICK = 2;            // au plus 2 créations par passage de peuplement
  var SPAWN_INTERVAL = 0.35;         // s : on ne repeuple pas à CHAQUE frame

  var LEGEND_ACTIVATE_DIST = 42;     // tuiles : distance à laquelle l'autel s'anime
  var LEGEND_FLEE_S = 90;            // fuite si pas affronté (§16, à la lettre)
  var LEGEND_COOLDOWN_S = 600;       // 10 min de jeu avant de pouvoir réapparaître

  var ENCOUNTER_DIST = 0.62;         // unités monde : « touche » le joueur

  // Timings de la Pokéball — IDENTIQUES au contrat §16 / à battle3d.js §17.
  var T_THROW = 600, T_SHAKE = 1200, T_RESULT = T_THROW + T_SHAKE;

  // Axes du contrat (§1.4) : up=-z, down=+z, left=-x, right=+x. Le modèle d'une
  // créature (comme celui d'un personnage) est construit tourné vers +z, donc
  // « down » correspond à une rotation nulle — même table que actors3d.js.
  var DIR_VEC = {
    up: { dx: 0, dy: -1, ry: Math.PI },
    down: { dx: 0, dy: 1, ry: 0 },
    left: { dx: -1, dy: 0, ry: -Math.PI / 2 },
    right: { dx: 1, dy: 0, ry: Math.PI / 2 },
  };
  var DIR_NAMES = ['up', 'down', 'left', 'right'];

  // ===========================================================================
  //  ÉTAT DU MODULE
  // ===========================================================================

  var _scene = null;
  var _regionId = null;
  var _roamers = [];             // tous les roamers vivants (ordinaires + légendaire)
  var _uidSeq = 1;
  var _legendary = null;         // le roamer légendaire actif, ou null
  var _legendCooldowns = Object.create(null);   // legendId -> t (R3.clock.t) autorisé
  var _encounterCbs = [];
  var _spawnClock = 0;
  var _lastPX = 0, _lastPZ = 0;  // dernière position joueur connue (pour throwBall)

  var _ball = null;              // groupe Three.js de la Pokéball, partagé
  var _ballAnim = null;          // { active, t, ... } | null — un seul lancer à la fois
  var _fx = [];                  // petits effets visuels transitoires en cours

  // ===========================================================================
  //  PETITS UTILITAIRES
  // ===========================================================================

  function heightAt(x, z) {
    var w = R3.get('world');
    if (w && typeof w.heightAt === 'function') {
      var h = w.heightAt(x, z);
      if (typeof h === 'number' && isFinite(h)) return h;
    }
    return 0;
  }

  function randInt(a, b) {
    if (b <= a) return a;
    return a + Math.floor(Math.random() * (b - a + 1));
  }

  /** Niveau d'un roamer fraîchement posé sur la carte.
   *  `species.minLevel`/`maxLevel` couvrent l'UNION de toutes les régions où
   *  l'espèce apparaît (js3d/dex3d.js, §8 du contrat) — une créature commune
   *  à val (Nv 3-8) et braise (Nv 32-40) déclare donc 3-40. Sans recroiser
   *  avec la fourchette de LA RÉGION COURANTE (dex.REGION_LEVELS), un joueur
   *  tout juste sorti de val pouvait croiser (et capturer) une créature de
   *  niveau 40 se baladant juste à côté du spawn — trouvé en jouant
   *  réellement à la partie. Même correctif que la rencontre en hautes
   *  herbes (game3d.js, triggerWildEncounter). */
  function roamerLevel(DEX, species) {
    var lo0 = species.minLevel || 3, hi0 = Math.max(lo0, species.maxLevel || lo0 + 2);
    var band = DEX && DEX.REGION_LEVELS && DEX.REGION_LEVELS[_regionId];
    if (!band) return randInt(lo0, hi0);
    var lo1 = Math.max(lo0, band[0]), hi1 = Math.min(hi0, band[1]);
    if (lo1 > hi1) { lo1 = band[0]; hi1 = band[1]; }  // pas de recoupement : on suit la région
    return randInt(lo1, hi1);
  }

  function shuffledDirs() {
    var arr = DIR_NAMES.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /** Une tuile est-elle prise par un autre roamer (position actuelle ou pas en cours) ? */
  function tileTaken(tx, ty, exclude) {
    for (var i = 0; i < _roamers.length; i++) {
      var r = _roamers[i];
      if (r === exclude) continue;
      if (r.tileX === tx && r.tileY === ty) return true;
      if (r.state === 'moving' && r._toTileX === tx && r._toTileY === ty) return true;
    }
    return false;
  }

  function disposeGroup(group) {
    if (!group) return;
    try { R3.disposeTree(group); }
    catch (e) { if (group.parent) group.parent.remove(group); }
  }

  // ===========================================================================
  //  PEUPLEMENT — apparition / disparition des créatures ORDINAIRES
  // ===========================================================================

  function desiredCount() {
    var lvl = (R3.quality && R3.quality.level) || 'high';
    if (lvl === 'low') return 6;       // « moins si R3.quality est bas » (§16)
    if (lvl === 'medium') return 10;
    return 14;
  }

  /** Cherche une tuile marchable, du bon biome pour au moins une espèce, dans
   *  l'anneau [RING_MIN, RING_MAX] autour du joueur. Renvoie null si aucune
   *  tuile convenable n'est trouvée en SPAWN_TRIES essais (on ne force jamais
   *  une espèce hors-thème — §16, point 1). */
  function pickSpawnSpot(R, DEX, px, pz, playerTx, playerTy) {
    for (var i = 0; i < SPAWN_TRIES; i++) {
      var ang = Math.random() * Math.PI * 2;
      var rad = RING_MIN + Math.random() * (RING_MAX - RING_MIN);
      var tx = Math.round(px + Math.cos(ang) * rad);
      var ty = Math.round(pz + Math.sin(ang) * rad);
      if (tx < 0 || ty < 0 || tx >= R.W || ty >= R.H) continue;
      if (tx === playerTx && ty === playerTy) continue;
      if (!R.isWalkable(tx, ty)) continue;
      if (tileTaken(tx, ty, null)) continue;
      var biome = R.biomeAt(tx, ty);
      var pool = DEX.byBiome(biome);
      if (!pool || !pool.length) continue;      // biome sans faune connue : on ignore
      return { tx: tx, ty: ty, biome: biome };
    }
    return null;
  }

  function spawnOne(R, DEX, px, pz, playerTx, playerTy) {
    var spot = pickSpawnSpot(R, DEX, px, pz, playerTx, playerTy);
    if (!spot) return;
    var species = DEX.pickWild(_regionId, spot.biome);   // jamais un légendaire (dex3d §8)
    if (!species) return;

    var group = buildModel(species.id, 'de');
    if (!group) return;

    var y = heightAt(spot.tx, spot.ty);
    group.position.set(spot.tx, y, spot.ty);
    group.rotation.y = DIR_VEC.down.ry;
    if (_scene) _scene.add(group);

    _roamers.push({
      uid: _uidSeq++,
      speciesId: species.id,
      legendary: false,
      level: roamerLevel(DEX, species),
      x: spot.tx, z: spot.ty,
      dir: 'down',
      group: group,
      state: 'idle',
      tileX: spot.tx, tileY: spot.ty,
      // --- champs internes (hors contrat, préfixés _) ---
      _phase: Math.random() * 6.2832,
      _moveT: 0, _pauseT: PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS),
      _fromX: spot.tx, _fromZ: spot.ty, _toX: spot.tx, _toZ: spot.ty,
      _toTileX: spot.tx, _toTileY: spot.ty,
      _ball: false, _encountered: false,
    });
  }

  function maintainPopulation(R, DEX, px, pz) {
    var playerTx = Math.round(px), playerTy = Math.round(pz);
    var ordinary = [];
    for (var i = 0; i < _roamers.length; i++) if (!_roamers[i].legendary) ordinary.push(_roamers[i]);

    var want = desiredCount();
    if (ordinary.length > want) {
      // La qualité a baissé en cours de route (ou pic ponctuel) : on retire le
      // plus lointain, un seul à la fois, pour ne jamais faire un « saut »
      // visible dans la population.
      var far = ordinary[0], farD = -1;
      for (i = 0; i < ordinary.length; i++) {
        var ro = ordinary[i];
        var d = (ro.x - px) * (ro.x - px) + (ro.z - pz) * (ro.z - pz);
        if (d > farD) { farD = d; far = ro; }
      }
      removeInternal(far);
      return;
    }

    var toSpawn = Math.min(SPAWN_PER_TICK, want - ordinary.length);
    for (var s = 0; s < toSpawn; s++) spawnOne(R, DEX, px, pz, playerTx, playerTy);
  }

  // ===========================================================================
  //  DÉPLACEMENT — de tuile en tuile, comme le joueur (actors3d.js)
  // ===========================================================================

  function tryStartMove(ro, playerTx, playerTy) {
    var order = shuffledDirs();
    for (var i = 0; i < order.length; i++) {
      var dir = order[i];
      var v = DIR_VEC[dir];
      var tx = ro.tileX + v.dx, ty = ro.tileY + v.dy;
      if (tx === playerTx && ty === playerTy) continue;    // ne rentre jamais dans le joueur
      var R = regionsApi();
      if (!R || !R.isWalkable(tx, ty)) continue;            // ni eau profonde, ni lave, ni obstacle
      if (tileTaken(tx, ty, ro)) continue;
      ro.dir = dir;
      ro.state = 'moving';
      ro._moveT = 0;
      ro._fromX = ro.x; ro._fromZ = ro.z;
      ro._toX = tx; ro._toZ = ty;
      ro._toTileX = tx; ro._toTileY = ty;
      return;
    }
    // Complètement bloqué (entouré d'eau/joueur/autres roamers) : on retente
    // bientôt plutôt que de boucler ce calcul à chaque frame.
    ro._pauseT = RETRY_MS + Math.random() * RETRY_MS;
  }

  function stepRoamer(ro, dtMs, playerTx, playerTy) {
    if (ro.state === 'moving') {
      ro._moveT += dtMs;
      var p = R3.clamp01(ro._moveT / MOVE_MS);
      ro.x = R3.lerp(ro._fromX, ro._toX, p);
      ro.z = R3.lerp(ro._fromZ, ro._toZ, p);
      if (p >= 1) {
        ro.tileX = ro._toTileX; ro.tileY = ro._toTileY;
        ro.x = ro._toX; ro.z = ro._toZ;
        ro.state = 'idle';
        ro._pauseT = PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS);
      }
    } else {
      ro._pauseT -= dtMs;
      if (ro._pauseT <= 0) tryStartMove(ro, playerTx, playerTy);
    }
  }

  // ===========================================================================
  //  LÉGENDAIRES — un seul à la fois, immobile, aura, fuite après 90 s
  // ===========================================================================

  function activateLegendary(altar, t, DEX) {
    var species = DEX ? DEX.get(altar.id) : null;
    var group = buildModel(altar.id, 'du légendaire');
    if (!group) return;

    // Le vrai modèle (legend3d.pN.js) fait 1,8 à 2,4 unités de haut ; tant
    // qu'il n'est pas encore modélisé, R3.buildCreature() renvoie un repli à
    // la taille d'une créature ordinaire (~1 unité) — on le grossit pour ne
    // pas avoir un « légendaire » minuscule sur son autel (même compensation
    // que battle3d.js, LEGEND_PLACEHOLDER_BOOST).
    if (group.userData && group.userData.placeholder) group.scale.multiplyScalar(2.4);

    var LL = llibApi();
    if (LL && typeof LL.aura === 'function') {
      try {
        var color = (species && species.color) || '#ffe066';
        var auraGroup = LL.aura(color, 1.5, { shape: 'disc', rings: 2, intensity: 1.3 });
        group.add(auraGroup);
        if (typeof LL.refresh === 'function') LL.refresh(group);
      } catch (e) { warn('aura du légendaire « ' + altar.id + ' »', e); }
    }

    var y = heightAt(altar.x, altar.y);
    group.position.set(altar.x, y, altar.y);
    group.rotation.y = DIR_VEC.down.ry;
    if (_scene) _scene.add(group);

    var ro = {
      uid: _uidSeq++,
      speciesId: altar.id,
      legendary: true,
      level: species ? species.minLevel : 45,
      x: altar.x, z: altar.y,
      dir: 'down',
      group: group,
      state: 'idle',
      tileX: altar.x, tileY: altar.y,
      _phase: Math.random() * 6.2832,
      _spawnT: t, _altarId: altar.id, _ball: false, _encountered: false,
      // Nom d'espèce mémorisé une fois pour toutes : `signalLegend()` le passe
      // à actors3d à CHAQUE image, il n'a pas le droit d'interroger le Pokédex
      // 60 fois par seconde.
      _nom: (species && species.name) || altar.id,
    };
    _legendary = ro;
    _roamers.push(ro);

    // Petit signal sonore, facultatif : le contrat ne garantit le nom d'aucune
    // fonction pour « un cri de légendaire ». On tente les plus probables et
    // on abandonne en silence si rien ne correspond (§1.7 : jamais bloquant).
    try {
      if (typeof Audio_ !== 'undefined' && Audio_ && Audio_.sfx) {
        var sfx = Audio_.sfx.legendary || Audio_.sfx.encounter || Audio_.sfx.levelUp || Audio_.sfx.catch_;
        if (typeof sfx === 'function') sfx();
      }
    } catch (e) { /* le son est un bonus, jamais bloquant */ }
  }

  function fleeLegendary(t) {
    if (!_legendary) return;
    var altarId = _legendary._altarId;
    removeInternal(_legendary);       // remet déjà les PNJ au calme
    _legendCooldowns[altarId] = t + LEGEND_COOLDOWN_S;
  }

  function updateLegendary(t, px, pz) {
    var R = regionsApi();
    if (!R || !_regionId) return;
    var region = R.get(_regionId);
    if (!region || !region.altars || !region.altars.length) return;

    if (_legendary) {
      if (t - _legendary._spawnT >= LEGEND_FLEE_S) fleeLegendary(t);
      return;   // « un seul à la fois » — §16
    }

    var q = questApi();
    for (var i = 0; i < region.altars.length; i++) {
      var a = region.altars[i];
      var readyAt = _legendCooldowns[a.id] || 0;
      if (t < readyAt) continue;
      // LE VERROU DES LÉGENDAIRES (contrat v3 §5) : tant que le sanctuaire de la
      // région n'est pas ouvert (badge de l'arène gagné), le gardien dort.
      // REPLI DANS CE SENS ET PAS L'AUTRE : si `quest3d` manque, tout apparaît
      // comme avant. On ne bloque jamais le jeu sur l'absence d'un module.
      if (q && typeof q.isLegendAwake === 'function') {
        var eveille = true;
        try { eveille = q.isLegendAwake(a.id) !== false; }
        catch (e) { eveille = true; }
        if (!eveille) continue;
      }
      var dist = Math.hypot(a.x - px, a.y - pz);
      if (dist > LEGEND_ACTIVATE_DIST) continue;
      activateLegendary(a, t, dexApi());
      break;
    }
  }

  // ===========================================================================
  //  RETRAIT D'UN ROAMER (capture, victoire de combat, fuite, recyclage…)
  // ===========================================================================

  function removeInternal(ro) {
    if (!ro) return;
    var idx = _roamers.indexOf(ro);
    if (idx >= 0) _roamers.splice(idx, 1);
    disposeGroup(ro.group);
    if (_legendary === ro) {
      _legendary = null;
      // Le légendaire n'est plus là : les PNJ n'ont plus de raison de reculer
      // les bras en l'air. Sans cet appel, ils resteraient figés d'étonnement
      // devant un autel vide jusqu'au prochain changement de région.
      calmActors();
    }
  }

  function remove(roamer) {
    if (!roamer) return;
    var wasLegendary = !!roamer.legendary;
    var altarId = roamer._altarId;
    removeInternal(roamer);
    if (wasLegendary && altarId) {
      var now = (R3.clock && typeof R3.clock.t === 'number') ? R3.clock.t : 0;
      _legendCooldowns[altarId] = now + LEGEND_COOLDOWN_S;
    }
  }

  // ===========================================================================
  //  PETITS EFFETS VISUELS DE LA CAPTURE (indépendants de battle3d.js — la
  //  capture en monde ouvert n'a pas de scène séparée, ces effets vivent
  //  directement dans la scène du monde).
  // ===========================================================================

  function fxMatLocal(color, additive, opacity) {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: opacity !== undefined ? opacity : 1,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: false,
    });
  }

  function spawnFx(e) {
    e.age = 0;
    if (e.group && _scene) _scene.add(e.group);
    _fx.push(e);
  }

  function updateFx(dt) {
    for (var i = _fx.length - 1; i >= 0; i--) {
      var e = _fx[i];
      e.age += dt;
      var p = e.age / e.life;
      if (p >= 1) {
        if (e.group && e.group.parent) e.group.parent.remove(e.group);
        if (e.mats) for (var m = 0; m < e.mats.length; m++) e.mats[m].dispose();
        _fx.splice(i, 1);
        continue;
      }
      if (e.update) e.update(p);
    }
  }

  /** Petites étincelles qui jaillissent d'un point (aspiration, secousse, échec). */
  function fxSparkle(pos, color, n) {
    if (!THREE_OK || !_scene) return;
    n = (R3.quality && R3.quality.particles) ? n : Math.max(3, (n / 3) | 0);
    var mat = fxMatLocal(color, true, 1);
    var group = new THREE.Group();
    var parts = [];
    for (var i = 0; i < n; i++) {
      var s = new THREE.Mesh(R3.geo.sphere(1, 6), mat);
      s.position.copy(pos);
      s.scale.setScalar(0.03 + Math.random() * 0.04);
      s.castShadow = false;
      group.add(s);
      var a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI * 0.6;
      parts.push({ mesh: s, v: new THREE.Vector3(
        Math.cos(b) * Math.sin(a), Math.sin(b) * 0.7 + 0.55, Math.cos(b) * Math.cos(a)
      ).multiplyScalar(1.0 + Math.random()) });
    }
    var p0 = pos.clone();
    spawnFx({
      group: group, mats: [mat], life: 0.5,
      update: function (p) {
        var t = p * 0.5;
        for (var k = 0; k < parts.length; k++) {
          var q = parts[k];
          q.mesh.position.set(p0.x + q.v.x * t, p0.y + q.v.y * t - 1.4 * t * t, p0.z + q.v.z * t);
        }
        mat.opacity = 1 - p * p;
      },
    });
  }

  /** Gerbe d'étoiles dorées : capture réussie. */
  function fxStarsBurst(pos, n) {
    if (!THREE_OK || !_scene) return;
    n = (R3.quality && R3.quality.particles) ? n : Math.max(4, (n / 3) | 0);
    var mat = fxMatLocal('#ffd75e', false, 1);
    var group = new THREE.Group();
    var parts = [];
    for (var i = 0; i < n; i++) {
      var star = R3.star(5, 0.11, 0.045, 0.035, '#ffd75e', 0, 0, 0);
      star.material = mat;
      star.castShadow = false;
      star.position.copy(pos);
      group.add(star);
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      var up = 1.3 + Math.random() * 2.2, sp = 1.0 + Math.random() * 1.8;
      parts.push({ mesh: star, v: new THREE.Vector3(Math.sin(a) * sp, up, Math.cos(a) * sp), spin: (Math.random() - 0.5) * 12 });
    }
    var p0 = pos.clone();
    spawnFx({
      group: group, mats: [mat], life: 1.2,
      update: function (p) {
        var t = p * 1.2;
        for (var k = 0; k < parts.length; k++) {
          var q = parts[k];
          q.mesh.position.set(p0.x + q.v.x * t, p0.y + q.v.y * t - 2.8 * t * t, p0.z + q.v.z * t);
          q.mesh.rotation.y += q.spin * 0.02;
        }
        mat.opacity = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
      },
    });
  }

  // ===========================================================================
  //  LA POKÉBALL — modèle simple (deux dômes + bande + bouton), suffisant pour
  //  se reconnaître de loin dans le monde ouvert. Une seule instance, partagée
  //  entre tous les lancers (contrat : « un seul lancer à la fois »).
  // ===========================================================================

  var _ballHalfGeo = null;
  function buildBallGroup() {
    var r = 0.20;
    if (!_ballHalfGeo) {
      _ballHalfGeo = new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      _ballHalfGeo.userData.shared = true;   // géométrie « maison », jamais disposée
    }
    var g = new THREE.Group();
    var top = new THREE.Mesh(_ballHalfGeo, R3.mat('#e5402f', { rough: 0.32 }));
    top.castShadow = true;
    var bot = new THREE.Mesh(_ballHalfGeo, R3.mat('#f4f4f4', { rough: 0.32 }));
    bot.rotation.x = Math.PI;
    bot.castShadow = true;
    var band = R3.torus(r * 1.01, r * 0.15, '#1a1c2c', 0, 0, 0, { seg: 18, rough: 0.5 });
    band.rotation.x = Math.PI / 2;
    var button = R3.cyl(r * 0.30, r * 0.30, r * 0.10, '#f4f4f4', 0, 0, r * 0.02, { seg: 14, rough: 0.3 });
    button.rotation.x = Math.PI / 2;
    var ring = R3.torus(r * 0.30, r * 0.055, '#1a1c2c', 0, 0, r * 0.07, { seg: 14, rough: 0.5 });
    ring.rotation.x = Math.PI / 2;
    g.add(top, bot, band, button, ring);
    g.visible = false;
    return g;
  }

  // ===========================================================================
  //  throwBall(roamer, chance, cb) — capture EN MONDE OUVERT
  //  Timings identiques au jeu 2D / à battle3d.js : lancer 0→600 ms, secousses
  //  600→1800 ms (3 cycles de 400 ms), résultat à 1800 ms.
  // ===========================================================================

  function throwBall(roamer, chance, cb) {
    if (!_scene || !THREE_OK || !_ball || !roamer || roamer._ball) {
      if (cb) { try { cb('escaped'); } catch (e) { warn('callback throwBall (repli)', e); } }
      return;
    }
    if (_ballAnim && _ballAnim.active) return;   // un seul lancer à la fois

    var c = (typeof chance === 'number' && isFinite(chance)) ? R3.clamp01(chance) : 0.35;
    roamer._ball = true;   // gèle le roamer : plus de déplacement ni de rencontre pendant le lancer

    var fromY = heightAt(_lastPX, _lastPZ) + 0.95;   // hauteur de lancer, ~épaule du joueur
    var toY = heightAt(roamer.x, roamer.z) + 0.32;   // hauteur de repos de la créature

    _ballAnim = {
      active: true, t: 0, chance: c, cb: cb, roamer: roamer, result: null,
      from: new THREE.Vector3(_lastPX, fromY, _lastPZ),
      to: new THREE.Vector3(roamer.x, toY, roamer.z),
      suctionDone: false, resultDone: false, lastShakeIdx: -1, done: false,
    };
    _ball.visible = true;
    _ball.position.copy(_ballAnim.from);
    _ball.rotation.set(0, 0, 0);
  }

  /** Fin du lancer pour un ÉCHEC : la créature réapparaît, on la « libère »
   *  (elle redevient déplaçable / rencontrable). Le cas CAPTURÉ est traité
   *  bien plus tôt, dès que le résultat est connu (voir updateBallAnim) : le
   *  modèle est déjà invisible à ce moment-là (aspiré), inutile d'attendre la
   *  fin du scintillement de la Ball pour libérer sa tuile. */
  function finishThrow() {
    var A = _ballAnim, ro = A ? A.roamer : null;
    if (ro) {
      ro._ball = false;
      if (ro.group) { ro.group.scale.setScalar(1); ro.group.visible = true; }
      if (!ro.legendary) {
        // « fuite » : le Pokémon sauvage s'échappe dans les hautes herbes —
        // on ne le laisse pas réapparaître comme par magie au même endroit,
        // on le retire simplement ; maintainPopulation() en repostera un
        // ailleurs à la prochaine passe. Un légendaire manqué, lui, reste
        // sur son autel : on peut retenter avant que les 90 s ne s'écoulent.
        removeInternal(ro);
      }
    }
    _ballAnim = null;
  }

  function updateBallAnim(dt) {
    if (!_ballAnim || !_ballAnim.active || !_ball) return;
    var A = _ballAnim, ro = A.roamer;
    A.t += dt * 1000;
    _ball.visible = true;

    if (A.t < T_THROW) {
      // ----- parabole 0 → 600 ms -----
      var p = A.t / T_THROW;
      _ball.position.lerpVectors(A.from, A.to, p);
      _ball.position.y += Math.sin(p * Math.PI) * 1.6;
      _ball.rotation.x -= dt * 20;
      _ball.rotation.z -= dt * 7;
    } else if (A.t < T_RESULT) {
      // ----- atterrissage + aspiration + 3 secousses de 400 ms -----
      if (!A.suctionDone) {
        A.suctionDone = true;
        fxSparkle(A.to, '#ffd9a0', 14);
      }
      var st = A.t - T_THROW;
      var shrink = R3.clamp01(1 - st / 220);
      if (ro && ro.group) {
        ro.group.scale.setScalar(Math.max(0.02, shrink));
        if (shrink <= 0.02) ro.group.visible = false;
      }
      var idx = Math.floor(st / 400);
      var sp = st % 400;
      if (idx !== A.lastShakeIdx) {
        A.lastShakeIdx = idx;
        if (idx > 0) fxSparkle(A.to, '#ffe27a', 6);
      }
      var tilt = 0, hop = 0;
      if (sp < 300) {
        var q = sp / 300;
        var dir = (idx % 2 === 0) ? -1 : 1;
        tilt = dir * 0.42 * Math.sin(q * Math.PI);
        hop = Math.sin(q * Math.PI) * 0.05;
      }
      _ball.position.set(A.to.x, A.to.y + hop, A.to.z);
      _ball.rotation.set(0, 0, tilt);
    } else {
      if (!A.resultDone) {
        A.resultDone = true;
        A.result = (Math.random() < A.chance) ? 'caught' : 'escaped';
        if (A.result === 'caught') {
          fxStarsBurst(A.to, 18);
          // Retirée tout de suite : le modèle est déjà invisible (aspiré
          // pendant la phase des secousses) — inutile d'attendre la fin du
          // scintillement de la Ball pour rendre sa tuile disponible, et ça
          // évite qu'un second lancer sur la même référence (avant la fin du
          // flourish) ne se heurte à un roamer « fantôme » encore marqué
          // occupé par une Ball.
          if (A.roamer) { A.roamer._ball = false; remove(A.roamer); }
        } else {
          fxSparkle(A.to, '#e8eef4', 10);
        }
        if (A.cb) { try { A.cb(A.result); } catch (e) { warn('callback throwBall', e); } }
      }
      var rt = (A.t - T_RESULT) / 1000;
      if (A.result === 'caught') {
        _ball.position.set(A.to.x, A.to.y + Math.min(0.2, rt * 0.5), A.to.z);
        _ball.rotation.y += dt * 3;
        if (rt > 0.9 && !A.done) { A.done = true; _ball.visible = false; _ballAnim = null; }
      } else {
        if (rt > 0.35 && !A.done) { A.done = true; _ball.visible = false; finishThrow(); }
      }
    }
  }

  // ===========================================================================
  //  API PUBLIQUE (§16)
  // ===========================================================================

  function build(scene) {
    _scene = scene || null;
    if (!_scene || !THREE_OK) return;
    try {
      _ball = buildBallGroup();
      _scene.add(_ball);
    } catch (e) { warn('construction de la Pokéball', e); _ball = null; }
  }

  function setRegion(regionId) {
    // On repart de zéro visuellement, mais on GARDE les cooldowns de
    // légendaires : sinon quitter puis revenir dans la même région ferait
    // réapparaître instantanément celui qui vient de fuir ou d'être capturé.
    for (var i = 0; i < _roamers.length; i++) disposeGroup(_roamers[i].group);
    _roamers.length = 0;
    _legendary = null;
    _spawnClock = 0;
    if (_ballAnim && _ball) _ball.visible = false;
    _ballAnim = null;
    while (_fx.length) {
      var e = _fx.pop();
      if (e.group && e.group.parent) e.group.parent.remove(e.group);
      if (e.mats) for (var m = 0; m < e.mats.length; m++) e.mats[m].dispose();
    }
    _regionId = regionId || null;
    // Nouvelle région : les PNJ de l'ancienne n'existent plus, ceux d'ici n'ont
    // rien vu. On repart d'une page blanche.
    calmActors();
  }

  function update(t, dt, px, pz) {
    if (!_scene || !_regionId) return;
    px = (typeof px === 'number' && isFinite(px)) ? px : _lastPX;
    pz = (typeof pz === 'number' && isFinite(pz)) ? pz : _lastPZ;
    _lastPX = px; _lastPZ = pz;
    var dtMs = (typeof dt === 'number' && isFinite(dt)) ? dt * 1000 : 16;
    var tt = (typeof t === 'number' && isFinite(t)) ? t : (R3.clock ? R3.clock.t : 0);

    var R = regionsApi();
    if (!R) { updateBallAnim(dt || 0); updateFx(dt || 0); return; }
    var DEX = dexApi();

    var playerTx = Math.round(px), playerTy = Math.round(pz);
    var vd = (R3.quality && R3.quality.viewDistance) || 46;

    // --- 1. déplacement + culling + animation d'attente -----------------------
    var i, ro;
    for (i = 0; i < _roamers.length; i++) {
      ro = _roamers[i];
      if (!ro.legendary && !ro._ball) stepRoamer(ro, dtMs, playerTx, playerTy);

      var h = heightAt(ro.x, ro.z);
      ro.group.position.set(ro.x, h, ro.z);
      var dv = DIR_VEC[ro.dir] || DIR_VEC.down;
      ro.group.rotation.y = dv.ry;

      var dist = Math.hypot(ro.x - px, ro.z - pz);
      var visible = dist <= vd;
      ro.group.visible = visible;
      // Culling : on n'anime (idle + aura) JAMAIS un modèle hors champ — un
      // roamer pèse une trentaine de meshes, une légendaire jusqu'à 90 (§16).
      if (visible) {
        if (ro.legendary) {
          var LL = llibApi();
          if (LL && typeof LL.animateAura === 'function') {
            try { LL.animateAura(ro.group, tt); } catch (e) { /* aura optionnelle */ }
          }
        }
        try { R3.idleCreature(ro.group, tt, ro._phase); } catch (e) { /* anim de repli déjà tolérante */ }
      }
    }

    // --- 2. rencontres non voulues (hautes herbes, collision directe) --------
    if (_encounterCbs.length) {
      for (i = 0; i < _roamers.length; i++) {
        ro = _roamers[i];
        if (ro.legendary || ro._ball) continue;
        var dx = ro.x - px, dz = ro.z - pz;
        if (dx * dx + dz * dz <= ENCOUNTER_DIST * ENCOUNTER_DIST) {
          if (!ro._encountered) {
            ro._encountered = true;
            for (var k = 0; k < _encounterCbs.length; k++) {
              try { _encounterCbs[k](ro); } catch (e) { warn('onEncounter', e); }
            }
          }
        } else {
          ro._encountered = false;
        }
      }
    }

    // --- 3. peuplement (au plus une fois toutes les SPAWN_INTERVAL s) --------
    if (DEX) {
      _spawnClock += (dt || 0);
      if (_spawnClock >= SPAWN_INTERVAL) {
        _spawnClock = 0;
        try { maintainPopulation(R, DEX, px, pz); } catch (e) { warn('peuplement', e); }
      }
    }

    // --- 4. recyclage des créatures trop loin ---------------------------------
    for (i = _roamers.length - 1; i >= 0; i--) {
      ro = _roamers[i];
      if (ro.legendary || ro._ball) continue;
      if (Math.hypot(ro.x - px, ro.z - pz) > DESPAWN_DIST) removeInternal(ro);
    }

    // --- 5. légendaire de la région -------------------------------------------
    try { updateLegendary(tt, px, pz); } catch (e) { warn('légendaire', e); }

    // --- 5 bis. l'étonnement des PNJ (v3 §10) ---------------------------------
    // Après updateLegendary : un légendaire qui vient d'apparaître fait réagir
    // le village dès la même image.
    signalLegend();

    // --- 6. lancer de Pokéball en cours + petits effets -----------------------
    updateBallAnim(dt || 0);
    updateFx(dt || 0);
  }

  function list() { return _roamers.slice(); }

  /** Le roamer visé par le joueur : dans le cône de son regard, à portée. */
  function aimed(px, pz, dir, range) {
    var r = (typeof range === 'number' && isFinite(range)) ? range : 2.2;
    var dv = DIR_VEC[dir] || DIR_VEC.down;
    var fx = dv.dx, fz = dv.dy;   // vecteur unitaire du regard, dans le plan (x,z)
    var best = null, bestScore = -1;
    for (var i = 0; i < _roamers.length; i++) {
      var ro = _roamers[i];
      if (ro._ball) continue;
      var vx = ro.x - px, vz = ro.z - pz;
      var dist = Math.hypot(vx, vz);
      if (dist < 0.05 || dist > r) continue;
      var nx = vx / dist, nz = vz / dist;
      var dot = nx * fx + nz * fz;        // alignement avec le regard du joueur
      if (dot < 0.55) continue;            // cône d'environ ±56°
      var score = dot - dist * 0.03;       // priorité à l'alignement, la distance départage
      if (score > bestScore) { bestScore = score; best = ro; }
    }
    return best;
  }

  function nearest(px, pz, maxDist) {
    var md = (typeof maxDist === 'number' && isFinite(maxDist)) ? maxDist : Infinity;
    var best = null, bestD = Infinity;
    for (var i = 0; i < _roamers.length; i++) {
      var ro = _roamers[i];
      if (ro._ball) continue;
      var d = Math.hypot(ro.x - px, ro.z - pz);
      if (d <= md && d < bestD) { bestD = d; best = ro; }
    }
    return best;
  }

  function onEncounter(fn) { if (typeof fn === 'function') _encounterCbs.push(fn); }

  R3.register('roamers', {
    build: build,
    setRegion: setRegion,
    update: update,
    list: list,
    aimed: aimed,
    nearest: nearest,
    throwBall: throwBall,
    remove: remove,
    onEncounter: onEncounter,
  });
})();
