# Codex instructions: Admin bootstrap via ADMIN_BOOTSTRAP_EMAILS
Goal
Implement admin bootstrap using an environment variable ADMIN_BOOTSTRAP_EMAILS so that:
  - The system can start with an empty users collection.
  - When a user provisions an account, if their email is listed in ADMIN_BOOTSTRAP_EMAILS, they automatically become an admin.
  - Admin access is granted via membership in an admins collection, not via a boolean on the user record.

## 1) Environment variable
Add env var:
  - ADMIN_BOOTSTRAP_EMAILS = comma-separated list of emails
    - Example: "alice@corp.com,bob@corp.com"

Parsing rules:
  - Split on commas
  - Trim whitespace
  - Lowercase normalization
  - Ignore empty strings

Implement helper:
  - getAdminBootstrapEmails(): Set<string>

## 2) Data model
users collection (existing)
Requirements:
  - email must be unique, stored normalized (lowercase)
  - Prevent provisioning if email already exists

Add/confirm unique index:
  - { email: 1 } unique

admins collection (new)
Schema:
{
  _id,
  userId: string,
  createdAt: Date,
  createdBy: string | 'system'   // for bootstrap
}

Indexes:
{ userId: 1 } unique

Helper functions in db layer:
  - isAdmin(userId): boolean
  - upsertAdmin(userId, createdBy='system')
  - removeAdmin(userId) (admin-only route later)

## 3) Provisioning flow (account creation)
Endpoint

Wherever account creation happens (e.g., /api/auth/register or /api/users), apply this logic:

On POST Create User

  - Normalize email to lowercase.
  - Check if a user exists with that email:
    - If yes: return 409 Conflict (“Account already exists”).
  - Create the user record.
  - After successful insert, check:
    - if normalized email ∈ ADMIN_BOOTSTRAP_EMAILS
    - then upsert into admins collection:
      - { userId, createdAt: now, createdBy: 'system' }
  - Return created user + isAdmin boolean (optional) so UI can adjust.

Important:

  - Step 3 and 4 should be done atomically if possible.
    - If you don’t have transactions, do:
      - create user
      - then upsert admin
      - both operations are idempotent due to unique constraints

## 4) Login flow safety net (optional but recommended)
Even if you bootstrap during provisioning, add a second safeguard:

On successful login / session creation

  - If user email ∈ ADMIN_BOOTSTRAP_EMAILS, ensure they are in admins collection (upsert).
  - This makes the system robust if:
    - admins collection was wiped
    - user was imported
    - admin membership was accidentally removed

This should be idempotent and cheap.

## 5) Authorization usage
Admin-gated endpoints/UI should call:
  - isAdmin(userId) (admins collection membership)

Do not gate on team or role.

## 6) Security / operational notes
  - Do NOT log the full ADMIN_BOOTSTRAP_EMAILS list (or only log count).
  - Normalize emails consistently everywhere.
  - Ensure provisioning and login both call the same bootstrap helper.

**Copy/paste to Codex (verbatim)**

Implement admin bootstrap using env var ADMIN_BOOTSTRAP_EMAILS (comma-separated emails). Normalize emails to lowercase.
Data model:
Ensure users.email has a unique index (email stored normalized).
Add new admins collection with { userId, createdAt, createdBy } and unique index on userId.
Provisioning flow (account creation endpoint):
Normalize email and reject with 409 if it already exists in users.
Create user.
If email ∈ ADMIN_BOOTSTRAP_EMAILS, upsert { userId, createdAt: now, createdBy: 'system' } into admins.
Return created user (optionally include isAdmin flag).
Add a safety net on login/session creation:
After successful login, if user email ∈ ADMIN_BOOTSTRAP_EMAILS, upsert into admins as well (idempotent).
All admin gating must use isAdmin(userId) (admins collection), not a boolean on user or role/team.

Alo implement the follwing tasks:
1. Add admins management UI (seed + revoke) in Admin.
2. Add light display of bundle assignments on bundle pages.
3. Wire reviewer auto‑assignment for review cycles (spec item #4).