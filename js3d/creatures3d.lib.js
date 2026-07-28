// =============================================================================
//  creatures3d.lib.js — BIBLIOTHÈQUE DE PRIMITIVES PARTAGÉES DES CRÉATURES
// =============================================================================
//  S'enregistre sous R3.register('clib', {...}) et sert aux 4 lots
//  creatures3d.p1..p4.js. Chaque lot l'utilise SI elle est présente :
//
//      const CL = R3.get('clib');
//      const oreille = (CL && CL.ear) ? CL.ear({ h: 0.2, color: '#fff' }) : replis;
//
//  CONVENTIONS COMMUNES À TOUS LES HELPERS
//  ---------------------------------------
//   * Un seul argument : un objet d'options. Tout est facultatif, tout a une
//     valeur par défaut raisonnable. Aucun helper ne lève jamais d'exception.
//   * `x`, `y`, `z` positionnent le résultat (0 par défaut).
//   * La créature regarde vers +z, +y est le haut, 1 tuile = 1 unité.
//   * ANCRAGE : indiqué dans le commentaire de chaque helper. Deux familles —
//       « centré »   : l'origine est au centre de la forme (convention R3.*)
//       « pivot base »: l'origine est le point d'attache, la forme pousse vers
//                       +y (oreille, antenne, corne) ou vers +x / -z (aile,
//                       nageoire) — pratique pour animer par rotation.
//   * Tous les matériaux passent par R3.mat() : ils sont partagés, donc gratuits.
//
//  TYPE DE RETOUR (fixe, ne change jamais selon les options)
//  ---------------------------------------------------------
//   Mesh  : birdBeak, paw, horn
//   Group : bodyBlob, catHead, dragonWing, finTail, petalRing, antenna, ear,
//           bubbleTrail, flameTuft, mouthSmile
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // ---------------------------------------------------------------------------
  //  Utilitaires internes
  // ---------------------------------------------------------------------------

  /** Renvoie v si c'est un nombre valide, sinon la valeur par défaut d. */
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  /** Positionne un objet selon o.x / o.y / o.z puis le renvoie. */
  function place(obj, o) {
    obj.position.set(num(o.x, 0), num(o.y, 0), num(o.z, 0));
    return obj;
  }

  /** Options de matériau reprises telles quelles depuis o (flat, rough, etc.). */
  function matOpts(o, extra) {
    const m = {};
    if (o.flat) m.flat = true;
    if (o.rough !== undefined) m.rough = o.rough;
    if (o.metal !== undefined) m.metal = o.metal;
    if (o.seg !== undefined) m.seg = o.seg;
    if (extra) Object.assign(m, extra);
    return m;
  }

  /** Petit détail décoratif : ne projette pas d'ombre (économie + propreté). */
  function light(mesh) { mesh.castShadow = false; return mesh; }

  // ===========================================================================
  //  bodyBlob — LE CORPS. Ellipsoïde dodu, éventuellement avec ventre clair.
  // ===========================================================================
  /**
   * Ancrage : centré (le centre de l'ellipsoïde est à l'origine du Group).
   * o = {
   *   rx, ry, rz   : demi-dimensions              (0.30 / 0.28 / 0.30)
   *   color        : couleur du corps             ('#ffffff')
   *   belly        : true, ou directement une couleur -> ventre clair devant
   *   bellyColor   : couleur du ventre            ('#fff6e0')
   *   back         : true, ou une couleur -> dos plus foncé (petite cape)
   *   backColor
   *   flat, rough, seg, x, y, z
   * }
   * userData : { body, belly, back }
   */
  function bodyBlob(o) {
    o = o || {};
    const rx = num(o.rx, 0.30), ry = num(o.ry, 0.28), rz = num(o.rz, 0.30);
    const g = new THREE.Group();

    const body = R3.ellipsoid(rx, ry, rz, o.color || '#ffffff', 0, 0, 0, matOpts(o));
    g.add(body);
    g.userData.body = body;

    if (o.back) {
      const bc = (typeof o.back === 'string') ? o.back : (o.backColor || '#000000');
      const bk = R3.ellipsoid(rx * 0.92, ry * 0.80, rz * 0.82, bc,
        0, ry * 0.22, -rz * 0.18, matOpts(o));
      g.add(bk);
      g.userData.back = bk;
    }

    if (o.belly) {
      const bc = (typeof o.belly === 'string') ? o.belly : (o.bellyColor || '#fff6e0');
      const bl = R3.ellipsoid(rx * 0.68, ry * 0.66, rz * 0.68, bc,
        0, -ry * 0.16, rz * 0.40, { rough: 0.92 });
      g.add(light(bl));
      g.userData.belly = bl;
    }

    return place(g, o);
  }

  // ===========================================================================
  //  catHead — TÊTE RONDE de petit animal : crâne, museau, oreilles, visage.
  // ===========================================================================
  /**
   * Ancrage : centré sur le crâne. Le visage regarde +z.
   * o = {
   *   r            : rayon du crâne                    (0.26)
   *   color        : couleur du crâne                  ('#ffffff')
   *   muzzle       : true -> museau clair devant       (false)
   *   muzzleColor                                       ('#fff6e0')
   *   nose         : true -> petit nez (par défaut si museau)
   *   noseColor                                         ('#ff8fb8')
   *   ears         : false | 'pointy' | 'round'        ('pointy')
   *   earColor     : (couleur du crâne par défaut)
   *   earInner     : couleur intérieure d'oreille      ('#ffb3c9')
   *   earSize      : facteur de taille d'oreille       (1)
   *   eyes         : afficher les yeux                 (true)
   *   eyeSpread, eyeR, eyeY : réglages fins des yeux
   *   blush        : joues roses                       (true)
   *   smile        : sourire                           (true)
   *   flat, rough, x, y, z
   * }
   * userData : { skull, earL, earR, eyes, muzzle }
   */
  function catHead(o) {
    o = o || {};
    const r = num(o.r, 0.26);
    const color = o.color || '#ffffff';
    const g = new THREE.Group();

    // Crâne : très légèrement plus large que haut, c'est ce qui fait « bébé ».
    const skull = R3.ellipsoid(r * 1.04, r, r * 0.98, color, 0, 0, 0, matOpts(o));
    g.add(skull);
    g.userData.skull = skull;

    // Museau clair
    if (o.muzzle) {
      const mz = R3.ellipsoid(r * 0.50, r * 0.36, r * 0.40, o.muzzleColor || '#fff6e0',
        0, -r * 0.26, r * 0.74, { rough: 0.9 });
      g.add(light(mz));
      g.userData.muzzle = mz;
    }
    if (o.nose || (o.muzzle && o.nose !== false)) {
      g.add(light(R3.ellipsoid(r * 0.14, r * 0.10, r * 0.10, o.noseColor || '#ff8fb8',
        0, -r * 0.14, r * 0.98, { rough: 0.7 })));
    }

    // Oreilles (chacune est un Group dont le pivot est à la base : on peut les
    // faire frémir avec earL.rotation.x/z sans qu'elles se décrochent).
    const shape = (o.ears === undefined) ? 'pointy' : o.ears;
    if (shape) {
      const es = num(o.earSize, 1);
      [-1, 1].forEach(function (s) {
        const e = ear({
          h: r * 0.80 * es, w: r * 0.62 * es,
          color: o.earColor || color, innerColor: o.earInner || '#ffb3c9',
          shape: (shape === 'round') ? 'round' : 'pointy',
          flat: o.flat,
        });
        e.position.set(s * r * 0.62, r * 0.62, -r * 0.06);
        e.rotation.z = -s * 0.26;
        g.add(e);
        if (s < 0) g.userData.earL = e; else g.userData.earR = e;
      });
    }

    // Visage
    if (o.eyes !== false) {
      const ey = R3.eyes(num(o.eyeSpread, r * 0.46), num(o.eyeY, r * 0.10),
        r * 0.88, num(o.eyeR, r * 0.24));
      g.add(ey);
      g.userData.eyes = ey;
    }
    if (o.blush !== false) {
      g.add(R3.blush(r * 0.72, -r * 0.20, r * 0.66, r * 0.20));
    }
    if (o.smile !== false && !o.muzzle) {
      g.add(mouthSmile({ w: r * 0.30, depth: r * 0.11, r: r * 0.075, y: -r * 0.34, z: r * 0.92 }));
    }

    return place(g, o);
  }

  // ===========================================================================
  //  birdBeak — BEC conique pointant vers +z.
  // ===========================================================================
  /**
   * Ancrage : centré (le centre du cône est à l'origine ; le bec mesure `len`
   * de long, donc placer le mesh à `base + len/2` sur z).
   * o = { len (0.16), r (0.07), color ('#f1c40f'), flat, x, y, z }
   * -> THREE.Mesh
   */
  function birdBeak(o) {
    o = o || {};
    const len = num(o.len, 0.16), r = num(o.r, 0.07);
    const m = R3.cone(r, len, o.color || '#f1c40f', 0, 0, 0,
      matOpts(o, { seg: num(o.seg, 10) }));
    m.rotation.x = Math.PI / 2;   // la pointe du cône (+y) part vers +z
    return place(m, o);
  }

  // ===========================================================================
  //  dragonWing — AILE MEMBRANÉE (dragon, chauve-souris, fée).
  // ===========================================================================
  /**
   * Ancrage : pivot à l'épaule (origine). L'aile se déploie vers +x.
   * Pour l'aile gauche, passer side:-1 — le Group est retourné par une rotation
   * (jamais par une échelle négative, qui casserait l'éclairage).
   * o = {
   *   len (0.55), height (0.42),
   *   color        : couleur de la membrane   ('#c94f7c')
   *   boneColor    : couleur des os           (couleur assombrie par défaut)
   *   side         : +1 (droite) | -1 (gauche)
   *   opacity      : translucidité de la membrane (1 = opaque)
   *   x, y, z, flat
   * }
   * userData : { membrane, bones:[...] }
   */
  function dragonWing(o) {
    o = o || {};
    const len = num(o.len, 0.55), h = num(o.height, 0.42);
    const color = o.color || '#c94f7c';
    const bone = o.boneColor || '#8e3a5c';
    const thick = Math.max(0.012, len * 0.028);
    const g = new THREE.Group();
    const bones = [];

    const mOpt = { side: THREE.DoubleSide, rough: 0.7 };
    if (o.opacity !== undefined && o.opacity < 1) {
      mOpt.transparent = true; mOpt.opacity = o.opacity; mOpt.depthWrite = false;
    }
    if (o.flat) mOpt.flat = true;

    // Membrane principale : grand lobe légèrement remontant.
    const mem = R3.ellipsoid(len * 0.52, h * 0.50, thick, color,
      len * 0.48, -h * 0.10, 0, mOpt);
    mem.rotation.z = 0.16;
    g.add(light(mem));
    g.userData.membrane = mem;

    // Deux festons au bord de fuite : c'est ce qui fait « aile de dragon ».
    [[len * 0.34, -h * 0.42, len * 0.24], [len * 0.72, -h * 0.34, len * 0.20]]
      .forEach(function (p) {
        const lobe = R3.ellipsoid(p[2], h * 0.28, thick, color, p[0], p[1], 0, mOpt);
        g.add(light(lobe));
      });

    // Os : bras principal + deux doigts posés sur la membrane.
    const arm = R3.cyl(thick * 1.1, thick * 1.7, len * 0.92, bone,
      len * 0.44, h * 0.12, thick * 0.6, { rough: 0.6 });
    arm.rotation.z = -Math.PI / 2 + 0.20;
    g.add(arm); bones.push(arm);

    [[0.30, len * 0.72], [0.85, len * 0.56]].forEach(function (f) {
      const d = R3.cyl(thick * 0.7, thick * 1.1, f[1], bone,
        len * 0.52 + Math.sin(f[0]) * 0.02, -h * 0.06, thick * 0.6, { rough: 0.6 });
      d.rotation.z = -Math.PI / 2 - f[0];
      g.add(light(d)); bones.push(d);
    });
    g.userData.bones = bones;

    if (num(o.side, 1) < 0) g.rotation.y = Math.PI;  // aile gauche
    return place(g, o);
  }

  // ===========================================================================
  //  finTail — NAGEOIRE CAUDALE / queue de poisson, à deux lobes.
  // ===========================================================================
  /**
   * Ancrage : pivot à la base (origine), la nageoire s'étend vers -z
   * (donc derrière une créature qui regarde +z).
   * o = { len (0.28), height (0.30), color ('#41a6f6'), thick, spread (0.35),
   *       lobes (2), x, y, z, flat }
   * userData : { lobes:[...] }
   */
  function finTail(o) {
    o = o || {};
    const len = num(o.len, 0.28), h = num(o.height, 0.30);
    const color = o.color || '#41a6f6';
    const th = num(o.thick, Math.max(0.012, len * 0.06));
    const spread = num(o.spread, 0.35);
    const g = new THREE.Group();
    const lobes = [];
    const mOpt = { side: THREE.DoubleSide, rough: 0.75 };
    if (o.flat) mOpt.flat = true;

    // Attache charnue
    g.add(R3.ellipsoid(th * 2.2, h * 0.26, len * 0.22, color, 0, 0, -len * 0.14, mOpt));

    const n = Math.max(1, num(o.lobes, 2));
    for (let i = 0; i < n; i++) {
      // 2 lobes -> un en haut, un en bas ; 1 lobe -> centré.
      const s = (n === 1) ? 0 : (i === 0 ? 1 : -1);
      const lobe = R3.ellipsoid(th, h * 0.52, len * 0.60, color,
        0, s * h * 0.30, -len * 0.58, mOpt);
      lobe.rotation.x = -s * spread;
      g.add(light(lobe));
      lobes.push(lobe);
    }
    g.userData.lobes = lobes;
    return place(g, o);
  }

  // ===========================================================================
  //  petalRing — COURONNE DE PÉTALES (fleur, tournesol, collerette).
  // ===========================================================================
  /**
   * Ancrage : centre de la couronne à l'origine.
   * axis:'z' (défaut) -> la fleur regarde +z, pétales dans le plan XY.
   * axis:'y'          -> couronne à plat, pétales dans le plan XZ.
   * o = {
   *   count (5), r (0.20)        : distance centre -> centre du pétale
   *   petalLen (0.24), petalWid (0.17), thick (0.07)
   *   color ('#ffaad8'), tipColor : liseré au bout des pétales (facultatif)
   *   start : angle du premier pétale en radians (Math.PI/2 = vers le haut)
   *   x, y, z, flat
   * }
   * userData : { petals:[...] }
   */
  function petalRing(o) {
    o = o || {};
    const n = Math.max(3, Math.round(num(o.count, 5)));
    const r = num(o.r, 0.20);
    const pl = num(o.petalLen, 0.24), pw = num(o.petalWid, 0.17);
    const th = num(o.thick, 0.07);
    const color = o.color || '#ffaad8';
    const start = num(o.start, Math.PI / 2);
    const g = new THREE.Group();
    const petals = [];
    const mo = matOpts(o, { rough: 0.85 });

    for (let i = 0; i < n; i++) {
      const a = start + (i / n) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const p = new THREE.Group();
      p.position.set(ca * r, sa * r, 0);
      p.rotation.z = a;
      // Le pétale est un ellipsoïde allongé sur x (= vers l'extérieur).
      p.add(R3.ellipsoid(pl * 0.5, pw * 0.5, th * 0.5, color, 0, 0, 0, mo));
      if (o.tipColor) {
        p.add(light(R3.ellipsoid(pl * 0.20, pw * 0.34, th * 0.42, o.tipColor,
          pl * 0.33, 0, 0.004, mo)));
      }
      g.add(p);
      petals.push(p);
    }
    g.userData.petals = petals;
    if (o.axis === 'y') g.rotation.x = -Math.PI / 2;
    return place(g, o);
  }

  // ===========================================================================
  //  antenna — ANTENNE souple terminée par une boule (insecte, baudroie, fée).
  // ===========================================================================
  /**
   * Ancrage : pivot à la base (origine), pousse vers +y.
   * o = { len (0.24), color ('#3f3f5a'), ballColor ('#fde74c'), ballR (0.055),
   *       glow (true) : la boule est lumineuse, tilt (0) : inclinaison en z,
   *       x, y, z }
   * userData : { stalk, ball }
   */
  function antenna(o) {
    o = o || {};
    const len = num(o.len, 0.24);
    const bR = num(o.ballR, 0.055);
    const g = new THREE.Group();

    const stalk = R3.cyl(len * 0.035, len * 0.075, len, o.color || '#3f3f5a',
      0, len * 0.5, 0, { rough: 0.8, seg: 6 });
    g.add(stalk);

    const bcol = o.ballColor || '#fde74c';
    const bopt = (o.glow === false)
      ? { rough: 0.6 }
      : { emissive: bcol, emissiveIntensity: 0.75, rough: 0.4 };
    const ball = R3.sphere(bR, bcol, 0, len + bR * 0.55, 0, bopt);
    g.add(ball);

    g.userData.stalk = stalk;
    g.userData.ball = ball;
    g.rotation.z = num(o.tilt, 0);
    return place(g, o);
  }

  // ===========================================================================
  //  paw — PATTE / PIED arrondi (aussi bien une main qu'un petit sabot).
  // ===========================================================================
  /**
   * Ancrage : centré. La patte est aplatie et allongée vers +z.
   * o = { r (0.09), color ('#ffffff'), flat, rough, x, y, z }
   * -> THREE.Mesh
   */
  function paw(o) {
    o = o || {};
    const r = num(o.r, 0.09);
    return R3.ellipsoid(r, r * 0.66, r * 1.20, o.color || '#ffffff',
      num(o.x, 0), num(o.y, 0), num(o.z, 0), matOpts(o, { rough: num(o.rough, 0.88) }));
  }

  // ===========================================================================
  //  ear — OREILLE pointue ou ronde, avec intérieur coloré.
  // ===========================================================================
  /**
   * Ancrage : pivot à la base (origine), pousse vers +y. Le devant est en +z.
   * o = { h (0.20), w (0.16), color ('#ffffff'), innerColor ('#ffb3c9'),
   *       shape : 'pointy' | 'round'  ('pointy'), flat, x, y, z }
   * userData : { outer, inner }
   */
  function ear(o) {
    o = o || {};
    const h = num(o.h, 0.20), w = num(o.w, 0.16);
    const g = new THREE.Group();
    let outer, inner;

    if (o.shape === 'round') {
      outer = R3.ellipsoid(w * 0.5, h * 0.5, w * 0.28, o.color || '#ffffff',
        0, h * 0.5, 0, matOpts(o));
      inner = R3.ellipsoid(w * 0.28, h * 0.30, w * 0.16, o.innerColor || '#ffb3c9',
        0, h * 0.48, w * 0.18, { rough: 0.9 });
    } else {
      outer = R3.cone(w * 0.5, h, o.color || '#ffffff', 0, h * 0.5, 0,
        matOpts(o, { seg: 9 }));
      inner = R3.cone(w * 0.30, h * 0.66, o.innerColor || '#ffb3c9',
        0, h * 0.42, w * 0.16, { rough: 0.9, seg: 9 });
    }
    g.add(outer, light(inner));
    g.userData.outer = outer;
    g.userData.inner = inner;
    return place(g, o);
  }

  // ===========================================================================
  //  horn — CORNE / pointe (dragon, licorne, cristal).
  // ===========================================================================
  /**
   * Ancrage : centré (cône vertical de hauteur `len`, pointe vers +y ;
   * placer le mesh à `base + len/2`). `tilt` incline autour de x.
   * o = { len (0.18), r (0.05), color ('#fff0c8'), flat (true : minéral),
   *       tilt (0), x, y, z }
   * -> THREE.Mesh
   */
  function horn(o) {
    o = o || {};
    const len = num(o.len, 0.18), r = num(o.r, 0.05);
    const m = R3.cone(r, len, o.color || '#fff0c8', 0, 0, 0,
      { flat: (o.flat === undefined ? true : !!o.flat), rough: num(o.rough, 0.55), seg: num(o.seg, 8) });
    m.rotation.x = num(o.tilt, 0);
    return place(m, o);
  }

  // ===========================================================================
  //  bubbleTrail — CHAPELET DE BULLES translucides qui s'élèvent.
  // ===========================================================================
  /**
   * Ancrage : première bulle à l'origine, les suivantes montent vers +y
   * (ou vers +z si dir:'forward', pour un jet d'eau).
   * o = { count (5), r (0.05), len (0.4), spread (0.08),
   *       color ('#a8e8ff'), dir ('up' | 'forward'), x, y, z }
   * userData : { bubbles:[...] }  <- à animer soi-même dans userData.attack
   */
  function bubbleTrail(o) {
    o = o || {};
    const n = Math.max(1, Math.round(num(o.count, 5)));
    const r = num(o.r, 0.05), len = num(o.len, 0.4);
    const spread = num(o.spread, 0.08);
    const color = o.color || '#a8e8ff';
    const forward = (o.dir === 'forward');
    const g = new THREE.Group();
    const bubbles = [];
    const mo = { transparent: true, opacity: 0.55, rough: 0.15, depthWrite: false };

    for (let i = 0; i < n; i++) {
      const u = (n === 1) ? 0 : i / (n - 1);
      const rr = r * (1 - u * 0.45);                    // les bulles s'amenuisent
      const side = Math.sin(u * 7.5) * spread;
      const b = R3.sphere(rr, color, side,
        forward ? side * 0.6 : u * len,
        forward ? u * len : side * 0.6, mo);
      light(b);
      b.receiveShadow = false;
      b.userData.u = u;                                 // repère pour animer
      g.add(b);
      bubbles.push(b);
    }
    g.userData.bubbles = bubbles;
    return place(g, o);
  }

  // ===========================================================================
  //  flameTuft — TOUFFE DE FLAMMES (souffle, crinière ardente, queue de feu).
  // ===========================================================================
  /**
   * Ancrage : pivot à la base (origine), les flammes montent vers +y.
   * o = { h (0.28), r (0.11), count (3), color ('#ff8c1a'),
   *       coreColor ('#ffe066'), x, y, z }
   * userData : { flames:[...], core }
   */
  function flameTuft(o) {
    o = o || {};
    const h = num(o.h, 0.28), r = num(o.r, 0.11);
    const n = Math.max(1, Math.round(num(o.count, 3)));
    const color = o.color || '#ff8c1a';
    const coreColor = o.coreColor || '#ffe066';
    const g = new THREE.Group();
    const flames = [];
    const mo = { emissive: color, emissiveIntensity: 0.55, rough: 0.45, seg: 9 };

    for (let i = 0; i < n; i++) {
      const u = (n === 1) ? 0 : (i / (n - 1)) * 2 - 1;  // -1 .. 1
      const fh = h * (1 - Math.abs(u) * 0.38);
      const f = R3.cone(r * (1 - Math.abs(u) * 0.30), fh, color,
        u * r * 0.85, fh * 0.5, -u * r * 0.25, mo);
      f.rotation.z = -u * 0.45;
      g.add(f);
      flames.push(f);
    }
    // Cœur clair : c'est lui qui donne l'impression de chaleur.
    const core = R3.cone(r * 0.48, h * 0.66, coreColor, 0, h * 0.34, r * 0.10,
      { emissive: coreColor, emissiveIntensity: 0.95, rough: 0.35, seg: 8 });
    g.add(light(core));
    g.userData.flames = flames;
    g.userData.core = core;
    return place(g, o);
  }

  // ===========================================================================
  //  mouthSmile — PETIT SOURIRE en arc (bonus, très utilisé par tous les lots).
  // ===========================================================================
  /**
   * Ancrage : centré sur le milieu de la bouche, face vers +z.
   * o = { w (0.10) demi-largeur, depth (0.035) creux du sourire,
   *       r (0.020) grosseur du trait, count (5), color ('#1a1c2c'),
   *       sad : true -> arc inversé, x, y, z }
   */
  function mouthSmile(o) {
    o = o || {};
    const w = num(o.w, 0.10), depth = num(o.depth, 0.035), r = num(o.r, 0.020);
    const n = Math.max(3, Math.round(num(o.count, 5)));
    const color = o.color || '#1a1c2c';
    const sign = o.sad ? -1 : 1;
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;                  // -1 .. 1
      const k = 1 - u * u;                              // 1 au milieu, 0 aux bouts
      const b = R3.sphere(r * (0.68 + 0.32 * k), color,
        u * w, -sign * k * depth, -Math.abs(u) * r * 0.5);
      light(b);
      b.receiveShadow = false;
      g.add(b);
    }
    return place(g, o);
  }

  // ---------------------------------------------------------------------------
  R3.register('clib', {
    bodyBlob: bodyBlob,
    catHead: catHead,
    birdBeak: birdBeak,
    dragonWing: dragonWing,
    finTail: finTail,
    petalRing: petalRing,
    antenna: antenna,
    paw: paw,
    ear: ear,
    horn: horn,
    bubbleTrail: bubbleTrail,
    flameTuft: flameTuft,
    // Bonus (hors contrat, utilisable si présent) :
    mouthSmile: mouthSmile,
  });
})();
