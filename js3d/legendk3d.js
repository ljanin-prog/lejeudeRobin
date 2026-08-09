// =============================================================================
//  legendk3d.js — SIX LÉGENDAIRES DE ROBIN PRENNENT ENFIN LEUR VRAIE ALLURE
// =============================================================================
//
//  « je voudrais que tu prennes les Pokémon du jeu de Clélia » — Robin,
//  9 août 2026.
//
//  Le jeu de Clélia contient cinq vrais légendaires modelés un par un (Mewtwo,
//  Rayquaza, Lugia, Ho-Oh, Arceus) plus Terapagos. Robin, lui, possède déjà ces
//  six-là dans sa liste de 36 — mais sous un id maison et avec une silhouette
//  inventée avant que le nom ne leur soit donné. Le Pokédex l'écrit noir sur
//  blanc : « le nom suit L'APPARENCE DÉJÀ DESSINÉE — la panthère est Mewtwo ».
//
//  Autrement dit : Robin a un Pokémon qui S'APPELLE Mewtwo et qui ressemble à
//  une panthère de pierre. Ce fichier lui donne le vrai Mewtwo.
//
//  ---------------------------------------------------------------------------
//  CE QUI CHANGE, ET CE QUI NE CHANGE PAS
//  ---------------------------------------------------------------------------
//  CHANGE   : le modèle 3D affiché sur la carte, en combat et dans le Pokédex.
//  NE CHANGE PAS : l'id (`obsidion` reste `obsidion`), le nom, le type, les
//  statistiques, la région, l'autel, la quête, la place dans la sauvegarde.
//  Une partie en cours ne s'en aperçoit donc que par les yeux — et c'est
//  exactement l'intention.
//
//  POURQUOI ON NE TOUCHE PAS AUX TYPES. Le vrai Mewtwo est de type Psy ; celui
//  de Robin est de type Roche, parce que le monde légendaire range 3 légendaires
//  par type et 6 par région (CONTRACT2 §4). Changer le type d'un seul décalerait
//  toute la table et déséquilibrerait les six arènes. L'allure suit le nom,
//  l'équilibre suit le contrat : chacun son rôle.
//
//  Chargé APRÈS `creatures3d.k1..k6.js` (les modèles qu'on recopie) et APRÈS
//  `legend3d.p1..p3.js` (les modèles qu'on remplace) — sinon l'ancien modèle,
//  enregistré en dernier, reprendrait le dessus.
// =============================================================================

(function () {
  'use strict';

  if (typeof R3 === 'undefined' || !R3 || typeof R3.registerCreature !== 'function') return;

  // ---------------------------------------------------------------------------
  //  La table : id maison de Robin  ->  modèle venu du jeu de Clélia.
  //  Les noms affichés sont ceux du Pokédex de Robin — ils étaient déjà bons.
  // ---------------------------------------------------------------------------
  var ALLURES = [
    { chez: 'obsidion',  modele: 'mewtwo',    nom: 'Mewtwo' },
    { chez: 'zephyrion', modele: 'rayquaza',  nom: 'Rayquaza' },
    { chez: 'marea',     modele: 'lugia',     nom: 'Lugia' },
    { chez: 'emberyx',   modele: 'hooh',      nom: 'Ho-Oh' },
    { chez: 'aureol',    modele: 'arceus',    nom: 'Arceus' },
    { chez: 'geomastre', modele: 'terapagos', nom: 'Terapagos' },
  ];

  var faits = [];
  var manques = [];

  for (var i = 0; i < ALLURES.length; i++) {
    var a = ALLURES[i];
    var build = R3.CREATURE_BUILDERS ? R3.CREATURE_BUILDERS[a.modele] : null;
    if (typeof build !== 'function') { manques.push(a.modele); continue; }

    // On réenregistre le MÊME constructeur sous l'id maison. Pas de copie, pas
    // d'adaptation : le modèle de Clélia respecte la même convention (Group
    // centré, posé sur y = 0, ~1 unité, `userData.anim` et `userData.attack`),
    // donc `battle3d`, `roamers3d` et la vignette du Pokédex l'animent déjà.
    R3.registerCreature(a.chez, build);
    faits.push(a.nom);
  }

  if (manques.length) {
    console.warn('[legendk3d] modèle(s) introuvable(s) : ' + manques.join(', ') +
                 ' — ces légendaires gardent leur ancienne silhouette.');
  }

  var API = {
    ALLURES: ALLURES,
    appliquees: faits,
    manquantes: manques,
  };
  if (typeof R3.register === 'function') R3.register('legendk', API);
  if (typeof window !== 'undefined') window.LEGENDK3D = API;
})();
