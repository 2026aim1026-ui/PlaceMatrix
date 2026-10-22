import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { timeAgo } from '../../utils/dateUtils';

export default function NotificationBell({ userId, adminFeed = false }) {
  const { db, repo } = useData();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  // Students see their own notifications; staff see the latest audit activity.
  const items = adminFeed
    ? [...db.audit].slice(-8).reverse().map((e) => ({ id: e.id, message: e.description, at: e.at, read: true, link: '/admin/audit-trail' }))
    : db.notifications.filter((n) => n.userId === userId).slice(0, 10);
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open && unread && userId) repo.markNotificationsRead(userId); }}
        className="relative rounded-lg p-2 text-ink-soft hover:bg-canvas hover:text-ink"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning ring-2 ring-white" aria-hidden />}
      </button>
      {open && (
        <div className="pop-in absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-line bg-white shadow-pop">
          <p className="border-b border-line px-3.5 py-2.5 text-sm font-semibold">{adminFeed ? 'Recent activity' : 'Notifications'}</p>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && <li className="px-3.5 py-6 text-center text-xs text-ink-muted">You are all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => { setOpen(false); if (n.link) navigate(n.link); }} className="flex w-full gap-2.5 px-3.5 py-2.5 text-left hover:bg-canvas">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? 'bg-line' : 'bg-brand'}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-xs text-ink">{n.message}</span>
                    <span className="block text-[10.5px] text-ink-muted">{timeAgo(n.at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
