# First-Login Access Code Change & Onboarding Tour

**Date:** 2026-03-27
**Goal:** New users set their own access code on first login, then get a spotlight tooltip tour explaining the app's features.

## Feature 1: First-Login Access Code Change

### Flow

1. Admin creates user → system generates a temporary 6-digit access code, sets `needsSetup: true`
2. Admin gives the temp code to the user (copy button in admin UI)
3. User logs in with the temp code
4. Instead of the dashboard, they see a "Set Your Access Code" screen
5. User enters their own 6-digit code (with confirmation field)
6. Code is saved, `needsSetup` set to `false`
7. Onboarding tour starts on the dashboard

### Data Model

Add to the User model:

```prisma
needsSetup Boolean @default(true) @map("needs_setup")
```

New users default to `needsSetup: true`. After setting their access code, it becomes `false`.

### Set Access Code Page

Route: `/setup` (or intercept in middleware/layout)

- Centered card (like the login page)
- Title: "Set Your Access Code"
- Description: "Choose a 6-digit code you'll use to log in"
- Two fields: "New Access Code" (6-digit, masked) and "Confirm Access Code"
- Validation: must be 6 digits, must match
- Submit → PATCH `/api/auth/setup` → updates `accessCode` and sets `needsSetup: false`
- On success → redirect to dashboard (onboarding starts)

### Middleware/Redirect

After login, check `needsSetup` from the session/token. If `true`, redirect to `/setup`. The user cannot access any other page until they set their code.

Add `needsSetup` to the JWT token and session callbacks in `auth.ts`.

### Admin: Reset Code

Admin can click "Reset Code" on any user in user management:
- Generates a new random 6-digit access code
- Sets `needsSetup: true`
- Shows the new code to the admin (one-time display)
- Admin never sees the user's self-chosen code after they set it

## Feature 2: Onboarding Tour (Spotlight Tooltips)

### When It Shows

- After first-login access code setup (user lands on dashboard, tour auto-starts)
- When user clicks "Tour" button in the help modal (replay)

### Persistence

`localStorage` key `lapc-onboarding-complete`. Set to `"true"` after completing or skipping the tour. Checked on dashboard mount — if not set and user just came from setup, auto-start.

### Tour Steps (9)

1. **New Invoice** — target: New Invoice button on dashboard. "Click here to start a new invoice. Staff info, account codes, and signatures auto-fill."
2. **New Quote** — target: New Quote button on dashboard. "Create quotes for cost estimates before finalizing an invoice."
3. **Staff Auto-Fill** — no target (feature is on another page). Centered tooltip with icon. "When creating an invoice, select a staff member and their department, contact info, and account numbers fill in automatically."
4. **Quick Picks** — no target. Centered tooltip. "The side panel shows quick-access items. Click any item to instantly add it as a line item."
5. **Line Item Autocomplete** — no target. Centered tooltip. "Start typing a description to search your saved items and quick picks."
6. **Signatures** — no target. Centered tooltip. "Signature approvers are remembered per staff member. They auto-populate based on who you've used before."
7. **Charge at Register** — no target. Centered tooltip. "For register-based transactions, use the Pending POS Charge workflow. The invoice is created without a number, and you add the POS charge number later after the register transaction."
8. **PDF & Email** — no target. Centered tooltip. "Once an invoice is finalized, download the PDF or click Email to open your mail client with the invoice details pre-filled."
9. **Analytics** — target: Analytics nav link. "Track spending trends, category breakdowns, and monthly totals on the Analytics page."

### Overlay Mechanics

- `OnboardingTour` component wraps the dashboard
- Dark backdrop: `fixed inset-0 bg-black/60 z-50`
- For steps with a target element: use `getBoundingClientRect()` to position a spotlight cutout (box-shadow trick: huge box-shadow on a positioned element matching the target's bounds)
- Tooltip: white card positioned near the spotlight, with title, description, step counter ("1 of 9"), Skip and Next buttons
- For steps without a target: centered modal-style tooltip with an icon
- Arrow keys and Enter work for navigation (accessible)
- Escape skips the tour

### Replay

Add a "Take the Tour" button to the existing `HelpModal` component. Clicking it sets `localStorage` key to empty and triggers the tour.

## What Stays the Same

- Access code login works for all users
- Username/password login remains as an alternative auth method
- Admin user creation flow (generates code, just adds needsSetup flag)
- All existing invoice/quote/staff functionality
