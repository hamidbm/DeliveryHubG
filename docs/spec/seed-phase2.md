Codex — proceed with Phase 2: export baseline seed data from my existing DB into the new seed folder format.
Requirements:

1. Implement an export script (new) scripts/export-baseline.ts that:
  - connects using MONGODB_URI
  - exports these collections into one JSON file per collection (array of docs):
    - taxonomy_categories → seed/baseline/taxonomy_categories.json
    - taxonomy_document_types → seed/baseline/taxonomy_document_types.json
    - wiki_themes → seed/baseline/wiki_themes.json (keep css inline, do not split)
    - wiki_templates → seed/baseline/wiki_templates.json
    - diagram_templates → seed/baseline/diagram_templates.json
    - bundles / applications (whatever collections you currently use) → normalize into seed/baseline/bundles.json in the same shape baseline seeder expects
2. Export documents “as stored” (no schema transforms) except:
  - convert ObjectId fields to strings (including _id) OR remove _id consistently (pick one, I prefer stringify _id)
3. Do not export sample/demo content in this script.
4. Add npm run db:export-baseline to package.json.
5. After exporting, I will commit the generated JSON files to the repo.

Also:
  - Update seed/README.md with the exact command + expected output.
  - If any of these collections do not exist in DB, print a warning but still write an empty array file.

# Two implementation details Codex must align with (important)
## 1) ObjectId serialization
To avoid JSON issues and ensure deterministic diffs, stringify all ObjectId fields. This includes nested ObjectIds too (e.g., bundleId, documentTypeId).
If Codex only stringifies _id but leaves nested ObjectIds, you’ll hit runtime mismatches when seeding.

## 2) Bundles.json shape must match the seeder expectation
Codex created seed/baseline/*.json as empty arrays, but the seeder likely expects a specific schema for bundles. Make sure the exporter emits exactly what the baseline seeder expects (e.g., bundle.key vs bundle.name, apps nested or separate).

If the seeder currently inserts bundles into bundles + applications collections separately, it may be easier to export those two collections as separate JSON files rather than forcing a single bundles.json. Either approach is fine — but it must match the seeder.
If you paste me Codex’s current seeding logic for bundles/apps (the part in src/lib/bootstrap/seed.ts), I can tell you the correct export shape immediately.

## What you should NOT do yet
Don’t ask Codex to generate “sample data” until baseline export + fresh DB bootstrap is verified. Otherwise you’ll chase bugs across two tiers at once.