# Családi napló — Backend (MVP)

## ✅ Phase 1 — Socle base de données : **FAIT** (2026-06-08)

- **Base D1** créée sur le compte Cloudflare : **`csaladinaplo-db`**
  - uuid : `16f97ff9-7ffe-4210-a6f9-1c524bed4284` · région **EEUR** (proche Hongrie)
- **Schéma appliqué** (8 tables) : `recipient, family, user, subscription, payment, invoice, post, comment`
  → voir `schema.sql` (re-jouable).
- **Données de démo** : famille **Kovács** (`code KOV-7821`) + destinataire (Kovács Józsefné, Szeged) + 1 user.

## ✅ Phase 2 — API (Worker SÉPARÉ + D1) : **FAIT & LIVE** (2026-06-08)

**Worker API séparé déployé** (le site live `csaladinaplo` n'est PAS touché).
- **Worker** : `csaladinaplo-api` → **https://csaladinaplo-api.joelle-marquie.workers.dev**
- **Code** : `backend/src/worker.js` (API JSON pure, CORS ouvert, binding D1 `DB`).
- **Binding D1** : `DB` → `csaladinaplo-db` (voir ⚠️ comptes ci-dessous).
- **Testé OK** : `GET /api/health` → `{"ok":true,"db":true}` · `POST /api/join {"code":"KOV-7821"}`
  → renvoie la famille Kovács (id 1, Szeged). Endpoints : `/api/health`, `/api/join`,
  `GET|POST /api/posts`, `/api/subscribe`, `/api/payment/callback` (stub).

### ⚠️ Piège comptes Cloudflare (résolu)
La 1ʳᵉ base `csaladinaplo-db` (uuid `16f97ff9-…`) avait été créée par le **MCP**, qui est sur un
**AUTRE compte Cloudflare** que le compte de production. Le compte de prod (qui héberge le Worker
`csaladinaplo`, le domaine csaladinaplo.hu et `csaladinaplo-api`) est :
- **Compte prod** : `Joelle.marquie@mtb.group` · id **`74a6608a72c0d9b625649710e90fae31`**
- **D1 de prod** : `csaladinaplo-db` · uuid **`1f35e32d-e7bb-4906-ab68-e1f46f778051`** · région Eastern Europe
  (schéma + seed Kovács re-créés via la **Console D1** du dashboard).
- L'ancienne base MCP (`16f97ff9-…`) est **orpheline** (autre compte) → à supprimer un jour. Le **MCP D1
  ne peut PAS gérer la base de prod** (compte différent) ; utiliser la Console du dashboard ou wrangler.

### Reste à faire (Phase 2 finition)
- Brancher le **front** (csaladinaplo.hu) sur l'API : remplacer les mocks par des `fetch` vers
  `https://csaladinaplo-api.joelle-marquie.workers.dev/api/…`.
- (Option) **Custom Domain** `api.csaladinaplo.hu` sur le Worker `csaladinaplo-api`.

### Procédure dashboard (éditeur en ligne, pas de wrangler/Node)
1. **dash.cloudflare.com → Compute (Workers) → Create → Worker.**
2. Nom : **`csaladinaplo-api`** → **Deploy** (le hello-world par défaut).
3. **Edit code** → tout sélectionner / supprimer → **coller le contenu de `backend/src/worker.js`** → **Deploy**.
4. **Settings → Bindings → Add binding → D1 database** :
   - Variable name : **`DB`**
   - D1 database : **`csaladinaplo-db`** → **Deploy** (re-déploie pour appliquer le binding).
5. **Test** : ouvrir `https://csaladinaplo-api.<sous-domaine>.workers.dev/api/health`
   → doit renvoyer `{"ok":true,"db":true,...}`.
   Puis `POST /api/join` avec `{"code":"KOV-7821"}` → doit renvoyer la famille Kovács.
6. (Option) **Custom Domain** `api.csaladinaplo.hu` → Settings → Domains & Routes → Add.
7. (Phase 3-4) **Settings → Variables and Secrets** (type *Secret*) : `SZAMLAZZ_AGENT_KEY`, `BARION_POSKEY`.

> Le front (csaladinaplo.hu) appellera l'API via son URL absolue (CORS déjà ouvert dans le worker).
> Équivalent wrangler (si Node installé un jour) :
> ```toml
> name = "csaladinaplo-api"
> main = "src/worker.js"
> compatibility_date = "2026-06-08"
> [[d1_databases]]
> binding = "DB"
> database_name = "csaladinaplo-db"
> database_id = "16f97ff9-7ffe-4210-a6f9-1c524bed4284"
> ```

## 🖼️ Images (R2) — CODE PRÊT, bucket BLOQUÉ par l'activation R2 (2026-06-10)

**État** : tout le code est en place (Worker + app), mais **R2 n'est pas activé sur le compte**
(`r2_bucket_create` → 403 `10042 "Please enable R2 through the Cloudflare Dashboard"`).
L'activation est une action de facturation (acceptation des conditions R2, carte éventuellement
demandée) → **à faire par Joëlle dans le dashboard** (le forfait gratuit couvre 10 Go/mois,
largement assez pour le MVP).

### Étapes restantes (≈ 5 min une fois R2 activé)
1. **Dashboard → R2 Object Storage → Enable R2** (compte prod `74a6608a…`).
2. Créer le bucket **`csaladinaplo-images`** (dashboard, wrangler ou MCP).
3. Bucket → **Settings → Public access → Allow Access** (URL `https://pub-xxxx.r2.dev`)
   — ou connecter le domaine custom `img.csaladinaplo.hu`. ⚠️ URL publique = `*.r2.dev`, pas `workers.dev`.
4. Bucket → **Settings → CORS policy** :
   `[{"AllowedOrigins":["https://csaladinaplo-app.pages.dev","https://csaladinaplo.hu"],"AllowedMethods":["GET"],"AllowedHeaders":["*"],"MaxAgeSeconds":86400}]`
5. Worker `csaladinaplo-api` : binding **R2 → `IMAGES` → csaladinaplo-images** + var **`IMG_BASE`** = URL publique
   (wrangler.toml est déjà prêt : décommenter le bloc `[[r2_buckets]]`) → redéployer.
6. App : **`VITE_IMG_BASE`** = même URL dans `csaladi-naplo/.env` → rebuild + redéploiement Pages.

### Comment les utilisateurs uploadent une image (flux implémenté)
1. App `/uj-poszt` (`NewPost.jsx`) : champ **« Fotó (opcionális) »** (jpeg/png/webp/gif, préviz locale).
2. À l'envoi : `uploadImage()` → **`POST /api/upload`** (multipart `file` + `family_id`).
3. Le Worker valide (type, max 8 Mo), écrit l'objet en R2 sous la clé
   **`families/<family_id>/<timestamp>-<uuid8>.<ext>`** (cache immutable 1 an) et renvoie `{img_key, url}`.
4. L'app crée le post via `POST /api/posts` avec `img_key`.
5. Affichage : feed → `imgUrl(img_key)` (= `VITE_IMG_BASE` + clé) ; gazette `/cimlap` et
   `GET /api/journal` → `posts[].img` = `IMG_BASE` + clé. Sans `IMG_BASE`, `img` reste `null` (placeholders).

### Seed d'images démo (après création du bucket)
```bash
# Photos de test déjà dans le repo : prototype/assets/photos/fam-3.jpg, fam-6.jpg, fam-7.jpg
npx wrangler r2 object put csaladinaplo-images/families/1/demo-fam-3.jpg --file prototype/assets/photos/fam-3.jpg --content-type image/jpeg
npx wrangler r2 object put csaladinaplo-images/families/1/demo-fam-6.jpg --file prototype/assets/photos/fam-6.jpg --content-type image/jpeg
npx wrangler r2 object put csaladinaplo-images/families/1/demo-fam-7.jpg --file prototype/assets/photos/fam-7.jpg --content-type image/jpeg
```
Puis lier aux posts Kovács (Console D1) :
```sql
UPDATE post SET img_key='families/1/demo-fam-3.jpg' WHERE id=1;
UPDATE post SET img_key='families/1/demo-fam-6.jpg' WHERE id=2;
UPDATE post SET img_key='families/1/demo-fam-7.jpg' WHERE id=3;
```

## 🔜 Phase 3-4 — Paiement & facturation (CODE ÉCRIT, en attente du secret)

Flux : **Számlázz émet le díjbekérő → lien Barion → paiement → facture auto**.
**Code Számla Agent écrit dans `src/worker.js`** (spec vérifiée : voir `SZAMLAZZ_AGENT.md`) :
- `POST /api/szamlazz/dijbekero` — émet la proforma (lien Barion dans `szlahu_vevoifiokurl`).
- `GET|POST /api/szamlazz/check` — **test de la clé SANS effet de bord** (à lancer en 1er).
- Barion est connecté **dans Számlázz** (fait côté user) → pas de flag XML, c'est au niveau compte.
- ⚠️ À activer dans le compte Számlázz : « **díjbekérő automatikus számlázása** » (facture auto au paiement).

### Secrets Worker (jamais dans le code) — Settings → Variables and Secrets, type *Secret*
- **`SZAMLAZZ_AGENT_KEY`** — clé Agent (minuscules) générée sur szamlazz.hu (Vezérlőpult → bas → « Számla Agent kulcsok »).
  L'utilisateur la colle lui-même dans le dashboard ; jamais dans le chat ni le code.
- `BARION_POSKEY` — déjà saisie **dans Számlázz** ; à ajouter ici seulement si on appelle Barion en direct (pas nécessaire avec le flux Számlázz-first).

## 🔜 Phase 5 — Brevo (emails cycle de vie) — DÉCIDÉ : temps réel via API
Décision user (2026-06) : **temps réel via API**.
- Événementiel (immédiat, déclenché par le Worker) : **inscription** → upsert contact Brevo + email bienvenue ;
  **paiement réussi** (IPN) → email de confirmation.
- Temps : **Cron Cloudflare quotidien** → rappel « publication approche » (X jours avant l'envoi de la gazette).
- Secret `BREVO_API_KEY` ; appels `POST api.brevo.com/v3/contacts` + `POST /v3/smtp/email` (templates).
- Brevo = société UE → bon pour le RGPD (responsable de traitement : MTB Retail Kft).

## ✅ Phase 2/3/5 — CÂBLAGE front ↔ API ↔ Brevo (FAIT 2026-06-08, à redéployer)

**Worker (`src/worker.js`) — nouveaux endpoints + emails serveur + Cron :**
- `POST /api/family/create` `{recipient:{name,nick?,street?,language?...}, manager:{name,email}, surname?}`
  → crée destinataire+famille+manager, **génère un code unique** (`genFamilyCode`, ex. `KOV-3920`),
  **upsert contact Brevo + email de bienvenue** (HU/FR/EN). Renvoie `{code, family_id}`.
- `POST /api/join` enrichi `{code, email?, name?, language?}` → si `email` : inscrit le membre + email de bienvenue.
- `POST /api/subscribe` enrichi `{..., buyer?, itemName?, language?}` → si `buyer` + clé Számlázz :
  émet le **díjbekérő** (ÁFA HU 27% / UE OSS à affiner) et renvoie `payment.payUrl` (lien Barion).
- `POST /api/payment/callback` `{subscription_id, status, amount?, currency?, email?, lang?, plan?}`
  → status payé ⇒ abonnement `active` + ligne `payment` + **email de confirmation**.
- `scheduled()` **Cron** → `runReminders()` : J-`REMINDER_DAYS` (déf. 3) avant fin de mois, envoie le
  **rappel « publication approche »** à tous les membres des abos actifs.
- Emails : `lifecycleEmail('welcome'|'payment'|'reminder', lang, data)` (HU/FR/EN, gabarit `mailShell`).

**Front (`prototype/app.html`) — couche `api()` :**
- `const API_BASE = 'https://csaladinaplo-api.joelle-marquie.workers.dev'` + `api(path, body)`.
- Onboarding : `join()` → `/api/join` ; `create()` → `/api/family/create` (nouveau champ **email** `o_f_email`).
- Tunnel d'abonnement : `finish()` → `/api/subscribe` (redirige vers `payment.payUrl` si présent).
- **Repli démo** partout (si l'API est injoignable, le prototype continue de fonctionner).

### 🚀 Redéploiement (2 Workers)
1. **API** : dashboard → Worker `csaladinaplo-api` → **Edit code** → coller `src/worker.js` → **Deploy**.
   - **Cron** : Settings → **Triggers → Cron Triggers → Add** → `0 9 * * *` (tous les jours 9h UTC).
   - (Option) Settings → Variables : `BREVO_LIST_ID` (id liste Brevo), `REMINDER_DAYS` (déf. 3).
   - Secrets déjà en place : `SZAMLAZZ_AGENT_KEY`, `BREVO_API_KEY`.
2. **Site** : Worker `csaladinaplo` → **New deployment** → glisser le contenu de `prototype/dist/` (dont `app.html`).

### 🧪 Tester l'API (après redeploy)
```bash
curl -X POST https://csaladinaplo-api.joelle-marquie.workers.dev/api/family/create \
  -H "content-type: application/json" \
  -d '{"recipient":{"name":"Teszt Nagyi","language":"hu"},"manager":{"name":"Teszt Anna","email":"TON_EMAIL"}}'
# → {"ok":true,"code":"TES-xxxx",...} + email de bienvenue reçu
```
> ⚠️ Le **paiement réel** (díjbekérő) reste bloqué tant que **NAV Online Számla** n'est pas connecté
> au fiók Számlázz « Családi napló » (erreur 378) — tâche de la comptable Hajnalka.

## Vérifier la base (via MCP Cloudflare ou dashboard → Storage → D1 → csaladinaplo-db)
```sql
SELECT f.code, f.name, r.name AS recipient, r.city FROM family f JOIN recipient r ON r.id=f.recipient_id;
```
