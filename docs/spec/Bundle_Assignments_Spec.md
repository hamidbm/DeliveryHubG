# Bundle Assignment Mapping – Design + Implementation Spec (for Codex)

## Purpose

Introduce a **bundle-to-user assignment** model that supports:
- Auto-assigning reviewers for review cycles
- Scoping “My Inbox” / “Reviews assigned to me”
- Governing visibility and responsibility for bundles across **CMO**, **Engineering**, and **SVP**
- Future-proofing (auditable, time-bounded, role-based)

This spec replaces any design that stores bundle responsibility only as `users.bundles[]`.

---

## Key Requirements

1. **Many-to-many mapping** between users and bundles (a user can be linked to many bundles; a bundle can have many users).
2. **Role-scoped assignments** (CMO reviewer vs assigned CMO vs engineering owner vs SVP, etc.).
3. **Auditability & flexibility**
   - Support active/inactive assignments
   - Optional start/end dates
4. **Centralized creation & management**
   - Admin-managed baseline assignments
   - Limited self-service where appropriate (optional)

---

## Assignment Types (Canonical)

Implement `assignmentType` with the following allowed values:

- `cmo_reviewer`
  - A CMO member who can review a bundle due to expertise (e.g., Security) but is **not** the primary assigned CMO for that bundle.
- `assigned_cmo`
  - The CMO member(s) specifically assigned to that bundle for primary oversight.
- `bundle_owner`
  - Engineering team member who owns the bundle.
- `svp`
  - SVP member assigned to implement/migrate products in the bundle.
- `observer`
  - Read/visibility-only association; should not trigger reviewer assignment.

> Note: These assignment types are *orthogonal* to a user’s `team` and `role`.  
> Example: A user may have `team = "CMO"` and `role = "EA Leader"`, and still have different assignment types across bundles.

---

## Data Model (MongoDB)

### New collection: `bundle_assignments`

```ts
type AssignmentType =
  | 'cmo_reviewer'
  | 'assigned_cmo'
  | 'bundle_owner'
  | 'svp'
  | 'observer';

type BundleAssignment = {
  _id: ObjectId;

  bundleId: string;          // canonical bundle identifier (same as used elsewhere in app)
  userId: string;            // canonical user id

  assignmentType: AssignmentType;

  active: boolean;           // true = current; false = historical/removed

  // optional governance/audit
  isPrimary?: boolean;       // only meaningful for 'assigned_cmo' and optionally 'bundle_owner'
  startAt?: Date;            // optional (can be in the past)
  endAt?: Date;              // optional
  createdAt: Date;
  updatedAt: Date;

  createdBy?: string;        // userId of admin/system
  notes?: string;
};
```

### Indexes (Required)

1. Fast lookups by bundle:
```js
{ bundleId: 1, active: 1, assignmentType: 1 }
```

2. Fast lookups by user:
```js
{ userId: 1, active: 1, assignmentType: 1 }
```

3. Uniqueness constraint (avoid duplicates for active rows):
- Option A (recommended): unique on `(bundleId, userId, assignmentType)` and treat updates as upserts
- Option B: unique on `(bundleId, userId, assignmentType, active)` if you want parallel inactive history rows

**Recommended**:
```js
unique: { bundleId: 1, userId: 1, assignmentType: 1 }
```
…and store history by toggling `active=false` and updating timestamps (or keep a separate history log later).

---

## Authorization & Who Can Manage Mappings

### Admin-managed baseline (Required)

Add an **Admin UI** to manage `bundle_assignments` because:
- These mappings affect review routing and accountability
- They should not be casually edited by every user
- CMO assignments in particular require governance

**Admin UI placement**
- Add an “Admin” module section: **Admin → Bundle Assignments**
- Only users with admin privileges may access it (use existing admin mechanism).

### Optional self-service (Optional, recommended limited scope)

If you want users to declare themselves, constrain it to safe operations:

**Allowed self-service actions**
- Users may add/remove themselves as:
  - `observer` (subscribe to a bundle’s activity/reviews)
  - (optional) `cmo_reviewer` if `team === "CMO"` (still subject to admin approval if desired)
- Users **cannot** self-assign:
  - `assigned_cmo`
  - `bundle_owner`
  - `svp`

**Self-service UI placement**
- User Profile → “My Bundles”
  - “Following” bundles (observer)
  - “Reviewer expertise” bundles (cmo_reviewer, CMO-only)

If approval workflow is desired:
- Store a request record or mark assignment `pending=true` until admin approves.
If keeping MVP simple:
- **Skip self-service** and manage all mappings via Admin UI.

---

## Integration Points (How the app uses these mappings)

### 1) Review auto-assignment (Critical)

When a review cycle is created for a resource with `bundleId`:

- Primary reviewers (default):
  - All `bundle_assignments` with:
    - `bundleId == resource.bundleId`
    - `active == true`
    - `assignmentType == 'assigned_cmo'`
- Secondary reviewers (optional):
  - Add `cmo_reviewer` if configured

Do NOT auto-assign `observer`, `svp`, or `bundle_owner` as reviewers.

### 2) Review “My Inbox” computation

A review appears in “My Inbox” if:
- user is explicitly listed as a reviewer on the cycle, OR
- user has an active `assigned_cmo` mapping for the bundle

### 3) Activities filtering / relevance (Future)

- `observer` can influence what a user sees as “interesting”
- Not required for initial implementation

---

## API Design (Minimal)

### Admin endpoints (protected)

- `GET /api/admin/bundle-assignments?bundleId=&userId=&type=`
- `POST /api/admin/bundle-assignments` (create/upsert)
- `PATCH /api/admin/bundle-assignments/:id` (activate/deactivate, change fields)
- Prefer `active=false` over hard delete

### Optional self-service endpoints (if implemented)

- `GET /api/me/bundles`
- `POST /api/me/bundles` (observer)
- `DELETE /api/me/bundles/:bundleId` (observer)

---

## UI Requirements

### Admin → Bundle Assignments

- Filters: Bundle, User, Assignment Type, Active
- Table columns:
  - Bundle
  - User (displayName, email)
  - Type
  - Active
  - Primary
  - Start/End
  - UpdatedAt
- Actions:
  - Add assignment
  - Toggle active
  - Mark primary (for assigned_cmo / bundle_owner)

### User Profile → My Bundles (Optional)

- “Following bundles” (observer)
- (CMO only) “Reviewer expertise bundles” (cmo_reviewer)
- If approval workflow exists: show pending requests

---

## Implementation Notes (Important)

1. Centralize constants:
   - `ASSIGNMENT_TYPES` list
   - Role/team helpers (Engineering vs SVP vs CMO) already exist or should exist

2. Avoid `users.bundles[]` as canonical storage.
   - If later adding `users.bundleIds[]`, treat it as a **cache** derived from `bundle_assignments`.

3. Always enforce permissions server-side for admin endpoints.

---

## What Codex Should Implement Next (Clear Checklist)

1. Create `bundle_assignments` collection + indexes.
2. Implement admin-only CRUD endpoints for bundle assignments.
3. Build Admin UI screen: Admin → Bundle Assignments.
4. Update review auto-assignment logic to use `assigned_cmo` mappings.
5. (Optional) Add user self-service for `observer` (and optionally CMO-only `cmo_reviewer`) in Profile → My Bundles.

---

## Summary

- Use a dedicated `bundle_assignments` collection.
- Support assignment types: `cmo_reviewer`, `assigned_cmo`, `bundle_owner`, `svp`, `observer`.
- Admin manages authoritative mappings; optional limited self-service for observers.
- Use mappings for reviewer auto-assignment and reviewer inbox.

This spec is authoritative for implementing bundle responsibility mappings.
