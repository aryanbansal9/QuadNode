import { Menu, Bell, Wifi, WifiOff, Loader2, ChevronDown } from 'lucide-react';
import { useConnection, CONNECTION } from '../../context/ConnectionContext';
import ConnectionIndicator from '../common/ConnectionIndicator';
import ThemeToggle from '../common/ThemeToggle';
import { cx } from '../../utils/format';

export default function Topbar({ onMenu }) {
  const { status, lastSyncLabel, backend } = useConnection();
  const StatusIcon = status === CONNECTION.OFFLINE ? WifiOff : status === CONNECTION.SYNCING ? Loader2 : Wifi;

  // Live Hybrid Mapping
  const liveEdge = backend?.edge?.total ?? 0;
  const liveCloud = backend?.cloud_memories ?? 0;
  const livePending = backend?.edge?.PENDING ?? 0;

  return (
    <header className="qn-topbar sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-white/10 dark:bg-[#070A0F]/85">
      <div className="flex h-[52px] items-center gap-2.5 px-4 lg:px-6">
        <button onClick={onMenu} className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-white/5" aria-label="Open navigation">
          <Menu size={18} />
        </button>

        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">QuadNode</span>
          <span className="font-mono text-[11px] text-slate-300 dark:text-slate-600">/</span>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">EDGE-001</span>
        </div>

        {/* Connection pill */}
        <div
          className={cx(
            'ml-1 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors duration-200',
            status === CONNECTION.ONLINE && 'border-emerald-500/30 bg-emerald-500/10',
            status === CONNECTION.OFFLINE && 'border-red-500/30 bg-red-500/10',
            status === CONNECTION.SYNCING && 'border-amber-500/30 bg-amber-500/10'
          )}
          role="status"
          aria-live="polite"
          title={`Edge: ${liveEdge} | Cloud: ${liveCloud} | Pending: ${livePending}`}
        >
          <StatusIcon size={13} className={cx(
            status === CONNECTION.ONLINE && 'text-emerald-500 dark:text-emerald-300',
            status === CONNECTION.OFFLINE && 'text-red-500 dark:text-red-300',
            status === CONNECTION.SYNCING && 'animate-spin text-amber-500 dark:text-amber-300'
          )} />
          <ConnectionIndicator />
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <p className="hidden font-mono text-[11px] text-slate-400 xl:block dark:text-slate-500">
            Last sync <span className="text-slate-600 dark:text-slate-300">{lastSyncLabel}</span>
          </p>
          <ThemeToggle />
          <button className="relative cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200" aria-label="Notifications">
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-orange-500" />
          </button>
          <button className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 transition-colors hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20" aria-label="Device menu">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 font-mono text-[10px] font-bold text-white dark:bg-slate-700 dark:text-slate-200">E1</span>
            <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
          </button>
        </div>
      </div>
    </header>
  );
}
