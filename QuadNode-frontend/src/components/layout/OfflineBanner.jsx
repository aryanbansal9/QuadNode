import { WifiOff, RefreshCw } from 'lucide-react';
import { useConnection } from '../../context/ConnectionContext';
import Button from '../common/Button';

export default function OfflineBanner() {
  const { isOffline, isSyncing, syncProgress, restoreConnection } = useConnection();
  if (isSyncing) {
    return (
      <div className="qn-banner border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 lg:px-6" role="status">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <RefreshCw size={14} className="animate-spin text-amber-600 dark:text-amber-300" />
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
            SYNCING — pushing local queue to Qdrant Server… {Math.round(syncProgress)}%
          </p>
          <div className="h-1 max-w-48 flex-1 overflow-hidden rounded-full bg-amber-500/20">
            <div className="h-full rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${syncProgress}%` }} />
          </div>
        </div>
      </div>
    );
  }
  if (!isOffline) return null;
  return (
    <div className="qn-banner border-b border-red-500/25 bg-red-500/[0.07] px-4 py-2 lg:px-6 dark:bg-red-500/10" role="alert">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        <WifiOff size={14} className="text-red-500 dark:text-red-300" />
        <p className="text-xs text-red-700 dark:text-red-200">
          <span className="font-semibold">Cloud offline (simulated).</span>{' '}
          <span className="opacity-80">Edge AI on localhost remains available — ask questions and create memories locally; they will queue for sync.</span>
        </p>
        <Button variant="secondary" size="sm" className="ml-auto" onClick={restoreConnection}>
          Restore connection
        </Button>
      </div>
    </div>
  );
}
