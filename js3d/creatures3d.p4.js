// =============================================================================
//  creatures3d.p4.js — LOT 4 des modèles de créatures
//  Stellini · Doudoune · Flamdrak · Glydrak · Aquadrak · Tonnedrak
// =============================================================================
//  Chaque modèle reprend la silhouette et les couleurs EXACTES du dessin 2D
//  correspondant (js/creatures.js) : ovalFill() devient un ellipsoïde, rect()
//  une boîte, et l'ordre de dessin devient la profondeur. C'est la même
//  créature, en volume — Robin doit la reconnaître au premier coup d'œil.
//
//  Conventions (voir CONTRACT.md) :
//    - Group centré en (0,0,0), posé sur y = 0, tourné vers +z, ~1 unité de haut.
//    - Tout passe par les primitives R3.* (matériaux et géométries partagés).
//    - userData.anim = { head, wingL, wingR, tail, float }
//    - userData.attack(g, p) : animation de combat, p de 0 à 1.
//
//  Comme dans les autres lots, le contenu de chaque créature est rangé dans un
//  sous-groupe « root » : les attaques déplacent ce root, jamais le Group
//  racine, dont la position appartient au moteur (monde ou arène de combat).
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // ===========================================================================
  //  Petits utilitaires locaux
  // ===========================================================================

  /** Un pivot (Object3D nu) posé quelque part : sert de point de rotation. */
  function pivot(x, y, z) {
    const o = new THREE.Object3D();
    o.position.set(x || 0, y || 0, z || 0);
    return o;
  }

  /** Courbe 0 -> 1 -> 0 : la base de presque toutes les animations d'attaque. */
  function pulse(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  /** Détail décoratif : allégé (pas d'ombre projetée). */
  function deco(m) { m.castShadow = false; return m; }

  /** La bibliothèque partagée du lot 1, si elle a bien été chargée. */
  function clib() { return R3.get('clib') || null; }

  /** Petite étoile lumineuse (étincelles, éclairs, scintillements). */
  function sparkleStar(r, color, x, y, z) {
    const s = R3.star(4, r, r * 0.32, r * 0.5, color, x, y, z, {
      emissive: color, emissiveIntensity: 0.95, rough: 0.35,
    });
    s.castShadow = false; s.receiveShadow = false;
    return s;
  }

  /** Yeux « ardents » : iris lumineux coloré + pupille sombre (dragons). */
  function glowEyes(spread, y, z, r, iris, pupil) {
    const g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      g.add(R3.sphere(r, iris, s * spread, y, z,
        { emissive: iris, emissiveIntensity: 0.5, rough: 0.35 }));
      g.add(deco(R3.sphere(r * 0.52, pupil || '#1a1c2c', s * spread, y, z + r * 0.62)));
    });
    return g;
  }

  /**
   * Petite aile membranée compacte (3 meshes) : membrane, panneau clair
   * traversant, os. Pivot à l'épaule, l'aile se déploie vers +x ;
   * side = -1 retourne le groupe pour l'aile gauche.
   */
  function smallWing(len, h, membrane, inner, bone, side) {
    const g = new THREE.Group();
    const th = Math.max(0.012, len * 0.055);
    const mo = { side: THREE.DoubleSide, rough: 0.72 };

    const mem = R3.ellipsoid(len * 0.54, h * 0.50, th, membrane,
      len * 0.46, -h * 0.06, 0, mo);
    mem.rotation.z = 0.18;
    g.add(deco(mem));

    // Panneau clair : plus épais que la membrane, il ressort des DEUX côtés —
    // l'aile reste donc identique à gauche et à droite après retournement.
    g.add(deco(R3.ellipsoid(len * 0.30, h * 0.29, th * 1.6, inner,
      len * 0.42, -h * 0.02, 0, mo)));

    const arm = R3.cyl(th * 0.9, th * 1.7, len * 0.92, bone,
      len * 0.44, h * 0.16, 0, { rough: 0.6, seg: 6 });
    arm.rotation.z = -Math.PI / 2 + 0.24;
    g.add(arm);

    if (side < 0) g.rotation.y = Math.PI;
    return g;
  }

  // --- Enveloppes « clib si présent, sinon repli » ---------------------------

  /** Oreille arrondie (lapin). Pivot à la base, pousse vers +y. */
  function ear2(h, w, color, inner, x, y, z) {
    const C = clib();
    if (C && C.ear) {
      return C.ear({ h: h, w: w, color: color, innerColor: inner,
        shape: 'round', x: x, y: y, z: z });
    }
    const g = new THREE.Group();
    g.add(R3.ellipsoid(w * 0.5, h * 0.5, w * 0.30, color, 0, h * 0.5, 0));
    g.add(deco(R3.ellipsoid(w * 0.28, h * 0.32, w * 0.16, inner, 0, h * 0.48, w * 0.19)));
    g.position.set(x || 0, y || 0, z || 0);
    return g;
  }

  /** Bec conique pointant vers +z (centre du cône à la position donnée). */
  function beak2(len, r, color, x, y, z) {
    const C = clib();
    if (C && C.birdBeak) return C.birdBeak({ len: len, r: r, color: color, x: x, y: y, z: z });
    const m = R3.cone(r, len, color, x, y, z, { seg: 10 });
    m.rotation.x = Math.PI / 2;
    return m;
  }

  /** Grande aile de dragon (glydrak) : la version riche de clib si possible. */
  function bigWing2(len, h, membrane, bone, side) {
    const C = clib();
    if (C && C.dragonWing) {
      return C.dragonWing({ len: len, height: h, color: membrane,
        boneColor: bone, side: side });
    }
    return smallWing(len, h, membrane, bone, bone, side);
  }

  /** Nageoire caudale à deux lobes, s'étendant vers -z. */
  function fin2(len, h, color, x, y, z) {
    const C = clib();
    if (C && C.finTail) return C.finTail({ len: len, height: h, color: color, x: x, y: y, z: z });
    const g = new THREE.Group();
    [1, -1].forEach(function (s) {
      const l = R3.ellipsoid(len * 0.07, h * 0.52, len * 0.60, color,
        0, s * h * 0.30, -len * 0.58, { side: THREE.DoubleSide, rough: 0.75 });
      l.rotation.x = -s * 0.35;
      g.add(deco(l));
    });
    g.position.set(x || 0, y || 0, z || 0);
    return g;
  }

  /** Touffe de flammes (pivot à la base, monte vers +y). */
  function flame2(h, r, color, core, x, y, z) {
    const C = clib();
    if (C && C.flameTuft) {
      return C.flameTuft({ h: h, r: r, count: 3, color: color,
        coreColor: core, x: x, y: y, z: z });
    }
    const g = new THREE.Group();
    [-1, 0, 1].forEach(function (u) {
      const fh = h * (1 - Math.abs(u) * 0.38);
      const f = R3.cone(r * (1 - Math.abs(u) * 0.3), fh, color,
        u * r * 0.85, fh * 0.5, -u * r * 0.25,
        { emissive: color, emissiveIntensity: 0.55, rough: 0.45, seg: 9 });
      f.rotation.z = -u * 0.45;
      g.add(f);
    });
    g.add(deco(R3.cone(r * 0.48, h * 0.66, core, 0, h * 0.34, r * 0.1,
      { emissive: core, emissiveIntensity: 0.95, rough: 0.35, seg: 8 })));
    g.position.set(x || 0, y || 0, z || 0);
    return g;
  }

  /** Chapelet de bulles (dir 'up' ou 'forward'). */
  function bubbles2(count, r, len, color, dir, x, y, z) {
    const C = clib();
    if (C && C.bubbleTrail) {
      return C.bubbleTrail({ count: count, r: r, len: len, color: color,
        dir: dir, x: x, y: y, z: z });
    }
    const g = new THREE.Group();
    const forward = (dir === 'forward');
    for (let i = 0; i < count; i++) {
      const u = (count === 1) ? 0 : i / (count - 1);
      const side = Math.sin(u * 7.5) * 0.08;
      const b = R3.sphere(r * (1 - u * 0.45), color,
        side, forward ? side * 0.6 : u * len, forward ? u * len : side * 0.6,
        { transparent: true, opacity: 0.55, rough: 0.15, depthWrite: false });
      b.castShadow = false; b.receiveShadow = false;
      g.add(b);
    }
    g.position.set(x || 0, y || 0, z || 0);
    return g;
  }

  /** Sourire en arc. */
  function smile2(w, depth, r, x, y, z) {
    const C = clib();
    if (C && C.mouthSmile) return C.mouthSmile({ w: w, depth: depth, r: r, x: x, y: y, z: z });
    return deco(R3.ellipsoid(w, r, r * 0.8, '#1a1c2c', x, y - depth * 0.5, z));
  }

  // ===========================================================================
  //  STELLINI — « Un lapin-étoile tout doré et scintillant. »
  //  2D : corps en étoile #f1c40f, cœur clair #fcef8d, longues oreilles de
  //       lapin à l'intérieur rose #ffaad8, petit nez #ff6b9d, mini-étoiles.
  // ===========================================================================
  R3.registerCreature('stellini', function () {
    const OR = '#f1c40f', CLAIR = '#fcef8d', ROSE = '#ffaad8', NEZ = '#ff6b9d';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // Le corps EST l'étoile : c'est lui qui sert de « tête » à l'animation.
    const corps = pivot(0, 0.40, 0);
    root.add(corps);

    // Étoile à 4 branches tournée de 45° : deux bras levés, deux jambes.
    const etoile = R3.star(4, 0.42, 0.175, 0.22, OR, 0, 0, 0, { rough: 0.55 });
    etoile.rotation.z = Math.PI / 4;
    corps.add(etoile);

    // Cœur lumineux qui déborde des deux faces.
    corps.add(deco(R3.ellipsoid(0.175, 0.175, 0.145, CLAIR, 0, 0, 0.02, {
      emissive: CLAIR, emissiveIntensity: 0.35, rough: 0.4,
    })));

    // Deux petits coussinets au bout des branches basses : il tient debout.
    [-1, 1].forEach(function (s) {
      root.add(R3.ellipsoid(0.085, 0.055, 0.10, OR, s * 0.28, 0.05, 0.02));
      root.add(deco(R3.ellipsoid(0.045, 0.028, 0.05, ROSE, s * 0.28, 0.045, 0.075)));
    });

    // Longues oreilles de lapin, intérieur rose.
    const oreilleL = ear2(0.36, 0.135, OR, ROSE, -0.11, 0.24, -0.02);
    const oreilleR = ear2(0.36, 0.135, OR, ROSE, 0.11, 0.24, -0.02);
    oreilleL.rotation.z = 0.15;
    oreilleR.rotation.z = -0.15;
    corps.add(oreilleL, oreilleR);

    // Visage
    corps.add(R3.eyes(0.105, 0.03, 0.145, 0.052));
    corps.add(deco(R3.ellipsoid(0.032, 0.026, 0.028, NEZ, 0, -0.055, 0.155)));
    corps.add(smile2(0.06, 0.028, 0.017, 0, -0.11, 0.145));
    corps.add(R3.blush(0.185, -0.06, 0.125, 0.045));

    // Mini-étoiles qui gravitent autour de lui.
    const etincelles = [];
    [[-0.42, 0.80, 0.10, 0.05], [0.46, 0.66, -0.06, 0.042],
     [-0.36, 0.16, -0.10, 0.038], [0.38, 0.94, 0.04, 0.045]]
      .forEach(function (p) {
        const s = sparkleStar(p[3], CLAIR, p[0], p[1], p[2]);
        root.add(s);
        etincelles.push(s);
      });

    g.userData.anim = { head: corps };

    // Attaque « Étoile » : il tournoie sur lui-même et bondit en avant,
    // pendant que ses étincelles s'écartent en gerbe.
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      root.position.z = k * 0.45;
      root.position.y = k * 0.20;
      corps.rotation.y = R3.clamp01(p) * Math.PI * 4;
      etincelles.forEach(function (s, i) {
        const a = i * 1.9 + k * 3.2;
        s.position.x = Math.cos(a) * (0.42 + k * 0.35);
        s.position.y = 0.45 + Math.sin(a) * (0.36 + k * 0.30);
        s.rotation.z = a * 1.6;
        s.scale.setScalar(1 + k * 1.1);
      });
    };
    return g;
  });

  // ===========================================================================
  //  DOUDOUNE — « Un poussin duveteux tout rond et tout doux. »
  //  2D : grosse boule #f1c40f doublée de #fcef8d, tête ronde, ailerons
  //       moignons, bec et pattes #ef7d57, joues #ffaad8, gros yeux.
  // ===========================================================================
  R3.registerCreature('doudoune', function () {
    const OR = '#f1c40f', CLAIR = '#fcef8d', BEC = '#ef7d57';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // Corps : une boule dodue, presque entièrement recouverte de duvet clair.
    root.add(R3.ellipsoid(0.35, 0.31, 0.33, OR, 0, 0.34, 0, { rough: 0.95 }));
    root.add(deco(R3.ellipsoid(0.295, 0.26, 0.285, CLAIR, 0, 0.33, 0.045, { rough: 1 })));

    // Pattes orange, trois doigts chacune.
    [-1, 1].forEach(function (s) {
      root.add(R3.ellipsoid(0.075, 0.035, 0.10, BEC, s * 0.115, 0.035, 0.035, { rough: 0.8 }));
      root.add(deco(R3.ellipsoid(0.055, 0.025, 0.045, BEC, s * 0.115, 0.032, 0.12)));
    });

    // Petite queue en houppe (elle frétille).
    const queue = pivot(0, 0.40, -0.30);
    queue.add(deco(R3.ellipsoid(0.085, 0.085, 0.075, CLAIR, 0, 0.05, -0.03, { rough: 1 })));
    root.add(queue);

    // Ailerons moignons : pivotés à l'épaule pour battre.
    const aileL = pivot(-0.30, 0.38, 0.01);
    const aileR = pivot(0.30, 0.38, 0.01);
    [[aileL, -1], [aileR, 1]].forEach(function (a) {
      a[0].add(R3.ellipsoid(0.10, 0.145, 0.125, OR, a[1] * 0.05, -0.04, 0, { rough: 0.95 }));
      a[0].add(deco(R3.ellipsoid(0.06, 0.10, 0.085, CLAIR, a[1] * 0.075, -0.05, 0.02, { rough: 1 })));
    });
    root.add(aileL, aileR);

    // Tête
    const tete = pivot(0, 0.72, 0.01);
    root.add(tete);
    tete.add(R3.ellipsoid(0.25, 0.23, 0.24, OR, 0, 0, 0, { rough: 0.95 }));
    tete.add(deco(R3.ellipsoid(0.20, 0.175, 0.19, CLAIR, 0, 0.035, 0.035, { rough: 1 })));

    // Houppette de trois plumes sur le crâne.
    [[-0.055, 0.22, -0.02, 0.05], [0.005, 0.255, 0.0, 0.058], [0.065, 0.225, 0.01, 0.048]]
      .forEach(function (h) {
        tete.add(deco(R3.ellipsoid(h[3], h[3] * 1.25, h[3], CLAIR, h[0], h[1], h[2], { rough: 1 })));
      });

    // Bec orange (deux parties, comme les deux rangées de pixels du 2D).
    tete.add(beak2(0.15, 0.075, BEC, 0, -0.045, 0.215));
    tete.add(deco(R3.ellipsoid(0.055, 0.028, 0.05, '#d95f3c', 0, -0.085, 0.215)));

    // Grands yeux brillants + joues roses : tout le charme est là.
    tete.add(R3.eyes(0.098, 0.035, 0.205, 0.064));
    tete.add(R3.blush(0.175, -0.055, 0.175, 0.052));

    g.userData.anim = { head: tete, wingL: aileL, wingR: aileR, tail: queue };

    // Attaque « Bec » : il prend son élan, bat des ailerons et pique en avant.
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      const t = R3.clamp01(p);
      root.position.z = k * 0.42 - Math.sin(t * Math.PI * 2) * 0.05;
      root.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.13;
      tete.rotation.x = k * 0.42;
      aileL.rotation.z = -Math.abs(Math.sin(t * 12)) * 0.9;
      aileR.rotation.z = Math.abs(Math.sin(t * 12)) * 0.9;
      queue.rotation.x = -k * 0.35;
    };
    return g;
  });

  // ===========================================================================
  //  FLAMDRAK — « Un petit dragon de feu aux cornes fières. »
  //  2D : corps #e74c3c éclairci de #ef7d57, ventre #fcd8a0, ailes #b13e53,
  //       cornes #b13e53, yeux ardents dorés #f1c40f, queue à flamme.
  // ===========================================================================
  R3.registerCreature('flamdrak', function () {
    const ROUGE = '#e74c3c', CLAIR = '#ef7d57', SOMBRE = '#b13e53';
    const VENTRE = '#fcd8a0', OR = '#f1c40f', BLANC = '#fff0c8';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // Corps trapu, dos plus clair, gros ventre crème.
    root.add(R3.ellipsoid(0.30, 0.27, 0.32, ROUGE, 0, 0.34, 0));
    root.add(deco(R3.ellipsoid(0.255, 0.215, 0.275, CLAIR, 0, 0.40, -0.025)));
    root.add(deco(R3.ellipsoid(0.205, 0.17, 0.17, VENTRE, 0, 0.26, 0.20, { rough: 0.95 })));

    // Deux petites pattes bien plantées.
    [-1, 1].forEach(function (s) {
      root.add(R3.ellipsoid(0.10, 0.075, 0.13, SOMBRE, s * 0.155, 0.07, 0.06));
    });

    // Queue : trois anneaux qui s'affinent, terminés par une flamme vive.
    const queue = pivot(0, 0.30, -0.26);
    root.add(queue);
    queue.add(R3.ellipsoid(0.10, 0.095, 0.13, ROUGE, 0, 0.02, -0.09));
    queue.add(R3.ellipsoid(0.075, 0.072, 0.11, ROUGE, 0, 0.08, -0.25));
    queue.add(R3.ellipsoid(0.05, 0.05, 0.08, CLAIR, 0, 0.17, -0.37));
    const flamme = flame2(0.24, 0.095, OR, BLANC, 0, 0.21, -0.41);
    flamme.rotation.x = -0.35;
    queue.add(flamme);

    // Ailes courtes et vives.
    const aileL = pivot(-0.24, 0.46, -0.08);
    const aileR = pivot(0.24, 0.46, -0.08);
    aileL.add(smallWing(0.36, 0.34, SOMBRE, ROUGE, SOMBRE, -1));
    aileR.add(smallWing(0.36, 0.34, SOMBRE, ROUGE, SOMBRE, 1));
    aileL.rotation.y = -0.45;
    aileR.rotation.y = 0.45;
    root.add(aileL, aileR);

    // Tête
    const tete = pivot(0, 0.63, 0.05);
    root.add(tete);
    tete.add(R3.ellipsoid(0.235, 0.215, 0.235, ROUGE, 0, 0, 0));
    tete.add(deco(R3.ellipsoid(0.16, 0.12, 0.135, CLAIR, 0, -0.045, 0.165)));
    // Narines
    [-1, 1].forEach(function (s) {
      tete.add(deco(R3.ellipsoid(0.022, 0.018, 0.018, SOMBRE, s * 0.055, -0.02, 0.275)));
    });
    // Cornes fières, balayées vers l'arrière.
    [-1, 1].forEach(function (s) {
      const c = R3.cone(0.052, 0.21, SOMBRE, s * 0.115, 0.215, -0.045,
        { rough: 0.55, seg: 8 });
      c.rotation.x = -0.55;
      c.rotation.z = -s * 0.22;
      tete.add(c);
    });
    // Regard ardent : iris doré, pupille sombre.
    tete.add(glowEyes(0.105, 0.045, 0.19, 0.058, OR, '#1a1c2c'));

    // Souffle de flamme, invisible hors attaque.
    const souffle = flame2(0.34, 0.14, OR, BLANC, 0, -0.05, 0.24);
    souffle.rotation.x = Math.PI / 2;
    souffle.visible = false;
    R3.noShadow(souffle);
    tete.add(souffle);

    g.userData.anim = { head: tete, wingL: aileL, wingR: aileR, tail: queue };

    // Attaque « Flamme » : il se cabre, puis crache un jet de feu.
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const charge = Math.sin(Math.min(1, t / 0.35) * Math.PI * 0.5);
      const feu = pulse(Math.max(0, (t - 0.30) / 0.70));
      root.position.z = -charge * 0.14 + feu * 0.22;
      root.rotation.x = charge * 0.20 - feu * 0.22;
      tete.rotation.x = charge * 0.35 - feu * 0.45;
      souffle.visible = feu > 0.02;
      souffle.scale.set(0.5 + feu * 1.1, 0.5 + feu * 1.1, 0.4 + feu * 2.4);
      queue.rotation.x = -feu * 0.3;
      queue.rotation.y = Math.sin(t * 14) * 0.18;
    };
    return g;
  });

  // ===========================================================================
  //  GLYDRAK — « Un dragon ailé au regard perçant et mystérieux. » (rare)
  //  2D : grandes ailes #5d275d à panneaux #d896ff, corps élancé #5d275d /
  //       #7a3b8f, ventre #ffaad8, longues cornes #d896ff, yeux rouges, crocs.
  // ===========================================================================
  R3.registerCreature('glydrak', function () {
    const SOMBRE = '#5d275d', MID = '#7a3b8f', LILAS = '#d896ff';
    const ROSE = '#ffaad8', ROUGE = '#e74c3c';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // Corps élancé, dressé.
    root.add(R3.ellipsoid(0.22, 0.33, 0.22, SOMBRE, 0, 0.42, 0));
    root.add(deco(R3.ellipsoid(0.175, 0.26, 0.175, MID, 0, 0.44, 0.055)));
    root.add(deco(R3.ellipsoid(0.115, 0.20, 0.10, ROSE, 0, 0.40, 0.155, { rough: 0.92 })));

    // Pattes griffues.
    [-1, 1].forEach(function (s) {
      root.add(R3.ellipsoid(0.095, 0.075, 0.125, SOMBRE, s * 0.135, 0.07, 0.045));
    });

    // Cou fin.
    root.add(R3.ellipsoid(0.105, 0.10, 0.105, MID, 0, 0.72, 0.01));

    // Queue longue qui descend en pointe lilas.
    const queue = pivot(0, 0.26, -0.18);
    root.add(queue);
    queue.add(R3.ellipsoid(0.085, 0.085, 0.13, SOMBRE, 0, -0.02, -0.10));
    queue.add(R3.ellipsoid(0.06, 0.06, 0.11, SOMBRE, 0, -0.07, -0.26));
    queue.add(R3.ellipsoid(0.04, 0.04, 0.08, MID, 0, -0.11, -0.39));
    const dard = R3.cone(0.055, 0.14, LILAS, 0, -0.13, -0.50, { flat: true, rough: 0.5, seg: 8 });
    dard.rotation.x = -Math.PI / 2 - 0.25;
    queue.add(deco(dard));

    // Grandes ailes de dragon (le trait le plus marquant du 2D).
    const aileL = pivot(-0.17, 0.62, -0.09);
    const aileR = pivot(0.17, 0.62, -0.09);
    aileL.add(bigWing2(0.60, 0.50, SOMBRE, LILAS, -1));
    aileR.add(bigWing2(0.60, 0.50, SOMBRE, LILAS, 1));
    // Panneau lilas au cœur de chaque membrane, traversant les deux faces.
    [[aileL, -1], [aileR, 1]].forEach(function (a) {
      a[0].add(deco(R3.ellipsoid(0.20, 0.145, 0.022, LILAS, a[1] * 0.28, -0.05, 0,
        { side: THREE.DoubleSide, rough: 0.7 })));
    });
    aileL.rotation.y = -0.30;
    aileR.rotation.y = 0.30;
    root.add(aileL, aileR);

    // Tête
    const tete = pivot(0, 0.79, 0.02);
    root.add(tete);
    tete.add(R3.ellipsoid(0.20, 0.185, 0.215, SOMBRE, 0, 0, 0));
    tete.add(deco(R3.ellipsoid(0.125, 0.10, 0.135, MID, 0, -0.04, 0.155)));
    // Longues cornes lilas.
    [-1, 1].forEach(function (s) {
      const c = R3.cone(0.045, 0.26, LILAS, s * 0.085, 0.215, -0.05,
        { flat: true, rough: 0.45, seg: 8 });
      c.rotation.x = -0.42;
      c.rotation.z = -s * 0.14;
      tete.add(c);
    });
    // Regard perçant : yeux rouges lumineux.
    tete.add(glowEyes(0.095, 0.035, 0.175, 0.055, ROUGE, '#1a1c2c'));
    // Deux petits crocs blancs.
    [-1, 1].forEach(function (s) {
      const d = R3.cone(0.022, 0.06, '#f4f4f4', s * 0.055, -0.095, 0.185, { seg: 6 });
      d.rotation.x = Math.PI;
      tete.add(deco(d));
    });

    g.userData.anim = { head: tete, wingL: aileL, wingR: aileR, tail: queue };

    // Attaque « Aile / Dragon » : il s'élève d'un grand coup d'ailes puis fond
    // sur l'adversaire.
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const monte = Math.sin(Math.min(1, t / 0.4) * Math.PI * 0.5);
      const plonge = pulse(Math.max(0, (t - 0.35) / 0.65));
      root.position.y = monte * 0.34 - plonge * 0.16;
      root.position.z = plonge * 0.5;
      root.rotation.x = -plonge * 0.28;
      const bat = Math.sin(t * 16) * (0.9 - t * 0.3);
      aileL.rotation.z = -bat;
      aileR.rotation.z = bat;
      tete.rotation.x = plonge * 0.3;
      queue.rotation.x = monte * 0.35;
    };
    return g;
  });

  // ===========================================================================
  //  AQUADRAK — « Un dragon des eaux aux écailles turquoise. »
  //  2D : corps serpentin #16a085 / #1abc9c, ventre #73eff7, crête dorsale
  //       #0e6655, nageoires latérales, crêtes aqueuses, bulles.
  // ===========================================================================
  R3.registerCreature('aquadrak', function () {
    const FONCE = '#16a085', CLAIR = '#1abc9c', TURQ = '#73eff7', DORSAL = '#0e6655';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // Base : le corps s'enroule au sol, puis se dresse en S.
    root.add(R3.ellipsoid(0.30, 0.11, 0.30, FONCE, 0, 0.10, -0.02));

    // Nageoire caudale, à l'arrière de l'enroulement.
    const queue = pivot(0, 0.26, -0.24);
    queue.add(fin2(0.28, 0.24, CLAIR, 0, 0, 0));
    root.add(queue);

    // Segments du corps, de plus en plus fins, décalés en zigzag doux.
    const segs = [
      [0.22, 0.20, 0.24, 0.06],
      [0.205, 0.36, 0.20, -0.02],
      [0.185, 0.51, 0.185, -0.07],
      [0.165, 0.64, 0.17, -0.02],
    ];
    segs.forEach(function (s, i) {
      root.add(R3.ellipsoid(s[0], s[2] * 0.55, s[2], FONCE, 0, s[1], s[3]));
      if (i % 2 === 0) {
        root.add(deco(R3.ellipsoid(s[0] * 0.72, s[2] * 0.42, s[2] * 0.6, CLAIR,
          0, s[1], s[3] + s[2] * 0.5)));
      }
    });
    // Ventre turquoise, bien visible de face.
    root.add(deco(R3.ellipsoid(0.115, 0.17, 0.075, TURQ, 0, 0.30, 0.20, { rough: 0.9 })));
    root.add(deco(R3.ellipsoid(0.095, 0.13, 0.06, TURQ, 0, 0.56, 0.10, { rough: 0.9 })));

    // Crête dorsale : trois lames sombres qui remontent le dos.
    [[0.26, -0.18, 0.13], [0.42, -0.22, 0.15], [0.57, -0.19, 0.12]].forEach(function (c) {
      const lame = R3.cone(c[2], c[2] * 1.7, DORSAL, 0, c[0], c[1], { seg: 6 });
      lame.scale.z = 0.35;
      lame.rotation.x = -0.45;
      root.add(deco(lame));
    });

    // Nageoires latérales, comme deux petites ailes d'eau.
    [-1, 1].forEach(function (s) {
      const n = R3.ellipsoid(0.16, 0.11, 0.02, CLAIR, s * 0.27, 0.34, -0.02,
        { side: THREE.DoubleSide, rough: 0.7 });
      n.rotation.z = s * 0.4;
      n.rotation.y = -s * 0.25;
      root.add(deco(n));
    });

    // Tête
    const tete = pivot(0, 0.80, 0.0);
    root.add(tete);
    tete.add(R3.ellipsoid(0.195, 0.155, 0.235, FONCE, 0, 0, 0.02));
    tete.add(deco(R3.ellipsoid(0.13, 0.10, 0.14, CLAIR, 0, -0.025, 0.16)));
    // Crêtes aqueuses sur le crâne.
    [[-0.085, 0.13, 0.14], [0, 0.16, 0.10], [0.085, 0.13, 0.14]].forEach(function (c) {
      const p = R3.cone(0.038, c[2], TURQ, c[0], c[1] + c[2] * 0.4, -0.03,
        { emissive: TURQ, emissiveIntensity: 0.3, rough: 0.35, seg: 7 });
      tete.add(deco(p));
    });
    tete.add(R3.eyes(0.11, 0.035, 0.175, 0.052));

    // Bulles d'ambiance qui remontent le long du corps.
    const bulles = bubbles2(3, 0.045, 0.42, TURQ, 'up', 0.30, 0.42, 0.10);
    R3.noShadow(bulles);
    root.add(bulles);

    // Jet d'eau, invisible hors attaque.
    const jet = bubbles2(4, 0.075, 0.55, TURQ, 'forward', 0, -0.03, 0.20);
    jet.visible = false;
    R3.noShadow(jet);
    tete.add(jet);

    g.userData.anim = { head: tete, tail: queue };

    // Attaque « Jet d'eau » : il se love en arrière, puis détend son cou et
    // envoie une gerbe de bulles.
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const charge = Math.sin(Math.min(1, t / 0.35) * Math.PI * 0.5);
      const tir = pulse(Math.max(0, (t - 0.30) / 0.70));
      root.rotation.x = charge * 0.18 - tir * 0.16;
      root.position.z = -charge * 0.10 + tir * 0.16;
      tete.rotation.x = charge * 0.40 - tir * 0.35;
      tete.position.z = tir * 0.12;
      queue.rotation.y = Math.sin(t * 10) * 0.35;
      jet.visible = tir > 0.02;
      jet.scale.set(0.6 + tir * 0.9, 0.6 + tir * 0.9, 0.3 + tir * 1.8);
      bulles.position.y = 0.42 + ((R3.clock.t * 0.3) % 1) * 0.2;
    };
    return g;
  });

  // ===========================================================================
  //  TONNEDRAK — « Un dragon électrique aux crêtes en éclair ! » (rare)
  //  2D : corps #f1c40f doublé de #fcef8d, crêtes et cornes en zigzag #ef7d57,
  //       ailes courtes, dents blanches, queue à pointe d'éclair, aura #fcef8d.
  // ===========================================================================
  R3.registerCreature('tonnedrak', function () {
    const OR = '#f1c40f', CLAIR = '#fcef8d', ORANGE = '#ef7d57', BLANC = '#f4f4f4';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // Corps rond et éclatant.
    root.add(R3.ellipsoid(0.31, 0.28, 0.31, OR, 0, 0.34, 0));
    root.add(deco(R3.ellipsoid(0.26, 0.225, 0.265, CLAIR, 0, 0.37, 0.045)));

    // Pattes.
    [-1, 1].forEach(function (s) {
      root.add(R3.ellipsoid(0.10, 0.075, 0.125, OR, s * 0.155, 0.07, 0.05));
    });

    // Crêtes électriques en zigzag le long du dos.
    [[0.50, -0.10, 0.075], [0.60, -0.02, 0.09], [0.50, 0.08, 0.07]].forEach(function (c, i) {
      const z = R3.cone(c[2], c[2] * 2.1, ORANGE, 0, c[0], c[1],
        { emissive: ORANGE, emissiveIntensity: 0.3, rough: 0.45, seg: 6 });
      z.scale.z = 0.4;
      z.rotation.x = (i - 1) * 0.35 - 0.25;
      root.add(deco(z));
    });

    // Ailes courtes et nerveuses.
    const aileL = pivot(-0.27, 0.42, -0.05);
    const aileR = pivot(0.27, 0.42, -0.05);
    aileL.add(smallWing(0.34, 0.32, OR, CLAIR, ORANGE, -1));
    aileR.add(smallWing(0.34, 0.32, OR, CLAIR, ORANGE, 1));
    aileL.rotation.y = -0.4;
    aileR.rotation.y = 0.4;
    root.add(aileL, aileR);

    // Queue terminée par un éclair.
    const queue = pivot(0, 0.30, -0.26);
    root.add(queue);
    queue.add(R3.ellipsoid(0.095, 0.09, 0.125, OR, 0, 0.01, -0.09));
    queue.add(R3.ellipsoid(0.065, 0.062, 0.10, CLAIR, 0, 0.07, -0.24));
    const eclair = sparkleStar(0.115, ORANGE, 0, 0.16, -0.35);
    queue.add(eclair);

    // Tête
    const tete = pivot(0, 0.66, 0.04);
    root.add(tete);
    tete.add(R3.ellipsoid(0.245, 0.225, 0.24, OR, 0, 0, 0));
    tete.add(deco(R3.ellipsoid(0.195, 0.17, 0.19, CLAIR, 0, 0.03, 0.04)));
    // Cornes en zigzag : deux segments coudés par corne.
    [-1, 1].forEach(function (s) {
      const c1 = R3.cone(0.05, 0.16, ORANGE, s * 0.115, 0.24, -0.02, { seg: 7, rough: 0.5 });
      c1.rotation.z = -s * 0.5;
      const c2 = R3.cone(0.036, 0.14, ORANGE, s * 0.185, 0.35, -0.02,
        { seg: 7, rough: 0.5, emissive: ORANGE, emissiveIntensity: 0.25 });
      c2.rotation.z = s * 0.45;
      tete.add(c1, deco(c2));
    });
    // Yeux électriques + deux petites dents.
    tete.add(R3.eyes(0.105, 0.035, 0.20, 0.06));
    [-1, 1].forEach(function (s) {
      const d = R3.cone(0.022, 0.055, BLANC, s * 0.05, -0.115, 0.185, { seg: 6 });
      d.rotation.x = Math.PI;
      tete.add(deco(d));
    });
    tete.add(R3.blush(0.185, -0.055, 0.175, 0.048));

    // Aura : quatre étincelles qui crépitent autour de lui.
    const aura = [];
    [[-0.46, 0.55, 0.05], [0.48, 0.38, -0.08], [-0.34, 0.90, -0.04], [0.36, 0.86, 0.10]]
      .forEach(function (p) {
        const s = sparkleStar(0.045, CLAIR, p[0], p[1], p[2]);
        root.add(s);
        aura.push(s);
      });

    g.userData.anim = { head: tete, wingL: aileL, wingR: aileR, tail: queue };

    // Attaque « Éclair » : il se ramasse, sa queue s'embrase, puis il décoche
    // une décharge en se jetant en avant.
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const charge = Math.sin(Math.min(1, t / 0.4) * Math.PI * 0.5);
      const tir = pulse(Math.max(0, (t - 0.35) / 0.65));
      root.position.y = -charge * 0.07 + tir * 0.20;
      root.position.z = -charge * 0.10 + tir * 0.40;
      tete.rotation.x = charge * 0.30 - tir * 0.35;
      const bat = Math.sin(t * 20) * 0.8;
      aileL.rotation.z = -bat;
      aileR.rotation.z = bat;
      queue.rotation.x = -charge * 0.5 + tir * 0.3;
      eclair.rotation.z = t * 22;
      eclair.scale.setScalar(1 + charge * 0.6 + tir * 1.4);
      // Les étincelles jaillissent en couronne au moment de la décharge.
      aura.forEach(function (s, i) {
        const a = i * 1.6 + t * 9;
        const r = 0.42 + tir * 0.55;
        s.position.x = Math.cos(a) * r;
        s.position.y = 0.55 + Math.sin(a * 1.3) * (0.30 + tir * 0.25);
        s.position.z = Math.sin(a) * r * 0.5;
        s.rotation.z = a * 2;
        s.scale.setScalar(0.8 + tir * 1.6);
      });
    };
    return g;
  });

})();
