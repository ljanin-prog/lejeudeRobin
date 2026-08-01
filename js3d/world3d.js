// =============================================================================
//  world3d.js — LE TERRAIN ET LES DÉCORS du « Jeu de Robin » en 3D  (contrat v2, §15)
// =============================================================================
//  Refonte pour les six régions de 384×224 tuiles (86 016 tuiles, ~10× la carte
//  d'origine) : l'ancien world3d.js construisait tout au démarrage, ce qui ne
//  passe plus à cette échelle. Ici on STREAME par chunks de 32×32 tuiles autour
//  du joueur — le principe (BufferGeometry + vertex colors, lissage bilinéaire,
//  InstancedMesh par catégorie de décor, délégation à water3d) reste celui de
//  la v1, simplement rejoué chunk par chunk plutôt qu'une fois pour toute la carte.
//
//  Ce qu'il fait :
//    1. setRegion(id) — recalcule le CHAMP DE HAUTEUR de toute la région (deux
//       Float32Array de ~86 016 entrées) UNE SEULE FOIS : jamais par chunk,
//       sinon les bords des chunks ne raccordent pas. Repère aussi les blocs de
//       tuiles contiguës formant un même monument (château, église, arène…).
//    2. update(t,px,pz) — construit les chunks proches (au plus 2 par frame,
//       sinon un à-coup à chaque déplacement rapide) et libère les chunks
//       lointains, avec une marge d'hystérésis pour ne pas clignoter aux
//       frontières.
//    3. heightAt(x,z) — hauteur lissée interpolée, exacte même pour un chunk
//       pas encore construit (elle ne dépend que du champ de hauteur global).
//    4. Décors : les tuiles ordinaires (arbres, fleurs, rochers…) restent
//       instanciées (un InstancedMesh par catégorie et par chunk) ; les tuiles
//       « monument » (château, rempart, arène…) sont déléguées à
//       R3.get('citybuild').build(kind, opts) et ajoutées telles quelles.
//    5. Eau : les tuiles d'eau d'un chunk sont regroupées par type et confiées
//       à R3.get('water').makeSurface() ; repli en plan coloré pour les types
//       que water3d ne connaît pas encore ('lava', 'swamp', 'ice').
//
//  API — voir CONTRACT2.md §15 :
//    R3.register('world', { build(scene), setRegion(id), heightAt(x,z),
//                            update(t,px,pz), root, stats() })
//
//  Repère : tuile (tx, ty) -> monde (x = tx, z = ty), y = hauteur, 1 tuile = 1 u.
// =============================================================================

(function () {
  'use strict';

  // Règle n°7 du contrat : jamais d'exception au chargement, même sans THREE
  // ou sans R3 — mais ici les deux sont réellement indispensables (aucune
  // primitive de rendu sans eux), donc on se contente de ne rien enregistrer.
  if (typeof THREE === 'undefined' || typeof R3 === 'undefined' || !R3) return;

  // ---------------------------------------------------------------------------
  //  ACCÈS AUX AUTRES MODULES — toujours à travers R3.get(), jamais mis en
  //  cache dans une variable de haut niveau : voir le piège documenté (une
  //  variable locale nommée pareil que le module masquerait la liaison).
  //  Repli systématique si le module manque (règle n°7 du contrat).
  // ---------------------------------------------------------------------------
  function regionsApi() { try { return R3.get('regions') || null; } catch (e) { return null; } }
  function tilesApi() { try { return R3.get('tiles') || null; } catch (e) { return null; } }
  function cityApi() { try { return R3.get('citybuild') || null; } catch (e) { return null; } }
  function waterApi() { try { return R3.get('water') || null; } catch (e) { return null; } }

  /** Type de tuile à (x,y) — via regions3d si présent, GRASS sinon (§9 : « un
   *  enfant ne doit jamais se retrouver devant un monde vide »). */
  function tileAt(x, y) {
    const R = regionsApi();
    if (R && typeof R.tileAt === 'function') {
      try { return R.tileAt(x, y); } catch (e) { /* repli ci-dessous */ }
    }
    return 'GRASS';
  }

  const clamp01 = R3.clamp01;

  // ---------------------------------------------------------------------------
  //  DIMENSIONS DE LA RÉGION ACTIVE — W/H sont des GETTERS côté regions3d
  //  (contrat §9) : on les relit à chaque setRegion, jamais mis en cache entre
  //  deux régions.
  // ---------------------------------------------------------------------------
  const CHUNK = 32;                 // taille d'un chunk, en tuiles (contrat §15)
  const BUILD_BUDGET = 2;           // chunks construits au plus par frame
  const SKIRT = 34;                 // débord de la « jupe » hors carte
  const SKIRT_DROP = 16;            // de combien son bord extérieur plonge

  let W = 384, H = 224;
  let NCX = 1, NCY = 1;
  let activeRegionId = null;
  let activeSeed = 0;
  let regionStyle = 'emeraude';

  // Style de ville (citybuild3d) associé à chaque région (contrat §3/§14).
  const REGION_STYLE = {
    val: 'emeraude', sylve: 'ambrelune', saphir: 'saphir',
    givre: 'cimefroide', braise: 'fournaise', aurore: 'aurore',
  };

  // ---------------------------------------------------------------------------
  //  BRUIT DÉTERMINISTE (identique dans l'esprit à la v1, sur R3.hash)
  // ---------------------------------------------------------------------------
  function vnoise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = R3.hash(x0, y0), b = R3.hash(x0 + 1, y0);
    const c = R3.hash(x0, y0 + 1), d = R3.hash(x0 + 1, y0 + 1);
    const top = a + (b - a) * sx;
    const bot = c + (d - c) * sx;
    return top + (bot - top) * sy;
  }

  /** Bruit de valeur lissé sur `cell` tuiles — sert aux tailles/formes variées
   *  des rochers/montagnes, sans dépendre d'un repère de carte fixe. */
  function relief(x, y, cell) {
    const fx = x / cell, fy = y / cell;
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = fx - i, ty = fy - j;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = R3.hash(i, j), b = R3.hash(i + 1, j);
    const c = R3.hash(i, j + 1), d = R3.hash(i + 1, j + 1);
    const h0 = a + (b - a) * sx, h1 = c + (d - c) * sx;
    return h0 + (h1 - h0) * sy;
  }

  // ---------------------------------------------------------------------------
  //  CHAMP DE HAUTEUR — recalculé UNE SEULE FOIS par setRegion (§15).
  //  Contrairement à la v1 (une seule carte, un seul massif tuné à la main),
  //  chaque tuile connaît déjà une hauteur cohérente avec son biome
  //  (tiles3d.js : MOUNTAIN=1.30, GLACIER=1.90, CLIFF=1.40…) puisque
  //  regions3d.js place déjà les biomes en grandes zones cohérentes. On se
  //  contente donc de lisser + d'ajouter une ondulation légère et TOUJOURS
  //  POSITIVE (la terre se soulève, elle ne se creuse jamais — sinon une berge
  //  pourrait passer sous l'eau), atténuée près des zones plates (pavés,
  //  eau) pour qu'aucune place ne gondole.
  // ---------------------------------------------------------------------------
  let TH = null;    // hauteur brute par tuile             (W × H)
  let CH = null;    // hauteur LISSÉE par sommet           ((W+1) × (H+1))

  // Tuiles plates par nature (routes, places, eaux, sols de bâtiments) — en
  // plus de la règle générale « tout ce qui est de biome 'citadel' est plat »
  // (tiles3d.js, §5 : « une place bosselée ruinerait l'effet ville monumentale »).
  const FLAT_TYPES = {
    PATH: 1, CITY_PATH: 1, CITY_GROUND: 1, CITY2_PATH: 1, CITY2_GROUND: 1,
    HOUSE_RED: 1, HOUSE_BLUE: 1, HOUSE_YELLOW: 1, FOUNTAIN: 1, FOUNTAIN2: 1,
    HOUSE2_RED: 1, HOUSE2_BLUE: 1, HOUSE2_YELLOW: 1,
    VLG_PATH: 1, PARK_PATH: 1, MTN_PATH: 1,
    STAR_PATH: 1, RUIN_STONE: 1, OBSERVATORY_FLOOR: 1, CLOUD_STONE: 1,
    MUD: 1, BASALT: 1, CRACKED_EARTH: 1, ASH: 1, LAVA_CRUST: 1,
    DESERT_SAND: 1, CORAL_SAND: 1, SAND: 1, ICE: 1,
  };

  function isFlatType(type, st) {
    if (st.water) return true;
    if (st.biome === 'citadel') return true;
    return !!FLAT_TYPES[type];
  }

  function cornerH(i, j) {
    if (i < 0) i = 0; else if (i > W) i = W;
    if (j < 0) j = 0; else if (j > H) j = H;
    return CH[j * (W + 1) + i];
  }

  function buildHeightField() {
    TH = new Float32Array(W * H);
    const flat = new Uint8Array(W * H);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = y * W + x;
        const type = tileAt(x, y);
        const st = R3.tileStyle(type);
        TH[o] = st.h;
        flat[o] = isFlatType(type, st) ? 1 : 0;
      }
    }

    // Ondulation douce, atténuée près des zones plates (test des 4 voisins :
    // moins cher qu'un flou séparable complet, largement suffisant à cette
    // échelle — le lissage des sommets, juste après, absorbe le reste).
    const sox = (activeSeed % 977) * 0.31, soy = ((activeSeed >> 3) % 977) * 0.27;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = y * W + x;
        if (flat[o]) continue;
        let nf = 0;
        if (x > 0 && flat[o - 1]) nf++;
        if (x < W - 1 && flat[o + 1]) nf++;
        if (y > 0 && flat[o - W]) nf++;
        if (y < H - 1 && flat[o + W]) nf++;
        const amp = 0.16 * (1 - nf / 4);
        if (amp > 0.001) TH[o] += amp * vnoise(x / 11.5 + sox, y / 11.5 + soy);
      }
    }

    // Lissage : un sommet = moyenne des 4 tuiles qui le touchent (identique
    // à la v1 — c'est ce qui garantit qu'aucune couture ne saute aux yeux et
    // que heightAt() reste cohérente au pixel près avec la géométrie affichée).
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

  function bil(A, B, C, D, u, v) {
    const top = A + (B - A) * u;
    const bot = C + (D - C) * u;
    return top + (bot - top) * v;
  }

  /** heightAt(x,z) — voir contrat §15 : exacte même hors chunk construit,
   *  puisqu'elle ne dépend que du champ de hauteur global (CH). Même
   *  subdivision 2×2 par tuile et même diagonale que la géométrie affichée
   *  (buildChunkTerrain) : le joueur ne flotte ni ne s'enfonce jamais. */
  function heightAt(x, z) {
    if (!CH) return 0;
    if (!isFinite(x) || !isFinite(z)) return 0;

    let fi = x + 0.5, fj = z + 0.5;
    if (fi < 0) fi = 0; else if (fi > W) fi = W;
    if (fj < 0) fj = 0; else if (fj > H) fj = H;
    let i = Math.floor(fi), j = Math.floor(fj);
    if (i >= W) i = W - 1;
    if (j >= H) j = H - 1;
    const u = fi - i, v = fj - j;

    const A = cornerH(i, j), B = cornerH(i + 1, j);
    const C = cornerH(i, j + 1), D = cornerH(i + 1, j + 1);

    const u0 = (u < 0.5) ? 0 : 0.5;
    const v0 = (v < 0.5) ? 0 : 0.5;
    const h00 = bil(A, B, C, D, u0, v0);
    const h10 = bil(A, B, C, D, u0 + 0.5, v0);
    const h01 = bil(A, B, C, D, u0, v0 + 0.5);
    const h11 = bil(A, B, C, D, u0 + 0.5, v0 + 0.5);

    const a = (u - u0) * 2, b = (v - v0) * 2;
    if (a + b <= 1) return h00 + (h10 - h00) * a + (h01 - h00) * b;
    return h11 + (h10 - h11) * (1 - b) + (h01 - h11) * (1 - a);
  }

  // ---------------------------------------------------------------------------
  //  MATÉRIAUX PARTAGÉS — 5 seaux, comme en v1. Les 18 nouveaux décors
  //  réutilisent ces mêmes seaux (le contraste vient des VERTEX COLORS propres
  //  à chaque sous-pièce du prototype, pas d'un nouveau matériau) : c'est ce
  //  qui garde le budget de matériaux constant malgré 3× plus de décors.
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
  function matBlade() { return vcMat('blade', { rough: 0.9, side: THREE.DoubleSide }, { amp: 0.15, y0: 0.04, y1: 0.62, speed: 1.6 }); }

  // ---------------------------------------------------------------------------
  //  bake() — aplatit un groupe de meshes R3 en UN SEUL BufferGeometry à vertex
  //  colors (identique à la v1). Les géométries de PROTOTYPES sont PARTAGÉES
  //  entre tous les chunks : on les marque `userData.shared = true` pour que
  //  R3.disposeTree() (appelé au déchargement d'un chunk) ne les détruise
  //  JAMAIS — sinon le premier chunk libéré casserait le rendu de tous les
  //  autres chunks qui utilisent encore ce même arbre/rocher/etc.
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
    geom.userData.shared = true;   // voir le commentaire ci-dessus — NE PAS retirer
    return geom;
  }

  // ---------------------------------------------------------------------------
  //  PETITES GÉOMÉTRIES MAISON (lamelles, prismes) — identiques à la v1.
  // ---------------------------------------------------------------------------
  const _localGeos = new Map();

  function bladeGeo(w, h) {
    const k = 'blade|' + w + '|' + h;
    let g = _localGeos.get(k);
    if (g) return g;
    const hw = w / 2, tw = w * 0.13;
    const p = [-hw, 0, 0, hw, 0, 0, tw, h, 0, -hw, 0, 0, tw, h, 0, -tw, h, 0];
    const n = [];
    const s = 1 / Math.sqrt(1 + 0.36);
    for (let i = 0; i < 6; i++) n.push(0, 0.6 * s, s);
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    _localGeos.set(k, g);
    return g;
  }

  function prismGeo(w, h, d) {
    const k = 'prism|' + w + '|' + h + '|' + d;
    let g = _localGeos.get(k);
    if (g) return g;
    const hw = w / 2, hd = d / 2;
    const A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [hw, 0, hd], D = [-hw, 0, hd];
    const E = [-hw, h, 0], F = [hw, h, 0];
    const p = [];
    function tri(a, b, c) { p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
    tri(A, F, B); tri(A, E, F);
    tri(D, C, F); tri(D, F, E);
    tri(A, D, E);
    tri(B, F, C);
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
  //  PROTOTYPES DE DÉCOR — repris tels quels de la v1 (A) puis les 18 nouveaux
  //  décors du contrat §15 (B). Chaque fonction renvoie un THREE.Group posé sur
  //  y = 0, centré en (0,0), qui sera cuit (bake) puis instancié.
  // ---------------------------------------------------------------------------

  // === A. DÉCORS REPRIS DE LA V1 (identiques) =================================

  function protoTree(variant) {
    const g = R3.group();
    if (variant === 'park') {
      g.add(R3.cyl(0.09, 0.14, 0.82, '#8b5a2b', 0, 0.41, 0, { seg: 7 }));
      g.add(R3.cyl(0.15, 0.23, 0.12, '#7a4d24', 0, 0.06, 0, { seg: 7 }));
      g.add(R3.ellipsoid(0.52, 0.50, 0.52, '#27ae60', 0, 1.24, 0, { seg: 8 }));
      g.add(R3.ellipsoid(0.34, 0.32, 0.33, '#38b764', -0.18, 1.50, 0.10, { seg: 8 }));
      g.add(R3.ellipsoid(0.28, 0.27, 0.28, '#2fa055', 0.22, 1.42, -0.12, { seg: 8 }));
      g.add(R3.ellipsoid(0.22, 0.21, 0.22, '#5bd07a', 0.02, 1.62, 0.06, { seg: 8 }));
    } else {
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

  function protoTallGrass() {
    const g = R3.group();
    const dark = '#1e7a37', mid = '#2b9c46', tip = '#63c95f';
    for (let i = 0; i < 3; i++) g.add(blade(0.46, 0.62, i === 1 ? mid : dark, 0, 0, 0, i * Math.PI / 3, 0));
    const spots = [
      [-0.26, -0.18, 0.52, 0.9, 0.18], [0.28, -0.10, 0.46, -0.4, -0.22],
      [0.10, 0.28, 0.58, 2.1, 0.12], [-0.14, 0.26, 0.42, 1.4, -0.16],
      [0.24, 0.20, 0.36, 0.2, 0.26],
    ];
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      g.add(blade(0.14, s[2], i % 2 ? tip : mid, s[0], 0, s[1], s[3], s[4]));
    }
    const base = R3.ellipsoid(0.40, 0.05, 0.40, '#1c6b32', 0, 0.03, 0, { seg: 8 });
    base.castShadow = false;
    g.add(base);
    return { geo: bake(g), mat: matBlade(), cast: false };
  }

  function protoFlowers() {
    const g = R3.group();
    const cols = ['#ffaad8', '#f1c40f', '#d896ff', '#fc7460', '#73eff7'];
    const spots = [[-0.20, -0.14, 0.22], [0.18, -0.20, 0.26], [0.22, 0.20, 0.20], [-0.16, 0.22, 0.24]];
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i]; const c = cols[i % cols.length];
      g.add(R3.box(0.024, s[2], 0.024, '#2f8f47', s[0], s[2] / 2, s[1]));
      const petal = R3.ellipsoid(0.085, 0.035, 0.085, c, s[0], s[2] + 0.015, s[1], { seg: 6 });
      petal.castShadow = false;
      g.add(petal);
      const heart = R3.box(0.04, 0.022, 0.04, '#f1c40f', s[0], s[2] + 0.032, s[1]);
      heart.castShadow = false;
      g.add(heart);
    }
    g.add(blade(0.12, 0.24, '#3fa055', 0.02, 0, -0.02, 0.6, 0.1));
    g.add(blade(0.12, 0.20, '#4cb85c', -0.06, 0, 0.10, 2.2, -0.12));
    return { geo: bake(g), mat: matBlade(), cast: false };
  }

  function protoRock() {
    const g = R3.group();
    g.add(R3.rot(R3.ellipsoid(0.34, 0.26, 0.30, '#7f8c8d', 0, 0.20, 0, { seg: 6 }), 0.15, 0.5, 0.1));
    g.add(R3.rot(R3.ellipsoid(0.20, 0.16, 0.18, '#94a0a2', 0.16, 0.30, -0.10, { seg: 6 }), -0.2, 1.1, 0.25));
    g.add(R3.rot(R3.ellipsoid(0.16, 0.11, 0.15, '#66727d', -0.20, 0.10, 0.16, { seg: 6 }), 0.1, -0.7, -0.15));
    return { geo: bake(g), mat: matRock(), cast: true };
  }

  function protoMountain(snowy) {
    const g = R3.group();
    g.add(R3.rot(R3.box(1.42, 0.86, 1.36, '#646c78', 0, 0.34, 0), 0.04, 0.42, -0.06));
    g.add(R3.rot(R3.box(1.14, 1.05, 1.06, '#6a727e', -0.06, 0.78, 0.05), 0.05, 1.02, 0.07));
    g.add(R3.rot(R3.box(0.86, 1.02, 0.80, '#767e8a', 0.14, 1.24, -0.08), -0.04, 0.24, 0.06));
    g.add(R3.rot(R3.box(0.54, 0.78, 0.50, '#828a94', 0.02, 1.72, 0.04), 0.07, 0.78, -0.05));
    g.add(R3.rot(R3.ellipsoid(0.46, 0.30, 0.44, '#5c6470', -0.52, 0.24, 0.40, { seg: 6 }), 0.10, 0.8, 0.14));
    g.add(R3.rot(R3.ellipsoid(0.38, 0.26, 0.36, '#5c6470', 0.56, 0.20, -0.44, { seg: 6 }), -0.08, 0.3, -0.12));
    if (snowy) {
      g.add(R3.rot(R3.box(0.60, 0.30, 0.56, '#eef6fb', 0.02, 2.02, 0.04), 0.07, 0.78, -0.05));
      g.add(R3.rot(R3.box(0.78, 0.22, 0.72, '#dfeef7', 0.14, 1.66, -0.08), -0.04, 0.24, 0.06));
      g.add(R3.ellipsoid(0.34, 0.14, 0.32, '#e6f1f7', -0.16, 1.32, 0.18, { seg: 6 }));
    }
    return { geo: bake(g), mat: matRock(), cast: true };
  }

  function protoSnowTuft() {
    const g = R3.group();
    g.add(R3.ellipsoid(0.30, 0.13, 0.28, '#f2fafd', -0.08, 0.07, 0.06, { seg: 7 }));
    g.add(R3.ellipsoid(0.18, 0.10, 0.17, '#ffffff', 0.20, 0.06, -0.14, { seg: 6 }));
    g.add(R3.rot(R3.ellipsoid(0.10, 0.08, 0.09, '#8a9199', 0.06, 0.06, 0.22, { seg: 5 }), 0.2, 0.6, 0.3));
    return { geo: bake(g), mat: matSolid(), cast: false };
  }

  function protoShell() {
    const g = R3.group();
    g.add(R3.rot(R3.ellipsoid(0.11, 0.05, 0.09, '#ffaad8', 0, 0.05, 0, { seg: 7 }), 0.15, 0.4, 0));
    g.add(R3.rot(R3.ellipsoid(0.07, 0.035, 0.055, '#ffd2e6', 0.01, 0.09, 0.01, { seg: 6 }), 0.15, 0.4, 0));
    g.add(R3.rot(R3.ellipsoid(0.06, 0.025, 0.05, '#f4e7c8', 0.19, 0.03, -0.14, { seg: 5 }), 0, 1.1, 0.2));
    return { geo: bake(g), mat: matSolid(), cast: false };
  }

  function protoMowLine() {
    const g = R3.group();
    const m = new THREE.Mesh(R3.geo.plane(0.99, 0.99), R3.mat('#8ad86a', { rough: 1 }));
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false; m.receiveShadow = false;
    g.add(m);
    return { geo: bake(g), mat: matSolid(), cast: false };
  }

  function protoBench() {
    const g = R3.group();
    const wood = '#8b5a2b', dark = '#5c2e0d';
    g.add(R3.box(0.07, 0.30, 0.07, dark, -0.26, 0.15, 0.09));
    g.add(R3.box(0.07, 0.30, 0.07, dark, 0.26, 0.15, 0.09));
    g.add(R3.box(0.07, 0.52, 0.07, dark, -0.26, 0.26, -0.11));
    g.add(R3.box(0.07, 0.52, 0.07, dark, 0.26, 0.26, -0.11));
    g.add(R3.box(0.68, 0.05, 0.10, wood, 0, 0.32, 0.12));
    g.add(R3.box(0.68, 0.05, 0.10, wood, 0, 0.32, 0.00));
    g.add(R3.box(0.68, 0.05, 0.10, wood, 0, 0.32, -0.12));
    const b1 = R3.box(0.68, 0.09, 0.05, wood, 0, 0.46, -0.14);
    b1.rotation.x = 0.16;
    const b2 = R3.box(0.68, 0.09, 0.05, wood, 0, 0.58, -0.16);
    b2.rotation.x = 0.16;
    g.add(b1, b2);
    return { geo: bake(g), mat: matSolid(), cast: true };
  }

  function protoReeds() {
    const g = R3.group();
    const spots = [[-0.26, -0.20, 0.62], [-0.16, -0.28, 0.48], [0.24, -0.14, 0.58], [0.30, 0.06, 0.44], [-0.30, 0.14, 0.50]];
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      g.add(blade(0.09, s[2], i % 2 ? '#2f9c58' : '#27ae60', s[0], 0, s[1], i * 1.1, (i % 2 ? 0.12 : -0.1)));
      if (i % 2 === 0) {
        const q = R3.ellipsoid(0.032, 0.075, 0.032, '#8b5a2b', s[0], s[2] + 0.05, s[1], { seg: 5 });
        q.castShadow = false;
        g.add(q);
      }
    }
    const pad = R3.ellipsoid(0.20, 0.014, 0.18, '#1e8449', 0.10, 0.03, 0.26, { seg: 8 });
    pad.castShadow = false;
    g.add(pad);
    const fl = R3.ellipsoid(0.055, 0.035, 0.055, '#ffaad8', 0.14, 0.06, 0.30, { seg: 6 });
    fl.castShadow = false;
    g.add(fl);
    return { geo: bake(g), mat: matBlade(), cast: false };
  }

  function protoFountain(big) {
    const g = R3.group();
    const k = big ? 1.32 : 1.0;
    const stone = '#b3bec6', stoneD = '#8f9ba4', stoneL = '#d3dbe0';
    g.add(R3.cyl(0.46 * k, 0.50 * k, 0.10, stoneD, 0, 0.05, 0, { seg: 16 }));
    g.add(R3.cyl(0.43 * k, 0.44 * k, 0.16, stone, 0, 0.16, 0, { seg: 16 }));
    g.add(R3.rot(R3.torus(0.40 * k, 0.055, stoneL, 0, 0.26, 0, { seg: 16 }), -Math.PI / 2, 0, 0));
    g.add(R3.cyl(0.08 * k, 0.12 * k, 0.42 * k, stone, 0, 0.21 + 0.21 * k, 0, { seg: 10 }));
    g.add(R3.cyl(0.19 * k, 0.06 * k, 0.07, stoneL, 0, 0.44 + 0.42 * k, 0, { seg: 14 }));
    if (big) {
      g.add(R3.cyl(0.06, 0.09, 0.34, stone, 0, 1.08, 0, { seg: 10 }));
      g.add(R3.cyl(0.13, 0.05, 0.06, stoneL, 0, 1.26, 0, { seg: 12 }));
    }
    return { geo: bake(g), mat: matSolid(), cast: true };
  }

  function addRoof(g, wallTop, halfW, halfD, rise, roof, roofDark, wallColor) {
    g.add(prism(halfW * 2, rise, halfD * 2, wallColor, 0, wallTop, 0));
    const slopeLen = Math.sqrt(halfD * halfD + rise * rise);
    const over = 0.17, th = 0.055;
    const ang = Math.atan2(rise, halfD);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let s = -1; s <= 1; s += 2) {
      const slab = R3.box(halfW * 2 + 0.20, th, slopeLen + over, roof,
        0, wallTop + rise / 2 + ca * th * 0.5 - sa * over * 0.5,
        s * (halfD / 2 + ca * over * 0.5 + sa * th * 0.5));
      slab.rotation.x = s * ang;
      g.add(slab);
    }
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
    g.add(R3.box(0.94, 0.08, 0.94, '#9aa3ab', 0, 0.04, 0));
    g.add(R3.box(hw * 2, wallH, hd * 2, '#efe0bd', 0, 0.08 + wallH / 2, 0));
    g.add(R3.box(hw * 2 + 0.02, 0.12, hd * 2 + 0.02, '#d9c49a', 0, 0.14, 0));
    addRoof(g, 0.08 + wallH, hw, hd, 0.46, roofColor, roofDark, '#efe0bd');
    g.add(R3.box(0.28, 0.50, 0.05, '#6b3d17', 0, 0.33, hd + 0.01));
    const knob = R3.sphere(0.028, '#f1c40f', 0.09, 0.36, hd + 0.04, { seg: 6 });
    knob.castShadow = false;
    g.add(knob);
    g.add(R3.box(0.34, 0.05, 0.12, '#c8cdd2', 0, 0.10, hd + 0.07));
    addWindow(g, -0.25, 0.72, hd + 0.02, 0.20, 0.20);
    addWindow(g, 0.25, 0.72, hd + 0.02, 0.20, 0.20);
    const sw1 = R3.box(0.035, 0.20, 0.20, '#8fe4f0', -hw - 0.01, 0.66, 0.02);
    const sw2 = R3.box(0.035, 0.20, 0.20, '#8fe4f0', hw + 0.01, 0.66, 0.02);
    sw1.castShadow = false; sw2.castShadow = false;
    g.add(sw1, sw2);
    g.add(R3.box(0.15, 0.50, 0.15, '#a8564a', 0.26, 1.42, -0.20));
    g.add(R3.box(0.19, 0.05, 0.19, '#5a4038', 0.26, 1.69, -0.20));
    return { geo: bake(g), mat: matSolid(), cast: true };
  }

  function protoHouse2(roofColor) {
    const g = R3.group();
    const roofDark = new THREE.Color(roofColor).multiplyScalar(0.72).getStyle();
    const hw = 0.44, hd = 0.44, wallH = 1.62;
    g.add(R3.box(0.96, 0.08, 0.96, '#9aa3ab', 0, 0.04, 0));
    g.add(R3.box(hw * 2, wallH, hd * 2, '#f4f0e2', 0, 0.08 + wallH / 2, 0));
    g.add(R3.box(hw * 2 + 0.02, 0.16, hd * 2 + 0.02, '#c8ccd0', 0, 0.16, 0));
    g.add(R3.box(hw * 2 + 0.05, 0.06, hd * 2 + 0.05, '#d8d2c2', 0, 0.94, 0));
    addRoof(g, 0.08 + wallH, hw, hd, 0.40, roofColor, roofDark, '#f4f0e2');
    g.add(R3.box(0.30, 0.58, 0.05, '#6b3d17', 0, 0.37, hd + 0.01));
    const knob2 = R3.sphere(0.028, '#f1c40f', 0.10, 0.40, hd + 0.04, { seg: 6 });
    knob2.castShadow = false;
    g.add(knob2);
    g.add(R3.box(0.44, 0.05, 0.16, '#a8564a', 0, 0.70, hd + 0.06));
    g.add(R3.box(0.38, 0.05, 0.14, '#c8cdd2', 0, 0.10, hd + 0.08));
    addWindow(g, -0.26, 0.46, hd + 0.02, 0.19, 0.19);
    addWindow(g, 0.26, 0.46, hd + 0.02, 0.19, 0.19);
    addWindow(g, -0.27, 1.26, hd + 0.02, 0.19, 0.22);
    addWindow(g, 0.00, 1.26, hd + 0.02, 0.19, 0.22);
    addWindow(g, 0.27, 1.26, hd + 0.02, 0.19, 0.22);
    const wl = R3.box(0.035, 0.20, 0.20, '#8fe4f0', -hw - 0.01, 1.26, 0.02);
    wl.castShadow = false;
    const wr = R3.box(0.035, 0.20, 0.20, '#8fe4f0', hw + 0.01, 1.26, 0.02);
    wr.castShadow = false;
    g.add(wl, wr);
    g.add(R3.box(0.16, 0.52, 0.16, '#a8564a', 0.27, 2.02, -0.22));
    g.add(R3.box(0.20, 0.05, 0.20, '#5a4038', 0.27, 2.30, -0.22));
    return { geo: bake(g), mat: matSolid(), cast: true };
  }

  function protoVlgHouse() {
    const g = R3.group();
    const hw = 0.40, hd = 0.40, wallH = 0.86;
    g.add(R3.box(0.90, 0.07, 0.90, '#8fae6a', 0, 0.035, 0));
    g.add(R3.box(hw * 2, wallH, hd * 2, '#f6f4ee', 0, 0.07 + wallH / 2, 0));
    g.add(R3.box(hw * 2 + 0.02, 0.13, hd * 2 + 0.02, '#cdd4d8', 0, 0.135, 0));
    g.add(R3.box(hw * 2 + 0.03, 0.05, 0.05, '#8b5a2b', 0, 0.07 + wallH, hd));
    g.add(R3.box(0.05, wallH, 0.05, '#8b5a2b', -hw, 0.07 + wallH / 2, hd));
    g.add(R3.box(0.05, wallH, 0.05, '#8b5a2b', hw, 0.07 + wallH / 2, hd));
    const top = 0.07 + wallH;
    const th1 = R3.ellipsoid(0.62, 0.46, 0.62, '#b8834a', 0, top + 0.06, 0, { seg: 10 });
    const th2 = R3.ellipsoid(0.46, 0.30, 0.46, '#c9955a', 0, top + 0.26, 0, { seg: 9 });
    const th3 = R3.ellipsoid(0.26, 0.16, 0.26, '#a5713d', 0, top + 0.42, 0, { seg: 8 });
    g.add(th1, th2, th3);
    g.add(R3.rot(R3.cyl(0.05, 0.05, 0.86, '#8b5a2b', 0, top + 0.44, 0, { seg: 6 }), 0, 0, Math.PI / 2));
    g.add(R3.box(0.26, 0.44, 0.05, '#8b5a2b', 0, 0.29, hd + 0.01));
    const kn = R3.sphere(0.026, '#f1c40f', 0.08, 0.32, hd + 0.04, { seg: 5 });
    kn.castShadow = false;
    g.add(kn);
    addWindow(g, -0.24, 0.62, hd + 0.02, 0.17, 0.17);
    g.add(R3.box(0.14, 0.42, 0.14, '#9aa0a4', -0.24, top + 0.34, -0.18));
    g.add(R3.box(0.18, 0.05, 0.18, '#6b7075', -0.24, top + 0.57, -0.18));
    g.add(R3.box(0.22, 0.06, 0.08, '#8b5a2b', -0.24, 0.50, hd + 0.06));
    const fl = R3.ellipsoid(0.09, 0.05, 0.05, '#ff6b9d', -0.24, 0.56, hd + 0.06, { seg: 6 });
    fl.castShadow = false;
    g.add(fl);
    return { geo: bake(g), mat: matSolid(), cast: true };
  }

  // === B. NOUVEAUX DÉCORS DU CONTRAT §15 (jungle/marécage/volcan/désert/
  //        glacier/plateau céleste/côte) — même esprit que la v1 : silhouette +
  //        volumes décalés, contraste par vertex colors (pas de nouveau
  //        matériau), variés par R3.hash au moment du placement. ================

  function protoJungleTree() {
    const g = R3.group();
    g.add(R3.cyl(0.13, 0.19, 1.05, '#5c3a1e', 0, 0.52, 0, { seg: 7 }));
    // Racines-contreforts : trois ailerons à la base du tronc.
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      g.add(R3.rot(R3.box(0.08, 0.30, 0.22, '#4a2f18', Math.cos(a) * 0.16, 0.15, Math.sin(a) * 0.16), 0, -a, 0.15));
    }
    const f1 = R3.ellipsoid(0.66, 0.34, 0.62, '#1d5e2a', 0, 1.30, 0, { seg: 9 });
    g.add(f1);
    g.add(R3.ellipsoid(0.48, 0.26, 0.46, '#236f2e', -0.20, 1.52, 0.16, { seg: 8 }));
    g.add(R3.ellipsoid(0.40, 0.22, 0.40, '#2a7a34', 0.26, 1.44, -0.18, { seg: 8 }));
    g.add(R3.ellipsoid(0.24, 0.16, 0.24, '#3f9c46', 0.02, 1.66, 0.05, { seg: 7 }));
    return { geo: bake(g), mat: matFoliage(), cast: true };
  }

  function protoVineTree() {
    const g = R3.group();
    g.add(R3.cyl(0.10, 0.15, 0.98, '#5a3a20', 0, 0.49, 0, { seg: 7 }));
    g.add(R3.ellipsoid(0.46, 0.32, 0.44, '#2b7b3a', 0, 1.18, 0, { seg: 8 }));
    g.add(R3.ellipsoid(0.30, 0.22, 0.30, '#357f38', 0.16, 1.36, -0.10, { seg: 7 }));
    // Lianes qui pendent — cylindres effilés, plus larges en haut qu'en bas.
    const vinePos = [[-0.30, 0.20], [0.28, -0.12], [0.06, 0.34], [-0.10, -0.30]];
    for (let i = 0; i < vinePos.length; i++) {
      const p = vinePos[i];
      const len = 0.55 + (i % 2) * 0.22;
      g.add(R3.cyl(0.012, 0.022, len, '#3d6b2f', p[0], 1.02 - len / 2, p[1], { seg: 4 }));
    }
    return { geo: bake(g), mat: matFoliage(), cast: true };
  }

  function protoFern() {
    const g = R3.group();
    const cols = ['#357f38', '#3f9c46', '#2f8b3c'];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(blade(0.16, 0.44 + (i % 2) * 0.10, cols[i % cols.length],
        Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05, a, 0.35));
    }
    const bud = R3.ellipsoid(0.05, 0.06, 0.05, '#4fbf5a', 0, 0.05, 0, { seg: 6 });
    bud.castShadow = false;
    g.add(bud);
    return { geo: bake(g), mat: matBlade(), cast: false };
  }

  function protoMangrove() {
    const g = R3.group();
    // Racines-échasses qui plongent vers l'eau.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const m = R3.cyl(0.03, 0.05, 0.42, '#3d5a3a', Math.cos(a) * 0.16, 0.10, Math.sin(a) * 0.16, { seg: 5 });
      m.rotation.z = Math.cos(a) * 0.35;
      m.rotation.x = Math.sin(a) * 0.35;
      g.add(m);
    }
    g.add(R3.cyl(0.09, 0.12, 0.44, '#4a6b45', 0, 0.44, 0, { seg: 7 }));
    g.add(R3.ellipsoid(0.36, 0.24, 0.34, '#4c7a44', 0, 0.78, 0, { seg: 8 }));
    g.add(R3.ellipsoid(0.24, 0.16, 0.24, '#5a8a4f', 0.14, 0.92, -0.10, { seg: 7 }));
    return { geo: bake(g), mat: matFoliage(), cast: true };
  }

  function protoPalm() {
    const g = R3.group();
    // Tronc courbe : segments empilés avec un léger décalage.
    let ox = 0, oy = 0;
    for (let i = 0; i < 5; i++) {
      const seg = 0.24;
      ox += Math.sin(i * 0.5) * 0.03;
      const m = R3.cyl(0.075 - i * 0.006, 0.085 - i * 0.006, seg, '#8b6a3f', ox, oy + seg / 2, 0, { seg: 6 });
      m.rotation.z = -Math.sin(i * 0.5) * 0.10;
      g.add(m);
      oy += seg;
    }
    // Couronne de palmes en étoile.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const fr = blade(0.14, 0.62, i % 2 ? '#3fa055' : '#38b764', ox, oy, 0, a, 1.15);
      g.add(fr);
    }
    g.add(R3.sphere(0.06, '#6b4423', ox + 0.06, oy - 0.04, 0.05, { seg: 6 }));
    g.add(R3.sphere(0.055, '#5a3a1c', ox - 0.05, oy - 0.06, -0.04, { seg: 6 }));
    return { geo: bake(g), mat: matFoliage(), cast: true };
  }

  function protoCactus() {
    const g = R3.group();
    g.add(R3.cyl(0.11, 0.13, 0.62, '#3f8f4a', 0, 0.31, 0, { seg: 8 }));
    g.add(R3.sphere(0.11, '#3f8f4a', 0, 0.62, 0, { seg: 8 }));
    const armA = R3.cyl(0.06, 0.07, 0.30, '#357f3f', -0.14, 0.42, 0, { seg: 6 });
    armA.rotation.z = 0.9;
    const armB = R3.cyl(0.055, 0.065, 0.26, '#357f3f', 0.13, 0.50, 0.02, { seg: 6 });
    armB.rotation.z = -0.85;
    g.add(armA, armB);
    const fl = R3.ellipsoid(0.045, 0.05, 0.045, '#ffe066', 0, 0.70, 0, { seg: 6 });
    fl.castShadow = false;
    g.add(fl);
    return { geo: bake(g), mat: matSolid(), cast: true };
  }

  function protoPineSnow() {
    const g = R3.group();
    g.add(R3.cyl(0.05, 0.08, 0.18, '#5a4632', 0, 0.09, 0, { seg: 6 }));
    g.add(R3.cone(0.36, 0.52, '#1f5e35', 0, 0.44, 0, { seg: 8 }));
    g.add(R3.cone(0.27, 0.42, '#256b3d', 0, 0.72, 0, { seg: 8 }));
    g.add(R3.cone(0.18, 0.32, '#2c7a46', 0, 0.96, 0, { seg: 8 }));
    // Neige posée sur les couches basses.
    g.add(R3.cone(0.37, 0.14, '#eef6fb', 0, 0.68, 0, { seg: 8 }));
    g.add(R3.cone(0.28, 0.11, '#eef6fb', 0, 0.92, 0, { seg: 8 }));
    g.add(R3.cone(0.10, 0.16, '#ffffff', 0, 1.14, 0, { seg: 6 }));
    return { geo: bake(g), mat: matFoliage(), cast: true };
  }

  function protoIceSpike() {
    const g = R3.group();
    const cols = ['#a8dcef', '#c9ecf7', '#8ecbe0'];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const h = 0.34 + (i % 2) * 0.20;
      const m = R3.cone(0.07 - i * 0.006, h, cols[i % cols.length], Math.cos(a) * 0.10, h / 2, Math.sin(a) * 0.10, { seg: 5 });
      m.rotation.x = Math.sin(a) * 0.14;
      m.rotation.z = Math.cos(a) * 0.14;
      g.add(m);
    }
    g.add(R3.cone(0.10, 0.50, '#f4fbff', 0, 0.25, 0, { seg: 6 }));
    return { geo: bake(g), mat: matRock(), cast: true };
  }

  function protoCrystalSpire() {
    const g = R3.group();
    const cols = ['#d896ff', '#b9a8e0', '#a8e6ff'];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const h = 0.42 + (i % 2) * 0.18;
      const top = R3.cone(0.075, h * 0.62, cols[i], Math.cos(a) * 0.09, h * 0.62 / 2 + h * 0.30, Math.sin(a) * 0.09, { seg: 5 });
      const bot = R3.cone(0.075, h * 0.38, cols[i], Math.cos(a) * 0.09, h * 0.30 / 2, Math.sin(a) * 0.09, { seg: 5 });
      bot.rotation.x = Math.PI;
      top.rotation.z = Math.sin(a) * 0.10;
      g.add(top, bot);
    }
    g.add(R3.cone(0.10, 0.70, '#e6d6ff', 0, 0.35, 0, { seg: 6 }));
    return { geo: bake(g), mat: matRock(), cast: true };
  }

  function protoRuinPillar() {
    const g = R3.group();
    g.add(R3.cyl(0.20, 0.22, 0.10, '#a09aab', 0, 0.05, 0, { seg: 10 }));
    g.add(R3.cyl(0.15, 0.16, 0.62, '#b9b3c6', 0, 0.41, 0, { seg: 10 }));
    g.add(R3.cyl(0.13, 0.15, 0.30, '#aca5b8', 0, 0.87, 0, { seg: 10 }));
    // Le fût cassé, penché.
    const broken = R3.cyl(0.11, 0.13, 0.24, '#9d96ab', 0.10, 1.10, 0.02, { seg: 10 });
    broken.rotation.z = 0.55;
    g.add(broken);
    g.add(R3.box(0.20, 0.09, 0.20, '#8a839a', -0.12, 0.045, 0.22));
    g.add(R3.box(0.16, 0.07, 0.14, '#8a839a', 0.18, 0.035, -0.14));
    return { geo: bake(g), mat: matRock(), cast: true };
  }

  function protoLavaRock() {
    const g = R3.group();
    g.add(R3.rot(R3.ellipsoid(0.30, 0.24, 0.28, '#1a1c2c', 0, 0.20, 0, { seg: 6 }), 0.2, 0.4, 0.1));
    g.add(R3.rot(R3.ellipsoid(0.18, 0.16, 0.17, '#232538', 0.16, 0.32, -0.12, { seg: 6 }), -0.1, 1.0, 0.2));
    g.add(R3.rot(R3.ellipsoid(0.14, 0.11, 0.13, '#141522', -0.18, 0.10, 0.16, { seg: 6 }), 0.15, -0.6, -0.1));
    // Fissures incandescentes : fines bandes claires, contraste par vertex color.
    const c1 = R3.box(0.20, 0.02, 0.03, '#ff8c42', -0.02, 0.30, 0.16);
    c1.rotation.y = 0.4; c1.castShadow = false;
    const c2 = R3.box(0.14, 0.02, 0.03, '#ffd166', 0.12, 0.18, -0.08);
    c2.rotation.y = -0.3; c2.castShadow = false;
    g.add(c1, c2);
    return { geo: bake(g), mat: matRock(), cast: true };
  }

  function protoGeyser() {
    const g = R3.group();
    // Anneau de roche autour du vent.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(R3.box(0.14, 0.14 + (i % 2) * 0.06, 0.12, i % 2 ? '#6b5a4a' : '#7a695a',
        Math.cos(a) * 0.24, 0.08, Math.sin(a) * 0.24));
    }
    g.add(R3.cyl(0.10, 0.16, 0.16, '#4a3f34', 0, 0.16, 0, { seg: 10 }));
    // Panache figé : ellipsoïdes pâles empilés, de plus en plus fins.
    g.add(R3.ellipsoid(0.10, 0.16, 0.10, '#e8f4f8', 0, 0.40, 0, { seg: 7 }));
    g.add(R3.ellipsoid(0.07, 0.14, 0.07, '#f4fafd', 0.02, 0.62, -0.01, { seg: 6 }));
    g.add(R3.ellipsoid(0.045, 0.10, 0.045, '#ffffff', -0.01, 0.80, 0.02, { seg: 5 }));
    return { geo: bake(g), mat: matSolid(), cast: false };
  }

  function protoDryBone() {
    const g = R3.group();
    // Crâne stylisé + côtes courbes, posés à plat.
    g.add(R3.ellipsoid(0.13, 0.09, 0.15, '#e8dcc0', -0.18, 0.06, 0, { seg: 7 }));
    g.add(R3.box(0.06, 0.04, 0.10, '#d8cba8', -0.30, 0.04, 0, { seg: 5 }));
    for (let i = 0; i < 3; i++) {
      const r = R3.torus(0.14 - i * 0.02, 0.018, '#e0d4b4', 0.05 + i * 0.09, 0.03, 0, { seg: 8 });
      r.rotation.x = Math.PI / 2;
      r.rotation.z = 0.5;
      g.add(r);
    }
    return { geo: bake(g), mat: matSolid(), cast: false };
  }

  function protoLilyPad() {
    const g = R3.group();
    const pad = R3.ellipsoid(0.24, 0.016, 0.22, '#1e8449', 0, 0.02, 0, { seg: 9 });
    pad.castShadow = false;
    g.add(pad);
    const pad2 = R3.ellipsoid(0.14, 0.014, 0.13, '#27ae60', 0.22, 0.018, 0.14, { seg: 8 });
    pad2.castShadow = false;
    g.add(pad2);
    const fl = R3.ellipsoid(0.06, 0.04, 0.06, '#ffaad8', -0.02, 0.05, 0.04, { seg: 6 });
    fl.castShadow = false;
    g.add(fl);
    return { geo: bake(g), mat: matBlade(), cast: false };
  }

  function protoDune() {
    const g = R3.group();
    g.add(R3.ellipsoid(0.62, 0.20, 0.50, '#cfa85e', 0, 0.10, 0, { seg: 9 }));
    g.add(R3.ellipsoid(0.40, 0.13, 0.34, '#d8b46a', 0.20, 0.14, -0.10, { seg: 8 }));
    g.add(R3.ellipsoid(0.26, 0.09, 0.24, '#c39a52', -0.24, 0.09, 0.14, { seg: 7 }));
    return { geo: bake(g), mat: matRock(), cast: false };
  }

  function protoCliff() {
    const g = R3.group();
    g.add(R3.rot(R3.box(0.90, 1.30, 0.80, '#a67f57', 0, 0.65, 0), 0.03, 0.3, -0.02));
    g.add(R3.rot(R3.box(0.62, 1.60, 0.58, '#96714c', -0.14, 0.80, 0.10), -0.02, 0.9, 0.03));
    g.add(R3.rot(R3.box(0.50, 0.90, 0.46, '#b89467', 0.20, 1.55, -0.08), 0.04, -0.4, -0.03));
    g.add(R3.rot(R3.ellipsoid(0.30, 0.16, 0.28, '#8a6a48', -0.06, 0.16, 0.24, { seg: 6 }), 0.1, 0.6, 0.1));
    return { geo: bake(g), mat: matRock(), cast: true };
  }

  function protoReef() {
    const g = R3.group();
    const cols = ['#ff8fb0', '#ffaa6a', '#c9a0f0', '#66d8c9'];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const h = 0.10 + (i % 3) * 0.06;
      g.add(R3.cone(0.05, h, cols[i % cols.length], Math.cos(a) * 0.14, h / 2, Math.sin(a) * 0.14, { seg: 5 }));
    }
    g.add(R3.ellipsoid(0.16, 0.09, 0.16, '#4a8f9a', 0, 0.06, 0, { seg: 7 }));
    return { geo: bake(g), mat: matRock(), cast: false };
  }

  function protoMossRuin() {
    const g = R3.group();
    g.add(R3.rot(R3.box(0.42, 0.24, 0.34, '#7a7568', -0.06, 0.12, 0.04), 0, 0.3, 0.05));
    g.add(R3.rot(R3.box(0.30, 0.20, 0.26, '#6e6a5e', 0.18, 0.20, -0.10), 0, -0.4, -0.06));
    g.add(R3.rot(R3.box(0.20, 0.14, 0.18, '#82806f', -0.20, 0.34, -0.14), 0.1, 0.6, 0.03));
    // Mousse : patches verts plaqués sur le dessus des blocs.
    const m1 = R3.ellipsoid(0.18, 0.03, 0.14, '#4b6b46', -0.04, 0.25, 0.05, { seg: 7 });
    m1.castShadow = false;
    const m2 = R3.ellipsoid(0.12, 0.025, 0.10, '#5a7c4f', 0.16, 0.31, -0.08, { seg: 6 });
    m2.castShadow = false;
    g.add(m1, m2);
    return { geo: bake(g), mat: matRock(), cast: true };
  }

  // ---------------------------------------------------------------------------
  //  REGISTRE DES PROTOTYPES — construits à la demande, une seule fois, PUIS
  //  PARTAGÉS entre tous les chunks (voir bake() : userData.shared = true).
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
        // --- nouveaux décors (contrat §15) ---
        case 'jungletree': p = protoJungleTree(); break;
        case 'vinetree': p = protoVineTree(); break;
        case 'fern': p = protoFern(); break;
        case 'mangrove': p = protoMangrove(); break;
        case 'palm': p = protoPalm(); break;
        case 'cactus': p = protoCactus(); break;
        case 'pinesnow': p = protoPineSnow(); break;
        case 'icespike': p = protoIceSpike(); break;
        case 'crystalspire': p = protoCrystalSpire(); break;
        case 'ruinpillar': p = protoRuinPillar(); break;
        case 'lavarock': p = protoLavaRock(); break;
        case 'geyser': p = protoGeyser(); break;
        case 'drybone': p = protoDryBone(); break;
        case 'lilypad': p = protoLilyPad(); break;
        case 'dune': p = protoDune(); break;
        case 'cliff': p = protoCliff(); break;
        case 'reef': p = protoReef(); break;
        case 'mossruin': p = protoMossRuin(); break;
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
  //  ORIENTATION DES BÂTIMENTS ET DES BANCS (v1, inchangé — fonctionne pour
  //  toutes les régions puisqu'il ne regarde que les tuiles voisines).
  // ---------------------------------------------------------------------------
  const STREET = {
    CITY_PATH: 1, CITY_GROUND: 1, CITY2_PATH: 1, CITY2_GROUND: 1,
    VLG_PATH: 1, PATH: 1, PARK_PATH: 1, MTN_PATH: 1,
    PAVED_ROAD: 1, PLAZA: 1, PLAZA_GRAND: 1,
  };
  const DIRS = [
    { dx: 0, dz: 1, ry: 0 }, { dx: 1, dz: 0, ry: Math.PI / 2 },
    { dx: -1, dz: 0, ry: -Math.PI / 2 }, { dx: 0, dz: -1, ry: Math.PI },
  ];
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
  //  PLACEMENT DES DÉCORS INSTANCIÉS
  // ---------------------------------------------------------------------------
  const _mat4 = new THREE.Matrix4();
  const _quat = new THREE.Quaternion();
  const _eul = new THREE.Euler();
  const _pos = new THREE.Vector3();
  const _scl = new THREE.Vector3();

  function pushInst(bucket, key, px, py, pz, rx, ry, rz, sx, sy, sz, cr, cg, cb) {
    let b = bucket[key];
    if (!b) b = bucket[key] = { m: [], c: [] };
    _eul.set(rx, ry, rz, 'YXZ');
    _quat.setFromEuler(_eul);
    _pos.set(px, py, pz);
    _scl.set(sx, sy, sz);
    _mat4.compose(_pos, _quat, _scl);
    _mat4.toArray(b.m, b.m.length);
    b.c.push(cr, cg, cb);
  }

  const GRASS_TINT = {
    TALL_GRASS: [0.97, 1.00, 0.90], TALL_PLAIN: [1.10, 1.04, 0.82],
    PARK_TALL: [1.00, 1.06, 0.92], VLG_TALL: [1.04, 1.02, 0.86],
    MTN_GRASS: [0.82, 0.90, 0.86],
    JUNGLE_TALL: [0.86, 1.03, 0.80], EMBER_GRASS: [1.06, 0.90, 0.70],
    PLATEAU_TALL: [0.94, 1.00, 1.06],
  };

  /** placeDecos(bucket,x,y,type,st) — type/style déjà résolus par l'appelant
   *  (évite de relire deux fois tileAt/tileStyle par tuile de chunk). */
  function placeDecos(bucket, x, y, type, st) {
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
        // Repli région-agnostique : l'altitude (heightAt réelle) suffit à
        // décider taille/enneigement, sans hypothèse sur la forme de la carte
        // (contrairement à la v1, réglée sur le massif fixe de l'ancien monde).
        const t = clamp01((h - 0.9) / 1.3);
        const hauteur = 0.55 + t * 2.2 + r3 * 0.45 + relief(x + 11, y - 7, 5) * 0.5;
        const snowy = t > 0.55 || type === 'SNOW' || type === 'GLACIER';
        const large = 1.0 + t * 0.5 + r2 * 0.26;
        pushInst(bucket, snowy ? 'mountain.snow' : 'mountain.rock',
          x + (r1 - 0.5) * 0.30, h - 0.30, y + (r2 - 0.5) * 0.30,
          (r3 - 0.5) * 0.10, r1 * Math.PI * 2, (r4 - 0.5) * 0.10,
          large, hauteur, large * (0.92 + r4 * 0.16),
          0.86 + r3 * 0.28, 0.88 + r3 * 0.24, 0.90 + r3 * 0.22);
        break;
      }
      case 'snowtuft': {
        if (r1 > 0.62) break;
        pushInst(bucket, 'snowtuft',
          x + (r2 - 0.5) * 0.4, h, y + (r3 - 0.5) * 0.4,
          0, r1 * Math.PI * 2, 0,
          0.8 + r4 * 0.7, 0.7 + r2 * 0.9, 0.8 + r3 * 0.7, 1, 1, 1);
        break;
      }
      case 'shell': {
        if (R3.hash(x, y) >= 0.07) break;
        pushInst(bucket, 'shell',
          x + (r2 - 0.5) * 0.4, h, y + (r3 - 0.5) * 0.4,
          0, r1 * Math.PI * 2, 0,
          0.85 + r4 * 0.5, 0.85 + r4 * 0.5, 0.85 + r4 * 0.5,
          0.95 + r1 * 0.15, 0.95 + r2 * 0.12, 0.98 + r3 * 0.08);
        break;
      }
      case 'mowline': {
        if ((y & 3) >= 2) break;
        pushInst(bucket, 'mowline', x, h + 0.02, y, 0, 0, 0, 1, 1, 1,
          0.98 + r1 * 0.06, 1.0, 0.96 + r2 * 0.06);
        break;
      }
      case 'bench': {
        pushInst(bucket, 'bench', x, h, y, 0, faceRot(x, y, isParkPath, 0), 0, 1, 1, 1, 1, 1, 1);
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
        pushInst(bucket, big ? 'fountain.big' : 'fountain.small', x, h, y, 0, 0, 0, 1, 1, 1, 1, 1, 1);
        fountains.push({ x: x, y: y, h: h, big: big });
        break;
      }
      case 'house': case 'house2': {
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

      // --- nouveaux décors : placement simple, variation par R3.hash --------
      case 'jungletree': case 'vinetree': case 'mangrove': case 'palm':
      case 'pinesnow': case 'cliff': {
        const ox = (r1 - 0.5) * 0.34, oz = (r2 - 0.5) * 0.34;
        const s = 0.85 + r3 * 0.42;
        pushInst(bucket, deco, x + ox, heightAt(x + ox, y + oz) - 0.04, y + oz,
          (r4 - 0.5) * 0.06, r1 * Math.PI * 2, (r3 - 0.5) * 0.06,
          s * (0.95 + r4 * 0.12), s * (0.96 + r2 * 0.20), s * (0.95 + r1 * 0.12),
          0.90 + r2 * 0.16, 0.92 + r3 * 0.14, 0.90 + r1 * 0.16);
        break;
      }
      case 'fern': case 'lilypad': {
        pushInst(bucket, deco, x + (r1 - 0.5) * 0.30, h, y + (r2 - 0.5) * 0.30,
          0, r3 * Math.PI * 2, 0,
          0.85 + r4 * 0.40, 0.85 + r1 * 0.35, 0.85 + r4 * 0.40,
          0.92 + r2 * 0.16, 0.95 + r3 * 0.12, 0.90 + r1 * 0.16);
        break;
      }
      case 'cactus': case 'icespike': case 'crystalspire': case 'ruinpillar':
      case 'lavarock': case 'geyser': case 'drybone': case 'dune':
      case 'reef': case 'mossruin': {
        pushInst(bucket, deco, x + (r1 - 0.5) * 0.24, h - 0.02, y + (r2 - 0.5) * 0.24,
          (r3 - 0.5) * 0.14, r1 * Math.PI * 2, (r4 - 0.5) * 0.14,
          0.80 + r3 * 0.45, 0.78 + r4 * 0.42, 0.80 + r2 * 0.45,
          0.90 + r4 * 0.20, 0.92 + r4 * 0.18, 0.94 + r4 * 0.16);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  MONUMENTS — repérage des blocs de tuiles contiguës (§15 : « repère les
  //  blocs contigus de même monument avant de construire »).
  //
  //  DEUX FAMILLES, selon l'empreinte NATURELLE (citybuild.footprint(kind)) :
  //
  //  1) Empreinte > 1×1 (château 9×6, église 7×5, arène 9×9, halte de soins
  //     4×3, boutique 3×3, manoir/fontaine/observatoire/phare/mât…) : ce sont
  //     des STRUCTURES UNIQUES — une seule par ville. On fusionne le bloc de
  //     tuiles contiguës qui portent ce décor et on appelle
  //     citybuild.build() UNE SEULE FOIS pour tout le bloc (sinon un château
  //     de 54 tuiles se construirait 54 fois, empilé sur lui-même).
  //
  //  2) Empreinte ≤ 1×1 (rempart, tours, portes, lampadaires, statues,
  //     haies, maisons de ville…) : ce sont des MODULES RÉPÉTÉS, potentiel-
  //     lement des centaines de tuiles par ville (un rempart fait ~150-200
  //     tuiles de pourtour). ÉCART DÉLIBÉRÉ AU CONTRAT : plutôt que d'appeler
  //     citybuild.build() une fois PAR TUILE (ce qui dépasserait de très loin
  //     le budget de 250 draw calls — mesuré à plus de 800 lors de la vérif-
  //     ication près d'une ville), on construit UN SEUL gabarit par (genre,
  //     style) via citybuild.build(), on en extrait les sous-maillages déjà
  //     « cuits » (bake() de citybuild3d les fusionne en 1 à 4 pièces par
  //     matériau), et on les INSTANCIE comme n'importe quel autre décor —
  //     un InstancedMesh par pièce et par chunk, quel que soit le nombre de
  //     tuiles. C'est la seule façon de tenir le budget avec un rempart de
  //     ville entier tout en gardant chaque tuile de mur rendue (la fusionner
  //     en un seul bloc géométrique, comme la famille 1, aurait laissé de
  //     vrais trous : buildWall()/buildWallTower()/buildGate() produisent
  //     toujours UNE section d'une tuile de large, quels que soient
  //     opts.w/opts.h — ils ignorent ces champs).
  // ---------------------------------------------------------------------------
  let blocksByChunk = null;   // Map('cx_cy' -> [block,...])  — famille 1 (surfacique)

  function footprintOf(cityApiV, kind) {
    if (cityApiV && typeof cityApiV.footprint === 'function') {
      try { const f = cityApiV.footprint(kind); if (f && f.w && f.h) return f; } catch (e) { /* repli */ }
    }
    return { w: 1, h: 1 };
  }

  function chunkKeyOfTile(tx, ty) {
    let cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK);
    if (cx < 0) cx = 0; else if (cx >= NCX) cx = NCX - 1;
    if (cy < 0) cy = 0; else if (cy >= NCY) cy = NCY - 1;
    return cx + '_' + cy;
  }

  /** Ne repère QUE les blocs « surfaciques » (empreinte > 1×1, famille 1
   *  ci-dessus). Les modules répétés (famille 2) sont laissés en place : ils
   *  sont détectés et instanciés tuile par tuile pendant buildChunk(), comme
   *  n'importe quel décor — voir placeMonumentInstance().
   *
   *  ÉCART DÉLIBÉRÉ SUPPLÉMENTAIRE, encore justifié par l'implémentation
   *  réelle de cities3d.js : on fusionne par BOÎTE ENGLOBANTE PAR TYPE DE
   *  DÉCOR (une passe sur toute la grille, une boîte par valeur de `deco`),
   *  PAS par composante connexe. Mesuré sur le terrain : `building()` de
   *  cities3d.js pose le château sur un rectangle plein, mais les rues/
   *  décors déjà posés avant (règle « premier arrivé, premier servi » de
   *  cities3d.js) y laissent des trous — un vrai flood-fill 4-connexe y
   *  trouvait 12 îlots de 1 à 9 tuiles au lieu d'un seul bloc de 54, donc
   *  12 châteaux empilés au même endroit. Chaque monument surfacique
   *  n'apparaissant qu'UNE FOIS par région (un seul château, une seule
   *  église, une seule arène — cf. cityDef du contrat §10), regrouper par
   *  TYPE plutôt que par contiguïté est à la fois plus simple, plus rapide
   *  (une seule passe, pas de pile de parcours) et surtout plus fidèle à
   *  l'intention du contrat : « une seule fois pour tout le bloc ». */
  function buildMonumentBlocks() {
    blocksByChunk = new Map();
    const cityApiV = cityApi();
    if (!cityApiV || typeof cityApiV.isMonument !== 'function') return;   // repli : aucun monument

    const boxes = Object.create(null);       // deco -> { x0,y0,x1,y1,roof }
    const bigDeco = Object.create(null);     // deco -> bool (mémoïsé, évite de rappeler isMonument/footprint 86 016 fois)

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const type = tileAt(x, y);
        const st = R3.tileStyle(type);
        const deco = st.deco;
        if (!deco) continue;

        let big = bigDeco[deco];
        if (big === undefined) {
          let isMon = false;
          try { isMon = cityApiV.isMonument(deco); } catch (e) { isMon = false; }
          big = isMon ? (function () { const fp = footprintOf(cityApiV, deco); return fp.w > 1 || fp.h > 1; })() : false;
          bigDeco[deco] = big;
        }
        if (!big) continue;

        let b = boxes[deco];
        if (!b) { boxes[deco] = { x0: x, y0: y, x1: x, y1: y, roof: st.roof || null }; continue; }
        if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
        if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      }
    }

    for (const deco in boxes) {
      const b = boxes[deco];
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      const key = chunkKeyOfTile(cx, cy);
      let arr = blocksByChunk.get(key);
      if (!arr) blocksByChunk.set(key, arr = []);
      arr.push({ kind: deco, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, roof: b.roof });
    }
  }

  // --- Famille 2 : gabarit instancié d'un monument à empreinte 1×1 ----------
  // Un seul citybuild.build() par (genre, style), dont on extrait les pièces
  // déjà cuites (matériau nommé 'citybuild-<seau>' par citybuild3d.js) pour
  // les réutiliser comme un THREE.InstancedMesh — voir le commentaire ci-
  // dessus. Les pièces ANIMÉES (bannières, jets...) sont délibérément
  // exclues : les instancier figerait une seule animation partagée par
  // toutes les occurrences, ce qui serait pire qu'une bannière immobile.
  const _monProtoCache = new Map();   // 'kind|style' -> [{geo,mat}, ...] | null

  function isDynamicNode(o, root) {
    let n = o;
    while (n && n !== root) { if (n.userData && n.userData.dyn) return true; n = n.parent; }
    return false;
  }

  function monumentProto(cityApiV, kind) {
    const key = kind + '|' + regionStyle;
    if (_monProtoCache.has(key)) return _monProtoCache.get(key);
    let parts = null;
    try {
      const g = cityApiV.build(kind, { style: regionStyle });
      if (g) {
        const baked = [], other = [];
        g.traverse(function (o) {
          if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
          if (isDynamicNode(o, g)) return;   // pièce animée : jamais instanciée
          o.geometry.userData.shared = true;  // protège du disposeTree par chunk
          const isBaked = !!(o.material && o.material.name && o.material.name.indexOf('citybuild-') === 0);
          (isBaked ? baked : other).push({ geo: o.geometry, mat: o.material });
        });
        parts = baked.length ? baked : (other.length ? other : null);
      }
    } catch (e) {
      console.warn('[world3d] échec du gabarit de monument « ' + kind + ' » :', e);
      parts = null;
    }
    _monProtoCache.set(key, parts);
    return parts;
  }

  /** Un rempart doit présenter sa face fine (l'épaisseur du mur) vers
   *  l'extérieur : on l'oriente selon l'axe dominant de ses voisins de même
   *  décor (mur qui court est-ouest vs nord-sud). Les autres modules répétés
   *  (tours, portes, statues…) sont conçus pour rester justes quelle que soit
   *  l'orientation (voir citybuild3d.js) : pas besoin d'orientation dédiée. */
  function repeatedMonumentOrientation(kind, x, y, deco) {
    if (kind !== 'wall') return 0;
    const ew = (R3.tileStyle(tileAt(x + 1, y)).deco === deco) || (R3.tileStyle(tileAt(x - 1, y)).deco === deco);
    const ns = (R3.tileStyle(tileAt(x, y + 1)).deco === deco) || (R3.tileStyle(tileAt(x, y - 1)).deco === deco);
    return (ns && !ew) ? Math.PI / 2 : 0;
  }

  function pushInstMon(bucket, key, px, py, pz, ry) {
    let b = bucket[key];
    if (!b) b = bucket[key] = { m: [] };
    _eul.set(0, ry, 0, 'YXZ');
    _quat.setFromEuler(_eul);
    _pos.set(px, py, pz);
    _scl.set(1, 1, 1);
    _mat4.compose(_pos, _quat, _scl);
    _mat4.toArray(b.m, b.m.length);
  }

  function placeMonumentInstance(monBucket, cityApiV, deco, x, y) {
    const parts = monumentProto(cityApiV, deco);
    if (!parts || !parts.length) return;
    const ry = repeatedMonumentOrientation(deco, x, y, deco);
    const py = heightAt(x, y);
    for (let i = 0; i < parts.length; i++) pushInstMon(monBucket, 'mon:' + deco + ':' + i, x, py, y, ry);
  }

  // ---------------------------------------------------------------------------
  //  COULEUR DE SOL PAR TUILE — calculée à la demande (pas de cache W×H×3 :
  //  seul le champ de hauteur doit être global d'après le contrat), avec le
  //  même grain déterministe que la v1.
  // ---------------------------------------------------------------------------
  const _sampleColor = new THREE.Color();
  const _tmp3 = [0, 0, 0];

  function sampleGroundColor(tx, ty, out) {
    const cx = tx < 0 ? 0 : (tx >= W ? W - 1 : tx);
    const cy = ty < 0 ? 0 : (ty >= H ? H - 1 : ty);
    const type = tileAt(cx, cy);
    const st = R3.tileStyle(type);
    _sampleColor.set(st.ground);
    const flatish = isFlatType(type, st);
    const r = R3.hash(cx * 3 + 1, cy * 5 + 2);
    const v = flatish ? (0.975 + 0.05 * r) : (0.905 + 0.185 * r);
    out[0] = _sampleColor.r * v; out[1] = _sampleColor.g * v; out[2] = _sampleColor.b * v;
  }

  function tileColorInto(m, n, out) {
    let tx0, tx1, ty0, ty1;
    if (m & 1) { tx0 = tx1 = (m - 1) >> 1; } else { tx0 = (m >> 1) - 1; tx1 = m >> 1; }
    if (n & 1) { ty0 = ty1 = (n - 1) >> 1; } else { ty0 = (n >> 1) - 1; ty1 = n >> 1; }
    let r = 0, g = 0, b = 0, k = 0;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        sampleGroundColor(tx, ty, _tmp3);
        r += _tmp3[0]; g += _tmp3[1]; b += _tmp3[2]; k++;
      }
    }
    out[0] = r / k; out[1] = g / k; out[2] = b / k;
  }

  // ---------------------------------------------------------------------------
  //  GÉOMÉTRIE DE TERRAIN D'UN CHUNK — 2 sous-cases par tuile, même diagonale
  //  que heightAt() (voir §15 et le commentaire de heightAt plus haut).
  // ---------------------------------------------------------------------------
  function buildChunkTerrain(x0, x1, y0, y1) {
    const tw = x1 - x0 + 1, td = y1 - y0 + 1;
    const nx = tw * 2, nz = td * 2;
    const vx = nx + 1, vz = nz + 1;
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

    const idx = new Uint32Array(nx * nz * 6);
    let k = 0;
    for (let n = 0; n < nz; n++) {
      for (let m = 0; m < nx; m++) {
        const a = n * vx + m, b = a + 1, cc = a + vx, d = cc + 1;
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
  //  JUPE DE BORDURE + OCÉAN LOINTAIN — construite UNE FOIS par région (elle
  //  suit le bord de la RÉGION ACTIVE, W/H dynamiques — pas de constante figée
  //  sur l'ancienne carte 120×70). Voir CONTRACT.md v1 : sans la jupe qui
  //  plonge, l'horizon devient vert et masque le ciel ; sans le quad d'océan
  //  lointain, la mer s'arrête net devant le joueur.
  // ---------------------------------------------------------------------------
  let skirtMesh = null;
  const farOceanMeshes = [];

  function buildSkirt() {
    const P = [], C = [];
    const xMin = -0.5, xMax = W - 0.5, zMin = -0.5, zMax = H - 0.5;
    const c = [0, 0, 0];
    const SEA_DEEP = new THREE.Color('#1b2c62');
    const SEA_Y = -0.12;
    let seaEdge = false;

    function quad(p00, p10, p01, p11, cr, cg, cb) {
      const t = [p00, p01, p10, p10, p01, p11];
      for (let i = 0; i < 6; i++) { P.push(t[i][0], t[i][1], t[i][2]); C.push(cr, cg, cb); }
    }
    function tcol(tx, ty) {
      const cx = tx < 0 ? 0 : (tx >= W ? W - 1 : tx);
      const cy = ty < 0 ? 0 : (ty >= H ? H - 1 : ty);
      const st = R3.tileStyle(tileAt(cx, cy));
      seaEdge = !!st.water;
      if (seaEdge) { c[0] = SEA_DEEP.r; c[1] = SEA_DEEP.g; c[2] = SEA_DEEP.b; return; }
      sampleGroundColor(cx, cy, _tmp3);
      c[0] = _tmp3[0]; c[1] = _tmp3[1]; c[2] = _tmp3[2];
    }

    for (let i = 0; i < W; i++) {
      const xa = i - 0.5, xb = i + 0.5;
      tcol(i, 0);
      let ha = seaEdge ? SEA_Y : cornerH(i, 0), hb = seaEdge ? SEA_Y : cornerH(i + 1, 0);
      let d = seaEdge ? 0 : SKIRT_DROP;
      quad([xa, ha - d, zMin - SKIRT], [xb, hb - d, zMin - SKIRT], [xa, ha, zMin], [xb, hb, zMin], c[0], c[1], c[2]);
      tcol(i, H - 1);
      ha = seaEdge ? SEA_Y : cornerH(i, H); hb = seaEdge ? SEA_Y : cornerH(i + 1, H);
      d = seaEdge ? 0 : SKIRT_DROP;
      quad([xa, ha, zMax], [xb, hb, zMax], [xa, ha - d, zMax + SKIRT], [xb, hb - d, zMax + SKIRT], c[0], c[1], c[2]);
    }
    for (let j = 0; j < H; j++) {
      const za = j - 0.5, zb = j + 0.5;
      tcol(0, j);
      let ha = seaEdge ? SEA_Y : cornerH(0, j), hb = seaEdge ? SEA_Y : cornerH(0, j + 1);
      let d = seaEdge ? 0 : SKIRT_DROP;
      quad([xMin - SKIRT, ha - d, za], [xMin, ha, za], [xMin - SKIRT, hb - d, zb], [xMin, hb, zb], c[0], c[1], c[2]);
      tcol(W - 1, j);
      ha = seaEdge ? SEA_Y : cornerH(W, j); hb = seaEdge ? SEA_Y : cornerH(W, j + 1);
      d = seaEdge ? 0 : SKIRT_DROP;
      quad([xMax, ha, za], [xMax + SKIRT, ha - d, za], [xMax, hb, zb], [xMax + SKIRT, hb - d, zb], c[0], c[1], c[2]);
    }
    const corners = [
      [0, 0, xMin - SKIRT, zMin - SKIRT, xMin, zMin],
      [W, 0, xMax, zMin - SKIRT, xMax + SKIRT, zMin],
      [0, H, xMin - SKIRT, zMax, xMin, zMax + SKIRT],
      [W, H, xMax, zMax, xMax + SKIRT, zMax + SKIRT],
    ];
    for (let i = 0; i < corners.length; i++) {
      const q = corners[i];
      tcol(q[0] >= W ? W - 1 : 0, q[1] >= H ? H - 1 : 0);
      const h = seaEdge ? SEA_Y : (cornerH(q[0], q[1]) - SKIRT_DROP);
      quad([q[2], h, q[3]], [q[4], h, q[3]], [q[2], h, q[5]], [q[4], h, q[5]], c[0], c[1], c[2]);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, matGround());
    m.castShadow = false; m.receiveShadow = false;
    m.name = 'bordure';
    return m;
  }

  /** Un bord de région est-il « côtier » ? Échantillonne 3 points le long du
   *  bord plutôt qu'un seul coin (une région peut avoir un rivage irrégulier). */
  function edgeIsWatery(side) {
    const samples = [];
    if (side === 'N' || side === 'S') {
      const y = side === 'N' ? 0 : H - 1;
      for (let f = 0.15; f <= 0.86; f += 0.35) samples.push([Math.round(W * f), y]);
    } else {
      const x = side === 'W' ? 0 : W - 1;
      for (let f = 0.15; f <= 0.86; f += 0.35) samples.push([x, Math.round(H * f)]);
    }
    let n = 0;
    for (let i = 0; i < samples.length; i++) {
      if (R3.tileStyle(tileAt(samples[i][0], samples[i][1])).water) n++;
    }
    return n >= 2;
  }

  function addFarOceanQuad(side) {
    const mesh = new THREE.Mesh(R3.geo.plane(1, 1), R3.mat('#1c2a63', { rough: 0.45 }));
    mesh.rotation.x = -Math.PI / 2;
    const size = Math.max(W, H) * 3.2;
    mesh.scale.set(size, size, 1);
    const cx = (W - 1) / 2, cz = (H - 1) / 2;
    const off = Math.max(W, H) * 1.6;
    let px = cx, pz = cz;
    if (side === 'N') pz = -off;
    else if (side === 'S') pz = H - 1 + off;
    else if (side === 'W') px = -off;
    else px = W - 1 + off;
    mesh.position.set(px, -0.32, pz);
    mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.name = 'ocean-horizon-' + side;
    root.add(mesh);
    farOceanMeshes.push(mesh);
  }

  function buildSkirtAndFarOcean() {
    skirtMesh = buildSkirt();
    root.add(skirtMesh);
    const sides = ['N', 'S', 'E', 'W'];
    for (let i = 0; i < sides.length; i++) {
      if (edgeIsWatery(sides[i])) addFarOceanQuad(sides[i]);
    }
  }

  // ---------------------------------------------------------------------------
  //  EAU — regroupement par chunk (contrat §15 : « par chunk », contrairement
  //  à la v1 qui groupait sur toute la carte). Repli en plan coloré pour tout
  //  type que water3d.js ne connaît pas (nouveaux types 'lava'/'swamp'/'ice').
  // ---------------------------------------------------------------------------
  const FALLBACK_COLOR = {
    lake: '#2a55b0', pond: '#2a4bb0', sea: '#22357a', waves: '#4fb2e6', shallow: '#3f95cf',
    lava: '#ff6b3d', swamp: '#33402a', ice: '#cfe9f5',
  };
  const FALLBACK_LEVEL = {
    lake: -0.06, pond: -0.06, sea: -0.05, waves: -0.03, shallow: -0.05,
    lava: -0.25, swamp: -0.30, ice: -0.02,
  };
  const FALLBACK_MAT_OPTS = {
    lake: { transparent: true, opacity: 0.82, rough: 0.15, metal: 0.05 },
    pond: { transparent: true, opacity: 0.82, rough: 0.15, metal: 0.05 },
    sea: { transparent: true, opacity: 0.85, rough: 0.20, metal: 0.05 },
    waves: { transparent: true, opacity: 0.78, rough: 0.20, metal: 0.05 },
    shallow: { transparent: true, opacity: 0.75, rough: 0.20, metal: 0.05 },
    // Lave : émissive, mate, opaque — elle ne « brille » pas comme de l'eau.
    lava: { transparent: false, rough: 0.55, emissive: '#ff6b3d', emissiveIntensity: 0.55 },
    // Marécage : trouble et bien plus opaque que l'eau claire.
    swamp: { transparent: true, opacity: 0.90, rough: 0.55, metal: 0.0 },
    // Glace : quasi immobile, un peu réfléchissante.
    ice: { transparent: true, opacity: 0.90, rough: 0.10, metal: 0.20 },
  };
  const _waterFallbackMats = Object.create(null);

  function fallbackWaterMesh(tiles, kind) {
    const level = FALLBACK_LEVEL[kind] !== undefined ? FALLBACK_LEVEL[kind] : -0.05;
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
    const m = R3.mat(FALLBACK_COLOR[kind] || '#2a55b0', FALLBACK_MAT_OPTS[kind] || FALLBACK_MAT_OPTS.lake);
    _waterFallbackMats[kind] = m;
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = false; mesh.castShadow = false;
    mesh.userData.waterKind = kind;
    return mesh;
  }

  /** makeSurface(tiles,kind) de water3d.js si le type est géré, repli sinon. */
  function waterMeshFor(tiles, kind) {
    const w = waterApi();
    if (w && typeof w.makeSurface === 'function' && (!w.KINDS || w.KINDS[kind])) {
      try { const m = w.makeSurface(tiles, kind); if (m) return m; } catch (e) {
        console.warn('[world3d] water.makeSurface a échoué :', kind, e);
      }
    }
    return fallbackWaterMesh(tiles, kind);
  }

  function animateFallbackWater(t) {
    for (const k in _waterFallbackMats) {
      const m = _waterFallbackMats[k];
      if (!m) continue;
      if (k === 'lava') {
        m.emissiveIntensity = 0.50 + Math.sin(t * 1.6) * 0.16 + Math.sin(t * 3.7) * 0.07;
      } else if (k === 'swamp') {
        m.opacity = 0.86 + Math.sin(t * 0.6) * 0.04;
      } else if (k === 'ice') {
        // immobile, comme demandé au §15 — rien à animer.
      } else {
        m.opacity = Math.min(1, 0.65 + Math.sin(t * 1.1 + k.length * 0.7) * 0.12);
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  FONTAINES — vasque instanciée + jet/eau à part (matériau animé de water3d).
  // ---------------------------------------------------------------------------
  const fountains = [];

  function buildChunkFountainWater(parent, chunkFountains) {
    const water = waterApi();
    for (let i = 0; i < chunkFountains.length; i++) {
      const f = chunkFountains[i];
      const k = f.big ? 1.32 : 1.0;
      let matJet = null;
      if (water && water.material) { try { matJet = water.material('fountain'); } catch (e) { matJet = null; } }
      if (!matJet) matJet = R3.matGlass('#a8ecf7', 0.58);

      const g = new THREE.Group();
      g.position.set(f.x, f.h, f.y);
      const disc = new THREE.Mesh(R3.geo.cyl(0.40 * k, 0.40 * k, 0.02, 16), matJet);
      disc.position.y = 0.25;
      g.add(disc);
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
  const fountainFx = [];

  // ---------------------------------------------------------------------------
  //  CONSTRUCTION / LIBÉRATION D'UN CHUNK
  // ---------------------------------------------------------------------------
  const root = new THREE.Group();
  root.name = 'monde';
  const chunkMap = new Map();       // 'cx_cy' -> { group, cx, cz, radius }

  function buildChunk(cx, cy) {
    const key = cx + '_' + cy;
    if (chunkMap.has(key)) return;

    const x0 = cx * CHUNK, x1 = Math.min(W - 1, x0 + CHUNK - 1);
    const y0 = cy * CHUNK, y1 = Math.min(H - 1, y0 + CHUNK - 1);
    const shadows = !!(R3.quality && R3.quality.shadows);

    const grp = new THREE.Group();
    grp.name = 'chunk_' + cx + '_' + cy;

    // --- terrain ---
    const gm = new THREE.Mesh(buildChunkTerrain(x0, x1, y0, y1), matGround());
    gm.castShadow = false; gm.receiveShadow = true;
    grp.add(gm);

    // --- décors + eau : un seul passage sur les tuiles du chunk ---
    const bucket = Object.create(null);
    const monBucket = Object.create(null);   // monuments à empreinte 1×1 (famille 2)
    const waterBuckets = Object.create(null);
    const cityApiV = cityApi();
    const chunkFountains = [];
    const fBefore = fountains.length;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const type = tileAt(x, y);
        const st = R3.tileStyle(type);
        if (st.water) {
          const arr = waterBuckets[st.water] || (waterBuckets[st.water] = []);
          arr.push({ x: x, y: y, h: TH ? TH[y * W + x] : st.h });
        }
        const deco = st.deco;
        if (!deco) continue;
        if (cityApiV && cityApiV.isMonument(deco)) {
          const fp = footprintOf(cityApiV, deco);
          if (fp.w <= 1 && fp.h <= 1) placeMonumentInstance(monBucket, cityApiV, deco, x, y);
          // sinon : structure surfacique, déjà prise en charge par blocksByChunk
          continue;
        }
        placeDecos(bucket, x, y, type, st);
      }
    }
    for (let i = fBefore; i < fountains.length; i++) chunkFountains.push(fountains[i]);

    // --- décors instanciés ---
    for (const bkey in bucket) {
      const b = bucket[bkey];
      const p = proto(bkey);
      const n = b.m.length / 16;
      if (!p || !n) continue;
      const im = new THREE.InstancedMesh(p.geo, p.mat, n);
      im.instanceMatrix.array.set(b.m);
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(b.c), 3);
      im.instanceColor.needsUpdate = true;
      im.castShadow = p.cast && shadows;
      im.receiveShadow = true;
      im.name = bkey;
      im.computeBoundingSphere();
      grp.add(im);
    }

    // --- monuments répétés instanciés (famille 2 : rempart, tours, portes,
    //     lampadaires, statues, maisons de ville…) ---
    for (const mkey in monBucket) {
      const b = monBucket[mkey];
      const n = b.m.length / 16;
      if (!n) continue;
      const parts = mkey.split(':');
      const partsArr = monumentProto(cityApiV, parts[1]);
      const piece = partsArr && partsArr[parts[2] | 0];
      if (!piece) continue;
      const im = new THREE.InstancedMesh(piece.geo, piece.mat, n);
      im.instanceMatrix.array.set(b.m);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = shadows;
      im.receiveShadow = true;
      im.name = mkey;
      im.computeBoundingSphere();
      grp.add(im);
    }

    // --- monuments dont ce chunk est le propriétaire (famille 1 : château,
    //     église, arène, halte de soins, boutique, manoir, fontaine…) ---
    const blocks = blocksByChunk ? blocksByChunk.get(key) : null;
    if (blocks && cityApiV) {
      for (let i = 0; i < blocks.length; i++) {
        const bl = blocks[i];
        try {
          const mg = cityApiV.build(bl.kind, {
            style: regionStyle, x: bl.x0, y: bl.y0, w: (bl.x1 - bl.x0 + 1), h: (bl.y1 - bl.y0 + 1),
            roof: bl.roof,
          });
          if (mg) {
            const ccx = (bl.x0 + bl.x1) / 2, ccz = (bl.y0 + bl.y1) / 2;
            mg.position.set(ccx, heightAt(ccx, ccz), ccz);
            grp.add(mg);
          }
        } catch (e) {
          console.warn('[world3d] échec de construction du monument « ' + bl.kind + ' » :', e);
        }
      }
    }

    // --- eau du chunk ---
    for (const kind in waterBuckets) {
      const m = waterMeshFor(waterBuckets[kind], kind);
      if (m) { m.name = 'eau-' + kind; grp.add(m); }
    }

    // --- fontaines (jet + gouttes) ---
    if (chunkFountains.length) buildChunkFountainWater(grp, chunkFountains);

    const cxw = (x0 + x1) * 0.5, czw = (y0 + y1) * 0.5;
    const radius = Math.sqrt(
      ((x1 - x0 + 1) * 0.5) * ((x1 - x0 + 1) * 0.5) + ((y1 - y0 + 1) * 0.5) * ((y1 - y0 + 1) * 0.5)
    );
    grp.userData.cx = cxw; grp.userData.cz = czw; grp.userData.radius = radius;
    root.add(grp);
    chunkMap.set(key, { group: grp, cx: cxw, cz: czw, radius: radius });
  }

  /**
   * Libère le groupe d'un chunk. On rend d'abord ses nappes d'eau à water3d :
   * `R3.disposeTree` ne libère que les buffers GPU, et water3d garde une liste
   * de toutes les surfaces créées (pour rééchanger leurs matériaux au
   * changement de qualité). Sans ce `release`, traverser une région entière
   * laissait des centaines de géométries d'eau vivantes en mémoire.
   * C'est le SEUL point de libération d'un chunk : disposeChunk et setRegion
   * passent tous les deux par ici.
   */
  function disposeChunkGroup(grp) {
    const w = waterApi();
    if (w && typeof w.release === 'function') {
      grp.traverse(function (o) {
        if (o.userData && o.userData.waterKind) {
          try { w.release(o); } catch (e) { /* une nappe de repli n'y est pas */ }
        }
      });
    }
    R3.disposeTree(grp);
  }

  function disposeChunk(key) {
    const c = chunkMap.get(key);
    if (!c) return;
    try { disposeChunkGroup(c.group); } catch (e) { console.warn('[world3d] échec de libération du chunk', key, e); }
    chunkMap.delete(key);
  }

  // ---------------------------------------------------------------------------
  //  API DU CONTRAT §15
  // ---------------------------------------------------------------------------
  let rootAttached = false;

  function build(scene) {
    if (!rootAttached) rootAttached = true;
    if (scene && root.parent !== scene) scene.add(root);
  }

  function setRegion(id) {
    const R = regionsApi();
    if (R && typeof R.load === 'function') {
      try { R.load(id); } catch (e) { console.warn('[world3d] échec de R.load(' + id + ') :', e); }
    }

    W = (R && typeof R.W === 'number' && R.W > 0) ? R.W : 384;
    H = (R && typeof R.H === 'number' && R.H > 0) ? R.H : 224;
    NCX = Math.max(1, Math.ceil(W / CHUNK));
    NCY = Math.max(1, Math.ceil(H / CHUNK));

    // Libère TOUT ce qui existait (contrat §15 : « setRegion : libère tout et
    // repart sur la nouvelle région »).
    // Le pire cas de la fuite d'eau : ici on libère TOUS les chunks d'un coup.
    chunkMap.forEach(function (c) { try { disposeChunkGroup(c.group); } catch (e) { /* déjà orphelin */ } });
    chunkMap.clear();
    if (skirtMesh) { try { R3.disposeTree(skirtMesh); } catch (e) { /* ignore */ } skirtMesh = null; }
    for (let i = 0; i < farOceanMeshes.length; i++) {
      try { R3.disposeTree(farOceanMeshes[i]); } catch (e) { /* ignore */ }
    }
    farOceanMeshes.length = 0;
    fountains.length = 0;
    for (let i = 0; i < fountainFx.length; i++) {
      try { R3.disposeTree(fountainFx[i].root); } catch (e) { /* ignore */ }
    }
    fountainFx.length = 0;

    const active = (R && typeof R.active === 'function') ? R.active() : null;
    activeRegionId = active ? active.id : (id || null);
    activeSeed = (active && typeof active.seed === 'number') ? active.seed : 0;
    regionStyle = REGION_STYLE[activeRegionId] || 'emeraude';

    buildHeightField();
    buildMonumentBlocks();
    buildSkirtAndFarOcean();
  }

  // ---------------------------------------------------------------------------
  //  STREAMING — update(t,px,pz) : charge/libère les chunks (contrat §15).
  // ---------------------------------------------------------------------------
  const _swayMats = [];
  let _swayCollected = false;
  const _toUnload = [];
  const _candidates = [];

  function update(t, px, pz) {
    // Balancement de la végétation (uTime partagé, une seule écriture/frame).
    if (!_swayCollected) {
      _swayCollected = true;
      _vcMats.forEach(function (m) { if (m.userData && m.userData.uTime) _swayMats.push(m); });
    }
    for (let i = 0; i < _swayMats.length; i++) _swayMats[i].userData.uTime.value = t;
    animateFallbackWater(t);

    // Fontaines : jet qui respire, gouttes qui retombent en boucle.
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

    if (!CH) return;                                  // aucune région chargée
    if (typeof px !== 'number' || typeof pz !== 'number') return;

    const vd = (R3.quality && R3.quality.viewDistance) || 46;
    const loadR = vd + 24;
    const unloadR = loadR + 16;                        // hystérésis (§15)

    // --- déchargement : au-delà de unloadR, sans limite de budget (pas cher) ---
    _toUnload.length = 0;
    chunkMap.forEach(function (c, key) {
      const dx = c.cx - px, dz = c.cz - pz;
      const d = Math.sqrt(dx * dx + dz * dz) - c.radius;
      if (d > unloadR) _toUnload.push(key);
    });
    for (let i = 0; i < _toUnload.length; i++) disposeChunk(_toUnload[i]);

    // --- chargement : au plus BUILD_BUDGET chunks par frame, les plus proches
    //     d'abord (sinon un à-coup d'une demi-seconde à chaque déplacement). ---
    _candidates.length = 0;
    for (let cy = 0; cy < NCY; cy++) {
      for (let cx = 0; cx < NCX; cx++) {
        const key = cx + '_' + cy;
        if (chunkMap.has(key)) continue;
        const cx0 = cx * CHUNK, cx1 = Math.min(W - 1, cx0 + CHUNK - 1);
        const cy0 = cy * CHUNK, cy1 = Math.min(H - 1, cy0 + CHUNK - 1);
        const ccx = (cx0 + cx1) * 0.5, ccz = (cy0 + cy1) * 0.5;
        const dx = ccx - px, dz = ccz - pz;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < loadR) _candidates.push({ cx: cx, cy: cy, d: d });
      }
    }
    _candidates.sort(function (a, b) { return a.d - b.d; });
    for (let i = 0; i < _candidates.length && i < BUILD_BUDGET; i++) buildChunk(_candidates[i].cx, _candidates[i].cy);
  }

  function stats() {
    let meshes = 0;
    root.traverse(function (o) { if (o.isMesh || o.isInstancedMesh) meshes++; });
    return { chunks: chunkMap.size, meshes: meshes };
  }

  // ---------------------------------------------------------------------------
  R3.register('world', {
    build: build,
    setRegion: setRegion,
    heightAt: heightAt,
    update: update,
    root: root,
    stats: stats,
  });
})();
