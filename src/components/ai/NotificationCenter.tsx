import React, { useMemo, useState } from 'react';
import { Notification } from '../../types/ai';

type Props = {
  notifications: Notification[];
  onRefresh: () => void;
  onMarkRead: (notificationId: string, read: boolean) => void;
};

const NotificationCenter: React.FC<Props> = ({ notifications, onRefresh, onMarkRead }) => {
  const [open, setOpen] = useState(false);
  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);
  const unread = notifications.filter((item) => !item.read);
  const read = notifications.filter((item) => item.read);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50"
      >
        <i className="fas fa-bell"></i>
        Notifications
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[90vw] rounded-xl border border-slate-200 bg-white shadow-xl z-40">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Notifications Center</p>
            <button onClick={onRefresh} className="text-xs font-semibold text-blue-700 hover:text-blue-800">Refresh</button>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-3 space-y-3">
            {unread.length > 0 && (
              <section>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Unread ({unread.length})</p>
                <div className="space-y-2">
                  {unread.map((item) => (
                    <article key={item.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-sm font-semibold text-slate-800 break-words">{item.title}</p>
                      <p className="text-xs text-slate-600 mt-1 break-words">{item.message}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => onMarkRead(item.id, true)}
                          className="text-xs font-semibold px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100"
                        >
                          Mark as read
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {read.length > 0 && (
              <section>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Read ({read.length})</p>
                <div className="space-y-2">
                  {read.slice(0, 40).map((item) => (
                    <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-700 break-words">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-1 break-words">{item.message}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {notifications.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                No notifications yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
