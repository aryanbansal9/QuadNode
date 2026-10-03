import { useState, useEffect } from 'react';
import { GitBranch, Sparkles, Check, Plus } from 'lucide-react';
import { PageHeader, Card } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { useConnection } from '../context/ConnectionContext';
import { conflictService } from '../api/services';

export default function Conflicts() {
  const { markDirty } = useConnection();
  const [items, setItems] = useState([]);
  const [resolved, setResolved] = useState([]);

  // Fetch real conflicts from FastAPI
  useEffect(() => {
    const fetchConflicts = async () => {
      try {
        const res = await conflictService.list();
        if (res.items && res.items.length > 0) {
          const mapped = res.items.map(c => ({
            id: c.id,
            memoryId: c.content_hash || 'Unknown Hash',
            title: c.source || 'Unknown Source',
            local: { text: c.text, updated: 'Just now', author: 'EDGE-001', version: c.version },
            cloud: { text: c.conflict_remote?.text || 'Unavailable', updated: 'Unknown', author: 'Cloud', version: c.synced_version },
            aiRecommendation: 'Manual review required based on divergent edit histories.',
            confidence: 50,
            status: 'OPEN'
          }));
          setItems(mapped);
        }
      } catch (err) {
        console.warn("Could not fetch conflicts");
      }
    };
    fetchConflicts();
  }, []);

  const resolve = async (id, how) => {
    try {
      // Map UI logic to FastAPI strategy schema
      let strategy = "keep_both";
      if (how === 'KEPT LOCAL') strategy = "keep_local";
      if (how === 'KEPT CLOUD') strategy = "keep_remote";
      
      // If it's a real ID from the backend, call the API
      if (!id.startsWith("CF-")) {
        await conflictService.resolve(id, strategy);
        markDirty();
      }
      
      setItems((l) => l.filter((c) => c.id !== id));
      setResolved((r) => [...r, { id: id.slice(0,8), how, at: new Date().toLocaleTimeString() }]);
    } catch (err) {
      console.error("Conflict resolution failed", err);
    }
  };

  const createDemo = () => {
    const c = {
      id: `CF-${String(items.length + resolved.length + 1).padStart(3, '0')}`,
      memoryId: 'MEM-1804',
      title: 'SPARE STOCK — SKF 6311 count',
      local: { text: '2 units in cage C-14. One reserved for P-204 rebuild.', updated: 'Just now', author: 'EDGE-001 · Stores scan', version: 2 },
      cloud: { text: '3 units in cage C-14 per last central audit.', updated: 'Yesterday', author: 'Qdrant Server · Audit import', version: 1 },
      aiRecommendation: 'Keep local count — edge scan is newer than the central audit and references a reservation the server cannot see.',
      confidence: 82,
      status: 'OPEN',
    };
    setItems((l) => [c, ...l]);
  };

  // ... (Keep the exact same JSX return statement from your original file)
  return (
    // Your exact UI code for rendering conflicts goes here
    <div>
      <PageHeader
        eyebrow="Divergence review"
        title="Memory Conflicts"
        subtitle="Same memory diverged on edge and server. Operator decides; AI only recommends."
        actions={<Button variant="secondary" size="sm" onClick={createDemo}><Plus size={14} /> Create conflict (demo)</Button>}
      />
      {/* ... rest of your UI ... */}
      <p className="card-enter mb-3 rounded-xl border border-slate-200 bg-white px-4 py-2 font-mono text-[11px] text-slate-400 dark:border-white/10 dark:bg-black/30 dark:text-slate-500">
        Demo dataset — operator decision authoritative. Live Sync triggers available.
      </p>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={GitBranch}
            title="No open conflicts"
            detail={resolved.length ? `Resolved ${resolved.length} conflict(s) this session. Queue is clean.` : 'Edge and server agree on all replicated memories.'}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((c, i) => (
            <Card key={c.id} className={`card-enter overflow-hidden stagger-${Math.min(i + 1, 4)}`}>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3.5 dark:border-white/10">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-300">
                  <GitBranch size={14} />
                </span>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.title}</h2>
                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{c.id} · {c.memoryId}</span>
                <Badge tone="orange" className="ml-auto">Open conflict</Badge>
              </div>

              <div className="grid gap-0 md:grid-cols-2">
                <div className="border-b border-slate-200 p-5 md:border-r md:border-b-0 dark:border-white/10">
                  <p className="font-mono text-[11px] tracking-widest text-emerald-600 uppercase dark:text-emerald-300">Local version · v{c.local.version}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{c.local.text}</p>
                  <p className="mt-3 font-mono text-[11px] text-slate-400 dark:text-slate-500">Updated {c.local.updated} · {c.local.author}</p>
                  <Button size="sm" className="mt-4 w-full" onClick={() => resolve(c.id, 'KEPT LOCAL')}><Check size={14} /> Keep local</Button>
                </div>
                <div className="p-5">
                  <p className="font-mono text-[11px] tracking-widest text-slate-400 uppercase dark:text-slate-400">Cloud version · v{c.cloud.version}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-300">{c.cloud.text}</p>
                  <p className="mt-3 font-mono text-[11px] text-slate-400 dark:text-slate-500">Updated {c.cloud.updated} · {c.cloud.author}</p>
                  <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => resolve(c.id, 'KEPT CLOUD')}>Keep cloud</Button>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-4 dark:border-white/10 dark:bg-black/30">
                <p className="flex items-center gap-1.5 font-mono text-[11px] tracking-widest text-violet-600 uppercase dark:text-violet-300"><Sparkles size={12} /> AI recommendation · {c.confidence}% confidence</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">“{c.aiRecommendation}”</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => resolve(c.id, 'MERGED')}>Merge both</Button>
                  <span className="font-mono text-[11px] text-slate-400 self-center dark:text-slate-600">Operator decision is authoritative.</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <Card className="mt-4 p-4">
          <h3 className="font-mono text-[11px] tracking-widest text-slate-400 uppercase dark:text-slate-400">Resolved this session</h3>
          <ul className="mt-2 space-y-1.5">
            {resolved.map((r) => (
              <li key={r.id} className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                <Check size={13} className="text-emerald-500 dark:text-emerald-400" /> {r.id} · {r.how} · {r.at}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}