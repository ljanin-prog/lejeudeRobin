// =============================================================================
//  world3d.js — LE TERRAIN ET LES DÉCORS du « Jeu de Robin » en 3D
// =============================================================================
//  C'est le module que Robin regarde en permanence : tout ce qui n'est ni le
//  ciel, ni un personnage, ni une créature est construit ici.
//
//  Ce qu'il fait, dans l'ordre :
//    1. CHAMP DE HAUTEUR — part de R3.tileStyle(type).h, ajoute un relief
//       montagneux à l'est et une ondulation douce ailleurs, puis LISSE
//       (un sommet = moyenne des 4 tuiles qui le touchent).
//    2. TERRAIN — 15 chunks de 24×24 tuiles, un BufferGeometry chacun, en
//       vertex colors. Chaque tuile est subdivisée en 2×2 : le sommet du CENTRE
//       porte la couleur pure de la tuile, ceux des bords la moyenne des
//       voisines. On garde donc l'identité de chaque tuile (un chemin reste un
//       chemin) sans aucune couture dure.
//    3. DÉCORS — chaque prototype (arbre, maison, rocher…) est modélisé avec les
//       primitives R3.*, puis « cuit » en UN SEUL BufferGeometry à vertex
//       colors (bake()). Un THREE.InstancedMesh par catégorie ET par chunk :
//       une centaine d'objets à l'écran ne coûte qu'un draw call.
//    4. EAU — les tuiles d'eau contiguës sont regroupées par type et confiées à
//       R3.get('water').makeSurface(). Repli : nappe bleue translucide.
//
//  API — voir CONTRACT.md :
//    R3.register('world', { build(scene), heightAt(x,z), update(t,px,pz), root })
//
//  Repère : tuile (tx, ty) -> monde (x = tx, z = ty), y = hauteur, 1 tuile = 1 u.
//  La tuile (tx,ty) occupe donc [tx-0.5, tx+0.5] × [ty-0.5, ty+0.5].
// =============================================================================

(function () {
  'use strict';

  if (typeof THREE === 'undefined' || typeof R3 === 'undefined') return;

  // ---------------------------------------------------------------------------
  //  DIMENSIONS
  // ---------------------------------------------------------------------------
  const W = (typeof MAP_W === 'number') ? MAP_W : 120;
  const H = (typeof MAP_H === 'number') ? MAP_H : 70;
  const CHUNK = 24;
  const NCX = Math.ceil(W / CHUNK);
  const NCY = Math.ceil(H / CHUNK);
  const SKIRT = 70;            // débord du terrain au-delà de la carte (le brouillard fait le reste)

  const clamp01 = R3.clamp01;

  /** Type de tuile, avec bords « collants » (hors carte = tuile du bord). */
  function tileAt(x, y) {
    const cx = x < 0 ? 0 : (x >= W ? W - 1 : x);
    const cy = y < 0 ? 0 : (y >= H ? H - 1 : y);
    if (typeof MAP !== 'undefined' && MAP[cy]) return MAP[cy][cx];
    return 'GRASS';
  }

  // ---------------------------------------------------------------------------
  //  BRUIT DÉTERMINISTE
  //  Bruit de valeur bilinéaire adouci, bâti sur R3.hash (= hashPos du jeu 2D) :
  //  le relief tombe donc toujours au même endroit, sans aucun stockage.
  // ---------------------------------------------------------------------------
  function vnoise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = R3.hash(x0, y0);
    const b = R3.hash(x0 + 1, y0);
    const c = R3.hash(x0, y0 + 1);
    const d = R3.hash(x0 + 1, y0 + 1);
    const top = a + (b - a) * sx;
    const bot = c + (d - c) * sx;
    return top + (bot - top) * sy;
  }

  // --- Massif montagneux de l'est --------------------------------------------
  // Les tuiles MOUNTAIN/MTN_* du jeu 2D sont tirées au hasard tuile par tuile :
  // utiliser leur h telle quelle donnerait un champ de cailloux tremblotant.
  // On leur substitue une vraie crête à grande échelle (les rochers instanciés
  // se chargent du détail), atténuée aux abords de la plaine, de la plage et de
  // la grande cité pour qu'il n'y ait jamais de falaise sèche.
  const MTN_BASE = { MOUNTAIN: 0.38, MTN_PATH: 0.00, MTN_GRASS: 0.10, SNOW: 0.30 };

  function mtnMask(x, y) {
    let m = clamp01((x - 67) / 10);          // montée depuis la plaine
    m *= clamp01((57 - y) / 7);              // s'efface avant la plage
    const inCity = Math.min(x - 80.5, y - 36.5);  // > 0 : dans la grande cité
    m *= clamp01(-inCity / 7);
    return m;
  }

  function mtnRidge(x, y) {
    const a = vnoise(x / 15, y / 13);
    const b = vnoise(x / 7 + 31, y / 6.4 + 17);
    const c = vnoise(x / 3.5 + 77, y / 3.2 + 51);
    let n = a * 0.78 + b * 0.18 + c * 0.04;
    n = Math.pow(n, 1.25);                                   // creuse un peu les vallées
    const east = 0.55 + 0.75 * clamp01((x - 70) / 42);       // ça monte vers l'est
    const north = 1 + 0.35 * clamp01((14 - y) / 14);         // et vers les neiges du nord
    return 0.35 + n * 3.0 * east * north;
  }

  // Tuiles « plates » : les places pavées et le fond des eaux ne doivent pas
  // onduler (sinon les nappes d'eau percent le sol et les places gondolent).
  const FLAT_TILES = {
    PATH: 1, CITY_PATH: 1, CITY_GROUND: 1, CITY2_PATH: 1, CITY2_GROUND: 1,
    HOUSE_RED: 1, HOUSE_BLUE: 1, HOUSE_YELLOW: 1, FOUNTAIN: 1, FOUNTAIN2: 1,
    HOUSE2_RED: 1, HOUSE2_BLUE: 1, HOUSE2_YELLOW: 1,
    VLG_PATH: 1, PARK_PATH: 1,
  };

  // ---------------------------------------------------------------------------
  //  CHAMP DE HAUTEUR ET COULEURS DE SOL
  // ---------------------------------------------------------------------------
  let TH = null;    // hauteur par tuile          (W × H)
  let TC = null;    // couleur linéaire par tuile (W × H × 3)
  let CH = null;    // hauteur LISSÉE par sommet  ((W+1) × (H+1))

  /** Hauteur du sommet (i, j) — il se trouve en monde ((i - 0.5), (j - 0.5)). */
  function cornerH(i, j) {
    if (i < 0) i = 0; else if (i > W) i = W;
    if (j < 0) j = 0; else if (j > H) j = H;
    return CH[j * (W + 1) + i];
  }

  function buildField() {
    if (TH) return;
    TH = new Float32Array(W * H);
    TC = new Float32Array(W * H * 3);
    const flat = new Float32Array(W * H);
    const col = new THREE.Color();

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = y * W + x;
        const type = tileAt(x, y);
        const st = R3.tileStyle(type);

        // --- hauteur brute ---
        let h;
        if (MTN_BASE[type] !== undefined) {
          h = mtnMask(x, y) * (MTN_BASE[type] + mtnRidge(x, y));
        } else {
          h = st.h;
        }
        TH[o] = h;
        flat[o] = (st.water || FLAT_TILES[type]) ? 1 : 0;

        // --- couleur du sol, avec un grain déterministe ---
        col.set(st.ground);
        const r = R3.hash(x * 3 + 1, y * 5 + 2);
        const v = FLAT_TILES[type] ? (0.975 + 0.05 * r) : (0.905 + 0.185 * r);
        TC[o * 3] = col.r * v;
        TC[o * 3 + 1] = col.g * v;
        TC[o * 3 + 2] = col.b * v;
      }
    }

    // --- flou du masque de platitude (séparable, rayon 2) ---
    const tmp = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) {
          const xx = Math.min(W - 1, Math.max(0, x + k));
          s += flat[y * W + xx];
        }
        tmp[y * W + x] = s / 5;
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) {
          const yy = Math.min(H - 1, Math.max(0, y + k));
          s += tmp[yy * W + x];
        }
        const o = y * W + x;
        // Une tuile plate le reste absolument : le fond des lacs ne bouge pas.
        const f = flat[o] > 0 ? 1 : (s / 5);
        // Ondulation UNIQUEMENT positive : la terre se soulève, elle ne se
        // creuse jamais — comme ça, aucune berge ne passe sous l'eau.
        TH[o] += (1 - f) * 0.20 * vnoise(x / 13.5 + 5, y / 12.5 + 9);
      }
    }

    // --- lissage : un sommet = moyenne des 4 tuiles qu'il touche ---
    CH = new Float32Array((W + 1) * (H + 1));
    for (let j = 0; j <= H; j++) {
      const jm = Math.min(H - 1, Math.max(0, j - 1));
      const jp = Math.min(H - 1, Math.max(0, j));
      for (let i = 0; i <= W; i++) {
        const im = Math.min(W - 1, Math.max(0, i - 1));
        const ip = Math.min(W - 1, Math.max(0, i));
        CH[j * (W + 1) + i] = (
          TH[jm * W + im] + TH[jm * W + ip] +
          TH[jp * W + im] + TH[jp * W + ip]
        ) * 0.25;
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  heightAt(x, z)
  //  Renvoie EXACTEMENT la hauteur de la surface affichée. La géométrie
  //  subdivise chaque tuile en 2×2 sous-cases dont les sommets sont interpolés
  //  bilinéairement entre les 4 coins de la tuile ; chaque sous-case est
  //  découpée en 2 triangles suivant la diagonale (+x,−z)→(−x,+z). On refait
  //  ici le même calcul, dans le même ordre : le joueur ne flotte pas et ne
  //  s'enfonce pas, même en pleine montagne.
  // ---------------------------------------------------------------------------
  function heightAt(x, z) {
    if (!CH) { buildField(); }
    if (!isFinite(x) || !isFinite(z)) return 0;

    // Repère du treillis des coins : le coin (i,j) est en (i-0.5, j-0.5).
    let fi = x + 0.5, fj = z + 0.5;
    if (fi < 0) fi = 0; else if (fi > W) fi = W;
    if (fj < 0) fj = 0; else if (fj > H) fj = H;
    let i = Math.floor(fi), j = Math.floor(fj);
    if (i >= W) i = W - 1;
    if (j >= H) j = H - 1;
    const u = fi - i, v = fj - j;             // position dans la tuile, 0..1

    const A = cornerH(i, j);          // (−x, −z)
    const B = cornerH(i + 1, j);      // (+x, −z)
    const C = cornerH(i, j + 1);      // (−x, +z)
    const D = cornerH(i + 1, j + 1);  // (+x, +z)

    // Sous-case 2×2 contenant le point.
    const u0 = (u < 0.5) ? 0 : 0.5;
    const v0 = (v < 0.5) ? 0 : 0.5;
    const h00 = bil(A, B, C, D, u0, v0);
    const h10 = bil(A, B, C, D, u0 + 0.5, v0);
    const h01 = bil(A, B, C, D, u0, v0 + 0.5);
    const h11 = bil(A, B, C, D, u0 + 0.5, v0 + 0.5);

    const a = (u - u0) * 2, b = (v - v0) * 2;   // 0..1 dans la sous-case
    if (a + b <= 1) return h00 + (h10 - h00) * a + (h01 - h00) * b;
    return h11 + (h10 - h11) * (1 - b) + (h01 - h11) * (1 - a);
  }

  function bil(A, B, C, D, u, v) {
    const top = A + (B - A) * u;
    const bot = C + (D - C) * u;
    return top + (bot - top) * v;
  }

  // ---------------------------------------------------------------------------
  //  MATÉRIAUX PARTAGÉS
  //  Les décors sont instanciés : ils ont besoin d'un matériau à vertexColors,
  //  ce que R3.mat() ne sait pas faire. On part donc d'un matériau R3 (pour
  //  hériter des réglages du socle) qu'on clone UNE SEULE FOIS par variante —
  //  quatre matériaux pour tout le monde, l'esprit de la règle est sauf.
  // ---------------------------------------------------------------------------
  const _vcMats = new Map();

  function vcMat(key, opts, sway) {
    let m = _vcMats.get(key);
    if (m) return m;
    m = R3.mat('#ffffff', opts).clone();
    m.vertexColors = true;
    if (sway) {
      const uTime = { value: 0 };
      m.userData.uTime = uTime;
      const amp = sway.amp.toFixed(4);
      const y0 = sway.y0.toFixed(3);
      const y1 = sway.y1.toFixed(3);
      const spd = (sway.speed || 1.5).toFixed(3);
      m.onBeforeCompile = function (shader) {
        shader.uniforms.uTime = uTime;
        shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          [
            '#include <begin_vertex>',
            '#ifdef USE_INSTANCING',
            '  vec3 swayO = instanceMatrix[3].xyz;',
            '#else',
            '  vec3 swayO = vec3(0.0);',
            '#endif',
            'float swayW = smoothstep(' + y0 + ', ' + y1 + ', transformed.y) * ' + amp + ';',
            'float swayP = uTime * ' + spd + ' + swayO.x * 0.85 + swayO.z * 0.63;',
            'transformed.x += sin(swayP) * swayW;',
            'transformed.z += sin(swayP * 0.77 + 1.3) * swayW * 0.65;',
          ].join('\n')
        );
      };
      m.customProgramCacheKey = function () { return 'w3d-' + key; };
    }
    _vcMats.set(key, m);
    return m;
  }

  function matGround() { return vcMat('ground', { rough: 0.96 }); }
  function matSolid() { return vcMat('solid', { rough: 0.85 }); }
  function matRock() { return vcMat('rock', { rough: 0.92, flat: true }); }
  function matFoliage() { return vcMat('foliage', { rough: 0.92 }, { amp: 0.055, y0: 0.85, y1: 2.2, speed: 1.1 }); }
  function matBlade() {
    return vcMat('blade', { rough: 0.9, side: THREE.DoubleSide }, { amp: 0.15, y0: 0.04, y1: 0.62, speed: 1.6 });
  }

  // ---------------------------------------------------------------------------
  //  bake() — aplatit un groupe de meshes R3 en UN SEUL BufferGeometry à vertex
  //  colors. C'est ce qui permet d'instancier un arbre entier (tronc + 4 masses
  //  de feuillage) en un unique draw call.
  // ---------------------------------------------------------------------------
  const _bv = new THREE.Vector3();
  const _bn = new THREE.Vector3();
  const _bm3 = new THREE.Matrix3();
  const _white = new THREE.Color(1, 1, 1);

  function bake(root) {
    root.updateMatrixWorld(true);
    const P = [], N = [], C = [];
    root.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      let g = o.geometry;
      if (g.index) g = g.toNonIndexed();
      const pa = g.attributes.position;
      if (!pa) return;
      let na = g.attributes.normal;
      if (!na) { g.computeVertexNormals(); na = g.attributes.normal; }
      _bm3.getNormalMatrix(o.matrixWorld);
      const c = (o.material && o.material.color) ? o.material.color : _white;
      for (let i = 0; i < pa.count; i++) {
        _bv.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
        P.push(_bv.x, _bv.y, _bv.z);
        _bn.fromBufferAttribute(na, i).applyMatrix3(_bm3).normalize();
        N.push(_bn.x, _bn.y, _bn.z);
        C.push(c.r, c.g, c.b);
      }
      if (g !== o.geometry) g.dispose();
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    geom.computeBoundingSphere();
    return geom;
  }

  // ---------------------------------------------------------------------------
  //  PETITES GÉOMÉTRIES MAISON
  // ---------------------------------------------------------------------------
  const _localGeos = new Map();

  /** Lamelle d'herbe : quad effilé dans le plan XY, base à y = 0. */
  function bladeGeo(w, h) {
    const k = 'blade|' + w + '|' + h;
    let g = _localGeos.get(k);
    if (g) return g;
    const hw = w / 2, tw = w * 0.13;
    const p = [
      -hw, 0, 0, hw, 0, 0, tw, h, 0,
      -hw, 0, 0, tw, h, 0, -tw, h, 0,
    ];
    // Normales légèrement « bombées » : la touffe attrape mieux la lumière.
    const n = [];
    const s = 1 / Math.sqrt(1 + 0.36);
    for (let i = 0; i < 6; i++) n.push(0, 0.6 * s, s);
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    _localGeos.set(k, g);
    return g;
  }

  /** Prisme triangulaire : faîte suivant X à la hauteur h, base w×d à y = 0. */
  function prismGeo(w, h, d) {
    const k = 'prism|' + w + '|' + h + '|' + d;
    let g = _localGeos.get(k);
    if (g) return g;
    const hw = w / 2, hd = d / 2;
    const A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [hw, 0, hd], D = [-hw, 0, hd];
    const E = [-hw, h, 0], F = [hw, h, 0];
    const p = [];
    function tri(a, b, c) { p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
    tri(A, F, B); tri(A, E, F);   // pan −z
    tri(D, C, F); tri(D, F, E);   // pan +z
    tri(A, D, E);                 // pignon −x
    tri(B, F, C);                 // pignon +x
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    _localGeos.set(k, g);
    return g;
  }

  function prism(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(prismGeo(w, h, d), R3.mat(color));
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  function blade(w, h, color, x, y, z, ry, rz) {
    const m = new THREE.Mesh(bladeGeo(w, h), R3.mat(color, { side: THREE.DoubleSide }));
    m.position.set(x || 0, y || 0, z || 0);
    m.rotation.set(0, ry || 0, rz || 0);
    return m;
  }

  // ---------------------------------------------------------------------------
  //  PROTOTYPES DE DÉCOR
  //  Chaque fonction renvoie un THREE.Group modélisé aux primitives R3, posé sur
  //  y = 0 et centré en (0,0). Il sera cuit puis instancié.
  //  Les couleurs reprennent celles des drawXxx() 2D de js/world.js, d'un ton
  //  plus profond (l'éclairage 3D les éclaircit).
  // ---------------------------------------------------------------------------

  // --- ARBRES ----------------------------------------------------------------
  // Tronc légèrement conique + 4 masses de feuillage décalées et de verts
  // différents : c'est l'objet le plus nombreux de la carte, il mérite le soin.
  function protoTree(variant) {
    const g = R3.group();
    if (variant === 'park') {
      // Arbre de parc : plus petit, plus rond, plus clair — bien peigné.
      g.add(R3.cyl(0.09, 0.14, 0.82, '#8b5a2b', 0, 0.41, 0, { seg: 7 }));
      g.add(R3.cyl(0.15, 0.23, 0.12, '#7a4d24', 0, 0.06, 0, { seg: 7 }));
      g.add(R3.ellipsoid(0.52, 0.50, 0.52, '#27ae60', 0, 1.24, 0, { seg: 8 }));
      g.add(R3.ellipsoid(0.34, 0.32, 0.33, '#38b764', -0.18, 1.50, 0.10, { seg: 8 }));
      g.add(R3.ellipsoid(0.28, 0.27, 0.28, '#2fa055', 0.22, 1.42, -0.12, { seg: 8 }));
      g.add(R3.ellipsoid(0.22, 0.21, 0.22, '#5bd07a', 0.02, 1.62, 0.06, { seg: 8 }));
    } else {
      // Arbre de forêt : haut, touffu, un peu sauvage.
      g.add(R3.cyl(0.085, 0.15, 0.95, '#8b5a2b', 0, 0.47, 0, { seg: 7 }));
      g.add(R3.cyl(0.17, 0.26, 0.14, '#6f4420', 0, 0.07, 0, { seg: 7 }));
      const f1 = R3.ellipsoid(0.58, 0.50, 0.56, '#1e8449', 0, 1.34, 0, { seg: 8 });
      R3.rot(f1, 0.12, 0.4, 0.08);
      const f2 = R3.ellipsoid(0.42, 0.38, 0.40, '#27ae60', -0.24, 1.64, 0.14, { seg: 8 });
      R3.rot(f2, -0.15, 0.9, 0.2);
      const f3 = R3.ellipsoid(0.34, 0.31, 0.32, '#38b764', 0.26, 1.55, -0.16, { seg: 8 });
      R3.rot(f3, 0.2, -0.6, -0.12);
      const f4 = R3.ellipsoid(0.26, 0.25, 0.26, '#4cbf6a', 0.03, 1.86, 0.08, { seg: 8 });
      g.add(f1, f2, f3, f4);
    }
    return { geo: bake(g), mat: matFoliage(), cast: true };
  }

  // --- HERBES HAUTES ---------------------------------------------------------
  // Ce sont les tuiles à rencontre : Robin DOIT les repérer d'un coup d'œil.
  // Touffe de lamelles croisées, nettement plus sombres et plus hautes que
  // l'herbe du sol, et qui se balancent (voir matBlade / sway).
  function protoTallGrass() {
    const g = R3.group();
    const dark = '#1e7a37';
    const mid = '#2b9c46';
    const tip = '#63c95f';
    // 3 lamelles larges croisées à 60°
    for (let i = 0; i < 3; i++) {
      g.add(blade(0.46, 0.62, i === 1 ? mid : dark, 0, 0, 0, i * Math.PI / 3, 0));
    }
    // brins fins tout autour, penchés dans tous les sens
    const spots = [
      [-0.26, -0.18, 0.52, 0.9, 0.18], [0.28, -0.10, 0.46, -0.4, -0.22],
      [0.10, 0.28, 0.58, 2.1, 0.12], [-0.14, 0.26, 0.42, 1.4, -0.16],
      [0.24, 0.20, 0.36, 0.2, 0.26],
    ];
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      g.add(blade(0.14, s[2], i % 2 ? tip : mid, s[0], 0, s[1], s[3], s[4]));
    }
    // socle sombre : la tuile se distingue même vue de haut
    const base = R3.ellipsoid(0.40, 0.05, 0.40, '#1c6b32', 0, 0.03, 0, { seg: 8 });
    base.castShadow = false;
    g.add(base);
    return { geo: bake(g), mat: matBlade(), cast: false };
  }

  // --- FLEURS ----------------------------------------------------------------
  function protoFlowers() {
    const g = R3.group();
    const cols = ['#ffaad8', '#f1c40f', '#d896ff', '#fc7460', '#73eff7'];
    const spots = [
      [-0.20, -0.14, 0.22], [0.18, -0.20, 0.26], [0.22, 0.20, 0.20], [-0.16, 0.22, 0.24],
    ];
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const c = cols[i % cols.length];
      g.add(R3.box(0.024, s[2], 0.024, '#2f8f47', s[0], s[2] / 2, s[1]));
      const petal = R3.ellipsoid(0.085, 0.035, 0.085, c, s[0], s[2] + 0.015, s[1], { seg: 6 });
      petal.castShadow = false;
      g.add(petal);
      // Cœur jaune : une petite boîte suffit et coûte 5 fois moins qu'une sphère.
      const heart = R3.box(0.04, 0.022, 0.04, '#f1c40f', s[0], s[2] + 0.032, s[1]);
      heart.castShadow = false;
      g.add(heart);
    }
    // deux brins d'herbe pour asseoir le bouquet
    g.add(blade(0.12, 0.24, '#3fa055', 0.02, 0, -0.02, 0.6, 0.1));
    g.add(blade(0.12, 0.20, '#4cb85c', -0.06, 0, 0.10, 2.2, -0.12));
    return { geo: bake(g), mat: matBlade(), cast: false };
  }

  // --- ROCHERS ---------------------------------------------------------------
  function protoRock() {
    const g = R3.group();
    g.add(R3.rot(R3.ellipsoid(0.34, 0.26, 0.30, '#7f8c8d', 0, 0.20, 0, { seg: 6 }), 0.15, 0.5, 0.1));
    g.add(R3.rot(R3.ellipsoid(0.20, 0.16, 0.18, '#94a0a2', 0.16, 0.30, -0.10, { seg: 6 }), -0.2, 1.1, 0.25));
    g.add(R3.rot(R3.ellipsoid(0.16, 0.11, 0.15, '#66727d', -0.20, 0.10, 0.16, { seg: 6 }), 0.1, -0.7, -0.15));
    return { geo: bake(g), mat: matRock(), cast: true };
  }

  // --- MASSIFS DE MONTAGNE ---------------------------------------------------
  // Plusieurs blocs pivotés et empilés : de loin, ça fait une vraie arête.
  function protoMountain(snowy) {
    const g = R3.group();
    g.add(R3.rot(R3.box(0.96, 1.20, 0.92, '#6a727e', 0, 0.52, 0), 0.06, 0.42, -0.08));
    g.add(R3.rot(R3.box(0.68, 1.55, 0.60, '#767e8a', 0.16, 0.78, 0.10), -0.05, 1.05, 0.09));
    g.add(R3.rot(R3.box(0.52, 0.98, 0.50, '#5c6470', -0.30, 0.42, 0.22), 0.10, -0.55, -0.12));
    g.add(R3.rot(R3.box(0.44, 0.62, 0.42, '#8a9199', 0.04, 1.42, -0.10), 0.08, 0.22, 0.06));
    g.add(R3.rot(R3.ellipsoid(0.30, 0.24, 0.28, '#5c6470', -0.36, 0.16, -0.30, { seg: 6 }), 0.12, 0.8, 0.18));
    if (snowy) {
      g.add(R3.rot(R3.box(0.52, 0.26, 0.48, '#eef6fb', 0.05, 1.74, -0.09), 0.08, 0.22, 0.06));
      g.add(R3.rot(R3.box(0.40, 0.20, 0.36, '#dfeef7', 0.18, 1.48, 0.10), -0.05, 1.05, 0.09));
      g.add(R3.ellipsoid(0.26, 0.12, 0.24, '#e6f1f7', -0.22, 1.12, 0.18, { seg: 6 }));
    }
    return { geo: bake(g), mat: matRock(), cast: true };
  }

  // --- TOUFFES DE NEIGE ------------------------------------------------------
  function protoSnowTuft() {
    const g = R3.group();
    g.add(R3.ellipsoid(0.30, 0.13, 0.28, '#f2fafd', -0.08, 0.07, 0.06, { seg: 7 }));
    g.add(R3.ellipsoid(0.18, 0.10, 0.17, '#ffffff', 0.20, 0.06, -0.14, { seg: 6 }));
    g.add(R3.rot(R3.ellipsoid(0.10, 0.08, 0.09, '#8a9199', 0.06, 0.06, 0.22, { seg: 5 }), 0.2, 0.6, 0.3));
    return { geo: bake(g), mat: matSolid(), cast: false };
  }

  // --- COQUILLAGES (plage) ---------------------------------------------------
  function protoShell() {
    const g = R3.group();
    const s = R3.rot(R3.ellipsoid(0.11, 0.05, 0.09, '#ffaad8', 0, 0.05, 0, { seg: 7 }), 0.15, 0.4, 0);
    g.add(s);
    g.add(R3.rot(R3.ellipsoid(0.07, 0.035, 0.055, '#ffd2e6', 0.01, 0.09, 0.01, { seg: 6 }), 0.15, 0.4, 0));
    g.add(R3.rot(R3.ellipsoid(0.06, 0.025, 0.05, '#f4e7c8', 0.19, 0.03, -0.14, { seg: 5 }), 0, 1.1, 0.2));
    return { geo: bake(g), mat: matSolid(), cast: false };
  }

  // --- LIGNE DE TONTE (gazon du parc) ---------------------------------------
  function protoMowLine() {
    const g = R3.group();
    const m = new THREE.Mesh(R3.geo.plane(0.99, 0.99), R3.mat('#8ad86a', { rough: 1 }));
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false;
    m.receiveShadow = false;
    g.add(m);
    return { geo: bake(g), mat: matSolid(), cast: false };
  }

  // --- BANC DE PARC ----------------------------------------------------------
  function protoBench() {
    const g = R3.group();
    const wood = '#8b5a2b', dark = '#5c2e0d';
    // pieds
    g.add(R3.box(0.07, 0.30, 0.07, dark, -0.26, 0.15, 0.09));
    g.add(R3.box(0.07, 0.30, 0.07, dark, 0.26, 0.15, 0.09));
    g.add(R3.box(0.07, 0.52, 0.07, dark, -0.26, 0.26, -0.11));
    g.add(R3.box(0.07, 0.52, 0.07, dark, 0.26, 0.26, -0.11));
    // assise : trois lattes
    g.add(R3.box(0.68, 0.05, 0.10, wood, 0, 0.32, 0.12));
    g.add(R3.box(0.68, 0.05, 0.10, wood, 0, 0.32, 0.00));
    g.add(R3.box(0.68, 0.05, 0.10, wood, 0, 0.32, -0.12));
    // dossier légèrement incliné
    const b1 = R3.box(0.68, 0.09, 0.05, wood, 0, 0.46, -0.14);
    b1.rotation.x = 0.16;
    const b2 = R3.box(0.68, 0.09, 0.05, wood, 0, 0.58, -0.16);
    b2.rotation.x = 0.16;
    g.add(b1, b2);
    return { geo: bake(g), mat: matSolid(), cast: true };
  }

  // --- ROSEAUX ET NÉNUPHARS (bord de mare) ----------------------------------
  function protoReeds() {
    const g = R3.group();
    const spots = [
      [-0.26, -0.20, 0.62], [-0.16, -0.28, 0.48], [0.24, -0.14, 0.58],
      [0.30, 0.06, 0.44], [-0.30, 0.14, 0.50],
    ];
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      g.add(blade(0.09, s[2], i % 2 ? '#2f9c58' : '#27ae60', s[0], 0, s[1], i * 1.1, (i % 2 ? 0.12 : -0.1)));
      // quenouille brune au sommet d'un roseau sur deux
      if (i % 2 === 0) {
        const q = R3.ellipsoid(0.032, 0.075, 0.032, '#8b5a2b', s[0], s[2] + 0.05, s[1], { seg: 5 });
        q.castShadow = false;
        g.add(q);
      }
    }
    // nénuphar + petite fleur rose
    const pad = R3.ellipsoid(0.20, 0.014, 0.18, '#1e8449', 0.10, 0.03, 0.26, { seg: 8 });
    pad.castShadow = false;
    g.add(pad);
    const fl = R3.ellipsoid(0.055, 0.035, 0.055, '#ffaad8', 0.14, 0.06, 0.30, { seg: 6 });
    fl.castShadow = false;
    g.add(fl);
    return { geo: bake(g), mat: matBlade(), cast: false };
  }

  // --- FONTAINE --------------------------------------------------------------
  function protoFountain(big) {
    const g = R3.group();
    const k = big ? 1.32 : 1.0;
    const stone = '#b3bec6', stoneD = '#8f9ba4', stoneL = '#d3dbe0';
    g.add(R3.cyl(0.46 * k, 0.50 * k, 0.10, stoneD, 0, 0.05, 0, { seg: 16 }));
    g.add(R3.cyl(0.43 * k, 0.44 * k, 0.16, stone, 0, 0.16, 0, { seg: 16 }));
    // Le tore de THREE est dans le plan XY : on le couche pour en faire une margelle.
    g.add(R3.rot(R3.torus(0.40 * k, 0.055, stoneL, 0, 0.26, 0, { seg: 16 }), -Math.PI / 2, 0, 0));
    g.add(R3.cyl(0.08 * k, 0.12 * k, 0.42 * k, stone, 0, 0.21 + 0.21 * k, 0, { seg: 10 }));
    g.add(R3.cyl(0.19 * k, 0.06 * k, 0.07, stoneL, 0, 0.44 + 0.42 * k, 0, { seg: 14 }));
    if (big) {
      g.add(R3.cyl(0.06, 0.09, 0.34, stone, 0, 1.08, 0, { seg: 10 }));
      g.add(R3.cyl(0.13, 0.05, 0.06, stoneL, 0, 1.26, 0, { seg: 12 }));
    }
    return { geo: bake(g), mat: matSolid(), cast: true };
  }

  // --- MAISONS ---------------------------------------------------------------
  // Murs + toit à deux pans DÉBORDANT + porte + fenêtres + cheminée.
  // La porte est modélisée face à +z ; l'instance est ensuite pivotée pour
  // qu'elle donne sur la rue (voir streetRot()).
  function addRoof(g, wallTop, halfW, halfD, rise, roof, roofDark, wallColor) {
    // Pignons pleins, couleur des murs : c'est eux qui donnent la silhouette.
    g.add(prism(halfW * 2, rise, halfD * 2, wallColor, 0, wallTop, 0));

    // Deux pans qui débordent largement de la façade (eaves + rives).
    //   ang  = pente du toit ; le pan +z pivote de +ang autour de X pour que son
    //   extrémité +z descende. Le centre de la dalle est le milieu de la pente,
    //   décalé vers le bas de la pente (débord) puis le long de la normale
    //   sortante (demi-épaisseur).
    const slopeLen = Math.sqrt(halfD * halfD + rise * rise);
    const over = 0.17;     // débord au-delà de l'égout
    const th = 0.055;      // épaisseur de la couverture
    const ang = Math.atan2(rise, halfD);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let s = -1; s <= 1; s += 2) {
      const slab = R3.box(halfW * 2 + 0.20, th, slopeLen + over, roof,
        0,
        wallTop + rise / 2 + ca * th * 0.5 - sa * over * 0.5,
        s * (halfD / 2 + ca * over * 0.5 + sa * th * 0.5));
      slab.rotation.x = s * ang;
      g.add(slab);
    }
    // Faîtière
    g.add(R3.box(halfW * 2 + 0.22, 0.06, 0.10, roofDark, 0, wallTop + rise + 0.015, 0));
  }

  function addWindow(g, x, y, z, w, h) {
    const fr = R3.box(w + 0.06, h + 0.06, 0.03, '#f4f4f4', x, y, z);
    fr.castShadow = false;
    const pane = R3.box(w, h, 0.035, '#8fe4f0', x, y, z + 0.012);
    pane.castShadow = false;
    const cv = R3.box(0.022, h, 0.045, '#7a4a24', x, y, z + 0.02);
    const chz = R3.box(w, 0.022, 0.045, '#7a4a24', x, y, z + 0.02);
    cv.castShadow = false; chz.castShadow = false;
    g.add(fr, pane, cv, chz);
  }

  function protoHouse(roofColor) {
    const g = R3.group();
    const roofDark = new THREE.Color(roofColor).multiplyScalar(0.72).getStyle();
    const hw = 0.43, hd = 0.43, wallH = 1.02;
    // socle
    g.add(R3.box(0.94, 0.08, 0.94, '#9aa3ab', 0, 0.04, 0));
    // murs
    g.add(R3.box(hw * 2, wallH, hd * 2, '#efe0bd', 0, 0.08 + wallH / 2, 0));
    // soubassement plus sombre
    g.add(R3.box(hw * 2 + 0.02, 0.12, hd * 2 + 0.02, '#d9c49a', 0, 0.14, 0));
    addRoof(g, 0.08 + wallH, hw, hd, 0.46, roofColor, roofDark, '#efe0bd');
    // porte
    g.add(R3.box(0.28, 0.50, 0.05, '#6b3d17', 0, 0.33, hd + 0.01));
    const knob = R3.sphere(0.028, '#f1c40f', 0.09, 0.36, hd + 0.04, { seg: 6 });
    knob.castShadow = false;
    g.add(knob);
    // marche
    g.add(R3.box(0.34, 0.05, 0.12, '#c8cdd2', 0, 0.10, hd + 0.07));
    // fenêtres de façade + une sur chaque pignon (les rangées de maisons
    // de la ville ne montrent pas que des murs nus)
    addWindow(g, -0.25, 0.72, hd + 0.02, 0.20, 0.20);
    addWindow(g, 0.25, 0.72, hd + 0.02, 0.20, 0.20);
    const sw1 = R3.box(0.035, 0.20, 0.20, '#8fe4f0', -hw - 0.01, 0.66, 0.02);
    const sw2 = R3.box(0.035, 0.20, 0.20, '#8fe4f0', hw + 0.01, 0.66, 0.02);
    sw1.castShadow = false; sw2.castShadow = false;
    g.add(sw1, sw2);
    // cheminée
    g.add(R3.box(0.15, 0.50, 0.15, '#a8564a', 0.26, 1.42, -0.20));
    g.add(R3.box(0.19, 0.05, 0.19, '#5a4038', 0.26, 1.69, -0.20));
    return { geo: bake(g), mat: matSolid(), cast: true };
  }

  function protoHouse2(roofColor) {
    const g = R3.group();
    const roofDark = new THREE.Color(roofColor).multiplyScalar(0.72).getStyle();
    const hw = 0.44, hd = 0.44, wallH = 1.62;   // un étage de plus que protoHouse
    g.add(R3.box(0.96, 0.08, 0.96, '#9aa3ab', 0, 0.04, 0));
    g.add(R3.box(hw * 2, wallH, hd * 2, '#f4f0e2', 0, 0.08 + wallH / 2, 0));
    g.add(R3.box(hw * 2 + 0.02, 0.16, hd * 2 + 0.02, '#c8ccd0', 0, 0.16, 0));
    // bandeau qui sépare les deux étages
    g.add(R3.box(hw * 2 + 0.05, 0.06, hd * 2 + 0.05, '#d8d2c2', 0, 0.94, 0));
    addRoof(g, 0.08 + wallH, hw, hd, 0.40, roofColor, roofDark, '#f4f0e2');
    // porte d'entrée avec auvent
    g.add(R3.box(0.30, 0.58, 0.05, '#6b3d17', 0, 0.37, hd + 0.01));
    const knob2 = R3.sphere(0.028, '#f1c40f', 0.10, 0.40, hd + 0.04, { seg: 6 });
    knob2.castShadow = false;
    g.add(knob2);
    g.add(R3.box(0.44, 0.05, 0.16, '#a8564a', 0, 0.70, hd + 0.06));
    g.add(R3.box(0.38, 0.05, 0.14, '#c8cdd2', 0, 0.10, hd + 0.08));
    // 2 fenêtres au rez, 3 à l'étage
    addWindow(g, -0.26, 0.46, hd + 0.02, 0.19, 0.19);
    addWindow(g, 0.26, 0.46, hd + 0.02, 0.19, 0.19);
    addWindow(g, -0.27, 1.26, hd + 0.02, 0.19, 0.22);
    addWindow(g, 0.00, 1.26, hd + 0.02, 0.19, 0.22);
    addWindow(g, 0.27, 1.26, hd + 0.02, 0.19, 0.22);
    // fenêtres latérales, pour que les rangées de maisons ne soient pas nues
    const wl = R3.box(0.035, 0.20, 0.20, '#8fe4f0', -hw - 0.01, 1.26, 0.02);
    wl.castShadow = false;
    const wr = R3.box(0.035, 0.20, 0.20, '#8fe4f0', hw + 0.01, 1.26, 0.02);
    wr.castShadow = false;
    g.add(wl, wr);
    // cheminée
    g.add(R3.box(0.16, 0.52, 0.16, '#a8564a', 0.27, 2.02, -0.22));
    g.add(R3.box(0.20, 0.05, 0.20, '#5a4038', 0.27, 2.30, -0.22));
    return { geo: bake(g), mat: matSolid(), cast: true };
  }

  // Maison de village : murs blanchis à la chaux et gros toit de chaume ARRONDI.
  function protoVlgHouse() {
    const g = R3.group();
    const hw = 0.40, hd = 0.40, wallH = 0.86;
    g.add(R3.box(0.90, 0.07, 0.90, '#8fae6a', 0, 0.035, 0));
    g.add(R3.box(hw * 2, wallH, hd * 2, '#f6f4ee', 0, 0.07 + wallH / 2, 0));
    g.add(R3.box(hw * 2 + 0.02, 0.13, hd * 2 + 0.02, '#cdd4d8', 0, 0.135, 0));
    // colombages, comme les liserés du dessin 2D
    g.add(R3.box(hw * 2 + 0.03, 0.05, 0.05, '#8b5a2b', 0, 0.07 + wallH, hd));
    g.add(R3.box(0.05, wallH, 0.05, '#8b5a2b', -hw, 0.07 + wallH / 2, hd));
    g.add(R3.box(0.05, wallH, 0.05, '#8b5a2b', hw, 0.07 + wallH / 2, hd));
    // chaume : une grosse masse arrondie qui déborde de partout
    const top = 0.07 + wallH;
    const th1 = R3.ellipsoid(0.62, 0.46, 0.62, '#b8834a', 0, top + 0.06, 0, { seg: 10 });
    const th2 = R3.ellipsoid(0.46, 0.30, 0.46, '#c9955a', 0, top + 0.26, 0, { seg: 9 });
    const th3 = R3.ellipsoid(0.26, 0.16, 0.26, '#a5713d', 0, top + 0.42, 0, { seg: 8 });
    g.add(th1, th2, th3);
    // faîtage plus sombre
    g.add(R3.rot(R3.cyl(0.05, 0.05, 0.86, '#8b5a2b', 0, top + 0.44, 0, { seg: 6 }), 0, 0, Math.PI / 2));
    // porte, fenêtre, cheminée de pierre
    g.add(R3.box(0.26, 0.44, 0.05, '#8b5a2b', 0, 0.29, hd + 0.01));
    const kn = R3.sphere(0.026, '#f1c40f', 0.08, 0.32, hd + 0.04, { seg: 5 });
    kn.castShadow = false;
    g.add(kn);
    addWindow(g, -0.24, 0.62, hd + 0.02, 0.17, 0.17);
    g.add(R3.box(0.14, 0.42, 0.14, '#9aa0a4', -0.24, top + 0.34, -0.18));
    g.add(R3.box(0.18, 0.05, 0.18, '#6b7075', -0.24, top + 0.57, -0.18));
    // bac à fleurs sous la fenêtre : le village doit être douillet
    g.add(R3.box(0.22, 0.06, 0.08, '#8b5a2b', -0.24, 0.50, hd + 0.06));
    const fl = R3.ellipsoid(0.09, 0.05, 0.05, '#ff6b9d', -0.24, 0.56, hd + 0.06, { seg: 6 });
    fl.castShadow = false;
    g.add(fl);
    return { geo: bake(g), mat: matSolid(), cast: true };
  }

  // ---------------------------------------------------------------------------
  //  REGISTRE DES PROTOTYPES (construits à la demande, une seule fois)
  // ---------------------------------------------------------------------------
  const PROTOS = Object.create(null);

  function proto(key) {
    let p = PROTOS[key];
    if (p !== undefined) return p;
    const dot = key.indexOf('.');
    const base = dot < 0 ? key : key.slice(0, dot);
    const arg = dot < 0 ? '' : key.slice(dot + 1);
    try {
      switch (base) {
        case 'tree': p = protoTree(arg); break;
        case 'tallgrass': p = protoTallGrass(); break;
        case 'flowers': p = protoFlowers(); break;
        case 'rock': p = protoRock(); break;
        case 'mountain': p = protoMountain(arg === 'snow'); break;
        case 'snowtuft': p = protoSnowTuft(); break;
        case 'shell': p = protoShell(); break;
        case 'mowline': p = protoMowLine(); break;
        case 'bench': p = protoBench(); break;
        case 'reeds': p = protoReeds(); break;
        case 'fountain': p = protoFountain(arg === 'big'); break;
        case 'house': p = protoHouse('#' + arg); break;
        case 'house2': p = protoHouse2('#' + arg); break;
        case 'vlghouse': p = protoVlgHouse(); break;
        default: p = null;
      }
    } catch (e) {
      console.error('[world3d] prototype en échec :', key, e);
      p = null;
    }
    PROTOS[key] = p;
    return p;
  }

  // ---------------------------------------------------------------------------
  //  ORIENTATION DES BÂTIMENTS ET DES BANCS
  // ---------------------------------------------------------------------------
  const STREET = {
    CITY_PATH: 1, CITY_GROUND: 1, CITY2_PATH: 1, CITY2_GROUND: 1,
    VLG_PATH: 1, PATH: 1, PARK_PATH: 1, MTN_PATH: 1,
  };
  // Le prototype regarde vers +z ; rotation.y amène ce +z sur la direction voulue.
  const DIRS = [
    { dx: 0, dz: 1, ry: 0 },
    { dx: 1, dz: 0, ry: Math.PI / 2 },
    { dx: -1, dz: 0, ry: -Math.PI / 2 },
    { dx: 0, dz: -1, ry: Math.PI },
  ];

  /** Fait regarder l'objet vers la première tuile voisine acceptée par test(). */
  function faceRot(x, y, test, fallback) {
    for (let i = 0; i < DIRS.length; i++) {
      const d = DIRS[i];
      if (test(tileAt(x + d.dx, y + d.dz))) return d.ry;
    }
    return fallback;
  }

  function isStreet(t) { return STREET[t] === 1; }
  function isParkPath(t) { return t === 'PARK_PATH'; }

  // ---------------------------------------------------------------------------
  //  PLACEMENT DES DÉCORS
  //  On remplit, chunk par chunk, des « seaux » (une matrice + une couleur par
  //  instance) puis on en fait un InstancedMesh par seau.
  // ---------------------------------------------------------------------------
  const _mat4 = new THREE.Matrix4();
  const _quat = new THREE.Quaternion();
  const _eul = new THREE.Euler();
  const _pos = new THREE.Vector3();
  const _scl = new THREE.Vector3();

  function pushInst(bucket, key, px, py, pz, rx, ry, rz, sx, sy, sz, cr, cg, cb) {
    let b = bucket[key];
    if (!b) { b = bucket[key] = { m: [], c: [] }; }
    _eul.set(rx, ry, rz, 'YXZ');
    _quat.setFromEuler(_eul);
    _pos.set(px, py, pz);
    _scl.set(sx, sy, sz);
    _mat4.compose(_pos, _quat, _scl);
    _mat4.toArray(b.m, b.m.length);
    b.c.push(cr, cg, cb);
  }

  /** Tuiles d'herbe haute : teinte selon le décor où elles poussent. */
  const GRASS_TINT = {
    TALL_GRASS: [0.97, 1.00, 0.90],
    TALL_PLAIN: [1.10, 1.04, 0.82],
    PARK_TALL: [1.00, 1.06, 0.92],
    VLG_TALL: [1.04, 1.02, 0.86],
    MTN_GRASS: [0.82, 0.90, 0.86],
  };

  function placeDecos(bucket, x, y) {
    const type = tileAt(x, y);
    const st = R3.tileStyle(type);
    const deco = st.deco;
    if (!deco) return;

    const h = heightAt(x, y);
    const r1 = R3.hash(x * 2 + 1, y);
    const r2 = R3.hash(x, y * 3 + 7);
    const r3 = R3.hash(x * 5 + 3, y * 7 + 11);
    const r4 = R3.hash(x * 11 + 5, y * 13 + 3);

    switch (deco) {

      case 'tree': {
        const park = (type === 'PARK_TREE');
        const ox = (r1 - 0.5) * (park ? 0.22 : 0.40);
        const oz = (r2 - 0.5) * (park ? 0.22 : 0.40);
        const s = park ? (0.90 + r3 * 0.20) : (0.80 + r3 * 0.48);
        const tint = park ? 1 : 0.90 + r4 * 0.20;
        pushInst(bucket, park ? 'tree.park' : 'tree.forest',
          x + ox, heightAt(x + ox, y + oz) - 0.05, y + oz,
          (r4 - 0.5) * 0.06, r1 * Math.PI * 2, (r3 - 0.5) * 0.06,
          s * (0.94 + r4 * 0.12), s, s * (0.94 + r1 * 0.12),
          tint * (0.96 + r2 * 0.10), tint * (0.94 + r3 * 0.14), tint * (0.92 + r1 * 0.10));
        break;
      }

      case 'tallgrass': {
        const t = GRASS_TINT[type] || [1, 1, 1];
        const j = 0.92 + r3 * 0.18;
        pushInst(bucket, 'tallgrass',
          x + (r1 - 0.5) * 0.30, h - 0.02, y + (r2 - 0.5) * 0.30,
          0, r1 * Math.PI * 2, 0,
          0.90 + r2 * 0.30, 0.85 + r4 * 0.42, 0.90 + r3 * 0.30,
          t[0] * j, t[1] * j, t[2] * j);
        break;
      }

      case 'flowers': {
        pushInst(bucket, 'flowers',
          x + (r1 - 0.5) * 0.24, h, y + (r2 - 0.5) * 0.24,
          0, r3 * Math.PI * 2, 0,
          0.85 + r4 * 0.35, 0.85 + r1 * 0.35, 0.85 + r4 * 0.35,
          0.92 + r2 * 0.20, 0.92 + r3 * 0.16, 0.92 + r1 * 0.20);
        break;
      }

      case 'rock': {
        pushInst(bucket, 'rock',
          x + (r1 - 0.5) * 0.28, h - 0.03, y + (r2 - 0.5) * 0.28,
          (r3 - 0.5) * 0.2, r1 * Math.PI * 2, (r4 - 0.5) * 0.2,
          0.75 + r3 * 0.60, 0.70 + r4 * 0.55, 0.75 + r2 * 0.60,
          0.90 + r4 * 0.22, 0.92 + r4 * 0.20, 0.94 + r4 * 0.18);
        break;
      }

      case 'mountain': {
        const snowy = (h > 3.0) || (r4 < 0.10 && h > 2.2);
        const sy = 0.80 + r3 * 1.15 + Math.max(0, h - 1.5) * 0.22;
        pushInst(bucket, snowy ? 'mountain.snow' : 'mountain.rock',
          x + (r1 - 0.5) * 0.34, h - 0.28, y + (r2 - 0.5) * 0.34,
          (r3 - 0.5) * 0.16, r1 * Math.PI * 2, (r4 - 0.5) * 0.16,
          0.85 + r2 * 0.55, sy, 0.85 + r4 * 0.55,
          0.88 + r3 * 0.26, 0.90 + r3 * 0.22, 0.92 + r3 * 0.20);
        break;
      }

      case 'snowtuft': {
        if (r1 > 0.62) break;
        pushInst(bucket, 'snowtuft',
          x + (r2 - 0.5) * 0.4, h, y + (r3 - 0.5) * 0.4,
          0, r1 * Math.PI * 2, 0,
          0.8 + r4 * 0.7, 0.7 + r2 * 0.9, 0.8 + r3 * 0.7,
          1, 1, 1);
        break;
      }

      case 'shell': {
        // Comme en 2D : un coquillage seulement de temps en temps.
        if (R3.hash(x, y) >= 0.07) break;
        pushInst(bucket, 'shell',
          x + (r2 - 0.5) * 0.4, h, y + (r3 - 0.5) * 0.4,
          0, r1 * Math.PI * 2, 0,
          0.85 + r4 * 0.5, 0.85 + r4 * 0.5, 0.85 + r4 * 0.5,
          0.95 + r1 * 0.15, 0.95 + r2 * 0.12, 0.98 + r3 * 0.08);
        break;
      }

      case 'mowline': {
        // Bandes de tonte de 2 tuiles, façon pelouse de stade (drawParkGrass).
        if ((y & 3) >= 2) break;
        pushInst(bucket, 'mowline', x, h + 0.02, y, 0, 0, 0, 1, 1, 1,
          0.98 + r1 * 0.06, 1.0, 0.96 + r2 * 0.06);
        break;
      }

      case 'bench': {
        const ry = faceRot(x, y, isParkPath, 0);
        pushInst(bucket, 'bench', x, h, y, 0, ry, 0, 1, 1, 1, 1, 1, 1);
        break;
      }

      case 'reeds': {
        pushInst(bucket, 'reeds',
          x + (r1 - 0.5) * 0.2, h, y + (r2 - 0.5) * 0.2,
          0, r3 * Math.PI * 2, 0,
          0.9 + r4 * 0.3, 0.85 + r1 * 0.4, 0.9 + r2 * 0.3,
          0.95 + r3 * 0.12, 1.0, 0.95 + r4 * 0.1);
        break;
      }

      case 'fountain': {
        const big = (type === 'FOUNTAIN2');
        pushInst(bucket, big ? 'fountain.big' : 'fountain.small',
          x, h, y, 0, 0, 0, 1, 1, 1, 1, 1, 1);
        fountains.push({ x: x, y: y, h: h, big: big });
        break;
      }

      case 'house':
      case 'house2': {
        const roof = (st.roof || '#d1483f').replace('#', '');
        const ry = faceRot(x, y, isStreet, 0);
        pushInst(bucket, deco + '.' + roof,
          x + (r1 - 0.5) * 0.06, h - 0.02, y + (r2 - 0.5) * 0.06,
          0, ry + (r3 - 0.5) * 0.10, 0,
          0.97 + r3 * 0.06, 0.95 + r4 * 0.12, 0.97 + r4 * 0.06,
          0.96 + r1 * 0.09, 0.96 + r2 * 0.09, 0.96 + r3 * 0.09);
        break;
      }

      case 'vlghouse': {
        const ry = faceRot(x, y, isStreet, 0);
        pushInst(bucket, 'vlghouse',
          x + (r1 - 0.5) * 0.14, h - 0.02, y + (r2 - 0.5) * 0.14,
          0, ry + (r3 - 0.5) * 0.30, 0,
          0.95 + r3 * 0.14, 0.92 + r4 * 0.18, 0.95 + r4 * 0.14,
          0.96 + r1 * 0.10, 0.95 + r2 * 0.10, 0.94 + r3 * 0.10);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  GÉOMÉTRIE DE TERRAIN D'UN CHUNK
  //  2 sous-cases par tuile : le sommet central porte la couleur PURE de la
  //  tuile, les sommets de bord la moyenne des tuiles voisines. Résultat : les
  //  chemins et les places restent nets, mais aucune couture ne saute aux yeux.
  // ---------------------------------------------------------------------------
  function tileColorInto(m, n, out) {
    // Colonnes de tuiles touchées par le sous-sommet m (idem lignes pour n).
    let tx0, tx1, ty0, ty1;
    if (m & 1) { tx0 = tx1 = (m - 1) >> 1; } else { tx0 = (m >> 1) - 1; tx1 = m >> 1; }
    if (n & 1) { ty0 = ty1 = (n - 1) >> 1; } else { ty0 = (n >> 1) - 1; ty1 = n >> 1; }
    let r = 0, g = 0, b = 0, k = 0;
    for (let ty = ty0; ty <= ty1; ty++) {
      const cy = ty < 0 ? 0 : (ty >= H ? H - 1 : ty);
      for (let tx = tx0; tx <= tx1; tx++) {
        const cx = tx < 0 ? 0 : (tx >= W ? W - 1 : tx);
        const o = (cy * W + cx) * 3;
        r += TC[o]; g += TC[o + 1]; b += TC[o + 2];
        k++;
      }
    }
    out[0] = r / k; out[1] = g / k; out[2] = b / k;
  }

  function buildChunkTerrain(x0, x1, y0, y1) {
    const tw = x1 - x0 + 1, td = y1 - y0 + 1;
    const nx = tw * 2, nz = td * 2;              // sous-cases
    const vx = nx + 1, vz = nz + 1;              // sommets
    const pos = new Float32Array(vx * vz * 3);
    const col = new Float32Array(vx * vz * 3);
    const c = [0, 0, 0];

    for (let n = 0; n < vz; n++) {
      const gn = y0 * 2 + n;
      const j = gn >> 1;
      const v = (gn & 1) ? 0.5 : 0;
      for (let m = 0; m < vx; m++) {
        const gm = x0 * 2 + m;
        const i = gm >> 1;
        const u = (gm & 1) ? 0.5 : 0;
        const A = cornerH(i, j), B = cornerH(i + 1, j);
        const C = cornerH(i, j + 1), D = cornerH(i + 1, j + 1);
        const o = (n * vx + m) * 3;
        pos[o] = gm * 0.5 - 0.5;
        pos[o + 1] = bil(A, B, C, D, u, v);
        pos[o + 2] = gn * 0.5 - 0.5;
        tileColorInto(gm, gn, c);
        col[o] = c[0]; col[o + 1] = c[1]; col[o + 2] = c[2];
      }
    }

    // Indices — diagonale (+x,−z) → (−x,+z), la MÊME que celle de heightAt().
    const idx = new Uint32Array(nx * nz * 6);
    let k = 0;
    for (let n = 0; n < nz; n++) {
      for (let m = 0; m < nx; m++) {
        const a = n * vx + m;            // (−x, −z)
        const b = a + 1;                 // (+x, −z)
        const cc = a + vx;               // (−x, +z)
        const d = cc + 1;                // (+x, +z)
        idx[k++] = a; idx[k++] = cc; idx[k++] = b;
        idx[k++] = b; idx[k++] = cc; idx[k++] = d;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }

  // ---------------------------------------------------------------------------
  //  JUPE DE BORDURE — prolonge le paysage bien au-delà de la carte pour qu'on
  //  ne voie jamais « le bout du monde ». Le brouillard de sky3d fait le reste.
  // ---------------------------------------------------------------------------
  function buildSkirt() {
    const P = [], C = [];
    const xMin = -0.5, xMax = W - 0.5, zMin = -0.5, zMax = H - 0.5;
    const c = [0, 0, 0];

    function quad(p00, p10, p01, p11, cr, cg, cb) {
      const t = [p00, p01, p10, p10, p01, p11];
      for (let i = 0; i < 6; i++) {
        P.push(t[i][0], t[i][1], t[i][2]);
        C.push(cr, cg, cb);
      }
    }
    // Couleur de la tuile de bord. Devant l'océan, on triche : la jupe prend la
    // couleur profonde de l'eau et se cale JUSTE SOUS le niveau de la mer, si
    // bien qu'elle prolonge la nappe animée jusqu'à l'horizon sans rupture.
    const SEA_DEEP = new THREE.Color('#1b2c62');
    let seaEdge = false;
    function tcol(tx, ty) {
      const cx = tx < 0 ? 0 : (tx >= W ? W - 1 : tx);
      const cy = ty < 0 ? 0 : (ty >= H ? H - 1 : ty);
      const st = R3.tileStyle(tileAt(cx, cy));
      seaEdge = !!st.water;
      if (seaEdge) { c[0] = SEA_DEEP.r; c[1] = SEA_DEEP.g; c[2] = SEA_DEEP.b; return; }
      const o = (cy * W + cx) * 3;
      c[0] = TC[o]; c[1] = TC[o + 1]; c[2] = TC[o + 2];
    }
    const SEA_Y = -0.12;

    for (let i = 0; i < W; i++) {
      const xa = i - 0.5, xb = i + 0.5;
      // nord
      tcol(i, 0);
      let ha = seaEdge ? SEA_Y : cornerH(i, 0), hb = seaEdge ? SEA_Y : cornerH(i + 1, 0);
      quad([xa, ha, zMin - SKIRT], [xb, hb, zMin - SKIRT], [xa, ha, zMin], [xb, hb, zMin], c[0], c[1], c[2]);
      // sud
      tcol(i, H - 1);
      ha = seaEdge ? SEA_Y : cornerH(i, H); hb = seaEdge ? SEA_Y : cornerH(i + 1, H);
      quad([xa, ha, zMax], [xb, hb, zMax], [xa, ha, zMax + SKIRT], [xb, hb, zMax + SKIRT], c[0], c[1], c[2]);
    }
    for (let j = 0; j < H; j++) {
      const za = j - 0.5, zb = j + 0.5;
      // ouest
      tcol(0, j);
      let ha = seaEdge ? SEA_Y : cornerH(0, j), hb = seaEdge ? SEA_Y : cornerH(0, j + 1);
      quad([xMin - SKIRT, ha, za], [xMin, ha, za], [xMin - SKIRT, hb, zb], [xMin, hb, zb], c[0], c[1], c[2]);
      // est
      tcol(W - 1, j);
      ha = seaEdge ? SEA_Y : cornerH(W, j); hb = seaEdge ? SEA_Y : cornerH(W, j + 1);
      quad([xMax, ha, za], [xMax + SKIRT, ha, za], [xMax, hb, zb], [xMax + SKIRT, hb, zb], c[0], c[1], c[2]);
    }
    // Les 4 coins
    const corners = [
      [0, 0, xMin - SKIRT, zMin - SKIRT, xMin, zMin],
      [W, 0, xMax, zMin - SKIRT, xMax + SKIRT, zMin],
      [0, H, xMin - SKIRT, zMax, xMin, zMax + SKIRT],
      [W, H, xMax, zMax, xMax + SKIRT, zMax + SKIRT],
    ];
    for (let i = 0; i < corners.length; i++) {
      const q = corners[i];
      tcol(q[0] >= W ? W - 1 : 0, q[1] >= H ? H - 1 : 0);
      const h = seaEdge ? SEA_Y : cornerH(q[0], q[1]);
      quad([q[2], h, q[3]], [q[4], h, q[3]], [q[2], h, q[5]], [q[4], h, q[5]], c[0], c[1], c[2]);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, matGround());
    m.castShadow = false;
    m.receiveShadow = false;
    m.name = 'bordure';
    return m;
  }

  // ---------------------------------------------------------------------------
  //  EAU — regroupement des tuiles par type d'eau, puis délégation à
  //  water3d.js. Repli intégré si le module manque.
  // ---------------------------------------------------------------------------
  const WATER_KIND_OF = {};
  (function () {
    const S = R3.TILE_STYLE;
    for (const k in S) { if (S[k].water) WATER_KIND_OF[k] = S[k].water; }
  })();

  function fallbackWaterMesh(tiles, kind) {
    const level = { lake: -0.06, pond: -0.06, sea: -0.05, waves: -0.03, shallow: -0.05 }[kind] || -0.05;
    const colors = { lake: '#2a55b0', pond: '#2a4bb0', sea: '#22357a', waves: '#4fb2e6', shallow: '#3f95cf' };
    const P = [];
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const a = t.x - 0.5, b = t.x + 0.5, u = t.y - 0.5, v = t.y + 0.5;
      P.push(a, level, u, a, level, v, b, level, u, b, level, u, a, level, v, b, level, v);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, R3.mat(colors[kind] || '#2a55b0', {
      transparent: true, opacity: 0.82, rough: 0.15, metal: 0.05,
    }));
    m.receiveShadow = false;
    m.castShadow = false;
    return m;
  }

  function buildWater(parent) {
    const water = R3.get('water');

    // Une nappe par TYPE d'eau (et non par flaque) : water3d.js sait très bien
    // gérer des tuiles disjointes, et on économise une vingtaine de draw calls.
    // Les tuiles d'un même type ayant toutes la même profondeur, le niveau de
    // surface calculé par water3d est identique — aucune marche visible.
    const groups = Object.create(null);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const kind = WATER_KIND_OF[tileAt(x, y)];
        if (!kind) continue;
        (groups[kind] || (groups[kind] = [])).push({ x: x, y: y, h: TH[y * W + x] });
      }
    }

    // La mer déborde de la carte : on la prolonge de tuiles virtuelles pour
    // qu'elle rejoigne l'horizon au lieu de s'arrêter net sous les yeux de Robin.
    if (groups.sea) {
      const sea = groups.sea;
      for (let ey = H; ey < H + 14; ey++) {
        for (let ex = -12; ex < W + 12; ex++) sea.push({ x: ex, y: ey, h: -0.7 });
      }
      for (let ey = 58; ey < H; ey++) {
        for (let ex = -12; ex < 0; ex++) sea.push({ x: ex, y: ey, h: -0.7 });
        for (let ex = W; ex < W + 12; ex++) sea.push({ x: ex, y: ey, h: -0.7 });
      }
    }

    let n = 0;
    for (const kind in groups) {
      let mesh = null;
      if (water && water.makeSurface) {
        try { mesh = water.makeSurface(groups[kind], kind); } catch (e) {
          console.error('[world3d] water.makeSurface a échoué :', e);
          mesh = null;
        }
      }
      if (!mesh) mesh = fallbackWaterMesh(groups[kind], kind);
      mesh.name = 'eau-' + kind;
      parent.add(mesh);
      n++;
    }
    return n;
  }

  // ---------------------------------------------------------------------------
  //  FONTAINES — la vasque est instanciée avec les autres décors ; l'eau et le
  //  jet sont ajoutés à part, car ils demandent le matériau animé de water3d.
  // ---------------------------------------------------------------------------
  const fountains = [];
  const fountainFx = [];

  function buildFountainWater(parent) {
    const water = R3.get('water');
    for (let i = 0; i < fountains.length; i++) {
      const f = fountains[i];
      const k = f.big ? 1.32 : 1.0;
      // On prend le matériau « fountain » de water3d : contrairement aux nappes,
      // il n'attend aucun attribut de géométrie particulier (pas de aEdge), donc
      // on peut le poser sur n'importe quelle forme.
      let matJet = null;
      if (water && water.material) {
        try { matJet = water.material('fountain'); } catch (e) { matJet = null; }
      }
      if (!matJet) matJet = R3.matGlass('#a8ecf7', 0.58);
      const matSurf = matJet;

      const g = new THREE.Group();
      g.position.set(f.x, f.h, f.y);

      const disc = new THREE.Mesh(R3.geo.cyl(0.40 * k, 0.40 * k, 0.02, 16), matSurf);
      disc.position.y = 0.25;
      g.add(disc);

      // Jet : une colonne fuselée + une couronne de gouttes qui retombent.
      const jet = new THREE.Mesh(R3.geo.cyl(0.035, 0.075, 0.42 * k, 8), matJet);
      jet.position.y = 0.44 + 0.42 * k + 0.24;
      g.add(jet);
      const drops = new THREE.Group();
      drops.position.y = 0.44 + 0.42 * k;
      for (let d = 0; d < 6; d++) {
        const a = (d / 6) * Math.PI * 2;
        const s = new THREE.Mesh(R3.geo.sphere(0.05, 6), matJet);
        s.position.set(Math.cos(a) * 0.22 * k, 0.1, Math.sin(a) * 0.22 * k);
        s.userData.a = a;
        drops.add(s);
      }
      g.add(drops);
      parent.add(g);
      fountainFx.push({ root: g, jet: jet, drops: drops, k: k, x: f.x, z: f.y, phase: f.x * 0.7 + f.y * 0.3 });
    }
  }

  // ---------------------------------------------------------------------------
  //  CONSTRUCTION GÉNÉRALE
  // ---------------------------------------------------------------------------
  const root = new THREE.Group();
  root.name = 'monde';
  const chunks = [];          // { group, cx, cz, radius }
  const waterGroup = new THREE.Group();
  waterGroup.name = 'eaux';
  const fxGroup = new THREE.Group();
  fxGroup.name = 'fontaines';
  let built = false;
  let drawCalls = 0;

  function build(scene) {
    if (built) { if (scene && root.parent !== scene) scene.add(root); return; }
    built = true;
    const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;

    buildField();

    const shadows = !!R3.quality.shadows;

    for (let cy = 0; cy < NCY; cy++) {
      for (let cx = 0; cx < NCX; cx++) {
        const x0 = cx * CHUNK, x1 = Math.min(W - 1, x0 + CHUNK - 1);
        const y0 = cy * CHUNK, y1 = Math.min(H - 1, y0 + CHUNK - 1);

        const grp = new THREE.Group();
        grp.name = 'chunk_' + cx + '_' + cy;

        // --- terrain ---
        const gm = new THREE.Mesh(buildChunkTerrain(x0, x1, y0, y1), matGround());
        gm.castShadow = false;
        gm.receiveShadow = true;
        grp.add(gm);
        drawCalls++;

        // --- décors ---
        const bucket = Object.create(null);
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) placeDecos(bucket, x, y);
        }
        for (const key in bucket) {
          const b = bucket[key];
          const p = proto(key);
          const n = b.m.length / 16;
          if (!p || !n) continue;
          const im = new THREE.InstancedMesh(p.geo, p.mat, n);
          im.instanceMatrix.array.set(b.m);
          im.instanceMatrix.needsUpdate = true;
          im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(b.c), 3);
          im.instanceColor.needsUpdate = true;
          im.castShadow = p.cast && shadows;
          im.receiveShadow = true;
          im.name = key;
          im.computeBoundingSphere();
          grp.add(im);
          drawCalls++;
        }

        grp.userData.cx = (x0 + x1) * 0.5;
        grp.userData.cz = (y0 + y1) * 0.5;
        grp.userData.radius = Math.sqrt(
          ((x1 - x0 + 1) * 0.5) * ((x1 - x0 + 1) * 0.5) +
          ((y1 - y0 + 1) * 0.5) * ((y1 - y0 + 1) * 0.5)
        );
        chunks.push(grp);
        root.add(grp);
      }
    }

    root.add(buildSkirt());
    drawCalls++;

    root.add(waterGroup);
    drawCalls += buildWater(waterGroup);

    root.add(fxGroup);
    buildFountainWater(fxGroup);

    if (scene) scene.add(root);

    // Si la qualité change en cours de partie, on suit (ombres surtout).
    R3.onQualityChange(function (q) {
      for (let i = 0; i < chunks.length; i++) {
        const g = chunks[i];
        for (let j = 0; j < g.children.length; j++) {
          const ch = g.children[j];
          if (ch.isInstancedMesh) {
            const p = PROTOS[ch.name];
            ch.castShadow = !!(p && p.cast) && !!q.shadows;
          }
        }
      }
    });

    if (typeof performance !== 'undefined') {
      console.log('[world3d] monde bâti en ' + Math.round(performance.now() - t0) +
        ' ms — ' + chunks.length + ' chunks, ' + drawCalls + ' draw calls potentiels.');
    }
  }

  // ---------------------------------------------------------------------------
  //  update() — balancement des herbes, jets de fontaine, visibilité des chunks
  // ---------------------------------------------------------------------------
  const _swayMats = [];
  let _swayCollected = false;

  function update(t, px, pz) {
    if (!built) return;

    // Balancement : une seule écriture d'uniform pour toute la végétation.
    if (!_swayCollected) {
      _swayCollected = true;
      _vcMats.forEach(function (m) { if (m.userData && m.userData.uTime) _swayMats.push(m); });
    }
    for (let i = 0; i < _swayMats.length; i++) _swayMats[i].userData.uTime.value = t;

    // Culling par chunk : au-delà de la distance de vue, on n'y touche même plus.
    if (typeof px === 'number' && typeof pz === 'number') {
      const far = (R3.quality.viewDistance || 46) + 18;
      for (let i = 0; i < chunks.length; i++) {
        const g = chunks[i];
        const dx = g.userData.cx - px, dz = g.userData.cz - pz;
        g.visible = Math.sqrt(dx * dx + dz * dz) - g.userData.radius < far;
      }
    }

    // Fontaines : le jet respire et les gouttes retombent en boucle.
    for (let i = 0; i < fountainFx.length; i++) {
      const f = fountainFx[i];
      if (typeof px === 'number') {
        const dx = f.x - px, dz = f.z - pz;
        f.root.visible = (dx * dx + dz * dz) < 44 * 44;
        if (!f.root.visible) continue;
      }
      const s = 1 + Math.sin(t * 3.1 + f.phase) * 0.09;
      f.jet.scale.set(1 / s, s, 1 / s);
      const kids = f.drops.children;
      for (let d = 0; d < kids.length; d++) {
        const o = kids[d];
        const p = ((t * 0.9 + d / kids.length + f.phase * 0.1) % 1);
        const rr = 0.10 + p * 0.26 * f.k;
        o.position.set(Math.cos(o.userData.a) * rr, 0.16 - p * p * 0.42, Math.sin(o.userData.a) * rr);
        o.scale.setScalar(1 - p * 0.55);
      }
    }
  }

  // ---------------------------------------------------------------------------
  R3.register('world', {
    build: build,
    heightAt: heightAt,
    update: update,
    root: root,
    // Extras utiles au débogage (hors contrat) :
    chunks: chunks,
    drawCallCount: function () { return drawCalls; },
  });
})();
