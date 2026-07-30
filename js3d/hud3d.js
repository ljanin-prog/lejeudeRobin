// =============================================================================
//  hud3d.js — INTERFACE de la version 3D du « Jeu de Robin »  (CONTRAT2 §18)
// =============================================================================
//  Tout ce qui n'est pas de la 3D vit ici : boîte de dialogue, bandeaux de
//  biome/région, équipe, Pokédex, carte (région + monde), combat (menus,
//  barres de PV, sac, capacités), menu du dirigeable, viseur de Pokéball,
//  collection, choix du compagnon, toasts, sélecteur de qualité.
//
//  L'interface est en HTML/CSS (fichier css3d/hud3d.css) : plus net et plus
//  lisible qu'un dessin sur canvas, et ça s'adapte tout seul à l'écran.
//
//  RÈGLE D'OR : aucune fonction ne suppose qu'un autre module est chargé.
//  dex3d / team3d / types3d / moves3d / regions3d / arenas3d / airship3d /
//  camera3d / cities3d sont tous lus via R3.get('xxx') et peuvent être
//  absents (page de test, module pas encore livré, erreur de chargement) :
//  chaque écran se dégrade proprement plutôt que de lever une exception.
//
//  Pour les 4 modules non encore vérifiés au moment où ce fichier est écrit
//  (regions3d, cities3d, arenas3d, airship3d, camera3d — livrés en parallèle),
//  on code contre LEUR SIGNATURE DE CONTRAT et on protège chaque appel par un
//  `typeof fn === 'function'` : le HUD reste fonctionnel même si un de ces
//  modules change de forme ou n'a pas fini de charger.
// =============================================================================

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Socle : accès tolérant à R3 et aux modules voisins.
  // ---------------------------------------------------------------------------
  const R3ref = (typeof R3 !== 'undefined' && R3) ? R3 : {
    get: function () { return undefined; },
    register: function (n, api) { return api; },
  };

  function DEX() { return R3ref.get('dex'); }
  function TEAM() { return R3ref.get('team'); }
  function TYPES() { return R3ref.get('types'); }
  function MOVES() { return R3ref.get('moves'); }
  function REGIONS() { return R3ref.get('regions'); }
  function ARENAS() { return R3ref.get('arenas'); }
  function AIRSHIP() { return R3ref.get('airship'); }
  function CAMERA() { return R3ref.get('camera'); }
  function CITIES() { return R3ref.get('cities'); }

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
  function clamp(v, lo, hi) { v = v | 0; return v < lo ? lo : (v > hi ? hi : v); }

  /** Temps en secondes, indépendant de la boucle de jeu (le HUD doit continuer
   *  à s'animer même si le monde 3D est en pause, par exemple sur la carte). */
  function now() { return performance.now() / 1000; }

  /**
   * Renvoie l'état du jeu, quel que soit le module qui le détient.
   * game3d.js expose window.GAME3D = { state, ... } ; on prévoit aussi le cas
   * où il s'enregistrerait via R3.register('game', ...), et le cas où une
   * page de test pose juste window.state.
   */
  function gameState() {
    if (window.GAME3D && window.GAME3D.state) return window.GAME3D.state;
    const g = R3ref.get('game');
    if (g && g.state) return g.state;
    if (window.state && typeof window.state === 'object') return window.state;
    return null;
  }

  /** Repli souris/tactile : rejoue une touche pour réutiliser la logique
   *  clavier de game3d.js quand aucun gestionnaire dédié n'a été branché. */
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

  // ===========================================================================
  //  TYPES ÉLÉMENTAIRES — table de repli si types3d.js manque (§2, figée)
  // ===========================================================================

  const TYPE_FALLBACK = {
    feu: { id: 'feu', label: 'Feu', color: '#ff6b3d', icon: '🔥' },
    eau: { id: 'eau', label: 'Eau', color: '#41a6f6', icon: '💧' },
    plante: { id: 'plante', label: 'Plante', color: '#38b764', icon: '🌿' },
    foudre: { id: 'foudre', label: 'Foudre', color: '#f1c40f', icon: '⚡' },
    glace: { id: 'glace', label: 'Glace', color: '#a8e6ff', icon: '❄️' },
    air: { id: 'air', label: 'Air', color: '#bfe3f2', icon: '💨' },
    terre: { id: 'terre', label: 'Terre', color: '#c08c4a', icon: '🍂' },
    roche: { id: 'roche', label: 'Roche', color: '#9aa0a6', icon: '🪨' },
    lumiere: { id: 'lumiere', label: 'Lumière', color: '#ffe066', icon: '✨' },
    ombre: { id: 'ombre', label: 'Ombre', color: '#7a5cbf', icon: '🌑' },
    temps: { id: 'temps', label: 'Temps', color: '#d896ff', icon: '⏳' },
    espace: { id: 'espace', label: 'Espace', color: '#4b62d9', icon: '🌌' },
  };
  const TYPE_ORDER_FALLBACK = ['feu', 'eau', 'plante', 'foudre', 'glace', 'air',
    'terre', 'roche', 'lumiere', 'ombre', 'temps', 'espace'];
  const NEUTRAL_TYPE = { id: null, label: 'Normal', color: '#94b0c2', icon: '◇' };

  function typeInfo(id) {
    const api = TYPES();
    if (api && typeof api.get === 'function') {
      const t = api.get(id);
      if (t) return t;
    }
    return TYPE_FALLBACK[id] || NEUTRAL_TYPE;
  }

  function typeOrder() {
    const api = TYPES();
    return (api && Array.isArray(api.ORDER)) ? api.ORDER : TYPE_ORDER_FALLBACK;
  }

  /** Pastille de type prête à insérer — réutilise types3d.badge() si présent. */
  function typeBadge(id, small) {
    const api = TYPES();
    if (api && typeof api.badge === 'function') {
      const b = api.badge(id);
      if (b) { if (small) b.classList.add('small'); return b; }
    }
    const t = typeInfo(id);
    const span = el('span', 'type-badge' + (small ? ' small' : ''));
    span.style.setProperty('--type-color', t.color);
    span.textContent = t.icon + ' ' + t.label;
    return span;
  }

  // ===========================================================================
  //  CAPACITÉS — lecture tolérante de moves3d.js
  // ===========================================================================

  function moveInfo(id) {
    const api = MOVES();
    if (api && typeof api.get === 'function') {
      const m = api.get(id);
      if (m) return m;
    }
    // Repli minimal : une attaque neutre plausible, jamais d'exception.
    return { id: id, name: id ? String(id) : 'Capacité', type: null,
             power: [8, 14], acc: 0.9, heal: 0, pp: 20, fx: null, desc: '' };
  }

  function moveShortDesc(move) {
    if (move.heal && typeof move.heal === 'object' && move.heal.frac) {
      return 'Soin ' + Math.round(move.heal.frac * 100) + ' % PV';
    }
    if (move.heal) return 'Soin +' + move.heal + ' PV';
    if (Array.isArray(move.power)) return move.power[0] + '–' + move.power[1] + ' dégâts';
    return 'Attaque';
  }

  // ===========================================================================
  //  LES 6 RÉGIONS — table figée du §3 (repli si regions3d.js est incomplet)
  // ===========================================================================

  const REGION_NAMES = {
    val: "Val d'Émeraude", sylve: "Sylve d'Ambre", saphir: 'Côte de Saphir',
    givre: 'Massif de Givre', braise: 'Caldeira de Braise', aurore: "Plateau d'Aurore",
  };
  const REGION_ORDER = ['val', 'sylve', 'saphir', 'givre', 'braise', 'aurore'];
  // Disposition de la carte du monde, telle que figée au §3 :
  //       [givre]   [aurore]   [braise]
  //       [val]     [sylve]    [saphir]
  // Coordonnées en pourcentage (0..100), réutilisées à la fois pour le SVG des
  // liaisons (viewBox "0 0 100 100") et pour positionner les pastilles en CSS.
  const WORLD_GRID = {
    givre: { x: 16.67, y: 25 }, aurore: { x: 50, y: 25 }, braise: { x: 83.33, y: 25 },
    val: { x: 16.67, y: 75 }, sylve: { x: 50, y: 75 }, saphir: { x: 83.33, y: 75 },
  };
  const WORLD_LINKS = [
    ['val', 'givre'], ['val', 'sylve'], ['sylve', 'aurore'], ['sylve', 'saphir'],
    ['saphir', 'braise'], ['givre', 'aurore'], ['aurore', 'braise'],
  ];

  function regionName(id) {
    const R = REGIONS();
    if (R && typeof R.get === 'function') {
      const r = R.get(id);
      if (r && r.name) return r.name;
    }
    return REGION_NAMES[id] || id || '???';
  }

  // ===========================================================================
  //  VIGNETTES DE CRÉATURES
  //  Trois sources, dans l'ordre de préférence :
  //   1. species.draw(ctx, x, y, échelle)  — les 26 créatures d'origine.
  //   2. rendu 3D hors écran (WebGLRenderer 96×96 partagé, mis en cache)
  //      — les 36 légendaires, via R3.buildCreature(id).
  //   3. pastille colorée + icône de type — repli si les deux précédents
  //      échouent (pas de WebGL, modèle absent, erreur quelconque).
  // ===========================================================================

  function mysteryThumb(scale) {
    scale = scale || 3;
    const size = 16 * scale + scale * 6;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
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

  /** Dessin 2D d'origine — repris tel quel du HUD 2D, qui marchait bien. */
  function creatureThumb(creature, scale) {
    scale = scale || 3;
    const margin = scale * 3;
    const size = 16 * scale + margin * 2;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    if (creature && typeof creature.draw === 'function') {
      try { creature.draw(c, margin, margin, scale); }
      catch (e) { console.warn('[hud3d] dessin de vignette en échec :', creature.id, e); }
    }
    return cv;
  }

  /** Redimensionne un canvas source dans un nouveau canvas de taille fixe
   *  (chaque écran a besoin de sa propre copie, on ne déplace jamais l'original
   *  d'un parent DOM à l'autre). */
  function resizedCanvas(src, size) {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = true;
    try { c.drawImage(src, 0, 0, size, size); } catch (e) { /* source invalide : canvas vide */ }
    return cv;
  }

  function lighten(hex, amt) {
    const s = (hex || '#7a5cbf').replace('#', '');
    const full = s.length === 3 ? s.split('').map(function (x) { return x + x; }).join('') : s;
    const n = parseInt(full, 16) || 0x7a5cbf;
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.min(255, Math.round(r + (255 - r) * amt));
    g = Math.min(255, Math.round(g + (255 - g) * amt));
    b = Math.min(255, Math.round(b + (255 - b) * amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /** Le repli « joli, pas un carré gris » : pastille dégradée + icône du type. */
  function typeIconThumb(species, size) {
    size = size || 64;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const c = cv.getContext('2d');
    const color = (species && species.color) || '#7a5cbf';
    const grad = c.createRadialGradient(size * 0.5, size * 0.4, size * 0.04, size * 0.5, size * 0.5, size * 0.56);
    grad.addColorStop(0, lighten(color, 0.35));
    grad.addColorStop(1, color);
    c.fillStyle = grad;
    c.beginPath();
    c.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = Math.max(2, size * 0.035);
    c.strokeStyle = 'rgba(10, 12, 26, .55)';
    c.stroke();
    const t = (species && species.types && species.types[0]) || null;
    const icon = typeInfo(t).icon || '❔';
    c.font = 'bold ' + Math.round(size * 0.44) + 'px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(icon, size / 2, size * 0.56);
    if (species && species.legendary) {
      c.font = 'bold ' + Math.round(size * 0.2) + 'px system-ui, sans-serif';
      c.fillStyle = '#fff4d6';
      c.textAlign = 'right';
      c.fillText('✨', size * 0.92, size * 0.22);
    }
    return cv;
  }

  // --- Rendu 3D hors écran, partagé et mis en cache ---------------------------

  const THUMB_SIZE = 96;
  let thumbRenderer = null, thumbScene = null, thumbCam = null, thumbReady = false;
  const thumb3DCache = new Map();   // speciesId -> canvas | null (échec mis en cache aussi)

  function ensureThumbRenderer() {
    if (thumbReady) return !!thumbRenderer;
    thumbReady = true;   // on ne retente qu'une fois : pas de tempête de tentatives
    if (typeof THREE === 'undefined') return false;
    try {
      const canvas = document.createElement('canvas');
      thumbRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      thumbRenderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
      thumbRenderer.setPixelRatio(1);
      thumbScene = new THREE.Scene();
      thumbCam = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
      const hemi = new THREE.HemisphereLight(0xfff6e0, 0x20243f, 1.15);
      thumbScene.add(hemi);
      const dir = new THREE.DirectionalLight(0xffffff, 1.0);
      dir.position.set(2.4, 3.2, 3.6);
      thumbScene.add(dir);
      return true;
    } catch (e) {
      console.warn('[hud3d] rendu 3D des vignettes indisponible (repli sur pastille de type) :', e);
      thumbRenderer = null;
      return false;
    }
  }

  /** Construit puis capture une vignette 3D pour une espèce. -> canvas | null */
  function render3DThumb(id) {
    if (!ensureThumbRenderer()) return null;
    let group;
    try { group = R3ref.buildCreature ? R3ref.buildCreature(id) : null; }
    catch (e) { console.warn('[hud3d] construction 3D de « ' + id + ' » en échec :', e); return null; }
    if (!group) return null;
    try {
      thumbScene.add(group);
      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(group);
      const size = new THREE.Vector3(); box.getSize(size);
      const center = new THREE.Vector3(); box.getCenter(center);
      const radius = Math.max(size.x, size.y, size.z, 0.5) * 0.62;
      const fovRad = (thumbCam.fov * Math.PI) / 180;
      const dist = Math.max(0.8, radius / Math.tan(fovRad / 2)) * 1.2;
      thumbCam.position.set(center.x + dist * 0.5, center.y + size.y * 0.22 + radius * 0.3, center.z + dist * 0.86);
      thumbCam.lookAt(center.x, center.y + size.y * 0.06, center.z);
      thumbCam.updateProjectionMatrix();
      thumbRenderer.setClearColor(0x000000, 0);
      thumbRenderer.clear();
      thumbRenderer.render(thumbScene, thumbCam);
      const out = document.createElement('canvas');
      out.width = THUMB_SIZE; out.height = THUMB_SIZE;
      out.getContext('2d').drawImage(thumbRenderer.domElement, 0, 0);
      thumbScene.remove(group);
      if (typeof R3ref.disposeTree === 'function') { try { R3ref.disposeTree(group); } catch (e) { /* tant pis */ } }
      return out;
    } catch (e) {
      console.warn('[hud3d] rendu de la vignette 3D de « ' + id + ' » en échec :', e);
      try { thumbScene.remove(group); } catch (e2) { /* ignore */ }
      return null;
    }
  }

  function creature3DThumb(species) {
    if (!species) return null;
    if (thumb3DCache.has(species.id)) return thumb3DCache.get(species.id);
    const cv = render3DThumb(species.id);
    thumb3DCache.set(species.id, cv);
    return cv;
  }

  /**
   * Point d'entrée UNIQUE pour une vignette d'espèce, à une taille précise.
   * Dispatch : dessin 2D -> rendu 3D (légendaires) -> pastille de type.
   */
  function thumbFor(species, px) {
    px = px || 72;
    if (!species) return resizedCanvas(mysteryThumb(3), px);
    if (typeof species.draw === 'function') {
      return resizedCanvas(creatureThumb(species, 3), px);
    }
    if (species.legendary) {
      const cv3d = creature3DThumb(species);
      if (cv3d) return resizedCanvas(cv3d, px);
    }
    return typeIconThumb(species, px);
  }

  // ===========================================================================
  //  ÉTAT INTERNE DU HUD
  // ===========================================================================

  const ui = {};                 // références aux éléments créés
  let inited = false;
  let hudRoot = null;

  let biomeTimer = 0;
  let regionBannerTimer = 0;
  let mapRaf = 0;
  let fpsVisible = false;
  let lastUniques = -1;

  let moveHandler = null;        // callback optionnel branché par game3d.js
  let starterHandler = null;

  let liveBattle = null;         // le battleState en cours, pour que setXCursor(i)
                                  // puisse muter directement battle.xxxCursor.

  let hudBadges = [];            // [{id,name,icon,color}] — posé par setBadges()
  let hudItems = {};             // {itemId: count}          — posé par setItems()

  const ITEM_META = {
    pokeball: { name: 'Pokéball', icon: '⚪', desc: 'Capture une créature sauvage.' },
    superball: { name: 'Super Ball', icon: '🔵', desc: 'Meilleure chance de capture.' },
    hyperball: { name: 'Hyper Ball', icon: '🟣', desc: 'Encore meilleure chance de capture !' },
    ballmaitresse: { name: 'Ball Maîtresse', icon: '🎯', desc: 'Capture garantie !' },
    potion: { name: 'Potion', icon: '💊', desc: 'Rend 20 PV à une créature.' },
  };

  // ===========================================================================
  //  INITIALISATION
  // ===========================================================================

  function init() {
    if (inited) return;
    hudRoot = $('hud') || document.body;
    inited = true;

    buildBiomeBanner();
    buildRegionBanner();
    buildCollectionCount();
    buildBallCount();
    buildAimReticle();
    buildViewToggle();
    buildBattleHud();
    buildMainMenu();
    buildMoveMenu();
    buildMonMenu();
    buildBagMenu();
    buildBattleLog();
    buildTeamOverlay();
    buildDexOverlay();
    buildMapOverlay();
    buildAirshipOverlay();
    buildCompass();
    buildToastLayer();
    buildQualityPicker();
    wireExistingElements();
    window.addEventListener('keydown', onGlobalKeydown, true);
    window.addEventListener('resize', placeHpCards);

    // Le compteur de FPS peut être demandé par l'URL (index3d.html#fps)
    if (String(location.hash || '').indexOf('fps') >= 0) setFpsVisible(true);
  }

  /** Branche les éléments déjà présents dans index3d.html. */
  function wireExistingElements() {
    const box = $('message-box');
    if (box) box.addEventListener('click', function () { fakeKey(' '); });

    const closeBtn = $('close-collection');
    if (closeBtn && !closeBtn.dataset.hudWired) {
      closeBtn.dataset.hudWired = '1';
      closeBtn.addEventListener('click', function () {
        const ov = $('collection-overlay');
        if (ov && !ov.classList.contains('hidden')) fakeKey('c');
      });
    }

    const fps = $('fps-counter');
    if (fps) fps.addEventListener('click', function () { setFpsVisible(false); });
  }

  function buildBiomeBanner() { ui.biome = el('div', 'biome-banner', hudRoot); }

  function buildRegionBanner() {
    const b = el('div', 'region-banner hidden', hudRoot);
    ui.regionBannerName = el('div', 'rb-name', b);
    ui.regionBannerSub = el('div', 'rb-sub', b);
    ui.regionBanner = b;
  }

  function buildCollectionCount() {
    ui.count = el('div', 'collection-count hidden', hudRoot);
    el('span', 'ball', ui.count);
    ui.countNum = el('span', 'num', ui.count, '0/0');
    ui.count.title = 'Créatures différentes capturées';
  }

  function buildBallCount() {
    const b = el('div', 'ball-count hidden', hudRoot);
    el('span', 'bc-icon', b, '⚪');
    ui.ballNum = el('span', 'bc-num', b, '0');
    ui.ballCount = b;
  }

  function buildAimReticle() {
    const r = el('div', 'aim-reticle hidden', hudRoot);
    el('div', 'ar-ring', r);
    ui.aimName = el('div', 'ar-name', r, '');
    el('div', 'ar-hint', r, 'B pour lancer une Ball !');
    ui.aimReticle = r;
  }

  function buildViewToggle() {
    const b = el('button', 'view-toggle-btn clickable', hudRoot, '🧭');
    b.type = 'button';
    b.title = 'Changer de vue (V)';
    b.setAttribute('aria-label', 'Changer de vue');
    // On passe TOUJOURS par la touche V : c'est game3d.js qui connaît les trois
    // vues, affiche le bon message et enregistre le choix dans la sauvegarde.
    b.addEventListener('click', function () { fakeKey('v'); b.blur(); });
    ui.viewToggle = b;
  }

  /** Icône du bouton de vue : 🧭 aventure · 🗺️ RPG · 👁️ première personne. */
  const VIEW_ICON = { aventure: '🧭', rpg: '🗺️', fps: '👁️' };
  const VIEW_NAME = { aventure: 'Vue aventure', rpg: 'Vue RPG', fps: 'Vue à la première personne' };

  function setViewMode(mode) {
    if (!ui.viewToggle) return;
    const id = VIEW_ICON[mode] ? mode : 'aventure';
    ui.viewToggle.textContent = VIEW_ICON[id];
    ui.viewToggle.title = VIEW_NAME[id] + ' — changer (V)';
    ui.viewToggle.setAttribute('aria-label', VIEW_NAME[id]);
  }

  function buildToastLayer() { ui.toasts = el('div', 'toast-layer', hudRoot); }

  // ===========================================================================
  //  BOUSSOLE — la mini-carte TOUJOURS affichée (« où suis-je ? »)
  // ---------------------------------------------------------------------------
  //  Une région fait 384 × 224 tuiles : sans repère permanent, on ne sait
  //  jamais où l'on est ni dans quelle direction se trouve la sortie. Ce petit
  //  panneau montre la région entière, ta position, les portes, le port et la
  //  ville, plus une flèche vers la porte la plus proche.
  //
  //  Il n'est PAS redessiné à chaque image : game3d.js appelle setCompass() à
  //  la fin de chaque pas, à chaque demi-tour et à chaque changement de région.
  // ===========================================================================

  const CP_W = 208, CP_H = 122;      // taille du canvas de la boussole
  const compassBase = Object.create(null);   // regionId -> canvas hors écran
  let compassInfo = null;

  function buildCompass() {
    const p = el('div', 'compass hidden', hudRoot);
    const head = el('div', 'cp-head', p);
    ui.compassRegion = el('span', 'cp-region', head, '');
    ui.compassCoords = el('span', 'cp-coords', head, '');
    const wrap = el('div', 'cp-map', p);
    ui.compassCanvas = el('canvas', null, wrap);
    ui.compassCanvas.width = CP_W;
    ui.compassCanvas.height = CP_H;
    ui.compassCtx = ui.compassCanvas.getContext('2d');
    ui.compassTarget = el('div', 'cp-target', p, '');
    p.title = 'Ta position dans la région — N pour la grande carte';
    p.addEventListener('click', function () { fakeKey('n'); });
    ui.compass = p;
  }

  /** Image de fond de la région, calculée UNE FOIS puis gardée en cache. */
  function compassBackground(regionId) {
    if (compassBase[regionId]) return compassBase[regionId];
    const R = REGIONS();
    if (!R || typeof R.minimap !== 'function') return null;
    let cv = null;
    try {
      cv = document.createElement('canvas');
      cv.width = CP_W; cv.height = CP_H;
      R.minimap(regionId, cv);
    } catch (e) {
      console.warn('[hud3d] fond de boussole indisponible :', e);
      return null;
    }
    compassBase[regionId] = cv;
    return cv;
  }

  const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];

  function arrowTo(dx, dy) {
    // atan2(dy, dx) avec y qui descend (repère de la carte).
    const a = Math.atan2(dy, dx);
    let i = Math.round(a / (Math.PI / 4));
    i = ((i % 8) + 8) % 8;
    return ARROWS[i];
  }

  /**
   * @param {object} info { regionId, regionName, x, y, dir, biome, visible }
   */
  function setCompass(info) {
    if (!ui.compass || !info) return;
    compassInfo = info;
    if (info.visible === false) { hide(ui.compass); return; }
    show(ui.compass);

    const R = REGIONS();
    const W = (R && R.W) || 384, H = (R && R.H) || 224;
    const px = Number(info.x) || 0, py = Number(info.y) || 0;

    ui.compassRegion.textContent = info.regionName || info.regionId || '';
    ui.compassCoords.textContent = Math.round(px) + ' · ' + Math.round(py);

    const c = ui.compassCtx;
    if (!c) return;
    c.clearRect(0, 0, CP_W, CP_H);

    const fond = compassBackground(info.regionId);
    if (fond) c.drawImage(fond, 0, 0, CP_W, CP_H);
    else { c.fillStyle = '#1b2036'; c.fillRect(0, 0, CP_W, CP_H); }

    const sx = function (x) { return (x / W) * CP_W; };
    const sy = function (y) { return (y / H) * CP_H; };

    // --- les lieux à retenir --------------------------------------------------
    const def = (R && typeof R.get === 'function') ? R.get(info.regionId) : null;
    let cible = null, cibleD = Infinity;

    if (def && Array.isArray(def.gates)) {
      def.gates.forEach(function (g) {
        marqueur(c, sx(g.x), sy(g.y), '#ffe066');
        const d = Math.abs(g.x - px) + Math.abs(g.y - py);
        if (d < cibleD) {
          cibleD = d;
          cible = { x: g.x, y: g.y, icon: '🚪', label: g.label || ('Vers ' + regionName(g.toRegion)) };
        }
      });
    }
    if (def && def.airship && typeof def.airship.x === 'number') {
      marqueur(c, sx(def.airship.x), sy(def.airship.y), '#41a6f6');
    }
    try {
      const cities = CITIES();
      const plan = (cities && typeof cities.plan === 'function') ? cities.plan(info.regionId) : null;
      if (plan) {
        if (plan.castle) marqueur(c, sx(plan.castle.x), sy(plan.castle.y), '#ffffff');
        if (plan.arena) marqueur(c, sx(plan.arena.x), sy(plan.arena.y), '#ff6b3d');
      }
    } catch (e) { /* cities3d est optionnel */ }

    // --- toi ------------------------------------------------------------------
    const jx = sx(px), jy = sy(py);
    c.beginPath();
    c.arc(jx, jy, 6.5, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(231, 76, 60, .55)';
    c.lineWidth = 2;
    c.stroke();
    c.beginPath();
    c.arc(jx, jy, 3.4, 0, Math.PI * 2);
    c.fillStyle = '#e74c3c';
    c.fill();
    c.lineWidth = 1.6;
    c.strokeStyle = '#fff';
    c.stroke();

    // Le petit nez qui montre où l'on regarde.
    const V = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[info.dir] || [0, 1];
    c.beginPath();
    c.moveTo(jx + V[0] * 5, jy + V[1] * 5);
    c.lineTo(jx + V[0] * 11 - V[1] * 3.4, jy + V[1] * 11 + V[0] * 3.4);
    c.lineTo(jx + V[0] * 11 + V[1] * 3.4, jy + V[1] * 11 - V[0] * 3.4);
    c.closePath();
    c.fillStyle = '#fff';
    c.fill();

    // --- la ligne « prochaine porte » ----------------------------------------
    if (cible) {
      ui.compassTarget.textContent = cible.icon + ' ' + cible.label + '  ' +
        arrowTo(cible.x - px, cible.y - py) + ' ' + Math.round(cibleD);
      show(ui.compassTarget);
    } else {
      ui.compassTarget.textContent = '';
    }
  }

  function marqueur(c, x, y, couleur) {
    c.beginPath();
    c.arc(x, y, 3.6, 0, Math.PI * 2);
    c.fillStyle = couleur;
    c.fill();
    c.lineWidth = 1.4;
    c.strokeStyle = 'rgba(0,0,0,.65)';
    c.stroke();
  }

  function showCompass(v) {
    if (!ui.compass) return;
    if (v) { if (compassInfo) show(ui.compass); }
    else hide(ui.compass);
  }

  function buildQualityPicker() {
    const box = el('div', 'quality-picker clickable', hudRoot);
    el('span', 'lbl', box, 'Qualité');
    ui.qualityBtns = {};
    [['low', 'Bas'], ['medium', 'Moyen'], ['high', 'Haut']].forEach(function (q) {
      const b = el('button', null, box, q[1]);
      b.type = 'button';
      b.addEventListener('click', function () {
        if (window.GAME3D && window.GAME3D.setQuality) window.GAME3D.setQuality(q[0], true);
        else if (R3ref.setQuality) R3ref.setQuality(q[0]);
        refreshQuality();
        toast('Qualité : ' + q[1]);
        b.blur();
      });
      ui.qualityBtns[q[0]] = b;
    });
    ui.qualityPicker = box;
    box.classList.add('hidden');
    refreshQuality();
    if (R3ref.onQualityChange) R3ref.onQualityChange(refreshQuality);
  }

  function refreshQuality() {
    if (!ui.qualityBtns) return;
    const lvl = R3ref.quality ? R3ref.quality.level : 'high';
    Object.keys(ui.qualityBtns).forEach(function (k) {
      ui.qualityBtns[k].classList.toggle('on', k === lvl);
    });
  }

  // ===========================================================================
  //  BOÎTE DE DIALOGUE
  // ===========================================================================

  function showMessage(text, opts) {
    opts = opts || {};
    const box = $('message-box');
    const txt = $('message-text');
    if (!box || !txt) return;
    txt.textContent = text === undefined || text === null ? '' : String(text);

    // Étiquette de l'interlocuteur, facultative (opts.name).
    let tag = box.querySelector('.message-name');
    if (opts.name) {
      if (!tag) { tag = document.createElement('div'); tag.className = 'message-name'; box.insertBefore(tag, txt); }
      tag.textContent = opts.name;
      show(tag);
    } else if (tag) hide(tag);

    if (box.classList.contains('hidden')) {
      box.classList.remove('hidden');
      replayAnim(box, 'message-box');
    }
    clearTimeout(showMessage._t);
    if (opts.duration) showMessage._t = setTimeout(hideMessage, opts.duration);
  }

  function hideMessage() { hide($('message-box')); }

  // ===========================================================================
  //  BANDEAUX DE BIOME ET DE RÉGION
  // ===========================================================================

  function setBiomeBanner(label) {
    if (!ui.biome) return;
    if (!label) { ui.biome.classList.remove('show'); return; }
    ui.biome.textContent = label;
    replayAnim(ui.biome, 'show');
    clearTimeout(biomeTimer);
    biomeTimer = setTimeout(function () { ui.biome.classList.remove('show'); }, 2400);
  }

  /** Grand cartouche affiché 2 secondes à chaque transition de région (§18). */
  function setRegionBanner(name) {
    if (!ui.regionBanner) return;
    if (!name) { hide(ui.regionBanner); return; }
    ui.regionBannerName.textContent = name;
    const R = REGIONS();
    let sub = '';
    try {
      const def = R && typeof R.active === 'function' ? R.active() : null;
      if (def && def.theme) sub = def.theme;
    } catch (e) { /* dégradation silencieuse */ }
    ui.regionBannerSub.textContent = sub;
    show(ui.regionBanner);
    replayAnim(ui.regionBanner, 'show');
    clearTimeout(regionBannerTimer);
    regionBannerTimer = setTimeout(function () { hide(ui.regionBanner); }, 2000);
  }

  // ===========================================================================
  //  COMPTEUR DE COLLECTION / DE POKÉBALLS
  // ===========================================================================

  function setCollectionCount(n, total) {
    if (!ui.count) return;
    const dex = DEX();
    const t = total || (dex ? dex.count : (typeof CREATURES !== 'undefined' ? CREATURES.length : 26));
    ui.countNum.textContent = (n | 0) + '/' + t;
    ui.count.title = (n | 0) + ' créature(s) différente(s) sur ' + t;
    if (lastUniques >= 0 && n > lastUniques) replayAnim(ui.count, 'pop');
    lastUniques = n | 0;
  }

  function showCollectionCount(v) { if (ui.count) ui.count.classList.toggle('hidden', !v); }

  function showBallCount(n) {
    if (!ui.ballCount) return;
    if (n === undefined || n === null) { hide(ui.ballCount); return; }
    ui.ballNum.textContent = String(n | 0);
    show(ui.ballCount);
  }

  // ===========================================================================
  //  VISEUR DE POKÉBALL
  //  Sans accès à la caméra 3D, on ne peut pas projeter une position monde en
  //  coordonnées écran depuis le HUD (camera3d.js n'expose pas la caméra elle-
  //  même, seulement `frame()`). Repli assumé et documenté : si `roamer` porte
  //  des coordonnées écran déjà projetées (roamer.screenX/screenY, 0..1), on
  //  les utilise ; sinon le réticule reste discret, centré bas d'écran, avec
  //  le nom de la créature — toujours visible, jamais mal placé.
  // ===========================================================================

  function showAimReticle(roamer) {
    if (!ui.aimReticle) return;
    if (!roamer) { hide(ui.aimReticle); return; }
    const sp = DEX() && typeof DEX().get === 'function' ? DEX().get(roamer.speciesId) : null;
    ui.aimName.textContent = (sp ? sp.name : (roamer.speciesId || 'Créature')) +
      (roamer.level ? ' · Nv ' + roamer.level : '');
    if (typeof roamer.screenX === 'number' && typeof roamer.screenY === 'number') {
      ui.aimReticle.style.left = (roamer.screenX * 100) + '%';
      ui.aimReticle.style.top = (roamer.screenY * 100) + '%';
      ui.aimReticle.classList.remove('fixed');
    } else {
      ui.aimReticle.style.left = '';
      ui.aimReticle.style.top = '';
      ui.aimReticle.classList.add('fixed');
    }
    ui.aimReticle.classList.toggle('legendary', !!roamer.legendary);
    show(ui.aimReticle);
  }

  // ===========================================================================
  //  BADGES / OBJETS — posés par game3d, consommés par l'équipe et le sac.
  // ===========================================================================

  function setBadges(badges) {
    hudBadges = normalizeBadges(badges);
    renderTeamBadgeStrip();
  }

  function normalizeBadges(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input.slice();
    const api = ARENAS();
    const out = [];
    Object.keys(input).forEach(function (rid) {
      if (!input[rid]) return;
      const b = api && typeof api.badgeOf === 'function' ? api.badgeOf(rid) : null;
      out.push(b || { id: rid, name: regionName(rid), icon: '🏅', color: '#f1c40f' });
    });
    return out;
  }

  function setItems(items) {
    hudItems = (items && typeof items === 'object') ? items : {};
    if (liveBattle && ui.bagMenu && !ui.bagMenu.classList.contains('hidden')) renderBagMenu(liveBattle);
  }

  // ===========================================================================
  //  COMBAT : BARRES DE PV
  //   Vert au-dessus de 60 %, orange en dessous, rouge en dessous de 30 %.
  // ===========================================================================

  function buildBattleHud() {
    ui.hp = { foe: makeHpCard('foe'), player: makeHpCard('player') };
  }

  function makeHpCard(side) {
    const card = el('div', 'hp-card ' + side + ' hidden', hudRoot);
    const head = el('div', 'hp-head', card);
    const name = el('span', 'hp-name', head, '');
    const num = el('span', 'hp-num', head, '');
    const meta = el('div', 'hp-meta', card);
    const level = el('span', 'hp-level', meta, '');
    const types = el('span', 'hp-types', meta);
    const bar = el('div', 'hp-bar', card);
    const fill = el('div', 'hp-fill', bar);
    return { root: card, name: name, num: num, level: level, types: types, fill: fill, last: 1 };
  }

  function hpClass(ratio) {
    if (ratio < 0.3) return 'low';
    if (ratio < 0.6) return 'mid';
    return 'ok';
  }

  function setHP(side, hp, maxHp, name, level, types) {
    if (!ui.hp) return;
    const card = ui.hp[side === 'foe' ? 'foe' : 'player'];
    if (!card) return;

    if (hp === null || hp === undefined) { hide(card.root); return; }

    const max = Math.max(1, maxHp || 1);
    const cur = Math.max(0, Math.min(max, hp));
    const ratio = cur / max;

    if (name !== undefined && name !== null) card.name.textContent = String(name);
    card.num.textContent = Math.round(cur) + ' / ' + Math.round(max) + ' PV';
    card.fill.style.width = (ratio * 100).toFixed(1) + '%';
    card.fill.className = 'hp-fill ' + hpClass(ratio);

    if (level !== undefined && level !== null) card.level.textContent = 'Nv ' + level;
    if (types !== undefined) {
      card.types.innerHTML = '';
      (Array.isArray(types) ? types : (types ? [types] : [])).forEach(function (t) {
        card.types.appendChild(typeBadge(t, true));
      });
    }

    show(card.root);
    if (ratio < card.last - 0.001) replayAnim(card.root, 'hit');
    card.last = ratio;
    placeHpCards();
  }

  /**
   * Empêche un menu de combat de recouvrir la carte de PV du joueur.
   * On MESURE les deux boîtes plutôt que de deviner avec des media queries :
   * si elles se chevauchent, la carte remonte juste au-dessus du menu.
   */
  function placeHpCards() {
    const card = ui.hp && ui.hp.player && ui.hp.player.root;
    if (!card || card.classList.contains('hidden')) return;
    card.style.bottom = '';
    const menus = [ui.mainMenu, ui.moveMenu, ui.monMenu, ui.bagMenu];
    let menu = null;
    for (let i = 0; i < menus.length; i++) {
      if (menus[i] && !menus[i].classList.contains('hidden')) { menu = menus[i]; break; }
    }
    if (!menu) return;
    const m = menu.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    if (!m.width || !c.width) return;
    const seChevauchent = (c.right > m.left - 8) && (c.left < m.right + 8) && (c.bottom > m.top - 4);
    if (seChevauchent) {
      card.style.bottom = Math.round(window.innerHeight - m.top + 12) + 'px';
    }
  }

  function hideHP(side) {
    if (!ui.hp) return;
    if (side) { hide(ui.hp[side === 'foe' ? 'foe' : 'player'].root); return; }
    hide(ui.hp.foe.root);
    hide(ui.hp.player.root);
  }

  // ===========================================================================
  //  COMBAT : MENU PRINCIPAL (2×2 — Attaque / Équipe / Sac / Fuite)
  // ===========================================================================

  const MAIN_MENU_ITEMS = [
    { label: 'Attaque', icon: '⚔️' },
    { label: 'Équipe', icon: '👥' },
    { label: 'Sac', icon: '🎒' },
    { label: 'Fuite', icon: '🏃' },
  ];

  function buildMainMenu() {
    const menu = el('div', 'battle-menu hidden', hudRoot);
    const grid = el('div', 'bm-grid', menu);
    ui.mainCells = MAIN_MENU_ITEMS.map(function (item, i) {
      const cell = el('button', 'bm-cell', grid);
      cell.type = 'button';
      el('span', 'bm-icon', cell, item.icon);
      el('span', 'bm-label', cell, item.label);
      cell.addEventListener('mouseenter', function () { setMenuCursor(i); });
      cell.addEventListener('click', function () {
        setMenuCursor(i);
        if (cell.disabled) return;
        fakeKey(' ');
        cell.blur();
      });
      return cell;
    });
    ui.mainMenu = menu;
  }

  function showMainMenu(battle) {
    if (!ui.mainMenu) return;
    liveBattle = battle || liveBattle;
    const b = liveBattle || {};
    if (ui.mainCells) {
      ui.mainCells.forEach(function (cell, i) {
        const flee = (i === 3) && b.canFlee === false;
        cell.disabled = !!flee;
        cell.classList.toggle('disabled', !!flee);
        cell.title = flee ? 'Impossible de fuir ce combat !' : '';
      });
    }
    hideMoveMenu(); hideMonMenu(); hideBagMenu();
    setMenuCursor(b.menuCursor || 0);
    show(ui.mainMenu);
    replayAnim(ui.mainMenu, 'battle-menu');
    placeHpCards();
  }

  function hideMainMenu() { hide(ui.mainMenu); placeHpCards(); }

  function setMenuCursor(i) {
    if (!ui.mainCells) return;
    const idx = clamp(i, 0, ui.mainCells.length - 1);
    ui.mainCells.forEach(function (c, k) { c.classList.toggle('selected', k === idx); });
    if (liveBattle) liveBattle.menuCursor = idx;
  }

  // ===========================================================================
  //  COMBAT : MENU DES CAPACITÉS — grille 2×2
  // ===========================================================================

  function buildMoveMenu() {
    const menu = el('div', 'move-menu hidden', hudRoot);
    const head = el('div', 'mm-head', menu);
    ui.mmName = el('span', 'mm-name', head, '');
    ui.mmHp = el('span', 'mm-hp', head, '');
    ui.moveGrid = el('div', 'move-grid', menu);
    el('p', 'mm-foot', menu, 'Flèches : choisir  ·  Espace : utiliser  ·  Échap : retour');
    ui.moveMenu = menu;
    ui.moveCells = [];
  }

  function movesOfBattle(battle) {
    const b = battle || {};
    if (b.player && b.player.mon && Array.isArray(b.player.mon.moves)) return b.player.mon.moves;
    if (Array.isArray(b.moves)) return b.moves;    // repli ancien format
    return [];
  }

  function showMoveMenu(battle) {
    if (!ui.moveMenu) return;
    liveBattle = battle || liveBattle;
    const b = liveBattle || {};
    // On garde la carte de PV du joueur À L'ÉCRAN : c'est elle qui montre les
    // dégâts encaissés, et la masquer pendant le choix de l'attaque revenait à
    // choisir à l'aveugle. `placeHpCards()` la décale si le menu la recouvre.
    if (ui.hp && ui.hp.player) show(ui.hp.player.root);

    const mon = (b.player && b.player.mon) || null;
    const slots = movesOfBattle(b).slice(0, 4);

    ui.mmName.textContent = (mon && (mon.nick || mon.name)) || 'Ton compagnon';
    if (mon && mon.hp !== undefined && mon.maxHp) {
      const r = Math.max(0, mon.hp) / Math.max(1, mon.maxHp);
      ui.mmHp.textContent = 'PV ' + Math.round(mon.hp) + '/' + Math.round(mon.maxHp);
      ui.mmHp.className = 'mm-hp ' + hpClass(r);
    } else {
      ui.mmHp.textContent = '';
      ui.mmHp.className = 'mm-hp';
    }

    ui.moveGrid.innerHTML = '';
    ui.moveCells = [];
    slots.forEach(function (slot, i) {
      // Compatible avec deux formats : {id,pp,ppMax} (Mon.moves du contrat)
      // ou directement un objet move complet (ancien format 2D).
      const id = (slot && slot.id) || slot;
      const move = moveInfo(id);
      const pp = (slot && slot.pp !== undefined) ? slot.pp : move.pp;
      const ppMax = (slot && slot.ppMax !== undefined) ? slot.ppMax : move.pp;

      const cell = el('button', 'move-cell', ui.moveGrid);
      cell.type = 'button';
      cell.style.setProperty('--type-color', typeInfo(move.type).color);
      const head2 = el('span', 'mv-head', cell);
      el('span', 'mv-name', head2, move.name || ('Capacité ' + (i + 1)));
      head2.appendChild(typeBadge(move.type, true));
      el('span', 'mv-info', cell, moveShortDesc(move));
      const ppEl = el('span', 'mv-pp', cell, 'PP ' + pp + '/' + ppMax);
      const out = pp <= 0;
      cell.disabled = out;
      cell.classList.toggle('disabled', out);
      if (out) ppEl.classList.add('empty');

      cell.addEventListener('mouseenter', function () { setMoveCursor(i); });
      cell.addEventListener('click', function () {
        setMoveCursor(i);
        if (out) return;
        if (moveHandler) moveHandler(i, move);
        else fakeKey(' ');
        cell.blur();
      });
      ui.moveCells.push(cell);
    });

    setMoveCursor(b.moveCursor || 0);
    hideMainMenu(); hideMonMenu(); hideBagMenu();
    show(ui.moveMenu);
    replayAnim(ui.moveMenu, 'move-menu');
    placeHpCards();
  }

  function hideMoveMenu() { hide(ui.moveMenu); placeHpCards(); }

  function setMoveCursor(i) {
    if (!ui.moveCells) return;
    const n = ui.moveCells.length;
    if (!n) return;
    const idx = clamp(i, 0, n - 1);
    ui.moveCells.forEach(function (c, k) { c.classList.toggle('selected', k === idx); });
    if (liveBattle) liveBattle.moveCursor = idx;
  }

  /** game3d.js peut brancher ce qui se passe au clic sur une capacité. */
  function onMoveChosen(fn) { moveHandler = fn; }

  // ===========================================================================
  //  COMBAT : MENU DE CHANGEMENT DE CRÉATURE
  // ===========================================================================

  function buildMonMenu() {
    const menu = el('div', 'mon-menu hidden', hudRoot);
    el('h3', null, menu, 'Change de créature');
    ui.monGrid = el('div', 'mon-grid', menu);
    el('p', 'mm-foot', menu, 'Flèches : choisir  ·  Espace : envoyer  ·  Échap : retour');
    ui.monMenu = menu;
    ui.monCells = [];
  }

  function showMonMenu(battle) {
    if (!ui.monMenu) return;
    liveBattle = battle || liveBattle;
    const b = liveBattle || {};
    const team = (b.player && Array.isArray(b.player.team)) ? b.player.team : ((TEAM() && TEAM().team) || []);
    const activeIndex = (b.player && b.player.index !== undefined) ? b.player.index : -1;

    ui.monGrid.innerHTML = '';
    ui.monCells = [];
    team.forEach(function (mon, i) {
      const sp = DEX() && typeof DEX().get === 'function' ? DEX().get(mon.id) : null;
      const fainted = !mon || (mon.hp | 0) <= 0;
      const cell = el('button', 'mon-card' + (fainted ? ' fainted' : '') + (i === activeIndex ? ' active' : ''), ui.monGrid);
      cell.type = 'button';
      cell.appendChild(thumbFor(sp, 52));
      el('div', 'mc-name', cell, mon.nick || (sp && sp.name) || mon.id);
      el('div', 'mc-level', cell, 'Nv ' + mon.level);
      const bar = el('div', 'mc-hp', cell);
      const fill = el('div', 'mc-hp-fill', bar);
      const ratio = mon.maxHp ? Math.max(0, mon.hp) / mon.maxHp : 0;
      fill.style.width = (ratio * 100) + '%';
      fill.className = 'mc-hp-fill ' + hpClass(ratio);
      if (fainted) el('div', 'mc-ko', cell, 'K.O.');
      if (i === activeIndex) el('div', 'mc-active-tag', cell, 'En combat');

      cell.disabled = fainted || i === activeIndex;
      cell.addEventListener('mouseenter', function () { setMonCursor(i); });
      cell.addEventListener('click', function () {
        setMonCursor(i);
        if (cell.disabled) return;
        fakeKey(' ');
        cell.blur();
      });
      ui.monCells.push(cell);
    });

    setMonCursor(b.monCursor || 0);
    hideMainMenu(); hideMoveMenu(); hideBagMenu();
    show(ui.monMenu);
    replayAnim(ui.monMenu, 'mon-menu');
    placeHpCards();
  }

  function hideMonMenu() { hide(ui.monMenu); placeHpCards(); }

  function setMonCursor(i) {
    if (!ui.monCells || !ui.monCells.length) return;
    const idx = clamp(i, 0, ui.monCells.length - 1);
    ui.monCells.forEach(function (c, k) { c.classList.toggle('selected', k === idx); });
    if (liveBattle) liveBattle.monCursor = idx;
  }

  // ===========================================================================
  //  COMBAT : SAC
  // ===========================================================================

  function buildBagMenu() {
    const menu = el('div', 'bag-menu hidden', hudRoot);
    el('h3', null, menu, 'Ton sac');
    ui.bagList = el('div', 'bag-list', menu);
    el('p', 'mm-foot', menu, 'Flèches : choisir  ·  Espace : utiliser  ·  Échap : retour');
    ui.bagMenu = menu;
    ui.bagCells = [];
  }

  function bagEntries(battle) {
    const b = battle || {};
    const out = [];
    Object.keys(hudItems).forEach(function (id) {
      const n = hudItems[id] | 0;
      if (n <= 0) return;
      const meta = ITEM_META[id] || { name: id, icon: '🎁', desc: '' };
      const isBall = id.indexOf('ball') >= 0;
      out.push({ id: id, n: n, meta: meta, disabled: isBall && b.canCatch === false });
    });
    return out;
  }

  function renderBagMenu(battle) {
    const entries = bagEntries(battle);
    ui.bagList.innerHTML = '';
    ui.bagCells = [];
    if (!entries.length) {
      el('p', 'bag-empty', ui.bagList, 'Ton sac est vide pour le moment.');
      return;
    }
    entries.forEach(function (entry, i) {
      const cell = el('button', 'bag-item' + (entry.disabled ? ' disabled' : ''), ui.bagList);
      cell.type = 'button';
      cell.disabled = entry.disabled;
      el('span', 'bi-icon', cell, entry.meta.icon);
      const info = el('span', 'bi-info', cell);
      el('span', 'bi-name', info, entry.meta.name);
      el('span', 'bi-desc', info, entry.meta.desc);
      el('span', 'bi-count', cell, '×' + entry.n);
      cell.title = entry.disabled ? 'Impossible de capturer ici.' : '';
      cell.addEventListener('mouseenter', function () { setBagCursor(i); });
      cell.addEventListener('click', function () {
        setBagCursor(i);
        if (entry.disabled) return;
        fakeKey(' ');
        cell.blur();
      });
      ui.bagCells.push(cell);
    });
  }

  function showBagMenu(battle) {
    if (!ui.bagMenu) return;
    liveBattle = battle || liveBattle;
    renderBagMenu(liveBattle);
    setBagCursor((liveBattle && liveBattle.bagCursor) || 0);
    hideMainMenu(); hideMoveMenu(); hideMonMenu();
    show(ui.bagMenu);
    replayAnim(ui.bagMenu, 'bag-menu');
    placeHpCards();
  }

  function hideBagMenu() { hide(ui.bagMenu); placeHpCards(); }

  function setBagCursor(i) {
    if (!ui.bagCells || !ui.bagCells.length) return;
    const idx = clamp(i, 0, ui.bagCells.length - 1);
    ui.bagCells.forEach(function (c, k) { c.classList.toggle('selected', k === idx); });
    if (liveBattle) liveBattle.bagCursor = idx;
  }

  // ===========================================================================
  //  COMBAT : JOURNAL
  // ===========================================================================

  function buildBattleLog() {
    ui.battleLog = el('div', 'battle-log hidden', hudRoot);
  }

  function setBattleLog(lines) {
    if (!ui.battleLog) return;
    const arr = Array.isArray(lines) ? lines.filter(Boolean) : (lines ? [String(lines)] : []);
    if (!arr.length) { hide(ui.battleLog); return; }
    ui.battleLog.innerHTML = '';
    arr.slice(-4).forEach(function (line) { el('p', null, ui.battleLog, line); });
    show(ui.battleLog);
  }

  // ===========================================================================
  //  COMBAT : ORCHESTRATION
  // ===========================================================================

  function showBattleUI(battle) {
    liveBattle = battle || null;
    if (!liveBattle) { hideBattleUI(); return; }
    const b = liveBattle;
    setInBattle(true);

    const pm = b.player && b.player.mon;
    const fm = b.foe && b.foe.mon;
    if (pm) setHP('player', pm.hp, pm.maxHp, pm.nick || pm.name, pm.level, pm.types);
    if (fm) {
      const sp = DEX() && typeof DEX().get === 'function' ? DEX().get(fm.id) : null;
      const legendTag = (sp && sp.legendary) ? '✨ ' : '';
      setHP('foe', fm.hp, fm.maxHp, legendTag + (fm.nick || fm.name || ''), fm.level, fm.types);
      if (ui.hp && ui.hp.foe) ui.hp.foe.root.classList.toggle('legendary', !!(sp && sp.legendary));
    }

    switch (b.phase) {
      case 'choose': showMainMenu(b); break;
      case 'choose_move': showMoveMenu(b); break;
      case 'choose_mon': showMonMenu(b); break;
      case 'bag': showBagMenu(b); break;
      default: hideMainMenu(); hideMoveMenu(); hideMonMenu(); hideBagMenu();
    }
  }

  function hideBattleUI() {
    hideHP();
    hideMainMenu();
    hideMoveMenu();
    hideMonMenu();
    hideBagMenu();
    setBattleLog(null);
    setInBattle(false);
    liveBattle = null;
  }

  function setInBattle(v) {
    const e = $('controls-hint');
    if (e) e.classList.toggle('en-combat', !!v);
    // La boussole n'a rien à faire par-dessus l'écran de combat.
    showCompass(!v);
  }

  // ===========================================================================
  //  ÉCRAN ÉQUIPE (touche E) — demande n°4 de Robin : « 6 places pour choisir »
  // ===========================================================================
  //  Interaction, à la souris ET au clavier :
  //   · cliquer/valider une place d'équipe la sélectionne (surbrillance) ;
  //   · cliquer/valider une AUTRE place d'équipe alors qu'une est sélectionnée
  //     les échange (team.swap) ;
  //   · cliquer/valider une créature de la Boîte alors qu'une place d'équipe
  //     est sélectionnée l'y fait entrer (team.toTeam), l'occupante partant
  //     à la Boîte ;
  //   · le bouton « Renvoyer à la Boîte » vide la place sélectionnée
  //     (toBox), désactivé si l'équipe n'a plus qu'un seul membre ;
  //   · les flèches déplacent le curseur dans la grille active (équipe ou
  //     boîte), Entrée/Espace valident, Échap ferme l'écran.
  // ===========================================================================

  const TEAM_COLS = 3;
  const BOX_COLS = 6;
  const BOX_PAGE_SIZE = BOX_COLS * 3;

  let teamCursor = 0;
  let teamZone = 'team';     // 'team' | 'box'
  let teamSelected = -1;     // index d'équipe « en main », -1 si aucun
  let boxCursor = 0;
  let boxPage = 0;

  function buildTeamOverlay() {
    const ov = el('div', 'overlay hidden', hudRoot);
    ov.id = 'team-overlay';
    const frame = el('div', 'team-frame', ov);
    el('h2', null, frame, 'Ton équipe');
    ui.teamBadgeStrip = el('div', 'team-badges', frame);

    const body = el('div', 'team-body', frame);
    const left = el('div', 'team-left', body);
    ui.teamGrid = el('div', 'team-grid', left);
    const boxSection = el('div', 'team-box-section', left);
    const boxHead = el('div', 'box-head', boxSection);
    el('h3', null, boxHead, 'La Boîte');
    ui.boxCount = el('span', 'box-count', boxHead, '');
    ui.boxGrid = el('div', 'box-grid', boxSection);
    const pager = el('div', 'box-pager', boxSection);
    ui.boxPrev = el('button', null, pager, '◀ Page précédente');
    ui.boxPageLabel = el('span', null, pager, '');
    ui.boxNext = el('button', null, pager, 'Page suivante ▶');
    ui.boxPrev.type = 'button'; ui.boxNext.type = 'button';
    ui.boxPrev.addEventListener('click', function () { changeBoxPage(-1); });
    ui.boxNext.addEventListener('click', function () { changeBoxPage(1); });

    const right = el('div', 'team-detail', body);
    ui.teamDetailThumb = el('div', 'td-thumb', right);
    ui.teamDetailName = el('div', 'td-name', right, '');
    ui.teamDetailTypes = el('div', 'td-types', right);

    // Le bouton qui manquait : désigner la créature qui combat. Sans lui, la
    // seule façon de changer de compagnon était d'échanger deux emplacements,
    // ce que personne ne devine. Il est placé HAUT dans le panneau pour rester
    // visible sans avoir à faire défiler, même sur un écran peu haut.
    ui.teamActiveBtn = el('button', 'td-active', right, '⚔️ Envoyer au combat');
    ui.teamActiveBtn.type = 'button';
    ui.teamActiveBtn.addEventListener('click', function () {
      const api = TEAM();
      if (!api || teamZone !== 'team') return;
      const mon = api.team[teamCursor];
      if (!mon) return;
      if ((mon.hp | 0) <= 0) { toast('Elle est K.O. — soigne-la d\'abord !', '🚫'); return; }
      if (typeof api.setActive === 'function' && api.setActive(teamCursor)) {
        renderTeamScreen();
        toast((mon.nick || mon.id) + ' est ton nouveau compagnon !', '⚔️');
      }
    });

    ui.teamDetailStats = el('div', 'td-stats', right);
    ui.teamDetailMoves = el('div', 'td-moves', right);
    ui.teamToBoxBtn = el('button', 'td-tobox', right, '↓ Renvoyer à la Boîte');
    ui.teamToBoxBtn.type = 'button';
    ui.teamToBoxBtn.addEventListener('click', function () {
      const api = TEAM();
      if (api && teamSelected >= 0 && api.toBox(teamSelected)) {
        teamSelected = -1;
        renderTeamScreen();
        toast('Créature renvoyée à la Boîte', '📦');
      }
    });

    const teamHint = el('p', 'hint', frame);
    teamHint.innerHTML = 'Flèches : choisir &nbsp;·&nbsp; <strong>A</strong> : envoyer au combat' +
      ' &nbsp;·&nbsp; Espace : saisir/échanger &nbsp;·&nbsp; Échap : fermer';

    ov.addEventListener('click', function (ev) { if (ev.target === ov) closeTeam(); });
    ui.teamOverlay = ov;
  }

  function renderTeamBadgeStrip() {
    if (!ui.teamBadgeStrip) return;
    ui.teamBadgeStrip.innerHTML = '';
    if (!hudBadges.length) { hide(ui.teamBadgeStrip); return; }
    hudBadges.forEach(function (b) {
      const s = el('span', 'badge-pill', ui.teamBadgeStrip);
      s.style.setProperty('--badge-color', b.color || '#f1c40f');
      s.textContent = (b.icon || '🏅') + ' ' + (b.name || b.id);
      s.title = b.motto || '';
    });
    show(ui.teamBadgeStrip);
  }

  function openTeam() {
    if (!ui.teamOverlay) return;
    teamCursor = 0; teamZone = 'team'; teamSelected = -1; boxCursor = 0; boxPage = 0;
    renderTeamScreen();
    show(ui.teamOverlay);
    replayAnim(ui.teamOverlay, 'overlay');
    showCompass(false);      // un écran plein masque la boussole
  }

  function closeTeam() { hide(ui.teamOverlay); teamSelected = -1; showCompass(true); }

  function setTeamCursor(i) {
    const api = TEAM();
    const n = api ? api.team.length : 0;
    if (!n) return;
    teamCursor = clamp(i, 0, n - 1);
    teamZone = 'team';
    renderTeamScreen();
  }

  function teamSlotLabel(mon) {
    if (!mon) return null;
    const sp = TEAM() && typeof TEAM().speciesOf === 'function' ? TEAM().speciesOf(mon.id) : (DEX() && DEX().get(mon.id));
    return sp;
  }

  function renderTeamScreen() {
    const api = TEAM();
    if (!ui.teamGrid) return;
    renderTeamBadgeStrip();

    const team = api ? api.team : [];
    const activeIdx = (api && typeof api.activeIndex === 'number') ? api.activeIndex : 0;
    ui.teamGrid.innerHTML = '';
    ui.teamCells = [];
    for (let i = 0; i < TEAM_MAX(); i++) {
      const mon = team[i] || null;
      const sp = mon ? teamSlotLabel(mon) : null;
      const cell = el('div', 'team-slot' + (!mon ? ' empty' : ''), ui.teamGrid);
      if (mon) {
        cell.appendChild(thumbFor(sp, 68));
        el('div', 'ts-name', cell, mon.nick || (sp && sp.name) || mon.id);
        el('div', 'ts-level', cell, 'Nv ' + mon.level);
        const types = el('div', 'ts-types', cell);
        (mon.types || []).forEach(function (t) { types.appendChild(typeBadge(t, true)); });
        const bar = el('div', 'ts-hp', cell);
        const fill = el('div', 'ts-hp-fill', bar);
        const ratio = mon.maxHp ? Math.max(0, mon.hp) / mon.maxHp : 0;
        fill.style.width = (ratio * 100) + '%';
        fill.className = 'ts-hp-fill ' + hpClass(ratio);
        if ((mon.hp | 0) <= 0) el('div', 'ts-ko', cell, 'K.O.');
      } else {
        el('div', 'ts-empty-label', cell, 'Place libre');
      }
      if (i === activeIdx) el('div', 'ts-active-tag', cell, '⚔️ Au combat');
      cell.classList.toggle('active', i === activeIdx);
      cell.classList.toggle('cursor', teamZone === 'team' && i === teamCursor);
      cell.classList.toggle('held', i === teamSelected);
      cell.addEventListener('click', function () { teamZone = 'team'; teamCursor = i; onTeamSlotActivate(i); });
      // ⚠️ Surtout PAS de renderTeamScreen() ici : reconstruire la grille sous
      // le curseur détruit l'élément que la souris est en train de cliquer, et
      // le clic n'arrive jamais (mousedown et mouseup sur deux éléments
      // différents). C'est ce qui rendait l'écran Équipe inutilisable.
      cell.addEventListener('mouseenter', function () { moveTeamCursor('team', i); });
      ui.teamCells.push(cell);
    }

    renderBoxGrid();
    renderTeamDetail();
  }

  function TEAM_MAX() { const api = TEAM(); return (api && api.MAX_TEAM) || 6; }

  /**
   * Déplace le curseur SANS reconstruire la grille : on se contente de bouger
   * les classes et de rafraîchir le panneau de détail. C'est ce qui permet au
   * survol de la souris de ne pas casser le clic (voir le commentaire dans
   * `renderTeamScreen`).
   */
  function moveTeamCursor(zone, index) {
    teamZone = (zone === 'box') ? 'box' : 'team';
    if (teamZone === 'team') teamCursor = index; else boxCursor = index;
    if (ui.teamCells) {
      ui.teamCells.forEach(function (c, k) {
        c.classList.toggle('cursor', teamZone === 'team' && k === teamCursor);
      });
    }
    if (ui.boxCells) {
      ui.boxCells.forEach(function (c, k) {
        c.classList.toggle('cursor', teamZone === 'box' && k === boxCursor);
      });
    }
    renderTeamDetail();
  }

  function onTeamSlotActivate(i) {
    const api = TEAM();
    if (!api) return;
    if (!api.team[i]) { renderTeamScreen(); return; }   // place vide : rien à saisir
    if (teamSelected === -1) {
      teamSelected = i;
    } else if (teamSelected === i) {
      teamSelected = -1;   // on repose la même créature : annule
    } else {
      api.swap(teamSelected, i);
      teamSelected = -1;
    }
    renderTeamScreen();
  }

  function renderBoxGrid() {
    const api = TEAM();
    const box = api ? api.box : [];
    const totalPages = Math.max(1, Math.ceil(box.length / BOX_PAGE_SIZE));
    boxPage = clamp(boxPage, 0, totalPages - 1);
    ui.boxCount.textContent = box.length + ' créature' + (box.length === 1 ? '' : 's') + ' en réserve';
    ui.boxPageLabel.textContent = 'Page ' + (boxPage + 1) + ' / ' + totalPages;
    ui.boxPrev.disabled = boxPage <= 0;
    ui.boxNext.disabled = boxPage >= totalPages - 1;

    ui.boxGrid.innerHTML = '';
    ui.boxCells = [];
    const start = boxPage * BOX_PAGE_SIZE;
    const pageItems = box.slice(start, start + BOX_PAGE_SIZE);
    if (!pageItems.length) {
      el('p', 'box-empty', ui.boxGrid, 'La Boîte est vide pour le moment.');
      return;
    }
    pageItems.forEach(function (mon, localIndex) {
      const sp = teamSlotLabel(mon);
      const idx = start + localIndex;
      const cell = el('button', 'box-slot', ui.boxGrid);
      cell.type = 'button';
      cell.appendChild(thumbFor(sp, 44));
      el('div', 'bs-name', cell, mon.nick || (sp && sp.name) || mon.id);
      el('div', 'bs-level', cell, 'Nv ' + mon.level);
      cell.classList.toggle('cursor', teamZone === 'box' && localIndex === boxCursor);
      cell.addEventListener('click', function () { teamZone = 'box'; boxCursor = localIndex; onBoxSlotActivate(idx); });
      cell.addEventListener('mouseenter', function () { moveTeamCursor('box', localIndex); });
      ui.boxCells.push(cell);
      ui.boxGrid.appendChild(cell);
    });
  }

  function changeBoxPage(delta) {
    const api = TEAM();
    const totalPages = Math.max(1, Math.ceil((api ? api.box.length : 0) / BOX_PAGE_SIZE));
    boxPage = clamp(boxPage + delta, 0, totalPages - 1);
    boxCursor = 0;
    renderTeamScreen();
  }

  function onBoxSlotActivate(absoluteIndex) {
    const api = TEAM();
    if (!api) return;
    if (teamSelected >= 0) {
      if (api.toTeam(absoluteIndex, teamSelected)) toast('Échange effectué !', '🔄');
      teamSelected = -1;
    } else {
      toast('Choisis d’abord une place dans ton équipe.', 'ℹ️');
    }
    renderTeamScreen();
  }

  function renderTeamDetail() {
    const api = TEAM();
    if (!ui.teamDetailThumb) return;
    let mon = null, sp = null;
    if (teamZone === 'team' && api) mon = api.team[teamCursor] || null;
    else if (teamZone === 'box' && api) mon = api.box[boxPage * BOX_PAGE_SIZE + boxCursor] || null;
    if (mon) sp = teamSlotLabel(mon);

    ui.teamDetailThumb.innerHTML = '';
    if (!mon) {
      ui.teamDetailThumb.appendChild(mysteryThumb(3));
      ui.teamDetailName.textContent = 'Choisis une créature';
      ui.teamDetailTypes.innerHTML = '';
      ui.teamDetailStats.innerHTML = '';
      ui.teamDetailMoves.innerHTML = '';
      ui.teamToBoxBtn.disabled = true;
      if (ui.teamActiveBtn) { ui.teamActiveBtn.disabled = true; ui.teamActiveBtn.textContent = '⚔️ Envoyer au combat'; }
      return;
    }
    ui.teamDetailThumb.appendChild(thumbFor(sp, 116));
    ui.teamDetailName.textContent = (mon.nick || (sp && sp.name) || mon.id) + '  ·  Nv ' + mon.level;
    ui.teamDetailTypes.innerHTML = '';
    (mon.types || []).forEach(function (t) { ui.teamDetailTypes.appendChild(typeBadge(t)); });

    ui.teamDetailStats.innerHTML = '';
    [['PV', mon.hp + '/' + mon.maxHp], ['Attaque', mon.atk], ['Défense', mon.def], ['Vitesse', mon.speed]]
      .forEach(function (pair) {
        const row = el('div', 'td-stat-row', ui.teamDetailStats);
        el('span', null, row, pair[0]);
        el('span', null, row, String(pair[1]));
      });

    ui.teamDetailMoves.innerHTML = '';
    (mon.moves || []).forEach(function (slot) {
      const move = moveInfo(slot.id);
      const row = el('div', 'td-move-row', ui.teamDetailMoves);
      row.style.setProperty('--type-color', typeInfo(move.type).color);
      row.appendChild(typeBadge(move.type, true));
      el('span', 'tdm-name', row, move.name);
      el('span', 'tdm-pp', row, 'PP ' + slot.pp + '/' + slot.ppMax);
    });

    ui.teamToBoxBtn.disabled = !(teamZone === 'team' && api && api.team.length > 1);

    if (ui.teamActiveBtn) {
      const actif = (api && typeof api.activeIndex === 'number') ? api.activeIndex : 0;
      const dejaActif = (teamZone === 'team' && teamCursor === actif);
      const ko = (mon.hp | 0) <= 0;
      ui.teamActiveBtn.disabled = (teamZone !== 'team') || dejaActif || ko;
      ui.teamActiveBtn.textContent = dejaActif ? '⚔️ Déjà au combat'
        : (ko ? '💤 K.O. — impossible' : '⚔️ Envoyer au combat');
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation clavier de l'écran Équipe (grille 2D consciente des deux zones).
  // ---------------------------------------------------------------------------
  function teamHandleKey(ev) {
    const api = TEAM();
    if (!api) return false;
    const key = ev.key;
    if (key === 'Enter' || key === ' ') {
      if (teamZone === 'team') onTeamSlotActivate(teamCursor);
      else onBoxSlotActivate(boxPage * BOX_PAGE_SIZE + boxCursor);
      return true;
    }
    if (key === 'a' || key === 'A') {
      // Désigner la créature qui combat — même chose que le bouton du panneau.
      if (teamZone === 'team' && ui.teamActiveBtn && !ui.teamActiveBtn.disabled) ui.teamActiveBtn.click();
      return true;
    }
    if (key === 'Backspace' || key === 'Delete') {
      if (teamZone === 'team' && api.team.length > 1) { api.toBox(teamCursor); renderTeamScreen(); }
      return true;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(key) === -1) return false;

    if (teamZone === 'team') {
      const n = api.team.length || 1;
      let row = Math.floor(teamCursor / TEAM_COLS), col = teamCursor % TEAM_COLS;
      if (key === 'ArrowLeft') col = (col - 1 + TEAM_COLS) % TEAM_COLS;
      else if (key === 'ArrowRight') col = (col + 1) % TEAM_COLS;
      else if (key === 'ArrowUp') { if (row === 0) { teamZone = 'box'; boxCursor = Math.min(col, api.box.length - 1); renderTeamScreen(); return true; } row--; }
      else if (key === 'ArrowDown') {
        if (row >= Math.ceil(TEAM_MAX() / TEAM_COLS) - 1) { teamZone = 'box'; boxCursor = 0; renderTeamScreen(); return true; }
        row++;
      }
      teamCursor = clamp(row * TEAM_COLS + col, 0, TEAM_MAX() - 1);
    } else {
      const pageLen = Math.min(BOX_PAGE_SIZE, api.box.length - boxPage * BOX_PAGE_SIZE);
      if (pageLen <= 0) { teamZone = 'team'; renderTeamScreen(); return true; }
      let row = Math.floor(boxCursor / BOX_COLS), col = boxCursor % BOX_COLS;
      if (key === 'ArrowLeft') col = (col - 1 + BOX_COLS) % BOX_COLS;
      else if (key === 'ArrowRight') col = (col + 1) % BOX_COLS;
      else if (key === 'ArrowUp') { if (row === 0) { teamZone = 'team'; renderTeamScreen(); return true; } row--; }
      else if (key === 'ArrowDown') row++;
      boxCursor = clamp(row * BOX_COLS + col, 0, pageLen - 1);
    }
    renderTeamScreen();
    return true;
  }

  // ===========================================================================
  //  ÉCRAN POKÉDEX (touche C)
  // ===========================================================================

  let dexFilterType = null;   // null = tous les types
  let dexFilterRegion = null; // null = toutes les régions
  let dexSelected = null;     // id d'espèce affichée dans le détail

  function buildDexOverlay() {
    const ov = el('div', 'overlay hidden', hudRoot);
    ov.id = 'dex-overlay';
    const frame = el('div', 'dex-frame', ov);
    el('h2', null, frame, 'Pokédex');

    const filters = el('div', 'dex-filters', frame);
    ui.dexTypeRow = el('div', 'dex-type-row', filters);
    ui.dexRegionRow = el('div', 'dex-region-row', filters);

    const body = el('div', 'dex-body', frame);
    ui.dexGrid = el('div', 'dex-grid', body);
    const detail = el('div', 'dex-detail hidden', body);
    ui.dexDetail = detail;
    ui.dexDetailThumb = el('div', 'dd-thumb', detail);
    ui.dexDetailName = el('div', 'dd-name', detail);
    ui.dexDetailTypes = el('div', 'dd-types', detail);
    ui.dexDetailDesc = el('p', 'dd-desc', detail);
    ui.dexDetailMeta = el('div', 'dd-meta', detail);

    el('p', 'hint', frame, 'Clique une créature pour en savoir plus · C ou Échap : fermer');
    ov.addEventListener('click', function (ev) { if (ev.target === ov) closeDex(); });
    ui.dexOverlay = ov;
  }

  function dexTypePills() {
    ui.dexTypeRow.innerHTML = '';
    const all = el('button', 'dex-pill' + (dexFilterType === null ? ' on' : ''), ui.dexTypeRow, 'Tous');
    all.type = 'button';
    all.addEventListener('click', function () { setDexFilter(null); });
    typeOrder().forEach(function (id) {
      const t = typeInfo(id);
      const b = el('button', 'dex-pill' + (dexFilterType === id ? ' on' : ''), ui.dexTypeRow, t.icon + ' ' + t.label);
      b.type = 'button';
      b.style.setProperty('--type-color', t.color);
      b.addEventListener('click', function () { setDexFilter(id); });
    });
  }

  function dexRegionPills() {
    ui.dexRegionRow.innerHTML = '';
    const dex = DEX();
    const ids = (dex && dex.REGION_IDS) || REGION_ORDER;
    const all = el('button', 'dex-pill' + (dexFilterRegion === null ? ' on' : ''), ui.dexRegionRow, 'Toutes régions');
    all.type = 'button';
    all.addEventListener('click', function () { dexFilterRegion = null; renderDexGrid(); dexRegionPills(); });
    ids.forEach(function (id) {
      const b = el('button', 'dex-pill' + (dexFilterRegion === id ? ' on' : ''), ui.dexRegionRow, regionName(id));
      b.type = 'button';
      b.addEventListener('click', function () { dexFilterRegion = id; renderDexGrid(); dexRegionPills(); });
    });
  }

  function openDex() {
    if (!ui.dexOverlay) return;
    dexTypePills();
    dexRegionPills();
    renderDexGrid();
    show(ui.dexOverlay);
    replayAnim(ui.dexOverlay, 'overlay');
    showCompass(false);
  }

  function closeDex() { hide(ui.dexOverlay); showCompass(true); }

  function setDexFilter(type) {
    dexFilterType = type || null;
    dexTypePills();
    renderDexGrid();
  }

  function renderDexGrid() {
    if (!ui.dexGrid) return;
    const dex = DEX();
    ui.dexGrid.innerHTML = '';
    hide(ui.dexDetail);
    if (!dex || !Array.isArray(dex.ALL) || !dex.ALL.length) {
      el('p', 'hint', ui.dexGrid, 'Le Pokédex n’est pas encore disponible.');
      return;
    }
    const st = gameState();
    const seen = (st && st.seen) || {};
    const collection = (st && st.collection) || {};

    const list = dex.ALL.filter(function (sp) {
      if (dexFilterType && sp.types.indexOf(dexFilterType) === -1) return false;
      if (dexFilterRegion && sp.regions.indexOf(dexFilterRegion) === -1) return false;
      return true;
    });

    list.forEach(function (sp) {
      const known = !!seen[sp.id];
      const card = el('button', 'dex-card' + (known ? '' : ' unknown') + (sp.legendary ? ' legendary' : ''), ui.dexGrid);
      card.type = 'button';
      card.appendChild(known ? thumbFor(sp, 72) : resizedCanvas(mysteryThumb(3), 72));
      el('div', 'dex-card-name', card, known ? sp.name : '???');
      if (known) {
        const types = el('div', 'dex-card-types', card);
        sp.types.forEach(function (t) { types.appendChild(typeBadge(t, true)); });
        const count = collection[sp.id] || 0;
        if (count > 0) el('div', 'dex-card-count', card, '×' + count);
      }
      card.addEventListener('click', function () {
        if (!known) { toast('Tu ne l’as pas encore rencontrée !', '❔'); return; }
        showDexDetail(sp);
      });
      card.title = known ? sp.name : 'Créature pas encore rencontrée';
    });
  }

  function showDexDetail(sp) {
    dexSelected = sp.id;
    ui.dexDetailThumb.innerHTML = '';
    ui.dexDetailThumb.appendChild(thumbFor(sp, 132));
    ui.dexDetailName.textContent = sp.name + (sp.legendary ? '  ✨' : '');
    ui.dexDetailTypes.innerHTML = '';
    sp.types.forEach(function (t) { ui.dexDetailTypes.appendChild(typeBadge(t)); });
    ui.dexDetailDesc.textContent = sp.description || '';
    ui.dexDetailMeta.innerHTML = '';
    const rows = [
      ['Régions', sp.regions.map(regionName).join(', ')],
      ['Niveaux', sp.minLevel + ' à ' + sp.maxLevel],
      ['PV de base', sp.baseHp], ['Attaque', sp.atk], ['Défense', sp.def], ['Vitesse', sp.speed],
    ];
    rows.forEach(function (pair) {
      const row = el('div', 'dd-meta-row', ui.dexDetailMeta);
      el('span', null, row, pair[0]);
      el('span', null, row, String(pair[1]));
    });
    show(ui.dexDetail);
  }

  // ===========================================================================
  //  ÉCRAN CARTE (touche N) — mode région / mode monde
  // ===========================================================================

  let mapMode = 'region';

  function buildMapOverlay() {
    const ov = el('div', 'overlay hidden', hudRoot);
    ov.id = 'map-overlay';
    const frame = el('div', 'map-frame', ov);
    const head = el('div', 'map-head', frame);
    ui.mapTitle = el('h2', null, head, 'Carte de la région');
    const tabs = el('div', 'map-mode-tabs', head);
    ui.mapTabRegion = el('button', null, tabs, 'Région');
    ui.mapTabWorld = el('button', null, tabs, 'Monde');
    ui.mapTabRegion.type = 'button'; ui.mapTabWorld.type = 'button';
    ui.mapTabRegion.addEventListener('click', function () { setMapMode('region'); });
    ui.mapTabWorld.addEventListener('click', function () { setMapMode('world'); });

    // --- mode région ---
    const regionView = el('div', 'map-region-view', frame);
    const wrap = el('div', 'map-canvas-wrap', regionView);
    ui.mapCanvas = el('canvas', null, wrap);
    ui.mapCanvas.width = 768; ui.mapCanvas.height = 448;
    ui.mapOverlayMarkers = el('div', 'map-markers', wrap);
    ui.mapCtx = ui.mapCanvas.getContext('2d');
    const legend = el('div', 'map-legend', regionView);
    [['#e74c3c', 'Toi'], ['#f1c40f', 'Porte'], ['#a5aab0', 'Ville'], ['#ff6b3d', 'Arène'], ['#41a6f6', 'Port aérien']]
      .forEach(function (item) {
        const s = el('span', null, legend);
        el('i', null, s).style.background = item[0];
        s.appendChild(document.createTextNode(item[1]));
      });
    ui.mapRegionView = regionView;

    // --- mode monde ---
    const worldView = el('div', 'map-world-view hidden', frame);
    ui.mapWorldGrid = el('div', 'world-grid-wrap', worldView);
    ui.mapWorldView = worldView;

    el('p', 'hint', frame, 'N · Espace · Échap : fermer la carte');
    ov.addEventListener('click', function (ev) { if (ev.target === ov) closeMap(); });
    ui.mapOverlay = ov;
  }

  function setMapMode(mode) {
    mapMode = (mode === 'world') ? 'world' : 'region';
    ui.mapTabRegion.classList.toggle('on', mapMode === 'region');
    ui.mapTabWorld.classList.toggle('on', mapMode === 'world');
    ui.mapTitle.textContent = mapMode === 'world' ? 'Carte du monde' : 'Carte de la région';
    show(mapMode === 'region' ? ui.mapRegionView : ui.mapWorldView);
    hide(mapMode === 'region' ? ui.mapWorldView : ui.mapRegionView);
    if (mapMode === 'world') renderWorldMap(); else drawRegionMap();
  }

  function openMap() {
    if (!ui.mapOverlay) return;
    setMapMode(mapMode);
    show(ui.mapOverlay);
    replayAnim(ui.mapOverlay, 'overlay');
    if (!mapRaf) mapRaf = requestAnimationFrame(mapLoop);
    showCompass(false);
  }

  function closeMap() {
    if (!ui.mapOverlay) return;
    hide(ui.mapOverlay);
    if (mapRaf) { cancelAnimationFrame(mapRaf); mapRaf = 0; }
    showCompass(true);
  }

  function mapLoop() {
    if (!ui.mapOverlay || ui.mapOverlay.classList.contains('hidden')) { mapRaf = 0; return; }
    if (mapMode === 'region') drawRegionMap();
    mapRaf = requestAnimationFrame(mapLoop);
  }

  function drawRegionMap() {
    const c = ui.mapCtx;
    if (!c) return;
    const R = REGIONS();
    const st = gameState();
    const regionId = (R && typeof R.activeId === 'function' && R.activeId()) || (st && st.regionId) || 'val';
    const W = (R && R.W) || 384, H = (R && R.H) || 224;

    c.fillStyle = '#0a0c18';
    c.fillRect(0, 0, ui.mapCanvas.width, ui.mapCanvas.height);
    let drawn = false;
    if (R && typeof R.minimap === 'function') {
      try { R.minimap(regionId, ui.mapCanvas); drawn = true; }
      catch (e) { console.warn('[hud3d] regions.minimap() en échec :', e); }
    }
    if (!drawn) {
      c.fillStyle = '#1b2036';
      c.fillRect(0, 0, ui.mapCanvas.width, ui.mapCanvas.height);
      c.fillStyle = '#5b6c8c';
      c.font = 'bold 22px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText('Carte de ' + regionName(regionId) + ' bientôt disponible', ui.mapCanvas.width / 2, ui.mapCanvas.height / 2);
    }

    // Marqueurs HTML par-dessus le canvas, positionnés en pourcentage.
    ui.mapOverlayMarkers.innerHTML = '';
    const def = (R && typeof R.active === 'function') ? R.active() : null;
    const addMarker = function (x, y, cls, icon, label) {
      const m = el('div', 'map-marker ' + cls, ui.mapOverlayMarkers);
      m.style.left = (x / W * 100) + '%';
      m.style.top = (y / H * 100) + '%';
      m.textContent = icon;
      if (label) m.title = label;
    };

    if (def && Array.isArray(def.gates)) {
      def.gates.forEach(function (g) { addMarker(g.x, g.y, 'gate', '🚪', g.label || ('Vers ' + regionName(g.toRegion))); });
    }
    try {
      const cities = CITIES();
      const plan = cities && typeof cities.plan === 'function' ? cities.plan(regionId) : null;
      if (plan) {
        if (plan.arena) addMarker(plan.arena.x, plan.arena.y, 'arena', '⚔️', 'Arène');
        if (plan.castle) addMarker(plan.castle.x, plan.castle.y, 'city', '🏰', plan.name || 'Ville');
      }
    } catch (e) { /* dégradation silencieuse */ }
    try {
      const airship = AIRSHIP();
      const port = airship && typeof airship.portOf === 'function' ? airship.portOf(regionId) : null;
      if (port && typeof port.x === 'number') addMarker(port.x, port.y, 'port', '⚓', port.name || 'Port aérien');
    } catch (e) { /* dégradation silencieuse */ }

    const px = (st && (st.tileX !== undefined ? st.tileX : (st.player && st.player.tileX)));
    const py = (st && (st.tileY !== undefined ? st.tileY : (st.player && st.player.tileY)));
    if (typeof px === 'number' && typeof py === 'number') {
      const blink = (Math.floor(now() * 2.6) % 2) === 0;
      addMarker(px, py, 'player' + (blink ? ' blink' : ''), '📍', 'Toi');
    }
  }

  function worldRegionStates() {
    const st = gameState();
    const R = REGIONS();
    const visited = (st && st.visitedRegions) || {};
    const currentId = (R && typeof R.activeId === 'function' && R.activeId()) || (st && st.regionId) || 'val';
    const out = {};
    Object.keys(WORLD_GRID).forEach(function (id) {
      out[id] = {
        current: id === currentId,
        visited: !!visited[id] || id === 'val',
        label: regionName(id),
        icon: '📍',
      };
    });
    return out;
  }

  function renderWorldMap() {
    if (!ui.mapWorldGrid) return;
    const states = worldRegionStates();
    buildWorldGrid(ui.mapWorldGrid, states, function (id, st) {
      toast(st.label + (st.current ? ' — tu y es !' : (st.visited ? ' — déjà explorée' : ' — pas encore explorée')), '🗺️');
    });
  }

  /** Grille des 6 régions, réutilisée par la carte du monde ET le menu du
   *  dirigeable : liaisons en SVG + pastilles HTML positionnées en %. */
  function buildWorldGrid(container, states, onClick) {
    container.innerHTML = '';
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'world-links');
    WORLD_LINKS.forEach(function (pair) {
      const a = WORLD_GRID[pair[0]], b = WORLD_GRID[pair[1]];
      if (!a || !b) return;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      const sa = states && states[pair[0]], sb = states && states[pair[1]];
      const seenLink = sa && sb && sa.visited && sb.visited;
      line.setAttribute('class', 'world-link' + (seenLink ? ' seen' : ''));
      svg.appendChild(line);
    });
    container.appendChild(svg);

    const nodes = [];
    Object.keys(WORLD_GRID).forEach(function (id) {
      const pos = WORLD_GRID[id];
      const st = (states && states[id]) || {};
      const btn = el('button', 'world-node' +
        (st.current ? ' current' : '') + (st.disabled ? ' locked' : '') + (st.visited ? ' visited' : ''), container);
      btn.type = 'button';
      btn.style.left = pos.x + '%';
      btn.style.top = pos.y + '%';
      el('span', 'wn-dot', btn, st.icon || '📍');
      el('span', 'wn-label', btn, st.label || regionName(id));
      if (st.sub) el('span', 'wn-sub', btn, st.sub);
      if (st.disabled) btn.disabled = true;
      btn.addEventListener('click', function () { if (onClick) onClick(id, st); });
      nodes.push({ id: id, btn: btn, state: st });
    });
    return nodes;
  }

  // ===========================================================================
  //  MENU DU DIRIGEABLE (§17 bis) — voyage rapide entre les 6 ports aériens
  // ===========================================================================

  function buildAirshipOverlay() {
    const ov = el('div', 'overlay hidden', hudRoot);
    ov.id = 'airship-overlay';
    const frame = el('div', 'airship-frame', ov);
    el('h2', null, frame, '🎈 Voyager en dirigeable');
    ui.airshipGrid = el('div', 'world-grid-wrap', frame);
    el('p', 'hint', frame, 'Choisis une région déjà explorée à pied · Échap : annuler');
    const cancel = el('button', null, frame, 'Annuler');
    cancel.type = 'button';
    cancel.addEventListener('click', closeAirshipMenu);
    ov.addEventListener('click', function (ev) { if (ev.target === ov) closeAirshipMenu(); });
    ui.airshipOverlay = ov;
  }

  /**
   * Écran de choix du dirigeable (§17 bis).
   * @param {Array|Object} ports    de préférence airship.travelOptions(current, visited)
   *                                — mais accepte aussi la table brute PORTS.
   * @param {string} current        id de région courante
   * @param {function} onChoose     onChoose(regionId) — appelé au clic sur un port débloqué
   */
  function openAirshipMenu(ports, current, onChoose) {
    if (!ui.airshipOverlay) return;
    const st = gameState();
    const visited = (st && st.visitedRegions) || {};
    const list = normalizePorts(ports, current, visited);

    const states = {};
    list.forEach(function (p) {
      const vu = (p.visited !== undefined) ? !!p.visited : !!visited[p.regionId];
      states[p.regionId] = {
        current: p.current, visited: vu, disabled: !p.enabled && !p.current,
        label: p.region || regionName(p.regionId),
        sub: p.current ? 'Tu y es'
          : (p.enabled ? (vu ? p.name : (p.reason || 'Région à découvrir'))
            : (p.reason || 'À découvrir à pied')),
        icon: p.current ? '🎈' : (p.enabled ? (vu ? '⚓' : '✨') : '🔒'),
      };
    });
    airshipNodes = buildWorldGrid(ui.airshipGrid, states, function (id, s) {
      if (s.current) { toast('Tu es déjà ici !', '🎈'); return; }
      if (s.disabled) { toast('Il faut y être allé à pied avant !', '🚶'); return; }
      closeAirshipMenu();
      if (onChoose) onChoose(id);
    });
    // Curseur posé d'emblée sur la première destination atteignable.
    let start = 0;
    for (let i = 0; i < airshipNodes.length; i++) {
      if (selectableNode(airshipNodes[i])) { start = i; break; }
    }
    setAirshipCursor(start);

    show(ui.airshipOverlay);
    replayAnim(ui.airshipOverlay, 'overlay');
    showCompass(false);
  }

  // --- pilotage au CLAVIER du menu du dirigeable -----------------------------
  // Sans ça, le menu ne répondait qu'à la souris : ni Échap pour sortir, ni
  // flèches pour choisir — on pouvait s'y retrouver coincé.
  let airshipNodes = [];
  let airshipCursor = 0;

  function airshipCount() { return airshipNodes.length; }

  function selectableNode(n) {
    return !!(n && n.btn && !n.btn.disabled && !(n.state && n.state.current));
  }

  /** Déplace le curseur d'un cran, en sautant les régions non atteignables. */
  function moveAirshipCursor(delta) {
    const n = airshipNodes.length;
    if (!n) return;
    const d = (delta < 0) ? -1 : 1;
    let i = airshipCursor;
    for (let k = 0; k < n; k++) {
      i = ((i + d) % n + n) % n;
      if (selectableNode(airshipNodes[i])) break;
    }
    setAirshipCursor(i);
  }

  function setAirshipCursor(i) {
    if (!airshipNodes.length) return;
    airshipCursor = ((i % airshipNodes.length) + airshipNodes.length) % airshipNodes.length;
    for (let k = 0; k < airshipNodes.length; k++) {
      airshipNodes[k].btn.classList.toggle('focus', k === airshipCursor);
    }
    const n = airshipNodes[airshipCursor];
    if (n && n.btn && n.btn.scrollIntoView) {
      try { n.btn.scrollIntoView({ block: 'nearest' }); } catch (e) { /* vieux navigateur */ }
    }
  }

  /** Valide la destination sous le curseur (Espace / Entrée). */
  function confirmAirship() {
    const n = airshipNodes[airshipCursor];
    if (!n || !n.btn) return false;
    n.btn.click();
    return true;
  }

  function normalizePorts(ports, current, visited) {
    if (Array.isArray(ports) && ports.length && ports[0] && ports[0].regionId) return ports;
    // Table brute { regionId: {x,y,name} } (AIRSHIP().PORTS) : on reconstruit
    // la même forme que travelOptions() pour rester cohérent.
    const ids = (ports && typeof ports === 'object') ? Object.keys(ports) : REGION_ORDER;
    return ids.map(function (id) {
      const p = (ports && ports[id]) || {};
      const enabled = id === current || !!visited[id];
      return {
        regionId: id, region: regionName(id), name: p.name || regionName(id),
        current: id === current, enabled: enabled,
        reason: enabled ? null : 'À découvrir à pied',
      };
    });
  }

  function closeAirshipMenu() { hide(ui.airshipOverlay); showCompass(true); }

  // ===========================================================================
  //  COLLECTION  (ids historiques conservés : #collection-overlay/-grid)
  // ===========================================================================

  function openCollection(collection) {
    const grid = $('collection-grid');
    const overlay = $('collection-overlay');
    if (!grid || !overlay) return;

    const st = gameState();
    const col = collection || (st && st.collection) || {};
    const dex = DEX();
    const list = dex && Array.isArray(dex.ALL) ? dex.ALL
      : (typeof CREATURES !== 'undefined' ? CREATURES : []);

    grid.innerHTML = '';
    let uniques = 0, total = 0;

    list.forEach(function (cr) {
      const count = col[cr.id] || 0;
      if (count > 0) { uniques++; total += count; }
      const card = el('div', 'creature-card' + (count === 0 ? ' unknown' : ''), grid);
      card.appendChild(count > 0 ? thumbFor(cr, 72) : resizedCanvas(mysteryThumb(3), 72));
      el('div', 'creature-name', card, count > 0 ? cr.name : '???');
      el('div', 'creature-count', card, count > 0 ? ('×' + count) : 'Pas encore vue');
      if (count > 0 && cr.description) card.title = cr.description;
    });

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
  //  CHOIX DU COMPAGNON DE DÉPART  (ids historiques conservés)
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
    const dex = DEX();
    const list = dex && Array.isArray(dex.ALL) ? dex.ALL
      : (typeof CREATURES !== 'undefined' ? CREATURES : []);

    grid.innerHTML = '';
    opts.forEach(function (opt, i) {
      const card = el('div', 'starter-card clickable' + (i === 0 ? ' selected' : ''), grid);
      card.id = 'starter-card-' + i;
      card.style.animationDelay = (i * 0.08) + 's';

      const cr = opt.id ? list.find(function (c) { return c.id === opt.id; }) : null;
      card.appendChild(cr ? thumbFor(cr, 116) : resizedCanvas(mysteryThumb(4), 116));
      el('div', 'starter-name', card, cr ? cr.name : '???');
      el('div', 'starter-type', card, opt.label || '');

      card.addEventListener('mouseenter', function () { setStarterCursor(i); });
      card.addEventListener('click', function () {
        setStarterCursor(i);
        if (starterHandler) starterHandler(i, opt);
        else fakeKey(' ');
      });
    });
  }

  function setStarterCursor(i) {
    const cards = document.querySelectorAll('#starter-grid .starter-card');
    for (let k = 0; k < cards.length; k++) cards[k].classList.toggle('selected', k === (i | 0));
    const st = gameState();
    if (st) st.starterCursor = i | 0;
  }

  function onStarterPick(fn) { starterHandler = fn; }

  // ===========================================================================
  //  DIVERS : FPS, toasts, bouton muet, astuce de commandes
  // ===========================================================================

  function toast(text, icon) {
    if (!ui.toasts) return;
    const t = el('div', 'toast', ui.toasts);
    if (icon) el('span', 'toast-icon', t, icon);
    t.appendChild(document.createTextNode(String(text)));
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2700);
    while (ui.toasts.children.length > 3) ui.toasts.removeChild(ui.toasts.firstChild);
  }

  function setFps(v) {
    const e = $('fps-counter');
    if (!e || !fpsVisible) return;
    e.textContent = (typeof v === 'number') ? (Math.round(v) + ' fps') : String(v);
  }

  function setFpsVisible(v) {
    fpsVisible = !!v;
    const e = $('fps-counter');
    if (e) e.classList.toggle('hidden', !fpsVisible);
  }

  function toggleFps() { setFpsVisible(!fpsVisible); }

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

  function showQualityPicker(v) {
    if (ui.qualityPicker) ui.qualityPicker.classList.toggle('hidden', !v);
  }

  // ===========================================================================
  //  CLAVIER GLOBAL — navigation à l'intérieur des écrans HUD ouverts.
  //  On capture (phase de capture) pour avoir une chance raisonnable de
  //  s'exécuter avant le contrôleur de jeu, et on stoppe la propagation des
  //  touches qu'on consomme pour éviter, par exemple, que le joueur avance
  //  dans le monde pendant que l'écran Équipe est ouvert.
  // ===========================================================================

  function onGlobalKeydown(ev) {
    const key = ev.key;

    if (ui.teamOverlay && !ui.teamOverlay.classList.contains('hidden')) {
      if (key === 'Escape') { closeTeam(); fakeKey('Escape'); return; }
      if (teamHandleKey(ev)) { ev.preventDefault(); ev.stopPropagation(); return; }
      return;
    }
    if (ui.dexOverlay && !ui.dexOverlay.classList.contains('hidden')) {
      if (key === 'Escape') { closeDex(); fakeKey('Escape'); }
      return;
    }
    if (ui.mapOverlay && !ui.mapOverlay.classList.contains('hidden')) {
      if (key === 'Escape' || key === ' ') { closeMap(); fakeKey('Escape'); }
      return;
    }
    if (ui.airshipOverlay && !ui.airshipOverlay.classList.contains('hidden')) {
      if (key === 'Escape') closeAirshipMenu();
      return;
    }
  }

  // ===========================================================================
  //  ENREGISTREMENT — R3.register('hud', api), signature exacte du §18,
  //  plus les extensions documentées (compatibilité avec l'existant).
  // ===========================================================================

  const api = {
    init: init,

    // dialogue et bandeaux
    showMessage: showMessage,
    hideMessage: hideMessage,
    setBiomeBanner: setBiomeBanner,
    setRegionBanner: setRegionBanner,
    toast: toast,
    setFps: setFps,
    showQualityPicker: showQualityPicker,

    // combat
    showBattleUI: showBattleUI,
    hideBattleUI: hideBattleUI,
    setHP: setHP,
    showMainMenu: showMainMenu,
    setMenuCursor: setMenuCursor,
    showMoveMenu: showMoveMenu,
    hideMoveMenu: hideMoveMenu,
    setMoveCursor: setMoveCursor,
    showMonMenu: showMonMenu,
    hideMonMenu: hideMonMenu,
    setMonCursor: setMonCursor,
    showBagMenu: showBagMenu,
    hideBagMenu: hideBagMenu,
    setBagCursor: setBagCursor,
    setBattleLog: setBattleLog,

    // hors combat
    openTeam: openTeam,
    closeTeam: closeTeam,
    setTeamCursor: setTeamCursor,
    openDex: openDex,
    closeDex: closeDex,
    setDexFilter: setDexFilter,
    openMap: openMap,
    closeMap: closeMap,
    setMapMode: setMapMode,
    setBadges: setBadges,
    setItems: setItems,
    setCollectionCount: setCollectionCount,
    showAimReticle: showAimReticle,
    showBallCount: showBallCount,

    // dirigeable (§17 bis)
    openAirshipMenu: openAirshipMenu,
    closeAirshipMenu: closeAirshipMenu,
    setAirshipCursor: setAirshipCursor,
    moveAirshipCursor: moveAirshipCursor,
    confirmAirship: confirmAirship,
    airshipCount: airshipCount,

    // boussole permanente et vue courante
    setCompass: setCompass,
    showCompass: showCompass,
    setViewMode: setViewMode,

    // --- extensions hors contrat, conservées pour la compatibilité et pour
    //     que les écrans titre / starter / collection restent fonctionnels ---
    hideHP: hideHP,
    setInBattle: setInBattle,
    onMoveChosen: onMoveChosen,
    openCollection: openCollection,
    closeCollection: closeCollection,
    buildStarterCards: buildStarterCards,
    setStarterCursor: setStarterCursor,
    onStarterPick: onStarterPick,
    setFpsVisible: setFpsVisible,
    toggleFps: toggleFps,
    setMuted: setMuted,
    showMuteButton: showMuteButton,
    showControlsHint: showControlsHint,
    showCollectionCount: showCollectionCount,
    creatureThumb: creatureThumb,
    thumbFor: thumbFor,
    ui: ui,
  };

  if (R3ref && typeof R3ref.register === 'function') R3ref.register('hud', api);
  window.HUD3D = api;   // filet de sécurité si R3 manquait

  // On initialise dès que le DOM est prêt : game3d.js peut appeler init() une
  // seconde fois sans dommage (la fonction est idempotente).
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();
