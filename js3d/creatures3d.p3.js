// =============================================================================
//  creatures3d.p3.js — LOT 3 des modèles de créatures
//  Étoilamer · Crabilino · Nuagette · Miaouche · Pandouki · Koronette
// =============================================================================
//  Chaque modèle reprend la silhouette et les couleurs exactes du dessin 2D
//  correspondant (js/creatures.js), mais en volume : ovalFill() devient un
//  ellipsoïde, rect() une boîte, et l'ordre de dessin devient la profondeur.
//
//  Conventions (voir CONTRACT.md) :
//    - Group centré en (0,0,0), posé sur y = 0, tourné vers +z, ~1 unité de haut.
//    - Tout passe par les primitives R3.* (matériaux et géométries partagés).
//    - userData.anim = { head, wingL, wingR, tail, float }
//    - userData.attack(g, p) : animation de combat, p de 0 à 1.
//
//  Astuce d'implémentation : le contenu de chaque créature est rangé dans un
//  sous-groupe « root ». Les attaques déplacent ce root plutôt que le Group
//  racine, dont la position appartient au moteur (monde ou arène de combat).
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // --- Petits utilitaires locaux -------------------------------------------

  /** Un pivot (Object3D nu) posé quelque part : sert de point de rotation. */
  function pivot(x, y, z) {
    const o = new THREE.Object3D();
    o.position.set(x || 0, y || 0, z || 0);
    return o;
  }

  /** Courbe 0 -> 1 -> 0, utilisée par presque toutes les attaques. */
  function pulse(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  /** Matériau d'étincelle : petite étoile dorée qui brille sans faire d'ombre. */
  function sparkle(rOut, color, x, y, z, glow) {
    const s = R3.star(4, rOut, rOut * 0.34, rOut * 0.5, color, x, y, z, {
      emissive: glow || color, emissiveIntensity: 0.85, rough: 0.4,
    });
    s.castShadow = false; s.receiveShadow = false;
    return s;
  }

  // ===========================================================================
  //  ÉTOILAMER — « Une étoile de mer souriante. »
  //  2D : étoile rose #ff6b9d à 5 branches, centre clair #ffaad8,
  //       points rouges #d62828, deux yeux et un sourire.
  // ===========================================================================
  R3.registerCreature('etoilamer', function () {
    const ROSE = '#ff6b9d', PALE = '#ffaad8', POINT = '#d62828';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // L'étoile entière tourne autour de son centre : c'est elle, la « tête ».
    const etoile = pivot(0, 0.46, 0);
    root.add(etoile);

    // Les 5 branches, une par pivot tourné de 72°.
    for (let i = 0; i < 5; i++) {
      const br = pivot(0, 0, 0);
      br.rotation.z = i * (Math.PI * 2 / 5);
      br.add(R3.ellipsoid(0.105, 0.25, 0.115, ROSE, 0, 0.30, 0));
      // Point de texture rouge près de la pointe (face avant seulement).
      const pt = R3.ellipsoid(0.035, 0.035, 0.022, POINT, 0, 0.38, 0.093);
      pt.castShadow = false;
      br.add(pt);
      etoile.add(br);
    }

    // Disque central bombé + tache claire.
    etoile.add(R3.ellipsoid(0.275, 0.275, 0.165, ROSE, 0, 0, 0));
    const tache = R3.ellipsoid(0.185, 0.155, 0.075, PALE, 0, -0.015, 0.115);
    tache.castShadow = false;
    etoile.add(tache);

    // Visage
    etoile.add(R3.eyes(0.10, 0.045, 0.155, 0.055));
    const bouche = R3.ellipsoid(0.05, 0.028, 0.025, '#1a1c2c', 0, -0.075, 0.155);
    bouche.castShadow = false;
    etoile.add(bouche);
    etoile.add(R3.blush(0.175, -0.03, 0.135, 0.045));

    g.userData.anim = { head: etoile };

    // Attaque « Étoile » : l'étoile de mer se met à tournoyer et bondit.
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      root.position.z = k * 0.5;
      root.position.y = k * 0.22;
      root.rotation.x = -k * 0.35;
      etoile.rotation.z = R3.clamp01(p) * Math.PI * 4;
    };
    return g;
  });

  // ===========================================================================
  //  CRABILINO — « Un crabe rouge qui fait clic-clac. »
  //  2D : carapace #e74c3c sur ventre #b13e53, deux grosses pinces,
  //       trois pattes par côté, yeux blancs sur tiges.
  // ===========================================================================
  R3.registerCreature('crabilino', function () {
    const CLAIR = '#e74c3c', SOMBRE = '#b13e53';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // Carapace : dôme clair posé sur un ventre plus foncé.
    root.add(R3.ellipsoid(0.38, 0.16, 0.29, SOMBRE, 0, 0.31, 0));
    root.add(R3.ellipsoid(0.36, 0.21, 0.27, CLAIR, 0, 0.38, 0));
    // Deux petites bosses claires façon coquillage.
    const b1 = R3.ellipsoid(0.07, 0.04, 0.06, SOMBRE, -0.16, 0.54, 0.02);
    const b2 = R3.ellipsoid(0.07, 0.04, 0.06, SOMBRE, 0.16, 0.54, 0.02);
    b1.castShadow = b2.castShadow = false;
    root.add(b1, b2);

    // Bouche
    const bouche = R3.ellipsoid(0.075, 0.03, 0.03, '#7a2436', 0, 0.28, 0.25);
    bouche.castShadow = false;
    root.add(bouche);

    // 3 pattes de chaque côté, écartées et légèrement en éventail.
    [-1, 1].forEach(function (s) {
      [-0.17, 0.0, 0.17].forEach(function (dz) {
        const pat = R3.cyl(0.022, 0.036, 0.32, SOMBRE, s * 0.31, 0.19, dz);
        pat.rotation.z = s * 0.58;
        pat.rotation.x = -dz * 1.1;
        root.add(pat);
      });
    });

    // Pinces : un pivot à l'épaule, bras + mors qui s'ouvrent.
    const pinces = [];
    [-1, 1].forEach(function (s) {
      const ep = pivot(s * 0.26, 0.42, 0.10);
      const bras = R3.cyl(0.05, 0.05, 0.20, SOMBRE, s * 0.10, 0.03, 0.02);
      bras.rotation.z = Math.PI / 2;
      ep.add(bras);
      ep.add(R3.ellipsoid(0.115, 0.125, 0.10, SOMBRE, s * 0.25, 0.06, 0.04));
      const luis = R3.ellipsoid(0.065, 0.05, 0.06, CLAIR, s * 0.25, 0.10, 0.09);
      luis.castShadow = false;
      ep.add(luis);
      // Mors supérieur et inférieur, légèrement entrouverts.
      const haut = R3.ellipsoid(0.05, 0.055, 0.10, SOMBRE, s * 0.30, 0.13, 0.13);
      const bas = R3.ellipsoid(0.05, 0.045, 0.09, SOMBRE, s * 0.30, -0.01, 0.13);
      haut.rotation.x = -0.35; bas.rotation.x = 0.3;
      ep.add(haut, bas);
      root.add(ep);
      pinces.push(ep);
    });

    // Yeux au bout de deux tiges (le pivot « tête » les fait dodeliner).
    const tete = pivot(0, 0.54, 0.06);
    [-1, 1].forEach(function (s) {
      tete.add(R3.cyl(0.026, 0.032, 0.22, SOMBRE, s * 0.115, 0.11, 0));
      tete.add(R3.sphere(0.078, '#f4f4f4', s * 0.115, 0.26, 0));
      tete.add(R3.sphere(0.038, '#1a1c2c', s * 0.12, 0.265, 0.055));
      const hi = R3.sphere(0.018, '#ffffff', s * 0.135, 0.29, 0.075);
      hi.castShadow = false;
      tete.add(hi);
    });
    root.add(tete);

    g.userData.anim = { head: tete, wingL: pinces[0], wingR: pinces[1] };

    // Attaque « Pince » : les deux pinces claquent en avant, le corps charge.
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      const clac = Math.abs(Math.sin(R3.clamp01(p) * Math.PI * 3));
      root.position.z = k * 0.4;
      root.rotation.x = -k * 0.2;
      pinces[0].rotation.z = -0.4 - clac * 0.7;
      pinces[1].rotation.z = 0.4 + clac * 0.7;
      pinces[0].rotation.x = pinces[1].rotation.x = -k * 0.35;
    };
    return g;
  });

  // ===========================================================================
  //  NUAGETTE — « ✦ Un esprit nuage très très rare ! ✦ »
  //  2D : nuage blanc #f4f4f4 doublé de gris #bdc3c7, reflets dorés #fff0c8,
  //       aura jaune translucide, joues roses, étincelles #fcef8d / #f1c40f.
  // ===========================================================================
  R3.registerCreature('nuagette', function () {
    const BLANC = '#f4f4f4', GRIS = '#bdc3c7', OR = '#fff0c8';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // Aura magique : grande bulle dorée à peine visible.
    const aura = R3.ellipsoid(0.52, 0.40, 0.46, '#fcef8d', 0, 0.54, 0, {
      transparent: true, opacity: 0.17, rough: 0.3,
      side: THREE.DoubleSide, depthWrite: false,
    });
    R3.noShadow(aura);
    root.add(aura);

    // Le nuage lui-même : la « tête », faite de bouffées.
    const nuage = pivot(0, 0, 0);
    root.add(nuage);

    // Dessous gris (ombre du nuage)
    nuage.add(R3.ellipsoid(0.36, 0.15, 0.27, GRIS, 0, 0.40, 0));
    nuage.add(R3.ellipsoid(0.17, 0.11, 0.15, GRIS, -0.23, 0.43, 0.02));
    nuage.add(R3.ellipsoid(0.17, 0.11, 0.15, GRIS, 0.23, 0.43, 0.02));
    // Bouffées blanches
    nuage.add(R3.ellipsoid(0.38, 0.24, 0.30, BLANC, 0, 0.53, 0));
    nuage.add(R3.ellipsoid(0.21, 0.18, 0.19, BLANC, -0.26, 0.62, 0.01));
    nuage.add(R3.ellipsoid(0.21, 0.18, 0.19, BLANC, 0.26, 0.62, 0.01));
    nuage.add(R3.ellipsoid(0.21, 0.18, 0.19, BLANC, 0.02, 0.72, -0.03));
    nuage.add(R3.ellipsoid(0.16, 0.13, 0.15, BLANC, 0.01, 0.60, 0.17));
    // Reflets dorés du soleil sur le dessus
    [-1, 1].forEach(function (s) {
      const r = R3.ellipsoid(0.11, 0.05, 0.09, OR, s * 0.15, 0.71, 0.08);
      r.castShadow = false;
      nuage.add(r);
    });

    // Visage
    nuage.add(R3.eyes(0.145, 0.56, 0.265, 0.062));
    const sourire = R3.ellipsoid(0.045, 0.028, 0.025, '#1a1c2c', 0, 0.46, 0.28);
    sourire.castShadow = false;
    nuage.add(sourire);
    nuage.add(R3.blush(0.25, 0.48, 0.235, 0.06));

    // Deux petits lambeaux de nuage qui traînent en dessous.
    [-1, 1].forEach(function (s) {
      const w = R3.ellipsoid(0.09, 0.05, 0.07, GRIS, s * 0.21, 0.17, 0.04);
      R3.noShadow(w);
      root.add(w);
    });

    // Étincelles tout autour (le pivot leur donne un léger balancement).
    const etincelles = pivot(0, 0.54, 0);
    const POS = [
      [-0.50, 0.22, 0.04, '#f1c40f'], [0.52, 0.15, -0.03, '#fcef8d'],
      [-0.44, -0.19, 0.08, '#fcef8d'], [0.42, -0.24, 0.05, '#f1c40f'],
      [0.04, 0.38, 0.18, '#fcef8d'], [-0.13, -0.31, -0.13, '#fcef8d'],
    ];
    POS.forEach(function (q) {
      etincelles.add(sparkle(0.055, q[3], q[0], q[1], q[2], '#f1c40f'));
    });
    root.add(etincelles);

    g.userData.anim = { head: nuage, tail: etincelles, float: true };
    g.userData.baseY = 0.10;

    // Attaque « Féerie » : le nuage se gonfle, les étincelles explosent en
    // couronne, puis tout se remet en place.
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      root.position.z = k * 0.35;
      root.position.y = k * 0.18;
      nuage.scale.setScalar(1 + k * 0.18);
      etincelles.scale.setScalar(1 + k * 0.85);
      etincelles.rotation.z = R3.clamp01(p) * Math.PI * 2;
      aura.scale.setScalar(1 + k * 0.35);
    };
    return g;
  });

  // ===========================================================================
  //  MIAOUCHE — « Un adorable petit chat aux yeux immenses. »
  //  2D : chat blanc #f4f4f4, oreilles à intérieur rose #ffaad8, yeux énormes,
  //       nez #ff6b9d, moustaches #bdc3c7, nœud rose, queue en courbe.
  // ===========================================================================
  R3.registerCreature('miaouche', function () {
    const BLANC = '#f4f4f4', ROSE = '#ffaad8', VIF = '#ff6b9d', GRIS = '#bdc3c7';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // Corps rond et pattes
    root.add(R3.ellipsoid(0.25, 0.23, 0.22, BLANC, 0, 0.24, 0));
    const pattesAv = pivot(0, 0.14, 0.10);
    [-1, 1].forEach(function (s) {
      pattesAv.add(R3.ellipsoid(0.075, 0.055, 0.095, BLANC, s * 0.11, -0.085, 0.07));
    });
    root.add(pattesAv);
    [-1, 1].forEach(function (s) {
      root.add(R3.ellipsoid(0.085, 0.055, 0.075, BLANC, s * 0.17, 0.05, -0.07));
    });

    // Queue relevée en courbe (3 segments décroissants dans un pivot).
    const queue = pivot(0, 0.26, -0.19);
    queue.add(R3.ellipsoid(0.055, 0.055, 0.075, BLANC, 0, 0.03, -0.07));
    queue.add(R3.ellipsoid(0.05, 0.05, 0.06, BLANC, 0.02, 0.14, -0.11));
    queue.add(R3.ellipsoid(0.045, 0.045, 0.045, BLANC, 0.05, 0.24, -0.10));
    root.add(queue);

    // Tête (pivot au niveau du cou)
    const tete = pivot(0, 0.44, 0);
    tete.add(R3.ellipsoid(0.30, 0.28, 0.27, BLANC, 0, 0.24, 0));
    // Oreilles pointues + intérieur rose
    [-1, 1].forEach(function (s) {
      const o = R3.cone(0.13, 0.24, BLANC, s * 0.18, 0.48, -0.02, { seg: 10 });
      o.rotation.z = -s * 0.22;
      tete.add(o);
      const i = R3.cone(0.07, 0.14, ROSE, s * 0.18, 0.47, 0.045, { seg: 8 });
      i.rotation.z = -s * 0.22;
      i.castShadow = false;
      tete.add(i);
    });
    // Grands yeux brillants, nez, joues
    tete.add(R3.eyes(0.135, 0.26, 0.235, 0.085));
    tete.add(R3.sphere(0.038, VIF, 0, 0.165, 0.27));
    tete.add(R3.blush(0.235, 0.125, 0.20, 0.062));
    // Moustaches
    [-1, 1].forEach(function (s) {
      [0.02, -0.05].forEach(function (dy, i) {
        const m = R3.cyl(0.008, 0.008, 0.22, GRIS, s * 0.26, 0.17 + dy, 0.15);
        m.rotation.set(0, s * 0.35, s * (Math.PI / 2 - 0.1 - i * 0.15));
        m.castShadow = false;
        tete.add(m);
      });
    });
    // Nœud rose sur l'oreille gauche
    const noeud = pivot(-0.27, 0.47, 0.07);
    noeud.add(R3.ellipsoid(0.065, 0.05, 0.03, VIF, -0.06, 0.01, 0));
    noeud.add(R3.ellipsoid(0.065, 0.05, 0.03, VIF, 0.06, 0.01, 0));
    noeud.add(R3.sphere(0.032, ROSE, 0, 0, 0.01));
    noeud.rotation.z = 0.3;
    tete.add(noeud);
    root.add(tete);

    g.userData.anim = { head: tete, tail: queue };

    // Attaque « Griffe » : petit bond en avant, coup de patte.
    g.userData.attack = function (gg, p) {
      const k = pulse(p);
      const t = R3.clamp01(p);
      root.position.z = k * 0.48;
      root.position.y = Math.sin(t * Math.PI) * 0.26;
      root.rotation.x = -k * 0.3;
      pattesAv.rotation.x = -Math.sin(t * Math.PI * 2) * 1.1;
      tete.rotation.x = -k * 0.22;
    };
    return g;
  });

  // ===========================================================================
  //  PANDOUKI — « Un panda tout rond et doux. »
  //  2D : corps et tête blancs #f4f4f4, oreilles/taches/pattes noires #1a1c2c,
  //       ventre crème #fff0c8, museau noir.
  // ===========================================================================
  R3.registerCreature('pandouki', function () {
    const BLANC = '#f4f4f4', NOIR = '#1a1c2c', CREME = '#fff0c8';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // Corps tout rond + ventre crème
    root.add(R3.ellipsoid(0.33, 0.29, 0.29, BLANC, 0, 0.32, 0));
    const ventre = R3.ellipsoid(0.155, 0.135, 0.07, CREME, 0, 0.28, 0.26);
    ventre.castShadow = false;
    root.add(ventre);
    // Pattes arrière noires
    [-1, 1].forEach(function (s) {
      root.add(R3.ellipsoid(0.125, 0.085, 0.155, NOIR, s * 0.16, 0.075, 0.06));
    });

    // Bras noirs (pivots à l'épaule : ils font coucou pendant l'attente).
    const bras = [];
    [-1, 1].forEach(function (s) {
      const ep = pivot(s * 0.26, 0.42, 0.02);
      ep.add(R3.ellipsoid(0.095, 0.145, 0.105, NOIR, s * 0.05, -0.08, 0));
      root.add(ep);
      bras.push(ep);
    });
    // Une pousse de bambou tenue dans la patte droite.
    const tige = R3.cyl(0.022, 0.024, 0.34, '#5fbf5f', 0.10, 0.02, 0.05);
    tige.rotation.z = 0.22;
    bras[1].add(tige);
    [-1, 1].forEach(function (s) {
      const f = R3.wing(0.11, 0.045, '#7fd36a', 0.06 + s * 0.06, 0.19, 0.05);
      f.rotation.z = s * 0.9;
      f.castShadow = false;
      bras[1].add(f);
    });

    // Tête
    const tete = pivot(0, 0.56, 0);
    tete.add(R3.ellipsoid(0.29, 0.27, 0.26, BLANC, 0, 0.19, 0.01));
    // Oreilles rondes noires
    [-1, 1].forEach(function (s) {
      tete.add(R3.sphere(0.105, NOIR, s * 0.235, 0.36, -0.02));
    });
    // Taches noires autour des yeux, puis œil blanc + pupille + reflet
    [-1, 1].forEach(function (s) {
      const t = R3.ellipsoid(0.105, 0.13, 0.085, NOIR, s * 0.125, 0.20, 0.20);
      t.rotation.z = s * 0.38;
      tete.add(t);
      tete.add(R3.sphere(0.055, BLANC, s * 0.13, 0.20, 0.255));
      const pup = R3.sphere(0.032, NOIR, s * 0.135, 0.20, 0.295);
      const hi = R3.sphere(0.014, '#ffffff', s * 0.15, 0.225, 0.31);
      pup.castShadow = false; hi.castShadow = false;
      tete.add(pup, hi);
    });
    // Museau
    tete.add(R3.ellipsoid(0.055, 0.04, 0.045, NOIR, 0, 0.10, 0.265));
    const mo = R3.ellipsoid(0.03, 0.02, 0.02, NOIR, 0, 0.045, 0.255);
    mo.castShadow = false;
    tete.add(mo);
    tete.add(R3.blush(0.215, 0.085, 0.215, 0.058));
    root.add(tete);

    g.userData.anim = { head: tete, wingL: bras[0], wingR: bras[1] };

    // Attaque « Roulade » : le panda se met en boule et roule vers l'adversaire.
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      root.position.z = k * 0.55;
      root.position.y = k * 0.12;
      root.rotation.x = -t * Math.PI * 2;
      bras[0].rotation.x = bras[1].rotation.x = -k * 1.1;
      tete.rotation.x = k * 0.35;
    };
    return g;
  });

  // ===========================================================================
  //  KORONETTE — « Une fée couronnée qui répand des étoiles magiques. »
  //  2D : ailes et corps lavande #d896ff, tête rose #ffaad8, couronne dorée
  //       #f1c40f, yeux étoilés #fcec6c, baguette #8b5a2b à pommeau doré.
  // ===========================================================================
  R3.registerCreature('koronette', function () {
    const LAVANDE = '#d896ff', ROSE = '#ffaad8', OR = '#f1c40f', ETOILE = '#fcec6c';
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);

    // Corps lavande
    root.add(R3.ellipsoid(0.175, 0.205, 0.165, LAVANDE, 0, 0.42, 0));

    // Ailes translucides : grande lavande + petite rose, sur un pivot d'épaule.
    const ailes = [];
    const OPTS = { transparent: true, opacity: 0.82, rough: 0.3 };
    [-1, 1].forEach(function (s) {
      const ep = pivot(s * 0.11, 0.52, -0.07);
      const haut = R3.wing(0.24, 0.185, LAVANDE, s * 0.22, 0.10, 0, OPTS);
      haut.rotation.z = s * 0.4;
      const bas = R3.wing(0.17, 0.13, ROSE, s * 0.16, -0.11, 0, OPTS);
      bas.rotation.z = -s * 0.45;
      haut.castShadow = false; bas.castShadow = false;
      ep.add(haut, bas);
      root.add(ep);
      ailes.push(ep);
    });

    // Bras (le droit tient la baguette)
    const brasG = R3.ellipsoid(0.055, 0.11, 0.055, LAVANDE, -0.19, 0.42, 0.02);
    brasG.rotation.z = 0.3;
    root.add(brasG);
    const brasD = pivot(0.16, 0.46, 0.02);
    brasD.add(R3.ellipsoid(0.055, 0.11, 0.055, LAVANDE, 0.03, -0.05, 0));
    // Baguette : manche brun, pommeau doré lumineux, étincelle au bout.
    const manche = R3.cyl(0.018, 0.02, 0.30, '#8b5a2b', 0.12, 0.06, 0.04);
    manche.rotation.z = -0.28;
    brasD.add(manche);
    const pommeau = R3.sphere(0.062, OR, 0.16, 0.22, 0.04, {
      emissive: OR, emissiveIntensity: 0.6, rough: 0.35,
    });
    brasD.add(pommeau);
    brasD.add(sparkle(0.07, ETOILE, 0.16, 0.22, 0.10, OR));
    root.add(brasD);

    // Tête rose + couronne dorée
    const tete = pivot(0, 0.58, 0);
    tete.add(R3.ellipsoid(0.23, 0.22, 0.21, ROSE, 0, 0.15, 0));
    tete.add(R3.cyl(0.155, 0.165, 0.075, OR, 0, 0.32, 0, { seg: 14, rough: 0.35, metal: 0.35 }));
    tete.add(R3.cone(0.05, 0.13, OR, 0, 0.40, 0, { seg: 8, rough: 0.35, metal: 0.35 }));
    [-1, 1].forEach(function (s) {
      tete.add(R3.cone(0.042, 0.095, OR, s * 0.115, 0.38, 0, { seg: 8, rough: 0.35, metal: 0.35 }));
    });
    // Yeux + petites étoiles au coin des yeux
    tete.add(R3.eyes(0.095, 0.17, 0.185, 0.05));
    [-1, 1].forEach(function (s) {
      tete.add(sparkle(0.045, ETOILE, s * 0.175, 0.20, 0.145, OR));
    });
    const sourire = R3.ellipsoid(0.04, 0.022, 0.02, '#b13e53', 0, 0.06, 0.20);
    sourire.castShadow = false;
    tete.add(sourire);
    tete.add(R3.blush(0.165, 0.085, 0.175, 0.05));
    root.add(tete);

    // Poussière d'étoiles qui l'accompagne
    const poussiere = pivot(0, 0.47, 0);
    [[-0.34, 0.24, 0.06], [0.36, -0.12, -0.05], [-0.26, -0.24, 0.11]].forEach(function (q) {
      poussiere.add(sparkle(0.05, ETOILE, q[0], q[1], q[2], OR));
    });
    root.add(poussiere);

    g.userData.anim = { head: tete, wingL: ailes[0], wingR: ailes[1], tail: poussiere, float: true };
    g.userData.baseY = 0.04;

    // Attaque « Magie » : la baguette se lève, les étoiles jaillissent en avant.
    g.userData.attack = function (gg, p) {
      const t = R3.clamp01(p);
      const k = pulse(p);
      root.position.z = k * 0.28;
      root.position.y = k * 0.30;
      brasD.rotation.z = -k * 1.5;
      brasD.rotation.x = -k * 0.4;
      poussiere.scale.setScalar(1 + k * 1.2);
      poussiere.position.z = k * 0.5;
      poussiere.rotation.z = t * Math.PI * 3;
      ailes[0].rotation.z = -k * 0.9;
      ailes[1].rotation.z = k * 0.9;
      tete.rotation.x = -k * 0.15;
    };
    return g;
  });

  // Enregistrement du lot (informatif : utile au débogage en console).
  R3.register('creaturesP3', {
    ids: ['etoilamer', 'crabilino', 'nuagette', 'miaouche', 'pandouki', 'koronette'],
  });
})();
