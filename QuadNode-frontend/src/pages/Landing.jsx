import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, ArrowRight, Menu, X, Database, WifiOff, ShieldCheck, RefreshCw,
  Search, Cpu, ChevronDown, User, ScanSearch, Sparkles,
  CloudOff, Cloud, CheckCircle2, Zap, Lock, GitBranch,
} from 'lucide-react';
import ThemeToggle from '../components/common/ThemeToggle';
import Badge from '../components/common/Badge';
import { cx } from '../utils/format';

/* ---------- Scroll reveal (respects prefers-reduced-motion via CSS) ---------- */
function Reveal({ children, className, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={cx('transition-all duration-700 ease-out', visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function SectionEyebrow({ children }) {
  return (
    <p className="font-mono text-[11px] font-semibold tracking-[0.24em] text-blue-600 uppercase dark:text-cyan-300/80">{children}</p>
  );
}

/* ---------- Navbar ---------- */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const links = [
    ['Product', '#product'],
    ['Architecture', '#architecture'],
    ['Features', '#features'],
    ['About', '#offline'],
  ];
  return (
    <header className={cx(
      'fixed inset-x-0 top-0 z-50 transition-all duration-300',
      scrolled
        ? 'border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#070A0F]/80'
        : 'border-b border-transparent bg-transparent'
    )}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 lg:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="QuadNode home">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-blue-600 to-cyan-500 shadow-[0_2px_12px_-4px_rgba(37,99,235,0.7)] dark:from-blue-500 dark:to-cyan-400">
            <Box size={17} className="text-white dark:text-slate-950" strokeWidth={2.5} />
          </span>
          <span>
            <span className="block text-sm leading-none font-bold tracking-tight text-slate-900 dark:text-white">QuadNode</span>
            <span className="mt-0.5 block font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase dark:text-slate-500">Edge Memory OS</span>
          </span>
        </Link>
        <nav className="ml-8 hidden items-center gap-1 md:flex" aria-label="Landing">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white">{label}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/dashboard"
            className="hidden items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-[0_2px_12px_-4px_rgba(37,99,235,0.6)] transition-all duration-150 hover:bg-blue-500 active:scale-[0.98] sm:inline-flex dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
          >
            Launch Console <ArrowRight size={14} />
          </Link>
          <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-white/5" aria-label="Menu">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md md:hidden dark:border-white/10 dark:bg-[#070A0F]/95" aria-label="Mobile">
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5">{label}</a>
          ))}
          <Link to="/dashboard" className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white dark:bg-cyan-400 dark:text-slate-950">
            Launch Console <ArrowRight size={14} />
          </Link>
        </nav>
      )}
    </header>
  );
}

/* ---------- Hero pipeline visual ---------- */
const heroStages = [
  { label: 'EDGE AI', sub: 'on-device query', icon: Cpu },
  { label: 'LOCAL MEMORY', sub: 'Qdrant Edge', icon: Database },
  { label: 'RETRIEVAL', sub: 'vector + rerank', icon: ScanSearch },
  { label: 'LOCAL LLM', sub: 'Llama 3.1', icon: Sparkles },
  { label: 'INTELLIGENCE', sub: 'cited answer', icon: Zap },
];

function HeroVisual() {
  return (
    <div className="qn-card card-enter stagger-2 relative overflow-hidden p-5 sm:p-6" aria-hidden>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.2em] text-slate-400 uppercase dark:text-slate-500">Live inference path</p>
        <Badge tone="emerald" dot>Local</Badge>
      </div>
      <ol className="relative space-y-0">
        {heroStages.map((s, i) => (
          <li key={s.label} className="relative flex gap-3.5 pb-4 last:pb-0">
            {i < heroStages.length - 1 && (
              <span className="absolute top-10 left-[17px] w-px">
                <svg width="2" height="100%" viewBox="0 0 2 32" preserveAspectRatio="none" className="h-8 text-blue-500 dark:text-cyan-400">
                  <line x1="1" y1="0" x2="1" y2="32" stroke="currentColor" strokeWidth="2" className="qn-flow-line" />
                </svg>
              </span>
            )}
            <span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-blue-600 dark:border-white/10 dark:bg-white/5 dark:text-cyan-300">
              <s.icon size={16} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-mono text-xs font-semibold tracking-widest text-slate-800 dark:text-slate-100">{s.label}</p>
              <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{s.sub}</p>
            </div>
            <span className="tnum font-mono text-[10px] text-slate-300 self-center dark:text-slate-600">0{i + 1}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-3.5 py-2.5 dark:bg-emerald-500/10">
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={13} /> Answered on-device · 0 cloud round-trips</p>
      </div>
    </div>
  );
}

/* ---------- Features ---------- */
const features = [
  { icon: Database, tint: 'blue', title: 'Edge-Native Memory', text: 'Persistent semantic memory running locally on the device — recall in milliseconds, no network required.' },
  { icon: WifiOff, tint: 'emerald', title: 'Offline Intelligence', text: 'AI remains fully available even without cloud connectivity. Local writes continue; sync waits.' },
  { icon: ShieldCheck, tint: 'violet', title: 'Privacy by Design', text: 'Sensitive information can remain on the edge. Guardrails classify PII before anything replicates.' },
  { icon: RefreshCw, tint: 'amber', title: 'Intelligent Synchronization', text: 'Synchronize cleared edge memories to the server when connectivity returns — queue, validate, push.' },
  { icon: Search, tint: 'cyan', title: 'Semantic Retrieval', text: 'Dense vector search with cross-encoder reranking surfaces the memories that actually matter.' },
  { icon: Cpu, tint: 'slate', title: 'Local AI Reasoning', text: 'A local LLM reasons strictly over retrieved memories — grounded answers with cited sources.' },
];

const tintCls = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-cyan-300',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  cyan: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  slate: 'bg-slate-500/10 text-slate-500 dark:text-slate-300',
};

/* ---------- Architecture ---------- */
const edgeModules = [
  ['Memory Ingestion', 'Chunk, validate and store observations'],
  ['Privacy Guardrails', 'Zero-shot PII quarantine'],
  ['Embeddings', 'Nomic dense vectors, on-device'],
  ['Edge Qdrant', 'Local vector store :6333'],
  ['Semantic Retrieval', 'Top-k recall over edge memory'],
  ['FlashRank', 'Cross-encoder precision rerank'],
  ['Local LLM', 'Llama 3.1 grounded reasoning'],
];

/* ---------- Page ---------- */
export default function Landing() {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="qn-app-bg min-h-screen text-slate-900 antialiased dark:text-slate-200">
      <Navbar />

      {/* ================= HERO ================= */}
      <section className="mx-auto max-w-6xl px-4 pt-32 pb-16 sm:pt-36 lg:px-6 lg:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="page-enter">
              <Badge tone="cyan" dot>Offline-first · Edge AI memory</Badge>
            </div>
            <h1 className="page-enter stagger-1 font-display mt-4 text-4xl leading-[1.04] font-bold tracking-[-0.025em] text-balance sm:text-5xl lg:text-[3.4rem]">
              AI THAT REMEMBERS<br />
              <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-violet-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-cyan-300 dark:to-violet-300">WHERE IT OPERATES.</span>
            </h1>
            <p className="page-enter stagger-2 mt-5 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg dark:text-slate-400">
              QuadNode is an offline-first Edge AI memory platform that gives intelligent systems persistent, private and locally accessible memory — even when the cloud disappears.
            </p>
            <div className="page-enter stagger-3 mt-7 flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_24px_-8px_rgba(37,99,235,0.7)] transition-all duration-150 hover:bg-blue-500 active:scale-[0.98] dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
              >
                Launch Edge Console <ArrowRight size={15} />
              </Link>
              <button
                onClick={() => scrollTo('architecture')}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-slate-400 active:scale-[0.98] dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/25"
              >
                Explore Architecture <ChevronDown size={15} />
              </button>
            </div>
            <dl className="page-enter stagger-4 mt-9 grid max-w-md grid-cols-3 gap-4 border-t border-slate-200 pt-5 dark:border-white/10">
              {[
                ['100%', 'local inference'],
                ['0', 'cloud calls to chat'],
                ['<50ms', 'edge recall path'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="tnum text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{v}</dt>
                  <dd className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <div aria-hidden className="absolute -inset-6 rounded-[28px] bg-gradient-to-br from-blue-500/[0.09] via-cyan-500/[0.05] to-violet-500/[0.09] blur-2xl dark:from-blue-500/[0.14] dark:via-cyan-400/[0.06] dark:to-violet-500/[0.12]" />
            <div className="relative"><HeroVisual /></div>
          </div>
        </div>
      </section>

      {/* ================= PRODUCT STRIP ================= */}
      <section id="product" className="border-y border-slate-200/80 bg-white/60 dark:border-white/10 dark:bg-black/20">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-3 lg:px-6">
          {[
            [Lock, 'Private by default', 'Memories live on the device. Only cleared data ever replicates.'],
            [Zap, 'Fast at the edge', 'Embeddings, retrieval and reasoning run on local hardware.'],
            [GitBranch, 'Syncs when online', 'A durable queue carries edge memory to the server on reconnect.'],
          ].map(([Icon, t, d], i) => (
            <Reveal key={t} delay={i * 80}>
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-300"><Icon size={16} /></span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 lg:px-6">
        <Reveal>
          <SectionEyebrow>Platform capabilities</SectionEyebrow>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl">Memory infrastructure for machines that can't phone home.</h2>
          <p className="mt-3 max-w-2xl text-slate-500 dark:text-slate-400">Six primitives that turn an isolated edge device into a system that learns, recalls and reasons.</p>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <div className="qn-card qn-card-hover group h-full p-5 transition-all duration-200">
                <span className={cx('flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110', tintCls[f.tint])}>
                  <f.icon size={18} />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{i + 1}. {f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= ARCHITECTURE ================= */}
      <section id="architecture" className="scroll-mt-20 border-y border-slate-200/80 bg-white/60 dark:border-white/10 dark:bg-black/20">
        <div className="mx-auto max-w-6xl px-4 py-20 lg:px-6">
          <Reveal>
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl">From observation to intelligence — without leaving the device.</h2>
          </Reveal>
          <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
            {/* Request path */}
            <Reveal>
              <div className="qn-card h-full p-5">
                <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-slate-400 uppercase dark:text-slate-500"><User size={13} /> User</p>
                <div className="my-3 flex justify-center"><ChevronDown size={15} className="text-blue-500 dark:text-cyan-400" /></div>
                <p className="font-mono text-[11px] tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">QuadNode Edge</p>
                <ol className="mt-3 space-y-1.5">
                  {edgeModules.map(([name, desc], i) => (
                    <li key={name} className="flex items-center gap-2.5 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                      <span className="tnum font-mono text-[10px] font-bold text-slate-300 dark:text-slate-600">{String(i + 1).padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">{name}</p>
                        <p className="truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="my-3 flex justify-center"><ChevronDown size={15} className="text-blue-500 dark:text-cyan-400" /></div>
                <p className="rounded-lg bg-emerald-500/10 px-3 py-2.5 text-center font-mono text-[11px] font-semibold tracking-widest text-emerald-700 dark:text-emerald-300">AI RESPONSE · CITED + GROUNDED</p>
              </div>
            </Reveal>
            {/* Sync path */}
            <Reveal delay={120} className="flex">
              <div className="qn-card flex w-full flex-col items-center justify-center gap-2 p-5 lg:w-56">
                <p className="font-mono text-[11px] tracking-[0.18em] text-slate-400 uppercase dark:text-slate-500">Replication</p>
                {[
                  ['Edge', 'device memory'],
                  ['Sync Queue', 'durable · hashed'],
                  ['Simulated Cloud', 'demo target'],
                ].map(([t, s], i) => (
                  <div key={t} className="flex w-full flex-col items-center">
                    {i > 0 && (
                      <svg width="12" height="26" viewBox="0 0 12 26" className="text-blue-500 dark:text-cyan-400"><line x1="6" y1="0" x2="6" y2="26" stroke="currentColor" strokeWidth="2" className="qn-flow-line" /></svg>
                    )}
                    <div className={cx(
                      'w-full rounded-lg border px-3 py-2.5 text-center',
                      t === 'Simulated Cloud'
                        ? 'border-dashed border-violet-500/40 bg-violet-500/[0.07]'
                        : 'border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.03]'
                    )}>
                      <p className="flex items-center justify-center gap-1.5 text-[13px] font-semibold">
                        {t === 'Simulated Cloud' && <Cloud size={13} className="text-violet-500" />}
                        {t}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{s}</p>
                    </div>
                  </div>
                ))}
                <Badge tone="violet" className="mt-2">Cloud Sync Simulation</Badge>
              </div>
            </Reveal>
            {/* Principles */}
            <Reveal delay={200} className="flex">
              <div className="qn-card flex w-full flex-col justify-center gap-4 p-5 lg:w-64">
                {[
                  ['Never guesses', 'Answers cite retrieved edge memories or decline.'],
                  ['Never leaks', 'PII-flagged memories stay LOCAL_ONLY by construction.'],
                  ['Never waits', 'Reads and writes work offline; sync is eventual.'],
                ].map(([t, d]) => (
                  <div key={t} className="flex gap-2.5">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                    <div>
                      <p className="text-sm font-semibold">{t}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= OFFLINE ================= */}
      <section id="offline" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 lg:px-6">
        <Reveal className="text-center">
          <SectionEyebrow>Designed for disconnection</SectionEyebrow>
          <h2 className="mx-auto mt-2 max-w-3xl font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl">
            WHEN THE CLOUD DISAPPEARS,<br />THE MEMORY STAYS.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">Watch the platform degrade gracefully — from connected operations to fully autonomous edge mode.</p>
        </Reveal>
        <Reveal delay={120}>
          <div className="qn-card mx-auto mt-10 max-w-3xl overflow-hidden">
            <div className="grid sm:grid-cols-2">
              <div className="border-b border-slate-200 p-6 sm:border-r sm:border-b-0 dark:border-white/10">
                <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-emerald-600 uppercase dark:text-emerald-300">
                  <span className="status-dot-live inline-block h-2 w-2 rounded-full bg-emerald-500" /> Online
                </p>
                <p className="mt-2 text-sm font-semibold">Cloud Connected</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
                  <li className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" /> Memories replicate to server</li>
                  <li className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" /> Queue drains continuously</li>
                  <li className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" /> Fleet telemetry visible</li>
                </ul>
              </div>
              <div className="bg-slate-50/70 p-6 dark:bg-white/[0.02]">
                <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-amber-600 uppercase dark:text-amber-300">
                  <CloudOff size={13} /> Connection lost
                </p>
                <p className="mt-2 font-mono text-sm font-bold tracking-widest">EDGE MODE</p>
                <ol className="mt-3 space-y-0">
                  {['Local Memory', 'Local AI', 'Still Operational'].map((s, i) => (
                    <li key={s} className="relative flex gap-3 pb-3 last:pb-0">
                      {i < 2 && <span className="absolute top-6 left-[9px] h-[calc(100%-1.25rem)] w-px bg-slate-300 dark:bg-white/15" />}
                      <span className="z-10 mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-blue-500 bg-white dark:border-cyan-400 dark:bg-[#0D1117]" />
                      <p className="text-sm font-medium">{s}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="border-t border-slate-200 bg-white px-6 py-3.5 dark:border-white/10 dark:bg-black/20">
              <p className="text-center font-mono text-[11px] text-slate-400 dark:text-slate-500">Writes queue as PENDING · reads never block · sync resumes on reconnect</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================= PRODUCT PREVIEW ================= */}
      <section className="border-y border-slate-200/80 bg-white/60 dark:border-white/10 dark:bg-black/20">
        <div className="mx-auto max-w-6xl px-4 py-20 lg:px-6">
          <Reveal className="text-center">
            <SectionEyebrow>Inside the console</SectionEyebrow>
            <h2 className="mx-auto mt-2 max-w-2xl font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl">One console for memory, reasoning and sync.</h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="qn-card mx-auto mt-10 max-w-4xl overflow-hidden !rounded-2xl shadow-2xl" aria-label="QuadNode dashboard preview (illustration)">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 hidden rounded-md bg-white px-3 py-1 font-mono text-[10px] text-slate-400 sm:block dark:bg-black/30 dark:text-slate-500">quadnode · /dashboard</span>
                <span className="ml-auto"><Badge tone="emerald" dot>Online</Badge></span>
              </div>
              <div className="grid gap-3 p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Edge Memories', '1,248', 'blue'],
                    ['Pending Sync', '7', 'amber'],
                    ['AI Queries', '342', 'violet'],
                    ['Cache', '18 hit', 'emerald'],
                  ].map(([l, v, a]) => (
                    <div key={l} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black/30">
                      <p className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.14em] text-slate-400 uppercase dark:text-slate-500">
                        <span className={cx('h-1.5 w-1.5 rounded-full', a === 'blue' && 'bg-blue-500 dark:bg-cyan-400', a === 'amber' && 'bg-amber-500', a === 'violet' && 'bg-violet-500', a === 'emerald' && 'bg-emerald-500')} />{l}
                      </p>
                      <p className="tnum mt-1 text-lg font-semibold tracking-tight">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:col-span-3 dark:border-white/10 dark:bg-black/30">
                    <p className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles size={12} className="text-violet-500" /> Local AI · Llama 3.1</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">“Vibration above 4.5 mm/s exceeds the E47 alarm threshold — inspect the P-204 bearing within 24h.”</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="cyan">Cooling_Manual.pdf · 91%</Badge>
                      <Badge tone="violet">P204_Log · 86%</Badge>
                      <Badge tone="emerald">Local</Badge>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:col-span-2 dark:border-white/10 dark:bg-black/30">
                    <p className="font-mono text-[10px] tracking-[0.16em] text-slate-400 uppercase dark:text-slate-500">Sync queue</p>
                    {[['MEM-1842', 'PENDING', 'amber'], ['MEM-1804', 'PENDING', 'amber'], ['MEM-1839', 'SYNCED', 'emerald']].map(([id, st, tone]) => (
                      <div key={id} className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{id}</span>
                        <Badge tone={tone}>{st}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
          <p className="mt-4 text-center font-mono text-[11px] text-slate-400 dark:text-slate-500">Illustrated preview · open the console for live data</p>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center lg:px-6">
        <Reveal>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_4px_24px_-8px_rgba(37,99,235,0.8)] dark:from-blue-500 dark:to-cyan-400 dark:text-slate-950">
            <Box size={22} strokeWidth={2.25} />
          </span>
          <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl">Give your AI a memory that survives the network.</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">Open the Edge Console — ingest a memory, ask the local AI, kill the connection, and watch it keep working.</p>
          <Link
            to="/dashboard"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_4px_24px_-8px_rgba(37,99,235,0.7)] transition-all duration-150 hover:bg-blue-500 active:scale-[0.98] dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
          >
            Launch QuadNode <ArrowRight size={15} />
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-slate-200/80 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row lg:px-6">
          <p className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <Box size={13} /> QuadNode · Edge Memory OS · hackathon prototype
          </p>
          <p className="font-mono text-[10px] tracking-widest text-slate-300 uppercase dark:text-slate-600">Local-first · Private · Grounded</p>
        </div>
      </footer>
    </div>
  );
}
