# Multi-Account Cloudflare Workers & Pages Management Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted web application deployed on Cloudflare Pages that manages multiple Cloudflare accounts, their Workers, Pages, KV namespaces, and D1 databases.

**Architecture:** React 18 + Vite frontend with Tailwind CSS, Cloudflare Pages Functions for backend API, KV storage for encrypted tokens and settings, AES-GCM encryption via Web Crypto API.

**Tech Stack:** React 18, Vite, React Router v6, Tailwind CSS, TypeScript, Cloudflare Pages Functions, Cloudflare KV, Web Crypto API

## Global Constraints

- All API tokens must be encrypted with AES-GCM before storing in KV
- Password stored as SHA-256 hash
- UI must match Cloudflare dashboard style (dark mode primary)
- Frontend routes: `/setup`, `/login`, `/dashboard`, `/accounts/*`, `/workers/*`, `/pages/*`, `/kv/*`, `/d1/*`, `/settings`
- API routes: `/api/auth/*`, `/api/accounts/*`, `/api/workers/*`, `/api/pages/*`, `/api/kv/*`, `/api/d1/*`, `/api/settings/*`

---

## Phase 1: Foundation (Tasks 1-4)

### Task 1: Project Setup

**Covers:** [S3, S11]

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`

**Interfaces:**
- Produces: Vite project with React + TypeScript + Tailwind CSS

- [ ] **Step 1: Initialize project**

```bash
npm create vite@latest . -- --template react-ts
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react-router-dom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

Edit `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'cf-orange': '#f6821f',
        'cf-dark': {
          900: '#1a1a2e',
          800: '#16213e',
          700: '#1e293b',
          600: '#334155',
        },
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: Update index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-cf-dark-900 text-gray-100;
}
```

- [ ] **Step 5: Verify setup**

```bash
npm run dev
```
Expected: Dev server starts, page shows React + Vite

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "feat: initialize project with React + Vite + Tailwind"
```

---

### Task 2: Cloudflare Pages Functions Setup

**Covers:** [S6, S11]

**Files:**
- Create: `functions/api/test.ts`
- Create: `wrangler.toml`

**Interfaces:**
- Produces: `/api/test` endpoint returns `{ status: "ok" }`

- [ ] **Step 1: Create test endpoint**

```typescript
// functions/api/test.ts
export const onRequest: PagesFunction = async () => {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 2: Configure wrangler.toml**

```toml
name = "multi-worker-manager"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "TOOL_DATA"
id = "YOUR_KV_NAMESPACE_ID"
```

- [ ] **Step 3: Test with wrangler**

```bash
npx wrangler pages dev dist
```
Expected: `curl http://localhost:8788/api/test` returns `{"status":"ok"}`

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add Cloudflare Pages Functions setup"
```

---

### Task 3: Types Definition

**Covers:** [S5]

**Files:**
- Create: `src/types/index.ts`

**Interfaces:**
- Produces: TypeScript interfaces for all data models

- [ ] **Step 1: Create types file**

```typescript
// src/types/index.ts
export interface Account {
  id: string;
  name: string;
  token_encrypted: string;
  token_iv: string;
  created_at: string;
}

export interface AccountMetadata {
  id: string;
  name: string;
  type: "standard" | "enterprise";
  settings?: {
    abuse_contact_email?: string;
    enforce_twofactor?: boolean;
  };
}

export interface Worker {
  id: string;
  name: string;
  created_on: string;
  modified_on: string;
  routes?: WorkerRoute[];
  bindings?: WorkerBinding[];
}

export interface WorkerRoute {
  pattern: string;
  script: string;
}

export interface WorkerBinding {
  type: "kv_namespace" | "d1_database" | "env_var" | "service_binding" | "custom_domain";
  name: string;
  namespace_id?: string;
  database_id?: string;
  value?: string;
  service?: string;
  domain?: string;
}

export interface PagesProject {
  id: string;
  name: string;
  created_on: string;
  subdomain: string;
  domains: string[];
  deployment_trigger?: {
    metadata: {
      branch: string;
      commit_hash: string;
      commit_message: string;
    };
  };
}

export interface KVNamespace {
  id: string;
  title: string;
  created_on: string;
  modified_on: string;
  description?: string;
}

export interface KVKey {
  name: string;
  value: string;
  expiration?: number;
  metadata?: Record<string, unknown>;
}

export interface D1Database {
  uuid: string;
  name: string;
  created_at: string;
  file_size?: number;
}

export interface D1Table {
  name: string;
  sql: string;
}

export interface D1Result {
  results: Record<string, unknown>[];
  success: boolean;
  meta: {
    duration: number;
    changes: number;
    last_row_id: number;
    changed_db: boolean;
    size_after: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  needsSetup: boolean;
}

export type Appearance = "light" | "dark" | "system";
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add TypeScript type definitions"
```

---

### Task 4: Routing Setup

**Covers:** [S7]

**Files:**
- Create: `src/App.tsx`
- Create: `src/pages/Auth/Login.tsx`
- Create: `src/pages/Auth/Setup.tsx`
- Create: `src/pages/Dashboard/Index.tsx`
- Create: `src/pages/Accounts/Index.tsx`
- Create: `src/pages/Workers/Index.tsx`
- Create: `src/pages/Pages/Index.tsx`
- Create: `src/pages/KV/Index.tsx`
- Create: `src/pages/D1/Index.tsx`
- Create: `src/pages/Settings/Index.tsx`

**Interfaces:**
- Produces: Route structure for all pages

- [ ] **Step 1: Update App.tsx with routing**

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Auth/Login";
import Setup from "./pages/Auth/Setup";
import Dashboard from "./pages/Dashboard/Index";
import Accounts from "./pages/Accounts/Index";
import Workers from "./pages/Workers/Index";
import Pages from "./pages/Pages/Index";
import KV from "./pages/KV/Index";
import D1 from "./pages/D1/Index";
import Settings from "./pages/Settings/Index";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:accountId/workers" element={<Workers />} />
        <Route path="/accounts/:accountId/pages" element={<Pages />} />
        <Route path="/accounts/:accountId/kv" element={<KV />} />
        <Route path="/accounts/:accountId/d1" element={<D1 />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 2: Create placeholder pages**

Each page should return a simple div with the page name for now.

- [ ] **Step 3: Verify routing**

```bash
npm run dev
```
Expected: Navigate to different routes, see placeholder pages

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add routing structure with placeholder pages"
```

---

## Phase 2: Authentication (Tasks 5-7)

### Task 5: Auth API Endpoints

**Covers:** [S4, S6]

**Files:**
- Create: `functions/api/auth/setup.ts`
- Create: `functions/api/auth/login.ts`
- Create: `functions/api/auth/logout.ts`
- Create: `functions/api/auth/check.ts`
- Create: `functions/lib/crypto.ts`
- Create: `functions/lib/kv.ts`

**Interfaces:**
- Produces: Authentication API endpoints
- Consumes: KV namespace TOOL_DATA

- [ ] **Step 1: Create crypto utilities**

```typescript
// functions/lib/crypto.ts
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const exported = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function encryptData(
  data: string,
  keyBase64: string
): Promise<{ encrypted: string; iv: string }> {
  const keyData = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(data)
  );
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptData(
  encryptedBase64: string,
  ivBase64: string,
  keyBase64: string
): Promise<string> {
  const keyData = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(encryptedBase64), (c) =>
    c.charCodeAt(0)
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  return new TextDecoder().decode(decrypted);
}
```

- [ ] **Step 2: Create KV utilities**

```typescript
// functions/lib/kv.ts
interface Env {
  TOOL_DATA: KVNamespace;
}

export async function getConfig(env: Env, key: string): Promise<string | null> {
  return env.TOOL_DATA.get(`config:${key}`);
}

export async function setConfig(env: Env, key: string, value: string): Promise<void> {
  await env.TOOL_DATA.put(`config:${key}`, value);
}

export async function getSession(env: Env, sessionId: string): Promise<string | null> {
  return env.TOOL_DATA.get(`session:${sessionId}`);
}

export async function setSession(env: Env, sessionId: string, accountId: string): Promise<void> {
  await env.TOOL_DATA.put(`session:${sessionId}`, accountId, { expirationTtl: 86400 });
}

export async function deleteSession(env: Env, sessionId: string): Promise<void> {
  await env.TOOL_DATA.delete(`session:${sessionId}`);
}
```

- [ ] **Step 3: Create setup endpoint**

```typescript
// functions/api/auth/setup.ts
import { hashPassword, generateEncryptionKey } from "../../lib/crypto";
import { getConfig, setConfig } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { password } = await context.request.json();
  
  // Check if already set up
  const existingHash = await getConfig(context.env, "password_hash");
  if (existingHash) {
    return new Response(
      JSON.stringify({ error: "Already set up" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  
  // Hash password and generate encryption key
  const passwordHash = await hashPassword(password);
  const encryptionKey = await generateEncryptionKey();
  
  // Store in KV
  await setConfig(context.env, "password_hash", passwordHash);
  await setConfig(context.env, "encryption_key", encryptionKey);
  
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json" } }
  );
};
```

- [ ] **Step 4: Create login endpoint**

```typescript
// functions/api/auth/login.ts
import { verifyPassword } from "../../lib/crypto";
import { getConfig, setSession } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { password } = await context.request.json();
  
  const passwordHash = await getConfig(context.env, "password_hash");
  if (!passwordHash) {
    return new Response(
      JSON.stringify({ error: "Not set up" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  
  const isValid = await verifyPassword(password, passwordHash);
  if (!isValid) {
    return new Response(
      JSON.stringify({ error: "Invalid password" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  
  // Create session
  const sessionId = crypto.randomUUID();
  await setSession(context.env, sessionId, "authenticated");
  
  return new Response(
    JSON.stringify({ success: true }),
    {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
      },
    }
  );
};
```

- [ ] **Step 5: Create logout endpoint**

```typescript
// functions/api/auth/logout.ts
import { deleteSession } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const cookie = context.request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (match) {
    await deleteSession(context.env, match[1]);
  }
  
  return new Response(
    JSON.stringify({ success: true }),
    {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
      },
    }
  );
};
```

- [ ] **Step 6: Create check endpoint**

```typescript
// functions/api/auth/check.ts
import { getConfig, getSession } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const passwordHash = await getConfig(context.env, "password_hash");
  const needsSetup = !passwordHash;
  
  if (needsSetup) {
    return new Response(
      JSON.stringify({ needsSetup: true, isAuthenticated: false }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
  
  const cookie = context.request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (match) {
    const session = await getSession(context.env, match[1]);
    if (session) {
      return new Response(
        JSON.stringify({ needsSetup: false, isAuthenticated: true }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  }
  
  return new Response(
    JSON.stringify({ needsSetup: false, isAuthenticated: false }),
    { headers: { "Content-Type": "application/json" } }
  );
};
```

- [ ] **Step 7: Test endpoints**

```bash
# Test setup
curl -X POST http://localhost:8788/api/auth/setup -H "Content-Type: application/json" -d '{"password":"test123"}'

# Test login
curl -X POST http://localhost:8788/api/auth/login -H "Content-Type: application/json" -d '{"password":"test123"}'

# Test check
curl http://localhost:8788/api/auth/check
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: add authentication API endpoints"
```

---

### Task 6: Auth Middleware

**Covers:** [S4]

**Files:**
- Create: `functions/_middleware.ts`

**Interfaces:**
- Consumes: Session cookie
- Produces: Validates authentication on all /api/* routes

- [ ] **Step 1: Create middleware**

```typescript
// functions/_middleware.ts
import { getSession } from "./lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  
  // Skip auth for setup and login endpoints
  if (
    url.pathname === "/api/auth/setup" ||
    url.pathname === "/api/auth/login" ||
    url.pathname === "/api/auth/check" ||
    !url.pathname.startsWith("/api/")
  ) {
    return context.next();
  }
  
  // Check session
  const cookie = context.request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  
  const session = await getSession(context.env, match[1]);
  if (!session) {
    return new Response(
      JSON.stringify({ error: "Invalid session" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  
  return context.next();
};
```

- [ ] **Step 2: Test middleware**

```bash
# Should return 401
curl http://localhost:8788/api/accounts

# Should work after login
curl -b "session=YOUR_SESSION_ID" http://localhost:8788/api/accounts
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add auth middleware for API routes"
```

---

### Task 7: Frontend Auth Components

**Covers:** [S7]

**Files:**
- Create: `src/contexts/AuthContext.tsx`
- Create: `src/hooks/useAuth.ts`
- Create: `src/pages/Auth/Login.tsx`
- Create: `src/pages/Auth/Setup.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Input.tsx`

**Interfaces:**
- Consumes: Auth API endpoints
- Produces: Auth context, login/setup pages

- [ ] **Step 1: Create auth context**

```typescript
// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  needsSetup: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<void>;
  setup: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/check");
      const data = await res.json();
      setIsAuthenticated(data.isAuthenticated);
      setNeedsSetup(data.needsSetup);
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Login failed");
    }
    setIsAuthenticated(true);
  }

  async function setup(password: string) {
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Setup failed");
    }
    await login(password);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, needsSetup, isLoading, login, setup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

- [ ] **Step 2: Create UI components**

```typescript
// src/components/ui/Button.tsx
import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  isLoading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  isLoading,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-cf-orange hover:bg-orange-600 text-white",
    secondary: "bg-cf-dark-600 hover:bg-cf-dark-700 text-gray-200",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className || ""}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? "Loading..." : children}
    </button>
  );
}
```

```typescript
// src/components/ui/Input.tsx
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-3 py-2 bg-cf-dark-700 border border-cf-dark-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-cf-orange ${
            error ? "border-red-500" : ""
          } ${className || ""}`}
          {...props}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);
```

- [ ] **Step 3: Create Setup page**

```typescript
// src/pages/Auth/Setup.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export default function Setup() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setup, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    navigate("/dashboard");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      await setup(password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cf-dark-900">
      <div className="w-full max-w-md p-8 bg-cf-dark-700 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6">
          Multi-Worker Manager Setup
        </h1>
        <p className="text-gray-400 text-center mb-6">
          Create an admin password to secure your management tool.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />
          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" isLoading={isLoading} className="w-full">
            Create Password
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create Login page**

```typescript
// src/pages/Auth/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    navigate("/dashboard");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cf-dark-900">
      <div className="w-full max-w-md p-8 bg-cf-dark-700 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6">
          Multi-Worker Manager
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" isLoading={isLoading} className="w-full">
            Login
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update App.tsx with AuthProvider**

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Auth/Login";
import Setup from "./pages/Auth/Setup";
import Dashboard from "./pages/Dashboard/Index";

// ... other imports

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, needsSetup, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cf-orange"></div>
      </div>
    );
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { needsSetup } = useAuth();

  return (
    <Routes>
      {needsSetup ? (
        <Route path="/setup" element={<Setup />} />
      ) : (
        <>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          {/* Add other protected routes */}
        </>
      )}
      <Route path="*" element={<Navigate to={needsSetup ? "/setup" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Test auth flow**

```bash
npm run dev
```
Expected: First visit shows setup page, after setup redirects to login, after login shows dashboard

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add frontend authentication components"
```

---

## Phase 3: Account Management (Tasks 8-10)

### Task 8: Account API Endpoints

**Covers:** [S6]

**Files:**
- Create: `functions/api/accounts/index.ts`
- Create: `functions/api/accounts/[id].ts`
- Create: `functions/api/accounts/[id]/verify.ts`

**Interfaces:**
- Consumes: KV namespace TOOL_DATA, encryption utilities
- Produces: Account CRUD API

- [ ] **Step 1: Create accounts list/create endpoint**

```typescript
// functions/api/accounts/index.ts
import { encryptData } from "../../lib/crypto";
import { getConfig } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const list = await context.env.TOOL_DATA.list({ prefix: "accounts:" });
  const accounts = [];

  for (const key of list.keys) {
    if (key.name.endsWith(":token_encrypted")) continue;
    const account = await context.env.TOOL_DATA.get(key.name, { type: "json" });
    if (account) {
      accounts.push({
        id: account.id,
        name: account.name,
        created_at: account.created_at,
      });
    }
  }

  return new Response(JSON.stringify({ success: true, data: accounts }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { token, name } = await context.request.json();

  // Verify token by calling Cloudflare API
  const verifyRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const verifyData = await verifyRes.json();

  if (!verifyData.success) {
    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get account info
  const accountsRes = await fetch("https://api.cloudflare.com/client/v4/accounts", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const accountsData = await accountsRes.json();

  if (!accountsData.success || accountsData.result.length === 0) {
    return new Response(
      JSON.stringify({ error: "No accounts found" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const accountInfo = accountsData.result[0];
  const encryptionKey = await getConfig(context.env, "encryption_key");
  const { encrypted, iv } = await encryptData(token, encryptionKey!);

  const account = {
    id: accountInfo.id,
    name: name || accountInfo.name,
    token_encrypted: encrypted,
    token_iv: iv,
    created_at: new Date().toISOString(),
  };

  await context.env.TOOL_DATA.put(`accounts:${account.id}`, JSON.stringify(account));

  return new Response(
    JSON.stringify({ success: true, data: { id: account.id, name: account.name } }),
    { headers: { "Content-Type": "application/json" } }
  );
};
```

- [ ] **Step 2: Create account detail/delete endpoint**

```typescript
// functions/api/accounts/[id].ts
import { deleteSession } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const id = (context.params as { id: string }).id;
  await context.env.TOOL_DATA.delete(`accounts:${id}`);
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 3: Create verify endpoint**

```typescript
// functions/api/accounts/[id]/verify.ts
import { decryptData } from "../../../lib/crypto";
import { getConfig } from "../../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const id = (context.params as { id: string }).id;
  const account = await context.env.TOOL_DATA.get(`accounts:${id}`, { type: "json" });

  if (!account) {
    return new Response(
      JSON.stringify({ error: "Account not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const encryptionKey = await getConfig(context.env, "encryption_key");
  const token = await decryptData(
    account.token_encrypted,
    account.token_iv,
    encryptionKey!
  );

  const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();

  return new Response(
    JSON.stringify({ success: data.success, data: data.result }),
    { headers: { "Content-Type": "application/json" } }
  );
};
```

- [ ] **Step 4: Test endpoints**

```bash
# Add account
curl -X POST http://localhost:8788/api/accounts \
  -H "Content-Type: application/json" \
  -b "session=YOUR_SESSION" \
  -d '{"token":"YOUR_CF_TOKEN","name":"My Account"}'

# List accounts
curl http://localhost:8788/api/accounts -b "session=YOUR_SESSION"
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add account management API endpoints"
```

---

### Task 9: Account Management UI

**Covers:** [S7]

**Files:**
- Create: `src/pages/Accounts/Index.tsx`
- Create: `src/components/accounts/AccountCard.tsx`
- Create: `src/components/accounts/AddAccountModal.tsx`

**Interfaces:**
- Consumes: Account API endpoints
- Produces: Account management page

- [ ] **Step 1: Create AccountCard component**

```typescript
// src/components/accounts/AccountCard.tsx
import { Account } from "../../types";

interface AccountCardProps {
  account: Account;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AccountCard({ account, onSelect, onDelete }: AccountCardProps) {
  return (
    <div className="bg-cf-dark-700 rounded-lg p-4 hover:bg-cf-dark-600 transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-lg">{account.name}</h3>
          <p className="text-gray-400 text-sm">ID: {account.id}</p>
          <p className="text-gray-400 text-xs mt-1">
            Added: {new Date(account.created_at).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => onDelete(account.id)}
          className="text-red-500 hover:text-red-400 text-sm"
        >
          Delete
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onSelect(account.id)}
          className="flex-1 px-3 py-2 bg-cf-orange hover:bg-orange-600 rounded text-sm"
        >
          Manage
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AddAccountModal component**

```typescript
// src/components/accounts/AddAccountModal.tsx
import { useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (token: string, name: string) => Promise<void>;
}

export function AddAccountModal({ isOpen, onClose, onAdd }: AddAccountModalProps) {
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await onAdd(token, name);
      setToken("");
      setName("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add account");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cf-dark-700 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add Cloudflare Account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Account Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Cloudflare Account"
          />
          <Input
            label="API Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your Cloudflare API token"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Add Account
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Accounts page**

```typescript
// src/pages/Accounts/Index.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Account } from "../../types";
import { AccountCard } from "../../components/accounts/AccountCard";
import { AddAccountModal } from "../../components/accounts/AddAccountModal";
import { Button } from "../../components/ui/Button";

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data.data || []);
    } catch (error) {
      console.error("Failed to load accounts:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddAccount(token: string, name: string) {
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to add account");
    }
    await loadAccounts();
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm("Are you sure you want to delete this account?")) return;
    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadAccounts();
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cf-orange"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <Button onClick={() => setIsModalOpen(true)}>Add Account</Button>
      </div>
      {accounts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No accounts added yet.</p>
          <Button onClick={() => setIsModalOpen(true)} className="mt-4">
            Add Your First Account
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onSelect={(id) => navigate(`/accounts/${id}/workers`)}
              onDelete={handleDeleteAccount}
            />
          ))}
        </div>
      )}
      <AddAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddAccount}
      />
    </div>
  );
}
```

- [ ] **Step 4: Test account management**

```bash
npm run dev
```
Expected: Can add accounts, see them listed, delete them

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add account management UI"
```

---

### Task 10: Layout Components

**Covers:** [S8]

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/Header.tsx`
- Create: `src/components/layout/Layout.tsx`

**Interfaces:**
- Produces: Layout components for dashboard

- [ ] **Step 1: Create Sidebar component**

```typescript
// src/components/layout/Sidebar.tsx
import { NavLink } from "react-router-dom";

interface SidebarProps {
  accountId?: string;
}

export function Sidebar({ accountId }: SidebarProps) {
  const navItems = accountId
    ? [
        { to: `/accounts/${accountId}/workers`, label: "Workers", icon: "⚡" },
        { to: `/accounts/${accountId}/pages`, label: "Pages", icon: "📄" },
        { to: `/accounts/${accountId}/kv`, label: "KV", icon: "💾" },
        { to: `/accounts/${accountId}/d1`, label: "D1", icon: "🗄️" },
      ]
    : [
        { to: "/dashboard", label: "Dashboard", icon: "🏠" },
        { to: "/accounts", label: "Accounts", icon: "👤" },
      ];

  return (
    <aside className="w-64 bg-cf-dark-800 border-r border-cf-dark-600 min-h-screen">
      <div className="p-4">
        <h1 className="text-xl font-bold text-cf-orange">Multi-Worker</h1>
      </div>
      <nav className="mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 transition-colors ${
                isActive
                  ? "bg-cf-dark-700 text-cf-orange"
                  : "text-gray-400 hover:bg-cf-dark-700 hover:text-gray-200"
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create Header component**

```typescript
// src/components/layout/Header.tsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function Header() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="h-16 bg-cf-dark-800 border-b border-cf-dark-600 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <NavLink to="/accounts" className="text-gray-400 hover:text-gray-200">
          ← All Accounts
        </NavLink>
      </div>
      <div className="flex items-center gap-4">
        <NavLink to="/settings" className="text-gray-400 hover:text-gray-200">
          Settings
        </NavLink>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-gray-200"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create Layout component**

```typescript
// src/components/layout/Layout.tsx
import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface LayoutProps {
  children: ReactNode;
  accountId?: string;
}

export function Layout({ children, accountId }: LayoutProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar accountId={accountId} />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 bg-cf-dark-900">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update pages to use Layout**

Update Dashboard, Accounts, Workers, etc. pages to wrap content in Layout component.

- [ ] **Step 5: Test layout**

```bash
npm run dev
```
Expected: Sidebar and header visible, navigation works

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add layout components (Sidebar, Header)"
```

---

## Phase 4: Workers Management (Tasks 11-13)

### Task 11: Workers API Endpoints

**Covers:** [S6]

**Files:**
- Create: `functions/api/accounts/[id]/workers/index.ts`
- Create: `functions/api/accounts/[id]/workers/[name].ts`
- Create: `functions/api/accounts/[id]/workers/[name]/bindings.ts`
- Create: `functions/lib/cloudflare.ts`

**Interfaces:**
- Consumes: Cloudflare API, encrypted tokens
- Produces: Workers management API

- [ ] **Step 1: Create Cloudflare API utilities**

```typescript
// functions/lib/cloudflare.ts
import { decryptData } from "./crypto";
import { getConfig } from "./kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export async function getCloudflareToken(env: Env, accountId: string): Promise<string> {
  const account = await env.TOOL_DATA.get(`accounts:${accountId}`, { type: "json" });
  if (!account) throw new Error("Account not found");
  
  const encryptionKey = await getConfig(env, "encryption_key");
  return decryptData(account.token_encrypted, account.token_iv, encryptionKey!);
}

export async function cloudflareFetch(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message || "Cloudflare API error");
  }
  return data.result;
}
```

- [ ] **Step 2: Create workers list endpoint**

```typescript
// functions/api/accounts/[id]/workers/index.ts
import { getCloudflareToken, cloudflareFetch } from "../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const token = await getCloudflareToken(context.env, accountId);
  const workers = await cloudflareFetch(token, `/accounts/${accountId}/workers/scripts`);
  
  return new Response(JSON.stringify({ success: true, data: workers }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const token = await getCloudflareToken(context.env, accountId);
  const { script, name } = await context.request.json();
  
  const formData = new FormData();
  formData.append("script", new Blob([script]), name);
  formData.append("metadata", JSON.stringify({ main_module: name }));
  
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${name}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }
  );
  const data = await res.json();
  
  if (!data.success) {
    return new Response(
      JSON.stringify({ error: data.errors?.[0]?.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 3: Create worker detail/delete endpoint**

```typescript
// functions/api/accounts/[id]/workers/[name].ts
import { getCloudflareToken, cloudflareFetch } from "../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const name = (context.params as { name: string }).name;
  const token = await getCloudflareToken(context.env, accountId);
  
  const worker = await cloudflareFetch(token, `/accounts/${accountId}/workers/scripts/${name}`);
  const settings = await cloudflareFetch(token, `/accounts/${accountId}/workers/scripts/${name}/settings`);
  const bindings = await cloudflareFetch(token, `/accounts/${accountId}/workers/scripts/${name}/bindings`);
  
  return new Response(
    JSON.stringify({ success: true, data: { ...worker, settings, bindings } }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const name = (context.params as { name: string }).name;
  const token = await getCloudflareToken(context.env, accountId);
  
  await cloudflareFetch(token, `/accounts/${accountId}/workers/scripts/${name}`, {
    method: "DELETE",
  });
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 4: Test endpoints**

```bash
# List workers
curl http://localhost:8788/api/accounts/ACCOUNT_ID/workers -b "session=YOUR_SESSION"

# Create worker
curl -X POST http://localhost:8788/api/accounts/ACCOUNT_ID/workers \
  -H "Content-Type: application/json" \
  -b "session=YOUR_SESSION" \
  -d '{"script":"addEventListener(\"fetch\", event => event.respondWith(new Response(\"Hello\")))", "name":"test-worker"}'
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add Workers API endpoints"
```

---

### Task 12: Workers Management UI

**Covers:** [S7]

**Files:**
- Create: `src/pages/Workers/Index.tsx`
- Create: `src/components/workers/WorkerTable.tsx`
- Create: `src/components/workers/CreateWorkerModal.tsx`

**Interfaces:**
- Consumes: Workers API
- Produces: Workers management page

- [ ] **Step 1: Create WorkerTable component**

```typescript
// src/components/workers/WorkerTable.tsx
import { Worker } from "../../types";

interface WorkerTableProps {
  workers: Worker[];
  onDelete: (name: string) => void;
}

export function WorkerTable({ workers, onDelete }: WorkerTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-cf-dark-600">
            <th className="text-left py-3 px-4">Name</th>
            <th className="text-left py-3 px-4">Created</th>
            <th className="text-left py-3 px-4">Modified</th>
            <th className="text-left py-3 px-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((worker) => (
            <tr key={worker.name} className="border-b border-cf-dark-600 hover:bg-cf-dark-700">
              <td className="py-3 px-4">
                <span className="text-cf-orange">⚡</span> {worker.name}
              </td>
              <td className="py-3 px-4 text-gray-400">
                {new Date(worker.created_on).toLocaleDateString()}
              </td>
              <td className="py-3 px-4 text-gray-400">
                {new Date(worker.modified_on).toLocaleDateString()}
              </td>
              <td className="py-3 px-4">
                <button
                  onClick={() => onDelete(worker.name)}
                  className="text-red-500 hover:text-red-400 text-sm"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create Workers page**

```typescript
// src/pages/Workers/Index.tsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Worker } from "../../types";
import { Layout } from "../../components/layout/Layout";
import { WorkerTable } from "../../components/workers/WorkerTable";
import { Button } from "../../components/ui/Button";

export default function Workers() {
  const { accountId } = useParams<{ accountId: string }>();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWorkers();
  }, [accountId]);

  async function loadWorkers() {
    try {
      const res = await fetch(`/api/accounts/${accountId}/workers`);
      const data = await res.json();
      setWorkers(data.data || []);
    } catch (error) {
      console.error("Failed to load workers:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteWorker(name: string) {
    if (!confirm(`Delete worker "${name}"?`)) return;
    const res = await fetch(`/api/accounts/${accountId}/workers/${name}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await loadWorkers();
    }
  }

  if (isLoading) {
    return (
      <Layout accountId={accountId}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cf-orange"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout accountId={accountId}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Workers</h1>
          <Button>Create Worker</Button>
        </div>
        {workers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>No workers found.</p>
          </div>
        ) : (
          <WorkerTable workers={workers} onDelete={handleDeleteWorker} />
        )}
      </div>
    </Layout>
  );
}
```

- [ ] **Step 3: Test workers page**

```bash
npm run dev
```
Expected: Can see workers list, delete workers

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add Workers management UI"
```

---

### Task 13: Worker Bindings Management

**Covers:** [S6, S7]

**Files:**
- Create: `functions/api/accounts/[id]/workers/[name]/bindings.ts`
- Create: `src/components/workers/BindingsEditor.tsx`

**Interfaces:**
- Consumes: Cloudflare API for bindings
- Produces: Bindings management UI

- [ ] **Step 1: Create bindings endpoint**

```typescript
// functions/api/accounts/[id]/workers/[name]/bindings.ts
import { getCloudflareToken, cloudflareFetch } from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const name = (context.params as { name: string }).name;
  const token = await getCloudflareToken(context.env, accountId);
  
  const bindings = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts/${name}/bindings`
  );
  
  return new Response(JSON.stringify({ success: true, data: bindings }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const name = (context.params as { name: string }).name;
  const token = await getCloudflareToken(context.env, accountId);
  const bindings = await context.request.json();
  
  await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts/${name}/bindings`,
    {
      method: "PUT",
      body: JSON.stringify(bindings),
    }
  );
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 2: Create BindingsEditor component**

```typescript
// src/components/workers/BindingsEditor.tsx
import { useState, useEffect } from "react";
import { WorkerBinding } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

interface BindingsEditorProps {
  accountId: string;
  workerName: string;
}

export function BindingsEditor({ accountId, workerName }: BindingsEditorProps) {
  const [bindings, setBindings] = useState<WorkerBinding[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBindings();
  }, [accountId, workerName]);

  async function loadBindings() {
    try {
      const res = await fetch(`/api/accounts/${accountId}/workers/${workerName}/bindings`);
      const data = await res.json();
      setBindings(data.data || []);
    } catch (error) {
      console.error("Failed to load bindings:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // ... rendering logic for different binding types

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Bindings</h3>
      {isLoading ? (
        <div className="animate-pulse">Loading...</div>
      ) : (
        <div className="space-y-2">
          {bindings.map((binding) => (
            <div key={binding.name} className="bg-cf-dark-700 p-3 rounded">
              <span className="text-cf-orange">{binding.type}:</span> {binding.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add Worker bindings management"
```

---

## Phase 5: Pages Management (Tasks 14-15)

### Task 14: Pages API Endpoints

**Covers:** [S6]

**Files:**
- Create: `functions/api/accounts/[id]/pages/index.ts`
- Create: `functions/api/accounts/[id]/pages/[name].ts`
- Create: `functions/api/accounts/[id]/pages/[name]/deploy.ts`

**Interfaces:**
- Consumes: Cloudflare Pages API
- Produces: Pages management API

- [ ] **Step 1: Create pages list/create endpoint**

```typescript
// functions/api/accounts/[id]/pages/index.ts
import { getCloudflareToken, cloudflareFetch } from "../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const token = await getCloudflareToken(context.env, accountId);
  const projects = await cloudflareFetch(token, `/accounts/${accountId}/pages/projects`);
  
  return new Response(JSON.stringify({ success: true, data: projects }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const token = await getCloudflareToken(context.env, accountId);
  const { name } = await context.request.json();
  
  const project = await cloudflareFetch(token, `/accounts/${accountId}/pages/projects`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  
  return new Response(JSON.stringify({ success: true, data: project }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 2: Create deploy endpoint**

```typescript
// functions/api/accounts/[id]/pages/[name]/deploy.ts
import { getCloudflareToken } from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const name = (context.params as { name: string }).name;
  const token = await getCloudflareToken(context.env, accountId);
  
  const formData = await context.request.formData();
  
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${name}/deployments`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }
  );
  const data = await res.json();
  
  if (!data.success) {
    return new Response(
      JSON.stringify({ error: data.errors?.[0]?.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  
  return new Response(JSON.stringify({ success: true, data: data.result }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 3: Test endpoints**

```bash
# List pages projects
curl http://localhost:8788/api/accounts/ACCOUNT_ID/pages -b "session=YOUR_SESSION"

# Deploy
curl -X POST http://localhost:8788/api/accounts/ACCOUNT_ID/pages/PROJECT_NAME/deploy \
  -b "session=YOUR_SESSION" \
  -F "file=@./dist/index.html"
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add Pages API endpoints"
```

---

### Task 15: Pages Management UI

**Covers:** [S7]

**Files:**
- Create: `src/pages/Pages/Index.tsx`
- Create: `src/components/pages/ProjectTable.tsx`
- Create: `src/components/pages/DeployModal.tsx`

**Interfaces:**
- Consumes: Pages API
- Produces: Pages management page

- [ ] **Step 1: Create Pages page**

```typescript
// src/pages/Pages/Index.tsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { PagesProject } from "../../types";
import { Layout } from "../../components/layout/Layout";
import { Button } from "../../components/ui/Button";

export default function Pages() {
  const { accountId } = useParams<{ accountId: string }>();
  const [projects, setProjects] = useState<PagesProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, [accountId]);

  async function loadProjects() {
    try {
      const res = await fetch(`/api/accounts/${accountId}/pages`);
      const data = await res.json();
      setProjects(data.data || []);
    } catch (error) {
      console.error("Failed to load pages:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // ... rendering logic

  return (
    <Layout accountId={accountId}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Pages Projects</h1>
          <Button>Create Project</Button>
        </div>
        {/* Project list */}
      </div>
    </Layout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add Pages management UI"
```

---

## Phase 6: KV & D1 Management (Tasks 16-18)

### Task 16: KV API Endpoints

**Covers:** [S6]

**Files:**
- Create: `functions/api/accounts/[id]/kv/index.ts`
- Create: `functions/api/accounts/[id]/kv/[namespace_id]/keys.ts`
- Create: `functions/api/accounts/[id]/kv/[namespace_id]/keys/[key].ts`

**Interfaces:**
- Consumes: Cloudflare KV API
- Produces: KV management API

- [ ] **Step 1: Create KV endpoints**

```typescript
// functions/api/accounts/[id]/kv/index.ts
import { getCloudflareToken, cloudflareFetch } from "../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const token = await getCloudflareToken(context.env, accountId);
  const namespaces = await cloudflareFetch(token, `/accounts/${accountId}/storage/kv/namespaces`);
  
  return new Response(JSON.stringify({ success: true, data: namespaces }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const token = await getCloudflareToken(context.env, accountId);
  const { title } = await context.request.json();
  
  const namespace = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces`,
    {
      method: "POST",
      body: JSON.stringify({ title }),
    }
  );
  
  return new Response(JSON.stringify({ success: true, data: namespace }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 2: Create KV keys endpoint**

```typescript
// functions/api/accounts/[id]/kv/[namespace_id]/keys.ts
import { getCloudflareToken, cloudflareFetch } from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const namespaceId = (context.params as { namespace_id: string }).namespace_id;
  const token = await getCloudflareToken(context.env, accountId);
  
  const keys = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys`
  );
  
  return new Response(JSON.stringify({ success: true, data: keys }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add KV management API endpoints"
```

---

### Task 17: D1 API Endpoints

**Covers:** [S6]

**Files:**
- Create: `functions/api/accounts/[id]/d1/index.ts`
- Create: `functions/api/accounts/[id]/d1/[database_id]/query.ts`

**Interfaces:**
- Consumes: Cloudflare D1 API
- Produces: D1 management API

- [ ] **Step 1: Create D1 endpoints**

```typescript
// functions/api/accounts/[id]/d1/index.ts
import { getCloudflareToken, cloudflareFetch } from "../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const token = await getCloudflareToken(context.env, accountId);
  const databases = await cloudflareFetch(token, `/accounts/${accountId}/d1/database`);
  
  return new Response(JSON.stringify({ success: true, data: databases }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const token = await getCloudflareToken(context.env, accountId);
  const { name } = await context.request.json();
  
  const database = await cloudflareFetch(
    token,
    `/accounts/${accountId}/d1/database`,
    {
      method: "POST",
      body: JSON.stringify({ name }),
    }
  );
  
  return new Response(JSON.stringify({ success: true, data: database }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 2: Create D1 query endpoint**

```typescript
// functions/api/accounts/[id]/d1/[database_id]/query.ts
import { getCloudflareToken } from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const accountId = (context.params as { id: string }).id;
  const databaseId = (context.params as { database_id: string }).database_id;
  const token = await getCloudflareToken(context.env, accountId);
  const { sql } = await context.request.json();
  
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    }
  );
  const data = await res.json();
  
  return new Response(JSON.stringify({ success: data.success, data: data.result }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add D1 management API endpoints"
```

---

### Task 18: KV & D1 Management UI

**Covers:** [S7]

**Files:**
- Create: `src/pages/KV/Index.tsx`
- Create: `src/pages/D1/Index.tsx`

**Interfaces:**
- Consumes: KV and D1 APIs
- Produces: KV and D1 management pages

- [ ] **Step 1: Create KV page**

```typescript
// src/pages/KV/Index.tsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { KVNamespace } from "../../types";
import { Layout } from "../../components/layout/Layout";
import { Button } from "../../components/ui/Button";

export default function KV() {
  const { accountId } = useParams<{ accountId: string }>();
  const [namespaces, setNamespaces] = useState<KVNamespace[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNamespaces();
  }, [accountId]);

  async function loadNamespaces() {
    try {
      const res = await fetch(`/api/accounts/${accountId}/kv`);
      const data = await res.json();
      setNamespaces(data.data || []);
    } catch (error) {
      console.error("Failed to load KV namespaces:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // ... rendering logic

  return (
    <Layout accountId={accountId}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">KV Namespaces</h1>
          <Button>Create Namespace</Button>
        </div>
        {/* Namespace list */}
      </div>
    </Layout>
  );
}
```

- [ ] **Step 2: Create D1 page**

```typescript
// src/pages/D1/Index.tsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { D1Database } from "../../types";
import { Layout } from "../../components/layout/Layout";
import { Button } from "../../components/ui/Button";

export default function D1() {
  const { accountId } = useParams<{ accountId: string }>();
  const [databases, setDatabases] = useState<D1Database[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDatabases();
  }, [accountId]);

  async function loadDatabases() {
    try {
      const res = await fetch(`/api/accounts/${accountId}/d1`);
      const data = await res.json();
      setDatabases(data.data || []);
    } catch (error) {
      console.error("Failed to load D1 databases:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // ... rendering logic

  return (
    <Layout accountId={accountId}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">D1 Databases</h1>
          <Button>Create Database</Button>
        </div>
        {/* Database list */}
      </div>
    </Layout>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add KV and D1 management UI"
```

---

## Phase 7: Settings & Polish (Tasks 19-21)

### Task 19: Settings API & UI

**Covers:** [S7]

**Files:**
- Create: `functions/api/settings/index.ts`
- Create: `functions/api/settings/password.ts`
- Create: `functions/api/settings/appearance.ts`
- Create: `src/pages/Settings/Index.tsx`

**Interfaces:**
- Consumes: KV config
- Produces: Settings management

- [ ] **Step 1: Create settings endpoints**

```typescript
// functions/api/settings/appearance.ts
import { getConfig, setConfig } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const appearance = await getConfig(context.env, "appearance");
  return new Response(
    JSON.stringify({ success: true, data: appearance || "system" }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { appearance } = await context.request.json();
  await setConfig(context.env, "appearance", appearance);
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 2: Create Settings page**

```typescript
// src/pages/Settings/Index.tsx
import { useState, useEffect } from "react";
import { Layout } from "../../components/layout/Layout";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Appearance } from "../../types";

export default function Settings() {
  const [appearance, setAppearance] = useState<Appearance>("system");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    loadAppearance();
  }, []);

  async function loadAppearance() {
    const res = await fetch("/api/settings/appearance");
    const data = await res.json();
    setAppearance(data.data);
  }

  async function handleSaveAppearance() {
    await fetch("/api/settings/appearance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appearance }),
    });
  }

  // ... rendering

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Appearance</h2>
          <div className="flex gap-4">
            {(["light", "dark", "system"] as Appearance[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setAppearance(mode)}
                className={`px-4 py-2 rounded ${
                  appearance === mode
                    ? "bg-cf-orange text-white"
                    : "bg-cf-dark-700 text-gray-300"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <Button onClick={handleSaveAppearance} className="mt-4">
            Save
          </Button>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Change Password</h2>
          <div className="space-y-4">
            <Input
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button>Update Password</Button>
          </div>
        </section>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add Settings page with appearance and password management"
```

---

### Task 20: Toast Notifications

**Covers:** [S8]

**Files:**
- Create: `src/contexts/ToastContext.tsx`
- Create: `src/components/ui/Toast.tsx`

**Interfaces:**
- Produces: Toast notification system

- [ ] **Step 1: Create toast context**

```typescript
// src/contexts/ToastContext.tsx
import { createContext, useContext, useState, ReactNode } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(message: string, type: Toast["type"] = "info") {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
```

- [ ] **Step 2: Create Toast component**

```typescript
// src/components/ui/Toast.tsx
import { useToast } from "../../contexts/ToastContext";

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
            toast.type === "success"
              ? "bg-green-600"
              : toast.type === "error"
              ? "bg-red-600"
              : "bg-cf-dark-600"
          }`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 hover:opacity-75"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx with ToastProvider**

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add toast notification system"
```

---

### Task 21: Dark/Light Mode Toggle

**Covers:** [S6]

**Files:**
- Modify: `src/index.css`
- Modify: `tailwind.config.js`

**Interfaces:**
- Consumes: Appearance setting
- Produces: Theme switching

- [ ] **Step 1: Update tailwind config for dark mode**

Already configured in Task 1 with `darkMode: 'class'`.

- [ ] **Step 2: Create theme hook**

```typescript
// src/hooks/useTheme.ts
import { useState, useEffect } from "react";
import { Appearance } from "../types";

export function useTheme() {
  const [appearance, setAppearance] = useState<Appearance>("system");

  useEffect(() => {
    loadAppearance();
  }, []);

  useEffect(() => {
    applyTheme(appearance);
  }, [appearance]);

  async function loadAppearance() {
    try {
      const res = await fetch("/api/settings/appearance");
      const data = await res.json();
      setAppearance(data.data || "system");
    } catch {
      // Default to system
    }
  }

  function applyTheme(mode: Appearance) {
    const root = document.documentElement;
    if (mode === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", isDark);
    } else {
      root.classList.toggle("dark", mode === "dark");
    }
  }

  return { appearance, setAppearance };
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add dark/light mode toggle"
```

---

### Task 22: Final Testing & Deployment

**Covers:** [S12, S13]

**Files:**
- Create: `wrangler.toml` (updated)
- Create: `README.md`

**Interfaces:**
- Consumes: All previous tasks
- Produces: Deployable application

- [ ] **Step 1: Update wrangler.toml**

```toml
name = "multi-worker-manager"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "TOOL_DATA"
id = "YOUR_KV_NAMESPACE_ID"

[vars]
ADMIN_PASSWORD = ""
```

- [ ] **Step 2: Test complete flow**

```bash
npm run build
npx wrangler pages dev dist
```

Test:
1. First visit shows setup page
2. Create password
3. Login with password
4. Add Cloudflare account
5. View Workers/Pages/KV/D1
6. Perform CRUD operations

- [ ] **Step 3: Deploy to Cloudflare Pages**

```bash
npx wrangler pages deploy dist
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: complete multi-account Cloudflare management tool"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-4 | Foundation (project setup, routing, types) |
| 2 | 5-7 | Authentication (API, middleware, UI) |
| 3 | 8-10 | Account management |
| 4 | 11-13 | Workers management |
| 5 | 14-15 | Pages management |
| 6 | 16-18 | KV & D1 management |
| 7 | 19-22 | Settings, polish, deployment |

Total: 22 tasks across 7 phases
