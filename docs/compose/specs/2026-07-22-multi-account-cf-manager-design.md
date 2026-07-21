# Multi-Account Cloudflare Workers & Pages Management Tool

## [S1] Problem

Users with multiple Cloudflare accounts need a unified interface to manage Workers, Pages, KV namespaces, and D1 databases across all accounts. The native Cloudflare dashboard only shows one account at a time, making multi-account management cumbersome.

## [S2] Solution Overview

Build a self-hosted web application deployed on Cloudflare Pages that:
- Stores multiple Cloudflare API tokens encrypted in KV
- Provides a unified dashboard to manage all accounts
- Offers full CRUD operations for Workers, Pages, KV, and D1
- Uses a UI style similar to Cloudflare's official dashboard

## [S3] Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Frontend | React 18 + Vite | Fast development, excellent TypeScript support |
| Routing | React Router v6 | Client-side routing for SPA |
| Styling | Tailwind CSS | Utility-first CSS, easy to match Cloudflare design |
| State | React Context + useState | Built-in, sufficient for this scale |
| Backend | Cloudflare Pages Functions | Serverless API routes at `/api/*` |
| Storage | Cloudflare KV | Persistent storage for tokens and settings |
| Encryption | AES-GCM via Web Crypto API | Modern, fast, built into Workers runtime |
| HTTP Client | Fetch API | Built-in, no extra dependencies |

## [S4] Authentication & Security

### Tool Access
- Simple password authentication
- Password stored as SHA-256 hash in KV (`config:password_hash`)
- Environment variable `ADMIN_PASSWORD` for initial setup
- If no password detected, show first-time setup wizard
- Session via HTTP-only cookie with 24h expiry

### Token Storage
- API tokens encrypted with AES-GCM before storing in KV
- Encryption key generated on first setup, stored in KV (`config:encryption_key`)
- Each token encrypted with unique IV

### API Security
- All `/api/*` routes require valid session cookie
- Middleware validates authentication on each request
- CORS configured for same-origin only

## [S5] Data Model

```
KV Namespace: TOOL_DATA

Keys:
├── config:password_hash     - SHA-256 hashed admin password
├── config:encryption_key    - Base64-encoded AES-GCM key
├── config:appearance        - "light" | "dark" | "system"
├── accounts:{account_id}    - Account metadata + encrypted token
│   ├── id                   - Cloudflare account ID
│   ├── name                 - Account name
│   ├── token_encrypted      - Encrypted API token
│   ├── token_iv             - IV used for encryption
│   └── created_at           - Timestamp
```

## [S6] API Endpoints

### Authentication
```
POST /api/auth/setup        - First-time password setup
POST /api/auth/login        - Authenticate with password
POST /api/auth/logout       - Clear session
GET  /api/auth/check        - Check if setup needed / session valid
```

### Account Management
```
GET    /api/accounts              - List all accounts
POST   /api/accounts              - Add new account (with token)
GET    /api/accounts/:id          - Get account details
PUT    /api/accounts/:id          - Update account
DELETE /api/accounts/:id          - Remove account
POST   /api/accounts/:id/verify   - Verify token works
```

### Workers Management
```
GET    /api/accounts/:id/workers              - List workers
GET    /api/accounts/:id/workers/:name        - Get worker details
POST   /api/accounts/:id/workers              - Create worker (upload script)
PUT    /api/accounts/:id/workers/:name        - Update worker script
DELETE /api/accounts/:id/workers/:name        - Delete worker
PUT    /api/accounts/:id/workers/:name/bindings - Update bindings
```

### Pages Management
```
GET    /api/accounts/:id/pages              - List Pages projects
GET    /api/accounts/:id/pages/:name        - Get project details
POST   /api/accounts/:id/pages              - Create Pages project
DELETE /api/accounts/:id/pages/:name        - Delete Pages project
POST   /api/accounts/:id/pages/:name/deploy - Deploy new version (upload assets)
GET    /api/accounts/:id/pages/:name/deployments - List deployments
```

### KV Management
```
GET    /api/accounts/:id/kv                  - List KV namespaces
POST   /api/accounts/:id/kv                  - Create KV namespace
DELETE /api/accounts/:id/kv/:namespace_id    - Delete KV namespace
GET    /api/accounts/:id/kv/:namespace_id/keys - List keys
GET    /api/accounts/:id/kv/:namespace_id/keys/:key - Get value
PUT    /api/accounts/:id/kv/:namespace_id/keys/:key - Set value
DELETE /api/accounts/:id/kv/:namespace_id/keys/:key - Delete key
```

### D1 Management
```
GET    /api/accounts/:id/d1                  - List D1 databases
POST   /api/accounts/:id/d1                  - Create D1 database
DELETE /api/accounts/:id/d1/:database_id     - Delete D1 database
GET    /api/accounts/:id/d1/:database_id/tables - List tables
POST   /api/accounts/:id/d1/:database_id/query  - Execute SQL query
```

### Settings
```
GET  /api/settings              - Get settings
PUT  /api/settings/password     - Change password
PUT  /api/settings/appearance   - Update appearance preference
```

## [S7] Frontend Pages

### 1. Setup Wizard (First-time)
- Shown when no password is configured
- Step 1: Create admin password
- Step 2: Confirmation

### 2. Login Page
- Password input
- Remember me checkbox (24h session)

### 3. Dashboard
- Account cards showing:
  - Account name
  - Account ID
  - Number of Workers
  - Number of Pages projects
  - Quick actions (View Workers, View Pages)

### 4. Account Management
- List all accounts with status
- Add account dialog (paste API token)
- Delete account with confirmation
- Account detail view

### 5. Workers List (per account)
- Table with columns: Name, Created, Modified, Routes
- Create worker button
- Delete worker action
- Click to view details

### 6. Worker Detail
- Script editor (view/edit)
- Routes configuration
- Bindings management:
  - Custom Domains
  - KV Namespaces
  - D1 Databases
  - Environment Variables
  - Service Bindings

### 7. Pages List (per account)
- Table with columns: Name, Created, Last Deploy, Domains
- Create project button
- Delete project action

### 8. Pages Detail
- Deployment history
- Deploy new version (file upload)
- Custom domains management

### 9. KV Management (per account)
- List namespaces with key count
- Create/delete namespace
- Browse keys in namespace
- Add/edit/delete key-value pairs

### 10. D1 Management (per account)
- List databases
- Create/delete database
- View tables
- SQL query editor

### 11. Settings
- Change password
- Appearance toggle (Light/Dark/System)
- About section

## [S8] UI Design

### Layout
- Fixed sidebar (260px) with navigation
- Top header with account selector and user menu
- Main content area with responsive grid

### Color Scheme (Dark Mode)
- Background: #1a1a2e, #16213e
- Cards: #1e293b
- Text: #e2e8f0
- Primary: #f6821f (Cloudflare orange)
- Success: #22c55e
- Error: #ef4444
- Border: #334155

### Components
- Sidebar navigation with icons
- Data tables with sorting/pagination
- Modal dialogs for forms
- Toast notifications for feedback
- Loading spinners for async operations
- Breadcrumb navigation

## [S9] Error Handling

- API errors return structured JSON: `{ error: string, code: string }`
- Frontend shows toast notifications for errors
- Network errors caught and displayed
- Token validation errors prompt re-authentication
- Rate limiting handled with retry logic

## [S10] Deployment

1. Create KV namespace `TOOL_DATA` in Cloudflare dashboard
2. Set environment variables in Pages:
   - `ADMIN_PASSWORD` (optional, for initial setup)
   - `KV_NAMESPACE_ID` (the KV namespace ID)
3. Deploy to Cloudflare Pages with:
   - Build command: `npm run build`
   - Build output: `dist`
4. Access the tool via Pages URL

## [S11] Project Structure

```
multi-worker/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # Base UI components (Button, Modal, etc.)
│   │   ├── layout/         # Layout components (Sidebar, Header)
│   │   └── features/       # Feature-specific components
│   ├── contexts/           # React Context providers
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions
│   ├── pages/              # Page components
│   │   ├── Auth/           # Login, Setup
│   │   ├── Dashboard/      # Main dashboard
│   │   ├── Accounts/       # Account management
│   │   ├── Workers/        # Workers management
│   │   ├── Pages/          # Pages management
│   │   ├── KV/             # KV management
│   │   ├── D1/             # D1 management
│   │   └── Settings/       # Settings page
│   ├── api/                # Frontend API client
│   ├── types/              # TypeScript types
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── functions/              # Cloudflare Pages Functions
│   ├── api/                # API routes
│   │   ├── auth.ts         # Authentication endpoints
│   │   ├── accounts.ts     # Account management
│   │   ├── workers.ts      # Workers API
│   │   ├── pages.ts        # Pages API
│   │   ├── kv.ts           # KV API
│   │   ├── d1.ts           # D1 API
│   │   └── settings.ts     # Settings API
│   ├── middleware.ts        # Auth middleware
│   └── _middleware.ts       # Global middleware
├── public/                 # Static assets
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── wrangler.toml           # Cloudflare configuration
```

## [S12] Implementation Phases

### Phase 1: Foundation (Day 1)
- Project setup (Vite + React + Tailwind)
- Cloudflare Pages Functions setup
- KV namespace configuration
- Basic routing structure
- Authentication system (setup + login)

### Phase 2: Account Management (Day 2)
- Account CRUD operations
- Token encryption/decryption
- Account verification
- Dashboard with account cards

### Phase 3: Workers Management (Day 3)
- Workers list and details
- Worker creation (script upload)
- Worker deletion
- Bindings management (KV, D1, env vars, custom domains)

### Phase 4: Pages Management (Day 4)
- Pages project list and details
- Project creation
- Deployment from asset upload
- Custom domains management

### Phase 5: KV & D1 Management (Day 5)
- KV namespace CRUD
- KV key-value browser
- D1 database CRUD
- D1 table viewer and query executor

### Phase 6: Polish & Settings (Day 6)
- Appearance settings (Light/Dark/System)
- Password change
- Error handling improvements
- Loading states and animations
- Final testing

## [S13] Testing Strategy

- Manual testing of all CRUD operations
- Test with multiple Cloudflare accounts
- Verify token encryption/decryption
- Test error scenarios (invalid tokens, network errors)
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile responsiveness testing

## [S14] Success Criteria

1. Can add and manage multiple Cloudflare accounts
2. Can view and manage Workers across all accounts
3. Can view and manage Pages projects across all accounts
4. Can manage KV namespaces and key-value pairs
5. Can manage D1 databases
6. UI matches Cloudflare dashboard style
7. All API tokens encrypted in storage
8. Deployed and working on Cloudflare Pages
