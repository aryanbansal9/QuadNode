import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Database } from 'lucide-react';
import { PageHeader, Card } from '../components/common/Card';
import Badge, { SyncBadge } from '../components/common/Badge';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { Drawer, Modal } from '../components/common/Modal';
import { useConnection } from '../context/ConnectionContext';
import { shortHash } from '../utils/format';
import { memoryService } from '../api/services';

const memoryFilters = ['All', 'Local Only', 'Sync Allowed', 'Pending Sync', 'Documents', 'Observations', 'AI Generated'];

function matchFilter(m, f) {
  switch (f) {
    case 'Local Only': return m.privacy === 'LOCAL ONLY';
    case 'Sync Allowed': return m.privacy === 'SYNC ALLOWED';
    case 'Pending Sync': return m.syncStatus === 'PENDING' || m.syncStatus === 'CONFLICT';
    case 'Documents': return m.type === 'Document';
    case 'Observations': return m.type === 'Observation';
    case 'AI Generated': return m.type === 'AI Generated';
    default: return true;
  }
}

function toUiMemory(m) {
  if (m && m.sync_status) {
    const ts = m.updated_at ? new Date(m.updated_at * 1000).toISOString() : new Date().toISOString();
    return {
      id: m.id,
      text: m.text,
      type: m.source?.includes('.pdf') || m.source?.includes('.txt') ? 'Document' : 'Observation',
      source: m.source || 'manual_entry',
      created: ts,
      updated: ts,
      device: 'EDGE-001',
      privacy: m.sync_status === 'LOCAL_ONLY' ? 'LOCAL ONLY' : 'SYNC ALLOWED',
      syncStatus: m.sync_status,
      version: m.version || 1,
      hash: m.content_hash || m.id,
      real: true,
    };
  }
  return m;
}

export default function Memory() {
  const { markDirty, refreshStatus, backend } = useConnection();
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [items, setItems] = useState([]); // STRICTLY EMPTY ON LOAD
  const [draft, setDraft] = useState({ text: '', type: 'Observation', privacy: 'SYNC ALLOWED' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchMemories = async () => {
      try {
        const res = await memoryService.list(100);
        if (!cancelled && res && Array.isArray(res.items)) {
          setItems(res.items.map(toUiMemory));
        }
      } catch (err) {
        console.error('Failed to load live memories', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchMemories();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(
    () => items.filter((m) => matchFilter(m, filter) && (m.text.toLowerCase().includes(query.toLowerCase()) || m.id.toLowerCase().includes(query.toLowerCase()))),
    [items, filter, query]
  );

  const createMemory = async () => {
    if (!draft.text.trim() || saving) return;
    setSaving(true);
    try {
      const res = await memoryService.create({ text: draft.text.trim(), source: 'manual_entry' });
      // Fetch latest memory list to ensure UI matches DB exactly
      const latest = await memoryService.list(100);
      if (latest && Array.isArray(latest.items)) {
         setItems(latest.items.map(toUiMemory));
      }
      refreshStatus?.();
      setDraft({ text: '', type: 'Observation', privacy: 'SYNC ALLOWED' });
      setCreateOpen(false);
    } catch (err) {
      console.error('Failed to save memory to backend', err);
    } finally {
      setSaving(false);
    }
  };

  // TRUE KPI DATA directly from the backend status object
  const liveTotal = backend?.edge?.total || 0;
  const liveLocal = backend?.edge?.LOCAL_ONLY || 0;
  const liveSyncAllowed = liveTotal - liveLocal;
  const livePending = backend?.edge?.PENDING || 0;

  return (
    <div>
      <PageHeader
        eyebrow="On-device vector store"
        title="Local Memory"
        subtitle="Everything the edge device currently remembers."
        actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> Create memory</Button>}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ['Total memories', liveTotal, 'blue'],
          ['Local only', liveLocal, 'slate'],
          ['Sync allowed', liveSyncAllowed, 'cyan'],
          ['Pending sync', livePending, 'amber'],
        ].map(([l, v, a], i) => (
          <Card key={l} hover className={`card-enter px-4 py-3 stagger-${Math.min(i + 1, 4)}`}>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${a === 'blue' ? 'bg-blue-500 dark:bg-cyan-400' : a === 'amber' ? 'bg-amber-500' : a === 'cyan' ? 'bg-cyan-500' : 'bg-slate-400'}`} />
              <p className="font-mono text-[11px] tracking-widest text-slate-400 uppercase dark:text-slate-500">{l}</p>
            </div>
            <p className="tnum mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{v}</p>
          </Card>
        ))}
      </div>

      <Card className="card-enter stagger-2 mt-4 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center dark:border-white/10">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search memories…"
              className="qn-input w-full rounded-lg py-2 pr-3 pl-9 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {memoryFilters.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`cursor-pointer rounded-lg border px-2.5 py-1.5 font-mono text-[11px] tracking-wide uppercase transition-all duration-150 ${filter === f ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-200' : 'border-slate-200 bg-transparent text-slate-400 hover:border-slate-300 dark:border-white/10 dark:text-slate-400'}`}>{f}</button>
            ))}
          </div>
        </div>

        {loading ? (
           <p className="p-4 font-mono text-xs text-slate-400">Loading live vectors from Edge...</p>
        ) : filtered.length === 0 ? (
          <EmptyState title="No memories match" detail="Database is empty or filter yielded no results." icon={Search} />
        ) : (
          <ul className="divide-y divide-slate-200/70 dark:divide-white/10">
            {filtered.map((m) => (
              <li key={m.id}>
                <button onClick={() => setSelected(m)} className="qn-table-row grid w-full cursor-pointer gap-2 px-4 py-3 text-left hover:bg-slate-50 lg:grid-cols-[1fr_auto] lg:items-center dark:hover:bg-white/[0.03]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] font-semibold text-blue-600 dark:text-cyan-300">{shortHash(m.id)}</span>
                      <span className="font-mono text-[9px] tracking-widest text-emerald-600 uppercase dark:text-emerald-400">· live</span>
                      <Badge tone="slate">{m.type}</Badge>
                      <SyncBadge status={m.privacy} />
                      <SyncBadge status={m.syncStatus} />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-700 dark:text-slate-200">{m.text}</p>
                    <p className="mt-1 flex items-center gap-1 font-mono text-[11px] text-slate-400 dark:text-slate-500"><Database size={10} /> {m.source} · {m.device}</p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{new Date(m.created).toLocaleDateString()} →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `Memory ${shortHash(selected.id)}` : ''}>
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge>{selected.type}</Badge>
              <SyncBadge status={selected.privacy} />
              <SyncBadge status={selected.syncStatus} />
            </div>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{selected.text}</p>
            <dl className="space-y-2 border-t border-slate-200 pt-4 font-mono text-xs dark:border-white/10">
              {[
                ['Memory ID', selected.id], ['Source', selected.source],
                ['Created', new Date(selected.created).toLocaleString()], ['Updated', new Date(selected.updated).toLocaleString()],
                ['Device', selected.device], ['Privacy policy', selected.privacy],
                ['Sync status', selected.syncStatus], ['Version', `v${selected.version}`],
                ['Hash', shortHash(selected.hash)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-400 dark:text-slate-500">{k}</dt>
                  <dd className="text-right break-all text-slate-700 dark:text-slate-300">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Drawer>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create memory">
        <div className="space-y-3">
          <label className="block text-xs text-slate-500 dark:text-slate-400">Memory text
            <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={4}
              placeholder="Observation, note, reading…" className="qn-input mt-1.5 w-full rounded-lg p-2.5 text-sm" />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createMemory} disabled={!draft.text.trim() || saving}>{saving ? 'Storing…' : 'Store locally'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}