import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb, emitEvent } from '../../../../../../services/db';
import { generateBundleBrief, generateMilestoneBrief, generateProgramBrief, resolveWeekKey, upsertWeeklyBrief, queueWeeklyBriefDigest } from '../../../../../../services/weeklyBrief';

const resolveFlag = (value: string | null, defaultValue = false) => {
  if (value === null) return defaultValue;
  return value === 'true' || value === '1' || value === 'yes';
};

export async function POST(request: Request) {
  const startMs = Date.now();
  const cronSecret = process.env.WEEKLY_BRIEF_CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Missing WEEKLY_BRIEF_CRON_SECRET' }, { status: 500 });
  const header = request.headers.get('x-cron-secret') || request.headers.get('X-Cron-Secret');
  if (!header || header !== cronSecret) {
    return NextResponse.json({ error: 'Forbidden', code: 'CRON_SECRET_INVALID' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const weekKey = resolveWeekKey(searchParams.get('weekKey') || undefined);
  const force = resolveFlag(searchParams.get('force'), false);
  const includeMilestones = resolveFlag(searchParams.get('includeMilestones'), false);

  const db = await getDb();
  const bundles = await db.collection('bundles').find({}).toArray();
  const milestones = includeMilestones
    ? await db.collection('milestones').find({ status: { $in: ['COMMITTED', 'IN_PROGRESS'] } }).toArray()
    : [];

  const counts = { program: 0, bundles: 0, milestones: 0 };

  const programBrief = await generateProgramBrief(weekKey, { userId: 'system' });
  if (programBrief) {
    await upsertWeeklyBrief(programBrief, force);
    await queueWeeklyBriefDigest(programBrief);
    counts.program += 1;
  }

  for (const bundle of bundles) {
    const bundleId = String(bundle._id || bundle.id || bundle.name || '');
    if (!bundleId) continue;
    const brief = await generateBundleBrief(bundleId, weekKey, { userId: 'system' });
    if (brief) {
      await upsertWeeklyBrief(brief, force);
      await queueWeeklyBriefDigest(brief);
      counts.bundles += 1;
    }
  }

  if (includeMilestones) {
    for (const milestone of milestones) {
      const milestoneId = String(milestone._id || milestone.id || milestone.name || '');
      if (!milestoneId) continue;
      const brief = await generateMilestoneBrief(milestoneId, weekKey, { userId: 'system' });
      if (brief) {
        await upsertWeeklyBrief(brief, force);
        await queueWeeklyBriefDigest(brief);
        counts.milestones += 1;
      }
    }
  }

  const durationMs = Date.now() - startMs;
  try {
    await emitEvent({
      ts: new Date().toISOString(),
      type: 'perf.weeklybrief.run',
      actor: { userId: 'system', displayName: 'System' },
      resource: { type: 'briefs.weekly', id: weekKey, title: 'Weekly Brief Run' },
      payload: {
        name: 'job.weeklybrief',
        at: new Date().toISOString(),
        durationMs,
        ok: true,
        counts,
        scope: { weekKey, includeMilestones, force }
      }
    });
  } catch {}

  return NextResponse.json({ weekKey, force, includeMilestones, counts });
}
