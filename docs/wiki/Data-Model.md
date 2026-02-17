# Data Model

DeliveryHub uses a domain-driven MongoDB schema. Each collection maps to one conceptual domain. This document lists the currently observed collections, their top-level fields, and existing indexes. It also recommends indexes to enforce uniqueness and improve query performance.

## Collections and Fields

### `ai_audit_logs`
Top-level fields:
- `_id`, `createdAt`, `error`, `expiresAt`, `identity`, `latencyMs`, `model`, `provider`, `success`, `targetId`, `targetType`, `task`

Observed indexes:
- `{ _id: 1 }`
- `{ createdAt: -1 }`
- `{ expiresAt: 1 }`

### `ai_rate_limits`
Top-level fields:
- no documents observed in sampling

Observed indexes:
- `{ _id: 1 }`
- `{ identity: 1, windowStart: 1 }` unique
- `{ expiresAt: 1 }`

### `ai_settings`
Top-level fields:
- `_id`, `defaultProvider`, `key`, `providers`

Observed indexes:
- `{ _id: 1 }`

### `applications`
Top-level fields:
- `_id`, `aid`, `bundleId`, `cloudMetadata`, `createdAt`, `createdBy`, `isActive`, `lifecycle`, `name`, `status`, `updatedAt`, `updatedBy`

Observed indexes:
- `{ _id: 1 }`

### `architecture_diagrams`
Top-level fields:
- `_id`, `content`, `createdBy`, `format`, `status`, `title`, `updatedAt`

Observed indexes:
- `{ _id: 1 }`

### `bundles`
Top-level fields:
- `_id`, `createdAt`, `createdBy`, `description`, `isActive`, `key`, `name`, `updatedAt`, `updatedBy`

Observed indexes:
- `{ _id: 1 }`

### `capabilities`
Top-level fields:
- `_id`, `description`, `level`, `name`

Observed indexes:
- `{ _id: 1 }`

### `counters`
Top-level fields:
- `_id`, `seq`

Observed indexes:
- `{ _id: 1 }`

### `interfaces`
Top-level fields:
- `_id`, `dataCriticality`, `sourceAppId`, `status`, `targetAppId`, `type`

Observed indexes:
- `{ _id: 1 }`

### `milestones`
Top-level fields:
- `_id`, `createdAt`, `endDate`, `name`, `startDate`, `status`, `targetCapacity`, `updatedAt`

Observed indexes:
- `{ _id: 1 }`

### `settings`
Top-level fields:
- `_id`, `ai`, `key`

Observed indexes:
- `{ _id: 1 }`

### `sprints`
Top-level fields:
- `_id`, `applicationId`, `bundleId`, `createdAt`, `name`, `status`

Observed indexes:
- `{ _id: 1 }`

### `taxonomy_categories`
Top-level fields:
- `_id`, `createdAt`, `icon`, `isActive`, `key`, `name`, `sortOrder`

Observed indexes:
- `{ _id: 1 }`

### `taxonomy_document_types`
Top-level fields:
- `_id`, `audience`, `categoryId`, `createdAt`, `isActive`, `key`, `lifecyclePhases`, `name`, `requiredMetadata`, `sortOrder`

Observed indexes:
- `{ _id: 1 }`

### `users`
Top-level fields:
- `_id`, `createdAt`, `email`, `name`, `password`, `role`

Observed indexes:
- `{ _id: 1 }`

### `wiki_ai_insights`
Top-level fields:
- `_id`, `content`, `createdAt`, `targetId`, `targetType`, `type`

Observed indexes:
- `{ _id: 1 }`
- `{ targetType: 1, targetId: 1, type: 1, createdAt: -1 }`

### `wiki_asset_ai_history`
Top-level fields:
- `_id`, `assetId`, `createdAt`, `expiresAt`, `model`, `provider`, `result`, `task`, `userEmail`

Observed indexes:
- `{ _id: 1 }`
- `{ assetId: 1, createdAt: -1 }`
- `{ expiresAt: 1 }`
- `{ assetIdStr: 1, createdAt: -1 }`

### `wiki_assets`
Top-level fields:
- `_id`, `applicationId`, `author`, `bundleId`, `createdAt`, `documentTypeId`, `file`, `lastModifiedBy`, `milestoneId`, `preview`, `spaceId`, `status`, `storage`, `themeKey`, `title`, `updatedAt`, `version`

Observed indexes:
- `{ _id: 1 }`

### `wiki_history`
Top-level fields:
- `_id`, `applicationId`, `author`, `bundleId`, `category`, `content`, `createdAt`, `lastModifiedBy`, `pageId`, `readingTime`, `spaceId`, `status`, `title`, `updatedAt`, `version`, `versionedAt`

Observed indexes:
- `{ _id: 1 }`

### `wiki_pages`
Top-level fields:
- `_id`, `applicationId`, `author`, `bundleId`, `category`, `content`, `createdAt`, `documentTypeId`, `lastModifiedBy`, `milestoneId`, `readingTime`, `slug`, `spaceId`, `status`, `summary`, `tags`, `themeKey`, `title`, `updatedAt`, `version`

Observed indexes:
- `{ _id: 1 }`

### `wiki_qa_history`
Top-level fields:
- `_id`, `answer`, `createdAt`, `expiresAt`, `model`, `pageId`, `provider`, `question`, `userEmail`

Observed indexes:
- `{ _id: 1 }`
- `{ pageId: 1, createdAt: -1 }`
- `{ expiresAt: 1 }`
- `{ targetType: 1, targetId: 1, createdAt: -1 }`
- `{ targetType: 1, targetIdStr: 1, createdAt: -1 }`

### `wiki_spaces`
Top-level fields:
- `_id`, `createdAt`, `description`, `name`

Observed indexes:
- `{ _id: 1 }`

### `wiki_themes`
Top-level fields:
- `_id`, `createdAt`, `css`, `isActive`, `isDefault`, `key`, `name`, `updatedAt`

Observed indexes:
- `{ _id: 1 }`

### `wiki_templates`
Top-level fields:
- `_id`, `name`, `documentTypeId`, `content`, `isActive`, `isDefault`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

Observed indexes:
- `{ _id: 1 }`

Recommended indexes:
- `{ documentTypeId: 1, isActive: 1 }`
- `{ documentTypeId: 1, isDefault: 1 }` unique with partial filter `isDefault: true`

### `wikipages` (legacy)
Top-level fields:
- `_id`, `author`, `bundleId`, `content`, `createdAt`, `documentTypeId`, `lastModifiedBy`, `slug`, `spaceId`, `status`, `title`, `updatedAt`, `version`

Observed indexes:
- `{ _id: 1 }`

### `work_items`
Top-level fields:
- `_id`, `activity`, `applicationId`, `assignedTo`, `bundleId`, `createdAt`, `createdBy`, `description`, `key`, `milestoneIds`, `priority`, `status`, `title`, `type`, `updatedAt`, `updatedBy`

Observed indexes:
- `{ _id: 1 }`

### `workitems` (legacy)
Top-level fields:
- `_id`, `applicationId`, `assignedTo`, `bundleId`, `createdAt`, `description`, `priority`, `status`, `title`, `type`, `updatedAt`

Observed indexes:
- `{ _id: 1 }`

## Index Recommendations

These indexes will improve query performance and protect uniqueness. Apply them if they match the expected data model.

Suggested uniqueness:
- `users.email` unique
- `bundles.key` unique
- `taxonomy_categories.key` unique
- `taxonomy_document_types.key` unique
- `wiki_spaces.name` unique
- `wiki_themes.key` unique
- `wiki_pages.slug` unique per space (compound)

Suggested query indexes:
- `work_items.status`, `work_items.assignedTo`, `work_items.bundleId`, `work_items.milestoneIds`
- `wiki_pages.spaceId`, `wiki_pages.bundleId`, `wiki_pages.applicationId`, `wiki_pages.documentTypeId`, `wiki_pages.updatedAt`
- `wiki_assets.spaceId`, `wiki_assets.bundleId`, `wiki_assets.applicationId`, `wiki_assets.documentTypeId`, `wiki_assets.updatedAt`
- `wiki_history.pageId`, `wiki_history.versionedAt`
- `applications.name`, `applications.bundleId`

## How to Create Indexes

Option A: using `mongosh` (if installed):

```shell
mongosh "mongodb://admin:secretpassword@localhost:27017/deliveryhub?authSource=admin"
```

```javascript
db.users.createIndex({ email: 1 }, { unique: true })
db.bundles.createIndex({ key: 1 }, { unique: true })
db.taxonomy_categories.createIndex({ key: 1 }, { unique: true })
db.taxonomy_document_types.createIndex({ key: 1 }, { unique: true })
db.wiki_spaces.createIndex({ name: 1 }, { unique: true })
db.wiki_themes.createIndex({ key: 1 }, { unique: true })
db.wiki_pages.createIndex({ spaceId: 1, slug: 1 }, { unique: true })
db.work_items.createIndex({ status: 1 })
db.work_items.createIndex({ assignedTo: 1 })
db.work_items.createIndex({ bundleId: 1 })
db.work_items.createIndex({ milestoneIds: 1 })
db.wiki_pages.createIndex({ spaceId: 1 })
db.wiki_pages.createIndex({ bundleId: 1 })
db.wiki_pages.createIndex({ applicationId: 1 })
db.wiki_pages.createIndex({ documentTypeId: 1 })
db.wiki_pages.createIndex({ updatedAt: -1 })
db.wiki_assets.createIndex({ spaceId: 1 })
db.wiki_assets.createIndex({ bundleId: 1 })
db.wiki_assets.createIndex({ applicationId: 1 })
db.wiki_assets.createIndex({ documentTypeId: 1 })
db.wiki_assets.createIndex({ updatedAt: -1 })
db.wiki_history.createIndex({ pageId: 1, versionedAt: -1 })
```

Option B: via Node.js (no `mongosh` required):

```javascript
const { MongoClient } = require('mongodb')

async function run() {
  const uri = 'mongodb://admin:secretpassword@localhost:27017/deliveryhub?authSource=admin'
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db()

  await db.collection('users').createIndex({ email: 1 }, { unique: true })
  await db.collection('bundles').createIndex({ key: 1 }, { unique: true })
  await db.collection('taxonomy_categories').createIndex({ key: 1 }, { unique: true })
  await db.collection('taxonomy_document_types').createIndex({ key: 1 }, { unique: true })
  await db.collection('wiki_spaces').createIndex({ name: 1 }, { unique: true })
  await db.collection('wiki_themes').createIndex({ key: 1 }, { unique: true })
  await db.collection('wiki_pages').createIndex({ spaceId: 1, slug: 1 }, { unique: true })

  await db.collection('work_items').createIndex({ status: 1 })
  await db.collection('work_items').createIndex({ assignedTo: 1 })
  await db.collection('work_items').createIndex({ bundleId: 1 })
  await db.collection('work_items').createIndex({ milestoneIds: 1 })

  await db.collection('wiki_pages').createIndex({ spaceId: 1 })
  await db.collection('wiki_pages').createIndex({ bundleId: 1 })
  await db.collection('wiki_pages').createIndex({ applicationId: 1 })
  await db.collection('wiki_pages').createIndex({ documentTypeId: 1 })
  await db.collection('wiki_pages').createIndex({ updatedAt: -1 })

  await db.collection('wiki_assets').createIndex({ spaceId: 1 })
  await db.collection('wiki_assets').createIndex({ bundleId: 1 })
  await db.collection('wiki_assets').createIndex({ applicationId: 1 })
  await db.collection('wiki_assets').createIndex({ documentTypeId: 1 })
  await db.collection('wiki_assets').createIndex({ updatedAt: -1 })

  await db.collection('wiki_history').createIndex({ pageId: 1, versionedAt: -1 })

  await client.close()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
```

## Notes
- MongoDB is schema-flexible but types are defined in `src/types.ts`
- Images extracted from Word are stored within `wiki_assets` and served through an API route
- `workitems` and `wikipages` look like legacy collections and may be safe to deprecate after validation

## Sample Documents (Sanitized)

### `work_items`
```json
{
  "_id": "6966de608582fecfbb2c46c3",
  "type": "EPIC",
  "title": "Epic 1",
  "description": "Some description of the Epic goes here",
  "bundleId": "6966443e3c24168fcb84a5f2",
  "applicationId": "",
  "priority": "MEDIUM",
  "status": "TODO",
  "assignedTo": "",
  "key": "WI-1",
  "createdAt": "2026-01-14T00:08:00.624Z",
  "updatedAt": "2026-01-14T13:16:18.403Z",
  "createdBy": "Hamid Ben Malek",
  "updatedBy": "Hamid Ben Malek",
  "milestoneIds": ["M1"],
  "activity": []
}
```

### `wiki_pages`
```json
{
  "_id": "69629f003af47c1a7cf09433",
  "title": "GPS Security Review",
  "slug": "",
  "spaceId": "69639538f4cb842c90445348",
  "category": "General",
  "tags": ["Security Review"],
  "author": "Hamid Ben Malek",
  "lastModifiedBy": "Hamid Ben Malek",
  "createdAt": "2026-01-10T18:48:32.416Z",
  "updatedAt": "2026-02-14T13:36:14.544Z",
  "readingTime": 11,
  "version": 8,
  "status": "Published",
  "themeKey": "aurora",
  "applicationId": "696645923c24168fcb84a5fd",
  "bundleId": "6966443e3c24168fcb84a5f2",
  "milestoneId": "M2",
  "documentTypeId": "69666b1e4400ba02c336a400",
  "summary": "Shortened summary stored as markdown"
}
```

### `wiki_assets`
```json
{
  "_id": "697b9a86e97ddb5cad475ae9",
  "title": "centralized-data-architecture-template",
  "spaceId": "69639538f4cb842c90445348",
  "bundleId": null,
  "applicationId": null,
  "milestoneId": null,
  "documentTypeId": "696669004400ba02c336a3ec",
  "status": "Published",
  "themeKey": "aurora",
  "author": "Hamid Ben Malek",
  "lastModifiedBy": "Hamid Ben Malek",
  "createdAt": "2026-01-29T17:36:06.349Z",
  "updatedAt": "2026-01-29T17:36:06.349Z",
  "version": 1,
  "storage": {
    "provider": "base64",
    "objectKey": "<file-bytes-omitted>"
  },
  "preview": {
    "type": "markdown | html | text",
    "objectKey": "<preview-content-omitted>"
  }
}
```

### `wiki_spaces`
```json
{
  "_id": "69639538f4cb842c90445348",
  "name": "CMO Space",
  "description": "Documentation written by CMO members",
  "createdAt": "2026-01-11T12:19:04.936Z"
}
```

### `taxonomy_document_types`
```json
{
  "_id": "6966687c4400ba02c336a3e8",
  "key": "ADR",
  "name": "Architecture Decision Record",
  "categoryId": "6966682b4400ba02c336a3e7",
  "isActive": true,
  "sortOrder": 10,
  "requiredMetadata": {
    "requiresBundle": true,
    "requiresApplication": true,
    "requiresMilestone": false
  },
  "createdAt": "2026-01-13T15:45:00.562Z"
}
```

### `wiki_history`
```json
{
  "_id": "69639641f4cb842c9044534a",
  "pageId": "69639607f4cb842c90445349",
  "title": "Member Design Document",
  "spaceId": "69639538f4cb842c90445348",
  "bundleId": "b1",
  "applicationId": "app5",
  "category": "Technical",
  "author": "Hamid Ben Malek",
  "lastModifiedBy": "Hamid Ben Malek",
  "createdAt": "2026-01-11T12:22:31.945Z",
  "updatedAt": "2026-01-11T12:22:31.945Z",
  "readingTime": 1,
  "version": 1,
  "status": "Published",
  "versionedAt": "2026-01-11T12:23:29.692Z"
}
```

### `wiki_templates`
```json
{
  "_id": "709a1b2c0c1a4c6fb0a9b123",
  "name": "Standard ADR Template",
  "documentTypeId": "6966687c4400ba02c336a3e8",
  "content": "# Architecture Decision Record\\n\\n## Context\\n\\n## Decision\\n\\n## Consequences\\n",
  "isActive": true,
  "isDefault": true,
  "createdAt": "2026-02-16T10:00:00.000Z",
  "updatedAt": "2026-02-16T10:00:00.000Z",
  "createdBy": "Hamid Ben Malek",
  "updatedBy": "Hamid Ben Malek"
}
```
