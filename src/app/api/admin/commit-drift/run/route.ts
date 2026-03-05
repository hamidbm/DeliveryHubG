import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { evaluateMilestoneCommitmentDrift } from '../../../../../services/commitmentDrift';
import { emitEvent, getDb } from '../../../../../services/db';
import { createNotificationsForEvent } from '../../../../../services/notifications';

const resolveFlag = (value: string | null, defaultValue = false) => {
  if (value === null) return defaultValue;
  return value === 'true' || value === '1' || value === 'yes';
};

const resolveNumber = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toRunKey = () => {
  const now = new Date();
  return now.toISOString().slice(0, 13);
};

export async function POST(request: Request) {
  const cronSecret = process.env.COMMIT_DRIFT_CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Missing COMMIT_DRIFT_CRON_SECRET' }, { status: 500 });
  }

  const header = request.headers.get('x-cron-secret') || request.headers.get('X-Cron-Secret');
  if (!header || header !== cronSecret) {
    return NextResponse.json({ error: 'Forbidden', code: 'CRON_SECRET_INVALID' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = resolveFlag(searchParams.get('dryRun'), false);
  const force = resolveFlag(searchParams.get('force'), false);
  const maxMilestones = resolveNumber(searchParams.get('maxMilestones'), 200);
  const batchSize = resolveNumber(searchParams.get('batchSize'), 50);

  const db = await getDb();
  const runKey = `commitdrift:${toRunKey()}`;

  const driftRuns = db.collection<Record<string, any>>('drift_runs');

  if (!force) {
    const existing = await driftRuns.findOne({ runKey });
    if (existing) {
      return NextResponse.json({
        skipped: true,
        reason: 'already-run',
        runKey,
        summary: existing?.summary || null
      });
    }
  }

  const runId = force ? `${runKey}:${Date.now()}` : runKey;
  const startMs = Date.now();
  const startedAt = new Date().toISOString();

  if (!dryRun) {
    await driftRuns.insertOne({
      runId,
      runKey,
      startedAt,
      status: 'running',
      dryRun,
      force,
      maxMilestones,
      batchSize
    });
  }

  const statuses = ['COMMITTED', 'IN_PROGRESS'];
  const milestones = await db.collection('milestones')
    .find({ status: { $in: statuses } })
    .limit(maxMilestones)
    .toArray();

  const counts = {
    scanned: 0,
    updated: 0,
    notifiedMajor: 0,
    notifiedCleared: 0,
    errors: 0
  };

  for (let i = 0; i < milestones.length; i += batchSize) {
    const batch = milestones.slice(i, i + batchSize);
    for (const milestone of batch) {
      const milestoneId = String(milestone._id || milestone.id || milestone.name || '');
      if (!milestoneId) continue;
      counts.scanned += 1;
      try {
        const drift = await evaluateMilestoneCommitmentDrift(milestoneId);
        if (!drift) continue;
        const previous = await db.collection('commitment_drift_snapshots').findOne({ milestoneId: drift.milestoneId });

        const changed = !previous
          || previous.driftBand !== drift.driftBand
          || JSON.stringify(previous.deltas || []) !== JSON.stringify(drift.deltas || [])
          || previous.baselineAt !== (drift.baselineAt || null)
          || previous.hasBaseline !== drift.hasBaseline;

        const prevBand = previous?.driftBand || 'NONE';
        const now = new Date().toISOString();

        if (!dryRun && changed) {
          await db.collection('commitment_drift_snapshots').updateOne(
            { milestoneId: drift.milestoneId },
            {
              $set: {
                milestoneId: drift.milestoneId,
                evaluatedAt: now,
                driftBand: drift.driftBand,
                deltas: drift.deltas,
                baselineAt: drift.baselineAt || null,
                hasBaseline: drift.hasBaseline
              }
            },
            { upsert: true }
          );
          counts.updated += 1;
        }

        if (prevBand !== drift.driftBand && !dryRun) {
          if (prevBand === 'MAJOR' && drift.driftBand === 'NONE') {
            try {
              await emitEvent({
                ts: now,
                type: 'milestones.commitdrift.cleared',
                actor: { userId: 'system', displayName: 'System' },
                resource: { type: 'milestones.milestone', id: drift.milestoneId, title: milestone.name },
                payload: { drift }
              });
            } catch {}
            await createNotificationsForEvent({
              type: 'milestone.commitment.drift',
              actor: { userId: 'system', displayName: 'System' },
              payload: { milestone, drift, status: 'cleared' }
            });
            counts.notifiedCleared += 1;
          }
          if (prevBand !== 'MAJOR' && drift.driftBand === 'MAJOR') {
            try {
              await emitEvent({
                ts: now,
                type: 'milestones.commitdrift.detected',
                actor: { userId: 'system', displayName: 'System' },
                resource: { type: 'milestones.milestone', id: drift.milestoneId, title: milestone.name },
                payload: { drift }
              });
            } catch {}
            await createNotificationsForEvent({
              type: 'milestone.commitment.drift',
              actor: { userId: 'system', displayName: 'System' },
              payload: { milestone, drift, status: 'major' }
            });
            counts.notifiedMajor += 1;
          }
        }
      } catch {
        counts.errors += 1;
      }
    }
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  if (!dryRun) {
    await driftRuns.updateOne(
      { runId },
      { $set: { status: 'completed', completedAt, summary: counts } }
    );
  }

  try {
    await emitEvent({
      ts: completedAt,
      type: 'perf.commitdrift.run',
      actor: { userId: 'system', displayName: 'System' },
      resource: { type: 'milestones.commitdrift', id: runId, title: 'Commit drift run' },
      payload: {
        name: 'job.commitdrift',
        at: completedAt,
        durationMs,
        ok: counts.errors === 0,
        counts,
        scope: {
          maxMilestones,
          batchSize,
          dryRun
        }
      }
    });
  } catch {}

  try {
    await emitEvent({
      ts: completedAt,
      type: 'admin.commitdrift.completed',
      actor: { userId: 'system', displayName: 'System' },
      resource: { type: 'milestones.commitdrift', id: runId, title: 'Commit drift run' },
      payload: { runId, counts, dryRun, maxMilestones, batchSize }
    });
  } catch {}

  return NextResponse.json({
    runId,
    runKey,
    dryRun,
    force,
    counts
  });
}
