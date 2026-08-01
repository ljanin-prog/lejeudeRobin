# Prompt pour appliquer les corrections de l'audit 3D

> Copier-coller le bloc ci-dessous dans une **nouvelle session** Claude Code ouverte sur
> `C:\Users\Janin\Desktop\Projects\lejeudeRobin`.
>
> Pour ne traiter qu'une partie du travail, remplacer la phrase de périmètre par
> « Applique uniquement le LOT 1 » (ou LOT 2, etc.) — voir la variante en fin de fichier.

---

## Prompt complet

```
Tu vas appliquer les corrections issues de l'audit du jeu 3D de Robin (10 ans).

## Contexte

Ce dépôt contient le jeu de Robin : un Pokémon-like en JavaScript, avec une version 2D
(js/, canvas) et une version 3D (js3d/, Three.js — point d'entrée index3d.html) qui
partagent la sauvegarde. Robin a 10 ans, il joue au jeu et il le code avec son parent.

Un audit complet vient d'être réalisé par une équipe de 7 experts. Sa synthèse est dans
.claude/AUDIT_3D.md — c'est ta feuille de route, lis-la EN ENTIER avant de commencer.
Les rapports détaillés de chaque expert, avec leurs justifications complètes, sont dans
.claude/AUDIT_3D_rapports_bruts.json : consulte-les quand une recommandation manque de
contexte, mais ne les lis pas intégralement d'emblée.

## Périmètre

Applique le LOT 1, le LOT 2 et le LOT 3 de .claude/AUDIT_3D.md, dans cet ordre.
Ne touche PAS au LOT 4 (« Plus tard / optionnel »).

## Règles non négociables

1. Lis js3d/CONTRACT.md, CONTRACT2.md et CONTRACT3.md AVANT de modifier quoi que ce soit.
   Ces contrats documentent des décisions déjà prises et des pièges déjà rencontrés.
   Si une correction de l'audit contredit un contrat, tu dois amender le contrat DANS LE
   MÊME COMMIT en expliquant pourquoi — sinon une future session « réparera » ta correction
   en croyant corriger une régression. Le cas est explicitement prévu pour la Ball Maîtresse
   (correction 2.4 contre contrat §11).

2. Ne casse jamais la sauvegarde. La partie de Robin n'existe que dans un localStorage et
   n'a aucune copie. Toute modification du format de sauvegarde doit rester rétrocompatible
   en lecture, avec migration. En cas de doute, ne change pas le format.

3. Ne modifie pas js/audio.js (interdit par le contrat). Pour les sons manquants, crée
   js3d/sfx3d.js qui étend le catalogue, comme indiqué en 1.7.

4. Respecte la philosophie du jeu : « jamais punitif ». Le jeu n'inflige pas de perte
   d'argent, pas de mort définitive, pas d'attente subie. Quand tu hésites entre deux
   options, choisis celle qui encourage l'enfant.

5. Écris du code dans le style de l'existant : mêmes conventions de nommage, même densité
   de commentaires, commentaires en français. Ce code sera relu par un parent et un enfant,
   pas par une équipe de développeurs seniors. Pas de nouvelle dépendance, pas de build,
   pas de framework, pas de refonte d'architecture.

6. Ne fais AUCUNE des corrections du LOT 4, et n'invente pas de correction hors audit. Si tu
   repères en chemin un bug non listé, note-le et signale-le à la fin plutôt que de dévier.

## Méthode de travail

Travaille lot par lot, et à l'intérieur d'un lot, correction par correction.

Pour chaque correction :
  a. Relis le code concerné et VÉRIFIE que le diagnostic de l'audit est exact. L'audit a été
     produit par lecture de code ; s'il se trompe sur un point, dis-le et n'applique pas la
     correction à l'aveugle.
  b. Applique le changement minimal qui règle le problème.
  c. Vérifie que rien d'autre n'est cassé : cherche tous les appelants de ce que tu modifies.
  d. Le harnais .claude/verif_fx.js montre comment charger les vrais modules dans un vm Node ;
     réutilise-le pour vérifier ce qui est vérifiable sans navigateur (calculs de dégâts, taux
     de capture, sérialisation, tables de types).

Commits : un commit par correction ou par petit groupe cohérent de corrections. Suis le style
de messages du dépôt — sujet en français, deux-points, verbe à l'infinitif. Par exemple :
  « Capture : réparer le soft-lock du lancer de Ball en combat »
  « Carte : afficher les sanctuaires et les autels de légendaires »
Ne pousse rien sur un dépôt distant.

Ordre imposé : le LOT 1 en entier avant le LOT 2, le LOT 2 en entier avant le LOT 3. Les deux
soft-locks (1.1 et 1.2) sont la toute première chose à corriger : ce sont eux qui peuvent
gâcher une session de jeu de Robin.

Attention à deux dépendances entre corrections signalées par l'audit :
  - 2.3 (cooldown des légendaires adouci) et 3.9 (limiter les soins de l'IA légendaire)
    s'équilibrent mutuellement : fais-les en gardant les deux en tête.
  - 3.7 (revanche d'arène) suppose 2.5 (formes évoluées chez les champions) déjà en place.

## Vérification finale

Quand tout est appliqué, lance le jeu et vérifie-le pour de vrai (la skill /run sait démarrer
ce projet ; sinon, sers index3d.html par un petit serveur local et ouvre-le dans Chrome avec
les outils navigateur). Contrôle au minimum : la console est propre au chargement, une partie
existante se recharge sans perte, un lancer de Ball répété ne gèle plus rien, la carte de région
montre le sanctuaire, et une capture affiche bien la célébration de nouvelle espèce.

## Ce que tu me rends à la fin

Un compte rendu en français qui dit, pour chaque correction de l'audit : appliquée / adaptée
(et pourquoi) / non appliquée (et pourquoi). Plus la liste des contrats amendés, et la liste
des problèmes repérés en chemin mais volontairement laissés de côté.

Travaille de façon autonome jusqu'au bout : ne me demande pas de valider entre deux
corrections. Arrête-toi seulement si une correction exige une décision de game design que
l'audit ne tranche pas.
```

---

## Variante : un seul lot à la fois

Recommandée si vous voulez tester le jeu avec Robin entre chaque étape. Remplacez la section
« Périmètre » par l'une de ces lignes :

- **Lot 1 seul** — les 10 bugs vérifiés, dont les deux soft-locks. Le plus rentable, et sans
  risque de changer le ressenti du jeu.
  ```
  Applique uniquement le LOT 1 de .claude/AUDIT_3D.md (bugs vérifiés). Ne touche à aucun
  autre lot.
  ```

- **Lot 2 seul** — les quick wins : carte des autels, célébration des captures, légendaires
  adoucis, Ball Maîtresse honnête, écran d'aide, export de sauvegarde. C'est le lot que Robin
  remarquera le plus.
  ```
  Applique uniquement le LOT 2 de .claude/AUDIT_3D.md (quick wins). Ne touche à aucun autre
  lot. Le LOT 1 a déjà été appliqué.
  ```

- **Lot 3 seul** — les gros chantiers (attaques des 7 types orphelins, musique de combat,
  onboarding, souris en vue FPS, tests de sauvegarde, revanche d'arène). Plusieurs de ces
  chantiers gagnent à être faits **avec** Robin : l'écriture des attaques et les noms de
  créatures sont une belle activité à deux.
  ```
  Applique uniquement le LOT 3 de .claude/AUDIT_3D.md (gros chantiers). Ne touche à aucun
  autre lot. Les LOTS 1 et 2 ont déjà été appliqués.
  ```
