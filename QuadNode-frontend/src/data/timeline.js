export const timelineEvents = [
  { time: '09:12', title: 'Document imported', detail: 'Cooling_System_Manual.pdf · 124 chunks embedded locally', device: 'EDGE-001', kind: 'document' },
  { time: '10:21', title: 'Memory created', detail: 'Operator observation · Pump hall B', device: 'EDGE-001', kind: 'memory' },
  { time: '10:35', title: 'AI query', detail: '"E47 cooling pump vibration" answered locally · 91% confidence', device: 'EDGE-001', kind: 'ai' },
  { time: '10:48', title: 'Memory retrieved', detail: '3 vectors returned from Qdrant Edge · 14ms', device: 'EDGE-001', kind: 'retrieval' },
  { time: '11:02', title: 'Memory updated', detail: 'MEM-1841 v3 · bearing inspection note', device: 'EDGE-001', kind: 'memory' },
  { time: '11:30', title: 'Network disconnected', detail: 'Uplink timeout · offline mode engaged', device: 'EDGE-001', kind: 'offline' },
  { time: '11:42', title: 'Offline memory created', detail: 'MEM-1842 stored locally · queued for sync', device: 'EDGE-001', kind: 'memory' },
  { time: '12:17', title: 'Network restored', detail: 'Uplink re-established · 240ms', device: 'EDGE-001', kind: 'online' },
  { time: '12:18', title: 'Sync started', detail: '7 items · validation → Qdrant Server', device: 'EDGE-001', kind: 'sync' },
  { time: '12:19', title: 'Sync completed', detail: '6 synced · 1 conflict flagged', device: 'EDGE-001', kind: 'sync' },
  { time: '12:20', title: 'Conflict detected', detail: 'CF-001 · MEM-1841 local v3 vs cloud v2', device: 'EDGE-001', kind: 'conflict' },
];
