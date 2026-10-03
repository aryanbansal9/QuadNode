import { Cpu, MapPin } from 'lucide-react';
import { PageHeader, Card } from '../components/common/Card';
import Badge from '../components/common/Badge';
import ProgressBar from '../components/common/ProgressBar';
import { devices } from '../data/devices';

export default function Devices() {
  return (
    <div>
      <PageHeader eyebrow="Fleet telemetry" title="Devices" subtitle="Edge fleet — local AI + Qdrant Edge per node. Multi-device sync ready." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {devices.map((d, i) => {
          const online = d.status === 'ONLINE';
          return (
            <Card key={d.id} hover className={`card-enter p-5 stagger-${Math.min(i + 1, 4)} ${!online ? 'opacity-90' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                    <Cpu size={17} className={online ? 'text-blue-600 dark:text-cyan-300' : 'text-slate-400 dark:text-slate-500'} />
                  </span>
                  <div>
                    <p className="flex items-center gap-1.5 font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                      {d.id}
                      {online && <span className="status-dot-live inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500"><MapPin size={10} /> {d.location}</p>
                  </div>
                </div>
                <Badge tone={online ? 'emerald' : 'red'} dot={online}>{d.status}</Badge>
              </div>

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{d.name.split('·')[1]?.trim()}</p>

              {online ? (
                <div className="mt-4 space-y-3">
                  {[
                    ['CPU', d.cpu], ['Memory', d.memory], ['Storage', d.storage],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div className="mb-1 flex justify-between font-mono text-[11px]"><span className="text-slate-400 uppercase dark:text-slate-500">{l}</span><span className="tnum text-slate-700 dark:text-slate-200">{v}%</span></div>
                      <ProgressBar value={v} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-[11px] text-slate-400 dark:border-white/10 dark:bg-black/30 dark:text-slate-500">
                  Last seen {d.lastSeen} · local queue preserved on device
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-200 pt-3 dark:border-white/10">
                <Badge tone={d.aiActive ? 'emerald' : 'slate'}>Local AI {d.aiActive ? 'active' : 'idle'}</Badge>
                <Badge tone={d.qdrantActive ? 'emerald' : 'slate'}>Qdrant Edge {d.qdrantActive ? 'active' : 'idle'}</Badge>
                <span className="ml-auto font-mono text-[10px] text-slate-300 self-center dark:text-slate-600">{d.model}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
