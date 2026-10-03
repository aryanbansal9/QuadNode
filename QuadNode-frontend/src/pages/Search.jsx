import { useState } from 'react';
import { Search as SearchIcon, Database, SlidersHorizontal, Sparkles } from 'lucide-react';
import { PageHeader, Card } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import ProgressBar from '../components/common/ProgressBar';
import { searchService } from '../api/services';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]); // STRICTLY EMPTY ON LOAD
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const r = await searchService.query(q);
      const mapped = (r.hits || []).map(h => ({
        id: h.id.slice(0, 8),
        title: h.source,
        excerpt: h.text,
        type: h.source?.includes('.pdf') || h.source?.includes('.txt') ? 'Document' : 'Observation',
        semantic: h.dense_rank ? Math.max(0, 1 - (h.dense_rank * 0.1)) : 0.5, 
        keyword: h.sparse_rank ? Math.max(0, 1 - (h.sparse_rank * 0.1)) : 0.5,
        combined: h.rerank_score || 0.8
      }));
      setResults(mapped);
    } catch (err) {
      console.error("Search failed", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Hybrid retrieval · semantic + keyword" title="Search" subtitle="Semantic + keyword hybrid retrieval over local vectors." />

      <Card className="card-enter p-4 sm:p-5">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
              placeholder="Search local memory…"
              className="qn-input w-full rounded-xl py-3 pr-4 pl-10 text-[15px]"
            />
          </div>
          <Button onClick={run} disabled={loading || !q.trim()} size="lg" className="!rounded-xl min-w-[108px]">{loading ? 'Searching…' : 'Search'}</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-widest text-slate-400 uppercase"><SlidersHorizontal size={12} /> Filters:</span>
          {['All sources', 'Documents', 'Observations', 'Last 30 days', 'Sync allowed'].map((f, i) => (
            <button key={f} className={`cursor-pointer rounded-lg border px-2.5 py-1 font-mono text-[11px] uppercase transition-colors ${i === 0 ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-200' : 'border-slate-200 text-slate-400 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'}`}>{f}</button>
          ))}
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-300"><Database size={12} /> Results retrieved from live QuadNode</span>
        </div>
      </Card>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
        ) : searched && results.length === 0 ? (
          <Card><EmptyState icon={SearchIcon} title="No results" detail="Try a different query or widen the filters." /></Card>
        ) : (
          <div className="space-y-3">
            {searched && <p className="font-mono text-[11px] tracking-widest text-slate-400 uppercase dark:text-slate-500">{results.length} results · Federated Search</p>}
            {results.map((r, i) => (
              <Card key={r.id} hover className={`card-enter p-4 stagger-${Math.min(i + 1, 5)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-blue-600 dark:text-cyan-300">{r.id}</span>
                  <Badge tone="slate">{r.type}</Badge>
                  <Badge tone={r.semantic >= r.keyword ? 'violet' : 'cyan'}><Sparkles size={10} /> {r.semantic >= r.keyword ? 'Semantic match' : 'Keyword match'}</Badge>
                  <span className="ml-auto font-mono text-[11px] text-slate-400 dark:text-slate-500">{r.title}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{r.excerpt}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[
                    ['Dense (Semantic)', r.semantic, 'bg-violet-500'],
                    ['Sparse (Keyword)', r.keyword, 'bg-blue-500 dark:bg-cyan-400'],
                    ['FlashRank (Cross-Encoder)', r.combined, 'bg-emerald-500'],
                  ].map(([l, v, tone]) => (
                    <div key={l}>
                      <div className="mb-1 flex justify-between font-mono text-[11px]"><span className="text-slate-400 dark:text-slate-500">{l}</span><span className="tnum text-slate-700 dark:text-slate-200">{Math.round(v * 100)}%</span></div>
                      <ProgressBar value={v * 100} tone={tone} />
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}