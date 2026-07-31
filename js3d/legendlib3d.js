// =============================================================================
//  legendlib3d.js — PRIMITIVES PARTAGÉES DES 36 LÉGENDAIRES   (CONTRACT2 §13)
// =============================================================================
//  S'enregistre sous R3.register('llib', {...}) et sert aux 3 lots
//  legend3d.p1..p3.js. Chaque lot l'utilise SI elle est présente :
//
//      const LL = R3.get('llib');
//      const halo = (LL && LL.aura) ? LL.aura('#ff6b3d', 1.3) : null;
//
//  POURQUOI CE FICHIER
//  -------------------
//  Les 26 créatures ordinaires sont mignonnes ; les 36 légendaires doivent
//  IMPRESSIONNER, et se reconnaître au premier coup d'œil — même de loin sur la
//  carte, même à moitié cachés derrière un arbre. Ce qui les distingue n'est pas
//  leur taille (on ne la voit pas de loin) mais la LUMIÈRE qu'ils portent :
//  aura qui pulse, anneaux en orbite, poussière d'étoiles. D'où cette
//  bibliothèque : si les 36 partagent les mêmes briques lumineuses, ils forment
//  une famille même modelés par trois mains différentes.
//
//  API DU CONTRAT (§13)                                        coût en meshes
//  --------------------------------------------------------------------------
//   aura(color, radius, opts)        halo translucide qui pulse       2 à 14
//   orbitRing(color, r, n, opts)     fragments en orbite              n (+1)  ≤ 13
//   crystalCluster(color, n, scale)  grappe de cristaux               n (+2)  ≤ 12
//   majesticWing(len, color, opts)   grande aile à segments           n+2     ≤ 11
//   plumeTail(len, color, n)         longue traîne de plumes/flammes  n       ≤ 12
//   halo(color, r, rays)             auréole à rayons                 rays+1  ≤ 15
//   runeStone(color, size)           pierre gravée flottante          3 (×count) ≤ 12
//   flowRibbon(len, color, opts)     ruban ondulant                   n       ≤ 14
//   starfield(color, n, r)           nuée de points lumineux          1 (THREE.Points)
//   glowCore(color, r)               cœur lumineux pulsant            3 (+1)
//   bigEyes(spread, y, z, r)         yeux nobles                      6 ou 8
//   animateAura(g, t)                anime TOUT ce qui précède, d'un seul appel
//
//  BONUS (en plus du contrat, jamais en remplacement — voir §4 pour les
//  silhouettes qui les réclament)
//  --------------------------------------------------------------------------
//   serpentBody(len, color, opts)    corps serpentin qui ondule       n     ≤ 14
//                                    (Abyssalor, Zéphyrion, Sablion, Maréa)
//   plateShell(r, color, opts)       carapace-plateau à dalles        n+2   ≤ 10
//                                    (Géomastre, Chronoss, Banquisor)
//   clockFace(r, color, opts)        cadran d'horloge à aiguilles     8
//                                    (Chronoss, Éternia)
//   mistPuff(color, r, n, opts)      volutes de brume / fumée         n     ≤ 10
//                                    (Nyxaroth, Pénombra, Orageon, Nébulon)
//   TYPE_COLOR                       les 12 couleurs de type du §2
//   refresh(g)                       à appeler si on ajoute des primitives à un
//                                    modèle DÉJÀ animé (voir animateAura)
//
//  AJOUTS DE LA VAGUE v3 (§9 : 25 DRAW CALLS PAR LÉGENDAIRE, MAXIMUM)
//  --------------------------------------------------------------------------
//  Le budget est passé de « 90 meshes » (v2) à « 25 draw calls » (v3). Or dans
//  three.js, un mesh = un draw call : on ne peut plus se contenter d'empiler des
//  ellipsoïdes. D'où la primitive centrale de cette vague :
//
//   bake(root, opts)                 FUSIONNE les meshes statiques de `root` :
//                                    un seul mesh par matériau, en place.
//                                    30 formes de 4 teintes -> 4 draw calls.
//   drawCalls(obj)                   compte les draw calls d'un modèle (pour
//                                    mesurer le budget, pas pour le deviner)
//   autoAnimate(g)                   accroche l'idle + animateAura au cycle de
//                                    rendu (sinon un légendaire se fige en combat)
//   nobleEyes(spread,y,z,r,opts)     bigEyes fusionné : 3 draw calls au lieu
//                                    de 8, et 2 avec `lean: true`
//   crown(color, r, points, opts)    couronne de pointes flottante      1 à 2
//   runeBand(color, r, n, opts)      ceinture de runes qui tourne       1 à 2
//   arcRings(color, r, n, opts)      anneaux inclinés en orbite         n (2)
//   crestFin(len, color, n, opts)    crête dorsale de lames             1
//   boltArc(len, color, opts)        éclair en zigzag                   1
//   petalSkirt(color, n, r, opts)    corolle / robe de pétales          1 à 2
//   antler(len, color, opts)         ramure de branches                 1 à 2
//   mane(color, r, n, opts)          crinière rayonnante                1 à 2
//
//  …et une option `bake: true` sur orbitRing, crystalCluster, halo et
//  majesticWing : le contenu est fusionné, le groupe continue de tourner ou de
//  battre. On perd le frémissement de CHAQUE fragment, on gagne 4 à 10 draw
//  calls. Aucune signature existante n'a changé — les lots P2 et P3 qui codent
//  contre le §13 de v2 en ce moment même ne voient aucune différence.
//
//  RÈGLE D'OR DE LA FUSION : dans un groupe destiné à `bake()`, une teinte =
//  UN SEUL jeu d'options. R3.mat() met en cache sur `couleur + JSON(options)`,
//  donc `{rough:0.8}` et `{rough:0.8, seg:12}` donnent DEUX matériaux, donc DEUX
//  draw calls après fusion. Ne jamais passer `seg` dans les options d'une pièce
//  qui sera fusionnée.
//
//  CONVENTIONS
//  -----------
//   * Chaque primitive renvoie un THREE.Group, jamais null, jamais d'exception.
//   * Le dernier argument est toujours un objet d'options facultatif : tout a
//     une valeur par défaut raisonnable.
//   * Ancrage indiqué dans le commentaire de chaque primitive. Les auras sont
//     ancrées à la BASE de la créature (y = 0) : LL.aura(c, 1.2) ajoutée telle
//     quelle à la racine du modèle tombe juste.
//   * La créature regarde +z, +y est le haut, 1 tuile = 1 unité.
//   * Tout est animé sur R3.clock.t (secondes réelles), jamais sur des frames.
//
//  DEUX PIÈGES QUI ONT DICTÉ LA CONCEPTION
//  ---------------------------------------
//  1) NE JAMAIS ANIMER UN MATÉRIAU. Les matériaux de R3.mat() sont PARTAGÉS :
//     faire pulser `material.opacity` ferait pulser les 36 légendaires (et les
//     26 créatures qui partagent la même teinte) exactement en même temps.
//     Toute la pulsation passe donc par des `scale` / `position` / `rotation`.
//     Astuce employée partout : deux coques concentriques qui respirent en
//     OPPOSITION de phase — l'œil lit un halo qui s'allume et s'éteint alors
//     qu'aucune couleur ne bouge.
//  2) L'ÉMISSIF PLUTÔT QUE L'ALBÉDO. Une aura peinte en couleur simple devient
//     grise dans le brouillard de la Caldeira et blafarde sur la neige. Les
//     matériaux lumineux d'ici ont `emissive` = leur propre couleur : ils
//     rendent la même chose sous tous les éclairages de biome.
//
//  COÛT : un légendaire complet ne dépasse pas 90 meshes et utilisera 4 à 6 de
//  ces primitives. Chacune reste sous 15 meshes, et toutes les parties
//  translucides sont sans ombre et sans écriture de profondeur (depthWrite:
//  false) — sinon elles découpent des trous dans la créature qu'elles entourent.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // ===========================================================================
  //  Utilitaires internes
  // ===========================================================================

  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function clampi(v, a, b) { v = Math.round(num(v, a)); return v < a ? a : (v > b ? b : v); }
  function clampf(v, a, b) { return v < a ? a : (v > b ? b : v); }
  /** Arrondi à 2 décimales : les options servent de clé de cache dans R3.mat(),
   *  les arrondir évite de créer 40 matériaux pour 40 opacités voisines. */
  function r2(v) { return Math.round(v * 100) / 100; }

  /** Phases décalées : deux auras côte à côte ne doivent pas battre à l'unisson.
   *  Multiple de l'angle d'or -> la suite ne repasse jamais deux fois au même
   *  endroit, sans avoir besoin d'un tirage aléatoire (donc déterministe). */
  let _seq = 0;
  function phase() { _seq = (_seq + 1) % 100003; return (_seq * 2.399963) % 6.2831853; }

  /** Matériau lumineux translucide : c'est LE matériau de cette bibliothèque. */
  function glowMat(color, opacity, extra) {
    const o = {
      transparent: true,
      opacity: r2(clampf(num(opacity, 0.3), 0.02, 1)),
      depthWrite: false,               // sinon l'aura perce la créature
      emissive: color,                 // visible sous tous les éclairages
      emissiveIntensity: 0.9,
      rough: 0.35,
      side: THREE.DoubleSide,
    };
    if (extra) Object.assign(o, extra);
    o.opacity = r2(o.opacity);
    o.emissiveIntensity = r2(o.emissiveIntensity);
    return R3.mat(color, o);
  }

  /** Matériau solide un peu lumineux (cristaux, plumes de feu, runes). */
  function solidMat(color, extra) {
    const o = { rough: 0.5, emissive: color, emissiveIntensity: 0.28 };
    if (extra) Object.assign(o, extra);
    if (o.opacity !== undefined) o.opacity = r2(o.opacity);
    o.emissiveIntensity = r2(o.emissiveIntensity);
    return R3.mat(color, o);
  }

  /** Mesh décoratif : ni ombre portée, ni ombre reçue (économie + propreté). */
  function put(geometry, material, x, y, z) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(num(x, 0), num(y, 0), num(z, 0));
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }

  /** Mesh « en dur » (aile, cristal, carapace) : lui, il projette une ombre. */
  function solid(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

  /** Ellipsoïde via la géométrie sphère partagée (mise à l'échelle). */
  function ell(rx, ry, rz, material, x, y, z, seg) {
    const m = put(R3.geo.sphere(1, seg || 14), material, x, y, z);
    m.scale.set(rx, ry, rz);
    return m;
  }

  /** Disque plat horizontal (dans le plan XZ) — la tache de lumière au sol. */
  function disc(r, material, y) {
    return put(R3.geo.cyl(r, r, 0.002, 28), material, 0, num(y, 0.02), 0);
  }

  /** Anneau horizontal (tore couché à plat). */
  function ring(r, tube, material, y) {
    const m = put(R3.geo.torus(r, tube, 22), material, 0, num(y, 0), 0);
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  function place(g, o) {
    g.position.set(num(o.x, 0), num(o.y, 0), num(o.z, 0));
    return g;
  }

  /** Les particules décoratives sautent en qualité basse (réglage §1.9). */
  function particlesOn() {
    return !(R3.quality && R3.quality.particles === false);
  }

  /** Enveloppe publique : une primitive ne doit JAMAIS casser la construction
   *  d'un légendaire. En cas de pépin on renvoie un groupe vide et on prévient. */
  function guard(name, fn) {
    return function () {
      try {
        const r = fn.apply(null, arguments);
        return r || new THREE.Group();
      } catch (e) {
        console.warn('[llib] ' + name + ' a échoué :', e);
        return new THREE.Group();
      }
    };
  }

  // Les 12 couleurs de type du §2 — pratique pour choisir la teinte d'une aura
  // sans dépendre du chargement de types3d.js.
  const TYPE_COLOR = {
    feu: '#ff6b3d', eau: '#41a6f6', plante: '#38b764', foudre: '#f1c40f',
    glace: '#a8e6ff', air: '#bfe3f2', terre: '#c08c4a', roche: '#9aa0a6',
    lumiere: '#ffe066', ombre: '#7a5cbf', temps: '#d896ff', espace: '#4b62d9',
  };

  // ===========================================================================
  //  1. aura(color, radius, opts) — LA primitive. Obligatoire sur les 36.
  // ===========================================================================
  /**
   * Ancrage : la BASE de la créature (y = 0). Le halo se centre à `opts.y`
   * (par défaut à 0,85 × rayon, soit à mi-corps d'un légendaire de 2 unités).
   *
   * opts = {
   *   intensity : 0.2 à 2.5   densité du halo et amplitude du battement  (1)
   *   rings     : 0 à 3       anneaux de lumière qui tournent            (1)
   *   particles : 0 à 8       lucioles en orbite (0 si qualité basse)    (4)
   *   shape     : 'sphere' | 'disc' | 'column'                    ('sphere')
   *   color2    : teinte de la coque externe (dégradé)      (= color)
   *   speed     : vitesse du battement                            (1.15)
   *   y, x, z   : décalage du groupe
   *   height    : hauteur de la colonne (shape:'column')       (3.2 × rayon)
   *   radiusY   : aplatissement vertical du halo sphérique         (0.95)
   * }
   *
   * Coût : sphere -> 3 + rings + particles (8 par défaut, 14 au maximum)
   *        disc   -> 2 + rings + particles
   *        column -> 3 + rings + particles
   *
   * Les trois formes, et à quoi elles servent :
   *   'sphere' : le cas général — une bulle de lumière autour de la créature.
   *   'disc'   : légendaire posé sur son autel ; le halo est au sol, on le voit
   *              de très loin en vue plongeante (c'est LA vue du jeu).
   *   'column' : puits de lumière qui monte au ciel — Auréol, Solaria,
   *              Monolithe, tout ce qui doit se repérer par-dessus la forêt.
   */
  function aura(color, radius, opts) {
    const o = opts || {};
    const col = color || '#ffe066';
    const col2 = o.color2 || col;
    const r = Math.max(0.15, num(radius, 1.0));
    const it = clampf(num(o.intensity, 1), 0.2, 2.5);
    const shape = (o.shape === 'disc' || o.shape === 'column') ? o.shape : 'sphere';
    const ry = num(o.radiusY, 0.95);
    const cy = num(o.y0, shape === 'sphere' ? r * 0.85 : 0);

    const g = new THREE.Group();
    const d = {
      kind: 'aura', ph: phase(), sp: num(o.speed, 1.15), it: it,
      rings: [], motes: [], cy: cy,
    };

    if (shape === 'sphere') {
      // Coque interne dense + coque externe diffuse. Elles respirent en
      // opposition : l'œil croit voir la luminosité varier alors que seule la
      // géométrie bouge (les matériaux sont partagés, on n'y touche pas).
      d.a = ell(r * 0.66, r * 0.66 * ry, r * 0.66,
        glowMat(col, 0.30 * it, { emissiveIntensity: 1.0 }), 0, cy, 0, 16);
      d.b = ell(r, r * ry, r,
        glowMat(col2, 0.13 * it, { emissiveIntensity: 0.75 }), 0, cy, 0, 16);
      d.a.renderOrder = 2; d.b.renderOrder = 2;
      g.add(d.a, d.b);
      // Tache au sol : c'est elle qui rend le légendaire lisible de loin dans
      // la vue plongeante, quand le corps n'est plus qu'un pâté de couleur.
      d.disc = disc(r * 1.15, glowMat(col2, 0.20 * it, { emissiveIntensity: 0.9 }), 0.02);
      g.add(d.disc);

    } else if (shape === 'disc') {
      d.disc = disc(r * 1.25, glowMat(col, 0.26 * it, { emissiveIntensity: 1.0 }), 0.02);
      const halo = disc(r * 1.75, glowMat(col2, 0.11 * it, { emissiveIntensity: 0.8 }), 0.015);
      d.b = halo;
      g.add(d.disc, halo);

    } else { // column
      const h = num(o.height, r * 3.2);
      d.disc = disc(r * 1.3, glowMat(col, 0.24 * it, { emissiveIntensity: 1.0 }), 0.02);
      // Colonne effilée vers le haut : un cylindre droit fait « tuyau » et son
      // couvercle se voit ; un tronc de cône qui se resserre fait « faisceau ».
      d.col = put(R3.geo.cyl(r * 0.42, r * 1.10, h, 20),
        glowMat(col2, 0.10 * it, { emissiveIntensity: 0.8 }), 0, h * 0.5, 0);
      d.colY = h * 0.5;
      d.a = ell(r * 0.52, r * 0.34, r * 0.52,
        glowMat(col, 0.22 * it, { emissiveIntensity: 1.0 }), 0, h * 0.94, 0, 14);
      d.col.renderOrder = 2; d.a.renderOrder = 2;
      g.add(d.disc, d.col, d.a);
    }

    // --- Anneaux de lumière ---------------------------------------------------
    // Chacun vit dans son propre groupe : le groupe tourne (rotation.y), le tore
    // porte l'inclinaison. Un tore est symétrique, le faire tourner dans son
    // propre plan ne se verrait pas.
    const nRings = clampi(num(o.rings, 1), 0, 3);
    for (let i = 0; i < nRings; i++) {
      const spin = new THREE.Group();
      const rr = r * (1.05 + i * 0.16);
      const m = ring(rr, Math.max(0.012, r * 0.035),
        glowMat(i % 2 ? col2 : col, (0.42 - i * 0.07) * it, { emissiveIntensity: 1.1 }),
        0);
      m.renderOrder = 2;
      const tilt = -Math.PI / 2 + (i === 0 ? 0.18 : (i === 1 ? -0.42 : 0.62));
      m.rotation.x = tilt;
      spin.position.y = cy + (shape === 'disc' ? r * 0.25 : 0) + (i - 0.5) * r * 0.16;
      spin.add(m);
      g.add(spin);
      d.rings.push({ spin: spin, mesh: m, tilt: tilt, sp: (i % 2 ? -0.55 : 0.42) - i * 0.06, ph: phase() });
    }

    // --- Lucioles en orbite ---------------------------------------------------
    const nMotes = particlesOn() ? clampi(num(o.particles, 4), 0, 8) : 0;
    for (let i = 0; i < nMotes; i++) {
      const mr = r * 0.16 * (0.6 + (i % 3) * 0.2);
      const m = put(R3.geo.sphere(mr, 8),
        glowMat(i % 2 ? col : col2, 0.85 * clampf(it, 0.5, 1.2), { emissiveIntensity: 0.85, side: THREE.FrontSide }),
        0, cy, 0);
      m.renderOrder = 3;
      g.add(m);
      d.motes.push({
        m: m,
        rad: r * (0.85 + (i % 4) * 0.14),
        sp: 0.5 + (i % 3) * 0.22,
        ph: (i / Math.max(1, nMotes)) * 6.2831853 + d.ph,
        y: cy + (i % 2 ? r * 0.30 : -r * 0.22),
        amp: r * 0.18,
      });
    }

    g.userData.ll = d;
    g.userData.auraColor = col;
    return place(g, o);
  }

  // ===========================================================================
  //  2. orbitRing(color, r, n, opts) — fragments en orbite
  // ===========================================================================
  /**
   * Ancrage : centre de l'orbite à l'origine (à placer à mi-hauteur du corps).
   * L'anneau est horizontal par défaut ; `tilt` l'incline vers l'avant.
   *
   * opts = {
   *   shape  : 'shard' | 'cube' | 'star' | 'sphere' | 'stone'     ('shard')
   *   size   : taille d'un fragment                       (0.22 × r)
   *   tilt   : inclinaison de l'orbite en radians                 (0.35)
   *   speed  : tours par seconde × 2π (négatif = sens inverse)     (0.5)
   *   guide  : true -> fin anneau lumineux qui matérialise l'orbite (false)
   *   color2 : couleur du guide                                (= color)
   *   wobble : amplitude du balancement vertical des fragments    (0.12)
   *   glow   : fragments lumineux plutôt que minéraux              (true)
   *   bake   : true -> fragments fusionnés (v3)                  (false)
   *   x, y, z
   * }
   * Coût : n meshes (+1 si guide). n plafonné à 12.
   *        avec `bake: true` : 1 draw call (2 avec le guide) — l'anneau tourne
   *        toujours, seul le frémissement de chaque éclat disparaît.
   *
   * Sert : les menhirs de Monolithe, les sabliers d'Éternia, les éclats de
   * Cristallia, les lunes de Vortexis.
   */
  function orbitRing(color, r, n, opts) {
    const o = opts || {};
    const col = color || '#a8e6ff';
    const rad = Math.max(0.1, num(r, 0.8));
    const cnt = clampi(num(n, 6), 1, 12);
    const size = num(o.size, rad * 0.22);
    const shape = o.shape || 'shard';
    const glow = o.glow !== false;

    const g = new THREE.Group();                 // porte l'inclinaison
    const spin = new THREE.Group();              // tourne
    g.add(spin);
    g.rotation.x = num(o.tilt, 0.35);

    const mtl = glow
      ? glowMat(col, 0.9, { emissiveIntensity: 0.6, side: THREE.FrontSide })
      : solidMat(col, { flat: true, rough: 0.6 });

    if (o.guide) {
      const gm = ring(rad, Math.max(0.008, rad * 0.018),
        glowMat(o.color2 || col, 0.35, { emissiveIntensity: 1.1 }), 0);
      gm.renderOrder = 2;
      spin.add(gm);
    }

    const frags = [];
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      let m;
      if (shape === 'cube') {
        m = put(R3.geo.box(size, size, size), mtl, 0, 0, 0);
      } else if (shape === 'star') {
        m = put(R3.geo.sphere(1, 6), mtl, 0, 0, 0);       // gemme facettée
        m.scale.set(size * 0.9, size * 1.3, size * 0.9);
      } else if (shape === 'sphere') {
        m = put(R3.geo.sphere(size * 0.55, 10), mtl, 0, 0, 0);
      } else if (shape === 'stone') {
        m = put(R3.geo.box(size * 0.55, size * 1.7, size * 0.4), mtl, 0, 0, 0);
      } else { // shard : biseau pointu vers l'extérieur
        m = put(R3.geo.cone(size * 0.42, size * 1.5, 5), mtl, 0, 0, 0);
        m.rotation.z = -Math.PI / 2;
      }
      m.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      if (!glow) solid(m);
      spin.add(m);
      frags.push({ m: m, a: a, rad: rad, ph: a + phase() * 0.1, base: m.rotation.z });
    }

    // Fusion facultative (v3 §9) : les n fragments ne font plus qu'un mesh qui
    // tourne en bloc. C'est ce qui rend « des anneaux en orbite » abordable
    // dans un budget de 25 draw calls.
    if (o.bake) { bake(spin); frags.length = 0; }

    g.userData.ll = {
      kind: 'orbit', spin: spin, frags: frags, ph: phase(),
      sp: num(o.speed, 0.5), wob: num(o.wobble, 0.12) * rad,
    };
    return place(g, o);
  }

  // ===========================================================================
  //  3. crystalCluster(color, n, scale) — grappe de cristaux
  // ===========================================================================
  /**
   * Ancrage : pivot à la BASE (origine), les cristaux poussent vers +y.
   * 4e argument facultatif :
   * opts = {
   *   opacity  : 1 = minéral opaque, 0.6 = glace translucide          (0.85)
   *   tipColor : couleur des pointes                              (= color)
   *   spread   : écartement latéral de la grappe                     (1)
   *   base     : true -> socle rocheux sous la grappe               (true)
   *   glow     : true -> petite lueur au cœur de la grappe          (true)
   *   flat     : facettes dures                                     (true)
   *   bake     : true -> grappe fusionnée (v3)                     (false)
   *   x, y, z
   * }
   * Coût : n (+1 socle) (+1 lueur). n plafonné à 10.
   *        avec `bake: true` : 1 draw call (2 teintes -> 2), plus 1 pour la
   *        lueur, qui reste séparée pour continuer de battre.
   *
   * Sert : le dos de Banquisor, les bois de Cristallia, les épines de Cryonix,
   * le socle de Monolithe.
   */
  function crystalCluster(color, n, scale, opts) {
    const o = opts || {};
    const col = color || '#a8e6ff';
    const cnt = clampi(num(n, 5), 1, 10);
    const s = Math.max(0.05, num(scale, 0.35));
    const spread = num(o.spread, 1);
    const opacity = clampf(num(o.opacity, 0.85), 0.15, 1);

    const g = new THREE.Group();
    const shards = [];
    const mtl = (opacity >= 0.99)
      ? solidMat(col, { flat: o.flat !== false, rough: 0.35, emissiveIntensity: 0.35 })
      : R3.mat(col, {
        transparent: true, opacity: r2(opacity), rough: 0.2,
        flat: o.flat !== false, emissive: col, emissiveIntensity: 0.45,
        side: THREE.DoubleSide, depthWrite: opacity > 0.6,
      });
    const tipMtl = o.tipColor ? solidMat(o.tipColor, { flat: true, rough: 0.3, emissiveIntensity: 0.7 }) : null;

    if (o.base !== false) {
      // Socle DISCRET : un simple renflement de la même teinte que les cristaux.
      // (Un socle large et contrasté vole la vedette à la grappe — essayé,
      //  ça ressemblait à un gâteau.)
      g.add(solid(ell(s * 0.52 * spread, s * 0.13, s * 0.52 * spread,
        solidMat(col, { flat: true, rough: 0.75, emissiveIntensity: 0.06 }),
        0, s * 0.05, 0, 7)));
    }

    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2 + 0.4;
      const u = (i % 3) / 3;                       // 3 tailles alternées
      const h = s * (1.5 - u * 0.55);
      const rr = s * (0.20 - u * 0.04);
      const dist = (cnt === 1) ? 0 : s * (0.34 + u * 0.16) * spread;
      const c = put(R3.geo.cone(rr, h, 6), (tipMtl && i % 3 === 1) ? tipMtl : mtl,
        Math.cos(a) * dist, h * 0.5 + s * 0.06, Math.sin(a) * dist);
      // Les cristaux s'écartent du centre : une gerbe, pas une haie.
      c.rotation.z = -Math.cos(a) * 0.32 * spread;
      c.rotation.x = Math.sin(a) * 0.32 * spread;
      solid(c);
      g.add(c);
      shards.push(c);
    }

    if (o.glow !== false) {
      const gl = put(R3.geo.sphere(s * 0.42, 10),
        glowMat(o.tipColor || col, 0.35, { emissiveIntensity: 1.2 }), 0, s * 0.42, 0);
      gl.renderOrder = 2;
      g.add(gl);
      g.userData.ll = { kind: 'crystal', ph: phase(), shards: shards, glow: gl, s: s };
    } else {
      g.userData.ll = { kind: 'crystal', ph: phase(), shards: shards, glow: null, s: s };
    }

    // Fusion facultative (v3 §9). La lueur centrale est marquée `llKeep` : elle
    // survit à la fusion et continue de pulser, sinon la grappe devient morte.
    if (o.bake) {
      const d = g.userData.ll;
      if (d.glow) d.glow.userData.llKeep = true;
      bake(g);
      d.shards = [];                    // les cônes n'existent plus séparément
    }
    return place(g, o);
  }

  // ===========================================================================
  //  4. majesticWing(len, color, opts) — grande aile à segments
  // ===========================================================================
  /**
   * Ancrage : pivot à l'ÉPAULE (origine). L'aile se déploie vers +x, dans le
   * plan XY (même convention que clib.dragonWing, pour pouvoir mélanger).
   * Aile gauche : passer `side: -1` — le groupe est retourné par une rotation
   * (jamais par une échelle négative, qui casserait l'éclairage).
   *
   * opts = {
   *   style    : 'feather' | 'membrane' | 'crystal' | 'ray' | 'flame' | 'bolt'
   *   segments : nombre de plumes / éclats / rayons  (5, plafonné à 9)
   *   height   : envergure verticale de l'aile           (0.75 × len)
   *   color2   : couleur des pointes / de l'alternance      (= color)
   *   boneColor: couleur de l'os / du bras            (= color assombri)
   *   opacity  : translucidité (1 = opaque)                    (1)
   *   side     : +1 droite | -1 gauche                        (+1)
   *   sweep    : recul des segments vers l'arrière (-z)      (0.12)
   *   spread   : ouverture de l'éventail                       (1)
   *   arm      : false -> pas d'os visible                  (true)
   *   flutter  : amplitude du frémissement des segments      (0.06)
   *              (animateAura ne touche QUE les segments, jamais la racine :
   *               le battement d'aile reste à la charge de la créature via
   *               userData.anim.wingL/wingR — les deux se superposent sans
   *               se marcher dessus.)
   *   bake     : true -> aile fusionnée (v3)                 (false)
   *   x, y, z
   * }
   * Coût : segments + 1 épaule (+1 bras) -> 7 par défaut, 11 au maximum.
   *        avec `bake: true` : 1 draw call par teinte employée (1 à 3). L'aile
   *        bat toujours — c'est la créature qui tourne sa racine — elle ne
   *        frémit simplement plus plume par plume. Deux ailes majestueuses pour
   *        2 draw calls : c'est ce qui rend le budget v3 tenable.
   *
   * Les six styles, et pour qui :
   *   feather  : Emberyx, Bourrasca, Éclipsion, Solaria — grandes rémiges.
   *   membrane : Pyrathos, Aélune, Prismée, Nébulon — voile tendu entre des os.
   *   crystal  : Cryonix, Cristallia, Givréa — éclats plats et anguleux.
   *   ray      : Auréol, Solaria — l'aile n'est que des rayons de lumière.
   *   flame    : Pyrathos, Emberyx, Fournalis — langues de feu superposées.
   *   bolt     : Fulguron, Voltaris — zigzags acérés d'électricité.
   */
  function majesticWing(len, color, opts) {
    const o = opts || {};
    const L = Math.max(0.15, num(len, 0.9));
    const H = num(o.height, L * 0.75);
    const col = color || '#ffe066';
    const col2 = o.color2 || col;
    const style = o.style || 'feather';
    const nSeg = clampi(num(o.segments, 5), 2, 9);
    const spread = num(o.spread, 1);
    const sweep = num(o.sweep, 0.12);
    const opacity = clampf(num(o.opacity, 1), 0.1, 1);
    const lumineux = (style === 'ray' || style === 'flame' || style === 'bolt');

    const g = new THREE.Group();
    const segs = [];

    function segMat(c, extra) {
      if (opacity < 0.99 || lumineux) {
        return glowMat(c, lumineux ? Math.max(0.78, opacity) : opacity,
          Object.assign({ emissiveIntensity: lumineux ? 0.75 : 0.3 }, extra || {}));
      }
      return solidMat(c, Object.assign({ rough: 0.6, emissiveIntensity: 0.14, side: THREE.DoubleSide }, extra || {}));
    }

    const boneCol = o.boneColor || col2;
    const thick = Math.max(0.012, L * 0.030);

    // Les options des segments, style par style. Elles servent AUSSI à l'épaule
    // et aux os : c'est ce qui permet à toute l'aile de tenir en un ou deux
    // matériaux, donc en un ou deux draw calls après `bake` (v3 §9). Sans cette
    // mise en commun, l'épaule d'une aile d'éclair coûtait un draw call à elle
    // seule, pour une bosse de la taille d'un pouce.
    const SEG_EXTRA = {
      crystal: { flat: true },
      ray: { emissiveIntensity: 1.3 },
      flame: { emissiveIntensity: 1.15 },
      bolt: { emissiveIntensity: 1.35 },
    };
    const extraSeg = SEG_EXTRA[style] || null;
    /** Matériau d'os / d'épaule : identique à celui des segments opaques, pour
     *  qu'ils fusionnent ensemble quand la couleur est la même. */
    function boneMat(c) {
      return solidMat(c, { rough: 0.6, emissiveIntensity: 0.14, side: THREE.DoubleSide });
    }

    // --- Épaule : la petite masse qui raccorde l'aile au corps ---------------
    g.add(solid(ell(L * 0.12, H * 0.16, L * 0.10, segMat(col2, extraSeg), L * 0.06, 0, 0, 10)));

    if (style === 'membrane') {
      // Voile tendu : un grand lobe + deux festons au bord de fuite + doigts.
      const mm = segMat(col, { side: THREE.DoubleSide });
      const mem = ell(L * 0.54, H * 0.52, thick, mm, L * 0.50, -H * 0.08, -sweep * L * 0.5, 14);
      mem.rotation.z = 0.15;
      g.add(mem); segs.push(mem);
      const lobes = [[L * 0.34, -H * 0.44, L * 0.26], [L * 0.74, -H * 0.36, L * 0.22]];
      for (let i = 0; i < Math.min(nSeg - 1, lobes.length); i++) {
        const p = lobes[i];
        const lo = ell(p[2], H * 0.30, thick, mm, p[0], p[1], -sweep * L * 0.5, 12);
        g.add(lo); segs.push(lo);
      }
      if (o.arm !== false) {
        const arm = put(R3.geo.cyl(thick * 1.1, thick * 1.9, L * 0.94, 7),
          boneMat(boneCol), L * 0.46, H * 0.14, 0);
        arm.rotation.z = -Math.PI / 2 + 0.20;
        g.add(solid(arm));
      }
      // Doigts : ce sont eux qui font lire « aile » et pas « pétale ».
      [[0.30, 0.70], [0.85, 0.54]].forEach(function (f) {
        const dgt = put(R3.geo.cyl(thick * 0.6, thick * 1.1, L * f[1], 6),
          boneMat(boneCol), L * 0.52, -H * 0.04, thick);
        dgt.rotation.z = -Math.PI / 2 - f[0];
        g.add(dgt);
      });
    } else {
      // Éventail de segments : plume, éclat, rayon, flamme ou éclair.
      // a0 = segment du haut (vers l'avant), a1 = segment du bas (vers l'arrière).
      const a0 = 0.42 * spread, a1 = -0.85 * spread;
      for (let i = 0; i < nSeg; i++) {
        const u = (nSeg === 1) ? 0 : i / (nSeg - 1);
        const a = a0 + (a1 - a0) * u;
        const sl = L * (1 - u * 0.34) * (style === 'ray' ? (i % 2 ? 0.72 : 1.06) : 1);
        const sw = H * (0.20 - u * 0.05);
        const cx = Math.cos(a), cz = Math.sin(a);
        const c = (i % 2) ? col : col2;
        let m;

        if (style === 'crystal') {
          // Cône à 4 pans écrasé sur z : un éclat plat, tranchant.
          m = put(R3.geo.cone(sw * 0.9, sl, 4), segMat(c, { flat: true }),
            cx * sl * 0.5, cz * sl * 0.5, -sweep * L * u);
          m.scale.z = 0.35;
          m.rotation.z = a - Math.PI / 2;
        } else if (style === 'ray') {
          m = put(R3.geo.cone(sw * 0.42, sl, 5), segMat(c, { emissiveIntensity: 1.3 }),
            cx * sl * 0.5, cz * sl * 0.5, -sweep * L * u * 0.4);
          m.rotation.z = a - Math.PI / 2;
        } else if (style === 'flame') {
          m = put(R3.geo.cone(sw * 0.78, sl, 7), segMat(c, { emissiveIntensity: 1.15 }),
            cx * sl * 0.5, cz * sl * 0.5, -sweep * L * u);
          m.scale.z = 0.6;
          m.rotation.z = a - Math.PI / 2 + (i % 2 ? 0.10 : -0.10);
        } else if (style === 'bolt') {
          // Barre fine et cassée : deux inclinaisons alternées font le zigzag.
          m = put(R3.geo.box(sl, sw * 0.42, sw * 0.22), segMat(c, { emissiveIntensity: 1.35 }),
            cx * sl * 0.5, cz * sl * 0.5, -sweep * L * u * 0.5);
          m.rotation.z = a + (i % 2 ? 0.26 : -0.26);
        } else { // feather
          m = ell(sl * 0.5, sw, Math.max(0.010, sw * 0.32), segMat(c),
            cx * sl * 0.52, cz * sl * 0.52, -sweep * L * u, 12);
          m.rotation.z = a;
          if (o.tipColor) {
            const tip = ell(sl * 0.16, sw * 0.7, Math.max(0.010, sw * 0.30), segMat(o.tipColor),
              cx * sl * 0.92, cz * sl * 0.92, -sweep * L * u, 10);
            tip.rotation.z = a;
            g.add(tip);
          }
        }
        if (!lumineux) solid(m);
        g.add(m);
        segs.push(m);
      }
      if (o.arm !== false && style !== 'ray') {
        const arm = put(R3.geo.cyl(thick * 0.9, thick * 1.8, L * 0.80, 7),
          solidMat(boneCol, { rough: 0.55, emissiveIntensity: 0.12 }),
          L * 0.40, H * 0.16, 0);
        arm.rotation.z = -Math.PI / 2 + 0.30;
        g.add(solid(arm));
      }
    }

    g.userData.ll = {
      kind: 'wing', ph: phase(), segs: segs,
      amp: num(o.flutter, 0.06), sp: 2.1 + (style === 'flame' ? 1.6 : 0),
      base: segs.map(function (m) { return m.rotation.z; }),
    };
    g.userData.segments = segs;

    // Fusion facultative (v3 §9) — faite AVANT le retournement de l'aile gauche
    // pour que la géométrie fusionnée reste dans le repère « aile droite ».
    if (o.bake) { bake(g); segs.length = 0; }

    if (num(o.side, 1) < 0) g.rotation.y = Math.PI;
    return place(g, o);
  }

  // ===========================================================================
  //  5. plumeTail(len, color, n) — longue traîne de plumes / de flammes
  // ===========================================================================
  /**
   * Ancrage : pivot à la BASE (origine), la traîne part vers -z (donc DERRIÈRE
   * une créature qui regarde +z).
   *
   * Les segments sont EMBOÎTÉS les uns dans les autres : faire tourner le
   * premier entraîne toute la queue. C'est ce qui donne le fouetté d'une traîne
   * de phénix, impossible à obtenir avec des segments frères.
   *
   * 4e argument facultatif :
   * opts = {
   *   style  : 'feather' | 'flame' | 'ribbon' | 'fin'        ('feather')
   *   width  : largeur du premier segment              (0.22 × len)
   *   color2 : couleur alternée / des pointes               (= color)
   *   droop  : affaissement de la traîne vers le bas          (0.10)
   *   amp    : amplitude de l'ondulation                      (0.22)
   *   speed  : vitesse de l'ondulation                        (1.8)
   *   x, y, z
   * }
   * Coût : n meshes (6 par défaut, 12 au maximum).
   *
   * Sert : la traîne d'Emberyx, la queue de Maréa, celle de Pénombra, la crête
   * de Fournalis (avec droop négatif).
   */
  function plumeTail(len, color, n, opts) {
    const o = opts || {};
    const L = Math.max(0.15, num(len, 1.0));
    const col = color || '#ff8c42';
    const col2 = o.color2 || col;
    const cnt = clampi(num(n, 6), 1, 12);
    const style = o.style || 'feather';
    const w0 = num(o.width, L * 0.22);
    const step = L / cnt;
    const droop = num(o.droop, 0.10);
    const lumineux = (style === 'flame');

    const root = new THREE.Group();
    const segs = [];
    let parent = root;

    for (let i = 0; i < cnt; i++) {
      const u = i / cnt;
      const w = w0 * (1 - u * 0.62);
      const c = (i % 2) ? col2 : col;
      const mtl = lumineux
        ? glowMat(c, 0.9, { emissiveIntensity: 1.15, side: THREE.FrontSide })
        : solidMat(c, { rough: 0.6, emissiveIntensity: 0.18, side: THREE.DoubleSide });

      const seg = new THREE.Group();
      seg.position.z = (i === 0) ? -step * 0.45 : -step;
      seg.rotation.x = droop;                     // chaque maillon retombe un peu

      let m;
      if (style === 'flame') {
        m = put(R3.geo.cone(w * 0.7, step * 1.35, 7), mtl, 0, 0, -step * 0.30);
        m.rotation.x = -Math.PI / 2;              // la pointe part vers -z
        m.scale.set(1, 1, 0.75);
      } else if (style === 'ribbon') {
        m = put(R3.geo.box(w * 1.5, Math.max(0.012, w * 0.12), step * 1.1), mtl, 0, 0, -step * 0.15);
      } else if (style === 'fin') {
        m = ell(Math.max(0.012, w * 0.14), w * 1.15, step * 0.62, mtl, 0, w * 0.35, -step * 0.15, 10);
      } else { // feather
        m = ell(w * 0.55, Math.max(0.014, w * 0.22), step * 0.66, mtl, 0, 0, -step * 0.15, 12);
      }
      if (!lumineux) solid(m);
      seg.add(m);
      parent.add(seg);
      parent = seg;
      segs.push(seg);
    }

    root.userData.ll = {
      kind: 'plume', ph: phase(), segs: segs,
      amp: num(o.amp, 0.22), sp: num(o.speed, 1.8), droop: droop,
    };
    root.userData.segments = segs;
    return place(root, o);
  }

  // ===========================================================================
  //  6. halo(color, r, rays) — auréole à rayons
  // ===========================================================================
  /**
   * Ancrage : centre de l'auréole à l'origine (à placer derrière ou au-dessus
   * de la tête). Par défaut l'auréole est DEBOUT dans le plan XY, face à +z,
   * comme une auréole de vitrail. `opts.plane: 'flat'` la couche à l'horizontale
   * au-dessus de la tête.
   *
   * 4e argument facultatif :
   * opts = {
   *   plane   : 'face' | 'flat'                              ('face')
   *   color2  : couleur des rayons                          (= color)
   *   speed   : vitesse de rotation (rad/s, négatif = inverse) (0.35)
   *   rayLen  : longueur des rayons                     (0.55 × r)
   *   tube    : grosseur de l'anneau                    (0.09 × r)
   *   solid   : true -> disque plein derrière l'anneau        (false)
   *   bake    : true -> auréole fusionnée (v3)                (false)
   *   x, y, z
   * }
   * Coût : 1 anneau + rays (+1 disque) -> 9 par défaut, 15 au maximum.
   *        avec `bake: true` : 1 à 3 draw calls ; l'auréole tourne toujours,
   *        seuls les rayons cessent de respirer un à un.
   *
   * Sert : Auréol (le nom vient de là), Solaria, Éclipsion (anneau sombre :
   * passer une couleur sombre et rays = 0), Chronoss, Éternia.
   */
  function halo(color, r, rays, opts) {
    const o = opts || {};
    const col = color || '#ffe066';
    const col2 = o.color2 || col;
    const rr = Math.max(0.08, num(r, 0.5));
    const nR = clampi(num(rays, 8), 0, 14);

    const g = new THREE.Group();
    const spin = new THREE.Group();
    g.add(spin);

    const tube = num(o.tube, rr * 0.09);
    const anneau = put(R3.geo.torus(rr, tube, 22),
      glowMat(col, 0.85, { emissiveIntensity: 1.2, side: THREE.FrontSide }), 0, 0, 0);
    anneau.renderOrder = 2;
    spin.add(anneau);

    if (o.solid) {
      const dk = put(R3.geo.cyl(rr * 0.96, rr * 0.96, 0.004, 26),
        glowMat(col2, 0.22, { emissiveIntensity: 0.9 }), 0, 0, -tube * 0.6);
      dk.rotation.x = Math.PI / 2;     // le cylindre est couché -> disque en XY
      dk.renderOrder = 2;
      spin.add(dk);
    }

    const rl = num(o.rayLen, rr * 0.55);
    const raysArr = [];
    for (let i = 0; i < nR; i++) {
      const a = (i / nR) * Math.PI * 2;
      const l = rl * (i % 2 ? 0.62 : 1);
      const m = put(R3.geo.cone(tube * 1.5, l, 5),
        glowMat(i % 2 ? col2 : col, 0.8, { emissiveIntensity: 1.3, side: THREE.FrontSide }),
        Math.cos(a) * (rr + l * 0.45), Math.sin(a) * (rr + l * 0.45), 0);
      m.rotation.z = a - Math.PI / 2;   // le cône pointe vers l'extérieur
      m.renderOrder = 2;
      spin.add(m);
      raysArr.push({ m: m, ph: a });
    }

    // Fusion facultative (v3 §9) : l'anneau et ses rayons ne font plus qu'une
    // ou deux pièces, qui tournent ensemble.
    if (o.bake) { bake(spin); raysArr.length = 0; }

    if (o.plane === 'flat') g.rotation.x = -Math.PI / 2;

    g.userData.ll = { kind: 'halo', spin: spin, rays: raysArr, ph: phase(), sp: num(o.speed, 0.35) };
    return place(g, o);
  }

  // ===========================================================================
  //  7. runeStone(color, size) — pierre gravée flottante
  // ===========================================================================
  /**
   * Ancrage : centre de la pierre à l'origine. Elle flotte (animateAura la fait
   * monter et descendre lentement et tourner sur elle-même).
   *
   * 3e/4e arguments : runeStone(color, size, opts)
   * opts = {
   *   glowColor : couleur de la gravure               ('#ffe066')
   *   rune      : 'star' | 'ring' | 'bar'              ('star')
   *   count     : nombre de pierres en cercle              (1, max 4)
   *   spread    : rayon du cercle si count > 1        (2.2 × size)
   *   x, y, z
   * }
   * Coût : 3 meshes par pierre (pierre + gravure + lueur) -> 12 au maximum.
   *
   * Sert : Monolithe (menhirs), Éternia, Chronoss, Nyxaroth, tous les
   * légendaires « anciens ». À combiner avec orbitRing pour les faire tourner.
   */
  function runeStone(color, size, opts) {
    const o = opts || {};
    const col = color || '#8a9199';
    const s = Math.max(0.05, num(size, 0.3));
    const glowCol = o.glowColor || '#ffe066';
    const cnt = clampi(num(o.count, 1), 1, 4);
    const spread = num(o.spread, s * 2.2);

    const g = new THREE.Group();
    const stones = [];
    const stoneMat = solidMat(col, { flat: true, rough: 0.85, emissiveIntensity: 0.05 });
    const runeMat = glowMat(glowCol, 0.95, { emissiveIntensity: 1.4, side: THREE.FrontSide });
    const auraMat = glowMat(glowCol, 0.16, { emissiveIntensity: 0.9 });

    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      const p = new THREE.Group();
      if (cnt > 1) { p.position.set(Math.cos(a) * spread, 0, Math.sin(a) * spread); p.rotation.y = -a; }

      // Bloc taillé : une sphère à 5 segments donne un caillou anguleux et
      // crédible pour 1 mesh (bien mieux qu'une boîte, trop régulière).
      const st = put(R3.geo.sphere(1, 5), stoneMat, 0, 0, 0);
      st.scale.set(s * 0.78, s * 1.15, s * 0.62);
      solid(st);
      p.add(st);

      // Gravure lumineuse, posée sur la face avant.
      let rn;
      if (o.rune === 'ring') {
        rn = put(R3.geo.torus(s * 0.36, s * 0.07, 14), runeMat, 0, 0, s * 0.56);
      } else if (o.rune === 'bar') {
        rn = put(R3.geo.box(s * 0.14, s * 0.78, s * 0.10), runeMat, 0, 0, s * 0.56);
        rn.rotation.z = 0.25;
      } else {
        rn = put(R3.geo.sphere(1, 4), runeMat, 0, 0, s * 0.56);
        rn.scale.set(s * 0.34, s * 0.46, s * 0.12);
        rn.rotation.z = 0.5;
      }
      rn.renderOrder = 2;
      p.add(rn);

      // Nimbe : sans lui, la pierre a l'air posée là par hasard.
      const nb = ell(s * 1.05, s * 1.4, s * 0.95, auraMat, 0, 0, 0, 12);
      nb.renderOrder = 2;
      p.add(nb);

      g.add(p);
      stones.push({ p: p, y0: 0, ph: phase(), spin: (i % 2 ? -0.35 : 0.28) });
    }

    g.userData.ll = { kind: 'rune', stones: stones, ph: phase(), amp: s * 0.22 };
    return place(g, o);
  }

  // ===========================================================================
  //  8. flowRibbon(len, color, opts) — ruban ondulant (vent, eau, temps)
  // ===========================================================================
  /**
   * Ancrage : pivot à la BASE (origine). Le ruban part vers -z par défaut
   * (`axis: 'y'` le fait monter, `axis: 'x'` le fait partir sur le côté).
   * Les segments sont FRÈRES (pas emboîtés) : l'onde les traverse comme une
   * vague, alors que plumeTail fouette comme un fouet. Deux mouvements très
   * différents, à choisir selon la créature.
   *
   * opts = {
   *   segments : nombre de lames                   (8, plafonné à 14)
   *   width    : largeur du ruban                     (0.22 × len)
   *   thick    : épaisseur                          (0.03 × width)
   *   color2   : couleur alternée                        (= color)
   *   opacity  : translucidité                              (0.75)
   *   amp      : amplitude de l'onde                 (0.18 × len)
   *   waves    : nombre d'ondes visibles sur la longueur      (1.6)
   *   speed    : vitesse de l'onde                            (1.6)
   *   taper    : rétrécissement vers la pointe                (0.6)
   *   axis     : 'z' | 'y' | 'x'                              ('z')
   *   x, y, z
   * }
   * Coût : segments meshes (8 par défaut, 14 au maximum).
   *
   * Sert : les voiles d'eau d'Ondinaë, le corps-ruban de Zéphyrion, le voile
   * d'Aélune, les écharpes de temps d'Éternia, les gaz de Nébulon.
   */
  function flowRibbon(len, color, opts) {
    const o = opts || {};
    const L = Math.max(0.15, num(len, 1.2));
    const col = color || '#a8e6ff';
    const col2 = o.color2 || col;
    const cnt = clampi(num(o.segments, 8), 2, 14);
    const w = num(o.width, L * 0.22);
    const th = num(o.thick, Math.max(0.010, w * 0.10));
    const opacity = clampf(num(o.opacity, 0.75), 0.08, 1);
    const step = L / cnt;

    const g = new THREE.Group();
    const segs = [];
    const mA = glowMat(col, opacity, { emissiveIntensity: 0.55 });
    const mB = glowMat(col2, opacity * 0.9, { emissiveIntensity: 0.55 });

    for (let i = 0; i < cnt; i++) {
      const u = (i + 0.5) / cnt;
      const ww = w * (1 - u * num(o.taper, 0.6));
      const m = put(R3.geo.box(ww, th, step * 1.05), (i % 2) ? mB : mA,
        0, 0, -(i + 0.5) * step);
      m.renderOrder = 2;
      g.add(m);
      segs.push({ m: m, u: u, z: -(i + 0.5) * step });
    }

    if (o.axis === 'y') g.rotation.x = Math.PI / 2;        // -z devient +y
    else if (o.axis === 'x') g.rotation.y = -Math.PI / 2;  // -z devient +x

    g.userData.ll = {
      kind: 'ribbon', segs: segs, ph: phase(),
      amp: num(o.amp, L * 0.18), sp: num(o.speed, 1.6), wl: num(o.waves, 1.6) * Math.PI * 2,
    };
    g.userData.segments = segs;
    return place(g, o);
  }

  // ===========================================================================
  //  9. starfield(color, n, r) — nuée de points lumineux
  // ===========================================================================
  /**
   * Ancrage : centre du nuage à l'origine.
   *
   * UN SEUL draw call quel que soit le nombre d'étoiles : c'est un THREE.Points
   * avec une texture de point ronde générée en canvas (pas de fichier externe,
   * §1.1) et partagée par tous les nuages. Le scintillement passe par l'attribut
   * de COULEUR de la géométrie — surtout pas par le matériau, qui est partagé.
   *
   * 4e argument facultatif :
   * opts = {
   *   size    : taille d'une étoile en unités monde     (0.055 × ?)
   *   spread  : 'ball' | 'shell' | 'disc' | 'spiral'      ('ball')
   *   opacity : 0..1                                        (1)
   *   color2  : seconde teinte, mélangée une étoile sur deux
   *   ry      : aplatissement vertical du nuage              (1)
   *   speed   : vitesse de rotation                       (0.15)
   *   seed    : graine (même graine = même nuage)            (1)
   *   x, y, z
   * }
   * Coût : 1 mesh (repli : n sphères plafonnées à 10 si THREE.Points manque).
   *
   * Sert : Astralis (constellations), Vortexis (spirale), Nébulon, Éternia,
   * Prismée, et le sillage de tout légendaire d'espace ou de temps.
   */
  let _dotTex;
  function dotTexture() {
    if (_dotTex !== undefined) return _dotTex;
    _dotTex = null;
    try {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const x = c.getContext('2d');
      const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0.0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.30, 'rgba(255,255,255,0.85)');
      gr.addColorStop(0.65, 'rgba(255,255,255,0.22)');
      gr.addColorStop(1.0, 'rgba(255,255,255,0)');
      x.fillStyle = gr;
      x.fillRect(0, 0, 32, 32);
      _dotTex = new THREE.CanvasTexture(c);
    } catch (e) { _dotTex = null; }
    return _dotTex;
  }

  const _ptsMats = new Map();
  function pointsMat(size, opacity) {
    const key = 'p|' + r2(size) + '|' + r2(opacity);
    let m = _ptsMats.get(key);
    if (m) return m;
    m = new THREE.PointsMaterial({
      size: size,
      map: dotTexture(),
      vertexColors: true,          // la teinte ET le scintillement viennent d'ici
      transparent: true,
      opacity: r2(opacity),
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    _ptsMats.set(key, m);
    return m;
  }

  function starfield(color, n, r, opts) {
    const o = opts || {};
    const col = new THREE.Color(color || '#f4f4f4');
    const col2 = new THREE.Color(o.color2 || color || '#fcef8d');
    const rad = Math.max(0.1, num(r, 1.0));
    const q = particlesOn() ? 1 : 0.5;
    let cnt = clampi(num(n, 24) * q, 4, 90);
    const size = num(o.size, rad * 0.075);
    const ry = num(o.ry, 1);
    const spread = o.spread || 'ball';
    const rnd = R3.rng(clampi(num(o.seed, 1), 1, 99999) * 7919);

    const g = new THREE.Group();

    if (!THREE.Points || !THREE.PointsMaterial) {
      // Repli très économe : quelques sphères lumineuses seulement.
      cnt = Math.min(cnt, 10);
      const mtl = glowMat(color || '#f4f4f4', 0.9, { emissiveIntensity: 1.4, side: THREE.FrontSide });
      const arr = [];
      for (let i = 0; i < cnt; i++) {
        const a = rnd() * 6.2831853, b = (rnd() - 0.5) * 3.1;
        const rr = rad * (0.4 + rnd() * 0.6);
        const m = put(R3.geo.sphere(size * 0.7, 6), mtl,
          Math.cos(a) * Math.cos(b) * rr, Math.sin(b) * rr * ry, Math.sin(a) * Math.cos(b) * rr);
        g.add(m); arr.push(m);
      }
      g.userData.ll = { kind: 'starFallback', ph: phase(), sp: num(o.speed, 0.15), pts: arr };
      return place(g, o);
    }

    const pos = new Float32Array(cnt * 3);
    const colArr = new Float32Array(cnt * 3);
    const base = new Float32Array(cnt * 3);
    const phs = new Float32Array(cnt);

    for (let i = 0; i < cnt; i++) {
      let px, py, pz;
      if (spread === 'disc') {
        const a = rnd() * 6.2831853, rr = rad * Math.sqrt(rnd());
        px = Math.cos(a) * rr; pz = Math.sin(a) * rr; py = (rnd() - 0.5) * rad * 0.18 * ry;
      } else if (spread === 'spiral') {
        // Bras de galaxie : le rayon croît avec l'angle, deux bras opposés.
        const u = i / cnt;
        const a = u * 6.2831853 * 1.6 + (i % 2 ? Math.PI : 0) + (rnd() - 0.5) * 0.5;
        const rr = rad * (0.16 + u * 0.9);
        px = Math.cos(a) * rr; pz = Math.sin(a) * rr;
        py = (rnd() - 0.5) * rad * 0.16 * ry;
      } else if (spread === 'shell') {
        const a = rnd() * 6.2831853, b = Math.acos(2 * rnd() - 1);
        const rr = rad * (0.88 + rnd() * 0.12);
        px = Math.sin(b) * Math.cos(a) * rr; py = Math.cos(b) * rr * ry; pz = Math.sin(b) * Math.sin(a) * rr;
      } else {
        const a = rnd() * 6.2831853, b = Math.acos(2 * rnd() - 1);
        const rr = rad * Math.cbrt(rnd());
        px = Math.sin(b) * Math.cos(a) * rr; py = Math.cos(b) * rr * ry; pz = Math.sin(b) * Math.sin(a) * rr;
      }
      pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;
      const c = (i % 3 === 0) ? col2 : col;
      base[i * 3] = c.r; base[i * 3 + 1] = c.g; base[i * 3 + 2] = c.b;
      colArr[i * 3] = c.r; colArr[i * 3 + 1] = c.g; colArr[i * 3 + 2] = c.b;
      phs[i] = rnd() * 6.2831853;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const cAttr = new THREE.BufferAttribute(colArr, 3);
    geom.setAttribute('color', cAttr);
    const pts = new THREE.Points(geom, pointsMat(size, clampf(num(o.opacity, 1), 0.05, 1)));
    pts.frustumCulled = false;    // le nuage suit la créature, sa boîte est fausse
    pts.renderOrder = 3;
    g.add(pts);

    g.userData.ll = {
      kind: 'star', ph: phase(), sp: num(o.speed, 0.15),
      pts: pts, attr: cAttr, base: base, phs: phs, n: cnt, tw: 2.6,
    };
    return place(g, o);
  }

  // ===========================================================================
  //  10. glowCore(color, r) — cœur lumineux pulsant
  // ===========================================================================
  /**
   * Ancrage : centre à l'origine.
   * 3e argument facultatif :
   * opts = {
   *   color2 : couleur du nimbe                       (= color)
   *   spikes : 0..8 éclats en croix autour du cœur         (0)
   *   speed  : vitesse du battement                      (2.0)
   *   shells : 1 à 3 coques concentriques (v3)             (3)
   *   x, y, z
   * }
   * Coût : `shells` meshes (+ spikes) -> 3 par défaut, 1 en version économe.
   * `shells: 1` sert quand le cœur n'est qu'un détail parmi d'autres et que le
   * budget de 25 draw calls du légendaire est déjà bien entamé.
   *
   * Sert : le cœur de magma de Pyrathos, le noyau d'Ondinaë, l'œil d'Orageon,
   * la gemme au front de Sylvaros, le trou noir d'Éclipsion.
   */
  function glowCore(color, r, opts) {
    const o = opts || {};
    const col = color || '#ffe066';
    const col2 = o.color2 || col;
    const rr = Math.max(0.03, num(r, 0.25));
    const g = new THREE.Group();

    const nSh = clampi(num(o.shells, 3), 1, 3);
    // En version à 1 coque, le cœur grossit : sans son nimbe il paraîtrait
    // riquiqui au milieu de la créature.
    const core = put(R3.geo.sphere(rr * (nSh === 1 ? 0.92 : 0.55), 12),
      glowMat(col, nSh === 1 ? 0.80 : 0.98, { emissiveIntensity: 1.5, side: THREE.FrontSide }), 0, 0, 0);
    core.renderOrder = 3;
    g.add(core);
    let mid = null, out = null;
    if (nSh >= 2) {
      mid = put(R3.geo.sphere(rr * 0.82, 12), glowMat(col, 0.34, { emissiveIntensity: 1.1 }), 0, 0, 0);
      mid.renderOrder = 2; g.add(mid);
    }
    if (nSh >= 3) {
      out = put(R3.geo.sphere(rr * 1.18, 12), glowMat(col2, 0.14, { emissiveIntensity: 0.8 }), 0, 0, 0);
      out.renderOrder = 2; g.add(out);
    }

    const spikes = [];
    const nS = clampi(num(o.spikes, 0), 0, 8);
    for (let i = 0; i < nS; i++) {
      const a = (i / nS) * Math.PI * 2;
      const sp = put(R3.geo.cone(rr * 0.14, rr * 1.5, 5),
        glowMat(col2, 0.8, { emissiveIntensity: 1.4, side: THREE.FrontSide }),
        Math.cos(a) * rr * 1.0, Math.sin(a) * rr * 1.0, 0);
      sp.rotation.z = a - Math.PI / 2;
      sp.renderOrder = 2;
      g.add(sp);
      spikes.push(sp);
    }

    g.userData.ll = { kind: 'core', ph: phase(), sp: num(o.speed, 2.0), core: core, mid: mid, out: out, spikes: spikes };
    return place(g, o);
  }

  // ===========================================================================
  //  11. bigEyes(spread, y, z, r) — yeux nobles
  // ===========================================================================
  /**
   * Ancrage : milieu du visage à l'origine ; les yeux regardent +z.
   * Différence avec R3.eyes : ceux-ci sont en AMANDE (allongés, pas ronds),
   * avec un iris coloré lumineux et un sourcil incliné. Une créature ordinaire
   * a de grands yeux ronds et gentils ; un légendaire a le regard décidé.
   *
   * 5e argument facultatif :
   * opts = {
   *   color   : couleur de l'iris (lumineuse)       ('#ffe066')
   *   dark    : couleur du globe                    ('#141824')
   *   brow    : true -> paupière/sourcil incliné        (true)
   *   browColor                                    (= dark)
   *   angry   : 0 = serein, 1 = très déterminé           (0.6)
   *   tilt    : inclinaison de l'amande                 (0.18)
   *   x, y, z : décalage supplémentaire du groupe
   * }
   * Coût : 3 meshes par œil (6), ou 4 par œil avec le sourcil (8).
   */
  function bigEyes(spread, y, z, r, opts) {
    const o = opts || {};
    const sp = num(spread, 0.16);
    const yy = num(y, 0.1);
    const zz = num(z, 0.28);
    const rr = Math.max(0.02, num(r, 0.075));
    const iris = o.color || '#ffe066';
    const dark = o.dark || '#141824';
    const angry = clampf(num(o.angry, 0.6), 0, 1);
    const tilt = num(o.tilt, 0.18);

    const g = new THREE.Group();
    const globeMat = R3.mat(dark, { rough: 0.35 });
    const irisMat = glowMat(iris, 0.95, { emissiveIntensity: 1.35, side: THREE.FrontSide });
    const hiMat = R3.mat('#ffffff', { rough: 0.2, emissive: '#ffffff', emissiveIntensity: 0.5 });
    const browMat = R3.mat(o.browColor || dark, { rough: 0.7 });
    const parts = [];

    [-1, 1].forEach(function (s) {
      const e = new THREE.Group();
      e.position.set(s * sp, yy, zz);

      // Globe en amande : plus large que haut, incliné vers l'extérieur.
      const globe = ell(rr * 1.15, rr * 0.72, rr * 0.55, globeMat, 0, 0, 0, 12);
      globe.rotation.z = -s * tilt;
      e.add(globe);

      // Iris lumineux, légèrement en avant du globe.
      const ir = ell(rr * 0.50, rr * 0.44, rr * 0.28, irisMat, 0, 0, rr * 0.34, 10);
      ir.renderOrder = 2;
      e.add(ir);

      // Reflet : minuscule, mais c'est lui qui rend le regard vivant.
      const hi = put(R3.geo.sphere(rr * 0.17, 8), hiMat, s * rr * 0.22, rr * 0.20, rr * 0.46);
      e.add(hi);

      if (o.brow !== false) {
        const br = ell(rr * 1.25, rr * 0.20, rr * 0.26, browMat, 0, rr * 0.62, rr * 0.12, 10);
        // Sourcil qui plonge vers le nez = regard déterminé.
        br.rotation.z = -s * (tilt + angry * 0.45);
        e.add(br);
      }

      g.add(e);
      parts.push(e);
    });

    g.userData.ll = { kind: 'eyes', ph: phase(), eyes: parts };
    g.userData.eyes = parts;
    return place(g, o);
  }

  // ===========================================================================
  //  BONUS 1. serpentBody(len, color, opts) — corps serpentin
  // ===========================================================================
  /**
   * Ancrage : pivot à la TÊTE (origine) ; le corps s'enfonce vers -z.
   * Comme plumeTail, les anneaux sont EMBOÎTÉS : l'ondulation se propage.
   *
   * opts = {
   *   segments : nombre d'anneaux                 (9, plafonné à 14)
   *   r        : rayon du premier anneau            (0.16 × len)
   *   taper    : rétrécissement jusqu'à la queue          (0.75)
   *   belly    : couleur du ventre (bandes claires)      (aucune)
   *   color2   : couleur alternée                      (= color)
   *   amp      : amplitude de l'ondulation                (0.30)
   *   speed    : vitesse                                  (1.4)
   *   rise     : le corps monte au lieu de rester à plat     (0)
   *   x, y, z
   * }
   * Coût : segments meshes (9 par défaut, 14 au maximum).
   *
   * Sert : Abyssalor, Zéphyrion, Sablion, la queue de Maréa, Nébulon.
   */
  function serpentBody(len, color, opts) {
    const o = opts || {};
    const L = Math.max(0.2, num(len, 1.6));
    const col = color || '#2f7fb8';
    const col2 = o.color2 || col;
    const cnt = clampi(num(o.segments, 9), 2, 14);
    const r0 = num(o.r, L * 0.16);
    const taper = clampf(num(o.taper, 0.75), 0, 0.95);
    const step = L / cnt;

    const root = new THREE.Group();
    const segs = [];
    let parent = root;

    for (let i = 0; i < cnt; i++) {
      const u = i / (cnt - 1 || 1);
      const rr = r0 * (1 - u * taper);
      const seg = new THREE.Group();
      seg.position.z = (i === 0) ? -step * 0.5 : -step;
      seg.rotation.x = num(o.rise, 0) * 0.2;

      const mtl = solidMat((i % 2) ? col2 : col, { rough: 0.55, emissiveIntensity: 0.10 });
      const m = ell(rr, rr * 0.9, step * 0.72, mtl, 0, 0, 0, 12);
      solid(m);
      seg.add(m);
      if (o.belly && i % 2 === 0) {
        const b = ell(rr * 0.62, rr * 0.30, step * 0.55,
          solidMat(o.belly, { rough: 0.8, emissiveIntensity: 0.05 }), 0, -rr * 0.62, 0, 10);
        seg.add(b);
      }
      parent.add(seg);
      parent = seg;
      segs.push(seg);
    }

    root.userData.ll = {
      kind: 'plume', ph: phase(), segs: segs,
      amp: num(o.amp, 0.30), sp: num(o.speed, 1.4), droop: num(o.rise, 0) * 0.2,
    };
    root.userData.segments = segs;
    return place(root, o);
  }

  // ===========================================================================
  //  BONUS 2. plateShell(r, color, opts) — carapace-plateau à dalles
  // ===========================================================================
  /**
   * Ancrage : pivot à la BASE de la carapace (origine), le dôme monte vers +y.
   * opts = {
   *   plates    : nombre de dalles              (6, plafonné à 8)
   *   h         : hauteur du dôme                   (0.55 × r)
   *   plateColor: couleur des dalles                (= color éclairci)
   *   rim       : true -> bourrelet au bord              (true)
   *   spikes    : true -> pointes sur les dalles        (false)
   *   x, y, z
   * }
   * Coût : 1 dôme + plates (+1 bourrelet) -> 8 par défaut, 10 au maximum.
   *
   * Sert : Géomastre (carapace-plateau, on doit pouvoir y poser une forêt),
   * Chronoss (le cadran se pose dessus), Banquisor (dos en banquise).
   */
  function plateShell(r, color, opts) {
    const o = opts || {};
    const rr = Math.max(0.1, num(r, 0.7));
    const h = num(o.h, rr * 0.55);
    const col = color || '#7a5c3a';
    const g = new THREE.Group();

    const dome = ell(rr, h, rr, solidMat(col, { rough: 0.9, flat: !!o.flat, emissiveIntensity: 0.04 }), 0, 0, 0, 14);
    solid(dome);
    g.add(dome);

    if (o.rim !== false) {
      const rim = ring(rr * 0.98, rr * 0.09, solidMat(o.plateColor || col, { rough: 0.9, emissiveIntensity: 0.04 }), h * 0.06);
      solid(rim);
      g.add(rim);
    }

    const n = clampi(num(o.plates, 6), 1, 8);
    const pMat = solidMat(o.plateColor || '#8a9199', { rough: 0.85, flat: true, emissiveIntensity: 0.04 });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const dist = rr * 0.52;
      const ph = h * 0.72;
      // Dalle hexagonale posée à plat, légèrement inclinée vers l'extérieur.
      const p = put(R3.geo.cyl(rr * 0.30, rr * 0.34, h * 0.22, 6), pMat,
        Math.cos(a) * dist, ph, Math.sin(a) * dist);
      p.rotation.z = -Math.cos(a) * 0.28;
      p.rotation.x = Math.sin(a) * 0.28;
      solid(p);
      g.add(p);
      if (o.spikes) {
        const s = put(R3.geo.cone(rr * 0.10, h * 0.55, 6), pMat,
          Math.cos(a) * dist, ph + h * 0.34, Math.sin(a) * dist);
        s.rotation.z = -Math.cos(a) * 0.28;
        s.rotation.x = Math.sin(a) * 0.28;
        solid(s);
        g.add(s);
      }
    }
    return place(g, o);
  }

  // ===========================================================================
  //  BONUS 3. clockFace(r, color, opts) — cadran d'horloge à aiguilles
  // ===========================================================================
  /**
   * Ancrage : centre du cadran à l'origine, face vers +z (`plane:'flat'` le
   * couche à l'horizontale, pour le poser sur une carapace).
   * opts = {
   *   rimColor  : couleur du cercle                ('#c8a06a')
   *   handColor : couleur des aiguilles            ('#ffe066')
   *   marks     : nombre de repères                     (4, max 12)
   *   speed     : tours de la grande aiguille par seconde (0.35)
   *   plane     : 'face' | 'flat'                     ('face')
   *   x, y, z
   * }
   * Coût : cadran + cercle + marks + 2 aiguilles -> 8 par défaut.
   *
   * Sert : Chronoss, Éternia, et tout effet « Temps ».
   */
  function clockFace(r, color, opts) {
    const o = opts || {};
    const rr = Math.max(0.06, num(r, 0.4));
    const col = color || '#d896ff';
    const g = new THREE.Group();

    const face = put(R3.geo.cyl(rr, rr, rr * 0.10, 24),
      glowMat(col, 0.55, { emissiveIntensity: 0.75 }), 0, 0, 0);
    face.rotation.x = Math.PI / 2;      // cylindre couché -> disque dans le plan XY
    g.add(face);

    const rim = put(R3.geo.torus(rr * 1.02, rr * 0.10, 22),
      solidMat(o.rimColor || '#c8a06a', { rough: 0.5, metal: 0.3, emissiveIntensity: 0.1 }), 0, 0, 0);
    solid(rim);
    g.add(rim);

    const nM = clampi(num(o.marks, 4), 0, 12);
    const mMat = glowMat(o.handColor || '#ffe066', 0.9, { emissiveIntensity: 1.2, side: THREE.FrontSide });
    for (let i = 0; i < nM; i++) {
      const a = (i / nM) * Math.PI * 2 + Math.PI / 2;
      const m = put(R3.geo.box(rr * 0.09, rr * 0.22, rr * 0.06), mMat,
        Math.cos(a) * rr * 0.78, Math.sin(a) * rr * 0.78, rr * 0.08);
      m.rotation.z = a - Math.PI / 2;
      g.add(m);
    }

    // Aiguilles : le pivot est au centre, l'aiguille pousse vers +y.
    function hand(l, w) {
      const p = new THREE.Group();
      p.add(put(R3.geo.box(w, l, rr * 0.05), mMat, 0, l * 0.42, rr * 0.10));
      return p;
    }
    const big = hand(rr * 0.80, rr * 0.07);
    const small = hand(rr * 0.52, rr * 0.10);
    g.add(big, small);

    if (o.plane === 'flat') g.rotation.x = -Math.PI / 2;
    g.userData.ll = { kind: 'clock', ph: phase(), big: big, small: small, sp: num(o.speed, 0.35) };
    return place(g, o);
  }

  // ===========================================================================
  //  BONUS 4. mistPuff(color, r, n, opts) — volutes de brume / fumée
  // ===========================================================================
  /**
   * Ancrage : centre du nuage à l'origine.
   * opts = {
   *   opacity : 0..1                                     (0.30)
   *   ry      : aplatissement vertical                   (0.55)
   *   speed   : vitesse de la dérive                     (0.55)
   *   rise    : hauteur du flottement                (0.18 × r)
   *   color2  : seconde teinte                        (= color)
   *   x, y, z
   * }
   * Coût : n meshes (5 par défaut, 10 au maximum).
   *
   * Sert : la fumée aux pattes de Nyxaroth, la queue vaporeuse de Pénombra,
   * le corps d'Orageon, le voile de gaz de Nébulon, l'écume d'Ondinaë.
   */
  function mistPuff(color, r, n, opts) {
    const o = opts || {};
    const col = color || '#94b0c2';
    const col2 = o.color2 || col;
    const rr = Math.max(0.05, num(r, 0.4));
    const cnt = clampi(num(n, 5), 1, 10);
    const ry = num(o.ry, 0.55);
    const g = new THREE.Group();
    const puffs = [];
    const mA = glowMat(col, num(o.opacity, 0.30), { emissiveIntensity: 0.35 });
    const mB = glowMat(col2, num(o.opacity, 0.30) * 0.8, { emissiveIntensity: 0.35 });

    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2 + 0.6;
      const dist = rr * (0.35 + (i % 3) * 0.22);
      const sz = rr * (0.55 - (i % 3) * 0.09);
      const m = ell(sz, sz * ry, sz, (i % 2) ? mB : mA,
        Math.cos(a) * dist, (i % 2 ? 0.12 : -0.08) * rr, Math.sin(a) * dist, 10);
      m.renderOrder = 2;
      g.add(m);
      puffs.push({ m: m, a: a, dist: dist, y0: m.position.y, ph: phase() });
    }
    g.userData.ll = {
      kind: 'mist', ph: phase(), puffs: puffs,
      sp: num(o.speed, 0.55), rise: num(o.rise, rr * 0.18),
    };
    return place(g, o);
  }

  // ===========================================================================
  //  BONUS 5. bake(root, opts) — LA FUSION.  C'est elle qui tient le budget v3.
  // ===========================================================================
  /**
   * Le §9 de CONTRACT3 impose **25 draw calls par légendaire**. Dans three.js,
   * un mesh = un draw call : un dragon fait de 60 ellipsoïdes coûte 60 draw
   * calls, quel que soit le nombre de matériaux. Impossible de faire majestueux
   * à ce prix-là.
   *
   * `bake()` renverse le problème : on modélise librement (60 formes, c'est
   * confortable), puis on FUSIONNE tout ce qui ne bouge pas les unes par
   * rapport aux autres. Une seule géométrie par matériau, donc un seul draw
   * call par teinte. Un dragon de 60 formes en 4 teintes coûte 4 draw calls.
   *
   * La fusion se fait EN PLACE : `root` garde sa position, sa rotation et son
   * rôle dans `userData.anim` — on peut donc fusionner une aile et continuer de
   * la faire battre, fusionner une tête et continuer de la tourner.
   *
   * Ce qui SURVIT à la fusion :
   *   - tout objet portant `userData.llKeep = true` (et sa descendance) ;
   *   - les THREE.Points / Line / Sprite (starfield, notamment).
   * Ils sont simplement re-parentés à `root` avec leur transformation composée.
   *
   * opts = { shadow: false -> le mesh fusionné ne projette plus d'ombre }
   *
   * PIÈGE À CONNAÎTRE : R3.mat() met en cache sur `couleur + JSON(options)`.
   * `{rough: 0.8}` et `{rough: 0.8, seg: 12}` sont DEUX matériaux, donc DEUX
   * draw calls après fusion, alors que `seg` ne concerne que la géométrie.
   * Dans un groupe à fusionner : une teinte, un seul jeu d'options, jamais de
   * `seg`. C'est la seule discipline que la fusion demande.
   */
  function mergeGeos(list) {
    const parts = [];
    let vCount = 0, iCount = 0, hasUV = true;
    for (let i = 0; i < list.length; i++) {
      const src = list[i].g;
      if (!src || !src.attributes || !src.attributes.position) continue;
      const g = src.clone();                 // jamais toucher la géométrie du cache R3
      g.applyMatrix4(list[i].m);             // transforme aussi les normales
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) hasUV = false;
      const n = g.attributes.position.count;
      vCount += n;
      iCount += g.index ? g.index.count : n;
      parts.push(g);
    }
    if (!parts.length || !vCount) return null;

    const pos = new Float32Array(vCount * 3);
    const nor = new Float32Array(vCount * 3);
    const uv = hasUV ? new Float32Array(vCount * 2) : null;
    // Au-delà de 65 535 sommets il faut des index 32 bits, sinon la moitié du
    // modèle se replie sur elle-même (bug très joli, très incompréhensible).
    const idx = (vCount > 65535) ? new Uint32Array(iCount) : new Uint16Array(iCount);
    let vo = 0, io = 0;

    for (let i = 0; i < parts.length; i++) {
      const g = parts[i];
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      if (uv) uv.set(g.attributes.uv.array, vo * 2);
      if (g.index) {
        const a = g.index.array;
        for (let k = 0; k < a.length; k++) idx[io + k] = a[k] + vo;
        io += a.length;
      } else {
        for (let k = 0; k < n; k++) idx[io + k] = k + vo;
        io += n;
      }
      vo += n;
      g.dispose();                            // le clone a fini son office
    }

    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    out.computeBoundingBox();
    return out;
  }

  function bake(root, opts) {
    const o = opts || {};
    if (!root || !root.isObject3D || !THREE.BufferGeometry) return root;
    try {
      root.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const order = [];                       // matériaux dans l'ordre rencontré
      const buckets = new Map();
      const kept = [];

      (function walk(node) {
        if (node !== root) {
          if (node.userData && node.userData.llKeep) {
            kept.push({ o: node, m: new THREE.Matrix4().multiplyMatrices(inv, node.matrixWorld) });
            return;
          }
          if (node.isPoints || node.isLine || node.isSprite) {
            kept.push({ o: node, m: new THREE.Matrix4().multiplyMatrices(inv, node.matrixWorld) });
            return;
          }
          if (node.isMesh && node.geometry && node.material && !Array.isArray(node.material)) {
            let b = buckets.get(node.material);
            if (!b) { b = { cast: false, recv: false, ro: 0, list: [] }; buckets.set(node.material, b); order.push(node.material); }
            b.list.push({ g: node.geometry, m: new THREE.Matrix4().multiplyMatrices(inv, node.matrixWorld) });
            b.cast = b.cast || node.castShadow;
            b.recv = b.recv || node.receiveShadow;
            if (node.renderOrder > b.ro) b.ro = node.renderOrder;
          }
        }
        const kids = node.children.slice();
        for (let i = 0; i < kids.length; i++) walk(kids[i]);
      })(root);

      if (!order.length && !kept.length) return root;

      while (root.children.length) root.remove(root.children[0]);

      for (let i = 0; i < order.length; i++) {
        const mtl = order[i];
        const b = buckets.get(mtl);
        const geom = mergeGeos(b.list);
        if (!geom) continue;
        const mesh = new THREE.Mesh(geom, mtl);
        mesh.castShadow = (o.shadow === false) ? false : b.cast;
        mesh.receiveShadow = (o.shadow === false) ? false : b.recv;
        mesh.renderOrder = b.ro;
        root.add(mesh);
      }
      for (let i = 0; i < kept.length; i++) {
        const k = kept[i];
        if (k.o.parent) k.o.parent.remove(k.o);
        k.m.decompose(k.o.position, k.o.quaternion, k.o.scale);
        root.add(k.o);
      }
      if (root.userData) delete root.userData._llNodes;   // la liste animée a changé
    } catch (e) {
      console.warn('[llib] bake a échoué (le modèle reste correct, juste plus cher) :', e);
    }
    return root;
  }

  /** Compte les draw calls d'un modèle : un mesh, un Points, un Line = un draw
   *  call. Sert à MESURER le budget du §9 plutôt qu'à l'estimer de tête. */
  function drawCalls(obj) {
    let n = 0;
    if (obj && obj.traverse) {
      obj.traverse(function (o) { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) n++; });
    }
    return n;
  }

  // ===========================================================================
  //  BONUS 6. nobleEyes(spread, y, z, r, opts) — les yeux nobles, fusionnés
  // ===========================================================================
  /**
   * Mêmes arguments et mêmes options que `bigEyes`, mais les deux yeux sont
   * FUSIONNÉS. `bigEyes` coûtait 6 à 8 draw calls — sur un budget de 25, c'était
   * un tiers du légendaire dépensé en deux billes. Ici :
   *
   *   par défaut   -> 3 draw calls : globes (+ sourcils), iris, reflets ;
   *   `lean: true` -> 2 draw calls : globes (+ sourcils) et iris seuls, le
   *                   reflet blanc étant fondu dans l'iris. C'est la version à
   *                   prendre quand le budget est serré ; à moins de deux
   *                   mètres on ne voit pas la différence.
   *
   * Les sourcils partagent le matériau des globes tant que `browColor` n'est pas
   * précisé — les préciser coûte 1 draw call de plus.
   * Les deux yeux clignent ensemble, ce qui est de toute façon ce que font les
   * yeux.
   *
   * `bigEyes` n'est PAS modifiée : les lots P2 et P3 codent contre elle.
   */
  function nobleEyes(spread, y, z, r, opts) {
    const o = opts || {};
    const sp = num(spread, 0.16);
    const rr = Math.max(0.02, num(r, 0.075));
    const iris = o.color || '#ffe066';
    const dark = o.dark || '#141824';
    const angry = clampf(num(o.angry, 0.6), 0, 1);
    const tilt = num(o.tilt, 0.18);
    const lean = !!o.lean;

    const g = new THREE.Group();
    const inner = new THREE.Group();          // c'est LUI qui cligne (scale.y)
    g.add(inner);

    const globeMat = R3.mat(dark, { rough: 0.35 });
    const irisMat = glowMat(iris, 0.95, { emissiveIntensity: 1.35, side: THREE.FrontSide });
    const hiMat = lean ? irisMat : R3.mat('#ffffff', { rough: 0.2, emissive: '#ffffff', emissiveIntensity: 0.5 });
    const browMat = o.browColor ? R3.mat(o.browColor, { rough: 0.35 }) : globeMat;

    [-1, 1].forEach(function (s) {
      const globe = ell(rr * 1.15, rr * 0.72, rr * 0.55, globeMat, s * sp, 0, 0, 12);
      globe.rotation.z = -s * tilt;
      inner.add(globe);
      const ir = ell(rr * 0.50, rr * 0.44, rr * 0.28, irisMat, s * sp, 0, rr * 0.34, 10);
      ir.renderOrder = 2;
      inner.add(ir);
      // Reflet : minuscule, mais c'est lui qui rend le regard vivant. En mode
      // `lean` il prend le matériau de l'iris et fusionne donc avec lui.
      const hi = put(R3.geo.sphere(rr * (lean ? 0.20 : 0.17), 8), hiMat,
        s * sp + s * rr * 0.22, rr * 0.20, rr * 0.46);
      hi.renderOrder = 2;
      inner.add(hi);
      if (o.brow !== false) {
        const br = ell(rr * 1.25, rr * 0.20, rr * 0.26, browMat, s * sp, rr * 0.62, rr * 0.12, 10);
        br.rotation.z = -s * (tilt + angry * 0.45);   // sourcil qui plonge = regard décidé
        inner.add(br);
      }
    });

    bake(inner);
    // Le décalage (y, z) est porté par le GROUPE et pas par la géométrie : le
    // clignement, qui écrase `inner` sur Y, reste centré sur la ligne des yeux.
    g.position.set(num(o.x, 0), num(o.y, 0) + num(y, 0.1), num(o.z, 0) + num(z, 0.28));
    g.userData.ll = { kind: 'blink', inner: inner, ph: phase() };
    g.userData.eyes = [inner];
    return g;
  }

  // ===========================================================================
  //  BONUS 7. crown(color, r, points, opts) — couronne de pointes flottante
  // ===========================================================================
  /**
   * Ancrage : centre de la couronne à l'origine, à poser au-dessus de la tête.
   * Elle tourne lentement et flotte : c'est l'attribut « royal » le moins cher
   * du catalogue, et celui qui se lit le mieux de loin.
   *
   * opts = {
   *   color2 : couleur des pointes courtes             (= color)
   *   band   : true -> bandeau annulaire                  (true)
   *   h      : hauteur des pointes                   (0.85 × r)
   *   gem    : true -> une gemme au bout de chaque pointe (false)
   *   speed  : rotation en rad/s                          (0.30)
   *   bob    : amplitude du flottement              (0.06 × r)
   *   tilt   : inclinaison de la couronne                    (0)
   *   bake   : false -> pas de fusion                     (true)
   *   x, y, z
   * }
   * Coût : 1 draw call, 2 si `color2` diffère de `color`.
   */
  function crown(color, r, points, opts) {
    const o = opts || {};
    const col = color || '#ffe066';
    const col2 = o.color2 || col;
    const rr = Math.max(0.05, num(r, 0.28));
    const n = clampi(num(points, 6), 3, 12);
    const h = num(o.h, rr * 0.85);

    const g = new THREE.Group();
    const spin = new THREE.Group();
    g.add(spin);

    const mA = solidMat(col, { flat: true, rough: 0.35, emissiveIntensity: 0.75 });
    const mB = (col2 === col) ? mA : solidMat(col2, { flat: true, rough: 0.32, emissiveIntensity: 0.95 });

    if (o.band !== false) {
      const b = put(R3.geo.torus(rr, rr * 0.09, 18), mA, 0, 0, 0);
      b.rotation.x = -Math.PI / 2;
      solid(b);
      spin.add(b);
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      // Pointes hautes et basses en alternance : une couronne toute régulière
      // fait « roue dentée », l'alternance fait « couronne ».
      const hh = h * ((i % 2) ? 0.58 : 1);
      const c = put(R3.geo.cone(rr * 0.16, hh, 4), (i % 2) ? mB : mA,
        Math.cos(a) * rr, hh * 0.5, Math.sin(a) * rr);
      c.rotation.z = -Math.cos(a) * 0.13;
      c.rotation.x = Math.sin(a) * 0.13;
      solid(c);
      spin.add(c);
      if (o.gem) {
        spin.add(put(R3.geo.sphere(rr * 0.11, 8), mB,
          Math.cos(a) * rr, hh + rr * 0.08, Math.sin(a) * rr));
      }
    }

    if (o.bake !== false) bake(spin);
    g.rotation.x = num(o.tilt, 0);
    g.userData.ll = { kind: 'spin', spin: spin, ph: phase(), sp: num(o.speed, 0.30), bob: num(o.bob, rr * 0.06) };
    return place(g, o);
  }

  // ===========================================================================
  //  BONUS 8. runeBand(color, r, n, opts) — ceinture de runes qui tourne
  // ===========================================================================
  /**
   * Ancrage : centre de l'anneau à l'origine ; les runes se dressent dans le
   * plan horizontal et tournent autour de la créature.
   *
   * opts = {
   *   color2 : couleur de la gravure                   (= color)
   *   size   : hauteur d'une rune                  (0.22 × r)
   *   tilt   : inclinaison de l'anneau                      (0)
   *   speed  : rotation en rad/s (négatif = sens inverse) (-0.28)
   *   guide  : true -> fin anneau lumineux                (false)
   *   bake   : false -> pas de fusion                      (true)
   *   x, y, z
   * }
   * Coût : 1 draw call, 2 si `color2` diffère, 3 avec le guide.
   */
  function runeBand(color, r, n, opts) {
    const o = opts || {};
    const col = color || '#ffe066';
    const col2 = o.color2 || col;
    const rr = Math.max(0.08, num(r, 0.6));
    const cnt = clampi(num(n, 6), 1, 12);
    const s = num(o.size, rr * 0.22);

    const g = new THREE.Group();
    const spin = new THREE.Group();
    g.add(spin);

    const mA = glowMat(col, 0.80, { emissiveIntensity: 1.15, side: THREE.FrontSide });
    const mB = (col2 === col) ? mA : glowMat(col2, 0.92, { emissiveIntensity: 1.4, side: THREE.FrontSide });

    if (o.guide) {
      const gd = ring(rr, Math.max(0.006, rr * 0.020), glowMat(col, 0.30, { emissiveIntensity: 1.0 }), 0);
      gd.renderOrder = 2;
      spin.add(gd);
    }
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      const p = new THREE.Group();
      p.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      p.rotation.y = -a;                       // la face gravée regarde dehors
      const dalle = put(R3.geo.box(s * 0.10, s, s * 0.70), mA, 0, 0, 0);
      // Deux barres croisées suffisent à faire lire « signe gravé ».
      const t1 = put(R3.geo.box(s * 0.14, s * 0.58, s * 0.15), mB, s * 0.07, s * 0.12, 0);
      const t2 = put(R3.geo.box(s * 0.14, s * 0.15, s * 0.44), mB, s * 0.07, -s * 0.18, 0);
      dalle.renderOrder = 2; t1.renderOrder = 3; t2.renderOrder = 3;
      p.add(dalle, t1, t2);
      spin.add(p);
    }

    if (o.bake !== false) bake(spin);
    g.rotation.x = num(o.tilt, 0);
    g.userData.ll = { kind: 'spin', spin: spin, ph: phase(), sp: num(o.speed, -0.28), bob: num(o.bob, 0) };
    return place(g, o);
  }

  // ===========================================================================
  //  BONUS 9. arcRings(color, r, n, opts) — anneaux inclinés en orbite
  // ===========================================================================
  /**
   * Ancrage : centre des anneaux à l'origine. Chaque anneau a sa propre
   * inclinaison et tourne dans son sens : c'est la signature « Horizons » la
   * plus reconnaissable, et elle ne coûte qu'un draw call par anneau.
   *
   * opts = { color2, tube (0.035), y0 (0), x, y, z }
   * Coût : n draw calls (2 par défaut, 4 au maximum).
   */
  function arcRings(color, r, n, opts) {
    const o = opts || {};
    const col = color || '#a8e6ff';
    const col2 = o.color2 || col;
    const rr = Math.max(0.1, num(r, 0.9));
    const cnt = clampi(num(n, 2), 1, 4);

    const g = new THREE.Group();
    const rings = [];
    const tilts = [0.55, -0.72, 1.15, -0.20];
    for (let i = 0; i < cnt; i++) {
      const spin = new THREE.Group();
      const R = rr * (1 + i * 0.17);
      const m = ring(R, Math.max(0.010, rr * num(o.tube, 0.035)),
        glowMat((i % 2) ? col2 : col, clampf(0.55 - i * 0.08, 0.1, 1), { emissiveIntensity: 1.15 }), 0);
      m.renderOrder = 2;
      const tilt = -Math.PI / 2 + tilts[i % 4];
      m.rotation.x = tilt;
      spin.position.y = num(o.y0, 0) + (i - (cnt - 1) * 0.5) * rr * 0.20;
      spin.add(m);
      g.add(spin);
      rings.push({ spin: spin, mesh: m, tilt: tilt, sp: (i % 2 ? -0.62 : 0.48), ph: phase() });
    }
    g.userData.ll = { kind: 'arcs', rings: rings, ph: phase() };
    return place(g, o);
  }

  // ===========================================================================
  //  BONUS 10. crestFin(len, color, n, opts) — crête dorsale de lames
  // ===========================================================================
  /**
   * Ancrage : pivot à la BASE (origine) ; la crête court vers -z, donc le long
   * du DOS d'une créature qui regarde +z. Les lames sont plus hautes au milieu.
   *
   * opts = { h (0.34 × len), opacity (1), bake (true), x, y, z }
   * Coût : 1 draw call.
   */
  function crestFin(len, color, n, opts) {
    const o = opts || {};
    const L = Math.max(0.1, num(len, 0.9));
    const col = color || '#73eff7';
    const cnt = clampi(num(n, 5), 1, 10);
    const h = num(o.h, L * 0.34);
    const opacity = clampf(num(o.opacity, 1), 0.1, 1);

    const g = new THREE.Group();
    const mtl = (opacity < 0.99)
      ? glowMat(col, opacity, { emissiveIntensity: 0.85 })
      : solidMat(col, { rough: 0.5, emissiveIntensity: 0.4, side: THREE.DoubleSide });

    for (let i = 0; i < cnt; i++) {
      const u = (i + 0.5) / cnt;
      const hh = h * (0.25 + Math.sin(u * Math.PI) * 1.05);
      const m = ell(Math.max(0.008, L * 0.022), hh * 0.5, L * (0.62 / cnt), mtl, 0, hh * 0.5, -u * L, 10);
      if (opacity >= 0.99) solid(m);
      g.add(m);
    }
    if (o.bake !== false) bake(g);
    return place(g, o);
  }

  // ===========================================================================
  //  BONUS 11. boltArc(len, color, opts) — éclair en zigzag
  // ===========================================================================
  /**
   * Ancrage : pivot à la BASE (origine), l'éclair monte vers +y en zigzaguant
   * dans le plan XY.
   *
   * opts = { segments (4), width (0.10 × len), zig (0.16 × len), bake (true) }
   * Coût : 1 draw call.
   */
  function boltArc(len, color, opts) {
    const o = opts || {};
    const L = Math.max(0.1, num(len, 0.7));
    const col = color || '#f1c40f';
    const cnt = clampi(num(o.segments, 4), 2, 8);
    const w = num(o.width, L * 0.10);
    const zig = num(o.zig, L * 0.16);
    const step = L / cnt;

    const g = new THREE.Group();
    const mtl = glowMat(col, 0.95, { emissiveIntensity: 1.45, side: THREE.FrontSide });
    let x = 0, y = 0;
    for (let i = 0; i < cnt; i++) {
      const dx = ((i % 2) ? -1 : 1) * zig;
      const m = put(R3.geo.box(w * (1 - i / (cnt * 1.7)), step * 1.15, w * 0.55), mtl,
        x + dx * 0.5, y + step * 0.5, 0);
      m.rotation.z = -Math.atan2(dx, step);   // la barre suit la diagonale
      m.renderOrder = 2;
      g.add(m);
      x += dx; y += step;
    }
    if (o.bake !== false) bake(g);
    return place(g, o);
  }

  // ===========================================================================
  //  BONUS 12. petalSkirt(color, n, r, opts) — corolle / robe de pétales
  // ===========================================================================
  /**
   * Ancrage : la taille (origine) ; les pétales retombent vers -y.
   * opts = { color2, drop (1.1 × r), flare (0.35), bake (true), x, y, z }
   * Coût : 1 draw call, 2 si `color2` diffère.
   */
  function petalSkirt(color, n, r, opts) {
    const o = opts || {};
    const col = color || '#ff6b9d';
    const col2 = o.color2 || col;
    const cnt = clampi(num(n, 8), 3, 14);
    const rr = Math.max(0.05, num(r, 0.40));
    const drop = num(o.drop, rr * 1.1);

    const g = new THREE.Group();
    const mA = solidMat(col, { rough: 0.55, side: THREE.DoubleSide, emissiveIntensity: 0.15 });
    const mB = (col2 === col) ? mA : solidMat(col2, { rough: 0.55, side: THREE.DoubleSide, emissiveIntensity: 0.15 });

    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      const p = new THREE.Group();
      p.rotation.y = -a;
      const pt = ell(rr * 0.46, drop * 0.52, Math.max(0.008, rr * 0.05), (i % 2) ? mB : mA,
        0, -drop * 0.40, rr * 0.60, 12);
      pt.rotation.x = -num(o.flare, 0.35);     // les pétales s'ouvrent vers le bas
      solid(pt);
      p.add(pt);
      g.add(p);
    }
    if (o.bake !== false) bake(g);
    return place(g, o);
  }

  // ===========================================================================
  //  BONUS 13. antler(len, color, opts) — ramure de branches
  // ===========================================================================
  /**
   * Ancrage : la base du merrain (origine), la ramure pousse vers +y.
   * opts = { side (+1 droite, -1 gauche), tipColor (bourgeons), bake (true) }
   * Coût : 1 draw call, 2 avec `tipColor`.
   */
  function antler(len, color, opts) {
    const o = opts || {};
    const L = Math.max(0.1, num(len, 0.5));
    const col = color || '#8b5a2b';
    const side = (num(o.side, 1) < 0) ? -1 : 1;

    const g = new THREE.Group();
    const mtl = solidMat(col, { rough: 0.9, emissiveIntensity: 0.04 });
    const tipMtl = o.tipColor ? solidMat(o.tipColor, { rough: 0.6, emissiveIntensity: 0.45 }) : null;

    const beam = put(R3.geo.cyl(L * 0.055, L * 0.090, L, 6), mtl, 0, L * 0.5, 0);
    beam.rotation.z = -side * 0.22;
    solid(beam);
    g.add(beam);

    // [hauteur d'attache, longueur, décalage z, écartement]
    const tines = [[0.28, 0.52, -0.06, 0.80], [0.54, 0.40, 0.10, 0.55], [0.76, 0.34, 0.00, 1.00]];
    for (let i = 0; i < tines.length; i++) {
      const t = tines[i];
      const bx = side * L * t[0] * 0.30;
      const by = L * t[0];
      const m = put(R3.geo.cyl(L * 0.028, L * 0.046, L * t[1], 5), mtl,
        bx + side * Math.sin(t[3]) * L * t[1] * 0.5,
        by + Math.cos(t[3]) * L * t[1] * 0.5, L * t[2]);
      m.rotation.z = -side * t[3];
      solid(m);
      g.add(m);
      if (tipMtl) {
        const b = ell(L * 0.085, L * 0.07, L * 0.05, tipMtl,
          bx + side * Math.sin(t[3]) * L * t[1],
          by + Math.cos(t[3]) * L * t[1], L * t[2], 8);
        solid(b);
        g.add(b);
      }
    }
    if (o.bake !== false) bake(g);
    return place(g, o);
  }

  // ===========================================================================
  //  BONUS 14. mane(color, r, n, opts) — crinière rayonnante
  // ===========================================================================
  /**
   * Ancrage : centre du disque à l'origine, la crinière rayonne dans le plan XY
   * (face à +z) — à poser derrière la tête d'un félin ou d'un oiseau.
   *
   * opts = { color2 (mèches vives), sweep (recul en -z), bake (true), x, y, z }
   * Coût : 1 draw call, 2 si `color2` diffère.
   */
  function mane(color, r, n, opts) {
    const o = opts || {};
    const col = color || '#f4a259';
    const col2 = o.color2 || col;
    const rr = Math.max(0.06, num(r, 0.42));
    const cnt = clampi(num(n, 10), 3, 16);

    const g = new THREE.Group();
    const mA = solidMat(col, { rough: 0.5, flat: true, emissiveIntensity: 0.5 });
    const mB = (col2 === col) ? mA : solidMat(col2, { rough: 0.4, flat: true, emissiveIntensity: 0.95 });

    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      // Mèches longues et courtes en alternance : une crinière régulière fait
      // « soleil de dessin animé », l'alternance fait « fourrure hérissée ».
      const l = rr * ((i % 2) ? 0.70 : 1.05);
      const d = rr * 0.55 + l * 0.42;
      const m = put(R3.geo.cone(rr * 0.17, l, 5), ((i % 3) === 1) ? mB : mA,
        Math.cos(a) * d, Math.sin(a) * d, -num(o.sweep, rr * 0.10));
      m.rotation.z = a - Math.PI / 2;          // la pointe part vers l'extérieur
      solid(m);
      g.add(m);
    }
    if (o.bake !== false) bake(g);
    return place(g, o);
  }

  // ===========================================================================
  //  animateAura(g, t) — anime TOUT ce que la bibliothèque a posé
  // ===========================================================================
  /**
   * À appeler une fois par frame dans l'idle du légendaire :
   *
   *     g.userData.anim.update = function (root, t) { LL.animateAura(root, t); };
   *
   * Aucun état externe : la liste des nœuds à animer est découverte au premier
   * appel par un parcours de l'arbre, puis rangée dans g.userData._llNodes.
   * Si l'on AJOUTE une primitive à un modèle déjà animé, appeler LL.refresh(g).
   *
   * Le parcours ne coûte rien après la première frame, et l'animation ne touche
   * que des transformations (scale / position / rotation) : jamais un matériau,
   * qui est partagé entre les 36.
   */
  const ANIM = Object.create(null);

  ANIM.aura = function (n, d, t) {
    const k = Math.sin(t * d.sp + d.ph);
    const it = d.it;
    // Deux coques en opposition de phase = illusion d'un halo qui s'allume.
    if (d.a) d.a.scale.setScalar(1 + k * 0.08 * it);
    if (d.b) d.b.scale.setScalar(1 - k * 0.06 * it);
    if (d.disc) { const s = 1 + k * 0.09 * it; d.disc.scale.set(s, 1, s); }
    if (d.col) {
      const s = 1 + k * 0.05 * it;
      d.col.scale.set(s, 1 + k * 0.03, s);
    }
    for (let i = 0; i < d.rings.length; i++) {
      const r = d.rings[i];
      r.spin.rotation.y = t * r.sp + r.ph;
      r.mesh.rotation.x = r.tilt + Math.sin(t * 0.55 + r.ph) * 0.20;
    }
    for (let i = 0; i < d.motes.length; i++) {
      const m = d.motes[i];
      const a = t * m.sp + m.ph;
      m.m.position.set(Math.cos(a) * m.rad, m.y + Math.sin(t * 1.7 + m.ph) * m.amp, Math.sin(a) * m.rad);
      const s = 0.75 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3.1 + m.ph));
      m.m.scale.setScalar(s);
    }
  };

  ANIM.orbit = function (n, d, t) {
    d.spin.rotation.y = t * d.sp + d.ph;
    for (let i = 0; i < d.frags.length; i++) {
      const f = d.frags[i];
      f.m.position.y = Math.sin(t * 1.3 + f.ph) * d.wob;
      f.m.rotation.y = t * 0.9 + f.ph;         // chaque éclat tourne sur lui-même
      f.m.rotation.x = Math.sin(t * 0.8 + f.ph) * 0.25;
    }
  };

  ANIM.halo = function (n, d, t) {
    d.spin.rotation.z = t * d.sp + d.ph;
    for (let i = 0; i < d.rays.length; i++) {
      const r = d.rays[i];
      r.m.scale.y = 1 + Math.sin(t * 2.2 + r.ph * 2) * 0.22;
    }
  };

  ANIM.ribbon = function (n, d, t) {
    for (let i = 0; i < d.segs.length; i++) {
      const s = d.segs[i];
      const w = t * d.sp - s.u * d.wl;
      // L'onde grandit vers la pointe : une écharpe est raide à l'attache.
      const k = d.amp * (0.25 + s.u * 0.95);
      s.m.position.x = Math.sin(w) * k;
      s.m.position.y = Math.cos(w * 0.7) * k * 0.45;
      s.m.rotation.z = Math.cos(w) * 0.45;
      s.m.rotation.y = Math.sin(w) * 0.30;
    }
  };

  ANIM.plume = function (n, d, t) {
    for (let i = 0; i < d.segs.length; i++) {
      const s = d.segs[i];
      // Retard croissant d'un maillon au suivant : c'est le fouetté.
      const w = t * d.sp - i * 0.55 + d.ph;
      s.rotation.y = Math.sin(w) * d.amp;
      s.rotation.x = d.droop + Math.cos(w * 0.8) * d.amp * 0.35;
    }
  };

  ANIM.star = function (n, d, t) {
    d.pts.rotation.y = t * d.sp + d.ph;
    d.pts.rotation.x = Math.sin(t * 0.11 + d.ph) * 0.12;
    const a = d.attr.array, b = d.base, p = d.phs;
    for (let i = 0; i < d.n; i++) {
      const k = 0.35 + 0.65 * Math.abs(Math.sin(t * d.tw + p[i]));
      a[i * 3] = b[i * 3] * k;
      a[i * 3 + 1] = b[i * 3 + 1] * k;
      a[i * 3 + 2] = b[i * 3 + 2] * k;
    }
    d.attr.needsUpdate = true;
  };

  ANIM.starFallback = function (n, d, t) {
    n.rotation.y = t * d.sp + d.ph;
    for (let i = 0; i < d.pts.length; i++) {
      d.pts[i].scale.setScalar(0.6 + 0.5 * Math.abs(Math.sin(t * 2.6 + i * 1.7 + d.ph)));
    }
  };

  ANIM.core = function (n, d, t) {
    const k = Math.sin(t * d.sp + d.ph);
    d.core.scale.setScalar(1 + k * 0.13);
    if (d.mid) d.mid.scale.setScalar(1 - k * 0.10);   // absentes si shells < 3
    if (d.out) d.out.scale.setScalar(1 + k * 0.07);
    for (let i = 0; i < d.spikes.length; i++) {
      d.spikes[i].scale.y = 1 + Math.sin(t * 3 + i * 1.1 + d.ph) * 0.30;
    }
  };

  ANIM.crystal = function (n, d, t) {
    if (d.glow) {
      const k = Math.sin(t * 1.6 + d.ph);
      d.glow.scale.setScalar(1 + k * 0.18);
    }
    // Frisson minéral : très léger, sinon les cristaux ont l'air en caoutchouc.
    for (let i = 0; i < d.shards.length; i++) {
      d.shards[i].position.y += 0;   // (position conservée)
      d.shards[i].scale.y = 1 + Math.sin(t * 1.1 + i * 0.9 + d.ph) * 0.035;
    }
  };

  ANIM.rune = function (n, d, t) {
    for (let i = 0; i < d.stones.length; i++) {
      const s = d.stones[i];
      s.p.position.y = s.y0 + Math.sin(t * 1.05 + s.ph) * d.amp;
      s.p.rotation.y += 0;                       // la rotation de pose est gardée
      s.p.rotation.z = Math.sin(t * 0.7 + s.ph) * 0.14;
      s.p.children[0].rotation.y = t * s.spin + s.ph;   // seul le bloc tourne
    }
  };

  ANIM.eyes = function (n, d, t) {
    // Clignement : une brève fermeture toutes les ~4,3 s, désynchronisée.
    const c = (t * 0.23 + d.ph * 0.16) % 1;
    const k = (c > 0.965) ? 1 - Math.abs(c - 0.9825) / 0.0175 : 0;
    const sy = 1 - k * 0.92;
    for (let i = 0; i < d.eyes.length; i++) d.eyes[i].scale.y = sy;
  };

  ANIM.wing = function (n, d, t) {
    // Frémissement des segments SEULEMENT : la racine de l'aile appartient à la
    // créature (userData.anim.wingL/wingR). Les deux mouvements s'additionnent.
    for (let i = 0; i < d.segs.length; i++) {
      d.segs[i].rotation.z = d.base[i] + Math.sin(t * d.sp - i * 0.5 + d.ph) * d.amp;
    }
  };

  ANIM.clock = function (n, d, t) {
    d.big.rotation.z = -t * d.sp * 6.2831853;
    d.small.rotation.z = -t * d.sp * 0.5236;     // 12× plus lent, comme une vraie
  };

  ANIM.mist = function (n, d, t) {
    for (let i = 0; i < d.puffs.length; i++) {
      const p = d.puffs[i];
      const a = p.a + t * d.sp * (i % 2 ? -0.6 : 1);
      p.m.position.x = Math.cos(a) * p.dist;
      p.m.position.z = Math.sin(a) * p.dist;
      p.m.position.y = p.y0 + Math.sin(t * 0.9 + p.ph) * d.rise;
      p.m.scale.setScalar(0.85 + 0.25 * Math.sin(t * 0.8 + p.ph));
    }
  };

  // --- Nouveaux mouvements de la vague v3 ------------------------------------

  /** Couronne / ceinture de runes : rotation lente + léger flottement. */
  ANIM.spin = function (n, d, t) {
    d.spin.rotation.y = t * d.sp + d.ph;
    if (d.bob) d.spin.position.y = Math.sin(t * 1.3 + d.ph) * d.bob;
  };

  /** Anneaux inclinés : chacun tourne dans son sens et gîte doucement. */
  ANIM.arcs = function (n, d, t) {
    for (let i = 0; i < d.rings.length; i++) {
      const r = d.rings[i];
      r.spin.rotation.y = t * r.sp + r.ph;
      r.mesh.rotation.x = r.tilt + Math.sin(t * 0.5 + r.ph) * 0.18;
    }
  };

  /** Clignement des yeux fusionnés : les deux paupières d'un seul coup. */
  ANIM.blink = function (n, d, t) {
    const c = (t * 0.23 + d.ph * 0.16) % 1;
    const k = (c > 0.965) ? 1 - Math.abs(c - 0.9825) / 0.0175 : 0;
    d.inner.scale.y = 1 - k * 0.92;
  };

  function collect(g) {
    const list = [];
    g.traverse(function (o) { if (o.userData && o.userData.ll) list.push(o); });
    g.userData._llNodes = list;
    return list;
  }

  function animateAura(g, t) {
    if (!g || !g.userData) return;
    const tt = (typeof t === 'number' && isFinite(t)) ? t : (R3.clock ? R3.clock.t : 0);
    let list = g.userData._llNodes;
    if (!list) list = collect(g);
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      const d = n.userData.ll;
      if (!d) continue;
      const f = ANIM[d.kind];
      if (f) { try { f(n, d, tt); } catch (e) { /* une animation ne casse jamais une frame */ } }
    }
  }

  /** À appeler si l'on ajoute des primitives à un modèle déjà animé. */
  function refresh(g) { if (g && g.userData) delete g.userData._llNodes; }

  // ===========================================================================
  //  autoAnimate(g) — brancher l'idle d'un légendaire sur le cycle de rendu
  // ===========================================================================
  /**
   * POURQUOI CETTE FONCTION EXISTE
   * ------------------------------
   * Sur la carte, `roamers3d` appelle bien `animateAura()` sur chaque créature.
   * Mais EN COMBAT, `battle3d` n'anime que sa PROPRE aura (`s.auraGroup`), pas
   * le modèle : les anneaux du légendaire se figeaient, ses cristaux ne
   * respiraient plus, et l'entrée en scène retombait à plat. Le lot Intégration
   * pourrait le corriger, mais on ne peut pas en dépendre — et surtout on n'a
   * pas le droit d'écrire dans `battle3d.js`.
   *
   * Le seul point d'accroche garanti à chaque frame, sans toucher au fichier de
   * personne, est `updateMatrixWorld()` : le moteur l'appelle sur toute la scène
   * juste avant de dessiner. On l'enveloppe, on anime, puis on laisse three.js
   * faire son travail habituel. Le garde `t !== last` évite de recalculer deux
   * fois dans la même frame quand `roamers3d` anime déjà de son côté.
   *
   * `g.userData.llIdle(t)`, s'il existe, porte l'idle propre à la créature
   * (lévitation, respiration, battement d'aile lent). Il est mis en sommeil
   * pendant une attaque, repérée par `g.userData.llAtk` que la créature pose
   * elle-même dans son `userData.attack`.
   */
  function autoAnimate(g) {
    if (!g || !g.isObject3D || g.userData._llAuto) return g;
    g.userData._llAuto = true;
    const proto = THREE.Object3D.prototype.updateMatrixWorld;
    let last = -1;
    g.updateMatrixWorld = function (force) {
      const t = (R3.clock && typeof R3.clock.t === 'number') ? R3.clock.t : 0;
      if (t !== last) {
        last = t;
        try {
          const u = this.userData;
          const enAttaque = (typeof u.llAtk === 'number') && (t - u.llAtk) < 0.10;
          if (u.llIdle && !enAttaque) u.llIdle(t);
          animateAura(this, t);
        } catch (e) { /* une animation ne casse jamais une frame */ }
      }
      proto.call(this, force);
    };
    return g;
  }

  // ===========================================================================
  //  Enregistrement — signature EXACTE du §13, plus les bonus.
  // ===========================================================================
  const api = {
    aura: guard('aura', aura),
    orbitRing: guard('orbitRing', orbitRing),
    crystalCluster: guard('crystalCluster', crystalCluster),
    majesticWing: guard('majesticWing', majesticWing),
    plumeTail: guard('plumeTail', plumeTail),
    halo: guard('halo', halo),
    runeStone: guard('runeStone', runeStone),
    flowRibbon: guard('flowRibbon', flowRibbon),
    starfield: guard('starfield', starfield),
    glowCore: guard('glowCore', glowCore),
    bigEyes: guard('bigEyes', bigEyes),
    animateAura: animateAura,
    // --- Bonus v2 (hors contrat, utilisables si présents) ---
    serpentBody: guard('serpentBody', serpentBody),
    plateShell: guard('plateShell', plateShell),
    clockFace: guard('clockFace', clockFace),
    mistPuff: guard('mistPuff', mistPuff),
    refresh: refresh,
    TYPE_COLOR: TYPE_COLOR,
    // --- Bonus v3 : le budget de 25 draw calls (CONTRACT3 §9) ---
    bake: bake,                 // volontairement pas sous `guard` : bake modifie
                                // `root` EN PLACE et le renvoie, il ne doit
                                // jamais être remplacé par un groupe vide.
    drawCalls: drawCalls,
    autoAnimate: autoAnimate,
    nobleEyes: guard('nobleEyes', nobleEyes),
    crown: guard('crown', crown),
    runeBand: guard('runeBand', runeBand),
    arcRings: guard('arcRings', arcRings),
    crestFin: guard('crestFin', crestFin),
    boltArc: guard('boltArc', boltArc),
    petalSkirt: guard('petalSkirt', petalSkirt),
    antler: guard('antler', antler),
    mane: guard('mane', mane),
  };

  R3.register('llib', api);
  // Raccourci de secours : si un lot cherche la bibliothèque avant l'appel à
  // R3.get('llib'), il la trouve aussi ici. (Le contrat, lui, dit R3.get.)
  R3.llib = api;
})();
