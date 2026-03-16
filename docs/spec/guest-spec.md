Guest Account Feature Specification
===================================

Overview
--------

This specification describes adding a new **Guest Account Type** to the system. Guest accounts are real authenticated users with limited privileges. They are **not** anonymous users; they must register and log in like regular users. Guest accounts have expanded read access and can create comments, but cannot modify any other product data or access admin or configuration surfaces.

This file defines:

-   Product goals

-   Auth and data models

-   Permission and role semantics

-   API and UI changes

-   Security considerations

-   Testing and acceptance criteria

* * * * *

Table of Contents
-----------------

1.  Product Definition

2.  Domain Concepts and Data Models

    -   User Identity Changes

    -   Access Profile

    -   Principal Representation

3.  Authorization Model

    -   Policy Helpers

    -   Permissions for Guest Role

4.  API Requirements

    -   Registration and Login

    -   Protected API Behavior

5.  UI Changes

    -   Login/Registration

    -   Navigation and Access

    -   Disabled/Hidden UI Controls

6.  Security Considerations

7.  Testing and Acceptance Criteria

8.  Schema and Interfaces

    -   TypeScript Interfaces

    -   Policy Helper Signatures

* * * * *

1. Product Definition
---------------------

**Guest Account Type** is an authenticated user type with:

-   *Full read access* to most product content

-   Ability to *create comments*

-   No ability to create, edit, delete, or configure product data

-   No access to admin or settings surfaces

-   No ability to perform workflow mutations, review decisions, investigation actions, or AI persistence

-   Full audit attribution for actions (comments)

Guest accounts behave like normal authenticated users except for restricted actions.

* * * * *

2. Domain Concepts and Data Models
----------------------------------

### 2.1 Persisted User Identity

Existing model:

type UserRecord = {\
  userId: string\
  email: string\
  fullName: string\
  team: string | null\
  role: string | null\
}

### 2.2 Add Account Type

Modify `UserRecord`:

type UserRecord = {\
  userId: string\
  email: string\
  fullName: string\
  team: string | null\
  role: string | null\
  accountType: 'STANDARD' | 'GUEST'\
}

-   **STANDARD**: existing full-access user

-   **GUEST**: guest account with limited privileges

If the DB requires non-null `team` and `role`, use safe defaults for GUEST:

team: "External"\
role: "Guest Viewer"

But **accountType** drives authorization solely.

### 2.3 Principal Representation

The principal should represent the logged-in user:

type Principal = {\
  userId: string\
  email: string\
  fullName: string\
  team: string | null\
  role: string | null\
  accountType: 'STANDARD' | 'GUEST'\
  isAuthenticated: true\
}

Separate from any anonymous principal type.

* * * * *

3. Authorization Model
----------------------

Use a **centralized shared auth layer** and **module-specific policy helpers**.

### 3.1 Shared Auth Layer

Place under:

src/shared/auth/\
  principal.ts\
  guards.ts\
  roles.ts

Responsibilities:

-   resolve principal from JWT/session

-   centralize route guards

-   normalize accountType

### 3.2 Authorization Policy Layer

Each module should have a policy file:

src/modules/wiki/domain/policy.ts\
src/modules/work-items/domain/policy.ts\
src/modules/comments/domain/policy.ts

Policy helpers should use `Principal`.

### 3.3 Policy Helper Examples

function canReadWorkItem(principal: Principal, item: WorkItem): boolean\
function canEditWorkItem(principal: Principal, item: WorkItem): boolean\
function canComment(principal: Principal): boolean\
function canAdministerApp(principal: Principal): boolean

### 3.4 Permission Rules for Guest

-   `canRead...` returns **true** for most approved content

-   `canComment(...)` returns **true**

-   `canEdit...` returns **false**

-   `canAdministerApp(...)` returns **false**

-   Any workflow mutation returns **false**

* * * * *

4. API Requirements
-------------------

### 4.1 Guest Registration

Add a **Guest Registration** flow on the login screen.

#### POST /api/auth/register-guest

Request:

{\
  "fullName": "string",\
  "email": "string",\
  "password": "string"\
}

Response:

-   201 Created: principal and JWT

-   400 validation errors

-   409 if email exists

Server actions:

-   create user with accountType = 'GUEST'

-   assign safe defaults for team/role if required

-   validate email uniqueness

-   enforce password policy

### 4.2 Login

Existing login API works for guest accounts too.

* * * * *

5. UI Changes
-------------

### 5.1 Authentication UI

On login screen:

[ Login ]\
[ Create Account ]\
[ Register Guest Account ]

When selecting **Register Guest Account**:

-   show form with:

    -   Full Name

    -   Email

    -   Password

    -   Confirm Password

    -   Register button

### 5.2 Navigation and Access

After login:

-   guest users should see:

    -   Dashboard

    -   Work Items (read-only)

    -   Wiki (read-only)

    -   Applications (read-only)

    -   Comments (able to add)

-   hide or disable:

    -   create/edit buttons for non-comments

    -   admin/settings navigation

    -   mutation-related views

### 5.3 Disabled Controls

In UI modules:

-   disable buttons like **Create**, **Edit**, **Delete**

-   if guest is allowed to comment, keep **Add Comment** enabled

-   show a tooltip or message like:

    > "This action is not permitted for guest accounts."

* * * * *

6. Security Considerations
--------------------------

Guest accounts are authenticated. Their identity must be real and auditable.

Do not elevate them in any authorization path, particularly:

-   no access to admin APIs

-   no configuration APIs

-   no mutation endpoints except comment creation

-   rates and abuse control for comment creation

-   no exposure of sensitive operational data

* * * * *

7. Testing and Acceptance Criteria
----------------------------------

### 7.1 Unit Tests

-   Guest registration success

-   Guest login success

-   Principal resolves correctly

-   Policy helpers enforce restrictions

### 7.2 API Tests

-   Guest cannot access mutation APIs

-   Guest can comment

-   Guest read access consistent

-   STANDARD user unaffected

### 7.3 UI Tests

-   Guest navigation is correct

-   Disabled controls show restrictions

-   Comment creation works for guest

* * * * *

8. Schema and Interfaces
------------------------

### 8.1 TypeScript: UserRecord

type UserRecord = {\
  userId: string\
  email: string\
  fullName: string\
  team: string | null\
  role: string | null\
  accountType: 'STANDARD' | 'GUEST'\
}

### 8.2 Principal

type Principal = {\
  userId: string\
  email: string\
  fullName: string\
  team: string | null\
  role: string | null\
  accountType: 'STANDARD' | 'GUEST'\
  isAuthenticated: true\
}

### 8.3 Policy Helper Signatures

function canReadWorkItem(principal: Principal, item: WorkItem): boolean\
function canEditWorkItem(principal: Principal, item: WorkItem): boolean\
function canComment(principal: Principal): boolean\
function canAdministerApp(principal: Principal): boolean

* * * * *

Deliverables for Codex
======================

Use this spec to:

1.  Add `accountType` to user schema

2.  Implement guest registration endpoint

3.  Centralize auth resolution

4.  Add policy helpers

5.  Enforce guest permissions

6.  Update UI flows and disable forbidden actions

7.  Add tests

* * * * *

Acceptance Checklist
====================

✔ Guest registers successfully\
✔ Guest login works\
✔ Guest read access allowed\
✔ Guest comment creation allowed\
✔ Guest mutation actions blocked\
✔ UI shows disabled actions appropriately\
✔ Tests cover all scenarios