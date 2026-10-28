# Administration du site

Le contenu du site se modifie depuis **https://lamine.mlndao.fr/admin/**, sans toucher au code.
Chaque enregistrement est envoyé sur GitHub ; le site **et l'assistant IA** se mettent à jour
tout seuls en 1 à 2 minutes.

## Ce qu'on peut modifier

| Rubrique de l'admin | Sur le site |
| --- | --- |
| **Actualités** | Section « Actualités » (photo facultative) |
| **Publications** | Section « Publications », regroupées par type, triées par année |
| **Enseignement** | Section « Enseignement » (cours, outils) |
| **Parcours** | Section « Parcours » |
| **Profil & bio** | Photo, titre, thèmes, liens, CV, biographie, encadré, contact |
| **Thèmes de recherche** | Section « Recherche » (introduction et cartes) |

Règles communes :

- **Champ anglais vide = texte français repris.** Remplissez l'anglais seulement s'il diffère.
- **Mise en forme** : `**gras**`, `*italique*`, `[texte du lien](https://…)`.
- **Ordre** : actualités et publications sont triées par date ; enseignement et parcours
  suivent le champ « Position » (1 = en haut).
- **Brouillon** : une actualité cochée « Masquer du site » reste dans l'admin sans être publiée.

## Première connexion (une seule fois)

L'admin se connecte à GitHub avec un **jeton d'accès personnel** :

1. Sur GitHub : photo de profil › **Settings** › **Developer settings** ›
   **Personal access tokens** › **Fine-grained tokens** › **Generate new token**.
2. Nom : `admin site` · Expiration : 1 an · **Repository access** : *Only select repositories* › `mlndao`.
3. **Permissions** › Repository permissions › **Contents : Read and write**
   (Metadata : Read-only s'ajoute tout seul).
4. **Generate token**, copiez-le, puis sur https://lamine.mlndao.fr/admin/ :
   **Se connecter avec un jeton d'accès** et collez-le.

Le navigateur garde la connexion. Le jeton donne accès en écriture au dépôt :
ne le partagez pas, et révoquez-le sur GitHub en cas de doute.

## Travailler en local (facultatif)

Pour prévisualiser avant de publier, dans le dossier du site :

```bash
python3 build.py          # régénère index.html et chatbot/knowledge.md
```

puis ouvrez `index.html` avec Live Server. Depuis Chrome, l'admin propose aussi
**« Travailler avec le dépôt local »** : les modifications sont écrites dans ce dossier
(à commiter ensuite vous-même), sans passer par GitHub.

`index.html` est **généré** : ne le modifiez pas à la main, vos changements seraient écrasés.
Pour changer la mise en page, modifiez `templates/index.html`.

## Organisation des fichiers

```
content/            le contenu (un fichier par actualité, publication, etc.)
templates/          le modèle de la page
build.py            assemble la page à partir du contenu
admin/              la page d'administration (Sveltia CMS) et sa configuration
images/uploads/     les photos ajoutées depuis l'admin
.github/workflows/  la publication automatique sur GitHub Pages
chatbot/            l'assistant IA (voir chatbot/README.md)
```

## En cas de problème

- **Le site ne se met pas à jour** : sur GitHub, onglet **Actions**, le dernier
  « Publier le site » doit être vert. S'il est rouge, ouvrez-le : le message indique
  le fichier en cause (souvent une date ou une année mal saisie).
- **« Le jeton fourni n'est pas valide »** : le jeton a expiré ou n'a pas la permission
  *Contents : Read and write* ; créez-en un nouveau.
