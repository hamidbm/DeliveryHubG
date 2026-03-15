import { EntityReference, EvidenceItem, StrategicQueryResponse } from '../../types/ai';
import { toEvidenceItems } from './evidenceEntities';

const VALID_ENTITY_TYPES = new Set(['workitem', 'application', 'bundle', 'milestone', 'review']);

const coerceStringArray = (raw: unknown, max = 6) => {
  if (!Array.isArray(raw)) return [] as string[];
  return raw
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .slice(0, max);
};

const normalizeEntities = (raw: unknown, max = 12): EntityReference[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: EntityReference[] = [];

  raw.forEach((item: any) => {
    const type = String(item?.type || '').toLowerCase();
    const id = String(item?.id || '').trim();
    const label = String(item?.label || '').trim();
    if (!VALID_ENTITY_TYPES.has(type) || !id || !label) return;
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      type: type as EntityReference['type'],
      id,
      label,
      ...(typeof item?.secondary === 'string' && item.secondary.trim()
        ? { secondary: item.secondary.trim() }
        : {})
    });
  });

  return out.slice(0, max);
};

const extractJsonObject = (raw: string) => {
  const text = raw.trim();
  if (!text) return null;
  if (text.startsWith('{') && text.endsWith('}')) return text;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
};

const entitiesFromEvidence = (evidence: EvidenceItem[]) => {
  const seen = new Set<string>();
  const out: EntityReference[] = [];
  evidence.forEach((item) => {
    (item.entities || []).forEach((entity) => {
      const key = `${entity.type}:${entity.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(entity);
    });
  });
  return out.slice(0, 12);
};

export const normalizeStrategicModelResponse = (
  rawText: string,
  deterministicFallback: StrategicQueryResponse
): StrategicQueryResponse => {
  const jsonText = extractJsonObject(rawText || '');
  if (!jsonText) {
    return {
      ...deterministicFallback,
      warning: 'Model response could not be parsed; returning deterministic strategic answer.'
    };
  }

  try {
    const parsed = JSON.parse(jsonText);
    const answer = String(parsed?.answer || '').trim();
    const explanation = String(parsed?.explanation || '').trim();
    const evidence = toEvidenceItems(Array.isArray(parsed?.evidence) ? parsed.evidence : [], 'ai', 8);
    const relatedEntities = normalizeEntities(parsed?.relatedEntities);
    const followUps = coerceStringArray(parsed?.followUps, 6);

    if (!answer || !explanation) {
      return {
        ...deterministicFallback,
        warning: 'Model response was incomplete; returning deterministic strategic answer.'
      };
    }

    const resolvedEvidence = evidence.length > 0 ? evidence : deterministicFallback.evidence;
    const resolvedRelated = relatedEntities.length > 0 ? relatedEntities : entitiesFromEvidence(resolvedEvidence);

    return {
      answer,
      explanation,
      evidence: resolvedEvidence,
      relatedEntities: resolvedRelated,
      followUps: followUps.length > 0 ? followUps : deterministicFallback.followUps,
      actionPlan: deterministicFallback.actionPlan,
      success: true,
      warning: followUps.length === 0 ? 'Model omitted follow-ups; deterministic follow-ups were applied.' : undefined
    };
  } catch {
    return {
      ...deterministicFallback,
      warning: 'Model response could not be parsed; returning deterministic strategic answer.'
    };
  }
};
