import { redirect } from 'next/navigation';

export default async function WorkItemRedirect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const threadId = typeof sp.threadId === 'string' ? sp.threadId : undefined;

  const qs = new URLSearchParams();
  qs.set('tab', 'work-items');
  qs.set('view', 'tree');
  qs.set('workItemId', id);
  if (threadId) qs.set('threadId', threadId);

  redirect(`/?${qs.toString()}`);
}
