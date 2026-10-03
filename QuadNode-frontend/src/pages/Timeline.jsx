import { useEffect, useState } from 'react';
import { FileText, Database, Cpu, Download, WifiOff, Wifi, RefreshCw, GitBranch, CheckCircle2, ShieldAlert } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '../components/common/Card';
import Badge from '../components/common/Badge';
import { timelineEvents as seedEvents } from '../data/timeline';
import { memoryService } from '../api/services';

const kindIcon = {
  memory_ingested: { Icon: FileText, cls: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600', label: 'cyan' },
  memory_updated: { Icon: Database, cls: 'border-blue-500/30 bg-blue-500/10 text-blue-600', label: 'blue' },
  network: { Icon: Wifi, cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600', label: 'emerald' },
  network_offline: { Icon: WifiOff, cls: 'border-red-500/30 bg-red-500/10 text-red-500', label: 'red' },
  sync_pushed: { Icon: RefreshCw, cls: 'border-amber-500/30 bg-amber-500/10 text-amber-600', label: 'amber' },
  privacy_quarantine: { Icon: ShieldAlert, cls: 'border-red-500/30 bg-red-500/10 text-red-600', label: 'red' }
};

export default function Timeline() {
  const [events, setEvents] = useState(seedEvents);
  
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await memoryService.activity(20);
        if (res && res.items) {
          const mappedLogs = res.items.map(log => {
            const isOffline = log.type === 'network' && log.forced;
            const isQuarantine = log.status === 'LOCAL_ONLY';
            
            let kind = log.type;
            if (isOffline) kind = 'network_offline';
            if (isQuarantine) kind = 'privacy_quarantine';

            return {
              time: new Date(log.timestamp * 1000).toLocaleTimeString(),
              title: isQuarantine ? 'Privacy Guard Triggered' : log.type.replace('_', ' ').toUpperCase(),
              kind: kind,
              detail: log.source ? `Processed ${log.source}` : JSON.stringify(log),
              device: 'EDGE-001'
            };
          });
          setEvents(prev => [...mappedLogs, ...prev]);
        }
      } catch (e) {
        console.warn("Could not fetch live audit logs");
      }
    };
    fetchLogs();
  }, []);

  return (
    <div>
      <PageHeader eyebrow="Audit trail" title="Timeline" subtitle="Full lifecycle of edge memory — from ingestion to resolution." />

      <Card className="card-enter overflow-hidden">
        <CardHeader title="System Activity Logs" subtitle="Live API telemetry" right={<Badge tone="emerald"><CheckCircle2 size={11} /> Live</Badge>} />
        <ol className="px-5 py-4">
          {events.map((e, i) => {
            const k = kindIcon[e.kind] || { Icon: Database, cls: 'border-slate-300 bg-slate-100 text-slate-500', label: 'slate' };
            return (
              <li key={i} className="group relative flex gap-4 pb-6 last:pb-1">
                {i < events.length - 1 && <span className="absolute top-9 left-[15px] h-[calc(100%-2rem)] w-px bg-slate-200 transition-colors group-hover:bg-blue-400/60 dark:bg-white/10" />}
                <span className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-transform duration-150 group-hover:scale-110 ${k.cls}`}>
                  <k.Icon size={14} />
                </span>
                <div className="min-w-0 flex-1 rounded-lg pt-0.5 transition-colors group-hover:bg-slate-50 dark:group-hover:bg-white/[0.02]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="tnum font-mono text-[11px] text-slate-400 dark:text-slate-500">{e.time}</span>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{e.title}</p>
                    <Badge tone={k.label}>{e.kind}</Badge>
                  </div>
                  <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{e.detail}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-300 dark:text-slate-600">{e.device}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}