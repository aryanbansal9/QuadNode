import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Database, Search, FileText,
  RefreshCw, GitBranch, Clock, Cpu, Settings, Box,
} from 'lucide-react';
import { useConnection } from '../../context/ConnectionContext';
import ConnectionIndicator from '../common/ConnectionIndicator';
import { cx } from '../../utils/format';

const groups = [
  {
    label: 'Operate',
    items: [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/assistant', label: 'AI Assistant', icon: MessageSquare },
      { to: '/memory', label: 'Memory', icon: Database },
      { to: '/search', label: 'Search', icon: Search },
    ],
  },
  {
    label: 'Replicate',
    items: [
      { to: '/documents', label: 'Documents', icon: FileText },
      { to: '/sync', label: 'Synchronization', icon: RefreshCw },
      { to: '/conflicts', label: 'Conflicts', icon: GitBranch, badge: 1 },
      { to: '/timeline', label: 'Timeline', icon: Clock },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/devices', label: 'Devices', icon: Cpu },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const { pendingCount } = useConnection();
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[1px] lg:hidden" onClick={onClose} />}
      <aside
        className={cx(
          'qn-sidebar fixed inset-y-0 left-0 z-40 flex w-[228px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0',
          'dark:border-white/10 dark:bg-[#0A0E14]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-200/80 px-4 py-[15px] dark:border-white/10">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-blue-600 to-cyan-500 shadow-[0_2px_12px_-4px_rgba(37,99,235,0.7)] dark:from-blue-500 dark:to-cyan-400">
            <Box size={17} className="text-white dark:text-slate-950" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">QuadNode</p>
            <p className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase dark:text-slate-500">Edge Memory OS</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Primary">
          {groups.map((g) => (
            <div key={g.label} className="mb-3 last:mb-0">
              <p className="px-2 pt-1 pb-1.5 font-mono text-[9px] font-semibold tracking-[0.2em] text-slate-400 uppercase dark:text-slate-600">{g.label}</p>
              {g.items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cx(
                      'qn-navlink group relative mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium',
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-white/[0.07] dark:text-white'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-slate-200'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)] dark:bg-cyan-400 dark:shadow-[0_0_8px_rgba(34,211,238,0.8)]" aria-hidden />
                      )}
                      <n.icon
                        size={15}
                        className={cx(
                          'shrink-0 transition-transform duration-150 group-hover:scale-110',
                          isActive ? 'text-blue-600 dark:text-cyan-300' : 'text-slate-400 dark:text-slate-500'
                        )}
                      />
                      <span className="flex-1 truncate">{n.label}</span>
                      {n.to === '/sync' && pendingCount > 0 && (
                        <span className="tnum rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-300">{pendingCount}</span>
                      )}
                      {n.to === '/conflicts' && (
                        <span className="tnum rounded-md bg-orange-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-orange-600 dark:text-orange-300">{n.badge}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200/80 p-3 dark:border-white/10">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] font-semibold tracking-widest text-slate-700 dark:text-slate-200">EDGE-001</p>
              <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500">Qdrant :6333</span>
            </div>
            <div className="mt-1.5">
              <ConnectionIndicator size="sm" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
