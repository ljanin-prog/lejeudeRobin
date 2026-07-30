// =============================================================================
//  game3d.js — CONTRÔLEUR du « Jeu de Robin » en 3D  (CONTRACT2.md §19)
// =============================================================================
//  C'est le chef d'orchestre : il ne dessine presque rien lui-même, il fait
//  jouer ensemble la vingtaine de modules js3d/*. Il assure :
//
//    • la machine à états  title / starter / world / battle / team / dex /
//      map / airship / transition ;
//    • le déplacement à la tuile, les collisions et les rencontres, contre
//      `R3.get('regions')` (qui remplace js/world.js pour la 3D) ;
//    • les tuiles spéciales : PORTAL (changement de région), AIRSHIP_DOCK
//      (voyage en dirigeable), ARENA_DOOR (défi de champion), HEAL_DOOR
//      (centre de soins), SHOP_DOOR, SIGN ;
//    • le lancer de Pokéball en monde ouvert (touche B) via `roamers3d` ;
//    • les combats : construction du `battleState` du §17, tours, IA, XP,
//      capture, badges ;
//    • la sauvegarde `robinGame3d_v1`, avec import UNIQUE depuis la
//      sauvegarde 2D `robinGame_v2` au tout premier lancement ;
//    • l'auto-qualité, mesurée sur le TEMPS DE TRAVAIL d'une frame (budget
//      14 ms), jamais sur le FPS.
//
//  RÈGLE ABSOLUE — aucune exception au chargement, même si la moitié des
//  modules manque : tout passe par `mod()` (accès tolérant) et `safeCall()`
//  (isolation d'erreur avec désactivation définitive de l'appel fautif).
//
//  Le jeu 2D (`js/`) n'est JAMAIS modifié, et sa sauvegarde jamais réécrite :
//  on la lit une seule fois, en lecture seule.
// =============================================================================

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  //  CONSTANTES DE JEU
  // ---------------------------------------------------------------------------
  const MOVE_DURATION_MS = 160;   // durée d'un pas d'une tuile (jeu 2D d'origine)
  // Rencontres INVISIBLES en hautes herbes : désactivées (0 = jamais).
  // Robin en avait assez d'être arrêté toutes les cinq secondes par une
  // créature surgie de nulle part. Désormais on n'affronte QUE les créatures
  // qu'on voit se balader sur la carte (roamers3d.js) : on les approche, on
  // leur parle avec Espace ou on leur lance une Ball avec B. Remettre une
  // valeur > 0 ici suffirait à réactiver l'ancien comportement.
  const ENCOUNTER_CHANCE = 0;
  // Distance (en tuiles) au-delà de laquelle on cesse d'afficher un PNJ : ils
  // sont articulés (≈ 34 meshes chacun), donc coûteux, et dispersés.
  const DIST_PNJ = 24;

  const SAVE_KEY = 'robinGame3d_v1';
  const OLD_SAVE_KEY = 'robinGame_v2';   // sauvegarde du jeu 2D — LECTURE SEULE

  const START_REGION = 'val';
  const START_X = 24, START_Y = 30;      // §3 : départ de la partie

  const FADE_MS = 320;            // durée d'un demi-fondu de transition
  const BALL_RANGE = 3.4;         // portée du lancer de Ball en monde ouvert

  // Vue FPS : ←/→ ne déplacent plus, elles font pivoter sur place. Une touche
  // maintenue enchaîne un quart de tour toutes les FPS_TURN_MS.
  const FPS_TURN_MS = 200;
  const TURN_ORDER = ['up', 'right', 'down', 'left'];   // sens des aiguilles
  const DIR_STEP = {
    up: { dx: 0, dz: -1 }, down: { dx: 0, dz: 1 },
    left: { dx: -1, dz: 0 }, right: { dx: 1, dz: 0 },
  };

  // Caméra de REPLI, utilisée seulement si camera3d.js est absent : 3e
  // personne, orientation fixe (un enfant ne doit jamais se perdre).
  const CAM_BACK = 11;
  const CAM_HEIGHT = 9;
  const CAM_LOOK_AHEAD = 1.6;
  const ZOOM_MIN = 0.60;
  const ZOOM_MAX = 1.70;

  // js/audio.js ne contient que 7 pistes (forest, lake, plain, beach, sea,
  // park, city). Tous les autres biomes — les 3 anciens sans piste et les 8
  // nouveaux du §5 — sont rabattus ici sur la piste la plus proche en
  // ambiance. Sans cette table, la moitié du monde serait silencieuse.
  const MUSIC_FALLBACK = {
    mountain: 'forest',
    village: 'plain',
    city2: 'city',
    jungle: 'forest',     // même luxuriance, même flûte
    swamp: 'lake',        // eau stagnante : les nappes du lac collent bien
    volcano: 'city',      // la piste la plus grave et la plus martiale
    desert: 'beach',      // chaleur et sable
    glacier: 'sea',       // notes cristallines et lentes
    celestial: 'park',    // la plus lumineuse et la plus aérienne
    coast: 'beach',
    citadel: 'city',
  };

  // Bonus de capture par Ball (§11).
  const BALL_BONUS = { pokeball: 1.0, superball: 1.5, hyperball: 2.2, ballmaitresse: 99 };

  // ---------------------------------------------------------------------------
  //  ÉTAT DU JEU — c'est aussi ce que lit hud3d.js via window.GAME3D.state
  // ---------------------------------------------------------------------------
  const state = {
    screen: 'title',   // title|starter|world|battle|team|dex|map|airship|transition
    playerName: '',
    regionId: START_REGION,
    starterCursor: 0,
    player: {
      tileX: START_X, tileY: START_Y,
      worldX: START_X, worldY: 0, worldZ: START_Y,
      dir: 'down',
      moving: false,
      moveProgress: 0,
      moveFromX: START_X, moveFromY: START_Y,
      moveToX: START_X, moveToY: START_Y,
    },
    zoom: 1,           // seulement pour la caméra de repli
    input: { up: false, down: false, left: false, right: false },
    messages: [],
    battle: null,
    // --- progression, tout ce qui part dans la sauvegarde -------------------
    collection: {},          // { speciesId: nombre de captures }
    seen: {},                // { speciesId: true }
    badges: {},              // { regionId: true }
    defeatedTrainers: {},    // { npcId: true }
    items: { pokeball: 20, superball: 0, hyperball: 0, potion: 5 },
    visitedRegions: { val: true },   // `val` est visitée d'office (§17 bis)
    cameraMode: 'aventure',
    // --- éphémère ------------------------------------------------------------
    tick: 0,
    lastBiome: null,
    transition: null,        // { phase:'out'|'in', t, to, toX, toY, label }
    aimed: null,             // roamer visé (pour le viseur du HUD)
    throwing: false,         // un lancer de Ball est en cours
  };

  // ---------------------------------------------------------------------------
  //  Variables de rendu
  // ---------------------------------------------------------------------------
  let canvas = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let playerGroup = null;
  let npcEntries = [];      // [{ group, npc }] — reconstruits à chaque région
  let bangMarker = null;    // le « ! » au-dessus d'un PNJ à qui l'on peut parler
  let fallbackSun = null;   // soleil de secours si sky3d.js est absent
  let fadeEl = null;        // voile noir des transitions de région
  let started = false;
  let lastTime = 0;
  let fpsTurnT = 0;         // minuterie de rotation sur place (vue FPS)

  const camPos = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
  const camAim = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;

  // ---------------------------------------------------------------------------
  //  Accès tolérant aux modules — aucun n'est obligatoire.
  // ---------------------------------------------------------------------------
  function mod(name) {
    try { return R3.get(name); } catch (e) { return undefined; }
  }

  const _broken = Object.create(null);
  /** Appelle fn() en isolant les erreurs : au premier échec, l'appel est
   *  désactivé pour de bon (pas de console noyée, pas de jeu bloqué). */
  function safeCall(key, fn) {
    if (_broken[key]) return undefined;
    try {
      return fn();
    } catch (e) {
      _broken[key] = true;
      console.error('[game3d] « ' + key + ' » désactivé après une erreur :', e);
      return undefined;
    }
  }

  /** Petit raccourci : appelle une méthode d'un module si elle existe. */
  function call(modName, fnName, args) {
    const m = mod(modName);
    if (!m || typeof m[fnName] !== 'function') return undefined;
    return safeCall(modName + '.' + fnName, function () {
      return m[fnName].apply(m, args || []);
    });
  }

  /** Les bruitages du jeu 2D, sans jamais planter si Audio_ manque. */
  function sfx(name) {
    try { if (typeof Audio_ !== 'undefined' && Audio_.sfx && Audio_.sfx[name]) Audio_.sfx[name](); }
    catch (e) { /* audio indisponible : le jeu continue */ }
  }

  // ===========================================================================
  //  1. INITIALISATION
  // ===========================================================================

  function init() {
    canvas = document.getElementById('game');
    if (!canvas) { console.error('[game3d] canvas #game introuvable.'); return; }

    initRenderer();
    initScene();
    buildFade();
    buildModules();
    bindEvents();

    loadGame();                 // peut importer l'ancienne sauvegarde 2D
    applyRegion(state.regionId, { silent: true });
    refreshHudCounters();
    refreshCompass();
    call('hud', 'setViewMode', [viewMode()]);
    updateMuteButton(typeof Audio_ !== 'undefined' && Audio_.isMuted && Audio_.isMuted());

    // Position de départ de la caméra : déjà en place, sans glissement.
    updatePlayerTransform(0);
    updateCamera(1e9);

    started = true;
    requestAnimationFrame(frame);
  }

  function initRenderer() {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, R3.quality.pixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // API Three r155 : outputColorSpace (et non plus outputEncoding).
    if (THREE.SRGBColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = R3.quality.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Filet de sécurité : si la feuille de style n'a pas (encore) positionné le
    // canvas, on le met nous-mêmes en plein écran derrière l'interface.
    try {
      const cs = window.getComputedStyle(canvas);
      if (cs.position === 'static') {
        canvas.style.position = 'fixed';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.zIndex = '0';
      }
      canvas.style.display = 'block';
    } catch (e) { /* sans importance */ }
  }

  function initScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      50, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 500
    );
    camera.position.set(START_X, CAM_HEIGHT, START_Y + CAM_BACK);
  }

  /** Voile noir des transitions de région : un simple div, créé à la volée
   *  pour ne pas avoir à toucher index3d.html. */
  function buildFade() {
    try {
      fadeEl = document.createElement('div');
      fadeEl.id = 'region-fade';
      fadeEl.style.cssText = 'position:fixed;inset:0;background:#0a0c18;opacity:0;' +
        'pointer-events:none;z-index:80;transition:none;display:none;';
      document.body.appendChild(fadeEl);
    } catch (e) { fadeEl = null; }
  }

  function setFade(alpha) {
    if (!fadeEl) return;
    const a = Math.max(0, Math.min(1, alpha));
    fadeEl.style.opacity = String(a);
    fadeEl.style.display = a <= 0.001 ? 'none' : 'block';
  }

  function buildModules() {
    // --- Ciel, soleil, brouillard ---
    const sky = mod('sky');
    if (sky && sky.build) safeCall('sky.build', function () { sky.build(scene); });
    if (!sky || _broken['sky.build']) buildFallbackSky();

    // --- Terrain et décors (le contenu vient au premier applyRegion) ---
    const world = mod('world');
    if (world && world.build) safeCall('world.build', function () { world.build(scene); });
    else { console.warn('[game3d] module « world » absent : sol de secours.'); buildFallbackGround(); }
    if (_broken['world.build']) buildFallbackGround();

    // --- Joueur ---
    const actors = mod('actors');
    playerGroup = (actors && actors.buildPlayer)
      ? safeCall('actors.buildPlayer', function () { return actors.buildPlayer(); })
      : null;
    if (!playerGroup) playerGroup = buildFallbackPlayer();
    scene.add(playerGroup);

    // --- Marqueur « ! » de dialogue ---
    bangMarker = buildBangMarker();
    bangMarker.visible = false;
    scene.add(bangMarker);

    // --- Phares des portes, du port et de la ville (repères visibles de loin) ---
    call('gates', 'build', [scene]);

    // --- Créatures qui se baladent sur la carte ---
    call('roamers', 'build', [scene]);
    const roamers = mod('roamers');
    if (roamers && roamers.onEncounter) {
      safeCall('roamers.onEncounter', function () {
        roamers.onEncounter(function (roamer) { onRoamerTouch(roamer); });
      });
    }

    // --- Dirigeable : il prend la caméra et le joueur pendant le vol, et
    //     c'est LUI qui nous dit quand charger la région (onMidFlight). ---
    call('airship', 'build', [scene, camera]);
    call('airship', 'setPlayer', [playerGroup]);
    const airship = mod('airship');
    if (airship && airship.onMidFlight) {
      safeCall('airship.onMidFlight', function () {
        airship.onMidFlight(function (from, to) {
          // On est au-dessus des nuages : le chargement (~150 ms) est masqué.
          loadRegionData(to);
        });
      });
    }

    // --- Caméra à deux vues ---
    call('camera', 'init', [camera]);

    // --- Interface ---
    const hud = mod('hud');
    if (hud && hud.init) safeCall('hud.init', function () { hud.init(); });
    else console.warn('[game3d] module « hud » absent : interface minimale.');
    if (hud && hud.onStarterPick) {
      safeCall('hud.onStarterPick', function () {
        hud.onStarterPick(function (i) { state.starterCursor = i; confirmStarter(); });
      });
    }
  }

  /** Ciel/lumière de secours si sky3d.js manque : il faut TOUJOURS y voir clair. */
  function buildFallbackSky() {
    const mood = R3.biomeMood('plain');
    scene.background = new THREE.Color(mood.sky);
    scene.fog = new THREE.FogExp2(new THREE.Color(mood.fog), R3.quality.fogDensity);

    const hemi = new THREE.HemisphereLight(0xcfeaff, 0x4c7a3c, 0.85);
    const sun = new THREE.DirectionalLight(new THREE.Color(mood.sun), 1.5);
    sun.position.set(18, 30, 12);
    sun.castShadow = R3.quality.shadows;
    sun.shadow.mapSize.set(R3.quality.shadowSize, R3.quality.shadowSize);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0008;
    scene.add(hemi, sun, sun.target);
    fallbackSun = sun;
  }

  /** Sol plat de secours si world3d.js manque : mieux qu'un écran vide. */
  function buildFallbackGround() {
    const g = new THREE.Mesh(R3.geo.plane(800, 800), R3.mat('#63b846', { rough: 1 }));
    g.rotation.x = -Math.PI / 2;
    g.position.set(192, 0, 112);
    g.receiveShadow = true;
    scene.add(g);
  }

  /** Silhouette de joueur de secours si actors3d.js manque. */
  function buildFallbackPlayer() {
    return R3.group(
      R3.cyl(0.17, 0.21, 0.44, '#41a6f6', 0, 0.30, 0),
      R3.sphere(0.19, '#ffd9a8', 0, 0.66, 0),
      R3.sphere(0.21, '#6b4423', 0, 0.72, -0.02)
    );
  }

  /** Bulle « ! » qui flotte au-dessus d'un PNJ à qui l'on peut parler. */
  function buildBangMarker() {
    const g = R3.group(
      R3.ellipsoid(0.24, 0.24, 0.20, '#fcec6c', 0, 0, 0,
        { rough: 0.5, emissive: '#f1c40f', emissiveIntensity: 0.35 }),
      R3.box(0.055, 0.16, 0.05, '#1a1c2c', 0, 0.045, 0.19),
      R3.box(0.055, 0.055, 0.05, '#1a1c2c', 0, -0.085, 0.19)
    );
    R3.noShadow(g);
    return g;
  }

  // ===========================================================================
  //  2. ÉVÉNEMENTS
  // ===========================================================================

  function bindEvents() {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', startGame);

    const nameInput = document.getElementById('name-input');
    if (nameInput) {
      nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); startGame(); }
      });
    }

    const closeCol = document.getElementById('close-collection');
    if (closeCol) closeCol.addEventListener('click', function () { closeOverlays(); });

    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) muteBtn.addEventListener('click', toggleMute);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', releaseAllKeys);
    window.addEventListener('wheel', onWheel, { passive: false });
  }

  function onResize() {
    if (!renderer || !camera) return;
    const w = window.innerWidth, h = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, R3.quality.pixelRatio));
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    call('battle', 'onResize', [w, h]);
  }

  /** Molette = zoom. camera3d gère ses propres bornes par vue ; en repli, on
   *  garde les bornes historiques. */
  function onWheel(e) {
    if (state.screen !== 'world') return;
    e.preventDefault();
    const step = (e.deltaY > 0 ? 1 : -1) * 0.09;
    const cam = mod('camera');
    if (cam && cam.zoom) { safeCall('camera.zoom', function () { cam.zoom(step); }); return; }
    state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom + step));
  }

  function releaseAllKeys() {
    state.input.up = state.input.down = state.input.left = state.input.right = false;
  }

  // ===========================================================================
  //  3. ENTRÉES CLAVIER (§19)
  //     Flèches/ZQSD · Espace · B · E · C · N · V · Shift+←/→ · M · Échap
  // ===========================================================================

  function onKeyDown(e) {
    // Pendant un vol ou un fondu, c'est le module concerné qui a la main
    // (airship3d capture Espace tout seul pour sauter la cinématique).
    if (state.screen === 'title' || state.screen === 'transition') return;

    // --- Menu du dirigeable : il se pilote AUSSI au clavier ------------------
    // Sans ça, on pouvait rester bloqué dedans (aucune touche ne répondait,
    // pas même Échap) — c'est ce qui rendait le dirigeable inutilisable.
    if (state.screen === 'airship') { onAirshipKey(e); return; }

    // --- Écran de sélection du compagnon de départ ---------------------------
    if (state.screen === 'starter') {
      if (state.messages.length > 0) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advanceMessage(); }
        return;
      }
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': case 'q': case 'Q':
          e.preventDefault(); moveStarterCursor(-1); break;
        case 'ArrowRight': case 'd': case 'D':
          e.preventDefault(); moveStarterCursor(1); break;
        case ' ': case 'Enter':
          e.preventDefault(); confirmStarter(); break;
      }
      return;
    }

    // --- Combat ---------------------------------------------------------------
    if (state.screen === 'battle') { onBattleKey(e); return; }

    // --- Overlays (équipe / Pokédex / carte) ---------------------------------
    // hud3d.js gère lui-même les flèches de l'écran ÉQUIPE et referme les
    // overlays sur Échap (en rejouant un faux Échap pour nous prévenir) : ici
    // on se contente de resynchroniser `state.screen`.
    if (state.screen === 'team' || state.screen === 'dex' || state.screen === 'map') {
      const k = e.key;
      const ferme = (k === 'Escape')
        || (state.screen === 'team' && (k === 'e' || k === 'E'))
        || (state.screen === 'dex' && (k === 'c' || k === 'C'))
        || (state.screen === 'map' && (k === 'n' || k === 'N' || k === ' '));
      if (ferme) { e.preventDefault(); closeOverlays(); }
      return;
    }

    // --- Monde ouvert ---------------------------------------------------------
    // Shift + ←/→ : pivoter la vue RPG. À tester AVANT le déplacement.
    if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      call('camera', 'rotate', [e.key === 'ArrowLeft' ? -1 : 1]);
      return;
    }

    switch (e.key) {
      case 'ArrowUp': case 'w': case 'z': case 'W': case 'Z':
        e.preventDefault(); state.input.up = true; break;
      case 'ArrowDown': case 's': case 'S':
        e.preventDefault(); state.input.down = true; break;
      case 'ArrowLeft': case 'a': case 'q': case 'A': case 'Q':
        e.preventDefault(); state.input.left = true; break;
      case 'ArrowRight': case 'd': case 'D':
        e.preventDefault(); state.input.right = true; break;
      case ' ': case 'Enter':
        e.preventDefault(); onAction(); break;
      case 'b': case 'B':
        e.preventDefault(); throwBallInWorld(); break;
      case 'e': case 'E':
        e.preventDefault(); openTeamScreen(); break;
      case 'c': case 'C':
        e.preventDefault(); openDexScreen(); break;
      case 'n': case 'N':
        e.preventDefault(); openMapScreen(); break;
      case 'v': case 'V':
        e.preventDefault(); toggleView(); break;
      case 't': case 'T':
        // Appeler le dirigeable de n'importe où : c'est LE moyen de voyager.
        e.preventDefault(); callAirship(); break;
      case 'm': case 'M':
        e.preventDefault(); toggleMute(); break;
      case 'Escape':
        e.preventDefault(); closeOverlays(); break;
    }
  }

  function onKeyUp(e) {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'z': case 'W': case 'Z':
        state.input.up = false; break;
      case 'ArrowDown': case 's': case 'S':
        state.input.down = false; break;
      case 'ArrowLeft': case 'a': case 'q': case 'A': case 'Q':
        state.input.left = false; break;
      case 'ArrowRight': case 'd': case 'D':
        state.input.right = false; break;
    }
  }

  /** Espace / Entrée en monde ouvert. */
  function onAction() {
    if (state.messages.length > 0) { advanceMessage(); return; }
    if (state.screen !== 'world' || state.player.moving) return;

    // 1. Un PNJ juste devant ?
    const front = getTileInFront();
    const npc = npcAt(front.x, front.y);
    if (npc) { talkToNPC(npc); return; }

    // 2. Une créature de la carte juste devant ? Espace = vrai combat (§16).
    const roamer = aimedRoamer();
    if (roamer) { startRoamerBattle(roamer); return; }

    // 3. Un panneau ?
    const poi = poiAt(front.x, front.y);
    if (poi && poi.kind === 'sign') {
      sfx('menu');
      showMessage('📜 ' + (poi.label || 'Panneau') +
        (poi.data && poi.data.text ? '\n' + poi.data.text : ''));
    }
  }

  /** Nom de la vue courante : 'aventure' | 'rpg' | 'fps' (repli : 'aventure'). */
  function viewMode() {
    const cam = mod('camera');
    if (!cam || !cam.frame) return 'aventure';
    const f = safeCall('camera.frame', function () { return cam.frame(); });
    return (f && f.mode) || 'aventure';
  }

  function isFpsView() { return viewMode() === 'fps'; }

  const VIEW_LABEL = {
    aventure: 'Vue aventure — de dos',
    rpg: 'Vue RPG — vue de dessus',
    fps: 'Vue à la première personne — ←/→ pour tourner',
  };

  function toggleView() {
    const cam = mod('camera');
    if (!cam || !cam.toggle) { showToast('Une seule vue disponible.', '🧭'); return; }
    safeCall('camera.toggle', function () { cam.toggle(); });
    state.cameraMode = (cam.mode && cam.mode()) || state.cameraMode;
    fpsTurnT = 0;
    showToast(VIEW_LABEL[state.cameraMode] || 'Vue changée', '🧭');
    call('hud', 'setViewMode', [state.cameraMode]);
    saveGame();
  }

  function toggleMute() {
    let muted = false;
    try { muted = Audio_.toggleMute(); } catch (e) { return; }
    updateMuteButton(muted);
    call('hud', 'setMuted', [muted]);
  }

  function updateMuteButton(muted) {
    const btn = document.getElementById('mute-btn');
    if (!btn) return;
    btn.classList.toggle('muted', !!muted);
    btn.textContent = muted ? '♪̸' : '♪';
    btn.setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son');
  }

  function showToast(text, icon) { call('hud', 'toast', [text, icon]); }

  /**
   * Rafraîchit la mini-carte permanente du HUD (« où suis-je ? »). On ne
   * l'appelle PAS à chaque image : la position ne change qu'à la fin d'un pas,
   * d'un demi-tour ou d'un changement de région.
   */
  function refreshCompass() {
    const hud = mod('hud');
    if (!hud || !hud.setCompass) return;
    call('hud', 'setCompass', [{
      regionId: state.regionId,
      regionName: regionName(state.regionId),
      x: state.player.tileX,
      y: state.player.tileY,
      dir: state.player.dir,
      biome: state.lastBiome,
      visible: state.screen === 'world',
    }]);
  }

  // ===========================================================================
  //  4. BOUCLE PRINCIPALE
  // ===========================================================================

  function frame(timestamp) {
    requestAnimationFrame(frame);
    if (!started) return;

    if (!lastTime) lastTime = timestamp;
    const rawMs = Math.max(0.1, timestamp - lastTime);
    lastTime = timestamp;
    const dtMs = Math.min(50, rawMs);   // dt borné, comme dans le jeu 2D

    const tWork0 = performance.now();
    tickGame(dtMs);

    // On juge la qualité sur le TEMPS DE TRAVAIL réel de la frame, jamais sur
    // le FPS : celui-ci est plafonné par le vsync et bridé quand la fenêtre
    // n'est pas au premier plan — s'y fier dégraderait le jeu pour rien.
    measurePerf(rawMs, performance.now() - tWork0);
  }

  /**
   * UNE image de jeu : logique, monde, rendu. Séparée de `frame()` pour être
   * appelable à la main (`window.GAME3D.tick(16.7)`) — indispensable pour
   * tester le jeu dans un onglet piloté par l'automatisation, où
   * `requestAnimationFrame` peut ne JAMAIS se déclencher.
   */
  function tickGame(dtMs) {
    R3.tickClock(dtMs);
    const dt = R3.clock.dt;
    const t = R3.clock.t;
    state.tick++;

    // --- Logique ---
    if (state.screen === 'world') updateWorld(dtMs);
    else if (state.screen === 'battle') updateBattle(dtMs);
    else if (state.screen === 'transition') updateTransition(dtMs);

    // --- Monde 3D (toujours animé : il sert de décor à l'écran titre) ---
    updatePlayerTransform(dt);
    updateCamera(dt);
    updateSceneModules(t, dt);

    // --- Rendu ---
    const battle = mod('battle');
    let rendered = false;
    if (state.screen === 'battle' && battle && battle.render) {
      if (battle.update) safeCall('battle.update', function () { battle.update(dt, state.battle); });
      rendered = safeCall('battle.render', function () { battle.render(renderer); return true; }) === true;
    }
    if (!rendered) renderer.render(scene, camera);
  }

  function updateSceneModules(t, dt) {
    const px = state.player.worldX, pz = state.player.worldZ;

    call('world', 'update', [t, px, pz]);
    call('water', 'update', [t]);
    call('sky', 'update', [t, px, pz]);
    call('citybuild', 'update', [t]);
    call('airship', 'update', [t, dt]);
    call('gates', 'update', [t, px, pz]);

    // Les créatures de la carte ne vivent que dans le monde ouvert.
    if (state.screen === 'world' || state.screen === 'title' || state.screen === 'starter') {
      call('roamers', 'update', [t, dt, px, pz]);
    }

    // Soleil de secours : on le garde centré sur le joueur pour que l'ombre suive.
    if (fallbackSun) {
      fallbackSun.position.set(px + 18, 30, pz + 12);
      fallbackSun.target.position.set(px, 0, pz);
      fallbackSun.target.updateMatrixWorld();
    }

    // PNJ : petite animation d'attente, avec culling par distance.
    const actors = mod('actors');
    if (actors && actors.updateNPC && npcEntries.length) {
      safeCall('actors.updateNPC', function () {
        const limite = Math.min(R3.quality.viewDistance, DIST_PNJ);
        for (let i = 0; i < npcEntries.length; i++) {
          const e = npcEntries[i];
          if (!e.npc) continue;
          const d = Math.abs(e.npc.x - px) + Math.abs(e.npc.y - pz);
          const proche = d <= limite;
          if (e.group.visible !== proche) e.group.visible = proche;
          if (!proche) continue;
          actors.updateNPC(e.group, e.npc, t);
        }
      });
    }

    updateBangMarker(t);
    updateAimReticle();
  }

  /** Le « ! » au-dessus du PNJ juste devant le joueur. */
  function updateBangMarker(t) {
    if (!bangMarker) return;
    if (state.screen !== 'world' || state.player.moving) { bangMarker.visible = false; return; }
    const front = getTileInFront();
    const npc = npcAt(front.x, front.y);
    if (!npc) { bangMarker.visible = false; return; }
    bangMarker.visible = true;
    bangMarker.position.set(npc.x, groundHeight(npc.x, npc.y) + 1.55 + Math.sin(t * 3.4) * 0.07, npc.y);
    bangMarker.rotation.y = Math.sin(t * 1.6) * 0.18;
  }

  /** Viseur de Pokéball : quand une créature est à portée devant le joueur. */
  function updateAimReticle() {
    if (state.screen !== 'world') {
      if (state.aimed) { state.aimed = null; call('hud', 'showAimReticle', [null]); }
      return;
    }
    const r = aimedRoamer();
    if (r === state.aimed) return;
    state.aimed = r;
    call('hud', 'showAimReticle', [r || null]);
  }

  // ===========================================================================
  //  5. MONDE OUVERT — déplacement à la tuile
  // ===========================================================================

  function regions() { return mod('regions'); }

  function isWalkable(x, y) {
    const R = regions();
    if (!R || !R.isWalkable) return true;
    const v = safeCall('regions.isWalkable', function () { return R.isWalkable(x, y); });
    return v !== false;
  }

  function isEncounterTile(x, y) {
    const R = regions();
    if (!R || !R.isEncounter) return false;
    return safeCall('regions.isEncounter', function () { return R.isEncounter(x, y); }) === true;
  }

  function biomeAt(x, y) {
    const R = regions();
    if (!R || !R.biomeAt) return 'plain';
    return safeCall('regions.biomeAt', function () { return R.biomeAt(x, y); }) || 'plain';
  }

  function tileAt(x, y) {
    const R = regions();
    if (!R || !R.tileAt) return '';
    return safeCall('regions.tileAt', function () { return R.tileAt(x, y); }) || '';
  }

  function poiAt(x, y) {
    const R = regions();
    if (!R || !R.poiAt) return null;
    return safeCall('regions.poiAt', function () { return R.poiAt(x, y); }) || null;
  }

  function npcAt(x, y) {
    for (let i = 0; i < npcEntries.length; i++) {
      const n = npcEntries[i].npc;
      if (n && n.x === x && n.y === y) return n;
    }
    return null;
  }

  function getTileInFront() {
    let dx = 0, dy = 0;
    switch (state.player.dir) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
    }
    return { x: state.player.tileX + dx, y: state.player.tileY + dy };
  }

  /**
   * Commande brute (haut/bas/gauche/droite) tournée selon l'orientation de la
   * caméra. En vue « aventure », `yaw` vaut toujours 0 : rien ne change. En vue
   * RPG après une rotation, « haut » doit rester « vers le haut de l'écran » —
   * c'est la recette donnée par le bandeau de camera3d.js.
   */
  function rotateCommand(dx, dz) {
    const cam = mod('camera');
    if (!cam || !cam.frame) return { dx: dx, dz: dz };
    const f = safeCall('camera.frame', function () { return cam.frame(); });
    if (!f) return { dx: dx, dz: dz };
    const a = f.rotating ? f.yawTarget : f.yaw;
    if (!a) return { dx: dx, dz: dz };
    const c = Math.cos(a), s = Math.sin(a);
    // `a` est un multiple exact de π/2 : on arrondit pour effacer l'erreur de
    // virgule flottante et rester sur une commande à la tuile.
    return { dx: Math.round(dx * c + dz * s), dz: Math.round(-dx * s + dz * c) };
  }

  function dirOf(dx, dz) {
    if (dz < 0) return 'up';
    if (dz > 0) return 'down';
    if (dx < 0) return 'left';
    return 'right';
  }

  /** Vue FPS : ←/→ font pivoter le joueur d'un quart de tour, sur place. */
  function turnPlayer(sens) {
    const i = TURN_ORDER.indexOf(state.player.dir);
    const n = (((i < 0 ? 0 : i) + sens) % 4 + 4) % 4;
    state.player.dir = TURN_ORDER[n];
    refreshCompass();     // la boussole affiche vers où l'on regarde
  }

  /** Rotation continue tant que la touche est maintenue (un tour / 200 ms). */
  function updateFpsTurn(dtMs) {
    const l = state.input.left, r = state.input.right;
    if (l === r) { fpsTurnT = 0; return; }        // rien, ou les deux à la fois
    if (fpsTurnT <= 0) { turnPlayer(l ? -1 : 1); fpsTurnT = FPS_TURN_MS; }
    else fpsTurnT -= dtMs;
  }

  function updateWorld(dt) {
    if (state.messages.length > 0) return;   // un message ouvert bloque tout

    const fps = isFpsView();
    // On pivote AVANT de tester le pas en cours : en vue FPS, on doit pouvoir
    // tourner la tête même en pleine marche.
    if (fps) updateFpsTurn(dt);

    if (state.player.moving) {
      state.player.moveProgress += dt / MOVE_DURATION_MS;
      if (state.player.moveProgress >= 1) {
        state.player.moveProgress = 1;
        state.player.tileX = state.player.moveToX;
        state.player.tileY = state.player.moveToY;
        state.player.moving = false;
        onStepFinished();
      }
      return;
    }

    let cmd;
    if (fps) {
      // Première personne : ↑ avance dans la direction du regard, ↓ recule
      // sans se retourner. Les côtés servent à pivoter (déjà traités).
      const f = DIR_STEP[state.player.dir] || DIR_STEP.down;
      if (state.input.up) cmd = { dx: f.dx, dz: f.dz };
      else if (state.input.down) cmd = { dx: -f.dx, dz: -f.dz };
      else return;
    } else {
      // Nouveau pas — priorité haut > bas > gauche > droite (comme le jeu 2D).
      let dx = 0, dz = 0;
      if (state.input.up)         { dz = -1; }
      else if (state.input.down)  { dz = 1;  }
      else if (state.input.left)  { dx = -1; }
      else if (state.input.right) { dx = 1;  }
      if (dx === 0 && dz === 0) return;
      cmd = rotateCommand(dx, dz);
      state.player.dir = dirOf(cmd.dx, cmd.dz);
    }

    const nx = state.player.tileX + cmd.dx;
    const ny = state.player.tileY + cmd.dz;
    if (!isWalkable(nx, ny) || npcAt(nx, ny)) return;

    state.player.moving = true;
    state.player.moveProgress = 0;
    state.player.moveFromX = state.player.tileX;
    state.player.moveFromY = state.player.tileY;
    state.player.moveToX = nx;
    state.player.moveToY = ny;
    sfx('footstep');
  }

  /** Fin d'un pas : biome, tuile spéciale, puis éventuelle rencontre. */
  function onStepFinished() {
    const x = state.player.tileX, y = state.player.tileY;
    refreshCompass();

    const biome = biomeAt(x, y);
    if (biome && biome !== state.lastBiome) {
      state.lastBiome = biome;
      onBiomeChanged(biome);
    }

    // Les tuiles spéciales priment sur la rencontre : marcher sur un portail
    // ne doit pas déclencher un combat au moment où l'écran part au noir.
    if (handleSpecialTile(x, y)) return;

    // ENCOUNTER_CHANCE vaut 0 : plus aucune créature ne surgit des herbes. On
    // garde le test pour pouvoir réactiver l'ancien comportement d'une seule
    // constante (voir en tête de fichier).
    if (ENCOUNTER_CHANCE > 0 && isEncounterTile(x, y) && Math.random() < ENCOUNTER_CHANCE) {
      triggerWildEncounter();
    }
  }

  function onBiomeChanged(biome) {
    const R = regions();
    const label = (R && R.labelOf) ? R.labelOf(biome) : biome;
    call('hud', 'setBiomeBanner', [label]);
    const sky = mod('sky');
    if (sky && sky.setBiome) safeCall('sky.setBiome', function () { sky.setBiome(biome, false); });
    else if (scene && scene.fog) {
      const mood = R3.biomeMood(biome);
      scene.fog.color.set(mood.fog);
      if (scene.background && scene.background.set) scene.background.set(mood.sky);
    }
    playBiomeMusic(biome);
    saveGame();
  }

  /** Musique du biome, avec repli pour les biomes sans piste dédiée. */
  function playBiomeMusic(biome) {
    if (!biome) return;
    try { Audio_.playMusic(MUSIC_FALLBACK[biome] || biome); } catch (e) { /* audio indispo */ }
  }

  /**
   * Tuiles spéciales du §5. -> true si la tuile a « pris la main » (le pas ne
   * doit alors déclencher aucune rencontre).
   */
  function handleSpecialTile(x, y) {
    const type = tileAt(x, y);
    const poi = poiAt(x, y);

    if (type === 'PORTAL') {
      const R = regions();
      const gate = (R && R.gateAt) ? safeCall('regions.gateAt', function () { return R.gateAt(x, y); }) : null;
      const data = gate || (poi && poi.data) || null;
      if (data && data.toRegion) {
        startRegionTransition(data.toRegion, data.toX, data.toY, (gate && gate.label) || (poi && poi.label));
        return true;
      }
      return false;
    }

    if (type === 'AIRSHIP_DOCK') { openAirshipMenu(); return true; }

    if (type === 'ARENA_DOOR') { challengeChampion(); return true; }

    if (type === 'HEAL_DOOR') {
      const team = mod('team');
      if (team && team.healAll) safeCall('team.healAll', function () { team.healAll(); });
      sfx('catch');
      showMessage('Centre de soins ✦\nToute ton équipe est requinquée !');
      saveGame();
      return true;
    }

    if (type === 'SHOP_DOOR') {
      sfx('menu');
      showMessage('Boutique 🛍️\n« Reviens plus tard, jeune dresseur :\nle marchand est parti chercher des Balls ! »');
      return true;
    }

    return false;
  }

  /** Hauteur du terrain sous un point (repli à 0 si world3d.js manque). */
  function groundHeight(x, z) {
    const world = mod('world');
    if (world && world.heightAt && !_broken['world.heightAt']) {
      const h = safeCall('world.heightAt', function () { return world.heightAt(x, z); });
      if (typeof h === 'number' && isFinite(h)) return h;
    }
    return 0;
  }

  /** Place le joueur dans le monde 3D et joue son animation. */
  function updatePlayerTransform(dt) {
    const airship = mod('airship');
    // Pendant le vol, le dirigeable a reparenté le joueur dans sa nacelle :
    // écrire sa position ici le décrocherait de son siège.
    if (airship && airship.isFlying && airship.isFlying()) return;

    const p = state.player;
    let tx, ty;
    if (p.moving) {
      const k = R3.clamp01(p.moveProgress);
      tx = p.moveFromX + (p.moveToX - p.moveFromX) * k;
      ty = p.moveFromY + (p.moveToY - p.moveFromY) * k;
    } else {
      tx = p.tileX;
      ty = p.tileY;
    }
    p.worldX = tx;
    p.worldZ = ty;
    p.worldY = groundHeight(p.worldX, p.worldZ);

    if (!playerGroup) return;
    playerGroup.position.set(p.worldX, p.worldY, p.worldZ);
    // En vue FPS on est DANS la tête du joueur : afficher son modèle mettrait
    // l'intérieur de son crâne plein écran. On attend la fin de la bascule
    // pour le cacher, sinon il disparaît alors que la caméra est encore loin.
    const cam = mod('camera');
    const f = (cam && cam.frame) ? safeCall('camera.frame', function () { return cam.frame(); }) : null;
    const dansLaTete = !!(f && f.mode === 'fps' && !f.switching);
    playerGroup.visible = ((state.screen !== 'battle') || !mod('battle')) && !dansLaTete;

    const actors = mod('actors');
    if (actors && actors.updatePlayer) {
      safeCall('actors.updatePlayer', function () {
        actors.updatePlayer(playerGroup, {
          moving: p.moving, moveProgress: p.moveProgress, dir: p.dir, t: R3.clock.t,
        });
      });
    } else {
      const target = dirToAngle(p.dir);
      playerGroup.rotation.y = angleDamp(playerGroup.rotation.y, target, 0.0001, dt);
    }
  }

  function dirToAngle(dir) {
    // Le modèle est tourné vers +z ; 'down' = +z = angle 0.
    switch (dir) {
      case 'up': return Math.PI;
      case 'left': return -Math.PI / 2;
      case 'right': return Math.PI / 2;
      default: return 0;
    }
  }

  function angleDamp(cur, target, smoothing, dt) {
    let d = target - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return cur + d * (1 - Math.pow(smoothing, Math.max(0.0001, dt)));
  }

  // ---------------------------------------------------------------------------
  //  CAMÉRA — déléguée à camera3d.js, avec repli sur l'ancien calcul fixe.
  // ---------------------------------------------------------------------------
  function updateCamera(dt) {
    if (!camera) return;
    const p = state.player;

    const cam = mod('camera');
    if (cam && cam.update) {
      // Léger balancement décoratif, uniquement sur l'écran titre.
      const sway = (state.screen === 'title' || state.screen === 'starter')
        ? Math.sin(R3.clock.t * 0.25) * 2.2 : 0;
      const ok = safeCall('camera.update', function () {
        // 3e argument : une FONCTION (x, z) => hauteur, pas une hauteur. On lui
        // passait un nombre : camera3d l'ignorait silencieusement et croyait
        // donc le terrain plat à l'altitude 0 — d'où une caméra qui pouvait
        // s'enfoncer dans une colline, et l'anti-occlusion aveugle au relief.
        cam.update(dt, {
          worldX: p.worldX, worldY: p.worldY, worldZ: p.worldZ,
          dir: p.dir, moving: p.moving, sway: sway,
        }, groundHeight);
        return true;
      });
      if (ok) return;
    }

    // --- repli : 3e personne, orientation FIXE, suivi lissé -------------------
    const airship = mod('airship');
    if (airship && airship.isFlying && airship.isFlying()) return;   // le vol pilote la caméra

    const z = state.zoom;
    const idle = (state.screen === 'title' || state.screen === 'starter')
      ? Math.sin(R3.clock.t * 0.25) * 2.2 : 0;

    camPos.set(p.worldX + idle, p.worldY + CAM_HEIGHT * z, p.worldZ + CAM_BACK * z);
    const hCam = groundHeight(camPos.x, camPos.z);
    if (camPos.y < hCam + 2.2) camPos.y = hCam + 2.2;

    // 0.86 ≈ 14 % de rattrapage par image à 60 Hz : doux mais jamais mou.
    const smooth = (dt > 1) ? 0 : 0.86;     // dt géant = recentrage immédiat
    camera.position.set(
      R3.damp(camera.position.x, camPos.x, smooth, dt),
      R3.damp(camera.position.y, camPos.y, smooth, dt),
      R3.damp(camera.position.z, camPos.z, smooth, dt)
    );
    camAim.set(p.worldX + idle * 0.5, p.worldY + 0.85, p.worldZ - CAM_LOOK_AHEAD);
    camera.lookAt(camAim);
  }

  // ===========================================================================
  //  6. RÉGIONS — chargement, PNJ, transitions
  // ===========================================================================

  /** Charge les DONNÉES d'une région et met à jour tous les modules qui en
   *  dépendent. Utilisé aussi bien par les portails que par le dirigeable
   *  (appelé alors au milieu du vol, quand l'écran est noyé de nuages). */
  function loadRegionData(id) {
    const R = regions();
    if (R && R.load) safeCall('regions.load', function () { R.load(id); });
    state.regionId = id;
    state.visitedRegions[id] = true;
    // world.setRegion rappelle regions.load() : c'est sans coût (mise en cache)
    // et ça garantit qu'il travaille bien sur la bonne région.
    call('world', 'setRegion', [id]);
    call('roamers', 'setRegion', [id]);
    call('gates', 'setRegion', [id]);
    rebuildNPCs(id);
    registerAirshipPort(id);
  }

  /** Charge une région ET y place le joueur. `opts.silent` : pas de bandeau. */
  function applyRegion(id, opts) {
    opts = opts || {};
    loadRegionData(id);

    const R = regions();
    const def = (R && R.get) ? safeCall('regions.get', function () { return R.get(id); }) : null;

    if (typeof opts.x === 'number' && typeof opts.y === 'number') {
      teleport(opts.x, opts.y);
    } else if (!opts.keepPosition) {
      const sp = (R && R.spawnOf) ? R.spawnOf(id) : { x: START_X, y: START_Y };
      teleport(sp.x, sp.y);
    } else {
      // On garde la position (reprise de sauvegarde) mais on la sécurise.
      teleport(state.player.tileX, state.player.tileY);
    }

    state.lastBiome = biomeAt(state.player.tileX, state.player.tileY);
    const sky = mod('sky');
    if (sky && sky.setBiome) safeCall('sky.setBiome.init', function () { sky.setBiome(state.lastBiome, true); });
    playBiomeMusic(state.lastBiome);

    if (!opts.silent) {
      call('hud', 'setRegionBanner', [(def && def.name) || id]);
      const lbl = (R && R.labelOf) ? R.labelOf(state.lastBiome) : state.lastBiome;
      call('hud', 'setBiomeBanner', [lbl]);
    }
    refreshCompass();
    saveGame();
  }

  /** Téléporte le joueur sur une tuile, en cherchant la plus proche marchable
   *  si celle demandée ne l'est pas (un enfant coincé, c'est un jeu cassé). */
  function teleport(x, y) {
    const p = findWalkableNear(x, y, 6);
    state.player.tileX = p.x;
    state.player.tileY = p.y;
    state.player.moving = false;
    state.player.moveProgress = 0;
    state.player.moveFromX = state.player.moveToX = p.x;
    state.player.moveFromY = state.player.moveToY = p.y;
    state.player.worldX = p.x;
    state.player.worldZ = p.y;
    updatePlayerTransform(0);
    updateCamera(1e9);
    refreshCompass();
  }

  function findWalkableNear(x, y, radius) {
    if (isWalkable(x, y)) return { x: x, y: y };
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (isWalkable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
        }
      }
    }
    return { x: x, y: y };
  }

  /** Reconstruit les PNJ 3D de la région active (les anciens sont libérés). */
  function rebuildNPCs(id) {
    for (let i = 0; i < npcEntries.length; i++) {
      const g = npcEntries[i].group;
      if (!g) continue;
      if (g.parent) g.parent.remove(g);
      try { R3.disposeTree(g); } catch (e) { /* déjà libéré */ }
    }
    npcEntries = [];

    const R = regions();
    const actors = mod('actors');
    if (!R || !R.npcsOf || !actors || !actors.buildNPC) return;

    const list = safeCall('regions.npcsOf', function () { return R.npcsOf(id); }) || [];
    const ANG = actors.ANGLE_DIR || {};
    safeCall('actors.buildNPC', function () {
      for (let i = 0; i < list.length; i++) {
        const npc = list[i];
        if (!npc || typeof npc.x !== 'number') continue;
        const g = actors.buildNPC(npc);
        if (!g) continue;
        g.position.set(npc.x, groundHeight(npc.x, npc.y), npc.y);
        g.rotation.y = (ANG[npc.dir] !== undefined) ? ANG[npc.dir] : 0;
        g.userData.solOk = false;   // actors3d rattrapera la hauteur du sol
        scene.add(g);
        npcEntries.push({ group: g, npc: npc });
      }
    });
  }

  /**
   * Déclare les SIX ports au dirigeable, pas seulement celui de la région
   * chargée. C'était le nœud du problème : `airship.canFly()` refuse toute
   * destination dont le port lui est inconnu, et un port n'était enregistré
   * qu'au chargement de sa région — donc au premier lancement, AUCUNE
   * destination n'était possible et le dirigeable ne servait à rien.
   * Les coordonnées des ports sont statiques (regions3d §4) : les déclarer
   * toutes ne coûte rien et ne génère aucune région.
   */
  function registerAirshipPort(id) {
    const R = regions();
    const airship = mod('airship');
    if (!R || !R.get || !airship) return;

    const tous = (R.list ? safeCall('regions.list', function () { return R.list(); }) : null) || [];
    for (let i = 0; i < tous.length; i++) {
      const d = tous[i];
      if (!d || !d.airship) continue;
      call('airship', 'registerPort', [d.id, d.airship.x, d.airship.y, d.airship.name]);
    }

    const def = safeCall('regions.get.port', function () { return R.get(id); });
    if (!def || !def.airship) return;
    call('airship', 'registerPort', [id, def.airship.x, def.airship.y, def.airship.name]);
    if (id === state.regionId) call('airship', 'dockAt', [id, def.airship.x, def.airship.y]);
  }

  // --- Transition de région (tuile PORTAL) : fondu court, puis bascule --------

  function startRegionTransition(toRegion, toX, toY, label) {
    if (state.transition) return;
    releaseAllKeys();
    sfx('menu');
    state.screen = 'transition';
    state.transition = {
      phase: 'out', t: 0,
      to: toRegion,
      toX: (typeof toX === 'number') ? toX : null,
      toY: (typeof toY === 'number') ? toY : null,
      label: label || null,
    };
  }

  function updateTransition(dtMs) {
    const tr = state.transition;
    if (!tr) { state.screen = 'world'; return; }
    tr.t += dtMs;

    if (tr.phase === 'out') {
      setFade(tr.t / FADE_MS);
      if (tr.t < FADE_MS) return;
      setFade(1);
      // Écran noir : c'est le moment où l'on paie le chargement.
      const R = regions();
      const def = (R && R.get) ? R.get(tr.to) : null;
      applyRegion(tr.to, {
        x: (tr.toX === null) ? undefined : tr.toX,
        y: (tr.toY === null) ? undefined : tr.toY,
        silent: true,
      });
      call('hud', 'setRegionBanner', [(def && def.name) || tr.to]);
      if (tr.label) showToast(tr.label, '🚪');
      tr.phase = 'in';
      tr.t = 0;
      return;
    }

    setFade(1 - tr.t / FADE_MS);
    if (tr.t >= FADE_MS) {
      setFade(0);
      state.transition = null;
      state.screen = 'world';
    }
  }

  // ===========================================================================
  //  7. DIRIGEABLE (§17 bis)
  // ===========================================================================

  /**
   * Les destinations proposées par le dirigeable : LES SIX RÉGIONS, tout de
   * suite. Le contrat prévoyait de n'ouvrir que les régions déjà visitées à
   * pied, mais les portes sont sur les bords d'une carte de 384 × 224 tuiles :
   * en pratique, Robin ne pouvait aller nulle part et le dirigeable ne servait
   * jamais. On garde l'information « déjà explorée » en sous-titre, sans
   * jamais bloquer le voyage.
   */
  function airshipOptions() {
    const R = regions();
    const airship = mod('airship');
    const ordre = (airship && Array.isArray(airship.ORDER)) ? airship.ORDER
      : ((R && R.list) ? (safeCall('regions.list.air', function () { return R.list(); }) || [])
          .map(function (d) { return d.id; })
        : ['val', 'sylve', 'saphir', 'givre', 'braise', 'aurore']);

    return ordre.map(function (id) {
      const def = (R && R.get) ? R.get(id) : null;
      const vu = !!state.visitedRegions[id];
      const port = (airship && airship.PORTS && airship.PORTS[id]) || (def && def.airship) || null;
      return {
        regionId: id,
        region: (def && def.name) || id,
        name: (port && port.name) || 'Port aérien',
        current: id === state.regionId,
        enabled: id !== state.regionId,
        reason: (id === state.regionId) ? 'Tu y es'
          : (vu ? null : 'Région encore inconnue'),
        visited: vu,
        level: def && def.recommendedLevel,
        x: port ? port.x : null,
        y: port ? port.y : null,
      };
    });
  }

  /** Touche T : le dirigeable vient te chercher, où que tu sois. */
  function callAirship() {
    if (state.screen !== 'world' || state.messages.length > 0 || state.throwing) return;
    openAirshipMenu();
  }

  function openAirshipMenu() {
    const hud = mod('hud');
    releaseAllKeys();
    sfx('menu');

    const options = airshipOptions();

    if (hud && hud.openAirshipMenu) {
      state.screen = 'airship';
      const ok = safeCall('hud.openAirshipMenu', function () {
        hud.openAirshipMenu(options, state.regionId,
          function (toRegion) { startFlight(toRegion); });
        return true;
      });
      // Le curseur clavier est posé par hud3d.js sur la première destination
      // atteignable : on ne le double pas ici (les deux modules n'ordonnent
      // pas les régions pareil).
      if (ok) return;
    }

    // Repli texte : le voyage doit rester possible même sans interface dédiée.
    state.screen = 'world';
    const dispo = options.filter(function (o) { return o.enabled; });
    if (!dispo.length) { showMessage('🎈 Le dirigeable ne peut aller nulle part.'); return; }
    const cible = dispo[0].regionId;
    showMessage('🎈 Embarquement immédiat pour ' + regionName(cible) + ' !',
      function () { startFlight(cible); });
  }

  /** Clavier du menu du dirigeable : ←/→ choisir, Espace valider, Échap sortir. */
  function onAirshipKey(e) {
    const airship = mod('airship');
    // Pendant la cinématique, airship3d.js gère lui-même Espace (« passer »).
    if (airship && airship.isFlying && airship.isFlying()) return;

    switch (e.key) {
      case 'Escape': case 'Backspace':
        e.preventDefault();
        call('hud', 'closeAirshipMenu', []);
        state.screen = 'world';
        releaseAllKeys();
        refreshCompass();
        break;
      case 'ArrowLeft': case 'a': case 'A': case 'q': case 'Q':
      case 'ArrowUp': case 'w': case 'W': case 'z': case 'Z':
        e.preventDefault();
        sfx('menu');
        call('hud', 'moveAirshipCursor', [-1]);
        break;
      case 'ArrowRight': case 'd': case 'D':
      case 'ArrowDown': case 's': case 'S':
        e.preventDefault();
        sfx('menu');
        call('hud', 'moveAirshipCursor', [1]);
        break;
      case ' ': case 'Enter':
        e.preventDefault();
        call('hud', 'confirmAirship', []);
        break;
      case 't': case 'T':
        e.preventDefault();
        call('hud', 'closeAirshipMenu', []);
        state.screen = 'world';
        break;
    }
  }

  function regionName(id) {
    const R = regions();
    const def = (R && R.get) ? R.get(id) : null;
    return (def && def.name) || id;
  }

  function startFlight(toRegion) {
    if (!toRegion || toRegion === state.regionId) { state.screen = 'world'; return; }
    const airship = mod('airship');
    const from = state.regionId;

    // On peut appeler le dirigeable de n'importe où (touche T) : on se place
    // d'abord sur l'embarcadère de la région, sinon le décollage se ferait
    // à un endroit et le joueur reviendrait à un autre.
    const R = regions();
    const defFrom = (R && R.get) ? R.get(from) : null;
    if (defFrom && defFrom.airship) {
      const dx = (typeof defFrom.airship.dockX === 'number') ? defFrom.airship.dockX : defFrom.airship.x;
      const dy = (typeof defFrom.airship.dockY === 'number') ? defFrom.airship.dockY : defFrom.airship.y;
      if (typeof dx === 'number' &&
          (state.player.tileX !== dx || state.player.tileY !== dy)) {
        teleport(dx, dy);
      }
    }

    if (!airship || !airship.fly) {
      // Repli : téléportation simple (le contrat l'autorise explicitement).
      state.screen = 'world';
      arriveAtPort(from, toRegion);
      return;
    }

    state.screen = 'airship';
    releaseAllKeys();
    const ok = safeCall('airship.fly', function () {
      airship.fly(from, toRegion, function (f, to) { arriveAtPort(f, to || toRegion); });
      return true;
    });
    if (!ok) { state.screen = 'world'; arriveAtPort(from, toRegion); }
  }

  /** Fin du vol : la région est déjà chargée (onMidFlight), il reste à poser
   *  le joueur sur l'embarcadère et à rendre la main. */
  function arriveAtPort(from, to) {
    if (state.regionId !== to) loadRegionData(to);

    const R = regions();
    const def = (R && R.get) ? R.get(to) : null;
    let x = null, y = null;
    if (def && def.airship) {
      x = (typeof def.airship.dockX === 'number') ? def.airship.dockX : def.airship.x;
      y = (typeof def.airship.dockY === 'number') ? def.airship.dockY : def.airship.y;
    }
    if (typeof x !== 'number') {
      const sp = (R && R.spawnOf) ? R.spawnOf(to) : { x: START_X, y: START_Y };
      x = sp.x; y = sp.y;
    }
    teleport(x, y);

    state.lastBiome = biomeAt(state.player.tileX, state.player.tileY);
    const sky = mod('sky');
    if (sky && sky.setBiome) safeCall('sky.setBiome.fly', function () { sky.setBiome(state.lastBiome, true); });
    playBiomeMusic(state.lastBiome);
    call('hud', 'setRegionBanner', [(def && def.name) || to]);
    state.screen = 'world';
    refreshCompass();
    showToast('Bienvenue à ' + ((def && def.name) || to) + ' !', '🎈');
    saveGame();
  }

  // ===========================================================================
  //  8. CAPTURE EN MONDE OUVERT (touche B)  — §16
  // ===========================================================================

  function aimedRoamer() {
    const ro = mod('roamers');
    if (!ro) return null;
    const p = state.player;
    let r = null;
    if (ro.aimed) {
      r = safeCall('roamers.aimed', function () {
        return ro.aimed(p.worldX, p.worldZ, p.dir, BALL_RANGE);
      }) || null;
    }
    if (!r && ro.nearest) {
      r = safeCall('roamers.nearest', function () {
        return ro.nearest(p.worldX, p.worldZ, 1.6);
      }) || null;
    }
    return r;
  }

  /** Le premier type de Ball disponible dans le sac. */
  function firstBall() {
    const ordre = ['pokeball', 'superball', 'hyperball', 'ballmaitresse'];
    for (let i = 0; i < ordre.length; i++) {
      if ((state.items[ordre[i]] | 0) > 0) return ordre[i];
    }
    return null;
  }

  function throwBallInWorld() {
    if (state.screen !== 'world' || state.messages.length > 0 || state.throwing) return;
    const ro = mod('roamers');
    const target = aimedRoamer();
    if (!target) { showToast('Aucune créature en vue…', '🔍'); return; }

    const ballId = firstBall();
    if (!ballId) { showToast('Plus aucune Ball !', '⚪'); return; }

    const team = mod('team');
    const dex = mod('dex');
    const species = (dex && dex.get) ? dex.get(target.speciesId) : null;
    const faux = { hp: 1, maxHp: 1, id: target.speciesId, level: target.level || 5 };
    const chance = (team && team.catchChance)
      ? safeCall('team.catchChance', function () { return team.catchChance(faux, species, BALL_BONUS[ballId] || 1); })
      : 0.35;

    state.items[ballId] = Math.max(0, (state.items[ballId] | 0) - 1);
    call('hud', 'setItems', [state.items]);
    state.throwing = true;
    sfx('throwBall');
    markSeen(target.speciesId);

    if (!ro || !ro.throwBall) { state.throwing = false; return; }
    safeCall('roamers.throwBall', function () {
      ro.throwBall(target, chance, function (result) {
        state.throwing = false;
        if (result === 'caught') onCaught(target.speciesId, target.level || 5, target);
        else {
          sfx('escape');
          showToast('Oh non… elle s\'est échappée !', '💨');
        }
      });
    });
    if (_broken['roamers.throwBall']) state.throwing = false;
  }

  /** Capture réussie (monde ouvert OU combat) : équipe, collection, sauvegarde. */
  function onCaught(speciesId, level, roamer) {
    const team = mod('team');
    const dex = mod('dex');
    const species = (dex && dex.get) ? dex.get(speciesId) : null;
    const nom = (species && species.name) || speciesId;

    let where = 'box';
    if (team && team.create && team.add) {
      safeCall('team.add', function () {
        const m = team.create(speciesId, level || 5, {
          caughtAt: { regionId: state.regionId, x: state.player.tileX, y: state.player.tileY },
        });
        where = team.add(m);
      });
    }
    state.collection[speciesId] = (state.collection[speciesId] || 0) + 1;
    markSeen(speciesId);
    sfx('catch');
    refreshHudCounters();
    if (roamer) call('roamers', 'remove', [roamer]);
    saveGame();

    showMessage('Bravo ! ' + nom + ' est capturé' + (species && species.legendary ? ' !!! ✨' : ' ! ✦') +
      (where === 'box' ? '\nTon équipe est pleine : il rejoint la Boîte.' : '\nIl rejoint ton équipe !'));
  }

  function markSeen(speciesId) {
    if (speciesId) state.seen[speciesId] = true;
  }

  /**
   * Un roamer a touché le joueur. Le contrat (§16) déclenchait ici un combat
   * d'office — mais avec 8 à 14 créatures qui se baladent autour du joueur, ça
   * revenait exactement au problème des rencontres surprises : on se faisait
   * arrêter sans l'avoir voulu. Désormais on se contente de rappeler comment
   * l'affronter : c'est TOUJOURS le joueur qui décide (Espace ou B).
   */
  let dernierRappel = -99;
  function onRoamerTouch(roamer) {
    if (!roamer || state.screen !== 'world' || state.messages.length > 0) return;
    if (R3.clock.t - dernierRappel < 12) return;     // pas plus d'un rappel /12 s
    dernierRappel = R3.clock.t;
    const dex = mod('dex');
    const sp = (dex && dex.get) ? dex.get(roamer.speciesId) : null;
    showToast(((sp && sp.name) || 'Une créature') + ' — Espace pour l\'affronter, B pour une Ball', '❕');
  }

  function startRoamerBattle(roamer) {
    if (!roamer) return;
    const dex = mod('dex');
    const species = (dex && dex.get) ? dex.get(roamer.speciesId) : null;
    call('roamers', 'remove', [roamer]);
    startWildBattle(roamer.speciesId, roamer.level || 5, species);
  }

  // ===========================================================================
  //  9. COMBATS (§17)
  // ===========================================================================

  function teamApi() { return mod('team'); }
  function movesApi() { return mod('moves'); }

  function playerTeamList() {
    const team = teamApi();
    return (team && Array.isArray(team.team)) ? team.team : [];
  }

  function activeMon() {
    const team = teamApi();
    if (team && team.active) {
      const m = safeCall('team.active', function () { return team.active(); });
      if (m) return m;
    }
    const list = playerTeamList();
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].hp > 0) return list[i];
    return null;
  }

  function indexOfMon(list, m) {
    for (let i = 0; i < list.length; i++) if (list[i] === m) return i;
    return 0;
  }

  /** Rencontre sauvage classique, tirée du Pokédex selon région et biome. */
  function triggerWildEncounter() {
    const dex = mod('dex');
    const biome = biomeAt(state.player.tileX, state.player.tileY);
    let species = null;
    if (dex && dex.pickWild) {
      species = safeCall('dex.pickWild', function () { return dex.pickWild(state.regionId, biome); });
    }
    if (!species) return;
    // `species.minLevel`/`maxLevel` couvrent l'UNION de toutes les régions où
    // l'espèce apparaît (voir js3d/dex3d.js, §8 du contrat) — une créature
    // commune à val (Nv 3-8) et braise (Nv 32-40) déclare donc 3-40. Sans
    // recroiser avec la fourchette de LA RÉGION COURANTE (dex.REGION_LEVELS),
    // un joueur tout juste parti de val peut croiser un adversaire de niveau
    // 40 dès sa première rencontre — trouvé en jouant réellement à la partie.
    const lo0 = species.minLevel || 3, hi0 = Math.max(lo0, species.maxLevel || lo0 + 2);
    const band = dex && dex.REGION_LEVELS && dex.REGION_LEVELS[state.regionId];
    let lo = lo0, hi = hi0;
    if (band) {
      const lo1 = Math.max(lo0, band[0]), hi1 = Math.min(hi0, band[1]);
      if (lo1 <= hi1) { lo = lo1; hi = hi1; }
      else { lo = band[0]; hi = band[1]; }  // pas de recoupement : on suit la région, pas l'espèce
    }
    const level = lo + Math.floor(Math.random() * (hi - lo + 1));
    startWildBattle(species.id, level, species);
  }

  function startWildBattle(speciesId, level, species) {
    const team = teamApi();
    const mine = activeMon();
    if (!mine) { showMessage('Toute ton équipe est K.O. !\nVa vite au centre de soins.'); return; }
    if (!team || !team.create) return;

    const foeMon = safeCall('team.create.wild', function () { return team.create(speciesId, level); });
    if (!foeMon) return;

    const dex = mod('dex');
    const sp = species || ((dex && dex.get) ? dex.get(speciesId) : null);
    if (sp && sp.legendary) sfx('rare'); else sfx('encounter');
    markSeen(speciesId);

    const list = playerTeamList();
    const b = {
      kind: 'wild',
      regionId: state.regionId,
      biome: biomeAt(state.player.tileX, state.player.tileY) || 'plain',
      player: { mon: mine, team: list, index: indexOfMon(list, mine) },
      foe: { mon: foeMon, team: [foeMon], index: 0, trainer: null },
      phase: 'intro',
      menuCursor: 0, moveCursor: 0, monCursor: 0, bagCursor: 0,
      result: null,
      anim: { seq: 0, side: null, moveId: null, fx: null, progress: 0 },
      ball: { active: false, progress: 0, shakeIndex: 0, result: null },
      canFlee: true,
      canCatch: true,
    };
    enterBattle(b, 'Un ' + (foeMon.nick || speciesId) + ' sauvage apparaît !' +
      (sp && sp.description ? '\n' + sp.description : ''));
  }

  /** Combat contre l'un des dresseurs de la région. */
  function startTrainerBattle(npc) {
    const arenas = mod('arenas');
    if (!activeMon()) { showMessage('Ton équipe est trop fatiguée pour se battre !'); return; }

    let b = null;
    if (arenas && arenas.makeTrainerBattle) {
      const R = regions();
      const def = (R && R.get) ? R.get(state.regionId) : null;
      // Les PNJ des régions n'ont pas de niveau : on leur donne celui conseillé
      // pour la région, sinon tous les dresseurs du jeu resteraient au niveau 5.
      const copie = {};
      for (const k in npc) copie[k] = npc[k];
      copie.level = (def && def.recommendedLevel) || 5;
      b = safeCall('arenas.makeTrainerBattle', function () {
        return arenas.makeTrainerBattle(copie, playerTeamList(), state.regionId);
      });
    }
    if (!b) return;
    b.npcId = npc.id;
    sfx('encounter');
    const intro = (npc.dialog && npc.dialog[0]) ? npc.name + ' : « ' + npc.dialog[0] + ' »\n' : '';
    enterBattle(b, intro + npc.name + ' envoie ' + (b.foe.mon.nick || 'sa créature') + ' au combat !');
  }

  /** Défi du champion, déclenché par la tuile ARENA_DOOR. */
  function challengeChampion() {
    const arenas = mod('arenas');
    if (!arenas || !arenas.makeBattle) { showMessage('L\'arène est fermée aujourd\'hui.'); return; }
    if (state.badges[state.regionId]) {
      const a = arenas.get ? arenas.get(state.regionId) : null;
      showMessage('🏟️ ' + ((a && a.name) || 'Arène') + '\nTu as déjà gagné ce badge ! Bravo ✦');
      return;
    }
    if (!activeMon()) { showMessage('Soigne ton équipe avant d\'affronter le champion !'); return; }

    const b = safeCall('arenas.makeBattle', function () {
      return arenas.makeBattle(state.regionId, playerTeamList());
    });
    if (!b) { showMessage('L\'arène est fermée aujourd\'hui.'); return; }

    sfx('rare');
    const tr = b.foe.trainer || {};
    const lignes = (tr.dialogIntro && tr.dialogIntro.length) ? tr.dialogIntro[0] : 'Montre-moi ta force !';
    enterBattle(b, (tr.name || 'Le champion') + ' : « ' + lignes + ' »\n' +
      (tr.name || 'Le champion') + ' envoie ' + (b.foe.mon.nick || 'sa créature') + ' !');
  }

  // --- Mise en place / sortie -------------------------------------------------

  function enterBattle(b, introText) {
    state.battle = b;
    state.screen = 'battle';
    releaseAllKeys();
    _hudBattle.phase = null;
    _hudBattle.foe = '';
    _hudBattle.player = '';

    call('battle', 'enter', [b, b.biome]);
    call('hud', 'setItems', [state.items]);
    call('hud', 'showBattleUI', [b]);
    showMessage(introText, function () { setBattlePhase('choose'); });
  }

  function endBattle() {
    state.battle = null;
    state.screen = 'world';
    _hudBattle.phase = null;
    call('hud', 'hideBattleUI', []);
    call('battle', 'exit', []);
    playBiomeMusic(state.lastBiome);
    saveGame();
  }

  function setBattlePhase(p) {
    const b = state.battle;
    if (!b) return;
    b.phase = p;
    call('hud', 'showBattleUI', [b]);
    _hudBattle.phase = p;
  }

  // --- Synchronisation légère de l'interface (barres de PV) -------------------
  const _hudBattle = { phase: null, foe: '', player: '' };

  function updateBattle() {
    const b = state.battle;
    if (!b) return;
    const hud = mod('hud');
    if (!hud || !hud.setHP) return;

    const pm = b.player && b.player.mon;
    const fm = b.foe && b.foe.mon;
    if (fm) {
      const key = fm.uid + ':' + fm.hp + '/' + fm.maxHp;
      if (key !== _hudBattle.foe) {
        _hudBattle.foe = key;
        safeCall('hud.setHP.foe', function () {
          hud.setHP('foe', fm.hp, fm.maxHp, fm.nick || fm.id, fm.level, fm.types);
        });
      }
    }
    if (pm) {
      const key = pm.uid + ':' + pm.hp + '/' + pm.maxHp;
      if (key !== _hudBattle.player) {
        _hudBattle.player = key;
        safeCall('hud.setHP.player', function () {
          hud.setHP('player', pm.hp, pm.maxHp, pm.nick || pm.id, pm.level, pm.types);
        });
      }
    }
  }

  // --- Clavier en combat ------------------------------------------------------

  function onBattleKey(e) {
    const b = state.battle;
    if (!b) return;

    if (state.messages.length > 0) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advanceMessage(); }
      return;
    }

    const k = e.key;
    const valide = (k === ' ' || k === 'Enter');
    const retour = (k === 'Escape');
    const gauche = (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'q' || k === 'Q');
    const droite = (k === 'ArrowRight' || k === 'd' || k === 'D');
    const haut = (k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'z' || k === 'Z');
    const bas = (k === 'ArrowDown' || k === 's' || k === 'S');
    if (!valide && !retour && !gauche && !droite && !haut && !bas) return;
    e.preventDefault();

    if (b.phase === 'choose') {
      // Menu 2×2 : 0 Attaque · 1 Équipe · 2 Sac · 3 Fuite
      let c = b.menuCursor | 0;
      if (gauche && c % 2 === 1) c--;
      else if (droite && c % 2 === 0) c++;
      else if (haut && c >= 2) c -= 2;
      else if (bas && c < 2) c += 2;
      else if (valide) { chooseMainMenu(c); return; }
      if (c !== b.menuCursor) { b.menuCursor = c; sfx('menu'); call('hud', 'setMenuCursor', [c]); }
      return;
    }

    if (b.phase === 'choose_move') {
      const moves = (b.player.mon && b.player.mon.moves) || [];
      let c = b.moveCursor | 0;
      if (retour) { setBattlePhase('choose'); return; }
      if (gauche && c % 2 === 1) c--;
      else if (droite && c % 2 === 0 && c + 1 < moves.length) c++;
      else if (haut && c >= 2) c -= 2;
      else if (bas && c + 2 < moves.length) c += 2;
      else if (valide) { usePlayerMove(c); return; }
      if (c !== b.moveCursor) { b.moveCursor = c; sfx('menu'); call('hud', 'setMoveCursor', [c]); }
      return;
    }

    if (b.phase === 'choose_mon') {
      const list = b.player.team || [];
      let c = b.monCursor | 0;
      if (retour) { setBattlePhase('choose'); return; }
      if (gauche || haut) c = Math.max(0, c - 1);
      else if (droite || bas) c = Math.min(list.length - 1, c + 1);
      else if (valide) { swapPlayerMon(c); return; }
      if (c !== b.monCursor) { b.monCursor = c; sfx('menu'); call('hud', 'setMonCursor', [c]); }
      return;
    }

    if (b.phase === 'bag') {
      const list = bagList();
      let c = b.bagCursor | 0;
      if (retour) { setBattlePhase('choose'); return; }
      if (gauche || haut) c = Math.max(0, c - 1);
      else if (droite || bas) c = Math.min(Math.max(0, list.length - 1), c + 1);
      else if (valide) { useBagItem(list[c]); return; }
      if (c !== b.bagCursor) { b.bagCursor = c; sfx('menu'); call('hud', 'setBagCursor', [c]); }
    }
  }

  /** Les objets du sac, dans le MÊME ordre que hud3d.js les affiche. */
  function bagList() {
    const out = [];
    for (const id in state.items) if ((state.items[id] | 0) > 0) out.push(id);
    return out;
  }

  function chooseMainMenu(i) {
    const b = state.battle;
    sfx('menu');
    b.menuCursor = i;
    if (i === 0) { b.moveCursor = 0; setBattlePhase('choose_move'); return; }
    if (i === 1) { b.monCursor = 0; setBattlePhase('choose_mon'); return; }
    if (i === 2) { b.bagCursor = 0; setBattlePhase('bag'); return; }
    // Fuite
    if (b.canFlee === false) { showToast('Impossible de fuir ce combat !', '🚫'); return; }
    setBattlePhase('animating');
    if (Math.random() < 0.85) {
      b.result = 'fled';
      setBattlePhase('result');
      showMessage('Tu prends la fuite !', function () { endBattle(); });
    } else {
      showMessage('Impossible de s\'enfuir !', function () { foeTurn(); });
    }
  }

  // --- Un tour de combat ------------------------------------------------------

  function moveOf(slot) {
    const mv = movesApi();
    const id = (slot && slot.id) || slot;
    if (mv && mv.get) return mv.get(id);
    return { id: id, name: id, power: [10, 15], type: null, fx: 'slash' };
  }

  function usePlayerMove(index) {
    const b = state.battle;
    const mon = b.player.mon;
    const slots = (mon && mon.moves) || [];
    const slot = slots[index] || slots[0];
    if (!slot) return;
    if (slot.pp !== undefined && slot.pp <= 0) { showToast('Plus de PP pour cette capacité !', '💤'); return; }

    b.moveCursor = index;
    const move = moveOf(slot);
    const team = teamApi();
    if (team && team.spendPP) safeCall('team.spendPP', function () { team.spendPP(mon, move.id); });

    setBattlePhase('animating');
    const texte = applyMove('player', mon, b.foe.mon, move);

    if (b.foe.mon.hp <= 0) {
      showMessage(texte + '\n' + (b.foe.mon.nick || 'L\'adversaire') + ' est K.O. !',
        function () { onFoeFainted(); });
      return;
    }
    showMessage(texte, function () { foeTurn(); });
  }

  function foeTurn() {
    const b = state.battle;
    if (!b) return;
    const mv = movesApi();
    const foe = b.foe.mon, mine = b.player.mon;
    if (!foe || !mine) { setBattlePhase('choose'); return; }

    let move = null;
    if (mv && mv.pickAI) move = safeCall('moves.pickAI', function () { return mv.pickAI(foe, mine, b); });
    if (!move) move = moveOf('charge');

    const team = teamApi();
    if (team && team.spendPP) safeCall('team.spendPP.foe', function () { team.spendPP(foe, move.id); });

    setBattlePhase('animating');
    const texte = applyMove('foe', foe, mine, move);

    if (mine.hp <= 0) {
      showMessage(texte + '\n' + (mine.nick || 'Ta créature') + ' est K.O. !',
        function () { onPlayerFainted(); });
      return;
    }
    showMessage(texte, function () { setBattlePhase('choose'); });
  }

  /** Applique une capacité et renvoie le texte à afficher. */
  function applyMove(side, attacker, defender, move) {
    const b = state.battle;
    const mv = movesApi();
    const team = teamApi();
    const nom = attacker.nick || attacker.id;

    let res = null;
    if (mv && mv.compute) res = safeCall('moves.compute', function () { return mv.compute(attacker, defender, move); });
    if (!res) res = { missed: false, dmg: 8, heal: 0, mult: 1, crit: false, text: null };

    // On passe `res` : battle3d s'en sert pour rendre le coup plus spectaculaire
    // quand il est super efficace ou critique, plus sobre quand il est faible.
    call('battle', 'notifyMove', [side, move, res]);
    if (b && b.anim) b.anim.seq = (b.anim.seq | 0) + 1;

    let txt = nom + ' utilise ' + (move.name || move.id) + ' !';
    if (res.missed) return txt + '\nRaté…';

    if (res.heal > 0) {
      const soigne = (team && team.heal)
        ? safeCall('team.heal', function () { return team.heal(attacker, res.heal); })
        : (attacker.hp = Math.min(attacker.maxHp, attacker.hp + res.heal), res.heal);
      return txt + '\n+' + soigne + ' PV récupérés !';
    }

    const degats = (team && team.damage)
      ? safeCall('team.damage', function () { return team.damage(defender, res.dmg); })
      : (defender.hp = Math.max(0, defender.hp - res.dmg), res.dmg);
    sfx('hit');
    txt += '\n' + degats + ' dégâts sur ' + (defender.nick || defender.id) + ' !';
    if (res.crit) txt += ' Coup critique !';
    if (res.text) txt += '\n' + res.text;
    return txt;
  }

  function swapPlayerMon(index) {
    const b = state.battle;
    const list = b.player.team || [];
    const cible = list[index];
    if (!cible || cible.hp <= 0 || cible === b.player.mon) { showToast('Impossible d\'envoyer celle-ci.', '🚫'); return; }

    const team = teamApi();
    if (team && team.setActive) safeCall('team.setActive', function () { team.setActive(index); });
    b.player.mon = cible;
    b.player.index = index;
    b.moveCursor = 0;
    call('battle', 'swapIn', ['player', cible]);
    _hudBattle.player = '';
    setBattlePhase('animating');
    showMessage('En avant, ' + (cible.nick || cible.id) + ' !', function () { foeTurn(); });
  }

  function useBagItem(id) {
    const b = state.battle;
    if (!id) { showToast('Ton sac est vide.', '🎒'); return; }
    if ((state.items[id] | 0) <= 0) return;

    if (id === 'potion') {
      const mon = b.player.mon;
      const team = teamApi();
      const rendu = (team && team.heal) ? team.heal(mon, 20) : 0;
      if (!rendu) { showToast('Cette créature est déjà en pleine forme.', '💊'); return; }
      state.items.potion = Math.max(0, state.items.potion - 1);
      call('hud', 'setItems', [state.items]);
      setBattlePhase('animating');
      showMessage('Tu utilises une Potion.\n+' + rendu + ' PV pour ' + (mon.nick || mon.id) + ' !',
        function () { foeTurn(); });
      return;
    }

    // Une Ball : capture PENDANT le combat (uniquement en combat sauvage).
    if (b.canCatch === false) { showToast('On ne capture pas la créature d\'un dresseur !', '🚫'); return; }
    throwBallInBattle(id);
  }

  function throwBallInBattle(ballId) {
    const b = state.battle;
    const team = teamApi();
    const dex = mod('dex');
    const foe = b.foe.mon;
    const species = (dex && dex.get) ? dex.get(foe.id) : null;
    const chance = (team && team.catchChance)
      ? safeCall('team.catchChance.battle', function () { return team.catchChance(foe, species, BALL_BONUS[ballId] || 1); })
      : 0.35;

    state.items[ballId] = Math.max(0, (state.items[ballId] | 0) - 1);
    call('hud', 'setItems', [state.items]);
    b.phase = 'ball';
    b.ball = { active: true, progress: 0, shakeIndex: 0, result: null };
    call('hud', 'showBattleUI', [b]);
    sfx('throwBall');

    const bt = mod('battle');
    if (!bt || !bt.throwBall) { resolveBattleCatch(Math.random() < chance ? 'caught' : 'escaped'); return; }
    const ok = safeCall('battle.throwBall', function () {
      bt.throwBall(chance, function (result) { resolveBattleCatch(result); });
      return true;
    });
    if (!ok) resolveBattleCatch(Math.random() < chance ? 'caught' : 'escaped');
  }

  function resolveBattleCatch(result) {
    const b = state.battle;
    if (!b) return;
    b.ball.result = result;
    b.ball.active = false;
    if (result === 'caught') {
      b.result = 'caught';
      setBattlePhase('result');
      onCaughtInBattle(b.foe.mon);
      return;
    }
    sfx('escape');
    setBattlePhase('animating');
    showMessage('Oh non… ' + (b.foe.mon.nick || 'la créature') + ' s\'est libérée !',
      function () { foeTurn(); });
  }

  /** Capture pendant un combat : le Mon adverse rejoint l'équipe TEL QUEL
   *  (niveau, PV, capacités) — c'est bien plus gratifiant qu'une copie neuve. */
  function onCaughtInBattle(mon) {
    const team = teamApi();
    let where = 'box';
    if (team && team.add) {
      mon.caughtAt = { regionId: state.regionId, x: state.player.tileX, y: state.player.tileY };
      where = safeCall('team.add.catch', function () { return team.add(mon); }) || 'box';
    }
    state.collection[mon.id] = (state.collection[mon.id] || 0) + 1;
    markSeen(mon.id);
    sfx('catch');
    refreshHudCounters();
    saveGame();
    showMessage('Bravo ! ' + (mon.nick || mon.id) + ' est capturé ! ✦' +
      (where === 'box' ? '\nTon équipe est pleine : il rejoint la Boîte.' : '\nIl rejoint ton équipe !'),
      function () { endBattle(); });
  }

  // --- Fin d'un camp ----------------------------------------------------------

  function onFoeFainted() {
    const b = state.battle;
    if (!b) return;
    const team = teamApi();
    const vaincu = b.foe.mon;

    // XP pour la créature au combat (et une part pour le reste de l'équipe).
    let lignes = '';
    if (team && team.gainXp && team.xpFor) {
      const gain = safeCall('team.xpFor', function () {
        return team.xpFor(vaincu, { trainer: b.kind !== 'wild' });
      }) || 10;
      const res = safeCall('team.gainXp', function () { return team.gainXp(b.player.mon, gain); });
      lignes += '\n' + (b.player.mon.nick || 'Ta créature') + ' gagne ' + gain + ' points d\'expérience !';
      if (res && res.leveled > 0) {
        lignes += '\nNiveau ' + res.level + ' ! 🎉';
        if (res.learned && res.learned.length) {
          lignes += '\nNouvelle capacité : ' + res.learned.map(function (id) {
            return (moveOf(id).name || id);
          }).join(', ') + ' !';
        }
        if (res.pendingLearn && res.pendingLearn.length) {
          lignes += '\n' + (b.player.mon.nick || 'Ta créature') + ' aimerait apprendre ' +
            (moveOf(res.pendingLearn[0].moveId).name || res.pendingLearn[0].moveId) +
            ',\nmais connaît déjà 4 capacités. Ce sera pour plus tard !';
        }
      }
      // Un tiers de l'XP pour les autres membres présents : personne n'est oublié.
      const list = b.player.team || [];
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i] !== b.player.mon && list[i].hp > 0) {
          safeCall('team.gainXp.reste', function () { team.gainXp(list[i], Math.round(gain / 3)); });
        }
      }
    }
    _hudBattle.player = '';

    // Combat sauvage : c'est fini.
    if (b.kind === 'wild') {
      b.result = 'win';
      setBattlePhase('result');
      showMessage('Victoire ! ✦' + lignes, function () { endBattle(); });
      return;
    }

    // Dresseur / champion : la créature suivante entre en scène.
    const foeTeam = b.foe.team || [];
    let next = -1;
    for (let i = 0; i < foeTeam.length; i++) {
      if (foeTeam[i] && foeTeam[i].hp > 0) { next = i; break; }
    }
    if (next >= 0) {
      b.foe.mon = foeTeam[next];
      b.foe.index = next;
      call('battle', 'swapIn', ['foe', b.foe.mon]);
      _hudBattle.foe = '';
      setBattlePhase('animating');
      const tr = b.foe.trainer || {};
      showMessage(lignes.replace(/^\n/, '') + '\n' + (tr.name || 'L\'adversaire') + ' envoie ' +
        (b.foe.mon.nick || 'une autre créature') + ' !', function () { setBattlePhase('choose'); });
      return;
    }

    onTrainerDefeated(lignes);
  }

  function onTrainerDefeated(lignes) {
    const b = state.battle;
    const tr = b.foe.trainer || {};
    b.result = 'win';
    setBattlePhase('result');
    sfx('catch');

    let texte = 'Victoire ! ' + (tr.name || 'Ton adversaire') + ' est battu ! ✦' + lignes;

    if (b.kind === 'champion') {
      state.badges[b.regionId || state.regionId] = true;
      const arenas = mod('arenas');
      const badge = (arenas && arenas.badgeOf) ? arenas.badgeOf(b.regionId || state.regionId) : null;
      const reward = (arenas && arenas.rewardText) ? arenas.rewardText(b.regionId || state.regionId) : '';
      if (reward) texte += '\n\n' + reward;
      else if (badge) texte += '\n\nTu remportes le ' + badge.name + ' ' + badge.icon + ' !';
      call('hud', 'setBadges', [state.badges]);
      // Le badge récompense TOUTE l'équipe (§12).
      const team = teamApi();
      const a = (arenas && arenas.get) ? arenas.get(b.regionId || state.regionId) : null;
      const bonus = (a && a.xpReward) || 120;
      if (team && team.gainXp) {
        const list = b.player.team || [];
        for (let i = 0; i < list.length; i++) {
          if (list[i]) safeCall('team.gainXp.badge', function () { team.gainXp(list[i], bonus); });
        }
      }
    } else if (b.npcId) {
      state.defeatedTrainers[b.npcId] = true;
      if (tr.dialogWin && tr.dialogWin.length) texte += '\n\n' + tr.name + ' : « ' + tr.dialogWin[0] + ' »';
    }

    saveGame();
    showMessage(texte, function () { endBattle(); });
  }

  function onPlayerFainted() {
    const b = state.battle;
    if (!b) return;
    const team = teamApi();
    const list = b.player.team || [];

    let next = -1;
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].hp > 0) { next = i; break; }

    if (next >= 0) {
      b.player.mon = list[next];
      b.player.index = next;
      b.moveCursor = 0;
      if (team && team.setActive) safeCall('team.setActive.ko', function () { team.setActive(next); });
      call('battle', 'swapIn', ['player', b.player.mon]);
      _hudBattle.player = '';
      setBattlePhase('animating');
      showMessage('En avant, ' + (b.player.mon.nick || 'toi') + ' !', function () { setBattlePhase('choose'); });
      return;
    }

    // Toute l'équipe est K.O. : on soigne tout le monde. Jamais punitif.
    b.result = 'lose';
    setBattlePhase('result');
    sfx('escape');
    if (team && team.healAll) safeCall('team.healAll.ko', function () { team.healAll(); });
    saveGame();
    showMessage('Toute ton équipe est K.O.…\nUn passant vous ramène au centre de soins :\ntout le monde est de nouveau en forme ! ✦',
      function () { endBattle(); });
  }

  // ===========================================================================
  //  10. PNJ ET DIALOGUES
  // ===========================================================================

  function talkToNPC(npc) {
    sfx('menu');
    if (npc.isTrainer && !state.defeatedTrainers[npc.id]) { startTrainerBattle(npc); return; }
    const lines = (npc.isTrainer && state.defeatedTrainers[npc.id] && npc.dialogDefeated)
      ? npc.dialogDefeated
      : (npc.dialog || ['…']);
    for (let i = 0; i < lines.length; i++) showMessage(npc.name + ' : ' + lines[i]);
  }

  // ===========================================================================
  //  11. MESSAGES
  // ===========================================================================

  function showMessage(text, onComplete) {
    state.messages.push({ text: text, onComplete: onComplete });
    if (state.messages.length === 1) displayCurrentMessage();
  }

  function advanceMessage() {
    const m = state.messages.shift();
    hideMessageBox();
    if (m && m.onComplete) m.onComplete();
    if (state.messages.length > 0) setTimeout(displayCurrentMessage, 50);
  }

  function displayCurrentMessage() {
    const msg = state.messages[0];
    if (!msg) return;
    const hud = mod('hud');
    if (hud && hud.showMessage) {
      safeCall('hud.showMessage', function () { hud.showMessage(msg.text); });
      if (!_broken['hud.showMessage']) return;
    }
    const textEl = document.getElementById('message-text');
    const boxEl = document.getElementById('message-box');
    if (textEl) textEl.textContent = msg.text;
    if (boxEl) boxEl.classList.remove('hidden');
  }

  function hideMessageBox() {
    const hud = mod('hud');
    if (hud && hud.hideMessage) {
      safeCall('hud.hideMessage', function () { hud.hideMessage(); });
      if (!_broken['hud.hideMessage']) return;
    }
    const boxEl = document.getElementById('message-box');
    if (boxEl) boxEl.classList.add('hidden');
  }

  // ===========================================================================
  //  12. ÉCRAN TITRE ET CHOIX DU COMPAGNON
  // ===========================================================================

  function startGame() {
    const input = document.getElementById('name-input');
    const name = (input && input.value.trim()) || 'Robin';
    state.playerName = name;
    const overlay = document.getElementById('title-overlay');
    if (overlay) overlay.classList.add('hidden');
    try { Audio_.init(); } catch (e) { /* audio indisponible */ }

    if (playerTeamList().length > 0) launchWorld();   // partie déjà commencée
    else { state.screen = 'starter'; openStarterSelection(); }
  }

  function openStarterSelection() {
    state.starterCursor = 0;
    const overlay = document.getElementById('starter-overlay');
    if (overlay) overlay.classList.remove('hidden');
    const hud = mod('hud');
    if (hud && hud.buildStarterCards) {
      safeCall('hud.buildStarterCards', function () { hud.buildStarterCards(); });
      if (!_broken['hud.buildStarterCards']) return;
    }
    buildStarterCardsFallback();
  }

  /** Grille de secours si hud3d.js ne la fournit pas. */
  function buildStarterCardsFallback() {
    const grid = document.getElementById('starter-grid');
    if (!grid) return;
    grid.innerHTML = '';
    STARTERS.forEach(function (opt, i) {
      const card = document.createElement('div');
      card.className = 'starter-card' + (i === 0 ? ' selected' : '');
      card.id = 'starter-card-' + i;
      card.onclick = function () { state.starterCursor = i; updateStarterHighlight(); confirmStarter(); };
      const nameEl = document.createElement('div');
      nameEl.className = 'starter-name';
      nameEl.textContent = opt.id ? speciesName(opt.id) : '???';
      card.appendChild(nameEl);
      const typeEl = document.createElement('div');
      typeEl.className = 'starter-type';
      typeEl.textContent = opt.label;
      card.appendChild(typeEl);
      grid.appendChild(card);
    });
  }

  const STARTERS = [
    { id: 'miaouche', label: 'Animal mignon' },
    { id: 'flamdrak', label: 'Dragon de feu' },
    { id: null, label: 'Surprise !' },
  ];

  function speciesName(id) {
    const dex = mod('dex');
    const sp = (dex && dex.get) ? dex.get(id) : null;
    return (sp && sp.name) || id;
  }

  function moveStarterCursor(delta) {
    state.starterCursor = Math.max(0, Math.min(STARTERS.length - 1, state.starterCursor + delta));
    sfx('menu');
    const hud = mod('hud');
    if (hud && hud.setStarterCursor) safeCall('hud.setStarterCursor', function () { hud.setStarterCursor(state.starterCursor); });
    else updateStarterHighlight();
  }

  function updateStarterHighlight() {
    const cards = document.querySelectorAll('#starter-grid .starter-card');
    for (let i = 0; i < cards.length; i++) cards[i].classList.toggle('selected', i === state.starterCursor);
  }

  function confirmStarter() {
    if (state.screen !== 'starter') return;
    const dex = mod('dex');
    let id = STARTERS[state.starterCursor] ? STARTERS[state.starterCursor].id : null;
    if (!id) {
      // Surprise : une créature commune au hasard (jamais un légendaire).
      const pool = (dex && Array.isArray(dex.BASE)) ? dex.BASE.filter(function (s) {
        return s.id !== 'miaouche' && s.id !== 'flamdrak';
      }) : [];
      id = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : 'feuillou';
    }

    const team = teamApi();
    let mon = null;
    if (team && team.create) {
      mon = safeCall('team.create.starter', function () { return team.create(id, 5); });
      if (mon) safeCall('team.add.starter', function () { team.add(mon); });
    }
    state.collection[id] = (state.collection[id] || 0) + 1;
    markSeen(id);

    const overlay = document.getElementById('starter-overlay');
    if (overlay) overlay.classList.add('hidden');
    sfx('catch');
    const sp = (dex && dex.get) ? dex.get(id) : null;
    showMessage('Tu as choisi ' + ((mon && mon.nick) || speciesName(id)) + ' ! ✦\n' +
      ((sp && sp.description) ? sp.description + '\n' : '') +
      'Prends-en bien soin dans tes combats !', function () { launchWorld(); });
  }

  function launchWorld() {
    state.screen = 'world';
    state.visitedRegions[state.regionId] = true;
    state.lastBiome = biomeAt(state.player.tileX, state.player.tileY);

    const R = regions();
    const def = (R && R.get) ? R.get(state.regionId) : null;
    call('hud', 'setRegionBanner', [(def && def.name) || state.regionId]);
    const lbl = (R && R.labelOf) ? R.labelOf(state.lastBiome) : state.lastBiome;
    call('hud', 'setBiomeBanner', [lbl]);

    const sky = mod('sky');
    if (sky && sky.setBiome) safeCall('sky.setBiome.launch', function () { sky.setBiome(state.lastBiome, true); });
    playBiomeMusic(state.lastBiome);

    refreshHudCounters();
    call('hud', 'showCollectionCount', [true]);
    call('hud', 'showQualityPicker', [true]);
    call('hud', 'setBadges', [state.badges]);
    call('hud', 'setItems', [state.items]);

    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) muteBtn.style.display = '';
    const hint = document.getElementById('controls-hint');
    if (hint) hint.classList.remove('hidden');

    refreshCompass();
    call('hud', 'setViewMode', [viewMode()]);
    saveGame();
    showMessage('Bienvenue, ' + state.playerName + ' ! ✦\n' +
      'Flèches pour explorer. Les créatures se voient sur la carte :\n' +
      'approche-toi et lance une Ball avec B.\n' +
      '🚪 Suis les colonnes de lumière pour changer de région.\n' +
      'T : appeler le dirigeable · V : changer de vue (dont la vue FPS)\n' +
      'E : équipe · C : Pokédex · N : carte · M : son');
  }

  // ===========================================================================
  //  13. ÉCRANS ANNEXES (équipe / Pokédex / carte)
  // ===========================================================================

  function openTeamScreen() {
    if (state.screen !== 'world' || state.messages.length > 0) return;
    const hud = mod('hud');
    if (!hud || !hud.openTeam) { showToast('Écran Équipe indisponible.', '⚠️'); return; }
    releaseAllKeys();
    sfx('menu');
    state.screen = 'team';
    safeCall('hud.openTeam', function () { hud.openTeam(); });
  }

  function openDexScreen() {
    if (state.screen !== 'world' || state.messages.length > 0) return;
    const hud = mod('hud');
    if (!hud || !hud.openDex) { showToast('Pokédex indisponible.', '⚠️'); return; }
    releaseAllKeys();
    sfx('menu');
    state.screen = 'dex';
    safeCall('hud.openDex', function () { hud.openDex(); });
  }

  function openMapScreen() {
    if (state.screen !== 'world' || state.messages.length > 0) return;
    const hud = mod('hud');
    if (!hud || !hud.openMap) { showToast('Carte indisponible.', '⚠️'); return; }
    releaseAllKeys();
    sfx('menu');
    state.screen = 'map';
    safeCall('hud.openMap', function () { hud.openMap(); });
  }

  /** Ferme tout ce qui peut être ouvert et revient au monde. Idempotent :
   *  hud3d.js referme certains overlays lui-même puis nous rejoue un Échap. */
  function closeOverlays() {
    const etait = state.screen;
    call('hud', 'closeTeam', []);
    call('hud', 'closeDex', []);
    call('hud', 'closeMap', []);
    call('hud', 'closeAirshipMenu', []);
    call('hud', 'closeCollection', []);
    const ov = document.getElementById('collection-overlay');
    if (ov) ov.classList.add('hidden');
    releaseAllKeys();
    if (etait === 'team' || etait === 'dex' || etait === 'map' || etait === 'airship') {
      sfx('menu');
      state.screen = 'world';
      refreshCompass();
      saveGame();
    }
  }

  function refreshHudCounters() {
    const dex = mod('dex');
    const total = (dex && dex.count) || 62;
    const uniques = Object.keys(state.collection).length;
    call('hud', 'setCollectionCount', [uniques, total]);
    call('hud', 'showBallCount', [state.items.pokeball | 0]);
    call('hud', 'setItems', [state.items]);
  }

  // ===========================================================================
  //  14. AUTO-QUALITÉ — on descend d'un cran si ça rame, jamais on ne remonte.
  // ===========================================================================
  let fpsAvg = 60;        // uniquement pour le compteur de debug
  let workAvg = 4;        // temps de travail moyen d'une frame, en ms
  let slowTime = 0;
  let warmup = 4;         // secondes de chauffe avant de juger
  let qualityCooldown = 0;
  let fpsDisplayTimer = 0;
  let manualQuality = false;   // si Robin choisit lui-même, on ne touche plus à rien

  const QUALITY_DOWN = { high: 'medium', medium: 'low', low: null };
  const WORK_BUDGET_MS = 14;   // au-delà, on ne tiendrait pas le 60 Hz

  function measurePerf(rawMs, workMs) {
    // Gros à-coup (onglet en arrière-plan, chargement de région, capture
    // d'écran) : on ne juge pas la qualité là-dessus.
    if (rawMs > 120) return;
    const s = rawMs / 1000;

    fpsAvg += (1 / Math.max(0.001, s) - fpsAvg) * Math.min(1, s * 1.5);
    workAvg += (workMs - workAvg) * Math.min(1, s * 2);

    if (warmup > 0) { warmup -= s; slowTime = 0; }
    if (qualityCooldown > 0) qualityCooldown -= s;

    const enJeu = (state.screen === 'world' || state.screen === 'battle');

    if (warmup <= 0 && enJeu && !manualQuality) {
      if (workAvg > WORK_BUDGET_MS) slowTime += s;
      else slowTime = 0;

      if (slowTime >= 3 && qualityCooldown <= 0) {
        const next = QUALITY_DOWN[R3.quality.level];
        slowTime = 0;
        qualityCooldown = 8;
        if (next) {
          console.warn('[game3d] ' + workAvg.toFixed(1) + ' ms/frame : qualité ➜ ' + next);
          applyQuality(next);
        }
      }
    }

    fpsDisplayTimer += s;
    if (fpsDisplayTimer > 0.25) {
      fpsDisplayTimer = 0;
      const hud = mod('hud');
      if (hud && hud.setFps) {
        safeCall('hud.setFps', function () {
          hud.setFps(Math.round(fpsAvg) + ' fps · ' + workAvg.toFixed(1) + ' ms');
        });
      }
    }
  }

  function applyQuality(level, choixManuel) {
    if (choixManuel) manualQuality = true;   // on ne contredira plus le joueur
    R3.setQuality(level);   // prévient aussi tous les modules abonnés
    if (!renderer) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, R3.quality.pixelRatio));
    renderer.shadowMap.enabled = R3.quality.shadows;
    renderer.shadowMap.needsUpdate = true;
    // Basculer les ombres impose de recompiler les matériaux.
    scene.traverse(function (o) {
      if (!o.material) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (let i = 0; i < list.length; i++) if (list[i]) list[i].needsUpdate = true;
    });
    if (scene.fog && scene.fog.density !== undefined) scene.fog.density = R3.quality.fogDensity;
    if (fallbackSun) {
      fallbackSun.castShadow = R3.quality.shadows;
      fallbackSun.shadow.mapSize.set(R3.quality.shadowSize, R3.quality.shadowSize);
      if (fallbackSun.shadow.map) {
        fallbackSun.shadow.map.dispose();
        fallbackSun.shadow.map = null;
      }
    }
    saveGame();
  }

  // ===========================================================================
  //  15. SAUVEGARDE  `robinGame3d_v1`  (§20)
  //      Nouvelle clé : la sauvegarde du jeu 2D n'est JAMAIS réécrite, elle
  //      n'est lue qu'une fois, au tout premier lancement de la 3D.
  // ===========================================================================

  function saveGame() {
    try {
      const team = teamApi();
      const ser = (team && team.serialize) ? team.serialize() : { team: [], box: [] };
      const cam = mod('camera');
      const data = {
        version: 1,
        playerName: state.playerName,
        regionId: state.regionId,
        tileX: state.player.tileX,
        tileY: state.player.tileY,
        dir: state.player.dir,
        team: ser.team || [],
        box: ser.box || [],
        activeIndex: ser.activeIndex || 0,
        collection: state.collection,
        seen: state.seen,
        badges: state.badges,
        defeatedTrainers: state.defeatedTrainers,
        items: state.items,
        visitedRegions: state.visitedRegions,
        quality: R3.quality.level,
        cameraMode: (cam && cam.mode) ? cam.mode() : state.cameraMode,
        cameraState: (cam && cam.serialize) ? cam.serialize() : null,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* localStorage indisponible : on ignore */ }
  }

  function loadGame() {
    let data = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) { data = null; }

    if (!data) { importOldSave(); return; }

    try {
      if (data.playerName) {
        state.playerName = data.playerName;
        const input = document.getElementById('name-input');
        if (input) input.value = data.playerName;
      }
      if (data.regionId) state.regionId = data.regionId;
      if (typeof data.tileX === 'number') state.player.tileX = data.tileX;
      if (typeof data.tileY === 'number') state.player.tileY = data.tileY;
      if (data.dir) state.player.dir = data.dir;

      const team = teamApi();
      if (team && team.deserialize) {
        safeCall('team.deserialize', function () {
          team.deserialize({ team: data.team || [], box: data.box || [], activeIndex: data.activeIndex || 0 });
        });
      }
      if (data.collection) state.collection = data.collection;
      if (data.seen) state.seen = data.seen;
      if (data.badges) state.badges = data.badges;
      if (data.defeatedTrainers) state.defeatedTrainers = data.defeatedTrainers;
      if (data.items) state.items = data.items;
      if (data.visitedRegions) state.visitedRegions = data.visitedRegions;
      state.visitedRegions[START_REGION] = true;
      if (data.cameraMode) state.cameraMode = data.cameraMode;
      if (data.quality && QUALITY_DOWN[data.quality] !== undefined) {
        manualQuality = false;
        R3.setQuality(data.quality);
      }
      const cam = mod('camera');
      if (cam && cam.deserialize) {
        safeCall('camera.deserialize', function () { cam.deserialize(data.cameraState || data.cameraMode); });
      }
      // La position sera sécurisée par applyRegion (keepPosition + teleport).
      _resumePosition = true;
    } catch (e) {
      console.warn('[game3d] sauvegarde illisible, on repart de zéro :', e);
    }
  }

  let _resumePosition = false;

  /**
   * Premier lancement de la version 3D : on récupère la partie 2D de Robin
   * (nom, starter, collection, dresseurs battus). La clé `robinGame_v2` est
   * lue, JAMAIS écrite.
   */
  function importOldSave() {
    let old = null;
    try {
      const raw = localStorage.getItem(OLD_SAVE_KEY);
      if (raw) old = JSON.parse(raw);
    } catch (e) { old = null; }
    if (!old) return;

    try {
      if (old.playerName) {
        state.playerName = old.playerName;
        const input = document.getElementById('name-input');
        if (input) input.value = old.playerName;
      }
      if (old.collection && typeof old.collection === 'object') {
        for (const id in old.collection) {
          state.collection[id] = old.collection[id];
          state.seen[id] = true;
        }
      }
      if (old.defeatedTrainers) state.defeatedTrainers = old.defeatedTrainers;

      const team = teamApi();
      if (team && team.importFromV2) {
        const rapport = safeCall('team.importFromV2', function () { return team.importFromV2(old); });
        if (rapport && (rapport.team || rapport.box)) {
          console.log('[game3d] partie 2D reprise : ' + rapport.team + ' au combat, ' + rapport.box + ' en boîte.');
        }
      }
      // On sauvegarde tout de suite dans la NOUVELLE clé : l'import n'aura
      // lieu qu'une seule fois, quoi qu'il arrive ensuite.
      saveGame();
    } catch (e) {
      console.warn('[game3d] import de la sauvegarde 2D impossible :', e);
    }
  }

  // ===========================================================================
  //  16. API de débogage — window.GAME3D
  // ===========================================================================
  const GAME3D = {
    state: state,
    get scene() { return scene; },
    get camera() { return camera; },
    get renderer() { return renderer; },
    get player() { return playerGroup; },
    get npcs() { return npcEntries; },
    get fps() { return Math.round(fpsAvg); },
    R3: R3,
    // Fonctions utiles depuis la console
    showMessage: showMessage,
    saveGame: saveGame,
    loadGame: loadGame,
    setQuality: applyQuality,
    // Une image de jeu à la main (utile quand requestAnimationFrame est gelé).
    tick: tickGame,
    teleport: teleport,
    goRegion: function (id, x, y) { applyRegion(id, { x: x, y: y }); },
    encounter: triggerWildEncounter,
    wild: startWildBattle,
    champion: challengeChampion,
    fly: startFlight,
    airship: openAirshipMenu,
    throwBall: throwBallInWorld,
    // Vues : 'aventure' | 'rpg' | 'fps'
    setView: function (id) {
      call('camera', 'setMode', [id, false]);
      state.cameraMode = viewMode();
      call('hud', 'setViewMode', [state.cameraMode]);
      return state.cameraMode;
    },
    view: viewMode,
    turn: turnPlayer,
    compass: refreshCompass,
    gates: function () { return call('gates', 'list', []) || []; },
    heal: function () { call('team', 'healAll', []); },
    giveAll: function () {
      const dex = mod('dex');
      if (!dex || !dex.ALL) return;
      dex.ALL.forEach(function (s) {
        state.collection[s.id] = state.collection[s.id] || 1;
        state.seen[s.id] = true;
      });
      refreshHudCounters();
      saveGame();
    },
    reset: function () {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* rien */ }
      location.reload();
    },
  };
  window.GAME3D = GAME3D;
  // Certains modules (interface, carte) ont besoin de l'état du jeu.
  window.gameState = state;

  // ---------------------------------------------------------------------------
  //  Démarrage — le script est chargé en fin de <body>, mais on gère les deux cas.
  // ---------------------------------------------------------------------------
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
