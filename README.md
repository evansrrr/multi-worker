# Multi-Worker Manager

A unified management tool for Cloudflare Workers, Pages, KV, and D1 databases across multiple Cloudflare accounts.

## Features

- **Multi-Account Management**: Add and manage multiple Cloudflare accounts with encrypted API token storage
- **Workers Management**: Create, update, and delete Cloudflare Workers with route and binding configuration
- **Pages Management**: Deploy and manage Cloudflare Pages projects
- **KV Storage**: Browse and manage KV namespaces and key-value pairs
- **D1 Databases**: Execute SQL queries and manage D1 database tables
- **Secure Authentication**: Password-protected access with encrypted token storage using AES-256-GCM
- **Dark Mode**: Modern dark theme UI with Cloudflare-inspired design

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Cloudflare Pages Functions (serverless)
- **Storage**: Cloudflare KV for session and account data
- **Security**: Web Crypto API for AES-256-GCM encryption

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Cloudflare account with Pages and KV access
- Wrangler CLI installed (`npm install -g wrangler`)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd multi-worker

# Install dependencies
npm install
```

### Development

```bash
# Start Vite dev server (frontend only)
npm run dev

# Start with Cloudflare Pages Functions (full stack)
npm run dev:pages
```

### Production Build

```bash
# Build the project
npm run build

# Preview the build
npm run preview
```

## Deployment to Cloudflare Pages

### 1. Create KV Namespace

```bash
# Create the KV namespace for storing data
npx wrangler kv namespace create TOOL_DATA
```

Copy the returned ID and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "TOOL_DATA"
id = "YOUR_KV_NAMESPACE_ID"
```

### 2. Deploy to Cloudflare Pages

```bash
# Deploy using Wrangler
npx wrangler pages deploy dist

# Or connect your Git repository for automatic deployments
```

### 3. Environment Variables

Configure via Cloudflare Dashboard or `wrangler.toml`:

| Variable | Description | Required |
|----------|-------------|----------|
| `TOOL_DATA` | KV namespace binding | Yes |

## Project Structure

```
multi-worker/
├── functions/           # Cloudflare Pages Functions (API)
│   ├── api/            # API endpoints
│   │   ├── auth/       # Authentication (login, setup, logout)
│   │   ├── accounts/   # Account management
│   │   └── settings/   # User settings
│   └── lib/            # Shared utilities
│       ├── cloudflare.ts  # Cloudflare API client
│       ├── crypto.ts      # Encryption/decryption
│       └── kv.ts          # KV storage operations
├── src/                # React frontend
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React contexts
│   ├── hooks/          # Custom hooks
│   ├── pages/          # Page components
│   └── types/          # TypeScript types
└── wrangler.toml       # Cloudflare configuration
```

## API Endpoints

### Authentication

- `POST /api/auth/setup` - First-time password setup
- `POST /api/auth/login` - Login with password
- `POST /api/auth/logout` - Logout and clear session
- `GET /api/auth/check` - Check authentication status

### Account Management

- `POST /api/accounts` - Add new account (with encrypted token)
- `DELETE /api/accounts/:id` - Remove account

### Settings

- `GET /api/settings/appearance` - Get appearance settings
- `PUT /api/settings/appearance` - Update appearance settings
- `POST /api/settings/password` - Change password

## Security

- All API tokens are encrypted using AES-256-GCM before storage
- Encryption keys are derived from a master key generated during setup
- Sessions are managed via HTTP-only cookies
- Passwords are hashed using SHA-256
- All API routes (except auth endpoints) require valid session

## License

MIT
