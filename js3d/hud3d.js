// =============================================================================
//  hud3d.js — INTERFACE de la version 3D du « Jeu de Robin »
//             (CONTRAT2 §18, complété par CONTRAT3 §11)
// =============================================================================
//  Tout ce qui n'est pas de la 3D vit ici : boîte de dialogue, bandeaux de
//  biome/région, équipe, Pokédex, carte (région + monde), combat (menus,
//  barres de PV, sac, capacités), menu du dirigeable, viseur de Pokéball,
//  collection, choix du compagnon, toasts, sélecteur de qualité.
//
//  Ajouts de la vague « Dresseur complet » (CONTRAT3 §11) :
//   · LA BOÎTE — valider une créature de la Boîte l'envoie DIRECTEMENT dans
//     l'équipe s'il reste de la place (demande n°1, la priorité absolue) ;
//   · le SÉLECTEUR DE BALL permanent, touche X ou clic (demande n°9) ;
//   · l'ARGENT, la BOUTIQUE du Centre, le JOURNAL des légendes (touche J),
//     l'écran d'ÉVOLUTION, l'ACADÉMIE du type Téra et le bouton TÉRA du
//     menu de combat.
//
//  Le HUD n'a JAMAIS de règle de jeu à lui : il affiche ce qu'on lui donne et
//  rappelle les callbacks. L'argent est à shop3d, les quêtes à quest3d, la
//  Téracristallisation à tera3d, la vérité de la Ball active à game3d.
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
  function QUEST() { return R3ref.get('quest'); }

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

  //  Table de repli alignée sur les 19 types de CONTRAT3 §2. Elle n'est utilisée
  //  QUE si types3d.js manque : dans ce cas, le HUD doit tout de même savoir
  //  colorier une pastille et remplir le filtre du Pokédex.
  const TYPE_FALLBACK = {
    feu: { id: 'feu', label: 'Feu', color: '#ff6b3d', icon: '🔥' },
    eau: { id: 'eau', label: 'Eau', color: '#41a6f6', icon: '💧' },
    plante: { id: 'plante', label: 'Plante', color: '#38b764', icon: '🌿' },
    electrique: { id: 'electrique', label: 'Électrique', color: '#f1c40f', icon: '⚡' },
    glace: { id: 'glace', label: 'Glace', color: '#a8e6ff', icon: '❄️' },
    air: { id: 'air', label: 'Air', color: '#bfe3f2', icon: '💨' },
    terre: { id: 'terre', label: 'Terre', color: '#c08c4a', icon: '🍂' },
    roche: { id: 'roche', label: 'Roche', color: '#9aa0a6', icon: '🪨' },
    lumiere: { id: 'lumiere', label: 'Lumière', color: '#ffe066', icon: '✨' },
    spectre: { id: 'spectre', label: 'Spectre', color: '#7a5cbf', icon: '👻' },
    temps: { id: 'temps', label: 'Temps', color: '#d896ff', icon: '⏳' },
    espace: { id: 'espace', label: 'Espace', color: '#4b62d9', icon: '🌌' },
    psy: { id: 'psy', label: 'Psy', color: '#ff6b9d', icon: '🔮' },
    fee: { id: 'fee', label: 'Fée', color: '#ffb3d9', icon: '🧚' },
    acier: { id: 'acier', label: 'Acier', color: '#b8c4d0', icon: '⚙️' },
    dragon: { id: 'dragon', label: 'Dragon', color: '#6a4fd8', icon: '🐉' },
    poison: { id: 'poison', label: 'Poison', color: '#b45cd8', icon: '☠️' },
    combat: { id: 'combat', label: 'Combat', color: '#e8622c', icon: '🥊' },
    normal: { id: 'normal', label: 'Normal', color: '#d8d0c4', icon: '◻️' },
  };
  const TYPE_ORDER_FALLBACK = ['feu', 'eau', 'plante', 'electrique', 'glace', 'air',
    'terre', 'roche', 'lumiere', 'spectre', 'temps', 'espace', 'psy', 'fee',
    'acier', 'dragon', 'poison', 'combat', 'normal'];
  // Les anciens ids traînent encore dans dex3d, moves3d et les sauvegardes :
  // même sans types3d, le HUD doit les afficher comme les nouveaux.
  const TYPE_ALIAS_FALLBACK = { foudre: 'electrique', ombre: 'spectre' };
  // « Normal » est désormais un VRAI type : le repli change de nom pour qu'on ne
  // voie jamais deux choses différentes sous le même mot (CONTRAT3 §2.3).
  const NEUTRAL_TYPE = { id: null, label: 'Neutre', color: '#94b0c2', icon: '◇' };

  /** Ramène un ancien id de type sur son id canonique (repli sans types3d). */
  function typeNormalize(id) {
    const api = TYPES();
    if (api && typeof api.normalize === 'function') {
      try { return api.normalize(id); } catch (e) { /* repli ci-dessous */ }
    }
    if (!id) return null;
    return TYPE_ALIAS_FALLBACK[id] || id;
  }

  function typeInfo(id) {
    const api = TYPES();
    if (api && typeof api.get === 'function') {
      const t = api.get(id);
      if (t) return t;
    }
    return TYPE_FALLBACK[typeNormalize(id)] || NEUTRAL_TYPE;
  }

  function typeOrder() {
    const api = TYPES();
    return (api && Array.isArray(api.ORDER)) ? api.ORDER : TYPE_ORDER_FALLBACK;
  }

  /**
   * « Cette liste de types contient-elle ce type ? », en tenant compte des
   * renommages. INDISPENSABLE : les espèces de dex3d portent encore `foudre` et
   * `ombre` alors que les filtres viennent de ORDER, qui dit `electrique` et
   * `spectre`. Un simple indexOf ne trouvait donc jamais rien.
   */
  function typeMatches(list, id) {
    const api = TYPES();
    if (api && typeof api.hasType === 'function') {
      try { return !!api.hasType(list, id); } catch (e) { /* repli ci-dessous */ }
    }
    if (!Array.isArray(list)) return false;
    const want = typeNormalize(id);
    for (let i = 0; i < list.length; i++) {
      if (typeNormalize(list[i]) === want) return true;
    }
    return false;
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
    // Les 36 légendaires ET les 29 formes évoluées n'ont pas de dessin 2D :
    // dès qu'il n'y a pas de `draw`, on tente le rendu 3D hors écran. Le cache
    // garde aussi les échecs, donc une espèce sans modèle n'est essayée qu'une
    // fois avant de retomber sur la pastille de type.
    const cv3d = creature3DThumb(species);
    if (cv3d) return resizedCanvas(cv3d, px);
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
    buildHelpOverlay();
    buildShopOverlay();
    buildJournalOverlay();
    buildAcademyOverlay();
    buildEvolutionOverlay();
    buildLearnOverlay();
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

  /**
   * DEMANDE N°9 DE ROBIN — le sélecteur de Ball.
   * Il remplace l'ancien compteur muet : on y voit la Ball active, son nom et
   * ce qu'il en reste, et un clic (ou la touche X) passe à la suivante.
   */
  function buildBallCount() {
    const b = el('button', 'ball-picker hidden', hudRoot);
    b.type = 'button';
    ui.ballIcon = el('span', 'bp-icon', b, '🔴');
    const body = el('span', 'bp-body', b);
    ui.ballName = el('span', 'bp-name', body, 'Pokéball');
    el('span', 'bp-key', body, 'X pour changer');
    ui.ballNum = el('span', 'bp-qty', b, '×0');
    b.addEventListener('click', function () { cycleBall(1); b.blur(); });
    ui.ballCount = b;

    // L'argent, discret, juste en dessous : Robin doit savoir s'il peut
    // s'offrir une Super Ball avant d'entrer au Centre.
    const m = el('div', 'money-count hidden', hudRoot);
    el('span', 'mc-icon', m, '🪙');
    ui.moneyNum = el('span', 'mc-num', m, '0');
    m.title = 'Ton argent';
    ui.moneyCount = m;
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
    // L'OBJECTIF DU MOMENT, toujours sous les yeux. `quest3d.hint()` produisait
    // déjà cette phrase, mais elle ne s'affichait QUE dans le journal (touche J) :
    // un enfant qui reprend sa partie trois jours plus tard ne savait plus quoi
    // faire, et ne pensait pas à ouvrir le journal.
    ui.compassQuest = el('div', 'cp-quest hidden', p, '');
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

    // --- la ligne « ce que je dois faire maintenant » -------------------------
    if (ui.compassQuest) {
      const objectif = (typeof info.quest === 'string') ? info.quest.trim() : '';
      if (objectif) {
        ui.compassQuest.textContent = '🎯 ' + objectif;
        show(ui.compassQuest);
      } else {
        ui.compassQuest.textContent = '';
        hide(ui.compassQuest);
      }
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
    // Le Pokédex FAIT AUTORITÉ sur le total : evolve3d y greffe ses 29 formes
    // évoluées après coup, et `dex.count` passe alors de 62 à 91. Un total figé
    // passé par l'appelant afficherait « /62 » pour toujours.
    const vrai = (dex && dex.count) | 0;
    const t = vrai || total || (typeof CREATURES !== 'undefined' ? CREATURES.length : 26);
    ui.countNum.textContent = (n | 0) + '/' + t;
    ui.count.title = (n | 0) + ' créature(s) différente(s) sur ' + t;
    if (lastUniques >= 0 && n > lastUniques) replayAnim(ui.count, 'pop');
    lastUniques = n | 0;
  }

  function showCollectionCount(v) { if (ui.count) ui.count.classList.toggle('hidden', !v); }

  // ===========================================================================
  //  SÉLECTEUR DE BALL (CONTRAT3 §11.2 — demande n°9)
  // ---------------------------------------------------------------------------
  //  Les bonus des quatre Balls existaient depuis le début (BALL_BONUS dans
  //  game3d.js) mais rien ne permettait de choisir. Ici : la Ball active est
  //  toujours à l'écran, on en change par clic ou par la touche X, et les Balls
  //  dont il ne reste rien sont sautées.
  //
  //  La VÉRITÉ appartient à game3d.js (`state.activeBall`) : quand le joueur
  //  change de Ball ici, on écrit dans l'état, on prévient window.GAME3D si
  //  la fonction existe, et on appelle le callback posé par onBallChange().
  // ===========================================================================

  const BALL_ORDER_FALLBACK = ['pokeball', 'superball', 'hyperball', 'ballmaitresse'];
  let ballInventory = null;      // {id: qty} — posé par setBallInventory()
  let activeBallId = 'pokeball';
  let ballChangeHandler = null;

  function SHOP() { return R3ref.get('shop'); }

  /** Les ids de Ball, dans l'ordre du catalogue de la boutique si on l'a. */
  function ballIds() {
    const shop = SHOP();
    if (shop && Array.isArray(shop.CATALOG)) {
      const out = [];
      shop.CATALOG.forEach(function (it) { if (it && it.kind === 'ball') out.push(it.id); });
      if (out.length) return out;
    }
    return BALL_ORDER_FALLBACK;
  }

  /** Métadonnées d'un objet : shop3d fait autorité, ITEM_META sert de repli. */
  function itemMeta(id) {
    const shop = SHOP();
    if (shop && typeof shop.item === 'function') {
      try {
        const it = shop.item(id);
        if (it && it.id === id) return it;
      } catch (e) { /* repli ci-dessous */ }
    }
    const m = ITEM_META[id];
    if (m) return { id: id, name: m.name, icon: m.icon, description: m.desc, price: 0, kind: 'objet' };
    return { id: id, name: String(id), icon: '🎁', description: '', price: 0, kind: 'objet' };
  }

  function ballQty(id) {
    const inv = ballInventory || hudItems || {};
    return inv[id] | 0;
  }

  function renderBallPicker() {
    if (!ui.ballCount) return;
    const meta = itemMeta(activeBallId);
    const n = ballQty(activeBallId);
    ui.ballIcon.textContent = meta.icon || '⚪';
    ui.ballName.textContent = meta.name || activeBallId;
    ui.ballNum.textContent = '×' + n;
    ui.ballCount.classList.toggle('vide', n <= 0);
    ui.ballCount.style.setProperty('--ball-color', meta.color || '#f1c40f');
    ui.ballCount.title = (meta.description || '') + '  (X ou clic : changer de Ball)';
  }

  /** Combien de Balls différentes le joueur possède-t-il vraiment ? */
  function ballsAvailable() {
    const ids = ballIds();
    const out = [];
    for (let i = 0; i < ids.length; i++) if (ballQty(ids[i]) > 0) out.push(ids[i]);
    return out;
  }

  function setActiveBall(id) {
    const ids = ballIds();
    activeBallId = (id && ids.indexOf(id) >= 0) ? id : (ids[0] || 'pokeball');
    renderBallPicker();
    if (liveBattle && ui.bagMenu && !ui.bagMenu.classList.contains('hidden')) renderBagMenu(liveBattle);
    return activeBallId;
  }

  function activeBall() { return activeBallId; }

  function setBallInventory(items) {
    ballInventory = (items && typeof items === 'object') ? items : null;
    // Si la Ball active est épuisée, on glisse sur une Ball qu'on possède :
    // rester bloqué sur un stock vide serait incompréhensible.
    if (ballQty(activeBallId) <= 0) {
      const dispo = ballsAvailable();
      if (dispo.length && dispo.indexOf(activeBallId) === -1) {
        activeBallId = dispo[0];
        notifyBallChange(activeBallId, true);
      }
    }
    renderBallPicker();
  }

  function notifyBallChange(id, silencieux) {
    const st = gameState();
    if (st) st.activeBall = id;
    if (window.GAME3D && typeof window.GAME3D.setActiveBall === 'function') {
      try { window.GAME3D.setActiveBall(id); } catch (e) { /* jamais bloquant */ }
    }
    if (ballChangeHandler) {
      try { ballChangeHandler(id); } catch (e) { console.warn('[hud3d] onBallChange :', e); }
    }
    if (!silencieux) {
      const meta = itemMeta(id);
      toast((meta.icon || '⚪') + ' ' + (meta.name || id) + ' — ×' + ballQty(id), null);
    }
  }

  /** game3d.js peut brancher ce qui se passe quand Robin change de Ball. */
  function onBallChange(fn) { ballChangeHandler = fn; }

  /** Rotation : la Ball suivante que l'on possède réellement. */
  function cycleBall(delta) {
    const dispo = ballsAvailable();
    if (!dispo.length) {
      toast('Tu n’as plus aucune Ball ! Passe au Centre en acheter.', '🛍️');
      return activeBallId;
    }
    if (dispo.length === 1) {
      if (dispo[0] !== activeBallId) { activeBallId = dispo[0]; renderBallPicker(); notifyBallChange(activeBallId); }
      else toast('C’est ta seule sorte de Ball pour l’instant !', '⚪');
      return activeBallId;
    }
    const d = (delta < 0) ? -1 : 1;
    let i = dispo.indexOf(activeBallId);
    if (i < 0) i = (d > 0) ? -1 : 0;
    i = ((i + d) % dispo.length + dispo.length) % dispo.length;
    activeBallId = dispo[i];
    renderBallPicker();
    notifyBallChange(activeBallId);
    return activeBallId;
  }

  /**
   * Compatibilité §18 : `showBallCount(n)` reste appelé par game3d.js avec le
   * nombre de Pokéballs. On s'en sert comme repli tant que setBallInventory()
   * n'a rien dit, et on montre/cache le sélecteur.
   */
  function showBallCount(n) {
    if (!ui.ballCount) return;
    if (n === undefined || n === null) { hide(ui.ballCount); return; }
    if (!ballInventory) {
      if (!hudItems || typeof hudItems !== 'object') hudItems = {};
      hudItems.pokeball = n | 0;
    }
    renderBallPicker();
    show(ui.ballCount);
  }

  // ===========================================================================
  //  ARGENT (CONTRAT3 §11.3) — discret, à côté des compteurs
  // ===========================================================================

  let hudMoney = 0;

  function setMoney(n) {
    hudMoney = Math.max(0, n | 0);
    if (!ui.moneyCount) return;
    ui.moneyNum.textContent = String(hudMoney);
    ui.moneyCount.title = hudMoney + ' pièces';
    show(ui.moneyCount);
    replayAnim(ui.moneyCount, 'pop');
    if (ui.shopMoney) ui.shopMoney.textContent = '🪙 ' + hudMoney;
    if (ui.shopOverlay && !ui.shopOverlay.classList.contains('hidden')) renderShopGrid();
  }

  function money() { return hudMoney; }

  function showMoney(v) { if (ui.moneyCount) ui.moneyCount.classList.toggle('hidden', !v); }

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
    // Le sac EST l'inventaire des Balls : le sélecteur se met à jour tout seul.
    setBallInventory(items);
    if (liveBattle && ui.bagMenu && !ui.bagMenu.classList.contains('hidden')) renderBagMenu(liveBattle);
    if (ui.shopOverlay && !ui.shopOverlay.classList.contains('hidden')) renderShopGrid();
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

    // --- La cinquième entrée : TÉRACRISTALLISATION (CONTRAT3 §7 et §11.3) ---
    // Elle occupe toute la largeur, sous la grille 2×2 : elle ne se confond
    // donc jamais avec les quatre commandes habituelles, et l'ordre 0..3 que
    // battle3d.js connaît ne bouge pas d'un pouce.
    const tera = el('button', 'bm-cell bm-tera', grid);
    tera.type = 'button';
    ui.teraIcon = el('span', 'bm-icon', tera, '💎');
    const tbody = el('span', 'bm-tera-body', tera);
    ui.teraLabel = el('span', 'bm-label', tbody, 'Téra');
    ui.teraSub = el('span', 'bm-tera-sub', tbody, 'À apprendre à l’Académie');
    tera.addEventListener('mouseenter', function () { setMenuCursor(MAIN_MENU_ITEMS.length); });
    tera.addEventListener('click', function () {
      if (tera.disabled) { toast(teraState.reason || 'Pas encore disponible.', '💎'); return; }
      setMenuCursor(MAIN_MENU_ITEMS.length);
      tera.blur();
      if (typeof teraState.onPress === 'function') {
        try { teraState.onPress(); } catch (e) { console.warn('[hud3d] bouton Téra :', e); }
      } else fakeKey(' ');
    });
    ui.teraCell = tera;
    ui.mainCells.push(tera);
    renderTeraButton();

    ui.mainMenu = menu;
  }

  // --- État du bouton Téra, poussé par game3d.js via setTeraState() ---------
  const teraState = { enabled: false, teraType: null, reason: '', onPress: null, shown: false };

  function renderTeraButton() {
    if (!ui.teraCell) return;
    // Tant que tera3d n'est pas là ET que personne n'a rien poussé, on cache
    // le bouton : mieux vaut rien qu'une commande qui ne sert à rien.
    const dispo = teraState.shown || !!R3ref.get('tera');
    ui.teraCell.classList.toggle('hidden', !dispo);
    if (!dispo) return;

    const t = teraState.teraType ? typeInfo(teraState.teraType) : null;
    ui.teraIcon.textContent = t ? (t.icon || '💎') : '💎';
    ui.teraCell.style.setProperty('--type-color', t ? t.color : '#d896ff');
    ui.teraLabel.textContent = t ? ('Téra ' + t.label) : 'Téracristallisation';
    ui.teraSub.textContent = teraState.enabled
      ? 'Fais briller ta créature !'
      : (teraState.reason || 'À apprendre à l’Académie-château.');
    ui.teraCell.disabled = !teraState.enabled;
    ui.teraCell.classList.toggle('disabled', !teraState.enabled);
    ui.teraCell.title = teraState.enabled ? 'Téracristalliser ta créature' : (teraState.reason || '');
  }

  /**
   * @param {object} o { enabled, teraType, reason, onPress }
   * Le HUD n'invente rien : il affiche ce que game3d/tera3d lui disent.
   */
  function setTeraState(o) {
    o = o || {};
    teraState.shown = true;
    teraState.enabled = !!o.enabled;
    teraState.teraType = o.teraType || null;
    teraState.reason = o.reason || '';
    teraState.onPress = (typeof o.onPress === 'function') ? o.onPress : null;
    renderTeraButton();
  }

  function showMainMenu(battle) {
    if (!ui.mainMenu) return;
    liveBattle = battle || liveBattle;
    const b = liveBattle || {};
    if (ui.mainCells) {
      ui.mainCells.forEach(function (cell, i) {
        // La cellule Téra a sa propre logique (renderTeraButton) : surtout ne
        // pas la réactiver ici, elle redeviendrait cliquable sans l'Académie.
        if (cell === ui.teraCell) return;
        const flee = (i === 3) && b.canFlee === false;
        cell.disabled = !!flee;
        cell.classList.toggle('disabled', !!flee);
        cell.title = flee ? 'Impossible de fuir ce combat !' : '';
      });
    }
    renderTeraButton();
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
    // On n'écrit JAMAIS l'index 4 (Téra) dans battle.menuCursor : battle3d ne
    // connaît que les quatre commandes 0..3, et un curseur hors table lui
    // ferait faire n'importe quoi si Robin appuyait ensuite sur Espace.
    // Le bouton Téra se déclenche par son propre callback (setTeraState).
    if (liveBattle && idx < MAIN_MENU_ITEMS.length) liveBattle.menuCursor = idx;
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
      const it = itemMeta(id);
      const meta = { name: it.name, icon: it.icon, desc: it.description || it.tagline || '' };
      const isBall = (it.kind === 'ball') || id.indexOf('ball') >= 0;
      out.push({
        id: id, n: n, meta: meta,
        actif: isBall && id === activeBallId,
        disabled: isBall && b.canCatch === false,
      });
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
      const cell = el('button', 'bag-item' + (entry.disabled ? ' disabled' : '') +
        (entry.actif ? ' active-ball' : ''), ui.bagList);
      cell.type = 'button';
      cell.disabled = entry.disabled;
      el('span', 'bi-icon', cell, entry.meta.icon);
      const info = el('span', 'bi-info', cell);
      el('span', 'bi-name', info, entry.meta.name + (entry.actif ? '  ⭐' : ''));
      el('span', 'bi-desc', info, entry.actif ? 'Ta Ball choisie (X pour changer)' : entry.meta.desc);
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
    el('span', 'box-tip', boxHead, '👆 Clique une créature pour la mettre dans ton équipe');
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

    // LE bouton de la demande n°1 de Robin : « je ne peux pas mettre les
    // créatures de la boîte dans mon équipe ». Il est écrit noir sur blanc,
    // à côté de son symétrique « Renvoyer à la Boîte », et il suffit de
    // cliquer une créature de la Boîte pour qu'il s'allume.
    ui.teamToTeamBtn = el('button', 'td-toteam', right, '⬆️ Mettre dans l’équipe');
    ui.teamToTeamBtn.type = 'button';
    ui.teamToTeamBtn.addEventListener('click', function () {
      boxToTeam(boxPage * BOX_PAGE_SIZE + boxCursor);
    });

    ui.teamDetailStats = el('div', 'td-stats', right);
    ui.teamDetailMoves = el('div', 'td-moves', right);
    ui.teamToBoxBtn = el('button', 'td-tobox', right, '↓ Renvoyer à la Boîte');
    ui.teamToBoxBtn.type = 'button';
    ui.teamToBoxBtn.addEventListener('click', function () {
      const api = TEAM();
      if (!api) return;
      // On accepte les DEUX gestes : une créature « en main » (teamSelected),
      // ou simplement celle que le curseur désigne. Exiger la sélection
      // préalable, c'était exactement le piège de la Boîte, à l'envers.
      const idx = (teamSelected >= 0) ? teamSelected : (teamZone === 'team' ? teamCursor : -1);
      if (idx < 0) return;
      if (api.toBox(idx)) {
        teamSelected = -1;
        renderTeamScreen();
        toast('Créature renvoyée à la Boîte', '📦');
      } else {
        toast('Il faut garder au moins une créature avec toi !', '💛');
      }
    });

    // --- utiliser un objet hors combat (§11.3) -------------------------------
    // Le sac n'existait qu'en combat : entre deux combats, la seule façon de
    // soigner était de retourner au Centre. On soigne (et on donne une pierre)
    // directement depuis l'écran Équipe.
    ui.teamUseBtn = el('button', 'td-use', right, '🎒 Utiliser un objet');
    ui.teamUseBtn.type = 'button';
    ui.teamUseBtn.addEventListener('click', function () {
      if (sacEquipeOuvert()) fermeSacEquipe(); else ouvreSacEquipe();
    });

    ui.teamBag = el('div', 'td-bag hidden', right);

    const teamHint = el('p', 'hint', frame);
    teamHint.innerHTML = 'Flèches : choisir &nbsp;·&nbsp; <strong>A</strong> : envoyer au combat' +
      ' &nbsp;·&nbsp; <strong>Espace</strong> sur une créature de la Boîte : la mettre dans ton équipe' +
      ' &nbsp;·&nbsp; <strong>U</strong> : utiliser un objet &nbsp;·&nbsp; Échap : fermer';

    ov.addEventListener('click', function (ev) { if (ev.target === ov) closeTeam(); });
    ui.teamOverlay = ov;
  }

  // ===========================================================================
  //  LE SAC DE L'ÉCRAN ÉQUIPE — soigner hors combat
  //  On ne montre que ce qui sert VRAIMENT sur une créature (soins et pierres)
  //  et qu'on possède : une liste d'objets grisés n'apprend rien à un enfant.
  // ===========================================================================
  function monSousCurseur() {
    const api = TEAM();
    if (!api) return null;
    if (teamZone === 'box') return api.box[boxPage * BOX_PAGE_SIZE + boxCursor] || null;
    return api.team[teamCursor] || null;
  }

  function objetsUtilisables() {
    const inv = hudItems || {};
    const shop = R3ref.get('shop');
    const out = [];
    Object.keys(inv).forEach(function (id) {
      if ((inv[id] | 0) <= 0) return;
      const meta = shop && shop.item ? shop.item(id) : null;
      const kind = meta ? meta.kind : null;
      // Les Balls ne se lancent pas sur sa propre équipe.
      if (kind === 'ball') return;
      if (meta && meta.usable === false) return;
      if (kind && kind !== 'soin' && kind !== 'pierre' && kind !== 'objet') return;
      out.push(meta || { id: id, name: id, icon: '🎁', description: '' });
    });
    return out;
  }

  function ouvreSacEquipe() {
    if (!ui.teamBag) return;
    const mon = monSousCurseur();
    if (!mon) { toast('Choisis d’abord une créature.', '👆'); return; }

    const liste = objetsUtilisables();
    ui.teamBag.innerHTML = '';
    el('div', 'tb-title', ui.teamBag, 'Sur ' + monLabel(mon) + ' :');

    if (!liste.length) {
      el('p', 'hint', ui.teamBag, 'Ton sac est vide. Le Centre Pokémon en vend !');
    } else {
      liste.forEach(function (item) {
        const b = el('button', 'tb-item', ui.teamBag);
        b.type = 'button';
        b.setAttribute('data-nav', '1');
        b.style.setProperty('--item-color', item.color || '#41a6f6');
        el('span', 'tb-icon', b, item.icon || '🎁');
        const t = el('span', 'tb-texts', b);
        el('span', 'tb-name', t, (item.name || item.id) + '  ×' + (hudItems[item.id] | 0));
        if (item.description) el('span', 'tb-desc', t, item.description);
        b.addEventListener('click', function () {
          const cible = monSousCurseur();
          let r = null;
          // game3d pilote : il applique, décompte, sauvegarde et enchaîne une
          // éventuelle évolution. Repli direct sur shop3d s'il n'est pas là.
          if (window.GAME3D && typeof window.GAME3D.useItem === 'function') {
            try { r = window.GAME3D.useItem(item.id, cible); } catch (e) { r = null; }
          } else {
            const shop = R3ref.get('shop');
            if (shop && shop.useFrom) {
              try { r = shop.useFrom(item.id, cible, gameState()); } catch (e) { r = null; }
            }
          }
          if (r && r.message) toast(r.message, r.ok ? '✨' : 'ℹ️');
          else if (!r) toast('Rien ne s’est passé.', 'ℹ️');
          fermeSacEquipe();
          renderTeamScreen();
        });
      });
    }

    show(ui.teamBag);
    navReset(ui.teamBag);
    if (ui.teamUseBtn) ui.teamUseBtn.textContent = '✖️ Refermer le sac';
  }

  function fermeSacEquipe() {
    if (!ui.teamBag) return;
    hide(ui.teamBag);
    navMarque(null);
    if (ui.teamUseBtn) ui.teamUseBtn.textContent = '🎒 Utiliser un objet';
  }

  function sacEquipeOuvert() {
    return !!(ui.teamBag && !ui.teamBag.classList.contains('hidden'));
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
      el('div', 'bs-go', cell, '⬆️ Dans l’équipe');
      cell.title = 'Clique pour mettre ' + monLabel(mon) + ' dans ton équipe';
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

  /** Le nom qu'on affiche pour une créature (surnom, sinon nom d'espèce). */
  function monLabel(mon) {
    if (!mon) return 'Cette créature';
    const sp = teamSlotLabel(mon);
    return mon.nick || (sp && sp.name) || mon.id;
  }

  /**
   * DEMANDE N°1 DE ROBIN — sortir une créature de la Boîte.
   *
   * L'ancienne version exigeait d'avoir d'abord sélectionné une place dans
   * l'équipe, et refusait tout le reste du temps (« Choisis d'abord une place
   * dans ton équipe »). Or `team.toTeam(boxIndex)` sait parfaitement ajouter
   * tout seul tant que l'équipe compte moins de 6 créatures : on ne demande
   * donc l'échange QUE quand l'équipe est vraiment pleine, et on dit alors
   * précisément quoi faire.
   */
  function boxToTeam(absoluteIndex) {
    const api = TEAM();
    if (!api || typeof api.toTeam !== 'function') return false;
    const mon = api.box[absoluteIndex];
    if (!mon) return false;
    const nom = monLabel(mon);
    const plein = api.team.length >= TEAM_MAX();

    if (!plein) {
      // Cas normal et de loin le plus fréquent : il reste de la place.
      if (api.toTeam(absoluteIndex)) {
        teamSelected = -1;
        renderTeamScreen();
        toast(nom + ' rejoint ton équipe !', '⬆️');
        return true;
      }
      return false;
    }

    // Équipe pleine : il FAUT désigner qui part à la Boîte.
    if (teamSelected >= 0) {
      const sortante = monLabel(api.team[teamSelected]);
      if (api.toTeam(absoluteIndex, teamSelected)) {
        teamSelected = -1;
        renderTeamScreen();
        toast(nom + ' remplace ' + sortante + ' !', '🔄');
        return true;
      }
      teamSelected = -1;
      renderTeamScreen();
      return false;
    }

    toast('Ton équipe est pleine ! Clique d’abord la créature de ton équipe que tu veux remplacer.', '👆');
    return false;
  }

  function onBoxSlotActivate(absoluteIndex) {
    const api = TEAM();
    if (!api) return;
    boxToTeam(absoluteIndex);
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
      if (ui.teamToTeamBtn) { ui.teamToTeamBtn.disabled = true; hide(ui.teamToTeamBtn); }
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

    // Le bouton « Mettre dans l'équipe » : visible dès qu'on regarde une
    // créature de la Boîte, avec un libellé qui explique quoi faire quand
    // l'équipe est pleine. C'est le geste que Robin doit trouver seul.
    if (ui.teamToTeamBtn) {
      const dansBoite = (teamZone === 'box');
      ui.teamToTeamBtn.classList.toggle('hidden', !dansBoite);
      if (dansBoite) {
        const plein = api && api.team.length >= TEAM_MAX();
        if (!plein) {
          ui.teamToTeamBtn.disabled = false;
          ui.teamToTeamBtn.textContent = '⬆️ Mettre dans l’équipe';
          ui.teamToTeamBtn.title = 'Il reste de la place dans ton équipe !';
        } else if (teamSelected >= 0) {
          ui.teamToTeamBtn.disabled = false;
          ui.teamToTeamBtn.textContent = '🔄 Remplacer ' + monLabel(api.team[teamSelected]);
          ui.teamToTeamBtn.title = 'Échange les deux créatures.';
        } else {
          ui.teamToTeamBtn.disabled = true;
          ui.teamToTeamBtn.textContent = '⬆️ Équipe pleine — choisis qui remplacer';
          ui.teamToTeamBtn.title = 'Clique une créature de ton équipe, puis reviens ici.';
        }
      }
    }

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
    // Après `show()`, et pas avant : `navElements()` écarte tout ce qui est
    // encore invisible (`offsetParent === null`), donc le reset fait dans
    // `renderDexGrid()` ne trouvait aucune carte tant que l'écran était caché.
    navReset(ui.dexOverlay);
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
      // typeMatches() et pas indexOf() : les espèces disent encore « foudre »
      // et « ombre » là où le filtre dit « electrique » et « spectre ».
      if (dexFilterType && !typeMatches(sp.types, dexFilterType)) return false;
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
      // Navigation clavier : c'est le DOM qui porte l'ordre de parcours.
      card.setAttribute('data-nav', '1');
    });
    // La grille vient d'être reconstruite (ouverture, changement de filtre) :
    // on repose le curseur au début. `navCourant` est PARTAGÉ par tous les
    // écrans — sans ce reset, le Pokédex hériterait du curseur de la Boutique.
    navReset(ui.dexOverlay);
  }

  function showDexDetail(sp) {
    dexSelected = sp.id;
    ui.dexDetailThumb.innerHTML = '';
    ui.dexDetailThumb.appendChild(thumbFor(sp, 132));
    ui.dexDetailName.textContent = sp.name + (sp.legendary ? '  ✨' : '');
    // Le titre des légendaires (« le Cerf Dormant »), sous le nom. Créé à la
    // volée : le Pokédex existait avant les titres, et une créature ordinaire
    // n'en a pas.
    if (!ui.dexDetailTitle) {
      ui.dexDetailTitle = el('div', 'dd-title hidden', null, '');
      ui.dexDetailName.parentNode.insertBefore(ui.dexDetailTitle, ui.dexDetailTypes);
    }
    if (sp.title) {
      ui.dexDetailTitle.textContent = sp.title;
      show(ui.dexDetailTitle);
    } else {
      ui.dexDetailTitle.textContent = '';
      hide(ui.dexDetailTitle);
    }
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
    // L'id est INDISPENSABLE : toute la mise en page de la carte tient dans la
    // règle `#map-canvas` (position absolue, inset 6px, taille du conteneur).
    // Sans lui, le canvas s'affichait à sa taille brute de 768×448 dans le flux
    // pendant que les marqueurs couvraient tout le conteneur : l'image et les
    // repères étaient à deux échelles différentes, et la carte montrait
    // n'importe quoi. Bug présent depuis l'écriture de l'écran.
    ui.mapCanvas.id = 'map-canvas';
    ui.mapCanvas.width = 768; ui.mapCanvas.height = 448;
    ui.mapOverlayMarkers = el('div', 'map-markers', wrap);
    ui.mapCtx = ui.mapCanvas.getContext('2d');
    const legend = el('div', 'map-legend', regionView);
    [['#e74c3c', 'Toi'], ['#f1c40f', 'Porte'], ['#a5aab0', 'Ville'],
     ['#ff6b3d', '⚔️ Arène'], ['#ff6b9d', '➕ Centre Pokémon'],
     ['#a678f0', '🔮 Académie'], ['#41a6f6', '⚓ Port aérien'],
     ['#ffd166', '⛩️ Sanctuaire'], ['#7a5cbf', '✦ Autel de légendaire']]
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
    // `nomme` : le nom du lieu est écrit À CÔTÉ du marqueur, pas seulement en
    // infobulle. Un émoji de 15 px sans légende ne se remarque pas — c'est
    // pour ça que Robin ne trouvait ni l'Académie ni les Centres.
    const addMarker = function (x, y, cls, icon, label, nomme) {
      const m = el('div', 'map-marker ' + cls + (nomme ? ' nomme' : ''), ui.mapOverlayMarkers);
      m.style.left = (x / W * 100) + '%';
      m.style.top = (y / H * 100) + '%';
      el('span', 'mk-icon', m, icon);
      if (nomme && label) el('span', 'mk-label', m, label);
      if (label) m.title = label;
    };

    if (def && Array.isArray(def.gates)) {
      def.gates.forEach(function (g) { addMarker(g.x, g.y, 'gate', '🚪', g.label || ('Vers ' + regionName(g.toRegion))); });
    }
    try {
      const cities = CITIES();
      const plan = cities && typeof cities.plan === 'function' ? cities.plan(regionId) : null;
      if (plan && plan.castle) {
        addMarker(plan.castle.x, plan.castle.y, 'city', '🏰', plan.name || 'Ville');
      }
      // Les lieux qui SERVENT vraiment au joueur — Centre Pokémon, arène,
      // Académie. `cities.beacons()` les fournit tous les trois depuis le
      // début, mais personne ne l'appelait : ni le Centre ni l'Académie
      // n'apparaissaient sur la carte, et Robin ne les trouvait pas.
      const reperes = (cities && typeof cities.beacons === 'function')
        ? cities.beacons(regionId) : null;
      if (Array.isArray(reperes) && reperes.length) {
        reperes.forEach(function (b) {
          if (typeof b.x !== 'number' || typeof b.y !== 'number') return;
          addMarker(b.x, b.y, b.kind || 'lieu', b.icon || '📌', b.label || '', true);
        });
      } else if (plan && plan.arena) {
        addMarker(plan.arena.x, plan.arena.y, 'arena', '⚔️', 'Arène');
      }
    } catch (e) { /* dégradation silencieuse */ }
    try {
      const airship = AIRSHIP();
      const port = airship && typeof airship.portOf === 'function' ? airship.portOf(regionId) : null;
      if (port && typeof port.x === 'number') addMarker(port.x, port.y, 'port', '⚓', port.name || 'Port aérien');
    } catch (e) { /* dégradation silencieuse */ }
    // Le sanctuaire et les autels de la quête. La quête dit « cherche leurs
    // autels » sur une région de 384×224 tuiles : sans repère, c'est une
    // fouille à l'aveugle, exactement le problème de l'Académie introuvable.
    // Les autels n'apparaissent QU'UNE FOIS le sanctuaire ouvert (badge gagné) :
    // avant, la légende doit rester un mystère qu'on entend raconter.
    try {
      const quest = QUEST();
      const sanc = (quest && typeof quest.sanctuary === 'function') ? quest.sanctuary(regionId) : null;
      if (sanc && typeof sanc.x === 'number') {
        addMarker(sanc.x, sanc.y, 'sanctuary' + (sanc.open ? '' : ' ferme'), sanc.icon || '⛩️',
          sanc.name + (sanc.open ? '' : ' (fermé)'), true);
        if (sanc.open && def && Array.isArray(def.altars)) {
          const collection = (st && st.collection) || {};
          def.altars.forEach(function (a) {
            if (typeof a.x !== 'number' || typeof a.y !== 'number') return;
            // L'autel du légendaire « chef » PORTE le sanctuaire (même tuile,
            // cf. quest3d §« LES SIX QUÊTES ») : deux marqueurs s'y
            // superposeraient exactement.
            if (a.x === sanc.x && a.y === sanc.y) return;
            const pris = collection[a.id] > 0;
            addMarker(a.x, a.y, 'altar' + (pris ? ' pris' : ''), pris ? '✅' : '✦', a.label || 'Autel', true);
          });
        }
      }
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
    // Quelle région abrite l'Académie ? Il n'y en a qu'une dans tout le jeu, et
    // rien ne le disait nulle part : Robin l'a cherchée sans savoir qu'elle
    // n'était pas dans la sienne. La carte du monde le dit maintenant.
    let regionAcademie = null;
    try {
      const C = CITIES();
      if (C && typeof C.academyDoorTile === 'function') {
        const d = C.academyDoorTile();
        if (d && d.regionId) regionAcademie = d.regionId;
      }
    } catch (e) { /* la carte marche très bien sans */ }

    const out = {};
    Object.keys(WORLD_GRID).forEach(function (id) {
      out[id] = {
        current: id === currentId,
        visited: !!visited[id] || id === 'val',
        label: regionName(id) + (id === regionAcademie ? '  🔮' : ''),
        academy: id === regionAcademie,
        icon: '📍',
      };
    });
    return out;
  }

  function renderWorldMap() {
    if (!ui.mapWorldGrid) return;
    const states = worldRegionStates();
    buildWorldGrid(ui.mapWorldGrid, states, function (id, st) {
      const ou = st.current ? ' — tu y es !'
        : (st.visited ? ' — déjà explorée' : ' — pas encore explorée');
      const plus = st.academy ? '\n🔮 C’est ici qu’on apprend la Téracristallisation !' : '';
      toast(st.label + ou + plus, '🗺️');
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
      // `subAlerte` : le sous-titre passe en jaune quand il porte un
      // avertissement (écart de niveau du dirigeable). Optionnel — la carte du
      // monde ne s'en sert pas.
      if (st.sub) el('span', 'wn-sub' + (st.subAlerte ? ' alerte' : ''), btn, st.sub);
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
  /**
   * Le niveau de l'équipe, tel qu'on le compare au niveau conseillé d'une
   * région : celui de la créature LA PLUS FORTE. On prend le maximum et non
   * la moyenne pour avertir le moins souvent possible — le but est de prévenir
   * Robin d'un vrai gouffre, pas de commenter chaque voyage.
   */
  function niveauEquipe() {
    let n = 0;
    try {
      const api = TEAM();
      const l = (api && Array.isArray(api.team)) ? api.team : [];
      for (let i = 0; i < l.length; i++) {
        if (l[i] && typeof l[i].level === 'number' && l[i].level > n) n = l[i].level;
      }
    } catch (e) { /* dégradation silencieuse */ }
    return n;
  }

  // Au-delà de cet écart, on prévient. Une région se joue confortablement
  // quelques niveaux en dessous du conseil : c'est le gouffre qu'on signale.
  const ECART_ALERTE = 10;

  // Destination qui attend une seconde validation (voir plus bas), et l'heure
  // à laquelle on l'a demandée : garder Espace enfoncé rejoue la touche toutes
  // les ~30 ms, et l'avertissement serait balayé avant d'avoir été lu.
  let airshipPending = null;
  let airshipPendingAt = 0;
  const DOUTE_DELAI = 0.5;   // secondes avant qu'un second appui compte

  function openAirshipMenu(ports, current, onChoose) {
    if (!ui.airshipOverlay) return;
    const st = gameState();
    const visited = (st && st.visitedRegions) || {};
    const list = normalizePorts(ports, current, visited);
    const monNiveau = niveauEquipe();
    airshipPending = null;

    const states = {};
    list.forEach(function (p) {
      const vu = (p.visited !== undefined) ? !!p.visited : !!visited[p.regionId];
      // `p.level` = `def.recommendedLevel`, transmis depuis game3d depuis
      // toujours mais jamais affiché : rien n'empêchait Robin de filer au
      // Plateau d'Aurore (Nv 45 conseillé) avec une équipe Nv 12, et de s'y
      // faire écraser sans avoir été prévenu. On informe, on ne bloque JAMAIS.
      const conseil = (typeof p.level === 'number' && p.level > 0) ? p.level : 0;
      const ecart = (conseil && monNiveau) ? (conseil - monNiveau) : 0;
      const alerte = ecart > ECART_ALERTE;
      // ⚠️ LE SOUS-TITRE S'AJOUTE, IL NE REMPLACE PAS. `airshipOptions()` de
      // game3d fournit `level` pour LES SIX régions : si le conseil de niveau
      // était une BRANCHE, il gagnait toujours et il ne restait plus rien —
      // ni « Région encore inconnue », ni le nom du port. Robin ne distinguait
      // plus une région déjà vue d'une région jamais visitée qu'à l'icône
      // (⚓ contre ✨), à 22 px et sans légende. Les deux tiennent sur deux
      // lignes (`\n` : `.wn-sub` est en `white-space: pre-line`).
      let sub;
      if (p.current) sub = 'Tu y es';
      else if (!p.enabled) sub = p.reason || 'À découvrir à pied';
      else {
        const ou = vu ? (p.name || 'Déjà visitée') : (p.reason || 'Jamais visitée');
        const niv = conseil
          ? ('Nv ' + conseil + ' conseillé'
             + (monNiveau ? ' · toi Nv ' + monNiveau : '')
             + (alerte ? ' ⚠️' : ''))
          : '';
        sub = niv ? (ou + '\n' + niv) : ou;
      }
      states[p.regionId] = {
        current: p.current, visited: vu, disabled: !p.enabled && !p.current,
        label: p.region || regionName(p.regionId),
        sub: sub,
        subAlerte: alerte,
        alerte: alerte, conseil: conseil,
        icon: p.current ? '🎈' : (p.enabled ? (vu ? '⚓' : '✨') : '🔒'),
      };
    });
    airshipNodes = buildWorldGrid(ui.airshipGrid, states, function (id, s) {
      if (s.current) { toast('Tu es déjà ici !', '🎈'); return; }
      if (s.disabled) { toast('Il faut y être allé à pied avant !', '🚶'); return; }
      // Écart de niveau : on demande une seconde confirmation, sur place, en
      // recliquant (ou en revalidant au clavier — `confirmAirship()` passe par
      // le même `btn.click()`). Rien n'est interdit : le voyage part au second
      // appui, et Robin sait dans quoi il s'engage.
      if (s.alerte && (airshipPending !== id || (now() - airshipPendingAt) < DOUTE_DELAI)) {
        if (airshipPending !== id) {
          airshipPending = id;
          airshipPendingAt = now();
          toast('Là-bas, les créatures sont vers le Nv ' + s.conseil
            + ' — c\'est costaud pour ton équipe. Reclique pour y aller quand même !', '⚠️');
          marqueAirshipDoute(id);
        }
        return;
      }
      airshipPending = null;
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

  /**
   * Écrit l'attente de confirmation SUR la carte, et pas seulement dans un
   * toast qui va disparaître : un enfant qui hésite trois secondes ne doit pas
   * se retrouver devant un bouton muet qui, lui, part au clic suivant.
   * Passer `null` remet tous les sous-titres d'origine.
   */
  function marqueAirshipDoute(id) {
    for (let i = 0; i < airshipNodes.length; i++) {
      const n = airshipNodes[i];
      const sub = n.btn.querySelector('.wn-sub');
      if (!sub) continue;
      if (n.id === id) {
        if (n._subOrig === undefined) n._subOrig = sub.textContent;
        sub.textContent = 'Reclique pour y aller quand même';
        sub.classList.add('alerte');
        n.btn.classList.add('doute');
      } else if (n._subOrig !== undefined) {
        sub.textContent = n._subOrig;
        n._subOrig = undefined;
        n.btn.classList.remove('doute');
      }
    }
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
    // Changer de destination annule la confirmation en attente : sinon
    // « reclique pour y aller quand même » resterait vrai pour une région
    // qu'on ne regarde plus.
    const vise = airshipNodes[airshipCursor];
    if (airshipPending && (!vise || vise.id !== airshipPending)) {
      airshipPending = null;
      marqueAirshipDoute(null);
    }
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

  function closeAirshipMenu() {
    airshipPending = null;
    hide(ui.airshipOverlay);
    showCompass(true);
  }

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
  //  BOUTIQUE DU CENTRE POKÉMON (CONTRAT3 §6 et §11.3 — demande n°8)
  // ---------------------------------------------------------------------------
  //  Le HUD n'achète rien et ne compte pas l'argent : il affiche l'étal que
  //  game3d lui donne et rappelle onBuy / onSell. Toute la logique (prix,
  //  porte-monnaie, stock) appartient à shop3d.js.
  // ===========================================================================

  const shopState = {
    stock: [], owned: {}, welcome: '', mode: 'buy',
    onBuy: null, onSell: null, onClose: null, qty: {},
  };

  function buildShopOverlay() {
    const ov = el('div', 'overlay hidden', hudRoot);
    ov.id = 'shop-overlay';
    const frame = el('div', 'shop-frame', ov);

    const head = el('div', 'shop-head', frame);
    el('h2', null, head, '🛍️ La boutique du Centre');
    ui.shopMoney = el('span', 'shop-money', head, '🪙 0');

    ui.shopWelcome = el('p', 'shop-welcome', frame, '');

    const tabs = el('div', 'shop-tabs', frame);
    ui.shopTabBuy = el('button', null, tabs, '🛒 Acheter');
    ui.shopTabSell = el('button', null, tabs, '💰 Vendre');
    ui.shopTabBuy.type = 'button'; ui.shopTabSell.type = 'button';
    ui.shopTabBuy.addEventListener('click', function () { setShopMode('buy'); });
    ui.shopTabSell.addEventListener('click', function () { setShopMode('sell'); });

    ui.shopGrid = el('div', 'shop-grid', frame);

    el('p', 'hint', frame, '↑↓ choisir · ←→ la quantité · Entrée : valider · Tab : acheter/vendre · Échap : sortir');
    const close = el('button', 'shop-close', frame, 'Au revoir !');
    close.type = 'button';
    close.addEventListener('click', closeShop);
    ov.addEventListener('click', function (ev) { if (ev.target === ov) closeShop(); });
    ui.shopOverlay = ov;
  }

  function setShopMode(mode) {
    shopState.mode = (mode === 'sell') ? 'sell' : 'buy';
    if (ui.shopTabBuy) ui.shopTabBuy.classList.toggle('on', shopState.mode === 'buy');
    if (ui.shopTabSell) ui.shopTabSell.classList.toggle('on', shopState.mode === 'sell');
    renderShopGrid();
  }

  /** Le sac de référence : celui que la boutique a fourni, sinon celui du HUD. */
  function shopInventory() {
    return (shopState.owned && Object.keys(shopState.owned).length) ? shopState.owned : (hudItems || {});
  }

  function shopOwned(id) {
    const inv = shopInventory();
    return (inv && inv[id]) | 0;
  }

  function sellPriceOf(item) {
    const shop = SHOP();
    if (shop && typeof shop.sellPriceOf === 'function') {
      try { return shop.sellPriceOf(item.id) | 0; } catch (e) { /* repli */ }
    }
    return Math.floor((item.price || 0) / 2);
  }

  function shopQty(id) { return Math.max(1, shopState.qty[id] || 1); }

  // ===========================================================================
  //  NAVIGATION AU CLAVIER DES ÉCRANS À CARTES
  //  Les écrans Équipe et dirigeable se pilotaient déjà aux flèches, mais la
  //  Boutique, le Journal et l'Académie ne répondaient qu'à la souris — un
  //  enfant qui joue au clavier devait lâcher les touches pour attraper la
  //  souris à chaque achat.
  //
  //  Une seule fonction sert les trois : tout élément marqué `data-nav` devient
  //  une étape de navigation. C'est le DOM qui porte l'ordre (celui du rendu),
  //  donc rien à resynchroniser quand une grille est reconstruite.
  //  `data-col` (Académie) sépare deux colonnes : ←/→ changent de colonne au
  //  lieu de régler une quantité.
  // ===========================================================================
  var navCourant = null;      // élément survolé par le clavier

  function navElements(overlay) {
    if (!overlay) return [];
    var tous = Array.prototype.slice.call(overlay.querySelectorAll('[data-nav]'));
    return tous.filter(function (e) { return !e.disabled && e.offsetParent !== null; });
  }

  function navMarque(el2) {
    if (navCourant && navCourant !== el2) navCourant.classList.remove('nav-cursor');
    navCourant = el2 || null;
    if (!navCourant) return;
    navCourant.classList.add('nav-cursor');
    // `nearest` : on ne recentre pas brutalement l'écran à chaque flèche.
    try { navCourant.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    catch (e) { try { navCourant.scrollIntoView(false); } catch (e2) { /* rien */ } }
  }

  function navReset(overlay) {
    var l = navElements(overlay);
    navMarque(l.length ? l[0] : null);
  }

  /**
   * Traite une touche pour un écran à cartes.
   * @returns {boolean} true si la touche a été consommée.
   */
  function navEcran(overlay, ev) {
    var key = ev.key;
    var liste = navElements(overlay);
    if (!liste.length) return false;

    // Le curseur a pu disparaître (grille reconstruite après un achat).
    var i = liste.indexOf(navCourant);
    if (i < 0) { i = 0; navMarque(liste[0]); }

    var col = navCourant ? navCourant.getAttribute('data-col') : null;

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      var pas = (key === 'ArrowDown') ? 1 : -1;
      if (col) {
        // Deux colonnes : on ne descend que parmi les éléments de la sienne.
        var meme = liste.filter(function (e) { return e.getAttribute('data-col') === col; });
        var j = meme.indexOf(navCourant);
        navMarque(meme[Math.max(0, Math.min(meme.length - 1, j + pas))]);
      } else {
        navMarque(liste[Math.max(0, Math.min(liste.length - 1, i + pas))]);
      }
      return true;
    }

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (col) {
        // Changer de colonne, en gardant à peu près la même hauteur.
        var vise = (key === 'ArrowRight') ? 'type' : 'mon';
        var autre = liste.filter(function (e) { return e.getAttribute('data-col') === vise; });
        if (!autre.length) return true;
        var memeCol = liste.filter(function (e) { return e.getAttribute('data-col') === col; });
        var rang = memeCol.indexOf(navCourant);
        navMarque(autre[Math.max(0, Math.min(autre.length - 1, rang))]);
        return true;
      }
      // Boutique : les flèches règlent la quantité de la carte courante.
      var b = (key === 'ArrowLeft') ? navCourant._moins : navCourant._plus;
      if (b && !b.disabled) b.click();
      return true;
    }

    if (key === 'Enter' || key === ' ') {
      var cible = navCourant._valider || navCourant;
      if (cible && !cible.disabled && typeof cible.click === 'function') cible.click();
      return true;
    }

    return false;
  }

  /**
   * Navigation clavier de la grille du Pokédex — le seul grand écran qui en
   * était privé, alors qu'il compte 62 cartes.
   * `navEcran` fait tout le travail, mais il raisonne en LISTE : ←/→ y règlent
   * une quantité (Boutique) et ↑/↓ n'avancent que d'un cran. Une grille se
   * parcourt mieux en damier, on traduit donc les touches ici : ←/→ passent à
   * la carte voisine, ↑/↓ sautent une LIGNE entière.
   * @returns {boolean} true si la touche a été consommée.
   */
  function dexNavKey(ev) {
    const key = ev.key;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      return navEcran(ui.dexOverlay, { key: (key === 'ArrowLeft') ? 'ArrowUp' : 'ArrowDown' });
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const liste = navElements(ui.dexOverlay);
      if (!liste.length) return false;
      const i = liste.indexOf(navCourant);
      if (i < 0) { navMarque(liste[0]); return true; }
      // Nombre de colonnes mesuré sur le vif : la grille est responsive, il
      // n'y a aucune constante à tenir à jour.
      let cols = 1;
      while (cols < liste.length && liste[cols].offsetTop === liste[0].offsetTop) cols++;
      const j = i + ((key === 'ArrowDown') ? cols : -cols);
      navMarque(liste[Math.max(0, Math.min(liste.length - 1, j))]);
      return true;
    }
    return navEcran(ui.dexOverlay, ev);
  }

  function renderShopGrid() {
    if (!ui.shopGrid) return;
    ui.shopGrid.innerHTML = '';
    if (ui.shopMoney) ui.shopMoney.textContent = '🪙 ' + hudMoney;

    const vente = (shopState.mode === 'sell');
    let liste;
    if (vente) {
      // On ne vend que ce qu'on possède, et jamais sa dernière Pokéball.
      liste = [];
      const vus = {};
      const source = shopState.stock.slice();
      const inv = shopInventory();
      Object.keys(inv).forEach(function (id) {
        if (!source.some(function (it) { return it && it.id === id; })) source.push(itemMeta(id));
      });
      source.forEach(function (it) {
        if (!it || vus[it.id]) return;
        vus[it.id] = true;
        if (shopOwned(it.id) <= 0) return;
        if (!it.price) return;                 // la Ball Maîtresse ne se revend pas
        liste.push(it);
      });
    } else {
      liste = shopState.stock.filter(function (it) { return it && it.price > 0; });
    }

    if (!liste.length) {
      el('p', 'shop-empty', ui.shopGrid, vente
        ? 'Tu n’as rien à vendre pour l’instant — garde tes trésors !'
        : 'L’étal est vide aujourd’hui. Reviens plus tard !');
      return;
    }

    liste.forEach(function (item) {
      const prix = vente ? sellPriceOf(item) : (item.price | 0);
      const possede = shopOwned(item.id);
      const card = el('div', 'shop-card', ui.shopGrid);
      card.style.setProperty('--item-color', item.color || '#41a6f6');
      // Repère pour la navigation au clavier (voir navEcran()) : toutes les
      // cartes d'un écran portent `data-nav`, et c'est la seule chose dont la
      // navigation a besoin pour fonctionner sur n'importe lequel des écrans.
      card.setAttribute('data-nav', '1');

      const top = el('div', 'sc-top', card);
      el('span', 'sc-icon', top, item.icon || '🎁');
      const titre = el('span', 'sc-titles', top);
      el('span', 'sc-name', titre, item.name || item.id);
      el('span', 'sc-price', titre, '🪙 ' + prix + (vente ? ' à la revente' : ''));

      el('p', 'sc-desc', card, item.description || '');
      if (item.tagline) el('p', 'sc-tag', card, '« ' + item.tagline + ' »');
      el('div', 'sc-owned', card, possede > 0 ? ('Tu en as déjà ' + possede) : 'Tu n’en as pas encore');

      // Réglage de la quantité : deux gros boutons, pas un champ de saisie.
      const rowQ = el('div', 'sc-qty', card);
      const moins = el('button', 'sc-step', rowQ, '−');
      const nb = el('span', 'sc-n', rowQ, String(shopQty(item.id)));
      const plus = el('button', 'sc-step', rowQ, '+');
      moins.type = 'button'; plus.type = 'button';

      const maxi = function () {
        if (vente) return Math.max(1, possede);
        return Math.max(1, prix > 0 ? Math.floor(hudMoney / prix) : 1);
      };
      const bouton = el('button', 'sc-buy', card, '');
      bouton.type = 'button';

      const refresh = function () {
        const q = Math.min(shopQty(item.id), Math.max(1, maxi()));
        shopState.qty[item.id] = q;
        nb.textContent = String(q);
        const total = prix * q;
        if (vente) {
          bouton.textContent = '💰 Vendre ×' + q + '  (+' + total + ')';
          bouton.disabled = possede < q;
        } else {
          bouton.textContent = '🛒 Acheter ×' + q + '  (−' + total + ')';
          bouton.disabled = total > hudMoney;
        }
        bouton.classList.toggle('disabled', bouton.disabled);
        moins.disabled = q <= 1;
        plus.disabled = q >= maxi();
      };

      moins.addEventListener('click', function () { shopState.qty[item.id] = shopQty(item.id) - 1; refresh(); });
      plus.addEventListener('click', function () { shopState.qty[item.id] = shopQty(item.id) + 1; refresh(); });
      // La navigation au clavier pilote ces trois boutons sans les chercher
      // dans le DOM : ←/→ règlent la quantité, Entrée valide.
      card._moins = moins; card._plus = plus; card._valider = bouton;
      bouton.addEventListener('click', function () {
        const q = shopQty(item.id);
        const cb = vente ? shopState.onSell : shopState.onBuy;
        if (typeof cb !== 'function') { toast('La caisse est fermée…', '🔒'); return; }
        try { cb(item.id, q); } catch (e) { console.warn('[hud3d] boutique :', e); }
        shopState.qty[item.id] = 1;
        renderShopGrid();
      });
      refresh();
    });
  }

  /**
   * @param {object} o { welcome, stock:[item], money, owned:{id:qty},
   *                     onBuy(id,qty), onSell(id,qty), onClose() }
   */
  function openShop(o) {
    if (!ui.shopOverlay) return;
    o = o || {};
    shopState.stock = Array.isArray(o.stock) ? o.stock.slice() : [];
    // On accepte aussi une simple liste d'ids : le HUD sait retrouver l'objet.
    shopState.stock = shopState.stock.map(function (it) {
      return (typeof it === 'string') ? itemMeta(it) : it;
    });
    shopState.owned = (o.owned && typeof o.owned === 'object') ? o.owned : {};
    shopState.welcome = o.welcome || '';
    shopState.onBuy = (typeof o.onBuy === 'function') ? o.onBuy : null;
    shopState.onSell = (typeof o.onSell === 'function') ? o.onSell : null;
    shopState.onClose = (typeof o.onClose === 'function') ? o.onClose : null;
    shopState.qty = {};
    if (typeof o.money === 'number') setMoney(o.money);

    if (!shopState.welcome) {
      const shop = SHOP();
      if (shop && typeof shop.shopWelcome === 'function') {
        try { shopState.welcome = shop.shopWelcome(); } catch (e) { /* tant pis */ }
      }
    }
    ui.shopWelcome.textContent = shopState.welcome || 'Bienvenue ! Tout ce qu’il te faut pour l’aventure.';

    setShopMode('buy');
    show(ui.shopOverlay);
    navReset(ui.shopOverlay);
    replayAnim(ui.shopOverlay, 'overlay');
    showCompass(false);
  }

  function closeShop() {
    if (!ui.shopOverlay || ui.shopOverlay.classList.contains('hidden')) return;
    hide(ui.shopOverlay);
    showCompass(true);
    const cb = shopState.onClose;
    shopState.onClose = null;
    if (cb) { try { cb(); } catch (e) { console.warn('[hud3d] fermeture de la boutique :', e); } }
  }

  // ===========================================================================
  //  JOURNAL DE QUÊTE (touche J) — CONTRAT3 §5 et §11.3, demande n°3
  // ===========================================================================

  const QUEST_ETAT = {
    inconnue: { label: 'Pas encore entendue', cls: 'inconnue', icon: '❔' },
    entendue: { label: 'La légende court…', cls: 'entendue', icon: '👂' },
    ouverte: { label: 'Le sanctuaire est ouvert !', cls: 'ouverte', icon: '🔓' },
    accomplie: { label: 'Quête accomplie !', cls: 'accomplie', icon: '🏆' },
  };

  function buildJournalOverlay() {
    const ov = el('div', 'overlay hidden', hudRoot);
    ov.id = 'journal-overlay';
    const frame = el('div', 'journal-frame', ov);
    el('h2', null, frame, '📖 Le journal des légendes');
    ui.journalList = el('div', 'journal-list', frame);
    el('p', 'hint', frame, '↑↓ parcourir les légendes · J ou Échap : refermer le journal');
    ov.addEventListener('click', function (ev) { if (ev.target === ov) closeJournal(); });
    ui.journalOverlay = ov;
  }

  /** @param {Array} entries — exactement le tableau rendu par quest.journal() */
  function openJournal(entries) {
    if (!ui.journalOverlay) return;
    let list = Array.isArray(entries) ? entries : null;
    if (!list) {
      const q = R3ref.get('quest');
      if (q && typeof q.journal === 'function') {
        try { list = q.journal(); } catch (e) { list = null; }
      }
    }
    ui.journalList.innerHTML = '';
    if (!list || !list.length) {
      el('p', 'hint', ui.journalList, 'Ton journal est encore vide. Parle aux gens des villages !');
    } else {
      list.forEach(function (q) {
        const etat = QUEST_ETAT[q.etat] || QUEST_ETAT.inconnue;
        const card = el('div', 'quest-card ' + etat.cls, ui.journalList);
        card.style.setProperty('--quest-color', q.couleur || '#f1c40f');
        card.setAttribute('data-nav', '1');     // navigation au clavier

        const head = el('div', 'qc-head', card);
        el('span', 'qc-icon', head, q.icone || '🏅');
        const t = el('span', 'qc-titles', head);
        el('span', 'qc-title', t, q.titre || 'Quête');
        el('span', 'qc-region', t, q.regionName || regionName(q.region));
        el('span', 'qc-state', head, etat.icon + ' ' + etat.label);

        el('p', 'qc-line', card, q.ligne || '');
        if (q.sanctuaire) el('p', 'qc-sanct', card, '⛩️ ' + q.sanctuaire);

        // Une petite barre de progression : « où en suis-je ? » en un coup d'œil.
        const total = q.total | 0;
        if (total > 0) {
          const pris = Math.min(total, q.captures | 0);
          const bar = el('div', 'qc-bar', card);
          const fill = el('div', 'qc-bar-fill', bar);
          fill.style.width = Math.round((pris / total) * 100) + '%';
          el('span', 'qc-count', card, '✨ ' + pris + ' / ' + total + ' légendaires');
        }
        if (q.fait) el('div', 'qc-done', card, '🏆 Bravo, cette légende est complète !');
      });
    }
    show(ui.journalOverlay);
    navReset(ui.journalOverlay);
    replayAnim(ui.journalOverlay, 'overlay');
    showCompass(false);
  }

  function closeJournal() { hide(ui.journalOverlay); showCompass(true); }

  // ===========================================================================
  //  ÉVOLUTION (CONTRAT3 §11.3 — demande n°4)
  // ---------------------------------------------------------------------------
  //  2,5 secondes exactement, plein écran, NON interruptible : c'est le moment
  //  de gloire de la créature, on le laisse jouer jusqu'au bout. Le HUD avale
  //  les touches pendant ce temps-là (voir onGlobalKeydown).
  // ===========================================================================

  let evoBusy = false;
  let evoPendingDone = null;     // le onDone de l'évolution en cours
  const EVO_TIMERS = [];

  function buildEvolutionOverlay() {
    const ov = el('div', 'evo-overlay hidden', hudRoot);
    const stage = el('div', 'evo-stage', ov);
    ui.evoThumb = el('div', 'evo-thumb', stage);
    ui.evoFlash = el('div', 'evo-flash', stage);
    ui.evoTitle = el('div', 'evo-title', ov, '');
    ui.evoText = el('div', 'evo-text', ov, '');
    ui.evoStage = stage;
    ui.evoOverlay = ov;
  }

  function evoClearTimers() {
    while (EVO_TIMERS.length) clearTimeout(EVO_TIMERS.pop());
  }

  function evoThumbOf(speciesId) {
    const dex = DEX();
    let sp = null;
    if (dex && typeof dex.get === 'function') {
      try { sp = dex.get(speciesId); } catch (e) { sp = null; }
    }
    return thumbFor(sp, 168);
  }

  /**
   * @param {object} o { fromName, toName, message, speciesId, fromSpeciesId, onDone() }
   */
  function showEvolution(o) {
    o = o || {};
    const fini = function () {
      if (typeof o.onDone === 'function') {
        try { o.onDone(); } catch (e) { console.warn('[hud3d] fin d’évolution :', e); }
      }
    };
    if (!ui.evoOverlay) { fini(); return; }
    // Deux évolutions d'affilée (une équipe qui monte de plusieurs niveaux) :
    // on enchaîne, mais on n'oublie JAMAIS de rendre la main sur la première,
    // sinon game3d resterait à attendre un onDone qui ne viendrait pas.
    evoClearTimers();
    if (evoPendingDone) {
      const precedent = evoPendingDone;
      evoPendingDone = null;
      try { precedent(); } catch (e) { console.warn('[hud3d] fin d’évolution :', e); }
    }
    evoBusy = true;
    evoPendingDone = fini;

    const de = o.fromName || 'Ta créature';
    const vers = o.toName || 'sa nouvelle forme';

    ui.evoThumb.innerHTML = '';
    ui.evoThumb.appendChild(o.fromSpeciesId ? evoThumbOf(o.fromSpeciesId) : evoThumbOf(o.speciesId));
    ui.evoTitle.textContent = 'Que se passe-t-il ?';
    ui.evoText.textContent = de + ' se met à briller…';

    ui.evoStage.className = 'evo-stage phase-blanchit';
    show(ui.evoOverlay);
    replayAnim(ui.evoOverlay, 'evo-overlay');

    // 1,2 s : l'éclat blanc, et on échange la silhouette contre la nouvelle.
    EVO_TIMERS.push(setTimeout(function () {
      ui.evoStage.className = 'evo-stage phase-eclat';
      ui.evoThumb.innerHTML = '';
      ui.evoThumb.appendChild(evoThumbOf(o.speciesId));
    }, 1200));

    // 1,7 s : la révélation.
    EVO_TIMERS.push(setTimeout(function () {
      ui.evoStage.className = 'evo-stage phase-revele';
      ui.evoTitle.textContent = '✨ ' + vers + ' ✨';
      ui.evoText.textContent = o.message || (de + ' a évolué en ' + vers + ' !');
    }, 1700));

    // 2,5 s : rideau. Jamais plus, jamais moins.
    EVO_TIMERS.push(setTimeout(function () {
      hide(ui.evoOverlay);
      evoBusy = false;
      evoPendingDone = null;
      fini();
    }, 2500));
  }

  function evolutionBusy() { return evoBusy; }

  // ===========================================================================
  //  APPRENDRE UNE CAPACITÉ QUAND LES QUATRE PLACES SONT PRISES
  //  (demande de Robin : « on ne peut pas faire apprendre les nouvelles
  //   attaques »)
  //
  //  Jusqu'ici le jeu se contentait de dire « pas de place pour Lame Feuille »
  //  et la capacité était perdue pour toujours. C'est l'écran qui manquait —
  //  `team3d.gainXp()` et `evolve3d` mettaient déjà les capacités « en attente »
  //  en précisant dans leurs commentaires que hud3d poserait la question.
  //
  //  Deux précautions pour un enfant de 10 ans : choisir NE VALIDE PAS (il faut
  //  ensuite appuyer sur le bouton du bas, qui écrit en toutes lettres ce qui
  //  va se passer), et « Ne rien oublier » est toujours à portée, y compris
  //  avec Échap.
  // ===========================================================================

  const learnState = { open: false, cursor: 0, moves: [], onChoose: null, newId: null };

  function buildLearnOverlay() {
    const ov = el('div', 'overlay hidden', hudRoot);
    ov.id = 'learn-overlay';
    const frame = el('div', 'learn-frame', ov);
    ui.learnTitle = el('h2', 'learn-title', frame, '');
    ui.learnNew = el('div', 'learn-new', frame);
    ui.learnQuestion = el('p', 'learn-question', frame, '');
    ui.learnGrid = el('div', 'learn-grid', frame);
    ui.learnKeep = el('button', 'learn-keep', frame, '🚫 Ne rien oublier');
    ui.learnKeep.type = 'button';
    ui.learnKeep.addEventListener('click', function () { setLearnCursor(4); });
    ui.learnGo = el('button', 'learn-go', frame, '');
    ui.learnGo.type = 'button';
    ui.learnGo.addEventListener('click', function () { validerLearn(); });
    el('p', 'hint', frame, '↑ ↓ ← → choisir  ·  Espace valider  ·  Échap ne rien oublier');
    ui.learnOverlay = ov;
    ui.learnCells = [];
  }

  /**
   * @param {object} o { monName, moveId, moves:[{id,pp,ppMax}], onChoose }
   *   `onChoose(index)` : 0..3 = la capacité à oublier, -1 = ne rien oublier.
   *   Appelée UNE seule fois, quoi qu'il arrive.
   */
  function showLearnMove(o) {
    o = o || {};
    const rendre = function (i) {
      const cb = learnState.onChoose;
      learnState.onChoose = null;
      if (typeof cb === 'function') {
        try { cb(i); } catch (e) { console.warn('[hud3d] choix de capacité :', e); }
      }
    };
    if (!ui.learnOverlay) { rendre(-1); return; }
    // Deux capacités d'affilée : on n'oublie jamais de rendre la main sur la
    // précédente, sinon game3d attendrait un `onChoose` qui ne viendrait pas.
    if (learnState.onChoose) rendre(-1);

    const nom = o.monName || 'Ta créature';
    const nouvelle = moveInfo(o.moveId);
    learnState.moves = (Array.isArray(o.moves) ? o.moves : []).slice(0, 4);
    learnState.onChoose = (typeof o.onChoose === 'function') ? o.onChoose : null;
    learnState.newId = o.moveId;
    learnState.open = true;

    ui.learnTitle.textContent = '✨ ' + nom + ' peut apprendre ' + (nouvelle.name || o.moveId) + ' !';
    ui.learnNew.innerHTML = '';
    ui.learnNew.appendChild(carteCapacite(o.moveId, null, 'learn-card neuve'));
    ui.learnQuestion.textContent =
      'Mais il connaît déjà quatre capacités. Laquelle doit-il oublier ?';

    ui.learnGrid.innerHTML = '';
    ui.learnCells = [];
    learnState.moves.forEach(function (slot, i) {
      const cell = carteCapacite((slot && slot.id) || slot, slot, 'learn-card');
      cell.addEventListener('mouseenter', function () { setLearnCursor(i); });
      cell.addEventListener('click', function () { setLearnCursor(i); });
      ui.learnGrid.appendChild(cell);
      ui.learnCells.push(cell);
    });

    setLearnCursor(0);
    show(ui.learnOverlay);
    replayAnim(ui.learnOverlay, 'overlay');
    showCompass(false);
  }

  /** Une carte de capacité, réutilisée pour la nouvelle et pour les quatre
   *  anciennes. `slot` porte les PP quand on les connaît. */
  function carteCapacite(moveId, slot, cls) {
    const move = moveInfo(moveId);
    const card = el('button', cls || 'learn-card', null);
    card.type = 'button';
    card.style.setProperty('--type-color', typeInfo(move.type).color);
    const tete = el('span', 'mv-head', card);
    el('span', 'mv-name', tete, move.name || moveId);
    tete.appendChild(typeBadge(move.type, true));
    el('span', 'mv-info', card, moveShortDesc(move));
    const pp = (slot && slot.pp !== undefined) ? slot.pp : move.pp;
    const ppMax = (slot && slot.ppMax !== undefined) ? slot.ppMax : move.pp;
    el('span', 'mv-pp', card, 'PP ' + pp + '/' + ppMax);
    return card;
  }

  /** 0..3 : une capacité à oublier. 4 : ne rien oublier. */
  function setLearnCursor(i) {
    learnState.cursor = clamp(i, 0, 4);
    for (let k = 0; k < ui.learnCells.length; k++) {
      ui.learnCells[k].classList.toggle('selected', k === learnState.cursor);
    }
    if (ui.learnKeep) ui.learnKeep.classList.toggle('selected', learnState.cursor === 4);
    // Le bouton du bas DIT ce qui va se passer : c'est lui qui valide, jamais
    // le simple fait de cliquer une carte.
    if (!ui.learnGo) return;
    const nouvelle = moveInfo(learnState.newId);
    if (learnState.cursor === 4) {
      ui.learnGo.textContent = '✔️ Ne pas apprendre ' + (nouvelle.name || '');
      ui.learnGo.classList.remove('danger');
    } else {
      const slot = learnState.moves[learnState.cursor];
      const vieille = moveInfo((slot && slot.id) || slot);
      ui.learnGo.textContent = '✔️ Oublier ' + (vieille.name || '?')
        + ' et apprendre ' + (nouvelle.name || '?');
      ui.learnGo.classList.add('danger');
    }
  }

  function validerLearn() {
    if (!learnState.open) return;
    const i = (learnState.cursor === 4) ? -1 : learnState.cursor;
    closeLearnMove();
    const cb = learnState.onChoose;
    learnState.onChoose = null;
    if (typeof cb === 'function') {
      try { cb(i); } catch (e) { console.warn('[hud3d] choix de capacité :', e); }
    }
  }

  function closeLearnMove() {
    learnState.open = false;
    if (ui.learnOverlay) hide(ui.learnOverlay);
    showCompass(true);
  }

  function learnBusy() { return !!learnState.open; }

  /** Les touches de l'écran. -> true si la touche a été consommée. */
  function onLearnKey(ev) {
    if (!learnState.open) return false;
    const k = ev.key;
    const n = ui.learnCells.length;      // 0..n-1 les capacités, n… le refus
    if (k === 'Escape') { setLearnCursor(4); validerLearn(); return true; }
    if (k === ' ' || k === 'Enter') { validerLearn(); return true; }
    if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'z' || k === 'Z') {
      setLearnCursor(learnState.cursor >= 4 ? Math.max(0, n - 1) : Math.max(0, learnState.cursor - 2));
      return true;
    }
    if (k === 'ArrowDown' || k === 's' || k === 'S') {
      setLearnCursor(learnState.cursor + 2 >= n ? 4 : learnState.cursor + 2);
      return true;
    }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'q' || k === 'Q') {
      setLearnCursor(Math.max(0, learnState.cursor - 1));
      return true;
    }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') {
      setLearnCursor(Math.min(4, learnState.cursor + 1));
      return true;
    }
    if (k >= '1' && k <= '4') { setLearnCursor(parseInt(k, 10) - 1); return true; }
    return false;
  }

  // ===========================================================================
  //  ACADÉMIE — choix du type Téra (CONTRAT3 §7, demande n°10)
  // ---------------------------------------------------------------------------
  //  Les types sont TOUJOURS itérés depuis la table vivante (o.types, sinon
  //  types.ORDER, sinon le repli du haut de ce fichier) : le nombre de types
  //  n'est jamais écrit en dur, il en restera 19 aujourd'hui et davantage
  //  demain sans toucher une ligne d'ici.
  // ===========================================================================

  const academyState = { unlocked: false, types: null, team: [], onUnlock: null, onPick: null, onClose: null, pick: null };

  function buildAcademyOverlay() {
    const ov = el('div', 'overlay hidden', hudRoot);
    ov.id = 'academy-overlay';
    const frame = el('div', 'academy-frame', ov);
    el('h2', null, frame, '🏰 L’Académie de Téracristallisation');
    ui.academyIntro = el('p', 'academy-intro', frame, '');

    ui.academyLock = el('div', 'academy-lock', frame);
    el('p', null, ui.academyLock,
      'Ici, on apprend à faire briller sa créature comme un cristal : elle change de type, ' +
      'frappe plus fort et encaisse mieux, une fois par combat.');
    ui.academyUnlockBtn = el('button', null, ui.academyLock, '💎 Apprendre la Téracristallisation !');
    ui.academyUnlockBtn.type = 'button';
    ui.academyUnlockBtn.addEventListener('click', function () {
      if (typeof academyState.onUnlock === 'function') {
        try { academyState.onUnlock(); } catch (e) { console.warn('[hud3d] académie :', e); }
      }
      academyState.unlocked = true;
      renderAcademy();
      toast('Tu sais Téracristalliser ! Choisis un type pour tes créatures.', '💎');
    });

    const body = el('div', 'academy-body', frame);
    const left = el('div', 'academy-team', body);
    el('h3', null, left, 'Quelle créature veux-tu former ?');
    ui.academyTeamGrid = el('div', 'academy-team-grid', left);
    const right = el('div', 'academy-types', body);
    el('h3', null, right, 'Choisis son type Téra');
    ui.academyTypeGrid = el('div', 'academy-type-grid', right);
    ui.academyBody = body;

    el('p', 'hint', frame, '↑↓ choisir · ←→ changer de colonne · Entrée : valider · Échap : quitter');
    const close = el('button', null, frame, 'Merci, au revoir !');
    close.type = 'button';
    close.addEventListener('click', closeAcademy);
    ov.addEventListener('click', function (ev) { if (ev.target === ov) closeAcademy(); });
    ui.academyOverlay = ov;
  }

  /** La liste des types à proposer — jamais un nombre écrit en dur. */
  function academyTypeList() {
    if (Array.isArray(academyState.types) && academyState.types.length) return academyState.types;
    return typeOrder().map(function (id) {
      const t = typeInfo(id);
      return { id: id, label: t.label, color: t.color, icon: t.icon };
    });
  }

  function monUid(mon) { return (mon && (mon.uid || mon.id)) || null; }

  function renderAcademy() {
    if (!ui.academyOverlay) return;
    const dev = academyState.unlocked;
    ui.academyLock.classList.toggle('hidden', dev);
    ui.academyBody.classList.toggle('hidden', !dev);
    ui.academyIntro.textContent = dev
      ? 'Un maître cristallier peut changer le type Téra d’une créature — une seule fois par visite.'
      : 'Le grand château aux quatre tours… c’est ici qu’on apprend le secret des cristaux.';
    if (!dev) return;

    const tera = R3ref.get('tera');
    const equipe = academyState.team.length ? academyState.team : ((TEAM() && TEAM().team) || []);

    // --- la colonne des créatures ---
    ui.academyTeamGrid.innerHTML = '';
    if (!equipe.length) {
      el('p', 'hint', ui.academyTeamGrid, 'Tu n’as aucune créature à former.');
    }
    equipe.forEach(function (mon) {
      const sp = teamSlotLabel(mon);
      let libre = true;
      if (tera && typeof tera.canSetTeraType === 'function') {
        try { libre = !!tera.canSetTeraType(mon); } catch (e) { libre = true; }
      }
      let actuel = null;
      if (tera && typeof tera.teraTypeOf === 'function') {
        try { actuel = tera.teraTypeOf(mon); } catch (e) { actuel = mon.teraType || null; }
      } else actuel = mon.teraType || (mon.types && mon.types[0]) || null;

      const card = el('button', 'academy-mon' + (libre ? '' : ' servie') +
        (monUid(mon) === academyState.pick ? ' choisie' : ''), ui.academyTeamGrid);
      card.type = 'button';
      // Deux colonnes navigables : ←/→ passent de l'une à l'autre, ↑/↓ montent
      // et descendent dans celle où l'on est.
      card.setAttribute('data-nav', '1');
      card.setAttribute('data-col', 'mon');
      card.appendChild(thumbFor(sp, 56));
      el('div', 'am-name', card, monLabel(mon));
      const badge = el('div', 'am-tera', card);
      badge.appendChild(typeBadge(actuel, true));
      if (!libre) el('div', 'am-note', card, 'Déjà formée aujourd’hui');
      card.disabled = !libre;
      card.addEventListener('click', function () {
        academyState.pick = monUid(mon);
        renderAcademy();
      });
    });

    // --- la colonne des types ---
    ui.academyTypeGrid.innerHTML = '';
    const choisi = academyState.pick;
    academyTypeList().forEach(function (t) {
      const b = el('button', 'academy-type', ui.academyTypeGrid);
      b.type = 'button';
      b.setAttribute('data-nav', '1');
      b.setAttribute('data-col', 'type');
      b.style.setProperty('--type-color', t.color || typeInfo(t.id).color);
      el('span', 'at-icon', b, t.icon || typeInfo(t.id).icon || '◇');
      el('span', 'at-label', b, t.label || typeInfo(t.id).label || t.id);
      b.disabled = !choisi;
      b.title = choisi ? 'Donner le type ' + (t.label || t.id) : 'Choisis d’abord une créature à gauche.';
      b.addEventListener('click', function () {
        if (!choisi) { toast('Choisis d’abord une créature à gauche !', '👈'); return; }
        if (typeof academyState.onPick === 'function') {
          try { academyState.onPick(choisi, t.id); } catch (e) { console.warn('[hud3d] académie :', e); }
        }
        academyState.pick = null;
        renderAcademy();
      });
    });
  }

  /**
   * @param {object} o { unlocked, types, team, onUnlock(), onPick(uid,typeId), onClose() }
   */
  function openAcademy(o) {
    if (!ui.academyOverlay) return;
    o = o || {};
    const tera = R3ref.get('tera');
    let dev = o.unlocked;
    if (dev === undefined && tera && typeof tera.isUnlocked === 'function') {
      try { dev = tera.isUnlocked(); } catch (e) { dev = false; }
    }
    academyState.unlocked = !!dev;
    academyState.types = Array.isArray(o.types) && o.types.length ? o.types : null;
    academyState.team = Array.isArray(o.team) ? o.team.slice() : [];
    academyState.onUnlock = (typeof o.onUnlock === 'function') ? o.onUnlock : null;
    academyState.onPick = (typeof o.onPick === 'function') ? o.onPick : null;
    academyState.onClose = (typeof o.onClose === 'function') ? o.onClose : null;
    academyState.pick = null;
    renderAcademy();
    show(ui.academyOverlay);
    navReset(ui.academyOverlay);
    replayAnim(ui.academyOverlay, 'overlay');
    showCompass(false);
  }

  function closeAcademy() {
    if (!ui.academyOverlay || ui.academyOverlay.classList.contains('hidden')) return;
    hide(ui.academyOverlay);
    showCompass(true);
    const cb = academyState.onClose;
    academyState.onClose = null;
    if (cb) { try { cb(); } catch (e) { console.warn('[hud3d] fermeture de l’académie :', e); } }
  }

  // ===========================================================================
  //  ÉCRAN D'AIDE (touche H)
  //  Les commandes n'étaient expliquées qu'UNE FOIS, dans le message de
  //  bienvenue, puis en 11 px tout en bas de l'écran. Un enfant de 10 ans qui
  //  reprend sa partie trois jours plus tard a oublié la moitié des touches et
  //  n'a aucun moyen de les revoir. H les rappelle toutes, à toute heure.
  //  H était libre : aucune autre touche du jeu ne l'utilise (vérifié dans le
  //  `switch` de game3d.js, dans onBattleKey et dans ce fichier).
  // ===========================================================================

  const HELP_SECTIONS = [
    ['🚶 Se déplacer', [
      ['↑ ↓ ← →', 'marcher (ZQSD ou WASD marchent aussi)'],
      ['Maj + ← →', 'faire tourner la caméra autour de toi'],
      ['Molette', 'zoomer et dézoomer'],
    ]],
    ['✨ Agir', [
      ['Espace', 'parler, entrer, valider'],
      ['Échap', "fermer l'écran ouvert"],
    ]],
    ['🔴 Attraper', [
      ['B', 'lancer une Ball sur la créature en vue'],
      ['X', 'changer de Ball'],
      ['F', 'sortir ton compagnon de sa Ball'],
    ]],
    ['📖 Tes écrans', [
      ['E', 'ton équipe : soigner, réorganiser'],
      ['C', 'le Pokédex'],
      ['N', 'la carte de la région et du monde'],
      ['J', 'le journal des légendes'],
    ]],
    ['🎈 Voyager et régler', [
      ['T', "appeler le dirigeable, d'où que tu sois"],
      ['V', 'changer de vue (dont la vue subjective)'],
      ['M', 'couper ou remettre le son'],
      ['P', 'le compteur de vitesse (images, dessins, triangles)'],
      ['H', 'revoir cet écran quand tu veux'],
    ]],
  ];

  /** Appelle une fonction de `window.GAME3D` en le disant si elle manque.
   *  Le HUD doit rester utilisable même sans contrôleur (règle §1.4). */
  function gameCall(nom) {
    if (window.GAME3D && typeof window.GAME3D[nom] === 'function') {
      try { window.GAME3D[nom](); return true; }
      catch (e) { console.warn('[hud3d] ' + nom + ' a échoué :', e); }
    }
    toast('Cette commande n\'est pas disponible ici.', '⚠️');
    return false;
  }

  /** Comme `gameCall`, mais pour une fonction dont on veut la VALEUR, et sans
   *  toast : l'appelant sait quoi afficher quand elle manque. */
  function gameValue(nom) {
    if (window.GAME3D && typeof window.GAME3D[nom] === 'function') {
      try { return window.GAME3D[nom](); }
      catch (e) { console.warn('[hud3d] ' + nom + ' a échoué :', e); }
    }
    return null;
  }

  function buildHelpOverlay() {
    const ov = el('div', 'overlay hidden', hudRoot);
    ov.id = 'help-overlay';
    const frame = el('div', 'help-frame', ov);
    el('h2', null, frame, '❓ Les commandes');
    const grid = el('div', 'help-grid', frame);
    HELP_SECTIONS.forEach(function (sec) {
      const bloc = el('div', 'help-sec', grid);
      el('h3', null, bloc, sec[0]);
      sec[1].forEach(function (row) {
        const line = el('div', 'help-row', bloc);
        el('span', 'help-key', line, row[0]);
        el('span', 'help-txt', line, row[1]);
      });
    });
    el('p', 'help-note', frame,
      'En vue subjective, ← et → font tourner ton regard, ↑ et ↓ te font avancer et reculer.');

    // --- Mettre sa partie à l'abri (correction 2.8) --------------------------
    // La sauvegarde ne vit que dans ce navigateur : un nettoyage d'historique
    // suffisait à tout effacer. L'écran d'aide est le seul endroit calme du
    // jeu, toujours atteignable par H : c'est ici que ces deux boutons vivent.
    const sauve = el('div', 'help-save', frame);
    el('p', 'help-save-txt', sauve,
      'Ta partie est rangée dans ce navigateur. Garde-en une copie sur l\'ordinateur, on ne sait jamais !');
    const bExport = el('button', 'help-save-btn', sauve, '💾 Enregistrer ma partie dans un fichier');
    bExport.type = 'button';
    bExport.addEventListener('click', function () { gameCall('exportSave'); });
    const bImport = el('button', 'help-save-btn', sauve, '📂 Reprendre une partie depuis un fichier');
    bImport.type = 'button';
    bImport.addEventListener('click', function () { gameCall('importSave'); });

    buildRestartBlock(frame);

    el('p', 'hint', frame, 'H · Échap : fermer');
    const close = el('button', null, frame, 'Fermer');
    close.type = 'button';
    close.addEventListener('click', function () { closeHelp(); fakeKey('Escape'); });
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov) { closeHelp(); fakeKey('Escape'); }
    });
    ui.helpOverlay = ov;
  }

  // ---------------------------------------------------------------------------
  //  RECOMMENCER UNE NOUVELLE PARTIE (demande de Robin)
  //  Un bouton qui efface des mois de jeu ne se clique pas comme les autres :
  //    1. il est en bas de l'écran d'aide, séparé et de la couleur du danger ;
  //    2. le premier clic n'efface RIEN — il ouvre une confirmation qui dit
  //       exactement ce qui va disparaître (créatures, badges, pièces) ;
  //    3. cette confirmation propose d'abord d'enregistrer la partie ;
  //    4. le bouton « Oui » ne s'arme qu'au bout de deux secondes, pour qu'un
  //       double-clic un peu rapide ne traverse pas les deux étapes d'un coup ;
  //    5. « Non, je garde ma partie » est le bouton par défaut, en clair.
  // ---------------------------------------------------------------------------

  const RESTART_ARME_MS = 2000;

  /** Le panneau (calme ou confirmation) et le compte à rebours en cours. */
  const restartUi = { calme: null, confirme: null, oui: null, perte: null, timer: 0 };

  /** Phrase de ce que Robin va perdre. Sans chiffres lisibles, « tout effacer »
   *  reste une abstraction ; avec eux, il pèse vraiment sa décision. */
  function restartPerteTexte() {
    const s = gameValue('saveSummary');
    if (!s) return 'Tu vas perdre ta partie : elle ne pourra pas revenir.';
    const bouts = [];
    if (s.creatures) bouts.push(s.creatures + (s.creatures > 1 ? ' créatures' : ' créature'));
    if (s.badges) bouts.push(s.badges + (s.badges > 1 ? ' badges' : ' badge'));
    if (s.argent) bouts.push(s.argent + (s.argent > 1 ? ' pièces' : ' pièce'));
    if (!bouts.length) return 'Ta partie vient de commencer : il n\'y a presque rien à perdre.';
    const liste = (bouts.length > 1)
      ? bouts.slice(0, -1).join(', ') + ' et ' + bouts[bouts.length - 1]
      : bouts[0];
    return 'Tu vas perdre ' + liste + '. Ça ne pourra pas revenir.';
  }

  function buildRestartBlock(frame) {
    const bloc = el('div', 'help-danger', frame);

    // --- 1er temps : le panneau calme ---------------------------------------
    const calme = el('div', 'help-danger-calme', bloc);
    el('p', 'help-save-txt', calme, 'Envie de tout refaire depuis le début, avec un autre compagnon ?');
    const bStart = el('button', 'help-danger-btn', calme, '🔄 Recommencer une nouvelle partie');
    bStart.type = 'button';
    bStart.addEventListener('click', function () { ouvrirConfirmationRestart(); });

    // --- 2e temps : la confirmation ------------------------------------------
    const conf = el('div', 'help-danger-confirme hidden', bloc);
    el('p', 'help-danger-titre', conf, '⚠️ Tout effacer et repartir de zéro ?');
    const perte = el('p', 'help-save-txt', conf, '');
    el('p', 'help-danger-note', conf,
      'Tu recommenceras au tout début : nouveau prénom, nouveau compagnon de départ.');
    const bGarder = el('button', 'help-save-btn', conf, '💾 D\'abord enregistrer ma partie dans un fichier');
    bGarder.type = 'button';
    bGarder.addEventListener('click', function () { gameCall('exportSave'); });
    const bOui = el('button', 'help-danger-btn', conf, 'Oui, tout effacer');
    bOui.type = 'button';
    bOui.addEventListener('click', function () {
      if (bOui.disabled) return;
      gameCall('restartGame');       // efface et recharge la page
    });
    const bNon = el('button', 'help-save-btn', conf, '↩️ Non, je garde ma partie');
    bNon.type = 'button';
    bNon.addEventListener('click', function () { fermerConfirmationRestart(); });

    restartUi.calme = calme;
    restartUi.confirme = conf;
    restartUi.oui = bOui;
    restartUi.perte = perte;
  }

  function ouvrirConfirmationRestart() {
    if (!restartUi.confirme) return;
    restartUi.perte.textContent = restartPerteTexte();
    hide(restartUi.calme);
    show(restartUi.confirme);
    armerBoutonRestart();
    // La confirmation naît tout en bas de l'écran d'aide, qui défile : sans ça,
    // Robin cliquerait un bouton puis ne verrait rien changer.
    try { restartUi.confirme.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    catch (e) { /* navigateur trop ancien : tant pis */ }
  }

  /** Le bouton « Oui » reste éteint deux secondes, en le disant. */
  function armerBoutonRestart() {
    const b = restartUi.oui;
    if (!b) return;
    if (restartUi.timer) { clearInterval(restartUi.timer); restartUi.timer = 0; }
    let reste = Math.ceil(RESTART_ARME_MS / 1000);
    b.disabled = true;
    b.textContent = 'Oui, tout effacer… (' + reste + ')';
    restartUi.timer = setInterval(function () {
      reste--;
      if (reste > 0) { b.textContent = 'Oui, tout effacer… (' + reste + ')'; return; }
      clearInterval(restartUi.timer);
      restartUi.timer = 0;
      b.disabled = false;
      b.textContent = 'Oui, tout effacer et recommencer';
    }, 1000);
  }

  /** Retour au panneau calme. Appelé aussi à chaque fermeture de l'aide : une
   *  confirmation laissée ouverte accueillerait Robin la fois suivante. */
  function fermerConfirmationRestart() {
    if (restartUi.timer) { clearInterval(restartUi.timer); restartUi.timer = 0; }
    if (!restartUi.confirme) return;
    hide(restartUi.confirme);
    show(restartUi.calme);
  }

  /** -> true si l'écran s'est VRAIMENT affiché. game3d s'en sert pour savoir
   *  s'il doit poser `state.screen = 'help'` ou jouer son repli en boîte de
   *  dialogue : si `buildHelpOverlay()` a échoué, `ui.helpOverlay` est absent
   *  et Robin se retrouvait sur un écran 'help' invisible dont seules Échap et
   *  H sortaient — sans jamais voir les commandes. */
  function openHelp() {
    if (!ui.helpOverlay) return false;
    fermerConfirmationRestart();   // on rouvre toujours sur le panneau calme
    show(ui.helpOverlay);
    replayAnim(ui.helpOverlay, 'overlay');
    showCompass(false);
    return true;
  }

  function closeHelp() {
    if (!ui.helpOverlay) return;
    fermerConfirmationRestart();
    hide(ui.helpOverlay);
    showCompass(true);
  }

  // ===========================================================================
  //  DIVERS : FPS, toasts, bouton muet, astuce de commandes
  // ===========================================================================

  /**
   * Durée d'affichage d'un toast, en millisecondes.
   * 2700 ms fixes, c'était réglé pour un adulte qui survole. Robin a 10 ans et
   * lit lentement : « Il faut y être allé à pied avant ! » disparaissait avant
   * la fin de la phrase. On compte donc environ 14 caractères par seconde,
   * avec une base pour l'apparition et la disparition.
   */
  function toastDuree(text) {
    const n = String(text || '').length;
    return Math.max(2600, Math.min(8000, 1800 + n * 70));
  }

  function toast(text, icon) {
    if (!ui.toasts) return;
    const t = el('div', 'toast', ui.toasts);
    if (icon) el('span', 'toast-icon', t, icon);
    t.appendChild(document.createTextNode(String(text)));
    // ⚠️ La durée est écrite DEUX FOIS : ici et dans l'animation CSS
    // `toast-vie` (css3d/hud3d.css). Les keyframes sont en pourcentages, donc
    // piloter `animationDuration` suffit à garder les deux d'accord — allonger
    // seulement le `setTimeout` laisserait un toast invisible à l'écran.
    const duree = toastDuree(text);
    t.style.animationDuration = duree + 'ms';
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, duree + 60);
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

  /** Un écran plein est-il ouvert ? (on n'y lance pas de Ball, par exemple) */
  function anyOverlayOpen() {
    const l = [ui.teamOverlay, ui.dexOverlay, ui.mapOverlay, ui.airshipOverlay,
      ui.shopOverlay, ui.journalOverlay, ui.academyOverlay, ui.helpOverlay];
    for (let i = 0; i < l.length; i++) {
      if (l[i] && !l[i].classList.contains('hidden')) return true;
    }
    const col = $('collection-overlay');
    if (col && !col.classList.contains('hidden')) return true;
    return false;
  }

  function onGlobalKeydown(ev) {
    const key = ev.key;

    // L'évolution est un moment de gloire : rien ne l'interrompt, pas même Échap.
    if (evoBusy) { ev.preventDefault(); ev.stopPropagation(); return; }

    // L'écran « quelle capacité oublier ? » prend TOUT le clavier tant qu'il
    // est ouvert : Robin doit répondre avant de reprendre sa partie, et aucune
    // autre touche ne doit le faire marcher derrière l'écran.
    if (learnState.open) {
      onLearnKey(ev);
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    // --- la touche X : changer de Ball (CONTRAT3 §11.2) ---------------------
    // Le HUD la consomme entièrement (stopPropagation) pour qu'aucun autre
    // module ne fasse tourner la sélection une deuxième fois dans la foulée.
    if ((key === 'x' || key === 'X') && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
      const cible = ev.target;
      const saisie = cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA');
      if (!saisie && !anyOverlayOpen()) {
        cycleBall(1);
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
    }

    // --- la touche J : le journal des légendes (CONTRAT3 §11.3) -------------
    // Le HUD l'ouvre lui-même en lisant quest.journal() : ainsi elle marche
    // même si game3d ne l'a pas branchée. game3d peut toujours appeler
    // hud.openJournal(entries) de son côté quand il veut fournir les données.
    if ((key === 'j' || key === 'J') && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
      const cible2 = ev.target;
      const saisie2 = cible2 && (cible2.tagName === 'INPUT' || cible2.tagName === 'TEXTAREA');
      if (!saisie2 && !anyOverlayOpen() && !liveBattle) {
        // On passe la main à game3d quand il est là : lui seul peut poser
        // `state.screen = 'journal'` et relâcher les touches de déplacement.
        // Sans ça, l'overlay s'ouvrait mais Robin continuait à marcher derrière.
        if (window.GAME3D && typeof window.GAME3D.journal === 'function') {
          try { window.GAME3D.journal(); } catch (e) { openJournal(null); }
        } else {
          openJournal(null);
        }
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
    }

    // --- la touche H : l'écran d'aide ---------------------------------------
    // Même schéma que J : le HUD sait l'ouvrir tout seul, mais laisse la main
    // à game3d quand il est là — lui seul peut poser `state.screen = 'help'`
    // et relâcher les touches de déplacement, sinon Robin marche derrière.
    if ((key === 'h' || key === 'H') && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
      const cible3 = ev.target;
      const saisie3 = cible3 && (cible3.tagName === 'INPUT' || cible3.tagName === 'TEXTAREA');
      const aideOuverte = ui.helpOverlay && !ui.helpOverlay.classList.contains('hidden');
      if (!saisie3 && (aideOuverte || (!anyOverlayOpen() && !liveBattle))) {
        if (aideOuverte) { closeHelp(); fakeKey('Escape'); }
        else if (window.GAME3D && typeof window.GAME3D.help === 'function') {
          try { window.GAME3D.help(); } catch (e) { openHelp(); }
        } else { openHelp(); }
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
    }

    if (ui.helpOverlay && !ui.helpOverlay.classList.contains('hidden')) {
      if (key === 'Escape') { closeHelp(); fakeKey('Escape'); ev.preventDefault(); ev.stopPropagation(); }
      return;
    }
    if (ui.shopOverlay && !ui.shopOverlay.classList.contains('hidden')) {
      if (key === 'Escape') { closeShop(); ev.preventDefault(); ev.stopPropagation(); return; }
      // Tab bascule Acheter / Vendre, comme les onglets à la souris.
      if (key === 'Tab' && ui.shopTabSell && ui.shopTabBuy) {
        (shopState.mode === 'sell' ? ui.shopTabBuy : ui.shopTabSell).click();
        navReset(ui.shopOverlay);
        ev.preventDefault(); ev.stopPropagation(); return;
      }
      if (navEcran(ui.shopOverlay, ev)) { ev.preventDefault(); ev.stopPropagation(); }
      return;
    }
    if (ui.journalOverlay && !ui.journalOverlay.classList.contains('hidden')) {
      if (key === 'Escape' || key === 'j' || key === 'J') {
        // `fakeKey('Escape')` rend la main à game3d, qui repasse `state.screen`
        // à 'world' — même schéma que l'écran Équipe juste en dessous.
        closeJournal(); fakeKey('Escape');
        ev.preventDefault(); ev.stopPropagation();
        return;
      }
      if (navEcran(ui.journalOverlay, ev)) { ev.preventDefault(); ev.stopPropagation(); }
      return;
    }
    if (ui.academyOverlay && !ui.academyOverlay.classList.contains('hidden')) {
      if (key === 'Escape') { closeAcademy(); ev.preventDefault(); ev.stopPropagation(); return; }
      if (navEcran(ui.academyOverlay, ev)) { ev.preventDefault(); ev.stopPropagation(); }
      return;
    }
    if (ui.teamOverlay && !ui.teamOverlay.classList.contains('hidden')) {
      // Sac ouvert : il capte les flèches et Échap le referme, sans quitter
      // l'écran Équipe — sinon Échap ferait tout disparaître d'un coup.
      if (sacEquipeOuvert()) {
        if (key === 'Escape') { fermeSacEquipe(); ev.preventDefault(); ev.stopPropagation(); return; }
        if (navEcran(ui.teamBag, ev)) { ev.preventDefault(); ev.stopPropagation(); return; }
        return;
      }
      if (key === 'Escape') { closeTeam(); fakeKey('Escape'); return; }
      // `U` comme « utiliser » : le raccourci du sac.
      if (key === 'u' || key === 'U') {
        ouvreSacEquipe(); ev.preventDefault(); ev.stopPropagation(); return;
      }
      if (teamHandleKey(ev)) { ev.preventDefault(); ev.stopPropagation(); return; }
      return;
    }
    if (ui.dexOverlay && !ui.dexOverlay.classList.contains('hidden')) {
      if (key === 'Escape') { closeDex(); fakeKey('Escape'); return; }
      if (dexNavKey(ev)) { ev.preventDefault(); ev.stopPropagation(); }
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

    // --- CONTRAT3 §11 : argent, Balls, boutique, journal, évolution, Téra ---
    setMoney: setMoney,
    money: money,
    showMoney: showMoney,
    setActiveBall: setActiveBall,
    activeBall: activeBall,
    setBallInventory: setBallInventory,
    cycleBall: cycleBall,
    onBallChange: onBallChange,

    openShop: openShop,
    closeShop: closeShop,

    openJournal: openJournal,
    closeJournal: closeJournal,

    // écran d'aide (touche H)
    openHelp: openHelp,
    closeHelp: closeHelp,

    showEvolution: showEvolution,
    evolutionBusy: evolutionBusy,

    // « Quelle capacité oublier ? » — appelé par game3d après une montée de
    // niveau ou une évolution, quand les quatre emplacements sont pris.
    showLearnMove: showLearnMove,
    learnBusy: learnBusy,

    openAcademy: openAcademy,
    closeAcademy: closeAcademy,
    setTeraState: setTeraState,

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
