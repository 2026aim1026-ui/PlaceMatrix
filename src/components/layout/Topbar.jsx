import { Menu } from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import AccountMenu from './AccountMenu';

export default function Topbar({ title, role, user, statusLine, onMenu, notificationUserId, adminFeed, menuSignal }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onMenu} className="-ml-1 rounded-lg p-2 text-ink-soft hover:bg-canvas lg:hidden" aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      <p className="hidden min-w-0 shrink-0 truncate text-sm font-semibold text-ink sm:block sm:w-40 xl:w-52">{title}</p>
      <div className="flex flex-1 justify-center">
        <GlobalSearch role={role} />
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <NotificationBell userId={notificationUserId} adminFeed={adminFeed} />
        <AccountMenu user={user} statusLine={statusLine} openSignal={menuSignal} />
      </div>
    </header>
  );
}
