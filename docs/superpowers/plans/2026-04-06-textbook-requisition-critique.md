# Textbook Requisition Plan Critique

## Clarified Product Intent

This critique assumes the intended access model is:

- Public-facing textbook requisition submission form for faculty
- Authenticated internal textbook requisition panel for all LAPortal users
- All authenticated LAPortal users can view, create, edit, status-change, notify, and delete textbook requisitions
- Internal LAPortal users can see the full requisition information associated with submissions

This means the requisition panel is not an admin-only tool. It is a shared internal operations panel.

## Executive Summary

The current plan is directionally solid, but it should not be implemented as written.

The main issues are:

- The plan’s language still describes an admin-only feature even though the intended product is a shared internal panel
- The route and permission model are internally inconsistent
- The public submission endpoint lacks abuse protection
- The notification workflow bypasses existing service/helper patterns in the repo
- The schema does not provide enough auditability for a workflow feature
- Some API and UI contracts are underspecified or internally inconsistent

## Findings

### 1. The plan describes the wrong product boundary

The document repeatedly calls this an admin panel or admin view, but the intended product is:

- a public submission surface
- an internal authenticated management panel available to all LAPortal users

This is not just wording. It influences route design, component naming, and access assumptions.

Relevant references:

- [2026-04-06-textbook-requisition.md:5](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:5)
- [2026-04-06-textbook-requisition.md:7](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:7)
- [2026-04-06-textbook-requisition.md:39](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:39)
- [2026-04-06-textbook-requisition.md:2053](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:2053)

### 2. The permission model is internally inconsistent

Given the intended product, all authenticated users should be able to:

- list requisitions
- view requisitions
- create internal requisitions
- edit requisitions
- change status
- send notifications
- delete requisitions

The current plan does not reflect that consistently:

- collection `POST` effectively allows any authenticated user
- item `PUT`, `PATCH`, `DELETE`, and notify are still modeled as admin-only

Relevant references:

- [2026-04-06-textbook-requisition.md:1514](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1514)
- [2026-04-06-textbook-requisition.md:1575](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1575)
- [2026-04-06-textbook-requisition.md:1594](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1594)
- [2026-04-06-textbook-requisition.md:1610](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1610)
- [2026-04-06-textbook-requisition.md:1633](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1633)

### 3. Public submit still has no abuse protection

The public-facing faculty form is unauthenticated. The plan claims rate limiting replaces CAPTCHA, but it never actually adds rate limiting to the public endpoint.

That is a real operational gap.

Relevant references:

- [2026-04-06-textbook-requisition.md:1509](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1509)
- [2026-04-06-textbook-requisition.md:2309](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:2309)

Existing repo pattern:

- [chat route](/Users/montalvo/lapc-invoice-maker/src/app/api/chat/route.ts:1)

### 4. Public and internal concerns are overloaded into one route

The plan uses one mixed route for both:

- public faculty submission
- authenticated internal CRUD

That can work, but it is harder to reason about, requires a broader middleware exception, and increases the chance of future auth mistakes.

Relevant references:

- [2026-04-06-textbook-requisition.md:1442](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1442)
- [2026-04-06-textbook-requisition.md:1458](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1458)

Current middleware complexity:

- [middleware.ts](/Users/montalvo/lapc-invoice-maker/src/middleware.ts:1)

### 5. Email handling breaks the repo’s architectural pattern

The plan says the service layer owns business logic, realtime, and email behavior. But the notification route directly:

- reads the webhook env var
- builds the body
- `fetch()`es the Power Automate webhook
- updates status inline

That bypasses the shared email helper and duplicates transport logic.

Relevant references:

- [2026-04-06-textbook-requisition.md:24](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:24)
- [2026-04-06-textbook-requisition.md:1623](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1623)

Existing repo helpers/patterns:

- [email.ts](/Users/montalvo/lapc-invoice-maker/src/lib/email.ts:1)
- [email send route](/Users/montalvo/lapc-invoice-maker/src/app/api/email/send/route.ts:49)

### 6. The schema is under-audited for a workflow feature

The requisition schema currently lacks important workflow metadata:

- who created an internal requisition
- who changed status
- when status last changed
- whether ordered or on-shelf notifications were sent
- who sent those notifications
- whether a notification was retried or failed

Without auditability, status/email actions will become hard to reason about operationally.

Relevant references:

- [2026-04-06-textbook-requisition.md:102](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:102)
- [2026-04-06-textbook-requisition.md:1679](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1679)

### 7. Some contracts are underspecified or misleading

Several data contracts need tightening:

- `needsAttention` exists but is hard-coded to `0`
- public submit returns the full requisition DTO instead of a narrow acknowledgment
- export currently drops book-level data
- export duplicates CSV escaping logic that already exists in the repo

Relevant references:

- [2026-04-06-textbook-requisition.md:302](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:302)
- [2026-04-06-textbook-requisition.md:1171](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1171)
- [2026-04-06-textbook-requisition.md:1267](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1267)
- [2026-04-06-textbook-requisition.md:1544](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1544)
- [2026-04-06-textbook-requisition.md:1690](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:1690)

Existing CSV helper:

- [csv.ts](/Users/montalvo/lapc-invoice-maker/src/lib/csv.ts:1)

### 8. The plan has internal implementation inconsistencies

The document references components or workflows that do not line up with the earlier tasks:

- `RequisitionEditView` and `RequisitionCreateView` are referenced later but not actually defined in the component plan
- some imports imply one UI approach but the examples use another
- skill references in the plan do not match the skills available in this session

Relevant references:

- [2026-04-06-textbook-requisition.md:2034](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:2034)
- [2026-04-06-textbook-requisition.md:2121](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:2121)
- [2026-04-06-textbook-requisition.md:2151](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:2151)
- [2026-04-06-textbook-requisition.md:2269](/Users/montalvo/lapc-invoice-maker/docs/superpowers/plans/2026-04-06-textbook-requisition.md:2269)

## Changes I Would Make To The Plan

### 1. Rewrite the feature framing

I would replace language like:

- admin panel
- admin views
- admin create

with language like:

- public faculty submission form
- authenticated requisition panel
- internal staff panel
- all LAPortal users

The plan should reflect the actual product model from the top of the document onward.

### 2. State the access model explicitly near the top

I would add a short access section near the goal/architecture section:

- Public: faculty can submit a requisition without authentication
- Authenticated LAPortal users: can view, create, edit, status-change, notify, and delete requisitions
- Requisition records are shared internal operational data, not admin-only data

This should be written once clearly so the route and component tasks do not drift.

### 3. Remove `withAdmin` from requisition routes

Given the intended behavior, the requisition routes should consistently use authenticated-user access for internal operations.

That means the plan should remove admin-role checks from:

- item update
- item patch/status update
- item delete
- notify route

and use the authenticated-user pattern consistently.

### 4. Split public submission from internal CRUD

I would revise the route layout from one mixed route to something like:

- `POST /api/textbook-requisitions/submit` for public faculty submission
- `GET /api/textbook-requisitions` for internal authenticated listing
- `POST /api/textbook-requisitions` for internal authenticated creation
- `GET/PUT/PATCH/DELETE /api/textbook-requisitions/[id]` for internal authenticated operations

This is cleaner, safer, and easier to maintain.

### 5. Narrow the middleware exception

Instead of exempting the entire requisitions API subtree, I would exempt only the truly public surfaces:

- `/textbook-requisitions/submit`
- `/api/textbook-requisitions/submit`

This reduces the chance of future accidental exposure.

### 6. Add rate limiting to public submit

I would explicitly add a task for:

- IP-based or request-fingerprint-based rate limiting
- `429 Too Many Requests` behavior
- optional honeypot field as lightweight bot friction

The repo already has a DB-backed rate limiter pattern. The plan should call for reusing it.

### 7. Move notification behavior into the service layer

The notification route should be a thin dispatcher.

The service should own:

- loading the requisition
- validating allowable notification type and state transition
- building the email subject/body
- calling `sendEmail()`
- updating status
- storing notification audit fields
- broadcasting realtime changes

This keeps transport logic consistent with the rest of the repo.

### 8. Add audit fields or a notification history table

At minimum, I would change the schema plan to include:

- `createdBy String?`
- `lastStatusChangedAt DateTime?`
- `lastStatusChangedBy String?`
- `orderedNotifiedAt DateTime?`
- `orderedNotifiedBy String?`
- `onShelfNotifiedAt DateTime?`
- `onShelfNotifiedBy String?`

Preferred alternative:

- add a `RequisitionNotification` table with notification type, recipient, success/failure, sentAt, sentBy, and payload metadata

If there is any chance this workflow matters operationally, the audit story should exist from day one.

### 9. Reconsider the field name `internalNotes`

If all authenticated LAPortal users can see and edit the field, then `internalNotes` may be misleading.

I would consider renaming it in the plan to something like:

- `staffNotes`
- `bookstoreNotes`
- `processingNotes`

If the team still wants `internalNotes`, the plan should define “internal” as “visible to any authenticated LAPortal user.”

### 10. Narrow the public submit response

I would not have the public submit endpoint return the full internal requisition DTO.

I would instead return a smaller acknowledgment payload, for example:

- `id`
- `submittedAt`
- `department`
- `course`
- `term`
- `reqYear`

This is cleaner and avoids exposing internal-only response shape to the public route by default.

### 11. Fix `needsAttention`

The plan currently defines and displays `needsAttention`, but the service returns `0` as a placeholder.

I would do one of two things:

- implement `needsAttention` properly server-side in stats, or
- remove it from the type/UI until it is real

The current version is not a stable contract.

### 12. Clarify the CSV export model

The plan needs to decide whether export is:

- one row per requisition, with book data flattened into summary columns
- or one row per book, with requisition metadata repeated

Right now it exports only requisition-level fields and omits the most important textbook detail.

I would also revise the plan to reuse the existing CSV utility rather than reimplement escaping locally.

### 13. Align route implementation with repo patterns

I would revise the plan to better match existing route conventions in the repo:

- use authenticated route wrappers consistently
- use no-store response behavior where appropriate for collection routes
- use Zod validation for patch payloads
- map errors explicitly for not-found, invalid-input, and transport failures

### 14. Fix the component/page contract in the plan

If the document wants a shared form component, then the page tasks should reference that shared component or clearly define wrapper views.

As written, the later page tasks reference `RequisitionEditView` and `RequisitionCreateView` without those being properly planned earlier.

I would either:

- keep only one shared form component and wire it directly in page tasks, or
- explicitly add wrapper view components to the file structure and tasks

### 15. Remove or replace invalid skill references

The plan currently references skills or workflows that are not valid in this session.

I would remove those references from the implementation plan or replace them with repo-available workflows if that is required by your agent process.

## What I Would Keep

I would keep the overall direction of:

- a dedicated requisition domain module
- separate requisition and requisition-book models
- public faculty submission
- internal authenticated management panel
- realtime refresh behavior
- status workflow
- email notification support
- export support

Those are all reasonable and fit the repo’s architecture.

## Recommended Revised Access Model

To make the plan unambiguous, I would recommend it explicitly say:

### Public

- Faculty can access `/textbook-requisitions/submit`
- Faculty can submit a requisition without LAPortal authentication
- Public submission is rate-limited

### Internal Authenticated Users

- Any authenticated LAPortal user can access the requisition panel
- Any authenticated LAPortal user can view the full requisition details
- Any authenticated LAPortal user can create, edit, delete, change status, and send instructor notification emails

### Data Visibility

- Requisition records are shared internal workflow records
- Full requisition details are visible to authenticated LAPortal users

## Bottom Line

The plan should be revised before implementation.

The main changes I would make are:

1. rewrite the feature framing so it matches the actual product
2. make the auth policy explicit and consistent
3. split public submit from internal CRUD
4. add public-submit rate limiting
5. move email workflow into the service layer
6. add auditability for status and notification actions
7. tighten the API/export/response contracts
8. clean up the plan’s own internal inconsistencies

With those changes, the plan would be substantially stronger and better aligned with the product intent you clarified.
