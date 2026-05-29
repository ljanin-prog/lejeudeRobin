// ============================================================
//  Personnages non-joueurs (PNJ) avec dialogues
// ============================================================
// Les PNJ réutilisent le sprite du joueur recoloré pour économiser des sprites,
// avec parfois un accessoire (chapeau) dessiné par-dessus.

const NPCS = [
  // ---- FORÊT ----
  {
    id: 'garde',
    name: 'Garde Forestier',
    x: 3, y: 7,
    dir: 'down',
    // Recolore le sprite joueur : 'j' (cheveux) → 'g' (marron), 'i' (peau) reste, 'l' (vêtements rose) → '6' (vert)
    colorMap: { 'j': 'g', 'l': '6' },
    accessory: 'hat-ranger',
    dialog: [
      "Bienvenue dans la forêt magique, jeune dresseur !",
      "On y croise des Feuillou, des Glanou et parfois même des Hibouché.",
      "Les Papillons sont rapides — sois prête à les capturer vite !",
    ],
  },
  // ---- LAC ----
  {
    id: 'pecheur',
    name: 'Pêcheur',
    x: 23, y: 4,
    dir: 'left',
    colorMap: { 'j': 'F', 'l': '9' },  // cheveux foncés, veste bleue
    accessory: 'hat-fisher',
    dialog: [
      "Hé, salut gamin !",
      "Tu sais, les Cygnik glissent sur ce lac avec une grâce incroyable.",
      "Si tu veux croiser des Bullini, marche dans les eaux peu profondes près du bord.",
      "Bonne chance !",
    ],
  },
  // ---- PLAINE ----
  {
    id: 'mamie',
    name: 'Mamie',
    x: 10, y: 38,
    dir: 'down',
    colorMap: { 'j': 'd', 'l': 'l' },
    accessory: null,
    dialog: [
      "Oh, bonjour mon petit !",
      "Quand j'étais jeune, j'ai aperçu une Nuagette flotter dans le ciel...",
      "Ces créatures rares surgissent n'importe où. Continue d'explorer !",
      "Il paraît qu'il y a des dragons dans les montagnes à l'est !",
    ],
  },
  {
    id: 'garcon',
    name: 'Petit garçon',
    x: 14, y: 38,
    dir: 'down',
    colorMap: { 'j': 'j', 'l': '6' },
    accessory: null,
    dialog: [
      "Salut !",
      "Tu en as combien dans ta collection ?",
      "Il paraît qu'il y a un petit village à l'ouest !",
      "Et des montagnes avec des dragons à l'est... tu es courageux !",
    ],
  },
  // ---- PLAGE / MER ----
  {
    id: 'marin',
    name: 'Marin',
    x: 15, y: 58,
    dir: 'down',
    colorMap: { 'j': 'F', 'l': 'c' },  // cheveux foncés, chemise blanche
    accessory: 'hat-sailor',
    dialog: [
      "Ohé, jeune dresseur !",
      "La mer cache plein de créatures fabuleuses.",
      "Les Méduzia, Étoilamer et Crabilino adorent les vagues.",
      "Marche dans les eaux écumantes pour les rencontrer !",
    ],
  },
  // ---- VILLE ----
  {
    id: 'marchand',
    name: 'Marchand',
    x: 52, y: 8,
    dir: 'down',
    colorMap: { 'j': 'g', 'l': '7' },
    accessory: null,
    dialog: [
      "Bienvenue dans la ville !",
      "Il paraît qu'il y a une bien plus grande cité à l'est, dans les montagnes.",
      "Pour y aller, traverse les montagnes en suivant les chemins gris.",
    ],
  },
  {
    id: 'mairesse',
    name: 'Mairesse',
    x: 57, y: 9,
    dir: 'left',
    colorMap: { 'j': 'd', 'l': '2' },  // cheveux gris, robe rouge
    accessory: null,
    dialog: [
      "Bonjour ! Je suis la mairesse de cette charmante ville.",
      "Profite bien de la fontaine, c'est notre fierté !",
      "Et n'hésite pas à visiter notre grand parc, juste à côté.",
    ],
  },
  // ---- VILLAGE ----
  {
    id: 'sage_village',
    name: 'Vieux sage',
    x: 10, y: 43,
    dir: 'down',
    colorMap: { 'j': 'd', 'l': 'c' },
    accessory: null,
    dialog: [
      "Bienvenue dans notre petit village, jeune dresseur !",
      "Les Miaouche et les Stellini adorent se promener par ici.",
      "Il y a même une Koronette cachée quelque part dans les buissons...",
    ],
  },
  // ---- PARC ----
  {
    id: 'famille',
    name: 'Maman avec son enfant',
    x: 28, y: 22,
    dir: 'down',
    colorMap: { 'j': 'F', 'l': 'a' },  // cheveux foncés, robe bleu clair
    accessory: null,
    dialog: [
      "Oh, quelle belle journée pour venir au parc !",
      "Mon petit adore voir les Bullini sauter dans l'étang.",
      "Si tu marches au bord de l'eau, peut-être que tu en verras aussi !",
    ],
  },
  {
    id: 'coureur',
    name: 'Coureur',
    x: 25, y: 22,
    dir: 'right',
    colorMap: { 'j': 'j', 'l': '3' },  // cheveux bruns, t-shirt orange
    accessory: null,
    dialog: [
      "Salut !",
      "*essoufflé* Je fais mon jogging matinal autour du parc...",
      "C'est super pour rester en forme avant de partir capturer !",
      "Continue ton entraînement, jeune dresseur !",
    ],
  },

  // ============================================================
  //  DRESSEURS (isTrainer: true)
  // ============================================================

  {
    id: 'dresseur_foret',
    name: 'Dresseur Léo',
    x: 7, y: 14,
    dir: 'down',
    colorMap: { 'j': 'j', 'l': '6' },
    accessory: 'hat-ranger',
    isTrainer: true,
    party: ['feuillou'],
    dialog: ["Je suis le gardien de la forêt ! Mon Feuillou est imbattable !"],
    dialogDefeated: ["Tu es fort... Mon Feuillou a encore besoin d'entraînement."],
  },
  {
    id: 'dresseur_lac',
    name: 'Dresseuse Ines',
    x: 28, y: 13,
    dir: 'left',
    colorMap: { 'j': 'F', 'l': 'a' },
    accessory: 'hat-fisher',
    isTrainer: true,
    party: ['cygnik'],
    dialog: ["Mon Cygnik glisse comme le vent ! Oses-tu l'affronter ?"],
    dialogDefeated: ["Incroyable... Tu es vraiment doué !"],
  },
  {
    id: 'dresseur_plaine',
    name: 'Dresseur Marco',
    x: 18, y: 35,
    dir: 'right',
    colorMap: { 'j': 'g', 'l': '3' },
    accessory: null,
    isTrainer: true,
    party: ['lapinou'],
    dialog: ["Hé toi ! Je veux tester mes forces ! Mon Lapinou est rapide !"],
    dialogDefeated: ["Bien joué... Mon Lapinou va s'entraîner plus dur !"],
  },
  {
    id: 'dresseur_village',
    name: 'Dresseuse Clara',
    x: 12, y: 47,
    dir: 'down',
    colorMap: { 'j': 'l', 'l': 'l' },
    accessory: null,
    isTrainer: true,
    party: ['miaouche'],
    dialog: ["Mon Miaouche est le plus mignon ET le plus fort du village !"],
    dialogDefeated: ["Tu as gagné... mais mon Miaouche reste le plus mignon !"],
  },
  {
    id: 'dresseur_montagne1',
    name: 'Grimpeur Axel',
    x: 75, y: 20,
    dir: 'down',
    colorMap: { 'j': 'F', 'l': '9' },
    accessory: null,
    isTrainer: true,
    party: ['pandouki'],
    dialog: ["Pour passer ces montagnes, il faut battre mon Pandouki !"],
    dialogDefeated: ["Tu m'as battu ! Poursuis ton chemin, dresseur courageux."],
  },
  {
    id: 'dresseur_montagne2',
    name: 'Dresseuse Nora',
    x: 80, y: 30,
    dir: 'left',
    colorMap: { 'j': 'd', 'l': '2' },
    accessory: null,
    isTrainer: true,
    party: ['flamdrak'],
    dialog: ["✦ Mon Flamdrak est la terreur de ces montagnes ! Attention à toi !"],
    dialogDefeated: ["Je n'arrive pas à y croire... Ton équipe est remarquable !"],
  },
  {
    id: 'dresseur_plage',
    name: 'Surfeur Éric',
    x: 22, y: 59,
    dir: 'up',
    colorMap: { 'j': 'j', 'l': 'c' },
    accessory: 'hat-sailor',
    isTrainer: true,
    party: ['bullini'],
    dialog: ["Les vagues m'ont appris à me battre ! Mon Bullini va t'éclabousser !"],
    dialogDefeated: ["Wahou ! Tu surmontes tout ! Continue comme ça !"],
  },
  {
    id: 'dresseur_cite',
    name: 'Champion Zara',
    x: 98, y: 44,
    dir: 'down',
    colorMap: { 'j': 'd', 'l': '7' },
    accessory: null,
    isTrainer: true,
    party: ['tonnedrak'],
    dialog: ["✦ Je suis la championne de la Grande Cité ! Mon Tonnedrak est invincible !"],
    dialogDefeated: ["Extraordinaire... Tu es digne d'être le champion ! ✦"],
  },
];

// ---- Utilitaires ----

function getNPCAt(x, y) {
  for (const npc of NPCS) {
    if (npc.x === x && npc.y === y) return npc;
  }
  return null;
}

// S'assure que chaque tuile occupée par un PNJ est walkable (sinon on remplace)
(function ensureNPCTilesAreWalkable() {
  for (const npc of NPCS) {
    if (npc.x < 0 || npc.x >= MAP_W || npc.y < 0 || npc.y >= MAP_H) continue;
    const tile = MAP[npc.y][npc.x];
    const info = TILE_TYPES[tile];
    if (!info || !info.walkable) {
      const biome = getBiomeQuadrant(npc.x, npc.y);
      let replacement = 'GRASS';
      if (biome === 'plain' || biome === 'village') replacement = 'PLAIN';
      else if (biome === 'beach') replacement = 'SAND';
      else if (biome === 'lake') replacement = 'SAND';
      else if (biome === 'mountain') replacement = 'MTN_PATH';
      else if (biome === 'city2') replacement = 'CITY2_PATH';
      MAP[npc.y][npc.x] = replacement;
    }
    // Assure aussi qu'au moins une tuile adjacente est walkable (sinon le joueur ne peut pas parler)
    const around = [
      [npc.x - 1, npc.y], [npc.x + 1, npc.y],
      [npc.x, npc.y - 1], [npc.x, npc.y + 1],
    ];
    let hasNeighbor = false;
    for (const [ax, ay] of around) {
      if (ax < 0 || ax >= MAP_W || ay < 0 || ay >= MAP_H) continue;
      const at = MAP[ay][ax];
      const inf = TILE_TYPES[at];
      if (inf && inf.walkable) { hasNeighbor = true; break; }
    }
    if (!hasNeighbor) {
      // Force la tuile face au PNJ (en bas par défaut) à être walkable
      const tx = npc.x, ty = npc.y + 1;
      if (ty < MAP_H) {
        const biome = getBiomeQuadrant(tx, ty);
        let replacement = 'GRASS';
        if (biome === 'plain' || biome === 'village') replacement = 'PLAIN';
        else if (biome === 'beach') replacement = 'SAND';
        else if (biome === 'lake') replacement = 'SAND';
        else if (biome === 'mountain') replacement = 'MTN_PATH';
        else if (biome === 'city2') replacement = 'CITY2_PATH';
        MAP[ty][tx] = replacement;
      }
    }
  }
})();

// ---- Dessin des PNJ ----

function drawNPCSprite(ctx, npc, x, y, tick = 0) {
  // Petit bobbing : monte/descend de 1 pixel
  const bob = Math.floor(tick / 30) % 2 === 0 ? 0 : -1;
  const spriteKey = `player_${npc.dir}_a`;
  drawSpriteRecolored(ctx, SPRITES[spriteKey], x, y + bob, 1, npc.colorMap || {});
  if (npc.accessory) drawNPCAccessory(ctx, npc.accessory, x, y + bob);
}

function drawNPCAccessory(ctx, accessory, x, y) {
  if (accessory === 'hat-ranger') {
    // Chapeau vert de ranger
    ctx.fillStyle = '#1e8449';
    ctx.fillRect(x + 3, y + 2, 10, 1);
    ctx.fillRect(x + 4, y + 1, 8, 1);
    ctx.fillRect(x + 5, y, 6, 1);
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(x + 5, y + 1, 6, 1);
    // Plume
    ctx.fillStyle = '#fc7460';
    ctx.fillRect(x + 11, y - 1, 1, 2);
  } else if (accessory === 'hat-fisher') {
    // Chapeau de paille
    ctx.fillStyle = '#d35400';
    ctx.fillRect(x + 2, y + 2, 12, 1);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(x + 4, y + 1, 8, 1);
    ctx.fillRect(x + 5, y, 6, 1);
    ctx.fillStyle = '#d35400';
    ctx.fillRect(x + 7, y, 2, 1);
  } else if (accessory === 'hat-sailor') {
    // Béret marin blanc à bande bleue
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(x + 3, y + 1, 10, 2);
    ctx.fillRect(x + 4, y, 8, 1);
    ctx.fillStyle = '#3b5dc9';
    ctx.fillRect(x + 4, y + 2, 8, 1);
    // Pompon rouge
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(x + 7, y, 2, 1);
  }
}
