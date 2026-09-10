# Assistant flottant Projet Requiem

Le widget est une interface du site. Il ne contient aucun prompt, moteur de recherche,
SDK de fournisseur ou clé API. Le chatbot Railway reste une application indépendante.

## Configuration locale

Utiliser Node.js 22 ou ultérieur et installer les dépendances avec `npm ci`.
Dans PowerShell, à la racine du site :

```powershell
$env:CHATBOT_API_URL = 'https://chatbot-codex-production.up.railway.app'
npm start
```

Ouvrir `http://localhost:3000`. La variable est définie pour ce terminal et les
processus qu’il lance. `npm start` ne charge pas automatiquement un fichier `.env`.
Si un fichier `.env` local est préféré, Node peut le charger explicitement avec
`node --env-file=.env server.js`. Ce fichier est déjà ignoré par Git. Ne pas ajouter
de clés OpenAI ou Anthropic au site.

## Configuration Railway, lors d’un futur déploiement

Dans les variables du service **Projet Requiem**, définir :

```text
CHATBOT_API_URL=https://chatbot-codex-production.up.railway.app
```

La valeur est l’origine du chatbot, sans `/api/chat`. Ne pas utiliser le domaine de
Projet Requiem. Conserver `npm start` comme commande de démarrage et laisser Railway
fournir `PORT`. Installer les dépendances de production depuis le fichier verrouillé;
Marked et DOMPurify sont des dépendances de production. Les dépendances de test ne
sont pas nécessaires en production.

Aucune configuration CORS, clé de fournisseur ou modification du service chatbot
n’est nécessaire. Ce travail ne déploie rien et ne configure aucune variable distante.

## Route et contrat vérifié

```text
Navigateur → POST /api/chat sur Projet Requiem
           → POST {CHATBOT_API_URL}/api/chat sur le chatbot
```

Le frontend public du chatbot, puis un appel réel à Claude, ont confirmé le contrat
de succès `{ "reply": "texte Markdown" }`. La route renvoie uniquement ce champ.
Elle n’essaie pas de deviner des champs alternatifs ou un protocole de streaming.
Un changement de contrat produit une erreur française contrôlée.

La route accepte uniquement `provider` (`openai` ou `anthropic`) et `messages`.
Chaque message contient uniquement `role` (`user` ou `assistant`) et `content`.
Le premier et le dernier messages doivent être ceux de l’utilisateur.

Limites :

- 1 à 30 messages, 1 à 4 000 caractères non vides par message;
- 60 000 caractères cumulés et corps JSON limité à 256 Kio;
- réponses amont limitées à 256 Kio et champ `reply` limité à 32 000 caractères;
- délai amont de 60 secondes, délai navigateur de 65 secondes;
- au maximum huit appels amont simultanés par processus du site.

Les valeurs supplémentaires, rôles système, clés envoyées dans le corps et en-têtes
`Authorization`/`X-API-Key` sont refusés. Les autres en-têtes du navigateur ne sont
pas transmis. L’origine amont est définie côté serveur; aucune URL du client n’est
acceptée et les redirections amont sont refusées. Les origines HTTP locales sont
autorisées uniquement pour les tests; l’amont distant exige HTTPS. Une configuration
pointant vers le même hôte/port ou vers `RAILWAY_PUBLIC_DOMAIN` est refusée.

Les requêtes de navigateur identifiées comme provenant d’un autre site sont refusées.
Ce contrôle et la limite de concurrence ne constituent pas une authentification ni
une limite distribuée entre plusieurs instances.

Les erreurs sont des codes et messages français contrôlés, jamais des traces ou des
erreurs SDK brutes. L’erreur OpenAI 402 vérifiée en production est conservée seulement
si son texte correspond exactement au message public connu. Les autres erreurs amont
deviennent des messages génériques. Les réponses du proxy portent `Cache-Control: no-store`.

## Mémoire et interface

Les clés de `sessionStorage` sont propres au widget :

- `rq-chat-history-v1` : les 30 derniers messages;
- `rq-chat-provider-v1` : le fournisseur sélectionné, Claude par défaut;
- `rq-chat-draft-v1` : le brouillon.

La mémoire suit l’onglet et l’origine du site : elle survit à un rafraîchissement et
à la navigation entre les quatre pages du même domaine. Le navigateur détermine son
comportement lors de la duplication/restauration d’un onglet. Il n’y a ni compte,
base de données ni stockage permanent ajouté.

Les longs messages de l’assistant restent visibles en entier. Pour le prochain appel,
leur contexte est limité à 4 000 caractères par message et aux échanges récents qui
tiennent dans les limites ci-dessus. L’historique ancien peut donc sortir du contexte.
Un appel interrompu par une navigation est restauré comme brouillon, sans renvoi automatique.
Un échec permet de réessayer sans dupliquer la question. Les erreurs ne sont pas ajoutées
au contexte du modèle. « Nouvelle conversation » efface historique et brouillon,
annule l’appel en cours et conserve le fournisseur choisi.

Si `sessionStorage` est indisponible, le widget continue de fonctionner en mémoire sur
la page et affiche une indication française sur la persistance indisponible.

## Markdown et isolation

Marked transforme le Markdown. Son traitement du HTML brut est remplacé par un
échappement. DOMPurify sanitise ensuite un fragment détaché avec une liste limitée :
`p`, `strong`, `em`, `ul`, `ol`, `li`, `a`, `br`, et les attributs `href` et `title`.
Seuls les liens absolus HTTP/HTTPS restent cliquables; ils reçoivent
`target="_blank"` et `rel="noopener noreferrer"` avant insertion dans le DOM.
Les messages utilisateur sont toujours du texte brut. Si les bibliothèques locales
ne chargent pas, les réponses s’affichent aussi en texte brut.

Les versions sont fixées dans `package-lock.json` et les modules navigateur sont servis
localement sous `/assets/chat-vendor/`. Aucun CDN ou domaine du chatbot n’est appelé
par le code du widget. Références : [Marked](https://marked.js.org/) et
[DOMPurify](https://github.com/cure53/DOMPurify).

Les classes et attributs commencent par `rq-chat`. Le script est un module isolé.
Les zones messages et saisie portent `data-lenis-prevent`, sans changement de Lenis.
Les nouveaux messages sont ajoutés au journal sans reconstruire les messages précédents.

## Accessibilité et mobile

Boutons natifs, contrôles nommés en français, titre de dialogue non modal, label de
saisie, `aria-expanded`, `aria-controls`, journal à annonce polie, état de chargement
et zone d’erreur accessible. Échap depuis le widget réduit le panneau et rend le
focus au lanceur. Aucun piège de focus. Entrée envoie, Maj+Entrée ajoute une ligne;
la composition de texte IME n’est pas interceptée. La réduction pendant un appel ne
déplace pas le focus lorsque la réponse arrive. Les mouvements réduits sont respectés.

Le panneau mesure au plus 390 pixels de large. Il s’adapte au viewport visuel,
aux zones de sécurité et aux changements du clavier. Les contrôles principaux ont
une cible de 44 pixels minimum. Sur petit écran, l’ouverture ne déclenche pas
automatiquement le clavier. Le panneau prend la place du lanceur pendant l’ouverture.
Sur un écran peu haut, les espaces sont réduits pour garder la saisie visible.

Quand le tiroir mobile existant est ouvert, le widget se réduit et se masque jusqu’à
la fermeture du tiroir. Il observe son état sans modifier la navigation.
Sur ordinateur, le panneau se décale à gauche si sa hauteur empiète sur la navigation.

## Vérification

Avec Google Chrome installé :

```powershell
npm test
```

Playwright utilise Chrome en mode sans interface. Les tests démarrent deux serveurs
locaux temporaires sur 3100 et 3101 : le site et un faux amont HTTP. Ils vérifient
interface, mémoire, navigation, défilement, Markdown, erreurs, validation et délai
réel de 60 secondes. Ils n’appellent pas les fournisseurs par défaut.

Pour vérifier aussi les vrais fournisseurs, démarrer le site dans un premier terminal :

```powershell
$env:PORT = '3102'
$env:CHATBOT_API_URL = 'https://chatbot-codex-production.up.railway.app'
npm start
```

Dans un deuxième terminal :

```powershell
$env:CHATBOT_LIVE_TEST = '1'
npm test -- --grep 'live Claude'
```

Ce test effectue deux demandes Claude puis une demande OpenAI via le site local.
Il attend actuellement l’erreur de crédits OpenAI; cette attente devra être adaptée
si le compte est rechargé. Il consomme l’usage normal des fournisseurs.

Les tests mobiles automatisés couvrent plusieurs tailles, le tiroir, un viewport
réduit et la visibilité des contrôles. Une vérification tactile sur iPhone/Android
réel et avec un lecteur d’écran reste conseillée avant déploiement.

### Résultats de cette intégration

Les 17 scénarios automatisés ont réussi, répartis entre le premier passage et les
vérifications ciblées après ajustements : les quatre pages, commandes du widget,
mémoire et brouillon, suivi du contexte, Markdown et injections HTML, erreurs et
réessai, annulation, défilement Lenis et chat, navigation, tailles mobiles, stockage
indisponible, clavier simulé sur un appareil tactile émulé, historique long,
validation et prévention de récursion, réponses amont invalides, délai réel de
60 secondes et appels réels Claude/OpenAI via le site local.

Claude a répondu et retenu le nom de code fourni dans la question précédente.
OpenAI a renvoyé l’erreur publique française HTTP 402 de crédits épuisés. Les captures
Chrome bureau/mobile ont aussi été inspectées. Aucun déploiement, commit, push ou
changement du chatbot n’a été effectué.

`npm audit` signale une vulnérabilité modérée dans `qs`, dépendance préexistante
d’Express; les nouvelles bibliothèques Markdown ne sont pas concernées par ce
rapport. Aucune mise à jour sans rapport avec le widget n’a été appliquée.
