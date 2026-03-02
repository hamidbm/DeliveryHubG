/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { EJSON } = require('bson');

const SAMPLE_DIR = path.join(process.cwd(), 'seed', 'sample');
const BASELINE_DIR = path.join(process.cwd(), 'seed', 'baseline');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const readBaseline = (file) => {
  const filePath = path.join(BASELINE_DIR, file);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return EJSON.parse(raw) || [];
  } catch {
    return JSON.parse(raw) || [];
  }
};

const writeSample = (file, docs) => {
  const filePath = path.join(SAMPLE_DIR, file);
  fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
  console.log(`Wrote ${docs.length} -> ${filePath}`);
};

const nowIso = () => new Date().toISOString();

const makeUsers = async () => {
  const hash = await bcrypt.hash('Demo123!', 10);
  const users = [
    { name: 'Amina Rahman', username: 'amina', email: 'amina.rahman@example.com', role: 'CMO Member', team: 'CMO' },
    { name: 'David Chen', username: 'david', email: 'david.chen@example.com', role: 'CMO Member', team: 'CMO' },
    { name: 'Omar Haddad', username: 'omar', email: 'omar.haddad@example.com', role: 'SVP Architect', team: 'SVP' },
    { name: 'Lina Kovacs', username: 'lina', email: 'lina.kovacs@example.com', role: 'SVP Delivery Lead', team: 'SVP' },
    { name: 'Marco Silva', username: 'marco', email: 'marco.silva@example.com', role: 'Engineering EA', team: 'Engineering' },
    { name: 'Priya Nair', username: 'priya', email: 'priya.nair@example.com', role: 'Engineering DBA', team: 'Engineering' },
    { name: 'Sophie Martin', username: 'sophie', email: 'sophie.martin@example.com', role: 'Management', team: 'Management' },
    { name: 'James Walker', username: 'james', email: 'james.walker@example.com', role: 'Engg Leader', team: 'Engineering' },
    { name: 'System Admin', username: 'admin', email: 'admin@example.com', role: 'Management', team: 'Management', isAdmin: true }
  ];
  return users.map((u, idx) => ({
    ...u,
    password: hash,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    _seedKey: `user:${idx + 1}`
  }));
};

const pickBundles = (bundles) => bundles.slice(0, 2);

const bundlePrefix = (bundle) => {
  const raw = String(bundle.key || bundle.name || 'BUNDLE');
  const safe = raw.replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();
  return safe || 'BUNDLE';
};

const findAppsForBundle = (apps, bundleName, bundleKey) => {
  return apps.filter((a) => {
    if (bundleKey && a.bundleKey === bundleKey) return true;
    if (bundleName && a.bundleName === bundleName) return true;
    if (bundleKey && a.bundleId === bundleKey) return true;
    return false;
  });
};

const getDocTypes = (docTypes) => docTypes.slice(0, 3);

const run = async () => {
  ensureDir(SAMPLE_DIR);

  const bundles = readBaseline('bundles.json');
  const applications = readBaseline('applications.json');
  const docTypes = readBaseline('taxonomy_document_types.json');

  const selectedBundles = pickBundles(bundles);
  if (!selectedBundles.length) throw new Error('No bundles in baseline to generate samples.');
  const selectedDocTypes = getDocTypes(docTypes);

  const users = await makeUsers();
  writeSample('users.json', users);

  const bundleAssignments = [];
  selectedBundles.forEach((bundle, index) => {
    const bundleName = bundle.name;
    bundleAssignments.push({
      assignmentType: 'assigned_cmo',
      active: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: `bundle_assignment:${index + 1}`,
      _refs: { bundleName, userEmail: 'amina.rahman@example.com' }
    });
    bundleAssignments.push({
      assignmentType: 'cmo_reviewer',
      active: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: `bundle_assignment:${index + 1}-b`,
      _refs: { bundleName, userEmail: 'david.chen@example.com' }
    });
    bundleAssignments.push({
      assignmentType: 'bundle_owner',
      active: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: `bundle_assignment:${index + 1}-c`,
      _refs: { bundleName, userEmail: 'omar.haddad@example.com' }
    });
  });
  writeSample('bundle_assignments.json', bundleAssignments);

  const wikiPages = [];
  selectedBundles.forEach((bundle, idx) => {
    const docType = selectedDocTypes[idx % selectedDocTypes.length];
    wikiPages.push({
      title: `${bundle.name} Architecture Overview`,
      slug: `${bundle.name.toLowerCase().replace(/\s+/g, '-')}-overview`,
      content: `# ${bundle.name} Architecture\n\nThis page captures the current state of ${bundle.name} architecture.\n\n## Key Decisions\n- Adopt zero-trust networking\n- Shift to managed identity\n\n## Open Questions\n- Data residency constraints\n- DR topology for active-active`,
      status: 'Published',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      version: 1,
      _seedKey: `wiki_page:${idx + 1}`,
      _refs: {
        bundleName: bundle.name,
        spaceName: `${bundle.name} Space`,
        documentTypeKey: docType?.key,
        authorEmail: 'sophie.martin@example.com',
        lastModifiedByEmail: 'sophie.martin@example.com'
      }
    });
  });

  const extraPages = [
    {
      title: 'Migration Readiness Checklist',
      slug: 'migration-readiness-checklist',
      content: `# Migration Readiness Checklist\n\n- Network segmentation approved\n- Secrets rotation plan\n- DR runbook drafted\n\n## Risks\n- Vendor support windows\n- Legacy data cleanup`,
      authorEmail: 'james.walker@example.com'
    },
    {
      title: 'Security & Compliance Notes',
      slug: 'security-compliance-notes',
      content: `# Security & Compliance Notes\n\nThis document summarizes security requirements and audit controls.\n\n## Controls\n- MFA for admin access\n- Immutable audit logs\n- Data retention`,
      authorEmail: 'amina.rahman@example.com'
    },
    {
      title: 'Operational Runbook Draft',
      slug: 'operational-runbook-draft',
      content: `# Operational Runbook\n\n## Monitoring\n- SLO dashboards\n- Synthetic probes\n\n## Incident Response\n- Escalation matrix\n- On-call roster`,
      authorEmail: 'marco.silva@example.com'
    },
    {
      title: 'Integration Dependencies',
      slug: 'integration-dependencies',
      content: `# Integration Dependencies\n\n## External Systems\n- Identity provider\n- Payment gateway\n- Notification service`,
      authorEmail: 'priya.nair@example.com'
    }
  ];

  extraPages.forEach((page, index) => {
    const bundle = selectedBundles[index % selectedBundles.length];
    const docType = selectedDocTypes[(index + 1) % selectedDocTypes.length];
    wikiPages.push({
      title: page.title,
      slug: `${bundle.name.toLowerCase().replace(/\s+/g, '-')}-${page.slug}`,
      content: page.content,
      status: 'Published',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      version: 1,
      _seedKey: `wiki_page:extra-${index + 1}`,
      _refs: {
        bundleName: bundle.name,
        spaceName: `${bundle.name} Space`,
        documentTypeKey: docType?.key,
        authorEmail: page.authorEmail,
        lastModifiedByEmail: page.authorEmail
      }
    });
  });
  writeSample('wiki_pages.json', wikiPages);

  const diagramSeedKey = 'diagram:bundle-1';
  const architectureDiagrams = [];
  selectedBundles.forEach((bundle, idx) => {
    const docType = selectedDocTypes[idx % selectedDocTypes.length];
    architectureDiagrams.push({
      title: `${bundle.name} Target Architecture`,
      format: 'MERMAID',
      status: 'DRAFT',
      content: `flowchart LR\n  Client-->API\n  API-->DB\n  API-->Cache\n  Cache-->DB`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: idx === 0 ? diagramSeedKey : `diagram:${bundlePrefix(bundle)}-core`,
      _refs: {
        bundleName: bundle.name,
        documentTypeKey: docType?.key,
        createdByEmail: 'omar.haddad@example.com',
        updatedByEmail: 'omar.haddad@example.com'
      }
    });
  });

  const extraDiagrams = [
    {
      title: 'Identity Flow',
      content: `sequenceDiagram\n  participant User\n  participant Auth\n  participant API\n  User->>Auth: Login\n  Auth->>API: Token\n  API-->>User: Session`,
      author: 'omar.haddad@example.com'
    },
    {
      title: 'Data Pipeline Overview',
      content: `flowchart TD\n  Source-->Ingest\n  Ingest-->Transform\n  Transform-->Store\n  Store-->Analytics`,
      author: 'omar.haddad@example.com'
    },
    {
      title: 'Network Segmentation',
      content: `flowchart LR\n  Internet-->WAF\n  WAF-->Gateway\n  Gateway-->Services\n  Services-->DB`,
      author: 'omar.haddad@example.com'
    },
    {
      title: 'DR Topology',
      content: `flowchart LR\n  RegionA-->RegionB\n  RegionB-->RegionA`,
      author: 'omar.haddad@example.com'
    }
  ];
  extraDiagrams.forEach((diagram, index) => {
    const bundle = selectedBundles[index % selectedBundles.length];
    const docType = selectedDocTypes[(index + 1) % selectedDocTypes.length];
    architectureDiagrams.push({
      title: `${bundle.name} ${diagram.title}`,
      format: 'MERMAID',
      status: 'DRAFT',
      content: diagram.content,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: `diagram:extra-${index + 1}`,
      _refs: {
        bundleName: bundle.name,
        documentTypeKey: docType?.key,
        createdByEmail: diagram.author,
        updatedByEmail: diagram.author
      }
    });
  });
  writeSample('architecture_diagrams.json', architectureDiagrams);

  const diagBundle = selectedBundles[0];
  const epicKey = `${bundlePrefix(diagBundle)}-EPIC`;
  const workitems = [];
  const makeFeatureKey = (bundle, idx) => `${bundlePrefix(bundle)}-F${idx}`;
  const makeStoryKey = (bundle, idx) => `${bundlePrefix(bundle)}-S${idx}`;
  const makeTaskKey = (bundle, idx) => `${bundlePrefix(bundle)}-T${idx}`;

  let storyCounter = 1;
  let taskCounter = 1;

  selectedBundles.forEach((bundle, bundleIndex) => {
    const epicKeyLocal = `${bundlePrefix(bundle)}-EPIC`;
    for (let f = 1; f <= 3; f += 1) {
      const featureKey = makeFeatureKey(bundle, f);
      const gpsFeatureNames = ['GPS Data Platform Migration', 'GPS Identity & Access Modernization', 'GPS Network & Connectivity'];
      const featureTitle = bundleIndex === 0 ? gpsFeatureNames[f - 1] || `${bundle.name} Feature ${f}` : `${bundle.name} Feature ${f}`;
      workitems.push({
        key: featureKey,
        type: 'FEATURE',
        title: featureTitle,
        description: `Feature ${f} for ${bundle.name}.`,
        status: f === 1 ? 'IN_PROGRESS' : 'TODO',
        priority: f === 1 ? 'HIGH' : 'MEDIUM',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        _seedKey: `workitem:${bundlePrefix(bundle)}:feature-${f}`,
        _refs: {
          bundleName: bundle.name,
          parentKey: epicKeyLocal,
          assigneeEmails: ['marco.silva@example.com'],
          createdByEmail: 'james.walker@example.com',
          updatedByEmail: 'james.walker@example.com'
        }
      });

      for (let s = 1; s <= 2; s += 1) {
        const storyKey = makeStoryKey(bundle, storyCounter);
        const storyTitle = bundleIndex === 0 && f === 1 && s === 1
          ? 'Implement API gateway policies'
          : `Story ${storyCounter} for ${bundle.name}`;
        workitems.push({
          key: storyKey,
          type: 'STORY',
          title: storyTitle,
          description: 'Deliver scoped implementation work for this feature.',
          status: s === 1 ? 'IN_PROGRESS' : 'TODO',
          priority: s === 1 ? 'HIGH' : 'MEDIUM',
          createdAt: nowIso(),
          updatedAt: nowIso(),
          _seedKey: `workitem:${bundlePrefix(bundle)}:story-${storyCounter}`,
          _refs: {
            bundleName: bundle.name,
            parentKey: featureKey,
            assigneeEmails: ['priya.nair@example.com'],
            watcherEmails: ['omar.haddad@example.com'],
            createdByEmail: 'sophie.martin@example.com',
            updatedByEmail: 'sophie.martin@example.com'
          },
          ...(bundleIndex === 0 && f === 1 && s === 1
            ? {
                linkedResource: { type: 'architecture_diagram', id: '__RESOLVE__', title: `${bundle.name} Target Architecture` },
                _refsLinkedDiagram: { diagramSeedKey }
              }
            : {})
        });

        workitems.push({
          key: makeTaskKey(bundle, taskCounter),
          type: 'TASK',
          title: `Task ${taskCounter} for ${bundle.name}`,
          description: 'Task supporting story execution.',
          status: 'TODO',
          priority: 'LOW',
          createdAt: nowIso(),
          updatedAt: nowIso(),
          _seedKey: `workitem:${bundlePrefix(bundle)}:task-${taskCounter}`,
          _refs: {
            bundleName: bundle.name,
            parentKey: storyKey,
            assigneeEmails: ['marco.silva@example.com'],
            createdByEmail: 'james.walker@example.com',
            updatedByEmail: 'james.walker@example.com'
          }
        });

        storyCounter += 1;
        taskCounter += 1;
      }
    }

    workitems.push({
      key: `${bundlePrefix(bundle)}-R1`,
      type: 'RISK',
      title: `Risk: ${bundle.name} data readiness`,
      description: 'Historical data quality may impact migration cutover.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      risk: { probability: 4, impact: 4, severity: 'high', area: 'operations', mitigation: 'Run cleansing pipeline before cutover.' },
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: `workitem:${bundlePrefix(bundle)}:risk-1`,
      _refs: {
        bundleName: bundle.name,
        parentKey: makeFeatureKey(bundle, 1),
        assigneeEmails: ['sophie.martin@example.com'],
        createdByEmail: 'sophie.martin@example.com',
        updatedByEmail: 'sophie.martin@example.com'
      },
      ...(bundleIndex === 0
        ? {
            linkedResource: { type: 'wiki_page', id: '__RESOLVE__', title: `${bundle.name} Architecture Overview` },
            _refsLinkedWiki: { wikiPageSeedKey: 'wiki_page:1' }
          }
        : {})
    });

    workitems.push({
      key: `${bundlePrefix(bundle)}-D1`,
      type: 'DEPENDENCY',
      title: `Dependency: ${bundle.name} identity rollout`,
      description: 'Requires new managed identity service.',
      status: 'BLOCKED',
      priority: 'HIGH',
      dependency: { blocking: true, dependsOn: { type: 'external', name: 'Identity Platform Team' } },
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: `workitem:${bundlePrefix(bundle)}:dependency-1`,
      _refs: {
        bundleName: bundle.name,
        parentKey: makeFeatureKey(bundle, 1),
        assigneeEmails: ['james.walker@example.com'],
        createdByEmail: 'james.walker@example.com',
        updatedByEmail: 'james.walker@example.com'
      }
    });
  });

  if (selectedBundles.length > 0) {
    const riskIdx = workitems.findIndex((w) => w._seedKey === 'workitem:' + bundlePrefix(selectedBundles[0]) + ':risk-1');
    if (riskIdx >= 0) {
      workitems[riskIdx] = {
        ...workitems[riskIdx],
        status: 'BLOCKED',
        priority: 'HIGH',
        risk: { ...(workitems[riskIdx].risk || {}), severity: 'critical', area: 'compliance' }
      };
    }
  }
  const extraWorkitems = [
    {
      key: `${bundlePrefix(diagBundle)}-T1`,
      type: 'TASK',
      title: 'Finalize migration cutover plan',
      description: 'Define rollback and cutover steps.',
      status: 'TODO',
      priority: 'MEDIUM',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: 'workitem:task-1',
      _refs: {
        bundleName: diagBundle.name,
        parentKey: `${bundlePrefix(diagBundle)}-F1`,
        assigneeEmails: ['marco.silva@example.com'],
        createdByEmail: 'james.walker@example.com',
        updatedByEmail: 'james.walker@example.com'
      }
    },
    {
      key: `${bundlePrefix(diagBundle)}-T2`,
      type: 'TASK',
      title: 'Define DR testing schedule',
      description: 'Coordinate disaster recovery test windows.',
      status: 'IN_PROGRESS',
      priority: 'LOW',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: 'workitem:task-2',
      _refs: {
        bundleName: diagBundle.name,
        parentKey: `${bundlePrefix(diagBundle)}-F1`,
        assigneeEmails: ['priya.nair@example.com'],
        createdByEmail: 'james.walker@example.com',
        updatedByEmail: 'james.walker@example.com'
      }
    },
    {
      key: `${bundlePrefix(diagBundle)}-S2`,
      type: 'STORY',
      title: 'Implement caching strategy',
      description: 'Define cache invalidation and TTL policy.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: 'workitem:story-2',
      _refs: {
        bundleName: diagBundle.name,
        parentKey: `${bundlePrefix(diagBundle)}-F1`,
        assigneeEmails: ['priya.nair@example.com'],
        watcherEmails: ['omar.haddad@example.com'],
        createdByEmail: 'sophie.martin@example.com',
        updatedByEmail: 'sophie.martin@example.com'
      }
    },
    {
      key: `${bundlePrefix(diagBundle)}-S3`,
      type: 'STORY',
      title: 'Observability dashboards',
      description: 'Add SLO dashboards for latency and errors.',
      status: 'TODO',
      priority: 'MEDIUM',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: 'workitem:story-3',
      _refs: {
        bundleName: diagBundle.name,
        parentKey: `${bundlePrefix(diagBundle)}-F1`,
        assigneeEmails: ['marco.silva@example.com'],
        createdByEmail: 'marco.silva@example.com',
        updatedByEmail: 'marco.silva@example.com'
      }
    },
    {
      key: `${bundlePrefix(diagBundle)}-R2`,
      type: 'RISK',
      title: 'Vendor capacity risk',
      description: 'Vendor bandwidth may delay delivery.',
      status: 'TODO',
      priority: 'MEDIUM',
      risk: { probability: 3, impact: 3, severity: 'medium', area: 'vendor', mitigation: 'Confirm staffing plan and buffer schedule.' },
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: 'workitem:risk-2',
      _refs: {
        bundleName: diagBundle.name,
        parentKey: `${bundlePrefix(diagBundle)}-F1`,
        assigneeEmails: ['sophie.martin@example.com'],
        createdByEmail: 'sophie.martin@example.com',
        updatedByEmail: 'sophie.martin@example.com'
      }
    },
    {
      key: `${bundlePrefix(diagBundle)}-D2`,
      type: 'DEPENDENCY',
      title: 'Dependency on data platform',
      description: 'Requires data platform team to provision pipelines.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dependency: { blocking: false, dependsOn: { type: 'external', name: 'Data Platform Team' } },
      createdAt: nowIso(),
      updatedAt: nowIso(),
      _seedKey: 'workitem:dependency-2',
      _refs: {
        bundleName: diagBundle.name,
        parentKey: `${bundlePrefix(diagBundle)}-F1`,
        assigneeEmails: ['james.walker@example.com'],
        createdByEmail: 'james.walker@example.com',
        updatedByEmail: 'james.walker@example.com'
      }
    }
  ];

  workitems.push(...extraWorkitems);
  writeSample('workitems.json', workitems);

  const reviewSeedKey = 'review:diagram-1';
  const reviewCycleId = 'cycle-001';
  const reviewSeedKey2 = 'review:wiki-1';
  const reviewSeedKey3 = 'review:risk-1';
  const reviews = [
    {
      _seedKey: reviewSeedKey,
      status: 'active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      currentCycleId: reviewCycleId,
      currentCycleStatus: 'feedback_sent',
      cycles: [
        {
          cycleId: reviewCycleId,
          number: 1,
          status: 'feedback_sent',
          requestedAt: nowIso(),
          requestedByEmail: 'omar.haddad@example.com',
          reviewersEmails: ['amina.rahman@example.com', 'david.chen@example.com'],
          feedbackSentAt: nowIso(),
          feedbackSentByEmail: 'amina.rahman@example.com',
          reviewerNote: {
            body: 'Please confirm the cache invalidation strategy and DR topology.',
            createdAt: nowIso()
          },
          vendorResponse: {
            body: 'We will add cache invalidation notes and DR topology in the next revision.',
            submittedAt: nowIso()
          },
          correlationId: 'sample-review-cycle-1'
        },
        {
          cycleId: 'cycle-002',
          number: 2,
          status: 'closed',
          requestedAt: nowIso(),
          requestedByEmail: 'omar.haddad@example.com',
          reviewersEmails: ['amina.rahman@example.com'],
          feedbackSentAt: nowIso(),
          feedbackSentByEmail: 'amina.rahman@example.com',
          reviewerNote: {
            body: 'Reviewed update; ok to proceed.',
            createdAt: nowIso()
          },
          vendorResponse: {
            body: 'Changes applied and validated.',
            submittedAt: nowIso()
          },
          correlationId: 'sample-review-cycle-2'
        }
      ],
      _refs: { diagramSeedKey }
    },
    {
      _seedKey: reviewSeedKey2,
      status: 'active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      currentCycleId: 'wiki-cycle-1',
      currentCycleStatus: 'vendor_addressing',
      cycles: [
        {
          cycleId: 'wiki-cycle-1',
          number: 1,
          status: 'vendor_addressing',
          requestedAt: nowIso(),
          requestedByEmail: 'sophie.martin@example.com',
          reviewersEmails: ['amina.rahman@example.com'],
          feedbackSentAt: nowIso(),
          feedbackSentByEmail: 'amina.rahman@example.com',
          reviewerNote: {
            body: 'Please add compliance references and audit controls.',
            createdAt: nowIso()
          },
          vendorResponse: {
            body: 'Working on compliance references; will update.',
            submittedAt: nowIso()
          },
          correlationId: 'sample-review-wiki-1'
        }
      ],
      _refs: { wikiPageSeedKey: 'wiki_page:extra-2' }
    },
    {
      _seedKey: reviewSeedKey3,
      status: 'active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      currentCycleId: 'risk-cycle-1',
      currentCycleStatus: 'requested',
      cycles: [
        {
          cycleId: 'risk-cycle-1',
          number: 1,
          status: 'requested',
          requestedAt: nowIso(),
          requestedByEmail: 'james.walker@example.com',
          reviewersEmails: ['amina.rahman@example.com', 'david.chen@example.com'],
          correlationId: 'sample-review-risk-1'
        }
      ],
      _refs: { workitemSeedKey: 'workitem:risk-1' }
    }
  ];
  writeSample('reviews.json', reviews);

  const commentThreads = [
    {
      _seedKey: 'thread:review-1',
      status: 'open',
      createdAt: nowIso(),
      lastActivityAt: nowIso(),
      _refs: {
        reviewSeedKey,
        participantEmails: ['amina.rahman@example.com', 'omar.haddad@example.com']
      }
    },
    {
      _seedKey: 'thread:review-2',
      status: 'open',
      createdAt: nowIso(),
      lastActivityAt: nowIso(),
      _refs: {
        reviewSeedKey,
        participantEmails: ['david.chen@example.com', 'omar.haddad@example.com']
      }
    },
    {
      _seedKey: 'thread:review-wiki-1',
      status: 'open',
      createdAt: nowIso(),
      lastActivityAt: nowIso(),
      _refs: {
        reviewSeedKey: reviewSeedKey2,
        participantEmails: ['amina.rahman@example.com', 'sophie.martin@example.com']
      }
    },
    {
      _seedKey: 'thread:review-risk-1',
      status: 'open',
      createdAt: nowIso(),
      lastActivityAt: nowIso(),
      _refs: {
        reviewSeedKey: reviewSeedKey3,
        participantEmails: ['amina.rahman@example.com', 'james.walker@example.com']
      }
    }
  ];
  writeSample('comment_threads.json', commentThreads);

  const commentMessages = [
    {
      _seedKey: 'message:review-1',
      body: 'Can you clarify the cache invalidation strategy for cross-region failover?',
      createdAt: nowIso(),
      _refs: {
        threadSeedKey: 'thread:review-1',
        authorEmail: 'amina.rahman@example.com'
      }
    },
    {
      _seedKey: 'message:review-2',
      body: 'We will document failover cache rules in the next revision.',
      createdAt: nowIso(),
      _refs: {
        threadSeedKey: 'thread:review-1',
        authorEmail: 'omar.haddad@example.com'
      }
    },
    {
      _seedKey: 'message:review-3',
      body: 'Please include DR topology diagram references.',
      createdAt: nowIso(),
      _refs: {
        threadSeedKey: 'thread:review-2',
        authorEmail: 'david.chen@example.com'
      }
    },
    {
      _seedKey: 'message:review-4',
      body: 'Working on DR topology update; will share shortly.',
      createdAt: nowIso(),
      _refs: {
        threadSeedKey: 'thread:review-2',
        authorEmail: 'omar.haddad@example.com'
      }
    },
    {
      _seedKey: 'message:review-wiki-1',
      body: 'Please add compliance references and audit controls.',
      createdAt: nowIso(),
      _refs: {
        threadSeedKey: 'thread:review-wiki-1',
        authorEmail: 'amina.rahman@example.com'
      }
    },
    {
      _seedKey: 'message:review-wiki-2',
      body: 'Acknowledged; adding compliance references now.',
      createdAt: nowIso(),
      _refs: {
        threadSeedKey: 'thread:review-wiki-1',
        authorEmail: 'sophie.martin@example.com'
      }
    },
    {
      _seedKey: 'message:review-risk-1',
      body: 'Can we quantify the compliance gating risk?',
      createdAt: nowIso(),
      _refs: {
        threadSeedKey: 'thread:review-risk-1',
        authorEmail: 'amina.rahman@example.com'
      }
    }
  ];
  writeSample('comment_messages.json', commentMessages);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
