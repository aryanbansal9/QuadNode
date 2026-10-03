import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import OfflineBanner from './OfflineBanner';

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="qn-app-bg min-h-screen text-slate-900 dark:text-slate-200">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="lg:pl-[228px]">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <OfflineBanner />
        <main className="page-enter mx-auto w-full max-w-7xl px-4 py-6 lg:px-6" key={undefined}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
