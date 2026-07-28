// =============================================================================
//  hud3d.js — INTERFACE de la version 3D du « Jeu de Robin »
// =============================================================================
//  Tout ce qui n'est pas de la 3D est ici : boîte de dialogue, bandeau de biome,
//  compteur de collection, barres de PV, menu de capacités, carte du monde,
//  collection, choix du starter, toasts et sélecteur de qualité.
//
//  L'interface est en HTML/CSS (fichier css3d/hud3d.css) : c'est bien plus net
//  et bien plus lisible qu'un dessin sur canvas, et ça s'adapte tout seul à la
//  taille de l'écran.
//
//  Rien ici ne suppose que game3d.js existe : chaque fonction se dégrade
//  proprement si un module ou une donnée manque. Aucune exception au chargement.
// =============================================================================

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Petits outils DOM
  // ---------------------------------------------------------------------------

  function $(id) { return document.getElementById(id); }

  /** Crée un élément, lui pose une classe/du texte, et l'accroche à un parent. */
  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function show(e) { if (e) e.classList.remove('hidden'); }
  function hide(e) { if (e) e.classList.add('hidden'); }

  /** Temps en secondes, indépendant de la boucle de jeu (le HUD doit continuer
   *  à s'animer même si le monde 3D est en pause, par exemple sur la carte). */
  function now() { return performance.now() / 1000; }

  /**
   * Renvoie l'état du jeu, quel que soit le module qui le détient.
   * game3d.js expose window.GAME3D = { state, ... } ; on prévoit aussi le cas
   * où il s'enregistrerait via R3.register('game', ...).
   */
  function gameState() {
    if (window.GAME3D && window.GAME3D.state) return window.GAME3D.state;
    const g = (typeof R3 !== 'undefined' && R3.get) ? R3.get('game') : null;
    if (g && g.state) return g.state;
    if (window.state && typeof window.state === 'object' && window.state.screen) return window.state;
    return null;
  }

  /** Repli souris/tactile : rejoue une touche pour réutiliser la logique clavier
   *  de game3d.js quand aucun gestionnaire n'a été branché sur le HUD. */
  function fakeKey(key) {
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true }));
    } catch (e) { /* navigateur trop ancien : on ignore */ }
  }

  /** Relance une animation CSS (il faut forcer un reflow entre les deux). */
  function replayAnim(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  // ---------------------------------------------------------------------------
  // Vignettes de créatures — on garde l'approche du jeu 2D : un petit canvas et
  // creature.draw(ctx, x, y, echelle). C'est joli, c'est immédiat, ça marche.
  // Le dessin est calé sur une grille de 16x16, avec une marge de sécurité pour
  // les créatures qui débordent un peu (ailes, antennes...).
  // ---------------------------------------------------------------------------

  function creatureThumb(creature, scale) {
    scale = scale || 3;
    const margin = scale * 3;
    const size = 16 * scale + margin * 2;
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    if (creature && typeof creature.draw === 'function') {
      try {
        creature.draw(c, margin, margin, scale);
      } catch (e) {
        console.warn('[hud3d] dessin de vignette en échec :', creature.id, e);
      }
    }
    return cv;
  }

  /** Vignette « inconnu » : un gros point d'interrogation. */
  function mysteryThumb(scale) {
    scale = scale || 3;
    const size = 16 * scale + scale * 6;
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(10, 12, 26, 0.9)';
    c.fillRect(0, 0, size, size);
    c.fillStyle = '#5b6c8c';
    c.font = 'bold ' + Math.round(size * 0.55) + 'px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('?', size / 2, size * 0.54);
    return cv;
  }

  // ---------------------------------------------------------------------------
  // Couleurs de la carte du monde — reprises telles quelles de getTileMapColor()
  // de js/game.js (elles sont bien choisies et Robin les reconnaît déjà).
  // ---------------------------------------------------------------------------

  const MAP_COLORS = {
    GRASS: '#5cb85c', TALL_GRASS: '#5cb85c', FLOWERS: '#5cb85c',
    TREE: '#1e8449',
    WATER: '#3b5dc9', SHALLOW: '#41a6f6',
    SAND: '#fcd8a0', SEA: '#1c2c5c', WAVES: '#73eff7',
    PATH: '#d4a373',
    PLAIN: '#bce884', TALL_PLAIN: '#bce884',
    ROCK: '#7f8c8d',
    HOUSE_RED: '#e74c3c', HOUSE_BLUE: '#3b5dc9', HOUSE_YELLOW: '#f1c40f',
    CITY_PATH: '#94b0c2', CITY_GROUND: '#94b0c2', FOUNTAIN: '#73eff7',
    PARK_GRASS: '#a7f070', PARK_TALL: '#a7f070', PARK_FLOWER: '#a7f070',
    PARK_PATH: '#fcd8a0', PARK_TREE: '#1e8449',
    POND: '#3b5dc9', POND_EDGE: '#41a6f6', BENCH: '#8b5a2b',
    MOUNTAIN: '#566c86', MTN_PATH: '#94b0c2', MTN_GRASS: '#7f8c8d', SNOW: '#e8f4f8',
    VLG_HOUSE: '#ef7d57', VLG_PATH: '#d4a373', VLG_TALL: '#d4a373',
    CITY2_PATH: '#bdc3c7', CITY2_GROUND: '#bdc3c7',
    HOUSE2_RED: '#e74c3c', HOUSE2_BLUE: '#3b5dc9', HOUSE2_YELLOW: '#f1c40f',
    FOUNTAIN2: '#73eff7',
  };

  function tileMapColor(tile) {
    const c = MAP_COLORS[tile];
    if (c) return c;
    // Repli : on emprunte la couleur de sol de la table de style 3D.
    if (typeof R3 !== 'undefined' && R3.tileStyle) return R3.tileStyle(tile).ground;
    return '#566c86';
  }

  const MAP_LEGEND = [
    ['#5cb85c', 'Forêt'], ['#bce884', 'Plaine'], ['#fcd8a0', 'Plage'],
    ['#3b5dc9', 'Eau'], ['#a7f070', 'Parc'], ['#94b0c2', 'Ville'],
    ['#ef7d57', 'Village'], ['#566c86', 'Montagne'], ['#e8f4f8', 'Neige'],
    ['#73eff7', 'Personnage'], ['#ffd93d', 'Dresseur à battre'], ['#e74c3c', 'Toi !'],
  ];

  // ---------------------------------------------------------------------------
  // État interne du HUD
  // ---------------------------------------------------------------------------

  const ui = {};                 // références aux éléments créés
  let inited = false;
  let hudRoot = null;

  let biomeTimer = 0;            // minuterie de disparition du bandeau
  let mapRaf = 0;                // requestAnimationFrame de la carte
  let mapBase = null;            // canvas hors-écran : le fond de carte (statique)
  let fpsVisible = false;
  let lastUniques = -1;

  let moveHandler = null;        // callback branché par game3d.js (clic sur une capacité)
  let starterHandler = null;     // idem pour le choix du starter

  const MAP_PX = 8;              // pixels par tuile dans le canvas de la carte
                                 // 120 x 70 tuiles -> 960 x 560 px : à la BONNE
                                 // échelle (le jeu 2D était calibré pour 60x45
                                 // et la carte débordait de l'écran).

  // ===========================================================================
  //  INITIALISATION
  // ===========================================================================

  function init() {
    if (inited) return;
    hudRoot = $('hud') || document.body;
    inited = true;

    buildBiomeBanner();
    buildCollectionCount();
    buildBattleHud();
    buildMapOverlay();
    buildToastLayer();
    buildQualityPicker();
    wireExistingElements();

    // Le compteur de FPS peut être demandé par l'URL (index3d.html#fps)
    if (String(location.hash || '').indexOf('fps') >= 0) setFpsVisible(true);
  }

  /** Branche les éléments déjà présents dans index3d.html. */
  function wireExistingElements() {
    // Cliquer la boîte de dialogue fait avancer le texte (pratique à la souris).
    const box = $('message-box');
    if (box) {
      box.addEventListener('click', function () { fakeKey(' '); });
    }

    // Le bouton « Fermer » de la collection est déjà branché par game3d.js,
    // mais on assure le coup si personne ne l'a fait.
    const closeBtn = $('close-collection');
    if (closeBtn && !closeBtn.dataset.hudWired) {
      closeBtn.dataset.hudWired = '1';
      closeBtn.addEventListener('click', function () {
        // Si game3d n'a rien branché, on simule la touche C.
        const ov = $('collection-overlay');
        if (ov && !ov.classList.contains('hidden')) fakeKey('c');
      });
    }

    // Cliquer le compteur de FPS le masque.
    const fps = $('fps-counter');
    if (fps) fps.addEventListener('click', function () { setFpsVisible(false); });
  }

  // ---------------------------------------------------------------------------
  // Construction des éléments dynamiques
  // ---------------------------------------------------------------------------

  function buildBiomeBanner() {
    ui.biome = el('div', 'biome-banner', hudRoot);
  }

  function buildCollectionCount() {
    ui.count = el('div', 'collection-count hidden', hudRoot);
    el('span', 'ball', ui.count);
    ui.countNum = el('span', 'num', ui.count, '0/0');
    ui.count.title = 'Créatures différentes capturées';
  }

  function buildBattleHud() {
    ui.hp = {
      foe: makeHpCard('foe'),
      player: makeHpCard('player'),
    };

    // --- Menu des capacités : grille 2x2 en HTML ---
    const menu = el('div', 'move-menu hidden', hudRoot);
    const head = el('div', 'mm-head', menu);
    ui.mmName = el('span', 'mm-name', head, '');
    ui.mmHp = el('span', 'mm-hp', head, '');
    ui.moveGrid = el('div', 'move-grid', menu);
    el('p', 'mm-foot', menu, 'Flèches : choisir  ·  Espace : utiliser');
    ui.moveMenu = menu;
    ui.moveCells = [];
  }

  function makeHpCard(side) {
    const card = el('div', 'hp-card ' + side + ' hidden', hudRoot);
    const head = el('div', 'hp-head', card);
    const name = el('span', 'hp-name', head, '');
    const num = el('span', 'hp-num', head, '');
    const bar = el('div', 'hp-bar', card);
    const fill = el('div', 'hp-fill', bar);
    return { root: card, name: name, num: num, fill: fill, last: 1 };
  }

  function buildMapOverlay() {
    const ov = el('div', 'overlay hidden', hudRoot);
    ov.id = 'map-overlay';
    const frame = el('div', 'map-frame', ov);
    el('h2', null, frame, 'Carte du monde');
    const wrap = el('div', 'map-canvas-wrap', frame);
    const cv = el('canvas', null, wrap);
    cv.id = 'map-canvas';
    cv.width = mapWidth() * MAP_PX;
    cv.height = mapHeight() * MAP_PX;
    const legend = el('div', 'map-legend', frame);
    MAP_LEGEND.forEach(function (item) {
      const s = el('span', null, legend);
      el('i', null, s).style.background = item[0];
      s.appendChild(document.createTextNode(item[1]));
    });
    el('p', 'hint', frame, 'N · Espace · Échap : fermer la carte');
    ui.mapOverlay = ov;
    ui.mapCanvas = cv;
    ui.mapCtx = cv.getContext('2d');
    // Fermer d'un clic hors du cadre.
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov) fakeKey('Escape');
    });
  }

  function buildToastLayer() {
    ui.toasts = el('div', 'toast-layer', hudRoot);
  }

  function buildQualityPicker() {
    const box = el('div', 'quality-picker clickable', hudRoot);
    el('span', 'lbl', box, 'Qualité');
    ui.qualityBtns = {};
    [['low', 'Bas'], ['medium', 'Moyen'], ['high', 'Haut']].forEach(function (q) {
      const b = el('button', null, box, q[1]);
      b.type = 'button';
      b.addEventListener('click', function () {
        // On passe par game3d quand il est là : lui seul réapplique aussi le
        // pixelRatio et les ombres au renderer. Et un choix fait à la main
        // désactive l'auto-qualité — on ne contredit pas le joueur.
        if (window.GAME3D && window.GAME3D.setQuality) window.GAME3D.setQuality(q[0], true);
        else if (typeof R3 !== 'undefined' && R3.setQuality) R3.setQuality(q[0]);
        refreshQuality();
        toast('Qualité : ' + q[1]);
        b.blur();
      });
      ui.qualityBtns[q[0]] = b;
    });
    ui.qualityPicker = box;
    box.classList.add('hidden');   // révélé au lancement de la partie
    refreshQuality();
    // Si game3d.js baisse la qualité tout seul, le bouton actif suit.
    if (typeof R3 !== 'undefined' && R3.onQualityChange) R3.onQualityChange(refreshQuality);
  }

  function refreshQuality() {
    if (!ui.qualityBtns) return;
    const lvl = (typeof R3 !== 'undefined' && R3.quality) ? R3.quality.level : 'high';
    Object.keys(ui.qualityBtns).forEach(function (k) {
      ui.qualityBtns[k].classList.toggle('on', k === lvl);
    });
  }

  // ===========================================================================
  //  BOÎTE DE DIALOGUE
  // ===========================================================================

  function showMessage(text) {
    const box = $('message-box');
    const txt = $('message-text');
    if (!box || !txt) return;
    txt.textContent = text === undefined || text === null ? '' : String(text);
    if (box.classList.contains('hidden')) {
      box.classList.remove('hidden');
      replayAnim(box, 'message-box');
    }
  }

  function hideMessage() { hide($('message-box')); }

  // ===========================================================================
  //  BANDEAU DE BIOME — apparaît, reste ~1,7 s, s'efface tout seul
  // ===========================================================================

  function setBiomeBanner(label) {
    if (!ui.biome) return;
    if (!label) { ui.biome.classList.remove('show'); return; }
    ui.biome.textContent = label;
    replayAnim(ui.biome, 'show');
    clearTimeout(biomeTimer);
    biomeTimer = setTimeout(function () {
      ui.biome.classList.remove('show');
    }, 2400);
  }

  // ===========================================================================
  //  COMPTEUR DE COLLECTION
  // ===========================================================================

  function setCollectionCount(n, total) {
    if (!ui.count) return;
    // On met la valeur à jour sans forcer l'affichage : c'est launchWorld() qui
    // décide quand le compteur apparaît (il n'a rien à faire sur l'écran titre).
    const t = total || (typeof CREATURES !== 'undefined' ? CREATURES.length : 26);
    ui.countNum.textContent = (n | 0) + '/' + t;
    ui.count.title = (n | 0) + ' créature(s) différente(s) sur ' + t;
    if (lastUniques >= 0 && n > lastUniques) replayAnim(ui.count, 'pop');
    lastUniques = n | 0;
  }

  // ===========================================================================
  //  BARRES DE PV
  //   side : 'player' | 'foe'
  //   Vert au-dessus de 60 %, jaune en dessous, rouge en dessous de 30 %.
  // ===========================================================================

  function hpClass(ratio) {
    if (ratio < 0.3) return 'low';
    if (ratio < 0.6) return 'mid';
    return 'ok';
  }

  function setHP(side, hp, maxHp, name) {
    if (!ui.hp) return;
    const card = ui.hp[side === 'foe' ? 'foe' : 'player'];
    if (!card) return;

    // Appel sans PV = on masque la barre.
    if (hp === null || hp === undefined) { hide(card.root); return; }

    const max = Math.max(1, maxHp || 1);
    const cur = Math.max(0, Math.min(max, hp));
    const ratio = cur / max;

    if (name !== undefined && name !== null) card.name.textContent = String(name);
    card.num.textContent = Math.round(cur) + ' / ' + Math.round(max) + ' PV';
    card.fill.style.width = (ratio * 100).toFixed(1) + '%';
    card.fill.className = 'hp-fill ' + hpClass(ratio);

    // Tant que le menu de capacités est ouvert, il porte déjà les PV du
    // compagnon : on ne réaffiche pas sa carte par-dessus.
    const menuOuvert = ui.moveMenu && !ui.moveMenu.classList.contains('hidden');
    if (!(side !== 'foe' && menuOuvert)) show(card.root);
    // Petite secousse quand on prend des dégâts : ça se sent tout de suite.
    if (ratio < card.last - 0.001) replayAnim(card.root, 'hit');
    card.last = ratio;
  }

  /** Masque une barre (ou les deux si aucun côté n'est précisé). */
  function hideHP(side) {
    if (!ui.hp) return;
    if (side) { hide(ui.hp[side === 'foe' ? 'foe' : 'player'].root); return; }
    hide(ui.hp.foe.root);
    hide(ui.hp.player.root);
  }

  /** Range toute l'interface de combat d'un coup (fin de combat). */
  function hideBattleUI() {
    hideHP();
    hideMoveMenu();
  }

  // ===========================================================================
  //  MENU DES CAPACITÉS — grille 2x2
  // ===========================================================================

  function movesOf(battle) {
    if (battle && Array.isArray(battle.moves) && battle.moves.length) return battle.moves;
    const st = gameState();
    if (st && st.starter && Array.isArray(st.starter.moves)) return st.starter.moves;
    return [];
  }

  function showMoveMenu(battle) {
    if (!ui.moveMenu) return;
    // Le menu affiche déjà « nom + PV » du compagnon : garder en plus sa carte
    // de PV ferait doublon et, sur un écran peu haut, les deux se chevauchent.
    if (ui.hp && ui.hp.player) hide(ui.hp.player.root);
    const b = battle || {};
    const st = gameState();
    const moves = movesOf(b).slice(0, 4);

    // En-tête : nom du compagnon et PV restants
    const starterName = (b.playerName) || (st && st.starter ? st.starter.name : '');
    ui.mmName.textContent = starterName || 'Ton compagnon';
    if (b.playerHp !== undefined && b.playerMaxHp) {
      const r = Math.max(0, b.playerHp) / Math.max(1, b.playerMaxHp);
      ui.mmHp.textContent = 'PV ' + b.playerHp + '/' + b.playerMaxHp;
      ui.mmHp.className = 'mm-hp ' + hpClass(r);
    } else {
      ui.mmHp.textContent = '';
      ui.mmHp.className = 'mm-hp';
    }

    // (Re)construction des cases
    ui.moveGrid.innerHTML = '';
    ui.moveCells = [];
    moves.forEach(function (move, i) {
      const cell = el('button', 'move-cell', ui.moveGrid);
      cell.type = 'button';
      el('span', 'mv-name', cell, move.name || ('Capacité ' + (i + 1)));
      if (move.heal) {
        el('span', 'mv-info heal', cell, 'Soin +' + move.heal + ' PV');
      } else if (Array.isArray(move.power)) {
        el('span', 'mv-info', cell, move.power[0] + '-' + move.power[1] + ' dégâts');
      } else {
        el('span', 'mv-info', cell, 'Attaque');
      }
      cell.addEventListener('mouseenter', function () { setMoveCursor(i, battle); });
      cell.addEventListener('click', function () {
        setMoveCursor(i, battle);
        if (moveHandler) moveHandler(i, moves[i]);
        else fakeKey(' ');   // repli : on rejoue la touche Espace
        cell.blur();
      });
      ui.moveCells.push(cell);
    });

    setMoveCursor(b.moveCursor || 0, battle);
    show(ui.moveMenu);
    replayAnim(ui.moveMenu, 'move-menu');
  }

  function hideMoveMenu() { hide(ui.moveMenu); }

  /** Le rappel des touches d'exploration n'a rien à faire pendant un combat. */
  function setInBattle(v) {
    const e = $('controls-hint');
    if (e) e.classList.toggle('en-combat', !!v);
  }

  function setMoveCursor(i, battle) {
    if (!ui.moveCells) return;
    const n = ui.moveCells.length;
    if (!n) return;
    const idx = Math.max(0, Math.min(n - 1, i | 0));
    for (let k = 0; k < n; k++) ui.moveCells[k].classList.toggle('selected', k === idx);
    if (battle) battle.moveCursor = idx;
  }

  /** game3d.js peut brancher ce qui se passe au clic sur une capacité. */
  function onMoveChosen(fn) { moveHandler = fn; }

  // ===========================================================================
  //  CARTE DU MONDE
  // ===========================================================================

  function mapWidth() { return (typeof MAP_W !== 'undefined') ? MAP_W : 120; }
  function mapHeight() { return (typeof MAP_H !== 'undefined') ? MAP_H : 70; }

  /** Dessine une fois pour toutes le fond de carte dans un canvas hors-écran. */
  function buildMapBase() {
    const W = mapWidth(), H = mapHeight();
    const cv = document.createElement('canvas');
    cv.width = W * MAP_PX;
    cv.height = H * MAP_PX;
    const c = cv.getContext('2d');
    c.fillStyle = '#0a0c18';
    c.fillRect(0, 0, cv.width, cv.height);

    if (typeof MAP !== 'undefined' && MAP && MAP.length) {
      for (let y = 0; y < H; y++) {
        const row = MAP[y];
        if (!row) continue;
        for (let x = 0; x < W; x++) {
          c.fillStyle = tileMapColor(row[x]);
          c.fillRect(x * MAP_PX, y * MAP_PX, MAP_PX, MAP_PX);
        }
      }
      // Un léger voile en damier donne du relief sans coûter grand-chose.
      c.fillStyle = 'rgba(0, 0, 0, 0.06)';
      for (let y = 0; y < H; y++) {
        for (let x = (y % 2); x < W; x += 2) {
          c.fillRect(x * MAP_PX, y * MAP_PX, MAP_PX, MAP_PX);
        }
      }
    }
    return cv;
  }

  /** Redessine la carte : fond figé + PNJ + joueur clignotant. */
  function drawMap() {
    const c = ui.mapCtx;
    if (!c) return;
    if (!mapBase) mapBase = buildMapBase();
    c.clearRect(0, 0, ui.mapCanvas.width, ui.mapCanvas.height);
    c.drawImage(mapBase, 0, 0);

    const st = gameState();
    const P = MAP_PX;

    // --- PNJ : cyan ; dresseurs : losange doré (gris s'ils sont déjà battus) ---
    if (typeof NPCS !== 'undefined' && Array.isArray(NPCS)) {
      const beaten = (st && st.defeatedTrainers) || {};
      NPCS.forEach(function (npc) {
        const cx = npc.x * P + P / 2;
        const cy = npc.y * P + P / 2;
        if (npc.isTrainer) {
          const done = !!beaten[npc.id];
          c.save();
          c.translate(cx, cy);
          c.rotate(Math.PI / 4);
          c.fillStyle = done ? '#7c8aa5' : '#ffd93d';
          c.strokeStyle = '#1a1c2c';
          c.lineWidth = 2;
          c.fillRect(-P * 0.75, -P * 0.75, P * 1.5, P * 1.5);
          c.strokeRect(-P * 0.75, -P * 0.75, P * 1.5, P * 1.5);
          c.restore();
        } else {
          c.fillStyle = '#73eff7';
          c.strokeStyle = '#1a1c2c';
          c.lineWidth = 2;
          c.beginPath();
          c.arc(cx, cy, P * 0.7, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
      });
    }

    // --- Le joueur : gros point rouge dans un halo jaune qui clignote ---
    if (st && st.player) {
      const cx = st.player.tileX * P + P / 2;
      const cy = st.player.tileY * P + P / 2;
      const blink = (Math.floor(now() * 2.6) % 2) === 0;
      if (blink) {
        c.fillStyle = 'rgba(252, 236, 108, 0.55)';
        c.beginPath();
        c.arc(cx, cy, P * 2.1, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#fcec6c';
      c.beginPath();
      c.arc(cx, cy, P * 1.25, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#e74c3c';
      c.beginPath();
      c.arc(cx, cy, P * 0.85, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#1a1c2c';
      c.lineWidth = 2;
      c.stroke();
    }
  }

  function mapLoop() {
    if (!ui.mapOverlay || ui.mapOverlay.classList.contains('hidden')) { mapRaf = 0; return; }
    drawMap();
    mapRaf = requestAnimationFrame(mapLoop);
  }

  function openMap() {
    if (!ui.mapOverlay) return;
    show(ui.mapOverlay);
    replayAnim(ui.mapOverlay, 'overlay');
    if (!mapRaf) mapRaf = requestAnimationFrame(mapLoop);
  }

  function closeMap() {
    if (!ui.mapOverlay) return;
    hide(ui.mapOverlay);
    if (mapRaf) { cancelAnimationFrame(mapRaf); mapRaf = 0; }
  }

  // ===========================================================================
  //  COLLECTION
  // ===========================================================================

  function openCollection(collection) {
    const grid = $('collection-grid');
    const overlay = $('collection-overlay');
    if (!grid || !overlay) return;

    const st = gameState();
    const col = collection || (st && st.collection) || {};
    const list = (typeof CREATURES !== 'undefined') ? CREATURES : [];

    grid.innerHTML = '';
    let uniques = 0, total = 0;

    list.forEach(function (cr) {
      const count = col[cr.id] || 0;
      if (count > 0) { uniques++; total += count; }

      const card = el('div', 'creature-card' + (count === 0 ? ' unknown' : ''), grid);
      card.appendChild(count > 0 ? creatureThumb(cr, 3) : mysteryThumb(3));
      el('div', 'creature-name', card, count > 0 ? cr.name : '???');
      el('div', 'creature-count', card,
        count > 0 ? ('×' + count) : 'Pas encore vue');
      if (count > 0 && cr.description) card.title = cr.description;
    });

    // Petit récapitulatif, inséré avant le bouton « Fermer ».
    let summary = overlay.querySelector('.collection-summary');
    if (!summary) {
      summary = document.createElement('p');
      summary.className = 'collection-summary';
      const btn = $('close-collection');
      if (btn && btn.parentNode === overlay) overlay.insertBefore(summary, btn);
      else overlay.appendChild(summary);
    }
    summary.innerHTML = '';
    summary.appendChild(document.createTextNode('Tu as rencontré '));
    const s1 = document.createElement('strong');
    s1.textContent = uniques + ' / ' + list.length;
    summary.appendChild(s1);
    summary.appendChild(document.createTextNode(' créatures différentes — '));
    const s2 = document.createElement('strong');
    s2.textContent = String(total);
    summary.appendChild(s2);
    summary.appendChild(document.createTextNode(' captures en tout !'));

    show(overlay);
    replayAnim(overlay, 'overlay');
  }

  function closeCollection() { hide($('collection-overlay')); }

  // ===========================================================================
  //  CHOIX DU COMPAGNON DE DÉPART
  //  (même contenu que buildStarterCards() du jeu 2D, en plus grand et plus doux)
  // ===========================================================================

  const STARTER_OPTIONS = [
    { id: 'miaouche', label: 'Animal mignon' },
    { id: 'flamdrak', label: 'Dragon de feu' },
    { id: null, label: 'Surprise !' },
  ];

  function buildStarterCards(options) {
    const grid = $('starter-grid');
    if (!grid) return;
    const opts = (Array.isArray(options) && options.length) ? options : STARTER_OPTIONS;
    const list = (typeof CREATURES !== 'undefined') ? CREATURES : [];

    grid.innerHTML = '';
    opts.forEach(function (opt, i) {
      const card = el('div', 'starter-card clickable' + (i === 0 ? ' selected' : ''), grid);
      card.id = 'starter-card-' + i;
      card.style.animationDelay = (i * 0.08) + 's';

      const cr = opt.id ? list.find(function (c) { return c.id === opt.id; }) : null;
      card.appendChild(cr ? creatureThumb(cr, 4) : mysteryThumb(4));
      el('div', 'starter-name', card, cr ? cr.name : '???');
      el('div', 'starter-type', card, opt.label || '');

      card.addEventListener('mouseenter', function () { setStarterCursor(i); });
      card.addEventListener('click', function () {
        setStarterCursor(i);
        if (starterHandler) starterHandler(i, opt);
        else fakeKey(' ');   // repli : Espace confirme, comme au clavier
      });
    });
  }

  function setStarterCursor(i) {
    const cards = document.querySelectorAll('#starter-grid .starter-card');
    for (let k = 0; k < cards.length; k++) cards[k].classList.toggle('selected', k === (i | 0));
    const st = gameState();
    if (st) st.starterCursor = i | 0;
  }

  /** game3d.js peut brancher ce qui se passe au clic sur une carte de starter. */
  function onStarterPick(fn) { starterHandler = fn; }

  // ===========================================================================
  //  DIVERS : FPS, toasts, bouton muet, astuce de commandes
  // ===========================================================================

  function setFps(v) {
    const e = $('fps-counter');
    if (!e || !fpsVisible) return;
    e.textContent = Math.round(v) + ' fps';
  }

  function setFpsVisible(v) {
    fpsVisible = !!v;
    const e = $('fps-counter');
    if (e) e.classList.toggle('hidden', !fpsVisible);
  }

  function toggleFps() { setFpsVisible(!fpsVisible); }

  function toast(text) {
    if (!ui.toasts) return;
    const t = el('div', 'toast', ui.toasts, String(text));
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2700);
    // On ne garde jamais plus de 3 messages empilés.
    while (ui.toasts.children.length > 3) ui.toasts.removeChild(ui.toasts.firstChild);
  }

  function setMuted(muted) {
    const b = $('mute-btn');
    if (!b) return;
    b.classList.toggle('muted', !!muted);
    b.textContent = muted ? '♪̸' : '♪';
    b.title = muted ? 'Remettre le son (M)' : 'Couper le son (M)';
  }

  function showControlsHint(v) {
    const e = $('controls-hint');
    if (e) e.classList.toggle('hidden', !v);
  }

  function showMuteButton(v) {
    const b = $('mute-btn');
    if (b) b.style.display = v ? 'flex' : 'none';
  }

  /** Affiche/masque le compteur de collection (inutile hors du monde). */
  function showCollectionCount(v) {
    if (ui.count) ui.count.classList.toggle('hidden', !v);
  }

  /** Affiche/masque le sélecteur de qualité (inutile sur l'écran titre). */
  function showQualityPicker(v) {
    if (ui.qualityPicker) ui.qualityPicker.classList.toggle('hidden', !v);
  }

  // ===========================================================================
  //  ENREGISTREMENT
  // ===========================================================================

  const api = {
    init: init,
    // dialogue
    showMessage: showMessage,
    hideMessage: hideMessage,
    // monde
    setBiomeBanner: setBiomeBanner,
    setCollectionCount: setCollectionCount,
    showCollectionCount: showCollectionCount,
    showQualityPicker: showQualityPicker,
    setInBattle: setInBattle,
    // combat
    showMoveMenu: showMoveMenu,
    hideMoveMenu: hideMoveMenu,
    setMoveCursor: setMoveCursor,
    onMoveChosen: onMoveChosen,
    setHP: setHP,
    hideHP: hideHP,
    hideBattleUI: hideBattleUI,
    // écrans
    openMap: openMap,
    closeMap: closeMap,
    openCollection: openCollection,
    closeCollection: closeCollection,
    buildStarterCards: buildStarterCards,
    setStarterCursor: setStarterCursor,
    onStarterPick: onStarterPick,
    // divers
    setFps: setFps,
    setFpsVisible: setFpsVisible,
    toggleFps: toggleFps,
    toast: toast,
    setMuted: setMuted,
    showMuteButton: showMuteButton,
    showControlsHint: showControlsHint,
    creatureThumb: creatureThumb,
    ui: ui,
  };

  if (typeof R3 !== 'undefined' && R3.register) R3.register('hud', api);
  window.HUD3D = api;   // filet de sécurité si R3 manquait

  // On initialise dès que le DOM est prêt : game3d.js peut appeler init() une
  // seconde fois sans dommage (la fonction est idempotente).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
