# Seed Data (Export/Import)

This folder contains JSON exports of important collections for bootstrapping a new environment.

## Export (from local MongoDB)

```bash
MONGODB_URI="mongodb://admin:secretpassword@localhost:27017/deliveryhub?authSource=admin" \
npm run seed:export
```

Optional overrides:
- `SEED_BUNDLE_NAMES="Bundle 1,Bundle 2,Bundle 3"` (defaults to these)
- `MONGODB_DB_NAME=deliveryhub`
- `SEED_DIR=/path/to/seed/collections`

The export writes JSON files to `seed/collections/` and a `seed/manifest.json`.

## Import (into Railway MongoDB)

Railway provides `MONGO_URL` automatically, so this usually works:

```bash
railway run npm run seed:import
```

If you need to run locally against Railway without `railway run`:

```bash
MONGO_URL="mongodb://mongo:...@mongodb.railway.internal:27017" \
npm run seed:import
```

Optional overrides:
- `MONGODB_DB_NAME=deliveryhub`
- `SEED_DIR=/path/to/seed/collections`

## Notes

- Import is idempotent (upsert by `_id`).
- IDs are preserved using EJSON.
