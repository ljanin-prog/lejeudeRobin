// Les "animaux fabuleux" que l'on peut capturer.
// Chaque créature a un dessin procédural (fonction draw) pour gagner du temps
// et leur donner plus de personnalité que des sprites 16x16.

const CREATURES = [
  {
    id: 'feuillou',
    name: 'Feuillou',
    biomes: ['forest'],
    description: 'Une feuille vivante toute mignonne.',
    catchRate: 0.85,
    color: '#38b764',
    draw: drawFeuillou,
  },
  {
    id: 'petalia',
    name: 'Pétalia',
    biomes: ['forest', 'plain', 'park'],
    description: 'Une petite fleur magique qui sourit.',
    catchRate: 0.85,
    color: '#ffaad8',
    draw: drawPetalia,
  },
  {
    id: 'goutella',
    name: 'Goutella',
    biomes: ['lake'],
    description: 'Une goutte d\'eau pleine de joie.',
    catchRate: 0.8,
    color: '#41a6f6',
    draw: drawGoutella,
  },
  {
    id: 'bullini',
    name: 'Bullini',
    biomes: ['lake', 'sea'],
    description: 'Un petit poisson bulle facétieux.',
    catchRate: 0.8,
    color: '#73eff7',
    draw: drawBullini,
  },
  {
    id: 'etincelo',
    name: 'Étincelo',
    biomes: ['plain', 'park'],
    description: 'Une étincelle dorée qui scintille.',
    catchRate: 0.75,
    color: '#f1c40f',
    draw: drawEtincelo,
  },
  {
    id: 'meduzia',
    name: 'Méduzia',
    biomes: ['sea'],
    description: 'Une méduse rose qui flotte gracieusement.',
    catchRate: 0.7,
    color: '#d896ff',
    draw: drawMeduzia,
  },
  {
    id: 'coralou',
    name: 'Coralou',
    biomes: ['sea'],
    description: 'Un petit corail dansant.',
    catchRate: 0.7,
    color: '#fc7460',
    draw: drawCoralou,
  },
  {
    id: 'fluffly',
    name: 'Fluffly',
    biomes: ['plain', 'forest', 'park'],
    description: 'Une boule de poil qui rebondit.',
    catchRate: 0.85,
    color: '#fcef8d',
    draw: drawFluffly,
  },
  {
    id: 'glanou',
    name: 'Glanou',
    biomes: ['forest'],
    description: 'Un petit gland avec un chapeau rigolo.',
    catchRate: 0.85,
    color: '#8b5a2b',
    draw: drawGlanou,
  },
  {
    id: 'papillon',
    name: 'Papillon',
    biomes: ['forest', 'plain', 'park'],
    description: 'Un papillon aux ailes rose et violet.',
    catchRate: 0.7,
    color: '#d896ff',
    draw: drawPapillon,
  },
  {
    id: 'cygnik',
    name: 'Cygnik',
    biomes: ['lake'],
    description: 'Un cygne gracieux qui glisse sur l\'eau.',
    catchRate: 0.65,
    color: '#f4f4f4',
    draw: drawCygnik,
  },
  {
    id: 'lotira',
    name: 'Lotira',
    biomes: ['lake'],
    description: 'Un nénuphar enchanté tout rose.',
    catchRate: 0.8,
    color: '#ffaad8',
    draw: drawLotira,
  },
  {
    id: 'lapinou',
    name: 'Lapinou',
    biomes: ['plain', 'park'],
    description: 'Un petit lapin tout doux avec de grandes oreilles.',
    catchRate: 0.85,
    color: '#f4f4f4',
    draw: drawLapinou,
  },
  {
    id: 'hibouche',
    name: 'Hibouché',
    biomes: ['forest', 'plain', 'park'],
    description: 'Un hibou aux yeux immenses.',
    catchRate: 0.75,
    color: '#8b5a2b',
    draw: drawHibouche,
  },
  {
    id: 'etoilamer',
    name: 'Étoilamer',
    biomes: ['sea'],
    description: 'Une étoile de mer souriante.',
    catchRate: 0.85,
    color: '#ff6b9d',
    draw: drawEtoilamer,
  },
  {
    id: 'crabilino',
    name: 'Crabilino',
    biomes: ['sea'],
    description: 'Un crabe rouge qui fait clic-clac.',
    catchRate: 0.7,
    color: '#e74c3c',
    draw: drawCrabilino,
  },
  {
    id: 'nuagette',
    name: 'Nuagette',
    biomes: ['forest', 'lake', 'plain', 'sea', 'park'],
    description: '✦ Un esprit nuage très très rare ! ✦',
    catchRate: 0.5,
    color: '#f4f4f4',
    rare: true,
    draw: drawNuagette,
  },

  // === CRÉATURES KAWAII ===
  {
    id: 'miaouche',
    name: 'Miaouche',
    biomes: ['village', 'plain', 'park'],
    description: 'Un adorable petit chat aux yeux immenses.',
    catchRate: 0.85,
    color: '#f4f4f4',
    kawaii: true,
    draw: drawMiaouche,
  },
  {
    id: 'pandouki',
    name: 'Pandouki',
    biomes: ['forest', 'mountain'],
    description: 'Un panda tout rond et doux.',
    catchRate: 0.8,
    color: '#f4f4f4',
    kawaii: true,
    draw: drawPandouki,
  },
  {
    id: 'koronette',
    name: 'Koronette',
    biomes: ['park', 'forest', 'plain'],
    description: 'Une fée couronnée qui répand des étoiles magiques.',
    catchRate: 0.7,
    color: '#d896ff',
    kawaii: true,
    draw: drawKoronette,
  },
  {
    id: 'stellini',
    name: 'Stellini',
    biomes: ['plain', 'park', 'village'],
    description: 'Un lapin-étoile tout doré et scintillant.',
    catchRate: 0.75,
    color: '#f1c40f',
    kawaii: true,
    draw: drawStellini,
  },
  {
    id: 'doudoune',
    name: 'Doudoune',
    biomes: ['forest', 'plain', 'village'],
    description: 'Un poussin duveteux tout rond et tout doux.',
    catchRate: 0.85,
    color: '#f1c40f',
    kawaii: true,
    draw: drawDoudoune,
  },

  // === DRAGONS ===
  {
    id: 'flamdrak',
    name: 'Flamdrak',
    biomes: ['mountain'],
    description: '✦ Un petit dragon de feu aux cornes fières. ✦',
    catchRate: 0.55,
    color: '#e74c3c',
    dragon: true,
    draw: drawFlamdrak,
  },
  {
    id: 'glydrak',
    name: 'Glydrak',
    biomes: ['mountain'],
    description: '✦ Un dragon ailé au regard perçant et mystérieux. ✦',
    catchRate: 0.4,
    color: '#5d275d',
    dragon: true,
    rare: true,
    draw: drawGlydrak,
  },
  {
    id: 'aquadrak',
    name: 'Aquadrak',
    biomes: ['lake', 'sea'],
    description: '✦ Un dragon des eaux aux écailles turquoise. ✦',
    catchRate: 0.5,
    color: '#1abc9c',
    dragon: true,
    draw: drawAquadrak,
  },
  {
    id: 'tonnedrak',
    name: 'Tonnedrak',
    biomes: ['mountain', 'plain'],
    description: '✦ Un dragon électrique aux crêtes en éclair ! ✦',
    catchRate: 0.4,
    color: '#f1c40f',
    dragon: true,
    rare: true,
    draw: drawTonnedrak,
  },
];

function getCreaturesForBiome(biome) {
  return CREATURES.filter(c => c.biomes.includes(biome));
}

const RARE_ENCOUNTER_CHANCE = 0.07;

function pickRandomCreature(biome) {
  const inBiome = CREATURES.filter(c => c.biomes.includes(biome));
  const rares = inBiome.filter(c => c.rare);
  const commons = inBiome.filter(c => !c.rare);
  // Chance faible de tomber sur une créature rare
  if (rares.length > 0 && Math.random() < RARE_ENCOUNTER_CHANCE) {
    return rares[Math.floor(Math.random() * rares.length)];
  }
  if (commons.length > 0) {
    return commons[Math.floor(Math.random() * commons.length)];
  }
  return inBiome[0] || CREATURES[0];
}

// ====== Fonctions de dessin des créatures ======
// Convention : (ctx, x, y, s) où s = échelle (1 = petit / monde, 2-3 = combat)
// Dessine dans une boîte 16*s × 16*s à partir du coin haut-gauche (x, y).

function drawFeuillou(ctx, x, y, s = 1) {
  // Feuille verte avec yeux et bouche
  ctx.fillStyle = '#1e8449';
  // Contour feuille
  ovalFill(ctx, x + 8 * s, y + 8 * s, 7 * s, 6 * s);
  ctx.fillStyle = '#27ae60';
  ovalFill(ctx, x + 8 * s, y + 8 * s, 6 * s, 5 * s);
  ctx.fillStyle = '#38b764';
  ovalFill(ctx, x + 8 * s, y + 7 * s, 4 * s, 3 * s);
  // Veines
  ctx.fillStyle = '#1e8449';
  rect(ctx, x + 8 * s, y + 4 * s, 1 * s, 7 * s);
  // Yeux
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 5 * s, y + 7 * s, 2 * s, 2 * s);
  rect(ctx, x + 9 * s, y + 7 * s, 2 * s, 2 * s);
  // Reflet dans les yeux
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x + 5 * s, y + 7 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 7 * s, 1 * s, 1 * s);
  // Bouche souriante
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 7 * s, y + 10 * s, 2 * s, 1 * s);
  rect(ctx, x + 6 * s, y + 11 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 11 * s, 1 * s, 1 * s);
  // Petite tige
  ctx.fillStyle = '#8b5a2b';
  rect(ctx, x + 7 * s, y + 14 * s, 2 * s, 2 * s);
}

function drawPetalia(ctx, x, y, s = 1) {
  // 5 pétales roses autour d'un centre jaune
  ctx.fillStyle = '#ffaad8';
  ovalFill(ctx, x + 8 * s, y + 3 * s, 2 * s, 2 * s);   // pétale haut
  ovalFill(ctx, x + 4 * s, y + 6 * s, 2 * s, 2 * s);   // pétale gauche-haut
  ovalFill(ctx, x + 12 * s, y + 6 * s, 2 * s, 2 * s);  // pétale droit-haut
  ovalFill(ctx, x + 4 * s, y + 10 * s, 2 * s, 2 * s);  // pétale gauche-bas
  ovalFill(ctx, x + 12 * s, y + 10 * s, 2 * s, 2 * s); // pétale droit-bas
  ctx.fillStyle = '#ff6b9d';
  // Liseré
  ovalFill(ctx, x + 8 * s, y + 3 * s, 1 * s, 1 * s);
  // Centre jaune
  ctx.fillStyle = '#f1c40f';
  ovalFill(ctx, x + 8 * s, y + 8 * s, 3 * s, 3 * s);
  ctx.fillStyle = '#fde74c';
  ovalFill(ctx, x + 8 * s, y + 7 * s, 2 * s, 2 * s);
  // Yeux
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 6 * s, y + 7 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 7 * s, 1 * s, 1 * s);
  // Bouche
  rect(ctx, x + 7 * s, y + 9 * s, 2 * s, 1 * s);
  // Tige
  ctx.fillStyle = '#27ae60';
  rect(ctx, x + 7 * s, y + 12 * s, 2 * s, 4 * s);
  // Feuille
  ctx.fillStyle = '#38b764';
  rect(ctx, x + 9 * s, y + 13 * s, 2 * s, 1 * s);
  rect(ctx, x + 10 * s, y + 14 * s, 1 * s, 1 * s);
}

function drawGoutella(ctx, x, y, s = 1) {
  // Goutte d'eau
  ctx.fillStyle = '#3b5dc9';
  // Pointe haut
  rect(ctx, x + 7 * s, y + 1 * s, 2 * s, 1 * s);
  rect(ctx, x + 6 * s, y + 2 * s, 4 * s, 1 * s);
  rect(ctx, x + 5 * s, y + 3 * s, 6 * s, 1 * s);
  // Corps arrondi
  ovalFill(ctx, x + 8 * s, y + 10 * s, 6 * s, 5 * s);
  ctx.fillStyle = '#41a6f6';
  ovalFill(ctx, x + 8 * s, y + 10 * s, 5 * s, 4 * s);
  rect(ctx, x + 6 * s, y + 4 * s, 4 * s, 2 * s);
  // Reflet brillant
  ctx.fillStyle = '#73eff7';
  ovalFill(ctx, x + 6 * s, y + 8 * s, 2 * s, 2 * s);
  rect(ctx, x + 7 * s, y + 5 * s, 1 * s, 2 * s);
  // Yeux
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 6 * s, y + 9 * s, 2 * s, 2 * s);
  rect(ctx, x + 10 * s, y + 9 * s, 2 * s, 2 * s);
  // Sourire
  rect(ctx, x + 7 * s, y + 12 * s, 1 * s, 1 * s);
  rect(ctx, x + 8 * s, y + 13 * s, 2 * s, 1 * s);
  rect(ctx, x + 10 * s, y + 12 * s, 1 * s, 1 * s);
}

function drawBullini(ctx, x, y, s = 1) {
  // Poisson rond cyan
  ctx.fillStyle = '#41a6f6';
  ovalFill(ctx, x + 7 * s, y + 8 * s, 5 * s, 4 * s);
  ctx.fillStyle = '#73eff7';
  ovalFill(ctx, x + 7 * s, y + 8 * s, 4 * s, 3 * s);
  // Ventre clair
  ctx.fillStyle = '#bce884';
  rect(ctx, x + 5 * s, y + 10 * s, 5 * s, 2 * s);
  // Nageoire arrière
  ctx.fillStyle = '#3b5dc9';
  rect(ctx, x + 12 * s, y + 6 * s, 1 * s, 2 * s);
  rect(ctx, x + 13 * s, y + 5 * s, 1 * s, 4 * s);
  rect(ctx, x + 12 * s, y + 9 * s, 1 * s, 2 * s);
  rect(ctx, x + 13 * s, y + 10 * s, 1 * s, 1 * s);
  // Nageoire dorsale
  rect(ctx, x + 7 * s, y + 4 * s, 1 * s, 2 * s);
  rect(ctx, x + 8 * s, y + 5 * s, 1 * s, 1 * s);
  // Œil
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x + 5 * s, y + 7 * s, 2 * s, 2 * s);
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 5 * s, y + 7 * s, 1 * s, 1 * s);
  // Bouche
  rect(ctx, x + 3 * s, y + 9 * s, 1 * s, 1 * s);
  // Bulles
  ctx.fillStyle = '#73eff7';
  rect(ctx, x + 2 * s, y + 5 * s, 1 * s, 1 * s);
  rect(ctx, x + 1 * s, y + 3 * s, 1 * s, 1 * s);
}

function drawEtincelo(ctx, x, y, s = 1) {
  // Étoile dorée à 4 branches + lueur
  ctx.fillStyle = '#fcef8d';
  // Lueur diffuse
  rect(ctx, x + 6 * s, y + 6 * s, 4 * s, 4 * s);
  rect(ctx, x + 5 * s, y + 7 * s, 6 * s, 2 * s);
  rect(ctx, x + 7 * s, y + 5 * s, 2 * s, 6 * s);
  // Étoile centrale
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x + 7 * s, y + 4 * s, 2 * s, 8 * s);     // vertical
  rect(ctx, x + 4 * s, y + 7 * s, 8 * s, 2 * s);     // horizontal
  rect(ctx, x + 5 * s, y + 5 * s, 1 * s, 1 * s);     // diagonale
  rect(ctx, x + 10 * s, y + 5 * s, 1 * s, 1 * s);
  rect(ctx, x + 5 * s, y + 10 * s, 1 * s, 1 * s);
  rect(ctx, x + 10 * s, y + 10 * s, 1 * s, 1 * s);
  // Cœur lumineux blanc
  ctx.fillStyle = '#fff0c8';
  rect(ctx, x + 7 * s, y + 7 * s, 2 * s, 2 * s);
  // Yeux mignons
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 6 * s, y + 7 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 7 * s, 1 * s, 1 * s);
  // Petites étincelles autour
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x + 2 * s, y + 2 * s, 1 * s, 1 * s);
  rect(ctx, x + 13 * s, y + 3 * s, 1 * s, 1 * s);
  rect(ctx, x + 1 * s, y + 12 * s, 1 * s, 1 * s);
  rect(ctx, x + 14 * s, y + 13 * s, 1 * s, 1 * s);
}

function drawMeduzia(ctx, x, y, s = 1) {
  // Méduse rose : dôme + tentacules
  ctx.fillStyle = '#d896ff';
  // Dôme
  rect(ctx, x + 4 * s, y + 3 * s, 8 * s, 5 * s);
  rect(ctx, x + 3 * s, y + 4 * s, 10 * s, 3 * s);
  rect(ctx, x + 5 * s, y + 2 * s, 6 * s, 1 * s);
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x + 4 * s, y + 4 * s, 8 * s, 3 * s);
  rect(ctx, x + 5 * s, y + 3 * s, 6 * s, 1 * s);
  // Bord du dôme
  ctx.fillStyle = '#9b59b6';
  rect(ctx, x + 3 * s, y + 7 * s, 10 * s, 1 * s);
  // Tentacules ondulés
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x + 4 * s, y + 8 * s, 1 * s, 4 * s);
  rect(ctx, x + 3 * s, y + 12 * s, 1 * s, 2 * s);
  rect(ctx, x + 6 * s, y + 8 * s, 1 * s, 3 * s);
  rect(ctx, x + 7 * s, y + 11 * s, 1 * s, 3 * s);
  rect(ctx, x + 6 * s, y + 14 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 8 * s, 1 * s, 3 * s);
  rect(ctx, x + 10 * s, y + 11 * s, 1 * s, 3 * s);
  rect(ctx, x + 11 * s, y + 8 * s, 1 * s, 4 * s);
  rect(ctx, x + 12 * s, y + 12 * s, 1 * s, 2 * s);
  // Yeux sur le dôme
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 6 * s, y + 5 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 5 * s, 1 * s, 1 * s);
  // Joues roses
  ctx.fillStyle = '#ff6b9d';
  rect(ctx, x + 5 * s, y + 6 * s, 1 * s, 1 * s);
  rect(ctx, x + 10 * s, y + 6 * s, 1 * s, 1 * s);
}

function drawCoralou(ctx, x, y, s = 1) {
  // Petit corail rouge/orange
  ctx.fillStyle = '#fc7460';
  // Branches
  rect(ctx, x + 7 * s, y + 5 * s, 2 * s, 8 * s);
  rect(ctx, x + 5 * s, y + 7 * s, 2 * s, 6 * s);
  rect(ctx, x + 9 * s, y + 7 * s, 2 * s, 6 * s);
  rect(ctx, x + 3 * s, y + 9 * s, 2 * s, 4 * s);
  rect(ctx, x + 11 * s, y + 9 * s, 2 * s, 4 * s);
  ctx.fillStyle = '#ef7d57';
  rect(ctx, x + 7 * s, y + 4 * s, 2 * s, 2 * s);
  rect(ctx, x + 5 * s, y + 6 * s, 1 * s, 2 * s);
  rect(ctx, x + 10 * s, y + 6 * s, 1 * s, 2 * s);
  rect(ctx, x + 3 * s, y + 8 * s, 1 * s, 2 * s);
  rect(ctx, x + 12 * s, y + 8 * s, 1 * s, 2 * s);
  // Pointes blanches
  ctx.fillStyle = '#fff0c8';
  rect(ctx, x + 7 * s, y + 4 * s, 2 * s, 1 * s);
  rect(ctx, x + 5 * s, y + 6 * s, 1 * s, 1 * s);
  rect(ctx, x + 10 * s, y + 6 * s, 1 * s, 1 * s);
  rect(ctx, x + 3 * s, y + 8 * s, 1 * s, 1 * s);
  rect(ctx, x + 12 * s, y + 8 * s, 1 * s, 1 * s);
  // Base (sable)
  ctx.fillStyle = '#fcd8a0';
  rect(ctx, x + 2 * s, y + 13 * s, 12 * s, 2 * s);
  // Yeux
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 7 * s, y + 9 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 9 * s, 1 * s, 1 * s);
  // Sourire
  rect(ctx, x + 7 * s, y + 11 * s, 2 * s, 1 * s);
}

function drawFluffly(ctx, x, y, s = 1) {
  // Boule de poil jaune toute ronde
  ctx.fillStyle = '#f39c12';
  ovalFill(ctx, x + 8 * s, y + 9 * s, 6 * s, 5 * s);
  ctx.fillStyle = '#fde74c';
  ovalFill(ctx, x + 8 * s, y + 9 * s, 5 * s, 4 * s);
  ctx.fillStyle = '#fcef8d';
  ovalFill(ctx, x + 7 * s, y + 8 * s, 3 * s, 2 * s);
  // Oreilles
  ctx.fillStyle = '#f39c12';
  rect(ctx, x + 3 * s, y + 4 * s, 2 * s, 3 * s);
  rect(ctx, x + 2 * s, y + 5 * s, 2 * s, 2 * s);
  rect(ctx, x + 11 * s, y + 4 * s, 2 * s, 3 * s);
  rect(ctx, x + 12 * s, y + 5 * s, 2 * s, 2 * s);
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x + 3 * s, y + 5 * s, 1 * s, 1 * s);
  rect(ctx, x + 12 * s, y + 5 * s, 1 * s, 1 * s);
  // Yeux brillants
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 5 * s, y + 8 * s, 2 * s, 2 * s);
  rect(ctx, x + 9 * s, y + 8 * s, 2 * s, 2 * s);
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x + 5 * s, y + 8 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 8 * s, 1 * s, 1 * s);
  // Sourire
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 7 * s, y + 11 * s, 2 * s, 1 * s);
  // Petites pattes
  rect(ctx, x + 5 * s, y + 13 * s, 2 * s, 2 * s);
  rect(ctx, x + 9 * s, y + 13 * s, 2 * s, 2 * s);
}

function drawGlanou(ctx, x, y, s = 1) {
  // Corps du gland (en bas)
  ctx.fillStyle = '#d4a373';
  ovalFill(ctx, x + 8 * s, y + 11 * s, 4 * s, 4 * s);
  ctx.fillStyle = '#8b5a2b';
  ovalFill(ctx, x + 8 * s, y + 12 * s, 3 * s, 3 * s);
  // Chapeau du gland
  ctx.fillStyle = '#5c2e0d';
  rect(ctx, x + 3 * s, y + 5 * s, 10 * s, 4 * s);
  rect(ctx, x + 4 * s, y + 4 * s, 8 * s, 1 * s);
  rect(ctx, x + 5 * s, y + 3 * s, 6 * s, 1 * s);
  ctx.fillStyle = '#8b5a2b';
  rect(ctx, x + 4 * s, y + 5 * s, 8 * s, 2 * s);
  // Texture sur le chapeau (petits points)
  ctx.fillStyle = '#5c2e0d';
  rect(ctx, x + 5 * s, y + 6 * s, 1 * s, 1 * s);
  rect(ctx, x + 8 * s, y + 6 * s, 1 * s, 1 * s);
  rect(ctx, x + 11 * s, y + 6 * s, 1 * s, 1 * s);
  // Petite tige verte sur le dessus
  ctx.fillStyle = '#38b764';
  rect(ctx, x + 8 * s, y + 1 * s, 1 * s, 2 * s);
  rect(ctx, x + 9 * s, y + 2 * s, 1 * s, 1 * s);
  // Yeux
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 6 * s, y + 10 * s, 2 * s, 2 * s);
  rect(ctx, x + 9 * s, y + 10 * s, 2 * s, 2 * s);
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x + 6 * s, y + 10 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 10 * s, 1 * s, 1 * s);
  // Joues
  ctx.fillStyle = '#ff6b9d';
  rect(ctx, x + 5 * s, y + 12 * s, 1 * s, 1 * s);
  rect(ctx, x + 11 * s, y + 12 * s, 1 * s, 1 * s);
  // Petit sourire
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 8 * s, y + 13 * s, 1 * s, 1 * s);
}

function drawPapillon(ctx, x, y, s = 1) {
  // Corps central foncé
  ctx.fillStyle = '#5d275d';
  rect(ctx, x + 7 * s, y + 4 * s, 2 * s, 9 * s);
  // Antennes
  rect(ctx, x + 7 * s, y + 2 * s, 1 * s, 2 * s);
  rect(ctx, x + 6 * s, y + 1 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 2 * s, 1 * s, 2 * s);
  rect(ctx, x + 10 * s, y + 1 * s, 1 * s, 1 * s);
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x + 5 * s, y, 1 * s, 1 * s);
  rect(ctx, x + 11 * s, y, 1 * s, 1 * s);
  // Ailes hautes (rose)
  ctx.fillStyle = '#ff6b9d';
  rect(ctx, x + 3 * s, y + 3 * s, 4 * s, 4 * s);
  rect(ctx, x + 2 * s, y + 4 * s, 1 * s, 3 * s);
  rect(ctx, x + 9 * s, y + 3 * s, 4 * s, 4 * s);
  rect(ctx, x + 13 * s, y + 4 * s, 1 * s, 3 * s);
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x + 4 * s, y + 4 * s, 2 * s, 2 * s);
  rect(ctx, x + 10 * s, y + 4 * s, 2 * s, 2 * s);
  // Ailes basses (violet)
  ctx.fillStyle = '#d896ff';
  rect(ctx, x + 4 * s, y + 8 * s, 3 * s, 4 * s);
  rect(ctx, x + 9 * s, y + 8 * s, 3 * s, 4 * s);
  rect(ctx, x + 3 * s, y + 9 * s, 1 * s, 2 * s);
  rect(ctx, x + 12 * s, y + 9 * s, 1 * s, 2 * s);
  // Points dorés sur les ailes
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x + 5 * s, y + 5 * s, 1 * s, 1 * s);
  rect(ctx, x + 11 * s, y + 5 * s, 1 * s, 1 * s);
  rect(ctx, x + 5 * s, y + 9 * s, 1 * s, 1 * s);
  rect(ctx, x + 11 * s, y + 9 * s, 1 * s, 1 * s);
  // Yeux mignons (sur le corps central)
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x + 7 * s, y + 5 * s, 1 * s, 1 * s);
  rect(ctx, x + 8 * s, y + 5 * s, 1 * s, 1 * s);
}

function drawCygnik(ctx, x, y, s = 1) {
  // Reflet d'eau
  ctx.fillStyle = '#41a6f6';
  rect(ctx, x + 5 * s, y + 14 * s, 9 * s, 1 * s);
  rect(ctx, x + 7 * s, y + 15 * s, 5 * s, 1 * s);
  // Corps blanc
  ctx.fillStyle = '#f4f4f4';
  ovalFill(ctx, x + 9 * s, y + 11 * s, 5 * s, 3 * s);
  ctx.fillStyle = '#bdc3c7';
  ovalFill(ctx, x + 10 * s, y + 12 * s, 4 * s, 2 * s);
  ctx.fillStyle = '#f4f4f4';
  ovalFill(ctx, x + 9 * s, y + 11 * s, 4 * s, 2 * s);
  // Queue relevée
  rect(ctx, x + 12 * s, y + 9 * s, 2 * s, 2 * s);
  rect(ctx, x + 13 * s, y + 8 * s, 1 * s, 2 * s);
  // Cou en S
  rect(ctx, x + 7 * s, y + 9 * s, 1 * s, 2 * s);
  rect(ctx, x + 6 * s, y + 7 * s, 1 * s, 2 * s);
  rect(ctx, x + 5 * s, y + 5 * s, 1 * s, 2 * s);
  rect(ctx, x + 4 * s, y + 3 * s, 2 * s, 2 * s);
  // Tête
  rect(ctx, x + 3 * s, y + 2 * s, 3 * s, 3 * s);
  // Bec orange
  ctx.fillStyle = '#ef7d57';
  rect(ctx, x + 1 * s, y + 3 * s, 3 * s, 1 * s);
  ctx.fillStyle = '#d35400';
  rect(ctx, x + 1 * s, y + 4 * s, 1 * s, 1 * s);
  // Œil
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 4 * s, y + 3 * s, 1 * s, 1 * s);
  // Aile (détail)
  ctx.fillStyle = '#94b0c2';
  rect(ctx, x + 9 * s, y + 10 * s, 3 * s, 1 * s);
  rect(ctx, x + 10 * s, y + 11 * s, 2 * s, 1 * s);
}

function drawLotira(ctx, x, y, s = 1) {
  // Feuille de nénuphar en bas
  ctx.fillStyle = '#1e8449';
  ovalFill(ctx, x + 8 * s, y + 13 * s, 7 * s, 2 * s);
  ctx.fillStyle = '#27ae60';
  ovalFill(ctx, x + 8 * s, y + 13 * s, 6 * s, 1 * s);
  ctx.fillStyle = '#38b764';
  rect(ctx, x + 5 * s, y + 12 * s, 6 * s, 1 * s);
  // Pétales du bas (rose foncé)
  ctx.fillStyle = '#ff6b9d';
  rect(ctx, x + 4 * s, y + 9 * s, 8 * s, 2 * s);
  rect(ctx, x + 3 * s, y + 10 * s, 1 * s, 1 * s);
  rect(ctx, x + 12 * s, y + 10 * s, 1 * s, 1 * s);
  // Pétales du milieu (rose clair)
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x + 4 * s, y + 6 * s, 8 * s, 4 * s);
  rect(ctx, x + 3 * s, y + 7 * s, 1 * s, 2 * s);
  rect(ctx, x + 12 * s, y + 7 * s, 1 * s, 2 * s);
  // Pétales du haut
  rect(ctx, x + 5 * s, y + 4 * s, 6 * s, 3 * s);
  rect(ctx, x + 6 * s, y + 3 * s, 4 * s, 1 * s);
  rect(ctx, x + 7 * s, y + 2 * s, 2 * s, 1 * s);
  // Reflets clairs
  ctx.fillStyle = '#fff0c8';
  rect(ctx, x + 5 * s, y + 5 * s, 4 * s, 1 * s);
  // Centre jaune
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x + 7 * s, y + 7 * s, 2 * s, 2 * s);
  ctx.fillStyle = '#fde74c';
  rect(ctx, x + 7 * s, y + 7 * s, 1 * s, 1 * s);
  // Yeux
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 6 * s, y + 8 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 8 * s, 1 * s, 1 * s);
}

function drawLapinou(ctx, x, y, s = 1) {
  // Oreilles longues
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x + 5 * s, y + 1 * s, 2 * s, 6 * s);
  rect(ctx, x + 9 * s, y + 1 * s, 2 * s, 6 * s);
  ctx.fillStyle = '#bdc3c7';
  rect(ctx, x + 5 * s, y + 1 * s, 1 * s, 6 * s);
  rect(ctx, x + 9 * s, y + 1 * s, 1 * s, 6 * s);
  // Intérieur oreilles (rose)
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x + 6 * s, y + 2 * s, 1 * s, 4 * s);
  rect(ctx, x + 10 * s, y + 2 * s, 1 * s, 4 * s);
  // Tête / corps
  ctx.fillStyle = '#f4f4f4';
  ovalFill(ctx, x + 8 * s, y + 9 * s, 5 * s, 4 * s);
  ctx.fillStyle = '#bdc3c7';
  ovalFill(ctx, x + 8 * s, y + 10 * s, 5 * s, 3 * s);
  ctx.fillStyle = '#f4f4f4';
  ovalFill(ctx, x + 8 * s, y + 9 * s, 4 * s, 3 * s);
  // Joues
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x + 4 * s, y + 10 * s, 1 * s, 1 * s);
  rect(ctx, x + 12 * s, y + 10 * s, 1 * s, 1 * s);
  // Yeux
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 6 * s, y + 9 * s, 2 * s, 2 * s);
  rect(ctx, x + 9 * s, y + 9 * s, 2 * s, 2 * s);
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x + 6 * s, y + 9 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 9 * s, 1 * s, 1 * s);
  // Nez rose
  ctx.fillStyle = '#ff6b9d';
  rect(ctx, x + 8 * s, y + 11 * s, 1 * s, 1 * s);
  // Bouche
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 7 * s, y + 12 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 12 * s, 1 * s, 1 * s);
  // Pattes
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x + 5 * s, y + 13 * s, 2 * s, 2 * s);
  rect(ctx, x + 9 * s, y + 13 * s, 2 * s, 2 * s);
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x + 5 * s, y + 14 * s, 1 * s, 1 * s);
  rect(ctx, x + 10 * s, y + 14 * s, 1 * s, 1 * s);
}

function drawHibouche(ctx, x, y, s = 1) {
  // Corps marron
  ctx.fillStyle = '#5c2e0d';
  ovalFill(ctx, x + 8 * s, y + 10 * s, 5 * s, 5 * s);
  ctx.fillStyle = '#8b5a2b';
  ovalFill(ctx, x + 8 * s, y + 10 * s, 4 * s, 4 * s);
  // Ventre crème
  ctx.fillStyle = '#fff0c8';
  ovalFill(ctx, x + 8 * s, y + 12 * s, 3 * s, 3 * s);
  // Touffes (oreilles)
  ctx.fillStyle = '#5c2e0d';
  rect(ctx, x + 4 * s, y + 4 * s, 2 * s, 2 * s);
  rect(ctx, x + 5 * s, y + 3 * s, 1 * s, 1 * s);
  rect(ctx, x + 10 * s, y + 4 * s, 2 * s, 2 * s);
  rect(ctx, x + 10 * s, y + 3 * s, 1 * s, 1 * s);
  // Disque facial
  ctx.fillStyle = '#d4a373';
  ovalFill(ctx, x + 8 * s, y + 7 * s, 4 * s, 3 * s);
  // Yeux énormes
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x + 5 * s, y + 6 * s, 3 * s, 3 * s);
  rect(ctx, x + 8 * s, y + 6 * s, 3 * s, 3 * s);
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 6 * s, y + 7 * s, 2 * s, 2 * s);
  rect(ctx, x + 9 * s, y + 7 * s, 2 * s, 2 * s);
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x + 6 * s, y + 7 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 7 * s, 1 * s, 1 * s);
  // Bec
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x + 8 * s, y + 9 * s, 1 * s, 2 * s);
  // Ailes
  ctx.fillStyle = '#5c2e0d';
  rect(ctx, x + 3 * s, y + 9 * s, 2 * s, 4 * s);
  rect(ctx, x + 11 * s, y + 9 * s, 2 * s, 4 * s);
  ctx.fillStyle = '#8b5a2b';
  rect(ctx, x + 4 * s, y + 10 * s, 1 * s, 2 * s);
  rect(ctx, x + 11 * s, y + 10 * s, 1 * s, 2 * s);
  // Pattes
  ctx.fillStyle = '#d35400';
  rect(ctx, x + 6 * s, y + 14 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 14 * s, 1 * s, 1 * s);
}

function drawEtoilamer(ctx, x, y, s = 1) {
  ctx.fillStyle = '#ff6b9d';
  // Branche haut
  rect(ctx, x + 7 * s, y + 1 * s, 2 * s, 4 * s);
  rect(ctx, x + 6 * s, y + 3 * s, 4 * s, 2 * s);
  // Branche bas-gauche
  rect(ctx, x + 3 * s, y + 11 * s, 3 * s, 3 * s);
  rect(ctx, x + 4 * s, y + 10 * s, 3 * s, 2 * s);
  // Branche bas-droite
  rect(ctx, x + 10 * s, y + 11 * s, 3 * s, 3 * s);
  rect(ctx, x + 9 * s, y + 10 * s, 3 * s, 2 * s);
  // Branche gauche
  rect(ctx, x + 1 * s, y + 6 * s, 4 * s, 2 * s);
  rect(ctx, x + 2 * s, y + 5 * s, 3 * s, 3 * s);
  // Branche droite
  rect(ctx, x + 11 * s, y + 6 * s, 4 * s, 2 * s);
  rect(ctx, x + 11 * s, y + 5 * s, 3 * s, 3 * s);
  // Centre rempli
  rect(ctx, x + 5 * s, y + 6 * s, 6 * s, 5 * s);
  rect(ctx, x + 4 * s, y + 7 * s, 8 * s, 3 * s);
  // Centre plus clair
  ctx.fillStyle = '#ffaad8';
  ovalFill(ctx, x + 8 * s, y + 8 * s, 3 * s, 2 * s);
  // Points texture
  ctx.fillStyle = '#d62828';
  rect(ctx, x + 7 * s, y + 3 * s, 1 * s, 1 * s);
  rect(ctx, x + 3 * s, y + 6 * s, 1 * s, 1 * s);
  rect(ctx, x + 12 * s, y + 6 * s, 1 * s, 1 * s);
  rect(ctx, x + 4 * s, y + 12 * s, 1 * s, 1 * s);
  rect(ctx, x + 11 * s, y + 12 * s, 1 * s, 1 * s);
  // Yeux
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 7 * s, y + 8 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 8 * s, 1 * s, 1 * s);
  // Sourire
  rect(ctx, x + 8 * s, y + 9 * s, 1 * s, 1 * s);
}

function drawCrabilino(ctx, x, y, s = 1) {
  // Corps rouge
  ctx.fillStyle = '#b13e53';
  ovalFill(ctx, x + 8 * s, y + 10 * s, 5 * s, 3 * s);
  ctx.fillStyle = '#e74c3c';
  ovalFill(ctx, x + 8 * s, y + 9 * s, 4 * s, 2 * s);
  // Pince gauche
  ctx.fillStyle = '#b13e53';
  rect(ctx, x + 2 * s, y + 6 * s, 3 * s, 3 * s);
  rect(ctx, x + 1 * s, y + 7 * s, 2 * s, 2 * s);
  rect(ctx, x + 3 * s, y + 5 * s, 1 * s, 1 * s);
  ctx.fillStyle = '#e74c3c';
  rect(ctx, x + 2 * s, y + 7 * s, 2 * s, 1 * s);
  // Bras pince gauche
  ctx.fillStyle = '#b13e53';
  rect(ctx, x + 4 * s, y + 9 * s, 2 * s, 1 * s);
  // Pince droite
  rect(ctx, x + 11 * s, y + 6 * s, 3 * s, 3 * s);
  rect(ctx, x + 13 * s, y + 7 * s, 2 * s, 2 * s);
  rect(ctx, x + 12 * s, y + 5 * s, 1 * s, 1 * s);
  ctx.fillStyle = '#e74c3c';
  rect(ctx, x + 12 * s, y + 7 * s, 2 * s, 1 * s);
  ctx.fillStyle = '#b13e53';
  rect(ctx, x + 10 * s, y + 9 * s, 2 * s, 1 * s);
  // Pattes latérales
  rect(ctx, x + 3 * s, y + 11 * s, 2 * s, 1 * s);
  rect(ctx, x + 2 * s, y + 12 * s, 2 * s, 1 * s);
  rect(ctx, x + 3 * s, y + 13 * s, 2 * s, 1 * s);
  rect(ctx, x + 11 * s, y + 11 * s, 2 * s, 1 * s);
  rect(ctx, x + 12 * s, y + 12 * s, 2 * s, 1 * s);
  rect(ctx, x + 11 * s, y + 13 * s, 2 * s, 1 * s);
  // Tiges des yeux
  ctx.fillStyle = '#b13e53';
  rect(ctx, x + 6 * s, y + 7 * s, 1 * s, 2 * s);
  rect(ctx, x + 9 * s, y + 7 * s, 1 * s, 2 * s);
  // Globes des yeux
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x + 5 * s, y + 5 * s, 2 * s, 2 * s);
  rect(ctx, x + 9 * s, y + 5 * s, 2 * s, 2 * s);
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 6 * s, y + 6 * s, 1 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 6 * s, 1 * s, 1 * s);
  // Bouche
  rect(ctx, x + 7 * s, y + 10 * s, 2 * s, 1 * s);
}

function drawNuagette(ctx, x, y, s = 1) {
  // Aura magique légère
  ctx.fillStyle = 'rgba(252, 239, 141, 0.4)';
  ovalFill(ctx, x + 8 * s, y + 9 * s, 7 * s, 5 * s);
  // Nuage (contour gris clair)
  ctx.fillStyle = '#bdc3c7';
  ovalFill(ctx, x + 8 * s, y + 10 * s, 6 * s, 4 * s);
  ovalFill(ctx, x + 5 * s, y + 8 * s, 3 * s, 2 * s);
  ovalFill(ctx, x + 11 * s, y + 8 * s, 3 * s, 2 * s);
  ovalFill(ctx, x + 8 * s, y + 7 * s, 3 * s, 2 * s);
  // Nuage (blanc dessus)
  ctx.fillStyle = '#f4f4f4';
  ovalFill(ctx, x + 8 * s, y + 10 * s, 5 * s, 3 * s);
  ovalFill(ctx, x + 5 * s, y + 8 * s, 2 * s, 1 * s);
  ovalFill(ctx, x + 11 * s, y + 8 * s, 2 * s, 1 * s);
  ovalFill(ctx, x + 8 * s, y + 7 * s, 2 * s, 1 * s);
  // Reflets dorés
  ctx.fillStyle = '#fff0c8';
  rect(ctx, x + 6 * s, y + 8 * s, 2 * s, 1 * s);
  rect(ctx, x + 9 * s, y + 8 * s, 2 * s, 1 * s);
  // Yeux brillants
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x + 6 * s, y + 9 * s, 1 * s, 1 * s);
  rect(ctx, x + 10 * s, y + 9 * s, 1 * s, 1 * s);
  // Sourire
  rect(ctx, x + 8 * s, y + 10 * s, 1 * s, 1 * s);
  // Joues
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x + 5 * s, y + 10 * s, 1 * s, 1 * s);
  rect(ctx, x + 11 * s, y + 10 * s, 1 * s, 1 * s);
  // Étincelles magiques autour
  ctx.fillStyle = '#fcef8d';
  const sparkles = [[2, 3], [14, 4], [1, 11], [14, 12], [8, 1], [13, 14]];
  for (const [sx, sy] of sparkles) {
    rect(ctx, x + sx * s, y + sy * s, 1 * s, 1 * s);
  }
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x + 2 * s, y + 2 * s, 1 * s, 1 * s);
  rect(ctx, x + 15 * s, y + 4 * s, 1 * s, 1 * s);
  // Wisps de nuage flottant en bas
  ctx.fillStyle = '#bdc3c7';
  rect(ctx, x + 4 * s, y + 13 * s, 1 * s, 1 * s);
  rect(ctx, x + 12 * s, y + 13 * s, 1 * s, 1 * s);
}

// ====== Helpers de dessin ======

function rect(ctx, x, y, w, h) {
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function ovalFill(ctx, cx, cy, rx, ry) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
        ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
  }
}

// ====== Kawaii creatures ======

function drawMiaouche(ctx, x, y, s = 1) {
  // Oreilles pointues
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x+3*s, y+1*s, 3*s, 4*s);
  rect(ctx, x+10*s, y+1*s, 3*s, 4*s);
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x+4*s, y+2*s, 1*s, 2*s);
  rect(ctx, x+11*s, y+2*s, 1*s, 2*s);
  // Tête
  ctx.fillStyle = '#f4f4f4';
  ovalFill(ctx, x+8*s, y+7*s, 5*s, 4*s);
  // Yeux grands
  ctx.fillStyle = '#1a1c2c';
  ovalFill(ctx, x+5*s, y+7*s, 2*s, 2*s);
  ovalFill(ctx, x+11*s, y+7*s, 2*s, 2*s);
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x+4*s, y+6*s, 1*s, 1*s);
  rect(ctx, x+10*s, y+6*s, 1*s, 1*s);
  // Nez + moustaches
  ctx.fillStyle = '#ff6b9d';
  rect(ctx, x+8*s, y+9*s, 1*s, 1*s);
  ctx.fillStyle = '#bdc3c7';
  rect(ctx, x+2*s, y+9*s, 3*s, 1*s);
  rect(ctx, x+11*s, y+9*s, 3*s, 1*s);
  // Joues
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x+3*s, y+8*s, 1*s, 1*s);
  rect(ctx, x+12*s, y+8*s, 1*s, 1*s);
  // Noeud rose sur l'oreille gauche
  ctx.fillStyle = '#ff6b9d';
  rect(ctx, x+2*s, y+2*s, 2*s, 1*s);
  rect(ctx, x+2*s, y+4*s, 2*s, 1*s);
  rect(ctx, x+3*s, y+3*s, 1*s, 1*s);
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x+2*s, y+3*s, 1*s, 1*s);
  rect(ctx, x+4*s, y+3*s, 1*s, 1*s);
  // Corps
  ctx.fillStyle = '#f4f4f4';
  ovalFill(ctx, x+8*s, y+13*s, 4*s, 3*s);
  // Queue en courbe
  rect(ctx, x+12*s, y+12*s, 3*s, 1*s);
  rect(ctx, x+14*s, y+11*s, 1*s, 1*s);
  rect(ctx, x+14*s, y+10*s, 1*s, 1*s);
  // Pattes
  rect(ctx, x+5*s, y+15*s, 2*s, 1*s);
  rect(ctx, x+9*s, y+15*s, 2*s, 1*s);
}

function drawPandouki(ctx, x, y, s = 1) {
  // Corps rond blanc
  ctx.fillStyle = '#f4f4f4';
  ovalFill(ctx, x+8*s, y+10*s, 5*s, 4*s);
  // Tête
  ovalFill(ctx, x+8*s, y+6*s, 4*s, 4*s);
  // Oreilles noires rondes
  ctx.fillStyle = '#1a1c2c';
  ovalFill(ctx, x+4*s, y+2*s, 2*s, 2*s);
  ovalFill(ctx, x+12*s, y+2*s, 2*s, 2*s);
  // Patches noirs yeux
  ovalFill(ctx, x+5*s, y+5*s, 2*s, 2*s);
  ovalFill(ctx, x+11*s, y+5*s, 2*s, 2*s);
  // Yeux blancs dans les patches
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x+4*s, y+5*s, 2*s, 2*s);
  rect(ctx, x+10*s, y+5*s, 2*s, 2*s);
  // Pupilles
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x+5*s, y+5*s, 1*s, 1*s);
  rect(ctx, x+11*s, y+5*s, 1*s, 1*s);
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x+4*s, y+5*s, 1*s, 1*s);
  rect(ctx, x+10*s, y+5*s, 1*s, 1*s);
  // Nez + bouche noirs
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x+7*s, y+8*s, 2*s, 1*s);
  rect(ctx, x+8*s, y+9*s, 1*s, 1*s);
  // Ventre crème
  ctx.fillStyle = '#fff0c8';
  ovalFill(ctx, x+8*s, y+11*s, 2*s, 2*s);
  // Pattes noires
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x+4*s, y+9*s, 2*s, 4*s);
  rect(ctx, x+10*s, y+9*s, 2*s, 4*s);
  rect(ctx, x+5*s, y+14*s, 3*s, 1*s);
  rect(ctx, x+8*s, y+14*s, 3*s, 1*s);
}

function drawKoronette(ctx, x, y, s = 1) {
  // Ailes (lavande translucide)
  ctx.fillStyle = '#d896ff';
  rect(ctx, x+1*s, y+5*s, 4*s, 4*s);
  rect(ctx, x+11*s, y+5*s, 4*s, 4*s);
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x+2*s, y+6*s, 2*s, 2*s);
  rect(ctx, x+12*s, y+6*s, 2*s, 2*s);
  rect(ctx, x+2*s, y+9*s, 3*s, 3*s);
  rect(ctx, x+11*s, y+9*s, 3*s, 3*s);
  // Corps (lavande)
  ctx.fillStyle = '#d896ff';
  ovalFill(ctx, x+8*s, y+10*s, 3*s, 3*s);
  // Tête rose
  ctx.fillStyle = '#ffaad8';
  ovalFill(ctx, x+8*s, y+6*s, 3*s, 3*s);
  // Couronne dorée
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x+5*s, y+2*s, 6*s, 2*s);
  rect(ctx, x+6*s, y+1*s, 1*s, 1*s);
  rect(ctx, x+8*s, y+0*s, 1*s, 2*s);
  rect(ctx, x+10*s, y+1*s, 1*s, 1*s);
  // Yeux étoilés
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x+6*s, y+5*s, 1*s, 1*s);
  rect(ctx, x+10*s, y+5*s, 1*s, 1*s);
  ctx.fillStyle = '#fcec6c';
  rect(ctx, x+5*s, y+5*s, 1*s, 1*s);
  rect(ctx, x+7*s, y+5*s, 1*s, 1*s);
  rect(ctx, x+9*s, y+5*s, 1*s, 1*s);
  rect(ctx, x+11*s, y+5*s, 1*s, 1*s);
  // Sourire
  ctx.fillStyle = '#b13e53';
  rect(ctx, x+7*s, y+7*s, 2*s, 1*s);
  // Baguette
  ctx.fillStyle = '#8b5a2b';
  rect(ctx, x+12*s, y+8*s, 1*s, 5*s);
  ctx.fillStyle = '#f1c40f';
  ovalFill(ctx, x+12*s, y+7*s, 2*s, 2*s);
  // Étincelles
  ctx.fillStyle = '#fcec6c';
  rect(ctx, x+1*s, y+2*s, 1*s, 1*s);
  rect(ctx, x+15*s, y+3*s, 1*s, 1*s);
  rect(ctx, x+3*s, y+13*s, 1*s, 1*s);
}

function drawStellini(ctx, x, y, s = 1) {
  // Corps étoile (or)
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x+7*s, y+5*s, 2*s, 8*s);
  rect(ctx, x+4*s, y+7*s, 8*s, 2*s);
  rect(ctx, x+5*s, y+5*s, 2*s, 2*s);
  rect(ctx, x+9*s, y+5*s, 2*s, 2*s);
  rect(ctx, x+5*s, y+11*s, 2*s, 2*s);
  rect(ctx, x+9*s, y+11*s, 2*s, 2*s);
  // Centre lumineux
  ctx.fillStyle = '#fcef8d';
  ovalFill(ctx, x+8*s, y+9*s, 3*s, 3*s);
  // Oreilles de lapin
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x+5*s, y+0*s, 2*s, 5*s);
  rect(ctx, x+9*s, y+0*s, 2*s, 5*s);
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x+6*s, y+1*s, 1*s, 3*s);
  rect(ctx, x+10*s, y+1*s, 1*s, 3*s);
  // Yeux + nez
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x+6*s, y+8*s, 1*s, 1*s);
  rect(ctx, x+9*s, y+8*s, 1*s, 1*s);
  ctx.fillStyle = '#ff6b9d';
  rect(ctx, x+8*s, y+10*s, 1*s, 1*s);
  // Mini étoiles autour
  ctx.fillStyle = '#fcef8d';
  rect(ctx, x+1*s, y+3*s, 1*s, 1*s);
  rect(ctx, x+14*s, y+2*s, 1*s, 1*s);
  rect(ctx, x+2*s, y+13*s, 1*s, 1*s);
  rect(ctx, x+13*s, y+14*s, 1*s, 1*s);
}

function drawDoudoune(ctx, x, y, s = 1) {
  // Corps très rond
  ctx.fillStyle = '#f1c40f';
  ovalFill(ctx, x+8*s, y+10*s, 6*s, 5*s);
  ctx.fillStyle = '#fcef8d';
  ovalFill(ctx, x+8*s, y+9*s, 5*s, 4*s);
  // Tête
  ctx.fillStyle = '#f1c40f';
  ovalFill(ctx, x+8*s, y+5*s, 4*s, 3*s);
  ctx.fillStyle = '#fcef8d';
  ovalFill(ctx, x+8*s, y+4*s, 3*s, 2*s);
  // Ailes moignons
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x+2*s, y+9*s, 3*s, 3*s);
  rect(ctx, x+11*s, y+9*s, 3*s, 3*s);
  ctx.fillStyle = '#fcef8d';
  rect(ctx, x+3*s, y+9*s, 1*s, 2*s);
  rect(ctx, x+12*s, y+9*s, 1*s, 2*s);
  // Yeux
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x+6*s, y+4*s, 2*s, 2*s);
  rect(ctx, x+9*s, y+4*s, 2*s, 2*s);
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x+6*s, y+4*s, 1*s, 1*s);
  rect(ctx, x+9*s, y+4*s, 1*s, 1*s);
  // Bec orange
  ctx.fillStyle = '#ef7d57';
  rect(ctx, x+7*s, y+7*s, 3*s, 1*s);
  rect(ctx, x+8*s, y+8*s, 1*s, 1*s);
  // Joues roses
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x+5*s, y+6*s, 1*s, 1*s);
  rect(ctx, x+11*s, y+6*s, 1*s, 1*s);
  // Pattes
  ctx.fillStyle = '#ef7d57';
  rect(ctx, x+5*s, y+15*s, 2*s, 1*s);
  rect(ctx, x+9*s, y+15*s, 2*s, 1*s);
  rect(ctx, x+4*s, y+14*s, 1*s, 1*s);
  rect(ctx, x+8*s, y+14*s, 1*s, 1*s);
}

// ====== Dragon creatures ======

function drawFlamdrak(ctx, x, y, s = 1) {
  // Queue avec flamme
  ctx.fillStyle = '#e74c3c';
  rect(ctx, x+11*s, y+12*s, 4*s, 2*s);
  rect(ctx, x+13*s, y+11*s, 2*s, 1*s);
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x+13*s, y+9*s, 2*s, 2*s);
  rect(ctx, x+14*s, y+8*s, 1*s, 2*s);
  ctx.fillStyle = '#fff0c8';
  rect(ctx, x+14*s, y+9*s, 1*s, 1*s);
  // Corps
  ctx.fillStyle = '#e74c3c';
  ovalFill(ctx, x+7*s, y+11*s, 5*s, 4*s);
  ctx.fillStyle = '#ef7d57';
  ovalFill(ctx, x+7*s, y+10*s, 4*s, 3*s);
  // Ventre clair
  ctx.fillStyle = '#fcd8a0';
  ovalFill(ctx, x+7*s, y+12*s, 3*s, 2*s);
  // Petites ailes
  ctx.fillStyle = '#b13e53';
  rect(ctx, x+2*s, y+7*s, 3*s, 4*s);
  rect(ctx, x+1*s, y+8*s, 2*s, 3*s);
  rect(ctx, x+11*s, y+7*s, 3*s, 4*s);
  rect(ctx, x+13*s, y+8*s, 2*s, 3*s);
  ctx.fillStyle = '#e74c3c';
  rect(ctx, x+3*s, y+8*s, 1*s, 2*s);
  rect(ctx, x+12*s, y+8*s, 1*s, 2*s);
  // Tête
  ctx.fillStyle = '#e74c3c';
  ovalFill(ctx, x+7*s, y+6*s, 4*s, 4*s);
  ctx.fillStyle = '#ef7d57';
  ovalFill(ctx, x+7*s, y+5*s, 3*s, 3*s);
  // Cornes
  ctx.fillStyle = '#b13e53';
  rect(ctx, x+5*s, y+2*s, 1*s, 2*s);
  rect(ctx, x+10*s, y+2*s, 1*s, 2*s);
  rect(ctx, x+4*s, y+1*s, 1*s, 1*s);
  rect(ctx, x+11*s, y+1*s, 1*s, 1*s);
  // Yeux ardents
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x+5*s, y+5*s, 2*s, 2*s);
  rect(ctx, x+9*s, y+5*s, 2*s, 2*s);
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x+5*s, y+5*s, 1*s, 1*s);
  rect(ctx, x+9*s, y+5*s, 1*s, 1*s);
  // Narines
  ctx.fillStyle = '#b13e53';
  rect(ctx, x+6*s, y+8*s, 1*s, 1*s);
  rect(ctx, x+9*s, y+8*s, 1*s, 1*s);
  // Flammes
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x+0*s, y+3*s, 1*s, 2*s);
  rect(ctx, x+14*s, y+3*s, 1*s, 2*s);
  ctx.fillStyle = '#ef7d57';
  rect(ctx, x+1*s, y+2*s, 1*s, 1*s);
  rect(ctx, x+14*s, y+2*s, 1*s, 1*s);
}

function drawGlydrak(ctx, x, y, s = 1) {
  // Grandes ailes violet
  ctx.fillStyle = '#5d275d';
  rect(ctx, x+0*s, y+4*s, 5*s, 7*s);
  rect(ctx, x+11*s, y+4*s, 5*s, 7*s);
  rect(ctx, x+1*s, y+2*s, 4*s, 2*s);
  rect(ctx, x+11*s, y+2*s, 4*s, 2*s);
  ctx.fillStyle = '#d896ff';
  rect(ctx, x+1*s, y+5*s, 3*s, 5*s);
  rect(ctx, x+12*s, y+5*s, 3*s, 5*s);
  rect(ctx, x+2*s, y+3*s, 2*s, 2*s);
  rect(ctx, x+12*s, y+3*s, 2*s, 2*s);
  // Corps élancé
  ctx.fillStyle = '#5d275d';
  rect(ctx, x+6*s, y+6*s, 4*s, 7*s);
  ctx.fillStyle = '#7a3b8f';
  rect(ctx, x+7*s, y+7*s, 2*s, 5*s);
  // Ventre clair
  ctx.fillStyle = '#ffaad8';
  rect(ctx, x+7*s, y+9*s, 2*s, 3*s);
  // Queue
  ctx.fillStyle = '#5d275d';
  rect(ctx, x+8*s, y+13*s, 2*s, 2*s);
  rect(ctx, x+9*s, y+14*s, 2*s, 1*s);
  rect(ctx, x+10*s, y+15*s, 2*s, 1*s);
  // Tête
  ovalFill(ctx, x+8*s, y+4*s, 4*s, 4*s);
  ctx.fillStyle = '#7a3b8f';
  ovalFill(ctx, x+8*s, y+3*s, 3*s, 3*s);
  // Cornes
  ctx.fillStyle = '#d896ff';
  rect(ctx, x+6*s, y+0*s, 1*s, 3*s);
  rect(ctx, x+10*s, y+0*s, 1*s, 3*s);
  // Yeux rouges
  ctx.fillStyle = '#e74c3c';
  rect(ctx, x+6*s, y+3*s, 2*s, 2*s);
  rect(ctx, x+10*s, y+3*s, 2*s, 2*s);
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x+7*s, y+4*s, 1*s, 1*s);
  rect(ctx, x+11*s, y+4*s, 1*s, 1*s);
  // Crocs
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x+7*s, y+6*s, 1*s, 1*s);
  rect(ctx, x+9*s, y+6*s, 1*s, 1*s);
}

function drawAquadrak(ctx, x, y, s = 1) {
  // Corps serpentin
  ctx.fillStyle = '#16a085';
  rect(ctx, x+5*s, y+3*s, 6*s, 11*s);
  ctx.fillStyle = '#1abc9c';
  rect(ctx, x+6*s, y+4*s, 4*s, 8*s);
  // Ventre turquoise
  ctx.fillStyle = '#73eff7';
  rect(ctx, x+7*s, y+5*s, 2*s, 6*s);
  // Écailles
  ctx.fillStyle = '#16a085';
  for (let i = 0; i < 3; i++) {
    rect(ctx, x+6*s, y+(5+i*3)*s, 1*s, 1*s);
    rect(ctx, x+9*s, y+(5+i*3)*s, 1*s, 1*s);
  }
  // Nageoire dorsale
  ctx.fillStyle = '#0e6655';
  rect(ctx, x+5*s, y+3*s, 1*s, 6*s);
  rect(ctx, x+4*s, y+4*s, 1*s, 4*s);
  rect(ctx, x+3*s, y+5*s, 1*s, 2*s);
  // Nageoires latérales
  rect(ctx, x+3*s, y+8*s, 2*s, 3*s);
  rect(ctx, x+11*s, y+8*s, 2*s, 3*s);
  ctx.fillStyle = '#1abc9c';
  rect(ctx, x+4*s, y+9*s, 1*s, 2*s);
  rect(ctx, x+11*s, y+9*s, 1*s, 2*s);
  // Tête
  ctx.fillStyle = '#16a085';
  ovalFill(ctx, x+8*s, y+3*s, 4*s, 3*s);
  ctx.fillStyle = '#1abc9c';
  ovalFill(ctx, x+8*s, y+2*s, 3*s, 2*s);
  // Crêtes aqueuses
  ctx.fillStyle = '#73eff7';
  rect(ctx, x+6*s, y+0*s, 1*s, 2*s);
  rect(ctx, x+8*s, y+0*s, 1*s, 1*s);
  rect(ctx, x+10*s, y+0*s, 1*s, 2*s);
  // Yeux
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x+6*s, y+2*s, 2*s, 2*s);
  rect(ctx, x+10*s, y+2*s, 2*s, 2*s);
  ctx.fillStyle = '#73eff7';
  rect(ctx, x+6*s, y+2*s, 1*s, 1*s);
  rect(ctx, x+10*s, y+2*s, 1*s, 1*s);
  // Queue + nageoire caudale
  ctx.fillStyle = '#16a085';
  rect(ctx, x+5*s, y+14*s, 6*s, 1*s);
  rect(ctx, x+4*s, y+15*s, 8*s, 1*s);
  // Bulles
  ctx.fillStyle = '#73eff7';
  rect(ctx, x+13*s, y+5*s, 1*s, 1*s);
  rect(ctx, x+14*s, y+3*s, 1*s, 1*s);
  rect(ctx, x+12*s, y+2*s, 1*s, 1*s);
}

function drawTonnedrak(ctx, x, y, s = 1) {
  // Aura électrique
  ctx.fillStyle = '#fcef8d';
  rect(ctx, x+0*s, y+5*s, 1*s, 1*s);
  rect(ctx, x+15*s, y+7*s, 1*s, 1*s);
  rect(ctx, x+1*s, y+12*s, 1*s, 1*s);
  rect(ctx, x+14*s, y+3*s, 1*s, 1*s);
  // Corps
  ctx.fillStyle = '#f1c40f';
  ovalFill(ctx, x+8*s, y+10*s, 5*s, 4*s);
  ctx.fillStyle = '#fcef8d';
  ovalFill(ctx, x+8*s, y+9*s, 4*s, 3*s);
  // Crêtes électriques
  ctx.fillStyle = '#ef7d57';
  rect(ctx, x+6*s, y+6*s, 1*s, 2*s);
  rect(ctx, x+5*s, y+5*s, 1*s, 1*s);
  rect(ctx, x+8*s, y+5*s, 1*s, 2*s);
  rect(ctx, x+7*s, y+4*s, 1*s, 1*s);
  rect(ctx, x+10*s, y+6*s, 1*s, 2*s);
  rect(ctx, x+11*s, y+5*s, 1*s, 1*s);
  // Ailes courtes
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x+2*s, y+8*s, 3*s, 4*s);
  rect(ctx, x+11*s, y+8*s, 3*s, 4*s);
  ctx.fillStyle = '#fcef8d';
  rect(ctx, x+3*s, y+9*s, 1*s, 2*s);
  rect(ctx, x+12*s, y+9*s, 1*s, 2*s);
  // Tête
  ctx.fillStyle = '#f1c40f';
  ovalFill(ctx, x+8*s, y+5*s, 4*s, 4*s);
  ctx.fillStyle = '#fcef8d';
  ovalFill(ctx, x+8*s, y+4*s, 3*s, 3*s);
  // Cornes en zigzag
  ctx.fillStyle = '#ef7d57';
  rect(ctx, x+6*s, y+1*s, 2*s, 2*s);
  rect(ctx, x+5*s, y+2*s, 1*s, 1*s);
  rect(ctx, x+7*s, y+3*s, 1*s, 1*s);
  rect(ctx, x+10*s, y+1*s, 2*s, 2*s);
  rect(ctx, x+12*s, y+2*s, 1*s, 1*s);
  rect(ctx, x+10*s, y+3*s, 1*s, 1*s);
  // Yeux électriques
  ctx.fillStyle = '#1a1c2c';
  rect(ctx, x+6*s, y+4*s, 2*s, 2*s);
  rect(ctx, x+10*s, y+4*s, 2*s, 2*s);
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x+6*s, y+4*s, 1*s, 1*s);
  rect(ctx, x+10*s, y+4*s, 1*s, 1*s);
  // Dents
  ctx.fillStyle = '#f4f4f4';
  rect(ctx, x+7*s, y+7*s, 1*s, 1*s);
  rect(ctx, x+9*s, y+7*s, 1*s, 1*s);
  // Queue + pointe éclair
  ctx.fillStyle = '#f1c40f';
  rect(ctx, x+10*s, y+13*s, 3*s, 2*s);
  rect(ctx, x+12*s, y+12*s, 2*s, 1*s);
  ctx.fillStyle = '#ef7d57';
  rect(ctx, x+13*s, y+11*s, 2*s, 2*s);
  rect(ctx, x+14*s, y+10*s, 1*s, 1*s);
}

// ====== Système de capacités ======

const M = {
  // Génériques
  vite:      { name: 'Coup rapide',          power: [7,  12] },
  assaut:    { name: 'Assaut',               power: [12, 18] },
  force:     { name: 'Grand coup',           power: [18, 26] },
  soin1:     { name: 'Repos léger',          heal:  10 },
  soin2:     { name: 'Soin',                 heal:  16 },
  // Végétal
  feuille:   { name: 'Lame feuille',         power: [12, 18] },
  soleil:    { name: 'Rayon solaire',        power: [20, 28] },
  // Eau
  jetEau:    { name: "Jet d'eau",            power: [10, 16] },
  hydro:     { name: 'Hydromoteur',          power: [20, 28] },
  // Feu
  flamme:    { name: 'Flamme',              power: [14, 20] },
  inferno:   { name: 'Inferno',             power: [22, 30] },
  // Électrique
  eclair:    { name: 'Éclair',              power: [16, 24] },
  tonnerre:  { name: 'Tonnerre',            power: [22, 32] },
  // Fée / Magique
  feerie:    { name: 'Éclat fée',           power: [12, 18] },
  luneEclat: { name: 'Éclat lunaire',       power: [20, 28] },
  magie:     { name: 'Baguette magique',    power: [16, 22] },
  soinMagie: { name: 'Soin magique',        heal:  18 },
  // Dragon
  dragon:    { name: 'Souffle dragon',      power: [18, 26] },
  dragonRage:{ name: 'Colère du dragon',    power: [24, 34] },
  // Autres
  aile:      { name: "Coup d'aile",         power: [12, 18] },
  pince:     { name: 'Pincement',           power: [10, 16] },
  griffe:    { name: 'Griffe',             power: [10, 16] },
  morsure:   { name: 'Morsure',            power: [12, 18] },
  serre:     { name: 'Serre acérée',        power: [14, 20] },
  ronron:    { name: 'Ronron soignant',     heal:  16 },
  calin:     { name: 'Câlin soin',          heal:  14 },
  bambou:    { name: 'Coup de bambou',      power: [16, 22] },
  roulade:   { name: 'Roulade',            power: [18, 26] },
  rebond:    { name: 'Super rebond',        power: [18, 24] },
  tentacule: { name: 'Tentacule',          power: [10, 15] },
  poudre:    { name: 'Poudre dodo',        power: [8,  14] },
  chant:     { name: 'Chant apaisant',      heal:  16 },
  petale:    { name: 'Tempête de pétales', power: [16, 22] },
  gland:     { name: 'Coup de gland',       power: [10, 15] },
  etoile:    { name: "Coup d'étoile",      power: [12, 18] },
  etoileEx:  { name: "Explosion d'étoiles",power: [20, 28] },
  bec:       { name: 'Coup de bec',         power: [8,  14] },
  plumes:    { name: 'Plumes tourbillon',   power: [16, 22] },
  nageoire:  { name: 'Coup de nageoire',    power: [10, 14] },
  bulle:     { name: "Bulle d'eau",         power: [12, 17] },
};

(function assignMoves() {
  const MAP = {
    feuillou:   [M.assaut,   M.feuille,  M.soin1,     M.soleil    ],
    petalia:    [M.vite,     M.petale,   M.soin1,     M.feerie    ],
    goutella:   [M.jetEau,   M.assaut,   M.soin1,     M.hydro     ],
    bullini:    [M.nageoire, M.bulle,    M.soin1,     M.hydro     ],
    etincelo:   [M.eclair,   M.assaut,   M.soin1,     M.tonnerre  ],
    meduzia:    [M.tentacule,M.assaut,   M.soin2,     M.force     ],
    coralou:    [M.pince,    M.jetEau,   M.soin1,     M.force     ],
    fluffly:    [M.vite,     M.morsure,  M.calin,     M.rebond    ],
    glanou:     [M.gland,    M.feuille,  M.soin1,     M.soleil    ],
    papillon:   [M.aile,     M.poudre,   M.soin2,     M.feerie    ],
    cygnik:     [M.aile,     M.serre,    M.chant,     M.hydro     ],
    lotira:     [M.petale,   M.jetEau,   M.soin2,     M.soleil    ],
    lapinou:    [M.vite,     M.assaut,   M.calin,     M.rebond    ],
    hibouche:   [M.assaut,   M.serre,    M.soin1,     M.force     ],
    etoilamer:  [M.etoile,   M.pince,    M.soin1,     M.etoileEx  ],
    crabilino:  [M.pince,    M.assaut,   M.soin1,     M.force     ],
    nuagette:   [M.feerie,   M.assaut,   M.soin2,     M.luneEclat ],
    miaouche:   [M.griffe,   M.morsure,  M.ronron,    M.force     ],
    pandouki:   [M.assaut,   M.bambou,   M.calin,     M.roulade   ],
    koronette:  [M.feerie,   M.magie,    M.soinMagie, M.luneEclat ],
    stellini:   [M.etoile,   M.feerie,   M.soin1,     M.etoileEx  ],
    doudoune:   [M.bec,      M.plumes,   M.chant,     M.assaut    ],
    flamdrak:   [M.flamme,   M.morsure,  M.soin1,     M.inferno   ],
    glydrak:    [M.aile,     M.dragon,   M.soin1,     M.dragonRage],
    aquadrak:   [M.jetEau,   M.dragon,   M.soin2,     M.hydro     ],
    tonnedrak:  [M.eclair,   M.dragon,   M.soin1,     M.dragonRage],
  };
  for (const c of CREATURES) {
    c.moves = MAP[c.id] || [M.assaut, M.vite, M.soin1, M.force];
  }
})();
