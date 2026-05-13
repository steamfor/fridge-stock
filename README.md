# FridgeStock

Application web PWA pour gérer le stock du frigo, congélateur et placard en famille, avec synchronisation temps réel et génération de menus par IA.

---

## Configuration Supabase

L'application utilise [Supabase](https://supabase.com) comme backend. Voici comment le configurer de zéro.

### 1. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com) → **New project**
2. Choisir un nom (ex: `fridgestock`) et un mot de passe de base de données
3. Une fois le projet créé, récupérer dans **Settings → API** :
   - **Project URL** : `https://xxxx.supabase.co`
   - **anon public key** : `eyJhbGci…`

---

### 2. Créer les tables

Dans **SQL Editor**, exécuter ce script :

```sql
-- Table stock
create table stock (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  qty      integer not null default 1,
  cat      text not null default '',
  exp      date,
  location text not null,
  added    bigint not null default extract(epoch from now()) * 1000
);

-- Table config
create table config (
  key   text primary key,
  value text not null
);

-- Mot de passe de l'application
insert into config (key, value) values ('app_password', 'monmotdepasse');
```

Remplacer `monmotdepasse` par le mot de passe souhaité pour accéder à l'app.

---

### 3. Activer le Realtime

Dans **Database → Replication**, activer la table `stock` pour les événements Realtime (INSERT, UPDATE, DELETE).

---

### 4. Configurer les permissions (RLS)

Dans **SQL Editor** :

```sql
-- Activer RLS
alter table stock  enable row level security;
alter table config enable row level security;

-- Autoriser l'accès anonyme au stock
create policy "stock_anon_all" on stock for all to anon using (true) with check (true);

-- Autoriser la lecture de la config uniquement
create policy "config_anon_read" on config for select to anon using (true);
```

---

### 5. Premier lancement

Ouvrir l'application dans le navigateur. L'écran de configuration s'affiche automatiquement la première fois :

1. Entrer l'**URL Supabase** (`https://xxxx.supabase.co`)
2. Entrer la **clé anon publique** (`eyJhbGci…`)
3. Cliquer **Enregistrer et continuer**
4. Entrer le **mot de passe** défini à l'étape 2

---

## Clés API pour la génération de menus

La fonctionnalité **Proposer des menus** peut utiliser trois modèles IA au choix. Ajouter les clés dans la table `config` de Supabase.

### Mistral AI (défaut)

```sql
insert into config (key, value) values ('mistral_key', 'votre-clé-mistral');
```

Obtenir une clé sur [console.mistral.ai](https://console.mistral.ai) → **API Keys**.

---

### ChatGPT / OpenAI (optionnel)

```sql
insert into config (key, value) values ('openai_key', 'sk-...');
```

Obtenir une clé sur [platform.openai.com](https://platform.openai.com) → **API keys**.

---

### Claude / Anthropic (optionnel)

```sql
insert into config (key, value) values ('anthropic_key', 'sk-ant-...');
```

Obtenir une clé sur [console.anthropic.com](https://console.anthropic.com) → **API Keys**.

---

### Modifier une clé existante

```sql
update config set value = 'nouvelle-clé' where key = 'mistral_key';
```

---

## Résumé des clés `config`

| `key`           | Obligatoire | Description                                  |
|-----------------|-------------|----------------------------------------------|
| `app_password`  | Oui         | Mot de passe d'accès à l'application         |
| `mistral_key`   | Non         | Clé API Mistral (menus IA — modèle par défaut) |
| `openai_key`    | Non         | Clé API OpenAI / ChatGPT (menus IA)          |
| `anthropic_key` | Non         | Clé API Anthropic / Claude (menus IA)        |

---

## Fonctionnalités

- **Stock** — Frigo, congélateur, placard avec quantités et dates d'expiration
- **Scanner** — Scan de codes-barres via caméra (Open Food Facts)
- **Ticket de caisse** — Import PDF, photo OCR ou texte collé
- **Menus IA** — Génération de menus basée sur le stock, avec choix du modèle (Mistral / ChatGPT / Claude) et mode batch cooking
- **Temps réel** — Synchronisation instantanée entre appareils (Supabase Realtime)
- **PWA** — Installable sur mobile (iOS/Android) et desktop
