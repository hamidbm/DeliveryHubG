import React, { useEffect, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { CommentThread, CommentMessage } from '../types';

interface CommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  resource: { type: string; id: string; title?: string } | null;
  currentUser?: { id?: string; userId?: string; name?: string; email?: string } | null;
  onUnreadCountChange?: (count: number) => void;
}

const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  isOpen,
  onClose,
  resource,
  currentUser,
  onUnreadCountChange
}) => {
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommentMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [newThreadText, setNewThreadText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  const userId = String(currentUser?.id || currentUser?.userId || '');

  const loadThreads = async () => {
    if (!resource?.type || !resource?.id) return;
    setLoadingThreads(true);
    try {
      const res = await fetch(`/api/resources/${encodeURIComponent(resource.type)}/${encodeURIComponent(resource.id)}/comment-threads`);
      const data = await res.json();
      setThreads(Array.isArray(data) ? data : []);
    } catch {
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  };

  const loadCommentState = async () => {
    if (!resource?.type || !resource?.id || !userId) return;
    try {
      const res = await fetch(`/api/resources/${encodeURIComponent(resource.type)}/${encodeURIComponent(resource.id)}/comment-threads/state`);
      const data = await res.json();
      setLastSeenAt(data?.lastSeenAt || null);
      if (typeof data?.unreadCount === 'number') {
        onUnreadCountChange?.(data.unreadCount);
      }
    } catch {}
  };

  useEffect(() => {
    if (resource?.id) {
      loadThreads();
    }
  }, [resource?.id, resource?.type, isOpen]);

  useEffect(() => {
    if (resource?.id) {
      loadCommentState();
    }
  }, [resource?.id, resource?.type, userId]);

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date().toISOString();
    const updateSeen = async () => {
      if (!resource?.type || !resource?.id || !userId) return;
      try {
        await fetch(`/api/resources/${encodeURIComponent(resource.type)}/${encodeURIComponent(resource.id)}/comment-threads/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastSeenAt: now })
        });
      } catch {}
    };
    updateSeen();
    setLastSeenAt(now);
    onUnreadCountChange?.(0);
  }, [isOpen, resource?.type, resource?.id, userId, onUnreadCountChange]);

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/comment-threads/${encodeURIComponent(selectedThreadId)}/messages`);
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      } catch {
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [selectedThreadId]);

  useEffect(() => {
    const effectiveLastSeen = lastSeenAt || new Date(0).toISOString();
    const unread = threads.filter((t) => new Date(t.lastActivityAt).toISOString() > effectiveLastSeen).length;
    onUnreadCountChange?.(unread);
  }, [threads, lastSeenAt, onUnreadCountChange]);

  const filteredThreads = threads.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (searchTerm.trim()) {
      const name = t.createdBy?.displayName || '';
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  const selectedThread = threads.find((t) => String(t._id) === String(selectedThreadId)) || null;

  const handleCreateThread = async () => {
    if (!newThreadText.trim() || !resource) return;
    try {
      const res = await fetch(`/api/resources/${encodeURIComponent(resource.type)}/${encodeURIComponent(resource.id)}/comment-threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newThreadText.trim(), resourceTitle: resource.title })
      });
      if (!res.ok) return;
      const data = await res.json();
      setNewThreadText('');
      await loadThreads();
      if (data?.threadId) setSelectedThreadId(String(data.threadId));
    } catch {}
  };

  const handleSendMessage = async () => {
    if (!composerText.trim() || !selectedThreadId || !resource) return;
    try {
      const res = await fetch(`/api/comment-threads/${encodeURIComponent(selectedThreadId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: composerText.trim(), resourceType: resource.type, resourceId: resource.id })
      });
      if (!res.ok) return;
      setComposerText('');
      const messagesRes = await fetch(`/api/comment-threads/${encodeURIComponent(selectedThreadId)}/messages`);
      const data = await messagesRes.json();
      setMessages(Array.isArray(data) ? data : []);
      await loadThreads();
    } catch {}
  };

  const handleToggleResolve = async () => {
    if (!selectedThreadId || !resource) return;
    const nextStatus = selectedThread?.status === 'resolved' ? 'open' : 'resolved';
    try {
      const res = await fetch(`/api/comment-threads/${encodeURIComponent(selectedThreadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, resourceType: resource.type, resourceId: resource.id })
      });
      if (!res.ok) return;
      await loadThreads();
      setSelectedThreadId(selectedThreadId);
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-x-0 top-[7.5rem] bottom-0 bg-slate-900/30" onClick={onClose} />
      <aside className="absolute right-0 top-[7.5rem] bottom-0 w-full max-w-[620px] bg-white shadow-2xl border-l border-slate-200 flex flex-col">
        <header className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Comments</div>
            <div className="text-lg font-black text-slate-900">{resource?.title || 'Artifact'}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedThreadId(null);
                setComposerText('');
              }}
              className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all"
            >
              New Thread
            </button>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-700">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </header>

        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
            placeholder="Search by author"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 border-r border-slate-100 overflow-y-auto">
            {loadingThreads ? (
              <div className="p-4 text-xs text-slate-400">Loading threads...</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">No threads yet.</div>
            ) : (
              filteredThreads.map((thread) => (
                <button
                  key={String(thread._id)}
                  onClick={() => setSelectedThreadId(String(thread._id))}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 transition ${
                    String(thread._id) === String(selectedThreadId) ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-700">{thread.createdBy?.displayName || 'User'}</div>
                  <div className="text-[10px] text-slate-400">{thread.messageCount} messages</div>
                  <div className={`text-[9px] font-black uppercase tracking-widest ${thread.status === 'resolved' ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {thread.status}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="flex-1 flex flex-col">
            {!selectedThread && (
              <div className="p-6">
                <div className="text-sm font-semibold text-slate-700 mb-3">Start a new thread</div>
                <textarea
                  value={newThreadText}
                  onChange={(e) => setNewThreadText(e.target.value)}
                  className="w-full min-h-[120px] border border-slate-200 rounded-xl p-3 text-sm"
                  placeholder="Write your comment..."
                />
                <button
                  onClick={handleCreateThread}
                  disabled={!newThreadText.trim()}
                  className="mt-3 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-slate-900 text-white disabled:opacity-50"
                >
                  Create Thread
                </button>
              </div>
            )}

            {selectedThread && (
              <>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-600">
                    {selectedThread.messageCount} messages
                  </div>
                  <button
                    onClick={handleToggleResolve}
                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border ${
                      selectedThread.status === 'resolved'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : 'bg-amber-50 text-amber-600 border-amber-200'
                    }`}
                  >
                    {selectedThread.status === 'resolved' ? 'Reopen' : 'Resolve'}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loadingMessages ? (
                    <div className="text-xs text-slate-400">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-xs text-slate-400">No messages yet.</div>
                  ) : (
                    messages.map((msg) => (
                      <div key={String(msg._id)} className="bg-slate-50 rounded-xl p-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                          {msg.author?.displayName || 'User'}
                        </div>
                        <div className="text-sm text-slate-700">
                          <MarkdownRenderer content={msg.body} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-4 border-t border-slate-100">
                  <textarea
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    className="w-full min-h-[90px] border border-slate-200 rounded-xl p-3 text-sm"
                    placeholder="Reply to this thread..."
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!composerText.trim()}
                    className="mt-3 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-slate-900 text-white disabled:opacity-50"
                  >
                    Send Reply
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default CommentsDrawer;
