
# Wiki Comments & Activity Events – Architecture & Implementation Spec

## Purpose

This document defines the architecture, UX, backend data model, and implementation guidance for:
- **Comments** on Wiki and other assets
- A global **Activity / Events system** used for in-app notifications
- A scalable foundation for a future **Review workflow**

Constraints:
- Next.js web application
- MongoDB only (no Kafka, no message bus, no schedulers)
- ~1000 internal users
- Cost-sensitive MVP

---

## 1. Design Principles

1. **Events-first, domain-second**
   - All meaningful actions emit immutable events.
   - Domain data (comments, reviews, documents) lives in its own collections.
2. **Append-only event log**
   - Events are immutable and optimized for feeds and notifications.
3. **No background workers**
   - All notifications are in-app and computed on read.
4. **Future-proof for Reviews**
   - Comments, events, and schemas must support formal reviews later.

---

## 2. Feature Overview

### 2.1 Comments (v1)

- Users can comment on any resource (Wiki article, diagram, dataset, etc.).
- Comments are organized as **threads**.
- Threads contain **messages**.
- Threads can be **resolved / unresolved**.
- Comments are shown in a **right-side panel**, not a separate page.
- Comments emit events.

### 2.2 Activities / Notifications (v1)

- All system events are recorded in a global `events` collection.
- Users can view all events via an **Activities** screen.
- Users see unread counts based on last-seen timestamps.
- No email/SMS/Teams notifications in v1.

### 2.3 Reviews (future)

- Reviews group comment threads.
- Reviews assign reviewers, track status, and collect artifacts.
- Reviews rely on comments + events, no redesign needed later.

---

## 3. UX Architecture

### 3.1 Entry Points

- Sticky header contains a **Comments** button with unread count badge.
- Clicking opens a **right-side drawer** showing comment threads.
- Top navigation contains **Activities** menu item.

### 3.2 Comments Panel

- Header:
  - Search
  - Filters (Author, Status, Mentions, Date)
- Body:
  - Thread list (open/resolved)
- Thread view:
  - Message list (chat-like)
  - Resolve / reopen
- Composer:
  - Markdown input
  - @mentions
  - Attachments (future)

### 3.3 Activities Screen

- Chronological feed of events.
- Filters:
  - Time range
  - Event type
  - Resource
  - Actor
- Clicking event navigates to resource or comment thread.

---

## 4. Data Model (MongoDB)

### 4.1 comment_threads

```ts
{
  _id,
  resource: { type: string, id: string },
  anchor?: { kind: string, data: object },
  status: 'open' | 'resolved',
  createdBy,
  createdAt,
  lastActivityAt,
  messageCount,
  participants: [userId],
  reviewId?: string
}
```

Indexes:
- `{ "resource.type": 1, "resource.id": 1, lastActivityAt: -1 }`
- `{ reviewId: 1, status: 1 }`

---

### 4.2 comment_messages

```ts
{
  _id,
  threadId,
  authorId,
  body,
  createdAt,
  editedAt?,
  deletedAt?,
  mentions: [userId],
  attachments?: []
}
```

Indexes:
- `{ threadId: 1, createdAt: 1 }`
- Full-text index on `body`

---

### 4.3 events

```ts
{
  _id,
  ts,
  type,
  actor: { id, name },
  resource: { type, id, title? },
  context?: { bundleId?, appId?, docType? },
  payload?: object,
  visibility?: { scope, teamIds? },
  correlationId?
}
```

Indexes:
- `{ ts: -1 }`
- `{ type: 1, ts: -1 }`
- `{ "actor.id": 1, ts: -1 }`
- `{ "resource.type": 1, "resource.id": 1, ts: -1 }`

TTL:
- 30–90 days recommended.

---

### 4.4 user_event_state

```ts
{
  userId,
  lastSeenAt
}
```

---

### 4.5 user_subscriptions (optional)

```ts
{
  userId,
  subscriptions: [
    { kind: 'eventType' | 'bundle' | 'resource', value }
  ]
}
```

---

## 5. Event Taxonomy

Naming:
`<module>.<entity>.<verb>`

Examples:
- `wiki.article.published`
- `comments.thread.created`
- `comments.message.created`
- `comments.thread.resolved`
- `review.started`
- `review.approved`

---

## 6. API Endpoints

- `GET /api/resources/:type/:id/comment-threads`
- `POST /api/resources/:type/:id/comment-threads`
- `POST /api/comment-threads/:threadId/messages`
- `PATCH /api/comment-threads/:threadId`
- `GET /api/events`
- `GET /api/events/unread-count`

---

## 7. Implementation Notes

- Use a shared `emitEvent()` helper.
- Events are immutable.
- Paginate by timestamp + id.
- Drawer loads comments lazily.

---

## Summary

- Events are global and immutable.
- Comments are domain data in their own collections.
- This design scales without Kafka and enables Reviews later.
