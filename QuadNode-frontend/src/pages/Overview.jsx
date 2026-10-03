import { Database, RefreshCw, GitBranch, MessageSquare, HardDrive, WifiOff, CheckCircle2, AlertTriangle, Cloud } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PageHeader, Card, CardHeader } from '../components/common/Card';
import MetricCard from '../components/common/MetricCard';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import ProgressBar from '../components/common/ProgressBar';
import { dashboardStats, systemStatus, memoryActivity, deviceHealth } from '../data/dashboard';
import { useConnection } from '../context/ConnectionContext';
import { useTheme } from '../context/ThemeContext';

const iconFor = (kind) => {
  switch (kind) {
    case 'document': return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300';
    case 'ai': return 'bg-violet-500/15 text-violet-600 dark:text-violet-300';
    case 'offline': return 'bg-red-500/15 text-red-500 dark:text-red-300';
    case 'online': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
    case 'sync': return 'bg-amber-500/15 text-amber-600 dark:text-amber-300';
    default: return 'bg-slate-500/15 text-slate-500 dark:text-slate-300';
  }
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="qn-chart-tooltip">
      <p className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      <p className="tnum mt-0.5 font-mono text-xs text-blue-600 dark:text-cyan-300">{payload[0].value} vectors</p>
    </div>
  );
}

export default function Overview() {
  const { isOffline, simulateOffline, restoreConnection, simulateSync, isSyncing, backend, pendingCount, edgeAvailable } = useConnection();
  const { isDark } = useTheme();
  
  // LIVE HYBRID MAPPING: Uses actual FastAPI schema if available, otherwise mock.
  const edgeMemories = backend?.edge?.total ?? dashboardStats.localMemories;
  const pending = backend?.edge?.PENDING ?? pendingCount ?? dashboardStats.pendingSync;
  const cloudMemories = backend?.cloud_memories ?? 1248;
  const localSecured = backend?.edge?.LOCAL_ONLY ?? 312;

  const dist = [
    { name: 'Edge', value: edgeMemories, color: isDark ? '#22d3ee' : '#2563eb' },
    { name: 'Cloud', value: cloudMemories, color: isDark ? '#818cf8' : '#7c3aed' },
    { name: 'Pending', value: pending, color: '#f59e0b' },
    { name: 'Local-only', value: localSecured, color: isDark ? '#64748b' : '#94a3b8' },
  ];
  const grid = isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0';
  const tick = isDark ? '#64748b' : '#94a3b8';

  return (
    <div>
      <PageHeader
        eyebrow="Edge operations · EDGE-001"
        title="Edge Intelligence"
        subtitle="Monitor memory, AI activity, connectivity and synchronization."
        actions={
          <>
            {isOffline ? (
              <Button variant="secondary" size="sm" onClick={restoreConnection}>Restore connection</Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={simulateOffline}><WifiOff size={14} /> Simulate cloud offline</Button>
            )}
            <Button size="sm" onClick={simulateSync} disabled={isSyncing || isOffline}>
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'Syncing…' : 'Sync now'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <MetricCard index={0} accent="blue" live={!!backend} label="Edge Memories" value={String(edgeMemories)} sub={backend ? 'live · Qdrant Edge' : '+12 this week'} icon={Database} />
        <MetricCard index={1} accent="amber" live={!!backend} label="Pending Sync" value={String(pending)} sub="queued for server" icon={RefreshCw} tone="text-amber-600 dark:text-amber-300" />
        <MetricCard index={2} accent="orange" label="Conflicts" value={backend?.edge?.CONFLICT ?? dashboardStats.conflicts} sub="needs review" icon={GitBranch} tone="text-orange-600 dark:text-orange-300" alert />
        <MetricCard index={3} accent="violet" label="AI Queries" value={dashboardStats.aiQueries} sub="last 30 days · local" icon={MessageSquare} />
        <MetricCard index={4} accent="slate" label="Storage" value="68%" sub="41.2 GB of 60 GB" icon={HardDrive} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Memory distribution chart */}
        <Card className="card-enter stagger-3 lg:col-span-2">
          <CardHeader title="Memory distribution" subtitle={backend ? 'live · GET /status' : 'demo snapshot'} right={<Cloud size={14} className="text-slate-400" />} />
          <div className="h-[228px] px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist} margin={{ top: 4, right: 8, bottom: 0, left: -14 }} barCategoryGap="28%">
                <CartesianGrid stroke={grid} strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: tick, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: tick, fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }} />
                <Bar dataKey="value" radius={[5, 5, 2, 2]} animationDuration={600}>
                  {dist.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        
        {/* Device health (Retained Frontend Feature) */}
        <Card className="card-enter stagger-3">
          <CardHeader title="Edge Device Health" subtitle="EDGE-001 · live" />
          <div className="space-y-4 px-4 py-4">
            {[
              { label: 'CPU', v: deviceHealth.cpu },
              { label: 'Memory', v: deviceHealth.memory },
              { label: 'Storage', v: deviceHealth.storage },
            ].map((r) => (
              <div key={r.label}>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-mono tracking-wider text-slate-400 uppercase dark:text-slate-400">{r.label}</span>
                  <span className="tnum font-mono text-slate-700 dark:text-slate-200">{r.v}%</span>
                </div>
                <ProgressBar value={r.v} tone={r.v > 80 ? 'bg-red-500' : r.v > 60 ? 'bg-amber-500' : 'bg-blue-500 dark:bg-cyan-400'} />
              </div>
            ))}
            <dl className="space-y-2 border-t border-slate-200 pt-3 text-xs dark:border-white/10">
              <div className="flex justify-between"><dt className="text-slate-400 dark:text-slate-500">Local model</dt><dd className="font-mono text-slate-700 dark:text-slate-300">{backend?.llm_model ?? deviceHealth.localModel}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400 dark:text-slate-500">Uptime</dt><dd className="tnum font-mono text-slate-700 dark:text-slate-300">{deviceHealth.uptime}</dd></div>
            </dl>
          </div>
        </Card>
      </div>
    </div>
  );
}