// =============================================================================
//  core3d.js — SOCLE COMMUN de la version 3D du « Jeu de Robin »
// =============================================================================
//  Tous les modules js3d/* codent contre l'API décrite ici (voir CONTRACT.md).
//  Chargé APRÈS three.min.js et APRÈS js/world.js, js/npcs.js, js/creatures.js.
//
//  CONVENTIONS D'AXES (à respecter partout) :
//    tuile (tx, ty) du jeu 2D  ->  monde 3D (x = tx, z = ty), y = hauteur
//    1 tuile = 1 unité monde   (le jeu 2D utilisait TILE = 16 px)
//    dir 'up' = -z   'down' = +z   'left' = -x   'right' = +x
//    Un modèle de créature est construit centré en (0,0,0), posé sur y = 0,
//    et tient dans une boîte d'environ 1 unité de large pour 1 de haut.
// =============================================================================

const R3 = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Horloge : temps RÉEL en secondes (le jeu 2D animait sur un compteur de
  // frames, ce qui rendait les animations 2x plus rapides sur un écran 120 Hz).
  // ---------------------------------------------------------------------------
  const clock = { t: 0, dt: 0 };

  function tickClock(dtMs) {
    clock.dt = Math.min(0.05, dtMs / 1000);
    clock.t += clock.dt;
  }

  // ---------------------------------------------------------------------------
  // Réglages de qualité (ajustés à l'exécution par game3d.js)
  // ---------------------------------------------------------------------------
  const quality = {
    level: 'high',        // 'low' | 'medium' | 'high'
    shadows: true,
    shadowSize: 2048,
    pixelRatio: 2,
    fogDensity: 0.022,
    viewDistance: 46,     // tuiles
    particles: true,
    waterDetail: 1,       // 0 = plat coloré, 1 = shader complet
  };

  const QUALITY_PRESETS = {
    low:    { shadows: false, shadowSize: 512,  pixelRatio: 1,   fogDensity: 0.045, viewDistance: 26, particles: false, waterDetail: 0 },
    medium: { shadows: true,  shadowSize: 1024, pixelRatio: 1.5, fogDensity: 0.030, viewDistance: 36, particles: true,  waterDetail: 1 },
    high:   { shadows: true,  shadowSize: 2048, pixelRatio: 2,   fogDensity: 0.022, viewDistance: 46, particles: true,  waterDetail: 1 },
  };

  function setQuality(level) {
    const p = QUALITY_PRESETS[level];
    if (!p) return;
    quality.level = level;
    Object.assign(quality, p);
    listeners.quality.forEach((fn) => fn(quality));
  }

  const listeners = { quality: [] };
  function onQualityChange(fn) { listeners.quality.push(fn); }

  // ---------------------------------------------------------------------------
  // Aléatoire déterministe — réutilise hashPos() de js/world.js pour que les
  // variations 3D tombent aux mêmes endroits que les variations 2D.
  // ---------------------------------------------------------------------------
  function hash(x, y) {
    return (typeof hashPos === 'function') ? hashPos(x, y) : 0.5;
  }

  // Générateur séquentiel déterministe à partir d'une graine.
  function rng(seed) {
    let s = (seed | 0) || 1;
    return function () {
      s = (s ^ (s << 13)) | 0;
      s = (s ^ (s >>> 17)) | 0;
      s = (s ^ (s << 5)) | 0;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  // ---------------------------------------------------------------------------
  // CACHES — un matériau/une géométrie créés une seule fois puis partagés.
  // C'est ce qui garde le jeu fluide malgré des milliers d'objets.
  // ---------------------------------------------------------------------------
  const _mats = new Map();
  const _geos = new Map();

  /**
   * Matériau standard partagé.
   * @param {string|number} color  couleur hex ('#38b764' ou 0x38b764)
   * @param {object} [o]  { rough, metal, flat, transparent, opacity, emissive,
   *                        emissiveIntensity, side, depthWrite }
   */
  function mat(color, o) {
    o = o || {};
    const key = 'm|' + color + '|' + JSON.stringify(o);
    let m = _mats.get(key);
    if (m) return m;
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: o.rough !== undefined ? o.rough : 0.82,
      metalness: o.metal !== undefined ? o.metal : 0.0,
      flatShading: !!o.flat,
      transparent: !!o.transparent,
      opacity: o.opacity !== undefined ? o.opacity : 1,
      side: o.side || THREE.FrontSide,
      emissive: new THREE.Color(o.emissive || 0x000000),
      emissiveIntensity: o.emissiveIntensity !== undefined ? o.emissiveIntensity : 1,
      depthWrite: o.depthWrite !== undefined ? o.depthWrite : true,
    });
    _mats.set(key, m);
    return m;
  }

  /** Matériau translucide façon gelée (méduse, goutte d'eau, ailes de fée). */
  function matGlass(color, opacity) {
    return mat(color, {
      transparent: true,
      opacity: opacity !== undefined ? opacity : 0.6,
      rough: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  /** Matériau lumineux (étincelles, flammes, éclairs). */
  function matGlow(color, intensity) {
    return mat(color, {
      emissive: color,
      emissiveIntensity: intensity !== undefined ? intensity : 0.9,
      rough: 0.4,
    });
  }

  const geo = {
    box(w, h, d) {
      const k = 'b|' + w + '|' + h + '|' + d;
      let g = _geos.get(k);
      if (!g) { g = new THREE.BoxGeometry(w, h, d); _geos.set(k, g); }
      return g;
    },
    sphere(r, seg) {
      seg = seg || 14;
      const k = 's|' + r + '|' + seg;
      let g = _geos.get(k);
      if (!g) { g = new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)); _geos.set(k, g); }
      return g;
    },
    cyl(rTop, rBot, h, seg) {
      seg = seg || 12;
      const k = 'c|' + rTop + '|' + rBot + '|' + h + '|' + seg;
      let g = _geos.get(k);
      if (!g) { g = new THREE.CylinderGeometry(rTop, rBot, h, seg); _geos.set(k, g); }
      return g;
    },
    cone(r, h, seg) {
      seg = seg || 12;
      const k = 'n|' + r + '|' + h + '|' + seg;
      let g = _geos.get(k);
      if (!g) { g = new THREE.ConeGeometry(r, h, seg); _geos.set(k, g); }
      return g;
    },
    torus(r, tube, seg) {
      seg = seg || 12;
      const k = 't|' + r + '|' + tube + '|' + seg;
      let g = _geos.get(k);
      if (!g) { g = new THREE.TorusGeometry(r, tube, Math.max(6, seg >> 1), seg); _geos.set(k, g); }
      return g;
    },
    plane(w, h) {
      const k = 'p|' + w + '|' + h;
      let g = _geos.get(k);
      if (!g) { g = new THREE.PlaneGeometry(w, h); _geos.set(k, g); }
      return g;
    },
  };

  // ---------------------------------------------------------------------------
  // PRIMITIVES DE MODÉLISATION
  // Chaque helper renvoie un THREE.Mesh prêt à être ajouté à un groupe.
  // Les positions sont TOUJOURS le centre de la forme.
  // ---------------------------------------------------------------------------

  function _place(mesh, x, y, z) {
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Boîte. box(w,h,d, couleur, x,y,z, opts) */
  function box(w, h, d, color, x, y, z, o) {
    return _place(new THREE.Mesh(geo.box(w, h, d), mat(color, o)), x, y, z);
  }

  /** Sphère. sphere(r, couleur, x,y,z, opts) */
  function sphere(r, color, x, y, z, o) {
    return _place(new THREE.Mesh(geo.sphere(r, (o && o.seg) || 14), mat(color, o)), x, y, z);
  }

  /** Ellipsoïde — LA primitive des créatures (équivalent 3D de ovalFill()).
   *  ellipsoid(rx, ry, rz, couleur, x,y,z, opts) */
  function ellipsoid(rx, ry, rz, color, x, y, z, o) {
    const m = new THREE.Mesh(geo.sphere(1, (o && o.seg) || 14), mat(color, o));
    m.scale.set(rx, ry, rz);
    return _place(m, x, y, z);
  }

  /** Cylindre. cyl(rTop, rBot, h, couleur, x,y,z, opts) */
  function cyl(rTop, rBot, h, color, x, y, z, o) {
    return _place(new THREE.Mesh(geo.cyl(rTop, rBot, h, (o && o.seg) || 12), mat(color, o)), x, y, z);
  }

  /** Cône. cone(r, h, couleur, x,y,z, opts) */
  function cone(r, h, color, x, y, z, o) {
    return _place(new THREE.Mesh(geo.cone(r, h, (o && o.seg) || 12), mat(color, o)), x, y, z);
  }

  /** Tore (anneaux, colliers, auréoles). torus(r, tube, couleur, x,y,z, opts) */
  function torus(r, tube, color, x, y, z, o) {
    return _place(new THREE.Mesh(geo.torus(r, tube, (o && o.seg) || 12), mat(color, o)), x, y, z);
  }

  /**
   * Aile / nageoire / pétale : forme plate arrondie, double face.
   * wing(longueur, largeur, couleur, x,y,z, opts)
   * L'aile pointe vers +x ; son point d'attache est à l'origine locale.
   */
  function wing(len, wid, color, x, y, z, o) {
    o = Object.assign({ side: THREE.DoubleSide }, o || {});
    const m = new THREE.Mesh(geo.sphere(1, 12), mat(color, o));
    m.scale.set(len, wid, 0.06 * Math.max(len, wid) * 2);
    return _place(m, x, y, z);
  }

  /**
   * Étoile extrudée à N branches, dans le plan XY, épaisseur sur Z.
   * star(branches, rExt, rInt, epaisseur, couleur, x,y,z, opts)
   */
  function star(branches, rOut, rIn, thick, color, x, y, z, o) {
    const k = 'star|' + branches + '|' + rOut + '|' + rIn + '|' + thick;
    let g = _geos.get(k);
    if (!g) {
      const shape = new THREE.Shape();
      const n = branches * 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r = (i % 2 === 0) ? rOut : rIn;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
      }
      shape.closePath();
      g = new THREE.ExtrudeGeometry(shape, {
        depth: thick, bevelEnabled: true,
        bevelThickness: thick * 0.3, bevelSize: rOut * 0.06, bevelSegments: 2,
      });
      g.center();
      _geos.set(k, g);
    }
    return _place(new THREE.Mesh(g, mat(color, o)), x, y, z);
  }

  /** Groupe : group(child1, child2, ...) ou group([tableau]) */
  function group() {
    const g = new THREE.Group();
    const args = (arguments.length === 1 && Array.isArray(arguments[0])) ? arguments[0] : Array.prototype.slice.call(arguments);
    args.forEach((c) => { if (c) g.add(c); });
    return g;
  }

  /** Paire symétrique sur l'axe X : le mesh fourni est cloné et miroité. */
  function mirrorX(mesh) {
    const c = mesh.clone();
    c.position.x = -mesh.position.x;
    c.rotation.y = -mesh.rotation.y;
    c.rotation.z = -mesh.rotation.z;
    return group(mesh, c);
  }

  /** Yeux « mignons » standard : deux billes noires + reflet blanc.
   *  eyes(ecart, y, z, rayon) — orientés vers +z (face à la caméra de combat) */
  function eyes(spread, y, z, r) {
    r = r || 0.055;
    const g = new THREE.Group();
    [-1, 1].forEach((s) => {
      const e = sphere(r, '#1a1c2c', s * spread, y, z);
      const hi = sphere(r * 0.42, '#ffffff', s * spread + r * 0.3, y + r * 0.35, z + r * 0.7);
      hi.castShadow = false;
      g.add(e, hi);
    });
    return g;
  }

  /** Joues roses de créature kawaii. */
  function blush(spread, y, z, r) {
    r = r || 0.05;
    const g = new THREE.Group();
    [-1, 1].forEach((s) => {
      const c = ellipsoid(r, r * 0.6, r * 0.4, '#ff8fb8', s * spread, y, z, { rough: 1 });
      c.castShadow = false;
      g.add(c);
    });
    return g;
  }

  function rot(obj, rx, ry, rz) { obj.rotation.set(rx || 0, ry || 0, rz || 0); return obj; }
  function pos(obj, x, y, z) { obj.position.set(x || 0, y || 0, z || 0); return obj; }
  function noShadow(obj) { obj.traverse((o) => { o.castShadow = false; o.receiveShadow = false; }); return obj; }

  /** Libère récursivement les géométries/matériaux NON partagés d'un objet. */
  function disposeTree(obj) {
    obj.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) {
        let cached = false;
        _geos.forEach((g) => { if (g === o.geometry) cached = true; });
        if (!cached) o.geometry.dispose();
      }
    });
    if (obj.parent) obj.parent.remove(obj);
  }

  // ---------------------------------------------------------------------------
  // TABLE DE STYLE DES 40 TUILES
  //   ground : couleur du sol (albédo — légèrement plus profond que la couleur
  //            2D, car l'éclairage 3D l'éclaircit)
  //   h      : hauteur du sol en unités (avant lissage par world3d.js)
  //   deco   : décor posé sur la tuile (null si aucun)
  //   water  : type de surface d'eau (null si aucune)
  //   roof   : couleur de toit, pour les décors 'house' / 'house2'
  // ---------------------------------------------------------------------------
  const TILE_STYLE = {
    // --- Forêt ---
    GRASS:        { ground: '#63b846', h: 0.00, deco: null },
    TALL_GRASS:   { ground: '#4a9c36', h: 0.00, deco: 'tallgrass' },
    FLOWERS:      { ground: '#63b846', h: 0.00, deco: 'flowers' },
    TREE:         { ground: '#559f3c', h: 0.05, deco: 'tree' },
    // --- Lac ---
    WATER:        { ground: '#1b3f78', h: -0.50, deco: null, water: 'lake' },
    SHALLOW:      { ground: '#3d86bd', h: -0.16, deco: null, water: 'shallow' },
    // --- Plage / mer ---
    SAND:         { ground: '#e3c68d', h: 0.00, deco: 'shell' },
    SEA:          { ground: '#132f5c', h: -0.70, deco: null, water: 'sea' },
    WAVES:        { ground: '#2f7fb8', h: -0.14, deco: null, water: 'waves' },
    // --- Plaine ---
    PATH:         { ground: '#c19a6b', h: 0.02, deco: null },
    PLAIN:        { ground: '#84c45c', h: 0.00, deco: null },
    TALL_PLAIN:   { ground: '#4f9e3f', h: 0.00, deco: 'tallgrass' },
    ROCK:         { ground: '#6fb84a', h: 0.04, deco: 'rock' },
    // --- Petite ville ---
    HOUSE_RED:    { ground: '#a5aab0', h: 0.03, deco: 'house',  roof: '#d1483f' },
    HOUSE_BLUE:   { ground: '#a5aab0', h: 0.03, deco: 'house',  roof: '#3355b8' },
    HOUSE_YELLOW: { ground: '#a5aab0', h: 0.03, deco: 'house',  roof: '#dbab18' },
    CITY_PATH:    { ground: '#8c98a6', h: 0.03, deco: null },
    CITY_GROUND:  { ground: '#a5aab0', h: 0.03, deco: null },
    FOUNTAIN:     { ground: '#a5aab0', h: 0.03, deco: 'fountain' },
    // --- Parc ---
    PARK_GRASS:   { ground: '#6cc04c', h: 0.00, deco: 'mowline' },
    PARK_TALL:    { ground: '#4a9c36', h: 0.00, deco: 'tallgrass' },
    PARK_FLOWER:  { ground: '#6cc04c', h: 0.00, deco: 'flowers' },
    PARK_PATH:    { ground: '#d9be89', h: 0.02, deco: null },
    PARK_TREE:    { ground: '#6cc04c', h: 0.05, deco: 'tree' },
    POND:         { ground: '#1b3f78', h: -0.38, deco: null, water: 'pond' },
    POND_EDGE:    { ground: '#4f9e3f', h: -0.02, deco: 'reeds' },
    BENCH:        { ground: '#6cc04c', h: 0.00, deco: 'bench' },
    // --- Montagnes ---
    MOUNTAIN:     { ground: '#6a727e', h: 1.30, deco: 'mountain' },
    MTN_PATH:     { ground: '#8a9199', h: 0.55, deco: null },
    MTN_GRASS:    { ground: '#5b7a58', h: 0.60, deco: 'tallgrass' },
    SNOW:         { ground: '#e6f1f7', h: 1.15, deco: 'snowtuft' },
    // --- Village ---
    VLG_HOUSE:    { ground: '#63b846', h: 0.03, deco: 'vlghouse' },
    VLG_PATH:     { ground: '#c08c62', h: 0.02, deco: null },
    VLG_TALL:     { ground: '#4a9c36', h: 0.00, deco: 'tallgrass' },
    // --- Grande cité ---
    CITY2_PATH:   { ground: '#8c98a6', h: 0.03, deco: null },
    CITY2_GROUND: { ground: '#a5aab0', h: 0.03, deco: null },
    HOUSE2_RED:   { ground: '#a5aab0', h: 0.03, deco: 'house2', roof: '#d1483f' },
    HOUSE2_BLUE:  { ground: '#a5aab0', h: 0.03, deco: 'house2', roof: '#3355b8' },
    HOUSE2_YELLOW:{ ground: '#a5aab0', h: 0.03, deco: 'house2', roof: '#dbab18' },
    FOUNTAIN2:    { ground: '#a5aab0', h: 0.03, deco: 'fountain' },
  };

  const DEFAULT_STYLE = { ground: '#63b846', h: 0, deco: null };
  function tileStyle(type) { return TILE_STYLE[type] || DEFAULT_STYLE; }

  // ---------------------------------------------------------------------------
  // AMBIANCE PAR BIOME — utilisée par sky3d.js (ciel, brouillard, soleil) et par
  // battle3d.js (décor de l'arène).
  // ---------------------------------------------------------------------------
  const BIOME_MOOD = {
    forest:   { sky: '#8fd3f4', fog: '#a8dcf0', sun: '#fff3d6', ground: '#63b846', ambient: 0.55, particles: 'pollen' },
    lake:     { sky: '#9fdcf7', fog: '#bfe8f7', sun: '#ffffff', ground: '#3d86bd', ambient: 0.60, particles: 'sparkle' },
    plain:    { sky: '#8ed0f7', fog: '#c3e6f5', sun: '#fff6e0', ground: '#84c45c', ambient: 0.60, particles: 'pollen' },
    beach:    { sky: '#a6ddf7', fog: '#ecdcb4', sun: '#fff0c8', ground: '#e3c68d', ambient: 0.65, particles: 'sparkle' },
    sea:      { sky: '#7cc4ef', fog: '#a9d6ea', sun: '#ffffff', ground: '#2f7fb8', ambient: 0.62, particles: 'spray' },
    park:     { sky: '#9ad9f7', fog: '#c8ebf5', sun: '#fff8e4', ground: '#6cc04c', ambient: 0.58, particles: 'pollen' },
    city:     { sky: '#a8d4ea', fog: '#cfdde6', sun: '#fff4e2', ground: '#a5aab0', ambient: 0.60, particles: null },
    mountain: { sky: '#b6dcf2', fog: '#d5e6ef', sun: '#f4f8ff', ground: '#8a9199', ambient: 0.52, particles: 'snow' },
    village:  { sky: '#95d4f2', fog: '#c9e4ee', sun: '#ffeec4', ground: '#63b846', ambient: 0.58, particles: 'pollen' },
    city2:    { sky: '#a0cfe8', fog: '#ccdae4', sun: '#fff2dc', ground: '#a5aab0', ambient: 0.60, particles: null },

    // --- LE CIEL DÉRÉGLÉ (cataclysme3d.js) -----------------------------------
    //  « quand les Pokémon légendaires se battent, tout se dérègle » — Robin.
    //  Ce ne sont pas des lieux : ce sont des ÉTATS passagers du ciel, posés
    //  par-dessus le biome réel pendant quelques secondes. `sky3d` ne connaît
    //  que des noms d'ambiance, il les affiche donc sans rien avoir à
    //  apprendre — et la transition douce qu'il fait déjà entre deux biomes
    //  devient gratuitement la bascule du dérèglement.
    chaos_nuit:   { sky: '#0d1030', fog: '#151a3a', sun: '#5560a0', ground: '#2a2f4a', ambient: 0.22, particles: 'sparkle' },
    chaos_jour:   { sky: '#fff8d0', fog: '#fff4d8', sun: '#ffffff', ground: '#cfc79a', ambient: 0.95, particles: 'sparkle' },
    chaos_orage:  { sky: '#39405a', fog: '#4a5068', sun: '#c8d0e8', ground: '#5a6070', ambient: 0.35, particles: 'spray' },
    chaos_espace: { sky: '#1a1050', fog: '#2a1c66', sun: '#b0a0ff', ground: '#3a2f6a', ambient: 0.40, particles: 'sparkle' },
    chaos_temps:  { sky: '#7fd8e8', fog: '#a8e6ee', sun: '#e8fbff', ground: '#5a8a9a', ambient: 0.70, particles: 'sparkle' },
  };
  function biomeMood(b) { return BIOME_MOOD[b] || BIOME_MOOD.plain; }

  // ---------------------------------------------------------------------------
  // REGISTRE DES MODÈLES DE CRÉATURES
  //   Chaque lot creatures3d.pN.js appelle R3.registerCreature('id', build)
  //   build() renvoie un THREE.Group centré en (0,0,0), posé sur y=0,
  //   d'environ 1 unité de haut, orienté vers +z.
  //   Pour animer : poser des références sur group.userData.anim
  //   (ex. { head, wingL, wingR, tail }) — voir CONTRACT.md.
  // ---------------------------------------------------------------------------
  const CREATURE_BUILDERS = Object.create(null);

  function registerCreature(id, buildFn) {
    CREATURE_BUILDERS[id] = buildFn;
  }

  /** Construit le modèle d'une créature. Renvoie un Group (jamais null :
   *  une silhouette de secours est produite si le modèle manque). */
  function buildCreature(id) {
    const build = CREATURE_BUILDERS[id];
    let g;
    if (build) {
      try { g = build(); } catch (e) { console.error('[R3] modèle 3D en échec :', id, e); }
    }
    if (!g) {
      const c = (typeof CREATURES !== 'undefined' && CREATURES.find((x) => x.id === id));
      g = group(
        ellipsoid(0.32, 0.28, 0.30, (c && c.color) || '#d896ff', 0, 0.30, 0),
        eyes(0.11, 0.36, 0.27)
      );
      g.userData.placeholder = true;
    }
    g.userData.creatureId = id;
    if (!g.userData.anim) g.userData.anim = {};
    return g;
  }

  /** Animation d'attente générique, appliquée si la créature n'en définit pas.
   *  Respiration + léger flottement.
   *
   *  `anim.update(g, t)` — LE POINT QUI DÉBLOQUE LES LÉGENDAIRES : chaque
   *  modèle peut poser sa propre fonction d'animation dans `userData.anim`.
   *  Personne ne l'appelait : les auras, anneaux et cristaux des 36 légendaires
   *  étaient figés depuis leur construction. On l'appelle EN PREMIER, pour
   *  qu'un modèle qui veut tout piloter lui-même puisse ensuite neutraliser
   *  les champs génériques (il lui suffit de ne pas les déclarer).
   *
   *  `anim.wingSpeed` / `anim.wingAmp` — les 6 rad/s d'origine sont le rythme
   *  d'un moineau : parfait pour une petite créature, ridicule sur un colosse
   *  de pierre. Les valeurs restent celles d'avant par défaut (rien ne change
   *  pour les 26 créatures d'origine), mais un gros modèle peut désormais
   *  demander un battement lent sans avoir à réécrire toute l'animation. */
  function idleCreature(g, t, phase) {
    const p = phase || 0;
    const a = g.userData.anim || {};

    // L'animation propre au modèle, si elle existe. Isolée : une erreur dans un
    // modèle ne doit jamais figer la boucle de rendu de tout le jeu.
    if (typeof a.update === 'function') {
      try { a.update(g, t); }
      catch (e) {
        a.update = null;   // on ne réessaie pas : pas de console noyée
        console.warn('[R3] animation propre désactivée pour', g.userData.creatureId, e);
      }
    }

    const s = 1 + Math.sin(t * 2.2 + p) * 0.035;
    g.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    if (a.head) a.head.rotation.z = Math.sin(t * 1.4 + p) * 0.07;
    if (a.wingL && a.wingR) {
      const sp = (typeof a.wingSpeed === 'number') ? a.wingSpeed : 6;
      const am = (typeof a.wingAmp === 'number') ? a.wingAmp : 0.35;
      const f = Math.sin(t * sp + p) * am;
      a.wingL.rotation.z = f;
      a.wingR.rotation.z = -f;
    }
    if (a.tail) a.tail.rotation.y = Math.sin(t * 2.6 + p) * 0.22;
    if (a.float) g.position.y = (g.userData.baseY || 0) + Math.sin(t * 1.8 + p) * 0.06;
  }

  // ---------------------------------------------------------------------------
  // REGISTRE DES MODULES — permet à chaque module de trouver les autres sans
  // ordre de chargement rigide.
  // ---------------------------------------------------------------------------
  const modules = Object.create(null);
  function register(name, api) { modules[name] = api; return api; }
  function get(name) { return modules[name]; }

  // ---------------------------------------------------------------------------
  // Divers
  // ---------------------------------------------------------------------------
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function damp(current, target, smoothing, dt) {
    return lerp(current, target, 1 - Math.pow(smoothing, dt * 60));
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  return {
    // horloge & qualité
    clock, tickClock, quality, setQuality, onQualityChange, QUALITY_PRESETS,
    // aléatoire
    hash, rng,
    // matériaux & géométries
    mat, matGlass, matGlow, geo,
    // primitives
    box, sphere, ellipsoid, cyl, cone, torus, wing, star,
    group, mirrorX, eyes, blush, rot, pos, noShadow, disposeTree,
    // données de style
    TILE_STYLE, tileStyle, BIOME_MOOD, biomeMood,
    // créatures
    CREATURE_BUILDERS, registerCreature, buildCreature, idleCreature,
    // modules
    register, get, modules,
    // maths
    lerp, clamp01, damp, easeOut, easeInOut,
  };
})();
