import React, { useMemo, useState } from 'react';
import { Notification } from '../../types/ai';

type Props = {
  notifications: Notification[];
  onRefresh: () => void;
  onMarkRead: (notificationId: string, read: boolean) => void;
  isAdmin?: boolean;
};

const statusStyle = (status?: string) => {
  if (status === 'sent') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'suppressed') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const ChannelStatus = ({ item }: { item: Notification }) => {
  const inApp = item.delivery?.in_app?.status || 'sent';
  const emailStatus = item.delivery?.email?.status || 'suppressed';
  const slackStatus = item.delivery?.slack?.status || 'suppressed';
  const teamsStatus = item.delivery?.teams?.status || 'suppressed';
  const emailError = item.delivery?.email?.lastErrorMessage;
  const slackError = item.delivery?.slack?.lastErrorMessage;
  const teamsError = item.delivery?.teams?.lastErrorMessage;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <span className={`text-[10px] font-bold uppercase border rounded-full px-2 py-0.5 ${statusStyle(inApp)}`}>
        In-App: {inApp}
      </span>
      <span
        title={emailStatus === 'failed' && emailError ? emailError : undefined}
        className={`text-[10px] font-bold uppercase border rounded-full px-2 py-0.5 ${statusStyle(emailStatus)}`}
      >
        Email: {emailStatus}
      </span>
      <span
        title={slackStatus === 'failed' && slackError ? slackError : undefined}
        className={`text-[10px] font-bold uppercase border rounded-full px-2 py-0.5 ${statusStyle(slackStatus)}`}
      >
        Slack: {slackStatus}
      </span>
      <span
        title={teamsStatus === 'failed' && teamsError ? teamsError : undefined}
        className={`text-[10px] font-bold uppercase border rounded-full px-2 py-0.5 ${statusStyle(teamsStatus)}`}
      >
        Teams: {teamsStatus}
      </span>
      {item.deliveryMode === 'digest' && (
        <span className="text-[10px] font-bold uppercase border rounded-full px-2 py-0.5 bg-indigo-50 text-indigo-700 border-indigo-200">
          Delivery Mode: Digest
        </span>
      )}
    </div>
  );
};

const NotificationCenter: React.FC<Props> = ({ notifications, onRefresh, onMarkRead, isAdmin }) => {
  const [open, setOpen] = useState(false);
  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);
  const failedCount = useMemo(() => notifications.filter((item) =>
    item.delivery?.email?.status === 'failed' ||
    item.delivery?.slack?.status === 'failed' ||
    item.delivery?.teams?.status === 'failed'
  ).length, [notifications]);
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
            <div className="flex items-center gap-2">
              {isAdmin && (
                <a
                  href="/dashboards?tab=admin"
                  className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                  title="Open Admin Notification Ops"
                >
                  Ops {failedCount > 0 ? `(${failedCount})` : ''}
                </a>
              )}
              <button onClick={onRefresh} className="text-xs font-semibold text-blue-700 hover:text-blue-800">Refresh</button>
            </div>
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
                      <ChannelStatus item={item} />
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
                      <ChannelStatus item={item} />
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
