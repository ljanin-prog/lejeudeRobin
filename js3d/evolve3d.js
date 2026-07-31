// =============================================================================
//  evolve3d.js — Les ÉVOLUTIONS  (CONTRACT3 §3, demande n° 4 de Robin)
// =============================================================================
//
//  « Les Pokémon doivent pouvoir évoluer. »
//
//  Ce module fait trois choses, et rien d'autre :
//
//   1. il DÉCRIT les chaînes d'évolution des 26 créatures d'origine
//      (3 stades pour les 5 « starters », 2 stades pour la majorité,
//       aucun pour les 2 créatures volontairement uniques) ;
//   2. il DÉCLARE les 29 nouvelles espèces qui en découlent, au format
//      `species` du §8 de CONTRACT2 — types, stats, capacités, description ;
//   3. il FAIT évoluer un individu (`evolve(mon)`) en respectant ce qui compte
//      pour un enfant de 10 ans : on garde son surnom, ses PP et son XP, on
//      recalcule les stats, on apprend les nouvelles capacités, et **on remplit
//      les PV au maximum** — une évolution est une récompense, jamais une perte.
//
//  ---------------------------------------------------------------------------
//  POURQUOI ON NE TOUCHE PAS À `dex3d.js`
//  ---------------------------------------------------------------------------
//  Le Pokédex appartient à un autre lot. Le contrat prévoit `dex.addSpecies(sp)`,
//  mais la version actuelle de `dex3d.js` ne l'expose pas. Plutôt que d'attendre,
//  on GREFFE nous-mêmes un `addSpecies` sur l'objet d'API déjà enregistré :
//   • on pousse les formes évoluées dans `dex.ALL` (elles apparaissent donc dans
//     le Pokédex de Robin) ;
//   • on ne touche JAMAIS à `dex.BASE`, qui est le tableau que `pickWild()`
//     filtre — c'est ce qui garantit qu'aucune forme évoluée ne surgit à l'état
//     sauvage dans les hautes herbes ;
//   • on enveloppe `dex.get()` pour qu'il connaisse les nouveaux ids.
//  Si un jour `dex3d.js` expose un vrai `addSpecies`, il est utilisé tel quel.
//
//  ---------------------------------------------------------------------------
//  CONVENTION D'IDS — accord avec le lot E2 (`creatures3d.p5.js`)
//  ---------------------------------------------------------------------------
//  Les modèles 3D des formes évoluées sont écrits EN PARALLÈLE par un autre
//  agent. La convention commune est `<idDeBase> + suffixe`, suffixe ∈ on|ar|ix,
//  concaténation STRICTE (l'exemple du contrat : `flamdrak` → `flamdrakon`).
//  Ici : stade 2 = `on` (sauf 2 formes en `ar`, plus jolies à l'oreille),
//        stade 3 = `ix`.
//  Comme les deux lots travaillent à l'aveugle, `fallbackModel()` essaie TOUTES
//  les variantes de suffixe avant de retomber sur la forme de base : si E2 a
//  choisi `ar` là où nous avons choisi `on`, le jeu affiche quand même un modèle
//  de la bonne famille, et jamais du vide.
//
//  Dépendances, toutes facultatives : `dex` (stats de base + publication),
//  `moves` (PP des capacités apprises), `R3.CREATURE_BUILDERS` (modèles 3D).
//  Aucune n'est requise : le module se charge seul sans lever d'exception.
// =============================================================================

(function () {
  'use strict';

  var ROOT = (typeof window !== 'undefined') ? window
           : (typeof globalThis !== 'undefined') ? globalThis : this;

  // Piège documenté dans dex3d.js : `core3d.js` déclare `const R3 = …` au
  // premier niveau d'un <script> classique. Cette liaison n'est JAMAIS une
  // propriété de window/globalThis — il ne faut donc surtout pas déclarer de
  // variable locale nommée `R3` (elle masquerait la vraie par hoisting), mais
  // la retrouver via `typeof R3 !== 'undefined'`.
  var R3mod = (typeof R3 !== 'undefined' && R3) ? R3 : null;

  var MAX_LEVEL = 60;   // même plafond que team3d.js (§11 de CONTRACT2)

  function mod(name) {
    try { return (R3mod && typeof R3mod.get === 'function') ? R3mod.get(name) : undefined; }
    catch (e) { return undefined; }
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // Piège classique : `Number(null)` vaut 0, pas NaN. Sans ce garde-fou, un
  // `num(sp && sp.baseHp, 45)` sur une espèce absente renverrait 0 et donnerait
  // des créatures à 1 PV. On écarte donc explicitement null / undefined / ''.
  function num(v, d) {
    if (v === null || v === undefined || v === '') return d;
    var n = Number(v);
    return isFinite(n) ? n : d;
  }

  // ===========================================================================
  //  1. LES 26 D'ORIGINE — repli de leurs statistiques
  //     On lit `dex3d` en priorité (c'est lui la source de vérité, et il tient
  //     lui-même ses noms de `js/creatures.js`). Cette table ne sert que si le
  //     Pokédex manque à l'appel : le module doit rester utilisable seul.
  // ===========================================================================
  var BASE_FALLBACK = {
    feuillou:  { name: 'Feuillou',  color: '#38b764', hp: 45, atk: 35, def: 38, speed: 30, catchRate: 0.85, regions: ['val', 'sylve'],                     biomes: ['forest', 'jungle', 'park'] },
    petalia:   { name: 'Pétalia',   color: '#ffaad8', hp: 42, atk: 38, def: 32, speed: 40, catchRate: 0.85, regions: ['val', 'sylve', 'aurore'],           biomes: ['forest', 'plain', 'park'] },
    goutella:  { name: 'Goutella',  color: '#41a6f6', hp: 44, atk: 36, def: 34, speed: 38, catchRate: 0.80, regions: ['val', 'sylve', 'saphir', 'givre'],  biomes: ['lake', 'swamp', 'sea'] },
    bullini:   { name: 'Bullini',   color: '#73eff7', hp: 40, atk: 34, def: 30, speed: 45, catchRate: 0.80, regions: ['val', 'sylve', 'saphir', 'givre'],  biomes: ['lake', 'sea', 'swamp'] },
    etincelo:  { name: 'Étincelo',  color: '#f1c40f', hp: 38, atk: 42, def: 28, speed: 52, catchRate: 0.75, regions: ['val', 'sylve', 'braise', 'aurore'], biomes: ['plain', 'park', 'jungle'] },
    meduzia:   { name: 'Méduzia',   color: '#d896ff', hp: 46, atk: 40, def: 34, speed: 36, catchRate: 0.70, regions: ['sylve', 'saphir'],                  biomes: ['sea', 'swamp'] },
    coralou:   { name: 'Coralou',   color: '#fc7460', hp: 48, atk: 38, def: 46, speed: 24, catchRate: 0.70, regions: ['saphir'],                           biomes: ['sea', 'beach', 'coast'] },
    fluffly:   { name: 'Fluffly',   color: '#fcef8d', hp: 50, atk: 36, def: 34, speed: 42, catchRate: 0.85, regions: ['val', 'sylve', 'saphir'],           biomes: ['plain', 'forest', 'park'] },
    glanou:    { name: 'Glanou',    color: '#8b5a2b', hp: 52, atk: 38, def: 48, speed: 22, catchRate: 0.85, regions: ['val', 'sylve'],                     biomes: ['forest', 'jungle'] },
    papillon:  { name: 'Papillon',  color: '#d896ff', hp: 40, atk: 36, def: 30, speed: 50, catchRate: 0.70, regions: ['val', 'sylve'],                     biomes: ['forest', 'plain', 'park'] },
    cygnik:    { name: 'Cygnik',    color: '#f4f4f4', hp: 52, atk: 44, def: 40, speed: 44, catchRate: 0.65, regions: ['val', 'saphir', 'givre'],           biomes: ['lake', 'sea', 'glacier'] },
    lotira:    { name: 'Lotira',    color: '#ffaad8', hp: 46, atk: 34, def: 42, speed: 30, catchRate: 0.80, regions: ['val', 'sylve'],                     biomes: ['lake', 'swamp'] },
    lapinou:   { name: 'Lapinou',   color: '#f4f4f4', hp: 44, atk: 34, def: 32, speed: 54, catchRate: 0.85, regions: ['val', 'givre', 'braise'],           biomes: ['plain', 'park', 'desert'] },
    hibouche:  { name: 'Hibouché',  color: '#8b5a2b', hp: 50, atk: 44, def: 38, speed: 42, catchRate: 0.75, regions: ['val', 'sylve', 'givre'],            biomes: ['forest', 'plain', 'jungle'] },
    etoilamer: { name: 'Étoilamer', color: '#ff6b9d', hp: 42, atk: 36, def: 40, speed: 28, catchRate: 0.85, regions: ['saphir'],                           biomes: ['sea', 'beach', 'coast'] },
    crabilino: { name: 'Crabilino', color: '#e74c3c', hp: 50, atk: 46, def: 50, speed: 26, catchRate: 0.70, regions: ['saphir', 'braise'],                 biomes: ['sea', 'beach', 'coast'] },
    nuagette:  { name: 'Nuagette',  color: '#f4f4f4', hp: 55, atk: 48, def: 42, speed: 50, catchRate: 0.50, regions: ['val', 'aurore'],                    biomes: ['plain', 'celestial'] },
    miaouche:  { name: 'Miaouche',  color: '#f4f4f4', hp: 44, atk: 40, def: 32, speed: 48, catchRate: 0.85, regions: ['val', 'sylve', 'saphir'],           biomes: ['village', 'city', 'plain'] },
    pandouki:  { name: 'Pandouki',  color: '#f4f4f4', hp: 60, atk: 46, def: 50, speed: 26, catchRate: 0.80, regions: ['val', 'sylve', 'givre'],            biomes: ['forest', 'mountain', 'jungle'] },
    koronette: { name: 'Koronette', color: '#d896ff', hp: 48, atk: 46, def: 38, speed: 46, catchRate: 0.70, regions: ['val', 'aurore'],                    biomes: ['park', 'forest', 'celestial'] },
    stellini:  { name: 'Stellini',  color: '#f1c40f', hp: 46, atk: 42, def: 34, speed: 50, catchRate: 0.75, regions: ['val', 'givre', 'aurore'],           biomes: ['plain', 'park', 'celestial'] },
    doudoune:  { name: 'Doudoune',  color: '#f1c40f', hp: 42, atk: 32, def: 34, speed: 36, catchRate: 0.85, regions: ['val', 'saphir', 'givre'],           biomes: ['forest', 'plain', 'village'] },
    flamdrak:  { name: 'Flamdrak',  color: '#e74c3c', hp: 75, atk: 62, def: 52, speed: 54, catchRate: 0.55, regions: ['braise'],                           biomes: ['volcano', 'mountain'] },
    glydrak:   { name: 'Glydrak',   color: '#5d275d', hp: 82, atk: 68, def: 56, speed: 60, catchRate: 0.40, regions: ['givre', 'braise', 'aurore'],        biomes: ['mountain', 'glacier', 'celestial'] },
    aquadrak:  { name: 'Aquadrak',  color: '#1abc9c', hp: 78, atk: 60, def: 58, speed: 52, catchRate: 0.50, regions: ['val', 'saphir'],                    biomes: ['lake', 'sea'] },
    tonnedrak: { name: 'Tonnedrak', color: '#f1c40f', hp: 80, atk: 66, def: 54, speed: 64, catchRate: 0.40, regions: ['sylve', 'braise', 'aurore'],        biomes: ['mountain', 'plain', 'jungle'] },
  };

  /** Les données de base d'une espèce d'origine — `dex3d` d'abord, repli ensuite. */
  function baseInfo(id) {
    var fb = BASE_FALLBACK[id] || null;
    var dex = mod('dex');
    var sp = null;
    if (dex && typeof dex.get === 'function') {
      try { sp = dex.get(id); } catch (e) { sp = null; }
    }
    return {
      name:      (sp && sp.name) || (fb && fb.name) || String(id),
      color:     (sp && sp.color) || (fb && fb.color) || '#d896ff',
      hp:        num(sp && sp.baseHp, fb ? fb.hp : 45),
      atk:       num(sp && sp.atk, fb ? fb.atk : 38),
      def:       num(sp && sp.def, fb ? fb.def : 36),
      speed:     num(sp && sp.speed, fb ? fb.speed : 38),
      catchRate: num(sp && sp.catchRate, fb ? fb.catchRate : 0.7),
      regions:   (sp && sp.regions && sp.regions.length) ? sp.regions.slice()
                 : (fb ? fb.regions.slice() : []),
      biomes:    (sp && sp.biomes && sp.biomes.length) ? sp.biomes.slice()
                 : (fb ? fb.biomes.slice() : []),
      dragon:    !!(sp && sp.dragon),
      kawaii:    !!(sp && sp.kawaii),
    };
  }

  // ===========================================================================
  //  2. LES CHAÎNES
  //
  //  `mul` = [PV, ATT, DÉF, VIT] appliqués aux stats de la forme DE BASE
  //  (et non de l'étape précédente) : le contrat impose 1,35× à 1,60×.
  //  Un stade 2 tourne autour de 1,45× ; un stade 3 autour de 1,55×.
  //
  //  `moves` = les 4 capacités de départ, dont TOUJOURS un soin : en combat,
  //  Robin doit pouvoir se soigner quelle que soit la créature qu'il envoie.
  //  `learn` = ce qui s'ajoute en montant, la première entrée tombant pile au
  //  niveau d'évolution pour que l'évolution offre immédiatement une nouveauté.
  // ===========================================================================
  var CHAIN_DATA = [

    // ---------------------------------------------------------------------
    //  TROIS STADES — les 5 « starters » (16 puis 34, 18 puis 36 pour Flamdrak)
    // ---------------------------------------------------------------------
    { base: 'feuillou', steps: [
      { suf: 'on', level: 16, name: 'Feuillon', types: ['plante'], color: '#2f9e52',
        mul: [1.42, 1.40, 1.45, 1.36], catchMul: 0.70,
        message: 'Feuillou déplie ses branches et grandit d’un coup !',
        description: "Sa feuille unique est devenue un petit buisson touffu. Quand il pleut, les insectes du Val viennent s’abriter dessous.",
        moves: ['feuille', 'lianeFouet', 'roseeGuerisseuse', 'petale'],
        learn: [{ level: 16, moveId: 'pluieDeGraines' }, { level: 22, moveId: 'bambou' }, { level: 28, moveId: 'soleil' }] },
      { suf: 'ix', level: 34, name: 'Feuillix', types: ['plante', 'fee'], color: '#1e8449',
        mul: [1.58, 1.55, 1.60, 1.50], catchMul: 0.55,
        message: 'Feuillon devient un arbre-gardien couronné de fleurs !',
        description: "Un arbre-gardien paisible, couronné de fleurs qui ne fanent jamais. Là où il s’assoit, la mousse repousse en une seule nuit.",
        moves: ['soleil', 'lianesGeantes', 'roseeGuerisseuse', 'feerie'],
        learn: [{ level: 34, moveId: 'petale' }, { level: 44, moveId: 'force' }] },
    ] },

    { base: 'goutella', steps: [
      { suf: 'on', level: 16, name: 'Goutellon', types: ['eau'], color: '#2f7fb8',
        mul: [1.42, 1.42, 1.40, 1.42], catchMul: 0.70,
        message: 'Goutella devient une source vive et bondissante !',
        description: "La petite goutte est devenue une source vive. Elle jaillit dès qu’on lui sourit, et arrose tout le monde sans le faire exprès.",
        moves: ['torrent', 'jetEau', 'sourceVive', 'bulle'],
        learn: [{ level: 16, moveId: 'vagueDeferlante' }, { level: 24, moveId: 'pluieBattante' }, { level: 30, moveId: 'hydro' }] },
      { suf: 'ix', level: 34, name: 'Goutellix', types: ['eau', 'glace'], color: '#123a6b',
        mul: [1.58, 1.56, 1.55, 1.52], catchMul: 0.55,
        message: 'Goutellon devient un torrent qui a appris à geler !',
        description: "Un torrent entier qui a appris à geler. Son rire fait tinter au fond de l’eau des cristaux aussi fins que du verre.",
        moves: ['hydro', 'lameGivre', 'sourceVive', 'vagueDeferlante'],
        learn: [{ level: 34, moveId: 'blizzard' }, { level: 44, moveId: 'force' }] },
    ] },

    { base: 'etincelo', steps: [
      { suf: 'on', level: 16, name: 'Étincelon', types: ['electrique'], color: '#f6d743',
        mul: [1.45, 1.45, 1.42, 1.38], catchMul: 0.70,
        message: 'Étincelo devient un éclair sur pattes !',
        description: "L’étincelle est devenue un éclair sur pattes. En passant, elle recharge toutes les lanternes du village — et fait grésiller les cheveux.",
        moves: ['eclair', 'etincelleVive', 'rechargeVive', 'arcElectrique'],
        learn: [{ level: 16, moveId: 'filetVolts' }, { level: 24, moveId: 'tonnerre' }, { level: 32, moveId: 'foudroiement' }] },
      { suf: 'ix', level: 34, name: 'Étincelix', types: ['electrique', 'acier'], color: '#c9a227',
        mul: [1.58, 1.58, 1.60, 1.50], catchMul: 0.55,
        message: 'Étincelon revêt une armure de métal traversée d’éclairs !',
        description: "Son corps de métal conduit la foudre sans jamais fondre. Quand elle court, l’air sent l’orage pendant une bonne heure.",
        moves: ['tonnerre', 'arcElectrique', 'rechargeVive', 'force'],
        learn: [{ level: 34, moveId: 'foudroiement' }, { level: 44, moveId: 'roulade' }] },
    ] },

    { base: 'flamdrak', steps: [
      // Le contrat cite lui-même `flamdrak` → `flamdrakon` au niveau 18.
      { suf: 'on', level: 18, name: 'Flamdrakon', types: ['feu', 'air'], color: '#c0392b',
        mul: [1.38, 1.40, 1.38, 1.36], catchMul: 0.70,
        message: 'Flamdrak grandit et déploie enfin ses ailes !',
        description: "Ses ailes se sont déployées d’un coup, un matin d’été. Depuis, il sème des braises derrière lui en volant, comme une comète.",
        moves: ['crocBraise', 'jetDeLave', 'coconBraise', 'aile'],
        learn: [{ level: 18, moveId: 'bouleFeu' }, { level: 28, moveId: 'souffleCendre' }, { level: 34, moveId: 'tempeteDeVent' }] },
      { suf: 'ix', level: 36, name: 'Flamdrakix', types: ['feu', 'dragon'], color: '#8e2a1c',
        mul: [1.55, 1.58, 1.55, 1.50], catchMul: 0.50,
        message: 'Flamdrakon devient un vrai dragon de feu !',
        description: "Le dragon de feu enfin adulte. Un seul battement de ses ailes suffit à rallumer un volcan que l’on croyait éteint.",
        moves: ['inferno', 'laveFondue', 'coconBraise', 'dragonRage'],
        learn: [{ level: 36, moveId: 'tempeteDeVent' }, { level: 48, moveId: 'force' }] },
    ] },

    { base: 'miaouche', steps: [
      // Suffixe `ar` : « Miaouchon » sonnerait plus petit, pas plus grand.
      { suf: 'ar', level: 16, name: 'Miaouchar', types: ['lumiere'], color: '#ffe066',
        mul: [1.42, 1.45, 1.40, 1.45], catchMul: 0.70,
        message: 'Miaouche s’étire… et sa fourrure se met à briller !',
        description: "Le chaton a grandi et sa fourrure brille comme un rayon de soleil sur le carrelage. Il ronronne fort, très fort.",
        moves: ['griffe', 'eclatDore', 'ronron', 'feerie'],
        learn: [{ level: 16, moveId: 'rayonDeLumiere' }, { level: 24, moveId: 'magie' }, { level: 30, moveId: 'etoileEx' }] },
      { suf: 'ix', level: 34, name: 'Miaouchix', types: ['lumiere', 'psy'], color: '#ffb347',
        mul: [1.58, 1.60, 1.52, 1.58], catchMul: 0.55,
        message: 'Miaouchar devient un grand félin de lumière !',
        description: "Un grand félin de lumière au regard tranquille. On raconte qu’il devine les rêves de celui qui ose le caresser.",
        moves: ['etoileEx', 'lanceLumiere', 'soinMagie', 'magie'],
        learn: [{ level: 34, moveId: 'eclatMiroir' }, { level: 44, moveId: 'force' }] },
    ] },

    // ---------------------------------------------------------------------
    //  DEUX STADES — la majorité (vers 20)
    // ---------------------------------------------------------------------
    { base: 'petalia', steps: [
      { suf: 'on', level: 20, name: 'Pétalion', types: ['plante', 'fee'], color: '#ff6b9d',
        mul: [1.45, 1.48, 1.45, 1.48], catchMul: 0.70,
        message: 'Pétalia ouvre sa corolle en grand !',
        description: "Sa corolle s’est ouverte en grand. Elle offre un pétale porte-bonheur à quiconque la salue poliment.",
        moves: ['petale', 'feerie', 'roseeGuerisseuse', 'soleil'],
        learn: [{ level: 20, moveId: 'rayonDeLumiere' }, { level: 28, moveId: 'lianeFouet' }, { level: 36, moveId: 'etoileEx' }] },
    ] },

    { base: 'bullini', steps: [
      { suf: 'on', level: 20, name: 'Bullinion', types: ['eau', 'psy'], color: '#41a6f6',
        mul: [1.48, 1.46, 1.45, 1.50], catchMul: 0.70,
        message: 'Bullini enfle jusqu’à faire de vraies vagues !',
        description: "Ses bulles font désormais de vraies vagues. Il devine où se cachent les autres poissons sans même ouvrir les yeux.",
        moves: ['torrent', 'bulle', 'sourceVive', 'vagueDeferlante'],
        learn: [{ level: 20, moveId: 'pluieBattante' }, { level: 28, moveId: 'hydro' }, { level: 36, moveId: 'tourbillon' }] },
    ] },

    { base: 'meduzia', steps: [
      // Évolution par PIERRE : la Pierre de Nuit s’achète au Centre (§6).
      { suf: 'on', level: 20, stone: 'pierre_nuit', name: 'Méduzion', types: ['eau', 'poison'], color: '#7a5cbf',
        mul: [1.50, 1.50, 1.48, 1.45], catchMul: 0.65,
        message: 'La Pierre de Nuit fait s’allonger les filaments de Méduzia !',
        description: "Ses filaments s’allongent dans le noir comme de longs rubans. Ils piquent un peu — mais elle s’excuse toujours après.",
        moves: ['tentacule', 'voileNoir', 'voileReparateur', 'morsureSombre'],
        learn: [{ level: 24, moveId: 'gouffreNoir' }, { level: 32, moveId: 'torrent' }, { level: 40, moveId: 'abimeSombre' }] },
    ] },

    { base: 'coralou', steps: [
      { suf: 'on', level: 20, name: 'Coralon', types: ['eau', 'roche'], color: '#e05a48',
        mul: [1.50, 1.48, 1.55, 1.40], catchMul: 0.70,
        message: 'Coralou grandit jusqu’à porter tout un récif !',
        description: "Un récif entier tient sur son dos. Les petits poissons viennent y dormir la nuit, et il fait très attention à ne pas bouger.",
        moves: ['eclatRocheux', 'jetEau', 'carapaceDePierre', 'pince'],
        learn: [{ level: 20, moveId: 'massuePierre' }, { level: 28, moveId: 'torrent' }, { level: 36, moveId: 'avalancheDePierres' }] },
    ] },

    { base: 'fluffly', steps: [
      { suf: 'on', level: 20, name: 'Flufflyon', types: ['air', 'normal'], color: '#f4d35e',
        mul: [1.52, 1.45, 1.48, 1.45], catchMul: 0.70,
        message: 'Fluffly gonfle et rebondit plus haut que les toits !',
        description: "Une grosse boule de poil qui rebondit plus haut que les toits. Se laisser tomber dessus est le meilleur jeu du village.",
        moves: ['rebond', 'bourrasque', 'calin', 'morsure'],
        learn: [{ level: 20, moveId: 'tornade' }, { level: 30, moveId: 'roulade' }, { level: 38, moveId: 'force' }] },
    ] },

    { base: 'glanou', steps: [
      { suf: 'on', level: 20, name: 'Glanon', types: ['plante', 'terre'], color: '#5c3a1e',
        mul: [1.55, 1.48, 1.55, 1.38], catchMul: 0.70,
        message: 'Glanou s’enracine et devient un chêne trapu !',
        description: "Le petit gland est devenu un chêne trapu. Son chapeau sert d’abri à toute une famille quand l’orage éclate.",
        moves: ['gland', 'coupDeTerre', 'terreNourriciere', 'bambou'],
        learn: [{ level: 20, moveId: 'lianesGeantes' }, { level: 28, moveId: 'crevasse' }, { level: 38, moveId: 'seisme' }] },
    ] },

    { base: 'cygnik', steps: [
      { suf: 'on', level: 22, name: 'Cygnikon', types: ['eau', 'fee'], color: '#e8f4f8',
        mul: [1.48, 1.50, 1.45, 1.50], catchMul: 0.65,
        message: 'Cygnik déploie des ailes larges de trois pas !',
        description: "Ses ailes déployées font trois pas de large. Son chant calme les vagues, et parfois même les disputes.",
        moves: ['aile', 'vagueDeferlante', 'chant', 'serre'],
        learn: [{ level: 22, moveId: 'tourbillon' }, { level: 30, moveId: 'tempeteDeVent' }, { level: 40, moveId: 'hydro' }] },
    ] },

    { base: 'lotira', steps: [
      { suf: 'on', level: 20, name: 'Lotiron', types: ['plante', 'eau'], color: '#ff8fbf',
        mul: [1.50, 1.45, 1.55, 1.42], catchMul: 0.70,
        message: 'Lotira s’étale : on pourrait s’asseoir dessus !',
        description: "Un grand nénuphar sur lequel on pourrait s’asseoir. Il fait pousser des fleurs rien qu’en respirant tranquillement.",
        moves: ['petale', 'torrent', 'roseeGuerisseuse', 'lianeFouet'],
        learn: [{ level: 20, moveId: 'lianesGeantes' }, { level: 30, moveId: 'vagueDeferlante' }, { level: 38, moveId: 'soleil' }] },
    ] },

    { base: 'lapinou', steps: [
      { suf: 'on', level: 20, name: 'Lapinon', types: ['terre', 'combat'], color: '#c08c4a',
        mul: [1.48, 1.55, 1.45, 1.38], catchMul: 0.70,
        message: 'Lapinou muscle ses pattes : le sol tremble !',
        description: "Ses coups de patte font trembler le sol. Il saute par-dessus les haies sans même prendre la peine de les regarder.",
        moves: ['ruadeTerre', 'rebond', 'calin', 'secousse'],
        learn: [{ level: 20, moveId: 'crevasse' }, { level: 28, moveId: 'roulade' }, { level: 38, moveId: 'seisme' }] },
    ] },

    { base: 'hibouche', steps: [
      { suf: 'ar', level: 22, name: 'Hibouchar', types: ['air', 'spectre'], color: '#4a3d6b',
        mul: [1.50, 1.52, 1.48, 1.48], catchMul: 0.65,
        message: 'Hibouché devient un vol silencieux dans la nuit !',
        description: "Il vole sans faire le moindre bruit. Ses grands yeux voient à travers la nuit — et un peu à travers les gens.",
        moves: ['serre', 'morsureSombre', 'voileReparateur', 'tourbillon'],
        learn: [{ level: 22, moveId: 'gouffreNoir' }, { level: 30, moveId: 'bourrasque' }, { level: 40, moveId: 'abimeSombre' }] },
    ] },

    { base: 'etoilamer', steps: [
      // Évolution par PIERRE : la Pierre d’Eau, en vente à Port-Saphir.
      { suf: 'on', level: 16, stone: 'pierre_eau', name: 'Étoilameron', types: ['eau', 'psy'], color: '#41a6f6',
        mul: [1.50, 1.48, 1.52, 1.50], catchMul: 0.70,
        message: 'La Pierre d’Eau couvre Étoilamer d’étoiles minuscules !',
        description: "Ses cinq branches se sont couvertes d’étoiles minuscules. Elle indique le nord aux bateaux qui se sont perdus.",
        moves: ['etoile', 'torrent', 'soinMagie', 'etoileEx'],
        learn: [{ level: 20, moveId: 'rayonDeLumiere' }, { level: 28, moveId: 'hydro' }, { level: 36, moveId: 'lanceLumiere' }] },
    ] },

    { base: 'crabilino', steps: [
      { suf: 'on', level: 20, name: 'Crabilinon', types: ['eau', 'acier'], color: '#b8c4d0',
        mul: [1.50, 1.52, 1.58, 1.40], catchMul: 0.65,
        message: 'Crabilino durcit sa carapace comme une enclume !',
        description: "Sa carapace est dure comme une enclume. Il ouvre les coquillages les plus têtus d’un seul clic-clac satisfait.",
        moves: ['pince', 'poingGranit', 'carapaceDePierre', 'torrent'],
        learn: [{ level: 22, moveId: 'massuePierre' }, { level: 30, moveId: 'vagueDeferlante' }, { level: 40, moveId: 'avalancheDePierres' }] },
    ] },

    { base: 'pandouki', steps: [
      { suf: 'on', level: 22, name: 'Pandoukion', types: ['plante', 'combat'], color: '#3d6b2f',
        mul: [1.55, 1.55, 1.52, 1.42], catchMul: 0.65,
        message: 'Pandouki devient un grand panda tout en muscles !',
        description: "Un grand panda paisible qui ne se fâche jamais — sauf si on touche à sa réserve de bambou.",
        moves: ['bambou', 'roulade', 'roseeGuerisseuse', 'force'],
        learn: [{ level: 22, moveId: 'lianesGeantes' }, { level: 32, moveId: 'seisme' }, { level: 42, moveId: 'ruadeTerre' }] },
    ] },

    { base: 'koronette', steps: [
      // Évolution par PIERRE : la Pierre de Lune, la plus recherchée du jeu.
      { suf: 'on', level: 18, stone: 'pierre_lune', name: 'Koronetton', types: ['lumiere', 'fee'], color: '#ffe066',
        mul: [1.50, 1.52, 1.48, 1.50], catchMul: 0.60,
        message: 'La Pierre de Lune change la couronne de Koronette en halo !',
        description: "Sa couronne s’est changée en halo d’étoiles. Elle exauce les vœux des enfants qui savent attendre leur tour.",
        moves: ['feerie', 'lanceLumiere', 'soinMagie', 'magie'],
        learn: [{ level: 22, moveId: 'rayonDeLumiere' }, { level: 30, moveId: 'etoileEx' }, { level: 40, moveId: 'eclatMiroir' }] },
    ] },

    { base: 'stellini', steps: [
      { suf: 'on', level: 22, name: 'Stellinion', types: ['lumiere', 'espace'], color: '#4b62d9',
        mul: [1.50, 1.50, 1.48, 1.42], catchMul: 0.65,
        message: 'Stellini bondit d’une constellation à l’autre !',
        description: "Un lièvre d’étoiles qui bondit d’une constellation à l’autre. Sa fourrure garde la chaleur du soleil toute la nuit.",
        moves: ['etoile', 'meteore', 'nebuleuseReparatrice', 'poussiereStellaire'],
        learn: [{ level: 24, moveId: 'cometeFilante' }, { level: 32, moveId: 'gravite' }, { level: 42, moveId: 'pluieDeMeteores' }] },
    ] },

    { base: 'doudoune', steps: [
      { suf: 'on', level: 18, name: 'Doudounon', types: ['air', 'normal'], color: '#e8b923',
        mul: [1.50, 1.50, 1.50, 1.50], catchMul: 0.70,
        message: 'Doudoune devient un coq duveteux et très fier !',
        description: "Le poussin est devenu un coq duveteux et fier. Il réveille tout le village au lever du soleil, qu’on le veuille ou non.",
        moves: ['bec', 'plumes', 'chant', 'serre'],
        learn: [{ level: 18, moveId: 'rafale' }, { level: 26, moveId: 'bourrasque' }, { level: 36, moveId: 'tempeteDeVent' }] },
    ] },

    // ---------------------------------------------------------------------
    //  LES TROIS AUTRES DRAGONS — évolution tardive (24), stats déjà hautes
    // ---------------------------------------------------------------------
    { base: 'glydrak', steps: [
      { suf: 'on', level: 24, name: 'Glydrakon', types: ['glace', 'dragon'], color: '#a8e6ff',
        mul: [1.45, 1.48, 1.45, 1.45], catchMul: 0.60,
        message: 'Glydrak change ses écailles en lames de givre !',
        description: "Ses écailles sont devenues des lames de givre. Son souffle transforme la pluie en cristaux avant qu’elle touche le sol.",
        moves: ['soufflePolaire', 'dragonRage', 'haleineDeGivre', 'pieuGlace'],
        learn: [{ level: 24, moveId: 'brumeGelee' }, { level: 34, moveId: 'blizzard' }, { level: 46, moveId: 'force' }] },
    ] },

    { base: 'aquadrak', steps: [
      { suf: 'on', level: 24, name: 'Aquadrakon', types: ['eau', 'dragon'], color: '#0e8f79',
        mul: [1.48, 1.48, 1.50, 1.45], catchMul: 0.60,
        message: 'Aquadrak s’allonge comme un fleuve entier !',
        description: "Un long dragon des rivières qui remonte les cascades en dormant à moitié. Il ronfle des bulles grosses comme des ballons.",
        moves: ['torrent', 'dragon', 'sourceVive', 'hydro'],
        learn: [{ level: 24, moveId: 'vagueDeferlante' }, { level: 34, moveId: 'dragonRage' }, { level: 46, moveId: 'tourbillon' }] },
    ] },

    { base: 'tonnedrak', steps: [
      { suf: 'on', level: 24, name: 'Tonnedrakon', types: ['electrique', 'dragon'], color: '#e8a33d',
        mul: [1.48, 1.50, 1.45, 1.40], catchMul: 0.60,
        message: 'Tonnedrak fait crépiter toutes les crêtes de son dos !',
        description: "Les crêtes en éclair de son dos crépitent en permanence. Voler à côté de lui, c’est être décoiffé pour la journée.",
        moves: ['arcElectrique', 'dragonRage', 'rechargeVive', 'tonnerre'],
        learn: [{ level: 24, moveId: 'foudroiement' }, { level: 34, moveId: 'tempeteDeVent' }, { level: 46, moveId: 'force' }] },
    ] },
  ];

  // Créatures volontairement UNIQUES : elles n'évoluent pas, et c'est un choix.
  // `papillon` est déjà une forme aboutie (la chenille est derrière lui) ;
  // `nuagette` est l'esprit rare du jeu 2D — la voir changer lui ferait perdre
  // ce qui la rend spéciale.
  var NO_EVOLUTION = ['papillon', 'nuagette'];

  // ===========================================================================
  //  3. CONSTRUCTION DES ESPÈCES ÉVOLUÉES ET DES CHAÎNES
  // ===========================================================================

  var EVOLVED = [];           // [species] — les 29 nouvelles formes
  var EVOLVED_BY_ID = {};     // id -> species
  var CHAINS = [];            // [chain] — { base, steps: [step] }
  var CHAIN_BY_ID = {};       // id (base OU forme évoluée) -> chain
  var STEP_FROM = {};         // id -> step dont c'est le `from`
  var FORM_INDEX = {};        // id évolué -> { base, stage, prev }

  function scale(v, m) { return Math.max(1, Math.round(num(v, 40) * num(m, 1.45))); }

  function buildAll() {
    for (var c = 0; c < CHAIN_DATA.length; c++) {
      var def = CHAIN_DATA[c];
      var info = baseInfo(def.base);
      var chain = { base: def.base, steps: [] };
      var fromId = def.base;
      var prevId = null;

      for (var s = 0; s < def.steps.length; s++) {
        var d = def.steps[s];
        var toId = def.base + d.suf;          // concaténation stricte : cf. en-tête
        var stone = d.stone || null;

        var step = {
          from: fromId,
          to: toId,
          level: d.level,
          stone: stone,
          message: d.message || (info.name + ' évolue !'),
        };
        chain.steps.push(step);
        STEP_FROM[fromId] = step;

        // --- l'espèce, au format §8 de CONTRACT2 --------------------------
        var lvlMin = Math.min(MAX_LEVEL, d.level);
        var sp = {
          id: toId,
          name: d.name,
          types: d.types.slice(0, 2),
          legendary: false,
          rare: (s > 0) || !!info.dragon,
          dragon: !!info.dragon,
          kawaii: !!info.kawaii,
          regions: info.regions.slice(),
          biomes: info.biomes.slice(),
          description: d.description,
          catchRate: Math.max(0.12, Math.round(info.catchRate * d.catchMul * 100) / 100),
          baseHp: scale(info.hp, d.mul[0]),
          atk: scale(info.atk, d.mul[1]),
          def: scale(info.def, d.mul[2]),
          speed: scale(info.speed, d.mul[3]),
          moveIds: d.moves.slice(0, 4),
          learnset: d.learn.map(function (e) { return { level: e.level, moveId: e.moveId }; }),
          color: d.color,
          draw: null,               // pas de dessin 2D : vignette rendue en 3D
          minLevel: lvlMin,
          maxLevel: Math.min(MAX_LEVEL, lvlMin + 20),
          // Extras hors contrat, utiles au HUD et à `fallbackModel()`.
          evolvedFrom: fromId,
          baseSpecies: def.base,
          stage: s + 2,
        };

        EVOLVED.push(sp);
        EVOLVED_BY_ID[toId] = sp;
        FORM_INDEX[toId] = { base: def.base, stage: s + 2, prev: prevId || def.base };

        prevId = fromId;
        fromId = toId;
      }

      CHAINS.push(chain);
      CHAIN_BY_ID[def.base] = chain;
      for (var k = 0; k < chain.steps.length; k++) CHAIN_BY_ID[chain.steps[k].to] = chain;
    }
  }

  try { buildAll(); }
  catch (e) {
    // Un module ne lève JAMAIS au chargement : si la table est cassée, le jeu
    // continue simplement sans évolutions.
    console.warn('[evolve3d] construction des chaînes impossible :', e);
  }

  // ===========================================================================
  //  4. PUBLICATION DANS LE POKÉDEX
  //     `dex3d.js` appartient à un autre lot : on ne le modifie pas, on greffe.
  // ===========================================================================

  var published = false;
  var publishMode = 'jamais';

  function publish() {
    if (published) return publishMode;
    var dex = mod('dex');
    if (!dex) return 'absent';            // on retentera plus tard, à la demande

    try {
      if (typeof dex.addSpecies === 'function' && !dex.__evolveGraft) {
        for (var i = 0; i < EVOLVED.length; i++) dex.addSpecies(EVOLVED[i]);
        published = true; publishMode = 'addSpecies';
        return publishMode;
      }

      if (!dex.__evolveGraft) {
        // Greffe minimale et non destructrice :
        //  • on N'AJOUTE PAS à `dex.BASE` — c'est le tableau que `pickWild()`
        //    filtre, et une forme évoluée ne doit jamais surgir dans les hautes
        //    herbes : elle se mérite ;
        //  • on ajoute à `dex.ALL` pour que le Pokédex de Robin les liste ;
        //  • on enveloppe `get()` pour que team3d/battle3d les résolvent.
        var prevGet = (typeof dex.get === 'function') ? dex.get : null;
        var extra = {};

        dex.addSpecies = function (sp) {
          if (!sp || !sp.id || extra[sp.id]) return sp;
          extra[sp.id] = sp;
          if (Array.isArray(dex.ALL) && dex.ALL.indexOf(sp) < 0) dex.ALL.push(sp);
          dex.count = Array.isArray(dex.ALL) ? dex.ALL.length : (num(dex.count, 0) + 1);
          return sp;
        };
        dex.get = function (id) {
          var found = null;
          if (prevGet) { try { found = prevGet.call(dex, id); } catch (e2) { found = null; } }
          return found || extra[id] || null;
        };
        dex.__evolveGraft = true;
        dex.EVOLVED = EVOLVED;
      }

      for (var j = 0; j < EVOLVED.length; j++) dex.addSpecies(EVOLVED[j]);
      published = true; publishMode = 'greffe';
      return publishMode;
    } catch (e) {
      console.warn('[evolve3d] publication des espèces évoluées impossible :', e);
      return 'echec';
    }
  }

  /** Publication paresseuse : appelée en tête des fonctions publiques, au cas où
   *  `dex3d.js` se serait enregistré APRÈS nous (ordre de scripts inattendu). */
  function ensure() { if (!published) publish(); }

  try { publish(); } catch (e) { /* jamais bloquant */ }

  // ===========================================================================
  //  5. API — lecture des chaînes
  // ===========================================================================

  /** L'espèce d'un id : nos formes évoluées d'abord, puis le Pokédex. */
  function speciesOf(id) {
    if (EVOLVED_BY_ID[id]) return EVOLVED_BY_ID[id];
    var dex = mod('dex');
    if (dex && typeof dex.get === 'function') {
      try { return dex.get(id) || null; } catch (e) { return null; }
    }
    return null;
  }

  function isLegendary(id) {
    var dex = mod('dex');
    if (dex && typeof dex.isLegendary === 'function') {
      try { if (dex.isLegendary(id)) return true; } catch (e) { /* on continue */ }
    }
    var sp = speciesOf(id);
    return !!(sp && sp.legendary);
  }

  /**
   * La chaîne d'évolution qui contient cette espèce (comme base OU comme forme
   * évoluée), ou `null`.
   * AUCUN LÉGENDAIRE N'ÉVOLUE : la garantie est double — ils ne figurent dans
   * aucune chaîne, et on refuse explicitement de leur en trouver une.
   */
  function chainOf(speciesId) {
    if (!speciesId) return null;
    if (isLegendary(speciesId)) return null;
    return CHAIN_BY_ID[speciesId] || null;
  }

  /** L'étape suivante de cette espèce (quel que soit son déclencheur), ou null. */
  function nextOf(speciesId) {
    if (!speciesId || isLegendary(speciesId)) return null;
    return STEP_FROM[speciesId] || null;
  }

  /** Le nom de la forme suivante — pour le Pokédex et l'écran Équipe. */
  function previewName(speciesId) {
    var step = nextOf(speciesId);
    if (!step) return null;
    ensure();
    var sp = speciesOf(step.to);
    return (sp && sp.name) || step.to;
  }

  /**
   * L'étape réalisable ICI ET MAINTENANT, ou `null`.
   * Une étape « à la pierre » n'est jamais automatique : elle passe par
   * `applyStone()`. Le niveau y sert seulement de niveau MINIMUM.
   */
  function canEvolve(mon) {
    if (!mon || !mon.id) return null;
    var step = nextOf(mon.id);
    if (!step) return null;
    if (step.stone) return null;
    return (num(mon.level, 1) >= step.level) ? step : null;
  }

  // ===========================================================================
  //  6. LES PIERRES
  //     `shop3d.js` (lot S) vend les objets ; nous décidons ce qu'ils font.
  // ===========================================================================

  var STONES = {};            // itemId -> { id, label, species: [ids] }
  var STONE_LABELS = {
    pierre_feu: 'Pierre de Feu', pierre_eau: 'Pierre d’Eau',
    pierre_plante: 'Pierre Plante', pierre_foudre: 'Pierre Foudre',
    pierre_lune: 'Pierre de Lune', pierre_nuit: 'Pierre de Nuit',
    pierre_glace: 'Pierre de Givre', pierre_soleil: 'Pierre du Soleil',
  };

  (function indexStones() {
    for (var i = 0; i < CHAINS.length; i++) {
      var st = CHAINS[i].steps;
      for (var j = 0; j < st.length; j++) {
        if (!st[j].stone) continue;
        var key = st[j].stone;
        if (!STONES[key]) {
          STONES[key] = { id: key, label: STONE_LABELS[key] || key, species: [] };
        }
        STONES[key].species.push(st[j].from);
      }
    }
  })();

  /** La pierre nécessaire à l'évolution de cette espèce, ou null. */
  function stoneFor(speciesId) {
    var step = nextOf(speciesId);
    return (step && step.stone) ? step.stone : null;
  }

  /**
   * Vrai si cet objet est une pierre d'évolution.
   * Volontairement LARGE (tout `pierre_*`) : `shop3d.js` est écrit en parallèle
   * et peut proposer des pierres que nous n'utilisons pas encore. Mieux vaut
   * répondre « oui, c'est une pierre » et ne rien faire, que planter.
   */
  function isStone(itemId) {
    if (!itemId || typeof itemId !== 'string') return false;
    if (STONES[itemId]) return true;
    return itemId.indexOf('pierre') === 0 || itemId.indexOf('stone') === 0;
  }

  // ===========================================================================
  //  7. L'ÉVOLUTION ELLE-MÊME
  // ===========================================================================

  /** PP d'une capacité — `moves3d.js` fait foi, repli à 20. */
  function ppOf(moveId) {
    var mv = mod('moves');
    if (mv && typeof mv.get === 'function') {
      try {
        var m = mv.get(moveId);
        if (m && isFinite(m.pp)) return Math.max(1, Math.round(m.pp));
      } catch (e) { /* repli */ }
    }
    return 20;
  }

  function knowsMove(mon, moveId) {
    if (!mon || !Array.isArray(mon.moves)) return false;
    for (var i = 0; i < mon.moves.length; i++) {
      if (mon.moves[i] && mon.moves[i].id === moveId) return true;
    }
    return false;
  }

  // Formules du §11 de CONTRACT2. Elles sont recopiées ici — et non empruntées
  // à team3d — parce que team3d n'expose pas `recomputeStats()`. Si l'une des
  // deux change un jour, il faut changer l'autre : c'est le prix de l'isolement
  // entre lots, assumé et documenté.
  function statHp(base, level) { return Math.max(1, Math.round(num(base, 45) * (1 + level * 0.06))); }
  function statOther(base, level, d) { return Math.max(1, Math.round(num(base, d) * (1 + level * 0.05))); }
  function xpNeeded(level) { return 20 + level * level * 4; }

  /**
   * Applique une étape d'évolution à un individu. MUTE `mon`.
   * @returns {{from, to, learned:string[], pending:string[], message, species}|null}
   */
  function applyStep(mon, step) {
    ensure();
    var newSp = speciesOf(step.to);
    if (!newSp) return null;                 // espèce introuvable : on ne casse rien

    var oldId = mon.id;
    var oldSp = speciesOf(oldId);
    var fbName = BASE_FALLBACK[oldId] ? BASE_FALLBACK[oldId].name : null;
    var oldName = (oldSp && oldSp.name) || fbName || oldId;

    // Le surnom SUIT l'espèce s'il n'en était pas vraiment un : un enfant qui a
    // baptisé sa créature « Bidule » garde « Bidule ». Comparaison insensible à
    // la casse et aux accents perdus : « Etincelo » doit compter comme « Étincelo ».
    var nick = (typeof mon.nick === 'string') ? mon.nick.trim() : '';
    var same = function (a, b) {
      if (!a || !b) return false;
      return String(a).toLowerCase() === String(b).toLowerCase();
    };
    if (!nick || same(nick, oldName) || same(nick, oldId) || same(nick, fbName)) {
      mon.nick = newSp.name || step.to;
    }

    mon.id = step.to;
    mon.types = (newSp.types || ['normal']).slice(0, 2);

    // Niveau, XP et PP inchangés — seules les statistiques sont recalculées.
    mon.level = clamp(Math.round(num(mon.level, 1)), 1, MAX_LEVEL);
    mon.maxHp = statHp(newSp.baseHp, mon.level);
    mon.atk = statOther(newSp.atk, mon.level, 38);
    mon.def = statOther(newSp.def, mon.level, 36);
    mon.speed = statOther(newSp.speed, mon.level, 38);
    mon.xp = Math.max(0, Math.round(num(mon.xp, 0)));
    mon.xpNext = xpNeeded(mon.level);

    // Les capacités du learnset déjà franchies au niveau courant.
    if (!Array.isArray(mon.moves)) mon.moves = [];
    var learned = [], pending = [];
    var ls = Array.isArray(newSp.learnset) ? newSp.learnset : [];
    for (var i = 0; i < ls.length; i++) {
      var e = ls[i];
      if (!e || !e.moveId) continue;
      if (num(e.level, 99) > mon.level) continue;
      if (knowsMove(mon, e.moveId)) continue;
      if (mon.moves.length < 4) {
        var pp = ppOf(e.moveId);
        mon.moves.push({ id: e.moveId, pp: pp, ppMax: pp });
        learned.push(e.moveId);
      } else {
        // On ne remplace JAMAIS tout seul une capacité choisie par Robin :
        // hud3d lui posera la question, comme pour une montée de niveau.
        pending.push(e.moveId);
      }
    }

    // PV AU MAXIMUM : une évolution est une récompense, pas une punition.
    mon.hp = mon.maxHp;
    if (mon.tera) mon.tera = false;          // la Téracristallisation retombe (§7)

    return {
      from: oldId,
      to: step.to,
      learned: learned,
      pending: pending,
      message: step.message,
      species: newSp,
      fromName: oldName,
      toName: newSp.name || step.to,
    };
  }

  /** Fait évoluer `mon` si c'est possible maintenant. MUTE `mon`. */
  function evolve(mon) {
    var step = canEvolve(mon);
    if (!step) return null;
    try { return applyStep(mon, step); }
    catch (e) { console.warn('[evolve3d] évolution impossible :', e); return null; }
  }

  /** Utilise une pierre sur `mon`. -> même résultat que `evolve()`, ou null. */
  function applyStone(mon, itemId) {
    if (!mon || !mon.id || !itemId) return null;
    var step = nextOf(mon.id);
    if (!step || !step.stone) return null;
    if (step.stone !== itemId) return null;
    if (num(mon.level, 1) < step.level) return null;   // le niveau reste un minimum
    try { return applyStep(mon, step); }
    catch (e) { console.warn('[evolve3d] pierre inopérante :', e); return null; }
  }

  // ===========================================================================
  //  8. MODÈLES 3D — le pont vers le lot E2 (`creatures3d.p5.js`)
  // ===========================================================================

  function hasModel(id) {
    if (!id || !R3mod || !R3mod.CREATURE_BUILDERS) return false;
    return typeof R3mod.CREATURE_BUILDERS[id] === 'function';
  }

  /**
   * L'id de modèle 3D à construire réellement pour cette espèce.
   * On essaie, dans l'ordre :
   *   1. l'id demandé (le cas normal, une fois E2 livré) ;
   *   2. les trois variantes de suffixe du même radical — E2 travaille en
   *      parallèle et a pu écrire `<base>ar` là où nous avons écrit `<base>on` ;
   *   3. la même chose sans la voyelle finale du radical (`feuillon`) ;
   *   4. l'étape précédente, puis la forme de base.
   * On renvoie TOUJOURS une chaîne : mieux vaut la forme de base que du vide.
   */
  function fallbackModel(speciesId) {
    if (!speciesId) return speciesId;
    if (hasModel(speciesId)) return speciesId;

    var info = FORM_INDEX[speciesId];
    if (!info) return speciesId;      // espèce d'origine ou inconnue : rien à faire

    var sufs = ['on', 'ar', 'ix'];
    var stem = info.base.replace(/[aeiouy]+$/, '');
    var cands = [], i;
    for (i = 0; i < sufs.length; i++) cands.push(info.base + sufs[i]);
    if (stem && stem !== info.base) {
      for (i = 0; i < sufs.length; i++) cands.push(stem + sufs[i]);
    }
    cands.push(info.prev);
    cands.push(info.base);

    for (i = 0; i < cands.length; i++) {
      if (cands[i] && cands[i] !== speciesId && hasModel(cands[i])) return cands[i];
    }
    return info.base;
  }

  // ===========================================================================
  //  9. CONFORT
  // ===========================================================================

  function isEvolved(id) { return !!FORM_INDEX[id]; }
  function baseOf(id) { return FORM_INDEX[id] ? FORM_INDEX[id].base : id; }
  function stageOf(id) { return FORM_INDEX[id] ? FORM_INDEX[id].stage : 1; }

  /** Toutes les formes d'une chaîne, de la base au stade final. */
  function formsOf(speciesId) {
    var ch = chainOf(speciesId);
    if (!ch) return speciesId ? [speciesId] : [];
    var out = [ch.base];
    for (var i = 0; i < ch.steps.length; i++) out.push(ch.steps[i].to);
    return out;
  }

  /** Petite vérification de cohérence — elle avertit, elle ne lève jamais. */
  function selfCheck() {
    var seen = {}, warn = [];
    for (var i = 0; i < EVOLVED.length; i++) {
      var sp = EVOLVED[i];
      if (seen[sp.id]) warn.push('id en double : ' + sp.id);
      seen[sp.id] = true;
      if (!sp.moveIds || sp.moveIds.length !== 4) warn.push(sp.id + ' : 4 capacités attendues');
      var uniq = {};
      for (var j = 0; j < (sp.moveIds || []).length; j++) {
        if (uniq[sp.moveIds[j]]) warn.push(sp.id + ' : capacité en double (' + sp.moveIds[j] + ')');
        uniq[sp.moveIds[j]] = true;
      }
      if (isLegendary(sp.evolvedFrom)) warn.push(sp.id + ' : évolue depuis un légendaire !');
    }
    if (warn.length) console.warn('[evolve3d] ' + warn.join(' · '));
    return warn;
  }
  try { selfCheck(); } catch (e) { /* jamais bloquant */ }

  // ===========================================================================
  //  ENREGISTREMENT
  // ===========================================================================

  var API = {
    // --- contrat §3 ---------------------------------------------------------
    CHAINS: CHAINS,
    chainOf: function (id) { ensure(); return chainOf(id); },
    nextOf: function (id) { ensure(); return nextOf(id); },
    canEvolve: function (m) { ensure(); return canEvolve(m); },
    evolve: evolve,
    stoneFor: stoneFor,
    isStone: isStone,
    applyStone: applyStone,
    previewName: previewName,
    fallbackModel: fallbackModel,

    // --- extras utiles aux autres lots --------------------------------------
    EVOLVED: EVOLVED,                 // les 29 espèces, si dex3d ne les prend pas
    STONES: STONES,                   // { itemId: { id, label, species: [] } }
    NO_EVOLUTION: NO_EVOLUTION,
    species: function (id) { ensure(); return speciesOf(id); },
    isEvolved: isEvolved,
    baseOf: baseOf,
    stageOf: stageOf,
    formsOf: function (id) { ensure(); return formsOf(id); },
    publish: publish,                 // à rappeler si dex3d s'enregistre après nous
    published: function () { return publishMode; },
    selfCheck: selfCheck,
    count: EVOLVED.length,
  };

  if (R3mod && typeof R3mod.register === 'function') R3mod.register('evolve', API);
  ROOT.EVOLVE3D = API;   // repli : utilisable même sans le socle R3
})();
