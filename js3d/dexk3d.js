// =============================================================================
//  dexk3d.js — LES 46 POKÉMON VENUS DU JEU DE CLÉLIA
// =============================================================================
//
//  « je voudrais que tu prennes les Pokémon du jeu de Clélia » — Robin,
//  9 août 2026.
//
//  Ce fichier apporte au Pokédex de Robin les 46 espèces que Clélia avait dans
//  « L'aventure de Clélia » : les trois départs de Kanto et leurs évolutions,
//  Pikachu, Évoli, Ronflex, et toute la faune de ses routes et de ses grottes.
//
//  SES SIX LÉGENDAIRES N'Y SONT PAS, et c'est voulu. Robin possède DÉJÀ un
//  Mewtwo, un Rayquaza, un Lugia, un Ho-Oh, un Arceus et un Terapagos parmi ses
//  36 légendaires — sous les ids maison `obsidion`, `zephyrion`, `marea`,
//  `emberyx`, `aureol` et `geomastre`. Les importer aurait mis deux Mewtwo dans
//  le même Pokédex. C'est donc leur MODÈLE 3D que l'on récupère, pour habiller
//  les légendaires que Robin connaît déjà : voir `legendk3d.js`.
//
//  ON AJOUTE, ON NE REMPLACE RIEN. Les 26 créatures maison de Robin et ses 36
//  légendaires ne bougent pas d'un point : `dex3d.add()` refuse par
//  construction d'écraser une espèce existante, et les sauvegardes en cours
//  continuent de s'ouvrir sans rien perdre.
//
//  ---------------------------------------------------------------------------
//  CE QUI A DÛ ÊTRE TRADUIT — les deux jeux ne parlent pas tout à fait pareil
//  ---------------------------------------------------------------------------
//
//  1. LES MODÈLES 3D arrivent tels quels dans `creatures3d.k1..k6.js`, branchés
//     sur leur propre bibliothèque de primitives (`kclib`) pour ne pas déformer
//     les créatures maison. Rien à traduire de ce côté : les deux moteurs sont
//     nés du même moule.
//
//  2. LES TYPES. Robin en a dix-neuf, Clélia dix-huit, et ce ne sont pas les
//     mêmes. Trois n'existent pas ici et ont été rabattus sur le plus proche :
//        · Électrik  -> Électrique   (même chose, autre orthographe)
//        · Vol       -> Air          ·  Sol -> Terre
//        · Ténèbres  -> Spectre      (Robin n'a pas de type Ténèbres)
//        · Insecte   -> Plante       (ni de type Insecte : la forêt fait office)
//
//  3. LES CAPACITÉS ne pouvaient PAS être reprises : Clélia les définit avec
//     leur puissance à l'intérieur de la créature, Robin les nomme par leur id
//     dans `moves3d.js`, et les deux barèmes de dégâts n'ont rien à voir
//     (20 de puissance maximum là-bas, 50 ici). Chaque espèce reçoit donc
//     quatre capacités DE CHEZ ROBIN, choisies sur son type — dont toujours
//     un soin, la règle du Pokédex maison.
//
//  4. LES STATISTIQUES. Clélia ne note que les PV ; il manquait l'attaque, la
//     défense et la vitesse. Elles reprennent le profil du vrai Pokémon
//     (Pikachu rapide et fragile, Ronflex lent et solide, Onix mur de pierre),
//     ramené à l'échelle de Robin : une créature de base y tourne autour de
//     35/38/30, un légendaire maison autour de 110/95/85.
//
//  5. LES RÉGIONS. Clélia a un seul grand monde, Robin en a six. Chaque espèce
//     a été rangée là où son type l'appelle : le feu à la Caldeira de Braise,
//     l'eau à la Côte de Saphir, la glace au Massif de Givre, l'électricité à
//     la Sylve d'Ambre, le psy et la lumière au Plateau d'Aurore.
//
//  Chargé APRÈS dex3d.js ET evolve3d.js : il ajoute d'abord les espèces, puis
//  seulement leurs évolutions — l'inverse afficherait « bulbizarre » au lieu
//  de « Herbizarre » dans l'écran Équipe.
// =============================================================================

(function () {
  'use strict';

  var R3ref = (typeof R3 !== 'undefined' && R3) ? R3 : null;
  if (!R3ref || typeof R3ref.get !== 'function') return;

  // ==========================================================================
  //  1. LES 46 ESPÈCES
  //
  //  `hp` reprend la vraie valeur du Pokémon (35 pour Pikachu) : c'est déjà
  //  l'échelle de Robin, celle où une créature de base a entre 40 et 60 PV.
  // ==========================================================================

  var ESPECES = [
    { id: 'bulbizarre', name: 'Bulbizarre',
      types: ['plante', 'poison'], legendary: false,
      regions: ['val', 'sylve'],
      biomes: ['forest', 'plain', 'park', 'jungle', 'swamp'],
      hp: 45, atk: 30, def: 30, speed: 28,
      color: '#78c850', catchRate: 0.7,
      moveIds: ['poudre', 'feuille', 'griffeNoire', 'roseeGuerisseuse'],
      learnset: [{ level: 18, moveId: 'soleil' }, { level: 26, moveId: 'luneEclat' }],
      description: 'Un petit dinosaure vert avec un bulbe sur le dos. Il pousse un peu chaque jour.' },
    { id: 'herbizarre', name: 'Herbizarre',
      types: ['plante', 'poison'], legendary: false,
      regions: ['val', 'sylve'],
      biomes: ['forest', 'park', 'plain', 'jungle', 'swamp'],
      hp: 60, atk: 38, def: 39, speed: 37,
      color: '#5fa845', catchRate: 0.5,
      moveIds: ['poudre', 'feuille', 'griffeNoire', 'roseeGuerisseuse'],
      learnset: [{ level: 18, moveId: 'soleil' }, { level: 26, moveId: 'luneEclat' }],
      description: 'Son bulbe est devenu un gros bouton de fleur. Il sent très bon.' },
    { id: 'florizarre', name: 'Florizarre',
      types: ['plante', 'poison'], legendary: false,
      regions: ['sylve', 'aurore'],
      biomes: ['forest', 'park', 'jungle', 'swamp', 'celestial', 'plain'],
      hp: 80, atk: 51, def: 51, speed: 50,
      color: '#3f9a49', catchRate: 0.32,
      moveIds: ['poudre', 'feuille', 'griffeNoire', 'roseeGuerisseuse'],
      learnset: [{ level: 18, moveId: 'soleil' }, { level: 26, moveId: 'luneEclat' }, { level: 36, moveId: 'foretPrimordiale' }],
      description: 'Une immense fleur rose s\'est ouverte sur son dos. On dort très bien dessous.' },
    { id: 'salameche', name: 'Salamèche',
      types: ['feu'], legendary: false,
      regions: ['braise', 'val'],
      biomes: ['plain', 'park', 'desert', 'volcano', 'forest'],
      hp: 39, atk: 32, def: 27, speed: 40,
      color: '#f08030', catchRate: 0.72,
      moveIds: ['etincelle', 'flamme', 'griffe', 'coconBraise'],
      learnset: [{ level: 18, moveId: 'inferno' }, { level: 26, moveId: 'force' }],
      description: 'Un petit lézard orange. La flamme de sa queue dit s\'il est content ou fatigué.' },
    { id: 'reptincel', name: 'Reptincel',
      types: ['feu'], legendary: false,
      regions: ['braise'],
      biomes: ['plain', 'desert', 'mountain', 'volcano'],
      hp: 58, atk: 40, def: 36, speed: 50,
      color: '#e2622a', catchRate: 0.5,
      moveIds: ['etincelle', 'flamme', 'griffe', 'coconBraise'],
      learnset: [{ level: 18, moveId: 'inferno' }, { level: 26, moveId: 'force' }],
      description: 'Il a grandi, sa flamme est plus haute, et il adore montrer qu\'il court vite.' },
    { id: 'dracaufeu', name: 'Dracaufeu',
      types: ['feu', 'air'], legendary: false,
      regions: ['braise', 'aurore'],
      biomes: ['mountain', 'desert', 'volcano', 'celestial', 'plain'],
      hp: 78, atk: 52, def: 48, speed: 62,
      color: '#ef7d57', catchRate: 0.34,
      moveIds: ['etincelle', 'flamme', 'aile', 'coconBraise'],
      learnset: [{ level: 18, moveId: 'inferno' }, { level: 26, moveId: 'bourrasque' }, { level: 36, moveId: 'souffleDuVolcan' }],
      description: '✦ Le grand dragon orange aux ailes bleues. Il vole si haut qu\'on voit tout le pays ! ✦' },
    { id: 'carapuce', name: 'Carapuce',
      types: ['eau'], legendary: false,
      regions: ['saphir', 'val'],
      biomes: ['lake', 'beach', 'sea', 'forest', 'plain'],
      hp: 44, atk: 30, def: 40, speed: 27,
      color: '#6890f0', catchRate: 0.72,
      moveIds: ['bulle', 'nageoire', 'griffe', 'sourceVive'],
      learnset: [{ level: 18, moveId: 'hydro' }, { level: 26, moveId: 'force' }],
      description: 'Une petite tortue bleue. Quand elle a peur, elle rentre dans sa carapace.' },
    { id: 'carabaffe', name: 'Carabaffe',
      types: ['eau'], legendary: false,
      regions: ['saphir'],
      biomes: ['lake', 'beach', 'sea'],
      hp: 59, atk: 39, def: 50, speed: 36,
      color: '#5a86dd', catchRate: 0.5,
      moveIds: ['bulle', 'nageoire', 'griffe', 'sourceVive'],
      learnset: [{ level: 18, moveId: 'hydro' }, { level: 26, moveId: 'force' }],
      description: 'Sa queue est devenue toute duveteuse. Elle nage très très vite.' },
    { id: 'tortank', name: 'Tortank',
      types: ['eau'], legendary: false,
      regions: ['saphir', 'givre'],
      biomes: ['lake', 'sea', 'beach', 'glacier', 'mountain'],
      hp: 79, atk: 51, def: 62, speed: 48,
      color: '#3b5dc9', catchRate: 0.32,
      moveIds: ['bulle', 'nageoire', 'morsure', 'sourceVive'],
      learnset: [{ level: 18, moveId: 'hydro' }, { level: 26, moveId: 'force' }, { level: 36, moveId: 'deferlanteAbyssale' }],
      description: 'Deux gros canons à eau sortent de sa carapace. C\'est la reine des batailles d\'eau !' },
    { id: 'pikachu', name: 'Pikachu',
      types: ['electrique'], legendary: false,
      regions: ['sylve', 'val'],
      biomes: ['forest', 'plain', 'park', 'city', 'jungle', 'swamp'],
      hp: 35, atk: 34, def: 25, speed: 56,
      color: '#f8d030', catchRate: 0.6,
      moveIds: ['picotement', 'eclair', 'griffe', 'rechargeVive'],
      learnset: [{ level: 18, moveId: 'tonnerre' }, { level: 26, moveId: 'force' }],
      description: 'La petite souris jaune aux joues rouges. Tout le monde la connaît !' },
    { id: 'raichu', name: 'Raichu',
      types: ['electrique'], legendary: false,
      regions: ['sylve'],
      biomes: ['plain', 'city', 'desert', 'jungle', 'swamp'],
      hp: 60, atk: 56, def: 34, speed: 68,
      color: '#f39c12', catchRate: 0.38,
      moveIds: ['picotement', 'eclair', 'morsure', 'rechargeVive'],
      learnset: [{ level: 18, moveId: 'tonnerre' }, { level: 26, moveId: 'force' }, { level: 36, moveId: 'orageCeleste' }],
      description: 'Plus grand, plus orange, avec une longue queue en éclair qui sert de paratonnerre.' },
    { id: 'evoli', name: 'Évoli',
      types: ['normal'], legendary: false,
      regions: ['val', 'sylve'],
      biomes: ['plain', 'park', 'city', 'forest', 'jungle', 'swamp'],
      hp: 55, atk: 34, def: 31, speed: 34,
      color: '#d4a373', catchRate: 0.55,
      moveIds: ['vite', 'assaut', 'griffe', 'soin1'],
      learnset: [{ level: 26, moveId: 'force' }],
      description: 'Une petite boule de poils avec une grande collerette. Elle peut devenir plein de choses !' },
    { id: 'aquali', name: 'Aquali',
      types: ['eau'], legendary: false,
      regions: ['saphir'],
      biomes: ['lake', 'sea', 'beach'],
      hp: 75, atk: 40, def: 37, speed: 40,
      color: '#41a6f6', catchRate: 0.34,
      moveIds: ['bulle', 'nageoire', 'morsure', 'sourceVive'],
      learnset: [{ level: 18, moveId: 'hydro' }, { level: 26, moveId: 'force' }, { level: 36, moveId: 'deferlanteAbyssale' }],
      description: 'Évoli devenue créature des eaux. Ses nageoires brillent comme des perles.' },
    { id: 'pyroli', name: 'Pyroli',
      types: ['feu'], legendary: false,
      regions: ['braise'],
      biomes: ['plain', 'desert', 'city', 'volcano'],
      hp: 65, atk: 58, def: 37, speed: 40,
      color: '#e2622a', catchRate: 0.34,
      moveIds: ['etincelle', 'flamme', 'morsure', 'coconBraise'],
      learnset: [{ level: 18, moveId: 'inferno' }, { level: 26, moveId: 'force' }, { level: 36, moveId: 'souffleDuVolcan' }],
      description: 'Évoli devenue créature de feu. Sa crinière est aussi chaude qu\'une couverture.' },
    { id: 'voltali', name: 'Voltali',
      types: ['electrique'], legendary: false,
      regions: ['sylve'],
      biomes: ['plain', 'park', 'city', 'jungle', 'swamp'],
      hp: 65, atk: 40, def: 37, speed: 62,
      color: '#fde74c', catchRate: 0.34,
      moveIds: ['picotement', 'eclair', 'morsure', 'rechargeVive'],
      learnset: [{ level: 18, moveId: 'tonnerre' }, { level: 26, moveId: 'force' }, { level: 36, moveId: 'orageCeleste' }],
      description: 'Évoli devenue créature d\'électricité. Ses poils se dressent quand elle est contente.' },
    { id: 'rondoudou', name: 'Rondoudou',
      types: ['normal', 'fee'], legendary: false,
      regions: ['val', 'aurore'],
      biomes: ['plain', 'park', 'city', 'forest', 'celestial'],
      hp: 60, atk: 28, def: 22, speed: 20,
      color: '#ffaad8', catchRate: 0.62,
      moveIds: ['vite', 'assaut', 'magie', 'soin1'],
      learnset: [{ level: 26, moveId: 'etoileEx' }],
      description: 'Un ballon rose qui chante. Attention : sa berceuse endort tout le monde !' },
    { id: 'grodoudou', name: 'Grodoudou',
      types: ['normal', 'fee'], legendary: false,
      regions: ['aurore'],
      biomes: ['plain', 'park', 'city', 'celestial'],
      hp: 85, atk: 43, def: 34, speed: 28,
      color: '#ff6b9d', catchRate: 0.36,
      moveIds: ['vite', 'assaut', 'magie', 'soin1'],
      learnset: [{ level: 26, moveId: 'etoileEx' }],
      description: 'Le grand ballon rose. Sa fourrure est si douce qu\'on ne veut plus la lâcher.' },
    { id: 'miaouss', name: 'Miaouss',
      types: ['normal'], legendary: false,
      regions: ['val', 'saphir'],
      biomes: ['city', 'park', 'plain', 'forest', 'sea', 'beach'],
      hp: 40, atk: 28, def: 22, speed: 56,
      color: '#fcd8a0', catchRate: 0.62,
      moveIds: ['vite', 'assaut', 'griffe', 'soin1'],
      learnset: [{ level: 26, moveId: 'force' }],
      description: 'Un chat malin avec une pièce d\'or sur le front. Il adore ce qui brille.' },
    { id: 'persian', name: 'Persian',
      types: ['normal'], legendary: false,
      regions: ['saphir', 'aurore'],
      biomes: ['city', 'park', 'sea', 'beach', 'celestial', 'plain'],
      hp: 65, atk: 43, def: 37, speed: 66,
      color: '#e8dcc0', catchRate: 0.38,
      moveIds: ['vite', 'assaut', 'morsure', 'soin1'],
      learnset: [{ level: 26, moveId: 'force' }],
      description: 'Le chat élégant à la fourrure crème. Il marche comme s\'il était le roi de la ville.' },
    { id: 'ronflex', name: 'Ronflex',
      types: ['normal'], legendary: false,
      regions: ['val', 'sylve'],
      biomes: ['forest', 'plain', 'mountain', 'jungle', 'swamp'],
      hp: 110, atk: 62, def: 44, speed: 19,
      color: '#3b5dc9', catchRate: 0.35,
      moveIds: ['vite', 'assaut', 'morsure', 'soin1'],
      learnset: [{ level: 26, moveId: 'force' }],
      description: 'Une énorme montagne bleue qui dort au milieu du chemin. Il mange, puis il dort.' },
    { id: 'chenipan', name: 'Chenipan',
      types: ['plante'], legendary: false,
      regions: ['val'],
      biomes: ['forest', 'park', 'plain'],
      hp: 45, atk: 19, def: 22, speed: 28,
      color: '#a8b820', catchRate: 0.9,
      moveIds: ['poudre', 'feuille', 'griffe', 'roseeGuerisseuse'],
      learnset: [{ level: 18, moveId: 'soleil' }, { level: 26, moveId: 'force' }],
      description: 'Une chenille verte toute ronde. Elle grimpe partout et sent la feuille fraîche.' },
    { id: 'chrysacier', name: 'Chrysacier',
      types: ['plante'], legendary: false,
      regions: ['val'],
      biomes: ['forest', 'park', 'plain'],
      hp: 50, atk: 14, def: 40, speed: 19,
      color: '#7fbe56', catchRate: 0.75,
      moveIds: ['poudre', 'feuille', 'griffe', 'roseeGuerisseuse'],
      learnset: [{ level: 18, moveId: 'soleil' }, { level: 26, moveId: 'force' }],
      description: 'Une chrysalide verte et brillante. Elle ne bouge presque pas : elle se prépare.' },
    { id: 'papilusion', name: 'Papilusion',
      types: ['plante', 'air'], legendary: false,
      regions: ['val', 'sylve'],
      biomes: ['forest', 'park', 'plain', 'jungle', 'swamp'],
      hp: 60, atk: 30, def: 33, speed: 46,
      color: '#d896ff', catchRate: 0.48,
      moveIds: ['poudre', 'feuille', 'aile', 'roseeGuerisseuse'],
      learnset: [{ level: 18, moveId: 'soleil' }, { level: 26, moveId: 'bourrasque' }, { level: 36, moveId: 'foretPrimordiale' }],
      description: 'Le papillon aux grandes ailes blanches et aux yeux rouges. Il danse dans les rayons de soleil.' },
    { id: 'roucool', name: 'Roucool',
      types: ['normal', 'air'], legendary: false,
      regions: ['val', 'sylve'],
      biomes: ['forest', 'plain', 'park', 'city', 'jungle', 'swamp'],
      hp: 40, atk: 28, def: 25, speed: 38,
      color: '#d4a373', catchRate: 0.8,
      moveIds: ['vite', 'assaut', 'aile', 'soin1'],
      learnset: [{ level: 26, moveId: 'bourrasque' }],
      description: 'Un petit oiseau brun très sage. Il se pose sur ton épaule si tu restes tranquille.' },
    { id: 'mystherbe', name: 'Mystherbe',
      types: ['plante', 'poison'], legendary: false,
      regions: ['sylve', 'val'],
      biomes: ['forest', 'park', 'jungle', 'swamp', 'plain'],
      hp: 45, atk: 31, def: 34, speed: 19,
      color: '#5aa8ff', catchRate: 0.8,
      moveIds: ['poudre', 'feuille', 'griffeNoire', 'roseeGuerisseuse'],
      learnset: [{ level: 18, moveId: 'soleil' }, { level: 26, moveId: 'luneEclat' }],
      description: 'Une petite plante bleue à pattes, avec des feuilles sur la tête. Elle marche la nuit.' },
    { id: 'minidraco', name: 'Minidraco',
      types: ['dragon'], legendary: false,
      regions: ['saphir', 'aurore'],
      biomes: ['lake', 'sea', 'beach', 'celestial', 'plain'],
      hp: 41, atk: 40, def: 30, speed: 33,
      color: '#8fd3f4', catchRate: 0.45,
      moveIds: ['vite', 'assaut', 'dragon', 'soin1'],
      learnset: [{ level: 26, moveId: 'force' }],
      description: '✦ Un tout petit dragon bleu, rare et timide. On dit qu\'il vit au fond des lacs. ✦' },
    { id: 'psykokwak', name: 'Psykokwak',
      types: ['eau'], legendary: false,
      regions: ['saphir', 'val'],
      biomes: ['lake', 'beach', 'sea', 'forest', 'plain'],
      hp: 50, atk: 32, def: 30, speed: 34,
      color: '#fde74c', catchRate: 0.75,
      moveIds: ['bulle', 'nageoire', 'griffe', 'sourceVive'],
      learnset: [{ level: 18, moveId: 'hydro' }, { level: 26, moveId: 'force' }],
      description: 'Un canard jaune qui a toujours un peu mal à la tête. Quand ça va très mal, il fait des miracles !' },
    { id: 'lokhlass', name: 'Lokhlass',
      types: ['eau', 'glace'], legendary: false,
      regions: ['givre', 'saphir'],
      biomes: ['lake', 'sea', 'glacier', 'mountain', 'beach'],
      hp: 90, atk: 53, def: 50, speed: 37,
      color: '#73eff7', catchRate: 0.4,
      moveIds: ['bulle', 'nageoire', 'lameGivre', 'sourceVive'],
      learnset: [{ level: 18, moveId: 'hydro' }, { level: 26, moveId: 'pieuGlace' }, { level: 36, moveId: 'deferlanteAbyssale' }],
      description: 'Un grand dinosaure marin tout doux. Il accepte de porter les enfants sur son dos.' },
    { id: 'tentacool', name: 'Tentacool',
      types: ['eau', 'poison'], legendary: false,
      regions: ['saphir'],
      biomes: ['sea', 'beach'],
      hp: 40, atk: 27, def: 24, speed: 45,
      color: '#41a6f6', catchRate: 0.8,
      moveIds: ['bulle', 'nageoire', 'griffeNoire', 'sourceVive'],
      learnset: [{ level: 18, moveId: 'hydro' }, { level: 26, moveId: 'luneEclat' }],
      description: 'Une méduse bleue translucide avec deux perles rouges. Elle flotte sans jamais se presser.' },
    { id: 'krabby', name: 'Krabby',
      types: ['eau'], legendary: false,
      regions: ['saphir'],
      biomes: ['beach', 'sea', 'lake'],
      hp: 36, atk: 58, def: 50, speed: 31,
      color: '#e74c3c', catchRate: 0.85,
      moveIds: ['bulle', 'nageoire', 'griffe', 'sourceVive'],
      learnset: [{ level: 18, moveId: 'hydro' }, { level: 26, moveId: 'force' }],
      description: 'Un petit crabe rouge avec deux pinces énormes. Il court de côté à toute vitesse.' },
    { id: 'otaria', name: 'Otaria',
      types: ['eau', 'glace'], legendary: false,
      regions: ['givre', 'saphir'],
      biomes: ['beach', 'sea', 'mountain', 'glacier'],
      hp: 65, atk: 30, def: 36, speed: 30,
      color: '#f4f4f4', catchRate: 0.6,
      moveIds: ['bulle', 'nageoire', 'lameGivre', 'sourceVive'],
      learnset: [{ level: 18, moveId: 'hydro' }, { level: 26, moveId: 'pieuGlace' }],
      description: 'Un bébé phoque blanc avec une corne sur le nez. Il glisse sur le ventre en riant.' },
    { id: 'kokiyas', name: 'Kokiyas',
      types: ['eau'], legendary: false,
      regions: ['saphir', 'givre'],
      biomes: ['beach', 'sea', 'glacier', 'mountain'],
      hp: 36, atk: 40, def: 58, speed: 25,
      color: '#3b5dc9', catchRate: 0.8,
      moveIds: ['bulle', 'nageoire', 'griffe', 'sourceVive'],
      learnset: [{ level: 18, moveId: 'hydro' }, { level: 26, moveId: 'force' }],
      description: 'Un coquillage bleu qui claque en s\'ouvrant et se fermant. À l\'intérieur, une perle rose.' },
    { id: 'rattata', name: 'Rattata',
      types: ['normal'], legendary: false,
      regions: ['val', 'sylve'],
      biomes: ['plain', 'park', 'city', 'forest', 'jungle', 'swamp'],
      hp: 36, atk: 35, def: 24, speed: 47,
      color: '#a040a0', catchRate: 0.9,
      moveIds: ['vite', 'assaut', 'griffe', 'soin1'],
      learnset: [{ level: 26, moveId: 'force' }],
      description: 'Une petite souris violette avec de grandes dents. Elle grignote absolument tout.' },
    { id: 'chetiflor', name: 'Chétiflor',
      types: ['plante', 'poison'], legendary: false,
      regions: ['sylve'],
      biomes: ['park', 'forest', 'plain', 'jungle', 'swamp'],
      hp: 50, atk: 47, def: 24, speed: 25,
      color: '#fde74c', catchRate: 0.75,
      moveIds: ['poudre', 'feuille', 'griffeNoire', 'roseeGuerisseuse'],
      learnset: [{ level: 18, moveId: 'soleil' }, { level: 26, moveId: 'luneEclat' }],
      description: 'Une fleur jaune au bout d\'une tige verte. Elle se balance en chantonnant.' },
    { id: 'goupix', name: 'Goupix',
      types: ['feu'], legendary: false,
      regions: ['braise'],
      biomes: ['desert', 'plain', 'city', 'volcano'],
      hp: 38, atk: 27, def: 27, speed: 42,
      color: '#ef7d57', catchRate: 0.7,
      moveIds: ['etincelle', 'flamme', 'griffe', 'coconBraise'],
      learnset: [{ level: 18, moveId: 'inferno' }, { level: 26, moveId: 'force' }],
      description: 'Un petit renard roux à six queues. Chaque queue qu\'il gagne le rend plus malin.' },
    { id: 'sabelette', name: 'Sabelette',
      types: ['terre'], legendary: false,
      regions: ['braise', 'givre'],
      biomes: ['desert', 'beach', 'volcano', 'glacier', 'mountain'],
      hp: 50, atk: 47, def: 53, speed: 25,
      color: '#e0c068', catchRate: 0.8,
      moveIds: ['jetSable', 'secousse', 'griffe', 'terreNourriciere'],
      learnset: [{ level: 18, moveId: 'crevasse' }, { level: 26, moveId: 'force' }],
      description: 'Un pangolin jaune qui se roule en boule. Il creuse des tunnels dans le sable.' },
    { id: 'galopa', name: 'Galopa',
      types: ['feu'], legendary: false,
      regions: ['braise'],
      biomes: ['desert', 'plain', 'volcano'],
      hp: 65, atk: 55, def: 36, speed: 58,
      color: '#f39c12', catchRate: 0.5,
      moveIds: ['etincelle', 'flamme', 'morsure', 'coconBraise'],
      learnset: [{ level: 18, moveId: 'inferno' }, { level: 26, moveId: 'force' }, { level: 36, moveId: 'souffleDuVolcan' }],
      description: 'Un cheval blanc à la crinière de feu. Il court plus vite que le vent du désert.' },
    { id: 'nosferapti', name: 'Nosferapti',
      types: ['poison', 'air'], legendary: false,
      regions: ['sylve', 'givre'],
      biomes: ['desert', 'mountain', 'city', 'jungle', 'swamp', 'glacier'],
      hp: 40, atk: 30, def: 24, speed: 36,
      color: '#5a5aa8', catchRate: 0.8,
      moveIds: ['frisson', 'griffeNoire', 'aile', 'voileReparateur'],
      learnset: [{ level: 18, moveId: 'luneEclat' }, { level: 26, moveId: 'bourrasque' }],
      description: 'Une petite chauve-souris bleue sans yeux. Elle voit avec ses oreilles, c\'est magique.' },
    { id: 'racaillou', name: 'Racaillou',
      types: ['roche', 'terre'], legendary: false,
      regions: ['givre', 'braise'],
      biomes: ['mountain', 'desert', 'glacier', 'volcano'],
      hp: 40, atk: 50, def: 60, speed: 14,
      color: '#8a9199', catchRate: 0.8,
      moveIds: ['galet', 'eclatPierre', 'secousse', 'carapaceDePierre'],
      learnset: [{ level: 18, moveId: 'poingGranit' }, { level: 26, moveId: 'crevasse' }],
      description: 'Un caillou vivant avec deux bras musclés. Il dévale les pentes en roulant.' },
    { id: 'onix', name: 'Onix',
      types: ['roche', 'terre'], legendary: false,
      regions: ['givre', 'braise'],
      biomes: ['mountain', 'glacier', 'volcano', 'desert'],
      hp: 62, atk: 30, def: 78, speed: 45,
      color: '#7f8c8d', catchRate: 0.45,
      moveIds: ['galet', 'eclatPierre', 'secousse', 'carapaceDePierre'],
      learnset: [{ level: 18, moveId: 'poingGranit' }, { level: 26, moveId: 'crevasse' }],
      description: 'Un immense serpent de rochers. Quand il passe sous la montagne, on l\'entend gronder.' },
    { id: 'magneti', name: 'Magnéti',
      types: ['electrique', 'acier'], legendary: false,
      regions: ['sylve', 'aurore'],
      biomes: ['mountain', 'city', 'jungle', 'swamp', 'celestial', 'plain'],
      hp: 45, atk: 24, def: 45, speed: 30,
      color: '#b8b8d0', catchRate: 0.7,
      moveIds: ['picotement', 'eclair', 'eclatPierre', 'rechargeVive'],
      learnset: [{ level: 18, moveId: 'tonnerre' }, { level: 26, moveId: 'poingGranit' }],
      description: 'Un aimant flottant avec un grand œil. Il fait « bzzz » et attire tout ce qui est en métal.' },
    { id: 'farfuret', name: 'Farfuret',
      types: ['spectre', 'glace'], legendary: false,
      regions: ['givre'],
      biomes: ['mountain', 'glacier'],
      hp: 55, atk: 57, def: 36, speed: 68,
      color: '#5d275d', catchRate: 0.55,
      moveIds: ['frisson', 'griffeNoire', 'lameGivre', 'voileReparateur'],
      learnset: [{ level: 18, moveId: 'luneEclat' }, { level: 26, moveId: 'pieuGlace' }],
      description: 'Un petit espiègle noir et rouge, vif comme l\'éclair. Il adore cacher les objets.' },
    { id: 'caninos', name: 'Caninos',
      types: ['feu'], legendary: false,
      regions: ['braise', 'val'],
      biomes: ['city', 'plain', 'park', 'volcano', 'desert', 'forest'],
      hp: 55, atk: 43, def: 30, speed: 39,
      color: '#f08030', catchRate: 0.7,
      moveIds: ['etincelle', 'flamme', 'griffe', 'coconBraise'],
      learnset: [{ level: 18, moveId: 'inferno' }, { level: 26, moveId: 'force' }],
      description: 'Un chiot orange rayé de noir. Il suit toujours son ami, où qu\'il aille.' },
    { id: 'fantominus', name: 'Fantominus',
      types: ['spectre', 'poison'], legendary: false,
      regions: ['sylve', 'aurore'],
      biomes: ['city', 'forest', 'jungle', 'swamp', 'celestial', 'plain'],
      hp: 45, atk: 24, def: 21, speed: 52,
      color: '#705898', catchRate: 0.65,
      moveIds: ['frisson', 'griffeNoire', 'griffe', 'voileReparateur'],
      learnset: [{ level: 18, moveId: 'luneEclat' }, { level: 26, moveId: 'force' }],
      description: 'Un petit fantôme violet qui flotte. Il fait des grimaces, mais il n\'est pas méchant du tout.' },
    { id: 'machoc', name: 'Machoc',
      types: ['combat'], legendary: false,
      regions: ['braise', 'givre'],
      biomes: ['city', 'mountain', 'volcano', 'desert', 'glacier'],
      hp: 70, atk: 50, def: 33, speed: 24,
      color: '#5aa8ff', catchRate: 0.6,
      moveIds: ['vite', 'assaut', 'force', 'soin1'],
      learnset: [{ level: 26, moveId: 'force' }],
      description: 'Un costaud bleu très musclé. Il soulève des rochers pour s\'entraîner... et pour aider.' },
    { id: 'abra', name: 'Abra',
      types: ['psy'], legendary: false,
      regions: ['aurore', 'val'],
      biomes: ['city', 'park', 'forest', 'celestial', 'plain'],
      hp: 45, atk: 16, def: 12, speed: 56,
      color: '#f1c40f', catchRate: 0.5,
      moveIds: ['etoile', 'magie', 'griffe', 'soinMagie'],
      learnset: [{ level: 18, moveId: 'etoileEx' }, { level: 26, moveId: 'force' }],
      description: 'Un petit renard doré qui dort dix-huit heures par jour. Il se téléporte même en dormant !' },
  ];

  // ==========================================================================
  //  2. ENTRÉE AU POKÉDEX
  //
  //  `dex.add()` refuse toute espèce dont l'id existe déjà : les 26 créatures
  //  maison et les 36 légendaires ne risquent rien, et une partie commencée
  //  avant aujourd'hui se rouvre à l'identique.
  // ==========================================================================

  var dex = R3ref.get('dex');
  var ajoutes = 0;
  if (dex && typeof dex.add === 'function') {
    try { ajoutes = dex.add(ESPECES); }
    catch (e) { console.warn('[dexk3d] ajout au Pokédex impossible :', e); }
  } else {
    console.warn('[dexk3d] dex3d absent ou trop ancien : les 52 espèces restent à quai.');
  }

  // ==========================================================================
  //  3. LES ÉVOLUTIONS
  //
  //  Les niveaux ont été RÉÉCRITS, pas repris : chez Clélia, Salamèche devient
  //  Reptincel au niveau 5 parce que son jeu est plus court. Ici, les trois
  //  départs de Kanto suivent la courbe maison — 16 puis 34, comme Feuillou et
  //  Flamdrak — pour que Robin ait la même montée d'un bout à l'autre du jeu.
  //  Les chenilles font exception : Chenipan devient Chrysacier à 8 et
  //  Papilusion à 12. C'est une chenille, elle ne va pas attendre trente
  //  niveaux pour faire son cocon.
  //
  //  ÉVOLI n'a qu'UNE évolution ici, Aquali. Le moteur d'évolution de Robin
  //  range une seule suite par espèce : impossible de proposer les trois d'un
  //  coup sans le réécrire. Pyroli et Voltali existent bel et bien — ils se
  //  capturent, à la Caldeira de Braise et dans la Sylve d'Ambre.
  // ==========================================================================

  var CHAINES = [
    { from: 'bulbizarre', to: 'herbizarre', level: 16,
      message: 'Bulbizarre évolue en Herbizarre !' },
    { from: 'herbizarre', to: 'florizarre', level: 34,
      message: 'Herbizarre évolue en Florizarre !' },
    { from: 'salameche', to: 'reptincel', level: 16,
      message: 'Salamèche évolue en Reptincel !' },
    { from: 'reptincel', to: 'dracaufeu', level: 34,
      message: 'Reptincel évolue en Dracaufeu !' },
    { from: 'carapuce', to: 'carabaffe', level: 16,
      message: 'Carapuce évolue en Carabaffe !' },
    { from: 'carabaffe', to: 'tortank', level: 34,
      message: 'Carabaffe évolue en Tortank !' },
    { from: 'chenipan', to: 'chrysacier', level: 8,
      message: 'Chenipan évolue en Chrysacier !' },
    { from: 'chrysacier', to: 'papilusion', level: 12,
      message: 'Chrysacier évolue en Papilusion !' },
    { from: 'pikachu', to: 'raichu', level: 22,
      message: 'Pikachu évolue en Raichu !' },
    { from: 'evoli', to: 'aquali', level: 22,
      message: 'Évoli évolue en Aquali !' },
    { from: 'rondoudou', to: 'grodoudou', level: 22,
      message: 'Rondoudou évolue en Grodoudou !' },
    { from: 'miaouss', to: 'persian', level: 22,
      message: 'Miaouss évolue en Persian !' },
  ];

  var evo = R3ref.get('evolve');
  var chaines = 0;
  if (evo && typeof evo.addStep === 'function') {
    for (var i = 0; i < CHAINES.length; i++) {
      try { if (evo.addStep(CHAINES[i])) chaines++; }
      catch (e) { console.warn('[dexk3d] évolution refusée :', CHAINES[i].from, e); }
    }
  }

  // ==========================================================================
  //  4. API — surtout utile aux harnais de vérification
  // ==========================================================================

  var API = {
    ESPECES: ESPECES,
    CHAINES: CHAINES,
    ajoutes: ajoutes,
    chaines: chaines,
    ids: function () {
      var out = [];
      for (var i = 0; i < ESPECES.length; i++) out.push(ESPECES[i].id);
      return out;
    },
    legendaires: function () {
      var out = [];
      for (var i = 0; i < ESPECES.length; i++) if (ESPECES[i].legendary) out.push(ESPECES[i].id);
      return out;
    },
  };

  if (typeof R3ref.register === 'function') R3ref.register('dexk', API);
  if (typeof window !== 'undefined') window.DEXK3D = API;
})();
