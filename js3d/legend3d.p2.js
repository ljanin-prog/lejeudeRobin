// =============================================================================
//  legend3d.p2.js — LOT P2 DES 36 LÉGENDAIRES   (CONTRACT2 §4, CONTRACT3 §9)
//  glace · air · terre · roche
//  cryonix · givréa · banquisor · bourrasca · zéphyrion · aélune ·
//  géomastre · terracor · limonis · monolithe · cristallia · obsidion
// =============================================================================
//  DEMANDE N° 5 DE ROBIN : « j'aimerai que les légendaires soient presque
//  pareils que les vrais de la série Pokémon et Pokémon Horizons ».
//  On s'inspire, on ne copie pas : les noms, les ids, les types et les régions
//  ne bougent pas. Ce qui progresse ici, c'est la SILHOUETTE.
//
//  CE QUI A CHANGÉ PAR RAPPORT À LA VERSION PRÉCÉDENTE
//  ---------------------------------------------------
//  1) LE BUDGET D'ABORD. CONTRACT3 §9 impose 25 draw calls maximum par
//     légendaire. La version précédente en dépensait 44 en moyenne (jusqu'à 58
//     pour Cryonix et Bourrasca) : deux légendaires à l'écran suffisaient à
//     manger la moitié du budget global de 250. Chaque modèle a donc été
//     REDESSINÉ autour de 23-24 meshes, et non pas simplement « allégé ».
//     Un jeu qui rame n'est plus un cadeau — cette contrainte a primé sur tout.
//
//  2) MOINS DE PIÈCES, PLUS GROSSES. Esprit « Horizons » : trois immenses
//     rémiges valent mieux que huit petites plumes, une ramure de trois prismes
//     bien écartés vaut mieux que six éclats serrés. Facettes dures partout
//     (flat: true), couleurs franches, contours marqués.
//
//  3) CHACUN GAGNE AU MOINS DEUX ATTRIBUTS DISTINCTIFS (CONTRACT3 §9) pris
//     dans la liste : ailes majestueuses, traîne, couronne, anneaux en orbite,
//     cristaux, runes, cœur lumineux. Ils sont annoncés en tête de chaque
//     créature, avec le décompte des draw calls.
//
//  4) QUATRE D'ENTRE EUX NE TOUCHENT PLUS LE SOL (Cryonix, Zéphyrion, Aélune,
//     Monolithe). Un légendaire qui lévite se lit immédiatement comme un être
//     supérieur — et quatre pattes en moins, ce sont quatre draw calls rendus
//     à la silhouette.
//
//  5) IDLE CALME (CONTRACT3 §9). R3.idleCreature() fait battre wingL/wingR à
//     6 rad/s : parfait pour un moineau, ridicule pour un colosse de pierre et
//     agité pour un dragon qui plane. Seules les créatures dont ce rythme a du
//     sens gardent ces champs ; les autres reçoivent un idle sur mesure (champ
//     `idle` de finir()), lent, entre 0,4 et 1,3 rad/s. Il est mis en pause
//     pendant une attaque pour ne pas écraser sa pose.
//
//  CONTRAT DE CHAQUE MODÈLE (inchangé)
//  -----------------------------------
//    * Group centré en (0,0,0), posé sur y = 0, regardant vers +z.
//    * 1,8 à 2,4 unités de haut.
//    * Porte une aura (LL.aura) — obligatoire, c'est elle qui le distingue
//      d'une créature ordinaire même de loin sur la carte.
//    * userData.anim = { head, wingL, wingR, tail, float } (R3.idleCreature),
//      complété par un idle sur mesure quand le rythme par défaut ne convient
//      pas (voir le point 5 ci-dessus).
//    * userData.legendary = true, userData.auraColor = '#xxxxxx'
//    * userData.attack = function (racine, p), p de 0 à 1 — obligatoire.
//    * Tout le corps est rangé dans un sous-groupe `inner` : les attaques
//      bougent `inner`, jamais le Group racine, que battle3d.js positionne et
//      que R3.idleCreature() met à l'échelle pour la respiration.
//
//  BIBLIOTHÈQUES
//  -------------
//    LL = R3.get('llib')  — primitives des légendaires (aura, ailes, cristaux…)
//    CL = R3.get('clib')  — primitives des créatures ordinaires
//  Les deux sont FACULTATIVES : un repli local (LIB(), pawM(), earG()…) évite
//  toute exception si l'une manque, quitte à être visuellement plus simple.
//
//  PIÈGE CONNU, ET SON CONTOURNEMENT (voir le rapport du lot L2)
//  ------------------------------------------------------------
//  R3.idleCreature() (core3d.js) n'appelle PAS userData.anim.update : la
//  fonction LL.animateAura() du contrat n'était donc jamais exécutée et les
//  auras restaient figées. On garde anim.update (c'est le contrat) ET on se
//  greffe sur updateMatrixWorld, appelé une fois par image par le moteur, pour
//  piloter nous-mêmes l'animation lente. Voir relaisAnim().
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // ---------------------------------------------------------------------------
  //  Accès à clib, avec repli silencieux à null (voir pawM/earG).
  // ---------------------------------------------------------------------------
  function CLIB() { return R3.get('clib') || null; }

  // ---------------------------------------------------------------------------
  //  Repli local pour llib — utilisé UNIQUEMENT si R3.get('llib') est absent au
  //  moment de la construction (jamais au chargement du fichier : LIB() est
  //  appelée depuis l'intérieur de chaque build()). Chaque fonction reprend la
  //  signature exacte du §13 de CONTRACT2, en version très simplifiée, avec un
  //  coût en meshes du même ordre pour ne pas faire exploser le budget.
  // ---------------------------------------------------------------------------
  let _lib = null;
  function LIB() {
    if (_lib) return _lib;
    const repli = buildFallback();
    const vraie = R3.get('llib');
    if (!vraie) return (_lib = repli);
    // On NE modifie PAS l'objet de legendlib3d.js (il appartient au lot L1) :
    // on assemble une vue locale où chaque primitive réellement fournie prend
    // le pas sur le repli. Si L1 renomme ou retire une primitive « bonus »
    // (serpentBody, plateShell…), on garde une version simple au lieu de faire
    // échouer toute la construction.
    const m = {};
    Object.keys(repli).forEach(function (k) { m[k] = repli[k]; });
    Object.keys(vraie).forEach(function (k) { if (typeof vraie[k] === 'function') m[k] = vraie[k]; });
    return (_lib = m);
  }

  function buildFallback() {
    function grp() { return new THREE.Group(); }
    function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
    function safe(fn) {
      return function () {
        try { const r = fn.apply(null, arguments); return r || grp(); }
        catch (e) { return grp(); }
      };
    }
    const F = {};

    F.aura = safe(function (color, r, o) {
      o = o || {};
      r = Math.max(0.15, r || 1);
      const y = num(o.y0, r * 0.85);
      const g = grp();
      g.add(R3.ellipsoid(r * 0.7, r * 0.66, r * 0.7, color, 0, y, 0,
        { transparent: true, opacity: 0.22, depthWrite: false, emissive: color, emissiveIntensity: 0.9, rough: 0.3 }));
      g.add(R3.ellipsoid(r, r * 0.95, r, o.color2 || color, 0, y, 0,
        { transparent: true, opacity: 0.10, depthWrite: false, emissive: o.color2 || color, emissiveIntensity: 0.6, rough: 0.3 }));
      R3.noShadow(g);
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });

    F.bigEyes = safe(function (spread, y, z, r, o) {
      return R3.eyes(num(spread, 0.16), num(y, 0.1), num(z, 0.28), r || 0.075);
    });

    F.majesticWing = safe(function (len, color, o) {
      o = o || {};
      len = Math.max(0.15, len || 0.9);
      const g = grp();
      g.add(R3.wing(len, len * 0.7, color, len * 0.5, 0, 0, { side: THREE.DoubleSide }));
      if (num(o.side, 1) < 0) g.rotation.y = Math.PI;
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });

    F.crystalCluster = safe(function (color, n, scale, o) {
      o = o || {};
      n = Math.max(1, Math.min(6, Math.round(n || 3)));
      scale = Math.max(0.05, scale || 0.35);
      const g = grp();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.4;
        g.add(R3.cone(scale * 0.2, scale * 1.3, (o.tipColor && i % 3 === 1) ? o.tipColor : color,
          Math.cos(a) * scale * 0.35, scale * 0.65, Math.sin(a) * scale * 0.35, { flat: true, seg: 6 }));
      }
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });

    F.plumeTail = safe(function (len, color, n, o) {
      o = o || {};
      len = Math.max(0.15, len || 1);
      n = Math.max(1, Math.min(6, Math.round(n || 3)));
      const root = grp(); const step = len / n;
      let parent = root;
      for (let i = 0; i < n; i++) {
        const s = grp();
        s.position.z = (i === 0) ? -step * 0.45 : -step;
        s.add(R3.ellipsoid(step * 0.45, step * 0.28, step * 0.5, (i % 2) ? (o.color2 || color) : color,
          0, 0, -step * 0.15, { rough: 0.6 }));
        parent.add(s); parent = s;
      }
      root.position.set(o.x || 0, o.y || 0, o.z || 0);
      return root;
    });

    F.halo = safe(function (color, r, rays, o) {
      o = o || {};
      r = Math.max(0.08, r || 0.5);
      const g = grp();
      g.add(R3.torus(r, r * 0.09, color, 0, 0, 0,
        { emissive: color, emissiveIntensity: 1.2, transparent: true, opacity: 0.85, depthWrite: false }));
      R3.noShadow(g);
      if (o.plane === 'flat') g.rotation.x = -Math.PI / 2;
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });

    F.orbitRing = safe(function (color, r, n, o) {
      o = o || {};
      r = Math.max(0.1, r || 0.8);
      n = Math.max(1, Math.min(6, Math.round(n || 4)));
      const g = grp();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        g.add(R3.sphere(r * 0.09, color, Math.cos(a) * r, 0, Math.sin(a) * r,
          { emissive: color, emissiveIntensity: 0.6, seg: 8 }));
      }
      g.rotation.x = num(o.tilt, 0.35);
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });

    F.runeStone = safe(function (color, size, o) {
      o = o || {};
      size = Math.max(0.05, size || 0.3);
      const cnt = Math.max(1, Math.min(2, Math.round(num(o.count, 1))));
      const g = grp();
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * Math.PI * 2;
        const d = (cnt > 1) ? num(o.spread, size * 2.2) : 0;
        g.add(R3.box(size * 0.8, size * 1.2, size * 0.6, color,
          Math.cos(a) * d, 0, Math.sin(a) * d, { flat: true, rough: 0.85 }));
        g.add(R3.sphere(size * 0.3, o.glowColor || '#ffe066',
          Math.cos(a) * d, 0, Math.sin(a) * d + size * 0.5,
          { emissive: o.glowColor || '#ffe066', emissiveIntensity: 1.2, seg: 8 }));
      }
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });

    F.flowRibbon = safe(function (len, color, o) {
      o = o || {};
      len = Math.max(0.15, len || 1.2);
      const n = Math.max(2, Math.min(6, Math.round(num(o.segments, 4))));
      const g = grp(); const step = len / n;
      for (let i = 0; i < n; i++) {
        g.add(R3.box(num(o.width, len * 0.22) * (1 - i / n * 0.5), num(o.thick, 0.05), step,
          (i % 2) ? (o.color2 || color) : color, 0, 0, -(i + 0.5) * step,
          { transparent: true, opacity: num(o.opacity, 0.75), emissive: color, emissiveIntensity: 0.5, depthWrite: false }));
      }
      R3.noShadow(g);
      if (o.axis === 'y') g.rotation.x = Math.PI / 2; else if (o.axis === 'x') g.rotation.y = -Math.PI / 2;
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });

    F.serpentBody = safe(function (len, color, o) {
      o = o || {};
      len = Math.max(0.2, len || 1.6);
      const n = Math.max(2, Math.min(8, Math.round(num(o.segments, 6))));
      const r0 = num(o.r, len * 0.16), step = len / n;
      const root = grp(); let parent = root;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1 || 1);
        const rr = r0 * (1 - u * num(o.taper, 0.75));
        const s = grp();
        s.position.z = (i === 0) ? -step * 0.5 : -step;
        s.add(R3.ellipsoid(rr, rr * 0.9, step * 0.72, (i % 2) ? (o.color2 || color) : color, 0, 0, 0, { rough: 0.55 }));
        parent.add(s); parent = s;
      }
      root.position.set(o.x || 0, o.y || 0, o.z || 0);
      return root;
    });

    F.plateShell = safe(function (r, color, o) {
      o = o || {};
      r = Math.max(0.1, r || 0.7);
      const h = num(o.h, r * 0.55);
      const g = grp();
      g.add(R3.ellipsoid(r, h, r, color, 0, 0, 0, { rough: 0.9, flat: true }));
      const n = Math.max(1, Math.min(4, Math.round(num(o.plates, 3))));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        g.add(R3.cyl(r * 0.30, r * 0.34, h * 0.22, o.plateColor || color,
          Math.cos(a) * r * 0.52, h * 0.72, Math.sin(a) * r * 0.52, { flat: true, rough: 0.85, seg: 6 }));
      }
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });

    F.glowCore = safe(function (color, r, o) {
      o = o || {};
      r = Math.max(0.03, r || 0.25);
      const g = grp();
      g.add(R3.sphere(r * 0.55, color, 0, 0, 0, { emissive: color, emissiveIntensity: 1.5, seg: 10 }));
      g.add(R3.sphere(r * 1.0, o.color2 || color, 0, 0, 0,
        { transparent: true, opacity: 0.28, emissive: o.color2 || color, emissiveIntensity: 0.9, depthWrite: false, seg: 10 }));
      R3.noShadow(g);
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });

    F.starfield = safe(function (color, n, r, o) {
      // Sans THREE.Points ni la texture de point de llib, on se contente de
      // DEUX lucioles. La vraie primitive ne coûte qu'un seul draw call : si le
      // repli en dépensait cinq, le budget de 25 sauterait en mode dégradé.
      o = o || {};
      r = Math.max(0.1, r || 1);
      const g = grp();
      for (let i = 0; i < 2; i++) {
        const a = (i / 2) * Math.PI * 2;
        g.add(R3.sphere(r * 0.05, color, Math.cos(a) * r * 0.8, (i % 2 ? 0.2 : -0.15) * r, Math.sin(a) * r * 0.8,
          { emissive: color, emissiveIntensity: 1.2, seg: 6, transparent: true, opacity: 0.9, depthWrite: false }));
      }
      R3.noShadow(g);
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      return g;
    });

    F.animateAura = function () { /* le repli est statique, mais il ne casse rien */ };
    F.refresh = function () { };
    return F;
  }

  // ===========================================================================
  //  PRIMITIVES LOCALES
  //  (écrites ici parce qu'elles n'existent pas dans legendlib3d.js, qui
  //   appartient au lot L1 — voir le rapport final)
  // ===========================================================================

  /**
   * regard(spread, y, z, r, opts) — les yeux d'un légendaire en DEUX draw calls.
   *
   * POURQUOI une primitive locale : LL.bigEyes() coûte 6 à 8 meshes (globe +
   * iris + reflet + sourcil, par œil). Avec un budget total de 25, les yeux
   * mangeaient un tiers de la silhouette. Ici, une seule amande par œil :
   * albédo TRÈS sombre + émissif de la couleur de l'iris. Le résultat se lit
   * sur un pelage blanc comme sur une roche noire — c'est exactement ce qu'il
   * faut pour un légendaire vu de loin — et le clignement n'est pas nécessaire
   * à cette distance.
   */
  function regard(spread, y, z, r, o) {
    o = o || {};
    const iris = o.color || '#ffe066';
    const sombre = o.dark || '#141824';
    const tilt = (o.tilt !== undefined) ? o.tilt : 0.24;
    const g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      const e = R3.ellipsoid(r * 1.20, r * 0.72, r * 0.52, sombre, s * spread, y, z, {
        emissive: iris, emissiveIntensity: (o.intensity !== undefined) ? o.intensity : 1.25,
        rough: 0.3, flat: !!o.flat,
      });
      e.rotation.z = -s * tilt;
      e.castShadow = false; e.receiveShadow = false;
      g.add(e);
    });
    return g;
  }

  /** Retire l'ombre d'un mesh : les détails décoratifs n'ont pas à doubler le
   *  coût de la passe d'ombres. Renvoie le mesh pour rester chaînable. */
  function sansOmbre(m) { m.castShadow = false; m.receiveShadow = false; return m; }

  /** Patte simple : UN seul mesh (cône tronqué). Un légendaire quadrupède
   *  dépense ainsi 4 draw calls pour ses pattes, pas 8. */
  function patte(x, z, h, rHaut, rBas, color, opts) {
    const g = new THREE.Group();
    g.position.set(x, h, z);
    const m = R3.cyl(rHaut, rBas, h, color, 0, -h / 2, 0,
      Object.assign({ rough: 0.7, seg: 7 }, opts || {}));
    g.add(m);
    return g;
  }

  /** Ossature commune : racine + sous-groupe `inner` (voir creatures3d.p1.js). */
  function shell() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    g.userData.inner = inner;
    return g;
  }

  /** Courbe 0 -> 1 -> 0, la base de presque toutes les animations d'attaque. */
  function arc(p) { return Math.sin(R3.clamp01(p) * Math.PI); }

  /**
   * relaisAnim(g, LL) — fait vivre l'aura, les anneaux et les cristaux.
   *
   * POURQUOI : le contrat prévoit `userData.anim.update(root, t)` appelé par
   * l'idle, mais R3.idleCreature() (core3d.js, qui ne nous appartient pas)
   * ne l'appelle jamais : il ne lit que head / wingL / wingR / tail / float.
   * Résultat, LL.animateAura() était du code mort et les auras ne pulsaient
   * pas. On garde donc anim.update — c'est le contrat, et le lot Intégration
   * pourra le brancher proprement — ET on se greffe sur updateMatrixWorld, que
   * le moteur appelle exactement une fois par image sur chaque objet de la
   * scène. Le garde sur R3.clock.t évite tout double travail si les deux
   * chemins finissent par coexister.
   */
  function relaisAnim(g, LL, idle) {
    const animer = function (t) {
      LL.animateAura(g, t);
      // L'idle propre à la créature (ailes qui planent, bras qui respirent,
      // menhirs qui dérivent) est SUSPENDU pendant une attaque : les deux
      // écriraient sur les mêmes rotations et l'attaque perdrait, puisque le
      // rendu passe après la mise à jour du combat.
      if (idle && !g.userData._atk) {
        try { idle(t); } catch (e) { /* jamais d'exception dans une image */ }
      }
    };
    if (!g.userData.anim) g.userData.anim = {};
    g.userData.anim.update = function (root, t) {
      animer((typeof t === 'number' && isFinite(t)) ? t : (R3.clock ? R3.clock.t : 0));
    };
    g.updateMatrixWorld = function (force) {
      const t = (R3.clock && R3.clock.t) || 0;
      if (t !== this.userData._auraT) {
        this.userData._auraT = t;
        try { animer(t); } catch (e) { /* une animation ne casse jamais une image */ }
      }
      THREE.Object3D.prototype.updateMatrixWorld.call(this, force);
    };
  }

  /** Dernière ligne de chaque légendaire : marque, aura, relais d'animation. */
  function finir(g, LL, o) {
    g.userData.anim = o.anim || {};
    g.userData.legendary = true;
    g.userData.auraColor = o.aura;
    if (o.baseY !== undefined) g.userData.baseY = o.baseY;
    // On enveloppe l'attaque pour lever le drapeau qui met l'idle en pause.
    // p = 0 est la POSE DE REPOS que battle3d.js demande en début de tour :
    // ce n'est pas une attaque, l'idle doit continuer.
    g.userData.attack = function (root, p) {
      root.userData._atk = (p > 0 && p < 1);
      o.attack(root, p);
    };
    relaisAnim(g, LL, o.idle);
    return g;
  }

  // ===========================================================================
  //  CRYONIX — dragon de glace, ailes cristallines            (glace · givre)
  //  #a8e6ff  #41a6f6  #f4f4f4
  //  Silhouette : dragon en vol plané, cou dressé, deux immenses ailes de
  //  cristal, crête dorsale en éclats. Il ne touche jamais le sol.
  //  Attributs distinctifs : AILES MAJESTUEUSES + CRISTAUX (crête et cornes).
  //  Draw calls : 24  (corps 1, cou 1, tête 1, museau 1, cornes 2, yeux 2,
  //                    crête 2, ailes 8, queue 2, souffle 1, aura 3)
  //  Le souffle est invisible au repos : il ne coûte rien tant qu'il ne sert pas.
  // ===========================================================================
  R3.registerCreature('cryonix', function () {
    const LL = LIB();
    const GLACE = '#a8e6ff', BLEU = '#41a6f6', BLANC = '#f4f4f4';
    const g = shell(), inner = g.userData.inner;

    // --- Corps fuselé, penché en avant : une posture de vol, pas de repos ----
    inner.add(R3.ellipsoid(0.44, 0.44, 0.92, BLEU, 0, 1.12, -0.12, { flat: true, rough: 0.42 }));

    // --- Cou dressé (c'est lui qui plonge à l'attaque) -----------------------
    const cou = new THREE.Group();
    cou.position.set(0, 1.34, 0.50);
    cou.rotation.x = -0.50;
    inner.add(cou);
    cou.add(R3.ellipsoid(0.21, 0.23, 0.50, BLEU, 0, 0.24, 0.18, { flat: true, rough: 0.42 }));

    const tete = new THREE.Group();
    tete.position.set(0, 0.54, 0.36);
    cou.add(tete);
    tete.add(R3.ellipsoid(0.25, 0.23, 0.32, GLACE, 0, 0, 0, { flat: true, rough: 0.35 }));
    tete.add(R3.ellipsoid(0.15, 0.13, 0.26, BLANC, 0, -0.08, 0.30, { flat: true, rough: 0.35 }));

    // Deux longues cornes rejetées en arrière : le crâne se lit en un instant.
    [-1, 1].forEach(function (s) {
      const c = R3.cone(0.055, 0.46, GLACE, s * 0.14, 0.18, -0.10,
        { flat: true, seg: 5, emissive: GLACE, emissiveIntensity: 0.35 });
      c.rotation.x = -0.95;
      c.rotation.z = -s * 0.28;
      tete.add(sansOmbre(c));
    });
    tete.add(regard(0.150, 0.03, 0.25, 0.058, { color: '#eafcff', dark: '#0e2230', flat: true }));

    // --- Crête dorsale : deux grands éclats plutôt que six petits ------------
    const crete = LL.crystalCluster(GLACE, 2, 0.34, {
      tipColor: BLANC, spread: 0.9, base: false, glow: false, opacity: 1, y: 1.46, z: -0.14,
    });
    inner.add(crete);

    // --- Ailes cristallines : trois éclats géants, envergure 2,7 unités ------
    const aileD = LL.majesticWing(1.35, GLACE, {
      style: 'crystal', color2: BLEU, segments: 3, spread: 1.25, sweep: 0.20,
      arm: false, side: 1, x: 0.34, y: 1.28, z: -0.10,
    });
    const aileG = LL.majesticWing(1.35, GLACE, {
      style: 'crystal', color2: BLEU, segments: 3, spread: 1.25, sweep: 0.20,
      arm: false, side: -1, x: -0.34, y: 1.28, z: -0.10,
    });
    inner.add(aileD, aileG);

    // --- Queue effilée : deux maillons emboîtés (le second suit le premier) --
    const queue = new THREE.Group();
    queue.position.set(0, 1.06, -0.80);
    queue.add(R3.ellipsoid(0.20, 0.19, 0.38, BLEU, 0, 0, -0.28, { flat: true, rough: 0.45 }));
    const bout = new THREE.Group();
    bout.position.set(0, 0, -0.58);
    bout.add(sansOmbre(R3.cone(0.13, 0.62, GLACE, 0, 0, -0.30,
      { flat: true, seg: 5, emissive: GLACE, emissiveIntensity: 0.4 })).rotateX(-Math.PI / 2));
    queue.add(bout);
    inner.add(queue);

    // --- Souffle glacial : invisible hors combat -----------------------------
    const souffle = sansOmbre(R3.ellipsoid(0.17, 0.17, 0.60, GLACE, 0, -0.06, 0.80,
      { transparent: true, opacity: 0.7, emissive: GLACE, emissiveIntensity: 1.1, depthWrite: false }));
    souffle.visible = false;
    tete.add(souffle);

    // --- Aura obligatoire : disque au sol, lisible en vue plongeante ---------
    const auraColor = BLEU;
    inner.add(LL.aura(auraColor, 1.30, {
      color2: GLACE, shape: 'disc', rings: 1, particles: 0, intensity: 1.15,
    }));

    return finir(g, LL, {
      aura: auraColor, baseY: 0.22,
      anim: { head: cou, tail: queue, float: true },
      idle: function (t) {
        // Vol plané : les ailes montent et descendent une fois toutes les 6 s.
        const k = Math.sin(t * 1.05) * 0.14;
        aileD.rotation.z = -k; aileG.rotation.z = k;
        aileD.rotation.x = k * 0.4; aileG.rotation.x = k * 0.4;
      },
      attack: function (root, p) {
        // « Souffle glacial » : le cou plonge, les ailes claquent, le froid jaillit.
        const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
        inn.position.z = k * 0.30;
        cou.rotation.x = -0.50 - k * 0.45;
        aileD.rotation.z = -k * 0.65;
        aileG.rotation.z = k * 0.65;
        crete.scale.setScalar(1 + k * 0.35);
        souffle.visible = pc > 0.22 && pc < 0.95;
        souffle.scale.set(1 + pc * 0.6, 1 + pc * 0.6, 0.3 + pc * 2.4);
        if (p >= 1) {
          cou.rotation.x = -0.50; aileD.rotation.z = 0; aileG.rotation.z = 0;
          crete.scale.setScalar(1); souffle.visible = false; inn.position.z = 0;
        }
      },
    });
  });

  // ===========================================================================
  //  GIVRÉA — biche de givre, bois de cristal                 (glace · givre)
  //  #e8f4f8  #a8e6ff  #d896ff
  //  Silhouette : biche élancée sur de longues pattes, ramure de cristal deux
  //  fois plus haute que sa tête, halo lunaire derrière la nuque, traîne de
  //  givre. Un esprit des neiges, pas un cerf.
  //  Attributs distinctifs : CRISTAUX (la ramure) + COURONNE (le halo) + TRAÎNE.
  //  Draw calls : 24  (pattes 4, corps 1, cou 1, tête 1, museau 1, yeux 2,
  //                    ramure 6, halo 1, traîne 3, aura 3, poussière 1)
  // ===========================================================================
  R3.registerCreature('givrea', function () {
    const LL = LIB();
    const BLANC = '#e8f4f8', GLACE = '#a8e6ff', MAUVE = '#d896ff';
    const g = shell(), inner = g.userData.inner;

    // --- Quatre pattes fines et hautes : toute la grâce est là ---------------
    const legs = [];
    [[-0.21, 0.36], [0.21, 0.36], [-0.20, -0.32], [0.20, -0.32]].forEach(function (p) {
      const l = patte(p[0], p[1], 0.94, 0.05, 0.075, BLANC, { rough: 0.6 });
      inner.add(l); legs.push(l);
    });

    inner.add(R3.ellipsoid(0.31, 0.33, 0.66, BLANC, 0, 1.44, -0.04, { flat: true, rough: 0.55 }));

    const cou = new THREE.Group();
    cou.position.set(0, 1.66, 0.44);
    cou.rotation.x = -0.38;
    inner.add(cou);
    cou.add(R3.ellipsoid(0.14, 0.16, 0.40, BLANC, 0, 0.26, 0.18, { flat: true, rough: 0.55 }));

    const tete = new THREE.Group();
    tete.position.set(0, 0.52, 0.34);
    cou.add(tete);
    tete.add(R3.ellipsoid(0.145, 0.135, 0.21, BLANC, 0, 0, 0, { flat: true, rough: 0.5 }));
    tete.add(R3.ellipsoid(0.075, 0.07, 0.14, GLACE, 0, -0.055, 0.19, { flat: true, rough: 0.5 }));
    tete.add(regard(0.092, 0.015, 0.155, 0.036, { color: MAUVE, dark: '#20143a', flat: true }));

    // --- La ramure : trois prismes par côté, très écartés, pointes mauves ----
    const boisD = LL.crystalCluster(GLACE, 3, 0.36, {
      tipColor: MAUVE, spread: 1.7, base: false, glow: false, opacity: 1, x: 0.10, y: 0.15, z: -0.03,
    });
    const boisG = LL.crystalCluster(GLACE, 3, 0.36, {
      tipColor: MAUVE, spread: 1.7, base: false, glow: false, opacity: 1, x: -0.10, y: 0.15, z: -0.03,
    });
    boisD.rotation.z = -0.42; boisG.rotation.z = 0.42;
    tete.add(boisD, boisG);

    // --- Halo lunaire derrière la nuque : UN mesh, et la biche devient sacrée -
    inner.add(LL.halo(MAUVE, 0.44, 0, { tube: 0.030, y: 2.05, z: 0.10 }));

    // --- Traîne de givre : trois nageoires emboîtées qui ondulent ------------
    const traine = LL.plumeTail(0.90, BLANC, 3, {
      style: 'fin', width: 0.30, color2: GLACE, y: 1.44, z: -0.62, droop: -0.06, amp: 0.16, speed: 1.1,
    });
    inner.add(traine);

    const auraColor = GLACE;
    inner.add(LL.aura(auraColor, 1.20, {
      color2: MAUVE, shape: 'disc', rings: 1, particles: 0, intensity: 1.1,
    }));
    // Poussière de neige : 1 seul draw call (THREE.Points) pour 20 flocons.
    inner.add(LL.starfield(BLANC, 20, 1.15, { color2: MAUVE, size: 0.05, spread: 'shell', ry: 0.8, seed: 21, y: 1.05 }));

    return finir(g, LL, {
      aura: auraColor,
      anim: { head: cou, tail: traine, float: false },
      attack: function (root, p) {
        // « Charge de givre » : elle se cabre, la ramure flamboie, elle fonce.
        const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
        inn.position.z = k * 0.60;
        cou.rotation.x = -0.38 - k * 0.35;
        boisD.scale.setScalar(1 + k * 0.40); boisG.scale.setScalar(1 + k * 0.40);
        legs.forEach(function (l, i) { l.rotation.x = Math.sin(pc * Math.PI * 5 + i) * 0.30 * k; });
        if (p >= 1) {
          inn.position.z = 0; cou.rotation.x = -0.38;
          boisD.scale.setScalar(1); boisG.scale.setScalar(1);
          legs.forEach(function (l) { l.rotation.x = 0; });
        }
      },
    });
  });

  // ===========================================================================
  //  BANQUISOR — ours des glaciers, dos en banquise           (glace · givre)
  //  #f4f4f4  #bfe3f2  #566c86
  //  Silhouette : colosse DRESSÉ sur ses pattes arrière, poings énormes, quatre
  //  icebergs plantés dans le dos, cœur de glace battant dans le poitrail.
  //  Debout, il fait 2,3 unités : on ne peut pas le confondre avec un ours.
  //  Attributs distinctifs : CRISTAUX (la banquise) + CŒUR LUMINEUX.
  //  Draw calls : 24  (jambes 2, corps 1, bras 2, poings 2, tête 1, museau 1,
  //                    yeux 2, banquise 4, cœur 3, collier 1, aura 4, neige 1)
  // ===========================================================================
  R3.registerCreature('banquisor', function () {
    const LL = LIB();
    const BLANC = '#f4f4f4', GLACE = '#bfe3f2', ARDOISE = '#566c86';
    const g = shell(), inner = g.userData.inner;

    // --- Deux jambes courtes et massives ------------------------------------
    const legs = [];
    [-0.30, 0.30].forEach(function (x) {
      const l = patte(x, -0.02, 0.66, 0.22, 0.27, BLANC, { rough: 0.88 });
      inner.add(l); legs.push(l);
    });

    // --- Torse en tonneau ----------------------------------------------------
    const torse = R3.ellipsoid(0.58, 0.66, 0.50, BLANC, 0, 1.20, 0, { rough: 0.85 });
    inner.add(torse);

    // --- Bras et poings (pivot à l'épaule : ils s'abattent à l'attaque) ------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const epaule = new THREE.Group();
      epaule.position.set(s * 0.56, 1.58, 0.02);
      inner.add(epaule);
      epaule.add(R3.ellipsoid(0.17, 0.34, 0.19, BLANC, 0, -0.30, 0, { rough: 0.86 }));
      epaule.add(R3.ellipsoid(0.21, 0.19, 0.20, GLACE, 0, -0.62, 0.05, { flat: true, rough: 0.8 }));
      bras.push(epaule);
    });

    // --- Tête ----------------------------------------------------------------
    const tete = new THREE.Group();
    tete.position.set(0, 1.94, 0.10);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.30, 0.27, 0.30, BLANC, 0, 0, 0, { rough: 0.85 }));
    tete.add(R3.ellipsoid(0.16, 0.13, 0.19, GLACE, 0, -0.09, 0.26, { rough: 0.85 }));
    tete.add(regard(0.135, 0.03, 0.24, 0.048, { color: '#9be8ff', dark: '#12222e', tilt: 0.34 }));

    // --- La banquise : quatre icebergs plantés dans le dos -------------------
    const banquise = LL.crystalCluster(GLACE, 4, 0.55, {
      tipColor: BLANC, spread: 1.5, base: false, glow: false, opacity: 1, y: 1.55, z: -0.34,
    });
    banquise.rotation.x = -0.30;
    inner.add(banquise);

    // --- Cœur de glace : il bat au milieu du poitrail ------------------------
    inner.add(LL.glowCore(GLACE, 0.24, { color2: '#eafcff', x: 0, y: 1.26, z: 0.44 }));

    // --- Collier de glace : sépare la tête du torse, gros gain de lisibilité --
    // (le tore de THREE est dans le plan XY : on le couche pour l'enfiler.)
    const collier = sansOmbre(R3.torus(0.34, 0.075, ARDOISE, 0, 1.74, 0.02,
      { flat: true, rough: 0.7, seg: 10 }));
    collier.rotation.x = -Math.PI / 2;
    inner.add(collier);

    const auraColor = GLACE;
    inner.add(LL.aura(auraColor, 1.40, {
      color2: ARDOISE, shape: 'sphere', rings: 1, particles: 0, intensity: 1.1, y0: 1.0,
    }));
    inner.add(LL.starfield(BLANC, 18, 1.30, { color2: GLACE, size: 0.055, spread: 'shell', seed: 22, y: 1.1 }));

    return finir(g, LL, {
      aura: auraColor,
      anim: { head: tete, float: false },
      idle: function (t) {
        // Les bras respirent avec le torse — deux fois plus lentement que la
        // respiration, sinon le colosse a l'air nerveux.
        bras[0].rotation.x = Math.sin(t * 0.85) * 0.09;
        bras[1].rotation.x = Math.sin(t * 0.85 + 0.7) * 0.09;
      },
      attack: function (root, p) {
        // « Poing de banquise » : il lève les deux bras, se cabre, et frappe.
        const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
        const leve = Math.sin(Math.min(1, pc * 2) * Math.PI * 0.5);   // monte vite, retombe fort
        const chute = pc > 0.5 ? (pc - 0.5) * 2 : 0;
        bras[0].rotation.x = -leve * 1.5 + chute * 2.1;
        bras[1].rotation.x = -leve * 1.5 + chute * 2.1;
        inn.rotation.x = -leve * 0.22 + chute * 0.30;
        torse.scale.set(1 + k * 0.10, 1 - k * 0.08, 1 + k * 0.10);
        banquise.rotation.z = Math.sin(pc * Math.PI * 9) * 0.07 * k;
        if (p >= 1) {
          bras[0].rotation.x = 0; bras[1].rotation.x = 0;
          inn.rotation.x = 0; torse.scale.setScalar(1); banquise.rotation.z = 0;
        }
      },
    });
  });

  // ===========================================================================
  //  BOURRASCA — griffon des cimes, plumes en spirale           (air · val)
  //  #bfe3f2  #f4f4f4  #94b0c2
  //  Silhouette : griffon aux ailes déployées sur près de 3 unités — trois
  //  rémiges immenses par aile, corne frontale en spirale, traîne de plumes.
  //  Attributs distinctifs : AILES MAJESTUEUSES + TRAÎNE.
  //  Draw calls : 24  (pattes 4, corps 1, tête 1, bec 1, yeux 2, corne 1,
  //                    ailes 8, traîne 3, aura 3)
  // ===========================================================================
  R3.registerCreature('bourrasca', function () {
    const LL = LIB();
    const GLACE = '#bfe3f2', BLANC = '#f4f4f4', ARDOISE = '#94b0c2';
    const g = shell(), inner = g.userData.inner;

    // --- Pattes : serres devant, pattes de lion derrière ---------------------
    const legs = [];
    [[-0.29, 0.42, BLANC], [0.29, 0.42, BLANC], [-0.31, -0.44, ARDOISE], [0.31, -0.44, ARDOISE]]
      .forEach(function (p) {
        const l = patte(p[0], p[1], 0.66, 0.10, 0.15, p[2], { rough: 0.75, flat: true });
        inner.add(l); legs.push(l);
      });

    // --- Corps de lion, poitrail haut : il est fier --------------------------
    const corps = R3.ellipsoid(0.44, 0.44, 0.72, ARDOISE, 0, 1.12, -0.10, { rough: 0.72 });
    inner.add(corps);

    const tete = new THREE.Group();
    tete.position.set(0, 1.62, 0.46);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.26, 0.25, 0.28, BLANC, 0, 0, 0, { flat: true, rough: 0.55 }));
    const bec = R3.cone(0.115, 0.30, '#e3c68d', 0, -0.05, 0.30, { flat: true, seg: 7 });
    bec.rotation.x = Math.PI / 2;
    tete.add(bec);
    tete.add(regard(0.145, 0.04, 0.21, 0.050, { color: '#ffe066', dark: '#2a1c10', tilt: 0.36 }));

    // --- La corne en spirale au sommet du crâne : sa marque de fabrique ------
    const corne = R3.cone(0.075, 0.52, GLACE, 0, 0.30, -0.06,
      { flat: true, seg: 5, emissive: GLACE, emissiveIntensity: 0.3 });
    corne.rotation.x = -0.55;
    tete.add(sansOmbre(corne));

    // --- Ailes : trois rémiges géantes par aile, envergure ~2,9 unités -------
    const aileD = LL.majesticWing(1.45, BLANC, {
      style: 'feather', color2: GLACE, segments: 3, spread: 1.15, height: 1.15,
      sweep: 0.18, arm: false, side: 1, x: 0.38, y: 1.34, z: -0.10,
    });
    const aileG = LL.majesticWing(1.45, BLANC, {
      style: 'feather', color2: GLACE, segments: 3, spread: 1.15, height: 1.15,
      sweep: 0.18, arm: false, side: -1, x: -0.38, y: 1.34, z: -0.10,
    });
    inner.add(aileD, aileG);

    // --- Traîne de plumes ----------------------------------------------------
    const queue = LL.plumeTail(0.85, ARDOISE, 3, {
      style: 'feather', width: 0.26, color2: GLACE, y: 1.06, z: -0.72, droop: 0.14, amp: 0.24, speed: 1.5,
    });
    inner.add(queue);

    const auraColor = GLACE;
    inner.add(LL.aura(auraColor, 1.30, {
      color2: BLANC, shape: 'disc', rings: 1, particles: 0, intensity: 1.15,
    }));

    return finir(g, LL, {
      aura: auraColor,
      anim: { head: tete, tail: queue, float: false },
      idle: function (t) {
        // Ailes déployées qui respirent : ample et lent, jamais un battement pressé.
        const k = Math.sin(t * 1.30) * 0.19;
        aileD.rotation.z = -k - 0.10; aileG.rotation.z = k + 0.10;
      },
      attack: function (root, p) {
        // « Vrille ascendante » : il s'élève, les ailes claquent, il fond en piqué.
        const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
        inn.position.y = k * 0.55;
        inn.position.z = k * 0.40;
        inn.rotation.x = -k * 0.35;
        inn.rotation.z = Math.sin(pc * Math.PI * 2) * 0.35 * k;
        aileD.rotation.z = -Math.sin(pc * Math.PI * 6) * 0.6 - 0.25;
        aileG.rotation.z = Math.sin(pc * Math.PI * 6) * 0.6 + 0.25;
        if (p >= 1) {
          inn.position.set(0, 0, 0); inn.rotation.set(0, 0, 0);
          aileD.rotation.z = 0; aileG.rotation.z = 0;
        }
      },
    });
  });

  // ===========================================================================
  //  ZÉPHYRION — serpent de vent, corps en ruban              (air · saphir)
  //  #cfe8f3  #a7f070  #f4f4f4
  //  Silhouette : long serpent céleste qui ondule dans les airs, moustaches de
  //  dragon, ruban de vent qui l'accompagne, trois sphères de vent en orbite.
  //  Attributs distinctifs : ANNEAUX EN ORBITE + TRAÎNE (le ruban).
  //  Draw calls : 24  (tête 1, museau 1, yeux 2, moustaches 2, corps 7,
  //                    ruban 4, orbite 3, aura 4)
  // ===========================================================================
  R3.registerCreature('zephyrion', function () {
    const LL = LIB();
    const CIEL = '#cfe8f3', VERT = '#a7f070', BLANC = '#f4f4f4';
    const g = shell(), inner = g.userData.inner;

    // --- Tête dressée : le corps s'enfonce derrière elle --------------------
    const tete = new THREE.Group();
    tete.position.set(0, 1.72, 0.95);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.23, 0.20, 0.38, CIEL, 0, 0, 0, { flat: true, rough: 0.4 }));
    tete.add(R3.ellipsoid(0.14, 0.11, 0.20, BLANC, 0, -0.06, 0.30, { flat: true, rough: 0.4 }));
    tete.add(regard(0.125, 0.03, 0.26, 0.044, { color: VERT, dark: '#12301c', flat: true }));
    // Moustaches de dragon d'Orient : deux traits verts, énormes gain de lecture.
    [-1, 1].forEach(function (s) {
      const m = R3.cyl(0.012, 0.028, 0.55, VERT, s * 0.14, -0.02, 0.28,
        { emissive: VERT, emissiveIntensity: 0.6, seg: 5 });
      m.rotation.x = Math.PI / 2.2;
      m.rotation.z = -s * 0.45;
      tete.add(sansOmbre(m));
    });

    // --- Corps serpentin : sept anneaux emboîtés, l'onde se propage ----------
    const corps = LL.serpentBody(2.60, CIEL, {
      segments: 7, r: 0.24, taper: 0.72, color2: BLANC, amp: 0.34, speed: 1.2, rise: 0.4,
      x: 0, y: 1.66, z: 0.72,
    });
    inner.add(corps);

    // --- Ruban de vent qui court le long du dos ------------------------------
    const ruban = LL.flowRibbon(1.90, VERT, {
      segments: 4, width: 0.30, thick: 0.045, color2: CIEL, opacity: 0.7,
      amp: 0.32, waves: 1.5, speed: 1.4, taper: 0.5, x: 0, y: 1.95, z: 0.55,
    });
    inner.add(ruban);

    // --- Trois sphères de vent en orbite ------------------------------------
    inner.add(LL.orbitRing(BLANC, 0.85, 3, {
      shape: 'sphere', color2: VERT, size: 0.22, y: 1.60, tilt: 0.55, speed: 0.7, glow: true,
    }));

    const auraColor = CIEL;
    inner.add(LL.aura(auraColor, 1.25, {
      color2: VERT, shape: 'sphere', rings: 1, particles: 0, intensity: 1.2, y0: 1.45,
    }));

    return finir(g, LL, {
      aura: auraColor, baseY: 0.22,
      anim: { head: tete, tail: corps, float: true },
      attack: function (root, p) {
        // « Tourbillon » : il se love, puis fouette l'air vers l'avant.
        const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
        inn.position.z = k * 0.60;
        inn.rotation.y = pc * Math.PI * 2 * (1 - pc) * 2.2;
        tete.rotation.y = Math.sin(pc * Math.PI * 4) * 0.45;
        tete.rotation.x = -k * 0.30;
        if (p >= 1) { inn.position.z = 0; inn.rotation.y = 0; tete.rotation.set(0, 0, 0); }
      },
    });
  });

  // ===========================================================================
  //  AÉLUNE — raie céleste, voile translucide                  (air · givre)
  //  #e6f1f7  #d896ff  #a8e6ff
  //  Silhouette : raie qui plane, deux voiles translucides de 1,6 unité, une
  //  couronne d'anneau posée à plat au-dessus d'elle, deux longues traînes.
  //  Attributs distinctifs : AILES / VOILES + COURONNE + TRAÎNE.
  //  Draw calls : 24  (corps 1, tête 1, yeux 2, voiles 10, couronne 3,
  //                    traîne 3, aura 3, étoiles 1)
  // ===========================================================================
  R3.registerCreature('aelune', function () {
    const LL = LIB();
    const CIEL = '#e6f1f7', MAUVE = '#d896ff', GLACE = '#a8e6ff';
    const g = shell(), inner = g.userData.inner;

    // --- Corps aplati, comme un galet de lumière ----------------------------
    const corps = R3.ellipsoid(0.36, 0.15, 0.70, CIEL, 0, 1.40, 0,
      { flat: true, rough: 0.35, transparent: true, opacity: 0.94 });
    inner.add(corps);

    const tete = new THREE.Group();
    tete.position.set(0, 1.45, 0.62);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.22, 0.11, 0.20, GLACE, 0, 0, 0, { flat: true, rough: 0.35 }));
    tete.add(regard(0.140, 0.035, 0.14, 0.044, { color: MAUVE, dark: '#231640', tilt: 0.05 }));

    // --- Les deux grands voiles : c'est toute sa silhouette -----------------
    const voileD = LL.majesticWing(1.60, CIEL, {
      style: 'membrane', color2: MAUVE, opacity: 0.72, segments: 2, height: 1.05,
      arm: false, side: 1, x: 0.12, y: 1.38, z: 0.04,
    });
    const voileG = LL.majesticWing(1.60, CIEL, {
      style: 'membrane', color2: MAUVE, opacity: 0.72, segments: 2, height: 1.05,
      arm: false, side: -1, x: -0.12, y: 1.38, z: 0.04,
    });
    inner.add(voileD, voileG);

    // --- Couronne posée à plat au-dessus : un anneau et deux rayons ---------
    inner.add(LL.halo(MAUVE, 0.42, 2, {
      plane: 'flat', color2: GLACE, tube: 0.032, rayLen: 0.22, speed: 0.28, y: 1.92,
    }));

    // --- Traîne : un ruban qui ondule derrière elle -------------------------
    const traine = LL.flowRibbon(1.50, GLACE, {
      segments: 3, width: 0.16, thick: 0.035, color2: MAUVE, opacity: 0.7,
      amp: 0.30, waves: 1.4, speed: 1.9, taper: 0.7, x: 0, y: 1.38, z: -0.60,
    });
    inner.add(traine);

    const auraColor = MAUVE;
    inner.add(LL.aura(auraColor, 1.25, {
      color2: GLACE, shape: 'disc', rings: 1, particles: 0, intensity: 1.2,
    }));
    inner.add(LL.starfield(GLACE, 22, 1.20, { color2: MAUVE, size: 0.05, spread: 'disc', seed: 24, y: 1.45 }));

    return finir(g, LL, {
      aura: auraColor, baseY: 0.52,
      anim: { head: tete, tail: traine, float: true },
      idle: function (t) {
        // Les deux voiles ondulent en opposition : c'est la nage d'une raie.
        const k = Math.sin(t * 0.95) * 0.17;
        voileD.rotation.z = k; voileG.rotation.z = -k;
        voileD.rotation.x = Math.sin(t * 0.95 - 0.6) * 0.10;
        voileG.rotation.x = voileD.rotation.x;
      },
      attack: function (root, p) {
        // « Voile stellaire » : elle ondule, puis plonge en avant dans la lumière.
        const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
        inn.position.z = k * 0.70;
        inn.position.y = Math.sin(pc * Math.PI * 2) * 0.25;
        inn.rotation.x = -k * 0.30;
        voileD.rotation.z = Math.sin(pc * Math.PI * 5) * 0.55 - 0.15;
        voileG.rotation.z = -Math.sin(pc * Math.PI * 5) * 0.55 + 0.15;
        if (p >= 1) {
          inn.position.set(0, 0, 0); inn.rotation.x = 0;
          voileD.rotation.z = 0; voileG.rotation.z = 0;
        }
      },
    });
  });

  // ===========================================================================
  //  GÉOMASTRE — tortue-montagne, carapace-plateau            (terre · sylve)
  //  #7a5c3a  #3d6b2f  #8a9199
  //  Silhouette : une montagne qui marche. Carapace-plateau à dalles surmontée
  //  d'un pic, trois rochers en orbite, une pierre runique posée dessus.
  //  Attributs distinctifs : RUNES + ANNEAUX EN ORBITE.
  //  Draw calls : 24  (pattes 4, plastron 1, cou 1, tête 1, bec 1, yeux 2,
  //                    carapace 5, pic 1, orbite 3, rune 3, aura 2)
  // ===========================================================================
  R3.registerCreature('geomastre', function () {
    const LL = LIB();
    const BRUN = '#7a5c3a', MOUSSE = '#3d6b2f', GRIS = '#8a9199';
    const g = shell(), inner = g.userData.inner;

    // --- Quatre pattes-piliers ----------------------------------------------
    const legs = [];
    [[-0.58, 0.46], [0.58, 0.46], [-0.55, -0.42], [0.55, -0.42]].forEach(function (p) {
      const l = patte(p[0], p[1], 0.58, 0.19, 0.25, BRUN, { rough: 0.88, flat: true });
      inner.add(l); legs.push(l);
    });

    inner.add(R3.ellipsoid(0.72, 0.24, 0.78, GRIS, 0, 0.62, 0, { rough: 0.9, flat: true }));

    const cou = new THREE.Group();
    cou.position.set(0, 0.72, 0.72);
    inner.add(cou);
    cou.add(R3.ellipsoid(0.18, 0.17, 0.34, BRUN, 0, 0.06, 0.20, { rough: 0.85, flat: true }));

    const tete = new THREE.Group();
    tete.position.set(0, 0.16, 0.50);
    cou.add(tete);
    tete.add(R3.ellipsoid(0.22, 0.20, 0.25, BRUN, 0, 0, 0, { rough: 0.85, flat: true }));
    tete.add(R3.cone(0.12, 0.22, GRIS, 0, -0.05, 0.24, { flat: true, seg: 6 }).rotateX(Math.PI / 2));
    tete.add(regard(0.125, 0.03, 0.21, 0.042, { color: MOUSSE, dark: '#101c0e', tilt: 0.30 }));

    // --- La carapace-plateau : dôme + bourrelet + trois grandes dalles -------
    const carapace = LL.plateShell(1.05, BRUN, {
      h: 1.10, plates: 3, plateColor: GRIS, rim: true, spikes: false, y: 0.66, z: -0.06,
    });
    inner.add(carapace);

    // --- Le pic : sans lui, ce n'est qu'une tortue ; avec lui, une montagne --
    inner.add(R3.cone(0.34, 0.80, GRIS, 0, 2.00, -0.06, { flat: true, seg: 6, rough: 0.9 }));

    // --- Trois rochers en orbite lente autour de la montagne ----------------
    // Sans ombre : une pierre qui flotte projette au sol une tache que le
    // joueur prend pour un objet à ramasser. Et c'est 3 draw calls de moins
    // dans la passe d'ombres.
    inner.add(R3.noShadow(LL.orbitRing(GRIS, 1.25, 3, {
      shape: 'stone', size: 0.34, y: 1.15, tilt: 0.28, speed: 0.22, glow: false, wobble: 0.18,
    })));

    // --- Pierre runique plantée sur la carapace -----------------------------
    inner.add(LL.runeStone(GRIS, 0.30, {
      glowColor: '#a7f070', rune: 'bar', count: 1, x: 0, y: 1.62, z: 0.40,
    }));

    const auraColor = MOUSSE;
    inner.add(LL.aura(auraColor, 1.55, {
      color2: GRIS, shape: 'disc', rings: 0, particles: 0, intensity: 1.25,
    }));

    return finir(g, LL, {
      aura: auraColor,
      anim: { head: cou, float: false },
      attack: function (root, p) {
        // « Séisme » : elle se ramasse, puis frappe le sol de tout son poids.
        const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
        inn.position.y = pc < 0.4 ? k * 0.22 : -k * 0.14;
        carapace.rotation.z = Math.sin(pc * Math.PI * 11) * 0.05 * k;
        cou.rotation.x = -k * 0.28;
        legs.forEach(function (l) { l.scale.y = 1 - k * 0.16; });
        if (p >= 1) {
          inn.position.y = 0; carapace.rotation.z = 0; cou.rotation.x = 0;
          legs.forEach(function (l) { l.scale.y = 1; });
        }
      },
    });
  });

  // ===========================================================================
  //  TERRACOR — taupe-titan, griffes de roche                 (terre · braise)
  //  #c08c4a  #5c3a1e  #e3c68d
  //  Silhouette : titan bipède au torse énorme, quatre griffes de pierre longues
  //  comme son bras, une stèle runique flottant dans son dos, des blocs de
  //  terre arrachés qui tournent autour de lui.
  //  Attributs distinctifs : RUNES + ANNEAUX EN ORBITE.
  //  Draw calls : 24  (jambes 2, torse 1, bras 2, mains 2, griffes 4, tête 1,
  //                    groin 1, yeux 2, rune 3, orbite 3, aura 3)
  // ===========================================================================
  R3.registerCreature('terracor', function () {
    const LL = LIB();
    const BRUN = '#c08c4a', SOMBRE = '#5c3a1e', PALE = '#e3c68d';
    const g = shell(), inner = g.userData.inner;

    const legs = [];
    [-0.30, 0.30].forEach(function (x) {
      const l = patte(x, -0.08, 0.50, 0.20, 0.26, SOMBRE, { rough: 0.85, flat: true });
      inner.add(l); legs.push(l);
    });

    const torse = R3.ellipsoid(0.56, 0.66, 0.50, BRUN, 0, 1.14, -0.02, { rough: 0.8, flat: true });
    inner.add(torse);

    // --- Bras, mains et griffes de roche ------------------------------------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const epaule = new THREE.Group();
      epaule.position.set(s * 0.52, 1.42, 0.04);
      inner.add(epaule);
      epaule.add(R3.ellipsoid(0.19, 0.32, 0.21, SOMBRE, 0, -0.26, 0, { rough: 0.8, flat: true }));
      const main = new THREE.Group();
      main.position.set(0, -0.56, 0.06);
      epaule.add(main);
      main.add(R3.ellipsoid(0.20, 0.17, 0.17, BRUN, 0, 0, 0, { rough: 0.8, flat: true }));
      // DEUX griffes par main, mais deux fois plus longues : même lecture, moitié prix.
      [-1, 1].forEach(function (i) {
        const griffe = R3.cone(0.075, 0.52, '#8a9199', i * 0.09, -0.10, 0.24,
          { flat: true, seg: 5, rough: 0.7 });
        griffe.rotation.x = Math.PI / 2.1;
        main.add(sansOmbre(griffe));
      });
      bras.push(epaule);
    });

    // --- Tête enfoncée dans les épaules, groin de fouisseur -----------------
    const tete = new THREE.Group();
    tete.position.set(0, 1.72, 0.24);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.27, 0.25, 0.27, BRUN, 0, 0, 0, { rough: 0.8, flat: true }));
    tete.add(R3.cone(0.14, 0.26, SOMBRE, 0, -0.06, 0.28, { flat: true, seg: 7 }).rotateX(Math.PI / 2));
    tete.add(regard(0.115, 0.04, 0.23, 0.036, { color: PALE, dark: '#1a0f06', tilt: 0.40 }));

    // --- La stèle runique qui le suit : c'est ce qu'il a déterré ------------
    inner.add(LL.runeStone(SOMBRE, 0.34, {
      glowColor: PALE, rune: 'star', count: 1, x: 0, y: 1.60, z: -0.66,
    }));

    // --- Blocs de terre en orbite (sans ombre : voir Géomastre) -------------
    inner.add(R3.noShadow(LL.orbitRing(SOMBRE, 1.00, 3, {
      shape: 'stone', size: 0.28, y: 0.55, tilt: 1.25, speed: 0.45, glow: false,
    })));

    const auraColor = SOMBRE;
    inner.add(LL.aura(auraColor, 1.35, {
      color2: BRUN, shape: 'disc', rings: 1, particles: 0, intensity: 1.2,
    }));

    return finir(g, LL, {
      aura: auraColor,
      anim: { head: tete, float: false },
      idle: function (t) {
        // Les griffes pèsent : elles balancent à peine.
        bras[0].rotation.x = Math.sin(t * 0.72) * 0.07;
        bras[1].rotation.x = Math.sin(t * 0.72 + 1.1) * 0.07;
      },
      attack: function (root, p) {
        // « Griffe sismique » : les deux bras fauchent en croix, le torse pivote.
        const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
        inn.position.z = k * 0.34;
        bras[0].rotation.z = k * 1.30; bras[1].rotation.z = -k * 1.30;
        bras[0].rotation.x = -k * 0.45; bras[1].rotation.x = -k * 0.45;
        torse.rotation.y = Math.sin(pc * Math.PI * 3) * 0.22 * k;
        if (p >= 1) {
          inn.position.z = 0; torse.rotation.y = 0;
          bras[0].rotation.set(0, 0, 0); bras[1].rotation.set(0, 0, 0);
        }
      },
    });
  });

  // ===========================================================================
  //  LIMONIS — golem de glaise, coulures douces               (terre · sylve)
  //  #a97b50  #c8a06a  #6b4423
  //  Silhouette : golem sans jambes, coulé sur place, un cœur d'ambre battant
  //  au milieu du torse et deux tablettes runiques qui flottent à ses côtés.
  //  Attributs distinctifs : CŒUR LUMINEUX + RUNES.
  //  Draw calls : 24  (socle 1, torse 1, bras 2, mains 2, tête 1, yeux 2,
  //                    cœur 3, runes 6, coulures 3, aura 3)
  // ===========================================================================
  R3.registerCreature('limonis', function () {
    const LL = LIB();
    const ARGILE = '#a97b50', CLAIR = '#c8a06a', SOMBRE = '#6b4423';
    const g = shell(), inner = g.userData.inner;

    // --- Socle fondu : il n'a pas de jambes, il coule -----------------------
    inner.add(R3.ellipsoid(0.68, 0.26, 0.62, SOMBRE, 0, 0.24, 0, { rough: 0.95 }));

    const torse = R3.ellipsoid(0.52, 0.72, 0.46, ARGILE, 0, 1.02, 0, { rough: 0.9 });
    inner.add(torse);

    const bras = [];
    [-1, 1].forEach(function (s) {
      const epaule = new THREE.Group();
      epaule.position.set(s * 0.48, 1.36, 0);
      inner.add(epaule);
      epaule.add(R3.ellipsoid(0.17, 0.36, 0.19, ARGILE, 0, -0.30, 0, { rough: 0.9 }));
      epaule.add(R3.ellipsoid(0.16, 0.15, 0.15, CLAIR, 0, -0.62, 0.03, { rough: 0.92 }));
      bras.push(epaule);
    });

    const tete = new THREE.Group();
    tete.position.set(0, 1.78, 0.04);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.28, 0.26, 0.26, ARGILE, 0, 0, 0, { rough: 0.88 }));
    tete.add(regard(0.115, 0.02, 0.22, 0.048, { color: '#ffe066', dark: '#2a1a0a', intensity: 1.5 }));

    // --- Le cœur d'ambre : on le voit battre à travers la glaise ------------
    inner.add(LL.glowCore(CLAIR, 0.26, { color2: '#ffe066', x: 0, y: 1.10, z: 0.36 }));

    // --- Deux tablettes runiques en lévitation ------------------------------
    inner.add(LL.runeStone(SOMBRE, 0.26, {
      glowColor: '#ffe066', rune: 'star', count: 2, spread: 0.82, x: 0, y: 1.32, z: 0,
    }));

    // --- Coulures douces : la signature de Limonis --------------------------
    [[-0.34, 1.20, 0.24], [0.30, 1.02, 0.30], [0.0, 1.58, 0.24]].forEach(function (p) {
      inner.add(sansOmbre(R3.cone(0.065, 0.30, SOMBRE, p[0], p[1], p[2], { rough: 0.9, seg: 6 })));
    });

    const auraColor = ARGILE;
    inner.add(LL.aura(auraColor, 1.30, {
      color2: CLAIR, shape: 'disc', rings: 1, particles: 0, intensity: 1.1,
    }));

    return finir(g, LL, {
      aura: auraColor,
      anim: { head: tete, float: false },
      idle: function (t) {
        // La glaise coule sans arrêt : un balancement mou, jamais rythmé.
        bras[0].rotation.x = Math.sin(t * 0.63) * 0.11;
        bras[1].rotation.x = Math.sin(t * 0.63 + 1.9) * 0.11;
      },
      attack: function (root, p) {
        // « Coulée de glaise » : tout le corps s'étire en avant, puis reflue.
        const inn = root.userData.inner, k = arc(p);
        torse.scale.set(1 + k * 0.14, 1 - k * 0.26, 1 + k * 0.14);
        inn.position.z = k * 0.42;
        bras[0].rotation.x = -k * 0.85; bras[1].rotation.x = -k * 0.85;
        if (p >= 1) {
          torse.scale.setScalar(1); inn.position.z = 0;
          bras[0].rotation.x = 0; bras[1].rotation.x = 0;
        }
      },
    });
  });

  // ===========================================================================
  //  MONOLITHE — colosse de menhirs flottants                 (roche · aurore)
  //  #8a9199  #566c86  #ffe066
  //  Silhouette : aucun membre ne se touche. Cinq menhirs suspendus dans l'air
  //  forment un géant, une couronne d'or tourne au-dessus de sa tête, quatre
  //  éclats de pierre gravitent autour de lui, et un faisceau de lumière monte
  //  au ciel : on le repère par-dessus la forêt.
  //  Attributs distinctifs : RUNES + ANNEAUX EN ORBITE + COURONNE.
  //  Draw calls : 23  (torse 1, plastron 1, bras 2, tête 1, yeux 2, rune 3,
  //                    couronne 5, orbite 4, aura 4)
  // ===========================================================================
  R3.registerCreature('monolithe', function () {
    const LL = LIB();
    const GRIS = '#8a9199', ARDOISE = '#566c86', OR = '#ffe066';
    const g = shell(), inner = g.userData.inner;

    // --- Menhir central --------------------------------------------------------
    const torse = R3.box(0.62, 1.05, 0.48, GRIS, 0, 1.12, 0, { flat: true, rough: 0.9 });
    torse.rotation.y = 0.08;
    inner.add(torse);
    inner.add(R3.box(0.42, 0.70, 0.26, ARDOISE, 0, 1.12, 0.28, { flat: true, rough: 0.9 }));

    // --- Bras : deux menhirs qui flottent, sans épaule ni articulation ---------
    const bras = [];
    [-1, 1].forEach(function (s) {
      const bloc = new THREE.Group();
      bloc.position.set(s * 0.70, 1.20, 0.04);
      inner.add(bloc);
      bloc.add(R3.box(0.27, 0.72, 0.27, ARDOISE, 0, 0, 0, { flat: true, rough: 0.9 }));
      bras.push(bloc);
    });

    // --- Tête : un petit menhir suspendu, jamais posé --------------------------
    const tete = new THREE.Group();
    tete.position.set(0, 2.02, 0.02);
    inner.add(tete);
    tete.add(R3.box(0.36, 0.40, 0.30, GRIS, 0, 0, 0, { flat: true, rough: 0.85 }));
    tete.add(regard(0.105, -0.01, 0.17, 0.040, { color: OR, dark: '#101216', tilt: 0.42, flat: true }));

    // --- Pierre runique en guise de socle : elle porte tout le colosse ---------
    inner.add(LL.runeStone(ARDOISE, 0.34, {
      glowColor: OR, rune: 'ring', count: 1, x: 0, y: 0.42, z: 0,
    }));

    // --- Couronne d'or, à plat au-dessus de la tête ---------------------------
    inner.add(LL.halo(OR, 0.52, 4, {
      plane: 'flat', color2: '#fff4d6', tube: 0.038, rayLen: 0.26, speed: 0.30, y: 2.38,
    }));

    // --- Quatre éclats de pierre en orbite (sans ombre : voir Géomastre) ------
    inner.add(R3.noShadow(LL.orbitRing(GRIS, 1.05, 4, {
      shape: 'stone', color2: ARDOISE, size: 0.30, y: 1.15, tilt: 0.30, speed: 0.34, glow: false,
    })));

    // --- Aura en COLONNE : le faisceau qui le signale de loin -----------------
    const auraColor = OR;
    inner.add(LL.aura(auraColor, 0.95, {
      color2: ARDOISE, shape: 'column', height: 3.4, rings: 1, particles: 0, intensity: 1.15,
    }));

    return finir(g, LL, {
      aura: auraColor, baseY: 0.22,
      anim: { head: tete, float: true },
      idle: function (t) {
        // Rien ne se touche : chaque bloc flotte à sa propre cadence. C'est ce
        // décalage qui fait lire « colosse suspendu » et pas « statue ».
        bras[0].position.y = 1.20 + Math.sin(t * 0.55) * 0.09;
        bras[1].position.y = 1.20 + Math.sin(t * 0.55 + 2.2) * 0.09;
        tete.position.y = 2.02 + Math.sin(t * 0.42 + 1.0) * 0.07;
      },
      attack: function (root, p) {
        // « Chute de menhirs » : les blocs s'écartent, montent, puis convergent.
        const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
        const ouvre = Math.sin(Math.min(1, pc * 1.6) * Math.PI * 0.5);
        const ferme = pc > 0.62 ? (pc - 0.62) / 0.38 : 0;
        const e = ouvre * 0.45 - ferme * 0.60;
        bras[0].position.set(-0.70 - e, 1.20 + ouvre * 0.45 - ferme * 0.70, 0.04);
        bras[1].position.set(0.70 + e, 1.20 + ouvre * 0.45 - ferme * 0.70, 0.04);
        inn.position.z = k * 0.30;
        tete.position.y = 2.02 - k * 0.18;
        torse.rotation.y = 0.08 + Math.sin(pc * Math.PI * 2) * 0.25;
        if (p >= 1) {
          bras[0].position.set(-0.70, 1.20, 0.04); bras[1].position.set(0.70, 1.20, 0.04);
          inn.position.z = 0; tete.position.y = 2.02; torse.rotation.y = 0.08;
        }
      },
    });
  });

  // ===========================================================================
  //  CRISTALLIA — cerf de cristal, bois en prismes            (roche · givre)
  //  #d896ff  #a8e6ff  #f4f4f4
  //  Silhouette : cerf taillé dans le quartz, ramure de six prismes, quatre
  //  éclats qui gravitent autour de lui et un disque de lumière derrière la
  //  tête. Tout est facetté : il renvoie la lumière comme une gemme.
  //  Attributs distinctifs : CRISTAUX + ANNEAUX EN ORBITE + COURONNE.
  //  Draw calls : 24  (pattes 4, corps 1, cou 1, tête 1, museau 1, yeux 2,
  //                    ramure 6, orbite 4, couronne 1, aura 3)
  // ===========================================================================
  R3.registerCreature('cristallia', function () {
    const LL = LIB();
    const MAUVE = '#d896ff', GLACE = '#a8e6ff', BLANC = '#f4f4f4';
    const g = shell(), inner = g.userData.inner;

    const legs = [];
    [[-0.23, 0.38], [0.23, 0.38], [-0.21, -0.34], [0.21, -0.34]].forEach(function (p) {
      const l = patte(p[0], p[1], 0.94, 0.055, 0.085, GLACE, { flat: true, rough: 0.3 });
      inner.add(l); legs.push(l);
    });

    inner.add(R3.ellipsoid(0.33, 0.35, 0.70, BLANC, 0, 1.44, -0.04,
      { flat: true, rough: 0.25, transparent: true, opacity: 0.95, emissive: GLACE, emissiveIntensity: 0.2 }));

    const cou = new THREE.Group();
    cou.position.set(0, 1.68, 0.46);
    cou.rotation.x = -0.34;
    inner.add(cou);
    cou.add(R3.ellipsoid(0.15, 0.17, 0.40, BLANC, 0, 0.26, 0.18, { flat: true, rough: 0.3 }));

    const tete = new THREE.Group();
    tete.position.set(0, 0.52, 0.34);
    cou.add(tete);
    tete.add(R3.ellipsoid(0.15, 0.14, 0.21, BLANC, 0, 0, 0, { flat: true, rough: 0.3 }));
    tete.add(R3.ellipsoid(0.075, 0.065, 0.13, GLACE, 0, -0.055, 0.19, { flat: true, rough: 0.3 }));
    tete.add(regard(0.095, 0.015, 0.155, 0.036, { color: MAUVE, dark: '#2a1240', flat: true }));

    // --- Ramure en prismes : trois par côté, très ouverts -------------------
    const boisD = LL.crystalCluster(GLACE, 3, 0.40, {
      tipColor: MAUVE, spread: 1.8, base: false, glow: false, opacity: 1, x: 0.11, y: 0.16, z: -0.03,
    });
    const boisG = LL.crystalCluster(GLACE, 3, 0.40, {
      tipColor: MAUVE, spread: 1.8, base: false, glow: false, opacity: 1, x: -0.11, y: 0.16, z: -0.03,
    });
    boisD.rotation.z = -0.38; boisG.rotation.z = 0.38;
    tete.add(boisD, boisG);

    // --- Quatre éclats en orbite : les prismes détachés de sa lumière -------
    inner.add(LL.orbitRing(GLACE, 0.82, 4, {
      shape: 'shard', color2: MAUVE, size: 0.24, y: 1.30, tilt: 0.48, speed: 0.55, glow: true,
    }));

    // --- Disque de lumière derrière la tête : 1 mesh, effet vitrail ---------
    inner.add(LL.halo(MAUVE, 0.46, 0, { tube: 0.034, y: 2.12, z: 0.16 }));

    const auraColor = MAUVE;
    inner.add(LL.aura(auraColor, 1.25, {
      color2: GLACE, shape: 'sphere', rings: 0, particles: 0, intensity: 1.3, y0: 1.15,
    }));

    return finir(g, LL, {
      aura: auraColor,
      anim: { head: cou, float: false },
      attack: function (root, p) {
        // « Prisme aveuglant » : la ramure s'embrase, puis il charge.
        const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
        cou.rotation.x = -0.34 - k * 0.34;
        boisD.scale.setScalar(1 + k * 0.55); boisG.scale.setScalar(1 + k * 0.55);
        inn.position.z = k * 0.40;
        legs.forEach(function (l, i) { l.rotation.x = Math.sin(pc * Math.PI * 5 + i) * 0.26 * k; });
        if (p >= 1) {
          cou.rotation.x = -0.34; inn.position.z = 0;
          boisD.scale.setScalar(1); boisG.scale.setScalar(1);
          legs.forEach(function (l) { l.rotation.x = 0; });
        }
      },
    });
  });

  // ===========================================================================
  //  OBSIDION — panthère d'obsidienne, veines de lave         (roche · braise)
  //  #1a1c2c  #3d4e62  #ff6b3d
  //  Silhouette : panthère de verre volcanique, dos hérissé de trois lames
  //  d'obsidienne, cœur de lave dans le poitrail, queue de flamme. Noir presque
  //  pur, striée d'orange : le contraste la rend lisible de très loin.
  //  Attributs distinctifs : CRISTAUX (les lames) + CŒUR LUMINEUX + TRAÎNE.
  //  Draw calls : 24  (pattes 4, corps 1, tête 1, museau 1, yeux 2, oreilles 2,
  //                    veine 1, lames 3, cœur 3, queue 3, aura 3)
  // ===========================================================================
  R3.registerCreature('obsidion', function () {
    const LL = LIB();
    const NOIR = '#1a1c2c', ARDOISE = '#3d4e62', LAVE = '#ff6b3d';
    const g = shell(), inner = g.userData.inner;

    const legs = [];
    [[-0.25, 0.56], [0.25, 0.56], [-0.23, -0.52], [0.23, -0.52]].forEach(function (p) {
      const l = patte(p[0], p[1], 0.80, 0.085, 0.12, NOIR, { flat: true, rough: 0.3, metal: 0.2 });
      inner.add(l); legs.push(l);
    });

    const corps = R3.ellipsoid(0.36, 0.36, 0.88, NOIR, 0, 1.32, -0.04,
      { flat: true, rough: 0.28, metal: 0.2 });
    inner.add(corps);

    const tete = new THREE.Group();
    tete.position.set(0, 1.54, 0.88);
    inner.add(tete);
    tete.add(R3.ellipsoid(0.24, 0.21, 0.26, NOIR, 0, 0, 0, { flat: true, rough: 0.28 }));
    tete.add(R3.ellipsoid(0.12, 0.10, 0.15, ARDOISE, 0, -0.07, 0.22, { flat: true, rough: 0.3 }));
    tete.add(regard(0.125, 0.03, 0.21, 0.046, { color: LAVE, dark: '#050608', tilt: 0.42, flat: true }));
    // Oreilles pointues, taillées dans la roche.
    [-1, 1].forEach(function (s) {
      const o = R3.cone(0.075, 0.26, NOIR, s * 0.15, 0.20, -0.02, { flat: true, seg: 5 });
      o.rotation.z = -s * 0.25;
      tete.add(sansOmbre(o));
    });

    // --- Une veine de lave court le long de l'échine ------------------------
    inner.add(sansOmbre(R3.ellipsoid(0.035, 0.035, 0.72, LAVE, 0, 1.66, -0.10,
      { emissive: LAVE, emissiveIntensity: 1.4, rough: 0.3 })));

    // --- Trois lames d'obsidienne plantées dans le dos ----------------------
    const lames = LL.crystalCluster(NOIR, 3, 0.36, {
      tipColor: LAVE, spread: 0.75, base: false, glow: false, opacity: 1, y: 1.58, z: -0.20,
    });
    lames.rotation.x = -0.22;
    inner.add(lames);

    // --- Cœur de lave, au creux du poitrail ---------------------------------
    inner.add(LL.glowCore(LAVE, 0.20, { color2: '#ffd166', x: 0, y: 1.26, z: 0.62 }));

    // --- Queue de flamme ----------------------------------------------------
    const queue = LL.plumeTail(1.00, NOIR, 3, {
      style: 'flame', width: 0.20, color2: LAVE, y: 1.30, z: -0.86, droop: -0.10, amp: 0.26, speed: 1.9,
    });
    inner.add(queue);

    const auraColor = LAVE;
    inner.add(LL.aura(auraColor, 1.30, {
      color2: NOIR, shape: 'disc', rings: 1, particles: 0, intensity: 1.25,
    }));

    return finir(g, LL, {
      aura: auraColor,
      anim: { head: tete, tail: queue, float: false },
      attack: function (root, p) {
        // « Griffe de lave » : elle bondit, les lames s'embrasent, elle retombe.
        const inn = root.userData.inner, k = arc(p), pc = R3.clamp01(p);
        inn.position.z = k * 0.85;
        inn.position.y = Math.sin(pc * Math.PI) * 0.32;
        inn.rotation.x = -k * 0.34;
        lames.scale.setScalar(1 + k * 0.45);
        tete.rotation.x = k * 0.20;
        if (p >= 1) {
          inn.position.set(0, 0, 0); inn.rotation.x = 0;
          lames.scale.setScalar(1); tete.rotation.x = 0;
        }
      },
    });
  });

})();
