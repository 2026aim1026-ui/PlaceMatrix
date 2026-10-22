import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

/** Shared shell for both portals. Sidebar + topbar stay mounted while child routes change. */
export default function AppLayout({ nav, badges, user, role, statusLine, notificationUserId, adminFeed, sidebarExtra, titleFor }) {
  const [drawer, setDrawer] = useState(false);
  const [menuSignal, setMenuSignal] = useState(0);
  const location = useLocation();

  useEffect(() => {
    setDrawer(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const flat = nav.flatMap((g) => g.items);
  const current = flat.filter((i) => location.pathname.startsWith(i.to)).sort((a, b) => b.to.length - a.to.length)[0];
  const title = titleFor?.(location.pathname) || current?.label || 'PlaceMatrix';

  useEffect(() => {
    document.title = `${title} · PlaceMatrix`;
  }, [title]);

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#main" className="sr-only z-[80] rounded bg-brand px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
      <Sidebar nav={nav} badges={badges} user={{ ...user, onSwitch: () => setMenuSignal((n) => n + 1) }} open={drawer} onClose={() => setDrawer(false)} extra={sidebarExtra} />
      <div className="lg:pl-60">
        <Topbar
          title={title}
          role={role}
          user={user}
          statusLine={statusLine}
          onMenu={() => setDrawer(true)}
          notificationUserId={notificationUserId}
          adminFeed={adminFeed}
          menuSignal={menuSignal}
        />
        <main id="main" className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
