
import { NextResponse } from 'next/server';
import { suggestReassignment } from '../../../../services/geminiService';
import { checkAndIncrementAiRateLimit, fetchSystemSettings, fetchWorkItemById, saveAiAuditLog } from '../../../../services/db';
import { getRateLimitPerHour, getRequestIdentity, getRetentionDays } from '../../../../services/aiPolicy';

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const settings = await fetchSystemSettings();
    const aiSettings = settings?.ai || {};
    const identity = getRequestIdentity(request);
    const allowed = await checkAndIncrementAiRateLimit(identity, getRateLimitPerHour(aiSettings, 30));
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }

    // Simulate team capacity scan
    const teamCapacity = [
      { name: 'Sarah PM', load: 14, role: 'Program Manager' },
      { name: 'Emma Watson', load: 2, role: 'Frontend Engineer' },
      { name: 'John Doe', load: 7, role: 'Backend Engineer' },
      { name: 'Alex Architect', load: 4, role: 'Enterprise Architect' }
    ];

    const model = aiSettings.geminiFlashModel || aiSettings.flashModel || 'gemini-3-flash-preview';
    const suggestion = await suggestReassignment(item, teamCapacity, model);
    await saveAiAuditLog({
      task: 'suggestReassignment',
      provider: 'GEMINI',
      model,
      success: true,
      latencyMs: Date.now() - startedAt,
      identity,
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ suggestion });
  } catch (error) {
    const settings = await fetchSystemSettings();
    const aiSettings = settings?.ai || {};
    await saveAiAuditLog({
      task: 'suggestReassignment',
      provider: 'UNKNOWN',
      success: false,
      error: (error as Error)?.message,
      latencyMs: Date.now() - startedAt,
      identity: getRequestIdentity(request),
      ttlDays: getRetentionDays(aiSettings, 'auditLogs', 30)
    });
    return NextResponse.json({ error: 'AI Rebalancing failed' }, { status: 500 });
  }
}
