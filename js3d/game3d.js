// =============================================================================
//  game3d.js — CONTRÔLEUR du « Jeu de Robin » en 3D
// =============================================================================
//  Remplace js/game.js : la LOGIQUE de jeu est reprise telle quelle (elle est
//  correcte et testée), seule la couche de rendu change — canvas 2D ➜ Three.js.
//
//  Responsabilités :
//    • créer le renderer, la scène et la caméra 3e personne ;
//    • orchestrer les modules js3d/* (sky, world, actors, hud, battle) en
//      tolérant l'absence de n'importe lequel d'entre eux ;
//    • faire tourner la machine à états title / starter / world / battle /
//      collection / map ;
//    • sauvegarder dans la MÊME clé localStorage que le jeu 2D.
// =============================================================================

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  //  Constantes de jeu (identiques au jeu 2D)
  // ---------------------------------------------------------------------------
  const MOVE_DURATION_MS = 160;   // durée d'un pas d'une tuile
  const ENCOUNTER_CHANCE = 0.18;  // 18 % de rencontre en fin de pas
  const START_X = 5;
  const START_Y = 5;
  const SAVE_KEY = 'robinGame_v2';

  // Caméra : 3e personne, ORIENTATION FIXE (un enfant ne doit jamais se perdre).
  const CAM_BACK = 11;    // recul derrière le joueur (sur +z)
  const CAM_HEIGHT = 9;   // hauteur au-dessus du joueur
  const CAM_LOOK_AHEAD = 1.6;  // on vise un peu DEVANT le joueur
  const ZOOM_MIN = 0.60;
  const ZOOM_MAX = 1.70;

  // Le jeu 2D n'a pas de piste musicale pour ces biomes : silence total.
  // On les rabat sur la piste existante la plus proche (bug corrigé ici, sans
  // toucher à js/audio.js).
  const MUSIC_FALLBACK = {
    mountain: 'forest',
    village: 'plain',
    city2: 'city',
  };

  // ---------------------------------------------------------------------------
  //  ÉTAT DU JEU — mêmes champs que le jeu 2D (la sauvegarde doit rester
  //  compatible), plus quelques champs propres à la 3D.
  // ---------------------------------------------------------------------------
  const state = {
    screen: 'title',      // 'title' | 'starter' | 'world' | 'battle' | 'collection' | 'map'
    playerName: '',
    starter: null,
    starterHp: 40,
    starterMaxHp: 40,
    starterCursor: 0,
    defeatedTrainers: {},
    player: {
      tileX: START_X,
      tileY: START_Y,
      pixelX: START_X * 16,
      pixelY: START_Y * 16,
      worldX: START_X + 0.5,   // position 3D continue (centre de tuile)
      worldZ: START_Y + 0.5,
      worldY: 0,
      dir: 'down',
      moving: false,
      moveProgress: 0,
      moveFromX: START_X, moveFromY: START_Y,
      moveToX: START_X, moveToY: START_Y,
      walkFrame: 0,
    },
    camera: { x: 0, y: 0 },   // conservé par compatibilité
    zoom: 1,
    input: { up: false, down: false, left: false, right: false },
    messages: [],
    battle: null,
    collection: {},
    tick: 0,
    lastBiome: null,
    biomeBannerTimer: 0,
  };

  // ---------------------------------------------------------------------------
  //  Variables de rendu
  // ---------------------------------------------------------------------------
  let canvas = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let playerGroup = null;
  let npcEntries = [];      // [{ group, npc }]
  let bangMarker = null;    // le « ! » au-dessus du PNJ à qui l'on peut parler
  let fallbackSun = null;   // soleil de secours si sky3d.js est absent
  let started = false;      // la boucle tourne-t-elle ?
  let lastTime = 0;

  const camPos = new THREE.Vector3();
  const camAim = new THREE.Vector3();

  // ---------------------------------------------------------------------------
  //  Accès tolérant aux modules — aucun n'est obligatoire.
  // ---------------------------------------------------------------------------
  function mod(name) { return R3.get(name); }

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

  // ===========================================================================
  //  INITIALISATION
  // ===========================================================================

  function init() {
    canvas = document.getElementById('game');
    if (!canvas) { console.error('[game3d] canvas #game introuvable.'); return; }

    initRenderer();
    initScene();
    buildModules();
    bindEvents();

    loadGame();
    refreshCollectionCount();
    updateMuteButton(typeof Audio_ !== 'undefined' && Audio_.isMuted && Audio_.isMuted());

    // Position de départ de la caméra : déjà en place, sans glissement au début.
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
    camera.position.set(START_X + 0.5, CAM_HEIGHT, START_Y + 0.5 + CAM_BACK);
  }

  function buildModules() {
    // --- Ciel, soleil, brouillard ---
    const sky = mod('sky');
    if (sky && sky.build) {
      safeCall('sky.build', function () { sky.build(scene); });
    }
    if (!sky || _broken['sky.build']) buildFallbackSky();

    // --- Terrain et décors ---
    const world = mod('world');
    if (world && world.build) {
      safeCall('world.build', function () { world.build(scene); });
    } else {
      console.warn('[game3d] module « world » absent : sol de secours.');
      buildFallbackGround();
    }
    if (_broken['world.build']) buildFallbackGround();

    // --- Joueur ---
    const actors = mod('actors');
    playerGroup = (actors && actors.buildPlayer)
      ? safeCall('actors.buildPlayer', function () { return actors.buildPlayer(); })
      : null;
    if (!playerGroup) playerGroup = buildFallbackPlayer();
    scene.add(playerGroup);

    // --- PNJ ---
    npcEntries = [];
    if (actors && actors.buildNPCs) {
      const list = safeCall('actors.buildNPCs', function () { return actors.buildNPCs(scene); });
      if (list && list.length) {
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (!e) continue;
          // On accepte aussi bien une liste de groupes qu'une liste de paires.
          const g = e.isObject3D ? e : (e.group || e.mesh || e.object || null);
          const n = e.npc || (g && g.userData && g.userData.npc) ||
                    (typeof NPCS !== 'undefined' ? NPCS[i] : null);
          if (g) npcEntries.push({ group: g, npc: n });
        }
      }
    }
    if (npcEntries.length === 0) console.warn('[game3d] aucun PNJ 3D construit.');

    // --- Marqueur « ! » de dialogue ---
    bangMarker = buildBangMarker();
    bangMarker.visible = false;
    scene.add(bangMarker);

    // --- Interface ---
    const hud = mod('hud');
    if (hud && hud.init) safeCall('hud.init', function () { hud.init(); });
    else console.warn('[game3d] module « hud » absent : interface minimale.');
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
    const g = new THREE.Mesh(
      R3.geo.plane(400, 400),
      R3.mat('#63b846', { rough: 1 })
    );
    g.rotation.x = -Math.PI / 2;
    g.position.set(60, 0, 35);
    g.receiveShadow = true;
    scene.add(g);
  }

  /** Silhouette de joueur de secours si actors3d.js manque. */
  function buildFallbackPlayer() {
    const g = R3.group(
      R3.cyl(0.17, 0.21, 0.44, '#41a6f6', 0, 0.30, 0),
      R3.sphere(0.19, '#ffd9a8', 0, 0.66, 0),
      R3.sphere(0.21, '#6b4423', 0, 0.72, -0.02)
    );
    return g;
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
  //  ÉVÉNEMENTS
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
    if (closeCol) closeCol.addEventListener('click', closeCollection);

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
    const battle = mod('battle');
    if (battle && battle.onResize) safeCall('battle.onResize', function () { battle.onResize(w, h); });
  }

  /** Molette = zoom, entre deux bornes confortables. */
  function onWheel(e) {
    if (state.screen !== 'world') return;
    e.preventDefault();
    const step = (e.deltaY > 0 ? 1 : -1) * 0.09;
    state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom + step));
  }

  function releaseAllKeys() {
    state.input.up = state.input.down = state.input.left = state.input.right = false;
  }

  // ===========================================================================
  //  ENTRÉES CLAVIER — repris à l'identique du jeu 2D
  // ===========================================================================

  function onKeyDown(e) {
    if (state.screen === 'title') return;

    // Navigation dans le menu des capacités (combat de dresseur)
    if (state.screen === 'battle' && state.battle && state.battle.isTrainer) {
      if (state.messages.length > 0) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advanceMessage(); }
        return;
      }
      if (state.battle.phase === 'choose_move') {
        e.preventDefault();
        const moves = state.starter ? (state.starter.moves || []) : [];
        switch (e.key) {
          case 'ArrowLeft': case 'a': case 'A': case 'q': case 'Q':
            if (state.battle.moveCursor % 2 === 1) state.battle.moveCursor--;
            break;
          case 'ArrowRight': case 'd': case 'D':
            if (state.battle.moveCursor % 2 === 0 && state.battle.moveCursor + 1 < moves.length)
              state.battle.moveCursor++;
            break;
          case 'ArrowUp': case 'w': case 'W': case 'z': case 'Z':
            if (state.battle.moveCursor >= 2) state.battle.moveCursor -= 2;
            break;
          case 'ArrowDown': case 's': case 'S':
            if (state.battle.moveCursor + 2 < moves.length) state.battle.moveCursor += 2;
            break;
          case ' ': case 'Enter':
            useTrainerMove();
            break;
        }
        return;
      }
      return;
    }

    // Écran de sélection du starter
    if (state.screen === 'starter') {
      if (state.messages.length > 0) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advanceMessage(); }
        return;
      }
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'q': case 'A': case 'Q':
          e.preventDefault();
          state.starterCursor = Math.max(0, state.starterCursor - 1);
          updateStarterHighlight();
          break;
        case 'ArrowRight': case 'd': case 'D':
          e.preventDefault();
          state.starterCursor = Math.min(2, state.starterCursor + 1);
          updateStarterHighlight();
          break;
        case ' ': case 'Enter':
          e.preventDefault();
          confirmStarter();
          break;
      }
      return;
    }

    // En collection : C ou Échap pour fermer
    if (state.screen === 'collection') {
      if (e.key === 'c' || e.key === 'C' || e.key === 'Escape') {
        e.preventDefault();
        closeCollection();
      }
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
      case 'c': case 'C':
        e.preventDefault();
        if (state.screen === 'world' && state.messages.length === 0) openCollection();
        break;
      case 'm': case 'M':
        e.preventDefault(); toggleMute(); break;
      case 'n': case 'N':
        e.preventDefault();
        if (state.screen === 'world' && state.messages.length === 0) openMap();
        else if (state.screen === 'map') closeMap();
        break;
      case 'Escape':
        e.preventDefault();
        if (state.screen === 'map') closeMap();
        break;
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

  function onAction() {
    // En priorité : avancer la boîte de message
    if (state.messages.length > 0) { advanceMessage(); return; }

    if (state.screen === 'battle' && state.battle && state.battle.phase === 'await') {
      throwPokeball();
      return;
    }
    if (state.screen === 'world' && !state.player.moving) {
      const front = getTileInFront();
      const npc = getNPCAt(front.x, front.y);
      if (npc) { talkToNPC(npc); return; }
    }
    if (state.screen === 'map') closeMap();
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

  function talkToNPC(npc) {
    Audio_.sfx.menu();
    if (npc.isTrainer && !state.defeatedTrainers[npc.id]) {
      startTrainerBattle(npc);
      return;
    }
    const lines = (npc.isTrainer && state.defeatedTrainers[npc.id] && npc.dialogDefeated)
      ? npc.dialogDefeated
      : npc.dialog;
    for (let i = 0; i < lines.length; i++) {
      showMessage(npc.name + ' : ' + lines[i]);
    }
  }

  function toggleMute() {
    const muted = Audio_.toggleMute();
    updateMuteButton(muted);
  }

  function updateMuteButton(muted) {
    const btn = document.getElementById('mute-btn');
    if (!btn) return;
    btn.classList.toggle('muted', !!muted);
    btn.textContent = muted ? '♪̸' : '♪';
    btn.setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son');
  }

  /** Musique du biome, avec repli pour les biomes sans piste dédiée. */
  function playBiomeMusic(biome) {
    if (!biome) return;
    try { Audio_.playMusic(MUSIC_FALLBACK[biome] || biome); } catch (e) { /* audio indispo */ }
  }

  // ===========================================================================
  //  BOUCLE PRINCIPALE
  // ===========================================================================

  function frame(timestamp) {
    requestAnimationFrame(frame);
    if (!started) return;

    if (!lastTime) lastTime = timestamp;
    const rawMs = Math.max(0.1, timestamp - lastTime);
    lastTime = timestamp;
    const dtMs = Math.min(50, rawMs);   // dt borné, comme dans le jeu 2D

    R3.tickClock(dtMs);
    const dt = R3.clock.dt;
    const t = R3.clock.t;

    state.tick++;
    if (state.biomeBannerTimer > 0) state.biomeBannerTimer -= dtMs;

    measureFps(rawMs);

    // --- Logique ---
    if (state.screen === 'world') updateWorld(dtMs);
    else if (state.screen === 'battle') updateBattle(dtMs);

    // --- Monde 3D (toujours animé : il sert aussi de décor à l'écran titre) ---
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

    const world = mod('world');
    if (world && world.update) safeCall('world.update', function () { world.update(t, px, pz); });

    const water = mod('water');
    if (water && water.update) safeCall('water.update', function () { water.update(t); });

    const sky = mod('sky');
    if (sky && sky.update) safeCall('sky.update', function () { sky.update(t, px, pz); });

    // Soleil de secours : on le garde centré sur le joueur pour que l'ombre suive.
    if (fallbackSun) {
      fallbackSun.position.set(px + 18, 30, pz + 12);
      fallbackSun.target.position.set(px, 0, pz);
      fallbackSun.target.updateMatrixWorld();
    }

    // PNJ : petite animation d'attente.
    const actors = mod('actors');
    if (actors && actors.updateNPC && npcEntries.length) {
      safeCall('actors.updateNPC', function () {
        for (let i = 0; i < npcEntries.length; i++) {
          const e = npcEntries[i];
          if (!e.npc) continue;
          // Culling simple : on n'anime que ce qui est autour du joueur.
          const d = Math.abs(e.npc.x + 0.5 - px) + Math.abs(e.npc.y + 0.5 - pz);
          if (d > R3.quality.viewDistance) continue;
          actors.updateNPC(e.group, e.npc, t);
        }
      });
    }

    updateBangMarker(t);
  }

  /** Le « ! » au-dessus du PNJ juste devant le joueur. */
  function updateBangMarker(t) {
    if (!bangMarker) return;
    if (state.screen !== 'world' || state.player.moving) { bangMarker.visible = false; return; }
    const front = getTileInFront();
    const npc = (typeof getNPCAt === 'function') ? getNPCAt(front.x, front.y) : null;
    if (!npc) { bangMarker.visible = false; return; }
    const gx = npc.x + 0.5, gz = npc.y + 0.5;
    bangMarker.visible = true;
    bangMarker.position.set(gx, groundHeight(gx, gz) + 1.55 + Math.sin(t * 3.4) * 0.07, gz);
    bangMarker.rotation.y = Math.sin(t * 1.6) * 0.18;
  }

  // ===========================================================================
  //  ÉCRAN « MONDE » — logique de déplacement reprise à l'identique
  // ===========================================================================

  function updateWorld(dt) {
    // Un message ouvert bloque les déplacements
    if (state.messages.length > 0) return;

    if (state.player.moving) {
      state.player.moveProgress += dt / MOVE_DURATION_MS;
      if (state.player.moveProgress >= 1) {
        // Fin du pas
        state.player.moveProgress = 1;
        state.player.tileX = state.player.moveToX;
        state.player.tileY = state.player.moveToY;
        state.player.pixelX = state.player.tileX * 16;
        state.player.pixelY = state.player.tileY * 16;
        state.player.moving = false;

        // Changement de biome : bannière, ciel, musique, sauvegarde
        const biome = getBiomeAt(state.player.tileX, state.player.tileY);
        if (biome && biome !== state.lastBiome) {
          state.lastBiome = biome;
          state.biomeBannerTimer = 2000;
          onBiomeChanged(biome);
        }

        // Rencontre ?
        if (isEncounterTile(state.player.tileX, state.player.tileY)) {
          if (Math.random() < ENCOUNTER_CHANCE) triggerEncounter();
        }
      }
      return;
    }

    // Déclencher un nouveau pas — priorité haut > bas > gauche > droite
    let dx = 0, dy = 0;
    let newDir = state.player.dir;
    if (state.input.up)         { dy = -1; newDir = 'up';    }
    else if (state.input.down)  { dy = 1;  newDir = 'down';  }
    else if (state.input.left)  { dx = -1; newDir = 'left';  }
    else if (state.input.right) { dx = 1;  newDir = 'right'; }

    if (dx !== 0 || dy !== 0) {
      state.player.dir = newDir;
      const nx = state.player.tileX + dx;
      const ny = state.player.tileY + dy;
      if (isWalkable(nx, ny) && !getNPCAt(nx, ny)) {
        state.player.moving = true;
        state.player.moveProgress = 0;
        state.player.moveFromX = state.player.tileX;
        state.player.moveFromY = state.player.tileY;
        state.player.moveToX = nx;
        state.player.moveToY = ny;
        state.player.walkFrame = 1 - state.player.walkFrame;
        Audio_.sfx.footstep();
      }
    }
  }

  function onBiomeChanged(biome) {
    const label = (typeof BIOME_LABEL !== 'undefined') ? BIOME_LABEL[biome] : null;
    const hud = mod('hud');
    if (hud && hud.setBiomeBanner && label) {
      safeCall('hud.setBiomeBanner', function () { hud.setBiomeBanner(label); });
    }
    const sky = mod('sky');
    if (sky && sky.setBiome) {
      safeCall('sky.setBiome', function () { sky.setBiome(biome, false); });
    } else if (scene.fog) {
      // Repli : on fait au moins bouger la couleur du brouillard et du ciel.
      const mood = R3.biomeMood(biome);
      scene.fog.color.set(mood.fog);
      if (scene.background && scene.background.set) scene.background.set(mood.sky);
    }
    playBiomeMusic(biome);
    // Le jeu 2D ne sauvait la position qu'à la capture : c'était frustrant.
    saveGame();
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
    const p = state.player;
    let tx, ty;
    if (p.moving) {
      const k = R3.clamp01(p.moveProgress);
      tx = p.moveFromX + (p.moveToX - p.moveFromX) * k;
      ty = p.moveFromY + (p.moveToY - p.moveFromY) * k;
      p.pixelX = tx * 16;
      p.pixelY = ty * 16;
    } else {
      tx = p.tileX;
      ty = p.tileY;
    }
    p.worldX = tx + 0.5;
    p.worldZ = ty + 0.5;
    p.worldY = groundHeight(p.worldX, p.worldZ);

    if (!playerGroup) return;
    playerGroup.position.set(p.worldX, p.worldY, p.worldZ);
    // On ne le cache que si battle3d prend vraiment la main sur le rendu.
    playerGroup.visible = (state.screen !== 'battle') || !mod('battle');

    const actors = mod('actors');
    if (actors && actors.updatePlayer) {
      safeCall('actors.updatePlayer', function () {
        actors.updatePlayer(playerGroup, {
          moving: p.moving,
          moveProgress: p.moveProgress,
          dir: p.dir,
          t: R3.clock.t,
        });
      });
    } else {
      // Repli : au moins orienter le bonhomme dans la bonne direction.
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
  //  CAMÉRA : 3e personne, orientation FIXE, suivi lissé.
  // ---------------------------------------------------------------------------
  function updateCamera(dt) {
    if (!camera) return;
    const p = state.player;
    const z = state.zoom;

    // Léger balancement décoratif, uniquement sur l'écran titre.
    const idle = (state.screen === 'title' || state.screen === 'starter')
      ? Math.sin(R3.clock.t * 0.25) * 2.2 : 0;

    const tx = p.worldX + idle;
    const ty = p.worldY + CAM_HEIGHT * z;
    const tz = p.worldZ + CAM_BACK * z;

    camPos.set(tx, ty, tz);

    // Anti-traversée du relief : la caméra reste au-dessus du terrain.
    const hCam = groundHeight(camPos.x, camPos.z);
    if (camPos.y < hCam + 2.2) camPos.y = hCam + 2.2;

    // 0.86 ≈ 14 % de rattrapage par image à 60 Hz : doux mais jamais mou.
    const smooth = (dt > 1) ? 0 : 0.86;     // dt géant = recentrage immédiat
    camera.position.set(
      R3.damp(camera.position.x, camPos.x, smooth, dt),
      R3.damp(camera.position.y, camPos.y, smooth, dt),
      R3.damp(camera.position.z, camPos.z, smooth, dt)
    );

    // On vise un peu DEVANT le joueur : il n'est jamais collé au bas de l'écran.
    camAim.set(p.worldX + idle * 0.5, p.worldY + 0.85, p.worldZ - CAM_LOOK_AHEAD);
    camera.lookAt(camAim);
  }

  // ===========================================================================
  //  COMBAT SAUVAGE / CAPTURE
  // ===========================================================================

  function triggerEncounter() {
    const biome = getBiomeAt(state.player.tileX, state.player.tileY);
    const creature = pickRandomCreature(biome);
    if (creature.rare) Audio_.sfx.rare();
    else Audio_.sfx.encounter();
    startBattle(creature);
  }

  function startBattle(creature) {
    state.screen = 'battle';
    state.battle = {
      creature: creature,
      phase: 'intro',
      pokeballX: 0,
      pokeballY: 0,
      animTick: 0,
      shakeOffset: 0,
      result: null,
      creatureVisible: true,
      flashTick: 0,
      hitPlayed: false,
      lastShakeIndex: -1,
      throwProgress: 0,   // 0 → 1 pendant le lancer (pour battle3d)
      shakeIndex: -1,
    };
    enterBattleScene();
    showMessage(
      'Un ' + creature.name + ' sauvage apparaît !\n' + creature.description +
      '\n\nESPACE pour lancer ta Pokéball, ' + state.playerName + ' ✦',
      function () {
        if (state.battle) state.battle.phase = 'await';
      }
    );
  }

  function throwPokeball() {
    if (!state.battle || state.battle.phase !== 'await') return;
    state.battle.phase = 'throw';
    state.battle.animTick = 0;
    Audio_.sfx.throwBall();
  }

  function updateBattle(dt) {
    if (!state.battle) return;
    const b = state.battle;

    if (b.isTrainer) { syncTrainerHud(b); return; }

    if (b.phase === 'throw') {
      b.animTick += dt;
      const t = b.animTick;
      const throwDuration = 600;    // ms : la ball atteint la créature
      const shakeDuration = 1200;   // ms : 3 secousses de 400 ms

      if (t < throwDuration) {
        const p = t / throwDuration;
        b.throwProgress = p;
        // Trajectoire en parabole (normalisée, battle3d la met à l'échelle 3D)
        b.pokeballX = p;
        b.pokeballY = Math.sin(p * Math.PI);
      } else if (t < throwDuration + shakeDuration) {
        if (!b.hitPlayed) { Audio_.sfx.hit(); b.hitPlayed = true; }
        b.creatureVisible = false;
        b.throwProgress = 1;
        b.pokeballX = 1;
        b.pokeballY = 0;
        const shakePhase = (t - throwDuration) % 400;
        const shakeIdx = Math.floor((t - throwDuration) / 400);
        if (shakeIdx !== b.lastShakeIndex && shakeIdx > 0) Audio_.sfx.shake();
        b.lastShakeIndex = shakeIdx;
        b.shakeIndex = shakeIdx;
        if (shakePhase < 100) b.shakeOffset = -2;
        else if (shakePhase < 200) b.shakeOffset = 2;
        else if (shakePhase < 300) b.shakeOffset = -1;
        else b.shakeOffset = 0;
      } else {
        // Résultat
        b.shakeOffset = 0;
        const success = Math.random() < b.creature.catchRate;
        b.result = success ? 'caught' : 'escaped';
        b.phase = 'result';

        if (success) {
          const cid = b.creature.id;
          state.collection[cid] = (state.collection[cid] || 0) + 1;
          saveGame();
          refreshCollectionCount();
          Audio_.sfx.catch();
          showMessage(
            'Hourra ! ' + b.creature.name + ' a rejoint ta collection ! ✦',
            function () { endBattle(); }
          );
        } else {
          b.creatureVisible = true;
          Audio_.sfx.escape();
          showMessage(
            'Oh non... ' + b.creature.name + ' s\'est échappé(e) !',
            function () { endBattle(); }
          );
        }
      }
    } else if (b.phase === 'result') {
      b.flashTick += dt;
    }
  }

  function enterBattleScene() {
    const battle = mod('battle');
    const biome = getBiomeAt(state.player.tileX, state.player.tileY) || 'plain';
    if (battle && battle.enter) {
      safeCall('battle.enter', function () { battle.enter(state.battle, biome); });
    }
  }

  function endBattle() {
    state.screen = 'world';
    state.battle = null;
    _hudCache.menu = null;
    _hudCache.foe = '';
    _hudCache.player = '';
    const hud = mod('hud');
    if (hud) {
      if (hud.hideMoveMenu) safeCall('hud.hideMoveMenu', function () { hud.hideMoveMenu(); });
      if (hud.hideBattleUI) safeCall('hud.hideBattleUI', function () { hud.hideBattleUI(); });
      else if (hud.hideHP) safeCall('hud.hideHP', function () { hud.hideHP(); });
    }
    const battle = mod('battle');
    if (battle && battle.exit) safeCall('battle.exit', function () { battle.exit(); });
  }

  // ===========================================================================
  //  MESSAGES
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

  function refreshCollectionCount() {
    const hud = mod('hud');
    if (!hud || !hud.setCollectionCount) return;
    const uniques = Object.keys(state.collection).length;
    const total = (typeof CREATURES !== 'undefined') ? CREATURES.length : 26;
    safeCall('hud.setCollectionCount', function () { hud.setCollectionCount(uniques, total); });
  }

  // ===========================================================================
  //  ÉCRAN TITRE / LANCEMENT DE LA PARTIE
  // ===========================================================================

  function startGame() {
    const input = document.getElementById('name-input');
    const name = (input && input.value.trim()) || 'Robin';
    state.playerName = name;
    const overlay = document.getElementById('title-overlay');
    if (overlay) overlay.classList.add('hidden');
    Audio_.init();
    if (state.starter) {
      launchWorld();          // partie déjà commencée : on repart directement
    } else {
      state.screen = 'starter';
      openStarterSelection(); // première partie : choix du compagnon
    }
  }

  function openStarterSelection() {
    state.starterCursor = 0;
    const overlay = document.getElementById('starter-overlay');
    if (overlay) overlay.classList.remove('hidden');
    buildStarterCards();
  }

  function buildStarterCards() {
    const grid = document.getElementById('starter-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const options = [
      { id: 'miaouche', label: 'Animal mignon' },
      { id: 'flamdrak', label: 'Dragon de feu' },
      { id: null,       label: 'Surprise !' },
    ];
    options.forEach(function (opt, i) {
      const card = document.createElement('div');
      card.className = 'starter-card' + (i === 0 ? ' selected' : '');
      card.id = 'starter-card-' + i;
      card.onclick = function () {
        state.starterCursor = i;
        updateStarterHighlight();
        confirmStarter();
      };

      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      cv.style.imageRendering = 'pixelated';
      const cctx = cv.getContext('2d');
      cctx.imageSmoothingEnabled = false;
      cctx.fillStyle = '#1a1c2c';
      cctx.fillRect(0, 0, 64, 64);
      if (opt.id) {
        const c = CREATURES.find(function (cr) { return cr.id === opt.id; });
        if (c) c.draw(cctx, 16, 16, 2);
      } else {
        cctx.fillStyle = '#fcec6c';
        cctx.font = 'bold 32px sans-serif';
        cctx.textAlign = 'center';
        cctx.textBaseline = 'middle';
        cctx.fillText('?', 32, 34);
      }
      card.appendChild(cv);

      const nameEl = document.createElement('div');
      nameEl.className = 'starter-name';
      nameEl.textContent = opt.id
        ? CREATURES.find(function (cr) { return cr.id === opt.id; }).name
        : '???';
      card.appendChild(nameEl);

      const typeEl = document.createElement('div');
      typeEl.className = 'starter-type';
      typeEl.textContent = opt.label;
      card.appendChild(typeEl);

      grid.appendChild(card);
    });
  }

  function updateStarterHighlight() {
    const cards = document.querySelectorAll('.starter-card');
    for (let i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('selected', i === state.starterCursor);
    }
  }

  function confirmStarter() {
    const optIds = ['miaouche', 'flamdrak', null];
    let id = optIds[state.starterCursor];
    if (!id) {
      // Surprise : créature aléatoire (sauf les deux starters fixes)
      const pool = CREATURES.filter(function (c) {
        return c.id !== 'miaouche' && c.id !== 'flamdrak';
      });
      id = pool[Math.floor(Math.random() * pool.length)].id;
    }
    state.starter = CREATURES.find(function (c) { return c.id === id; });
    state.starterHp = state.starterMaxHp;

    const overlay = document.getElementById('starter-overlay');
    if (overlay) overlay.classList.add('hidden');
    Audio_.sfx.catch();
    showMessage(
      'Tu as choisi ' + state.starter.name + ' ! ✦\n' + state.starter.description +
      '\nPrends-en bien soin dans tes combats !',
      function () { launchWorld(); }
    );
  }

  function launchWorld() {
    state.screen = 'world';
    state.lastBiome = getBiomeAt(state.player.tileX, state.player.tileY);
    state.biomeBannerTimer = 2000;
    saveGame();

    // Ambiance de départ
    const sky = mod('sky');
    if (sky && sky.setBiome) {
      safeCall('sky.setBiome.init', function () { sky.setBiome(state.lastBiome, true); });
    }
    const hud = mod('hud');
    const label = (typeof BIOME_LABEL !== 'undefined') ? BIOME_LABEL[state.lastBiome] : null;
    if (hud && hud.setBiomeBanner && label) {
      safeCall('hud.setBiomeBanner.init', function () { hud.setBiomeBanner(label); });
    }
    playBiomeMusic(state.lastBiome);
    refreshCollectionCount();

    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) muteBtn.style.display = '';
    const hint = document.getElementById('controls-hint');
    if (hint) hint.classList.remove('hidden');

    showMessage(
      'Bienvenue, ' + state.playerName + ' ! ✦\n' +
      'Flèches pour explorer · Hautes herbes = rencontres.\n' +
      'Parle aux dresseurs pour les affronter !\n' +
      'C : collection · N : carte · M : son · Molette : zoom'
    );
  }

  // ===========================================================================
  //  COMBAT CONTRE LES DRESSEURS — logique reprise telle quelle
  // ===========================================================================

  function startTrainerBattle(npc) {
    if (!state.starter) return;
    const trainerCreature = CREATURES.find(function (c) { return c.id === npc.party[0]; })
      || CREATURES[0];
    Audio_.sfx.encounter();
    state.screen = 'battle';
    state.battle = {
      isTrainer: true,
      trainer: npc,
      trainerCreature: trainerCreature,
      trainerHp: 40,
      trainerMaxHp: 40,
      playerHp: state.starterHp,
      playerMaxHp: state.starterMaxHp,
      phase: 'intro',
      moveCursor: 0,
      animTick: 0,
      result: null,
      creatureVisible: true,
      attackSeq: 0,          // incrémenté à chaque coup porté
      pendingAttacks: [],    // [{ side, move, dmg }] — battle3d peut les consommer
    };
    enterBattleScene();
    showMessage(
      npc.name + ' : "' + npc.dialog[0] + '"\n' +
      npc.name + ' envoie ' + trainerCreature.name + ' au combat !',
      function () {
        if (state.battle) {
          state.battle.phase = 'choose_move';
          state.battle.moveCursor = 0;
        }
      }
    );
  }

  function useTrainerMove() {
    const b = state.battle;
    if (!b || !b.isTrainer || b.phase !== 'choose_move') return;
    if (state.messages.length > 0) return;

    const moves = state.starter ? (state.starter.moves || []) : [];
    const move = moves[b.moveCursor] || moves[0] || { name: 'Attaque', power: [10, 16] };

    b.phase = 'animating';
    b.pendingAttacks = [];

    let playerMsg = '';

    if (move.heal) {
      const healed = Math.min(move.heal, b.playerMaxHp - b.playerHp);
      b.playerHp = Math.min(b.playerMaxHp, b.playerHp + move.heal);
      playerMsg = state.starter.name + ' utilise ' + move.name + ' !\n+' + healed + ' PV récupérés !';
      b.pendingAttacks.push({ side: 'player', move: move, heal: healed });
    } else {
      const dmg = rollDamage(move.power);
      b.trainerHp = Math.max(0, b.trainerHp - dmg);
      playerMsg = state.starter.name + ' utilise ' + move.name + ' !\n' +
        dmg + ' dégâts sur ' + b.trainerCreature.name + ' !';
      b.pendingAttacks.push({ side: 'player', move: move, dmg: dmg });
    }
    b.attackSeq++;

    if (b.trainerHp <= 0) {
      b.phase = 'result'; b.result = 'win'; b.creatureVisible = false;
      Audio_.sfx.catch();
      const cid = b.trainerCreature.id;
      state.collection[cid] = (state.collection[cid] || 0) + 1;
      state.defeatedTrainers[b.trainer.id] = true;
      state.starterHp = b.playerHp;
      saveGame();
      refreshCollectionCount();
      showMessage(
        playerMsg + '\nVictoire ! ' + b.trainer.name + ' est battu ! ✦\n' +
        b.trainerCreature.name + ' rejoint ta collection !',
        function () { endBattle(); }
      );
      return;
    }

    // Tour du dresseur (l'IA choisit une capacité)
    const aiMove = pickAIMove(b.trainerCreature, b);
    let trainerMsg = '';

    if (aiMove.heal) {
      const healed = Math.min(aiMove.heal, b.trainerMaxHp - b.trainerHp);
      b.trainerHp = Math.min(b.trainerMaxHp, b.trainerHp + aiMove.heal);
      trainerMsg = b.trainerCreature.name + ' utilise ' + aiMove.name + ' !\n+' + healed + ' PV récupérés.';
      b.pendingAttacks.push({ side: 'foe', move: aiMove, heal: healed });
    } else {
      const dmg = rollDamage(aiMove.power);
      b.playerHp = Math.max(0, b.playerHp - dmg);
      trainerMsg = b.trainerCreature.name + ' utilise ' + aiMove.name + ' !\n' +
        dmg + ' dégâts sur ' + state.starter.name + ' !';
      b.pendingAttacks.push({ side: 'foe', move: aiMove, dmg: dmg });
    }
    b.attackSeq++;

    if (b.playerHp <= 0) {
      b.phase = 'result'; b.result = 'lose';
      Audio_.sfx.escape();
      state.starterHp = state.starterMaxHp;
      saveGame();
      showMessage(
        playerMsg + '\n' + trainerMsg + '\nOh non, tu as perdu...',
        function () { endBattle(); }
      );
    } else {
      b.phase = 'choose_move';
      state.starterHp = b.playerHp;
      showMessage(
        playerMsg + '\n' + trainerMsg + '\nPV ' + b.trainerCreature.name + ': ' +
        b.trainerHp + '/' + b.trainerMaxHp + '  ·  Tes PV: ' + b.playerHp + '/' + b.playerMaxHp
      );
    }
  }

  function rollDamage(powerRange) {
    return powerRange[0] + Math.floor(Math.random() * (powerRange[1] - powerRange[0] + 1));
  }

  function pickAIMove(creature, b) {
    const moves = creature.moves || [];
    if (moves.length === 0) return { name: 'Attaque', power: [8, 15] };
    // Préfère soigner si les PV sont bas (< 30 %)
    if (b.trainerHp / b.trainerMaxHp < 0.3) {
      const healMove = moves.find(function (m) { return m.heal; });
      if (healMove) return healMove;
    }
    const attackMoves = moves.filter(function (m) { return !m.heal; });
    const pool = attackMoves.length > 0 ? attackMoves : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // --- Synchronisation de l'interface de combat (barres de PV, menu) ---------
  const _hudCache = { menu: null, cursor: -1, foe: '', player: '' };

  function syncTrainerHud(b) {
    const hud = mod('hud');
    if (!hud) return;

    const wantMenu = (b.phase === 'choose_move' && state.messages.length === 0);
    if (wantMenu !== _hudCache.menu) {
      _hudCache.menu = wantMenu;
      _hudCache.cursor = -1;
      if (wantMenu && hud.showMoveMenu) {
        safeCall('hud.showMoveMenu', function () { hud.showMoveMenu(b); });
      } else if (!wantMenu && hud.hideMoveMenu) {
        safeCall('hud.hideMoveMenu', function () { hud.hideMoveMenu(); });
      }
    }
    if (wantMenu && hud.setMoveCursor && b.moveCursor !== _hudCache.cursor) {
      _hudCache.cursor = b.moveCursor;
      safeCall('hud.setMoveCursor', function () { hud.setMoveCursor(b.moveCursor); });
    }

    if (!hud.setHP) return;
    const foeKey = b.trainerHp + '/' + b.trainerMaxHp;
    if (foeKey !== _hudCache.foe) {
      _hudCache.foe = foeKey;
      safeCall('hud.setHP.foe', function () {
        hud.setHP('foe', b.trainerHp, b.trainerMaxHp, b.trainerCreature.name);
      });
    }
    const plKey = b.playerHp + '/' + b.playerMaxHp;
    if (plKey !== _hudCache.player) {
      _hudCache.player = plKey;
      safeCall('hud.setHP.player', function () {
        hud.setHP('player', b.playerHp, b.playerMaxHp, state.starter ? state.starter.name : '');
      });
    }
  }

  // ===========================================================================
  //  COLLECTION
  // ===========================================================================

  function openCollection() {
    state.screen = 'collection';
    Audio_.sfx.menu();
    releaseAllKeys();
    const hud = mod('hud');
    if (hud && hud.openCollection) {
      safeCall('hud.openCollection', function () { hud.openCollection(); });
      if (!_broken['hud.openCollection']) return;
    }
    buildCollectionGridFallback();
    const overlay = document.getElementById('collection-overlay');
    if (overlay) overlay.classList.remove('hidden');
  }

  function closeCollection() {
    Audio_.sfx.menu();
    const hud = mod('hud');
    if (hud && hud.closeCollection) {
      safeCall('hud.closeCollection', function () { hud.closeCollection(); });
    }
    const overlay = document.getElementById('collection-overlay');
    if (overlay) overlay.classList.add('hidden');
    state.screen = 'world';
  }

  /** Grille de la collection en repli (si hud3d.js ne la fournit pas).
   *  Les vignettes réutilisent le dessin 2D des créatures : c'est joli et ça
   *  marche tel quel. */
  function buildCollectionGridFallback() {
    const grid = document.getElementById('collection-grid');
    if (!grid || typeof CREATURES === 'undefined') return;
    grid.innerHTML = '';
    CREATURES.forEach(function (c) {
      const count = state.collection[c.id] || 0;
      const card = document.createElement('div');
      card.className = 'creature-card' + (count === 0 ? ' unknown' : '');

      const cv = document.createElement('canvas');
      cv.width = 32; cv.height = 32;
      const cctx = cv.getContext('2d');
      cctx.imageSmoothingEnabled = false;
      if (count > 0) {
        c.draw(cctx, 0, 0, 2);
      } else {
        cctx.fillStyle = '#0a0a14';
        cctx.fillRect(0, 0, 32, 32);
        cctx.fillStyle = '#566c86';
        cctx.font = 'bold 20px sans-serif';
        cctx.textAlign = 'center';
        cctx.textBaseline = 'middle';
        cctx.fillText('?', 16, 18);
      }
      card.appendChild(cv);

      const nameEl = document.createElement('div');
      nameEl.className = 'creature-name';
      nameEl.textContent = count > 0 ? c.name : '???';
      card.appendChild(nameEl);

      const countEl = document.createElement('div');
      countEl.className = 'creature-count';
      countEl.textContent = count > 0 ? '×' + count : 'Pas encore vu';
      card.appendChild(countEl);

      grid.appendChild(card);
    });
  }

  // ===========================================================================
  //  CARTE DU MONDE
  // ===========================================================================

  function openMap() {
    if (state.screen !== 'world') return;
    const hud = mod('hud');
    if (!hud || !hud.openMap) { console.warn('[game3d] carte indisponible (hud absent).'); return; }
    // On relâche les touches pour ne pas repartir tout seul en fermant la carte.
    releaseAllKeys();
    state.screen = 'map';
    Audio_.sfx.menu();
    safeCall('hud.openMap', function () { hud.openMap(); });
  }

  function closeMap() {
    if (state.screen !== 'map') return;
    Audio_.sfx.menu();
    const hud = mod('hud');
    if (hud && hud.closeMap) safeCall('hud.closeMap', function () { hud.closeMap(); });
    releaseAllKeys();
    state.screen = 'world';
  }

  // ===========================================================================
  //  AUTO-QUALITÉ — on descend d'un cran si ça rame, jamais on ne remonte.
  // ===========================================================================
  let fpsAvg = 60;
  let lowFpsTime = 0;
  let warmup = 3;         // secondes de chauffe avant de juger
  let qualityCooldown = 0;
  let fpsDisplayTimer = 0;

  const QUALITY_DOWN = { high: 'medium', medium: 'low', low: null };

  function measureFps(rawMs) {
    // Gros à-coup (onglet passé en arrière-plan, chargement) : on ne juge pas
    // la qualité là-dessus, sinon on dégraderait le jeu pour rien.
    if (rawMs > 120) return;
    const s = rawMs / 1000;
    const inst = 1 / Math.max(0.001, s);
    // Moyenne glissante (exponentielle) : ~1 s de mémoire.
    fpsAvg += (inst - fpsAvg) * Math.min(1, s * 1.5);

    if (warmup > 0) { warmup -= s; lowFpsTime = 0; }
    if (qualityCooldown > 0) qualityCooldown -= s;

    if (warmup <= 0) {
      if (fpsAvg < 40) lowFpsTime += s;
      else lowFpsTime = 0;

      if (lowFpsTime >= 2 && qualityCooldown <= 0) {
        const next = QUALITY_DOWN[R3.quality.level];
        lowFpsTime = 0;
        qualityCooldown = 6;
        if (next) {
          console.warn('[game3d] ' + Math.round(fpsAvg) + ' fps : qualité ➜ ' + next);
          applyQuality(next);
        }
      }
    }

    fpsDisplayTimer += s;
    if (fpsDisplayTimer > 0.25) {
      fpsDisplayTimer = 0;
      const hud = mod('hud');
      if (hud && hud.setFps) safeCall('hud.setFps', function () { hud.setFps(Math.round(fpsAvg)); });
    }
  }

  function applyQuality(level) {
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
  }

  // ===========================================================================
  //  SAUVEGARDE — MÊME clé et MÊMES champs que le jeu 2D, pour que la
  //  progression de Robin passe d'une version à l'autre dans les deux sens.
  // ===========================================================================

  function saveGame() {
    try {
      const data = {
        playerName: state.playerName,
        starterId: state.starter ? state.starter.id : null,
        starterHp: state.starterHp,
        collection: state.collection,
        defeatedTrainers: state.defeatedTrainers,
        tileX: state.player.tileX,
        tileY: state.player.tileY,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* localStorage indisponible : on ignore */ }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.playerName) {
        state.playerName = data.playerName;
        const input = document.getElementById('name-input');
        if (input) input.value = data.playerName;
      }
      if (data.starterId) {
        state.starter = CREATURES.find(function (c) { return c.id === data.starterId; }) || null;
        if (data.starterHp) state.starterHp = data.starterHp;
      }
      if (data.collection) state.collection = data.collection;
      if (data.defeatedTrainers) state.defeatedTrainers = data.defeatedTrainers;
      if (typeof data.tileX === 'number' && typeof data.tileY === 'number'
          && isWalkable(data.tileX, data.tileY)) {
        state.player.tileX = data.tileX;
        state.player.tileY = data.tileY;
        state.player.pixelX = data.tileX * 16;
        state.player.pixelY = data.tileY * 16;
        state.player.moveFromX = state.player.moveToX = data.tileX;
        state.player.moveFromY = state.player.moveToY = data.tileY;
        state.player.worldX = data.tileX + 0.5;
        state.player.worldZ = data.tileY + 0.5;
      }
      state.lastBiome = getBiomeAt(state.player.tileX, state.player.tileY);
    } catch (e) { /* données corrompues : on ignore */ }
  }

  // ===========================================================================
  //  API de débogage — window.GAME3D
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
    teleport: function (tx, ty) {
      state.player.tileX = tx; state.player.tileY = ty;
      state.player.moving = false; state.player.moveProgress = 0;
      state.player.moveFromX = state.player.moveToX = tx;
      state.player.moveFromY = state.player.moveToY = ty;
      updatePlayerTransform(0);
      updateCamera(1e9);
    },
    encounter: triggerEncounter,
    giveAll: function () {
      CREATURES.forEach(function (c) { state.collection[c.id] = state.collection[c.id] || 1; });
      refreshCollectionCount();
      saveGame();
    },
  };
  window.GAME3D = GAME3D;
  // Certains modules (interface, carte) peuvent avoir besoin de l'état du jeu.
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
