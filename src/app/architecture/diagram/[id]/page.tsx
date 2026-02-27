import { redirect } from 'next/navigation';

export default async function ArchitectureDiagramRedirect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const focus = typeof sp.focus === 'string' ? sp.focus : undefined;
  const cycle = typeof sp.cycle === 'string' ? sp.cycle : undefined;
  const cycleId = typeof sp.cycleId === 'string' ? sp.cycleId : undefined;
  const threadId = typeof sp.threadId === 'string' ? sp.threadId : undefined;

  const qs = new URLSearchParams();
  qs.set('tab', 'architecture');
  qs.set('diagramId', id);
  if (focus) qs.set('focus', focus);
  if (cycleId || cycle) qs.set('cycleId', cycleId || cycle || '');
  if (threadId) qs.set('threadId', threadId);

  redirect(`/?${qs.toString()}`);
}
