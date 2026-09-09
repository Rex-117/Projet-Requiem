# Projet Requiem

Site web scolaire et personnel consacré à **Resident Evil Requiem**. Le projet présente l'univers du jeu à travers son histoire, ses lieux, son gameplay, ses personnages, ses bandes-annonces et les personnes ayant participé à sa création.

> [!IMPORTANT]
> Ce projet est un site de fans réalisé à des fins scolaires et non commerciales. Il n'est ni affilié à, ni approuvé ou commandité par Capcom. **Resident Evil**, **Resident Evil Requiem**, ainsi que les noms, images, vidéos, musiques et autres éléments associés, appartiennent à Capcom et à leurs détenteurs respectifs.

## Fonctionnalités

- page d'accueil immersive avec vidéos d'arrière-plan et musique;
- navigation adaptative pour ordinateur et appareil mobile;
- sections consacrées à l'histoire, aux lieux et au gameplay;
- galeries, carrousels et transitions d'images interactifs;
- page des personnages alimentée par une API Express locale;
- fiches de personnages, galeries et visionneuse de modèles vidéo;
- pages dédiées aux bandes-annonces et aux crédits;
- interface principalement en français.

## Technologies utilisées

- HTML5;
- CSS3;
- JavaScript;
- Node.js;
- Express;
- Lenis pour certains comportements de défilement.

Le site charge aussi certaines ressources externes, notamment des médias hébergés sur Cloudinary, Google Fonts et Font Awesome. Une connexion Internet peut donc être nécessaire pour afficher l'ensemble du contenu.

## Installation locale

### Prérequis

- [Node.js](https://nodejs.org/) et npm installés sur votre ordinateur;
- un navigateur web récent.

### Démarrage

1. Clonez le dépôt :

   ```bash
   git clone https://github.com/Rex-117/Projet-Requiem.git
   ```

2. Accédez au dossier du projet :

   ```bash
   cd Projet-Requiem
   ```

3. Installez les dépendances :

   ```bash
   npm install
   ```

4. Lancez le serveur local :

   ```bash
   npm start
   ```

5. Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

Le port peut être modifié avec la variable d'environnement `PORT`.

## Structure du projet

```text
Projet-Requiem/
├── assets/              # Images, pistes audio et vidéos
├── Backup/              # Anciennes copies de travail
├── index.html           # Page d'accueil
├── characters.html      # Page des personnages
├── trailer.html         # Page des bandes-annonces
├── credits.html         # Page des crédits
├── style.css            # Styles du site
├── index.js             # Interactions générales de l'interface
├── injectionScript.js   # Chargement et affichage des personnages
├── characters.json      # Données des personnages
├── server.js            # Serveur Express et API locale
└── package.json         # Dépendances et commande de démarrage
```

## API locale

Le serveur expose les données utilisées par la page des personnages :

```http
GET /api/characters
```

Cette route retourne en JSON les informations contenues dans `characters.json`.

## Utilisation

Ce dépôt a été créé dans un contexte scolaire et personnel. Son contenu lié à Resident Evil ne doit pas être interprété comme une publication officielle de Capcom.

