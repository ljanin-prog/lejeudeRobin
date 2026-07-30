// ============================================================================
//  citybuild3d.js — LES MONUMENTS EN 3D DES SIX VILLES  (contrat v2, §14 + §17 bis)
// ============================================================================
//  Ce module construit à l'unité tout ce qui fait qu'une ville est MAJESTUEUSE :
//  le rempart et sa porte monumentale, le château qui domine la campagne,
//  l'église et son clocher, la grande fontaine, l'arène, les maisons de ville,
//  et le mât d'amarrage du dirigeable.
//
//  world3d.js appelle `R3.get('citybuild').build(kind, opts)` et ajoute le
//  groupe renvoyé tel quel au chunk. Rien n'est instancié ici.
//
//  ---------------------------------------------------------------------------
//  DEUX IDÉES PORTENT TOUT LE FICHIER — les comprendre évite de le casser :
//
//  1) LES SIX STYLES NE SONT PAS UNE TEINTE.
//     `opts.style` change les MATÉRIAUX, la FORME DES TOITS, la FORME DES
//     BANNIÈRES et les ORNEMENTS. Bourg-Émeraude a des pignons de bois et des
//     colombages ; Ambrelune est sur pilotis sous des toits de feuilles ;
//     Port-Saphir a des tuiles bleues et des cordages ; Cimefroide a de la
//     pierre sombre, des flèches très raides et de la neige ; Fournaise est en
//     basalte avec des braseros ; Aurore-Cité est en marbre blanc à coupoles
//     d'or. On doit reconnaître la ville à sa seule architecture.
//
//  2) LA « CUISSON » (bake) — c'est ce qui tient le budget de draw calls.
//     Un château modélisé fait ~110 meshes. 110 meshes = 110 draw calls, et
//     trois bâtiments suffiraient à faire tomber le jeu. On fusionne donc, à la
//     construction, toutes les pièces STATIQUES en un seul BufferGeometry par
//     « famille de matériau » (mat, métal, halo chaud, halo froid), la couleur
//     de chaque pièce passant en VERTEX COLORS. Un château = 2 à 4 draw calls.
//     Seules les pièces ANIMÉES (bannières, jets d'eau, portail, girouette…)
//     restent des meshes séparés : elles doivent pouvoir bouger toutes seules.
//     `opts.bake === false` désactive la cuisson (utile pour déboguer).
//
//  Repère : chaque monument est posé sur y = 0, centré en (0,0,0) dans le plan
//  horizontal, tient dans opts.w × opts.h tuiles, et regarde vers +z ; opts.dir
//  ('up'|'down'|'left'|'right' ou un angle en radians) le fait pivoter.
// ============================================================================

(function () {
  'use strict';

  // Aucune exception au chargement : si le socle manque, on ne fait rien.
  if (typeof THREE === 'undefined' || typeof R3 === 'undefined' || !R3) {
    if (typeof console !== 'undefined') console.warn('[citybuild3d] R3/THREE absents — module inactif.');
    return;
  }

  const PI = Math.PI;

  // ==========================================================================
  //  1. LES SIX STYLES DE VILLE
  //     roofKind   : forme du toit des bâtiments      ('pignon', 'pignon_raide',
  //                  'feuille', 'plat', 'dome')
  //     towerKind  : forme du couronnement des tours  ('cone', 'cone_haut',
  //                  'feuille', 'gradins', 'dome')
  //     bannerKind : forme des bannières              ('queue', 'triangle',
  //                  'feuille', 'flamme', 'carre')
  // ==========================================================================

  const STYLES = {
    // --- Bourg-Émeraude : bois et pierre claire, au milieu des arbres --------
    emeraude: {
      id: 'emeraude',
      stone: '#ddd6c2', stoneDark: '#b0a68c', trim: '#f2ecdb',
      wood: '#8b5a2b', woodDark: '#5c2e0d',
      wall: '#fcd8a0',                       // torchis crème des maisons 2D
      roof: '#2f8f5f', roofDark: '#1e6b45',
      banner: '#38b764', banner2: '#f1c40f',
      gold: '#e8b93a', glass: '#73eff7', ground: '#b9b2a0',
      roofKind: 'pignon', towerKind: 'cone', bannerKind: 'queue',
      colombage: true, flowers: true,
    },
    // --- Ambrelune : pilotis, toits de feuilles, lanternes -------------------
    ambrelune: {
      id: 'ambrelune',
      stone: '#6f5f45', stoneDark: '#4e412e', trim: '#8a7550',
      wood: '#7a5a34', woodDark: '#4a3520',
      wall: '#c9a86f',
      roof: '#4f7f37', roofDark: '#35601f',
      banner: '#f1c40f', banner2: '#ff8c42',
      gold: '#f1c40f', glass: '#a7f070', ground: '#6b5a3c',
      roofKind: 'feuille', towerKind: 'feuille', bannerKind: 'feuille',
      pilotis: true, lanterns: true,
    },
    // --- Port-Saphir : pierre marine, tuiles bleues, cordages ---------------
    saphir: {
      id: 'saphir',
      stone: '#c3ccd4', stoneDark: '#8d9daa', trim: '#e6edf2',
      wood: '#a5723f', woodDark: '#6b4423',
      wall: '#eef3f6',
      roof: '#2f6fb8', roofDark: '#1d4c85',
      banner: '#41a6f6', banner2: '#f4f4f4',
      gold: '#d8c07a', glass: '#73eff7', ground: '#a9b6c0',
      roofKind: 'pignon', towerKind: 'cone', bannerKind: 'triangle',
      ropes: true,
    },
    // --- Cimefroide : pierre sombre, flèches raides, toits enneigés ---------
    cimefroide: {
      id: 'cimefroide',
      stone: '#5c6472', stoneDark: '#3c434f', trim: '#79808e',
      wood: '#5a4632', woodDark: '#3a2c1f',
      wall: '#6d7482',
      roof: '#333b48', roofDark: '#242a34',
      banner: '#a8e6ff', banner2: '#e8f4f8',
      gold: '#c9d4de', glass: '#a8e6ff', ground: '#7d8592',
      roofKind: 'pignon_raide', towerKind: 'cone_haut', bannerKind: 'triangle',
      snowy: true, snow: '#eef6fb',
    },
    // --- Fournaise : basalte noir, braseros, coulées de lave ----------------
    fournaise: {
      id: 'fournaise',
      stone: '#39323f', stoneDark: '#241f2b', trim: '#4d4457',
      wood: '#4a3128', woodDark: '#2c1c18',
      wall: '#3f3644',
      roof: '#5b2f26', roofDark: '#3b1d18',
      banner: '#ff6b3d', banner2: '#f1c40f',
      gold: '#e08a3c', glass: '#ff9a5c', ground: '#2e2833',
      roofKind: 'plat', towerKind: 'gradins', bannerKind: 'flamme',
      braziers: true, lava: '#ff6b3d',
    },
    // --- Aurore-Cité : marbre blanc et or, coupoles -------------------------
    aurore: {
      id: 'aurore',
      stone: '#f2eee2', stoneDark: '#d6cfbd', trim: '#ffffff',
      wood: '#c9a86f', woodDark: '#9a7c4a',
      wall: '#f7f4ec',
      roof: '#e8c060', roofDark: '#c49a3c',
      banner: '#ffe066', banner2: '#d896ff',
      gold: '#e8c060', glass: '#fff4d6', ground: '#e0dbcc',
      roofKind: 'dome', towerKind: 'dome', bannerKind: 'carre',
      gilded: true,
    },
  };

  function ST(name) { return STYLES[name] || STYLES.emeraude; }

  // Emprises « naturelles » : ce que le monument occupe quand l'appelant ne
  // précise rien. Les gros monuments ne peuvent PAS tenir dans une seule tuile
  // (un château de 16 unités de haut sur 1×1 serait une aiguille) : on garde
  // donc leur emprise de dessin dès que l'appelant n'en impose pas une plus
  // grande. cities3d.js les estampe toujours en blocs, jamais isolés.
  const FOOTPRINT = {
    wall: [1, 1], wallTower: [1, 1], gateArch: [1, 1],
    castle: [9, 6], castleTower: [1, 1], castleGate: [1, 1],
    church: [7, 5], churchTower: [1, 1],
    manor: [3, 3], townhouse: [1, 1], marketStall: [1, 1],
    grandFountain: [3, 3], statue: [1, 1], lamp: [1, 1], banner: [1, 1],
    hedge: [1, 1], roseBed: [1, 1],
    arena: [9, 9], healCenter: [4, 3], shop: [3, 3], portal: [1, 1],
    lighthouse: [2, 2], observatory: [5, 5],
    dock: [1, 1], bridge: [1, 1], signpost: [1, 1], legendAltar: [1, 1],
    airshipMast: [3, 3], airshipDock: [1, 1],
  };

  // Monuments construits à l'unité pour tout un bloc de tuiles (cf. tiles3d).
  const GRAND = {
    wall: 1, wallTower: 1, gateArch: 1, castle: 1, castleTower: 1, castleGate: 1,
    church: 1, churchTower: 1, manor: 1, arena: 1, grandFountain: 1, statue: 1,
    healCenter: 1, shop: 1, portal: 1, lighthouse: 1, observatory: 1,
    airshipMast: 1,
  };

  // ==========================================================================
  //  2. MATÉRIAUX ET PRIMITIVES
  //     Tout passe par R3.mat()/R3.geo.* — jamais de MeshStandardMaterial nu.
  //     Les quatre matériaux de cuisson sont des CLONES d'un matériau R3 (même
  //     astuce que world3d.js) : R3.mat() ne sait pas produire un matériau à
  //     vertexColors, mais on hérite ainsi de tous ses réglages.
  // ==========================================================================

  const BUCKET_OPTS = {
    matte:     { rough: 0.86 },
    metal:     { rough: 0.30, metal: 0.85 },
    glowWarm:  { rough: 0.60, emissive: '#ffd9a0', emissiveIntensity: 0.85 },
    glowCool:  { rough: 0.60, emissive: '#8fd6ff', emissiveIntensity: 0.85 },
  };

  const _bakeMats = new Map();
  function bakeMat(bucket) {
    let m = _bakeMats.get(bucket);
    if (m) return m;
    m = R3.mat('#ffffff', BUCKET_OPTS[bucket] || BUCKET_OPTS.matte).clone();
    m.vertexColors = true;
    m.name = 'citybuild-' + bucket;
    _bakeMats.set(bucket, m);
    return m;
  }

  // Traduit nos options « maison » (glow: 'warm'|'cool') en options R3, et
  // marque le mesh pour la cuisson.
  function opt(o) {
    if (!o) return undefined;
    if (!o.glow) return o;
    const r = Object.assign({}, o);
    r.emissive = (o.glow === 'cool') ? '#8fd6ff' : '#ffd9a0';
    r.emissiveIntensity = 0.85;
    delete r.glow;
    return r;
  }

  function tagged(mesh, color, o) {
    // Un mesh transparent garde son propre matériau : la transparence ne se
    // fusionne pas proprement avec de l'opaque (ordre de tri).
    if (o && o.transparent) return mesh;
    mesh.userData.vc = color;
    mesh.userData.bucket = (o && o.glow)
      ? (o.glow === 'cool' ? 'glowCool' : 'glowWarm')
      : ((o && o.metal >= 0.4) ? 'metal' : 'matte');
    return mesh;
  }

  function bx(w, h, d, c, x, y, z, o) { return tagged(R3.box(w, h, d, c, x, y, z, opt(o)), c, o); }
  function cy(rt, rb, h, c, x, y, z, o) { return tagged(R3.cyl(rt, rb, h, c, x, y, z, opt(o)), c, o); }
  function cn(r, h, c, x, y, z, o) { return tagged(R3.cone(r, h, c, x, y, z, opt(o)), c, o); }
  function sp(r, c, x, y, z, o) { return tagged(R3.sphere(r, c, x, y, z, opt(o)), c, o); }
  function el(rx, ry, rz, c, x, y, z, o) { return tagged(R3.ellipsoid(rx, ry, rz, c, x, y, z, opt(o)), c, o); }

  /** Anneau posé à plat (le tore de Three est dans le plan XY). */
  function ring(r, tube, c, x, y, z, o) {
    const m = tagged(R3.torus(r, tube, c, x, y, z, opt(o)), c, o);
    m.rotation.x = PI / 2;
    return m;
  }

  /** Boîte tournée : raccourci très utilisé (pentes de toit, haubans, arcs). */
  function rbx(w, h, d, c, x, y, z, rx, ry, rz, o) {
    const m = bx(w, h, d, c, x, y, z, o);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    return m;
  }

  /** Matériau d'eau : celui de water3d.js si présent, sinon un bleu translucide. */
  function waterMat(kind) {
    const W = R3.get('water');
    if (W && typeof W.material === 'function') {
      try { const m = W.material(kind); if (m) return m; } catch (e) { /* repli ci-dessous */ }
    }
    return (kind === 'fountain' || kind === 'jet')
      ? R3.mat('#a8e6ff', { transparent: true, opacity: 0.55, rough: 0.1, emissive: '#73eff7', emissiveIntensity: 0.25 })
      : R3.mat('#2f7fb8', { transparent: true, opacity: 0.78, rough: 0.12 });
  }

  function meshOf(geometry, material, x, y, z) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // ==========================================================================
  //  3. LA CUISSON — fusion des pièces statiques
  // ==========================================================================

  function isDynamic(o, root) {
    let n = o;
    while (n && n !== root) { if (n.userData && n.userData.dyn) return true; n = n.parent; }
    return !!(root && root.userData && root.userData.dyn);
  }

  /** Fusionne une liste de { geo, mw, col } en un seul BufferGeometry. */
  function mergeEntries(list) {
    const parts = [];
    let vTotal = 0, iTotal = 0;
    for (let i = 0; i < list.length; i++) {
      const src = list[i].geo;
      if (!src || !src.attributes || !src.attributes.position) continue;
      // On CLONE : les géométries du cache R3 sont partagées, les transformer
      // en place détruirait tous les autres objets qui s'en servent.
      const g = src.clone();
      g.applyMatrix4(list[i].mw);
      parts.push({ g: g, col: list[i].col });
      vTotal += g.attributes.position.count;
      iTotal += g.index ? g.index.count : g.attributes.position.count;
    }
    if (!parts.length) return null;

    const pos = new Float32Array(vTotal * 3);
    const nor = new Float32Array(vTotal * 3);
    const uvs = new Float32Array(vTotal * 2);
    const col = new Float32Array(vTotal * 3);
    const idx = (vTotal > 65535) ? new Uint32Array(iTotal) : new Uint16Array(iTotal);

    const tmp = new THREE.Color();
    let vo = 0, io = 0;
    for (let i = 0; i < parts.length; i++) {
      const g = parts[i].g;
      const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      const cnt = p.count;
      pos.set(p.array, vo * 3);
      if (n) nor.set(n.array, vo * 3);
      if (u) uvs.set(u.array, vo * 2);
      // THREE.Color convertit sRGB -> espace de travail linéaire, exactement
      // comme R3.mat() : les couleurs cuites sont identiques aux couleurs vives.
      tmp.set(parts[i].col || '#ffffff');
      for (let k = 0; k < cnt; k++) {
        col[(vo + k) * 3] = tmp.r; col[(vo + k) * 3 + 1] = tmp.g; col[(vo + k) * 3 + 2] = tmp.b;
      }
      if (g.index) {
        const ia = g.index.array;
        for (let k = 0; k < ia.length; k++) idx[io + k] = ia[k] + vo;
        io += ia.length;
      } else {
        for (let k = 0; k < cnt; k++) idx[io + k] = vo + k;
        io += cnt;
      }
      vo += cnt;
      g.dispose();
    }

    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    return out;
  }

  function bake(root) {
    try {
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      root.scale.set(1, 1, 1);
      root.updateMatrixWorld(true);

      const groups = new Map();   // clé -> { mat, list }
      const doomed = [];
      root.traverse(function (o) {
        if (!o.isMesh || isDynamic(o, root)) return;
        let key, material, color;
        if (o.userData.vc) {
          const b = o.userData.bucket || 'matte';
          key = 'vc:' + b; material = bakeMat(b); color = o.userData.vc;
        } else {
          key = 'm:' + o.material.uuid; material = o.material; color = '#ffffff';
        }
        let grp = groups.get(key);
        if (!grp) { grp = { mat: material, list: [] }; groups.set(key, grp); }
        grp.list.push({ geo: o.geometry, mw: o.matrixWorld, col: color });
        doomed.push(o);
      });
      if (!doomed.length) return root;

      const baked = [];
      groups.forEach(function (grp) {
        const g = mergeEntries(grp.list);
        if (g) baked.push(meshOf(g, grp.mat, 0, 0, 0));
      });
      // On ne retire qu'APRÈS la traversée : modifier l'arbre pendant un
      // traverse() saute des enfants au hasard.
      for (let i = 0; i < doomed.length; i++) if (doomed[i].parent) doomed[i].parent.remove(doomed[i]);
      for (let i = 0; i < baked.length; i++) root.add(baked[i]);

      let dyn = 0;
      root.traverse(function (o) { if (o.isMesh && baked.indexOf(o) < 0) dyn++; });
      root.userData.drawCalls = baked.length + dyn;
      root.userData.baked = true;
    } catch (e) {
      console.warn('[citybuild3d] cuisson impossible, monument laissé brut :', e);
    }
    return root;
  }

  function countMeshes(o) {
    let n = 0;
    o.traverse(function (c) { if (c.isMesh) n++; });
    return n;
  }

  // ==========================================================================
  //  4. LES PIÈCES ANIMÉES
  //     Toutes s'inscrivent dans ANIM ; update() les fait vivre. Un monument
  //     libéré par le streaming n'est plus rattaché à une scène : on purge la
  //     liste de temps en temps plutôt qu'à chaque frame (c'est du balayage,
  //     pas une opération critique).
  // ==========================================================================

  const ANIM = [];
  let lastSweep = 0;

  function reg(entry) { ANIM.push(entry); return entry; }

  function attached(o) {
    let n = o;
    while (n.parent) n = n.parent;
    return !!n.isScene;
  }

  // --------------------------------------------------------------------------
  //  Bannière : une ou deux hampes de tissu articulées, qui claquent au vent.
  //  `segments = 2` donne un vrai frémissement (pour les grandes bannières) ;
  //  `1` suffit aux fanions décoratifs et coûte moitié moins.
  // --------------------------------------------------------------------------
  function cloth(st, color, len, wid, segments) {
    const kind = st.bannerKind;
    const mtl = R3.mat(color, { rough: 0.75, side: THREE.DoubleSide });
    const holder = new THREE.Group();
    holder.userData.dyn = true;

    const n = Math.max(1, segments || 1);
    const segLen = len / n;
    let parent = holder;
    const links = [];
    for (let i = 0; i < n; i++) {
      const w = (kind === 'triangle' || kind === 'flamme')
        ? wid * (1 - i / (n + 0.6)) : wid;
      const geoSeg = R3.geo.plane(segLen, w);
      const seg = meshOf(geoSeg, mtl, 0, -w * 0, 0);
      seg.rotation.y = PI / 2;             // le plan regarde ±x, la longueur va vers -z
      const pivot = new THREE.Group();
      pivot.position.set(0, 0, i === 0 ? 0 : -segLen);
      seg.position.set(0, 0, -segLen / 2);
      pivot.add(seg);
      parent.add(pivot);
      links.push(pivot);
      parent = pivot;
    }

    // Terminaison propre à chaque style : queue d'aronde, pointe, feuille,
    // flamme ou carré bordé d'or. C'est un détail, mais c'est LE détail qui
    // fait qu'on reconnaît la ville de loin.
    const tipParent = links[links.length - 1];
    if (kind === 'queue') {
      const notch = meshOf(R3.geo.plane(wid * 0.5, wid * 0.34), R3.mat(color, { rough: 0.75, side: THREE.DoubleSide }), 0, 0, -segLen - wid * 0.22);
      notch.rotation.y = PI / 2; notch.rotation.z = PI / 4;
      tipParent.add(notch);
    } else if (kind === 'feuille') {
      const leaf = meshOf(R3.geo.sphere(1, 8), R3.mat(color, { rough: 0.8, side: THREE.DoubleSide }), 0, 0, -segLen - wid * 0.3);
      leaf.scale.set(0.02, wid * 0.45, wid * 0.55);
      tipParent.add(leaf);
    } else if (kind === 'carre') {
      const border = meshOf(R3.geo.plane(segLen * 0.98, wid * 0.16), R3.mat(st.gold, { rough: 0.35, metal: 0.7, side: THREE.DoubleSide }), 0, -wid * 0.42, -segLen / 2);
      border.rotation.y = PI / 2;
      tipParent.add(border);
    } else if (kind === 'flamme') {
      const flame = meshOf(R3.geo.plane(wid * 0.8, wid * 0.5), R3.mat(st.banner2, { rough: 0.7, side: THREE.DoubleSide }), 0, 0, -segLen - wid * 0.3);
      flame.rotation.y = PI / 2;
      tipParent.add(flame);
    }

    reg({ t: 'banner', links: links, root: holder, ph: 0 });
    return holder;
  }

  /** Mât + bannière complète, posé en (x,y,z). `up` = hauteur de la hampe. */
  function bannerPole(st, x, y, z, up, len, color, segments) {
    const g = R3.group(
      cy(0.05, 0.06, up, st.woodDark, 0, up / 2, 0),
      sp(0.09, st.gold, 0, up + 0.06, 0, { metal: 0.7, rough: 0.3 })
    );
    const c = cloth(st, color, len, len * 0.62, segments);
    c.position.set(0, up - len * 0.42, 0);
    g.add(c);
    g.position.set(x, y, z);
    return g;
  }

  /** Petit fanion accroché à un mur (pas de hampe verticale, juste le tissu). */
  function wallBanner(st, x, y, z, len, color) {
    const c = cloth(st, color, len, len * 0.55, 1);
    c.position.set(x, y, z);
    c.rotation.y = 0;
    return c;
  }

  // --------------------------------------------------------------------------
  //  Jets d'eau, braseros, portails, girouettes, cloches, phare.
  // --------------------------------------------------------------------------
  function waterJet(x, y, z, h, r) {
    const m = meshOf(R3.geo.cyl(r * 0.35, r, h, 7), waterMat('fountain'), x, y + h / 2, z);
    m.castShadow = false;
    m.userData.dyn = true;
    reg({ t: 'jet', mesh: m, base: y, h: h, ph: (x * 3.1 + z * 1.7) });
    return m;
  }

  function flame(st, x, y, z, s) {
    const g = new THREE.Group();
    g.userData.dyn = true;
    const f1 = meshOf(R3.geo.cone(0.16 * s, 0.44 * s, 7), R3.mat('#ff6b3d', { emissive: '#ff6b3d', emissiveIntensity: 1.1, rough: 0.4 }), 0, 0.22 * s, 0);
    const f2 = meshOf(R3.geo.cone(0.10 * s, 0.30 * s, 7), R3.mat('#ffd166', { emissive: '#ffd166', emissiveIntensity: 1.3, rough: 0.4 }), 0, 0.20 * s, 0);
    f1.castShadow = false; f2.castShadow = false;
    g.add(f1, f2);
    g.position.set(x, y, z);
    reg({ t: 'flame', g: g, f1: f1, f2: f2, s: s, ph: (x * 2.3 + z * 4.1) });
    return g;
  }

  function brazier(st, x, y, z, s) {
    s = s || 1;
    const g = R3.group(
      cy(0.13 * s, 0.09 * s, 0.7 * s, st.stoneDark, 0, 0.35 * s, 0),
      cy(0.28 * s, 0.16 * s, 0.26 * s, st.stone, 0, 0.82 * s, 0),
      ring(0.28 * s, 0.05 * s, st.gold, 0, 0.94 * s, 0, { metal: 0.7, rough: 0.3 })
    );
    g.add(flame(st, 0, 0.9 * s, 0, s));
    g.position.set(x, y, z);
    return g;
  }

  function lantern(st, x, y, z, s) {
    s = s || 1;
    const g = R3.group(
      cy(0.035, 0.035, 0.22 * s, st.woodDark, 0, 0.11 * s, 0),
      bx(0.20 * s, 0.24 * s, 0.20 * s, '#ffe9b0', 0, -0.12 * s, 0, { glow: 'warm' }),
      cn(0.17 * s, 0.12 * s, st.gold, 0, -0.30 * s, 0, { metal: 0.6, rough: 0.35 })
    );
    g.position.set(x, y, z);
    return g;
  }

  // ==========================================================================
  //  5. TOITS, CRÉNEAUX, ARCHES — les briques d'architecture partagées
  // ==========================================================================

  /** Toit à deux pentes, faîtage selon l'axe X. Renvoie un groupe. */
  function gable(w, d, h, color, dark, y, over) {
    over = (over === undefined) ? 0.14 : over;
    const W = w + over * 2, D = d + over * 2;
    const slant = Math.sqrt((D / 2) * (D / 2) + h * h);
    const a = Math.atan2(h, D / 2);
    const g = R3.group();
    for (let s = -1; s <= 1; s += 2) {
      g.add(rbx(W, 0.10, slant, color, 0, y + h / 2, s * D / 4, s * a, 0, 0));
    }
    g.add(bx(W * 0.99, 0.12, 0.16, dark, 0, y + h + 0.02, 0));      // faîtage
    // Pignons : les triangles de mur sous les pentes, approchés par deux
    // marches — sans eux on voit à travers le toit de profil.
    for (let s = -1; s <= 1; s += 2) {
      g.add(bx(0.14, h * 0.62, d * 0.60, dark, s * w / 2, y + h * 0.31, 0));
    }
    return { g: g, top: y + h + 0.08, slant: slant, angle: a, W: W, D: D };
  }

  /** Toit style — c'est ici que les six villes divergent vraiment. */
  function roofFor(st, w, d, y, opts) {
    opts = opts || {};
    const color = opts.color || st.roof;
    const dark = opts.dark || st.roofDark;
    const g = R3.group();
    const kind = opts.kind || st.roofKind;
    let top = y;

    if (kind === 'plat') {
      // Fournaise : toit-terrasse de basalte, parapet, et une vasque de braise.
      g.add(bx(w + 0.2, 0.22, d + 0.2, dark, 0, y + 0.11, 0));
      for (let s = -1; s <= 1; s += 2) {
        g.add(bx(w + 0.2, 0.34, 0.14, color, 0, y + 0.39, s * (d / 2 + 0.03)));
        g.add(bx(0.14, 0.34, d + 0.2, color, s * (w / 2 + 0.03), y + 0.39, 0));
      }
      top = y + 0.56;
      if (st.braziers && opts.brazier !== false) g.add(brazier(st, 0, y + 0.22, 0, 0.7));
    } else if (kind === 'dome') {
      // Aurore-Cité : tambour de marbre, coupole d'or, flèche étoilée.
      const r = Math.min(w, d) * 0.46;
      g.add(bx(w + 0.16, 0.20, d + 0.16, st.stoneDark, 0, y + 0.10, 0));
      g.add(cy(r * 1.06, r * 1.14, 0.34, st.stone, 0, y + 0.37, 0));
      const dome = el(r * 1.05, r * 0.95, r * 1.05, color, 0, y + 0.52, 0, { metal: 0.65, rough: 0.28, seg: 16 });
      g.add(dome);
      g.add(ring(r * 1.08, 0.05, st.gold, 0, y + 0.54, 0, { metal: 0.8, rough: 0.25 }));
      g.add(cy(0.03, 0.05, 0.5, st.gold, 0, y + 0.52 + r * 0.95 + 0.25, 0, { metal: 0.8, rough: 0.25 }));
      const star = R3.star(5, 0.18, 0.08, 0.05, st.gold, 0, y + 0.52 + r * 0.95 + 0.58, 0, { metal: 0.8, rough: 0.25 });
      tagged(star, st.gold, { metal: 0.8 });
      g.add(star);
      top = y + 0.52 + r * 0.95 + 0.7;
    } else if (kind === 'feuille') {
      // Ambrelune : trois nappes de grandes feuilles superposées, débordantes.
      let yy = y;
      const layers = 3;
      for (let i = 0; i < layers; i++) {
        const k = 1 - i * 0.22;
        const gg = gable(w * k, d * k, 0.34, i % 2 ? dark : color, dark, yy, 0.30 * k);
        g.add(gg.g);
        yy += 0.30;
      }
      // Franges de feuilles qui pendent aux avant-toits.
      for (let s = -1; s <= 1; s += 2) {
        g.add(bx(w * 0.92, 0.16, 0.10, dark, 0, y + 0.02, s * (d / 2 + 0.28)));
      }
      top = yy + 0.24;
    } else {
      // Pignon classique — raide et enneigé à Cimefroide.
      const h = (kind === 'pignon_raide') ? Math.max(w, d) * 0.62 : Math.min(w, d) * 0.42 + 0.2;
      const gg = gable(w, d, h, color, dark, y);
      g.add(gg.g);
      top = gg.top;
      if (st.snowy) {
        for (let s = -1; s <= 1; s += 2) {
          g.add(rbx(gg.W * 0.96, 0.07, gg.slant * 0.72, st.snow, 0, y + h / 2 + 0.10, s * gg.D / 4 - s * gg.slant * 0.06 * Math.sin(gg.angle), s * gg.angle, 0, 0));
        }
      }
      if (st.ropes) {
        // Port-Saphir : filet de cordage tendu sur la pente au vent.
        g.add(rbx(gg.W * 0.9, 0.05, 0.05, st.wood, 0, y + h * 0.55, gg.D * 0.18, 0, 0, 0));
      }
    }
    return { g: g, top: top };
  }

  /** Couronnement de tour, propre à chaque style. */
  function towerCap(st, r, y, opts) {
    opts = opts || {};
    const color = opts.color || st.roof;
    const dark = opts.dark || st.roofDark;
    const kind = opts.kind || st.towerKind;
    const g = R3.group();
    let top = y;
    if (kind === 'dome') {
      g.add(ring(r * 1.05, 0.07, st.gold, 0, y + 0.03, 0, { metal: 0.8, rough: 0.25 }));
      g.add(el(r * 1.02, r * 1.15, r * 1.02, color, 0, y + 0.05, 0, { metal: 0.6, rough: 0.3, seg: 14 }));
      g.add(cy(0.03, 0.045, 0.42, st.gold, 0, y + r * 1.15 + 0.22, 0, { metal: 0.8, rough: 0.25 }));
      top = y + r * 1.15 + 0.44;
    } else if (kind === 'gradins') {
      // Fournaise : couronnement à gradins, une braise au sommet.
      g.add(cy(r * 0.92, r * 1.10, 0.30, dark, 0, y + 0.15, 0));
      g.add(cy(r * 0.66, r * 0.90, 0.26, color, 0, y + 0.43, 0));
      g.add(cy(r * 0.42, r * 0.64, 0.22, dark, 0, y + 0.67, 0));
      g.add(flame(st, 0, y + 0.78, 0, 0.9));
      top = y + 0.9;
    } else if (kind === 'feuille') {
      g.add(cn(r * 1.5, 0.55, dark, 0, y + 0.28, 0, { seg: 8 }));
      g.add(cn(r * 1.15, 0.60, color, 0, y + 0.68, 0, { seg: 8 }));
      g.add(cn(r * 0.8, 0.55, dark, 0, y + 1.05, 0, { seg: 8 }));
      top = y + 1.3;
    } else {
      const hh = (kind === 'cone_haut') ? r * 4.6 : r * 2.8;
      g.add(ring(r * 1.06, 0.07, st.stoneDark, 0, y + 0.02, 0));
      g.add(cn(r * 1.16, hh, color, 0, y + hh / 2 + 0.04, 0, { seg: 10 }));
      if (st.snowy) g.add(cn(r * 0.72, hh * 0.5, st.snow, 0, y + hh * 0.75 + 0.04, 0, { seg: 10 }));
      g.add(sp(0.09, st.gold, 0, y + hh + 0.1, 0, { metal: 0.75, rough: 0.3 }));
      top = y + hh + 0.18;
    }
    return { g: g, top: top };
  }

  /** Créneaux sur le pourtour d'un rectangle. */
  function crenelRect(g, w, d, y, mw, mh, color, step) {
    step = step || (mw * 1.9);
    const nx = Math.max(2, Math.round(w / step));
    const nz = Math.max(2, Math.round(d / step));
    for (let i = 0; i < nx; i++) {
      const x = -w / 2 + (i + 0.5) * (w / nx);
      g.add(bx(mw, mh, mw, color, x, y + mh / 2, -d / 2 + mw / 2));
      g.add(bx(mw, mh, mw, color, x, y + mh / 2, d / 2 - mw / 2));
    }
    for (let j = 1; j < nz - 1; j++) {
      const z = -d / 2 + (j + 0.5) * (d / nz);
      g.add(bx(mw, mh, mw, color, -w / 2 + mw / 2, y + mh / 2, z));
      g.add(bx(mw, mh, mw, color, w / 2 - mw / 2, y + mh / 2, z));
    }
  }

  /** Créneaux sur le pourtour d'une tour ronde. */
  function crenelRing(g, r, y, n, mw, mh, color) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2;
      const m = bx(mw, mh, mw * 0.8, color, Math.cos(a) * r, y + mh / 2, Math.sin(a) * r);
      m.rotation.y = -a;
      g.add(m);
    }
  }

  /** Herse : grille de fer relevée sous l'arche (elle ne bloque jamais le passage). */
  function portcullis(w, h, y, z, color) {
    const g = R3.group();
    const bars = Math.max(3, Math.round(w / 0.22));
    for (let i = 0; i < bars; i++) {
      const x = -w / 2 + (i + 0.5) * (w / bars);
      g.add(bx(0.06, h, 0.06, color, x, y - h / 2, z, { metal: 0.75, rough: 0.35 }));
    }
    g.add(bx(w, 0.08, 0.09, color, 0, y - h * 0.25, z, { metal: 0.75, rough: 0.35 }));
    g.add(bx(w, 0.08, 0.09, color, 0, y - h * 0.75, z, { metal: 0.75, rough: 0.35 }));
    // Pointes du bas : la herse a des dents, c'est ce qui la rend menaçante.
    for (let i = 0; i < bars; i++) {
      const x = -w / 2 + (i + 0.5) * (w / bars);
      g.add(cn(0.05, 0.14, color, x, y - h - 0.07, z, { metal: 0.75, rough: 0.35, seg: 5 }));
    }
    return g;
  }

  /** Arche en plein cintre approchée par des claveaux — bien plus riche qu'un
   *  simple linteau, et ça ne coûte que quelques boîtes. */
  function archTop(g, w, y, z, depth, color, steps) {
    steps = steps || 5;
    const r = w / 2;
    for (let i = 0; i < steps; i++) {
      const a = (i + 0.5) / steps * PI;
      const x = -Math.cos(a) * r;
      const yy = y + Math.sin(a) * r * 0.55;
      const b = bx(w / steps * 1.25, 0.22, depth, color, x, yy, z);
      b.rotation.z = -Math.cos(a) * 0.55;
      g.add(b);
    }
  }

  /** Fenêtres éclairées alignées sur une façade (vers +z par défaut). */
  function windows(g, st, n, y, z, w, h, spread, glow) {
    for (let i = 0; i < n; i++) {
      const x = (n === 1) ? 0 : -spread / 2 + i * (spread / (n - 1));
      g.add(bx(w + 0.08, h + 0.08, 0.06, st.stoneDark, x, y, z - 0.02));
      g.add(bx(w, h, 0.06, glow === false ? st.glass : '#ffe9b0', x, y, z + 0.02, glow === false ? undefined : { glow: 'warm' }));
    }
  }

  /** Socle sur pilotis (Ambrelune) ou marches (Aurore) selon le style. */
  function podium(g, st, w, d, y) {
    if (st.pilotis) {
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          g.add(cy(0.11, 0.13, y + 0.5, st.wood, sx * (w / 2 - 0.25), (y + 0.5) / 2, sz * (d / 2 - 0.25)));
        }
      }
      g.add(bx(w + 0.24, 0.16, d + 0.24, st.woodDark, 0, y + 0.42, 0));
      return y + 0.5;
    }
    if (st.gilded) {
      g.add(bx(w + 0.5, 0.16, d + 0.5, st.stoneDark, 0, 0.08, 0));
      g.add(bx(w + 0.28, 0.16, d + 0.28, st.stone, 0, 0.24, 0));
      return 0.32;
    }
    g.add(bx(w + 0.22, 0.24, d + 0.22, st.stoneDark, 0, 0.12, 0));
    return 0.24;
  }

  // ==========================================================================
  //  6. LES MONUMENTS
  // ==========================================================================

  // --------------------------------------------------------------------------
  //  REMPART — ≤ 12 meshes. C'est le budget le plus serré du fichier : il y en
  //  aura des centaines. La section est SYMÉTRIQUE (créneaux des deux côtés,
  //  chemin de ronde au milieu) : elle reste juste quelle que soit
  //  l'orientation du mur, même si l'appelant ne fournit pas opts.dir.
  // --------------------------------------------------------------------------
  function buildWall(st, o, g) {
    const H = 3.0 * o.hs;
    const t = 0.86;
    g.add(bx(1.02, 0.36, t + 0.14, st.stoneDark, 0, 0.18, 0));          // 1 socle
    g.add(bx(1.02, H - 0.7, t, st.stone, 0, 0.36 + (H - 0.7) / 2, 0));  // 2 mur
    g.add(bx(1.04, 0.14, t + 0.12, st.stoneDark, 0, H - 0.34, 0));      // 3 cordon
    g.add(bx(1.02, 0.16, t - 0.34, st.ground, 0, H - 0.19, 0));         // 4 chemin de ronde
    // 5..10 — trois merlons de chaque côté
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 3; i++) {
        g.add(bx(0.24, 0.46, 0.17, st.stone, -0.34 + i * 0.34, H + 0.12, s * (t / 2 - 0.09)));
      }
    }
    // 11 — la touche de style : neige, lave, mousse ou cordage.
    if (st.snowy) g.add(bx(1.02, 0.07, t + 0.14, st.snow, 0, H + 0.38, 0));
    else if (st.braziers) g.add(bx(1.02, 0.09, 0.10, st.lava, 0, H - 0.62, t / 2 + 0.02, { glow: 'warm' }));
    else if (st.pilotis) g.add(bx(1.02, 0.12, 0.10, st.roof, 0, H - 0.55, t / 2 + 0.03));
    else if (st.ropes) g.add(bx(1.02, 0.07, 0.08, st.wood, 0, H - 0.72, t / 2 + 0.02));
    else if (st.gilded) g.add(bx(1.02, 0.08, t + 0.14, st.gold, 0, H - 0.52, 0, { metal: 0.75, rough: 0.3 }));
    else g.add(bx(0.5, 0.10, 0.10, st.roof, 0.1, H - 0.8, t / 2 + 0.02));   // lierre / bandeau peint
  }

  // --------------------------------------------------------------------------
  //  TOUR DE REMPART — plus haute que le mur, elle rythme l'enceinte.
  // --------------------------------------------------------------------------
  function buildWallTower(st, o, g, big) {
    const r = big ? 0.72 : 0.60;
    const H = (big ? 5.6 : 4.4) * o.hs;
    g.add(cy(r * 1.18, r * 1.34, 0.4, st.stoneDark, 0, 0.2, 0, { seg: 12 }));
    g.add(cy(r, r * 1.1, H - 0.4, st.stone, 0, 0.4 + (H - 0.4) / 2, 0, { seg: 12 }));
    g.add(ring(r * 1.12, 0.09, st.stoneDark, 0, H - 0.1, 0, { seg: 12 }));
    crenelRing(g, r * 1.02, H, 8, 0.2, 0.4, st.stone);
    // Meurtrières lumineuses : de nuit comme de jour, la tour est habitée.
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      g.add(bx(0.1, 0.34, 0.1, '#ffe9b0', Math.cos(a) * r * 1.02, H * 0.55, Math.sin(a) * r * 1.02, { glow: 'warm' }));
    }
    const cap = towerCap(st, r * 0.96, H + 0.42);
    g.add(cap.g);
    g.add(bannerPole(st, 0, cap.top, 0, 0.9, 0.62, st.banner, 1));
    return cap.top;
  }

  // --------------------------------------------------------------------------
  //  PORTE MONUMENTALE — c'est par là qu'on entre vraiment dans la ville.
  //  Quatre piliers d'angle et quatre arches : le passage est ouvert dans LES
  //  DEUX axes, donc la porte reste juste même si l'appelant ignore opts.dir.
  //  La herse est relevée — jamais de blocage pour le joueur.
  // --------------------------------------------------------------------------
  function buildGate(st, o, g, castle) {
    const H = (castle ? 5.4 : 6.2) * o.hs;
    const p = 0.30;                        // demi-largeur d'un pilier
    const c = 0.42;                        // écart des piliers au centre
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        g.add(bx(p * 2, H * 0.62, p * 2, st.stone, sx * c, H * 0.31, sz * c));
      }
    }
    // Arches sur les quatre faces.
    for (let axis = 0; axis < 2; axis++) {
      for (let s = -1; s <= 1; s += 2) {
        const sub = R3.group();
        archTop(sub, 0.86, H * 0.62, 0, 0.34, st.stoneDark, 4);
        sub.position.set(axis === 0 ? 0 : s * c, 0, axis === 0 ? s * c : 0);
        sub.rotation.y = axis === 0 ? 0 : PI / 2;
        g.add(sub);
      }
    }
    // Chambre de la herse + couronnement.
    g.add(bx(1.02, 0.5, 1.02, st.stone, 0, H * 0.62 + 0.55, 0));
    g.add(bx(1.14, 0.16, 1.14, st.stoneDark, 0, H * 0.62 + 0.86, 0));
    g.add(bx(0.9, 0.5, 0.9, st.stone, 0, H * 0.62 + 1.18, 0));
    crenelRect(g, 1.1, 1.1, H * 0.62 + 1.42, 0.17, 0.34, st.stone, 0.34);
    // Herse relevée, dents visibles sous la voûte.
    g.add(portcullis(0.74, 0.44, H * 0.62 - 0.06, 0, '#6b7076'));
    // Écusson de la ville + bannières de part et d'autre.
    g.add(bx(0.34, 0.4, 0.08, st.banner, 0, H * 0.62 + 0.55, c + p + 0.02));
    g.add(bx(0.42, 0.08, 0.08, st.gold, 0, H * 0.62 + 0.33, c + p + 0.02, { metal: 0.75, rough: 0.3 }));
    if (!castle) {
      for (let s = -1; s <= 1; s += 2) {
        g.add(bannerPole(st, s * (c + p * 0.4), H * 0.62 + 0.9, 0, 1.1, 0.8, s > 0 ? st.banner : st.banner2, 2));
      }
      if (st.lanterns) { g.add(lantern(st, 0.5, H * 0.55, 0.5, 1)); g.add(lantern(st, -0.5, H * 0.55, -0.5, 1)); }
      if (st.braziers) { g.add(brazier(st, 0.52, 0, 0.52, 0.85)); g.add(brazier(st, -0.52, 0, -0.52, 0.85)); }
    }
  }

  // --------------------------------------------------------------------------
  //  LE CHÂTEAU — le monument qui doit faire dire « waouh ».
  //  Donjon central, quatre tours à toits pointus, créneaux, herse, bannières
  //  qui flottent, fenêtres éclairées. Jusqu'à 16 unités de haut.
  // --------------------------------------------------------------------------
  function buildCastle(st, o, g) {
    const W = o.W, D = o.D;
    const hs = o.hs;
    const wallH = 3.2 * hs;
    const th = 0.62;

    // --- Motte et cour ------------------------------------------------------
    g.add(bx(W, 0.42, D, st.stoneDark, 0, 0.21, 0));
    g.add(bx(W - 1.3, 0.12, D - 1.3, st.ground, 0, 0.46, 0));

    // --- Courtine ----------------------------------------------------------
    const gw = 1.5;                                   // largeur de la porte
    g.add(bx(W, wallH, th, st.stone, 0, 0.42 + wallH / 2, -D / 2 + th / 2));           // arrière
    for (let s = -1; s <= 1; s += 2) {
      g.add(bx(th, wallH, D, st.stone, s * (W / 2 - th / 2), 0.42 + wallH / 2, 0));    // côtés
      g.add(bx((W - gw) / 2, wallH, th, st.stone, s * (W + gw) / 4, 0.42 + wallH / 2, D / 2 - th / 2));
    }
    g.add(bx(gw, wallH * 0.34, th, st.stone, 0, 0.42 + wallH * 0.83, D / 2 - th / 2)); // linteau
    archTop(g, gw, 0.42 + wallH * 0.62, D / 2 - th / 2, th + 0.06, st.stoneDark, 5);
    g.add(portcullis(gw * 0.78, 0.7, 0.42 + wallH * 0.63, D / 2 - th / 2, '#6b7076'));
    crenelRect(g, W, D, 0.42 + wallH, 0.22, 0.44, st.stone, 0.95);
    // Bandeau de style le long de la courtine.
    if (st.gilded) g.add(bx(W + 0.04, 0.12, th + 0.06, st.gold, 0, 0.42 + wallH * 0.72, D / 2 - th / 2, { metal: 0.8, rough: 0.28 }));
    if (st.snowy) g.add(bx(W + 0.06, 0.08, th + 0.08, st.snow, 0, 0.42 + wallH + 0.46, 0));

    // --- Quatre tours d'angle ----------------------------------------------
    const tr = 0.82;
    const tops = [];
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        const t = new THREE.Group();
        const H = (5.6 + (sz > 0 ? 0.9 : 0)) * hs;    // les tours de façade sont plus hautes
        t.add(cy(tr * 1.16, tr * 1.3, 0.42, st.stoneDark, 0, 0.21, 0, { seg: 12 }));
        t.add(cy(tr, tr * 1.1, H, st.stone, 0, 0.42 + H / 2, 0, { seg: 12 }));
        t.add(ring(tr * 1.14, 0.1, st.stoneDark, 0, 0.42 + H, 0, { seg: 12 }));
        t.add(bx(0.14, 0.42, 0.12, '#ffe9b0', 0, 0.42 + H * 0.6, tr * 1.02, { glow: 'warm' }));
        const cap = towerCap(st, tr * 0.98, 0.42 + H + 0.12);
        t.add(cap.g);
        t.add(bannerPole(st, 0, cap.top, 0, 1.0, 0.7, sz > 0 ? st.banner : st.banner2, 1));
        t.position.set(sx * (W / 2 - tr * 0.5), 0, sz * (D / 2 - tr * 0.5));
        g.add(t);
        tops.push(cap.top);
      }
    }

    // --- Le donjon ----------------------------------------------------------
    const kw = Math.min(4.4, W * 0.42), kd = Math.min(3.8, D * 0.5);
    const kh = 7.6 * hs;
    const kz = -D * 0.12;
    const K = new THREE.Group();
    K.add(bx(kw + 0.4, 0.5, kd + 0.4, st.stoneDark, 0, 0.25, 0));
    K.add(bx(kw, kh, kd, st.stone, 0, 0.5 + kh / 2, 0));
    // Contreforts : ce sont eux qui donnent au donjon sa masse.
    for (let sx = -1; sx <= 1; sx += 2) {
      K.add(bx(0.3, kh * 0.86, 0.3, st.stoneDark, sx * (kw / 2 - 0.02), 0.5 + kh * 0.43, kd / 2 - 0.02));
      K.add(bx(0.3, kh * 0.86, 0.3, st.stoneDark, sx * (kw / 2 - 0.02), 0.5 + kh * 0.43, -kd / 2 + 0.02));
    }
    // Fenêtres éclairées, deux rangs.
    windows(K, st, 3, 0.5 + kh * 0.42, kd / 2 + 0.02, 0.22, 0.42, kw * 0.62);
    windows(K, st, 3, 0.5 + kh * 0.72, kd / 2 + 0.02, 0.22, 0.42, kw * 0.62);
    // Grande rosace / horloge sur la face avant.
    K.add(ring(0.34, 0.07, st.gold, 0, 0.5 + kh * 0.9, kd / 2 + 0.03, { metal: 0.8, rough: 0.28 }));
    K.add(bx(0.5, 0.5, 0.05, st.glass, 0, 0.5 + kh * 0.9, kd / 2 + 0.01, { glow: 'warm' }));
    // Mâchicoulis + créneaux.
    K.add(bx(kw + 0.44, 0.34, kd + 0.44, st.stoneDark, 0, 0.5 + kh + 0.17, 0));
    crenelRect(K, kw + 0.44, kd + 0.44, 0.5 + kh + 0.34, 0.22, 0.44, st.stone, 0.8);
    // Étage sommital + toiture de style + flèche.
    const upY = 0.5 + kh + 0.34;
    K.add(bx(kw * 0.66, 1.5 * hs, kd * 0.66, st.stone, 0, upY + 0.75 * hs, 0));
    const rf = roofFor(st, kw * 0.66, kd * 0.66, upY + 1.5 * hs, { brazier: false });
    K.add(rf.g);
    const spireBase = rf.top;
    K.add(cy(0.26, 0.34, 1.1 * hs, st.stone, 0, spireBase + 0.55 * hs, 0, { seg: 10 }));
    K.add(cn(0.42, 2.0 * hs, st.roof, 0, spireBase + 1.1 * hs + 1.0 * hs, 0, { seg: 10 }));
    if (st.snowy) K.add(cn(0.26, 1.0 * hs, st.snow, 0, spireBase + 1.1 * hs + 1.5 * hs, 0, { seg: 10 }));
    const finY = spireBase + 1.1 * hs + 2.0 * hs;
    K.add(sp(0.16, st.gold, 0, finY + 0.1, 0, { metal: 0.8, rough: 0.25 }));
    K.add(bannerPole(st, 0, finY + 0.2, 0, 1.5, 1.15, st.banner, 2));
    K.position.set(0, 0, kz);
    g.add(K);

    // --- Bannières de façade et détails de style ---------------------------
    for (let s = -1; s <= 1; s += 2) {
      const b = wallBanner(st, s * gw * 0.86, 0.42 + wallH * 0.52, D / 2 + 0.06, 1.5, s > 0 ? st.banner : st.banner2);
      b.rotation.z = -PI / 2;   // le tissu pend le long du mur
      g.add(b);
    }
    if (st.braziers) {
      g.add(brazier(st, gw * 0.72, 0.42, D / 2 + 0.5, 1));
      g.add(brazier(st, -gw * 0.72, 0.42, D / 2 + 0.5, 1));
      g.add(bx(W - 1.6, 0.08, 0.34, st.lava, 0, 0.5, D * 0.22, { glow: 'warm' }));
    }
    if (st.lanterns) {
      g.add(lantern(st, gw * 0.72, 0.42 + wallH * 0.8, D / 2 + 0.2, 1.2));
      g.add(lantern(st, -gw * 0.72, 0.42 + wallH * 0.8, D / 2 + 0.2, 1.2));
    }
    if (st.ropes) {
      for (let s = -1; s <= 1; s += 2) {
        g.add(rbx(0.05, 0.05, D * 0.9, st.wood, s * (W / 2 - 0.3), 0.42 + wallH + 0.5, 0, 0.06, 0, 0));
      }
    }
    if (st.flowers) {
      for (let s = -1; s <= 1; s += 2) g.add(bx(0.5, 0.14, 0.16, st.roof, s * 1.4, 0.42 + wallH * 0.55, D / 2 + 0.06));
    }
    if (st.gilded) {
      for (let s = -1; s <= 1; s += 2) {
        const st1 = R3.star(5, 0.2, 0.09, 0.05, st.gold, s * 1.5, 0.42 + wallH * 0.8, D / 2 + 0.05, { metal: 0.8, rough: 0.28 });
        tagged(st1, st.gold, { metal: 0.8 });
        g.add(st1);
      }
    }
  }

  // --------------------------------------------------------------------------
  //  L'ÉGLISE — nef, clocher pointu, rosace, contreforts, cloche visible.
  // --------------------------------------------------------------------------
  function buildChurch(st, o, g) {
    const W = o.W, D = o.D, hs = o.hs;
    const navW = Math.min(W * 0.62, 4.2), navD = D - 0.6;
    const navH = 3.4 * hs;

    const baseY = podium(g, st, navW, navD, 0);
    g.add(bx(navW, navH, navD, st.stone, 0, baseY + navH / 2, 0));

    // Bas-côtés : ils élargissent la nef et donnent son profil d'église.
    for (let s = -1; s <= 1; s += 2) {
      g.add(bx(0.7, navH * 0.62, navD * 0.9, st.stoneDark, s * (navW / 2 + 0.33), baseY + navH * 0.31, 0));
      const rf = roofFor(st, 0.9, navD * 0.9, baseY + navH * 0.62, { kind: st.roofKind === 'dome' ? 'pignon' : st.roofKind });
      rf.g.position.x = s * (navW / 2 + 0.33);
      g.add(rf.g);
    }
    // Contreforts.
    for (let s = -1; s <= 1; s += 2) {
      for (let i = -1; i <= 1; i++) {
        g.add(bx(0.24, navH * 0.8, 0.34, st.stoneDark, s * (navW / 2 + 0.66), baseY + navH * 0.4, i * navD * 0.3));
      }
    }
    // Toit de la nef.
    const nav = roofFor(st, navW, navD, baseY + navH);
    g.add(nav.g);

    // Abside arrondie à l'arrière.
    g.add(cy(navW * 0.42, navW * 0.46, navH * 0.9, st.stone, 0, baseY + navH * 0.45, -navD / 2 - navW * 0.2, { seg: 12 }));
    g.add(cn(navW * 0.5, 1.1, st.roof, 0, baseY + navH * 0.9 + 0.55, -navD / 2 - navW * 0.2, { seg: 12 }));

    // Façade : portail en arche, rosace, statues de saints.
    const fz = navD / 2 + 0.02;
    g.add(bx(1.0, 1.5, 0.14, st.woodDark, 0, baseY + 0.75, fz));
    archTop(g, 1.16, baseY + 1.5, fz, 0.18, st.stoneDark, 5);
    g.add(ring(0.46, 0.09, st.stoneDark, 0, baseY + navH * 0.72, fz + 0.02));
    g.add(bx(0.78, 0.78, 0.05, '#ffd9f0', 0, baseY + navH * 0.72, fz, { glow: 'warm' }));
    for (let i = 0; i < 4; i++) {
      const spoke = bx(0.06, 0.86, 0.06, st.stoneDark, 0, baseY + navH * 0.72, fz + 0.04);
      spoke.rotation.z = i * PI / 4;                 // meneaux de la rosace
      g.add(spoke);
    }
    windows(g, st, 3, baseY + navH * 0.42, navW / 2 + 0.36 + 0.02, 0.2, 0.55, navD * 0.6);

    // --- Le clocher ---------------------------------------------------------
    const tw = 1.5, th = 5.6 * hs;
    const T = new THREE.Group();
    T.add(bx(tw + 0.24, 0.4, tw + 0.24, st.stoneDark, 0, 0.2, 0));
    T.add(bx(tw, th, tw, st.stone, 0, 0.4 + th / 2, 0));
    for (let s = -1; s <= 1; s += 2) {
      T.add(bx(0.18, th * 0.9, 0.18, st.stoneDark, s * tw / 2, 0.4 + th * 0.45, tw / 2));
      T.add(bx(0.18, th * 0.9, 0.18, st.stoneDark, s * tw / 2, 0.4 + th * 0.45, -tw / 2));
    }
    T.add(bx(0.3, 0.7, 0.05, '#ffe9b0', 0, 0.4 + th * 0.45, tw / 2 + 0.02, { glow: 'warm' }));
    // Beffroi ouvert : quatre piliers, la cloche est VISIBLE au milieu.
    const by = 0.4 + th;
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        T.add(bx(0.24, 1.2, 0.24, st.stone, sx * (tw / 2 - 0.12), by + 0.6, sz * (tw / 2 - 0.12)));
      }
    }
    T.add(bx(tw + 0.3, 0.22, tw + 0.3, st.stoneDark, 0, by + 1.31, 0));
    const bell = new THREE.Group();
    bell.userData.dyn = true;
    const bellMat = R3.mat(st.gold, { metal: 0.85, rough: 0.28 });
    const bm = meshOf(R3.geo.cyl(0.14, 0.28, 0.4, 10), bellMat, 0, -0.2, 0);
    const bt = meshOf(R3.geo.sphere(0.07, 8), bellMat, 0, -0.42, 0);
    bell.add(bm, bt);
    bell.position.set(0, by + 1.18, 0);
    T.add(bell);
    reg({ t: 'bell', g: bell, ph: 0 });
    // Flèche.
    const cap = towerCap(st, tw * 0.62, by + 1.42, { kind: st.towerKind === 'dome' ? 'dome' : (st.towerKind === 'feuille' ? 'feuille' : 'cone_haut') });
    T.add(cap.g);
    T.add(bannerPole(st, 0, cap.top, 0, 0.7, 0.5, st.banner, 1));
    T.position.set(-(navW / 2 + 0.95), 0, navD * 0.24);
    g.add(T);

    // Touches de style au pied de l'église.
    if (st.lanterns) { g.add(lantern(st, 0.9, baseY + 1.9, fz + 0.1, 1)); g.add(lantern(st, -0.9, baseY + 1.9, fz + 0.1, 1)); }
    if (st.braziers) { g.add(brazier(st, 1.0, baseY, fz + 0.5, 0.9)); g.add(brazier(st, -1.0, baseY, fz + 0.5, 0.9)); }
    if (st.snowy) g.add(bx(navW + 0.8, 0.07, 0.5, st.snow, 0, baseY + 0.02, fz + 0.3));
    for (let s = -1; s <= 1; s += 2) {
      g.add(bannerPole(st, s * (navW / 2 + 0.2), baseY, fz + 0.45, 2.2, 0.9, s > 0 ? st.banner : st.banner2, 2));
    }
  }

  // --------------------------------------------------------------------------
  //  CLOCHER SEUL (tuile CHURCH_TOWER isolée)
  // --------------------------------------------------------------------------
  function buildChurchTower(st, o, g) {
    const tw = 0.92, th = 5.2 * o.hs;
    g.add(bx(tw + 0.2, 0.36, tw + 0.2, st.stoneDark, 0, 0.18, 0));
    g.add(bx(tw, th, tw, st.stone, 0, 0.36 + th / 2, 0));
    g.add(bx(0.22, 0.6, 0.05, '#ffe9b0', 0, 0.36 + th * 0.5, tw / 2 + 0.01, { glow: 'warm' }));
    const by = 0.36 + th;
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        g.add(bx(0.18, 0.9, 0.18, st.stone, sx * (tw / 2 - 0.09), by + 0.45, sz * (tw / 2 - 0.09)));
      }
    }
    g.add(bx(tw + 0.22, 0.18, tw + 0.22, st.stoneDark, 0, by + 0.99, 0));
    const cap = towerCap(st, tw * 0.6, by + 1.08, { kind: 'cone_haut' });
    g.add(cap.g);
  }

  // --------------------------------------------------------------------------
  //  MAISON DE VILLE — instanciée des centaines de fois : ≤ 12 meshes, une
  //  seule famille de matériau, aucune fenêtre émissive (ce serait un second
  //  draw call par maison, multiplié par trois cents).
  // --------------------------------------------------------------------------
  function buildTownhouse(st, o, g) {
    const r = o.rnd;
    const w = 0.86, d = 0.82;
    const h = (1.5 + r() * 0.9) * o.hs;
    const roofC = o.roof || st.roof;
    const baseY = st.pilotis ? 0.42 : 0.06;
    if (st.pilotis) {
      // Ambrelune : la maison est perchée sur quatre pieux.
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) g.add(cy(0.07, 0.08, baseY + 0.1, st.woodDark, sx * 0.3, (baseY + 0.1) / 2, sz * 0.28));
      }
    } else {
      g.add(bx(w + 0.12, 0.14, d + 0.12, st.stoneDark, 0, 0.07, 0));
    }
    g.add(bx(w, h, d, st.wall, 0, baseY + h / 2, 0));
    // Décor de façade propre au style — un seul mesh, mais il change tout.
    if (st.colombage) {
      g.add(bx(w + 0.02, 0.1, d + 0.02, st.woodDark, 0, baseY + h * 0.55, 0));
    } else if (st.gilded) {
      g.add(bx(w + 0.02, 0.08, d + 0.02, st.gold, 0, baseY + h * 0.78, 0, { metal: 0.7, rough: 0.32 }));
    } else {
      g.add(bx(w + 0.02, 0.09, d + 0.02, st.stoneDark, 0, baseY + h * 0.62, 0));
    }
    g.add(bx(0.2, 0.36, 0.05, st.woodDark, 0, baseY + 0.19, d / 2 + 0.01));       // porte
    g.add(bx(0.2, 0.2, 0.05, st.glass, -0.24, baseY + h * 0.68, d / 2 + 0.01));   // fenêtre
    g.add(bx(0.2, 0.2, 0.05, st.glass, 0.24, baseY + h * 0.68, d / 2 + 0.01));
    // Toit : la forme dit la ville.
    const rf = roofFor(st, w, d, baseY + h, { color: roofC, dark: st.roofDark, brazier: false });
    g.add(rf.g);
    if (!st.pilotis && st.roofKind !== 'plat') g.add(bx(0.14, 0.42, 0.14, st.stoneDark, 0.26, rf.top - 0.05, -0.1)); // cheminée
    return rf.top;
  }

  // --------------------------------------------------------------------------
  //  MANOIR — la maison des notables : deux corps, une tourelle, un perron.
  // --------------------------------------------------------------------------
  function buildManor(st, o, g) {
    const W = Math.max(2.2, o.W - 0.5), D = Math.max(2.0, o.D - 0.5), hs = o.hs;
    const h = 2.6 * hs;
    const baseY = podium(g, st, W, D, 0);
    g.add(bx(W, h, D, st.wall, 0, baseY + h / 2, 0));
    g.add(bx(W + 0.05, 0.12, D + 0.05, st.colombage ? st.woodDark : st.stoneDark, 0, baseY + h * 0.52, 0));
    const rf = roofFor(st, W, D, baseY + h, { color: o.roof || st.roof });
    g.add(rf.g);
    // Aile latérale plus basse.
    const aw = W * 0.45, ah = h * 0.68;
    g.add(bx(aw, ah, D * 0.7, st.wall, -(W / 2 + aw / 2 - 0.05), baseY + ah / 2, D * 0.1));
    const rf2 = roofFor(st, aw, D * 0.7, baseY + ah, { color: o.roof || st.roof, brazier: false });
    rf2.g.position.set(-(W / 2 + aw / 2 - 0.05), 0, D * 0.1);
    g.add(rf2.g);
    // Tourelle d'angle : c'est elle qui fait « manoir » et pas « grosse maison ».
    const T = new THREE.Group();
    const tr = 0.4, tH = h * 1.35;
    T.add(cy(tr, tr * 1.1, tH, st.stone, 0, baseY + tH / 2, 0, { seg: 10 }));
    T.add(bx(0.16, 0.4, 0.05, '#ffe9b0', 0, baseY + tH * 0.62, tr, { glow: 'warm' }));
    const cap = towerCap(st, tr, baseY + tH, { kind: st.towerKind === 'gradins' ? 'gradins' : (st.towerKind === 'dome' ? 'dome' : 'cone') });
    T.add(cap.g);
    T.position.set(W / 2 - 0.1, 0, D / 2 - 0.1);
    g.add(T);
    // Perron et fenêtres.
    g.add(bx(0.9, 0.16, 0.5, st.stoneDark, 0, baseY + 0.08, D / 2 + 0.22));
    g.add(bx(0.44, 0.8, 0.06, st.woodDark, 0, baseY + 0.4, D / 2 + 0.02));
    windows(g, st, 3, baseY + h * 0.68, D / 2 + 0.02, 0.24, 0.4, W * 0.62);
    if (st.lanterns) { g.add(lantern(st, 0.5, baseY + 1.4, D / 2 + 0.12, 0.9)); g.add(lantern(st, -0.5, baseY + 1.4, D / 2 + 0.12, 0.9)); }
    g.add(bannerPole(st, -W / 2 + 0.2, baseY + h, D / 2 - 0.1, 0.9, 0.55, st.banner2, 1));
  }

  // --------------------------------------------------------------------------
  //  ÉTAL DE MARCHÉ — petit, coloré, avec sa bâche rayée.
  // --------------------------------------------------------------------------
  function buildStall(st, o, g) {
    const c = o.roof || st.banner2;
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) g.add(cy(0.035, 0.035, 0.9, st.wood, sx * 0.38, 0.45, sz * 0.3));
    }
    g.add(bx(0.9, 0.1, 0.7, st.wood, 0, 0.62, 0));                     // étal
    g.add(bx(0.86, 0.34, 0.06, st.woodDark, 0, 0.4, 0.32));            // devanture
    // Bâche à deux pentes, rayée grâce à deux couleurs alternées.
    for (let s = -1; s <= 1; s += 2) {
      g.add(rbx(0.96, 0.05, 0.46, c, 0, 1.02, s * 0.18, s * 0.6, 0, 0));
      g.add(rbx(0.30, 0.05, 0.46, '#f4f4f4', s * 0.3, 1.03, s * 0.18, s * 0.6, 0, 0));
    }
    // Marchandises.
    g.add(bx(0.18, 0.16, 0.16, st.roof, -0.24, 0.75, -0.05));
    g.add(sp(0.09, '#ff6b9d', 0.05, 0.76, -0.02));
    g.add(sp(0.09, '#f1c40f', 0.24, 0.76, 0.02));
  }

  // --------------------------------------------------------------------------
  //  LA GRANDE FONTAINE — bassin, vasques étagées, jets d'eau animés.
  // --------------------------------------------------------------------------
  function buildFountain(st, o, g) {
    const R = Math.max(1.0, Math.min(o.W, o.D) * 0.44);
    g.add(cy(R + 0.16, R + 0.24, 0.2, st.stoneDark, 0, 0.1, 0, { seg: 20 }));
    g.add(cy(R, R + 0.1, 0.46, st.stone, 0, 0.33, 0, { seg: 20 }));
    g.add(ring(R, 0.1, st.trim, 0, 0.55, 0, { seg: 20 }));
    // Nappe d'eau du bassin (matériau de water3d si présent).
    const pond = meshOf(R3.geo.cyl(R - 0.1, R - 0.1, 0.06, 20), waterMat('pond'), 0, 0.5, 0);
    pond.castShadow = false;
    g.add(pond);
    // Pied et vasques étagées.
    g.add(cy(0.24, 0.34, 0.9, st.stone, 0, 0.95, 0, { seg: 12 }));
    g.add(cy(R * 0.62, R * 0.5, 0.16, st.stone, 0, 1.46, 0, { seg: 16 }));
    const pond2 = meshOf(R3.geo.cyl(R * 0.56, R * 0.56, 0.05, 16), waterMat('pond'), 0, 1.55, 0);
    pond2.castShadow = false;
    g.add(pond2);
    g.add(cy(0.15, 0.2, 0.72, st.stone, 0, 1.9, 0, { seg: 10 }));
    g.add(cy(R * 0.34, R * 0.26, 0.13, st.stone, 0, 2.32, 0, { seg: 14 }));
    // Couronnement : une créature de pierre selon le style.
    if (st.gilded) {
      g.add(el(0.2, 0.26, 0.2, st.gold, 0, 2.62, 0, { metal: 0.8, rough: 0.28 }));
      const s5 = R3.star(6, 0.24, 0.1, 0.06, st.gold, 0, 2.98, 0, { metal: 0.8, rough: 0.28 });
      tagged(s5, st.gold, { metal: 0.8 }); g.add(s5);
    } else {
      g.add(el(0.2, 0.24, 0.24, st.trim, 0, 2.6, 0));
      g.add(cn(0.13, 0.34, st.trim, 0, 2.9, 0, { seg: 8 }));
    }
    // Jets : un central et quatre en couronne.
    g.add(waterJet(0, 2.42, 0, 0.7, 0.06));
    for (let i = 0; i < 4; i++) {
      const a = i * PI / 2 + PI / 4;
      g.add(waterJet(Math.cos(a) * R * 0.55, 1.6, Math.sin(a) * R * 0.55, 0.5, 0.045));
      g.add(bx(0.12, 0.12, 0.12, st.stoneDark, Math.cos(a) * R * 0.55, 1.58, Math.sin(a) * R * 0.55));
    }
    if (st.lanterns) for (let i = 0; i < 4; i++) { const a = i * PI / 2; g.add(lantern(st, Math.cos(a) * (R + 0.35), 1.3, Math.sin(a) * (R + 0.35), 1)); }
    if (st.snowy) g.add(ring(R + 0.2, 0.09, st.snow, 0, 0.21, 0, { seg: 20 }));
    if (st.braziers) for (let i = 0; i < 2; i++) g.add(brazier(st, (i ? 1 : -1) * (R + 0.4), 0, 0, 0.9));
  }

  // --------------------------------------------------------------------------
  //  STATUE — un héros sur son socle, avec un attribut propre à la ville.
  // --------------------------------------------------------------------------
  function buildStatue(st, o, g) {
    const c = st.gilded ? st.gold : st.trim;
    const mo = st.gilded ? { metal: 0.75, rough: 0.3 } : undefined;
    g.add(bx(0.9, 0.24, 0.9, st.stoneDark, 0, 0.12, 0));
    g.add(bx(0.7, 0.7, 0.7, st.stone, 0, 0.59, 0));
    g.add(bx(0.8, 0.1, 0.8, st.stoneDark, 0, 0.99, 0));
    g.add(bx(0.4, 0.14, 0.06, st.gold, 0, 0.62, 0.36, { metal: 0.75, rough: 0.3 }));   // plaque gravée
    g.add(el(0.17, 0.3, 0.14, c, 0, 1.36, 0, mo));                                     // buste
    g.add(sp(0.14, c, 0, 1.74, 0, mo));                                                // tête
    g.add(el(0.06, 0.24, 0.06, c, -0.22, 1.36, 0.02, mo));                             // bras
    g.add(el(0.06, 0.24, 0.06, c, 0.22, 1.42, 0.02, mo));
    g.add(el(0.24, 0.3, 0.1, c, 0, 1.36, -0.14, mo));                                  // cape
    // Attribut : bâton, ancre, torche, lance de glace ou étoile.
    if (st.ropes) { g.add(cy(0.03, 0.03, 0.7, st.gold, 0.3, 1.5, 0.1, { metal: 0.7, rough: 0.3 })); g.add(ring(0.13, 0.04, st.gold, 0.3, 1.2, 0.1, { metal: 0.7, rough: 0.3 })); }
    else if (st.braziers) { g.add(cy(0.03, 0.03, 0.6, st.woodDark, 0.3, 1.5, 0.1)); g.add(flame(st, 0.3, 1.78, 0.1, 0.7)); }
    else if (st.snowy) { g.add(cn(0.08, 0.7, st.glass, 0.3, 1.72, 0.1, { seg: 6 })); }
    else if (st.gilded) { const s6 = R3.star(6, 0.16, 0.07, 0.05, st.gold, 0.3, 1.8, 0.1, { metal: 0.8, rough: 0.28 }); tagged(s6, st.gold, { metal: 0.8 }); g.add(s6); }
    else { g.add(cy(0.03, 0.035, 0.85, st.wood, 0.3, 1.5, 0.1)); g.add(sp(0.09, st.roof, 0.3, 1.94, 0.1)); }
  }

  // --------------------------------------------------------------------------
  //  RÉVERBÈRE, HAIE, MASSIF DE ROSES, PANNEAU — le petit mobilier urbain.
  // --------------------------------------------------------------------------
  function buildLamp(st, o, g) {
    const H = 2.3 * o.hs;
    g.add(cy(0.11, 0.15, 0.2, st.stoneDark, 0, 0.1, 0, { seg: 8 }));
    g.add(cy(0.05, 0.07, H, st.woodDark, 0, 0.2 + H / 2, 0, { seg: 8 }));
    g.add(bx(0.22, 0.28, 0.22, '#ffe9b0', 0, H + 0.34, 0, { glow: 'warm' }));
    g.add(cn(0.19, 0.16, st.gold, 0, H + 0.55, 0, { metal: 0.7, rough: 0.32, seg: 8 }));
    if (st.lanterns) g.add(cy(0.02, 0.02, 0.3, st.wood, 0.16, H + 0.1, 0));
  }

  function buildHedge(st, o, g) {
    const c = st.snowy ? '#3f6b52' : (st.braziers ? '#4a5a35' : '#3f8f4a');
    g.add(bx(0.96, 0.5, 0.96, c, 0, 0.25, 0));
    g.add(bx(0.86, 0.12, 0.86, st.snowy ? st.snow : '#5ea84a', 0, 0.55, 0));
    if (st.gilded) g.add(bx(1.0, 0.06, 1.0, st.gold, 0, 0.04, 0, { metal: 0.7, rough: 0.32 }));
  }

  function buildRoseBed(st, o, g) {
    const r = o.rnd;
    g.add(bx(0.96, 0.14, 0.96, st.stoneDark, 0, 0.07, 0));
    g.add(bx(0.82, 0.12, 0.82, '#4a7a3a', 0, 0.17, 0));
    const cols = st.snowy ? ['#a8e6ff', '#d8e8f2', '#ffffff']
      : st.braziers ? ['#ff6b3d', '#f1c40f', '#e94b3c']
        : st.gilded ? ['#ffe066', '#d896ff', '#ffffff']
          : ['#ff6b9d', '#ffaad8', '#f1c40f'];
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05, rr = 0.16 + r() * 0.2;
      g.add(sp(0.09, cols[i % cols.length], Math.cos(a) * rr, 0.29 + r() * 0.05, Math.sin(a) * rr, { seg: 6 }));
    }
  }

  function buildSignpost(st, o, g) {
    g.add(cy(0.06, 0.07, 1.2, st.woodDark, 0, 0.6, 0, { seg: 6 }));
    g.add(bx(0.7, 0.34, 0.06, st.wood, 0, 1.15, 0.02));
    g.add(bx(0.62, 0.26, 0.03, st.trim, 0, 1.15, 0.06));
    g.add(cn(0.09, 0.14, st.roof, 0, 1.4, 0, { seg: 6 }));
  }

  // --------------------------------------------------------------------------
  //  ARÈNE — un petit colisée avec l'emblème de la ville au-dessus de la porte.
  // --------------------------------------------------------------------------
  function buildArena(st, o, g) {
    const R = Math.max(2.6, Math.min(o.W, o.D) * 0.46), hs = o.hs;
    const H = 3.2 * hs;
    g.add(cy(R + 0.24, R + 0.4, 0.34, st.stoneDark, 0, 0.17, 0, { seg: 20 }));
    g.add(cy(R, R + 0.16, H, st.stone, 0, 0.34 + H / 2, 0, { seg: 20 }));
    g.add(ring(R + 0.06, 0.14, st.stoneDark, 0, 0.34 + H, 0, { seg: 20 }));
    // Gradins (couronne creuse suggérée par un anneau en retrait).
    g.add(cy(R - 0.5, R - 0.5, 0.3, st.ground, 0, 0.34 + H + 0.1, 0, { seg: 18 }));
    // Arcades : 10 colonnes engagées, c'est ce qui fait « colisée ».
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI * 2;
      const x = Math.cos(a) * (R + 0.1), z = Math.sin(a) * (R + 0.1);
      const col = cy(0.16, 0.18, H * 0.86, st.trim, x, 0.34 + H * 0.43, z, { seg: 8 });
      g.add(col);
      if (i % 2 === 0) g.add(bx(0.16, 0.5, 0.1, '#ffe9b0', x, 0.34 + H * 0.72, z, { glow: 'warm' }));
    }
    crenelRing(g, R + 0.05, 0.34 + H + 0.14, 14, 0.2, 0.34, st.stone);
    // Grande porte au sud, emblème au-dessus.
    g.add(bx(1.5, 1.9, 0.4, st.woodDark, 0, 0.34 + 0.95, R - 0.02));
    archTop(g, 1.7, 0.34 + 1.9, R - 0.02, 0.44, st.stoneDark, 5);
    g.add(ring(0.36, 0.09, st.gold, 0, 0.34 + H * 0.86, R + 0.04, { metal: 0.8, rough: 0.28 }));
    g.add(cy(0.3, 0.3, 0.06, st.banner, 0, 0.34 + H * 0.86, R + 0.02, { seg: 12 }));
    // Bannières tout autour : une arène doit claquer au vent.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + 0.3;
      g.add(bannerPole(st, Math.cos(a) * (R - 0.2), 0.34 + H + 0.2, Math.sin(a) * (R - 0.2), 1.2, 0.85, i % 2 ? st.banner : st.banner2, 1));
    }
    if (st.braziers) { g.add(brazier(st, 1.2, 0.34, R + 0.5, 1.1)); g.add(brazier(st, -1.2, 0.34, R + 0.5, 1.1)); }
    if (st.snowy) g.add(ring(R + 0.3, 0.1, st.snow, 0, 0.36, 0, { seg: 20 }));
  }

  // --------------------------------------------------------------------------
  //  CENTRE DE SOINS et BOUTIQUE — reconnaissables à leur emblème.
  // --------------------------------------------------------------------------
  function civic(st, o, g, roofColor, emblem) {
    const W = Math.max(2.0, o.W - 0.4), D = Math.max(1.8, o.D - 0.4), hs = o.hs;
    const h = 2.3 * hs;
    const baseY = podium(g, st, W, D, 0);
    g.add(bx(W, h, D, st.wall, 0, baseY + h / 2, 0));
    g.add(bx(W + 0.04, 0.1, D + 0.04, st.stoneDark, 0, baseY + h * 0.58, 0));
    const rf = roofFor(st, W, D, baseY + h, { color: roofColor, dark: st.roofDark, brazier: false });
    g.add(rf.g);
    // Auvent sur la façade.
    g.add(bx(W * 0.8, 0.1, 0.6, roofColor, 0, baseY + h * 0.82, D / 2 + 0.28));
    for (let s = -1; s <= 1; s += 2) g.add(cy(0.05, 0.05, h * 0.8, st.wood, s * W * 0.34, baseY + h * 0.41, D / 2 + 0.5));
    // Porte vitrée et fenêtres.
    g.add(bx(0.8, 1.3, 0.06, st.glass, 0, baseY + 0.65, D / 2 + 0.02, { glow: 'warm' }));
    g.add(bx(0.9, 0.12, 0.08, st.stoneDark, 0, baseY + 1.36, D / 2 + 0.03));
    windows(g, st, 2, baseY + h * 0.62, D / 2 + 0.02, 0.3, 0.4, W * 0.68);
    // Emblème : croix pour le centre de soins, sacoche pour la boutique.
    if (emblem === 'croix') {
      g.add(bx(0.6, 0.18, 0.07, '#ffffff', 0, baseY + h + 0.42, D / 2 + 0.06, { glow: 'warm' }));
      g.add(bx(0.18, 0.6, 0.07, '#ffffff', 0, baseY + h + 0.42, D / 2 + 0.06, { glow: 'warm' }));
      g.add(cy(0.42, 0.42, 0.08, roofColor, 0, baseY + h + 0.42, D / 2 + 0.02, { seg: 14 }));
    } else {
      g.add(bx(0.5, 0.42, 0.1, st.wood, 0, baseY + h + 0.4, D / 2 + 0.05));
      g.add(bx(0.54, 0.1, 0.11, st.gold, 0, baseY + h + 0.58, D / 2 + 0.05, { metal: 0.75, rough: 0.3 }));
      g.add(bx(0.1, 0.16, 0.11, st.gold, 0, baseY + h + 0.68, D / 2 + 0.05, { metal: 0.75, rough: 0.3 }));
    }
    g.add(bannerPole(st, W / 2 - 0.15, baseY + h, D / 2 - 0.1, 0.8, 0.5, st.banner, 1));
    if (st.lanterns) g.add(lantern(st, -W / 2 + 0.2, baseY + 1.7, D / 2 + 0.2, 0.9));
  }

  // --------------------------------------------------------------------------
  //  PORTAIL DE RÉGION — deux menhirs, une arche, un disque tourbillonnant.
  // --------------------------------------------------------------------------
  function buildPortal(st, o, g) {
    for (let s = -1; s <= 1; s += 2) {
      g.add(bx(0.3, 2.4, 0.36, '#6a5fa8', s * 0.58, 1.2, 0));
      g.add(bx(0.36, 0.2, 0.42, '#8a7ec8', s * 0.58, 2.44, 0));
    }
    g.add(bx(1.6, 0.3, 0.4, '#6a5fa8', 0, 2.68, 0));
    g.add(cn(0.2, 0.5, '#a99bd6', 0, 3.05, 0, { seg: 6 }));
    // Le vortex : un disque translucide qui tourne, plus un anneau de runes.
    const disc = meshOf(R3.geo.cyl(0.62, 0.62, 0.04, 18),
      R3.mat('#a99bd6', { transparent: true, opacity: 0.62, emissive: '#7a5cbf', emissiveIntensity: 0.9, rough: 0.3, side: THREE.DoubleSide, depthWrite: false }),
      0, 1.35, 0);
    disc.rotation.x = PI / 2;
    disc.castShadow = false;
    disc.userData.dyn = true;
    g.add(disc);
    const runes = new THREE.Group();
    runes.userData.dyn = true;
    const rm = R3.mat('#d896ff', { emissive: '#d896ff', emissiveIntensity: 1.0, rough: 0.4 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      const q = meshOf(R3.geo.box(0.1, 0.1, 0.1), rm, Math.cos(a) * 0.8, 1.35, Math.sin(a) * 0.8);
      q.castShadow = false;
      runes.add(q);
    }
    g.add(runes);
    reg({ t: 'portal', disc: disc, runes: runes, ph: 0 });
  }

  // --------------------------------------------------------------------------
  //  PHARE — visible de très loin depuis la mer, avec son faisceau qui tourne.
  // --------------------------------------------------------------------------
  function buildLighthouse(st, o, g) {
    const H = 7.5 * o.hs;
    g.add(cy(1.0, 1.25, 0.5, st.stoneDark, 0, 0.25, 0, { seg: 16 }));
    g.add(cy(0.44, 0.9, H, st.trim, 0, 0.5 + H / 2, 0, { seg: 16 }));
    // Bandes rouges : trois anneaux suffisent à donner la signature du phare.
    for (let i = 0; i < 3; i++) {
      const y = 0.5 + H * (0.18 + i * 0.26);
      const r = 0.9 - (0.9 - 0.44) * (0.18 + i * 0.26);
      g.add(cy(r + 0.02, r + 0.06, 0.42, '#d1483f', 0, y, 0, { seg: 16 }));
    }
    const gy = 0.5 + H;
    g.add(cy(0.72, 0.62, 0.16, st.stoneDark, 0, gy + 0.08, 0, { seg: 16 }));           // galerie
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      g.add(bx(0.06, 0.3, 0.06, st.stoneDark, Math.cos(a) * 0.66, gy + 0.3, Math.sin(a) * 0.66));
    }
    g.add(cy(0.42, 0.42, 0.7, '#ffe9b0', 0, gy + 0.5, 0, { glow: 'warm', seg: 12 }));  // lanterne
    g.add(cn(0.56, 0.55, '#d1483f', 0, gy + 1.12, 0, { seg: 12 }));
    g.add(sp(0.1, st.gold, 0, gy + 1.44, 0, { metal: 0.8, rough: 0.28 }));
    // Faisceau tournant.
    const beam = meshOf(R3.geo.cone(0.9, 6.5, 10),
      R3.mat('#fff4d6', { transparent: true, opacity: 0.16, emissive: '#fff4d6', emissiveIntensity: 0.7, side: THREE.DoubleSide, depthWrite: false }),
      0, gy + 0.5, 3.25);
    beam.rotation.x = PI / 2;
    beam.castShadow = false;
    const pivot = new THREE.Group();
    pivot.userData.dyn = true;
    pivot.add(beam);
    g.add(pivot);
    reg({ t: 'beam', g: pivot, ph: 0 });
  }

  // --------------------------------------------------------------------------
  //  OBSERVATOIRE — la coupole d'Aurore-Cité, sa fente et son télescope.
  // --------------------------------------------------------------------------
  function buildObservatory(st, o, g) {
    const R = Math.max(1.4, Math.min(o.W, o.D) * 0.36), hs = o.hs;
    const H = 3.4 * hs;
    g.add(cy(R + 0.3, R + 0.5, 0.4, st.stoneDark, 0, 0.2, 0, { seg: 18 }));
    g.add(cy(R, R + 0.12, H, st.stone, 0, 0.4 + H / 2, 0, { seg: 18 }));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      g.add(cy(0.11, 0.12, H * 0.9, st.trim, Math.cos(a) * (R + 0.06), 0.4 + H * 0.45, Math.sin(a) * (R + 0.06), { seg: 8 }));
      g.add(bx(0.14, 0.44, 0.06, '#cfe0ff', Math.cos(a) * (R + 0.1), 0.4 + H * 0.72, Math.sin(a) * (R + 0.1), { glow: 'cool' }));
    }
    g.add(ring(R + 0.14, 0.12, st.gold, 0, 0.4 + H, 0, { metal: 0.8, rough: 0.28, seg: 18 }));
    g.add(el(R, R * 0.86, R, st.trim, 0, 0.4 + H + 0.06, 0, { seg: 18 }));
    // La fente de la coupole + le télescope qui en sort : c'est ça qui raconte.
    g.add(bx(0.36, R * 0.9, R * 2.05, st.stoneDark, 0, 0.4 + H + R * 0.42, 0));
    const tube = cy(0.17, 0.22, 1.7, st.stoneDark, 0, 0.4 + H + R * 0.72, 0.2, { seg: 10 });
    tube.rotation.x = -0.7;
    g.add(tube);
    g.add(cy(0.2, 0.2, 0.14, st.gold, 0, 0.4 + H + R * 0.72 + 0.55, 0.72, { metal: 0.8, rough: 0.28, seg: 10 }));
    g.add(bx(0.9, 0.16, 0.5, st.stoneDark, 0, 0.4, R + 0.3));
    const s7 = R3.star(5, 0.22, 0.09, 0.06, st.gold, 0, 0.4 + H * 0.5, R + 0.2, { metal: 0.8, rough: 0.28 });
    tagged(s7, st.gold, { metal: 0.8 }); g.add(s7);
    g.add(bannerPole(st, R * 0.7, 0.4 + H, R * 0.7, 1.2, 0.8, st.banner, 1));
  }

  // --------------------------------------------------------------------------
  //  PONTON, PONT, AUTEL DU LÉGENDAIRE
  // --------------------------------------------------------------------------
  function buildDock(st, o, g) {
    g.add(bx(1.0, 0.12, 1.0, st.wood, 0, 0.16, 0));
    for (let i = -1; i <= 1; i++) g.add(bx(0.96, 0.05, 0.24, st.woodDark, 0, 0.23, i * 0.33));
    for (let sx = -1; sx <= 1; sx += 2) g.add(cy(0.08, 0.09, 0.6, st.woodDark, sx * 0.42, 0.3, 0.42, { seg: 6 }));
    g.add(cy(0.1, 0.12, 0.5, st.woodDark, 0.42, 0.45, -0.42, { seg: 6 }));      // bitte d'amarrage
    g.add(ring(0.13, 0.03, '#5c4a3a', 0.42, 0.62, -0.42, { seg: 8 }));          // cordage
  }

  function buildBridge(st, o, g) {
    g.add(bx(1.02, 0.14, 1.0, st.wood, 0, 0.2, 0));
    for (let s = -1; s <= 1; s += 2) {
      g.add(bx(1.02, 0.1, 0.08, st.woodDark, 0, 0.52, s * 0.44));
      for (let i = -1; i <= 1; i++) g.add(bx(0.08, 0.34, 0.08, st.woodDark, i * 0.42, 0.34, s * 0.44));
    }
    g.add(bx(1.02, 0.1, 0.9, st.woodDark, 0, 0.11, 0));
  }

  function buildAltar(st, o, g) {
    g.add(cy(0.86, 1.0, 0.24, '#4a4270', 0, 0.12, 0, { seg: 14 }));
    g.add(cy(0.66, 0.76, 0.2, '#5a4f8c', 0, 0.34, 0, { seg: 14 }));
    for (let i = 0; i < 4; i++) {
      const a = i * PI / 2 + PI / 4;
      const p = bx(0.16, 1.0, 0.16, '#6a5fa8', Math.cos(a) * 0.62, 0.94, Math.sin(a) * 0.62);
      p.rotation.y = -a;
      p.rotation.z = Math.cos(a) * 0.12;
      g.add(p);
      g.add(bx(0.1, 0.3, 0.03, '#d896ff', Math.cos(a) * 0.7, 1.1, Math.sin(a) * 0.7, { glow: 'cool' }));
    }
    const crystal = meshOf(R3.geo.sphere(0.3, 8), R3.mat('#d896ff', { emissive: '#d896ff', emissiveIntensity: 0.9, transparent: true, opacity: 0.85, rough: 0.2 }), 0, 1.5, 0);
    crystal.scale.set(0.7, 1.5, 0.7);
    crystal.castShadow = false;
    crystal.userData.dyn = true;
    g.add(crystal);
    reg({ t: 'altar', g: crystal, ph: 0, base: 1.5 });
  }

  // --------------------------------------------------------------------------
  //  PORT AÉRIEN (§17 bis) — le mât d'amarrage se voit de très loin : c'est le
  //  repère qui dit « le dirigeable s'arrête ici ».
  // --------------------------------------------------------------------------
  function buildMast(st, o, g) {
    const H = 11.5 * o.hs;
    g.add(cy(1.5, 1.75, 0.36, st.stoneDark, 0, 0.18, 0, { seg: 12 }));
    g.add(cy(1.3, 1.4, 0.2, st.wood, 0, 0.44, 0, { seg: 12 }));
    // Le fût, en trois segments qui s'affinent.
    g.add(cy(0.28, 0.4, H * 0.42, st.wood, 0, 0.54 + H * 0.21, 0, { seg: 10 }));
    g.add(cy(0.19, 0.28, H * 0.34, st.woodDark, 0, 0.54 + H * 0.42 + H * 0.17, 0, { seg: 10 }));
    g.add(cy(0.12, 0.19, H * 0.24, st.wood, 0, 0.54 + H * 0.76 + H * 0.12, 0, { seg: 10 }));
    // Anneaux d'amarrage.
    for (let i = 0; i < 3; i++) {
      const y = 0.54 + H * (0.3 + i * 0.24);
      g.add(ring(0.34 - i * 0.06, 0.05, st.gold, 0, y, 0, { metal: 0.8, rough: 0.3, seg: 10 }));
    }
    // Haubans : six câbles tendus de la couronne vers la plate-forme.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      const rx = Math.cos(a) * 1.25, rz = Math.sin(a) * 1.25;
      const len = Math.sqrt(rx * rx + rz * rz + (H * 0.62) * (H * 0.62));
      const c = cy(0.035, 0.035, len, '#5c4a3a', rx / 2, 0.54 + H * 0.31, rz / 2, { seg: 5 });
      c.rotation.z = Math.atan2(-rx, H * 0.62);
      c.rotation.x = Math.atan2(rz, H * 0.62);
      g.add(c);
    }
    // Couronne d'amarrage + girouette qui tourne.
    const topY = 0.54 + H;
    g.add(cy(0.5, 0.34, 0.2, st.stoneDark, 0, topY, 0, { seg: 10 }));
    g.add(ring(0.5, 0.06, st.gold, 0, topY + 0.12, 0, { metal: 0.8, rough: 0.3, seg: 10 }));
    const vane = new THREE.Group();
    vane.userData.dyn = true;
    const vm = R3.mat(st.gold, { metal: 0.8, rough: 0.3 });
    vane.add(meshOf(R3.geo.box(0.06, 0.06, 0.8), vm, 0, 0, 0));
    vane.add(meshOf(R3.geo.cone(0.11, 0.28, 6), vm, 0, 0, -0.5));
    const tail = meshOf(R3.geo.plane(0.34, 0.26), R3.mat(st.banner, { rough: 0.7, side: THREE.DoubleSide }), 0, 0, 0.44);
    tail.rotation.y = PI / 2;
    vane.add(tail);
    vane.position.set(0, topY + 0.5, 0);
    g.add(vane);
    reg({ t: 'vane', g: vane, ph: 0 });
    // Bannières et lanternes de la ville.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2 + 0.4;
      g.add(bannerPole(st, Math.cos(a) * 1.15, 0.54, Math.sin(a) * 1.15, 2.4, 1.1, i % 2 ? st.banner : st.banner2, 2));
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + 0.8;
      g.add(lantern(st, Math.cos(a) * 1.45, 1.5, Math.sin(a) * 1.45, 1));
    }
    if (st.braziers) g.add(brazier(st, 1.4, 0.36, -1.4, 1));
  }

  function buildAirshipDock(st, o, g) {
    // Plancher de bois et cordages, garde-corps, passerelle et lanternes.
    g.add(bx(1.02, 0.14, 1.02, st.wood, 0, 0.17, 0));
    for (let i = -1; i <= 1; i++) g.add(bx(0.98, 0.05, 0.26, st.woodDark, 0, 0.25, i * 0.33));
    for (let s = -1; s <= 1; s += 2) {
      g.add(bx(0.08, 0.5, 0.08, st.woodDark, s * 0.44, 0.49, -0.44));
      g.add(bx(0.08, 0.5, 0.08, st.woodDark, s * 0.44, 0.49, 0.44));
      g.add(bx(0.94, 0.06, 0.06, '#5c4a3a', 0, 0.7, s * 0.44));
    }
    // Passerelle d'embarquement, inclinée vers +z.
    const ramp = bx(0.6, 0.08, 0.9, st.wood, 0, 0.42, 0.72);
    ramp.rotation.x = 0.22;
    g.add(ramp);
    g.add(lantern(st, 0.44, 1.05, -0.44, 0.9));
    g.add(lantern(st, -0.44, 1.05, -0.44, 0.9));
    g.add(bannerPole(st, -0.44, 0.24, 0.44, 1.5, 0.7, st.banner, 1));
    g.add(ring(0.14, 0.035, '#5c4a3a', 0.44, 0.28, 0.3, { seg: 8 }));
  }

  // ==========================================================================
  //  7. build(kind, opts)
  // ==========================================================================

  const BUILDERS = {
    wall: buildWall,
    wallTower: function (st, o, g) { buildWallTower(st, o, g, false); },
    gateArch: function (st, o, g) { buildGate(st, o, g, false); },
    castle: buildCastle,
    castleTower: function (st, o, g) { buildWallTower(st, o, g, true); },
    castleGate: function (st, o, g) { buildGate(st, o, g, true); },
    church: buildChurch,
    churchTower: buildChurchTower,
    manor: buildManor,
    townhouse: buildTownhouse,
    marketStall: buildStall,
    grandFountain: buildFountain,
    statue: buildStatue,
    lamp: buildLamp,
    banner: function (st, o, g) {
      g.add(cy(0.13, 0.17, 0.22, st.stoneDark, 0, 0.11, 0, { seg: 8 }));
      g.add(bannerPole(st, 0, 0.22, 0, 3.0 * o.hs, 1.3, st.banner, 2));
    },
    hedge: buildHedge,
    roseBed: buildRoseBed,
    arena: buildArena,
    healCenter: function (st, o, g) { civic(st, o, g, o.roof || '#f06a8a', 'croix'); },
    shop: function (st, o, g) { civic(st, o, g, o.roof || '#3aa6d8', 'sac'); },
    portal: buildPortal,
    lighthouse: buildLighthouse,
    observatory: buildObservatory,
    dock: buildDock,
    bridge: buildBridge,
    signpost: buildSignpost,
    legendAltar: buildAltar,
    airshipMast: buildMast,
    airshipDock: buildAirshipDock,
  };

  const DIRS = { up: PI, down: 0, left: -PI / 2, right: PI / 2 };

  function build(kind, opts) {
    const make = BUILDERS[kind];
    if (!make) return null;                       // kind inconnu : null, sans planter
    opts = opts || {};
    let root = null;
    try {
      const st = ST(opts.style);
      const nat = FOOTPRINT[kind] || [1, 1];
      // Les grands monuments gardent leur emprise de dessin si l'appelant n'en
      // impose pas une plus grande (voir le commentaire de FOOTPRINT).
      const W = (typeof opts.w === 'number' && opts.w > 1) ? opts.w : nat[0];
      const D = (typeof opts.h === 'number' && opts.h > 1) ? opts.h : nat[1];
      const seed = (typeof opts.seed === 'number') ? opts.seed
        : ((opts.x || 0) * 73856093 ^ (opts.y || 0) * 19349663) | 0;
      const o = {
        W: W, D: D, w: W, h: D,
        hs: Math.max(0.5, Math.min(1.35, opts.height || 1)),
        roof: opts.roof || null,
        rnd: R3.rng(seed || 1),
        seed: seed,
      };
      root = new THREE.Group();
      make(st, o, root);
      root.userData.meshes = countMeshes(root);
      root.userData.kind = kind;
      root.userData.style = st.id;
      if (opts.bake !== false) bake(root);
      else root.userData.drawCalls = root.userData.meshes;
      // La rotation n'est appliquée qu'APRÈS la cuisson : sinon elle serait
      // cuite dans la géométrie puis appliquée une seconde fois.
      const dir = opts.dir;
      if (typeof dir === 'number') root.rotation.y = dir;
      else if (dir && DIRS[dir] !== undefined) root.rotation.y = DIRS[dir];
    } catch (e) {
      console.warn('[citybuild3d] échec de construction de « ' + kind + ' » :', e);
      return root || null;
    }
    return root;
  }

  /** Ce décor est-il construit à l'unité (jamais en InstancedMesh) ? */
  function isMonument(kind) { return !!BUILDERS[kind]; }

  /** Sous-ensemble : monuments à ne construire QU'UNE FOIS par bloc de tuiles. */
  function isGrand(kind) { return !!GRAND[kind]; }

  /** Emprise naturelle d'un monument, en tuiles. */
  function footprint(kind) {
    const f = FOOTPRINT[kind] || [1, 1];
    return { w: f[0], h: f[1] };
  }

  // ==========================================================================
  //  8. update(t) — bannières, jets d'eau, portails, braseros, cloches…
  // ==========================================================================

  function update(t) {
    const T = (typeof t === 'number') ? t : (R3.clock ? R3.clock.t : 0);
    const rich = !R3.quality || R3.quality.particles !== false;

    for (let i = 0; i < ANIM.length; i++) {
      const a = ANIM[i];
      switch (a.t) {
        case 'banner': {
          // Deux harmoniques : une houle lente + un frémissement rapide. Chaque
          // segment reprend le mouvement du précédent avec un retard, ce qui
          // donne l'onde qui court le long du tissu.
          const links = a.links;
          for (let k = 0; k < links.length; k++) {
            const d = k * 0.55;
            links[k].rotation.y = Math.sin(T * 1.7 - d + a.ph) * 0.30 + Math.sin(T * 4.3 - d) * 0.10;
            links[k].rotation.x = Math.sin(T * 2.1 - d + a.ph) * 0.09;
          }
          break;
        }
        case 'jet': {
          const s = rich ? (0.82 + Math.sin(T * 3.4 + a.ph) * 0.18) : 1;
          a.mesh.scale.set(1, s, 1);
          a.mesh.position.y = a.base + a.h * s / 2;
          break;
        }
        case 'flame': {
          if (!rich) break;
          const f = 0.86 + Math.sin(T * 9.1 + a.ph) * 0.1 + Math.sin(T * 14.7 + a.ph * 2) * 0.06;
          a.f1.scale.set(1, f, 1);
          a.f2.scale.set(0.9 + (1 - f) * 0.5, f * 1.1, 0.9 + (1 - f) * 0.5);
          a.g.rotation.y = Math.sin(T * 2.3 + a.ph) * 0.3;
          break;
        }
        case 'portal': {
          a.disc.rotation.z = T * 0.9;
          const p = 1 + Math.sin(T * 2.2) * 0.06;
          a.disc.scale.set(p, p, 1);
          a.runes.rotation.y = -T * 0.5;
          a.runes.position.y = Math.sin(T * 1.4) * 0.08;
          break;
        }
        case 'bell': {
          a.g.rotation.z = Math.sin(T * 1.1) * 0.10;
          break;
        }
        case 'vane': {
          a.g.rotation.y = Math.sin(T * 0.35) * 0.9 + Math.sin(T * 1.3) * 0.15;
          break;
        }
        case 'beam': {
          a.g.rotation.y = T * 0.55;
          break;
        }
        case 'altar': {
          a.g.rotation.y = T * 0.7;
          a.g.position.y = a.base + Math.sin(T * 1.5) * 0.12;
          break;
        }
      }
    }

    // Purge : les monuments libérés par le streaming ne sont plus rattachés à
    // une scène. On balaie toutes les 3 secondes — jamais dans la frame chaude.
    if (T - lastSweep > 3) {
      lastSweep = T;
      for (let i = ANIM.length - 1; i >= 0; i--) {
        const a = ANIM[i];
        const node = a.root || a.g || a.mesh || (a.links && a.links[0]);
        if (node && !attached(node)) ANIM.splice(i, 1);
      }
    }
  }

  // ==========================================================================
  //  9. ENREGISTREMENT
  // ==========================================================================

  R3.register('citybuild', {
    // --- signature exacte du contrat §14 ---
    build: build,
    isMonument: isMonument,
    update: update,
    // --- ajouts utiles à world3d.js / cities3d.js (jamais en remplacement) ---
    STYLES: STYLES,
    KINDS: Object.keys(BUILDERS),
    isGrand: isGrand,
    footprint: footprint,
    animCount: function () { return ANIM.length; },
  });
})();
