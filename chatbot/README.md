# Assistant du site — déploiement

Le chatbot du site répond aux visiteurs à propos de Lamine (parcours, recherche,
publications, enseignement, contact) en s'appuyant **uniquement** sur le contenu
du site. Il est courtois, vouvoie, répond dans la langue du visiteur et renvoie
vers `mlndao@outlook.com` pour tout ce qu'il ne sait pas ou qui engage Lamine.

```
chatbot/
├── src/worker.js          API (Cloudflare Worker) : consignes, sécurité, appel OpenAI
├── knowledge.md           ce que le chatbot sait (généré depuis index.html)
├── build_knowledge.py     régénère knowledge.md
├── knowledge_extra.md     (optionnel) infos à ajouter, absentes du site
└── wrangler.toml          configuration Cloudflare
assets/js/profile-chat.js  Assistant IA : onglet + panneau latéral sur le site
```

La clé OpenAI reste côté Cloudflare : elle n'apparaît jamais dans le site ni dans Git.

## 1. Première mise en ligne (une seule fois)

Prérequis : un compte Cloudflare gratuit et une clé API OpenAI
(idéalement une clé dédiée à ce site, distincte de celle du PAD).

```bash
cd chatbot
npm install                              # installe wrangler (outil Cloudflare)
npx wrangler login                       # ouvre le navigateur pour se connecter
npx wrangler secret put OPENAI_API_KEY   # colle la clé quand elle est demandée
npx wrangler deploy
```

La commande `deploy` affiche l'adresse du Worker, par exemple
`https://lamine-chat.mon-compte.workers.dev`.

## 2. Brancher le site

Dans `index.html`, en bas de page, remplace l'adresse de `data-api`
(en gardant `/chat` à la fin) :

```html
<script src="assets/js/profile-chat.js"
        data-api="https://lamine-chat.mon-compte.workers.dev/chat" defer></script>
```

Adresse actuelle : `https://lamine-chat.mlndao.workers.dev/chat`.
Si `data-api` contient `VOTRE-SOUS-DOMAINE`, l'assistant n'est pas affiché.

L'avatar de l'assistant est dessiné dans `profile-chat.js`. Pour mettre une image à la place,
ajoute `data-avatar="chemin/vers/image.png"` à la balise.

## 3. Mettre à jour ce que sait le chatbot

Après chaque modification du site :

```bash
python3 chatbot/build_knowledge.py
cd chatbot && npx wrangler deploy
```

Pour lui apprendre des choses absentes du site (sujets de collaboration,
encadrement de stages, disponibilités…), écris-les dans `chatbot/knowledge_extra.md`
puis relance les deux commandes ci-dessus.

## Tester en local

```bash
# terminal 1 : le site
python3 -m http.server 8000
# terminal 2 : l'API (la clé est lue dans chatbot/.dev.vars, jamais commité)
cd chatbot && echo "OPENAI_API_KEY=sk-..." > .dev.vars && npx wrangler dev
```

Puis, temporairement, `data-api="http://127.0.0.1:8787/chat"` dans `index.html`
et ouvre http://localhost:8000.

## Garde-fous en place

- **Périmètre** : uniquement Lamine et son travail ; les questions hors sujet sont
  déclinées poliment. Aucune invention : en cas de doute, renvoi vers l'e-mail.
- **Aucun engagement** au nom de Lamine (recrutement, disponibilité, encadrement…).
- **Origines autorisées** : seul `https://lamine.mlndao.fr` (et localhost) peut
  appeler l'API (`ALLOWED_ORIGINS` dans `wrangler.toml`).
- **Anti-abus** : 15 questions par minute et par visiteur, messages de 1 000
  caractères max, réponses de 500 tokens max, 10 derniers messages seulement.
- **Coût** : avec gpt-4.1-mini, une question coûte environ 0,2 centime
  (tout le site est envoyé au modèle). Fixe quand même une limite de budget
  mensuelle sur https://platform.openai.com/settings/organization/limits.
