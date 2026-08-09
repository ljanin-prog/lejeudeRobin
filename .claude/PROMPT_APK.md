# Prompt : le jeu de Robin en APK sur le téléphone (vacances)

> À coller dans une nouvelle session Claude Code, ouverte dans ce projet.
> Conseil : lancer chaque phase séparément (copier la mission + une seule phase),
> valider sur le téléphone entre chaque, puis passer à la suivante.
> Budget total attendu : ~1,5 M tokens répartis sur plusieurs sessions.

---

## Mission

Rendre le jeu 3D (`index3d.html` + `js3d/`) jouable au doigt sur un téléphone
Android, puis l'emballer en APK que j'installerai moi-même (sideload, pas de
Play Store). Le jeu doit rester 100 % local et hors-ligne dans l'app.

## Contraintes non négociables

- **La version PC ne doit pas régresser** : clavier + souris (pointer lock)
  continuent de fonctionner exactement comme avant. Les contrôles tactiles
  s'ajoutent, ils ne remplacent rien.
- Relire d'abord les mémoires du projet (surtout « Pièges 3D » et
  « Équilibre du combat ») et les contrats `js3d/CONTRACT2.md` /
  `js3d/CONTRACT3.md` avant de toucher aux modules concernés.
- Ne jamais modifier `js3d/vendor/three.min.js`.
- La sauvegarde est partagée entre 2D et 3D : ne pas changer les clés
  `localStorage` existantes.
- Après toute retouche des modules 3D, relancer les deux harnais Node de
  vérification hors navigateur (voir la mémoire « Corrections lots 1 et 2 »).
- Textes du jeu en français (Robin a 10 ans).
- Une branche git par phase, fusion dans master seulement quand je l'ai
  validée sur le téléphone.

## Comment je teste

Je ne peux tester qu'à la main, sur mon téléphone Android. À la fin de chaque
phase : lancer un serveur local (`npx serve` ou équivalent), me donner
l'adresse à ouvrir depuis le téléphone (même wifi), et me lister précisément
quoi vérifier. Tu peux aussi tester en amont dans Chrome via CDP en mode
émulation tactile (voir la mémoire « Lancer le jeu sans l'extension ») — mais
c'est mon test sur téléphone qui fait foi.

---

## Phase 1 — Contrôles tactiles

Détecter l'écran tactile et afficher alors :
- un **joystick virtuel** en bas à gauche pour se déplacer ;
- le **glissement du doigt** sur la moitié droite de l'écran pour tourner la
  caméra (remplace le pointer lock, avec la même sensibilité progressive que
  la version souris — voir la mémoire « Révision jouabilité ») ;
- des **boutons tactiles** pour les actions clavier existantes : interagir,
  sauter/courir s'il y a lieu, ouvrir les menus (équipe, dex, quêtes, boutique,
  carte/boussole). Recenser d'abord toutes les touches gérées dans
  `js3d/game3d.js` et `js3d/hud3d.js` avant de dessiner quoi que ce soit.
- Le combat (`battle3d.js`) doit être jouable entièrement au toucher.

Aucun bouton ne doit masquer d'information de jeu importante.

## Phase 2 — HUD et menus sur petit écran

Adapter chaque surface à un écran de téléphone (paysage en priorité,
portrait si peu coûteux) : HUD principal, combat, boutique, dex, équipe,
boîte, quêtes, évolutions, Téra, arènes, dirigeable. Passer les menus un par
un ; textes lisibles sans zoomer, boutons assez gros pour un doigt d'enfant.
`css3d/hud3d.css` est le gros morceau. Ne pas casser l'affichage PC :
les adaptations passent par media queries / détection tactile.

## Phase 3 — Performance mobile

Objectif : fluidité correcte (~30 fps) sur un téléphone milieu de gamme.
Relire **impérativement** la mémoire « Pièges 3D » avant d'optimiser.
Pistes dans l'ordre : résolution de rendu (pixelRatio plafonné), distance
d'affichage, ombres, densité de décor. Chaque optimisation doit être
réversible et testée sur PC aussi.

## Phase 4 — Emballage APK (Capacitor)

- Créer la coquille Capacitor dans un sous-dossier (ex. `apk/`) **sans
  déranger le jeu** : le projet n'a pas de `package.json` à la racine et ne
  doit pas en gagner un ; tout le tooling vit dans `apk/`.
- Embarquer `index3d.html`, `js3d/`, `css3d/` et tout asset nécessaire dans
  l'app (copie au build, pas de duplication maintenue à la main — script de
  synchronisation).
- App 100 % hors-ligne, plein écran, orientation paysage verrouillée si la
  phase 2 a privilégié le paysage. Nom : « Le jeu de Robin », icône simple
  générée à partir d'un élément du jeu.
- Vérifier d'abord ce qui est installé sur mon PC (Node, JDK, Android SDK).
  S'il manque quelque chose, me donner la liste exacte à installer et
  t'arrêter — ne pas installer de SDK sans me demander.
- Produire une **APK debug signée** (suffisant pour un sideload) et me donner :
  le chemin du fichier `.apk`, et la marche à suivre pas à pas pour
  l'installer sur le téléphone (transfert + autorisation « sources
  inconnues »).
- Me prévenir : désinstaller l'APK effacera la sauvegarde du jeu.

## Livrable final

Un fichier `.apk` sur mon disque, que j'installe moi-même, avec le jeu
complet jouable au doigt, hors-ligne, pour les vacances.
