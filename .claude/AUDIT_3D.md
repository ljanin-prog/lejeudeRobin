# Audit du jeu 3D — synthèse consolidée

> Audit réalisé le 2026-08-01 par une équipe de 7 agents spécialisés (game design jeunesse,
> bugs/robustesse, performance Three.js, UX/contrôles, contenu/équilibrage, architecture,
> audio/ambiance) plus une synthèse. Aucun code n'a été modifié pendant l'audit.
>
> Les rapports détaillés de chaque expert (44 recommandations au total, avec justifications
> ligne par ligne) sont dans `.claude/AUDIT_3D_rapports_bruts.json`.

## État général

Le jeu 3D est dans un état remarquablement sain pour un projet parent-enfant : architecture
modulaire robuste (registre R3, `safeCall` qui isole les modules cassés, sauvegarde versionnée
et migrée sans perte), philosophie « jamais punitif » appliquée presque partout, écriture des
quêtes et des champions de grande qualité, musique procédurale nettement au-dessus de la
moyenne, rendu Three.js déjà optimisé intelligemment (chunks, instancing, auto-qualité).

Les faiblesses se concentrent sur quatre axes :

1. Trois vrais bugs autour des animations de capture asynchrones, dont **deux soft-locks** qui
   gèlent le jeu jusqu'au rechargement.
2. La boucle de capture, pourtant la préférée de Robin, est **sous-récompensée** (ni XP, ni
   argent, ni célébration de nouvelle espèce), alors que les légendaires sont paradoxalement
   **punitifs** (cooldown de 10 min même en cas de défaite, fuite invisible à 90 s, Ball
   Maîtresse qui peut mentir).
3. Des trous de contenu qui cassent l'équilibrage en seconde moitié de jeu (7 types sans aucune
   attaque, champions qui n'alignent jamais de formes évoluées, soins à valeur fixe obsolètes).
4. Un ressenti incomplet (pas de musique de combat, pas de fanfare, secousses de Pokéball
   muettes) et une sauvegarde sans aucun filet hors navigateur.

Rien ne demande de refonte : presque tout se corrige par petites touches sur l'existant.

---

## LOT 1 — Bugs vérifiés (à faire en premier)

Chacun de ces défauts a été confirmé en lisant le code, avec le numéro de ligne.

### 1.1 Soft-lock en combat — lancer de Ball
`js3d/battle3d.js` ~l.2906 : `throwBall()` fait `if (ballAnim && ballAnim.active) return;`
**sans jamais appeler le callback**. Si Robin relance une Ball pendant les ~1,1 s d'animation
résiduelle, `game3d` reste en phase `'ball'` pour toujours : la Ball est perdue, plus aucune
touche n'est acceptée, rechargement obligatoire.
**Correctif** : toujours appeler `cb(null)` / `cb('escaped')` avant d'abandonner un lancer.

### 1.2 Soft-lock monde ouvert — touches B et T mortes pour la session
`js3d/roamers3d.js` l.785-786 : `setRegion()` fait `_ballAnim = null` sans appeler le callback.
Si la région change pendant un lancer en monde ouvert, `state.throwing` reste `true` à vie côté
`game3d.js` (`throwBallInWorld` ~l.2074).
**Correctif** : appeler le cb avant d'effacer, et remettre `state.throwing = false` dans
`applyRegion()` en ceinture-bretelles.

### 1.3 Filet Téra jamais exécuté
`js3d/tera3d.js` `repair()` l.535 : teste `if (!m.tera) continue;` alors que le drapeau `tera`
n'est **jamais persisté** par `team3d.packMon`. Une créature sauvegardée téracristallisée
(`saveGame` est appelé avant `endBattle` dans `onCaughtInBattle`/`onTrainerDefeated`) reste
mono-type définitivement après rechargement.
**Correctif** : tester la présence de `m.uid` dans `base` au lieu de `m.tera`.

### 1.4 Récompense légendaire jamais versée
`js3d/game3d.js` l.2977 : `payRewardLine(b.kind)` où `kind` vaut `'wild'|'trainer'|'champion'`.
Le barème `REWARD_RULES.legendary` de `shop3d.js` (20×niveau + 200) est du code jamais atteint :
un légendaire niv. 50 rapporte ~200 pièces au lieu de ~1200.

### 1.5 `activeIndex` qui dérive
`js3d/team3d.js` : `remove()` / `toBox()` ne corrigent `activeIndex` que s'il sort des bornes.
Ranger une créature d'indice inférieur fait entrer en combat **une autre créature** que le
champion choisi par Robin.

### 1.6 Le dernier soin éjecté en FIFO
`js3d/team3d.js` `movesForLevel()` ~l.275 : éjecte les capacités en premier-entré-premier-sorti.
Une créature créée ou capturée à haut niveau perd son unique soin (Feuillou dès le niv. 27), ce
qui contredit la règle « chaque espèce possède au moins un soin » affichée par `dex3d.js`.
Touche aussi les équipes des dresseurs.

### 1.7 Sons fantômes silencieux
`js3d/game3d.js` l.3577 appelle `sfx('heal')` qui n'existe pas dans `js/audio.js` : soigner est
muet, sans erreur. Idem `roamers3d.js` l.436 qui cherche `legendary` / `levelUp` / `catch_`.
Le contrat interdisant de modifier `js/audio.js`, créer un petit `js3d/sfx3d.js` qui étend le
catalogue.

### 1.8 `pendingLearn` jeté
Dès qu'une créature a 4 capacités, elle ne peut plus **jamais** rien apprendre : `game3d.js`
affiche « Ce sera pour plus tard ! » et jette l'information, aucune UI de remplacement n'existe.
L'XP partagée aux équipiers ignore même la valeur de retour de `gainXp`.
(Le correctif complet est le chantier 3.4 ; ici, au minimum, ne pas mentir dans le message.)

### 1.9 `FALLBACK_TYPES` incohérent
`js3d/team3d.js` l.55-64 contredit `dex3d.js` sur 5 espèces (lapinou, miaouche, hibouche,
aquadrak, cygnik) : multiplicateurs de types silencieusement faux si le repli s'active un jour.

### 1.10 Fuite douce de perf
`js3d/water3d.js` l.486 : le tableau `surfaces` garde des références vers les meshes déchargés.

---

## LOT 2 — Quick wins (fort impact, petit effort)

### 2.1 Sanctuaires et autels sur la carte de région
`js3d/hud3d.js` `drawRegionMap` ~l.2478 ignore sanctuaires et autels, alors que
`quest3d.sanctuaries()` fournit déjà `{x, y, name, open, icon:'⛩️', color}` et que `regions3d`
fournit `region.altars`. La quête dit « cherche leurs autels » sur une région de 384×224 tuiles :
c'est le plus gros mur de frustration du jeu, et la répétition exacte du problème de l'Académie
introuvable (CONTRACT3 §18.3).
**Correctif** : marqueur nommé pour le sanctuaire (classe `nomme`, comme `cities.beacons()`),
et un `✦` par autel **une fois le sanctuaire ouvert** — afficher après ouverture préserve le
mystère de la légende.

### 2.2 Fêter la première capture d'une espèce, et récompenser toute capture
`js3d/game3d.js` `onCaught()` ~l.2114 et `onCaughtInBattle()` ~l.2804 : message identique pour
la 1ʳᵉ espèce et le 15ᵉ doublon, et la capture ne rapporte ni XP ni argent — alors que c'est
LA boucle voulue par Robin (les rencontres surprises ont été coupées exprès,
`ENCOUNTER_CHANCE = 0`). Un enfant qui joue « attrapeur » arrive à l'arène avec une équipe trop
faible : mur invisible.
**Correctif** : `state.collection[speciesId]` dit en une ligne si l'espèce est nouvelle.
- Nouvelle espèce : message « ✨ Nouvelle espèce ! Feuillou rejoint ton Pokédex (12/62) », son
  `'rare'` au lieu de `'catch'`, `fxStarsBurst` (existe dans `roamers3d.js`), prime ~100 pièces.
- Toute capture : un peu d'XP à la créature active (~la moitié du barème de combat) et
  ~2×niveau pièces. Le combat reste plus rentable, mais capturer ne laisse plus l'équipe sur place.
- Corrige au passage l'économie avare du début (~20 pièces par victoire contre 200 la Pokéball).

### 2.3 Cooldown légendaire conditionnel et fuite annoncée
`js3d/game3d.js` `startRoamerBattle` ~l.2218 appelle `roamers.remove(roamer)` dès le **début**
du combat, et `roamers3d.js` `remove()` ~l.500 pose systématiquement
`_legendCooldowns = t + 600`. Perdre contre le légendaire = autel vide 10 minutes réelles, sans
explication : double punition qui contredit la philosophie du jeu.
**Correctif** : passer une raison à `remove()` — cooldown de 600 s seulement si `'caught'`,
~60-120 s si défaite ou fuite.
Ajouter aussi les toasts que `LEGEND_FLEE_S = 90` rend nécessaires : un à l'apparition
(« ✨ Sylvaros est apparu au Sanctuaire ! Il ne restera pas longtemps… ») et un à ~20 s de la
fin (« Il s'apprête à repartir ! »), le hook `R3.get('hud').toast` existe déjà.

### 2.4 Ball Maîtresse à 100 %, vraiment
`js3d/team3d.js` `catchChance` l.606 borne à 0,97 alors que `shop3d.js` promet « Elle ne rate
jamais » et qu'on n'en gagne que deux dans tout le jeu. Un enfant qui garde sa Ball unique
pendant des heures et la voit rater vivrait la pire trahison du jeu.
**Correctif** : `if (bonus >= 99) return 1;` avant le clamp — **et amender le contrat §11** qui
impose la borne 0,97, sinon une future session « réparera » la régression.

### 2.5 Formes évoluées chez les champions 4-6, soins fixes convertis en fractions
`js3d/arenas3d.js` n'aligne que des formes de base (Koronette 47 chez Astréa alors que le joueur
a Koronetton, ×1,55 en stats) : remplacer par les ids évolués dans les arènes givre/braise/aurore
et chez les dresseurs tardifs — `team3d.create()` les résout déjà.
Convertir les soins hérités du 2D à valeur fixe (soin1 = 10 PV face à 400 PV max) en
`{frac: 0.15-0.30}` ; `compute()` gère déjà les deux formats.

### 2.6 Secousses de Pokéball sonorisées
Le moment le plus tendu du jeu est muet alors que la 2D le sonorise. `shakeIndex` est déjà
exposé (`battle3d.js` l.2957 et équivalent dans `roamers3d.js`) : jouer un son à chaque
changement, ~5 lignes.

### 2.7 Trois correctifs UX
- **Écran d'aide rappelable (touche H)** sur le gabarit des overlays existants : les touches ne
  sont expliquées qu'une fois au démarrage, puis en 11 px.
- **Pokédex navigable au clavier** : poser `data-nav` sur les cartes ; c'est le seul grand écran
  sans navigation clavier, et le système `navEcran` fait déjà tout (`hud3d.js` l.2890-2978).
- **Toasts lisibles** : durée proportionnelle à la longueur du texte (2700 ms fixes aujourd'hui,
  trop court pour un lecteur de 10 ans) et planchers de police relevés à 12-13 px.

### 2.8 Trois filets d'architecture (~15-40 lignes chacun)
- Copie de secours tournante avant chaque `setItem`, plus `exportSave()` / `importSave()` en
  fichier : **la partie de Robin n'existe aujourd'hui que dans un localStorage.**
- `window.onerror` qui affiche « Oups, le fichier X a un problème ligne Y » : une erreur de
  syntaxe tue aujourd'hui silencieusement un module entier.
- `checkBoot()` qui vérifie les invariants d'ordre des 41 `<script>`, aujourd'hui gardés par de
  simples commentaires.

### 2.9 Perf mesurable et deux micro-fuites
- Afficher `renderer.info.render.calls` et `.triangles` dans le compteur FPS existant
  (`game3d.js measurePerf`) : 3 lignes qui rendent toutes les optimisations mesurables par Robin
  lui-même.
- Purger le tableau `surfaces` de `water3d.js` (voir 1.10).
- Mettre en cache les couleurs hex parsées ~9 500 fois par chunk dans `world3d.js` (le motif
  existe déjà dans `water3d.js` l.80-84).

### 2.10 Visée FPS alignée sur le regard, et avertissement du dirigeable
- `js3d/game3d.js` `aimedRoamer()` l.2062 passe la cardinale `p.dir` au lieu de l'angle libre
  `fpsYaw` : en regardant à 45°, on ne vise pas ce qu'on regarde. Étendre `roamers.aimed()` pour
  accepter un angle.
- Dans le menu du dirigeable, afficher « Conseillé : Nv 45 — ton équipe : Nv 12 ⚠️ » avec
  confirmation quand l'écart dépasse ~10 niveaux : on informe sans jamais bloquer.

---

## LOT 3 — Gros chantiers qui en valent la peine

### 3.1 Donner des attaques aux 7 types orphelins
`js3d/moves3d.js` ne couvre que 12 des 19 types de `types3d.js` : **psy, fée, acier, dragon,
poison, combat et normal n'ont aucune capacité**. Les évolutions créent pourtant des créatures
de ces types (Feuillix fée, Flamdrakix dragon…) qui n'auront jamais de STAB, et 7 des 19 choix
Téra sont des pièges (bonus ×1,5 sur zéro attaque).
**Correctif** : 1 faible + 1 moyenne + 1 forte + 1 soin par type (~15 lignes par type sur le
modèle existant), et compléter `MOVE_SPEC`. Belle activité d'écriture à faire **avec Robin**
(noms et descriptions).

### 3.2 Musique de combat, fanfare de victoire, sons de coups variés
La pop-rock calme du biome continue pendant les combats et les légendaires, la victoire n'a pas
de fanfare, et les 18 effets visuels partagent un unique blip `'hit'`.
**Correctif** : ambiance `'combat'` et jingle de victoire dans `music3d.js` (l'ordonnanceur sait
déjà changer d'ambiance à la volée, `setBiome` le prouve), branchés dans `enterBattle()` /
`onTrainerDefeated()` ; puis 4-5 variantes de son de coup par famille, modulées par `res.mult` et
`res.crit` pour que « super efficace » **s'entende** comme il se voit déjà.

### 3.3 Onboarding progressif et objectif du moment sur le HUD
Remplacer le message de bienvenue de 7 lignes par des astuces contextuelles à la première
occasion (premier roamer visé → « B pour lancer une Ball », première porte → « Espace »), via un
`state.hintsVus` sauvegardé. Et afficher en permanence sous la boussole la phrase que
`quest3d.hint()` renvoie déjà : un enfant qui reprend sa partie après 3 jours sait immédiatement
quoi faire.

### 3.4 Écran de remplacement de capacité, et objets utilisables sur le banc
- La promesse « Ce sera pour plus tard ! » n'est tenue nulle part (voir 1.8) : un écran à
  5 boutons sur le modèle de l'écran d'évolution.
- Le Rappel est inutilisable en combat car `useBagItem()` cible toujours la créature active,
  forcément vivante : ré-employer la phase `'choose_mon'` existante pour cibler les K.O.

Deux chouettes mini-projets à coder avec Robin.

### 3.5 Rotation à la souris en vue FPS (pointer lock)
La vue FPS ne se tourne qu'aux flèches, à 172°/s. Pour un enfant habitué à Minecraft, la souris
est le geste naturel : `requestPointerLock()` au clic du canvas quand `isFpsView()`,
`fpsYaw -= movementX × sensibilité`. `poseYaw()` et `camera3d.js` consomment déjà `fpsYaw`, rien
d'autre à toucher. Garder les flèches en repli.

### 3.6 Tests Node de la sauvegarde
Le cycle `serialize → deserialize` et la migration v1→v2 sont ce qui protège la partie de Robin
quand une session IA retouche `team3d` / `evolve3d` / `tera3d`. Le harnais `.claude/verif_fx.js`
prouve que les vrais modules se chargent dans un `vm` Node.
**Correctif** : le déplacer dans `tests/`, écrire `verif_save.js` (créer une équipe, sérialiser,
désérialiser, comparer ; figer une sauvegarde v1 et v2 de référence), et y ajouter le test de
cohérence des tables dupliquées (`fb`, `MOVE_SPEC`, `BALL_BONUS`, `FALLBACK_TYPES`).

### 3.7 Revanche d'arène : un endgame pour les bagarreurs
Après les 6 quêtes, il ne reste plus aucun combat scénarisé (dresseurs et champions épuisables
une seule fois, `state.defeatedTrainers` / `state.badges`). Quand le badge est gagné, la porte
d'arène propose « Revanche amicale ? » : même équipe du champion à +6 niveaux (avec les formes
évoluées du chantier 2.5), récompense d'argent normale, pas de nouveau badge. Recycle 100 % de
l'existant et rejoint la demande n°6 de Robin sur les « combats spéciaux ».

### 3.8 Alléger les roamers et la simulation pendant les combats
- Couper `castShadow` des ~25-35 meshes de chaque roamer au-delà de ~14 tuiles (aujourd'hui
  ~400 meshes jamais cullés en qualité haute).
- Sauter la mise à jour du monde (nuages, 260 particules, ombres, fontaines) quand
  `state.screen === 'battle'` puisque `battle3d` recouvre tout l'écran — en **gardant** les
  écrans `title` / `starter` où le monde sert de décor.
- Conditionner le second `buildChunk` de la frame au temps réellement consommé par le premier.

### 3.9 Limiter la guerre d'usure contre les légendaires IA
Tous les légendaires portent un soin `{frac: 0.45}` à 10 PP et `pickAI` se soigne à 80 % sous
30 % de PV : Astralis niv. 55 peut régénérer ~2800 PV pendant que les PP du joueur s'épuisent.
Réduire les PP du soin des adversaires légendaires à 4-5, ou baisser la probabilité à ~40 % et
interdire deux soins consécutifs. À faire **en même temps** que 2.3, pour équilibrer les deux sens.

---

## LOT 4 — Plus tard / optionnel

- **Rééquilibrer les types du roster commun** : 9 espèces Eau contre 1 Feu, 1 Glace, 0 Temps non
  légendaire. Ajouter 3-4 espèces communes (une Feu tôt, une Glace à Givre, une Temps
  accessible). Activité idéale AVEC Robin : il invente la créature, le parent ajoute `BASE_DATA`
  et le modèle via `creatures3d.lib.js`. À faire après 3.1.
- **Varier les objectifs des 6 quêtes légendaires** : elles suivent exactement le même schéma
  badge → sanctuaire → 6 captures. Le champ `condition` de `QUESTS` existe déjà (marée basse via
  le cycle du ciel, apporter une Pierre Glace, capturer les 5 gardiens AVANT le chef).
- **Ambiance du monde** : style de particule `'rain'` (~10 lignes dans `sky3d.js PART_STYLE`),
  nappe de bruit filtré par biome (vagues / vent / oiseaux), bruits de pas variant avec
  `tileAt()`, 4-6 papillons en `InstancedMesh`, 3 mini-jingles évolution / badge / Téra.
- **Support manette** : ~40 lignes sur `navigator.getGamepads()` et le pattern `fakeKey()`
  existant. Aucune dépendance, dégradation nulle sans manette.
- **Un vrai rôle pour le compagnon (touche F)** : `buddy3d.js` est soigné mais purement
  cosmétique. Trouver un objet toutes les ~300 pas (hook dans `onStepFinished`) et +10 % d'XP à
  la créature qui marche dehors. Rejoint la demande n°2 de Robin.
- **Découper `game3d.js`** (4020 lignes, déjà organisé en 16 sections) : extraire d'abord
  §15 Sauvegarde (~220 lignes autonomes) en `save3d.js`, puis §9 Combats. Un fichier par session,
  en vérifiant le jeu entre chaque.
- **Hygiène documentaire** : page « ce qui fait foi » en tête de `CONTRACT3.md` (les 2277 lignes
  de contrats se remplacent partiellement, ex. 12 → 19 types) ; clarifier la migration 2D→3D à
  sens unique.
- **Micro-optimisations de rendu** : `userData.shared = true` sur les géométries du cache
  `R3.geo` (`disposeTree` balaie tout le cache à chaque despawn), culler par distance les pièces
  animées des villes (bannières, jets, flammes à 80 tuiles derrière le brouillard), libérer le
  second contexte WebGL des vignettes après ~10 s d'inactivité. À faire quand 2.9 permettra d'en
  mesurer l'effet.
- **Raccourcis propres à chaque écran** en pied de page : la Boutique n'annonce nulle part que
  ←/→ règlent la quantité, l'écran Équipe cache U/A/Backspace. Moins urgent une fois 2.7 en place.
