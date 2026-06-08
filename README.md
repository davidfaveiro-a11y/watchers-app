# Watchers

Application mobile web privée pour centraliser la vie du groupe Watchers :

- concerts et informations de sonorisation ;
- répétitions, payeur désigné et état du règlement ;
- accès aux fichiers Google Drive ;
- écoutes par plateforme ;
- chiffre d'affaires CD, vinyles et merchandising ;
- notifications et activité récente.

## Choix technique

L'application est une PWA statique hébergée sur GitHub Pages. GitHub héberge l'interface et le code,
mais pas une base de données privée. Supabase fournit l'authentification, la base PostgreSQL, les règles
d'accès et les événements temps réel.

## Tester localement

Un serveur HTTP est nécessaire pour le service worker :

```powershell
node dev-server.cjs
```

Ouvrir ensuite `http://localhost:4173`. Le bouton **Découvrir la version démo** fonctionne sans service externe.

## Configurer Supabase

1. Créer un projet sur [Supabase](https://supabase.com/).
2. Ouvrir le SQL Editor et exécuter `supabase/schema.sql`.
3. Copier l'URL du projet et la clé publique `anon` dans `config.js`.
4. Dans **Authentication > URL Configuration**, ajouter l'URL GitHub Pages dans les URL de redirection.
5. Ouvrir l'application, choisir **Créer mon compte** et utiliser `david.faveiro@gmail.com`.
6. Confirmer l'adresse grâce au lien reçu par e-mail.
7. Ne jamais placer la clé `service_role` dans cette application.

```js
window.WATCHERS_CONFIG = {
  supabaseUrl: "https://PROJECT.supabase.co",
  supabaseAnonKey: "CLE_PUBLIQUE_ANON",
  googleDriveFolderUrl: "https://drive.google.com/drive/folders/...",
};
```

Le schéma préautorise uniquement `david.faveiro@gmail.com`, avec le rôle administrateur. Pour ajouter
un membre ensuite, insérer son adresse dans `allowed_members` depuis le SQL Editor ou une future interface
d'administration. Une adresse absente de cette table ne peut pas créer de compte.

## Google Drive et statistiques

La première version ouvre le dossier partagé du groupe et référence les fichiers depuis Supabase.
Une synchronisation automatique exige une fonction serveur avec OAuth Google : les secrets Google ne
doivent jamais être stockés dans GitHub Pages.

Spotify for Artists, Apple Music for Artists et YouTube Studio ne proposent pas tous les mêmes données
ni les mêmes API publiques. Le modèle `streaming_stats` permet une saisie ou un import CSV commun.

## Notifications

Le bouton de l'application active les notifications du navigateur. Les alertes persistantes lorsque
l'application est fermée nécessitent une fonction Supabase Edge et un service Web Push. Les tables
concerts, répétitions et fichiers sont déjà activées pour le temps réel.

## Publier sur GitHub

1. Créer un dépôt GitHub privé.
2. Nommer la branche principale `main`.
3. Envoyer le projet sur GitHub.
4. Dans **Settings > Pages**, choisir **GitHub Actions** comme source.

Le workflow `.github/workflows/pages.yml` publiera automatiquement l'application.

> Attention : un dépôt privé n'implique pas forcément un site GitHub Pages privé. Les données sensibles
> restent protégées par Supabase et ses règles RLS ; ne pas placer de documents privés directement dans le dépôt.
