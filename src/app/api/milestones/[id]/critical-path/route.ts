import { NextResponse } from 'next/server';
import { computeMilestoneCriticalPath } from '../../../../../services/criticalPath';
import { createVisibilityContext, getAuthUserFromCookies } from '../../../../../services/visibility';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const visibility = createVisibilityContext(user);
    if (!(await visibility.canViewMilestone(id))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const includeExternalParam = url.searchParams.get('includeExternal');
    const includeExternal = includeExternalParam === null ? undefined : includeExternalParam === 'true';
    const maxExternalDepth = url.searchParams.get('maxExternalDepth') ? Number(url.searchParams.get('maxExternalDepth')) : undefined;
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined;

    const result = await computeMilestoneCriticalPath(String(id), { includeExternal, maxExternalDepth, limit });
    const includeGraph = url.searchParams.get('includeGraph') === 'true';
    if (!includeGraph) {
      if (result) {
        delete (result as any).nodes;
        delete (result as any).edges;
      }
    }
    if (includeGraph && result?.nodes?.length) {
      result.nodes = await Promise.all(result.nodes.map(async (node: any) => {
        if (!node?.bundleId) return node;
        const canView = await visibility.canViewBundle(String(node.bundleId));
        if (canView) return node;
        return {
          ...node,
          title: 'Restricted item',
          restricted: true
        };
      }));
    }
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to compute critical path' }, { status: 500 });
  }
}
