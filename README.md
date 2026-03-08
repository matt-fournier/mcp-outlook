# MCP Outlook — Email & Calendar

Serveur MCP déployé sur Supabase Edge Functions pour interagir avec les courriels et calendriers Outlook via Microsoft Graph API.

## Fonctionnalités

| Outil | Description |
|---|---|
| `read_emails` | Lire les courriels d'un utilisateur (inbox, brouillons, envoyés, dossiers personnalisés). Filtre par défaut la boîte « Prioritaire » (exclut « Autres »). |
| `list_mail_folders` | Lister les dossiers d'une boîte courriel (incluant les dossiers personnalisés et sous-dossiers). Retourne les IDs utilisables avec `read_emails`. |
| `create_draft_email` | Créer un brouillon de courriel dans la boîte d'un utilisateur |
| `read_calendar_events` | Lire les événements d'un calendrier spécifique d'un utilisateur |
| `create_calendar_event` | Créer un événement dans un calendrier spécifique d'un utilisateur |

## Architecture

```
supabase/functions/
├── _shared/
│   └── mcp-auth/             # Module d'authentification partagé entre tous les MCP
│       ├── mod.ts             # Point d'entrée — authenticate(req)
│       ├── api-key.ts         # Validation par clé API (mcp_sk_...)
│       ├── supabase-jwt.ts    # Validation par JWT Supabase (getClaims / getUser)
│       └── types.ts           # AuthIdentity, AuthResult
├── mcp-outlook/
│   ├── index.ts               # Point d'entrée HTTP, CORS, authentification
│   ├── server.ts              # Serveur JSON-RPC manuel (compatible Deno)
│   ├── auth.ts                # Ré-export depuis _shared/mcp-auth
│   ├── cors.ts                # Configuration CORS
│   ├── types.ts               # Interfaces TypeScript
│   ├── graph-client.ts        # Client Microsoft Graph API (client credentials)
│   └── tools/
│       ├── index.ts           # Enregistrement de tous les outils
│       ├── read-emails.ts     # Lecture des courriels (focused inbox par défaut)
│       ├── list-mail-folders.ts # Listage des dossiers et sous-dossiers
│       ├── create-draft.ts    # Création de brouillons
│       ├── read-calendar-events.ts  # Lecture du calendrier
│       └── create-calendar-event.ts # Création d'événements
└── mcp-timely/                # (futur) — même pattern d'auth
```

## Authentification

Le module `_shared/mcp-auth` gère l'authentification pour tous les MCP du projet. Il supporte 3 méthodes, essayées dans l'ordre :

| Méthode | Cas d'usage | Token format |
|---|---|---|
| **SKIP_AUTH** | Développement local uniquement | Aucun token requis (`SKIP_AUTH=true` dans `.env.local`) |
| **API Key** | Claude Desktop, Cowork, scripts serveur | `Bearer mcp_sk_...` |
| **Supabase JWT** | Apps web avec login Supabase | `Bearer eyJhbG...` (JWT standard) |

Toutes les fonctions MCP sont déployées avec `verify_jwt = false` pour désactiver la vérification JWT au niveau du gateway Supabase. L'authentification est gérée dans la fonction elle-même, conformément au [pattern recommandé par Supabase](https://supabase.com/docs/guides/functions/auth).

## Prérequis

### 1. Application Azure AD

1. Aller sur [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. Créer une nouvelle application
3. Ajouter les permissions API (type **Application**) :
   - `Mail.ReadWrite` — Lire et écrire les courriels de tous les utilisateurs
   - `Calendars.ReadWrite` — Lire et écrire les calendriers de tous les utilisateurs
4. Accorder le consentement administrateur
5. Créer un secret client et noter les valeurs :
   - Tenant ID
   - Client ID
   - Client Secret

### 2. Projet Supabase

Un projet Supabase actif avec l'authentification configurée.

## Installation

```bash
# Cloner le dépôt
git clone <repo-url>
cd mcp-outlook

# Copier le fichier d'environnement
cp supabase/.env.local.example supabase/.env.local

# Remplir les valeurs dans supabase/.env.local
```

## Développement local

> Prérequis: Supabase local utilise Docker. Assurez-vous que **Docker tourne** (ex: démarrez *Docker Desktop*) avant d'exécuter `supabase start`.

### Mode rapide (sans auth)

Pour tester sans configurer l'authentification, ajoutez ces variables dans `supabase/.env.local` :

```
SKIP_AUTH=true
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
```

Puis lancez :

```bash
# Docker doit être démarré (ex: Docker Desktop)
supabase start
supabase functions serve mcp-outlook --env-file supabase/.env.local
```

Vous pouvez maintenant appeler le MCP directement sans token :

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/mcp-outlook \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

> **⚠️ Ne jamais activer `SKIP_AUTH` en production.**

### Mode avec API Key (local)

Pour tester l'authentification par clé API localement :

```
SKIP_AUTH=false
MCP_API_KEYS=dev-test:mcp_sk_test123
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
```

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/mcp-outlook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mcp_sk_test123" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Mode avec JWT Supabase (local)

Pour tester avec un JWT Supabase, récupérez les clés locales après `supabase start` :

> Prérequis: Docker doit être démarré (ex: Docker Desktop).

```bash
supabase status
```

Ajoutez `SB_PUBLISHABLE_KEY` (ou `SUPABASE_ANON_KEY` pour les projets legacy) dans `.env.local`, puis créez un utilisateur de test et obtenez un JWT :

```bash
export SUPABASE_URL="http://localhost:54321"
export SUPABASE_ANON_KEY="<your-local-anon-key>"
export EMAIL="test@example.com"
export PASSWORD="test-password"

# Créer le compte
curl -sS -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"'$EMAIL'","password":"'$PASSWORD'"}'

# Se connecter et extraire le token
export JWT=$(curl -sS -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"'$EMAIL'","password":"'$PASSWORD'"}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["access_token"])')
```

## Configuration des secrets (production)

```bash
# Microsoft Graph API
supabase secrets set MICROSOFT_TENANT_ID=your-tenant-id
supabase secrets set MICROSOFT_CLIENT_ID=your-client-id
supabase secrets set MICROSOFT_CLIENT_SECRET=your-client-secret

# Authentification MCP — clés API (format: nom:clé, séparées par des virgules)
supabase secrets set MCP_API_KEYS="claude-desktop:mcp_sk_VOTRE_CLE,backend:mcp_sk_AUTRE_CLE"

# Supabase JWT (pour les clients web avec login)
# SB_PUBLISHABLE_KEY ou SUPABASE_ANON_KEY — selon votre projet
supabase secrets set SB_PUBLISHABLE_KEY=sb_publishable_xxx
```

## Déploiement

```bash
supabase functions deploy mcp-outlook --no-verify-jwt
```

Ou automatiquement via GitHub Actions lors d'un push sur `main`.

## Intégration Claude Desktop

Ajouter dans la configuration MCP de Claude Desktop :

```json
{
  "mcpServers": {
    "outlook": {
      "url": "https://kfmeeqkmlwskinlojrwa.supabase.co/functions/v1/mcp-outlook",
      "headers": {
        "Authorization": "Bearer mcp_sk_VOTRE_CLE_SECRETE"
      }
    }
  }
}
```

## Intégration app web (Supabase Auth)

```ts
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch(
  "https://kfmeeqkmlwskinlojrwa.supabase.co/functions/v1/mcp-outlook",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "read_emails",
        arguments: { user_email: "mathias@obliques.co", limit: 5 },
      },
    }),
  }
);
```
