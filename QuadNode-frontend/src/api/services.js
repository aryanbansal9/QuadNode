import { apiClient, USE_MOCK } from './client';
import { memories } from '../data/memories';
import { sampleSearchResults } from '../data/search';
import { documents } from '../data/documents';
import { syncQueue, syncMetrics } from '../data/sync';
import { conflicts } from '../data/conflicts';
import { timelineEvents } from '../data/timeline';
import { dashboardStats, systemStatus, memoryActivity, deviceHealth } from '../data/dashboard';
import { devices } from '../data/devices';

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

/**
 * Parse backend source strings like:
 *   "- Pump P-204 vibration threshold is 4.5 mm/s [Confidence: 0.87]"
 * into UI-friendly objects. Never throws.
 */
export function parseChatSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources.map((s, i) => {
    if (typeof s !== 'string') return null;
    let text = s.trim().replace(/^-\s*/, '');
    let confidence = null;
    const m = text.match(/\[Confidence:\s*([0-9.]+)\]/i);
    if (m) {
      confidence = parseFloat(m[1]);
      text = text.replace(m[0], '').trim();
    }
    const relevance = confidence != null && !Number.isNaN(confidence)
      ? Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence))
      : 0.75;
    const short = text.length > 48 ? `${text.slice(0, 48)}…` : text;
    return {
      name: short || `Local Memory #${i + 1}`,
      text,
      relevance,
      relevancePct: Math.round(relevance * 100),
      type: 'Observation',
      locality: 'Local',
    };
  }).filter(Boolean);
}

export const chatService = {
  async send(message, opts = {}) {
    if (USE_MOCK) {
      await delay(900);
      return {
        answer:
          'Based on the available local memory, the recommended first step is to inspect the pump bearing and review the previous maintenance record. Vibration above 4.5 mm/s exceeds the E47 alarm threshold; MEM-1841 records a recent SKF 6311 replacement that returned vibration to 1.8 mm/s.',
        sources: [
          { name: 'Cooling_System_Manual.pdf', relevance: 0.91, type: 'Document', locality: 'Local' },
          { name: 'P204_Maintenance_Log', relevance: 0.86, type: 'Observation', locality: 'Local' },
          { name: 'Local Memory #1842', relevance: 0.84, type: 'Observation', locality: 'Local' },
        ],
        confidence: 91,
        local: true,
      };
    }
    // Real backend: POST /chat { query }
    const { data } = await apiClient.post('/chat', { query: message });
    const sources = parseChatSources(data.sources);
    const top = sources.length
      ? Math.max(...sources.map((s) => s.relevancePct))
      : null;
    return {
      answer: data.response ?? '',
      sources,
      confidence: top,
      cache_hit: !!data.cache_hit,
      time_ms: data.time_ms ?? null,
      local: true,
      raw: data,
    };
  },
};

export const memoryService = {
  async list(limit = 100) {
    if (USE_MOCK) { await delay(); return memories; }
    // Real backend: GET /memories -> [{id,text,source,sync_status,timestamp}]
    const { data } = await apiClient.get('/memories', { params: { limit } });
    return Array.isArray(data) ? data : [];
  },
  async create(payload) {
    if (USE_MOCK) { await delay(); return { id: `MEM-${Date.now()}`, ...payload }; }
    // Real backend: POST /ingest { text, source }
    const { data } = await apiClient.post('/ingest', {
      text: payload.text,
      source: payload.source || 'manual_entry',
    });
    return data; // { status, id, sync_state }
  },
};

export const searchService = {
  async query(q) {
    if (USE_MOCK) { await delay(500); return sampleSearchResults; }
    // No dedicated /search endpoint on backend: reuse /chat retrieval.
    const { data } = await apiClient.post('/chat', { query: q });
    const parsed = parseChatSources(data.sources);
    return parsed.map((s, i) => ({
      id: `EDGE-${i + 1}`,
      title: s.name,
      excerpt: s.text,
      type: 'Observation',
      source: 'Qdrant Edge · quadnode_memory',
      semantic: s.relevance,
      keyword: s.relevance,
      combined: s.relevance,
    }));
  },
};

export const documentService = {
  async list() {
    if (USE_MOCK) { await delay(); return documents; }
    // No /documents endpoint: fall back to edge memories.
    const { data } = await apiClient.get('/memories', { params: { limit: 100 } });
    return Array.isArray(data) ? data : [];
  },
};

export const syncService = {
  async status() {
    if (USE_MOCK) { await delay(); return { ...syncMetrics, queue: syncQueue }; }
    // Real backend: GET /status
    const { data } = await apiClient.get('/status');
    return data;
  },
  async trigger() {
    if (USE_MOCK) { await delay(1200); return { ok: true }; }
    // Real backend: POST /sync {}
    const { data } = await apiClient.post('/sync');
    return data;
  },
  async conflicts() {
    if (USE_MOCK) { await delay(); return conflicts; }
    // No backend conflict endpoint for MVP — return demo dataset.
    return conflicts;
  },
  async resolve(id, strategy) {
    if (USE_MOCK) { await delay(); return { ok: true, id, strategy }; }
    return { ok: true, id, strategy, demo: true };
  },
};

export const systemService = {
  async overview() {
    if (USE_MOCK) { await delay(); return { dashboardStats, systemStatus, memoryActivity, deviceHealth, timelineEvents, devices }; }
    // Real backend: GET /status is the only telemetry.
    const { data } = await apiClient.get('/status');
    return data;
  },
};
