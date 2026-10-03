export const dashboardStats = {
  localMemories: 1248,
  pendingSync: 7,
  conflicts: 1,
  aiQueries: 342,
  storagePct: 68,
};

export const systemStatus = [
  { id: 'ai', label: 'AI Engine', detail: 'Llama 3.1 8B · Q4', state: 'ACTIVE' },
  { id: 'qdrant', label: 'Qdrant Edge', detail: '127.0.0.1:6333 · 1,248 vectors', state: 'ACTIVE' },
  { id: 'embed', label: 'Local Embeddings', detail: 'Nomic Embed · 768 dims', state: 'ACTIVE' },
  { id: 'net', label: 'Network', detail: 'edge uplink', state: 'NETWORK' },
  { id: 'sync', label: 'Synchronization', detail: 'queue depth 7', state: 'SYNC' },
];

export const memoryActivity = [
  { time: '09:12', event: 'Document imported', detail: 'Cooling_System_Manual.pdf · 124 chunks', kind: 'document' },
  { time: '10:21', event: 'New observation created', detail: 'Operator note · Pump hall B', kind: 'memory' },
  { time: '10:35', event: 'AI query processed', detail: '"E47 cooling pump vibration" · 91% confidence', kind: 'ai' },
  { time: '11:02', event: 'Local memory updated', detail: 'Memory #1841 · P-204 bearing inspection', kind: 'memory' },
  { time: '11:30', event: 'Network connection lost', detail: 'Uplink timeout · entering offline mode', kind: 'offline' },
  { time: '11:42', event: 'Offline memory created', detail: 'Memory #1842 · vibration reading 6.1 mm/s', kind: 'memory' },
  { time: '12:17', event: 'Connection restored', detail: 'Uplink re-established · 240ms latency', kind: 'online' },
  { time: '12:18', event: 'Synchronization started', detail: '7 items queued for Qdrant Server', kind: 'sync' },
  { time: '12:19', event: 'Synchronization completed', detail: '6 synced · 1 conflict flagged', kind: 'sync' },
];

export const deviceHealth = {
  cpu: 67,
  memory: 48,
  storage: 68,
  localModel: 'Llama 3.1 8B',
  embeddingModel: 'Nomic Embed v1.5',
  uptime: '14d 06h 22m',
  temperature: '54°C',
  power: '18.2 W',
};
