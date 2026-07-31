// =============================================================================
//  creatures3d.p5.js — LOT E2 : LES MODÈLES 3D DES FORMES ÉVOLUÉES
// =============================================================================
//  Robin voulait que ses créatures puissent évoluer (demande n° 4). Le lot E1
//  écrit les CHAÎNES d'évolution (`evolve3d.js`) ; ici on écrit uniquement les
//  MODÈLES 3D des formes évoluées, exactement sur le patron des lots
//  creatures3d.p1..p4.js.
//
//  RÈGLE ARTISTIQUE — c'est ce qui rend l'évolution lisible pour un enfant :
//  une forme évoluée doit se lire comme LA MÊME créature, en plus grand et en
//  plus fort. On garde donc :
//    * la palette exacte de la forme de base (reprise de js/creatures.js),
//    * la silhouette générale (une goutte reste une goutte, un chat reste un chat),
//  et on ajoute UN attribut spectaculaire clairement visible : couronne, cornes,
//  ailes plus longues, crinière, cristaux, plaques d'armure, queue majestueuse.
//
//  CONVENTIONS (identiques aux lots p1..p4, voir CONTRACT.md §4) :
//    * Group centré en (0,0,0), posé sur y = 0, regardant vers +z.
//    * Tout le corps est rangé dans un sous-groupe `root` : les animations
//      d'attaque bougent `root`, JAMAIS le Group racine, dont la position
//      appartient au moteur (monde ou arène de combat).
//    * userData.anim = { head, wingL, wingR, tail, float } — c'est
//      R3.idleCreature() qui s'en sert pour l'idle calme (respiration, léger
//      balancement, battement d'ailes, rotation de la queue), animé sur
//      R3.clock.t. On y range aussi les anneaux/satellites dans `tail` : leur
//      rotation lente sur y donne gratuitement l'orbite qu'on veut voir.
//    * userData.attack = function (racine, p) avec p de 0 à 1.
//
//  BUDGET : 20 draw calls maximum par créature. Chaque modèle annonce son
//  compte dans son en-tête (compté mesh par mesh — un mesh = un draw call,
//  les matériaux étant partagés par R3.mat()). Les effets d'attaque cachés
//  (`visible = false`) ne coûtent rien tant qu'ils ne sont pas joués.
//
//  NOMMAGE — pourquoi autant d'alias : le lot E1 nomme les espèces évoluées
//  EN MÊME TEMPS que nous, sans que l'on puisse se concerter. La convention
//  imposée est `<base>on` / `<base>ar` / `<base>ix`, mais elle laisse deux
//  flottements : « petalia » donne-t-il « petaliaon » ou « petalion » ? et
//  quel suffixe pour un 3e stade ? On enregistre donc chaque modèle sous
//  toutes les orthographes plausibles (voir `evolue()` plus bas). Un builder
//  n'est appelé que si le jeu demande son id : les alias ne coûtent RIEN.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // ===========================================================================
  //  ENREGISTREMENT ET ALIAS
  // ===========================================================================

  /**
   * Les racines plausibles d'un nom d'espèce évoluée.
   * « feuillou » -> ['feuillou', 'feuillo', 'feuill'] : concaténation stricte,
   * élision d'une voyelle finale, élision de toutes les voyelles finales.
   * C'est le filet qui évite le modèle gris de secours si E1 a écrit
   * « feuillon » là où nous attendions « feuillouon ».
   */
  function racines(base) {
    const out = [base];
    const uneMoins = base.replace(/[aeiouy]$/, '');
    const toutesMoins = base.replace(/[aeiouy]+$/, '');
    [uneMoins, toutesMoins].forEach(function (r) {
      if (r.length > 2 && out.indexOf(r) < 0) out.push(r);
    });
    return out;
  }

  /**
   * Enregistre la (ou les) forme(s) évoluée(s) d'une créature de base.
   * @param {string} base       id de la créature d'origine ('flamdrak')
   * @param {function} stade2   builder de la 1re évolution (obligatoire)
   * @param {function} [stade3] builder de la 2e évolution (starters seulement)
   * Si stade3 manque, `-ar` et `-ix` retombent sur le stade 2 : mieux vaut la
   * bonne créature en un peu trop petit qu'une silhouette grise anonyme.
   */
  function evolue(base, stade2, stade3) {
    racines(base).forEach(function (r) {
      R3.registerCreature(r + 'on', stade2);
      R3.registerCreature(r + 'ar', stade3 || stade2);
      R3.registerCreature(r + 'ix', stade3 || stade2);
    });
  }

  // ===========================================================================
  //  PETITS OUTILS LOCAUX (rien n'est exporté : tout reste dans cette closure)
  // ===========================================================================

  /** Un pivot nu : sert de point de rotation, ne coûte aucun draw call. */
  function pivot(x, y, z) {
    const o = new THREE.Object3D();
    o.position.set(x || 0, y || 0, z || 0);
    return o;
  }

  /** L'ossature commune : racine + sous-groupe `root` où l'on modélise tout. */
  function shell() {
    const g = R3.group();
    const root = pivot(0, 0, 0);
    g.add(root);
    return { g: g, root: root };
  }

  /**
   * Agrandit tout le contenu d'un modèle sans jamais toucher au Group racine,
   * dont l'échelle appartient au moteur (R3.idleCreature() s'en sert pour la
   * respiration). Sert aux évolutions dont la silhouette ne peut pas grandir
   * seule sans se déformer : une étoile de mer ou un crabe restent plats, mais
   * ils doivent quand même se lire « plus gros » que leur forme de base — c'est
   * la promesse d'une évolution.
   */
  function grandir(root, k) { root.scale.setScalar(k); return root; }

  /** Détail décoratif : pas d'ombre projetée (plus propre et moins cher). */
  function deco(m) { m.castShadow = false; return m; }

  /** Courbe 0 -> 1 -> 0 : la base de presque toutes les attaques. */
  function pulse(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  /** La bibliothèque partagée des créatures, si elle a été chargée. */
  function CL() { return R3.get('clib') || null; }

  // --- Visages ---------------------------------------------------------------

  /** Yeux « mignons » standard (4 meshes) — repris tels quels de R3. */
  function bigEyes(spread, y, z, r) { return R3.eyes(spread, y, z, r); }

  /**
   * Regard ardent, version économique : 2 meshes seulement (un iris lumineux
   * par œil). C'est le regard des formes évoluées « fières » — on gagne les
   * 2 draw calls des reflets pour les mettre dans la couronne ou les ailes.
   */
  function fireEyes(spread, y, z, r, iris) {
    const g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      g.add(deco(R3.sphere(r, iris || '#f1c40f', s * spread, y, z,
        { emissive: iris || '#f1c40f', emissiveIntensity: 0.6, rough: 0.35 })));
    });
    return g;
  }

  /** Sourire en arc, 3 meshes (via clib si présente). */
  function smile3(w, depth, r, x, y, z) {
    const C = CL();
    if (C && C.mouthSmile) {
      return C.mouthSmile({ w: w, depth: depth, r: r, count: 3, x: x, y: y, z: z });
    }
    return R3.group(deco(R3.ellipsoid(w, r, r * 0.8, '#1a1c2c', x, y - depth * 0.5, z)));
  }

  // --- Attributs spectaculaires ---------------------------------------------

  /**
   * Paire de cornes symétriques (2 meshes). Pivot du cône au centre : on le
   * place donc à `base + len/2`. `tilt` incline vers l'arrière, `spread` écarte.
   */
  function hornPair(len, r, color, x, y, z, tilt, spread) {
    const g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      const c = R3.cone(r, len, color, s * x, y, z,
        { flat: true, rough: 0.5, seg: 8 });
      c.rotation.x = tilt || 0;
      c.rotation.z = -s * (spread || 0);
      g.add(c);
    });
    return g;
  }

  /**
   * Couronne flottante : un anneau posé à plat + n pointes (1 + n meshes).
   * C'est l'attribut le plus lisible de tous — un enfant comprend « roi »
   * en un coup d'œil, même de loin et même de dos.
   */
  function crownRing(r, tube, color, n, spikeLen, spikeColor) {
    const g = new THREE.Group();
    const anneau = R3.torus(r, tube, color, 0, 0, 0,
      { rough: 0.35, metal: 0.25, seg: 14, emissive: color, emissiveIntensity: 0.18 });
    anneau.rotation.x = Math.PI / 2;
    g.add(deco(anneau));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const p = R3.cone(tube * 1.9, spikeLen, spikeColor || color,
        Math.cos(a) * r, spikeLen * 0.5, Math.sin(a) * r,
        { flat: true, rough: 0.35, seg: 6, emissive: spikeColor || color, emissiveIntensity: 0.25 });
      g.add(deco(p));
    }
    return g;
  }

  /**
   * Anneau en orbite (1 mesh). À ranger dans `anim.tail` : R3.idleCreature()
   * lui applique une lente rotation sur y — l'orbite est alors gratuite.
   */
  function orbitRing(r, tube, color, tilt) {
    const g = new THREE.Group();
    const t = R3.torus(r, tube, color, 0, 0, 0,
      { transparent: true, opacity: 0.72, rough: 0.25, seg: 16,
        emissive: color, emissiveIntensity: 0.5, depthWrite: false });
    t.rotation.x = Math.PI / 2 + (tilt || 0);
    g.add(deco(t));
    return g;
  }

  /**
   * Rangée de pointes (crête dorsale, épines, cristaux) : 1 mesh par entrée.
   * liste = [[x, y, z, rayon, longueur, inclinaisonX], ...]
   */
  function spikeRow(liste, color, opts) {
    const g = new THREE.Group();
    const o = opts || {};
    liste.forEach(function (s) {
      const c = R3.cone(s[3], s[4], color, s[0], s[1], s[2], {
        flat: o.flat !== false, rough: o.rough !== undefined ? o.rough : 0.45, seg: o.seg || 7,
        emissive: o.emissive || undefined,
        emissiveIntensity: o.emissive ? (o.emissiveIntensity || 0.3) : undefined,
      });
      c.rotation.x = s[5] || 0;
      if (o.flatten) c.scale.z = o.flatten;
      g.add(deco(c));
    });
    return g;
  }

  /**
   * Aile membranée COMPACTE : 2 meshes (membrane + bras). Pivot à l'épaule,
   * l'aile se déploie vers +x ; side = -1 la retourne pour le côté gauche.
   * (On n'utilise jamais une échelle négative : elle casserait l'éclairage.)
   */
  function wing2(len, h, membrane, bone, side) {
    const g = new THREE.Group();
    const th = Math.max(0.012, len * 0.05);
    const mem = R3.ellipsoid(len * 0.55, h * 0.52, th, membrane,
      len * 0.47, -h * 0.05, 0, { side: THREE.DoubleSide, rough: 0.72 });
    mem.rotation.z = 0.18;
    g.add(deco(mem));
    const arm = R3.cyl(th * 0.9, th * 1.8, len * 0.94, bone,
      len * 0.45, h * 0.17, 0, { rough: 0.6, seg: 6 });
    arm.rotation.z = -Math.PI / 2 + 0.24;
    g.add(arm);
    if (side < 0) g.rotation.y = Math.PI;
    return g;
  }

  /** Aile emplumée compacte : 2 meshes (grande plume + couverture). */
  function featherWing(len, h, color, shade, side) {
    const g = new THREE.Group();
    const p1 = R3.ellipsoid(len * 0.55, h * 0.30, len * 0.16, color,
      len * 0.50, 0, -len * 0.06, { rough: 0.9 });
    p1.rotation.z = 0.20;
    g.add(p1);
    const p2 = R3.ellipsoid(len * 0.34, h * 0.22, len * 0.13, shade,
      len * 0.30, -h * 0.10, len * 0.05, { rough: 0.92 });
    p2.rotation.z = 0.30;
    g.add(deco(p2));
    if (side < 0) g.rotation.y = Math.PI;
    return g;
  }

  /** Touffe de flammes (count + 1 meshes) — via clib, sinon repli maison. */
  function flames(h, r, count, color, core, x, y, z) {
    const C = CL();
    if (C && C.flameTuft) {
      return C.flameTuft({ h: h, r: r, count: count, color: color,
        coreColor: core, x: x, y: y, z: z });
    }
    const g = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const u = (count === 1) ? 0 : (i / (count - 1)) * 2 - 1;
      const fh = h * (1 - Math.abs(u) * 0.38);
      const f = R3.cone(r * (1 - Math.abs(u) * 0.3), fh, color,
        u * r * 0.85, fh * 0.5, -u * r * 0.25,
        { emissive: color, emissiveIntensity: 0.55, rough: 0.45, seg: 9 });
      f.rotation.z = -u * 0.45;
      g.add(f);
    }
    g.add(deco(R3.cone(r * 0.48, h * 0.66, core, 0, h * 0.34, r * 0.1,
      { emissive: core, emissiveIntensity: 0.95, rough: 0.35, seg: 8 })));
    g.position.set(x || 0, y || 0, z || 0);
    return g;
  }

  /** Nageoire caudale (1 attache + n lobes meshes) — via clib si présente. */
  function fin(len, h, color, lobes, x, y, z) {
    const C = CL();
    if (C && C.finTail) {
      return C.finTail({ len: len, height: h, color: color, lobes: lobes,
        x: x, y: y, z: z });
    }
    const g = new THREE.Group();
    for (let i = 0; i < lobes; i++) {
      const s = (lobes === 1) ? 0 : (i === 0 ? 1 : -1);
      const l = R3.ellipsoid(len * 0.07, h * 0.52, len * 0.60, color,
        0, s * h * 0.30, -len * 0.58, { side: THREE.DoubleSide, rough: 0.75 });
      l.rotation.x = -s * 0.35;
      g.add(deco(l));
    }
    g.position.set(x || 0, y || 0, z || 0);
    return g;
  }

  /** Couronne de pétales (n meshes) — via clib si présente. */
  function petals(count, r, len, wid, thick, color, start, y, z) {
    const C = CL();
    if (C && C.petalRing) {
      return C.petalRing({ count: count, r: r, petalLen: len, petalWid: wid,
        thick: thick, color: color, start: start, y: y, z: z });
    }
    const g = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const a = (start || Math.PI / 2) + (i / count) * Math.PI * 2;
      const p = new THREE.Group();
      p.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      p.rotation.z = a;
      p.add(R3.ellipsoid(len * 0.5, wid * 0.5, thick * 0.5, color, 0, 0, 0, { rough: 0.85 }));
      g.add(p);
    }
    g.position.set(0, y || 0, z || 0);
    return g;
  }

  /** Oreille (2 meshes) — via clib si présente. */
  function ear(h, w, color, inner, shape, x, y, z) {
    const C = CL();
    if (C && C.ear) {
      return C.ear({ h: h, w: w, color: color, innerColor: inner,
        shape: shape, x: x, y: y, z: z });
    }
    const g = new THREE.Group();
    g.add(R3.ellipsoid(w * 0.5, h * 0.5, w * 0.3, color, 0, h * 0.5, 0));
    g.add(deco(R3.ellipsoid(w * 0.28, h * 0.32, w * 0.16, inner, 0, h * 0.48, w * 0.19)));
    g.position.set(x || 0, y || 0, z || 0);
    return g;
  }

  /** Petite étoile lumineuse (1 mesh) : étincelles et satellites. */
  function sparkle(r, color, x, y, z) {
    const s = R3.star(4, r, r * 0.32, r * 0.5, color, x, y, z,
      { emissive: color, emissiveIntensity: 0.9, rough: 0.35 });
    s.castShadow = false; s.receiveShadow = false;
    return s;
  }

  // ###########################################################################
  //  FAMILLE DU LOT 1 — feuillou · petalia · goutella · bullini · etincelo ·
  //                     meduzia · coralou
  // ###########################################################################

  // ===========================================================================
  //  FEUILLOU -> stade 2 : l'arbrisseau vivant.
  //  Même feuille, même vert, mais elle a poussé sur un vrai petit tronc et
  //  porte trois bourgeons dorés — c'est l'attribut spectaculaire.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildFeuillouon() {
    const VERT_SOMBRE = '#1e8449', VERT = '#27ae60', VERT_CLAIR = '#38b764';
    const BOIS = '#8b5a2b', OR = '#fde74c';
    const s = shell(), root = s.root;

    // Tronc et racines : la créature ne flotte plus, elle est plantée.
    root.add(R3.cyl(0.075, 0.115, 0.34, BOIS, 0, 0.17, 0, { rough: 0.95, seg: 9 }));   // 1
    root.add(R3.ellipsoid(0.17, 0.065, 0.16, BOIS, 0, 0.04, 0, { rough: 0.95 }));      // 2
    [-1, 1].forEach(function (k) {
      root.add(deco(R3.ellipsoid(0.10, 0.045, 0.07, BOIS, k * 0.13, 0.045, 0.05,
        { rough: 1 })));                                                               // 3, 4
    });

    // La grande feuille : c'est elle qui porte le visage, donc c'est la « tête ».
    const feuille = pivot(0, 0.34, 0);
    root.add(feuille);
    feuille.add(R3.ellipsoid(0.44, 0.50, 0.09, VERT_SOMBRE, 0, 0.46, -0.02));          // 5
    feuille.add(R3.ellipsoid(0.39, 0.45, 0.12, VERT, 0, 0.46, 0.02));                  // 6
    feuille.add(deco(R3.ellipsoid(0.25, 0.29, 0.09, VERT_CLAIR, 0, 0.52, 0.065)));     // 7
    feuille.add(R3.cone(0.16, 0.32, VERT, 0, 1.00, 0.005, { seg: 10 }));               // 8

    // Visage, un cran plus haut et plus assuré que chez Feuillou.
    feuille.add(bigEyes(0.145, 0.53, 0.135, 0.066));                                   // 9-12
    feuille.add(smile3(0.095, 0.038, 0.022, 0, 0.375, 0.175));                         // 13-15

    // ATTRIBUT SPECTACULAIRE : trois bourgeons dorés en couronne au sommet.
    const bourgeons = pivot(0, 0.34, 0);
    root.add(bourgeons);
    [[-0.20, 0.86, 0.06], [0.21, 0.90, 0.04], [0.01, 1.16, 0.02]].forEach(function (b) {
      bourgeons.add(deco(R3.sphere(0.062, OR, b[0], b[1], b[2],
        { emissive: OR, emissiveIntensity: 0.45, rough: 0.35 })));                     // 16-18
    });

    // Une foliole latérale qui bat comme une aile.
    const aileL = pivot(-0.22, 0.46, 0.02);
    const foliole = R3.ellipsoid(0.19, 0.055, 0.10, VERT_CLAIR, -0.18, 0, 0, { rough: 0.9 });
    foliole.rotation.z = 0.55;
    aileL.add(deco(foliole));                                                          // 19
    root.add(aileL);

    s.g.userData.anim = { head: feuille, tail: bourgeons, wingL: aileL };
    s.g.userData.attack = function (gg, p) {
      // « Lame feuille » : la feuille se vrille et fauche vers l'avant.
      const k = pulse(p);
      root.position.z = k * 0.55;
      root.position.y = k * 0.18;
      feuille.rotation.y = R3.clamp01(p) * Math.PI * 4;
      feuille.rotation.x = -k * 0.32;
      if (p >= 1) { feuille.rotation.y = 0; feuille.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  FEUILLOU -> stade 3 : le grand arbre-gardien.
  //  Le tronc est devenu massif, deux bras-branches encadrent une couronne
  //  feuillue, et la sève a cristallisé en trois éclats dorés.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildFeuillouar() {
    const VERT_SOMBRE = '#1e8449', VERT = '#27ae60', VERT_CLAIR = '#38b764';
    const BOIS = '#8b5a2b', BOIS_SOMBRE = '#5c2e0d', OR = '#fde74c';
    const s = shell(), root = s.root;

    // Tronc massif + contreforts.
    root.add(R3.cyl(0.17, 0.27, 0.62, BOIS, 0, 0.31, 0, { rough: 0.95, seg: 10 }));    // 1
    root.add(R3.ellipsoid(0.34, 0.10, 0.32, BOIS_SOMBRE, 0, 0.05, 0, { rough: 1 }));   // 2
    [-1, 1].forEach(function (k) {
      root.add(deco(R3.ellipsoid(0.13, 0.06, 0.10, BOIS_SOMBRE, k * 0.24, 0.06, 0.06,
        { rough: 1 })));                                                               // 3, 4
    });

    // Bras-branches : ils battent lentement comme des ailes de bois.
    const brasL = pivot(-0.20, 0.62, 0.0), brasR = pivot(0.20, 0.62, 0.0);
    [[brasL, -1], [brasR, 1]].forEach(function (b) {
      const m = R3.cyl(0.045, 0.075, 0.34, BOIS, b[1] * 0.16, 0.06, 0, { rough: 0.92, seg: 7 });
      m.rotation.z = -b[1] * 1.05;
      b[0].add(m);                                                                     // 5, 6
    });
    root.add(brasL, brasR);

    // Couronne feuillue : trois grandes masses, c'est la « tête ».
    const cime = pivot(0, 0.74, 0);
    root.add(cime);
    cime.add(R3.ellipsoid(0.42, 0.30, 0.36, VERT_SOMBRE, 0, 0.12, -0.03));             // 7
    cime.add(R3.ellipsoid(0.34, 0.26, 0.30, VERT, -0.16, 0.30, 0.04));                 // 8
    cime.add(R3.ellipsoid(0.30, 0.24, 0.27, VERT_CLAIR, 0.18, 0.32, 0.02));            // 9

    // Regard grave d'un vieil arbre : deux yeux d'ambre dans l'écorce.
    root.add(fireEyes(0.115, 0.46, 0.24, 0.058, '#fde74c'));                           // 10, 11

    // ATTRIBUT SPECTACULAIRE : trois cristaux de sève dorés, plantés en cime.
    const cristaux = pivot(0, 0.74, 0);
    root.add(cristaux);
    cristaux.add(spikeRow([
      [-0.26, 0.52, 0.06, 0.055, 0.24, -0.30],
      [0.00, 0.66, -0.02, 0.065, 0.32, 0.00],
      [0.27, 0.50, 0.04, 0.052, 0.22, 0.28],
    ], OR, { emissive: OR, emissiveIntensity: 0.5 }));                                 // 12-14

    // Crête d'écorce le long du tronc : la silhouette reste « arbre ».
    root.add(spikeRow([
      [0, 0.30, -0.24, 0.075, 0.20, -0.55],
      [0, 0.48, -0.22, 0.065, 0.18, -0.50],
    ], BOIS_SOMBRE, { flatten: 0.4 }));                                                // 15, 16

    // Trois grandes feuilles-lames qui pendent, majestueuses.
    const feuillage = pivot(0, 0.66, 0);
    root.add(feuillage);
    [[-0.40, 0.02, 0.10, 0.7], [0.42, 0.00, 0.06, -0.7], [0.0, -0.04, 0.34, 0.0]]
      .forEach(function (f) {
        const l = R3.ellipsoid(0.20, 0.05, 0.12, VERT_CLAIR, f[0], f[1], f[2], { rough: 0.9 });
        l.rotation.z = f[3];
        feuillage.add(deco(l));                                                        // 17-19
      });

    s.g.userData.anim = { head: cime, wingL: brasL, wingR: brasR, tail: cristaux };
    s.g.userData.attack = function (gg, p) {
      // « Rayon solaire » : l'arbre se cabre, la cime s'ouvre et rayonne.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.34;
      root.rotation.x = -k * 0.16;
      cime.scale.setScalar(1 + k * 0.28);
      cristaux.rotation.y = t * Math.PI * 3;
      cristaux.scale.setScalar(1 + k * 0.6);
      feuillage.rotation.x = -k * 0.4;
      if (p >= 1) { cime.scale.setScalar(1); cristaux.scale.setScalar(1); feuillage.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  PETALIA -> stade 2 : la fleur royale.
  //  Deux corolles au lieu d'une, et un diadème d'or autour du cœur.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildPetaliaon() {
    const ROSE = '#ffaad8', ROSE_VIF = '#ff6b9d';
    const OR = '#f1c40f', OR_CLAIR = '#fde74c';
    const TIGE = '#27ae60', FEUILLE = '#38b764';
    const s = shell(), root = s.root;

    root.add(R3.ellipsoid(0.17, 0.06, 0.17, TIGE, 0, 0.04, 0, { rough: 0.9 }));        // 1
    root.add(R3.cyl(0.055, 0.080, 0.66, TIGE, 0, 0.37, 0, { rough: 0.85, seg: 8 }));   // 2
    const fe = R3.ellipsoid(0.20, 0.05, 0.10, FEUILLE, 0.19, 0.30, 0.01, { rough: 0.9 });
    fe.rotation.z = 0.55;
    root.add(deco(fe));                                                                // 3

    // Corolle : pivot au cœur de la fleur, elle suit le soleil.
    const tete = pivot(0, 0.80, 0);
    root.add(tete);
    tete.add(petals(5, 0.30, 0.34, 0.24, 0.10, ROSE_VIF, Math.PI / 2, 0, -0.02));      // 4-8
    tete.add(petals(4, 0.20, 0.26, 0.19, 0.09, ROSE, Math.PI / 4, 0, 0.05));           // 9-12
    tete.add(R3.ellipsoid(0.175, 0.175, 0.11, OR, 0, 0, 0.055, { rough: 0.8 }));       // 13
    tete.add(deco(R3.ellipsoid(0.130, 0.130, 0.085, OR_CLAIR, 0, 0.015, 0.095,
      { rough: 0.75 })));                                                              // 14

    tete.add(bigEyes(0.072, 0.035, 0.165, 0.040));                                     // 15-18

    // ATTRIBUT SPECTACULAIRE : le diadème d'or, un anneau qui ceint le cœur.
    const diademe = R3.torus(0.215, 0.028, OR, 0, 0.02, 0.02,
      { rough: 0.3, metal: 0.3, seg: 16, emissive: OR, emissiveIntensity: 0.25 });
    tete.add(deco(diademe));                                                           // 19

    s.g.userData.anim = { head: tete, tail: null };
    s.g.userData.attack = function (gg, p) {
      // « Tempête de pétales » : la double corolle s'ouvre et tournoie.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.36;
      root.rotation.x = -k * 0.26;
      tete.rotation.z = t * Math.PI * 3;
      tete.scale.setScalar(1 + k * 0.3);
      if (p >= 1) { tete.rotation.z = 0; tete.scale.setScalar(1); }
    };
    return s.g;
  }

  // ===========================================================================
  //  GOUTELLA -> stade 2 : la goutte couronnée.
  //  Toujours la même goutte bleue, mais ceinte d'une couronne de glace et
  //  escortée de deux gouttelettes en orbite.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildGoutellaon() {
    const BLEU_SOMBRE = '#3b5dc9', BLEU = '#41a6f6', CYAN = '#73eff7';
    const s = shell(), root = s.root;

    const corps = pivot(0, 0.42, 0);
    root.add(corps);
    corps.add(R3.ellipsoid(0.40, 0.38, 0.38, BLEU, 0, 0, 0, { rough: 0.45 }));         // 1
    corps.add(R3.ellipsoid(0.395, 0.22, 0.375, BLEU_SOMBRE, 0, -0.19, 0, { rough: 0.5 })); // 2
    corps.add(R3.cone(0.24, 0.50, BLEU, 0, 0.48, 0, { rough: 0.45, seg: 12 }));        // 3
    const film = R3.ellipsoid(0.43, 0.41, 0.41, CYAN, 0, 0, 0,
      { transparent: true, opacity: 0.24, rough: 0.08, depthWrite: false });
    corps.add(deco(film));                                                             // 4
    const r1 = R3.ellipsoid(0.10, 0.14, 0.06, CYAN, -0.185, 0.125, 0.29, { rough: 0.2 });
    r1.rotation.z = 0.4;
    corps.add(deco(r1));                                                               // 5
    corps.add(deco(R3.ellipsoid(0.042, 0.07, 0.035, CYAN, -0.09, 0.30, 0.17, { rough: 0.2 }))); // 6

    corps.add(bigEyes(0.16, 0.055, 0.35, 0.075));                                      // 7-10
    corps.add(smile3(0.105, 0.05, 0.024, 0, -0.135, 0.345));                           // 11-13

    // ATTRIBUT SPECTACULAIRE : la couronne de glace au sommet de la goutte.
    const couronne = crownRing(0.19, 0.030, CYAN, 3, 0.20, '#a8e6ff');
    couronne.position.set(0, 0.78, 0);
    corps.add(couronne);                                                               // 14-17

    // Deux gouttelettes satellites : elles tournent avec `tail`.
    const satellites = pivot(0, 0.62, 0);
    root.add(satellites);
    satellites.add(deco(R3.sphere(0.062, CYAN, 0.42, 0.10, 0.04,
      { transparent: true, opacity: 0.75, rough: 0.1 })));                             // 18
    satellites.add(deco(R3.sphere(0.048, CYAN, -0.40, 0.24, -0.05,
      { transparent: true, opacity: 0.75, rough: 0.1 })));                             // 19

    s.g.userData.anim = { head: corps, tail: satellites, float: true };
    s.g.userData.baseY = 0.04;
    s.g.userData.attack = function (gg, p) {
      // « Jet d'eau » : la goutte se comprime, puis se détend d'un coup.
      const k = pulse(p);
      root.position.z = k * 0.30;
      corps.scale.set(1 + k * 0.18, 1 - k * 0.18, 1 + k * 0.18);
      satellites.rotation.y = R3.clamp01(p) * Math.PI * 4;
      satellites.scale.setScalar(1 + k * 0.7);
      if (p >= 1) { corps.scale.setScalar(1); satellites.scale.setScalar(1); }
    };
    return s.g;
  }

  // ===========================================================================
  //  GOUTELLA -> stade 3 : le souverain des eaux.
  //  La goutte s'est dressée en vague, porte une haute couronne de glace,
  //  deux bras d'eau et une traîne liquide. Il lévite.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildGoutellaar() {
    const BLEU_SOMBRE = '#3b5dc9', BLEU = '#41a6f6', CYAN = '#73eff7', GLACE = '#a8e6ff';
    const s = shell(), root = s.root;

    // Corps en vague dressée.
    const corps = pivot(0, 0.52, 0);
    root.add(corps);
    corps.add(R3.ellipsoid(0.34, 0.44, 0.33, BLEU, 0, 0, 0, { rough: 0.42 }));         // 1
    corps.add(R3.ellipsoid(0.33, 0.22, 0.32, BLEU_SOMBRE, 0, -0.28, 0, { rough: 0.5 })); // 2
    corps.add(deco(R3.ellipsoid(0.37, 0.47, 0.36, CYAN, 0, 0.01, 0,
      { transparent: true, opacity: 0.22, rough: 0.08, depthWrite: false })));         // 3
    // La crête de la vague, qui retombe vers l'arrière.
    const crete = R3.ellipsoid(0.20, 0.13, 0.16, CYAN, 0, 0.44, -0.16, { rough: 0.25 });
    crete.rotation.x = -0.5;
    corps.add(deco(crete));                                                            // 4

    corps.add(bigEyes(0.14, 0.10, 0.31, 0.068));                                       // 5-8

    // ATTRIBUT SPECTACULAIRE 1 : la haute couronne de glace à quatre pointes.
    const couronne = crownRing(0.22, 0.034, GLACE, 4, 0.28, GLACE);
    couronne.position.set(0, 0.62, 0);
    corps.add(couronne);                                                               // 9-13

    // ATTRIBUT SPECTACULAIRE 2 : deux bras d'eau qui encadrent le souverain.
    const brasL = pivot(-0.32, 0.58, 0.02), brasR = pivot(0.32, 0.58, 0.02);
    [[brasL, -1], [brasR, 1]].forEach(function (b) {
      const m = R3.ellipsoid(0.10, 0.21, 0.10, BLEU, b[1] * 0.06, -0.06, 0,
        { transparent: true, opacity: 0.85, rough: 0.3 });
      m.rotation.z = -b[1] * 0.35;
      b[0].add(deco(m));                                                               // 14, 15
    });
    root.add(brasL, brasR);

    // Traîne liquide : trois lobes qui ondulent derrière lui.
    const traine = pivot(0, 0.26, -0.20);
    root.add(traine);
    [[0, -0.02, -0.14, 0.17], [0, -0.08, -0.34, 0.13], [0, -0.13, -0.52, 0.09]]
      .forEach(function (t) {
        traine.add(deco(R3.ellipsoid(t[3], t[3] * 0.55, t[3] * 1.3, CYAN, t[0], t[1], t[2],
          { transparent: true, opacity: 0.7, rough: 0.2 })));                          // 16-18
      });

    // Anneau d'eau en orbite : c'est lui qui fait « légendaire des mers ».
    const anneau = orbitRing(0.52, 0.022, CYAN, 0.22);
    anneau.position.set(0, 0.50, 0);
    root.add(anneau);                                                                  // 19

    s.g.userData.anim = { head: corps, wingL: brasL, wingR: brasR, tail: anneau, float: true };
    s.g.userData.baseY = 0.06;
    s.g.userData.attack = function (gg, p) {
      // « Hydromoteur » : il se dresse, puis déferle en avant comme une vague.
      const t = R3.clamp01(p);
      const charge = Math.sin(Math.min(1, t / 0.35) * Math.PI * 0.5);
      const vague = pulse(Math.max(0, (t - 0.30) / 0.70));
      root.position.y = charge * 0.20 - vague * 0.05;
      root.position.z = -charge * 0.10 + vague * 0.50;
      root.rotation.x = -vague * 0.28;
      corps.scale.set(1 + vague * 0.20, 1 + charge * 0.22 - vague * 0.18, 1 + vague * 0.20);
      traine.rotation.x = -vague * 0.45;
      anneau.scale.setScalar(1 + vague * 0.8);
      if (p >= 1) { corps.scale.setScalar(1); anneau.scale.setScalar(1); }
    };
    return s.g;
  }

  // ===========================================================================
  //  BULLINI -> stade 2 : le poisson-voile.
  //  Même petit poisson bleu, mais avec une voile dorsale immense, de longues
  //  nageoires-voiles et une caudale à trois lobes.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildBullinion() {
    const BLEU = '#41a6f6', CYAN = '#73eff7', VENTRE = '#bce884', NAGE = '#3b5dc9';
    const s = shell(), root = s.root;

    const corps = pivot(0, 0.46, 0);
    root.add(corps);
    corps.add(R3.ellipsoid(0.32, 0.30, 0.40, CYAN, 0, 0, 0, { rough: 0.5 }));          // 1
    corps.add(R3.ellipsoid(0.285, 0.22, 0.36, BLEU, 0, 0.09, -0.02, { rough: 0.5 }));  // 2
    corps.add(deco(R3.ellipsoid(0.23, 0.145, 0.30, VENTRE, 0, -0.17, 0.03, { rough: 0.85 }))); // 3

    // ATTRIBUT SPECTACULAIRE : la voile dorsale, haute comme le corps.
    const voile = R3.ellipsoid(0.028, 0.30, 0.22, NAGE, 0, 0.50, -0.04,
      { side: THREE.DoubleSide, rough: 0.6 });
    voile.rotation.x = -0.20;
    corps.add(voile);                                                                  // 4
    corps.add(deco(R3.ellipsoid(0.034, 0.20, 0.05, CYAN, 0, 0.46, 0.10,
      { side: THREE.DoubleSide, rough: 0.4 })));                                       // 5
    corps.add(deco(R3.ellipsoid(0.034, 0.16, 0.05, CYAN, 0, 0.44, -0.18,
      { side: THREE.DoubleSide, rough: 0.4 })));                                       // 6

    // Caudale à trois lobes : la queue est devenue majestueuse.
    const queue = fin(0.38, 0.44, NAGE, 3, 0, 0.02, -0.37);
    corps.add(queue);                                                                  // 7-10

    // Longues nageoires-voiles latérales (elles battent lentement).
    const nagL = pivot(-0.29, -0.04, 0.05), nagR = pivot(0.29, -0.04, 0.05);
    [[nagL, -1], [nagR, 1]].forEach(function (n) {
      const m = R3.ellipsoid(0.21, 0.038, 0.13, NAGE, n[1] * 0.17, -0.03, -0.02,
        { side: THREE.DoubleSide, rough: 0.6 });
      m.rotation.z = n[1] * 0.42;
      n[0].add(deco(m));                                                               // 11, 12
    });
    corps.add(nagL, nagR);

    corps.add(bigEyes(0.16, 0.085, 0.35, 0.076));                                      // 13-16
    corps.add(smile3(0.082, 0.036, 0.021, 0, -0.115, 0.375));                          // 17-19

    s.g.userData.anim = { head: corps, wingL: nagL, wingR: nagR, tail: queue, float: true };
    s.g.userData.baseY = 0.07;
    s.g.userData.attack = function (gg, p) {
      // « Bulle d'eau » : il gonfle, fonce, et sa voile claque derrière lui.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.62;
      root.rotation.x = -k * 0.26;
      corps.scale.setScalar(1 + k * 0.20);
      queue.rotation.y = Math.sin(t * Math.PI * 6) * 0.55;
      if (p >= 1) { corps.scale.setScalar(1); queue.rotation.y = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  ÉTINCELO -> stade 2 : la comète dorée.
  //  L'étoile a six branches, un anneau de lumière en orbite et une traîne
  //  de feu qui la suit. Elle lévite.
  //  Budget : 18 draw calls.
  // ===========================================================================
  function buildEtinceloon() {
    const OR = '#f1c40f', HALO = '#fcef8d', COEUR = '#fff0c8';
    const s = shell(), root = s.root;

    const etoile = pivot(0, 0.62, 0);
    root.add(etoile);

    // Halo diffus, puis l'étoile à six branches, puis le cœur brûlant.
    etoile.add(deco(R3.star(6, 0.58, 0.20, 0.05, HALO, 0, 0, -0.05, {
      transparent: true, opacity: 0.42, emissive: HALO, emissiveIntensity: 0.7,
      rough: 0.4, depthWrite: false,
    })));                                                                              // 1
    etoile.add(R3.star(6, 0.46, 0.155, 0.13, OR, 0, 0, 0.01, {
      emissive: OR, emissiveIntensity: 0.55, rough: 0.35,
    }));                                                                               // 2
    etoile.add(deco(R3.sphere(0.145, COEUR, 0, 0, 0.10,
      { emissive: COEUR, emissiveIntensity: 0.95, rough: 0.3 })));                     // 3

    etoile.add(bigEyes(0.078, 0.035, 0.195, 0.042));                                   // 4-7
    etoile.add(smile3(0.058, 0.026, 0.016, 0, -0.062, 0.195));                         // 8-10

    // ATTRIBUT SPECTACULAIRE : l'anneau de lumière en orbite autour d'elle.
    const anneau = orbitRing(0.66, 0.024, HALO, 0.35);
    anneau.position.set(0, 0.62, 0);
    root.add(anneau);                                                                  // 11

    // Quatre étincelles satellites, dans le même groupe pour tourner ensemble.
    const scintilles = pivot(0, 0.62, 0);
    root.add(scintilles);
    [[0.56, 0.36, -0.10], [-0.60, 0.14, 0.08], [0.46, -0.38, 0.06], [-0.44, -0.30, -0.10]]
      .forEach(function (q, i) {
        const st = sparkle(0.075 + i * 0.008, OR, q[0], q[1], q[2]);
        st.rotation.z = i * 0.7;
        scintilles.add(st);                                                            // 12-15
      });

    // Traîne de comète : trois cônes lumineux effilés derrière elle.
    const traine = pivot(0, 0.62, -0.20);
    root.add(traine);
    [[0.10, 0.30, 0.00], [0.075, 0.24, -0.22], [0.05, 0.18, -0.40]].forEach(function (t) {
      const c = R3.cone(t[0], t[1], HALO, 0, 0, t[2], {
        transparent: true, opacity: 0.6, emissive: HALO, emissiveIntensity: 0.8,
        rough: 0.35, seg: 7, depthWrite: false,
      });
      c.rotation.x = -Math.PI / 2;
      traine.add(deco(c));                                                             // 16-18
    });

    grandir(root, 1.09);   // Étincelo était déjà haut perché : on en rajoute

    s.g.userData.anim = { head: etoile, tail: scintilles, float: true };
    s.g.userData.baseY = 0.08;
    s.g.userData.attack = function (gg, p) {
      // « Explosion d'étoiles » : elle tournoie, jaillit, et sa traîne s'étire.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.60;
      root.position.y = k * 0.24;
      etoile.rotation.z = t * t * Math.PI * 6;
      etoile.scale.setScalar(1 + k * 0.5);
      scintilles.rotation.z = -t * Math.PI * 4;
      scintilles.scale.setScalar(1 + k * 0.9);
      anneau.scale.setScalar(1 + k * 0.7);
      traine.scale.set(1, 1, 1 + k * 1.8);
      if (p >= 1) {
        etoile.scale.setScalar(1); scintilles.scale.setScalar(1);
        anneau.scale.setScalar(1); traine.scale.setScalar(1);
      }
    };
    return s.g;
  }

  // ===========================================================================
  //  MÉDUZIA -> stade 2 : la méduse royale.
  //  Même cloche gélatineuse mauve et rose, mais couronnée de trois pointes
  //  et lestée de quatre longs tentacules à deux segments.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildMeduziaon() {
    const MAUVE = '#d896ff', ROSE = '#ffaad8', VIOLET = '#9b59b6';
    const s = shell(), root = s.root;

    const dome = pivot(0, 0.74, 0);
    root.add(dome);
    dome.add(R3.ellipsoid(0.44, 0.38, 0.44, MAUVE, 0, 0, 0,
      { transparent: true, opacity: 0.80, rough: 0.22 }));                             // 1
    dome.add(deco(R3.ellipsoid(0.34, 0.28, 0.34, ROSE, 0, 0.035, 0.01, { rough: 0.45 }))); // 2
    const bord = R3.torus(0.425, 0.044, VIOLET, 0, -0.165, 0, { rough: 0.5, seg: 16 });
    bord.rotation.x = Math.PI / 2;
    dome.add(bord);                                                                    // 3
    dome.add(deco(R3.ellipsoid(0.13, 0.06, 0.10, '#ffffff', -0.10, 0.34, 0.09,
      { transparent: true, opacity: 0.55, rough: 0.1 })));                             // 4

    // ATTRIBUT SPECTACULAIRE : la couronne de trois pointes sur le dôme.
    dome.add(spikeRow([
      [-0.17, 0.42, 0.02, 0.055, 0.22, -0.25],
      [0.00, 0.50, -0.02, 0.065, 0.28, 0.00],
      [0.18, 0.42, 0.02, 0.052, 0.21, 0.25],
    ], VIOLET, { emissive: MAUVE, emissiveIntensity: 0.35 }));                         // 5-7

    dome.add(bigEyes(0.15, 0.015, 0.38, 0.068));                                       // 8-11

    // Quatre tentacules à deux segments : ils ondulent tous ensemble.
    const tentacules = pivot(0, 0.60, 0);
    root.add(tentacules);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.5;
      const tx = Math.cos(a) * 0.28, tz = Math.sin(a) * 0.28;
      const t = pivot(tx, 0, tz);
      t.add(R3.ellipsoid(0.044, 0.17, 0.044, ROSE, 0, -0.16, 0, { rough: 0.6 }));      // 12,14,16,18
      const s2 = R3.ellipsoid(0.034, 0.16, 0.034, ROSE,
        Math.cos(a) * 0.07, -0.44, Math.sin(a) * 0.07, { rough: 0.6 });
      s2.rotation.z = -Math.cos(a) * 0.32;
      s2.rotation.x = Math.sin(a) * 0.32;
      t.add(deco(s2));                                                                 // 13,15,17,19
      tentacules.add(t);
    }

    s.g.userData.anim = { head: dome, tail: tentacules, float: true };
    s.g.userData.baseY = 0.09;
    s.g.userData.attack = function (gg, p) {
      // « Tentacule » : la cloche se contracte et propulse la méduse en avant.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.50;
      root.position.y = k * 0.18;
      dome.scale.set(1 + k * 0.28, 1 - k * 0.30, 1 + k * 0.28);
      tentacules.scale.set(1 - k * 0.25, 1 + k * 0.40, 1 - k * 0.25);
      tentacules.rotation.x = -k * 0.32;
      tentacules.rotation.y = Math.sin(t * Math.PI * 3) * 0.38;
      if (p >= 1) {
        dome.scale.setScalar(1); tentacules.scale.setScalar(1);
        tentacules.rotation.x = 0;
      }
    };
    return s.g;
  }

  // ===========================================================================
  //  CORALOU -> stade 2 : le récif vivant.
  //  Le même buisson de corail, plus haut, plus dense, et surtout hérissé de
  //  deux cristaux clairs qui poussent entre les branches.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildCoralouon() {
    const CORAIL = '#fc7460', CORAIL_CLAIR = '#ef7d57', POINTE = '#fff0c8';
    const SABLE = '#fcd8a0';
    const s = shell(), root = s.root;

    /** Une branche de corail, version économique : 2 meshes (tige + pointe). */
    function branche(len, rBase, tilt, color) {
      const b = new THREE.Group();
      const rTop = rBase * 0.6;
      b.add(R3.cyl(rTop, rBase, len, color, 0, len * 0.5, 0, { rough: 0.8, seg: 8 }));
      b.add(deco(R3.sphere(rTop * 1.25, POINTE, 0, len + rTop * 0.3, 0, { rough: 0.7, seg: 9 })));
      b.rotation.z = tilt;
      return b;
    }

    root.add(R3.ellipsoid(0.48, 0.085, 0.36, SABLE, 0, 0.05, 0, { rough: 1 }));        // 1
    root.add(deco(R3.sphere(0.065, SABLE, -0.34, 0.06, 0.14, { rough: 1 })));          // 2

    // Branche centrale : c'est elle qui porte le visage.
    const centre = branche(0.92, 0.115, 0, CORAIL);
    centre.position.set(0, 0.09, 0.01);
    root.add(centre);                                                                  // 3, 4
    centre.add(R3.ellipsoid(0.16, 0.175, 0.15, CORAIL, 0, 0.46, 0.025, { rough: 0.8 })); // 5

    // Quatre branches latérales : elles dansent avec `tail`.
    const laterales = pivot(0, 0.09, 0);
    root.add(laterales);
    [[-0.21, 0.64, 0.088, 0.34, -0.07, CORAIL], [0.21, 0.64, 0.088, -0.34, -0.07, CORAIL],
     [-0.36, 0.46, 0.068, 0.58, 0.11, CORAIL_CLAIR], [0.36, 0.46, 0.068, -0.58, 0.11, CORAIL_CLAIR]]
      .forEach(function (b) {
        const br = branche(b[1], b[2], b[3], b[5]);
        br.position.set(b[0], 0, b[4]);
        laterales.add(br);                                                             // 6-13
      });

    // Visage sur le renflement central.
    const face = pivot(0, 0.46, 0.025);
    centre.add(face);
    face.add(bigEyes(0.072, 0.025, 0.128, 0.045));                                     // 14-17

    // ATTRIBUT SPECTACULAIRE : deux cristaux de corail qui percent le buisson.
    laterales.add(spikeRow([
      [-0.13, 0.72, -0.16, 0.055, 0.30, -0.20],
      [0.15, 0.60, -0.14, 0.048, 0.26, 0.18],
    ], POINTE, { emissive: POINTE, emissiveIntensity: 0.35 }));                        // 18, 19

    s.g.userData.anim = { head: centre, tail: laterales };
    s.g.userData.attack = function (gg, p) {
      // « Danse du récif » : les branches se dressent puis fouettent en avant.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.32;
      centre.rotation.x = -k * 0.45;
      centre.scale.set(1 + k * 0.10, 1 + k * 0.24, 1 + k * 0.10);
      laterales.rotation.x = -k * 0.32;
      laterales.rotation.y = Math.sin(t * Math.PI * 4) * 0.48;
      if (p >= 1) {
        centre.rotation.x = 0; centre.scale.setScalar(1);
        laterales.rotation.x = 0; laterales.rotation.y = 0;
      }
    };
    return s.g;
  }

  // ###########################################################################
  //  FAMILLE DU LOT 2 — fluffly · glanou · papillon · cygnik · lotira ·
  //                     lapinou · hibouche
  // ###########################################################################

  // ===========================================================================
  //  FLUFFLY -> stade 2 : la boule à crinière.
  //  Toujours la même boule jaune et orange, mais une vraie crinière ambrée
  //  lui fait le tour du corps — impossible de le confondre avec le petit.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildFlufflyon() {
    const JAUNE = '#fde74c', ORANGE = '#f39c12', PALE = '#fcef8d', ROSE = '#ffaad8';
    const s = shell(), root = s.root;

    const boule = pivot(0, 0.46, 0);
    root.add(boule);
    boule.add(R3.ellipsoid(0.46, 0.40, 0.44, ORANGE, 0, 0, 0, { rough: 0.95 }));       // 1
    boule.add(R3.ellipsoid(0.415, 0.365, 0.395, JAUNE, 0, 0.02, 0.025, { rough: 0.92 })); // 2
    boule.add(deco(R3.ellipsoid(0.22, 0.13, 0.11, PALE, -0.09, 0.19, 0.26, { rough: 1 }))); // 3
    boule.add(R3.sphere(0.15, JAUNE, -0.24, 0.29, -0.12, { rough: 0.95 }));            // 4
    boule.add(R3.sphere(0.13, JAUNE, 0.26, 0.26, -0.08, { rough: 0.95 }));             // 5

    // ATTRIBUT SPECTACULAIRE : la crinière — quatre grosses touffes ambrées
    // qui débordent tout autour du corps. C'est ce qui dit « il a grandi ».
    const criniere = pivot(0, 0.46, 0);
    root.add(criniere);
    [[-0.42, 0.10, -0.16, 0.17], [0.44, 0.06, -0.12, 0.16],
     [-0.20, -0.26, -0.24, 0.15], [0.22, -0.22, -0.26, 0.145]].forEach(function (t) {
      criniere.add(R3.sphere(t[3], ORANGE, t[0], t[1], t[2], { rough: 0.98 }));        // 6-9
    });

    // Oreilles : plus longues, intérieur rose.
    const orL = ear(0.26, 0.14, ORANGE, ROSE, 'round', -0.28, 0.34, -0.02);
    const orR = ear(0.26, 0.14, ORANGE, ROSE, 'round', 0.28, 0.34, -0.02);
    orL.rotation.z = 0.42; orR.rotation.z = -0.42;
    boule.add(orL, orR);                                                               // 10-13

    boule.add(bigEyes(0.155, 0.09, 0.365, 0.078));                                     // 14-17

    // Deux pattes, bien plantées devant.
    [-1, 1].forEach(function (k) {
      root.add(R3.ellipsoid(0.115, 0.085, 0.13, ORANGE, k * 0.19, 0.095, 0.25,
        { rough: 0.95 }));                                                             // 18, 19
    });

    s.g.userData.anim = { head: boule, tail: criniere };
    s.g.userData.attack = function (gg, p) {
      // « Super rebond » : il roule en avant et retombe en s'écrasant.
      const b = pulse(p), t = R3.clamp01(p);
      root.position.z = b * 0.60;
      root.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.38;
      boule.rotation.x = t * Math.PI * 2;
      criniere.rotation.x = t * Math.PI * 2;
      const ecras = 1 + b * 0.12;
      root.scale.set(1 / Math.sqrt(ecras), ecras, 1 / Math.sqrt(ecras));
      if (p >= 1) { root.scale.setScalar(1); boule.rotation.x = 0; criniere.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  GLANOU -> stade 2 : le chêne-chevalier.
  //  Le gland a mis une armure d'écorce et son chapeau est devenu un heaume
  //  à deux cornes. Le plus drôle des évolués, et le plus fier.
  //  Budget : 18 draw calls.
  // ===========================================================================
  function buildGlanouon() {
    const CLAIR = '#d4a373', BOIS = '#8b5a2b', SOMBRE = '#5c2e0d', VERT = '#38b764';
    const s = shell(), root = s.root;

    // Corps du gland, plus gros.
    root.add(R3.ellipsoid(0.35, 0.38, 0.35, CLAIR, 0, 0.44, 0, { rough: 0.85 }));      // 1
    root.add(R3.ellipsoid(0.30, 0.24, 0.30, BOIS, 0, 0.26, 0, { rough: 0.85 }));       // 2
    const pointe = R3.cone(0.18, 0.20, BOIS, 0, 0.11, 0);
    pointe.rotation.x = Math.PI;
    root.add(pointe);                                                                  // 3

    // ATTRIBUT SPECTACULAIRE 1 : trois plaques d'armure d'écorce sur le torse.
    root.add(spikeRow([
      [-0.19, 0.42, 0.24, 0.10, 0.16, Math.PI / 2],
      [0.19, 0.42, 0.24, 0.10, 0.16, Math.PI / 2],
      [0.00, 0.24, 0.26, 0.11, 0.14, Math.PI / 2],
    ], SOMBRE, { flat: false, rough: 0.85, flatten: 0.5 }));                           // 4-6

    root.add(bigEyes(0.135, 0.50, 0.315, 0.070));                                      // 7-10

    // ATTRIBUT SPECTACULAIRE 2 : le heaume-cupule, avec ses deux cornes.
    const heaume = pivot(0, 0.70, 0);
    root.add(heaume);
    heaume.add(R3.cyl(0.36, 0.41, 0.17, BOIS, 0, 0.06, 0, { seg: 16, rough: 0.9 }));   // 11
    heaume.add(R3.ellipsoid(0.365, 0.24, 0.365, SOMBRE, 0, 0.17, 0, { rough: 0.9 }));  // 12
    heaume.add(hornPair(0.30, 0.055, CLAIR, 0.26, 0.26, -0.02, -0.15, -0.55));         // 13, 14

    // La tige verte et sa feuille, restées de l'enfance.
    heaume.add(R3.cyl(0.04, 0.05, 0.16, SOMBRE, 0, 0.38, 0, { seg: 8 }));              // 15
    const feuille = R3.ellipsoid(0.13, 0.032, 0.07, VERT, 0.12, 0.45, 0, { rough: 0.8 });
    feuille.rotation.z = 0.5;
    heaume.add(deco(feuille));                                                         // 16

    // Deux bras-branches, qui battent doucement.
    const brasL = pivot(-0.31, 0.44, 0.03), brasR = pivot(0.31, 0.44, 0.03);
    [[brasL, -1], [brasR, 1]].forEach(function (b) {
      const m = R3.cyl(0.035, 0.055, 0.24, BOIS, b[1] * 0.09, -0.06, 0, { rough: 0.9, seg: 6 });
      m.rotation.z = -b[1] * 0.6;
      b[0].add(m);                                                                     // 17, 18
    });
    root.add(brasL, brasR);

    s.g.userData.anim = { head: heaume, wingL: brasL, wingR: brasR };
    s.g.userData.attack = function (gg, p) {
      // « Coup de gland » : il vrille comme une toupie et charge tête baissée.
      const b = pulse(p), t = R3.clamp01(p);
      root.rotation.y = t * Math.PI * 4;
      root.position.z = b * 0.50;
      root.position.y = b * 0.16;
      heaume.rotation.x = b * 0.30;
      if (p >= 1) { root.rotation.y = 0; heaume.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  PAPILLON -> stade 2 : le papillon impérial.
  //  Quatre lobes d'ailes au lieu de deux, un motif doré, et deux rubans de
  //  traîne qui flottent derrière lui. Il lévite.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildPapillonon() {
    const CORPS = '#5d275d', ROSE_VIF = '#ff6b9d', ROSE = '#ffaad8';
    const LILAS = '#d896ff', OR = '#f1c40f';
    const s = shell(), root = s.root;

    // Corps segmenté, dressé.
    const corps = pivot(0, 0.52, 0);
    root.add(corps);
    corps.add(R3.ellipsoid(0.115, 0.115, 0.115, CORPS, 0, 0.20, 0.02, { rough: 0.7 })); // 1
    corps.add(R3.ellipsoid(0.105, 0.20, 0.105, CORPS, 0, -0.02, 0, { rough: 0.7 }));   // 2
    corps.add(deco(R3.ellipsoid(0.075, 0.135, 0.075, LILAS, 0, -0.26, 0, { rough: 0.75 }))); // 3

    // ATTRIBUT SPECTACULAIRE : quatre grands lobes d'ailes, deux par côté.
    const aileL = pivot(-0.08, 0.58, -0.02), aileR = pivot(0.08, 0.58, -0.02);
    [[aileL, -1], [aileR, 1]].forEach(function (a) {
      const haut = R3.ellipsoid(0.34, 0.30, 0.022, ROSE_VIF, a[1] * 0.34, 0.16, 0,
        { side: THREE.DoubleSide, rough: 0.7 });
      haut.rotation.z = a[1] * 0.24;
      a[0].add(deco(haut));                                                            // 4, 6
      const bas = R3.ellipsoid(0.25, 0.22, 0.020, LILAS, a[1] * 0.28, -0.22, 0,
        { side: THREE.DoubleSide, rough: 0.7 });
      bas.rotation.z = -a[1] * 0.20;
      a[0].add(deco(bas));                                                             // 5, 7
      // Motif doré au cœur de chaque aile haute, traversant les deux faces.
      a[0].add(deco(R3.ellipsoid(0.10, 0.09, 0.030, OR, a[1] * 0.36, 0.18, 0,
        { side: THREE.DoubleSide, rough: 0.5, emissive: OR, emissiveIntensity: 0.2 }))); // 8, 9
    });
    root.add(aileL, aileR);

    // Antennes à pommeau doré.
    [-1, 1].forEach(function (k) {
      const C = CL();
      const ant = (C && C.antenna)
        ? C.antenna({ len: 0.24, color: CORPS, ballColor: OR, ballR: 0.05,
            tilt: -k * 0.42, x: k * 0.075, y: 0.30, z: 0.05 })
        : R3.group(R3.cyl(0.012, 0.018, 0.24, CORPS, k * 0.075, 0.42, 0.05, { seg: 6 }));
      corps.add(ant);                                                                  // 10-13
    });

    corps.add(bigEyes(0.078, 0.215, 0.115, 0.045));                                    // 14-17

    // Traîne : deux rubans roses qui flottent derrière.
    const traine = pivot(0, 0.30, -0.10);
    root.add(traine);
    [-1, 1].forEach(function (k) {
      const r = R3.ellipsoid(0.035, 0.028, 0.28, ROSE, k * 0.09, -0.06, -0.28,
        { transparent: true, opacity: 0.85, rough: 0.6 });
      r.rotation.y = -k * 0.25;
      traine.add(deco(r));                                                             // 18, 19
    });

    grandir(root, 1.10);   // un papillon impérial doit dominer son petit cousin

    s.g.userData.anim = { head: corps, wingL: aileL, wingR: aileR, tail: traine, float: true };
    s.g.userData.baseY = 0.10;
    s.g.userData.attack = function (gg, p) {
      // « Plumes tourbillon » : il bat furieusement des ailes et fond en avant.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.55;
      root.position.y = k * 0.28;
      const bat = Math.sin(t * 18) * 1.0;
      aileL.rotation.z = -bat; aileR.rotation.z = bat;
      corps.rotation.x = -k * 0.30;
      traine.rotation.x = -k * 0.45;
      if (p >= 1) { corps.rotation.x = 0; traine.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  CYGNIK -> stade 2 : le cygne royal.
  //  Même blanc, même cou en S, mais des ailes déployées, une couronne d'or
  //  et une longue traîne de plumes.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildCygnikon() {
    const BLANC = '#f4f4f4', OMBRE = '#bdc3c7', PLUME = '#94b0c2';
    const BEC = '#ef7d57', BEC_SOMBRE = '#d35400', OR = '#f1c40f';
    const s = shell(), root = s.root;

    // Corps en coque de bateau.
    root.add(R3.ellipsoid(0.34, 0.26, 0.44, BLANC, 0, 0.32, -0.03));                   // 1
    root.add(deco(R3.ellipsoid(0.28, 0.15, 0.36, OMBRE, 0, 0.20, -0.05, { rough: 0.9 }))); // 2

    // Cou en S : trois segments qui montent en s'affinant.
    const cou = pivot(0, 0.48, 0.10);
    root.add(cou);
    cou.add(R3.ellipsoid(0.085, 0.13, 0.085, BLANC, 0, 0.11, 0.02));                   // 3
    cou.add(R3.ellipsoid(0.072, 0.13, 0.072, BLANC, 0, 0.33, 0.06));                   // 4
    cou.add(R3.ellipsoid(0.062, 0.12, 0.062, BLANC, 0, 0.54, 0.03));                   // 5

    // Tête et bec.
    const tete = pivot(0, 1.14, 0.10);
    root.add(tete);
    tete.add(R3.ellipsoid(0.115, 0.105, 0.13, BLANC, 0, 0, 0));                        // 6
    const bec = R3.cone(0.048, 0.20, BEC, 0, -0.025, 0.20, { seg: 9 });
    bec.rotation.x = Math.PI / 2;   // la pointe du cône part vers l'avant
    tete.add(deco(bec));                                                               // 7
    tete.add(deco(R3.ellipsoid(0.035, 0.028, 0.030, BEC_SOMBRE, 0, 0.015, 0.135)));    // 8
    tete.add(fireEyes(0.070, 0.035, 0.105, 0.030, '#1a1c2c'));                         // 9, 10

    // ATTRIBUT SPECTACULAIRE 1 : la couronne d'or sur la tête.
    const couronne = crownRing(0.105, 0.020, OR, 3, 0.11, OR);
    couronne.position.set(0, 0.10, 0.01);
    tete.add(couronne);                                                                // 11-14

    // ATTRIBUT SPECTACULAIRE 2 : les grandes ailes déployées.
    const aileL = pivot(-0.28, 0.40, -0.02), aileR = pivot(0.28, 0.40, -0.02);
    aileL.add(featherWing(0.50, 0.42, BLANC, PLUME, -1));                              // 15, 16
    aileR.add(featherWing(0.50, 0.42, BLANC, PLUME, 1));                               // 17, 18
    aileL.rotation.y = -0.30; aileR.rotation.y = 0.30;
    root.add(aileL, aileR);

    // Traîne de plumes derrière la queue.
    const traine = pivot(0, 0.34, -0.42);
    const t1 = R3.ellipsoid(0.12, 0.055, 0.26, BLANC, 0, 0.02, -0.20, { rough: 0.9 });
    t1.rotation.x = 0.30;
    traine.add(deco(t1));                                                              // 19
    root.add(traine);

    s.g.userData.anim = { head: tete, wingL: aileL, wingR: aileR, tail: traine };
    s.g.userData.attack = function (gg, p) {
      // « Coup d'aile » : il se dresse, ouvre les ailes en grand, et frappe.
      const t = R3.clamp01(p);
      const monte = Math.sin(Math.min(1, t / 0.4) * Math.PI * 0.5);
      const frappe = pulse(Math.max(0, (t - 0.35) / 0.65));
      root.position.y = monte * 0.24 - frappe * 0.10;
      root.position.z = frappe * 0.45;
      const bat = Math.sin(t * 14) * (0.95 - t * 0.3);
      aileL.rotation.z = -bat; aileR.rotation.z = bat;
      cou.rotation.x = -monte * 0.22 + frappe * 0.30;
      tete.rotation.x = frappe * 0.35;
      if (p >= 1) { cou.rotation.x = 0; tete.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  LOTIRA -> stade 2 : le lotus sacré.
  //  La feuille flottante s'est élargie, la fleur a doublé de corolle et son
  //  cœur d'or brille comme une petite lampe.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildLotiraon() {
    const VERT_SOMBRE = '#1e8449', VERT = '#27ae60', VERT_CLAIR = '#38b764';
    const ROSE_VIF = '#ff6b9d', ROSE = '#ffaad8';
    const OR = '#f1c40f', OR_CLAIR = '#fde74c';
    const s = shell(), root = s.root;

    // La grande feuille-socle, en trois disques emboîtés.
    root.add(R3.ellipsoid(0.56, 0.045, 0.56, VERT_SOMBRE, 0, 0.06, 0, { rough: 0.9 })); // 1
    root.add(deco(R3.ellipsoid(0.50, 0.040, 0.50, VERT, 0, 0.085, 0, { rough: 0.9 }))); // 2
    root.add(deco(R3.ellipsoid(0.34, 0.035, 0.34, VERT_CLAIR, 0, 0.105, 0.02, { rough: 0.9 }))); // 3

    // Fleur : double corolle, pivot au cœur. Assez haute pour que les pétales
    // du bas ne traversent pas la feuille-socle.
    const fleur = pivot(0, 0.48, 0);
    root.add(fleur);
    fleur.add(petals(6, 0.28, 0.32, 0.20, 0.10, ROSE_VIF, Math.PI / 2, 0, -0.04));     // 4-9
    fleur.add(petals(4, 0.18, 0.24, 0.16, 0.09, ROSE, Math.PI / 4, 0, 0.04));          // 10-13
    fleur.add(R3.ellipsoid(0.155, 0.155, 0.10, OR, 0, 0, 0.05, { rough: 0.8 }));       // 14
    fleur.add(deco(R3.ellipsoid(0.115, 0.115, 0.08, OR_CLAIR, 0, 0.015, 0.09,
      { emissive: OR_CLAIR, emissiveIntensity: 0.4, rough: 0.55 })));                  // 15

    fleur.add(bigEyes(0.068, 0.030, 0.155, 0.038));                                    // 16-19

    // NB : les reflets dorés du dessin 2D sont rendus par l'émissivité du cœur
    // plutôt que par des meshes séparés — le budget sert mieux la double
    // corolle, qui est ce qui se voit de loin.

    s.g.userData.anim = { head: fleur, float: true };
    s.g.userData.baseY = 0.03;
    s.g.userData.attack = function (gg, p) {
      // « Tempête de pétales » : la fleur s'ouvre en grand et tournoie.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.34;
      fleur.rotation.z = t * Math.PI * 3;
      fleur.scale.setScalar(1 + k * 0.35);
      fleur.rotation.x = -k * 0.28;
      if (p >= 1) { fleur.rotation.z = 0; fleur.scale.setScalar(1); fleur.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  LAPINOU -> stade 2 : le lapin-lune.
  //  Le même lapin blanc, en plus grand, avec des oreilles immenses, un
  //  croissant de lune sur le front et une collerette argentée.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildLapinouon() {
    const BLANC = '#f4f4f4', OMBRE = '#bdc3c7', ROSE = '#ffaad8', NEZ = '#ff6b9d';
    const LUNE = '#a8e6ff';
    const s = shell(), root = s.root;

    root.add(R3.ellipsoid(0.31, 0.30, 0.30, BLANC, 0, 0.34, 0, { rough: 0.95 }));      // 1
    root.add(deco(R3.ellipsoid(0.25, 0.22, 0.24, OMBRE, 0, 0.30, -0.05, { rough: 1 }))); // 2

    // Pattes.
    [-1, 1].forEach(function (k) {
      root.add(R3.ellipsoid(0.11, 0.075, 0.14, BLANC, k * 0.17, 0.08, 0.09, { rough: 0.95 })); // 3, 4
    });

    // Tête.
    const tete = pivot(0, 0.70, 0.02);
    root.add(tete);
    tete.add(R3.ellipsoid(0.26, 0.24, 0.26, BLANC, 0, 0, 0, { rough: 0.95 }));         // 5
    tete.add(deco(R3.ellipsoid(0.14, 0.10, 0.11, BLANC, 0, -0.08, 0.20, { rough: 1 }))); // 6

    // ATTRIBUT SPECTACULAIRE 1 : des oreilles immenses, presque aussi hautes
    // que le corps.
    const orL = ear(0.62, 0.16, BLANC, ROSE, 'round', -0.12, 0.20, -0.02);
    const orR = ear(0.62, 0.16, BLANC, ROSE, 'round', 0.12, 0.20, -0.02);
    orL.rotation.z = 0.16; orR.rotation.z = -0.16;
    tete.add(orL, orR);                                                                // 7-10

    tete.add(bigEyes(0.115, 0.02, 0.225, 0.062));                                      // 11-14
    tete.add(deco(R3.ellipsoid(0.030, 0.024, 0.026, NEZ, 0, -0.075, 0.255)));          // 15

    // ATTRIBUT SPECTACULAIRE 2 : le croissant de lune sur le front — deux
    // pointes qui se font face, la marque de sa lignée.
    tete.add(spikeRow([
      [-0.075, 0.19, 0.16, 0.028, 0.13, 0.55],
      [0.075, 0.19, 0.16, 0.028, 0.13, 0.55],
    ], LUNE, { emissive: LUNE, emissiveIntensity: 0.5 }));                             // 16, 17

    // Collerette argentée au cou.
    const col = R3.torus(0.235, 0.045, OMBRE, 0, 0.56, 0.01, { rough: 0.6, seg: 14 });
    col.rotation.x = Math.PI / 2;
    root.add(deco(col));                                                               // 18

    // Queue-pompon.
    const queue = pivot(0, 0.38, -0.30);
    queue.add(deco(R3.sphere(0.12, BLANC, 0, 0.02, -0.04, { rough: 1 })));             // 19
    root.add(queue);

    s.g.userData.anim = { head: tete, wingL: orL, wingR: orR, tail: queue };
    s.g.userData.attack = function (gg, p) {
      // « Éclat lunaire » : il bondit très haut et retombe pattes en avant.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.55;
      root.position.y = Math.sin(t * Math.PI) * 0.55;
      root.rotation.x = -k * 0.25;
      tete.rotation.x = k * 0.20;
      if (p >= 1) { root.rotation.x = 0; tete.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  HIBOUCHE -> stade 2 : le grand-duc.
  //  Mêmes bruns, mêmes yeux immenses, mais deux aigrettes dressées, de
  //  grandes ailes et des serres de rapace.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildHiboucheon() {
    const SOMBRE = '#5c2e0d', BOIS = '#8b5a2b', VENTRE = '#fff0c8';
    const DISQUE = '#d4a373', BEC = '#f1c40f', PATTE = '#d35400';
    const s = shell(), root = s.root;

    root.add(R3.ellipsoid(0.34, 0.36, 0.31, SOMBRE, 0, 0.44, 0, { rough: 0.92 }));     // 1
    root.add(deco(R3.ellipsoid(0.245, 0.27, 0.22, VENTRE, 0, 0.40, 0.16, { rough: 0.95 }))); // 2

    // Tête.
    const tete = pivot(0, 0.80, 0.02);
    root.add(tete);
    tete.add(R3.ellipsoid(0.30, 0.26, 0.28, BOIS, 0, 0, 0, { rough: 0.92 }));          // 3
    tete.add(deco(R3.ellipsoid(0.245, 0.215, 0.14, DISQUE, 0, -0.02, 0.19, { rough: 0.95 }))); // 4

    // ATTRIBUT SPECTACULAIRE 1 : les aigrettes, deux longues touffes dressées.
    tete.add(hornPair(0.34, 0.065, SOMBRE, 0.16, 0.28, -0.04, -0.22, -0.30));          // 5, 6

    tete.add(bigEyes(0.125, 0.02, 0.28, 0.088));                                       // 7-10
    const bec = R3.cone(0.052, 0.15, BEC, 0, -0.115, 0.265, { seg: 9 });
    bec.rotation.x = Math.PI / 2 + 0.5;
    tete.add(deco(bec));                                                               // 11

    // ATTRIBUT SPECTACULAIRE 2 : les grandes ailes de chasse.
    const aileL = pivot(-0.31, 0.50, -0.02), aileR = pivot(0.31, 0.50, -0.02);
    aileL.add(featherWing(0.48, 0.46, BOIS, SOMBRE, -1));                              // 12, 13
    aileR.add(featherWing(0.48, 0.46, BOIS, SOMBRE, 1));                               // 14, 15
    aileL.rotation.y = -0.25; aileR.rotation.y = 0.25;
    root.add(aileL, aileR);

    // Serres.
    [-1, 1].forEach(function (k) {
      root.add(R3.ellipsoid(0.085, 0.055, 0.12, PATTE, k * 0.135, 0.055, 0.09, { rough: 0.85 })); // 16, 17
    });

    // Queue en éventail.
    const queue = pivot(0, 0.34, -0.28);
    const q1 = R3.ellipsoid(0.16, 0.045, 0.20, SOMBRE, 0, -0.02, -0.16, { rough: 0.9 });
    q1.rotation.x = 0.28;
    queue.add(deco(q1));                                                               // 18
    const q2 = R3.ellipsoid(0.10, 0.035, 0.14, BOIS, 0, 0.01, -0.26, { rough: 0.9 });
    q2.rotation.x = 0.34;
    queue.add(deco(q2));                                                               // 19
    root.add(queue);

    s.g.userData.anim = { head: tete, wingL: aileL, wingR: aileR, tail: queue };
    s.g.userData.attack = function (gg, p) {
      // « Serre acérée » : il s'élève d'un coup d'ailes puis fond, serres en avant.
      const t = R3.clamp01(p);
      const monte = Math.sin(Math.min(1, t / 0.4) * Math.PI * 0.5);
      const plonge = pulse(Math.max(0, (t - 0.35) / 0.65));
      root.position.y = monte * 0.36 - plonge * 0.16;
      root.position.z = plonge * 0.52;
      root.rotation.x = -plonge * 0.30;
      const bat = Math.sin(t * 16) * (0.95 - t * 0.3);
      aileL.rotation.z = -bat; aileR.rotation.z = bat;
      tete.rotation.x = plonge * 0.28;
      if (p >= 1) { root.rotation.x = 0; tete.rotation.x = 0; }
    };
    return s.g;
  }

  // ###########################################################################
  //  FAMILLE DU LOT 3 — etoilamer · crabilino · nuagette · miaouche ·
  //                     pandouki · koronette
  // ###########################################################################

  // ===========================================================================
  //  ÉTOILAMER -> stade 2 : l'étoile à sept branches.
  //  Même rose, même sourire, mais sept branches au lieu de cinq, une perle
  //  nacrée au centre et trois cristaux marins.
  //  Budget : 18 draw calls.
  // ===========================================================================
  function buildEtoilameron() {
    const ROSE = '#ff6b9d', PALE = '#ffaad8', POINT = '#d62828', PERLE = '#fff0c8';
    const s = shell(), root = s.root;

    // Penchée en arrière : on voit mieux le visage, et les branches basses ne
    // s'enfoncent pas dans le sol.
    const etoile = pivot(0, 0.56, 0);
    etoile.rotation.x = -0.28;
    root.add(etoile);

    etoile.add(R3.star(7, 0.52, 0.20, 0.13, ROSE, 0, 0, 0, { rough: 0.85 }));          // 1
    etoile.add(deco(R3.star(7, 0.40, 0.16, 0.10, PALE, 0, 0, 0.055, { rough: 0.9 }))); // 2

    // ATTRIBUT SPECTACULAIRE 1 : la perle nacrée au cœur de l'étoile.
    etoile.add(deco(R3.sphere(0.115, PERLE, 0, 0, 0.13,
      { emissive: PERLE, emissiveIntensity: 0.35, rough: 0.25 })));                    // 3

    etoile.add(bigEyes(0.085, 0.055, 0.20, 0.046));                                    // 4-7
    etoile.add(smile3(0.060, 0.028, 0.017, 0, -0.045, 0.20));                          // 8-10

    // Les points rouges du dessin 2D, un par branche visible.
    [[-0.30, 0.24], [0.30, 0.24], [-0.36, -0.16], [0.36, -0.16], [0.0, 0.38]]
      .forEach(function (q) {
        etoile.add(deco(R3.sphere(0.035, POINT, q[0], q[1], 0.10, { rough: 0.8 })));   // 11-15
      });

    // ATTRIBUT SPECTACULAIRE 2 : trois cristaux marins plantés sur le dos.
    const cristaux = pivot(0, 0.56, -0.06);
    root.add(cristaux);
    cristaux.add(spikeRow([
      [-0.22, 0.10, -0.10, 0.045, 0.22, -0.6],
      [0.22, 0.10, -0.10, 0.045, 0.22, -0.6],
      [0.00, -0.26, -0.10, 0.050, 0.26, -0.6],
    ], PALE, { emissive: PALE, emissiveIntensity: 0.35 }));                            // 16-18

    // Une étoile de mer est plate : elle ne peut pas gagner en hauteur toute
    // seule, on l'agrandit donc franchement pour que l'évolution se voie.
    grandir(root, 1.14);

    s.g.userData.anim = { head: etoile, tail: cristaux };
    s.g.userData.attack = function (gg, p) {
      // « Coup d'étoile » : elle tourne sur elle-même et se jette en avant.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.52;
      root.position.y = k * 0.22;
      etoile.rotation.z = t * Math.PI * 4;
      etoile.scale.setScalar(1 + k * 0.30);
      if (p >= 1) { etoile.rotation.z = 0; etoile.scale.setScalar(1); }
    };
    return s.g;
  }

  // ===========================================================================
  //  CRABILINO -> stade 2 : le crabe-colosse.
  //  Le même rouge, mais une carapace à plaques d'armure, deux pinces
  //  énormes et une couronne d'épines.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildCrabilinon() {
    const CLAIR = '#e74c3c', SOMBRE = '#b13e53', BLANC = '#fff0c8';
    const s = shell(), root = s.root;

    // Carapace large, portée plus haut que chez Crabilino : le colosse se
    // dresse sur ses pattes au lieu de raser le sol.
    const corps = pivot(0, 0.38, 0);
    root.add(corps);
    corps.add(R3.ellipsoid(0.46, 0.24, 0.36, CLAIR, 0, 0, 0, { rough: 0.6 }));         // 1
    corps.add(deco(R3.ellipsoid(0.40, 0.16, 0.30, SOMBRE, 0, -0.12, 0.02, { rough: 0.7 }))); // 2

    // ATTRIBUT SPECTACULAIRE 1 : trois plaques d'armure sur le dos.
    corps.add(spikeRow([
      [-0.24, 0.16, -0.06, 0.13, 0.16, -0.35],
      [0.00, 0.22, -0.08, 0.15, 0.20, -0.30],
      [0.24, 0.16, -0.06, 0.13, 0.16, -0.35],
    ], SOMBRE, { flat: true, rough: 0.55, flatten: 0.6 }));                            // 3-5

    // ATTRIBUT SPECTACULAIRE 2 : deux pinces énormes, montées sur pivot.
    const pinceL = pivot(-0.46, 0.36, 0.14), pinceR = pivot(0.46, 0.36, 0.14);
    [[pinceL, -1], [pinceR, 1]].forEach(function (b) {
      const bras = R3.ellipsoid(0.10, 0.085, 0.16, SOMBRE, b[1] * 0.06, -0.02, 0.02, { rough: 0.7 });
      b[0].add(bras);                                                                  // 6, 8
      const pince = R3.ellipsoid(0.155, 0.135, 0.21, CLAIR, b[1] * 0.16, 0.04, 0.20, { rough: 0.6 });
      pince.rotation.y = -b[1] * 0.30;
      b[0].add(pince);                                                                 // 7, 9
    });
    root.add(pinceL, pinceR);

    // Quatre pattes, plus hautes qu'avant.
    [[-0.40, 0.13, -0.14], [0.40, 0.13, -0.14], [-0.34, 0.12, 0.14], [0.34, 0.12, 0.14]]
      .forEach(function (q) {
        root.add(R3.ellipsoid(0.080, 0.075, 0.13, SOMBRE, q[0], q[1], q[2], { rough: 0.8 })); // 10-13
      });

    // Yeux sur tiges — la marque de fabrique du crabe, ici bien plus hautes.
    [-1, 1].forEach(function (k) {
      corps.add(R3.cyl(0.030, 0.038, 0.30, CLAIR, k * 0.15, 0.27, 0.16, { seg: 6, rough: 0.7 })); // 14, 16
      corps.add(deco(R3.sphere(0.070, BLANC, k * 0.15, 0.45, 0.16, { rough: 0.5 })));  // 15, 17
    });

    // Couronne d'épines sur le front.
    corps.add(spikeRow([
      [-0.10, 0.16, 0.30, 0.040, 0.16, -0.9],
      [0.10, 0.16, 0.30, 0.040, 0.16, -0.9],
    ], BLANC, { emissive: BLANC, emissiveIntensity: 0.25 }));                          // 18, 19

    // Un crabe reste large et bas : sans ce coup de pouce, sa forme évoluée
    // paraîtrait plus PETITE que Crabilino, dont les tiges oculaires montaient
    // déjà haut. Voir `grandir()`.
    grandir(root, 1.10);

    s.g.userData.anim = { head: corps, wingL: pinceL, wingR: pinceR };
    s.g.userData.attack = function (gg, p) {
      // « Pincement » : il avance de côté puis referme ses deux pinces d'un coup.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.40;
      root.position.x = Math.sin(t * Math.PI * 3) * 0.14;
      const serre = Math.abs(Math.sin(t * Math.PI * 4));
      pinceL.rotation.z = serre * 0.55;
      pinceR.rotation.z = -serre * 0.55;
      corps.rotation.x = -k * 0.16;
      if (p >= 1) { root.position.x = 0; corps.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  NUAGETTE -> stade 2 : le nuage d'orage doré.
  //  Le même petit nuage blanc, devenu gros cumulus, ceint d'un anneau d'or
  //  et escorté d'étincelles. Il lévite.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildNuagetteon() {
    const BLANC = '#f4f4f4', GRIS = '#bdc3c7', OR = '#fff0c8', ETINC = '#fcef8d';
    const s = shell(), root = s.root;

    const nuage = pivot(0, 0.52, 0);
    root.add(nuage);
    // Quatre masses blanches emboîtées : c'est ce qui fait « nuage » et pas « boule ».
    nuage.add(R3.ellipsoid(0.36, 0.26, 0.30, BLANC, 0, 0, 0.02, { rough: 1 }));        // 1
    nuage.add(R3.ellipsoid(0.26, 0.22, 0.24, BLANC, -0.30, 0.06, -0.02, { rough: 1 })); // 2
    nuage.add(R3.ellipsoid(0.24, 0.20, 0.22, BLANC, 0.31, 0.04, -0.02, { rough: 1 })); // 3
    nuage.add(R3.ellipsoid(0.22, 0.19, 0.20, BLANC, 0.02, 0.24, -0.06, { rough: 1 })); // 4
    // Ombres grises dessous : le nuage prend du volume.
    nuage.add(deco(R3.ellipsoid(0.32, 0.12, 0.24, GRIS, -0.08, -0.19, -0.02, { rough: 1 }))); // 5
    nuage.add(deco(R3.ellipsoid(0.24, 0.10, 0.20, GRIS, 0.24, -0.16, -0.02, { rough: 1 }))); // 6

    nuage.add(bigEyes(0.145, 0.03, 0.29, 0.072));                                      // 7-10
    nuage.add(smile3(0.080, 0.036, 0.020, 0, -0.10, 0.29));                            // 11-13

    // ATTRIBUT SPECTACULAIRE : l'anneau d'or qui le ceint, comme un halo.
    const anneau = orbitRing(0.58, 0.026, OR, 0.20);
    anneau.position.set(0, 0.52, 0);
    root.add(anneau);                                                                  // 14

    // Étincelles qui crépitent autour de lui (elles tournent avec `tail`).
    const etincelles = pivot(0, 0.62, 0);
    root.add(etincelles);
    [[-0.50, 0.16, 0.08], [0.52, 0.10, -0.06], [-0.24, 0.40, -0.12], [0.28, 0.38, 0.10]]
      .forEach(function (q, i) {
        etincelles.add(sparkle(0.055 + i * 0.006, ETINC, q[0], q[1], q[2]));           // 15-18
      });

    // Un rayon doré qui tombe du nuage : le clin d'œil « esprit très rare ».
    const rayon = R3.cone(0.055, 0.34, ETINC, 0, 0.22, 0.02, {
      transparent: true, opacity: 0.45, emissive: ETINC, emissiveIntensity: 0.7,
      rough: 0.35, seg: 7, depthWrite: false,
    });
    rayon.rotation.x = Math.PI;
    root.add(deco(rayon));                                                             // 19

    grandir(root, 1.10);   // un cumulus, pas un petit nuage

    s.g.userData.anim = { head: nuage, tail: etincelles, float: true };
    s.g.userData.baseY = 0.12;
    s.g.userData.attack = function (gg, p) {
      // « Tonnerre » : le nuage enfle, s'assombrit puis lâche sa décharge.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.38;
      nuage.scale.setScalar(1 + k * 0.32);
      anneau.scale.setScalar(1 + k * 0.6);
      anneau.rotation.y = t * Math.PI * 3;
      etincelles.rotation.y = -t * Math.PI * 5;
      etincelles.scale.setScalar(1 + k * 1.1);
      rayon.scale.set(1 + k * 0.8, 1 + k * 1.6, 1 + k * 0.8);
      if (p >= 1) {
        nuage.scale.setScalar(1); anneau.scale.setScalar(1);
        etincelles.scale.setScalar(1); rayon.scale.setScalar(1);
      }
    };
    return s.g;
  }

  // ===========================================================================
  //  MIAOUCHE -> stade 2 : le chat élégant.
  //  Le même chat blanc aux yeux immenses, en plus grand, avec une collerette
  //  et une longue queue en panache.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildMiaoucheon() {
    const BLANC = '#f4f4f4', ROSE = '#ffaad8', VIF = '#ff6b9d', GRIS = '#bdc3c7';
    const s = shell(), root = s.root;

    root.add(R3.ellipsoid(0.30, 0.28, 0.34, BLANC, 0, 0.38, -0.02, { rough: 0.92 }));  // 1
    root.add(deco(R3.ellipsoid(0.22, 0.19, 0.24, GRIS, 0, 0.30, 0.10, { rough: 0.96 }))); // 2

    // Pattes.
    [-1, 1].forEach(function (k) {
      root.add(R3.ellipsoid(0.095, 0.070, 0.13, BLANC, k * 0.17, 0.075, 0.14, { rough: 0.92 })); // 3, 4
    });

    // Tête.
    const tete = pivot(0, 0.74, 0.05);
    root.add(tete);
    tete.add(R3.ellipsoid(0.27, 0.25, 0.26, BLANC, 0, 0, 0, { rough: 0.92 }));         // 5
    tete.add(deco(R3.ellipsoid(0.14, 0.10, 0.11, BLANC, 0, -0.085, 0.21, { rough: 0.96 }))); // 6

    // Oreilles pointues.
    const orL = ear(0.24, 0.17, BLANC, ROSE, 'pointy', -0.16, 0.17, -0.02);
    const orR = ear(0.24, 0.17, BLANC, ROSE, 'pointy', 0.16, 0.17, -0.02);
    orL.rotation.z = 0.24; orR.rotation.z = -0.24;
    tete.add(orL, orR);                                                                // 7-10

    tete.add(bigEyes(0.115, 0.015, 0.235, 0.075));                                     // 11-14
    tete.add(deco(R3.ellipsoid(0.030, 0.024, 0.026, VIF, 0, -0.075, 0.265)));          // 15

    // ATTRIBUT SPECTACULAIRE 1 : la collerette, comme un col de fourrure.
    const col = R3.torus(0.255, 0.055, GRIS, 0, 0.58, 0.03, { rough: 0.95, seg: 14 });
    col.rotation.x = Math.PI / 2;
    root.add(deco(col));                                                               // 16

    // ATTRIBUT SPECTACULAIRE 2 : la longue queue en panache, à trois segments.
    const queue = pivot(0, 0.40, -0.32);
    root.add(queue);
    queue.add(R3.ellipsoid(0.075, 0.075, 0.16, BLANC, 0, 0.06, -0.12, { rough: 0.94 })); // 17
    queue.add(R3.ellipsoid(0.062, 0.062, 0.15, BLANC, 0, 0.22, -0.24, { rough: 0.94 })); // 18
    queue.add(deco(R3.sphere(0.095, BLANC, 0, 0.38, -0.30, { rough: 1 })));            // 19

    grandir(root, 1.08);   // un chat élégant, nettement plus grand que le chaton

    s.g.userData.anim = { head: tete, wingL: orL, wingR: orR, tail: queue };
    s.g.userData.attack = function (gg, p) {
      // « Griffe » : il bondit et frappe d'un coup de patte.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.55;
      root.position.y = Math.sin(t * Math.PI) * 0.30;
      root.rotation.x = -k * 0.28;
      tete.rotation.x = k * 0.24;
      queue.rotation.x = -k * 0.45;
      if (p >= 1) { root.rotation.x = 0; tete.rotation.x = 0; queue.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  MIAOUCHE -> stade 3 : le félin royal.
  //  C'est un starter : il a droit au grand jeu. Crinière, couronne d'or,
  //  DEUX queues. On garde le blanc et le rose du chaton — sinon Robin ne
  //  reconnaîtrait plus son compagnon du début.
  //  Budget : 20 draw calls (le maximum autorisé — la couronne en vaut la peine).
  // ===========================================================================
  function buildMiaouchear() {
    const BLANC = '#f4f4f4', ROSE = '#ffaad8', VIF = '#ff6b9d', GRIS = '#bdc3c7';
    const OR = '#f1c40f';
    const s = shell(), root = s.root;

    // Corps de fauve, plus long et plus bas sur pattes.
    root.add(R3.ellipsoid(0.33, 0.30, 0.42, BLANC, 0, 0.44, -0.04, { rough: 0.92 }));  // 1
    root.add(deco(R3.ellipsoid(0.24, 0.20, 0.28, GRIS, 0, 0.34, 0.10, { rough: 0.96 }))); // 2
    [-1, 1].forEach(function (k) {
      root.add(R3.ellipsoid(0.105, 0.115, 0.14, BLANC, k * 0.20, 0.13, 0.16, { rough: 0.92 })); // 3, 4
    });

    // Tête.
    const tete = pivot(0, 0.86, 0.10);
    root.add(tete);
    tete.add(R3.ellipsoid(0.26, 0.24, 0.25, BLANC, 0, 0, 0, { rough: 0.92 }));         // 5
    tete.add(deco(R3.ellipsoid(0.135, 0.10, 0.11, BLANC, 0, -0.085, 0.20, { rough: 0.96 }))); // 6

    // ATTRIBUT SPECTACULAIRE 1 : la crinière — quatre touffes roses qui
    // encadrent le visage. C'est la première chose que l'on voit.
    const criniere = pivot(0, 0.86, 0.02);
    root.add(criniere);
    [[-0.30, 0.04, -0.02, 0.150], [0.30, 0.04, -0.02, 0.150],
     [-0.19, 0.28, -0.06, 0.135], [0.19, 0.28, -0.06, 0.135]].forEach(function (t) {
      criniere.add(R3.sphere(t[3], ROSE, t[0], t[1], t[2], { rough: 1 }));             // 7-10
    });

    // Oreilles courtes, prises dans la crinière.
    tete.add(deco(R3.cone(0.075, 0.16, BLANC, -0.15, 0.24, -0.02, { seg: 8 })));       // 11
    tete.add(deco(R3.cone(0.075, 0.16, BLANC, 0.15, 0.24, -0.02, { seg: 8 })));        // 12

    // Regard doré de fauve (2 meshes : on économise les reflets pour la couronne).
    tete.add(fireEyes(0.110, 0.01, 0.225, 0.048, OR));                                 // 13, 14
    tete.add(deco(R3.ellipsoid(0.030, 0.024, 0.026, VIF, 0, -0.075, 0.255)));          // 15

    // ATTRIBUT SPECTACULAIRE 2 : la couronne d'or, flottant au-dessus du crâne.
    const couronne = crownRing(0.155, 0.024, OR, 2, 0.14, OR);
    couronne.position.set(0, 0.32, -0.01);
    tete.add(couronne);                                                                // 16-18

    // DEUX queues, signe des félins de légende.
    const queues = pivot(0, 0.46, -0.38);
    root.add(queues);
    [-1, 1].forEach(function (k) {
      const q = R3.ellipsoid(0.062, 0.062, 0.26, BLANC, k * 0.10, 0.14, -0.22, { rough: 0.94 });
      q.rotation.y = -k * 0.22;
      q.rotation.x = 0.42;
      queues.add(q);                                                                   // 19, 20
    });

    s.g.userData.anim = { head: tete, tail: queues };
    s.g.userData.attack = function (gg, p) {
      // « Griffe royale » : il se ramasse, bondit très loin et retombe en force.
      const t = R3.clamp01(p);
      const charge = Math.sin(Math.min(1, t / 0.3) * Math.PI * 0.5);
      const bond = pulse(Math.max(0, (t - 0.25) / 0.75));
      root.position.y = -charge * 0.08 + Math.sin(Math.max(0, (t - 0.25) / 0.75) * Math.PI) * 0.42;
      root.position.z = -charge * 0.12 + bond * 0.66;
      root.rotation.x = -bond * 0.30;
      tete.rotation.x = charge * 0.20 + bond * 0.22;
      criniere.scale.setScalar(1 + bond * 0.25);
      queues.rotation.y = Math.sin(t * 10) * 0.35;
      if (p >= 1) { root.rotation.x = 0; tete.rotation.x = 0; criniere.scale.setScalar(1); }
    };
    return s.g;
  }

  // ===========================================================================
  //  PANDOUKI -> stade 2 : le panda-lutteur.
  //  Le même panda noir et blanc, mais massif, avec une ceinture de champion
  //  et un bâton de bambou. Il a l'air fort sans avoir l'air méchant.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildPandoukion() {
    const BLANC = '#f4f4f4', NOIR = '#1a1c2c', CREME = '#fff0c8';
    const BAMBOU = '#38b764', OR = '#f1c40f';
    const s = shell(), root = s.root;

    root.add(R3.ellipsoid(0.36, 0.34, 0.32, BLANC, 0, 0.42, 0, { rough: 0.95 }));      // 1
    root.add(deco(R3.ellipsoid(0.26, 0.24, 0.22, CREME, 0, 0.38, 0.17, { rough: 0.98 }))); // 2

    // Tête.
    const tete = pivot(0, 0.82, 0.03);
    root.add(tete);
    tete.add(R3.ellipsoid(0.28, 0.26, 0.26, BLANC, 0, 0, 0, { rough: 0.95 }));         // 3
    tete.add(deco(R3.ellipsoid(0.13, 0.10, 0.10, NOIR, 0, -0.085, 0.22, { rough: 0.9 }))); // 4
    // Oreilles rondes noires.
    [-1, 1].forEach(function (k) {
      tete.add(R3.ellipsoid(0.095, 0.095, 0.055, NOIR, k * 0.21, 0.21, -0.02, { rough: 0.9 })); // 5, 6
    });
    // Les taches noires autour des yeux : la signature du panda.
    [-1, 1].forEach(function (k) {
      const t = R3.ellipsoid(0.095, 0.105, 0.055, NOIR, k * 0.115, 0.015, 0.20, { rough: 0.9 });
      t.rotation.z = -k * 0.30;
      tete.add(deco(t));                                                               // 7, 8
    });
    tete.add(bigEyes(0.115, 0.02, 0.245, 0.055));                                      // 9-12

    // Bras et jambes.
    const brasL = pivot(-0.33, 0.46, 0.04), brasR = pivot(0.33, 0.46, 0.04);
    [[brasL, -1], [brasR, 1]].forEach(function (b) {
      b[0].add(R3.ellipsoid(0.10, 0.145, 0.11, NOIR, b[1] * 0.03, -0.10, 0, { rough: 0.95 })); // 13, 14
    });
    root.add(brasL, brasR);
    [-1, 1].forEach(function (k) {
      root.add(R3.ellipsoid(0.115, 0.085, 0.14, NOIR, k * 0.175, 0.085, 0.06, { rough: 0.95 })); // 15, 16
    });

    // ATTRIBUT SPECTACULAIRE 1 : le bâton de bambou tenu en travers.
    const baton = pivot(0, 0.44, 0.22);
    root.add(baton);
    const tige = R3.cyl(0.035, 0.035, 0.86, BAMBOU, 0, 0, 0, { seg: 8, rough: 0.8 });
    tige.rotation.z = Math.PI / 2;
    baton.add(tige);                                                                   // 17
    baton.add(deco(R3.cyl(0.042, 0.042, 0.06, '#27ae60', 0, 0, 0, { seg: 8, rough: 0.8 }))); // 18

    // ATTRIBUT SPECTACULAIRE 2 : la ceinture de champion.
    const ceinture = R3.torus(0.335, 0.045, OR, 0, 0.30, 0.01,
      { rough: 0.3, metal: 0.35, seg: 14, emissive: OR, emissiveIntensity: 0.15 });
    ceinture.rotation.x = Math.PI / 2;
    root.add(deco(ceinture));                                                          // 19

    grandir(root, 1.08);   // le lutteur en impose : un panda plus massif

    s.g.userData.anim = { head: tete, wingL: brasL, wingR: brasR };
    s.g.userData.attack = function (gg, p) {
      // « Coup de bambou » : il pivote et balaie devant lui avec son bâton.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.42;
      root.rotation.y = Math.sin(t * Math.PI * 2) * 0.55;
      baton.rotation.z = -Math.sin(t * Math.PI * 2) * 1.2;
      baton.position.y = 0.44 + k * 0.18;
      tete.rotation.x = k * 0.20;
      if (p >= 1) { root.rotation.y = 0; baton.rotation.z = 0; baton.position.y = 0.44; }
    };
    return s.g;
  }

  // ===========================================================================
  //  KORONETTE -> stade 2 : la reine des fées.
  //  Même lavande, même rose, mais quatre ailes, une vraie couronne et un
  //  anneau d'étoiles en orbite. Elle lévite.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildKoronetteon() {
    const LAVANDE = '#d896ff', ROSE = '#ffaad8', OR = '#f1c40f', ETOILE = '#fcec6c';
    const s = shell(), root = s.root;

    const corps = pivot(0, 0.54, 0);
    root.add(corps);
    // Robe évasée (un cône retourné) + buste.
    const robe = R3.cone(0.24, 0.44, LAVANDE, 0, -0.14, 0, { seg: 12, rough: 0.7 });
    robe.rotation.x = Math.PI;
    corps.add(robe);                                                                   // 1
    corps.add(R3.ellipsoid(0.135, 0.16, 0.13, LAVANDE, 0, 0.14, 0, { rough: 0.7 }));   // 2

    // Tête et chevelure.
    const tete = pivot(0, 0.42, 0.01);
    corps.add(tete);
    tete.add(R3.ellipsoid(0.155, 0.155, 0.15, ROSE, 0, 0, 0, { rough: 0.85 }));        // 3
    tete.add(deco(R3.ellipsoid(0.175, 0.145, 0.16, LAVANDE, 0, 0.055, -0.03, { rough: 0.9 }))); // 4

    // ATTRIBUT SPECTACULAIRE 1 : la couronne d'or à trois pointes.
    const couronne = crownRing(0.125, 0.020, OR, 3, 0.13, ETOILE);
    couronne.position.set(0, 0.15, 0);
    tete.add(couronne);                                                                // 5-8

    // ATTRIBUT SPECTACULAIRE 2 : quatre ailes de fée translucides.
    const aileL = pivot(-0.10, 0.62, -0.05), aileR = pivot(0.10, 0.62, -0.05);
    [[aileL, -1], [aileR, 1]].forEach(function (a) {
      const haut = R3.ellipsoid(0.26, 0.20, 0.018, ROSE, a[1] * 0.26, 0.10, 0,
        { side: THREE.DoubleSide, transparent: true, opacity: 0.72, rough: 0.3, depthWrite: false });
      haut.rotation.z = a[1] * 0.30;
      a[0].add(deco(haut));                                                            // 9, 11
      const bas = R3.ellipsoid(0.19, 0.15, 0.016, LAVANDE, a[1] * 0.20, -0.16, 0,
        { side: THREE.DoubleSide, transparent: true, opacity: 0.68, rough: 0.3, depthWrite: false });
      bas.rotation.z = -a[1] * 0.24;
      a[0].add(deco(bas));                                                             // 10, 12
    });
    root.add(aileL, aileR);

    tete.add(bigEyes(0.062, 0.005, 0.145, 0.036));                                     // 13-16

    // La baguette à pommeau d'étoile.
    const baguette = pivot(0.26, 0.60, 0.12);
    baguette.add(R3.cyl(0.016, 0.020, 0.30, '#8b5a2b', 0, 0.07, 0, { seg: 6, rough: 0.85 })); // 17
    baguette.add(sparkle(0.075, ETOILE, 0, 0.26, 0));                                  // 18
    baguette.rotation.z = -0.28;
    root.add(baguette);

    // Anneau d'étoiles en orbite (il tourne via `tail`).
    const anneau = orbitRing(0.46, 0.018, ETOILE, 0.30);
    anneau.position.set(0, 0.60, 0);
    root.add(anneau);                                                                  // 19

    s.g.userData.anim = { head: tete, wingL: aileL, wingR: aileR, tail: anneau, float: true };
    s.g.userData.baseY = 0.12;
    s.g.userData.attack = function (gg, p) {
      // « Baguette magique » : elle lève sa baguette, l'étoile enfle et éclate.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.40;
      root.position.y = k * 0.20;
      baguette.rotation.z = -0.28 - k * 1.3;
      baguette.scale.setScalar(1 + k * 0.5);
      const bat = Math.sin(t * 20) * 0.85;
      aileL.rotation.z = -bat; aileR.rotation.z = bat;
      anneau.rotation.y = t * Math.PI * 4;
      anneau.scale.setScalar(1 + k * 0.9);
      if (p >= 1) {
        baguette.rotation.z = -0.28; baguette.scale.setScalar(1); anneau.scale.setScalar(1);
      }
    };
    return s.g;
  }

  // ###########################################################################
  //  FAMILLE DU LOT 4 — stellini · doudoune · flamdrak · glydrak ·
  //                     aquadrak · tonnedrak
  // ###########################################################################

  // ===========================================================================
  //  STELLINI -> stade 2 : le lapin-comète.
  //  Même étoile dorée, mêmes longues oreilles de lapin, mais cinq branches,
  //  un anneau de lumière en orbite et une traîne d'astres.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildStellinion() {
    const OR = '#f1c40f', CLAIR = '#fcef8d', ROSE = '#ffaad8', NEZ = '#ff6b9d';
    const s = shell(), root = s.root;

    const corps = pivot(0, 0.50, 0);
    root.add(corps);
    const etoile = R3.star(5, 0.50, 0.21, 0.24, OR, 0, 0, 0, { rough: 0.55 });
    corps.add(etoile);                                                                 // 1
    corps.add(deco(R3.ellipsoid(0.20, 0.20, 0.165, CLAIR, 0, 0, 0.025,
      { emissive: CLAIR, emissiveIntensity: 0.35, rough: 0.4 })));                     // 2

    // Longues oreilles de lapin, restées de l'enfance.
    const orL = ear(0.46, 0.155, OR, ROSE, 'round', -0.13, 0.28, -0.02);
    const orR = ear(0.46, 0.155, OR, ROSE, 'round', 0.13, 0.28, -0.02);
    orL.rotation.z = 0.15; orR.rotation.z = -0.15;
    corps.add(orL, orR);                                                               // 3-6

    corps.add(bigEyes(0.115, 0.03, 0.165, 0.056));                                     // 7-10
    corps.add(deco(R3.ellipsoid(0.034, 0.028, 0.030, NEZ, 0, -0.06, 0.175)));          // 11

    // ATTRIBUT SPECTACULAIRE 1 : l'anneau de lumière en orbite.
    const anneau = orbitRing(0.62, 0.022, CLAIR, 0.32);
    anneau.position.set(0, 0.50, 0);
    root.add(anneau);                                                                  // 12

    // ATTRIBUT SPECTACULAIRE 2 : quatre astres qui gravitent autour de lui.
    const astres = pivot(0, 0.50, 0);
    root.add(astres);
    [[-0.50, 0.34, 0.10, 0.055], [0.54, 0.20, -0.06, 0.048],
     [-0.42, -0.30, -0.10, 0.044], [0.44, -0.36, 0.04, 0.050]].forEach(function (q) {
      astres.add(sparkle(q[3], CLAIR, q[0], q[1], q[2]));                              // 13-16
    });

    // Deux coussinets pour qu'il tienne debout.
    [-1, 1].forEach(function (k) {
      root.add(R3.ellipsoid(0.095, 0.06, 0.115, OR, k * 0.30, 0.055, 0.02));           // 17, 18
    });

    // Une petite traîne de comète derrière lui.
    const tr = R3.cone(0.09, 0.34, CLAIR, 0, 0.50, -0.36, {
      transparent: true, opacity: 0.5, emissive: CLAIR, emissiveIntensity: 0.7,
      rough: 0.35, seg: 7, depthWrite: false,
    });
    tr.rotation.x = -Math.PI / 2;
    root.add(deco(tr));                                                                // 19

    s.g.userData.anim = { head: corps, tail: astres, float: true };
    s.g.userData.baseY = 0.05;
    s.g.userData.attack = function (gg, p) {
      // « Explosion d'étoiles » : il tournoie, bondit, ses astres partent en gerbe.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.50;
      root.position.y = k * 0.24;
      corps.rotation.y = t * Math.PI * 4;
      astres.rotation.y = -t * Math.PI * 5;
      astres.scale.setScalar(1 + k * 1.0);
      anneau.scale.setScalar(1 + k * 0.7);
      if (p >= 1) { astres.scale.setScalar(1); anneau.scale.setScalar(1); }
    };
    return s.g;
  }

  // ===========================================================================
  //  DOUDOUNE -> stade 2 : le coq-soleil.
  //  Le poussin duveteux est devenu un coq éclatant : crête dressée, grande
  //  queue de plumes, ailes qui portent enfin.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildDoudouneon() {
    const OR = '#f1c40f', CLAIR = '#fcef8d', BEC = '#ef7d57', BEC_SOMBRE = '#d95f3c';
    const s = shell(), root = s.root;

    root.add(R3.ellipsoid(0.34, 0.36, 0.32, OR, 0, 0.44, 0, { rough: 0.95 }));         // 1
    root.add(deco(R3.ellipsoid(0.28, 0.29, 0.27, CLAIR, 0, 0.43, 0.055, { rough: 1 }))); // 2

    // Tête.
    const tete = pivot(0, 0.86, 0.02);
    root.add(tete);
    tete.add(R3.ellipsoid(0.24, 0.22, 0.23, OR, 0, 0, 0, { rough: 0.95 }));            // 3

    // ATTRIBUT SPECTACULAIRE 1 : la crête de coq, trois lames dressées.
    tete.add(spikeRow([
      [-0.09, 0.24, -0.01, 0.055, 0.16, 0],
      [0.00, 0.28, -0.01, 0.065, 0.22, 0],
      [0.09, 0.24, -0.01, 0.055, 0.16, 0],
    ], BEC, { flat: false, rough: 0.7, flatten: 0.45 }));                              // 4-6

    const bec = R3.cone(0.070, 0.17, BEC, 0, -0.045, 0.215, { seg: 9 });
    bec.rotation.x = Math.PI / 2;
    tete.add(deco(bec));                                                               // 7
    tete.add(bigEyes(0.105, 0.04, 0.215, 0.066));                                      // 8-11
    tete.add(deco(R3.ellipsoid(0.050, 0.026, 0.045, BEC_SOMBRE, 0, -0.09, 0.215)));    // 12

    // Ailes qui portent enfin.
    const aileL = pivot(-0.31, 0.48, 0.01), aileR = pivot(0.31, 0.48, 0.01);
    aileL.add(featherWing(0.40, 0.40, OR, CLAIR, -1));                                 // 13, 14
    aileR.add(featherWing(0.40, 0.40, OR, CLAIR, 1));                                  // 15, 16
    aileL.rotation.y = -0.28; aileR.rotation.y = 0.28;
    root.add(aileL, aileR);

    // ATTRIBUT SPECTACULAIRE 2 : la grande queue de plumes recourbées.
    const queue = pivot(0, 0.48, -0.30);
    root.add(queue);
    [[0, 0.16, -0.14, 0.09, 0.30, 0.55], [0, 0.30, -0.24, 0.075, 0.26, 0.85]]
      .forEach(function (q) {
        const pl = R3.ellipsoid(q[3], q[3] * 0.42, q[4] * 0.5, CLAIR, q[0], q[1], q[2],
          { rough: 0.92 });
        pl.rotation.x = q[5];
        queue.add(deco(pl));                                                           // 17, 18
      });

    // Une patte visible devant (l'autre est cachée par le corps de face).
    root.add(R3.ellipsoid(0.085, 0.04, 0.115, BEC, 0, 0.045, 0.12, { rough: 0.8 }));   // 19

    s.g.userData.anim = { head: tete, wingL: aileL, wingR: aileR, tail: queue };
    s.g.userData.attack = function (gg, p) {
      // « Plumes tourbillon » : il bat des ailes, monte et pique du bec.
      const k = pulse(p), t = R3.clamp01(p);
      root.position.z = k * 0.48;
      root.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.16;
      tete.rotation.x = k * 0.45;
      const bat = Math.abs(Math.sin(t * 14)) * 1.0;
      aileL.rotation.z = -bat; aileR.rotation.z = bat;
      queue.rotation.x = -k * 0.38;
      if (p >= 1) { tete.rotation.x = 0; queue.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  FLAMDRAK -> stade 2 : le dragon de feu (« Flamdrakon »).
  //  C'est l'exemple donné par le contrat, donc le modèle-étalon du lot :
  //  mêmes rouges, même ventre crème, mais des ailes deux fois plus grandes,
  //  de vraies cornes et une crinière de flammes sur la nuque.
  //  Budget : 19 draw calls au repos (20 au pic de l'attaque, souffle compris).
  // ===========================================================================
  function buildFlamdrakon() {
    const ROUGE = '#e74c3c', CLAIR = '#ef7d57', SOMBRE = '#b13e53';
    const VENTRE = '#fcd8a0', OR = '#f1c40f', BLANC = '#fff0c8';
    const s = shell(), root = s.root;

    root.add(R3.ellipsoid(0.34, 0.32, 0.38, ROUGE, 0, 0.44, 0));                       // 1
    root.add(deco(R3.ellipsoid(0.235, 0.20, 0.20, VENTRE, 0, 0.34, 0.25, { rough: 0.95 }))); // 2
    [-1, 1].forEach(function (k) {
      root.add(R3.ellipsoid(0.115, 0.09, 0.15, SOMBRE, k * 0.18, 0.085, 0.07));        // 3, 4
    });

    // Tête, portée plus haut que chez Flamdrak : il se tient droit.
    const tete = pivot(0, 0.84, 0.07);
    root.add(tete);
    tete.add(R3.ellipsoid(0.255, 0.235, 0.26, ROUGE, 0, 0, 0));                        // 5
    tete.add(deco(R3.ellipsoid(0.175, 0.13, 0.15, CLAIR, 0, -0.05, 0.185)));           // 6
    tete.add(fireEyes(0.115, 0.05, 0.21, 0.062, OR));                                  // 7, 8

    // ATTRIBUT SPECTACULAIRE 1 : deux vraies cornes, longues et recourbées.
    tete.add(hornPair(0.34, 0.062, SOMBRE, 0.125, 0.26, -0.06, -0.60, -0.20));         // 9, 10

    // ATTRIBUT SPECTACULAIRE 2 : la crinière de flammes sur la nuque.
    const criniere = flames(0.30, 0.115, 2, OR, BLANC, 0, 0.62, -0.22);
    criniere.rotation.x = -0.45;
    R3.noShadow(criniere);
    root.add(criniere);                                                                // 11-13

    // ATTRIBUT SPECTACULAIRE 3 : les grandes ailes.
    const aileL = pivot(-0.28, 0.60, -0.10), aileR = pivot(0.28, 0.60, -0.10);
    aileL.add(wing2(0.58, 0.50, SOMBRE, ROUGE, -1));                                   // 14, 15
    aileR.add(wing2(0.58, 0.50, SOMBRE, ROUGE, 1));                                    // 16, 17
    aileL.rotation.y = -0.40; aileR.rotation.y = 0.40;
    root.add(aileL, aileR);

    // Queue à flamme.
    const queue = pivot(0, 0.38, -0.32);
    root.add(queue);
    queue.add(R3.ellipsoid(0.105, 0.10, 0.20, ROUGE, 0, 0.02, -0.15));                 // 18
    const bout = R3.cone(0.085, 0.26, OR, 0, 0.16, -0.34,
      { emissive: OR, emissiveIntensity: 0.7, rough: 0.4, seg: 8 });
    bout.rotation.x = -0.5;
    queue.add(deco(bout));                                                             // 19

    // Souffle de feu, invisible hors attaque (0 draw call au repos).
    const souffle = R3.cone(0.16, 0.52, OR, 0, -0.05, 0.42,
      { emissive: OR, emissiveIntensity: 0.9, rough: 0.35, seg: 9,
        transparent: true, opacity: 0.85, depthWrite: false });
    souffle.rotation.x = Math.PI / 2;
    souffle.visible = false;
    tete.add(deco(souffle));                                                           // (+1 pendant l'attaque)

    s.g.userData.anim = { head: tete, wingL: aileL, wingR: aileR, tail: queue };
    s.g.userData.attack = function (gg, p) {
      // « Inferno » : il se cabre, ouvre les ailes, puis crache un long jet.
      const t = R3.clamp01(p);
      const charge = Math.sin(Math.min(1, t / 0.35) * Math.PI * 0.5);
      const feu = pulse(Math.max(0, (t - 0.30) / 0.70));
      root.position.z = -charge * 0.16 + feu * 0.26;
      root.rotation.x = charge * 0.20 - feu * 0.24;
      tete.rotation.x = charge * 0.38 - feu * 0.48;
      souffle.visible = feu > 0.02;
      souffle.scale.set(0.5 + feu * 1.2, 0.5 + feu * 1.2, 0.4 + feu * 2.6);
      const bat = Math.sin(t * 13) * 0.7;
      aileL.rotation.z = -bat; aileR.rotation.z = bat;
      queue.rotation.x = -feu * 0.32;
      criniere.scale.setScalar(1 + charge * 0.35);
      if (p >= 1) { souffle.visible = false; criniere.scale.setScalar(1); }
    };
    return s.g;
  }

  // ===========================================================================
  //  FLAMDRAK -> stade 3 : le dragon-volcan (« Flamdrakar »).
  //  Le stade final d'un starter : plaque dorsale de lave, quatre cornes,
  //  crinière ardente et ailes immenses. Toujours le même rouge.
  //  Budget : 20 draw calls au repos.
  // ===========================================================================
  function buildFlamdrakar() {
    const ROUGE = '#e74c3c', CLAIR = '#ef7d57', SOMBRE = '#b13e53';
    const VENTRE = '#fcd8a0', OR = '#f1c40f', BLANC = '#fff0c8';
    const s = shell(), root = s.root;

    // Corps massif, poitrail bombé.
    root.add(R3.ellipsoid(0.38, 0.35, 0.42, ROUGE, 0, 0.46, 0));                       // 1
    root.add(deco(R3.ellipsoid(0.26, 0.23, 0.22, VENTRE, 0, 0.36, 0.28, { rough: 0.95 }))); // 2
    [-1, 1].forEach(function (k) {
      root.add(R3.ellipsoid(0.13, 0.10, 0.17, SOMBRE, k * 0.21, 0.095, 0.07));         // 3, 4
    });

    // ATTRIBUT SPECTACULAIRE 1 : la plaque dorsale de lave. Deux lames et non
    // trois : les ailes immenses ci-dessous sont ce qui distingue vraiment ce
    // stade du précédent, c'est là qu'il faut mettre le budget.
    root.add(spikeRow([
      [0, 0.66, -0.18, 0.115, 0.26, -0.40],
      [0, 0.50, -0.34, 0.095, 0.21, -0.60],
    ], SOMBRE, { flat: true, rough: 0.5, flatten: 0.45 }));                            // 5, 6

    // Cou puis tête, portés haut.
    root.add(R3.ellipsoid(0.155, 0.17, 0.155, ROUGE, 0, 0.78, 0.10));                  // 7
    const tete = pivot(0, 1.02, 0.15);
    root.add(tete);
    tete.add(R3.ellipsoid(0.245, 0.225, 0.27, ROUGE, 0, 0, 0));                        // 8
    tete.add(fireEyes(0.115, 0.05, 0.215, 0.060, OR));                                 // 9, 10

    // ATTRIBUT SPECTACULAIRE 2 : quatre cornes, deux longues et deux courtes.
    tete.add(hornPair(0.40, 0.062, SOMBRE, 0.125, 0.26, -0.07, -0.62, -0.18));         // 11, 12
    tete.add(hornPair(0.20, 0.045, CLAIR, 0.185, 0.10, -0.10, -0.95, -0.45));          // 13, 14

    // ATTRIBUT SPECTACULAIRE 3 : les ailes immenses.
    // (Envergure volontairement contenue sous 2 unités : au-delà, les ailes
    // traversent le décor des arènes et le culling du monde.)
    const aileL = pivot(-0.30, 0.66, -0.12), aileR = pivot(0.30, 0.66, -0.12);
    aileL.add(wing2(0.64, 0.60, SOMBRE, ROUGE, -1));                                   // 15, 16
    aileR.add(wing2(0.64, 0.60, SOMBRE, ROUGE, 1));                                    // 17, 18
    aileL.rotation.y = -0.42; aileR.rotation.y = 0.42;
    root.add(aileL, aileR);

    // Queue à flamme vive (flames(count 1) = 2 meshes : flamme + cœur clair).
    const queue = pivot(0, 0.40, -0.38);
    root.add(queue);
    const bout = flames(0.30, 0.11, 1, OR, BLANC, 0, 0.02, -0.20);
    bout.rotation.x = -0.35;
    R3.noShadow(bout);
    queue.add(bout);                                                                   // 19, 20

    s.g.userData.anim = { head: tete, wingL: aileL, wingR: aileR, tail: queue };
    s.g.userData.attack = function (gg, p) {
      // « Colère du dragon » : il s'élève d'un coup d'ailes, puis fond en
      // crachant le feu — les deux temps forts d'un combat de dragon.
      const t = R3.clamp01(p);
      const monte = Math.sin(Math.min(1, t / 0.35) * Math.PI * 0.5);
      const plonge = pulse(Math.max(0, (t - 0.30) / 0.70));
      root.position.y = monte * 0.34 - plonge * 0.14;
      root.position.z = -monte * 0.08 + plonge * 0.52;
      root.rotation.x = -plonge * 0.30;
      const bat = Math.sin(t * 12) * (0.95 - t * 0.25);
      aileL.rotation.z = -bat; aileR.rotation.z = bat;
      tete.rotation.x = monte * 0.30 - plonge * 0.40;
      queue.rotation.x = monte * 0.30;
      queue.rotation.y = Math.sin(t * 9) * 0.28;
      if (p >= 1) { root.rotation.x = 0; tete.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  GLYDRAK -> stade 2 : le dragon nocturne.
  //  Mêmes violets, même regard rouge, mais quatre cornes lilas, des ailes
  //  démesurées et un cristal à la pointe de la queue.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildGlydrakon() {
    const SOMBRE = '#5d275d', MID = '#7a3b8f', LILAS = '#d896ff';
    const ROSE = '#ffaad8', ROUGE = '#e74c3c';
    const s = shell(), root = s.root;

    // Corps élancé, dressé.
    root.add(R3.ellipsoid(0.25, 0.38, 0.25, SOMBRE, 0, 0.50, 0));                      // 1
    root.add(deco(R3.ellipsoid(0.135, 0.24, 0.115, ROSE, 0, 0.48, 0.18, { rough: 0.92 }))); // 2
    [-1, 1].forEach(function (k) {
      root.add(R3.ellipsoid(0.105, 0.085, 0.14, SOMBRE, k * 0.155, 0.08, 0.05));       // 3, 4
    });
    root.add(R3.ellipsoid(0.12, 0.12, 0.12, MID, 0, 0.86, 0.02));                      // 5

    // Tête.
    const tete = pivot(0, 0.98, 0.03);
    root.add(tete);
    tete.add(R3.ellipsoid(0.215, 0.20, 0.235, SOMBRE, 0, 0, 0));                       // 6
    tete.add(fireEyes(0.10, 0.035, 0.19, 0.055, ROUGE));                               // 7, 8

    // ATTRIBUT SPECTACULAIRE 1 : quatre cornes lilas en couronne.
    tete.add(hornPair(0.34, 0.048, LILAS, 0.09, 0.24, -0.06, -0.45, -0.12));           // 9, 10
    tete.add(hornPair(0.20, 0.038, LILAS, 0.165, 0.12, -0.10, -0.80, -0.42));          // 11, 12

    // ATTRIBUT SPECTACULAIRE 2 : des ailes démesurées, le trait dominant.
    const aileL = pivot(-0.19, 0.76, -0.11), aileR = pivot(0.19, 0.76, -0.11);
    aileL.add(wing2(0.68, 0.64, SOMBRE, LILAS, -1));                                   // 13, 14
    aileR.add(wing2(0.68, 0.64, SOMBRE, LILAS, 1));                                    // 15, 16
    aileL.rotation.y = -0.36; aileR.rotation.y = 0.36;
    root.add(aileL, aileR);

    // Queue longue, terminée par un cristal lilas.
    const queue = pivot(0, 0.30, -0.22);
    root.add(queue);
    queue.add(R3.ellipsoid(0.09, 0.09, 0.20, SOMBRE, 0, -0.04, -0.16));                // 17
    queue.add(R3.ellipsoid(0.062, 0.062, 0.15, MID, 0, -0.12, -0.36));                 // 18
    const dard = R3.cone(0.065, 0.20, LILAS, 0, -0.17, -0.52,
      { flat: true, rough: 0.4, seg: 8, emissive: LILAS, emissiveIntensity: 0.3 });
    dard.rotation.x = -Math.PI / 2 - 0.25;
    queue.add(deco(dard));                                                             // 19

    s.g.userData.anim = { head: tete, wingL: aileL, wingR: aileR, tail: queue };
    s.g.userData.attack = function (gg, p) {
      // « Souffle dragon » : il s'élève très haut puis fond sur l'adversaire.
      const t = R3.clamp01(p);
      const monte = Math.sin(Math.min(1, t / 0.4) * Math.PI * 0.5);
      const plonge = pulse(Math.max(0, (t - 0.35) / 0.65));
      root.position.y = monte * 0.42 - plonge * 0.18;
      root.position.z = plonge * 0.56;
      root.rotation.x = -plonge * 0.30;
      const bat = Math.sin(t * 15) * (0.95 - t * 0.3);
      aileL.rotation.z = -bat; aileR.rotation.z = bat;
      tete.rotation.x = plonge * 0.32;
      queue.rotation.x = monte * 0.38;
      if (p >= 1) { root.rotation.x = 0; tete.rotation.x = 0; }
    };
    return s.g;
  }

  // ===========================================================================
  //  AQUADRAK -> stade 2 : le serpent des mers.
  //  Le corps serpentin s'est allongé, la crête dorsale court sur tout le dos
  //  et une couronne de corail turquoise lui ceint la tête.
  //  Budget : 19 draw calls.
  // ===========================================================================
  function buildAquadrakon() {
    const FONCE = '#16a085', CLAIR = '#1abc9c', TURQ = '#73eff7', DORSAL = '#0e6655';
    const s = shell(), root = s.root;

    // L'enroulement au sol, puis quatre segments qui montent en S.
    root.add(R3.ellipsoid(0.36, 0.13, 0.36, FONCE, 0, 0.12, -0.02));                   // 1
    [[0.26, 0.24, 0.29, 0.07], [0.24, 0.44, 0.245, -0.03],
     [0.22, 0.62, 0.22, -0.09], [0.195, 0.78, 0.20, -0.03]].forEach(function (q) {
      root.add(R3.ellipsoid(q[0], q[2] * 0.58, q[2], FONCE, 0, q[1], q[3]));           // 2-5
    });
    root.add(deco(R3.ellipsoid(0.135, 0.22, 0.09, TURQ, 0, 0.40, 0.24, { rough: 0.9 }))); // 6

    // ATTRIBUT SPECTACULAIRE 1 : la crête dorsale complète, trois lames.
    root.add(spikeRow([
      [0, 0.32, -0.22, 0.15, 0.26, -0.45],
      [0, 0.52, -0.26, 0.16, 0.28, -0.42],
      [0, 0.70, -0.22, 0.13, 0.24, -0.40],
    ], DORSAL, { flat: true, rough: 0.55, flatten: 0.35 }));                           // 7-9

    // Nageoires latérales, comme deux ailes d'eau.
    const nagL = pivot(-0.30, 0.42, -0.02), nagR = pivot(0.30, 0.42, -0.02);
    [[nagL, -1], [nagR, 1]].forEach(function (n) {
      const m = R3.ellipsoid(0.21, 0.14, 0.022, CLAIR, n[1] * 0.15, 0, 0,
        { side: THREE.DoubleSide, rough: 0.7 });
      m.rotation.z = n[1] * 0.40;
      m.rotation.y = -n[1] * 0.25;
      n[0].add(deco(m));                                                               // 10, 11
    });
    root.add(nagL, nagR);

    // Nageoire caudale à deux lobes.
    const queue = fin(0.34, 0.30, CLAIR, 2, 0, 0.30, -0.32);
    root.add(queue);                                                                   // 12-14

    // Tête.
    const tete = pivot(0, 0.98, 0.02);
    root.add(tete);
    tete.add(R3.ellipsoid(0.215, 0.175, 0.26, FONCE, 0, 0, 0.02));                     // 15
    tete.add(fireEyes(0.115, 0.04, 0.195, 0.050, TURQ));                               // 16, 17

    // ATTRIBUT SPECTACULAIRE 2 : la couronne de corail turquoise.
    tete.add(spikeRow([
      [-0.095, 0.155, -0.02, 0.042, 0.20, -0.30],
      [0.095, 0.155, -0.02, 0.042, 0.20, -0.30],
    ], TURQ, { emissive: TURQ, emissiveIntensity: 0.45 }));                            // 18, 19

    s.g.userData.anim = { head: tete, wingL: nagL, wingR: nagR, tail: queue };
    s.g.userData.attack = function (gg, p) {
      // « Hydromoteur » : il se love en arrière, puis détend tout son corps.
      const t = R3.clamp01(p);
      const charge = Math.sin(Math.min(1, t / 0.35) * Math.PI * 0.5);
      const tir = pulse(Math.max(0, (t - 0.30) / 0.70));
      root.rotation.x = charge * 0.20 - tir * 0.18;
      root.position.z = -charge * 0.12 + tir * 0.40;
      tete.rotation.x = charge * 0.42 - tir * 0.38;
      tete.position.z = 0.02 + tir * 0.16;
      queue.rotation.y = Math.sin(t * 10) * 0.40;
      if (p >= 1) { root.rotation.x = 0; tete.rotation.x = 0; tete.position.z = 0.02; }
    };
    return s.g;
  }

  // ===========================================================================
  //  TONNEDRAK -> stade 2 : le dragon-tonnerre.
  //  Même or éclatant, mêmes zigzags orange, mais des ailes qui portent, une
  //  crête d'éclairs sur tout le dos et un anneau électrique en orbite.
  //  Budget : 20 draw calls.
  // ===========================================================================
  function buildTonnedrakon() {
    const OR = '#f1c40f', CLAIR = '#fcef8d', ORANGE = '#ef7d57';
    const s = shell(), root = s.root;

    root.add(R3.ellipsoid(0.35, 0.32, 0.35, OR, 0, 0.42, 0));                          // 1
    root.add(deco(R3.ellipsoid(0.29, 0.26, 0.30, CLAIR, 0, 0.45, 0.055)));             // 2
    [-1, 1].forEach(function (k) {
      root.add(R3.ellipsoid(0.115, 0.085, 0.14, OR, k * 0.175, 0.08, 0.06));           // 3, 4
    });

    // ATTRIBUT SPECTACULAIRE 1 : la crête d'éclairs, trois zigzags lumineux.
    root.add(spikeRow([
      [0, 0.66, -0.10, 0.095, 0.24, -0.55],
      [0, 0.74, 0.00, 0.110, 0.30, -0.15],
      [0, 0.64, 0.10, 0.090, 0.22, 0.25],
    ], ORANGE, { flat: true, rough: 0.45, flatten: 0.4, emissive: ORANGE, emissiveIntensity: 0.35 })); // 5-7

    // Ailes qui portent enfin.
    const aileL = pivot(-0.31, 0.52, -0.06), aileR = pivot(0.31, 0.52, -0.06);
    aileL.add(wing2(0.50, 0.44, OR, ORANGE, -1));                                      // 8, 9
    aileR.add(wing2(0.50, 0.44, OR, ORANGE, 1));                                       // 10, 11
    aileL.rotation.y = -0.38; aileR.rotation.y = 0.38;
    root.add(aileL, aileR);

    // Tête.
    const tete = pivot(0, 0.80, 0.05);
    root.add(tete);
    // NB : pas de doublage clair sur le crâne (comme chez Tonnedrak) — sur un
    // corps déjà doré il ne se voit presque pas, et ces 2 draw calls servent
    // bien mieux l'anneau électrique et l'éclair de la queue.
    tete.add(R3.ellipsoid(0.265, 0.245, 0.26, OR, 0, 0, 0));                           // 12
    tete.add(bigEyes(0.115, 0.04, 0.225, 0.062));                                      // 13-16
    // Cornes en zigzag, ramenées à une paire bien lisible.
    tete.add(hornPair(0.24, 0.052, ORANGE, 0.13, 0.26, -0.02, 0, -0.55));              // 17, 18

    // Queue terminée par un éclair.
    const queue = pivot(0, 0.36, -0.30);
    root.add(queue);
    const eclair = sparkle(0.135, ORANGE, 0, 0.14, -0.22);
    queue.add(eclair);                                                                 // 19

    // ATTRIBUT SPECTACULAIRE 2 : l'anneau électrique en orbite (il tourne avec
    // la queue, puisque les deux vivent dans le même groupe `tail`).
    const anneau = orbitRing(0.60, 0.020, CLAIR, 0.28);
    anneau.position.set(0, 0.48, 0.30);
    queue.add(anneau);                                                                 // 20

    grandir(root, 1.10);   // Tonnedrak était déjà haut : il faut en rajouter

    s.g.userData.anim = { head: tete, wingL: aileL, wingR: aileR, tail: queue };
    s.g.userData.attack = function (gg, p) {
      // « Tonnerre » : il se ramasse, sa queue s'embrase, puis il décoche.
      const t = R3.clamp01(p);
      const charge = Math.sin(Math.min(1, t / 0.4) * Math.PI * 0.5);
      const tir = pulse(Math.max(0, (t - 0.35) / 0.65));
      root.position.y = -charge * 0.08 + tir * 0.22;
      root.position.z = -charge * 0.12 + tir * 0.46;
      tete.rotation.x = charge * 0.30 - tir * 0.38;
      const bat = Math.sin(t * 20) * 0.85;
      aileL.rotation.z = -bat; aileR.rotation.z = bat;
      queue.rotation.x = -charge * 0.45 + tir * 0.30;
      eclair.rotation.z = t * 22;
      eclair.scale.setScalar(1 + charge * 0.6 + tir * 1.5);
      anneau.scale.setScalar(1 + tir * 1.1);
      if (p >= 1) { eclair.scale.setScalar(1); anneau.scale.setScalar(1); }
    };
    return s.g;
  }

  // ###########################################################################
  //  ENREGISTREMENT DES 30 MODÈLES
  //  Chaque appel couvre `<base>on`, `<base>ar` et `<base>ix`, plus les
  //  variantes élidées (voir `evolue()` et `racines()` en tête de fichier).
  // ###########################################################################

  // --- Lot 1 -----------------------------------------------------------------
  evolue('feuillou', buildFeuillouon, buildFeuillouar);   // starter Plante : 3 stades
  evolue('petalia', buildPetaliaon);
  evolue('goutella', buildGoutellaon, buildGoutellaar);   // starter Eau : 3 stades
  evolue('bullini', buildBullinion);
  evolue('etincelo', buildEtinceloon);
  evolue('meduzia', buildMeduziaon);
  evolue('coralou', buildCoralouon);

  // --- Lot 2 -----------------------------------------------------------------
  evolue('fluffly', buildFlufflyon);
  evolue('glanou', buildGlanouon);
  evolue('papillon', buildPapillonon);
  evolue('cygnik', buildCygnikon);
  evolue('lotira', buildLotiraon);
  evolue('lapinou', buildLapinouon);
  evolue('hibouche', buildHiboucheon);

  // --- Lot 3 -----------------------------------------------------------------
  evolue('etoilamer', buildEtoilameron);
  evolue('crabilino', buildCrabilinon);
  evolue('nuagette', buildNuagetteon);
  evolue('miaouche', buildMiaoucheon, buildMiaouchear);   // starter du jeu : 3 stades
  evolue('pandouki', buildPandoukion);
  evolue('koronette', buildKoronetteon);

  // --- Lot 4 -----------------------------------------------------------------
  evolue('stellini', buildStellinion);
  evolue('doudoune', buildDoudouneon);
  evolue('flamdrak', buildFlamdrakon, buildFlamdrakar);   // starter du jeu : 3 stades
  evolue('glydrak', buildGlydrakon);
  evolue('aquadrak', buildAquadrakon);
  evolue('tonnedrak', buildTonnedrakon);

  // Trace de chargement : utile en console quand on cherche pourquoi une
  // évolution affiche une silhouette grise.
  R3.register('creatures3d.p5', {
    lot: 'E2 — formes évoluées',
    bases: 26,
    modeles: 30,
    /** Rend la liste des ids canoniques, pour le lot Intégration. */
    idsCanoniques: function () {
      return [
        'feuillouon', 'feuillouar', 'petaliaon', 'goutellaon', 'goutellaar',
        'bullinion', 'etinceloon', 'meduziaon', 'coralouon',
        'flufflyon', 'glanouon', 'papillonon', 'cygnikon', 'lotiraon',
        'lapinouon', 'hiboucheon',
        'etoilameron', 'crabilinon', 'nuagetteon', 'miaoucheon', 'miaouchear',
        'pandoukion', 'koronetteon',
        'stellinion', 'doudouneon', 'flamdrakon', 'flamdrakar', 'glydrakon',
        'aquadrakon', 'tonnedrakon',
      ];
    },
  });

})();
