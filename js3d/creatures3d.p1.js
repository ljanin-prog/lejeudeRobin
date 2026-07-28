// =============================================================================
//  creatures3d.p1.js — LOT 1 DES MODÈLES 3D DE CRÉATURES
//  feuillou · petalia · goutella · bullini · etincelo · meduzia · coralou
// =============================================================================
//  Chaque modèle reprend la silhouette et les couleurs exactes du dessin 2D
//  correspondant (js/creatures.js), mais en volume : ovalFill() devient un
//  ellipsoïde, rect() une boîte, l'ordre de dessin devient la profondeur en z.
//
//  Conventions respectées pour tous les modèles :
//    * Group centré en (0,0,0), posé sur y = 0, regardant vers +z, ~1 unité.
//    * Tout le corps est rangé dans un sous-groupe `inner` : les animations
//      d'attaque bougent `inner` et JAMAIS le Group racine, que battle3d.js
//      positionne dans l'arène (et que R3.idleCreature() met à l'échelle).
//    * userData.anim = { head, wingL, wingR, tail, float }
//    * userData.attack = function (racine, p) avec p de 0 à 1.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // ---------------------------------------------------------------------------
  //  Accès à la bibliothèque partagée, avec repli si elle n'est pas chargée.
  //  (Résolu à la construction, pas au chargement : l'ordre des <script> n'a
  //  donc aucune importance.)
  // ---------------------------------------------------------------------------
  function lib() { return R3.get('clib') || null; }

  /** Sourire en arc — passe par clib si présente, sinon repli minimal. */
  function smile(o) {
    const CL = lib();
    if (CL && CL.mouthSmile) return CL.mouthSmile(o);
    o = o || {};
    const m = R3.ellipsoid(o.w || 0.10, (o.r || 0.02) * 1.2, (o.r || 0.02),
      o.color || '#1a1c2c', o.x || 0, o.y || 0, o.z || 0);
    m.castShadow = false;
    return R3.group(m);
  }

  /** Chapelet de bulles — via clib, sinon quelques sphères translucides. */
  function bubbles(o) {
    const CL = lib();
    if (CL && CL.bubbleTrail) return CL.bubbleTrail(o);
    o = o || {};
    const g = new THREE.Group();
    const n = o.count || 4, r = o.r || 0.05, len = o.len || 0.4;
    const arr = [];
    for (let i = 0; i < n; i++) {
      const b = R3.sphere(r * (1 - i / n * 0.4), o.color || '#a8e8ff',
        Math.sin(i * 1.7) * (o.spread || 0.08), (i / Math.max(1, n - 1)) * len, 0,
        { transparent: true, opacity: 0.55, rough: 0.15, depthWrite: false });
      b.castShadow = false;
      g.add(b); arr.push(b);
    }
    g.userData.bubbles = arr;
    g.position.set(o.x || 0, o.y || 0, o.z || 0);
    return g;
  }

  /** Couronne de pétales — via clib, sinon des ellipsoïdes disposés en rond. */
  function petals(o) {
    const CL = lib();
    if (CL && CL.petalRing) return CL.petalRing(o);
    o = o || {};
    const g = new THREE.Group();
    const n = o.count || 5, r = o.r || 0.2;
    const arr = [];
    for (let i = 0; i < n; i++) {
      const a = (o.start !== undefined ? o.start : Math.PI / 2) + (i / n) * Math.PI * 2;
      const p = new THREE.Group();
      p.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      p.rotation.z = a;
      p.add(R3.ellipsoid((o.petalLen || 0.24) * 0.5, (o.petalWid || 0.17) * 0.5,
        (o.thick || 0.07) * 0.5, o.color || '#ffaad8', 0, 0, 0));
      g.add(p); arr.push(p);
    }
    g.userData.petals = arr;
    g.position.set(o.x || 0, o.y || 0, o.z || 0);
    return g;
  }

  /** Nageoire caudale — via clib, sinon deux palmes plates. */
  function finTail(o) {
    const CL = lib();
    if (CL && CL.finTail) return CL.finTail(o);
    o = o || {};
    const g = new THREE.Group();
    const len = o.len || 0.28, h = o.height || 0.30;
    [1, -1].forEach(function (s) {
      const l = R3.ellipsoid(0.02, h * 0.52, len * 0.6, o.color || '#41a6f6',
        0, s * h * 0.3, -len * 0.58, { side: THREE.DoubleSide });
      l.rotation.x = -s * 0.35;
      l.castShadow = false;
      g.add(l);
    });
    g.position.set(o.x || 0, o.y || 0, o.z || 0);
    return g;
  }

  /** Ossature commune : racine + sous-groupe `inner` où l'on modélise tout. */
  function shell() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    g.userData.inner = inner;
    return g;
  }

  /** Courbe 0 -> 1 -> 0, la base de presque toutes les animations d'attaque. */
  function arc(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  // ===========================================================================
  //  FEUILLOU — « Une feuille vivante toute mignonne. »
  //  2D : feuille verte (#1e8449 / #27ae60 / #38b764), nervure sombre,
  //       gros yeux, sourire, petite tige brune en bas.
  // ===========================================================================
  R3.registerCreature('feuillou', function () {
    const VERT_SOMBRE = '#1e8449', VERT = '#27ae60', VERT_CLAIR = '#38b764';
    const BOIS = '#8b5a2b';
    const g = shell(), inner = g.userData.inner;

    // --- Tige brune posée au sol ---------------------------------------------
    inner.add(R3.cyl(0.045, 0.065, 0.17, BOIS, 0, 0.085, 0, { rough: 0.95, seg: 8 }));
    inner.add(R3.ellipsoid(0.10, 0.045, 0.10, BOIS, 0, 0.03, 0, { rough: 0.95 }));
    // Deux foliolules à la base, pour meubler le pied
    [-1, 1].forEach(function (s) {
      const f = R3.ellipsoid(0.09, 0.035, 0.05, VERT_CLAIR, s * 0.11, 0.09, 0.02,
        { rough: 0.9 });
      f.rotation.z = s * 0.5;
      inner.add(f);
    });

    // --- La feuille elle-même (pivot à la base : elle se balance au vent) -----
    const leaf = new THREE.Group();
    leaf.position.set(0, 0.15, 0);
    leaf.scale.setScalar(0.88);   // ajuste la silhouette à ~1 unité de haut
    inner.add(leaf);

    // Liseré sombre (le « contour » du dessin 2D) puis le limbe, puis le clair
    leaf.add(R3.ellipsoid(0.365, 0.425, 0.075, VERT_SOMBRE, 0, 0.40, -0.020));
    leaf.add(R3.ellipsoid(0.325, 0.385, 0.100, VERT, 0, 0.40, 0.015));
    leaf.add(R3.ellipsoid(0.205, 0.245, 0.075, VERT_CLAIR, 0, 0.45, 0.055));
    // Pointe de la feuille
    const pointe = R3.cone(0.135, 0.26, VERT, 0, 0.87, 0.005, { seg: 10 });
    leaf.add(pointe);
    // Nervure centrale + deux nervures obliques : des ellipsoïdes très étirés,
    // qui épousent la courbure du limbe (une boîte flotterait aux extrémités).
    leaf.add(R3.ellipsoid(0.024, 0.300, 0.145, VERT_SOMBRE, 0, 0.44, 0.015, { rough: 0.9 }));
    [-1, 1].forEach(function (s) {
      const n = R3.ellipsoid(0.018, 0.125, 0.100, VERT_SOMBRE, s * 0.105, 0.60, 0.020,
        { rough: 0.9 });
      n.rotation.z = -s * 0.95;   // les nervures s'écartent vers l'extérieur
      n.castShadow = false;
      leaf.add(n);
    });

    // --- Visage (le sourire passe DEVANT la nervure, comme en 2D) -------------
    leaf.add(R3.eyes(0.125, 0.46, 0.115, 0.062));
    leaf.add(R3.blush(0.205, 0.365, 0.090, 0.048));
    leaf.add(smile({ w: 0.085, depth: 0.035, r: 0.021, y: 0.315, z: 0.155 }));

    g.userData.anim = { head: leaf, float: false };
    g.userData.attack = function (root, p) {
      // « Coupe-feuille » : la feuille se vrille et fonce en avant.
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.55;
      inn.position.y = k * 0.22;
      inn.rotation.x = -k * 0.35;
      leaf.rotation.y = R3.clamp01(p) * Math.PI * 4;
      leaf.rotation.x = -k * 0.30;
      if (p >= 1) { leaf.rotation.y = 0; leaf.rotation.x = 0; }
    };
    return g;
  });

  // ===========================================================================
  //  PETALIA — « Une petite fleur magique qui sourit. »
  //  2D : 5 pétales #ffaad8 (liseré #ff6b9d), cœur #f1c40f/#fde74c,
  //       tige #27ae60, petite feuille #38b764.
  // ===========================================================================
  R3.registerCreature('petalia', function () {
    const ROSE = '#ffaad8', ROSE_VIF = '#ff6b9d';
    const OR = '#f1c40f', OR_CLAIR = '#fde74c';
    const TIGE = '#27ae60', FEUILLE = '#38b764';
    const g = shell(), inner = g.userData.inner;

    // --- Tige et feuille -------------------------------------------------------
    inner.add(R3.ellipsoid(0.12, 0.05, 0.12, TIGE, 0, 0.035, 0, { rough: 0.9 }));
    inner.add(R3.cyl(0.045, 0.060, 0.50, TIGE, 0, 0.27, 0, { rough: 0.85, seg: 8 }));
    const fe = R3.ellipsoid(0.15, 0.045, 0.075, FEUILLE, 0.15, 0.23, 0.01, { rough: 0.9 });
    fe.rotation.z = 0.55;
    inner.add(fe);
    const fe2 = R3.ellipsoid(0.10, 0.038, 0.06, FEUILLE, -0.11, 0.36, 0.01, { rough: 0.9 });
    fe2.rotation.z = -0.60;
    fe2.castShadow = false;
    inner.add(fe2);

    // --- Corolle (pivot au cœur de la fleur : elle suit le soleil) ------------
    const head = new THREE.Group();
    head.position.set(0, 0.60, 0);
    inner.add(head);

    head.add(petals({
      count: 5, r: 0.205, petalLen: 0.27, petalWid: 0.19, thick: 0.085,
      color: ROSE, tipColor: ROSE_VIF, start: Math.PI / 2,
    }));
    // Cœur jaune bombé
    head.add(R3.ellipsoid(0.155, 0.155, 0.095, OR, 0, 0, 0.045, { rough: 0.8 }));
    head.add(R3.ellipsoid(0.115, 0.115, 0.075, OR_CLAIR, 0, 0.015, 0.085, { rough: 0.75 }));

    // --- Visage sur le cœur ----------------------------------------------------
    head.add(R3.eyes(0.062, 0.030, 0.145, 0.036));
    head.add(R3.blush(0.108, -0.030, 0.125, 0.034));
    head.add(smile({ w: 0.052, depth: 0.024, r: 0.014, y: -0.045, z: 0.148, count: 4 }));

    g.userData.anim = { head: head, float: false };
    g.userData.attack = function (root, p) {
      // « Tourbillon de pétales » : la corolle s'ouvre et tournoie.
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.35;
      inn.rotation.x = -k * 0.28;
      head.rotation.z = R3.clamp01(p) * Math.PI * 3;
      head.scale.setScalar(1 + k * 0.25);
      if (p >= 1) { head.rotation.z = 0; head.scale.setScalar(1); }
    };
    return g;
  });

  // ===========================================================================
  //  GOUTELLA — « Une goutte d'eau pleine de joie. »
  //  2D : goutte #3b5dc9 (contour) / #41a6f6 (corps) / #73eff7 (reflet),
  //       pointe en haut, gros yeux, large sourire.
  // ===========================================================================
  R3.registerCreature('goutella', function () {
    const BLEU_SOMBRE = '#3b5dc9', BLEU = '#41a6f6', CYAN = '#73eff7';
    const g = shell(), inner = g.userData.inner;

    // --- Corps (pivot au centre de la goutte : il ballotte) -------------------
    const corps = new THREE.Group();
    corps.position.set(0, 0.34, 0);
    inner.add(corps);

    corps.add(R3.ellipsoid(0.335, 0.320, 0.320, BLEU, 0, 0, 0, { rough: 0.45 }));
    // Fond plus sombre : c'est le « contour » du dessin 2D, vu en volume.
    corps.add(R3.ellipsoid(0.330, 0.185, 0.315, BLEU_SOMBRE, 0, -0.155, 0, { rough: 0.5 }));
    // Pointe de la goutte + capuchon sombre
    corps.add(R3.cone(0.205, 0.42, BLEU, 0, 0.40, 0, { rough: 0.45, seg: 12 }));
    corps.add(R3.cone(0.075, 0.16, BLEU_SOMBRE, 0, 0.58, 0, { rough: 0.5, seg: 10 }));
    // Pellicule brillante translucide : la petite magie qui fait « eau »
    const film = R3.ellipsoid(0.360, 0.345, 0.345, CYAN, 0, 0, 0,
      { transparent: true, opacity: 0.26, rough: 0.08, depthWrite: false });
    film.castShadow = false;
    corps.add(film);
    // Reflets
    const r1 = R3.ellipsoid(0.085, 0.115, 0.055, CYAN, -0.155, 0.105, 0.245, { rough: 0.2 });
    r1.rotation.z = 0.4; r1.castShadow = false;
    corps.add(r1);
    const r2 = R3.ellipsoid(0.035, 0.060, 0.030, CYAN, -0.075, 0.255, 0.145, { rough: 0.2 });
    r2.castShadow = false;
    corps.add(r2);

    // --- Visage ----------------------------------------------------------------
    corps.add(R3.eyes(0.135, 0.045, 0.295, 0.068));
    corps.add(R3.blush(0.225, -0.075, 0.235, 0.050));
    corps.add(smile({ w: 0.090, depth: 0.045, r: 0.022, y: -0.115, z: 0.290 }));

    // --- Deux gouttelettes satellites -----------------------------------------
    inner.add(R3.sphere(0.045, CYAN, 0.34, 0.62, 0.10,
      { transparent: true, opacity: 0.7, rough: 0.1 }));
    inner.add(R3.sphere(0.032, CYAN, -0.30, 0.78, -0.05,
      { transparent: true, opacity: 0.7, rough: 0.1 }));

    // --- Jet d'eau, caché hors combat ------------------------------------------
    const jet = bubbles({ count: 5, r: 0.075, len: 0.75, spread: 0.07, color: CYAN, dir: 'forward' });
    jet.position.set(0, 0.34, 0.30);
    jet.visible = false;
    inner.add(jet);

    g.userData.anim = { head: corps, float: false };
    g.userData.attack = function (root, p) {
      // « Pistolet à eau » : la goutte se comprime puis crache un jet.
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.22;
      corps.scale.set(1 + k * 0.16, 1 - k * 0.16, 1 + k * 0.16);
      jet.visible = pc > 0.15 && pc < 0.95;
      jet.scale.set(1, 1, 0.4 + pc * 1.6);
      if (jet.userData.bubbles) {
        // NB : on ne touche jamais au matériau (il est partagé par R3.mat) —
        // seulement à l'échelle de chaque bulle.
        jet.userData.bubbles.forEach(function (b, i) {
          b.scale.setScalar(0.9 + Math.sin((pc * 3 + i * 0.3) * Math.PI) * 0.5);
        });
      }
      if (p >= 1) { jet.visible = false; corps.scale.setScalar(1); }
    };
    return g;
  });

  // ===========================================================================
  //  BULLINI — « Un petit poisson bulle facétieux. »
  //  2D : corps #41a6f6/#73eff7, ventre #bce884, nageoires #3b5dc9, bulles.
  // ===========================================================================
  R3.registerCreature('bullini', function () {
    const BLEU = '#41a6f6', CYAN = '#73eff7', VENTRE = '#bce884', NAGE = '#3b5dc9';
    const g = shell(), inner = g.userData.inner;

    // --- Corps ballon ----------------------------------------------------------
    const corps = new THREE.Group();
    corps.position.set(0, 0.38, 0);
    inner.add(corps);

    corps.add(R3.ellipsoid(0.290, 0.270, 0.345, CYAN, 0, 0, 0, { rough: 0.5 }));
    corps.add(R3.ellipsoid(0.255, 0.195, 0.310, BLEU, 0, 0.085, -0.020, { rough: 0.5 }));
    const ventre = R3.ellipsoid(0.205, 0.130, 0.265, VENTRE, 0, -0.155, 0.030, { rough: 0.85 });
    ventre.castShadow = false;
    corps.add(ventre);

    // --- Nageoire dorsale ------------------------------------------------------
    const dorsale = R3.ellipsoid(0.028, 0.150, 0.130, NAGE, 0, 0.290, -0.030,
      { side: THREE.DoubleSide, rough: 0.6 });
    dorsale.rotation.x = -0.25;
    corps.add(dorsale);

    // --- Queue (pivot à l'attache : elle bat) ----------------------------------
    const queue = finTail({ len: 0.30, height: 0.34, color: NAGE, thick: 0.022 });
    queue.position.set(0, 0.02, -0.31);
    corps.add(queue);

    // --- Nageoires pectorales (jouent le rôle des ailes pour l'idle) -----------
    const nageoires = [];
    [-1, 1].forEach(function (s) {
      const piv = new THREE.Group();
      piv.position.set(s * 0.255, -0.045, 0.045);
      const n = R3.ellipsoid(0.130, 0.032, 0.095, NAGE, s * 0.11, 0, -0.02,
        { side: THREE.DoubleSide, rough: 0.6 });
      n.rotation.z = s * 0.35;
      n.castShadow = false;
      piv.add(n);
      corps.add(piv);
      nageoires.push(piv);
    });

    // --- Visage ---------------------------------------------------------------
    corps.add(R3.eyes(0.145, 0.070, 0.300, 0.072));
    corps.add(R3.blush(0.230, -0.055, 0.245, 0.048));
    corps.add(smile({ w: 0.070, depth: 0.032, r: 0.020, y: -0.100, z: 0.320, count: 4 }));

    // --- Bulles qui s'échappent ------------------------------------------------
    const bul = bubbles({ count: 4, r: 0.048, len: 0.42, spread: 0.07, color: CYAN });
    bul.position.set(0.10, 0.62, 0.22);
    inner.add(bul);

    g.userData.anim = {
      head: corps, wingL: nageoires[0], wingR: nageoires[1], tail: queue, float: true,
    };
    g.userData.baseY = 0.05;
    g.userData.attack = function (root, p) {
      // « Charge bulle » : il gonfle, fonce, puis se dégonfle.
      const inn = root.userData.inner, k = arc(p);
      inn.position.z = k * 0.60;
      inn.rotation.x = -k * 0.25;
      corps.scale.setScalar(1 + k * 0.22);
      queue.rotation.y = Math.sin(R3.clamp01(p) * Math.PI * 6) * 0.5;
      if (p >= 1) { corps.scale.setScalar(1); queue.rotation.y = 0; }
    };
    return g;
  });

  // ===========================================================================
  //  ÉTINCELO — « Une étincelle dorée qui scintille. »
  //  2D : étoile à 4 branches #f1c40f, halo #fcef8d, cœur #fff0c8, yeux.
  // ===========================================================================
  R3.registerCreature('etincelo', function () {
    const OR = '#f1c40f', HALO = '#fcef8d', COEUR = '#fff0c8';
    const g = shell(), inner = g.userData.inner;

    // --- L'étoile (pivot au centre) --------------------------------------------
    const etoile = new THREE.Group();
    etoile.position.set(0, 0.56, 0);
    inner.add(etoile);

    // Halo diffus : grande étoile pâle, translucide, derrière.
    const halo = R3.star(4, 0.50, 0.155, 0.05, HALO, 0, 0, -0.045, {
      transparent: true, opacity: 0.45, emissive: HALO, emissiveIntensity: 0.7,
      rough: 0.4, depthWrite: false,
    });
    halo.castShadow = false;
    etoile.add(halo);
    // Étoile principale, bien dorée
    etoile.add(R3.star(4, 0.395, 0.120, 0.115, OR, 0, 0, 0.010, {
      emissive: OR, emissiveIntensity: 0.5, rough: 0.35,
    }));
    // Cœur lumineux
    const coeur = R3.sphere(0.125, COEUR, 0, 0, 0.085,
      { emissive: COEUR, emissiveIntensity: 0.9, rough: 0.3 });
    coeur.castShadow = false;
    etoile.add(coeur);

    // --- Visage ---------------------------------------------------------------
    etoile.add(R3.eyes(0.068, 0.030, 0.175, 0.038));
    etoile.add(R3.blush(0.120, -0.030, 0.155, 0.032));
    etoile.add(smile({ w: 0.050, depth: 0.022, r: 0.014, y: -0.055, z: 0.175, count: 4 }));

    // --- Petites étincelles satellites (tournent autour) -----------------------
    const scintilles = new THREE.Group();
    scintilles.position.set(0, 0.56, 0);
    inner.add(scintilles);
    [[0.46, 0.34, -0.10], [-0.50, 0.16, 0.08], [0.40, -0.34, 0.06], [-0.38, -0.28, -0.10]]
      .forEach(function (p, i) {
        const s = R3.star(4, 0.075 + i * 0.008, 0.024, 0.02, OR, p[0], p[1], p[2],
          { emissive: OR, emissiveIntensity: 0.85, rough: 0.3 });
        s.rotation.z = i * 0.7;
        s.castShadow = false;
        scintilles.add(s);
      });

    g.userData.anim = { head: etoile, tail: scintilles, float: true };
    g.userData.baseY = 0.06;
    g.userData.attack = function (root, p) {
      // « Éclat » : l'étoile tournoie de plus en plus vite et jaillit en avant.
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.55;
      inn.position.y = k * 0.20;
      etoile.rotation.z = pc * pc * Math.PI * 6;
      etoile.scale.setScalar(1 + k * 0.45);
      scintilles.rotation.z = -pc * Math.PI * 4;
      scintilles.scale.setScalar(1 + k * 0.8);
      if (p >= 1) { etoile.scale.setScalar(1); scintilles.scale.setScalar(1); }
    };
    return g;
  });

  // ===========================================================================
  //  MÉDUZIA — « Une méduse rose qui flotte gracieusement. »
  //  2D : dôme #d896ff / #ffaad8, bord #9b59b6, tentacules #ffaad8,
  //       yeux sur le dôme, joues #ff6b9d.
  // ===========================================================================
  R3.registerCreature('meduzia', function () {
    const MAUVE = '#d896ff', ROSE = '#ffaad8', VIOLET = '#9b59b6';
    const g = shell(), inner = g.userData.inner;

    // --- L'ombrelle (pivot au centre du dôme) ---------------------------------
    const dome = new THREE.Group();
    dome.position.set(0, 0.62, 0);
    inner.add(dome);

    // Cloche translucide + noyau rose plus dense à l'intérieur : c'est ce
    // double niveau qui donne l'aspect gélatineux.
    const cloche = R3.ellipsoid(0.375, 0.320, 0.375, MAUVE, 0, 0, 0,
      { transparent: true, opacity: 0.80, rough: 0.22 });
    dome.add(cloche);
    const noyau = R3.ellipsoid(0.290, 0.235, 0.290, ROSE, 0, 0.030, 0.010, { rough: 0.45 });
    noyau.castShadow = false;
    dome.add(noyau);
    // Bord du dôme
    const bord = R3.torus(0.360, 0.038, VIOLET, 0, -0.140, 0, { rough: 0.5, seg: 16 });
    bord.rotation.x = Math.PI / 2;
    dome.add(bord);
    // Reflet au sommet
    const refl = R3.ellipsoid(0.115, 0.055, 0.090, '#ffffff', -0.09, 0.290, 0.075,
      { transparent: true, opacity: 0.55, rough: 0.1 });
    refl.castShadow = false;
    dome.add(refl);

    // --- Visage sur la cloche --------------------------------------------------
    dome.add(R3.eyes(0.130, 0.010, 0.320, 0.062));
    dome.add(R3.blush(0.215, -0.070, 0.275, 0.048));
    dome.add(smile({ w: 0.072, depth: 0.030, r: 0.018, y: -0.095, z: 0.320, count: 4 }));

    // --- Tentacules (un seul groupe : ils ondulent ensemble) -------------------
    const tentacules = new THREE.Group();
    tentacules.position.set(0, 0.50, 0);
    inner.add(tentacules);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const tx = Math.cos(a) * 0.245, tz = Math.sin(a) * 0.245;
      const t = new THREE.Group();
      t.position.set(tx, 0, tz);
      // Deux segments décalés = une ondulation, sans coûter cher.
      const s1 = R3.ellipsoid(0.038, 0.130, 0.038, ROSE, 0, -0.125, 0, { rough: 0.6 });
      const s2 = R3.ellipsoid(0.030, 0.115, 0.030, ROSE,
        Math.cos(a) * 0.055, -0.335, Math.sin(a) * 0.055, { rough: 0.6 });
      s2.rotation.z = -Math.cos(a) * 0.30;
      s2.rotation.x = Math.sin(a) * 0.30;
      s2.castShadow = false;
      t.add(s1, s2);
      tentacules.add(t);
    }

    g.userData.anim = { head: dome, tail: tentacules, float: true };
    g.userData.baseY = 0.07;
    g.userData.attack = function (root, p) {
      // « Pulsation » : la cloche se contracte, la méduse se propulse en avant.
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.45;
      inn.position.y = k * 0.15;
      dome.scale.set(1 + k * 0.28, 1 - k * 0.30, 1 + k * 0.28);
      tentacules.scale.set(1 - k * 0.25, 1 + k * 0.35, 1 - k * 0.25);
      tentacules.rotation.x = -k * 0.30;
      tentacules.rotation.y = Math.sin(pc * Math.PI * 3) * 0.35;
      if (p >= 1) {
        dome.scale.setScalar(1); tentacules.scale.setScalar(1);
        tentacules.rotation.x = 0;
      }
    };
    return g;
  });

  // ===========================================================================
  //  CORALOU — « Un petit corail dansant. »
  //  2D : branches #fc7460 / #ef7d57, pointes #fff0c8, socle de sable #fcd8a0.
  // ===========================================================================
  R3.registerCreature('coralou', function () {
    const CORAIL = '#fc7460', CORAIL_CLAIR = '#ef7d57', POINTE = '#fff0c8';
    const SABLE = '#fcd8a0';
    const g = shell(), inner = g.userData.inner;

    /** Une branche de corail : pivot à sa base, pousse vers +y.
     *  `tilt` > 0 penche la branche vers -x, < 0 vers +x. */
    function branche(len, rBase, tilt) {
      const b = new THREE.Group();
      const rTop = rBase * 0.62;
      b.add(R3.cyl(rTop, rBase, len, CORAIL, 0, len * 0.5, 0, { rough: 0.8, seg: 9 }));
      b.add(R3.cyl(rTop * 0.92, rTop * 1.12, len * 0.30, CORAIL_CLAIR,
        0, len * 0.86, 0, { rough: 0.8, seg: 9 }));
      const t = R3.sphere(rTop * 1.15, POINTE, 0, len + rTop * 0.35, 0, { rough: 0.7, seg: 10 });
      t.castShadow = false;
      b.add(t);
      b.rotation.z = tilt;
      return b;
    }

    // --- Socle de sable --------------------------------------------------------
    const socle = R3.ellipsoid(0.415, 0.070, 0.310, SABLE, 0, 0.045, 0, { rough: 1 });
    inner.add(socle);
    inner.add(R3.sphere(0.055, SABLE, -0.29, 0.055, 0.12, { rough: 1 }));
    inner.add(R3.sphere(0.040, SABLE, 0.26, 0.050, -0.13, { rough: 1 }));

    // --- Branche centrale : c'est elle qui porte le visage ---------------------
    const centre = branche(0.78, 0.092, 0);
    centre.position.set(0, 0.08, 0.01);
    inner.add(centre);
    // Renflement du visage, à mi-hauteur de la branche
    centre.add(R3.ellipsoid(0.132, 0.145, 0.125, CORAIL, 0, 0.40, 0.020, { rough: 0.8 }));

    // --- Branches latérales (elles dansent) ------------------------------------
    //     [x, longueur, rayon de base, inclinaison (vers l'extérieur), z]
    const laterales = new THREE.Group();
    laterales.position.set(0, 0.08, 0);
    inner.add(laterales);
    [[-0.180, 0.54, 0.072, 0.34, -0.06], [0.180, 0.54, 0.072, -0.34, -0.06],
     [-0.310, 0.38, 0.056, 0.58, 0.10], [0.310, 0.38, 0.056, -0.58, 0.10]]
      .forEach(function (b) {
        const br = branche(b[1], b[2], b[3]);
        br.position.set(b[0], 0, b[4]);
        laterales.add(br);
      });

    // --- Visage sur le renflement central --------------------------------------
    const face = new THREE.Group();
    face.position.set(0, 0.40, 0.020);
    centre.add(face);
    face.add(R3.eyes(0.062, 0.022, 0.108, 0.040));
    face.add(R3.blush(0.108, -0.032, 0.090, 0.032));
    face.add(smile({ w: 0.050, depth: 0.022, r: 0.014, y: -0.072, z: 0.106, count: 4 }));

    g.userData.anim = { head: centre, tail: laterales, float: false };
    g.userData.attack = function (root, p) {
      // « Danse du corail » : les branches se dressent puis fouettent en avant.
      const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
      inn.position.z = k * 0.28;
      centre.rotation.x = -k * 0.45;
      centre.scale.set(1 + k * 0.10, 1 + k * 0.22, 1 + k * 0.10);
      laterales.rotation.x = -k * 0.30;
      laterales.rotation.y = Math.sin(pc * Math.PI * 4) * 0.45;
      if (p >= 1) {
        centre.rotation.x = 0; centre.scale.setScalar(1);
        laterales.rotation.x = 0; laterales.rotation.y = 0;
      }
    };
    return g;
  });

})();
