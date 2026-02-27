const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://admin:secretpassword@localhost:27017/deliveryhub?authSource=admin';

const templates = [
  {
    key: 'c4-context-mermaid-v1',
    name: 'C4 Context (Mermaid)',
    description: 'Context diagram for system boundaries and external actors.',
    diagramType: 'c4_context',
    format: 'MERMAID',
    isDefault: true,
    content: `C4Context
title System Context

Person(user, "User")
System(system, "System")
System_Ext(ext, "External System")

Rel(user, system, "Uses")
Rel(system, ext, "Integrates with")`
  },
  {
    key: 'c4-container-mermaid-v1',
    name: 'C4 Container (Mermaid)',
    description: 'Container view for apps, APIs, and data stores.',
    diagramType: 'c4_container',
    format: 'MERMAID',
    isDefault: true,
    content: `C4Container
title Container Diagram

Person(user, "User")
System_Boundary(s1, "System") {
  Container(web, "Web App")
  Container(api, "API")
  ContainerDb(db, "Database")
}

Rel(user, web, "Uses")
Rel(web, api, "Calls")
Rel(api, db, "Reads/Writes")`
  },
  {
    key: 'sequence-mermaid-v1',
    name: 'Sequence Diagram (Mermaid)',
    description: 'Simple request/response flow.',
    diagramType: 'sequence',
    format: 'MERMAID',
    isDefault: true,
    content: `sequenceDiagram
participant User
participant Web
participant API
participant DB

User->>Web: Request
Web->>API: Call
API->>DB: Query
DB-->>API: Result
API-->>Web: Response
Web-->>User: Render`
  },
  {
    key: 'service-design-drawio-v1',
    name: 'Service Design (Draw.io)',
    description: 'Service blueprint starter (Draw.io).',
    diagramType: 'service_design',
    format: 'DRAWIO',
    isDefault: true,
    content: '<mxfile><diagram id="page-1" name="Page-1"><mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>'
  },
  {
    key: 'enterprise-arch-drawio-v1',
    name: 'Enterprise Architecture (Draw.io)',
    description: 'Enterprise architecture landscape starter.',
    diagramType: 'enterprise_arch',
    format: 'DRAWIO',
    isDefault: true,
    content: '<mxfile><diagram id="page-1" name="Page-1"><mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>'
  },
  {
    key: 'database-schema-mermaid-v1',
    name: 'Database Schema (Mermaid)',
    description: 'ER diagram starter.',
    diagramType: 'database_schema',
    format: 'MERMAID',
    isDefault: true,
    content: `erDiagram
  USER ||--o{ ORDER : places
  USER {
    string id
    string name
  }
  ORDER {
    string id
    string status
  }`
  },
  {
    key: 'mindmap-md-v1',
    name: 'Mind Map (MD)',
    description: 'Mind map starter.',
    diagramType: 'mind_map',
    format: 'MINDMAP_MD',
    isDefault: true,
    content: `# Root Topic

## Branch A
### Idea A1

## Branch B
### Idea B1`
  }
];

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const now = new Date().toISOString();
  const force = process.argv.includes('--force');
  let upserts = 0;

  for (const t of templates) {
    const existing = await db.collection('diagram_templates').findOne({ key: t.key });
    const isDefault = force ? t.isDefault : (existing?.isDefault ?? t.isDefault);
    const update = {
      ...t,
      isDefault,
      isActive: true,
      updatedAt: now
    };
    const res = await db.collection('diagram_templates').updateOne(
      { key: t.key },
      { $set: update, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    if (res.upsertedCount || res.modifiedCount) upserts += 1;
  }

  console.log(`Seeded ${upserts} diagram templates.${force ? ' (forced defaults)' : ''}`);
  await client.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
