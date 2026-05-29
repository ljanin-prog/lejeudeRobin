// ============================================================
//  Le jeu de Robin — moteur principal du jeu
// ============================================================

const CANVAS_W = 256;
const CANVAS_H = 192;
const VIEW_TILES_X = CANVAS_W / TILE;  // 16
const VIEW_TILES_Y = CANVAS_H / TILE;  // 12
const MOVE_DURATION_MS = 160;          // durée d'un déplacement d'une tuile
const ENCOUNTER_CHANCE = 0.18;

const START_X = 5;
const START_Y = 5;

const STARTER_IDS = ['miaouche', 'flamdrak', null]; // null = surprise

const state = {
  screen: 'title',     // 'title' | 'starter' | 'world' | 'battle' | 'collection' | 'map'
  playerName: '',
  starter: null,        // créature de départ choisie
  starterHp: 40,        // PV actuels du starter
  starterMaxHp: 40,
  starterCursor: 0,     // curseur sur l'écran de sélection du starter
  defeatedTrainers: {}, // id des dresseurs battus
  player: {
    tileX: START_X,
    tileY: START_Y,
    pixelX: START_X * TILE,
    pixelY: START_Y * TILE,
    dir: 'down',
    moving: false,
    moveProgress: 0,
    moveFromX: 0, moveFromY: 0,
    moveToX: 0, moveToY: 0,
    walkFrame: 0,
  },
  camera: { x: 0, y: 0 },
  input: { up: false, down: false, left: false, right: false },
  messages: [],
  battle: null,
  collection: {},
  tick: 0,
  lastBiome: null,
  biomeBannerTimer: 0,
};

let canvas, ctx;
let lastTime = 0;

// ============================================================
//  Initialisation
// ============================================================

window.addEventListener('DOMContentLoaded', init);

function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Boutons / inputs HTML
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      startGame();
    }
  });
  document.getElementById('close-collection').addEventListener('click', closeCollection);
  document.getElementById('mute-btn').addEventListener('click', toggleMute);

  // Clavier
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Charge la partie sauvegardée
  loadGame();

  // Dessine l'écran de titre de fond (joli)
  drawTitleBackdrop();

  requestAnimationFrame(gameLoop);
}

// ============================================================
//  Entrées clavier
// ============================================================

function onKeyDown(e) {
  if (state.screen === 'title') return;

  // Navigation dans le menu des capacités (combat dresseur)
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

  // Écran sélection du starter
  if (state.screen === 'starter') {
    // Si un message est affiché (après confirmation), ESPACE l'avance
    if (state.messages.length > 0) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        advanceMessage();
      }
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

  // En collection, juste C / Echap pour fermer
  if (state.screen === 'collection') {
    if (e.key === 'c' || e.key === 'C' || e.key === 'Escape') {
      e.preventDefault();
      closeCollection();
    }
    return;
  }

  switch (e.key) {
    case 'ArrowUp':
    case 'w':
    case 'z':
    case 'W':
    case 'Z':
      e.preventDefault();
      state.input.up = true;
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      e.preventDefault();
      state.input.down = true;
      break;
    case 'ArrowLeft':
    case 'a':
    case 'q':
    case 'A':
    case 'Q':
      e.preventDefault();
      state.input.left = true;
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      e.preventDefault();
      state.input.right = true;
      break;
    case ' ':
    case 'Enter':
      e.preventDefault();
      onAction();
      break;
    case 'c':
    case 'C':
      e.preventDefault();
      if (state.screen === 'world' && state.messages.length === 0) {
        openCollection();
      }
      break;
    case 'm':
    case 'M':
      e.preventDefault();
      toggleMute();
      break;
    case 'n':
    case 'N':
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

function toggleMute() {
  const muted = Audio_.toggleMute();
  const btn = document.getElementById('mute-btn');
  if (btn) {
    btn.classList.toggle('muted', muted);
    btn.textContent = muted ? '♪̸' : '♪';
    btn.setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son');
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
  if (state.messages.length > 0) {
    advanceMessage();
    return;
  }
  // Sinon, action contextuelle selon l'écran
  if (state.screen === 'battle' && state.battle && state.battle.phase === 'await') {
    throwPokeball();
    return;
  }
  if (state.screen === 'world' && !state.player.moving) {
    const front = getTileInFront();
    const npc = getNPCAt(front.x, front.y);
    if (npc) {
      talkToNPC(npc);
      return;
    }
  }
  if (state.screen === 'map') {
    closeMap();
  }
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
  for (const line of lines) {
    showMessage(`${npc.name} : ${line}`);
  }
}

// ============================================================
//  Boucle principale
// ============================================================

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min(50, timestamp - lastTime); // borne le dt
  lastTime = timestamp;

  state.tick++;
  if (state.biomeBannerTimer > 0) state.biomeBannerTimer -= dt;

  if (state.screen === 'world') updateWorld(dt);
  else if (state.screen === 'battle') updateBattle(dt);

  // Rendu
  ctx.fillStyle = '#1a1c2c';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (state.screen === 'world' || state.screen === 'collection') renderWorld();
  else if (state.screen === 'battle') renderBattle();
  else if (state.screen === 'map') renderMap();

  requestAnimationFrame(gameLoop);
}

// ============================================================
//  Écran "monde"
// ============================================================

function updateWorld(dt) {
  // Si un message est ouvert, on bloque les déplacements
  if (state.messages.length > 0) return;

  if (state.player.moving) {
    state.player.moveProgress += dt / MOVE_DURATION_MS;
    if (state.player.moveProgress >= 1) {
      // Fin du déplacement
      state.player.moveProgress = 1;
      state.player.tileX = state.player.moveToX;
      state.player.tileY = state.player.moveToY;
      state.player.pixelX = state.player.tileX * TILE;
      state.player.pixelY = state.player.tileY * TILE;
      state.player.moving = false;

      // Mise à jour bannière biome + musique
      const biome = getBiomeAt(state.player.tileX, state.player.tileY);
      if (biome && biome !== state.lastBiome) {
        state.lastBiome = biome;
        state.biomeBannerTimer = 2000;
        Audio_.playMusic(biome);
      }

      // Rencontre ?
      if (isEncounterTile(state.player.tileX, state.player.tileY)) {
        if (Math.random() < ENCOUNTER_CHANCE) {
          triggerEncounter();
        }
      }
    } else {
      // Interpolation
      const p = state.player.moveProgress;
      state.player.pixelX = (state.player.moveFromX + (state.player.moveToX - state.player.moveFromX) * p) * TILE;
      state.player.pixelY = (state.player.moveFromY + (state.player.moveToY - state.player.moveFromY) * p) * TILE;
    }
    return;
  }

  // Déclencher un nouveau déplacement
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

function renderWorld() {
  // Caméra centrée sur le joueur, clampée aux bords de la carte
  const targetCamX = state.player.pixelX - CANVAS_W / 2 + TILE / 2;
  const targetCamY = state.player.pixelY - CANVAS_H / 2 + TILE / 2;
  state.camera.x = clamp(targetCamX, 0, MAP_W * TILE - CANVAS_W);
  state.camera.y = clamp(targetCamY, 0, MAP_H * TILE - CANVAS_H);
  const cx = Math.floor(state.camera.x);
  const cy = Math.floor(state.camera.y);

  // Tuiles visibles
  const startTX = Math.floor(cx / TILE);
  const startTY = Math.floor(cy / TILE);
  const endTX = Math.ceil((cx + CANVAS_W) / TILE);
  const endTY = Math.ceil((cy + CANVAS_H) / TILE);

  for (let ty = startTY; ty <= endTY; ty++) {
    for (let tx = startTX; tx <= endTX; tx++) {
      const tile = getTile(tx, ty);
      drawTile(ctx, tile, tx * TILE - cx, ty * TILE - cy, state.tick);
    }
  }

  // PNJ visibles
  for (const npc of NPCS) {
    if (npc.x < startTX - 1 || npc.x > endTX || npc.y < startTY - 1 || npc.y > endTY) continue;
    const nx = npc.x * TILE - cx;
    const ny = npc.y * TILE - cy;
    // Ombre
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(nx + 4, ny + 15, 8, 1);
    drawNPCSprite(ctx, npc, nx, ny, state.tick);
  }

  // Joueur
  const px = Math.floor(state.player.pixelX - cx);
  const py = Math.floor(state.player.pixelY - cy);
  const spriteKey = `player_${state.player.dir}_${state.player.walkFrame === 0 ? 'a' : 'b'}`;
  // Petite ombre
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(px + 4, py + 15, 8, 1);
  drawSprite(ctx, SPRITES[spriteKey], px, py);

  // Indicateur "!" au-dessus du PNJ si le joueur est juste devant
  const front = getTileInFront();
  const facingNPC = getNPCAt(front.x, front.y);
  if (facingNPC) {
    const nx = facingNPC.x * TILE - cx;
    const ny = facingNPC.y * TILE - cy;
    const bob = Math.floor(Math.sin(state.tick / 10) * 1);
    // Petite bulle jaune avec "!"
    ctx.fillStyle = '#fcec6c';
    ctx.fillRect(nx + 6, ny - 8 + bob, 5, 7);
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(nx + 8, ny - 7 + bob, 1, 3);
    ctx.fillRect(nx + 8, ny - 3 + bob, 1, 1);
  }

  // Bannière biome si récemment changée
  if (state.biomeBannerTimer > 0) {
    const label = BIOME_LABEL[state.lastBiome];
    if (label) drawBiomeBanner(label);
  }

  // Petite barre d'info en haut à droite : nb créatures capturées
  drawCollectionCount();
}

function drawBiomeBanner(text) {
  // Animation d'apparition/disparition
  const fade = Math.min(1, state.biomeBannerTimer / 400, (2000 - state.biomeBannerTimer) / 400);
  ctx.fillStyle = `rgba(26, 28, 44, ${0.8 * fade})`;
  ctx.fillRect(0, 8, CANVAS_W, 14);
  ctx.fillStyle = `rgba(252, 236, 108, ${fade})`;
  ctx.font = 'bold 10px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, CANVAS_W / 2, 15);
}

function drawCollectionCount() {
  const count = Object.values(state.collection).reduce((a, b) => a + b, 0);
  const uniques = Object.keys(state.collection).length;
  // Coin haut droit
  ctx.fillStyle = 'rgba(26, 28, 44, 0.7)';
  ctx.fillRect(CANVAS_W - 60, 4, 56, 22);
  drawSprite(ctx, SPRITES.pokeball_small, CANVAS_W - 58, 6);
  ctx.fillStyle = '#fcec6c';
  ctx.font = 'bold 9px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${uniques}/${CREATURES.length}`, CANVAS_W - 48, 7);
  ctx.fillStyle = '#f4f4f4';
  ctx.font = '8px "Segoe UI", sans-serif';
  ctx.fillText(`Total: ${count}`, CANVAS_W - 48, 17);
}

// ============================================================
//  Système de combat / capture
// ============================================================

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
    creature,
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
  };
  showMessage(
    `Un ${creature.name} sauvage apparaît !\n${creature.description}\n\nESPACE pour lancer ta Pokéball, ${state.playerName} ✦`,
    () => {
      // Quand le joueur ferme le message d'intro, on passe en "await"
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
  if (b.isTrainer) return; // trainer battles are message-driven, no animation needed

  if (b.phase === 'throw') {
    b.animTick += dt;
    const t = b.animTick;

    // Position cible : centre de la créature
    const startX = 40, startY = 150;
    const targetX = CANVAS_W / 2;
    const targetY = 70;
    const throwDuration = 600;   // ms pour atteindre la créature
    const shakeDuration = 1200;  // ms pour les secousses

    if (t < throwDuration) {
      const p = t / throwDuration;
      b.pokeballX = startX + (targetX - startX) * p;
      // Trajectoire en arc (parabole)
      const arc = -Math.sin(p * Math.PI) * 60;
      b.pokeballY = startY + (targetY - startY) * p + arc;
    } else if (t < throwDuration + shakeDuration) {
      // Pokéball arrivée : créature disparaît, ball secoue
      if (!b.hitPlayed) {
        Audio_.sfx.hit();
        b.hitPlayed = true;
      }
      b.creatureVisible = false;
      b.pokeballX = targetX;
      b.pokeballY = targetY;
      const shakePhase = (t - throwDuration) % 400;
      const shakeIdx = Math.floor((t - throwDuration) / 400);
      if (shakeIdx !== b.lastShakeIndex && shakeIdx > 0) {
        Audio_.sfx.shake();
      }
      b.lastShakeIndex = shakeIdx;
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
        Audio_.sfx.catch();
        showMessage(
          `Hourra ! ${b.creature.name} a rejoint ta collection ! ✦`,
          () => { endBattle(); }
        );
      } else {
        b.creatureVisible = true;
        Audio_.sfx.escape();
        showMessage(
          `Oh non... ${b.creature.name} s'est échappé(e) !`,
          () => { endBattle(); }
        );
      }
    }
  } else if (b.phase === 'result') {
    b.flashTick += dt;
  }
}

function endBattle() {
  state.screen = 'world';
  state.battle = null;
}

function renderBattle() {
  const b = state.battle;
  if (!b) return;
  const biome = getBiomeAt(state.player.tileX, state.player.tileY);
  drawBattleBackground(biome);

  if (b.isTrainer) {
    renderTrainerBattle(b);
  } else {
    renderWildBattle(b);
  }
}

function renderWildBattle(b) {
  drawPlatform(CANVAS_W / 2, 105, '#566c86', '#94b0c2');
  drawPlatform(60, 175, '#566c86', '#94b0c2');

  const creatureScale = 4;
  const cs = TILE * creatureScale;
  const ccx = Math.floor(CANVAS_W / 2 - cs / 2);
  const ccy = 30 + Math.sin(state.tick / 18) * 2;

  if (b.creatureVisible) {
    b.creature.draw(ctx, ccx, Math.floor(ccy), creatureScale);
  }
  if (b.phase === 'result' && b.result === 'caught') {
    drawCaptureSparkles(CANVAS_W / 2, 80, state.tick);
  }
  if (b.phase === 'throw') {
    drawSprite(ctx, SPRITES.pokeball,
      Math.floor(b.pokeballX - 8 + b.shakeOffset),
      Math.floor(b.pokeballY - 8)
    );
  }
  drawSprite(ctx, SPRITES.player_up_a, 40, 140, 2);
  if (b.phase !== 'result' || b.result === 'escaped') {
    drawBattleNamePlate(b.creature.name, 8, 8);
  }
}

function renderTrainerBattle(b) {
  const showMenu = b.phase === 'choose_move' && state.messages.length === 0;

  // Plateformes
  drawPlatform(CANVAS_W / 2, 105, '#566c86', '#94b0c2');
  if (!showMenu) drawPlatform(52, 170, '#566c86', '#94b0c2');

  // Créature du dresseur (centre-haut)
  const tScale = 4;
  const tcx = Math.floor(CANVAS_W / 2 - TILE * tScale / 2);
  const tcy = Math.floor(30 + Math.sin(state.tick / 18) * 2);
  if (b.creatureVisible) {
    b.trainerCreature.draw(ctx, tcx, tcy, tScale);
  }
  if (b.phase === 'result' && b.result === 'win') {
    drawCaptureSparkles(CANVAS_W / 2, 80, state.tick);
  }

  // Créature du joueur (cachée quand le menu est ouvert)
  if (!showMenu && state.starter) {
    state.starter.draw(ctx, 12, 118, 3);
  }

  // Barre de PV du dresseur (toujours visible)
  drawHPBar(b.trainerCreature.name, b.trainerHp, b.trainerMaxHp, 130, 8, 118);

  // Barre de PV du joueur (cachée quand menu visible, l'info est dans le menu)
  if (!showMenu && state.starter) {
    drawHPBar(state.starter.name, b.playerHp, b.playerMaxHp, 130, 142, 118);
  }

  // Nom du dresseur
  drawBattleNamePlate(b.trainer.name, 8, 8);

  // Menu des capacités
  if (showMenu) drawMoveMenu(b);
}

function drawMoveMenu(b) {
  const moves = state.starter ? (state.starter.moves || []) : [];

  // Panneau de fond
  ctx.fillStyle = 'rgba(10, 10, 24, 0.96)';
  ctx.fillRect(0, 108, CANVAS_W, 84);
  ctx.strokeStyle = '#fcec6c';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 108.5, CANVAS_W - 1, 83);

  // En-tête : nom + PV
  ctx.fillStyle = '#fcec6c';
  ctx.font = 'bold 8px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(state.starter ? state.starter.name : '', 6, 112);
  ctx.fillStyle = b.playerHp / b.playerMaxHp < 0.3 ? '#e74c3c'
    : b.playerHp / b.playerMaxHp < 0.6 ? '#f1c40f' : '#5cb85c';
  ctx.textAlign = 'right';
  ctx.fillText(`PV ${b.playerHp}/${b.playerMaxHp}`, CANVAS_W - 6, 112);

  // Séparateur
  ctx.fillStyle = '#29366f';
  ctx.fillRect(0, 122, CANVAS_W, 1);

  // Grille 2×2 des capacités
  const CW = 124, CH = 24, GAP = 4;
  for (let i = 0; i < Math.min(moves.length, 4); i++) {
    const move = moves[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = 2 + col * (CW + GAP);
    const cy = 125 + row * (CH + GAP);
    const sel = i === (b.moveCursor || 0);

    // Fond cellule
    ctx.fillStyle = sel ? '#1d3a6e' : '#12122a';
    ctx.fillRect(cx, cy, CW, CH);
    ctx.strokeStyle = sel ? '#fcec6c' : '#3d5e8c';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, cy + 0.5, CW - 1, CH - 1);

    // Flèche sélection
    if (sel) {
      ctx.fillStyle = '#fcec6c';
      ctx.font = '8px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('▶', cx + 2, cy + 4);
    }

    // Nom capacité
    ctx.fillStyle = sel ? '#fcec6c' : '#f4f4f4';
    ctx.font = `${sel ? 'bold ' : ''}8px "Segoe UI", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(move.name, cx + 12, cy + 4);

    // Info dégâts / soin
    if (move.heal) {
      ctx.fillStyle = '#5cb85c';
      ctx.font = '7px "Segoe UI", sans-serif';
      ctx.fillText(`Soin +${move.heal} PV`, cx + 12, cy + 14);
    } else {
      ctx.fillStyle = '#94b0c2';
      ctx.font = '7px "Segoe UI", sans-serif';
      ctx.fillText(`${move.power[0]}-${move.power[1]} dég.`, cx + 12, cy + 14);
    }
  }

  // Aide navigation
  ctx.fillStyle = '#566c86';
  ctx.font = '7px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Flèches : choisir  ·  Espace : utiliser', CANVAS_W / 2, 183);
}

function drawHPBar(name, hp, maxHp, x, y, w) {
  ctx.fillStyle = 'rgba(26, 28, 44, 0.9)';
  ctx.fillRect(x, y, w, 28);
  ctx.strokeStyle = '#566c86';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 27);
  ctx.fillStyle = '#fcec6c';
  ctx.font = 'bold 8px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name.substring(0, 12), x + 4, y + 3);
  ctx.fillStyle = '#f4f4f4';
  ctx.font = '7px "Segoe UI", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${hp}/${maxHp}`, x + w - 4, y + 3);
  const barW = w - 8;
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(x + 4, y + 16, barW, 7);
  const ratio = Math.max(0, hp / maxHp);
  ctx.fillStyle = ratio > 0.5 ? '#5cb85c' : ratio > 0.25 ? '#f1c40f' : '#e74c3c';
  ctx.fillRect(x + 4, y + 16, Math.floor(barW * ratio), 7);
}

function drawBattleBackground(biome) {
  // Ciel / fond selon biome
  let topColor, bottomColor, midColor;
  switch (biome) {
    case 'forest':
      topColor = '#73eff7'; midColor = '#a7f070'; bottomColor = '#38b764'; break;
    case 'lake':
      topColor = '#73eff7'; midColor = '#41a6f6'; bottomColor = '#3b5dc9'; break;
    case 'plain':
      topColor = '#73eff7'; midColor = '#bce884'; bottomColor = '#a7f070'; break;
    case 'beach':
      topColor = '#73eff7'; midColor = '#fcd8a0'; bottomColor = '#d4a373'; break;
    case 'sea':
      topColor = '#73eff7'; midColor = '#41a6f6'; bottomColor = '#29366f'; break;
    case 'mountain':
      topColor = '#94b0c2'; midColor = '#7f8c8d'; bottomColor = '#566c86'; break;
    case 'village':
      topColor = '#73eff7'; midColor = '#bce884'; bottomColor = '#a7f070'; break;
    case 'city2':
      topColor = '#73eff7'; midColor = '#bdc3c7'; bottomColor = '#94b0c2'; break;
    default:
      topColor = '#73eff7'; midColor = '#a7f070'; bottomColor = '#38b764';
  }
  // Ciel
  ctx.fillStyle = topColor;
  ctx.fillRect(0, 0, CANVAS_W, 95);
  // Nuages simples
  ctx.fillStyle = '#f4f4f4';
  const cloudOffset = Math.floor(state.tick / 8) % 256;
  ctx.fillRect(((30 - cloudOffset) + 256) % 256, 15, 24, 4);
  ctx.fillRect(((36 - cloudOffset) + 256) % 256, 12, 14, 3);
  ctx.fillRect(((150 - cloudOffset) + 256) % 256, 30, 30, 4);
  // Sol (gradient en bandes)
  ctx.fillStyle = midColor;
  ctx.fillRect(0, 95, CANVAS_W, 30);
  ctx.fillStyle = bottomColor;
  ctx.fillRect(0, 125, CANVAS_W, CANVAS_H - 125);
}

function drawPlatform(cx, cy, dark, light) {
  // Ellipse 60×12
  for (let y = -6; y <= 6; y++) {
    for (let x = -30; x <= 30; x++) {
      if ((x * x) / 900 + (y * y) / 36 <= 1) {
        ctx.fillStyle = y < 0 ? light : dark;
        ctx.fillRect(Math.floor(cx + x), Math.floor(cy + y), 1, 1);
      }
    }
  }
}

function drawBattleNamePlate(name, x, y) {
  const w = name.length * 7 + 16;
  ctx.fillStyle = 'rgba(26, 28, 44, 0.85)';
  ctx.fillRect(x, y, w, 18);
  ctx.strokeStyle = '#fcec6c';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 17);
  ctx.fillStyle = '#fcec6c';
  ctx.font = 'bold 10px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, x + 8, y + 9);
}

function drawCaptureSparkles(cx, cy, tick) {
  const positions = [
    { dx: -20, dy: -10, off: 0 },
    { dx: 25, dy: -15, off: 7 },
    { dx: -15, dy: 20, off: 14 },
    { dx: 22, dy: 18, off: 21 },
    { dx: 0, dy: -25, off: 28 },
    { dx: 30, dy: 5, off: 35 },
    { dx: -30, dy: 0, off: 42 },
  ];
  for (const p of positions) {
    const phase = (tick + p.off) % 30;
    if (phase < 15) {
      const r = 1 + Math.floor(phase / 4);
      ctx.fillStyle = phase < 8 ? '#fff0c8' : '#f1c40f';
      ctx.fillRect(cx + p.dx - r, cy + p.dy, r * 2 + 1, 1);
      ctx.fillRect(cx + p.dx, cy + p.dy - r, 1, r * 2 + 1);
    }
  }
}

// ============================================================
//  Messages (boîte HTML en bas du canvas)
// ============================================================

function showMessage(text, onComplete) {
  state.messages.push({ text, onComplete });
  if (state.messages.length === 1) displayCurrentMessage();
}

function advanceMessage() {
  const m = state.messages.shift();
  hideMessageBox();
  if (m && m.onComplete) m.onComplete();
  if (state.messages.length > 0) {
    setTimeout(displayCurrentMessage, 50);
  }
}

function displayCurrentMessage() {
  const msg = state.messages[0];
  if (!msg) return;
  const textEl = document.getElementById('message-text');
  textEl.textContent = msg.text;
  document.getElementById('message-box').classList.remove('hidden');
}

function hideMessageBox() {
  document.getElementById('message-box').classList.add('hidden');
}

// ============================================================
//  Écran titre / lancement de la partie
// ============================================================

function startGame() {
  const input = document.getElementById('name-input');
  const name = input.value.trim() || 'Robin';
  state.playerName = name;
  document.getElementById('title-overlay').classList.add('hidden');
  Audio_.init();
  if (state.starter) {
    // Partie déjà existante : on repart directement
    launchWorld();
  } else {
    // Première partie : choisir son starter
    state.screen = 'starter';
    openStarterSelection();
  }
}

function openStarterSelection() {
  state.starterCursor = 0;
  const overlay = document.getElementById('starter-overlay');
  overlay.classList.remove('hidden');
  buildStarterCards();
}

function buildStarterCards() {
  const grid = document.getElementById('starter-grid');
  grid.innerHTML = '';
  const options = [
    { id: 'miaouche', label: 'Animal mignon' },
    { id: 'flamdrak', label: 'Dragon de feu' },
    { id: null,       label: 'Surprise !' },
  ];
  options.forEach((opt, i) => {
    const card = document.createElement('div');
    card.className = 'starter-card' + (i === 0 ? ' selected' : '');
    card.id = 'starter-card-' + i;
    card.onclick = () => { state.starterCursor = i; updateStarterHighlight(); confirmStarter(); };

    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    cv.style.imageRendering = 'pixelated';
    const cctx = cv.getContext('2d');
    cctx.imageSmoothingEnabled = false;
    cctx.fillStyle = '#1a1c2c';
    cctx.fillRect(0, 0, 64, 64);
    if (opt.id) {
      const c = CREATURES.find(cr => cr.id === opt.id);
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
    nameEl.textContent = opt.id ? CREATURES.find(cr => cr.id === opt.id).name : '???';
    card.appendChild(nameEl);

    const typeEl = document.createElement('div');
    typeEl.className = 'starter-type';
    typeEl.textContent = opt.label;
    card.appendChild(typeEl);

    grid.appendChild(card);
  });
}

function updateStarterHighlight() {
  document.querySelectorAll('.starter-card').forEach((el, i) => {
    el.classList.toggle('selected', i === state.starterCursor);
  });
}

function confirmStarter() {
  const optIds = ['miaouche', 'flamdrak', null];
  let id = optIds[state.starterCursor];
  if (!id) {
    // Surprise : créature aléatoire (sauf les 2 starters fixes)
    const pool = CREATURES.filter(c => c.id !== 'miaouche' && c.id !== 'flamdrak');
    id = pool[Math.floor(Math.random() * pool.length)].id;
  }
  state.starter = CREATURES.find(c => c.id === id);
  state.starterHp = state.starterMaxHp;

  document.getElementById('starter-overlay').classList.add('hidden');
  Audio_.sfx.catch();
  showMessage(
    `Tu as choisi ${state.starter.name} ! ✦\n${state.starter.description}\nPrends-en bien soin dans tes combats !`,
    () => launchWorld()
  );
}

function launchWorld() {
  state.screen = 'world';
  state.lastBiome = getBiomeAt(state.player.tileX, state.player.tileY);
  state.biomeBannerTimer = 2000;
  saveGame();
  Audio_.playMusic(state.lastBiome);
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) muteBtn.style.display = '';
  showMessage(
    `Bienvenue, ${state.playerName} ! ✦\nFlèches pour explorer · Hautes herbes = rencontres.\nParle aux dresseurs pour les affronter !\nC : collection · N : carte · M : son`
  );
}

// ============================================================
//  Combat contre les dresseurs
// ============================================================

function startTrainerBattle(npc) {
  if (!state.starter) return;
  const trainerCreature = CREATURES.find(c => c.id === npc.party[0]) || CREATURES[0];
  Audio_.sfx.encounter();
  state.screen = 'battle';
  state.battle = {
    isTrainer: true,
    trainer: npc,
    trainerCreature,
    trainerHp: 40,
    trainerMaxHp: 40,
    playerHp: state.starterHp,
    playerMaxHp: state.starterMaxHp,
    phase: 'intro',
    moveCursor: 0,
    animTick: 0,
    result: null,
    creatureVisible: true,
  };
  showMessage(
    `${npc.name} : "${npc.dialog[0]}"\n${npc.name} envoie ${trainerCreature.name} au combat !`,
    () => {
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

  let playerMsg = '';
  let playerHpChange = 0;

  if (move.heal) {
    const healed = Math.min(move.heal, b.playerMaxHp - b.playerHp);
    b.playerHp = Math.min(b.playerMaxHp, b.playerHp + move.heal);
    playerMsg = `${state.starter.name} utilise ${move.name} !\n+${healed} PV récupérés !`;
    playerHpChange = healed;
  } else {
    const dmg = rollDamage(move.power);
    b.trainerHp = Math.max(0, b.trainerHp - dmg);
    playerMsg = `${state.starter.name} utilise ${move.name} !\n${dmg} dégâts sur ${b.trainerCreature.name} !`;
  }

  if (b.trainerHp <= 0) {
    b.phase = 'result'; b.result = 'win'; b.creatureVisible = false;
    Audio_.sfx.catch();
    const cid = b.trainerCreature.id;
    state.collection[cid] = (state.collection[cid] || 0) + 1;
    state.defeatedTrainers[b.trainer.id] = true;
    state.starterHp = b.playerHp;
    saveGame();
    showMessage(
      `${playerMsg}\nVictoire ! ${b.trainer.name} est battu ! ✦\n${b.trainerCreature.name} rejoint ta collection !`,
      () => endBattle()
    );
    return;
  }

  // Tour du dresseur (IA choisit une capacité)
  const aiMove = pickAIMove(b.trainerCreature, b);
  let trainerMsg = '';

  if (aiMove.heal) {
    const healed = Math.min(aiMove.heal, b.trainerMaxHp - b.trainerHp);
    b.trainerHp = Math.min(b.trainerMaxHp, b.trainerHp + aiMove.heal);
    trainerMsg = `${b.trainerCreature.name} utilise ${aiMove.name} !\n+${healed} PV récupérés.`;
  } else {
    const dmg = rollDamage(aiMove.power);
    b.playerHp = Math.max(0, b.playerHp - dmg);
    trainerMsg = `${b.trainerCreature.name} utilise ${aiMove.name} !\n${dmg} dégâts sur ${state.starter.name} !`;
  }

  if (b.playerHp <= 0) {
    b.phase = 'result'; b.result = 'lose';
    Audio_.sfx.escape();
    state.starterHp = state.starterMaxHp;
    showMessage(
      `${playerMsg}\n${trainerMsg}\nOh non, tu as perdu...`,
      () => endBattle()
    );
  } else {
    b.phase = 'choose_move';
    showMessage(
      `${playerMsg}\n${trainerMsg}\nPV ${b.trainerCreature.name}: ${b.trainerHp}/${b.trainerMaxHp}  ·  Tes PV: ${b.playerHp}/${b.playerMaxHp}`
    );
  }
}

function rollDamage(powerRange) {
  return powerRange[0] + Math.floor(Math.random() * (powerRange[1] - powerRange[0] + 1));
}

function pickAIMove(creature, b) {
  const moves = creature.moves || [];
  if (moves.length === 0) return { name: 'Attaque', power: [8, 15] };
  // Préfère soigner si PV bas (< 30%)
  if (b.trainerHp / b.trainerMaxHp < 0.3) {
    const healMove = moves.find(m => m.heal);
    if (healMove) return healMove;
  }
  // Sinon attaque aléatoire parmi les attaques
  const attackMoves = moves.filter(m => !m.heal);
  const pool = attackMoves.length > 0 ? attackMoves : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Petit fond décoratif derrière l'overlay titre
function drawTitleBackdrop() {
  // Quelques tuiles d'herbe et fleurs juste pour ne pas avoir un fond noir derrière l'overlay
  for (let ty = 0; ty < VIEW_TILES_Y; ty++) {
    for (let tx = 0; tx < VIEW_TILES_X; tx++) {
      const r = hashPos(tx + 100, ty + 100);
      let tile = 'GRASS';
      if (r < 0.10) tile = 'TREE';
      else if (r < 0.15) tile = 'FLOWERS';
      else if (r < 0.20) tile = 'TALL_GRASS';
      drawTile(ctx, tile, tx * TILE, ty * TILE, 0);
    }
  }
}

// ============================================================
//  Collection (Pokédex Robin)
// ============================================================

function openCollection() {
  state.screen = 'collection';
  Audio_.sfx.menu();
  const grid = document.getElementById('collection-grid');
  grid.innerHTML = '';
  CREATURES.forEach(c => {
    const count = state.collection[c.id] || 0;
    const card = document.createElement('div');
    card.className = 'creature-card' + (count === 0 ? ' unknown' : '');

    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = 32;
    cardCanvas.height = 32;
    const cctx = cardCanvas.getContext('2d');
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
    card.appendChild(cardCanvas);

    const nameEl = document.createElement('div');
    nameEl.className = 'creature-name';
    nameEl.textContent = count > 0 ? c.name : '???';
    card.appendChild(nameEl);

    const countEl = document.createElement('div');
    countEl.className = 'creature-count';
    countEl.textContent = count > 0 ? `×${count}` : 'Pas encore vu';
    card.appendChild(countEl);

    grid.appendChild(card);
  });
  document.getElementById('collection-overlay').classList.remove('hidden');
}

function closeCollection() {
  Audio_.sfx.menu();
  document.getElementById('collection-overlay').classList.add('hidden');
  state.screen = 'world';
}

// ============================================================
//  Carte du monde (écran dessiné sur le canvas)
// ============================================================

function openMap() {
  if (state.screen !== 'world') return;
  // Reset des entrées pour éviter qu'on bouge tout seul en fermant la carte
  state.input.up = state.input.down = state.input.left = state.input.right = false;
  state.screen = 'map';
  Audio_.sfx.menu();
}

function closeMap() {
  if (state.screen !== 'map') return;
  Audio_.sfx.menu();
  state.screen = 'world';
}

function getTileMapColor(tile) {
  switch (tile) {
    case 'GRASS': case 'TALL_GRASS': case 'FLOWERS': return '#5cb85c';
    case 'TREE': return '#1e8449';
    case 'WATER': return '#3b5dc9';
    case 'SHALLOW': return '#41a6f6';
    case 'SAND': return '#fcd8a0';
    case 'SEA': return '#1c2c5c';
    case 'WAVES': return '#73eff7';
    case 'PATH': return '#d4a373';
    case 'PLAIN': case 'TALL_PLAIN': return '#bce884';
    case 'ROCK': return '#7f8c8d';
    // Ville
    case 'HOUSE_RED': return '#e74c3c';
    case 'HOUSE_BLUE': return '#3b5dc9';
    case 'HOUSE_YELLOW': return '#f1c40f';
    case 'CITY_PATH': case 'CITY_GROUND': return '#94b0c2';
    case 'FOUNTAIN': return '#73eff7';
    // Parc
    case 'PARK_GRASS': case 'PARK_TALL': case 'PARK_FLOWER': return '#a7f070';
    case 'PARK_PATH': return '#fcd8a0';
    case 'PARK_TREE': return '#1e8449';
    case 'POND': return '#3b5dc9';
    case 'POND_EDGE': return '#41a6f6';
    case 'BENCH': return '#8b5a2b';
    case 'MOUNTAIN': return '#566c86';
    case 'MTN_PATH': return '#94b0c2';
    case 'MTN_GRASS': return '#7f8c8d';
    case 'SNOW': return '#e8f4f8';
    case 'VLG_HOUSE': return '#ef7d57';
    case 'VLG_PATH': case 'VLG_TALL': return '#d4a373';
    case 'CITY2_PATH': case 'CITY2_GROUND': return '#bdc3c7';
    case 'HOUSE2_RED': return '#e74c3c';
    case 'HOUSE2_BLUE': return '#3b5dc9';
    case 'HOUSE2_YELLOW': return '#f1c40f';
    case 'FOUNTAIN2': return '#73eff7';
    default: return '#566c86';
  }
}

function renderMap() {
  // Fond parchemin
  ctx.fillStyle = '#1a1c2c';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // Cadre décoratif jaune
  ctx.fillStyle = '#fcec6c';
  ctx.fillRect(4, 4, CANVAS_W - 8, CANVAS_H - 8);
  ctx.fillStyle = '#2a1a14';
  ctx.fillRect(6, 6, CANVAS_W - 12, CANVAS_H - 12);

  // Titre
  ctx.fillStyle = '#fcec6c';
  ctx.font = 'bold 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Carte du monde', CANVAS_W / 2, 10);

  // Zone de carte (chaque tuile = 3 pixels — adapté à 60x45)
  const tilePix = 3;
  const mapPxW = MAP_W * tilePix;
  const mapPxH = MAP_H * tilePix;
  const ox = Math.floor((CANVAS_W - mapPxW) / 2);
  const oy = 22;

  // Bordure noire de la carte
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(ox - 2, oy - 2, mapPxW + 4, mapPxH + 4);

  // Dessine chaque tuile en couleur
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      ctx.fillStyle = getTileMapColor(MAP[y][x]);
      ctx.fillRect(ox + x * tilePix, oy + y * tilePix, tilePix, tilePix);
    }
  }

  // PNJ en cyan
  ctx.fillStyle = '#73eff7';
  for (const npc of NPCS) {
    ctx.fillRect(ox + npc.x * tilePix, oy + npc.y * tilePix, tilePix, tilePix);
  }

  // Position du joueur (clignote, plus gros)
  const blink = Math.floor(state.tick / 12) % 2 === 0;
  const px = ox + state.player.tileX * tilePix;
  const py = oy + state.player.tileY * tilePix;
  if (blink) {
    ctx.fillStyle = '#fcec6c';
    ctx.fillRect(px - 2, py - 2, tilePix + 4, tilePix + 4);
  }
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(px - 1, py - 1, tilePix + 2, tilePix + 2);

  // Légende sur 2 lignes
  const legY1 = oy + mapPxH + 7;
  const legY2 = legY1 + 11;
  ctx.font = '8px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const line1 = [
    ['#5cb85c', 'Forêt'],
    ['#bce884', 'Plaine'],
    ['#3b5dc9', 'Lac'],
    ['#566c86', 'Montagne'],
    ['#e8f4f8', 'Neige'],
  ];
  const line2 = [
    ['#a7f070', 'Parc'],
    ['#94b0c2', 'Ville'],
    ['#ef7d57', 'Village'],
    ['#73eff7', 'PNJ'],
    ['#e74c3c', 'Toi'],
  ];
  function drawLegendLine(items, ly) {
    let lx = ox;
    for (const [color, label] of items) {
      ctx.fillStyle = color;
      ctx.fillRect(lx, ly - 3, 5, 5);
      ctx.fillStyle = '#f4f4f4';
      ctx.fillText(label, lx + 8, ly);
      lx += label.length * 5 + 18;
    }
  }
  drawLegendLine(line1, legY1);
  drawLegendLine(line2, legY2);

  // Astuce du bas
  ctx.fillStyle = '#94b0c2';
  ctx.font = '9px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N / Espace / Échap : fermer', CANVAS_W / 2, CANVAS_H - 10);
}

// ============================================================
//  Sauvegarde / chargement (localStorage)
// ============================================================

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
    localStorage.setItem('robinGame_v2', JSON.stringify(data));
  } catch (e) { /* localStorage indisponible : on ignore */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem('robinGame_v2');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.playerName) {
      state.playerName = data.playerName;
      document.getElementById('name-input').value = data.playerName;
    }
    if (data.starterId) {
      state.starter = CREATURES.find(c => c.id === data.starterId) || null;
      if (data.starterHp) state.starterHp = data.starterHp;
    }
    if (data.collection) state.collection = data.collection;
    if (data.defeatedTrainers) state.defeatedTrainers = data.defeatedTrainers;
    if (typeof data.tileX === 'number' && typeof data.tileY === 'number'
        && isWalkable(data.tileX, data.tileY)) {
      state.player.tileX = data.tileX;
      state.player.tileY = data.tileY;
      state.player.pixelX = data.tileX * TILE;
      state.player.pixelY = data.tileY * TILE;
    }
  } catch (e) { /* données corrompues : on ignore */ }
}

// ============================================================
//  Helpers
// ============================================================

function clamp(v, mn, mx) {
  return Math.max(mn, Math.min(mx, v));
}
