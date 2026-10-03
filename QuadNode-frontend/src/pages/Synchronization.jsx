import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Play, Database, Layers, ShieldCheck, Cloud, ArrowRight } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '../components/common/Card';
import MetricCard from '../components/common/MetricCard';
import Badge, { SyncBadge } from '../components/common/Badge';
import Button from '../components/common/Button';
import ConnectionIndicator from '../components/common/ConnectionIndicator';
import { syncQueue, syncMetrics } from '../data/sync';
import { useConnection } from '../context/ConnectionContext';
import { memoryService } from '../api/services';
import { USE_MOCK } from '../api/client';
import { cx } from '../utils/format';

const flowStages = [
  { label: 'LOCAL MEMORY', icon: Database },
  { label: 'SYNC QUEUE', icon: Layers },
  { label: 'VALIDATION', icon: ShieldCheck },
  { label: 'QDRANT SERVER', icon: Cloud },
];

export default function Synchronization() {
  const { status, isOffline, isSyncing, syncProgress, simulateOffline, restoreConnection, simulateSync, backend, pendingCount, cloudSimulatedOffline } = useConnection();
  const [realRows, setRealRows] = useState([]);
  const [syncMsg, setSyncMsg] = useState('');

  const loadQueue = async () => {
    if (USE_MOCK) return;
    try {
      const rows = await memoryService.list(100);
      setRealRows(Array.isArray(rows) ? rows : []);
    } catch { /* keep mock rows */ }
  };

  useEffect(() => { loadQueue(); }, [pendingCount]);
  useEffect(() => { loadQueue(); }, []);

  const queue = [
    ...realRows
      .filter((r) => r.sync_status === 'PENDING' || r.sync_status === 'SYNCED' || r.sync_status === 'LOCAL_ONLY')
      .slice(0, 20)
      .map((r) => ({
        id: String(r.id).slice(0, 8),
        title: (r.text || '').slice(0, 60) || '(empty)',
        status: r.sync_status,
        created: r.timestamp ? new Date(r.timestamp * 1000).toLocaleString() : '—',
        lastAttempt: '—',
        size: 'live · edge',
        live: true,
      })),
    ...syncQueue,
  ];

  const pending = backend?.pending_sync ?? pendingCount ?? syncMetrics.pending;
  const synced = backend?.cloud_memories ?? 1248;

  const onSync = async () => {
    setSyncMsg('');
    const res = await simulateSync();
    if (res?.queued) setSyncMsg(cloudSimulatedOffline ? 'Cloud offline (simulated) — memories stay queued locally. Restore connection, then Sync now.' : 'Sync queued.');
    else if (res?.ok === false) setSyncMsg(`Sync failed: ${res.error} — edge backend unreachable?`);
    else if (typeof res?.synced_count === 'number') setSyncMsg(`Synced ${res.synced_count} memor${res.synced_count === 1 ? 'y' : 'ies'} to cloud.`);
    loadQueue();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Edge → cloud replication"
        title="Edge Synchronization"
        subtitle="Local-first queue → validate → push to Qdrant Server when online."
        actions={
          <>
            {isOffline ? (
              <Button variant="secondary" size="sm" onClick={restoreConnection}>Restore connection</Button>
            ) : (
              <Button variant="warn" size="sm" onClick={simulateOffline}><WifiOff size={14} /> Simulate cloud offline</Button>
            )}
            <Button size="sm" onClick={onSync} disabled={isSyncing || (isOffline && !USE_MOCK && cloudSimulatedOffline)}>
              {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} {isSyncing ? `Syncing ${Math.round(syncProgress)}%` : 'Sync now'}
            </Button>
          </>
        }
      />

      <Card className="card-enter flex flex-wrap items-center gap-4 p-4">
        <ConnectionIndicator />
        <span className="font-mono text-xs text-slate-400 dark:text-slate-500">EDGE-001 → QDRANT SERVER</span>
        <span className="ml-auto flex items-center gap-2">
          <Badge tone={isOffline ? 'red' : isSyncing ? 'amber' : 'emerald'} dot>
            {isOffline ? 'OFFLINE — QUEUEING' : isSyncing ? 'SYNCING' : 'SYNCED'}
          </Badge>
          <span className="tnum font-mono text-[11px] text-slate-400 dark:text-slate-500">queue depth {pending} · {status}</span>
        </span>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard index={0} accent="amber" live={!!backend} label="Pending" value={String(pending)} sub="awaiting uplink · live" tone="text-amber-600 dark:text-amber-300" />
        <MetricCard index={1} accent="emerald" live={!!backend} label="Synced" value={String(synced)} sub="total vectors on server · live" tone="text-emerald-600 dark:text-emerald-300" />
        <MetricCard index={2} accent="slate" label="Failed" value={syncMetrics.failed} sub="will retry automatically" />
        <MetricCard index={3} accent="orange" label="Conflicts" value={syncMetrics.conflicts} sub="demo dataset" alert />
      </div>
      {syncMsg && (
        <p className="card-enter mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-[11px] text-slate-600 dark:border-white/10 dark:bg-black/30 dark:text-slate-300" role="status">{syncMsg}</p>
      )}

      {/* Sync flow visual */}
      <Card className="card-enter stagger-2 mt-4 p-5">
        <h3 className="font-mono text-[11px] tracking-[0.14em] text-slate-400 uppercase dark:text-slate-400">Sync pipeline</h3>
        <div className="mt-4 flex flex-col items-stretch gap-2 md:flex-row md:items-center">
          {flowStages.map((s, i) => (
            <div key={s.label} className="flex flex-1 flex-col md:flex-row md:items-center">
              <div className={cx(
                'flex flex-1 items-center gap-3 rounded-xl border px-3.5 py-3 transition-all duration-200',
                isSyncing
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : isOffline && i > 1
                    ? 'border-slate-200 bg-slate-50 opacity-60 dark:border-white/10 dark:bg-black/20'
                    : 'border-slate-200 bg-slate-50/60 dark:border-white/10 dark:bg-white/[0.03]'
              )}>
                <span className={cx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  isSyncing ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300' : 'bg-blue-500/10 text-blue-600 dark:bg-cyan-500/10 dark:text-cyan-300'
                )}>
                  <s.icon size={15} className={isSyncing ? 'animate-pulse' : ''} />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold tracking-widest text-slate-700 dark:text-slate-200">{s.label}</p>
                  {isSyncing
                    ? <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-amber-500/20"><div className="h-full rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${syncProgress}%` }} /></div>
                    : <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{i === 0 ? `${pending} staged` : i === 1 ? 'FIFO · hashed' : i === 2 ? 'GLiNER + hash' : `${synced} vectors`}</p>}
                </div>
              </div>
              {i < flowStages.length - 1 && (
                <span className="flex justify-center md:px-1">
                  {isSyncing ? (
                    <svg width="26" height="12" viewBox="0 0 26 12" className="rotate-90 text-amber-500 md:rotate-0"><line x1="0" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth="2" className="qn-flow-line" /></svg>
                  ) : (
                    <ArrowRight size={15} className="rotate-90 text-slate-300 md:rotate-0 dark:text-slate-600" />
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center font-mono text-[11px] text-slate-400 dark:text-slate-500">
          {isOffline ? 'Uplink down — stages 3–4 paused, local writes continue.' : isSyncing ? 'Pushing queue… validating hashes before server write.' : 'Pipeline idle. All local changes reconciled.'}
        </p>
      </Card>

      <Card className="card-enter stagger-3 mt-4 overflow-hidden">
        <CardHeader title="Sync queue" subtitle="Per-memory replication state" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 font-mono text-[10px] tracking-widest text-slate-400 uppercase dark:border-white/10 dark:text-slate-500">
                <th className="px-4 py-2.5">Memory</th><th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Created</th><th className="px-4 py-2.5">Last attempt</th><th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {queue.map((q) => (
                <tr key={q.id} className="qn-table-row transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{q.title} {q.live && <span className="font-mono text-[9px] tracking-widest text-emerald-600 uppercase dark:text-emerald-400">· live</span>}</p>
                    <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{q.id} · {q.size}</p>
                  </td>
                  <td className="px-4 py-2.5"><SyncBadge status={q.status} /></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{q.created}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{q.lastAttempt}</td>
                  <td className="px-4 py-2.5 text-right">
                    {q.status === 'FAILED' || q.status === 'PENDING' ? (
                      <Button variant="secondary" size="sm" onClick={onSync}>Retry</Button>
                    ) : q.status === 'CONFLICT' ? (
                      <Button variant="secondary" size="sm" onClick={() => (window.location.hash = '#/conflicts')}>Review</Button>
                    ) : (
                      <span className="font-mono text-[11px] text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
