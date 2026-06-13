# Számlázz.hu — Számla Agent : díjbekérő + lien Barion (spec vérifiée 2026-06)

Réf. croisée docs.szamlazz.hu + clients open-source (szamlazz.js, szamlazz.py, laravel-szamlazzhu, wc-szamlazz).
Implémenté dans `src/worker.js` (fonctions `buildDijbekeroXml`, `szamlazzDijbekero`, `szamlazzCheck`).

## Transport
- **POST** `https://www.szamlazz.hu/szamla/`, `multipart/form-data`.
- Le **NOM du champ** choisit l'action ; le XML est envoyé comme **fichier** (Blob), pas comme champ texte.
  - Créer facture / díjbekérő → champ **`action-xmlagentxmlfile`**
  - Interroger une facture (lecture seule) → champ **`action-szamla_agent_xml`** (root `<xmlszamlaxml>`)
- Ne PAS fixer `Content-Type` soi-même (le runtime met le boundary multipart).

## Authentification
- `<szamlaagentkulcs>` **en minuscules** dans `<beallitasok>`. Remplace user/mot de passe.
- Clé générée sur szamlazz.hu → Vezérlőpult → bas de page → « Számla Agent kulcsok ». API-only.
- Stockée en secret Worker **`SZAMLAZZ_AGENT_KEY`**.

## Díjbekérő (proforma)
- Marqué par **`<dijbekero>true</dijbekero>`** dans `<fejlec>` (≠ `<elolegszamla>` qui est une vraie facture).
- Ordre des blocs : `beallitasok` → `fejlec` → `elado` → `vevo` → `tetelek`.
- `beallitasok` : `szamlaagentkulcs`, `eszamla`, `szamlaLetoltes` (false), `valaszVerzio` (**2** = réponse XML).
- `vevo` : `nev, orszag?, irsz, telepules, cim, email, sendEmail(true), adoszam?`.
- `tetel` : `megnevezes, mennyiseg, mennyisegiEgyseg, nettoEgysegar, afakulcs, nettoErtek, afaErtek, bruttoErtek`.
- `elado` : tout optionnel (l'identité vient du compte de la clé) ; champs email : `emailReplyto, emailTargy, emailSzoveg`.

## Lien de paiement Barion
- **Pré-requis (1×, dans le compte Számlázz, pas via API)** : connecter Barion (déjà fait côté user).
  Capacité au niveau **compte** — pas de flag XML par facture.
- Avec `vevo/sendEmail=true` + `vevo/email`, Számlázz **email au client** le lien du portail « vevői fiók » où il paie via Barion.
- Le lien revient dans le **header `szlahu_vevoifiokurl`** (et `<vevoifiokurl>` du XML si `valaszVerzio=2`).
- **Auto-facturation** : si « díjbekérő automatikus számlázása » est activé dans le compte, le paiement
  déclenche automatiquement l'émission de la vraie facture (aucun appel API en plus). ← à activer côté Számlázz.

## Réponse (headers `szlahu_`)
- Succès : `szlahu_szamlaszam` (n° doc), `szlahu_nettovegosszeg`, `szlahu_bruttovegosszeg`, `szlahu_vevoifiokurl`.
- Erreur : **`szlahu_error_code`** (numérique) + **`szlahu_error`** (texte, URL-encodé). ⚠️ PAS `szlahu_error_message`.
- Succès ⇔ `szlahu_error_code` vide ET `szlahu_szamlaszam` présent.

## Test clé SANS effet de bord
- Action `action-szamla_agent_xml` sur une commande inexistante :
  « facture introuvable » ⇒ clé VALIDE · erreur d'auth ⇒ clé INVALIDE. (impl. dans `szamlazzCheck`).

## Flux retenu (rappel)
Souscription → Worker émet le **díjbekérő** (lien Barion) → client paie → Számlázz auto-convertit en facture
→ webhook `/api/payment/callback` met à jour `subscription/payment/invoice` en base.
