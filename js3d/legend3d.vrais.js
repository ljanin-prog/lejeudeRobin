// =============================================================================
//  legend3d.vrais.js — SEPT LÉGENDAIRES REFAITS D'APRÈS LES VRAIS
// =============================================================================
//
//  « je voudrais que les Pokémon légendaires ressemblent aux vrais de la
//   série » — Robin, 9 août 2026.
//
//  Les 36 légendaires du jeu ont été dessinés AVANT qu'on leur donne le nom
//  d'un vrai Pokémon. Le Pokédex l'assume noir sur blanc : « le nom suit
//  L'APPARENCE DÉJÀ DESSINÉE — la panthère est Mewtwo ». Résultat : Groudon
//  était un dragon de lave avec de grandes ailes membranées. Le vrai Groudon
//  n'a pas d'ailes du tout.
//
//  Sept modèles sont donc refaits ici, d'après la vraie silhouette. Sept et pas
//  trente-six : ce sont ceux que Robin croise dans l’histoire (les rivalités de
//  `legends3d.js`) et ceux qui ont une dimension. Les trente autres gardent
//  leur allure maison — elle n'est pas fausse, elle est juste inventée, et il
//  vaut mieux sept créatures justes que trente-six approximations.
//
//  (Six AUTRES avaient déjà reçu leur vraie allure le même jour, reprise du jeu
//  de Clélia : Mewtwo, Rayquaza, Lugia, Ho-Oh, Arceus et Terapagos — voir
//  `legendk3d.js`. Cela fait treize légendaires fidèles sur trente-six.)
//
// -----------------------------------------------------------------------------
//  CE QUI COMPTE POUR QU'ON LES RECONNAISSE
// -----------------------------------------------------------------------------
//  Un Pokémon se reconnaît à TROIS choses, et le volume n'en fait pas partie :
//  la SILHOUETTE (quadrupède trapu ? bipède élancé ? serpent ?), les COULEURS
//  dans leur ordre, et UN détail signature qu'on ne peut pas rater (le diamant
//  de Dialga, les perles de Palkia, les bois de Xerneas). Chaque modèle
//  ci-dessous est construit dans cet ordre, et le détail signature est toujours
//  le plus gros et le plus lumineux.
//
//  Chargé APRÈS `legend3d.p1..p3.js` : le dernier enregistrement gagne, ces
//  sept-là remplacent donc les anciens sans qu'on ait à toucher aux fichiers
//  d'origine, qui restent lisibles et intacts.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || typeof THREE === 'undefined') return;

  function llib() { return (R3.get && R3.get('llib')) || null; }

  // Matières. `rough` mat pour la peau, un peu de métal pour Dialga.
  var PEAU = { rough: 0.85 };
  var DUR = { rough: 0.55, metal: 0.35 };
  var VIF = function (c) { return { emissive: c, emissiveIntensity: 0.55, rough: 0.4 }; };
  var FORT = function (c) { return { emissive: c, emissiveIntensity: 1.0, rough: 0.3 }; };

  /** Les deux côtés d'un coup : évite d'écrire deux fois chaque membre. */
  function paire(fn) { fn(-1); fn(1); }

  /**
   * Termine un modèle à la manière de `legend3d.p1.js` : marque légendaire,
   * pose l'aura, branche l'animation d'attaque et l'animation de repos.
   * On reproduit ce contrat plutôt que de l'importer — les lots p1..p3 gardent
   * leurs helpers privés, et on ne va pas les ouvrir pour six modèles.
   */
  function finir(g, o) {
    g.userData.legendary = true;
    g.userData.auraColor = o.aura;
    g.userData.anim = o.anim || {};
    var LL = llib();
    if (LL && LL.aura) {
      try { g.add(LL.aura(o.aura, o.rayon || 1.4, { rings: 1, particles: 0, shape: 'sphere' })); }
      catch (e) { /* l'aura est un bonus, pas une obligation */ }
    }
    g.userData.attack = function (root, p) {
      var k = R3.clamp01(p);
      try { o.attack(k); } catch (e) { /* une attaque ne casse jamais le jeu */ }
      if (LL && LL.animateAura) { try { LL.animateAura(g, R3.clock.t); } catch (e) {} }
    };
    if (LL && LL.autoAnimate) { try { LL.autoAnimate(g); } catch (e) {} }
    return g;
  }

  /** Une patte épaisse : cuisse + tibia + pied. Sert aux quadrupèdes. */
  function patte(x, z, h, ep, couleur, griffe) {
    var p = new THREE.Group();
    p.position.set(x, 0, z);
    p.add(R3.ellipsoid(ep, h * 0.42, ep * 1.1, couleur, 0, h * 0.62, 0, PEAU));
    p.add(R3.cyl(ep * 0.72, ep * 0.82, h * 0.55, couleur, 0, h * 0.28, 0, PEAU));
    p.add(R3.ellipsoid(ep * 1.05, ep * 0.55, ep * 1.35, couleur, 0, ep * 0.5, 0.05, PEAU));
    if (griffe) {
      for (var i = -1; i <= 1; i++) {
        var c = R3.cone(ep * 0.24, ep * 0.62, griffe, i * ep * 0.55, ep * 0.35, 0.16 + ep * 0.6, PEAU);
        c.rotation.x = 1.35;
        p.add(c);
      }
    }
    return p;
  }

  // ===========================================================================
  //  GROUDON  (pyrathos) — LE CONTINENT QUI MARCHE
  //
  //  Silhouette : quadrupède TRAPU, très bas sur pattes, dos plus haut que la
  //  tête. Rouge sombre, ventre et plaques gris pierre, griffes blanches.
  //  Signature : les plaques grises qui saillent des flancs et du dos, et la
  //  queue épaisse hérissée de pointes. Aucune aile — c'est l'erreur qu'on
  //  corrige ici.
  // ===========================================================================
  R3.registerCreature('pyrathos', function () {
    var ROUGE = '#c0392b', SOMBRE = '#8e2b12', PIERRE = '#7f8c8d', BLANC = '#ecf0f1', FEU = '#ff8c42';
    var g = new THREE.Group();

    var corps = new THREE.Group();
    corps.position.set(0, 0.62, 0);
    g.add(corps);
    // POSTURE. Premier essai : un quadrupède bas et large. Vu à l'écran, on ne
    // lisait qu'une masse ronde — la caméra de combat regarde d'un peu haut,
    // et un animal ramassé lui présente surtout son dos. Le vrai Groudon est
    // d'ailleurs SEMI-DRESSÉ : il prend appui sur ses pattes arrière, torse
    // relevé, bras courts en avant. On redresse donc le buste et on allonge
    // l'arrière-train, pour que la silhouette se lise de face.
    corps.add(R3.ellipsoid(0.48, 0.40, 0.60, ROUGE, 0, 0.02, -0.28, PEAU));   // arrière-train
    corps.add(R3.ellipsoid(0.44, 0.48, 0.42, ROUGE, 0, 0.42, 0.16, PEAU));    // buste redressé
    corps.add(R3.ellipsoid(0.32, 0.34, 0.26, PIERRE, 0, 0.38, 0.38, PEAU));   // plastron gris
    // Les deux bras courts à griffes blanches, bien en avant du corps.
    paire(function (s) {
      var bras = R3.cyl(0.11, 0.09, 0.38, ROUGE, s * 0.40, 0.34, 0.26, PEAU);
      bras.rotation.z = s * 0.55; bras.rotation.x = -0.35;
      corps.add(bras);
      var poing = R3.ellipsoid(0.13, 0.12, 0.13, ROUGE, s * 0.52, 0.14, 0.40, PEAU);
      corps.add(poing);
      for (var i = -1; i <= 1; i++) {
        var gr = R3.cone(0.035, 0.17, BLANC, s * 0.52 + i * 0.07, 0.06, 0.48, PEAU);
        gr.rotation.x = 0.8;
        corps.add(gr);
      }
    });

    // Les plaques. Elles dépassent franchement du corps : de loin, ce sont
    // elles qu'on voit avant la couleur.
    paire(function (s) {
      var pl = R3.box(0.10, 0.34, 0.44, PIERRE, s * 0.48, 0.44, 0.06, PEAU);
      pl.rotation.z = s * 0.30;
      corps.add(pl);
      var pl2 = R3.box(0.08, 0.22, 0.34, PIERRE, s * 0.44, 0.16, -0.34, PEAU);
      pl2.rotation.z = s * 0.5;
      corps.add(pl2);
    });
    // Crête dorsale : trois plaques qui descendent vers la queue.
    [[0.52, -0.14], [0.40, -0.38], [0.28, -0.58]].forEach(function (p) {
      corps.add(R3.box(0.28, 0.16, 0.10, PIERRE, 0, p[0], p[1], PEAU));
    });

    // Deux pattes arrière seulement : le poids repose derrière, comme chez le
    // vrai. Les « pattes avant » sont les bras, plus haut.
    corps.add(patte(-0.34, -0.30, 0.62, 0.19, ROUGE, BLANC));
    corps.add(patte(0.34, -0.30, 0.62, 0.19, ROUGE, BLANC));

    // Tête : massive, mâchoire lourde, deux cornes grises vers l'arrière.
    var tete = new THREE.Group();
    tete.position.set(0, 1.14, 0.42);
    g.add(tete);
    tete.add(R3.ellipsoid(0.26, 0.24, 0.34, ROUGE, 0, 0, 0, PEAU));
    tete.add(R3.ellipsoid(0.19, 0.14, 0.26, ROUGE, 0, -0.09, 0.26, PEAU));      // museau
    tete.add(R3.ellipsoid(0.16, 0.07, 0.22, PIERRE, 0, -0.15, 0.28, PEAU));     // mâchoire
    tete.add(R3.ellipsoid(0.12, 0.05, 0.14, FEU, 0, -0.11, 0.36, VIF(FEU)));    // gueule
    paire(function (s) {
      var corne = R3.cone(0.07, 0.36, PIERRE, s * 0.20, 0.14, -0.10, PEAU);
      corne.rotation.z = -s * 0.55; corne.rotation.x = -0.5;
      tete.add(corne);
    });
    tete.add(R3.eyes ? R3.eyes(0.15, 0.06, 0.24, 0.055, '#f1c40f') :
      R3.ellipsoid(0.05, 0.05, 0.05, '#f1c40f', 0, 0.06, 0.24, FORT('#f1c40f')));

    // Queue épaisse à pointes : elle prolonge le corps, elle ne pend pas.
    var queue = new THREE.Group();
    queue.position.set(0, 0.56, -0.72);
    g.add(queue);
    queue.add(R3.ellipsoid(0.24, 0.20, 0.34, ROUGE, 0, 0, -0.20, PEAU));
    queue.add(R3.ellipsoid(0.16, 0.14, 0.28, ROUGE, 0, -0.04, -0.56, PEAU));
    [[-0.18, -0.30], [0.18, -0.30], [-0.12, -0.62], [0.12, -0.62]].forEach(function (p) {
      var pointe = R3.cone(0.06, 0.24, PIERRE, p[0], 0.10, p[1], PEAU);
      pointe.rotation.x = -0.7;
      queue.add(pointe);
    });

    return finir(g, {
      aura: FEU, rayon: 1.15,
      anim: { head: tete, tail: queue, float: false },
      attack: function (p) {
        // Il se cabre et frappe le sol : tout le corps monte puis retombe.
        var k = Math.sin(p * Math.PI);
        corps.rotation.x = -k * 0.30;
        corps.position.y = 0.60 + k * 0.18;
        tete.rotation.x = k * 0.45;
        queue.rotation.x = -k * 0.35;
      },
    });
  });

  // ===========================================================================
  //  KYOGRE  (abyssalor) — LA BALEINE DES ABYSSES
  //
  //  Silhouette : un corps d'orque massif qui NAGE dans l'air (il ne pose pas
  //  de pattes — il n'en a pas). Bleu très sombre dessus, blanc dessous.
  //  Signature : les deux immenses nageoires pectorales, plus longues que le
  //  corps, et les traits rouges qui les traversent.
  // ===========================================================================
  R3.registerCreature('abyssalor', function () {
    var BLEU = '#1b3f78', CLAIR = '#2f7fb8', BLANC = '#ecf0f1', ROUGE = '#c0392b', OEIL = '#f1c40f';
    var g = new THREE.Group();

    var corps = new THREE.Group();
    corps.position.set(0, 0.92, 0);
    g.add(corps);
    corps.add(R3.ellipsoid(0.42, 0.40, 0.86, BLEU, 0, 0, 0, PEAU));            // tronc
    corps.add(R3.ellipsoid(0.34, 0.30, 0.44, BLEU, 0, 0.02, 0.62, PEAU));      // tête fondue au corps
    corps.add(R3.ellipsoid(0.30, 0.20, 0.70, BLANC, 0, -0.22, 0.10, PEAU));    // ventre blanc
    corps.add(R3.ellipsoid(0.20, 0.12, 0.26, BLANC, 0, -0.14, 0.66, PEAU));
    // Les traits rouges du dos, la marque de fabrique.
    [[0, 0.34, 0.30], [0, 0.36, -0.02], [0, 0.32, -0.34]].forEach(function (p) {
      corps.add(R3.box(0.30, 0.05, 0.12, ROUGE, p[0], p[1], p[2], VIF(ROUGE)));
    });
    corps.add(R3.ellipsoid(0.16, 0.06, 0.16, ROUGE, 0, 0.30, 0.52, VIF(ROUGE)));

    // Nageoires pectorales : énormes, incurvées, terminées en pointe.
    var nageL = new THREE.Group(), nageR = new THREE.Group();
    paire(function (s) {
      var n = (s < 0) ? nageL : nageR;
      n.position.set(s * 0.38, 0.86, 0.18);
      g.add(n);
      var bras = R3.ellipsoid(0.46, 0.09, 0.24, BLEU, s * 0.44, 0, -0.06, PEAU);
      bras.rotation.z = -s * 0.22;
      n.add(bras);
      var bout = R3.ellipsoid(0.34, 0.07, 0.16, BLEU, s * 0.96, -0.10, -0.22, PEAU);
      bout.rotation.z = -s * 0.5;
      n.add(bout);
      var trait = R3.box(0.60, 0.035, 0.07, ROUGE, s * 0.52, 0.04, -0.02, VIF(ROUGE));
      trait.rotation.z = -s * 0.22;
      n.add(trait);
      var pointe = R3.cone(0.07, 0.26, BLEU, s * 1.22, -0.20, -0.30, PEAU);
      pointe.rotation.z = s * 1.2;
      n.add(pointe);
    });

    // Deux nageoires caudales en pointe, écartées en V.
    var queue = new THREE.Group();
    queue.position.set(0, 0.92, -0.80);
    g.add(queue);
    paire(function (s) {
      var c = R3.cone(0.13, 0.52, BLEU, s * 0.20, 0.06, -0.24, PEAU);
      c.rotation.x = -1.35; c.rotation.z = -s * 0.45;
      queue.add(c);
    });

    g.add(R3.ellipsoid(0.055, 0.045, 0.04, OEIL, -0.24, 0.98, 0.76, FORT(OEIL)));
    g.add(R3.ellipsoid(0.055, 0.045, 0.04, OEIL, 0.24, 0.98, 0.76, FORT(OEIL)));

    return finir(g, {
      aura: CLAIR, rayon: 1.55,
      anim: { head: corps, wingL: nageL, wingR: nageR, tail: queue, float: true },
      attack: function (p) {
        // Il ondule comme s'il nageait, puis donne un coup de queue.
        var k = Math.sin(p * Math.PI * 2);
        corps.rotation.x = k * 0.16;
        corps.position.y = 0.92 + Math.sin(p * Math.PI) * 0.22;
        nageL.rotation.x = k * 0.5; nageR.rotation.x = -k * 0.5;
        queue.rotation.y = k * 0.4;
      },
    });
  });

  // ===========================================================================
  //  DIALGA  (chronoss) — LE DRAGON D'ACIER DU TEMPS
  //
  //  Silhouette : quadrupède haut sur pattes, long museau, crête métallique.
  //  Bleu acier, plaques gris métal, articulations dorées.
  //  Signature : LE DIAMANT BLEU au milieu du poitrail. C'est le plus gros
  //  détail lumineux du modèle, et il doit se voir avant tout le reste.
  // ===========================================================================
  R3.registerCreature('chronoss', function () {
    var ACIER = '#4a6b9a', METAL = '#8fa3bf', SOMBRE = '#2b3f5e', DIAM = '#41a6f6', OR = '#d4af37';
    var g = new THREE.Group();

    var corps = new THREE.Group();
    corps.position.set(0, 0.78, 0);
    g.add(corps);
    corps.add(R3.ellipsoid(0.40, 0.38, 0.66, ACIER, 0, 0.04, -0.04, DUR));
    corps.add(R3.ellipsoid(0.36, 0.34, 0.36, ACIER, 0, 0.10, 0.46, DUR));       // poitrail
    corps.add(R3.ellipsoid(0.30, 0.22, 0.30, METAL, 0, -0.16, 0.34, DUR));      // plastron

    // LE DIAMANT. Un octaèdre (deux cônes dos à dos) qui pulse.
    var diamant = new THREE.Group();
    diamant.position.set(0, 0.92, 0.50);
    g.add(diamant);
    var haut = R3.cone(0.14, 0.22, DIAM, 0, 0.11, 0, FORT(DIAM));
    var bas = R3.cone(0.14, 0.22, DIAM, 0, -0.11, 0, FORT(DIAM));
    bas.rotation.x = Math.PI;
    diamant.add(haut, bas);

    // Plaques d'épaule et de hanche.
    paire(function (s) {
      var ep = R3.ellipsoid(0.16, 0.16, 0.20, METAL, s * 0.38, 0.22, 0.28, DUR);
      corps.add(ep);
      corps.add(R3.ellipsoid(0.14, 0.14, 0.18, METAL, s * 0.36, 0.08, -0.40, DUR));
    });
    // Crête dorsale en lames.
    [[0.34, 0.10], [0.38, -0.16], [0.32, -0.42]].forEach(function (p) {
      var l = R3.box(0.06, 0.22, 0.20, METAL, 0, p[0], p[1], DUR);
      corps.add(l);
    });

    corps.add(patte(-0.32, 0.36, 0.66, 0.14, ACIER, METAL));
    corps.add(patte(0.32, 0.36, 0.66, 0.14, ACIER, METAL));
    corps.add(patte(-0.34, -0.36, 0.70, 0.15, ACIER, METAL));
    corps.add(patte(0.34, -0.36, 0.70, 0.15, ACIER, METAL));

    // Tête : long museau, crête qui part vers l'arrière, deux « ailerons ».
    var tete = new THREE.Group();
    tete.position.set(0, 1.24, 0.52);
    g.add(tete);
    tete.add(R3.ellipsoid(0.20, 0.19, 0.26, ACIER, 0, 0, 0, DUR));
    tete.add(R3.ellipsoid(0.13, 0.11, 0.30, ACIER, 0, -0.05, 0.32, DUR));       // museau long
    tete.add(R3.ellipsoid(0.10, 0.06, 0.24, METAL, 0, -0.10, 0.34, DUR));
    var crete = R3.cone(0.10, 0.34, METAL, 0, 0.18, -0.16, DUR);
    crete.rotation.x = 0.9;
    tete.add(crete);
    paire(function (s) {
      var ail = R3.box(0.04, 0.16, 0.26, METAL, s * 0.20, 0.06, -0.10, DUR);
      ail.rotation.z = -s * 0.4;
      tete.add(ail);
      tete.add(R3.ellipsoid(0.045, 0.035, 0.035, DIAM, s * 0.13, 0.03, 0.20, FORT(DIAM)));
    });
    tete.add(R3.ellipsoid(0.05, 0.05, 0.05, OR, 0, 0.14, 0.10, VIF(OR)));       // gemme frontale

    // Longue queue segmentée, tenue haute.
    var queue = new THREE.Group();
    queue.position.set(0, 0.82, -0.62);
    g.add(queue);
    queue.add(R3.ellipsoid(0.16, 0.15, 0.30, ACIER, 0, 0.02, -0.20, DUR));
    queue.add(R3.ellipsoid(0.11, 0.10, 0.28, ACIER, 0, 0.06, -0.56, DUR));
    queue.add(R3.cone(0.09, 0.30, METAL, 0, 0.10, -0.86, DUR));

    return finir(g, {
      aura: DIAM, rayon: 1.5,
      anim: { head: tete, tail: queue, float: false },
      attack: function (p) {
        // Le diamant s'embrase, la tête plonge, la queue fouette.
        var k = Math.sin(p * Math.PI);
        diamant.scale.setScalar(1 + k * 0.7);
        tete.rotation.x = k * 0.4;
        corps.position.z = k * 0.16;
        queue.rotation.y = Math.sin(p * Math.PI * 3) * 0.3;
      },
    });
  });

  // ===========================================================================
  //  PALKIA  (vortexis) — LE GARDIEN DE L'ESPACE
  //
  //  Silhouette : BIPÈDE, dressé, élancé — l'inverse de Dialga, et c'est ce
  //  contraste qui les rend reconnaissables l'un par rapport à l'autre.
  //  Blanc gris, rayures roses.
  //  Signature : les deux PERLES ROSES encastrées dans les épaules.
  // ===========================================================================
  R3.registerCreature('vortexis', function () {
    var BLANC = '#dfe4ec', GRIS = '#9aa4b8', ROSE = '#ff8fc8', VIOLET = '#7f6ae0';
    var g = new THREE.Group();

    var corps = new THREE.Group();
    corps.position.set(0, 0.70, 0);
    g.add(corps);
    corps.add(R3.ellipsoid(0.34, 0.46, 0.34, BLANC, 0, 0.34, 0, PEAU));        // buste dressé
    corps.add(R3.ellipsoid(0.32, 0.30, 0.32, BLANC, 0, -0.06, -0.04, PEAU));   // bassin
    corps.add(R3.ellipsoid(0.24, 0.30, 0.20, GRIS, 0, 0.30, 0.22, PEAU));      // plastron

    // LES PERLES. Grosses, roses, brillantes, une à chaque épaule.
    var perleL = null, perleR = null;
    paire(function (s) {
      var ep = R3.ellipsoid(0.20, 0.18, 0.20, BLANC, s * 0.36, 0.58, 0, PEAU);
      corps.add(ep);
      var perle = R3.sphere ? R3.sphere(0.115, ROSE, s * 0.44, 0.60, 0.06, FORT(ROSE))
                            : R3.ellipsoid(0.115, 0.115, 0.115, ROSE, s * 0.44, 0.60, 0.06, FORT(ROSE));
      corps.add(perle);
      if (s < 0) perleL = perle; else perleR = perle;
      // Bras fins terminés par trois griffes.
      var bras = R3.cyl(0.075, 0.06, 0.44, BLANC, s * 0.42, 0.30, 0.06, PEAU);
      bras.rotation.z = s * 0.22;
      corps.add(bras);
      for (var i = -1; i <= 1; i++) {
        var gr = R3.cone(0.03, 0.14, GRIS, s * 0.50 + i * 0.05, 0.06, 0.12, PEAU);
        gr.rotation.x = 0.5;
        corps.add(gr);
      }
      // Aileron rose sur l'avant-bras : le second détail rose.
      var ail = R3.box(0.03, 0.20, 0.16, ROSE, s * 0.52, 0.30, -0.02, VIF(ROSE));
      ail.rotation.z = s * 0.22;
      corps.add(ail);
    });

    // Deux grandes jambes, posture stable.
    corps.add(patte(-0.20, 0.02, 0.60, 0.15, BLANC, GRIS));
    corps.add(patte(0.20, 0.02, 0.60, 0.15, BLANC, GRIS));

    // Tête : museau court, crête pointue, bande rose sur le crâne.
    var tete = new THREE.Group();
    tete.position.set(0, 1.42, 0.06);
    g.add(tete);
    tete.add(R3.ellipsoid(0.19, 0.18, 0.22, BLANC, 0, 0, 0, PEAU));
    tete.add(R3.ellipsoid(0.12, 0.10, 0.20, BLANC, 0, -0.05, 0.22, PEAU));
    tete.add(R3.box(0.06, 0.05, 0.28, ROSE, 0, 0.14, 0.02, VIF(ROSE)));
    var pointe = R3.cone(0.08, 0.30, BLANC, 0, 0.16, -0.14, PEAU);
    pointe.rotation.x = 1.0;
    tete.add(pointe);
    paire(function (s) {
      tete.add(R3.ellipsoid(0.045, 0.035, 0.03, VIOLET, s * 0.12, 0.02, 0.16, FORT(VIOLET)));
    });

    // Queue épaisse, tenue derrière pour l'équilibre.
    var queue = new THREE.Group();
    queue.position.set(0, 0.62, -0.32);
    g.add(queue);
    queue.add(R3.ellipsoid(0.17, 0.16, 0.30, BLANC, 0, 0, -0.20, PEAU));
    queue.add(R3.ellipsoid(0.11, 0.10, 0.26, BLANC, 0, -0.06, -0.52, PEAU));
    queue.add(R3.box(0.05, 0.18, 0.20, ROSE, 0, 0.06, -0.36, VIF(ROSE)));

    return finir(g, {
      aura: ROSE, rayon: 1.45,
      anim: { head: tete, tail: queue, float: false },
      attack: function (p) {
        // Il ouvre les bras : les deux perles s'allument d'un coup.
        var k = Math.sin(p * Math.PI);
        if (perleL) perleL.scale.setScalar(1 + k * 0.9);
        if (perleR) perleR.scale.setScalar(1 + k * 0.9);
        corps.rotation.x = -k * 0.18;
        tete.rotation.x = -k * 0.25;
        queue.rotation.x = k * 0.3;
      },
    });
  });

  // ===========================================================================
  //  GIRATINA  (sablion) — LA FORME ORIGINELLE
  //
  //  Silhouette : un LONG SERPENT qui flotte, sans pattes au sol, avec six
  //  crochets noirs sortis du dos comme des pattes d'insecte.
  //  Noir, bandes dorées, six pointes rouges autour de la tête.
  //  Signature : les six crochets, et la couronne rouge.
  // ===========================================================================
  R3.registerCreature('sablion', function () {
    var NOIR = '#2a1f3d', OMBRE = '#1a1226', OR = '#d4af37', ROUGE = '#c0392b', OEIL = '#ff4d4d';
    var g = new THREE.Group();

    // Le corps : six anneaux de plus en plus fins, qui ondulent.
    var corps = new THREE.Group();
    corps.position.set(0, 1.00, 0);
    g.add(corps);
    var anneaux = [];
    for (var i = 0; i < 6; i++) {
      var t = i / 5;
      var seg = R3.ellipsoid(0.30 - t * 0.16, 0.28 - t * 0.15, 0.30 - t * 0.14,
        NOIR, 0, 0, -i * 0.34, PEAU);
      corps.add(seg);
      anneaux.push(seg);
      // Bande dorée entre deux segments : c'est elle qui donne le rythme.
      if (i < 5) {
        corps.add(R3.torus(0.26 - t * 0.13, 0.035, OR, 0, 0, -i * 0.34 - 0.17,
          { emissive: OR, emissiveIntensity: 0.5, rough: 0.4 }));
      }
    }

    // Les six crochets : trois de chaque côté, courbés vers l'avant.
    var crochets = [];
    for (var j = 0; j < 3; j++) {
      (function (j2) {
        paire(function (s) {
          var c = new THREE.Group();
          c.position.set(s * 0.24, 0.06, -0.10 - j2 * 0.36);
          corps.add(c);
          var bras = R3.cyl(0.05, 0.035, 0.42, OMBRE, s * 0.16, 0.06, 0, PEAU);
          bras.rotation.z = s * 0.9;
          c.add(bras);
          var pointe = R3.cone(0.05, 0.30, ROUGE, s * 0.34, 0.16, 0.10, VIF(ROUGE));
          pointe.rotation.z = s * 1.3; pointe.rotation.x = -0.5;
          c.add(pointe);
          crochets.push(c);
        });
      })(j);
    }

    // Tête : plate, large, entourée de six pointes rouges en couronne.
    var tete = new THREE.Group();
    tete.position.set(0, 1.06, 0.44);
    g.add(tete);
    tete.add(R3.ellipsoid(0.24, 0.18, 0.28, NOIR, 0, 0, 0, PEAU));
    tete.add(R3.ellipsoid(0.15, 0.11, 0.20, NOIR, 0, -0.03, 0.24, PEAU));
    tete.add(R3.box(0.22, 0.04, 0.10, OR, 0, 0.12, 0.06, VIF(OR)));
    for (var k2 = 0; k2 < 6; k2++) {
      var a = (k2 / 6) * Math.PI * 2;
      var pk = R3.cone(0.045, 0.30, ROUGE, Math.sin(a) * 0.24, 0.06, Math.cos(a) * 0.18 - 0.06, VIF(ROUGE));
      pk.rotation.z = -Math.sin(a) * 1.1;
      pk.rotation.x = Math.cos(a) * 0.9;
      tete.add(pk);
    }
    paire(function (s) {
      tete.add(R3.ellipsoid(0.05, 0.035, 0.03, OEIL, s * 0.13, 0.03, 0.20, FORT(OEIL)));
    });

    return finir(g, {
      aura: '#b05ca0', rayon: 1.5,
      anim: { head: tete, float: true },
      attack: function (p) {
        // Il ondule d'un bout à l'autre, comme un fouet.
        for (var i2 = 0; i2 < anneaux.length; i2++) {
          anneaux[i2].position.x = Math.sin(p * Math.PI * 2 + i2 * 0.8) * 0.16 * (i2 / 5);
        }
        for (var c2 = 0; c2 < crochets.length; c2++) {
          crochets[c2].rotation.x = Math.sin(p * Math.PI * 2 + c2) * 0.4;
        }
        tete.rotation.x = Math.sin(p * Math.PI) * 0.4;
      },
    });
  });

  // ===========================================================================
  //  XERNEAS  (sylvaros) — LE CERF DE LA VIE
  //
  //  Silhouette : un cerf ÉLANCÉ, très haut sur pattes fines, cou droit.
  //  Corps bleu nuit, sabots noirs.
  //  Signature : les bois immenses, en forme d'arbre, dont chaque pointe
  //  s'allume d'une couleur différente. C'est le seul modèle du jeu avec sept
  //  couleurs vives d'un coup — et c'est exactement ce qui le rend unique.
  // ===========================================================================
  R3.registerCreature('sylvaros', function () {
    var BLEU = '#1f3b7a', SOMBRE = '#14264d', BOIS = '#e8e4d8', OEIL = '#41a6f6';
    var ARC = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#41a6f6', '#7f6ae0', '#ff8fc8'];
    var g = new THREE.Group();

    var corps = new THREE.Group();
    corps.position.set(0, 0.86, 0);
    g.add(corps);
    corps.add(R3.ellipsoid(0.26, 0.26, 0.52, BLEU, 0, 0, -0.06, PEAU));
    corps.add(R3.ellipsoid(0.22, 0.22, 0.26, BLEU, 0, 0.06, 0.34, PEAU));
    corps.add(R3.ellipsoid(0.18, 0.14, 0.34, SOMBRE, 0, -0.18, 0.02, PEAU));

    // Quatre pattes fines : la finesse fait tout le contraste avec Groudon.
    [[-0.17, 0.30], [0.17, 0.30], [-0.18, -0.32], [0.18, -0.32]].forEach(function (p) {
      var j = new THREE.Group();
      j.position.set(p[0], 0, p[1]);
      corps.add(j);
      j.add(R3.cyl(0.055, 0.04, 0.82, BLEU, 0, -0.42, 0, PEAU));
      j.add(R3.ellipsoid(0.055, 0.05, 0.07, SOMBRE, 0, -0.83, 0.01, PEAU));
    });

    // Cou droit et tête fine.
    var cou = R3.cyl(0.10, 0.13, 0.46, BLEU, 0, 1.16, 0.34, PEAU);
    cou.rotation.x = -0.30;
    g.add(cou);
    var tete = new THREE.Group();
    tete.position.set(0, 1.44, 0.46);
    g.add(tete);
    tete.add(R3.ellipsoid(0.13, 0.13, 0.18, BLEU, 0, 0, 0, PEAU));
    tete.add(R3.ellipsoid(0.08, 0.07, 0.15, BLEU, 0, -0.04, 0.18, PEAU));
    tete.add(R3.ellipsoid(0.05, 0.04, 0.05, SOMBRE, 0, -0.05, 0.30, PEAU));
    paire(function (s) {
      tete.add(R3.ellipsoid(0.04, 0.035, 0.03, OEIL, s * 0.09, 0.03, 0.13, FORT(OEIL)));
      var or = R3.cone(0.035, 0.14, BLEU, s * 0.11, 0.12, -0.02, PEAU);
      or.rotation.z = -s * 0.5;
      tete.add(or);
    });

    // LES BOIS. Deux troncs qui montent, chacun avec des branches, et sept
    // pointes colorées au bout — la signature du personnage.
    var bois = new THREE.Group();
    bois.position.set(0, 1.56, 0.34);
    g.add(bois);
    var pointes = [];
    paire(function (s) {
      var tronc = R3.cyl(0.035, 0.05, 0.52, BOIS, s * 0.11, 0.26, -0.04, PEAU);
      tronc.rotation.z = -s * 0.24;
      bois.add(tronc);
      for (var b = 0; b < 4; b++) {
        var h = 0.20 + b * 0.16;
        var lg = 0.26 - b * 0.03;
        var br = R3.cyl(0.026, 0.02, lg, BOIS, s * (0.16 + b * 0.07), h + 0.10, -0.06 + b * 0.03, PEAU);
        br.rotation.z = -s * (0.7 + b * 0.12);
        bois.add(br);
        var couleur = ARC[(b + (s < 0 ? 0 : 3)) % ARC.length];
        var pt = R3.ellipsoid(0.05, 0.05, 0.05, couleur,
          s * (0.24 + b * 0.10), h + 0.20, -0.06 + b * 0.03, FORT(couleur));
        bois.add(pt);
        pointes.push(pt);
      }
    });
    var sommet = R3.ellipsoid(0.055, 0.055, 0.055, ARC[6], 0, 0.62, -0.04, FORT(ARC[6]));
    bois.add(sommet);
    pointes.push(sommet);

    return finir(g, {
      aura: '#2ecc71', rayon: 1.5,
      anim: { head: tete, float: false },
      attack: function (p) {
        // Les sept couleurs s'allument l'une après l'autre, puis tout éclate.
        for (var i = 0; i < pointes.length; i++) {
          var phase = R3.clamp01(p * 2 - i * 0.06);
          pointes[i].scale.setScalar(1 + Math.sin(phase * Math.PI) * 1.1);
        }
        tete.rotation.x = -Math.sin(p * Math.PI) * 0.35;
        bois.rotation.x = -Math.sin(p * Math.PI) * 0.20;
      },
    });
  });

  // ===========================================================================
  //  KYUREM  (cryonix) — LE DRAGON DE GLACE INACHEVÉ
  //
  //  Silhouette : bipède voûté, ailes brisées et asymétriques, corps gris-bleu
  //  pris dans la glace. Il a l'air abîmé — c'est le personnage.
  //  Signature : les blocs de glace qui poussent hors de son dos et de sa
  //  queue, et l'œil jaune unique qui perce sous la glace.
  // ===========================================================================
  R3.registerCreature('cryonix', function () {
    var CORPS = '#7f96a8', GLACE = '#a8e6ff', PROFOND = '#4a6b80', OEIL = '#f1c40f';
    var g = new THREE.Group();

    var corps = new THREE.Group();
    corps.position.set(0, 0.72, 0);
    g.add(corps);
    corps.add(R3.ellipsoid(0.36, 0.44, 0.36, CORPS, 0, 0.30, 0.02, PEAU));
    corps.add(R3.ellipsoid(0.34, 0.30, 0.34, CORPS, 0, -0.06, -0.06, PEAU));
    corps.add(R3.ellipsoid(0.24, 0.28, 0.22, PROFOND, 0, 0.26, 0.24, PEAU));

    // Les blocs de glace : irréguliers, plantés de travers. C'est le désordre
    // qui fait lire « inachevé » plutôt que « décoré ».
    var glacons = [];
    [[-0.30, 0.56, -0.14, 0.18, 0.7], [0.34, 0.42, -0.20, 0.22, -0.5],
     [-0.10, 0.72, -0.26, 0.16, 0.2], [0.18, 0.66, -0.30, 0.14, -0.9],
     [0.00, 0.20, -0.42, 0.20, 0.4]].forEach(function (b) {
      var m = R3.cone(b[3] * 0.6, b[3] * 2.0, GLACE, b[0], b[1], b[2],
        { transparent: true, opacity: 0.85, emissive: GLACE, emissiveIntensity: 0.5, rough: 0.2 });
      m.rotation.z = b[4]; m.rotation.x = -0.4;
      corps.add(m);
      glacons.push(m);
    });

    corps.add(patte(-0.20, 0.04, 0.58, 0.15, CORPS, GLACE));
    corps.add(patte(0.20, 0.04, 0.58, 0.15, CORPS, GLACE));

    // Ailes brisées, franchement asymétriques.
    var aileL = new THREE.Group(), aileR = new THREE.Group();
    paire(function (s) {
      var a = (s < 0) ? aileL : aileR;
      a.position.set(s * 0.34, 1.04, -0.10);
      g.add(a);
      var lg = (s < 0) ? 0.62 : 0.44;                  // la droite est cassée
      var os = R3.cyl(0.045, 0.03, lg, PROFOND, s * lg * 0.5, 0.10, 0, PEAU);
      os.rotation.z = -s * 1.1;
      a.add(os);
      var voile = R3.ellipsoid(lg * 0.5, 0.16, 0.06, GLACE, s * lg * 0.5, -0.02, -0.04,
        { transparent: true, opacity: 0.7, emissive: GLACE, emissiveIntensity: 0.35, rough: 0.25 });
      voile.rotation.z = -s * 0.4;
      a.add(voile);
    });

    // Tête : mâchoire lourde, corne unique, un seul œil qui brille.
    var tete = new THREE.Group();
    tete.position.set(0, 1.28, 0.20);
    g.add(tete);
    tete.add(R3.ellipsoid(0.19, 0.18, 0.24, CORPS, 0, 0, 0, PEAU));
    tete.add(R3.ellipsoid(0.13, 0.10, 0.22, CORPS, 0, -0.06, 0.24, PEAU));
    tete.add(R3.ellipsoid(0.11, 0.05, 0.18, PROFOND, 0, -0.11, 0.26, PEAU));
    var corne = R3.cone(0.06, 0.34, GLACE, 0, 0.20, -0.02,
      { transparent: true, opacity: 0.9, emissive: GLACE, emissiveIntensity: 0.6, rough: 0.2 });
    corne.rotation.x = -0.25;
    tete.add(corne);
    tete.add(R3.ellipsoid(0.055, 0.045, 0.035, OEIL, -0.11, 0.03, 0.18, FORT(OEIL)));
    tete.add(R3.ellipsoid(0.035, 0.030, 0.03, PROFOND, 0.11, 0.03, 0.18, PEAU));   // l'autre est éteint

    var queue = new THREE.Group();
    queue.position.set(0, 0.68, -0.40);
    g.add(queue);
    queue.add(R3.ellipsoid(0.15, 0.14, 0.28, CORPS, 0, 0, -0.18, PEAU));
    var boutGlace = R3.cone(0.14, 0.42, GLACE, 0, 0.04, -0.48,
      { transparent: true, opacity: 0.85, emissive: GLACE, emissiveIntensity: 0.55, rough: 0.2 });
    boutGlace.rotation.x = -1.4;
    queue.add(boutGlace);

    return finir(g, {
      aura: GLACE, rayon: 1.5,
      anim: { head: tete, wingL: aileL, wingR: aileR, tail: queue, float: false },
      attack: function (p) {
        // La glace grandit d'un coup, puis il se voûte en soufflant.
        var k = Math.sin(p * Math.PI);
        for (var i = 0; i < glacons.length; i++) glacons[i].scale.setScalar(1 + k * 0.6);
        corps.rotation.x = k * 0.22;
        tete.rotation.x = k * 0.45;
        aileL.rotation.z = k * 0.4; aileR.rotation.z = -k * 0.25;
      },
    });
  });

  // Repère de débogage : quels modèles ce fichier a-t-il remplacés ?
  var API = { refaits: ['pyrathos', 'abyssalor', 'chronoss', 'vortexis', 'sablion', 'sylvaros', 'cryonix'] };
  if (R3.register) R3.register('legendvrais', API);
  if (typeof window !== 'undefined') window.LEGENDVRAIS3D = API;
})();
