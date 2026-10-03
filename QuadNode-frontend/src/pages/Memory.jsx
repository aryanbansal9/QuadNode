import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Database } from 'lucide-react';
import { PageHeader, Card } from '../components/common/Card';
import Badge, { SyncBadge } from '../components/common/Badge';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { Drawer, Modal } from '../components/common/Modal';
import { memories, memoryFilters } from '../data/memories';
import { useConnection } from '../context/ConnectionContext';
import { shortHash } from '../utils/format';
import { memoryService } from '../api/services';
import { USE_MOCK } from '../api/client';

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
  // Backend-native row: {id,text,source,sync_status,timestamp}
  if (m && (m.sync_status || m.timestamp !== undefined)) {
    const syncStatus = m.sync_status || 'UNKNOWN';
    const ts = m.timestamp ? new Date(m.timestamp * 1000).toISOString() : new Date().toISOString();
    return {
      id: m.id,
      text: m.text,
      type: 'Observation',
      source: m.source || 'manual_entry',
      created: ts,
      updated: ts,
      device: 'EDGE-001',
      privacy: syncStatus === 'LOCAL_ONLY' ? 'LOCAL ONLY' : 'SYNC ALLOWED',
      syncStatus,
      version: 1,
      hash: m.id,
      real: true,
    };
  }
  return m;
}

export default function Memory() {
  const { markDirty, refreshStatus } = useConnection();
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [items, setItems] = useState(memories);
  const [draft, setDraft] = useState({ text: '', type: 'Observation', privacy: 'SYNC ALLOWED' });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  // Load real edge memories once (kept alongside demo seeds so UI never looks empty).
  useEffect(() => {
    if (USE_MOCK) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const real = await memoryService.list(100);
        if (!cancelled && Array.isArray(real) && real.length) {
          const mapped = real.map(toUiMemory);
          setItems((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            return [...mapped.filter((m) => !ids.has(m.id)), ...prev];
          });
        }
      } catch {
        if (!cancelled) setLoadError('Edge backend unreachable — showing demo seeds. Start backend on :8000.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(
    () => items.filter((m) => matchFilter(m, filter) && (m.text.toLowerCase().includes(query.toLowerCase()) || m.id.toLowerCase().includes(query.toLowerCase()))),
    [items, filter, query]
  );

  const stats = useMemo(() => ({
    total: items.length + 1241,
    localOnly: items.filter((m) => m.privacy === 'LOCAL ONLY').length,
    syncAllowed: items.filter((m) => m.privacy === 'SYNC ALLOWED').length,
    pending: items.filter((m) => m.syncStatus === 'PENDING' || m.syncStatus === 'CONFLICT').length,
  }), [items]);

  const createMemory = async () => {
    if (!draft.text.trim() || saving) return;
    if (USE_MOCK) {
      const mem = {
        id: `MEM-${1843 + items.length}`,
        text: draft.text.trim(),
        type: draft.type,
        source: 'Manual entry · EDGE-001',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        device: 'EDGE-001',
        privacy: draft.privacy,
        syncStatus: draft.privacy === 'LOCAL ONLY' ? 'LOCAL ONLY' : 'PENDING',
        version: 1,
        hash: Math.random().toString(16).slice(2, 18),
      };
      setItems((l) => [mem, ...l]);
      if (mem.syncStatus === 'PENDING') markDirty();
      setDraft({ text: '', type: 'Observation', privacy: 'SYNC ALLOWED' });
      setCreateOpen(false);
      return;
    }
    // Real backend: POST /ingest decides PENDING vs LOCAL_ONLY via GLiNER.
    setSaving(true);
    try {
      const res = await memoryService.create({ text: draft.text.trim(), source: 'manual_entry' });
      const state = res.sync_state || 'PENDING';
      const mem = {
        id: res.id,
        text: draft.text.trim(),
        type: draft.type,
        source: 'manual_entry · EDGE-001',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        device: 'EDGE-001',
        privacy: state === 'LOCAL_ONLY' ? 'LOCAL ONLY' : 'SYNC ALLOWED',
        syncStatus: state,
        version: 1,
        hash: res.id,
        real: true,
      };
      setItems((l) => [mem, ...l]);
      refreshStatus?.();
      setDraft({ text: '', type: 'Observation', privacy: 'SYNC ALLOWED' });
      setCreateOpen(false);
    } catch {
      // Edge unreachable: keep locally so demo can continue, clearly marked.
      const mem = {
        id: `LOCAL-${Date.now()}`,
        text: draft.text.trim(),
        type: draft.type,
        source: 'Manual entry · EDGE-001 (edge unreachable, UI-only)',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        device: 'EDGE-001',
        privacy: draft.privacy,
        syncStatus: 'PENDING',
        version: 1,
        hash: 'unreachable',
      };
      setItems((l) => [mem, ...l]);
      markDirty();
      setCreateOpen(false);
    } finally {
      setSaving(false);
    }
  };

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
          ['Total memories', '1,248', 'blue'],
          ['Local only', String(312 + stats.localOnly), 'slate'],
          ['Sync allowed', String(929 + stats.syncAllowed), 'cyan'],
          ['Pending sync', String(4 + stats.pending), 'amber'],
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
        {(loading || loadError) && (
          <p className="border-b border-slate-200 px-4 py-2 font-mono text-[11px] text-slate-400 dark:border-white/10 dark:text-slate-500">
            {loading ? 'Loading edge memories from GET /memories…' : loadError}
          </p>
        )}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center dark:border-white/10">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search memories…"
              className="qn-input w-full rounded-lg py-2 pr-3 pl-9 text-sm"
              aria-label="Search memories"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Memory filters">
            {memoryFilters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`cursor-pointer rounded-lg border px-2.5 py-1.5 font-mono text-[11px] tracking-wide uppercase transition-all duration-150 ${filter === f ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-200' : 'border-slate-200 bg-transparent text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:border-white/10 dark:text-slate-400 dark:hover:border-white/20 dark:hover:text-slate-200'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No memories match" detail="Adjust the filter or search query." icon={Search} />
        ) : (
          <ul className="divide-y divide-slate-200/70 dark:divide-white/10">
            {filtered.map((m) => (
              <li key={m.id}>
                <button onClick={() => setSelected(m)} className="qn-table-row grid w-full cursor-pointer gap-2 px-4 py-3 text-left hover:bg-slate-50 lg:grid-cols-[1fr_auto] lg:items-center dark:hover:bg-white/[0.03]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] font-semibold text-blue-600 dark:text-cyan-300">{m.real ? shortHash(m.id) : m.id}</span>
                      {m.real && <span className="font-mono text-[9px] tracking-widest text-emerald-600 uppercase dark:text-emerald-400">· live</span>}
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

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `Memory ${selected.real ? shortHash(selected.id) : selected.id}` : ''}>
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
                ['Memory ID', selected.real ? selected.id : selected.id], ['Source', selected.source],
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
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-500 dark:text-slate-400">Type
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className="qn-input mt-1.5 w-full rounded-lg p-2 text-sm">
                <option>Observation</option><option>Document</option><option>AI Generated</option>
              </select>
            </label>
            <label className="block text-xs text-slate-500 dark:text-slate-400">Privacy
              <select value={draft.privacy} onChange={(e) => setDraft({ ...draft, privacy: e.target.value })} className="qn-input mt-1.5 w-full rounded-lg p-2 text-sm">
                <option>SYNC ALLOWED</option><option>LOCAL ONLY</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createMemory} disabled={!draft.text.trim() || saving}>{saving ? 'Storing…' : 'Store locally'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
