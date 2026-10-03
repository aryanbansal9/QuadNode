import { useState } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { useConnection, CONNECTION } from '../context/ConnectionContext';
import { useTheme } from '../context/ThemeContext';
import { cx } from '../utils/format';

function Row({ label, detail, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div><p className="text-sm text-slate-800 dark:text-slate-200">{label}</p>{detail && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{detail}</p>}</div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Seg({ options, value, onChange }) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-black/30" role="radiogroup">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={cx('cursor-pointer rounded-md px-2.5 py-1.5 font-mono text-[11px] tracking-wide uppercase transition-all duration-150', value === o ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300')}>
          {o}
        </button>
      ))}
    </div>
  );
}

const themeOptions = [
  { id: 'light', label: 'Light', icon: Sun, hint: 'Clean off-white surfaces' },
  { id: 'dark', label: 'Dark', icon: Moon, hint: 'Deep ops-console charcoal' },
  { id: 'system', label: 'System', icon: Monitor, hint: 'Follows your OS setting' },
];

export default function Settings() {
  const { status, setStatus, simulateOffline, restoreConnection } = useConnection();
  const { preference, setPreference, resolved } = useTheme();
  const [memPolicy, setMemPolicy] = useState('AUTO CLASSIFY');
  const [aiModel, setAiModel] = useState('Llama 3.1 8B');
  const [embModel, setEmbModel] = useState('Nomic Embed v1.5');
  const [saved, setSaved] = useState(false);

  const netMode = status === CONNECTION.OFFLINE ? 'Offline' : status === CONNECTION.SYNCING ? 'Auto' : 'Online';

  return (
    <div>
      <PageHeader eyebrow="Device configuration" title="Settings" subtitle="Prototype device configuration. No destructive system actions." actions={<Button size="sm" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>{saved ? 'Saved ✓' : 'Save settings'}</Button>} />

      {/* Appearance — the polished theme section */}
      <Card className="card-enter overflow-hidden">
        <CardHeader title="Appearance" subtitle="Theme applies instantly across shell, pages and charts" right={<Badge tone={resolved === 'dark' ? 'violet' : 'blue'} dot>Active · {resolved}</Badge>} />
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {themeOptions.map((t) => {
            const active = preference === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setPreference(t.id)}
                className={cx(
                  'group cursor-pointer rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-px',
                  active
                    ? 'border-blue-500/60 bg-blue-500/[0.06] shadow-[0_8px_24px_-12px_rgba(37,99,235,0.5)] dark:border-cyan-400/50 dark:bg-cyan-400/[0.06] dark:shadow-[0_8px_24px_-12px_rgba(34,211,238,0.4)]'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm dark:border-white/10 dark:hover:border-white/20'
                )}
                role="radio"
                aria-checked={active}
              >
                {/* Mini preview */}
                <span className={cx(
                  'mb-3 block h-16 overflow-hidden rounded-lg border',
                  t.id === 'light' ? 'border-slate-200 bg-[#F6F8FB]' : t.id === 'dark' ? 'border-white/10 bg-[#070A0F]' : 'border-slate-300 bg-gradient-to-r from-[#F6F8FB] from-50% to-[#070A0F] to-50%'
                )}>
                  <span className={cx('m-2 block h-2 w-2/3 rounded-full', t.id === 'dark' ? 'bg-cyan-400/70' : 'bg-blue-500/60')} />
                  <span className={cx('mx-2 block h-6 rounded-md border', t.id === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white')} />
                </span>
                <span className="flex items-center gap-2">
                  <t.icon size={14} className={active ? 'text-blue-600 dark:text-cyan-300' : 'text-slate-400'} />
                  <span className={cx('text-sm font-semibold', active ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300')}>{t.label}</span>
                  {active && <Check size={13} className="ml-auto text-blue-600 dark:text-cyan-300" />}
                </span>
                <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">{t.hint}</span>
              </button>
            );
          })}
        </div>
        <p className="border-t border-slate-200 px-4 py-2.5 font-mono text-[11px] text-slate-400 dark:border-white/10 dark:text-slate-500">
          Preference persists in localStorage · charts, badges and status lights adapt automatically.
        </p>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="card-enter stagger-1">
          <CardHeader title="Device information" />
          <div className="divide-y divide-slate-200/70 dark:divide-white/10">
            <Row label="Device ID" detail="Provisioned edge node"><span className="font-mono text-xs text-slate-700 dark:text-slate-300">EDGE-001</span></Row>
            <Row label="Site" detail="Pump hall controller"><span className="font-mono text-xs text-slate-700 dark:text-slate-300">Hall B · Rack 4</span></Row>
            <Row label="Qdrant Edge" detail="Local vector endpoint"><span className="font-mono text-xs text-slate-700 dark:text-slate-300">127.0.0.1:6333</span></Row>
            <Row label="Qdrant Server" detail="Cloud sync target"><span className="font-mono text-xs text-slate-700 dark:text-slate-300">sync.quadnode.internal:6333</span></Row>
          </div>
        </Card>

        <Card className="card-enter stagger-2">
          <CardHeader title="Models" />
          <div className="divide-y divide-slate-200/70 dark:divide-white/10">
            <Row label="AI model" detail="On-device inference"><Seg options={['Llama 3.1 8B', 'Phi-3 Mini']} value={aiModel} onChange={setAiModel} /></Row>
            <Row label="Embedding model" detail="Local vectorizer · 768 dims"><Seg options={['Nomic Embed v1.5', 'MiniLM-L6']} value={embModel} onChange={setEmbModel} /></Row>
          </div>
        </Card>

        <Card className="card-enter stagger-2">
          <CardHeader title="Memory policy" subtitle="Default for newly created memories" right={<Badge tone="cyan">{memPolicy}</Badge>} />
          <div className="space-y-2 p-4">
            {[
              ['LOCAL ONLY', 'Never leaves the device.'],
              ['SYNC ALLOWED', 'Eligible for server replication.'],
              ['AUTO CLASSIFY', 'Heuristic: sensitive stays local. (Recommended)'],
            ].map(([v, d]) => (
              <button key={v} onClick={() => setMemPolicy(v)} className={`w-full cursor-pointer rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150 ${memPolicy === v ? 'border-blue-500/50 bg-blue-500/[0.06] dark:border-cyan-500/50 dark:bg-cyan-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'}`}>
                <p className={`font-mono text-xs font-semibold tracking-widest ${memPolicy === v ? 'text-blue-700 dark:text-cyan-200' : 'text-slate-600 dark:text-slate-300'}`}>{v}</p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{d}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="card-enter stagger-3">
          <CardHeader title="Network & synchronization" />
          <div className="divide-y divide-slate-200/70 dark:divide-white/10">
            <Row label="Network mode" detail="Offline forces local-only operation">
              <Seg options={['Online', 'Offline', 'Auto']} value={netMode} onChange={(v) => {
                if (v === 'Offline') simulateOffline();
                else if (v === 'Online') restoreConnection();
                else setStatus(CONNECTION.ONLINE);
              }} />
            </Row>
            <Row label="Auto-sync on reconnect" detail="Push queue when uplink returns"><Seg options={['On', 'Off']} value="On" onChange={() => {}} /></Row>
            <Row label="Conflict strategy" detail="Default when versions diverge"><Seg options={['Manual', 'Local wins', 'Server wins']} value="Manual" onChange={() => {}} /></Row>
          </div>
        </Card>
      </div>
    </div>
  );
}
