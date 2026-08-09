// =============================================================================
//  creatures3d.klib.js — PRIMITIVES DES CRÉATURES VENUES DU JEU DE CLÉLIA
// =============================================================================
//  Reprise telle quelle de `creatures3d.lib.js` de « L'aventure de Clélia »,
//  à un détail près : elle s'enregistre sous la clé **`kclib`**, pas `clib`.
//
//  POURQUOI DEUX BIBLIOTHÈQUES PLUTÔT QU'UNE FUSION. Les deux jeux ont une
//  `clib` née du même moule, mais qui a divergé : celle de Robin sait faire des
//  ailes de dragon, une corne et une houppe de flammes ; celle de Clélia sait
//  faire un bec d'oiseau, une aile de papillon, une aura et vingt autres pièces
//  — et ses `bodyBlob`, `catHead`, `ear`… ont dérivé de leur côté. Les fusionner
//  reviendrait à changer, sans le vouloir, l'allure des 26 créatures que Robin
//  connaît déjà. Chaque famille de modèles garde donc SA bibliothèque :
//  `creatures3d.p1..p5.js` lisent `clib`, `creatures3d.k1..k6.js` lisent
//  `kclib`, et personne ne déforme personne.
//
//  Chaque lot l'utilise SI elle est présente :
//
//      const CL = R3.get('kclib');
//      const oreille = (CL && CL.ear) ? CL.ear({ h: 0.24, color: '#f4f4f4' })
//                                     : R3.cone(0.08, 0.24, '#f4f4f4');
//
//  CONVENTIONS COMMUNES À TOUS LES HELPERS
//  ---------------------------------------
//   * Un seul argument : un objet d'options. Tout est facultatif, tout a une
//     valeur par défaut raisonnable — `CL.paw()` sans argument donne déjà une
//     jolie petite patte. Aucun helper ne lève jamais d'exception.
//   * `x`, `y`, `z` positionnent le résultat (0 par défaut).
//   * La créature regarde vers +z, +y est le haut, 1 tuile = 1 unité,
//     une créature fait environ 1 unité de haut.
//   * ANCRAGE : indiqué dans le commentaire de chaque helper. Trois familles —
//       « centré »     : l'origine est au centre de la forme (convention R3.*)
//       « pivot base » : l'origine est le point d'attache et la forme pousse
//                        vers +y (oreille, antenne, tige, feuille) — pratique
//                        pour animer par simple rotation du groupe.
//       « posé »       : le bas de la forme touche y = 0 (goutte d'eau).
//   * Tous les matériaux passent par R3.mat() (via R3.ellipsoid, R3.cone, …) :
//     ils sont partagés et donc gratuits. Jamais de `new THREE.Material` ici.
//   * Les petits détails décoratifs ne projettent pas d'ombre (économie).
//   * Style : LOW-POLY ARRONDI ET DOUX. Aucune forme anguleuse par défaut —
//     `flat: true` n'est proposé que pour les rares matières minérales.
//
//  TYPE DE RETOUR (fixe, ne change JAMAIS selon les options)
//  ---------------------------------------------------------
//   THREE.Mesh  : birdBeak, paw
//   THREE.Group : tous les autres
//
//  COÛT EN MESHES avec les options par défaut (budget du contrat : 40 par
//  créature) — de quoi doser un modèle sans le mesurer :
//   bodyBlob 1 (+1 ventre, +1 dos)   catHead 16 (crâne 1, oreilles 4, yeux 4,
//   joues 2, sourire 5)              birdBeak 1     finTail 3     petalRing 5
//   antenna 3     paw 1     ear 2     bubbleTrail 5     sparkleRing 6
//   leafBlade 4   tentacle 6   waterDrop 3   shellSpiral 10   mouthSmile 5
//   bigEyes 6     stem 2    eyeStalk 4   butterflyWing 5   featherWing 4
//   starBody 6    glowAura 2   cloudPuff 6   claw 4   acornCap 7   swanNeck 6
//  Pour alléger : `smile:false`, `blush:false`, `ears:false` sur catHead, et
//  des `count` plus petits sur les helpers répétitifs.
//
//  ANIMATION
//  ---------
//   Plusieurs helpers posent un `userData.animate(t)` : une petite fonction
//   d'animation autonome (t = R3.clock.t en secondes). Les lots peuvent
//   l'ignorer, ou la ranger dans `g.userData.anim.parts` et l'appeler.
//   `CL.tick(racine, t)` parcourt un modèle et appelle tous les `animate`
//   rencontrés.
//   ATTENTION : PERSONNE N'APPELLE `CL.tick` DANS LE JEU. Le jeu n'appelle que
//   R3.idleCreature() et userData.attack(). Pour qu'une créature vive vraiment,
//   elle se pilote elle-même :
//       CL.pilote(modeleRacine, function (t) { … });   // via onBeforeRender
//   et son `attack` déclare son état avec `CL.busy(racine, p)`, pour que le
//   pilote laisse la place au geste de joie. Voir le contrat v5 §13.
//
//  L'ÉCLAT  (contrat v5 §21)
//  -------------------------
//   La bibliothèque habille aussi les modèles des AUTRES lots : elle enveloppe
//   `R3.buildCreature` au chargement, et tout modèle construit reçoit
//     · une OMBRE DE CONTACT (deux disques plats) et un LISERÉ de silhouette,
//       pour avoir l'air posé sur l'herbe et non collé dessus ;
//     · pour deux ou trois espèces sur soixante-quinze, tirées de façon
//       DÉTERMINISTE, des couleurs décalées et un anneau d'étoiles : les
//       créatures BRILLANTES.
//   Pour forcer : `R3.buildCreature('pikachu', { shiny: true })`, ou
//   `CL.eclat(modele, { shiny: true, ombre: false })`. Réglages en tête de
//   l'IIFE, sous « RÉGLAGES DE L'ÉCLAT ».
//
//  BESTIAIRE VISÉ (17 créatures, aucune n'est agressive) :
//   feuillou, petalia, goutella, bullini, etincelo, meduzia, coralou, fluffly,
//   glanou, papillon, cygnik, lotira, lapinou, hibouche, etoilamer, crabilino,
//   nuagette.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  // ===========================================================================
  //  RÉGLAGES DE L'ÉCLAT — tout se règle ICI, et nulle part ailleurs.
  //  (contrat v5 §21. Trois essais avec Clélia et ces huit nombres bougeront.)
  // ===========================================================================

  //  --- La surprise : les créatures brillantes ---
  /**
   * Une espèce sur RARETE_BRILLANTE brille. 75 modèles / 26 ≈ 3 espèces : assez
   * rare pour que ce soit un événement, assez fréquent pour qu'une partie en
   * croise une. Baisser le nombre rend les brillantes plus courantes.
   */
  const RARETE_BRILLANTE = 26;
  /**
   * Le tirage est DÉTERMINISTE (voir `estBrillante`) : la même espèce brille
   * partout et toujours — dans le monde, en combat, dans la collection. C'est
   * volontaire : une brillante attrapée doit rester brillante, sinon la
   * surprise se change en déception. Changer ce grain de sel change le tirage.
   *
   * Le grain a été CHOISI, pas subi : celui-ci fait briller Fluffly, Miaouss et
   * Otaria. Les trois ont un LIEU GARANTI dans les données, vérifié :
   *   · Fluffly  — montagne, ville   (creatures3d.data.js, table des biomes)
   *   · Miaouss  — ville, parc, PLAINE (pokemon3d.data.js)
   *   · Otaria   — plage, mer, montagne
   * La plaine de Miaouss est tout près du départ : Clélia verra donc une
   * brillante sans avoir à traverser la carte, et les deux autres attendront
   * le voyage. Une rareté sans lieu garanti ne vaut rien (règle 5 du contrat).
   */
  const SEL_BRILLANTE = 'eclat-v5-32:';
  /** Rotation de teinte, en tours (0,42 ≈ 151° : jaune -> cyan, vert -> violet).
   *  Il faut que ça saute aux yeux d'un enfant de six ans, de loin. */
  const TEINTE_BRILLANTE = 0.42;
  const SATURATION_BRILLANTE = 1.30;   // couleurs plus franches
  const CLARTE_BRILLANTE = 1.10;       // à peine plus clair
  /**
   * Un gris n'a pas de teinte à faire tourner : sans traitement particulier,
   * un Otaria tout gris serait strictement identique en brillant — et une
   * variante qu'il faut deviner ne sert à rien. On lui DONNE donc une teinte,
   * la même pour tous les gris, douce pour rester crédible.
   */
  const SATURATION_MINI = 0.14;        // en dessous, c'est un gris
  const TEINTE_DES_GRIS = 0.79;        // lavande
  const SATURATION_DES_GRIS = 0.34;
  /** On assombrit un gris teinté : à 0,97 de clarté, une teinte ne se voit pas.
   *  C'est ce nombre qui fait la différence entre un Otaria blanc et un Otaria
   *  lavande — donc entre une variante invisible et une vraie surprise. */
  const CLARTE_DES_GRIS = 0.82;
  /** Les noirs (pupilles, contours, museaux) ne bougent jamais. */
  const CLARTE_MINI = 0.16;
  /** Les blancs FRANCS non plus — blanc de l'œil, reflets, fourrure blanche.
   *  « Franc » veut dire neutre : au-delà de SATURATION_DU_BLANC, un « blanc »
   *  est en réalité une couleur très pâle (le corps d'Otaria, #f6f6f8), et
   *  celui-là a le droit de changer. Sans cette nuance, une créature blanche
   *  n'aurait aucune version brillante visible. */
  const CLARTE_DU_BLANC = 0.94;
  const SATURATION_DU_BLANC = 0.06;
  /** Lueur propre ajoutée au corps d'une brillante : elle « scintille » même à
   *  l'ombre d'un arbre. Au-delà de 0,3 la créature devient une lampe. */
  const EMISSIF_BRILLANTE = 0.16;
  /** Étoiles qui tournent autour d'une brillante (0 pour les supprimer). */
  const ETINCELLES_BRILLANTE = 5;

  //  --- Ce qui pose une créature sur l'herbe : ombre de contact et liseré ---
  /** Deux disques sombres empilés : un large et pâle, un petit et net. C'est le
   *  dégradé du pauvre, et à distance de jeu il ne se distingue pas d'un vrai. */
  const OMBRE_COULEUR = '#171a2b';
  const OMBRE_OPACITE_LARGE = 0.15;
  const OMBRE_OPACITE_SERREE = 0.24;
  /** Nombre de pièces du modèle qui reçoivent un liseré, des plus grosses aux
   *  plus petites (0 = aucun liseré). 2 = le corps et la tête : le meilleur
   *  rapport contour / draw calls. */
  const LISERE_PIECES = 2;
  /** Épaisseur du liseré en unités monde (1 unité = 1 tuile). Un trait, pas un
   *  bord : à 0,016 sur une tête de 0,5 de diamètre, le contour devenait une
   *  capuche noire — vérifié en gros plan, c'est le premier réglage qu'il a
   *  fallu reprendre. */
  const LISERE_EPAISSEUR = 0.008;
  const LISERE_COULEUR = '#2a2340';

  // ===========================================================================
  //  Utilitaires internes (non exportés sauf mention)
  // ===========================================================================

  /** Renvoie v si c'est un nombre fini, sinon la valeur par défaut d. */
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  /** Renvoie un entier >= min. */
  function count(v, d, min) { return Math.max(min === undefined ? 1 : min, Math.round(num(v, d))); }

  /** Positionne un objet selon o.x / o.y / o.z puis le renvoie. */
  function place(obj, o) {
    obj.position.set(num(o.x, 0), num(o.y, 0), num(o.z, 0));
    return obj;
  }

  /** Options de matériau reprises telles quelles depuis o (flat, rough, seg…). */
  function matOpts(o, extra) {
    const m = {};
    if (o.flat) m.flat = true;
    if (o.rough !== undefined) m.rough = o.rough;
    if (o.metal !== undefined) m.metal = o.metal;
    if (o.seg !== undefined) m.seg = o.seg;
    if (o.opacity !== undefined && o.opacity < 1) {
      m.transparent = true; m.opacity = o.opacity;
    }
    if (o.emissive) { m.emissive = o.emissive; m.emissiveIntensity = num(o.emissiveIntensity, 0.7); }
    if (extra) Object.assign(m, extra);
    return m;
  }

  /** Petit détail décoratif : ni ombre portée, ni ombre reçue. */
  function light(mesh) { mesh.castShadow = false; mesh.receiveShadow = false; return mesh; }

  /** Matériau translucide « gelée / eau / bulle », en options pour R3.*. */
  function jelly(opacity, rough) {
    return {
      transparent: true,
      opacity: num(opacity, 0.6),
      rough: num(rough, 0.18),
      depthWrite: false,
      side: THREE.DoubleSide,
    };
  }

  /**
   * Chaîne de groupes emboîtés — le squelette souple des antennes, tiges,
   * tentacules et cous. joints[0] est à l'origine, joints[i+1] est à
   * `sign * segLen` sur y dans le repère de joints[i].
   * Faire tourner joints[i] fait suivre tout ce qui est au-dessus : c'est ce
   * qui donne des ondulations naturelles pour trois lignes de code.
   */
  function chain(n, segLen, sign) {
    const root = new THREE.Group();
    const joints = [];
    let parent = root;
    for (let i = 0; i < n; i++) {
      const j = new THREE.Group();
      if (i > 0) j.position.y = sign * segLen;
      parent.add(j);
      joints.push(j);
      parent = j;
    }
    return { root: root, joints: joints };
  }

  /**
   * Parcourt un modèle et appelle tous les userData.animate(t) rencontrés.
   * Exporté : CL.tick(groupeCreature, R3.clock.t).
   */
  function tick(root, t) {
    if (!root || !root.traverse) return;
    root.traverse(function (o) {
      const f = o.userData && o.userData.animate;
      if (typeof f === 'function') {
        try { f(t); } catch (e) { /* une animation ratée ne doit rien casser */ }
      }
    });
  }

  // ===========================================================================
  //  PILOTE — LE MOTEUR D'ANIMATION AUTONOME DES CRÉATURES        (contrat v5 §13.2)
  // ===========================================================================
  /**
   * Accroche une animation par image au modèle `g`, SANS dépendre d'aucun
   * appelant. C'est le point important : le jeu n'appelle que R3.idleCreature()
   * et userData.attack() ; personne n'appelle CL.tick(). Un modèle qui veut
   * vivre en permanence (bulles qui remontent, oreille qui frémit, queue qui
   * balance) doit donc se piloter lui-même, et le seul crochet disponible est
   * l'`onBeforeRender` d'un de ses meshes.
   *
   * Trois précautions, chacune payée par un bug réel :
   *   1. on se greffe sur le premier mesh OPAQUE — un mesh transparent peut
   *      être rendu dans un ordre imprévisible, voire pas du tout ;
   *   2. `frustumCulled = false` sur ce mesh, sinon l'animation s'arrête net
   *      dès que la créature sort du champ et reprend dans une pose absurde ;
   *   3. garde sur le temps : le rendu passe deux fois par image (passe
   *      d'ombre + passe couleur) et l'animation serait jouée en double.
   *
   * Replis sans exception (contrat v5 §13.4) : `fn` est appelée dans un
   * try/catch ; au DEUXIÈME échec on débranche cette animation-là seule, en
   * silence — le reste du modèle et la boucle de rendu continuent.
   *
   * @param g    le Group racine de la créature
   * @param fn   fn(t) — t en secondes (R3.clock.t)
   * @param opts { root : objet portant userData.busy (par défaut g)
   *               busy : false pour ignorer complètement la garde `busy` }
   * @return le mesh porteur, ou null si le modèle n'a aucun mesh.
   */
  function pilote(g, fn, opts) {
    try {
      if (!g || typeof g.traverse !== 'function' || typeof fn !== 'function') return null;
      opts = opts || {};
      let cible = null, secours = null;
      g.traverse(function (o) {
        if (!o.isMesh) return;
        if (!secours) secours = o;
        if (!cible && o.material && !o.material.transparent) cible = o;
      });
      cible = cible || secours;
      if (!cible) return null;
      cible.frustumCulled = false;
      // Pendant l'animation de joie, c'est `attack` qui commande : le pilote
      // se met en veille pour ne pas lui disputer les mêmes rotations.
      const veille = (opts.busy === false) ? null : (opts.root || g);
      let dernier = -1, ratés = 0;
      cible.onBeforeRender = function () {
        if (veille && veille.userData && veille.userData.busy) return;
        const t = (R3.clock && R3.clock.t) || 0;
        if (t === dernier) return;
        dernier = t;
        try { fn(t); }
        catch (e) {
          ratés++;
          if (ratés >= 2) cible.onBeforeRender = function () {};
        }
      };
      return cible;
    } catch (e) {
      return null;   // un pilote qu'on n'a pas pu poser ne casse jamais rien
    }
  }

  /**
   * Marque le modèle « occupé » pendant l'animation de joie.
   *
   * LE DÉFAUT HISTORIQUE (contrat v5 §13.1) : la version d'origine écrivait
   * `busy = (p < 1)`. Or battle3d.js:2606 rappelle `attack(modele, 0)` pour
   * remettre la pose au repos à la fin du geste — donc p = 0, donc busy restait
   * `true` pour le reste de la partie et le modèle ne bougeait plus jamais.
   * « Occupé » veut dire « une animation est EN COURS », pas « au repos ».
   */
  function busy(root, p) {
    if (root && root.userData) root.userData.busy = (p > 0 && p < 1);
  }

  // ===========================================================================
  //  1. bodyBlob — LE CORPS. Ellipsoïde dodu, ventre clair, dos plus foncé.
  //     Utilisé par : bullini, fluffly, lapinou, hibouche, cygnik, crabilino,
  //     glanou, nuagette (base), goutella…
  // ===========================================================================
  /**
   * Ancrage : centré (le centre de l'ellipsoïde est à l'origine du Group).
   * o = {
   *   rx, ry, rz   : demi-dimensions                     (0.30 / 0.28 / 0.30)
   *   color        : couleur du corps                    ('#ffffff')
   *   shade        : true, ou une couleur -> calotte plus foncée sur le dos
   *   shadeColor   : couleur de la calotte               ('#000000')
   *   belly        : true, ou une couleur -> ventre clair devant
   *   bellyColor                                          ('#fff0c8')
   *   squash       : aplatissement vertical supplémentaire (1 = aucun)
   *   flat, rough, seg, opacity, emissive, x, y, z
   * }
   * userData : { body, belly, shade }
   */
  function bodyBlob(o) {
    o = o || {};
    const sq = num(o.squash, 1);
    const rx = num(o.rx, 0.30), ry = num(o.ry, 0.28) * sq, rz = num(o.rz, 0.30);
    const g = new THREE.Group();

    const body = R3.ellipsoid(rx, ry, rz, o.color || '#ffffff', 0, 0, 0, matOpts(o));
    g.add(body);
    g.userData.body = body;

    // Calotte foncée sur le dos : donne du volume sans coûter de lumière.
    if (o.shade) {
      const sc = (typeof o.shade === 'string') ? o.shade : (o.shadeColor || '#000000');
      const sh = R3.ellipsoid(rx * 0.94, ry * 0.84, rz * 0.86, sc,
        0, ry * 0.20, -rz * 0.16, matOpts(o));
      g.add(sh);
      g.userData.shade = sh;
    }

    // Ventre clair devant : le petit détail qui rend une bestiole attachante.
    if (o.belly) {
      const bc = (typeof o.belly === 'string') ? o.belly : (o.bellyColor || '#fff0c8');
      const bl = R3.ellipsoid(rx * 0.70, ry * 0.68, rz * 0.70, bc,
        0, -ry * 0.16, rz * 0.38, { rough: 0.92 });
      g.add(light(bl));
      g.userData.belly = bl;
    }

    return place(g, o);
  }

  // ===========================================================================
  //  2. catHead — TÊTE RONDE de petit animal : crâne, museau, oreilles, visage.
  //     Utilisé par : lapinou, fluffly, hibouche, cygnik (petite tête), glanou.
  // ===========================================================================
  /**
   * Ancrage : centré sur le crâne. Le visage regarde +z.
   * o = {
   *   r            : rayon du crâne                       (0.26)
   *   color        : couleur du crâne                     ('#ffffff')
   *   muzzle       : true -> museau clair devant          (false)
   *   muzzleColor                                          ('#fff0c8')
   *   disc         : true -> disque facial clair (hibou)  (false)
   *   discColor                                            ('#d4a373')
   *   nose         : true -> petit nez (implicite si museau), false pour l'ôter
   *   noseColor                                            ('#ff6b9d')
   *   ears         : false | 'pointy' | 'round' | 'long' | 'tuft'   ('round')
   *   earColor     : couleur des oreilles     (couleur du crâne par défaut)
   *   earInner     : couleur intérieure                    ('#ffaad8')
   *   earSize      : facteur de taille                     (1)
   *   earSpread    : écartement des oreilles               (0.62 × r)
   *   eyes         : afficher les yeux                     (true)
   *   eyeStyle     : 'dot' (billes noires) | 'big' (grands yeux blancs) ('dot')
   *   eyeSpread, eyeR, eyeY : réglages fins
   *   blush        : joues roses                           (true)
   *   smile        : sourire                               (true)
   *   flat, rough, x, y, z
   * }
   * userData : { skull, earL, earR, eyes, muzzle, disc }
   */
  function catHead(o) {
    o = o || {};
    const r = num(o.r, 0.26);
    const color = o.color || '#ffffff';
    const g = new THREE.Group();

    // Crâne : très légèrement plus large que haut — c'est ce qui fait « bébé ».
    const skull = R3.ellipsoid(r * 1.05, r, r * 0.98, color, 0, 0, 0, matOpts(o));
    g.add(skull);
    g.userData.skull = skull;

    // Disque facial (hibou) : large galette claire posée sur l'avant du crâne.
    if (o.disc) {
      const dc = (typeof o.disc === 'string') ? o.disc : (o.discColor || '#d4a373');
      const d = R3.ellipsoid(r * 0.88, r * 0.78, r * 0.40, dc, 0, r * 0.02, r * 0.66,
        { rough: 0.95 });
      g.add(light(d));
      g.userData.disc = d;
    }

    // Museau clair
    if (o.muzzle) {
      const mz = R3.ellipsoid(r * 0.50, r * 0.36, r * 0.42, o.muzzleColor || '#fff0c8',
        0, -r * 0.26, r * 0.72, { rough: 0.92 });
      g.add(light(mz));
      g.userData.muzzle = mz;
    }
    if (o.nose || (o.muzzle && o.nose !== false)) {
      g.add(light(R3.ellipsoid(r * 0.15, r * 0.11, r * 0.11, o.noseColor || '#ff6b9d',
        0, -r * 0.14, r * 0.96, { rough: 0.7 })));
    }

    // Oreilles : chacune est un Group dont le pivot est à la base, on peut donc
    // les faire frémir avec earL.rotation.x/z sans qu'elles se décrochent.
    const shape = (o.ears === undefined) ? 'round' : o.ears;
    if (shape) {
      const es = num(o.earSize, 1);
      const spread = num(o.earSpread, r * 0.62);
      const lean = (shape === 'long') ? 0.10 : (shape === 'tuft' ? 0.42 : 0.26);
      [-1, 1].forEach(function (s) {
        const e = ear({
          h: r * (shape === 'long' ? 1.7 : 0.82) * es,
          w: r * (shape === 'long' ? 0.44 : 0.64) * es,
          color: o.earColor || color,
          innerColor: o.earInner || '#ffaad8',
          shape: shape,
          flat: o.flat,
        });
        e.position.set(s * spread, r * 0.60, -r * 0.06);
        e.rotation.z = -s * lean;
        g.add(e);
        if (s < 0) g.userData.earL = e; else g.userData.earR = e;
      });
    }

    // Visage
    if (o.eyes !== false) {
      const ey = (o.eyeStyle === 'big')
        ? bigEyes({
            spread: num(o.eyeSpread, r * 0.52), r: num(o.eyeR, r * 0.42),
            y: num(o.eyeY, r * 0.10), z: r * 0.78,
          })
        : R3.eyes(num(o.eyeSpread, r * 0.46), num(o.eyeY, r * 0.10),
                  r * 0.88, num(o.eyeR, r * 0.24));
      g.add(ey);
      g.userData.eyes = ey;
    }
    if (o.blush !== false) {
      g.add(R3.blush(r * 0.74, -r * 0.20, r * 0.64, r * 0.20));
    }
    if (o.smile !== false && !o.muzzle) {
      g.add(mouthSmile({ w: r * 0.30, depth: r * 0.11, r: r * 0.075,
                         y: -r * 0.34, z: r * 0.92 }));
    }

    return place(g, o);
  }

  // ===========================================================================
  //  3. birdBeak — BEC pointant vers +z.
  //     Utilisé par : cygnik (bec orange large), hibouche (petit bec jaune).
  // ===========================================================================
  /**
   * Ancrage : centré (le centre du cône est à l'origine ; le bec mesure `len`
   * de long, donc le poser à `avantDuVisage + len/2` sur z).
   * o = {
   *   len   : longueur                       (0.16)
   *   r     : demi-largeur à la base         (0.07)
   *   color                                  ('#f1c40f')
   *   wide  : facteur d'élargissement latéral (1) — 1.6 pour un bec de cygne
   *   droop : aplatissement vertical          (1) — 0.6 pour un bec plat
   *   tilt  : inclinaison vers le bas en rad  (0)
   *   flat, rough, seg, x, y, z
   * }
   * -> THREE.Mesh
   */
  function birdBeak(o) {
    o = o || {};
    const len = num(o.len, 0.16), r = num(o.r, 0.07);
    const m = R3.cone(r, len, o.color || '#f1c40f', 0, 0, 0,
      matOpts(o, { seg: num(o.seg, 10), rough: num(o.rough, 0.68) }));
    // Le cône pointe vers +y : on le bascule pour qu'il pointe vers +z.
    m.rotation.x = Math.PI / 2 + num(o.tilt, 0);
    m.scale.set(num(o.wide, 1), 1, num(o.droop, 1));
    return place(m, o);
  }

  // ===========================================================================
  //  4. finTail — NAGEOIRE CAUDALE / queue, à deux lobes souples.
  //     Utilisé par : bullini, goutella, cygnik (queue relevée), meduzia.
  // ===========================================================================
  /**
   * Ancrage : pivot à la base (origine), la nageoire s'étend vers -z
   * (donc derrière une créature qui regarde +z).
   * o = {
   *   len (0.28)      : longueur vers l'arrière
   *   height (0.30)   : envergure verticale
   *   color ('#41a6f6')
   *   edgeColor       : liseré au bord des lobes (facultatif)
   *   thick           : demi-épaisseur          (len × 0.06)
   *   spread (0.35)   : écartement des lobes en radians
   *   lobes (2)       : 1 = nageoire simple, 2 = queue de poisson, 3 = éventail
   *   x, y, z, flat
   * }
   * userData : { lobes:[...], animate(t) }
   */
  function finTail(o) {
    o = o || {};
    const len = num(o.len, 0.28), h = num(o.height, 0.30);
    const color = o.color || '#41a6f6';
    const th = num(o.thick, Math.max(0.012, len * 0.06));
    const spread = num(o.spread, 0.35);
    const g = new THREE.Group();
    const lobes = [];
    const mOpt = matOpts(o, { side: THREE.DoubleSide, rough: num(o.rough, 0.72) });

    // Attache charnue : évite le raccord net entre le corps et la nageoire.
    g.add(R3.ellipsoid(th * 2.4, h * 0.26, len * 0.24, color, 0, 0, -len * 0.13, mOpt));

    const n = count(o.lobes, 2, 1);
    for (let i = 0; i < n; i++) {
      // 2 lobes -> un en haut, un en bas ; 1 lobe -> centré ; 3 -> éventail.
      const s = (n === 1) ? 0 : ((i / (n - 1)) * 2 - 1);
      const lobe = R3.ellipsoid(th, h * 0.52, len * 0.60, color,
        0, s * h * 0.30, -len * 0.58, mOpt);
      lobe.rotation.x = -s * spread;
      g.add(light(lobe));
      if (o.edgeColor) {
        g.add(light(R3.ellipsoid(th * 0.9, h * 0.16, len * 0.16, o.edgeColor,
          0, s * h * 0.50, -len * 0.92, mOpt)));
      }
      lobes.push(lobe);
    }
    g.userData.lobes = lobes;
    g.userData.animate = function (t) {
      g.rotation.y = Math.sin(t * 2.6) * 0.20;
    };
    return place(g, o);
  }

  // ===========================================================================
  //  5. petalRing — COURONNE DE PÉTALES.
  //     Utilisé par : petalia (5 pétales roses), lotira (3 couronnes empilées),
  //     nuagette (collerette dorée), etincelo (halo).
  // ===========================================================================
  /**
   * Ancrage : centre de la couronne à l'origine.
   *   axis:'z' (défaut) -> la fleur regarde +z, pétales dans le plan XY.
   *   axis:'y'          -> couronne à plat, pétales dans le plan XZ, `tilt`
   *                        les redresse vers le haut (fleur en coupe).
   * o = {
   *   count (5)        : nombre de pétales (minimum 3)
   *   r (0.20)         : distance centre -> centre du pétale
   *   petalLen (0.24), petalWid (0.17), thick (0.07)
   *   color ('#ffaad8')
   *   tipColor         : liseré plus vif au bout des pétales (facultatif)
   *   tilt (0)         : redressement de chaque pétale, en radians
   *   start            : angle du premier pétale (Math.PI/2 = vers le haut)
   *   axis, x, y, z, flat, rough
   * }
   * userData : { petals:[...], animate(t) }  — petals[i] est un Group pivotant
   *            sur le centre de la fleur : parfait pour faire respirer la corolle.
   */
  function petalRing(o) {
    o = o || {};
    const n = count(o.count, 5, 3);
    const r = num(o.r, 0.20);
    const pl = num(o.petalLen, 0.24), pw = num(o.petalWid, 0.17);
    const th = num(o.thick, 0.07);
    const color = o.color || '#ffaad8';
    const start = num(o.start, Math.PI / 2);
    const tilt = num(o.tilt, 0);
    const g = new THREE.Group();
    const petals = [];
    const mo = matOpts(o, { rough: num(o.rough, 0.86) });

    for (let i = 0; i < n; i++) {
      const a = start + (i / n) * Math.PI * 2;
      const p = new THREE.Group();
      p.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      // Ordre 'ZYX' : le pétale est d'abord orienté radialement (z), PUIS
      // redressé autour de son propre axe y. Avec l'ordre 'XYZ' par défaut, le
      // redressement se ferait dans le repère de la fleur et tous les pétales
      // pencheraient du même côté au lieu de former une coupe.
      p.rotation.order = 'ZYX';
      p.rotation.z = a;
      p.rotation.y = -tilt;              // redresse la pointe vers l'avant/le haut
      // Le pétale est un ellipsoïde allongé sur x (= vers l'extérieur), avec
      // une pointe arrondie : jamais d'angle vif.
      p.add(R3.ellipsoid(pl * 0.5, pw * 0.5, th * 0.5, color, 0, 0, 0, mo));
      if (o.tipColor) {
        p.add(light(R3.ellipsoid(pl * 0.20, pw * 0.34, th * 0.44, o.tipColor,
          pl * 0.34, 0, 0.004, mo)));
      }
      p.userData.a0 = a;
      g.add(p);
      petals.push(p);
    }
    g.userData.petals = petals;
    g.userData.animate = function (t) {
      for (let i = 0; i < petals.length; i++) {
        petals[i].rotation.y = -tilt + Math.sin(t * 1.7 + i * 0.8) * 0.09;
      }
    };
    if (o.axis === 'y') g.rotation.x = -Math.PI / 2;
    return place(g, o);
  }

  // ===========================================================================
  //  6. antenna — ANTENNE souple terminée par une boule.
  //     Utilisé par : papillon (2 antennes dorées), crabilino, meduzia,
  //     nuagette, glanou (germe).
  // ===========================================================================
  /**
   * Ancrage : pivot à la base (origine), pousse vers +y.
   * o = {
   *   len (0.24)       : longueur totale de la tige
   *   color ('#5d275d'): couleur de la tige
   *   ballColor ('#f1c40f'), ballR (0.045)
   *   ball (true)      : false -> antenne nue
   *   glow (true)      : la boule est légèrement lumineuse
   *   curve (0)        : courbure totale en radians (0.6 = joli arc)
   *   segments (2)     : nombre de tronçons — plus il y en a, plus l'arc est doux
   *   tilt (0)         : inclinaison de la base autour de z
   *   x, y, z
   * }
   * userData : { joints:[...], ball, animate(t) }
   */
  function antenna(o) {
    o = o || {};
    const len = num(o.len, 0.24);
    const bR = num(o.ballR, 0.045);
    const curve = num(o.curve, 0);
    const n = count(o.segments, 2, 1);
    const segLen = len / n;
    const color = o.color || '#5d275d';

    const c = chain(n, segLen, +1);
    const g = c.root;

    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      const rBot = len * 0.075 * (1 - u0 * 0.55);
      const rTop = len * 0.075 * (1 - u1 * 0.55);
      c.joints[i].rotation.z = curve / n;
      c.joints[i].add(R3.cyl(rTop, rBot, segLen, color, 0, segLen * 0.5, 0,
        { rough: 0.8, seg: 6 }));
    }

    const last = c.joints[n - 1];
    if (o.ball !== false) {
      const bcol = o.ballColor || '#f1c40f';
      const bopt = (o.glow === false)
        ? { rough: 0.6 }
        : { emissive: bcol, emissiveIntensity: 0.7, rough: 0.42 };
      const ball = R3.sphere(bR, bcol, 0, segLen + bR * 0.5, 0, bopt);
      last.add(ball);
      g.userData.ball = ball;
    }

    g.userData.joints = c.joints;
    g.userData.animate = function (t) {
      for (let i = 0; i < c.joints.length; i++) {
        c.joints[i].rotation.z = curve / n + Math.sin(t * 2.4 + i * 0.9) * 0.05;
      }
    };
    g.rotation.z = num(o.tilt, 0);
    return place(g, o);
  }

  // ===========================================================================
  //  7. paw — PATTE / PIED arrondi (aussi bien une main qu'un petit pied).
  //     Utilisé par : lapinou, fluffly, hibouche, crabilino, glanou, cygnik.
  // ===========================================================================
  /**
   * Ancrage : centré. La patte est aplatie et allongée vers +z.
   * o = { r (0.09), color ('#ffffff'), squash (0.66) aplatissement vertical,
   *       stretch (1.20) allongement vers l'avant, flat, rough, x, y, z }
   * -> THREE.Mesh
   */
  function paw(o) {
    o = o || {};
    const r = num(o.r, 0.09);
    return R3.ellipsoid(r, r * num(o.squash, 0.66), r * num(o.stretch, 1.20),
      o.color || '#ffffff', num(o.x, 0), num(o.y, 0), num(o.z, 0),
      matOpts(o, { rough: num(o.rough, 0.9) }));
  }

  // ===========================================================================
  //  8. ear — OREILLE pointue, ronde, longue (lapin) ou en touffe (hibou).
  //     Utilisé par : lapinou, fluffly, hibouche, nuagette (petites cornes).
  // ===========================================================================
  /**
   * Ancrage : pivot à la base (origine), pousse vers +y. Le devant est en +z.
   * o = {
   *   h (0.20), w (0.16)
   *   color ('#ffffff'), innerColor ('#ffaad8')
   *   shape : 'pointy' | 'round' | 'long' | 'tuft'   ('round')
   *   inner : false pour supprimer l'intérieur coloré
   *   bend (0) : courbure de la pointe vers l'avant, en radians
   *   flat, x, y, z
   * }
   * userData : { outer, inner }
   */
  function ear(o) {
    o = o || {};
    const h = num(o.h, 0.20), w = num(o.w, 0.16);
    const shape = o.shape || 'round';
    const color = o.color || '#ffffff';
    const inCol = o.innerColor || '#ffaad8';
    const g = new THREE.Group();
    let outer, inner;

    if (shape === 'pointy') {
      outer = R3.cone(w * 0.5, h, color, 0, h * 0.5, 0, matOpts(o, { seg: 9 }));
      inner = R3.cone(w * 0.30, h * 0.66, inCol, 0, h * 0.42, w * 0.16,
        { rough: 0.9, seg: 9 });
    } else if (shape === 'tuft') {
      // Petite aigrette trapue et arrondie du hibou (jamais une pointe agressive).
      outer = R3.ellipsoid(w * 0.42, h * 0.5, w * 0.38, color, 0, h * 0.5, 0,
        matOpts(o, { seg: 10 }));
      outer.rotation.z = 0.10;
      inner = R3.ellipsoid(w * 0.20, h * 0.26, w * 0.18, inCol, 0, h * 0.60, w * 0.20,
        { rough: 0.9 });
    } else if (shape === 'long') {
      // Grande oreille de lapin : ovale très étiré, légèrement bombé.
      outer = R3.ellipsoid(w * 0.5, h * 0.5, w * 0.34, color, 0, h * 0.5, 0,
        matOpts(o, { seg: 12 }));
      inner = R3.ellipsoid(w * 0.28, h * 0.38, w * 0.16, inCol, 0, h * 0.50, w * 0.22,
        { rough: 0.92 });
    } else {
      outer = R3.ellipsoid(w * 0.5, h * 0.5, w * 0.30, color, 0, h * 0.5, 0,
        matOpts(o, { seg: 12 }));
      inner = R3.ellipsoid(w * 0.28, h * 0.30, w * 0.16, inCol, 0, h * 0.48, w * 0.20,
        { rough: 0.9 });
    }

    g.add(outer);
    if (o.inner !== false) g.add(light(inner));
    g.userData.outer = outer;
    g.userData.inner = inner;
    g.rotation.x = num(o.bend, 0);
    return place(g, o);
  }

  // ===========================================================================
  //  9. bubbleTrail — CHAPELET DE BULLES translucides.
  //     Utilisé par : bullini, goutella, meduzia, crabilino (petites bulles).
  // ===========================================================================
  /**
   * Ancrage : première bulle à l'origine, les suivantes s'éloignent vers +y
   * (dir:'up', défaut) ou vers +z (dir:'forward', pour un petit jet).
   * o = {
   *   count (5), r (0.05), len (0.40), spread (0.08)
   *   color ('#a8e8ff'), opacity (0.5)
   *   dir : 'up' | 'forward'
   *   x, y, z
   * }
   * userData : { bubbles:[...], animate(t) }
   *            chaque bulle porte userData.u ∈ [0,1] (sa place dans le chapelet).
   */
  function bubbleTrail(o) {
    o = o || {};
    const n = count(o.count, 5, 1);
    const r = num(o.r, 0.05), len = num(o.len, 0.40);
    const spread = num(o.spread, 0.08);
    const color = o.color || '#a8e8ff';
    const forward = (o.dir === 'forward');
    const g = new THREE.Group();
    const bubbles = [];
    const mo = jelly(num(o.opacity, 0.5), 0.14);

    for (let i = 0; i < n; i++) {
      const u = (n === 1) ? 0 : i / (n - 1);
      const rr = r * (1 - u * 0.45);                 // les bulles s'amenuisent
      const side = Math.sin(u * 7.5) * spread;
      const b = R3.sphere(rr, color,
        side,
        forward ? side * 0.6 : u * len,
        forward ? u * len : side * 0.6, mo);
      light(b);
      b.userData.u = u;
      b.userData.r0 = rr;
      g.add(b);
      bubbles.push(b);
    }
    g.userData.bubbles = bubbles;
    g.userData.animate = function (t) {
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        const u = (b.userData.u + t * 0.35) % 1;     // remontée en boucle
        if (forward) b.position.z = u * len; else b.position.y = u * len;
        const s = 0.55 + (1 - u) * 0.75;
        b.scale.setScalar(s);
      }
    };
    return place(g, o);
  }

  // ===========================================================================
  // 10. sparkleRing — ANNEAU D'ÉTINCELLES qui tourne autour de la créature.
  //     Utilisé par : etincelo, nuagette (la rare : anneau doré marqué),
  //     lotira, papillon (poussière de fée).
  // ===========================================================================
  /**
   * Ancrage : centre de l'anneau à l'origine.
   * o = {
   *   count (6)      : nombre d'étincelles
   *   r (0.40)       : rayon de l'anneau
   *   size (0.05)    : taille d'une étincelle
   *   color ('#fde74c'), color2 : couleur alternée une étincelle sur deux
   *   shape : 'star' (défaut, étoile à 4 branches) | 'dot' (perle douce)
   *   axis : 'y' (défaut, anneau horizontal) | 'z' (anneau face à la caméra)
   *   tilt (0.32)    : inclinaison de l'anneau, en radians (axis 'y')
   *   wave (0.05)    : ondulation verticale des étincelles
   *   speed (0.9)    : vitesse de rotation utilisée par animate()
   *   glow (true)
   *   x, y, z
   * }
   * userData : { sparks:[...], spin (Group à faire tourner), animate(t) }
   */
  function sparkleRing(o) {
    o = o || {};
    const n = count(o.count, 6, 1);
    const r = num(o.r, 0.40);
    const size = num(o.size, 0.05);
    const wave = num(o.wave, 0.05);
    const speed = num(o.speed, 0.9);
    const c1 = o.color || '#fde74c';
    const c2 = o.color2 || c1;
    const glow = (o.glow !== false);

    const g = new THREE.Group();          // repère extérieur (position)
    const tiltG = new THREE.Group();      // inclinaison de l'anneau
    const spin = new THREE.Group();       // rotation propre : c'est lui qu'on anime
    tiltG.add(spin);
    g.add(tiltG);

    const sparks = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const col = (i % 2 === 0) ? c1 : c2;
      const mo = glow
        ? { emissive: col, emissiveIntensity: 1.0, rough: 0.35 }
        : { rough: 0.5 };
      let s;
      if (o.shape === 'dot') {
        s = R3.ellipsoid(size * 0.55, size * 0.55, size * 0.55, col, 0, 0, 0, mo);
      } else {
        // Étoile à 4 branches, géométrie unique partagée par toutes les étincelles.
        s = R3.star(4, size, size * 0.34, size * 0.34, col, 0, 0, 0, mo);
      }
      light(s);
      s.position.set(Math.cos(a) * r, Math.sin(a * 2) * wave, Math.sin(a) * r);
      s.userData.a0 = a;
      spin.add(s);
      sparks.push(s);
    }

    if (o.axis === 'z') {
      // Anneau dressé face à la caméra : on redresse le plan XZ en plan XY.
      tiltG.rotation.x = Math.PI / 2;
    } else {
      tiltG.rotation.x = num(o.tilt, 0.32);
    }

    g.userData.sparks = sparks;
    g.userData.spin = spin;
    g.userData.animate = function (t) {
      spin.rotation.y = t * speed;
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        s.rotation.z = t * 1.6 + i;
        const k = 0.65 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3.4 + s.userData.a0 * 3));
        // PIÈGE : une étincelle `shape:'dot'` est un R3.ellipsoid, dont les
        // RAYONS sont rangés dans `scale`. Un scale.setScalar(k) la
        // transformerait en boule de rayon k — la fameuse « volute devenue
        // rocher ». On mémorise l'échelle d'origine au premier passage et on
        // multiplie par elle : correct pour les perles comme pour les étoiles.
        if (!s.userData.s0) s.userData.s0 = s.scale.clone();
        const s0 = s.userData.s0;
        s.scale.set(s0.x * k, s0.y * k, s0.z * k);
        s.position.y = Math.sin(s.userData.a0 * 2 + t * 1.5) * wave;
      }
    };
    return place(g, o);
  }

  // ===========================================================================
  // 11. leafBlade — FEUILLE arrondie avec nervure.
  //     Utilisé par : feuillou (le corps entier !), petalia (feuille de tige),
  //     lotira (feuille de nénuphar, axis 'z'), glanou (germe).
  // ===========================================================================
  /**
   * Ancrage : pivot à la base (origine).
   *   axis:'y' (défaut) -> la feuille se dresse vers +y, sa face regarde +z.
   *   axis:'z'          -> la feuille est couchée à plat, pointe vers +z
   *                        (nénuphar, feuille au sol).
   * o = {
   *   len (0.46)      : longueur de la base à la pointe
   *   wid (0.34)      : largeur maximale
   *   thick (0.10)    : épaisseur
   *   color ('#38b764')
   *   edgeColor       : liseré plus foncé sur le pourtour (facultatif)
   *   vein (true), veinColor ('#1e8449')
   *   tip (true)      : petite pointe conique au bout
   *   tilt (0)        : inclinaison autour de z
   *   axis, x, y, z, flat, rough
   * }
   * userData : { blade, vein, animate(t) }
   */
  function leafBlade(o) {
    o = o || {};
    const len = num(o.len, 0.46), wid = num(o.wid, 0.34);
    const th = num(o.thick, 0.10);
    const color = o.color || '#38b764';
    const g = new THREE.Group();
    const mo = matOpts(o, { rough: num(o.rough, 0.88) });

    // Contour légèrement plus foncé : c'est le liseré du dessin 2D.
    if (o.edgeColor) {
      g.add(light(R3.ellipsoid(wid * 0.54, len * 0.50, th * 0.54, o.edgeColor,
        0, len * 0.48, 0, mo)));
    }

    const blade = R3.ellipsoid(wid * 0.5, len * 0.46, th * 0.5, color,
      0, len * 0.48, 0, mo);
    g.add(blade);
    g.userData.blade = blade;

    if (o.tip !== false) {
      const tip = R3.cone(wid * 0.26, len * 0.22, color, 0, len * 0.94, 0,
        matOpts(o, { seg: 9, rough: num(o.rough, 0.88) }));
      g.add(light(tip));
    }

    if (o.vein !== false) {
      const v = R3.box(wid * 0.055, len * 0.78, th * 0.62, o.veinColor || '#1e8449',
        0, len * 0.50, th * 0.16, { rough: 0.9 });
      g.add(light(v));
      g.userData.vein = v;
    }

    // Petit renflement à la base : la feuille ne « flotte » pas dans le vide.
    g.add(light(R3.ellipsoid(wid * 0.14, len * 0.08, th * 0.42, color, 0, len * 0.05, 0, mo)));

    g.rotation.z = num(o.tilt, 0);
    if (o.axis === 'z') g.rotation.x = Math.PI / 2;
    g.userData.animate = function (t) {
      g.rotation.y = Math.sin(t * 1.3) * 0.06;
    };
    return place(g, o);
  }

  // ===========================================================================
  // 12. tentacle — TENTACULE / branche souple, chaîne de perles décroissantes.
  //     Utilisé par : meduzia (8 tentacules), coralou (branches, rigid:true),
  //     etoilamer, nuagette (volutes de brume).
  // ===========================================================================
  /**
   * Ancrage : pivot à l'attache (origine).
   *   dir:'down' (défaut) -> pend vers -y (méduse)
   *   dir:'up'            -> pousse vers +y (corail)
   * o = {
   *   len (0.40)     : longueur totale
   *   count (5)      : nombre de tronçons (5 = souple et économe)
   *   r (0.045)      : rayon à l'attache
   *   taper (0.55)   : amincissement au bout (0 = cylindrique, 1 = pointe fine)
   *   color ('#ffaad8'), tipColor : couleur du dernier tronçon (facultatif)
   *   wave (0.16)    : courbure de repos, en radians par tronçon
   *   phase (0)      : décale l'ondulation (à varier d'un tentacule à l'autre)
   *   yaw (0)        : orientation autour de y (pour rayonner autour d'un corps)
   *   speed (2.2)    : vitesse d'ondulation d'animate()
   *   rigid          : true -> pas d'animation, forme figée (corail)
   *   dir, x, y, z, flat, rough, opacity
   * }
   * userData : { joints:[...], beads:[...], animate(t) }
   */
  function tentacle(o) {
    o = o || {};
    const len = num(o.len, 0.40);
    const n = count(o.count, 5, 1);
    const r = num(o.r, 0.045);
    const taper = num(o.taper, 0.55);
    const wave = num(o.wave, 0.16);
    const phase = num(o.phase, 0);
    const speed = num(o.speed, 2.2);
    const sign = (o.dir === 'up') ? 1 : -1;
    const segLen = len / n;
    const color = o.color || '#ffaad8';
    const mo = matOpts(o, { rough: num(o.rough, 0.8), seg: 10 });

    const c = chain(n, segLen, sign);
    const g = c.root;
    const beads = [];

    for (let i = 0; i < n; i++) {
      const u = (n === 1) ? 0 : i / (n - 1);
      const rr = Math.max(0.006, r * (1 - taper * u));
      const col = (o.tipColor && i === n - 1) ? o.tipColor : color;
      c.joints[i].rotation.z = wave * Math.sin(i * 1.15 + phase);
      // Ellipsoïde légèrement plus long que le tronçon : les perles se
      // chevauchent, la chaîne paraît continue et douce.
      const bead = R3.ellipsoid(rr, segLen * 0.62, rr, col, 0, sign * segLen * 0.5, 0, mo);
      c.joints[i].add(bead);
      beads.push(bead);
    }
    // Bout arrondi : jamais de section coupée net.
    const rEnd = Math.max(0.006, r * (1 - taper));
    c.joints[n - 1].add(light(R3.ellipsoid(rEnd * 1.05, rEnd * 1.05, rEnd * 1.05,
      o.tipColor || color, 0, sign * segLen, 0, mo)));

    g.userData.joints = c.joints;
    g.userData.beads = beads;
    g.userData.animate = o.rigid ? function () {} : function (t) {
      for (let i = 0; i < c.joints.length; i++) {
        c.joints[i].rotation.z = wave * Math.sin(i * 1.15 + phase + t * speed) * 1.0;
        c.joints[i].rotation.x = wave * 0.5 * Math.sin(i * 0.9 + phase * 1.7 + t * speed * 0.8);
      }
    };
    g.rotation.y = num(o.yaw, 0);
    return place(g, o);
  }

  // ===========================================================================
  // 13. waterDrop — GOUTTE D'EAU (boule en bas, pointe en haut), translucide.
  //     Utilisé par : goutella (le corps entier), bullini, meduzia, lotira
  //     (rosée), cygnik (éclaboussures).
  // ===========================================================================
  /**
   * Ancrage : POSÉ — le bas de la goutte touche y = 0, la pointe est à y = h.
   * o = {
   *   r (0.26)       : rayon de la boule du bas
   *   h (0.66)       : hauteur totale, pointe comprise
   *   color ('#41a6f6')
   *   deepColor      : couleur du contour plus sombre (facultatif, '#3b5dc9')
   *   shineColor ('#73eff7') : reflet brillant
   *   shine (true)
   *   glass (true)   : corps légèrement translucide
   *   opacity (0.86)
   *   x, y, z
   * }
   * userData : { bulb, tip, shine, animate(t) }
   */
  function waterDrop(o) {
    o = o || {};
    const r = num(o.r, 0.26);
    const h = Math.max(r * 1.7, num(o.h, 0.66));
    const color = o.color || '#41a6f6';
    const g = new THREE.Group();

    const solid = (o.glass === false);
    const mo = solid
      ? { rough: 0.25 }
      : { transparent: true, opacity: num(o.opacity, 0.86), rough: 0.14 };

    // La boule repose EXACTEMENT sur y = 0 : son demi-axe vertical est aussi
    // sa hauteur de centre.
    const br = r * 0.98;

    // Contour plus profond, comme le double ovale du dessin 2D.
    if (o.deepColor) {
      g.add(R3.ellipsoid(r * 1.06, br * 1.02, r * 1.06, o.deepColor, 0, br, 0, mo));
    }

    const bulb = R3.ellipsoid(r, br, r, color, 0, br, 0, mo);
    g.add(bulb);
    g.userData.bulb = bulb;

    // Pointe : cône doux qui part du haut de la boule et s'arrête à y = h.
    const coneH = Math.max(0.02, h - br * 1.5);
    const tip = R3.cone(r * 0.70, coneH, color, 0, br * 1.5 + coneH * 0.5, 0,
      Object.assign({ seg: 12 }, mo));
    g.add(tip);
    g.userData.tip = tip;

    if (o.shine !== false) {
      const sh = R3.ellipsoid(r * 0.26, r * 0.34, r * 0.16, o.shineColor || '#73eff7',
        -r * 0.42, br * 1.25, r * 0.72, { rough: 0.1, emissive: o.shineColor || '#73eff7',
          emissiveIntensity: 0.25 });
      g.add(light(sh));
      g.userData.shine = sh;
    }

    g.userData.animate = function (t) {
      // Une goutte, ça tremblote : léger ballottement vertical.
      const s = 1 + Math.sin(t * 3.1) * 0.03;
      g.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    };
    return place(g, o);
  }

  // ===========================================================================
  // 14. shellSpiral — COQUILLAGE EN SPIRALE (perles sur une spirale douce).
  //     Utilisé par : crabilino (petite coquille), etoilamer, décor de plage,
  //     accessoires de bord de mer.
  // ===========================================================================
  /**
   * Ancrage : centre de la spirale à l'origine.
   *   axis:'z' (défaut) -> la spirale regarde +z (bien lisible de face)
   *   axis:'y'          -> la spirale est couchée à plat
   * o = {
   *   r (0.20)       : rayon extérieur de la coquille
   *   turns (2)      : nombre de tours
   *   count (10)     : nombre de perles (toutes partagent UNE géométrie)
   *   thick (0.5)    : épaisseur relative (1 = perles sphériques)
   *   color ('#ffd9c0'), tipColor : couleur des perles du centre (facultatif)
   *   spin (0)       : rotation de la spirale sur elle-même
   *   axis, x, y, z, flat, rough
   * }
   * userData : { beads:[...] }
   */
  function shellSpiral(o) {
    o = o || {};
    const r = num(o.r, 0.20);
    const turns = num(o.turns, 2);
    const n = count(o.count, 10, 3);
    const thick = num(o.thick, 0.5);
    const color = o.color || '#ffd9c0';
    const g = new THREE.Group();
    const beads = [];
    const mo = matOpts(o, { rough: num(o.rough, 0.7), seg: 12 });

    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);                       // 0 au centre -> 1 au bord
      const a = u * turns * Math.PI * 2;
      const rad = r * Math.pow(u, 0.95);
      const br = r * 0.30 * (0.22 + 0.78 * u);     // les perles grossissent
      const col = (o.tipColor && u < 0.3) ? o.tipColor : color;
      const b = R3.ellipsoid(br, br, br * thick, col,
        Math.cos(a) * rad, Math.sin(a) * rad, 0, mo);
      g.add(b);
      beads.push(b);
    }
    g.userData.beads = beads;
    g.rotation.z = num(o.spin, 0);
    if (o.axis === 'y') g.rotation.x = -Math.PI / 2;
    return place(g, o);
  }

  // ===========================================================================
  //  BONUS — hors des 14 du contrat, mais très utiles. Toujours tester leur
  //  présence : `if (CL && CL.starBody) ...`
  // ===========================================================================

  // ---------------------------------------------------------------------------
  //  mouthSmile — PETIT SOURIRE en arc de perles. Presque toutes les créatures
  //  de Clélia sourient : c'est le helper le plus utilisé de la bibliothèque.
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : centré sur le milieu de la bouche, face vers +z.
   * o = { w (0.10) demi-largeur, depth (0.035) creux de l'arc,
   *       r (0.020) grosseur du trait, count (5), color ('#1a1c2c'),
   *       open (0) : >0 -> petite bouche ouverte ronde (surprise, joie),
   *       sad : true -> arc inversé, x, y, z }
   */
  function mouthSmile(o) {
    o = o || {};
    const w = num(o.w, 0.10), depth = num(o.depth, 0.035), r = num(o.r, 0.020);
    const color = o.color || '#1a1c2c';
    const g = new THREE.Group();

    if (num(o.open, 0) > 0) {
      const k = num(o.open, 0);
      g.add(light(R3.ellipsoid(w * 0.55, w * 0.55 * k, r * 1.2, color, 0, 0, 0,
        { rough: 0.8 })));
      return place(g, o);
    }

    const n = count(o.count, 5, 3);
    const sign = o.sad ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;             // -1 .. 1
      const k = 1 - u * u;                         // 1 au milieu, 0 aux bouts
      const b = R3.sphere(r * (0.68 + 0.32 * k), color,
        u * w, -sign * k * depth, -Math.abs(u) * r * 0.5, { rough: 0.85 });
      g.add(light(b));
    }
    return place(g, o);
  }

  // ---------------------------------------------------------------------------
  //  bigEyes — GRANDS YEUX blancs à pupille sombre (hibouche, crabilino,
  //  bullini, fluffly). Beaucoup plus expressifs que R3.eyes() quand la
  //  créature doit avoir « des yeux immenses ».
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : centré entre les deux yeux, regard vers +z.
   * o = { spread (0.12) demi-écart, r (0.085) rayon du globe,
   *       scleraColor ('#f8f8f8'), pupilColor ('#1a1c2c'), pupilR (0.52×r),
   *       look (0) décalage horizontal des pupilles (-1..1), x, y, z }
   * userData : { pupils:[gauche, droite] }
   */
  function bigEyes(o) {
    o = o || {};
    const spread = num(o.spread, 0.12), r = num(o.r, 0.085);
    const pr = num(o.pupilR, r * 0.52);
    const look = num(o.look, 0);
    const g = new THREE.Group();
    const pupils = [];
    [-1, 1].forEach(function (s) {
      g.add(light(R3.ellipsoid(r, r, r * 0.60, o.scleraColor || '#f8f8f8',
        s * spread, 0, 0, { rough: 0.55 })));
      const p = R3.ellipsoid(pr, pr, pr * 0.55, o.pupilColor || '#1a1c2c',
        s * spread + look * r * 0.28, 0, r * 0.46, { rough: 0.5 });
      g.add(light(p));
      pupils.push(p);
      g.add(light(R3.sphere(pr * 0.34, '#ffffff',
        s * spread + look * r * 0.28 + pr * 0.42, pr * 0.42, r * 0.66,
        { rough: 0.25 })));
    });
    g.userData.pupils = pupils;
    return place(g, o);
  }

  // ---------------------------------------------------------------------------
  //  stem — TIGE VERTE incurvée (petalia, lotira, feuillou, glanou).
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : pivot à la base (origine), pousse vers +y.
   * o = { len (0.30), r (0.030), color ('#27ae60'), curve (0) courbure totale,
   *       segments (2), taper (0.75) rapport haut/bas, tilt (0), x, y, z }
   * userData : { joints:[...] }
   */
  function stem(o) {
    o = o || {};
    const len = num(o.len, 0.30);
    const r = num(o.r, 0.030);
    const n = count(o.segments, 2, 1);
    const segLen = len / n;
    const taper = num(o.taper, 0.75);
    const curve = num(o.curve, 0);
    const color = o.color || '#27ae60';

    const c = chain(n, segLen, +1);
    for (let i = 0; i < n; i++) {
      const rBot = r * (1 - (1 - taper) * (i / n));
      const rTop = r * (1 - (1 - taper) * ((i + 1) / n));
      c.joints[i].rotation.z = curve / n;
      c.joints[i].add(R3.cyl(rTop, rBot, segLen, color, 0, segLen * 0.5, 0,
        { rough: 0.86, seg: 8 }));
    }
    c.root.userData.joints = c.joints;
    c.root.rotation.z = num(o.tilt, 0);
    return place(c.root, o);
  }

  // ---------------------------------------------------------------------------
  //  eyeStalk — ŒIL SUR TIGE (crabilino, et tout ce qui doit être rigolo).
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : pivot à la base (origine), pousse vers +y.
   * o = { len (0.16), r (0.05) rayon du globe, stalkColor ('#b13e53'),
   *       eyeColor ('#f8f8f8'), pupilColor ('#1a1c2c'), tilt (0), x, y, z }
   * userData : { globe, pupil, animate(t) }
   */
  function eyeStalk(o) {
    o = o || {};
    const len = num(o.len, 0.16), r = num(o.r, 0.05);
    const g = new THREE.Group();
    g.add(R3.cyl(r * 0.42, r * 0.52, len, o.stalkColor || '#b13e53', 0, len * 0.5, 0,
      { rough: 0.8, seg: 8 }));
    const globe = R3.sphere(r, o.eyeColor || '#f8f8f8', 0, len + r * 0.8, 0,
      { rough: 0.5 });
    const pupil = R3.ellipsoid(r * 0.48, r * 0.48, r * 0.30, o.pupilColor || '#1a1c2c',
      0, len + r * 0.8, r * 0.80, { rough: 0.5 });
    const hi = R3.sphere(r * 0.20, '#ffffff', r * 0.28, len + r * 1.05, r * 0.80,
      { rough: 0.25 });
    g.add(globe, light(pupil), light(hi));
    g.userData.globe = globe;
    g.userData.pupil = pupil;
    g.userData.animate = function (t) {
      g.rotation.z = num(o.tilt, 0) + Math.sin(t * 2.1) * 0.10;
    };
    g.rotation.z = num(o.tilt, 0);
    return place(g, o);
  }

  // ---------------------------------------------------------------------------
  //  butterflyWing — AILE DE PAPILLON à deux lobes (papillon, fées, meduzia).
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : pivot au corps (origine). L'aile se déploie vers +x pour side:+1.
   * Pour l'aile gauche, passer side:-1 — le Group est retourné par une rotation
   * (jamais par une échelle négative, qui casserait l'éclairage).
   * o = {
   *   len (0.34), height (0.32), thick (0.02)
   *   color ('#ff6b9d')       : lobe supérieur
   *   lowerColor ('#d896ff')  : lobe inférieur
   *   innerColor ('#ffaad8')  : tache claire au centre du lobe supérieur
   *   dotColor ('#f1c40f')    : petits points dorés
   *   opacity (1)             : <1 pour une aile de fée translucide
   *   side (+1 | -1), x, y, z
   * }
   * userData : { upper, lower }
   */
  function butterflyWing(o) {
    o = o || {};
    const len = num(o.len, 0.34), h = num(o.height, 0.32);
    const th = num(o.thick, 0.02);
    const g = new THREE.Group();
    const mo = { side: THREE.DoubleSide, rough: 0.62 };
    if (num(o.opacity, 1) < 1) {
      mo.transparent = true; mo.opacity = num(o.opacity, 1); mo.depthWrite = false;
    }

    const upper = R3.ellipsoid(len * 0.50, h * 0.42, th, o.color || '#ff6b9d',
      len * 0.48, h * 0.22, 0, mo);
    upper.rotation.z = 0.14;
    g.add(light(upper));

    const lower = R3.ellipsoid(len * 0.37, h * 0.33, th, o.lowerColor || '#d896ff',
      len * 0.36, -h * 0.30, 0, mo);
    lower.rotation.z = -0.16;
    g.add(light(lower));

    g.add(light(R3.ellipsoid(len * 0.20, h * 0.16, th * 1.3, o.innerColor || '#ffaad8',
      len * 0.40, h * 0.22, th * 0.9, mo)));

    const dot = o.dotColor || '#f1c40f';
    g.add(light(R3.ellipsoid(len * 0.07, len * 0.07, th * 1.4, dot,
      len * 0.66, h * 0.24, th * 1.0, { rough: 0.5 })));
    g.add(light(R3.ellipsoid(len * 0.055, len * 0.055, th * 1.4, dot,
      len * 0.46, -h * 0.32, th * 1.0, { rough: 0.5 })));

    g.userData.upper = upper;
    g.userData.lower = lower;
    if (num(o.side, 1) < 0) g.rotation.y = Math.PI;
    return place(g, o);
  }

  // ---------------------------------------------------------------------------
  //  featherWing — AILE DE PLUMES repliée le long du corps (cygnik, hibouche).
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : pivot à l'épaule (origine). L'aile descend et part vers l'arrière
   * (-z) pour side:+1 (côté droit). Passer side:-1 pour le côté gauche.
   * o = { len (0.34), wid (0.15), color ('#f4f4f4'), tipColor,
   *       layers (3) nombre de plumes visibles, side (+1|-1), x, y, z, flat }
   * userData : { main, feathers:[...] }
   */
  function featherWing(o) {
    o = o || {};
    const len = num(o.len, 0.34), wid = num(o.wid, 0.15);
    const color = o.color || '#f4f4f4';
    const g = new THREE.Group();
    const mo = matOpts(o, { rough: num(o.rough, 0.82) });

    // Corps de l'aile : galette bombée plaquée sur le flanc.
    const main = R3.ellipsoid(wid * 0.5, len * 0.42, len * 0.5, color,
      0, -len * 0.16, -len * 0.10, mo);
    main.rotation.x = 0.12;
    g.add(main);
    g.userData.main = main;

    // Plumes du bord de fuite : 2-3 lobes décalés vers l'arrière et le bas.
    const n = count(o.layers, 3, 1);
    const feathers = [];
    for (let i = 0; i < n; i++) {
      const u = (n === 1) ? 0 : i / (n - 1);
      const col = (o.tipColor && i === n - 1) ? o.tipColor : color;
      const f = R3.ellipsoid(wid * 0.32, len * (0.26 - u * 0.06), len * (0.34 - u * 0.05),
        col, wid * 0.06 * (1 - u), -len * (0.34 + u * 0.10), -len * (0.34 + u * 0.16), mo);
      f.rotation.x = 0.24 + u * 0.16;
      g.add(light(f));
      feathers.push(f);
    }
    g.userData.feathers = feathers;
    if (num(o.side, 1) < 0) g.rotation.y = Math.PI;
    return place(g, o);
  }

  // ---------------------------------------------------------------------------
  //  starBody — CORPS EN ÉTOILE aux bras dodus et arrondis.
  //  (etoilamer : 5 bras roses ; etincelo : 4-5 bras dorés et lumineux.)
  //  Bien plus doux que R3.star(), qui est extrudé et anguleux.
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : centré. axis:'z' (défaut) -> l'étoile fait face à +z.
   *                   axis:'y'          -> l'étoile est couchée à plat.
   * o = {
   *   arms (5), armLen (0.30), armWid (0.15), thick (0.13)
   *   r (0.10)          : rayon du bourrelet central
   *   color ('#ff6b9d'), centerColor ('#ffaad8')
   *   start (Math.PI/2) : angle du premier bras (vers le haut)
   *   glow (false)      : bras légèrement lumineux (etincelo, nuagette)
   *   axis, x, y, z, flat, rough
   * }
   * userData : { arms:[...], center, animate(t) }
   */
  function starBody(o) {
    o = o || {};
    const n = count(o.arms, 5, 3);
    const armLen = num(o.armLen, 0.30);
    const armWid = num(o.armWid, 0.15);
    const th = num(o.thick, 0.13);
    const cr = num(o.r, 0.10);
    const color = o.color || '#ff6b9d';
    const start = num(o.start, Math.PI / 2);
    const g = new THREE.Group();
    const arms = [];

    const mo = matOpts(o, { rough: num(o.rough, 0.85), seg: 12 });
    if (o.glow) { mo.emissive = color; mo.emissiveIntensity = num(o.glowIntensity, 0.55); }

    for (let i = 0; i < n; i++) {
      const a = start + (i / n) * Math.PI * 2;
      const arm = new THREE.Group();
      arm.rotation.z = a;
      // Bras dodu : ellipsoïde allongé vers +x local, pointe arrondie.
      arm.add(R3.ellipsoid(armLen * 0.56, armWid * 0.5, th * 0.5, color,
        armLen * 0.48, 0, 0, mo));
      arm.userData.a0 = a;
      g.add(arm);
      arms.push(arm);
    }

    // Bourrelet central plus clair : il « soude » les bras entre eux.
    const center = R3.ellipsoid(cr * 1.55, cr * 1.55, th * 0.62,
      o.centerColor || '#ffaad8', 0, 0, th * 0.10, mo);
    g.add(center);
    g.userData.center = center;
    g.userData.arms = arms;
    g.userData.animate = function (t) {
      for (let i = 0; i < arms.length; i++) {
        arms[i].scale.setScalar(1 + Math.sin(t * 2.6 + i * 1.2) * 0.05);
      }
    };
    if (o.axis === 'y') g.rotation.x = -Math.PI / 2;
    return place(g, o);
  }

  // ---------------------------------------------------------------------------
  //  glowAura — HALO LUMINEUX translucide (etincelo, nuagette la rare, lotira).
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : centré. Ne projette ni ne reçoit d'ombre.
   * o = { r (0.45), color ('#fcef8d'), layers (2), opacity (0.20),
   *       squash (0.8) aplatissement vertical, pulse (0.06) amplitude,
   *       x, y, z }
   * userData : { shells:[...], animate(t) }
   */
  function glowAura(o) {
    o = o || {};
    const r = num(o.r, 0.45);
    const n = count(o.layers, 2, 1);
    const color = o.color || '#fcef8d';
    const op = num(o.opacity, 0.20);
    const squash = num(o.squash, 0.8);
    const pulse = num(o.pulse, 0.06);
    const g = new THREE.Group();
    const shells = [];
    for (let i = 0; i < n; i++) {
      const k = 1 + i * 0.30;
      const s = R3.ellipsoid(r * k, r * k * squash, r * k, color, 0, 0, 0, {
        transparent: true,
        opacity: op / (1 + i * 0.7),
        rough: 0.2,
        emissive: color,
        emissiveIntensity: 0.8,
        depthWrite: false,
        side: THREE.BackSide,
        seg: 12,
      });
      light(s);
      g.add(s);
      shells.push(s);
    }
    g.userData.shells = shells;
    g.userData.animate = function (t) {
      const k = 1 + Math.sin(t * 1.6) * pulse;
      g.scale.setScalar(k);
    };
    return place(g, o);
  }

  // ---------------------------------------------------------------------------
  //  cloudPuff — AMAS DE BOSSES façon petit nuage (nuagette, écume, mousse).
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : centré sur la masse principale.
   * o = { r (0.32) rayon de la bosse centrale, count (5) bosses périphériques,
   *       color ('#f8f8f8'), shadeColor (dessous plus gris, facultatif),
   *       spread (1.0), squash (0.72), seed (1), x, y, z }
   * userData : { puffs:[...], animate(t) }
   */
  function cloudPuff(o) {
    o = o || {};
    const r = num(o.r, 0.32);
    const n = count(o.count, 5, 0);
    const color = o.color || '#f8f8f8';
    const spread = num(o.spread, 1.0);
    const squash = num(o.squash, 0.72);
    const rnd = R3.rng(num(o.seed, 1) * 977 + 13);
    const g = new THREE.Group();
    const puffs = [];
    const mo = { rough: 0.95, seg: 12 };

    if (o.shadeColor) {
      g.add(light(R3.ellipsoid(r * 1.02, r * squash * 0.92, r * 1.02, o.shadeColor,
        0, -r * 0.10, 0, mo)));
    }
    const main = R3.ellipsoid(r, r * squash, r * 0.94, color, 0, 0, 0, mo);
    g.add(main);
    puffs.push(main);

    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + rnd() * 0.5;
      const rr = r * (0.44 + rnd() * 0.26);
      const d = r * (0.72 + rnd() * 0.24) * spread;
      const p = R3.ellipsoid(rr, rr * squash * 1.05, rr * 0.94, color,
        Math.cos(a) * d, (rnd() - 0.35) * r * 0.42, Math.sin(a) * d * 0.55, mo);
      g.add(p);
      p.userData.y0 = p.position.y;
      p.userData.ph = i * 1.3;
      puffs.push(p);
    }
    g.userData.puffs = puffs;
    g.userData.animate = function (t) {
      for (let i = 1; i < puffs.length; i++) {
        const p = puffs[i];
        p.position.y = p.userData.y0 + Math.sin(t * 1.3 + p.userData.ph) * r * 0.05;
      }
    };
    return place(g, o);
  }

  // ---------------------------------------------------------------------------
  //  claw — PINCE de crabe (crabilino) : deux mâchoires arrondies qui claquent.
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : pivot au poignet (origine), la pince pointe vers +z.
   * o = { len (0.22), color ('#b13e53'), innerColor ('#e74c3c'),
   *       open (0.30) écartement au repos en radians, yaw (0) orientation
   *       autour de y, x, y, z }
   * userData : { upper, lower, animate(t) }  — animer upper/lower.rotation.x
   *            pour le fameux « clic-clac ».
   */
  function claw(o) {
    o = o || {};
    const len = num(o.len, 0.22);
    const color = o.color || '#b13e53';
    const open = num(o.open, 0.30);
    const g = new THREE.Group();
    const mo = { rough: 0.65, seg: 12 };

    // Paume renflée
    g.add(R3.ellipsoid(len * 0.30, len * 0.36, len * 0.38, color, 0, 0, len * 0.26, mo));
    g.add(light(R3.ellipsoid(len * 0.18, len * 0.14, len * 0.22,
      o.innerColor || '#e74c3c', 0, 0, len * 0.44, mo)));

    const upper = new THREE.Group();
    upper.position.set(0, len * 0.12, len * 0.48);
    upper.rotation.x = -open;
    upper.add(R3.ellipsoid(len * 0.17, len * 0.15, len * 0.34, color,
      0, 0, len * 0.30, mo));
    g.add(upper);

    const lower = new THREE.Group();
    lower.position.set(0, -len * 0.12, len * 0.48);
    lower.rotation.x = open;
    lower.add(R3.ellipsoid(len * 0.16, len * 0.13, len * 0.30, color,
      0, 0, len * 0.28, mo));
    g.add(lower);

    g.userData.upper = upper;
    g.userData.lower = lower;
    g.userData.animate = function (t) {
      const k = open * (0.55 + 0.45 * Math.sin(t * 3.4));
      upper.rotation.x = -k;
      lower.rotation.x = k;
    };
    g.rotation.y = num(o.yaw, 0);
    return place(g, o);
  }

  // ---------------------------------------------------------------------------
  //  acornCap — CHAPEAU DE GLAND / béret arrondi (glanou, champignons, glands
  //  de décor). Un dôme texturé de petites bosses, jamais un cône.
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : centré sur le bord du chapeau (y = 0). Le dôme visible monte
   * jusqu'à y = h ; sa moitié basse s'enfonce dans ce qu'il coiffe (le gland),
   * ce qui évite tout raccord visible.
   * o = { r (0.26), h (0.20), color ('#5c2e0d'), rimColor ('#8b5a2b'),
   *       studs (5) petites bosses de texture, studColor, x, y, z, flat }
   * userData : { dome }
   */
  function acornCap(o) {
    o = o || {};
    const r = num(o.r, 0.26), h = num(o.h, 0.20);
    const color = o.color || '#5c2e0d';
    const g = new THREE.Group();
    const mo = matOpts(o, { rough: num(o.rough, 0.9), seg: 14 });

    const dome = R3.ellipsoid(r, h, r, color, 0, 0, 0, mo);
    g.add(dome);
    g.userData.dome = dome;

    // Bourrelet du bord : le petit ourlet qui rend le chapeau « rigolo ».
    // Le tore de THREE est dans le plan XY : on le couche pour qu'il ceinture
    // le dôme à l'horizontale.
    const rim = R3.torus(r * 0.94, r * 0.11, o.rimColor || '#8b5a2b', 0, 0, 0,
      { rough: 0.9, seg: 16 });
    rim.rotation.x = -Math.PI / 2;
    g.add(rim);

    const n = count(o.studs, 5, 0);
    const sc = o.studColor || color;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      const d = r * 0.60;
      g.add(light(R3.ellipsoid(r * 0.10, h * 0.22, r * 0.10, sc,
        Math.cos(a) * d, h * 0.72, Math.sin(a) * d, { rough: 0.95 })));
    }
    return place(g, o);
  }

  // ---------------------------------------------------------------------------
  //  swanNeck — COU EN S (cygnik). Chaîne de perles courbée, pivot aux épaules.
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : pivot à la base du cou (origine), monte vers +y puis s'avance
   * vers +z. `userData.head` est un Group vide placé au sommet : y accrocher
   * la tête, elle suivra toutes les ondulations.
   * o = { len (0.46), r (0.05), color ('#f4f4f4'), count (6),
   *       curve (0.55) ampleur du S, x, y, z }
   * userData : { joints:[...], head, animate(t) }
   */
  function swanNeck(o) {
    o = o || {};
    const len = num(o.len, 0.46);
    const r = num(o.r, 0.05);
    const n = count(o.count, 6, 2);
    const segLen = len / n;
    const curve = num(o.curve, 0.55);
    const color = o.color || '#f4f4f4';

    const c = chain(n, segLen, +1);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      // Courbe en S : on part en arrière, on revient vers l'avant.
      c.joints[i].rotation.x = curve * Math.sin(u * Math.PI * 1.15 - 0.35) / n * 3.0;
      const rr = r * (1 - u * 0.28);
      c.joints[i].add(R3.ellipsoid(rr, segLen * 0.66, rr, color, 0, segLen * 0.5, 0,
        { rough: 0.85, seg: 10 }));
    }
    const head = new THREE.Group();
    head.position.y = segLen;
    c.joints[n - 1].add(head);

    c.root.userData.joints = c.joints;
    c.root.userData.head = head;
    c.root.userData.animate = function (t) {
      c.root.rotation.z = Math.sin(t * 1.1) * 0.05;
      for (let i = 0; i < c.joints.length; i++) {
        c.joints[i].rotation.y = Math.sin(t * 1.4 + i * 0.5) * 0.03;
      }
    };
    return place(c.root, o);
  }

  // ===========================================================================
  //  L'ÉCLAT — OMBRE DE CONTACT, LISERÉ ET CRÉATURES BRILLANTES
  //  (contrat v5 §21 ; couture (d) du §16.1 : tout vit ici, rien dans core3d.js)
  // ===========================================================================
  //  Deux choses très différentes, réunies parce qu'elles s'appliquent au même
  //  moment — juste après qu'un modèle a été construit :
  //
  //   1. LA PARURE, pour TOUTES les créatures : une ombre de contact et un
  //      liseré de silhouette. C'est ce qui manquait le plus au rendu : sans
  //      elles une créature n'a pas l'air POSÉE sur l'herbe, elle a l'air
  //      COLLÉE dessus, comme un autocollant. La carte d'ombre du soleil ne
  //      suffit pas : elle couvre 44 tuiles, donc une bestiole d'une tuile n'y
  //      pèse que deux ou trois texels — et en qualité basse il n'y a pas
  //      d'ombre du tout.
  //
  //   2. L'ÉCLAT, pour deux ou trois espèces sur soixante-quinze : couleurs
  //      décalées et étoiles qui tournent. C'est une surprise, donc c'est rare,
  //      et c'est évident à l'œil — une variante qu'il faut deviner ne sert à
  //      rien.
  //
  //  RÈGLES TENUES ICI :
  //   · aucun `new THREE.Material` — R3.mat() uniquement, donc tout est partagé ;
  //   · aucune texture, aucun shader : deux ellipsoïdes et une coque retournée ;
  //   · rien n'est ajouté à core3d.js (il appartient à un autre agent) ;
  //   · aucune fonction ne lève : au pire la parure manque, jamais le modèle.
  // ===========================================================================

  /** Marque un objet et toute sa descendance comme PARURE : ni le liseré, ni la
   *  boîte englobante, ni la sonde ne doivent la confondre avec le modèle. */
  function marqueParure(o) {
    if (!o) return o;
    o.traverse(function (x) { x.userData.parure = true; });
    return o;
  }

  // ---------------------------------------------------------------------------
  //  Couleurs — en sRGB, à la main.
  //  On n'utilise PAS THREE.Color.getHSL/setHSL : depuis r152 la gestion des
  //  couleurs travaille en linéaire, et la même rotation de teinte n'y donne
  //  pas du tout la même couleur à l'écran. `getHexString()`, lui, rend bien
  //  du sRGB : c'est le seul aller-retour sur lequel on peut compter.
  // ---------------------------------------------------------------------------

  /** '#rrggbb' -> { h, s, l } dans [0,1], ou null si la chaîne est illisible. */
  function hexVersHsl(hex) {
    if (typeof hex !== 'string') return null;
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const r = ((n >> 16) & 255) / 255, v = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, v, b), mn = Math.min(r, v, b);
    const l = (mx + mn) / 2;
    if (mx === mn) return { h: 0, s: 0, l: l };
    const d = mx - mn;
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h;
    if (mx === r) h = ((v - b) / d + (v < b ? 6 : 0)) / 6;
    else if (mx === v) h = ((b - r) / d + 2) / 6;
    else h = ((r - v) / d + 4) / 6;
    return { h: h, s: s, l: l };
  }

  /** { h, s, l } -> '#rrggbb'. */
  function hslVersHex(h, s, l) {
    h = ((h % 1) + 1) % 1;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    let r, v, b;
    if (s === 0) { r = v = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const canal = function (t) {
        t = ((t % 1) + 1) % 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      r = canal(h + 1 / 3); v = canal(h); b = canal(h - 1 / 3);
    }
    const oct = function (x) {
      const k = Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16);
      return k.length < 2 ? '0' + k : k;
    };
    return '#' + oct(r) + oct(v) + oct(b);
  }

  /**
   * La couleur brillante d'une couleur ordinaire, ou null s'il ne faut pas y
   * toucher (gris, noir, blanc : les yeux, les crocs, les reflets).
   * Exporté : CL.couleurBrillante('#f1c40f') -> '#0fb2f1'
   */
  function couleurBrillante(hex) {
    const c = hexVersHsl(hex);
    if (!c) return null;
    if (c.l < CLARTE_MINI) return null;                              // les noirs
    if (c.l > CLARTE_DU_BLANC && c.s < SATURATION_DU_BLANC) return null;  // les blancs francs
    if (c.s < SATURATION_MINI) {
      return hslVersHex(TEINTE_DES_GRIS, SATURATION_DES_GRIS,
                        Math.min(c.l, CLARTE_DES_GRIS));
    }
    return hslVersHex(c.h + TEINTE_BRILLANTE,
                      c.s * SATURATION_BRILLANTE,
                      Math.min(0.90, c.l * CLARTE_BRILLANTE));
  }

  // ---------------------------------------------------------------------------
  //  Le tirage des espèces brillantes — déterministe, sans état, sans stockage.
  // ---------------------------------------------------------------------------

  /** FNV-1a, ramené dans [0,1[. Deux caractères de différence donnent deux
   *  nombres sans rapport : c'est tout ce qu'on demande à ce hachage. */
  function hachage(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }

  /**
   * Cette espèce brille-t-elle ? Toujours la même réponse, sur toutes les
   * machines et à toutes les parties — donc mesurable, et donc reproductible
   * d'une capture à l'autre. Exporté : CL.estBrillante('miaouss').
   */
  function estBrillante(id) {
    if (!id || typeof id !== 'string') return false;
    return hachage(SEL_BRILLANTE + id) < (1 / RARETE_BRILLANTE);
  }

  // ---------------------------------------------------------------------------
  //  Substitution de matériaux — l'astuce qui rend le brillant gratuit.
  // ---------------------------------------------------------------------------
  //  On ne MODIFIE JAMAIS un matériau : ils sont partagés par tout le jeu, et
  //  changer la couleur de celui d'un Pikachu repeindrait aussi les fleurs.
  //  On en demande un AUTRE à R3.mat(), qui le met en cache : le deuxième
  //  Pikachu brillant ne coûte plus rien.
  const _matsBrillants = new Map();

  function materiauBrillant(m) {
    if (!m || m.length !== undefined || !m.color) return null;
    if (_matsBrillants.has(m)) return _matsBrillants.get(m);
    let neuf = null;
    try {
      const cible = couleurBrillante('#' + m.color.getHexString());
      if (cible) {
        let emissive = cible, force = EMISSIF_BRILLANTE;
        // Une pièce qui brillait déjà (boule d'antenne, cœur magique) garde sa
        // force : on ne va pas éteindre une lumière en la rendant brillante.
        if (m.emissive && m.emissive.getHex && m.emissive.getHex() !== 0) {
          emissive = couleurBrillante('#' + m.emissive.getHexString()) || cible;
          force = Math.max(m.emissiveIntensity || 0, EMISSIF_BRILLANTE);
        }
        neuf = R3.mat(cible, {
          rough: m.roughness,
          metal: m.metalness,
          flat: !!m.flatShading,
          transparent: !!m.transparent,
          opacity: m.opacity,
          side: m.side,
          depthWrite: !!m.depthWrite,
          emissive: emissive,
          emissiveIntensity: force,
        });
      }
    } catch (e) { neuf = null; }
    _matsBrillants.set(m, neuf);
    return neuf;
  }

  /** Repeint tout un modèle aux couleurs brillantes. Renvoie le nombre de
   *  pièces effectivement repeintes (0 si la créature est toute grise). */
  function teinteBrillante(g) {
    let n = 0;
    g.traverse(function (o) {
      if (!o.isMesh || o.userData.parure) return;
      const neuf = materiauBrillant(o.material);
      if (neuf) { o.material = neuf; n++; }
    });
    return n;
  }

  // ---------------------------------------------------------------------------
  //  empreinte — la boîte du CORPS, halos et parures exclus.
  // ---------------------------------------------------------------------------
  /** Sert à dimensionner l'ombre et à poser l'anneau d'étincelles. Les auras
   *  sont énormes par nature : incluses, elles donneraient à Nuagette une ombre
   *  de deux tuiles de large. On les reconnaît à leur transparence. */
  function empreinte(g) {
    const b = new THREE.Box3();
    g.updateWorldMatrix(false, true);
    g.traverse(function (o) {
      if (!o.isMesh || o.userData.parure) return;
      const m = o.material;
      if (m && m.length === undefined && m.transparent && m.opacity < 0.7) return;
      if (m && m.blending === THREE.AdditiveBlending) return;
      b.expandByObject(o);
    });
    return b;
  }

  // ---------------------------------------------------------------------------
  //  ombreDeContact — LA PETITE OMBRE SOUS LES PIEDS.
  // ---------------------------------------------------------------------------
  /**
   * Ancrage : les disques sont posés à l'origine du modèle, à ras du sol.
   * o = { boite : une Box3 déjà calculée (sinon on la calcule)
   *       opacite : facteur global (1 par défaut ; 0 supprime l'ombre)
   *       color, y }
   * -> le THREE.Group des disques (déjà ajouté à g), ou null.
   *
   * Deux disques très plats et non éclairés plutôt qu'un seul : le grand pâle
   * fait le halo, le petit sombre fait le point de contact. `depthWrite:false`
   * et un renderOrder négatif pour qu'ils ne se disputent pas la profondeur
   * entre eux ni avec le reste.
   */
  function ombreDeContact(g, o) {
    o = o || {};
    const k = num(o.opacite, 1);
    if (!g || k <= 0) return null;
    const b = (o.boite && !o.boite.isEmpty()) ? o.boite : empreinte(g);
    if (b.isEmpty()) return null;

    const cx = (b.min.x + b.max.x) * 0.5, cz = (b.min.z + b.max.z) * 0.5;
    // L'ombre reprend l'empreinte au sol de la créature, un peu resserrée
    // (0,46 au lieu de 0,50) : une ombre qui déborde de la silhouette se voit
    // tout de suite, une ombre un rien trop petite ne se voit jamais.
    const rx = Math.max(0.16, (b.max.x - b.min.x) * 0.46);
    const rz = Math.max(0.16, (b.max.z - b.min.z) * 0.46);
    const couleur = o.color || OMBRE_COULEUR;
    const y0 = num(o.y, 0.008);
    const grp = new THREE.Group();

    // `seg: 10` : un disque de dix côtés, vu à plat et de loin, est parfaitement
    // rond à l'œil et coûte deux fois moins de triangles qu'à seize.
    const large = R3.ellipsoid(rx * 1.10, 0.004, rz * 1.10, couleur, cx, y0, cz, {
      rough: 1, transparent: true, opacity: OMBRE_OPACITE_LARGE * k,
      depthWrite: false, seg: 10,
    });
    large.renderOrder = -3;
    const serree = R3.ellipsoid(rx * 0.64, 0.004, rz * 0.64, couleur, cx, y0 + 0.004, cz, {
      rough: 1, transparent: true, opacity: OMBRE_OPACITE_SERREE * k,
      depthWrite: false, seg: 10,
    });
    serree.renderOrder = -2;
    grp.add(light(large), light(serree));
    marqueParure(grp);
    g.add(grp);
    g.userData.ombreContact = grp;
    return grp;
  }

  // ---------------------------------------------------------------------------
  //  lisere — LE CONTOUR DU DESSIN, EN TROIS DIMENSIONS.
  // ---------------------------------------------------------------------------
  /**
   * Coque retournée (`BackSide`) légèrement plus grosse que la pièce : on n'en
   * voit que le pourtour, exactement comme le trait noir d'un dessin 2D. C'est
   * le vocabulaire graphique du jeu de Clélia, et ça détache la créature du
   * fond vert même quand elle est loin.
   *
   * La coque est fille de la pièce, pas du modèle : elle hérite donc de TOUTES
   * ses animations (respiration, geste de joie, bond) sans une ligne de plus.
   *
   * o = { pieces : nombre de pièces habillées (par défaut LISERE_PIECES)
   *       epaisseur : en unités monde
   *       color }
   * -> le tableau des coques créées.
   */
  function lisere(g, o) {
    o = o || {};
    const e = num(o.epaisseur, LISERE_EPAISSEUR);
    const n = Math.max(0, Math.round(num(o.pieces, LISERE_PIECES)));
    if (!g || n <= 0 || e <= 0) return [];
    const couleur = o.color || LISERE_COULEUR;

    // On classe les pièces OPAQUES par volume : le corps d'abord, la tête
    // ensuite. Une pièce translucide (bulle, aura, voile) n'a pas de contour.
    const cand = [];
    g.traverse(function (m) {
      if (!m.isMesh || m.userData.parure || !m.geometry) return;
      const mat = m.material;
      if (!mat || mat.length !== undefined) return;
      if (mat.transparent && mat.opacity < 0.95) return;
      if (mat.depthWrite === false) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      if (!bb) return;
      const dx = (bb.max.x - bb.min.x) * Math.abs(m.scale.x);
      const dy = (bb.max.y - bb.min.y) * Math.abs(m.scale.y);
      const dz = (bb.max.z - bb.min.z) * Math.abs(m.scale.z);
      if (!(dx > 1e-4 && dy > 1e-4 && dz > 1e-4)) return;
      cand.push({ m: m, v: dx * dy * dz, dx: dx, dy: dy, dz: dz });
    });
    cand.sort(function (a, b) { return b.v - a.v; });

    const faits = [];
    const coquille = R3.mat(couleur, { rough: 1, side: THREE.BackSide });
    for (let i = 0; i < Math.min(n, cand.length); i++) {
      const c = cand[i];
      // L'échelle est RELATIVE à la pièce : `2e/d` donne la même épaisseur de
      // trait quelle que soit la taille de la pièce — et quelle que soit la
      // façon dont sa taille est exprimée (rayons dans `scale` pour un
      // ellipsoïde, dimensions dans la géométrie pour une boîte).
      const h = new THREE.Mesh(c.m.geometry, coquille);
      h.scale.set(1 + 2 * e / c.dx, 1 + 2 * e / c.dy, 1 + 2 * e / c.dz);
      h.castShadow = false;
      h.receiveShadow = false;
      h.userData.parure = true;
      c.m.add(h);
      faits.push(h);
    }
    return faits;
  }

  // ---------------------------------------------------------------------------
  //  etincellesBrillantes — les étoiles qui tournent autour d'une brillante.
  // ---------------------------------------------------------------------------
  function etincellesBrillantes(g, b) {
    if (ETINCELLES_BRILLANTE <= 0 || !b || b.isEmpty()) return null;
    const rx = (b.max.x - b.min.x) * 0.5, rz = (b.max.z - b.min.z) * 0.5;
    const anneau = sparkleRing({
      count: ETINCELLES_BRILLANTE,
      r: Math.max(0.34, Math.max(rx, rz) + 0.13),
      size: 0.055,
      color: '#fff2a0', color2: '#ffffff',
      wave: 0.07, speed: 1.15, tilt: 0.30,
      y: Math.max(0.25, b.max.y * 0.55),
    });
    marqueParure(anneau);
    g.add(anneau);
    // L'anneau se pilote lui-même — personne n'appelle CL.tick, et il doit
    // continuer de tourner PENDANT le geste de joie : d'où `busy: false`.
    if (typeof anneau.userData.animate === 'function') {
      pilote(anneau, anneau.userData.animate, { busy: false });
    }
    return anneau;
  }

  // ---------------------------------------------------------------------------
  //  eclat — LE POINT D'ENTRÉE UNIQUE. Habille un modèle fraîchement construit.
  // ---------------------------------------------------------------------------
  /**
   * CL.eclat(modele, opts) — idempotent : deux appels ne posent qu'une parure.
   * opts = {
   *   shiny  : true / false pour forcer ; absent -> le tirage par espèce
   *   ombre  : false pour ne pas poser l'ombre de contact (utile là où la scène
   *            en pose déjà une, comme le terrain de combat)
   *   lisere : false pour ne pas poser le liseré
   * }
   * -> le modèle, toujours, même si tout a échoué.
   */
  function eclat(g, opts) {
    if (!g || typeof g.traverse !== 'function') return g;
    if (g.userData.eclatPose) return g;
    g.userData.eclatPose = true;
    opts = opts || {};

    const veutBriller = (opts.shiny === undefined || opts.shiny === null)
      ? estBrillante(g.userData.creatureId)
      : !!opts.shiny;

    let b = null;
    try { b = empreinte(g); } catch (e) { b = null; }

    if (veutBriller) {
      g.userData.shiny = true;
      try { teinteBrillante(g); } catch (e) { /* la parure prime sur l'éclat */ }
      try { etincellesBrillantes(g, b); } catch (e) { /* idem */ }
    }
    if (opts.ombre !== false) {
      try { ombreDeContact(g, { boite: b }); } catch (e) { /* rien de grave */ }
    }
    if (opts.lisere !== false) {
      try { lisere(g); } catch (e) { /* rien de grave */ }
    }
    return g;
  }

  // ===========================================================================
  //  ENREGISTREMENT — les 14 helpers du contrat, puis les bonus.
  // ===========================================================================
  R3.register('kclib', {
    // --- Les 14 du CONTRACT.md ---
    bodyBlob: bodyBlob,
    catHead: catHead,
    birdBeak: birdBeak,
    finTail: finTail,
    petalRing: petalRing,
    antenna: antenna,
    paw: paw,
    ear: ear,
    bubbleTrail: bubbleTrail,
    sparkleRing: sparkleRing,
    leafBlade: leafBlade,
    tentacle: tentacle,
    waterDrop: waterDrop,
    shellSpiral: shellSpiral,

    // --- Bonus (tester leur présence avant usage) ---
    mouthSmile: mouthSmile,
    bigEyes: bigEyes,
    stem: stem,
    eyeStalk: eyeStalk,
    butterflyWing: butterflyWing,
    featherWing: featherWing,
    starBody: starBody,
    glowAura: glowAura,
    cloudPuff: cloudPuff,
    claw: claw,
    acornCap: acornCap,
    swanNeck: swanNeck,

    // --- Outils ---
    tick: tick,        // CL.tick(modele, R3.clock.t) : joue tous les animate()
    chain: chain,      // squelette souple réutilisable
    pilote: pilote,    // CL.pilote(modele, fn) : la vie autonome, par onBeforeRender
    busy: busy,        // CL.busy(racine, p) : « une animation est en cours »

    // --- L'éclat (contrat v5 §21) ---
    eclat: eclat,                       // CL.eclat(modele, opts) : la parure entière
    ombreDeContact: ombreDeContact,     // les deux disques sous les pieds
    lisere: lisere,                     // la coque retournée qui fait le contour
    estBrillante: estBrillante,         // CL.estBrillante('miaouss') -> true/false
    teinteBrillante: teinteBrillante,   // repeint un modèle aux couleurs brillantes
    couleurBrillante: couleurBrillante, // '#f1c40f' -> la même en brillant
    empreinte: empreinte,               // la Box3 du corps, halos exclus
    RARETE_BRILLANTE: RARETE_BRILLANTE,
  });

  // ===========================================================================
  //  RACCORDEMENT — c'est ici, et NULLE PART AILLEURS, que l'éclat entre
  //  réellement dans le jeu.               (couture (d) du contrat v5 §16.1)
  // ===========================================================================
  //  Six fichiers appellent `R3.buildCreature` : battle3d, roamers3d, game3d,
  //  flight3d, crystal3d, growth3d — et la sonde. Aucun ne nous appartient, et
  //  `core3d.js` non plus. On enveloppe donc `R3.buildCreature` une fois pour
  //  toutes, depuis la bibliothèque : chaque modèle sort désormais habillé, où
  //  qu'il soit demandé, sans qu'aucun autre fichier bouge d'une ligne.
  //
  //  Trois précautions :
  //   · la bibliothèque est chargée APRÈS core3d.js et AVANT tous les appelants
  //     (index3d.html, lignes 101 et 114) : l'enveloppe est donc en place avant
  //     le premier appel, et personne ne garde de référence directe à la
  //     fonction d'origine ;
  //   · `__eclat` empêche un double enveloppement si le fichier est chargé
  //     deux fois (la sonde et le jeu, par exemple) ;
  //   · si quoi que ce soit échoue, on rend le modèle NU plutôt que rien :
  //     une créature sans ombre reste une créature, une créature manquante non.
  (function raccorde() {
    try {
      const brut = R3.buildCreature;
      if (typeof brut !== 'function' || brut.__eclat) return;
      const habille = function (id, opts) {
        const g = brut(id);
        try { eclat(g, opts); } catch (e) { /* jamais au prix du modèle */ }
        return g;
      };
      habille.__eclat = true;
      R3.buildCreature = habille;
    } catch (e) {
      // Sans raccord, les modèles restent exactement ceux d'avant : le jeu
      // perd sa parure, il ne perd rien d'autre.
    }
  })();
})();
