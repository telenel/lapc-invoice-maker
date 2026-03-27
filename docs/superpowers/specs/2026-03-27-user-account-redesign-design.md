# User Account System Redesign

## Context

The existing auth system uses a dual-login approach: username/password OR a 6-digit access code. New users go through a `needsSetup` flow where they create their own access code. This is being scrapped in favor of a simpler model: admin creates users with just a name, users log in with a default password, then complete onboarding to set their email (which becomes their username), password, and preferences.

## Database Changes

**User model** -- drop `accessCode` and `needsSetup`, add `setupComplete`:

```prisma
model User {
  id            String   @id @default(uuid())
  username      String   @unique
  passwordHash  String   @map("password_hash")
  name          String
  email         String   @default("")
  role          String   @default("user")
  active        Boolean  @default(true)
  setupComplete Boolean  @default(false) @map("setup_complete")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  // relations...
}
```

**Migration:**
- Drop `access_code` column (and its unique index)
- Drop `needs_setup` column
- Add `setup_complete` boolean, default `false`
- Data migration: `UPDATE users SET setup_complete = NOT needs_setup`

## Admin User Creation

**Flow:** Admin enters full name only -> clicks "Create User"

**Backend logic (`/api/admin/users` POST):**
1. Extract first name, lowercase it -> temp `username` (e.g., "Jane Smith" -> "jane")
2. If username conflicts, append number: `jane`, `jane2`, `jane3`
3. Set `passwordHash` = bcrypt("password123")
4. Set `setupComplete = false`
5. Return created user

**Success dialog:** "User created. Tell them to log in as **jane** with password **password123**"

**Remove from admin UI:**
- "Generate Code" / "Reset Code" buttons
- Access code column in users table
- `generateAccessCode()` function and all uniqueness logic

## Auth & Login

**Login form (`login-form.tsx`):**
- Simple username + password form only
- Remove all `isAccessCode` / 6-digit detection logic
- Always show both fields

**Auth (`auth.ts`):**
- Remove the entire access code login branch (`if (/^\d{6}$/.test(input))`)
- Keep only username/password path
- JWT callback: store `setupComplete` from DB (refreshed on each request)
- Session callback: expose `setupComplete`

**Middleware (`middleware.ts`):**
- If `setupComplete === false` and not on `/setup` -> redirect to `/setup`
- If `setupComplete === true` and on `/setup` -> redirect to `/`

## Onboarding Setup Flow

**New `/setup` page** -- multi-step form replacing the old access code page:

### Step 1: Profile
- Full name (pre-filled, editable)
- Email input with label: "This will become your username for future logins"
- Email validation: valid format, unique in DB

### Step 2: Password
- New password + confirm password
- Minimum 8 characters

### Step 3: Theme
- 3 theme options (Light, Dark, Catppuccin) as visual cards
- Selecting one applies it immediately as a live preview

### Step 4: Complete
- Submit calls `/api/setup` POST
- API updates: `username` = email, `passwordHash` = new hash, `name` = final name, `setupComplete` = true
- Redirects to `/` where existing `OnboardingWrapper` shows the tour

**API (`/api/setup` POST):**
- Auth required (user must be logged in)
- Validates: email unique (excluding self), password >= 8 chars, name non-empty
- Updates user record
- Returns success

## Files to Modify

### Delete:
- `src/app/api/auth/setup/route.ts`

### Rewrite:
- `src/app/setup/page.tsx` -- new multi-step onboarding
- `src/components/admin/user-management.tsx` -- remove access code UI
- `src/app/api/admin/users/route.ts` -- name-only creation with bcrypt default password
- `src/app/api/admin/users/[id]/route.ts` -- remove resetCode handler

### Modify:
- `prisma/schema.prisma` -- drop accessCode/needsSetup, add setupComplete
- `prisma/seed.ts` -- seed admin with password hash, `setupComplete: true`, remove access code generation
- `src/lib/auth.ts` -- remove access code path, swap to setupComplete
- `src/middleware.ts` -- swap needsSetup to setupComplete
- `src/components/login-form.tsx` -- simple username+password only

### Existing users:
Migration sets `setup_complete = NOT needs_setup` so current users who completed the old setup are not forced through again.
