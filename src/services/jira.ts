import { WorkItemStatus, WorkItemType } from '../types';

type JiraConfig = {
  host: string;
  email: string;
  apiToken: string;
  projectKeys: string[];
  storyPointsFieldId?: string;
  statusMapping?: Record<string, WorkItemStatus>;
};

type JiraIssue = {
  id: string;
  key: string;
  fields: any;
};

const defaultStatusMap: Record<string, WorkItemStatus> = {
  'to do': WorkItemStatus.TODO,
  'todo': WorkItemStatus.TODO,
  'in progress': WorkItemStatus.IN_PROGRESS,
  'in-progress': WorkItemStatus.IN_PROGRESS,
  'review': WorkItemStatus.REVIEW,
  'done': WorkItemStatus.DONE,
  'blocked': WorkItemStatus.BLOCKED
};

export const getJiraConfig = () => {
  const host = process.env.JIRA_HOST || '';
  const email = process.env.JIRA_EMAIL || '';
  const apiToken = process.env.JIRA_API_TOKEN || '';
  const keys = (process.env.JIRA_PROJECT_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean);
  const storyPointsFieldId = process.env.JIRA_STORY_POINTS_FIELD_ID || undefined;
  let statusMapping: Record<string, WorkItemStatus> | undefined;
  if (process.env.JIRA_STATUS_MAPPING) {
    try {
      statusMapping = JSON.parse(process.env.JIRA_STATUS_MAPPING);
    } catch {
      statusMapping = undefined;
    }
  }
  const missing = [];
  if (!host) missing.push('JIRA_HOST');
  if (!email) missing.push('JIRA_EMAIL');
  if (!apiToken) missing.push('JIRA_API_TOKEN');
  if (!keys.length) missing.push('JIRA_PROJECT_KEYS');
  return {
    ok: missing.length === 0,
    missing,
    config: { host, email, apiToken, projectKeys: keys, storyPointsFieldId, statusMapping }
  };
};

const buildAuthHeader = (config: JiraConfig) => {
  const token = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  return `Basic ${token}`;
};

const resolveStoryPoints = (fields: any, config: JiraConfig) => {
  const candidates = [
    config.storyPointsFieldId,
    'customfield_10026',
    'customfield_10016',
    'customfield_10002'
  ].filter(Boolean) as string[];
  for (const key of candidates) {
    const value = fields?.[key];
    if (typeof value === 'number') return value;
  }
  if (typeof fields?.storyPoints === 'number') return fields.storyPoints;
  return undefined;
};

export const mapJiraStatus = (jiraStatus: string, config: JiraConfig) => {
  const raw = String(jiraStatus || '').trim();
  if (!raw) return WorkItemStatus.TODO;
  const custom = config.statusMapping;
  if (custom) {
    const direct = custom[raw];
    if (direct) return direct;
    const lower = custom[raw.toLowerCase()];
    if (lower) return lower as WorkItemStatus;
  }
  return defaultStatusMap[raw.toLowerCase()] || WorkItemStatus.TODO;
};

export const mapJiraIssueToWorkItem = (issue: JiraIssue, config: JiraConfig) => {
  const fields = issue.fields || {};
  const summary = fields.summary || issue.key;
  const statusName = fields.status?.name || fields.status?.statusCategory?.name || '';
  const storyPoints = resolveStoryPoints(fields, config);
  const assignee = fields.assignee?.displayName || fields.assignee?.emailAddress || fields.assignee?.name || undefined;
  const projectKey = fields.project?.key || issue.key.split('-')[0];
  const url = `${config.host.replace(/\/$/, '')}/browse/${issue.key}`;
  return {
    key: issue.key,
    title: summary,
    status: mapJiraStatus(statusName, config),
    storyPoints,
    assignedTo: assignee,
    type: WorkItemType.STORY,
    jira: {
      host: config.host,
      key: issue.key,
      issueId: issue.id,
      url,
      lastSyncedAt: new Date().toISOString()
    },
    jiraProjectKey: projectKey
  };
};

export const getJiraClient = () => {
  if (process.env.NODE_ENV === 'test' && (globalThis as any).__jiraMock) {
    return (globalThis as any).__jiraMock;
  }

  return {
    searchIssues: async (config: JiraConfig, jql: string, limit = 50, startAt = 0) => {
      const fields = ['summary', 'status', 'assignee', 'updated', 'project'];
      if (config.storyPointsFieldId) fields.push(config.storyPointsFieldId);
      const url = new URL(`${config.host.replace(/\/$/, '')}/rest/api/3/search`);
      url.searchParams.set('jql', jql);
      url.searchParams.set('startAt', String(startAt));
      url.searchParams.set('maxResults', String(limit));
      url.searchParams.set('fields', fields.join(','));
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: buildAuthHeader(config),
          Accept: 'application/json'
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Jira search failed: ${res.status} ${text}`);
      }
      return await res.json();
    }
  };
};
