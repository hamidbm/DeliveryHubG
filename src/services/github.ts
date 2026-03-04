type GitHubConfig = {
  token: string;
  repos: string[];
};

export type GitHubPullRequest = {
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  mergedAt?: string | null;
  updatedAt: string;
  url: string;
  author?: string;
  headRef?: string;
};

export const getGitHubConfig = () => {
  const token = process.env.GITHUB_TOKEN || '';
  const repos = (process.env.GITHUB_REPOS || '').split(',').map((r) => r.trim()).filter(Boolean);
  const missing: string[] = [];
  if (!token) missing.push('GITHUB_TOKEN');
  if (!repos.length) missing.push('GITHUB_REPOS');
  return {
    ok: missing.length === 0,
    missing,
    config: { token, repos }
  };
};

const buildHeaders = (config: GitHubConfig) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${config.token}`,
  'X-GitHub-Api-Version': '2022-11-28'
});

const mapPullRequest = (pr: any): GitHubPullRequest => {
  return {
    number: Number(pr.number),
    title: String(pr.title || ''),
    body: pr.body ? String(pr.body) : undefined,
    state: pr.state === 'closed' ? 'closed' : 'open',
    mergedAt: pr.merged_at ? String(pr.merged_at) : null,
    updatedAt: pr.updated_at ? String(pr.updated_at) : new Date().toISOString(),
    url: pr.html_url ? String(pr.html_url) : '',
    author: pr.user?.login ? String(pr.user.login) : undefined,
    headRef: pr.head?.ref ? String(pr.head.ref) : undefined
  };
};

export const extractWorkItemKeys = (value: string) => {
  if (!value) return [];
  const pattern = /\b(?:[A-Z]{2,10}-\d+|WI-\d+)\b/g;
  const matches = value.match(pattern) || [];
  return Array.from(new Set(matches.map((m) => m.toUpperCase())));
};

export const getGitHubClient = () => {
  if (process.env.NODE_ENV === 'test' && (globalThis as any).__githubMock) {
    return (globalThis as any).__githubMock;
  }

  return {
    listPullRequests: async (config: GitHubConfig, repo: string, limit = 50) => {
      const url = new URL(`https://api.github.com/repos/${repo}/pulls`);
      url.searchParams.set('state', 'all');
      url.searchParams.set('sort', 'updated');
      url.searchParams.set('direction', 'desc');
      url.searchParams.set('per_page', String(Math.min(Math.max(limit, 1), 100)));
      const res = await fetch(url.toString(), { headers: buildHeaders(config) });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub PR list failed: ${res.status} ${text}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data.map(mapPullRequest) : [];
    }
  };
};
