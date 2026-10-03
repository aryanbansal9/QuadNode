export const conflicts = [
  {
    id: 'CF-001',
    memoryId: 'MEM-1841',
    title: 'PUMP P-204 — bearing state',
    local: {
      text: 'Bearing replaced (SKF 6311). Vibration returned to normal at 1.8 mm/s. Coupling re-torqued to 68 N·m.',
      updated: '11:32 AM',
      author: 'EDGE-001 · Technician A. Rao',
      version: 3,
    },
    cloud: {
      text: 'Inspection pending. Vibration elevated, awaiting parts. Do not run above 80% load.',
      updated: '10:14 AM',
      author: 'Qdrant Server · Supervisor review',
      version: 2,
    },
    aiRecommendation: 'Merge both observations because the local update appears to be a later operational update that supersedes the pending-inspection state, while preserving the load-limit caution.',
    confidence: 87,
    status: 'OPEN',
  },
];
