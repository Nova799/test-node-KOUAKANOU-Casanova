# Blog API — backend test (Parse Server + Express)

Parse Server monté sur Express, avec Cloud Code pour les règles métier. MongoDB en mémoire par défaut (mongod embarqué via mongodb-memory-server pour les tests) ; mettre `DATABASE_URI` pour persister.

## Lancer

```bash
cp .env.example .env
npm install
npm start          # http://localhost:1337/parse
npm test           # 6 tests, exit 0
```

Variables : `PARSE_MASTER_KEY` (obligatoire, jamais dans le code), `DATABASE_URI`, `APP_ID`, `SERVER_URL`, `PORT`.

## Ce qui est fait

- Schéma Post / Comment / Like créé au démarrage (CLP inclus)
- beforeSave Post : trim + validation title 3-120, body 1-5000 ; author/likesCount/commentsCount forcés à la création, non modifiables ensuite
- beforeSave Comment : validation text 1-500, vérification existence du post (101 sinon), author forcé, ACL
- afterSave/afterDelete Comment : mise à jour de commentsCount
- afterDelete Post : suppression en cascade des comments et likes
- toggleLike (cloud function) : like/unlike, max un par (user, post), mise à jour de likesCount, retourne `{ liked, likesCount }`
- userStats (bonus) : posts, comments, likesReceived
- 6 tests automatisés (node:test)

## Choix

- mongodb-memory-server en devDependencies pour que `npm test` tourne sans Mongo installé
- Unique index sur Like(post, user) pour la cohérence sous appels parallèles
- ACL : lecture publique, écriture auteur uniquement

## Ce que j'améliorerais

- Tests de charge sur toggleLike parallèle
- Pagination et tri sur les listes
- Validation côté REST pour les champs manquants plutôt que 500
- Logging structuré et métriques
