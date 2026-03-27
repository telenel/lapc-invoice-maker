# User Account System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the access-code auth system with simple name-based user creation, default password login, and a multi-step onboarding flow.

**Architecture:** Drop `accessCode` and `needsSetup` from the User model, add `setupComplete`. Admin creates users with just a name (first name becomes temp username, password defaults to "password123"). New users log in, then complete onboarding (name, email→username, password, theme) before accessing the app.

**Tech Stack:** Next.js 14, Prisma 7, NextAuth, bcryptjs, Tailwind CSS, shadcn/ui v4

---

### Task 1: Database Migration

**Files:**
- Modify: `prisma/schema.prisma:10-26`

- [ ] **Step 1: Update the User model in schema.prisma**

Replace lines 16 and 19 (accessCode and needsSetup) with setupComplete:

```prisma
model User {
  id             String    @id @default(uuid())
  username       String    @unique
  passwordHash   String    @map("password_hash")
  name           String
  email          String    @default("")
  role           String    @default("user")
  active         Boolean   @default(true)
  setupComplete  Boolean   @default(false) @map("setup_complete")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  invoices       Invoice[]
  userQuickPicks UserQuickPick[]

  @@map("users")
}
```

- [ ] **Step 2: Create the migration**

Run: `npx prisma migrate dev --name replace_access_code_with_setup_complete`

This will fail because it tries to drop a non-nullable column. We need a custom migration. After it creates the migration file, replace its contents with:

```sql
-- Drop access code column and its unique index
ALTER TABLE "users" DROP COLUMN IF EXISTS "access_code";

-- Convert needs_setup to setup_complete (inverted logic)
ALTER TABLE "users" ADD COLUMN "setup_complete" BOOLEAN NOT NULL DEFAULT false;
UPDATE "users" SET "setup_complete" = NOT "needs_setup";
ALTER TABLE "users" DROP COLUMN "needs_setup";
```

- [ ] **Step 3: Regenerate Prisma client**

Run: `npx prisma generate`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "feat: replace accessCode/needsSetup with setupComplete in User model"
```

---

### Task 2: Update Auth — Remove Access Code Login Path

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Rewrite auth.ts**

Replace the entire file with:

```typescript
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username.trim().toLowerCase(), active: true },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          setupComplete: user.setupComplete,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as unknown as { username: string }).username;
        token.role = (user as unknown as { role: string }).role;
        token.setupComplete = (user as unknown as { setupComplete: boolean }).setupComplete;
      } else if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, setupComplete: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.setupComplete = dbUser.setupComplete;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { username: string }).username = token.username as string;
        (session.user as { role: string }).role = token.role as string;
        (session.user as { setupComplete: boolean }).setupComplete = token.setupComplete as boolean;
      }
      return session;
    },
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: remove access code login, use setupComplete in auth"
```

---

### Task 3: Update Middleware

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Rewrite middleware.ts**

Replace the entire file with:

```typescript
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const setupComplete = req.nextauth.token?.setupComplete;
    const isSetupPage = req.nextUrl.pathname === "/setup";

    if (!setupComplete && !isSetupPage) {
      return NextResponse.redirect(new URL("/setup", req.url));
    }
    if (setupComplete && isSetupPage) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/((?!login|api/auth|api/setup|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$).*)",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: middleware uses setupComplete instead of needsSetup"
```

---

### Task 4: Simplify Login Form

**Files:**
- Modify: `src/components/login-form.tsx`

- [ ] **Step 1: Rewrite login-form.tsx**

Replace the entire file with:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid username or password");
      setLoading(false);
    } else {
      router.push(searchParams.get("callbackUrl") || "/");
      router.refresh();
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-lg border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-3xl font-bold tracking-tight text-center">
          InvoiceMaker
        </CardTitle>
        <p className="text-sm text-muted-foreground text-center">Los Angeles Pierce College</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              required
              autoFocus
              className="h-11"
              placeholder="Username…"
              autoComplete="username"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required className="h-11" autoComplete="current-password" />
          </div>
          {error && (
            <div aria-live="polite">
              <div className="border-t border-border/50" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
          <Button type="submit" className="w-full h-11 font-semibold uppercase tracking-wide bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/login-form.tsx
git commit -m "feat: simplify login form — username + password only"
```

---

### Task 5: New Setup API Endpoint

**Files:**
- Delete: `src/app/api/auth/setup/route.ts`
- Create: `src/app/api/setup/route.ts`

- [ ] **Step 1: Delete old setup API**

Delete `src/app/api/auth/setup/route.ts`

- [ ] **Step 2: Create new setup API at src/app/api/setup/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await request.json();
  const { name, email, password } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Check email uniqueness (excluding self)
  const existing = await prisma.user.findUnique({ where: { username: email.toLowerCase() } });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ error: "This email is already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: name.trim(),
      email: email.toLowerCase(),
      username: email.toLowerCase(),
      passwordHash,
      setupComplete: true,
    },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git rm src/app/api/auth/setup/route.ts
git add src/app/api/setup/route.ts
git commit -m "feat: new /api/setup endpoint for onboarding"
```

---

### Task 6: New Multi-Step Setup Page

**Files:**
- Rewrite: `src/app/setup/page.tsx`

- [ ] **Step 1: Rewrite setup page with multi-step onboarding**

Replace the entire file with:

```tsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckIcon, MoonIcon, PaletteIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "light", label: "Light", icon: SunIcon, description: "Clean and bright" },
  { value: "dark", label: "Dark", icon: MoonIcon, description: "Easy on the eyes" },
  { value: "theme-mocha", label: "Catppuccin", icon: PaletteIcon, description: "Warm and cozy" },
];

export default function SetupPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1: Profile
  const [name, setName] = useState(session?.user?.name || "");
  const [email, setEmail] = useState("");

  // Step 2: Password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Pre-fill name when session loads
  const sessionName = session?.user?.name || "";
  if (sessionName && !name) setName(sessionName);

  function handleNextProfile() {
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    setStep(2);
  }

  function handleNextPassword() {
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setStep(3);
  }

  async function handleComplete() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/30">
      <div className="mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lapc-logo.png" alt="Los Angeles Pierce College" style={{ height: 80, width: "auto" }} />
      </div>
      <Card className="w-full max-w-md shadow-lg border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight text-center">
            {step === 1 && "Welcome! Set Up Your Profile"}
            {step === 2 && "Create Your Password"}
            {step === 3 && "Choose Your Theme"}
          </CardTitle>
          <p className="text-sm text-muted-foreground text-center">
            Step {step} of 3
          </p>
        </CardHeader>
        <CardContent>
          {/* Step 1: Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-name">Full Name</Label>
                <Input
                  id="setup-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name…"
                  autoFocus
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-email">Email</Label>
                <Input
                  id="setup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  This will become your username for future logins.
                </p>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button onClick={handleNextProfile} className="w-full h-11 font-semibold bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white">
                Continue
              </Button>
            </div>
          )}

          {/* Step 2: Password */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-password">New Password</Label>
                <Input
                  id="setup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters…"
                  autoFocus
                  className="h-11"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-confirm">Confirm Password</Label>
                <Input
                  id="setup-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password…"
                  className="h-11"
                  autoComplete="new-password"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep(1); setError(""); }} className="flex-1 h-11">
                  Back
                </Button>
                <Button onClick={handleNextPassword} className="flex-1 h-11 font-semibold bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Theme */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid gap-3">
                {themeOptions.map((t) => {
                  const Icon = t.icon;
                  const selected = theme === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-4 text-left transition-all hover:bg-accent/50",
                        selected ? "border-primary bg-accent ring-2 ring-primary/20" : "border-border"
                      )}
                    >
                      <Icon className="size-5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </div>
                      {selected && <CheckIcon className="size-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep(2); setError(""); }} className="flex-1 h-11">
                  Back
                </Button>
                <Button onClick={handleComplete} disabled={loading} className="flex-1 h-11 font-semibold bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white">
                  {loading ? "Setting up…" : "Complete Setup"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/setup/page.tsx
git commit -m "feat: multi-step onboarding — profile, password, theme"
```

---

### Task 7: Rewrite Admin User Creation API

**Files:**
- Modify: `src/app/api/admin/users/route.ts`
- Modify: `src/lib/validators.ts:73-76`

- [ ] **Step 1: Simplify the validator**

In `src/lib/validators.ts`, replace `adminUserCreateSchema`:

```typescript
export const adminUserCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
});
```

- [ ] **Step 2: Rewrite the admin users API route**

Replace `src/app/api/admin/users/route.ts` entirely:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminUserCreateSchema } from "@/lib/validators";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "password123";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        active: true,
        setupComplete: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users);
  } catch (err) {
    console.error("GET /api/admin/users failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = adminUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name } = parsed.data;

  try {
    // Generate username from first name, handle conflicts
    const firstName = name.trim().split(/\s+/)[0].toLowerCase();
    let username = firstName;
    let suffix = 2;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${firstName}${suffix}`;
      suffix++;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        name: name.trim(),
        role: "user",
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        active: true,
        setupComplete: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/users failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/users/route.ts src/lib/validators.ts
git commit -m "feat: admin creates users with name only + default password"
```

---

### Task 8: Clean Up Admin User Update API

**Files:**
- Modify: `src/app/api/admin/users/[id]/route.ts`

- [ ] **Step 1: Remove resetCode handler and accessCode from selects**

Replace the entire file:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminUserUpdateSchema } from "@/lib/validators";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "password123";

const userSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  active: true,
  setupComplete: true,
  createdAt: true,
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await request.json();

    // Handle password reset — sets back to default and forces re-onboarding
    if (body.resetPassword) {
      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      const firstName = (await prisma.user.findUnique({ where: { id }, select: { name: true } }))
        ?.name.split(/\s+/)[0].toLowerCase() || "user";

      let username = firstName;
      let suffix = 2;
      while (true) {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (!existing || existing.id === id) break;
        username = `${firstName}${suffix}`;
        suffix++;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { passwordHash, setupComplete: false, username },
        select: userSelect,
      });
      return NextResponse.json(updated);
    }

    const parsed = adminUserUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { name, email, role: newRole } = parsed.data;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(newRole !== undefined && { role: newRole }),
      },
      select: userSelect,
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("PUT /api/admin/users/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    await prisma.user.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/admin/users/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/users/[id]/route.ts
git commit -m "feat: replace resetCode with resetPassword in admin user API"
```

---

### Task 9: Rewrite Admin User Management UI

**Files:**
- Modify: `src/components/admin/user-management.tsx`

- [ ] **Step 1: Rewrite user-management.tsx**

Replace the entire file. Key changes: remove access code column/dialogs, show `setupComplete` status, replace "Generate Code" with "Create User", replace "Reset Code" with "Reset Password":

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  setupComplete: boolean;
  createdAt: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [newName, setNewName] = useState("");
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("user");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) setUsers(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleCreate() {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      const created = await res.json();
      setCreatedUsername(created.username);
      setUsers((prev) => [created, ...prev]);
    }
  }

  function handleCloseCreate() {
    setCreateOpen(false);
    setNewName("");
    setCreatedUsername(null);
  }

  function openEdit(user: User) {
    setEditUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
  }

  async function handleEdit() {
    if (!editUser) return;
    const res = await fetch(`/api/admin/users/${editUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, email: editEmail, role: editRole }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditUser(null);
    }
  }

  async function handleResetPassword(user: User) {
    if (!confirm(`Reset password for ${user.name}? They will need to go through onboarding again.`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: true }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      alert(`Password reset. Tell ${user.name} to log in as "${updated.username}" with password "password123".`);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Are you sure you want to deactivate this user?")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: false } : u)));
    }
  }

  if (loading) return <p className="text-center py-8 text-muted-foreground">Loading users...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Dialog open={createOpen} onOpenChange={(open) => { if (!open) handleCloseCreate(); else setCreateOpen(true); }}>
          <DialogTrigger render={<Button>Create User</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Enter the user&apos;s full name. They&apos;ll log in with a temporary username and default password.
              </DialogDescription>
            </DialogHeader>
            {createdUsername ? (
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">User created successfully. Share these credentials:</p>
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <p className="text-sm"><span className="text-muted-foreground">Username:</span> <strong className="font-mono">{createdUsername}</strong></p>
                  <p className="text-sm"><span className="text-muted-foreground">Password:</span> <strong className="font-mono">password123</strong></p>
                </div>
                <p className="text-xs text-muted-foreground">They&apos;ll be prompted to set up their profile on first login.</p>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="user-create-name">Full Name</Label>
                  <Input id="user-create-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Jane Smith" />
                </div>
              </div>
            )}
            <DialogFooter>
              {createdUsername ? (
                <Button onClick={handleCloseCreate}>Done</Button>
              ) : (
                <Button onClick={handleCreate} disabled={!newName.trim()}>Create User</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className={!user.active ? "opacity-50" : ""}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell className="font-mono text-sm">{user.username}</TableCell>
              <TableCell>{user.email || "-"}</TableCell>
              <TableCell>
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
              </TableCell>
              <TableCell>
                {!user.active ? (
                  <Badge variant="outline">Inactive</Badge>
                ) : !user.setupComplete ? (
                  <Badge variant="secondary">Pending Setup</Badge>
                ) : (
                  <Badge variant="default">Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(user)}>Edit</Button>
                {user.active && (
                  <Button variant="outline" size="sm" onClick={() => handleResetPassword(user)}>Reset Password</Button>
                )}
                {user.active && (
                  <Button variant="outline" size="sm" onClick={() => handleDeactivate(user.id)}>Deactivate</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Edit dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-edit-name">Name</Label>
              <Input id="user-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-edit-email">Email</Label>
              <Input id="user-edit-email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-edit-role">Role</Label>
              <Select value={editRole || null} onValueChange={(v) => setEditRole(v ?? "user")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/user-management.tsx
git commit -m "feat: admin UI — create user by name, reset password, show setup status"
```

---

### Task 10: Update Seed File

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Remove access code generation from seed**

Replace lines 5, 10-12, 16, 26, 29-31 in seed.ts. The new admin creation block:

```typescript
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("admin", 10);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: { role: "admin" },
    create: {
      username: "admin",
      passwordHash,
      name: "Administrator",
      role: "admin",
      setupComplete: true,
    },
  });
```

Remove the `import crypto` line and `generateAccessCode` function. Remove the `accessCode` field from the create block. Remove the `if (admin.accessCode)` console.log block. Keep all remaining seed data (staff, categories, quick picks) unchanged.

- [ ] **Step 2: Commit**

```bash
git add prisma/seed.ts
git commit -m "fix: remove access code from seed, set admin setupComplete"
```

---

### Task 11: Build & Test

- [ ] **Step 1: Run the build**

Run: `npm run build`
Expected: Clean build with no type errors

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass (some tests referencing old fields may need updating)

- [ ] **Step 3: Fix any test failures**

If tests reference `accessCode`, `needsSetup`, or the old auth flow, update them to match the new schema.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: fix tests for new account system"
```
