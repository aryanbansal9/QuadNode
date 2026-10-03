import { useEffect, useRef, useState } from 'react';
import { Send, Cpu, WifiOff, FileText, Database, Sparkles, Zap, Thermometer, Wrench } from 'lucide-react';
import { PageHeader, Card } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { useConnection } from '../context/ConnectionContext';
import { chatService } from '../api/services';
import { cx } from '../utils/format';

const seedMessages = [
  { role: 'user', text: 'What should I check if Pump P-204 shows abnormal vibration?' },
  {
    role: 'ai',
    text: 'Based on the available local memory, the recommended first step is to inspect the pump bearing and review the previous maintenance record. Vibration above 4.5 mm/s exceeds the E47 alarm threshold; MEM-1841 records a recent SKF 6311 replacement that returned vibration to 1.8 mm/s. Recheck coupling torque (68 N·m) and bearing temperature trend.',
    sources: [
      { name: 'Cooling_System_Manual.pdf', relevance: 91, type: 'Document', locality: 'Local' },
      { name: 'P204_Maintenance_Log', relevance: 86, type: 'Observation', locality: 'Local' },
      { name: 'Local Memory #1842', relevance: 84, type: 'Observation', locality: 'Local' },
    ],
    confidence: 91,
  },
];

const suggestions = [
  { icon: Wrench, label: 'P-204 vibration threshold?' },
  { icon: Thermometer, label: 'E47 cooling envelope?' },
  { icon: Zap, label: 'Coupling torque spec?' },
];

function pctOf(s) {
  if (typeof s.relevancePct === 'number') return s.relevancePct;
  if (typeof s.relevance === 'number') return Math.round(s.relevance <= 1 ? s.relevance * 100 : s.relevance);
  return 75;
}

export default function Assistant() {
  const { isOffline, edgeAvailable } = useConnection();
  const [messages, setMessages] = useState(seedMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = async (preset) => {
    const q = (preset ?? input).trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);
    try {
      const res = await chatService.send(q);
      const sources = Array.isArray(res.sources) ? res.sources : [];
      setMessages((m) => [...m, {
        role: 'ai',
        text: res.answer || '(empty response from edge backend)',
        sources,
        confidence: typeof res.confidence === 'number' ? res.confidence : null,
        cacheHit: !!res.cache_hit,
        timeMs: res.time_ms ?? null,
      }]);
    } catch (err) {
      const offline = !err?.response;
      setMessages((m) => [...m, {
        role: 'ai',
        text: offline
          ? 'Edge backend unreachable at http://127.0.0.1:8000. Start it with run.bat / uvicorn backend.main:app, then ask again. Your question was kept — nothing was sent to any cloud.'
          : `Edge backend error: ${err?.response?.data?.detail || err.message}`,
        sources: [],
        confidence: null,
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Local inference · zero cloud round-trip"
        title="Local AI Assistant"
        subtitle="Grounded in Qdrant Edge memory. Every answer cites what the device remembers."
        actions={
          <span className="flex items-center gap-2">
            <Badge tone="emerald" dot><Cpu size={11} /> Running locally</Badge>
            <Badge tone="violet">Llama 3.1 · on-device</Badge>
          </span>
        }
      />

      {isOffline && (
        <div className="card-enter mb-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3" role="status">
          <WifiOff size={16} className="shrink-0 text-amber-600 dark:text-amber-300" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <span className="font-mono font-bold tracking-widest">OFFLINE MODE</span>
            <span className="mx-2 opacity-50">·</span>
            Responses are generated using local memory and local AI.
          </p>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Conversation */}
        <Card className="flex min-h-[560px] flex-col overflow-hidden xl:col-span-2">
          <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="msg-enter flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 shadow-[0_4px_16px_-6px_rgba(37,99,235,0.5)] dark:bg-cyan-400 dark:shadow-[0_4px_16px_-6px_rgba(34,211,238,0.4)]">
                    <p className="font-mono text-[10px] tracking-widest text-blue-100 uppercase dark:text-slate-800">You · EDGE-001</p>
                    <p className="mt-1 text-sm text-white dark:text-slate-950">{m.text}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="msg-enter flex justify-start gap-2.5">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white dark:from-violet-400 dark:to-cyan-400 dark:text-slate-950">
                    <Sparkles size={14} />
                  </span>
                  <div className="max-w-[92%] flex-1 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-widest uppercase">
                      <span className="flex items-center gap-1.5 text-violet-600 dark:text-violet-300"><Cpu size={11} /> QuadNode Local</span>
                      <Badge tone="emerald">Edge AI</Badge>
                      {m.cacheHit && <Badge tone="cyan">Cache hit</Badge>}
                      {m.timeMs != null && <span className="tnum text-slate-400 dark:text-slate-500">{m.timeMs} ms</span>}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{m.text}</p>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-3 border-t border-slate-200 pt-3 dark:border-white/10">
                        <p className="font-mono text-[10px] tracking-widest text-slate-400 uppercase dark:text-slate-500">Sources · Qdrant Edge</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {m.sources.map((s) => (
                            <div key={s.name} className="group rounded-lg border border-slate-200 bg-white p-2.5 transition-all duration-150 hover:-translate-y-px hover:shadow-sm dark:border-white/10 dark:bg-black/30 dark:hover:border-white/20">
                              <div className="flex items-center gap-1.5">
                                {s.type === 'Document' ? <FileText size={12} className="shrink-0 text-blue-500 dark:text-cyan-300" /> : <Database size={12} className="shrink-0 text-violet-500 dark:text-violet-300" />}
                                <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200" title={s.text || s.name}>{s.name}</p>
                              </div>
                              <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 dark:from-violet-400 dark:to-cyan-400" style={{ width: `${pctOf(s)}%` }} />
                              </div>
                              <div className="mt-1.5 flex items-center justify-between">
                                <span className="tnum font-mono text-[11px] text-slate-500">{pctOf(s)}%</span>
                                <Badge tone="emerald">{s.locality || 'Local'}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">Confidence: <span className="tnum font-mono font-semibold text-emerald-600 dark:text-emerald-300">{m.confidence != null ? `${m.confidence}%` : 'n/a'}</span></p>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            {loading && (
              <div className="flex justify-start gap-2.5">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white dark:from-violet-400 dark:to-cyan-400 dark:text-slate-950">
                  <Cpu size={14} className="animate-pulse" />
                </span>
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-white/10 dark:bg-white/[0.03]">
                  <span className="flex gap-1" aria-label="Generating response">
                    {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500" style={{ animationDelay: `${d * 0.15}s` }} />)}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">reasoning on-device…</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white/60 p-4 dark:border-white/10 dark:bg-black/20">
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => send(s.label)}
                  disabled={loading}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 transition-all duration-150 hover:-translate-y-px hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-cyan-400/50 dark:hover:text-cyan-300"
                >
                  <s.icon size={12} /> {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Ask the local AI…"
                className="qn-input min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-sm"
                aria-label="Ask the local AI"
              />
              <Button onClick={() => send()} disabled={loading || !input.trim()} aria-label="Send message" className="!rounded-xl">
                <Send size={15} /> Send
              </Button>
            </div>
          </div>
        </Card>

        {/* Context panel */}
        <div className="space-y-4">
          <Card className="card-enter stagger-1 p-4">
            <h3 className="font-mono text-[11px] tracking-[0.14em] text-slate-400 uppercase dark:text-slate-400">Retrieval Context</h3>
            <dl className="mt-3 space-y-2.5 text-xs">
              {[
                ['Vector store', 'Qdrant Edge :6333'],
                ['Edge reachable', edgeAvailable === false ? 'NO' : 'YES'],
                ['Top-k', '3 / threshold 0.05'],
                ['Embeddings', 'Nomic · local'],
                ['Rerank', 'FlashRank · local'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2"><dt className="text-slate-400 dark:text-slate-500">{k}</dt><dd className="font-mono text-slate-700 dark:text-slate-300">{v}</dd></div>
              ))}
            </dl>
          </Card>
          <Card className="card-enter stagger-2 p-4">
            <h3 className="font-mono text-[11px] tracking-[0.14em] text-slate-400 uppercase dark:text-slate-400">Memory Policy</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              New memories default to <span className="font-medium text-blue-600 dark:text-cyan-300">PENDING</span> unless classified sensitive, in which case they stay{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">LOCAL ONLY</span> and never leave the device.
            </p>
            <div className="mt-3 flex gap-2">
              <Badge tone="cyan">Sync allowed</Badge>
              <Badge tone="slate">Local only</Badge>
            </div>
          </Card>
          <Card className={cx('card-enter stagger-3 border-blue-500/20 p-4 dark:border-cyan-500/20')}>
            <h3 className="font-mono text-[11px] tracking-[0.14em] text-blue-600 uppercase dark:text-cyan-300">Pipeline</h3>
            <ol className="mt-2 space-y-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {['QUERY → embed locally', 'RETRIEVE → Qdrant Edge top-10', 'RERANK → FlashRank top-3', 'REASON → Llama 3.1 on-device', 'ANSWER + sources + confidence'].map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-blue-500/10 font-mono text-[9px] font-bold text-blue-600 dark:bg-cyan-500/10 dark:text-cyan-300">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
