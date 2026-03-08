# MCP Outlook — Email & Calendar

Serveur MCP déployé sur Supabase Edge Functions pour interagir avec les courriels et calendriers Outlook via Microsoft Graph API.

## Fonctionnalités

| Outil | Description |
|---|---|
| `read_emails` | Lire les courriels d'un utilisateur (inbox, brouillons, envoyés, etc.) |
| `create_draft_email` | Créer un brouillon de courriel dans la boîte d'un utilisateur |
| `read_calendar_events` | Lire les événements d'un calendrier spécifique d'un utilisateur |
| `create_calendar_event` | Créer un événement dans un calendrier spécifique d'un utilisateur |

## Architecture

```
supabase/functions/mcp-server/
├── index.ts              # Point d'entrée HTTP, CORS, authentification
├── server.ts             # Instanciation du serveur MCP
├── auth.ts               # Validation JWT via Supabase Auth
├── cors.ts               # Configuration CORS
├── types.ts              # Interfaces TypeScript
├── graph-client.ts       # Client Microsoft Graph API (client credentials)
└── tools/
    ├── index.ts           # Enregistrement de tous les outils
    ├── read-emails.ts     # Outil de lecture des courriels
    ├── create-draft.ts    # Outil de création de brouillons
    ├── read-calendar-events.ts  # Outil de lecture du calendrier
    └── create-calendar-event.ts # Outil de création d'événements
```

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

```bash
# Démarrer Supabase localement
supabase start

# Lancer la fonction en mode développement
supabase functions serve mcp-server --env-file supabase/.env.local
```

## Configuration des secrets (production)

```bash
supabase secrets set MICROSOFT_TENANT_ID=your-tenant-id
supabase secrets set MICROSOFT_CLIENT_ID=your-client-id
supabase secrets set MICROSOFT_CLIENT_SECRET=your-client-secret
```

## Déploiement

```bash
supabase functions deploy mcp-server
```

Ou automatiquement via GitHub Actions lors d'un push sur `main`.

## Test rapide

```bash
# Lister les outils disponibles
curl -X POST http://localhost:54321/functions/v1/mcp-server \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Lire les courriels d'un utilisateur
curl -X POST http://localhost:54321/functions/v1/mcp-server \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0","id":2,"method":"tools/call",
    "params":{
      "name":"read_emails",
      "arguments":{"user_email":"user@example.com","limit":5}
    }
  }'
```

## Intégration Claude Desktop

Ajouter dans la configuration MCP de Claude Desktop :

```json
{
  "mcpServers": {
    "outlook": {
      "url": "https://<project-ref>.supabase.co/functions/v1/mcp-server",
      "headers": {
        "Authorization": "Bearer <SUPABASE_JWT_TOKEN>"
      }
    }
  }
}
```
