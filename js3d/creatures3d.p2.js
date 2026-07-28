// =============================================================================
//  creatures3d.p2.js — LOT 2 des modèles 3D de créatures
//  fluffly · glanou · papillon · cygnik · lotira · lapinou · hibouche
// =============================================================================
//  Chaque modèle reprend la silhouette et les couleurs exactes du dessin 2D
//  correspondant de js/creatures.js (les fonctions drawXxx), en volume.
//  Conventions : groupe centré en (0,0,0), posé sur y = 0, tourné vers +z,
//  environ 1 unité de haut. Voir CONTRACT.md.
// =============================================================================

(function () {
  'use strict';

  // Dégradation gracieuse : si le socle n'est pas là, on ne casse rien.
  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  const TAU = Math.PI * 2;
  const HALF = Math.PI / 2;

  // ---------------------------------------------------------------------------
  //  Petits outils locaux (rien n'est exporté : tout reste dans cette closure)
  // ---------------------------------------------------------------------------

  /** Pivot vide : place le centre de rotation d'un sous-ensemble animé. */
  function pivot(x, y, z) {
    const o = new THREE.Object3D();
    o.position.set(x || 0, y || 0, z || 0);
    for (let i = 3; i < arguments.length; i++) {
      if (arguments[i]) o.add(arguments[i]);
    }
    return o;
  }

  /** Ajoute plusieurs enfants d'un coup et renvoie le parent. */
  function addAll(parent) {
    for (let i = 1; i < arguments.length; i++) {
      if (arguments[i]) parent.add(arguments[i]);
    }
    return parent;
  }

  /** Détail posé sur une surface : pas d'ombre portée (évite l'acné d'ombre). */
  function flat(m) { m.castShadow = false; return m; }

  /** Petite bouche sombre, équivalent 3D du rect() de sourire du dessin 2D. */
  function mouth(w, h, d, x, y, z) {
    return flat(R3.ellipsoid(w, h, d, '#1a1c2c', x, y, z, { rough: 1 }));
  }

  /** Yeux clairs sur corps foncé (papillon) : bille blanche + pupille. */
  function eyesWhite(spread, y, z, r) {
    const g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      g.add(flat(R3.sphere(r, '#f4f4f4', s * spread, y, z)));
      g.add(flat(R3.sphere(r * 0.5, '#1a1c2c', s * spread, y, z + r * 0.62)));
    });
    return g;
  }

  /** Grands yeux ronds de hibou : blanc + pupille + éclat. */
  function eyesOwl(spread, y, z, r) {
    const g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      g.add(flat(R3.sphere(r, '#f4f4f4', s * spread, y, z)));
      g.add(flat(R3.sphere(r * 0.52, '#1a1c2c', s * spread, y, z + r * 0.60)));
      g.add(flat(R3.sphere(r * 0.20, '#ffffff', s * spread + r * 0.26, y + r * 0.28, z + r * 0.82)));
    });
    return g;
  }

  /** Courbe en cloche : vaut 0 en p=0 et p=1, 1 au milieu. Base des attaques. */
  function bell(p) { return Math.sin(Math.PI * R3.clamp01(p)); }

  /**
   * Couronne de pétales horizontaux (nénuphar).
   * Un pivot par pétale : rotation.y = azimut, rotation.z = relevé du bout.
   */
  function petalRing(parent, n, radius, rx, ry, rz, color, y, tilt, phase) {
    for (let i = 0; i < n; i++) {
      const a = phase + (i / n) * TAU;
      const p = pivot(0, y, 0);
      p.rotation.y = a;
      const petal = R3.ellipsoid(rx, ry, rz, color, radius, 0, 0, { rough: 0.7 });
      petal.rotation.z = -tilt;
      p.add(petal);
      parent.add(p);
    }
  }

  // ===========================================================================
  //  FLUFFLY — « Une boule de poil qui rebondit. »
  //  2D : grosse boule #fde74c cerclée de #f39c12, reflet #fcef8d,
  //       oreilles orange à intérieur rose, gros yeux, sourire, deux pattes.
  // ===========================================================================
  R3.registerCreature('fluffly', function () {
    const g = R3.group();
    const root = R3.group();
    g.add(root);

    // Le corps entier fait office de tête : c'est une boule à pattes.
    const ball = R3.group();

    // Fourrure extérieure (le cercle orange du dessin) puis le corps jaune.
    ball.add(R3.ellipsoid(0.38, 0.33, 0.36, '#f39c12', 0, 0, 0, { rough: 0.95 }));
    ball.add(R3.ellipsoid(0.345, 0.305, 0.325, '#fde74c', 0, 0.015, 0.02, { rough: 0.92 }));
    // Reflet pâle en haut à gauche, comme en 2D.
    ball.add(flat(R3.ellipsoid(0.19, 0.11, 0.10, '#fcef8d', -0.07, 0.16, 0.21, { rough: 1 })));

    // Trois touffes pour que la silhouette reste duveteuse et pas « bille ».
    ball.add(R3.sphere(0.13, '#fde74c', -0.20, 0.24, -0.10, { rough: 0.95 }));
    ball.add(R3.sphere(0.11, '#fde74c', 0.22, 0.21, -0.06, { rough: 0.95 }));
    ball.add(R3.sphere(0.12, '#f39c12', 0.02, 0.10, -0.31, { rough: 0.95 }));

    // Oreilles : petits chaussons orange penchés vers l'extérieur.
    [-1, 1].forEach(function (s) {
      const ear = R3.ellipsoid(0.075, 0.15, 0.065, '#f39c12', s * 0.27, 0.36, -0.02, { rough: 0.9 });
      ear.rotation.z = -s * 0.42;
      ball.add(ear);
      const inner = flat(R3.ellipsoid(0.04, 0.10, 0.035, '#ffaad8', s * 0.285, 0.36, 0.03, { rough: 1 }));
      inner.rotation.z = -s * 0.42;
      ball.add(inner);
    });

    // Visage
    ball.add(R3.eyes(0.135, 0.08, 0.30, 0.072));
    ball.add(R3.blush(0.235, -0.03, 0.23, 0.055));
    ball.add(mouth(0.05, 0.028, 0.03, 0, -0.075, 0.325));

    ball.position.y = 0.36;
    root.add(ball);

    // Petites pattes devant
    [-1, 1].forEach(function (s) {
      root.add(R3.ellipsoid(0.10, 0.075, 0.11, '#f39c12', s * 0.17, 0.085, 0.22, { rough: 0.95 }));
    });

    g.userData.anim = { head: ball };
    // Attaque « Rebond » : Fluffly roule vers l'avant et retombe en s'écrasant.
    g.userData.attack = function (obj, p) {
      const b = bell(p);
      root.position.z = b * 0.55;
      root.position.y = Math.abs(Math.sin(p * Math.PI * 2)) * 0.34;
      ball.rotation.x = p * TAU;
      const squash = 1 + b * 0.10;
      root.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    };
    return g;
  });

  // ===========================================================================
  //  GLANOU — « Un petit gland avec un chapeau rigolo. »
  //  2D : gland #d4a373 / #8b5a2b, chapeau #5c2e0d à bandeau #8b5a2b piqué de
  //       points, tige verte #38b764, joues #ff6b9d.
  // ===========================================================================
  R3.registerCreature('glanou', function () {
    const g = R3.group();
    const root = R3.group();
    g.add(root);

    // Corps du gland : clair en haut, plus foncé vers la pointe.
    root.add(R3.ellipsoid(0.29, 0.31, 0.29, '#d4a373', 0, 0.36, 0, { rough: 0.85 }));
    root.add(R3.ellipsoid(0.245, 0.20, 0.245, '#8b5a2b', 0, 0.22, 0, { rough: 0.85 }));
    const tip = R3.cone(0.15, 0.17, '#8b5a2b', 0, 0.10, 0);
    tip.rotation.x = Math.PI;
    root.add(tip);

    // Visage sur le gland
    root.add(R3.eyes(0.125, 0.41, 0.26, 0.066));
    root.add(R3.blush(0.215, 0.31, 0.19, 0.05));
    root.add(mouth(0.035, 0.025, 0.025, 0, 0.275, 0.275));

    // Chapeau (cupule) : bandeau + calotte + petits points de texture.
    const cap = pivot(0, 0.58, 0);
    cap.add(R3.cyl(0.31, 0.35, 0.15, '#8b5a2b', 0, 0.06, 0, { seg: 16, rough: 0.9 }));
    cap.add(R3.ellipsoid(0.315, 0.20, 0.315, '#5c2e0d', 0, 0.15, 0, { rough: 0.9 }));
    [0.9, 2.3, 3.9, 5.5].forEach(function (a) {
      cap.add(flat(R3.sphere(0.035, '#5c2e0d', Math.sin(a) * 0.33, 0.05, Math.cos(a) * 0.33, { rough: 1 })));
    });
    // Tige et petite feuille verte sur le dessus
    cap.add(R3.cyl(0.035, 0.045, 0.13, '#5c2e0d', 0, 0.30, 0, { seg: 8 }));
    const leaf = R3.ellipsoid(0.10, 0.028, 0.055, '#38b764', 0.10, 0.36, 0, { rough: 0.8 });
    leaf.rotation.z = 0.5;
    cap.add(leaf);
    root.add(cap);

    g.userData.anim = { head: cap };
    // Attaque « Gland » : Glanou vrille comme une toupie et fonce en avant.
    g.userData.attack = function (obj, p) {
      const b = bell(p);
      root.rotation.y = p * TAU * 2;
      root.position.z = b * 0.45;
      root.position.y = b * 0.14;
      cap.rotation.x = b * 0.25;
    };
    return g;
  });

  // ===========================================================================
  //  PAPILLON — « Un papillon aux ailes rose et violet. »
  //  2D : corps #5d275d, ailes hautes #ff6b9d (reflet #ffaad8), ailes basses
  //       #d896ff, points dorés #f1c40f, antennes à pointe dorée, yeux clairs.
  // ===========================================================================
  R3.registerCreature('papillon', function () {
    const g = R3.group();
    const root = R3.group();
    g.add(root);

    // Corps fuselé + petite tête ronde
    root.add(R3.ellipsoid(0.065, 0.21, 0.08, '#5d275d', 0, 0.55, 0, { rough: 0.7 }));
    root.add(R3.sphere(0.095, '#5d275d', 0, 0.78, 0.015, { rough: 0.7 }));
    root.add(eyesWhite(0.05, 0.79, 0.085, 0.032));

    // Antennes fines à boule dorée
    [-1, 1].forEach(function (s) {
      const ant = R3.cyl(0.012, 0.016, 0.20, '#5d275d', s * 0.055, 0.90, -0.01, { seg: 6 });
      ant.rotation.z = -s * 0.45;
      ant.castShadow = false;
      root.add(ant);
      root.add(flat(R3.sphere(0.033, '#f1c40f', s * 0.115, 0.985, -0.01, { rough: 0.5 })));
    });

    // Ailes : deux paires par côté, dans le plan XY comme sur le sprite.
    const wings = [];
    [-1, 1].forEach(function (s) {
      const w = pivot(s * 0.05, 0.64, 0);
      // Aile haute (rose) + son reflet clair + point doré
      const up = R3.wing(0.24, 0.22, '#ff6b9d', s * 0.23, 0.09, -0.015, { rough: 0.6 });
      up.rotation.z = s * 0.22;
      w.add(up);
      w.add(flat(R3.ellipsoid(0.10, 0.085, 0.012, '#ffaad8', s * 0.23, 0.11, 0.03, { rough: 0.7 })));
      w.add(flat(R3.sphere(0.032, '#f1c40f', s * 0.18, 0.06, 0.035, { rough: 0.5 })));
      // Aile basse (violette) + point doré
      const dn = R3.wing(0.19, 0.175, '#d896ff', s * 0.19, -0.16, -0.01, { rough: 0.6 });
      dn.rotation.z = -s * 0.18;
      w.add(dn);
      w.add(flat(R3.sphere(0.030, '#f1c40f', s * 0.17, -0.16, 0.03, { rough: 0.5 })));
      wings.push(w);
      root.add(w);
    });

    g.userData.baseY = 0;
    g.userData.anim = { wingL: wings[0], wingR: wings[1], float: true };
    // Attaque « Poudre » : montée en flèche, battements très rapides.
    g.userData.attack = function (obj, p) {
      const b = bell(p);
      root.position.y = b * 0.32;
      root.position.z = b * 0.42;
      const f = Math.sin(p * Math.PI * 12) * 0.75;
      wings[0].rotation.z = f;
      wings[1].rotation.z = -f;
      root.rotation.x = -b * 0.25;
    };
    return g;
  });

  // ===========================================================================
  //  CYGNIK — « Un cygne gracieux qui glisse sur l'eau. »
  //  2D : corps #f4f4f4 ombré #bdc3c7, plumes #94b0c2, cou en S, bec #ef7d57
  //       à pointe #d35400, reflet d'eau #41a6f6.
  // ===========================================================================
  R3.registerCreature('cygnik', function () {
    const g = R3.group();
    const root = R3.group();
    g.add(root);

    // Reflet d'eau : galette bleue translucide sous le corps.
    const ripple = R3.ellipsoid(0.46, 0.02, 0.46, '#41a6f6', 0, 0.025, -0.02,
      { transparent: true, opacity: 0.45, rough: 0.25, depthWrite: false });
    R3.noShadow(ripple);
    root.add(ripple);

    // Coque du corps, façon barque
    root.add(R3.ellipsoid(0.28, 0.23, 0.39, '#f4f4f4', 0, 0.27, -0.02, { rough: 0.8 }));
    root.add(R3.ellipsoid(0.245, 0.14, 0.33, '#bdc3c7', 0, 0.17, -0.02, { rough: 0.85 }));

    // Ailes repliées le long du corps
    const wingP = [];
    [-1, 1].forEach(function (s) {
      const w = pivot(s * 0.20, 0.31, -0.02);
      w.add(R3.ellipsoid(0.10, 0.17, 0.30, '#f4f4f4', s * 0.05, 0, -0.02, { rough: 0.8 }));
      w.add(flat(R3.ellipsoid(0.055, 0.10, 0.20, '#94b0c2', s * 0.10, -0.03, -0.06, { rough: 0.85 })));
      wingP.push(w);
      root.add(w);
    });

    // Queue relevée à l'arrière
    const tail = pivot(0, 0.33, -0.32);
    const tailMesh = R3.ellipsoid(0.11, 0.09, 0.17, '#f4f4f4', 0, 0.05, -0.10, { rough: 0.8 });
    tailMesh.rotation.x = 0.7;
    tail.add(tailMesh);
    root.add(tail);

    // Cou en S : quatre perles décroissantes, puis la tête.
    const neck = pivot(0, 0.42, 0.09);
    neck.add(R3.sphere(0.105, '#f4f4f4', 0, 0.07, 0.02, { rough: 0.8 }));
    neck.add(R3.sphere(0.093, '#f4f4f4', 0, 0.19, -0.01, { rough: 0.8 }));
    neck.add(R3.sphere(0.085, '#f4f4f4', 0, 0.31, 0.005, { rough: 0.8 }));
    neck.add(R3.sphere(0.082, '#f4f4f4', 0, 0.41, 0.055, { rough: 0.8 }));
    neck.add(R3.ellipsoid(0.105, 0.10, 0.115, '#f4f4f4', 0, 0.50, 0.115, { rough: 0.8 }));
    // Bec orange pointé vers +z
    const beak = R3.cone(0.055, 0.17, '#ef7d57', 0, 0.485, 0.26, { seg: 8 });
    beak.rotation.x = HALF - 0.12;
    neck.add(beak);
    neck.add(flat(R3.sphere(0.033, '#d35400', 0, 0.474, 0.325, { rough: 0.9 })));
    neck.add(R3.eyes(0.062, 0.535, 0.185, 0.034));
    root.add(neck);

    g.userData.anim = { head: neck, tail: tail };
    // Attaque « Coup d'aile » : les ailes s'ouvrent en grand, le cou fouette.
    g.userData.attack = function (obj, p) {
      const b = bell(p);
      wingP[0].rotation.z = b * 1.15;
      wingP[1].rotation.z = -b * 1.15;
      neck.rotation.x = -Math.sin(p * Math.PI * 2) * 0.55;
      root.position.z = b * 0.35;
      root.position.y = b * 0.12;
    };
    return g;
  });

  // ===========================================================================
  //  LOTIRA — « Un nénuphar enchanté tout rose. »
  //  2D : feuille #1e8449 / #27ae60 / #38b764, pétales #ff6b9d puis #ffaad8,
  //       reflets #fff0c8, cœur #f1c40f / #fde74c.
  // ===========================================================================
  R3.registerCreature('lotira', function () {
    const g = R3.group();
    const root = R3.group();
    g.add(root);

    // Feuille de nénuphar posée au sol
    root.add(R3.ellipsoid(0.48, 0.035, 0.48, '#1e8449', 0, 0.035, 0, { rough: 0.9, seg: 18 }));
    root.add(flat(R3.ellipsoid(0.42, 0.03, 0.42, '#27ae60', 0, 0.055, 0, { rough: 0.9, seg: 18 })));
    root.add(flat(R3.ellipsoid(0.22, 0.025, 0.14, '#38b764', -0.04, 0.07, 0.10, { rough: 1 })));

    // La fleur : trois couronnes de pétales de plus en plus dressées.
    const flower = pivot(0, 0.07, 0);
    petalRing(flower, 6, 0.30, 0.25, 0.04, 0.13, '#ff6b9d', 0.13, 0.24, 0.0);
    petalRing(flower, 6, 0.245, 0.23, 0.038, 0.12, '#ffaad8', 0.32, 0.72, 0.52);
    petalRing(flower, 4, 0.14, 0.18, 0.034, 0.095, '#ffaad8', 0.50, 1.15, 0.26);
    // Reflet clair sur un pétale de devant
    flower.add(flat(R3.ellipsoid(0.13, 0.025, 0.06, '#fff0c8', 0, 0.36, 0.27, { rough: 1 })));
    // Cœur doré
    flower.add(R3.sphere(0.105, '#f1c40f', 0, 0.62, 0, { rough: 0.6 }));
    flower.add(flat(R3.sphere(0.05, '#fde74c', -0.035, 0.665, 0.045, { rough: 0.6 })));
    flower.add(R3.eyes(0.075, 0.625, 0.09, 0.038));
    root.add(flower);

    g.userData.anim = { head: flower };
    // Attaque « Pétale » : la fleur s'étire, tourne et se penche vers l'ennemi.
    g.userData.attack = function (obj, p) {
      const b = bell(p);
      flower.rotation.y = p * TAU;
      flower.rotation.x = b * 0.45;
      flower.position.y = 0.07 + b * 0.16;
      flower.scale.setScalar(1 + b * 0.12);
    };
    return g;
  });

  // ===========================================================================
  //  LAPINOU — « Un petit lapin tout doux avec de grandes oreilles. »
  //  2D : blanc #f4f4f4 ombré #bdc3c7, intérieur d'oreilles et coussinets
  //       #ffaad8, nez #ff6b9d, gros yeux.
  // ===========================================================================
  R3.registerCreature('lapinou', function () {
    const g = R3.group();
    const root = R3.group();
    g.add(root);

    // Corps
    root.add(R3.ellipsoid(0.28, 0.26, 0.26, '#f4f4f4', 0, 0.28, 0, { rough: 0.9 }));
    root.add(R3.ellipsoid(0.265, 0.17, 0.245, '#bdc3c7', 0, 0.19, -0.01, { rough: 0.9 }));

    // Pattes avant et queue en pompon
    [-1, 1].forEach(function (s) {
      root.add(R3.ellipsoid(0.095, 0.075, 0.11, '#f4f4f4', s * 0.16, 0.075, 0.17, { rough: 0.9 }));
      root.add(flat(R3.ellipsoid(0.045, 0.03, 0.05, '#ffaad8', s * 0.16, 0.06, 0.245, { rough: 1 })));
    });
    const tail = pivot(0, 0.30, -0.26);
    tail.add(R3.sphere(0.105, '#f4f4f4', 0, 0, 0, { rough: 1 }));
    root.add(tail);

    // Tête
    const head = pivot(0, 0.50, 0.02);
    head.add(R3.ellipsoid(0.265, 0.235, 0.24, '#f4f4f4', 0, 0.12, 0, { rough: 0.9 }));
    // Grandes oreilles (pivotées pour l'attaque)
    const ears = [];
    [-1, 1].forEach(function (s) {
      const e = pivot(s * 0.105, 0.24, -0.02);
      const shell = R3.ellipsoid(0.07, 0.195, 0.055, '#f4f4f4', 0, 0.18, 0, { rough: 0.9 });
      shell.rotation.z = -s * 0.16;
      e.add(shell);
      const inner = flat(R3.ellipsoid(0.038, 0.145, 0.03, '#ffaad8', s * 0.008, 0.18, 0.035, { rough: 1 }));
      inner.rotation.z = -s * 0.16;
      e.add(inner);
      ears.push(e);
      head.add(e);
    });
    // Visage
    head.add(R3.eyes(0.115, 0.15, 0.20, 0.065));
    head.add(R3.blush(0.205, 0.06, 0.145, 0.052));
    head.add(flat(R3.sphere(0.036, '#ff6b9d', 0, 0.075, 0.235, { rough: 0.9 })));
    head.add(mouth(0.022, 0.02, 0.02, -0.045, 0.025, 0.225));
    head.add(mouth(0.022, 0.02, 0.02, 0.045, 0.025, 0.225));
    root.add(head);

    g.userData.anim = { head: head, tail: tail };
    // Attaque « Rebond » : grand bond en avant, oreilles rejetées en arrière.
    g.userData.attack = function (obj, p) {
      const b = bell(p);
      root.position.y = b * 0.52;
      root.position.z = b * 0.50;
      head.rotation.x = -b * 0.30;
      ears[0].rotation.x = b * 0.85;
      ears[1].rotation.x = b * 0.85;
      const stretch = 1 + b * 0.10;
      root.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
    };
    return g;
  });

  // ===========================================================================
  //  HIBOUCHE — « Un hibou aux yeux immenses. »
  //  2D : corps #5c2e0d / #8b5a2b, ventre #fff0c8, disque facial #d4a373,
  //       yeux énormes, bec #f1c40f, pattes #d35400.
  // ===========================================================================
  R3.registerCreature('hibouche', function () {
    const g = R3.group();
    const root = R3.group();
    g.add(root);

    // Corps en gros œuf, ventre crème
    root.add(R3.ellipsoid(0.345, 0.345, 0.30, '#5c2e0d', 0, 0.37, 0, { rough: 0.9 }));
    root.add(R3.ellipsoid(0.30, 0.305, 0.265, '#8b5a2b', 0, 0.37, 0.04, { rough: 0.9 }));
    root.add(flat(R3.ellipsoid(0.195, 0.20, 0.135, '#fff0c8', 0, 0.28, 0.20, { rough: 0.95 })));

    // Pattes orange
    [-1, 1].forEach(function (s) {
      root.add(R3.ellipsoid(0.075, 0.05, 0.10, '#d35400', s * 0.135, 0.055, 0.14, { rough: 0.85 }));
    });

    // Ailes le long du corps
    const wingP = [];
    [-1, 1].forEach(function (s) {
      const w = pivot(s * 0.30, 0.48, 0);
      w.add(R3.ellipsoid(0.085, 0.24, 0.20, '#5c2e0d', s * 0.02, -0.10, -0.01, { rough: 0.9 }));
      w.add(flat(R3.ellipsoid(0.045, 0.155, 0.125, '#8b5a2b', s * 0.055, -0.11, 0.02, { rough: 0.9 })));
      wingP.push(w);
      root.add(w);
    });

    // Petite queue
    const tail = pivot(0, 0.16, -0.26);
    const tm = R3.ellipsoid(0.13, 0.06, 0.14, '#5c2e0d', 0, -0.02, -0.06, { rough: 0.9 });
    tm.rotation.x = -0.4;
    tail.add(tm);
    root.add(tail);

    // Tête (elle se penche : c'est un hibou, il incline la tête)
    const head = pivot(0, 0.60, 0);
    head.add(R3.ellipsoid(0.30, 0.255, 0.26, '#8b5a2b', 0, 0.06, 0.01, { rough: 0.9 }));
    head.add(flat(R3.ellipsoid(0.245, 0.205, 0.11, '#d4a373', 0, 0.045, 0.185, { rough: 0.95 })));
    // Aigrettes
    [-1, 1].forEach(function (s) {
      const t = R3.cone(0.075, 0.17, '#5c2e0d', s * 0.175, 0.27, -0.02, { seg: 8 });
      t.rotation.z = -s * 0.38;
      head.add(t);
    });
    head.add(eyesOwl(0.118, 0.065, 0.205, 0.105));
    const beak = R3.cone(0.05, 0.12, '#f1c40f', 0, -0.045, 0.27, { seg: 8 });
    beak.rotation.x = HALF - 0.55;
    head.add(beak);
    root.add(head);

    g.userData.anim = { head: head, tail: tail };
    // Attaque « Serre » : envol, ailes déployées, piqué griffes en avant.
    g.userData.attack = function (obj, p) {
      const b = bell(p);
      root.position.y = b * 0.38;
      root.position.z = b * 0.48;
      wingP[0].rotation.z = b * 1.25;
      wingP[1].rotation.z = -b * 1.25;
      head.rotation.x = b * 0.28;
      root.rotation.x = -b * 0.22;
    };
    return g;
  });
})();
