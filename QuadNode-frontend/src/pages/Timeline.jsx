import { FileText, Database, Cpu, Download, WifiOff, Wifi, RefreshCw, GitBranch, CheckCircle2 } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '../components/common/Card';
import Badge from '../components/common/Badge';
import { timelineEvents } from '../data/timeline';

const kindIcon = {
  document: { Icon: FileText, cls: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300', label: 'cyan' },
  memory: { Icon: Database, cls: 'border-slate-300 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300', label: 'slate' },
  ai: { Icon: Cpu, cls: 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300', label: 'violet' },
  retrieval: { Icon: Download, cls: 'border-slate-300 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300', label: 'slate' },
  offline: { Icon: WifiOff, cls: 'border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-300', label: 'red' },
  online: { Icon: Wifi, cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', label: 'emerald' },
  sync: { Icon: RefreshCw, cls: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300', label: 'amber' },
  conflict: { Icon: GitBranch, cls: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300', label: 'orange' },
};

export default function Timeline() {
  return (
    <div>
      <PageHeader eyebrow="Audit trail" title="Timeline" subtitle="Full lifecycle of edge memory — from ingestion to resolution." />

      <Card className="card-enter overflow-hidden">
        <CardHeader title="Memory lifecycle" subtitle="EDGE-001 · Sep 29, 2026" right={<Badge tone="emerald"><CheckCircle2 size={11} /> 11 events</Badge>} />
        <ol className="px-5 py-4">
          {timelineEvents.map((e, i) => {
            const k = kindIcon[e.kind] || kindIcon.memory;
            return (
              <li key={i} className="group relative flex gap-4 pb-6 last:pb-1">
                {i < timelineEvents.length - 1 && <span className="absolute top-9 left-[15px] h-[calc(100%-2rem)] w-px bg-slate-200 transition-colors group-hover:bg-blue-400/60 dark:bg-white/10" />}
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
