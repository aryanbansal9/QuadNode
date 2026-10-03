export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function timeAgo(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${Math.max(s, 1)}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString();
}

export function formatBytes(mb) {
  return `${mb}%`;
}

export function shortHash(s) {
  if (!s) return '—';
  return s.length > 12 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}

export function statusColor(status) {
  switch ((status || '').toUpperCase()) {
    case 'ONLINE':
    case 'ACTIVE':
    case 'SYNCED':
    case 'INDEXED':
    case 'EMBEDDED':
    case 'STORED':
      return 'emerald';
    case 'OFFLINE':
    case 'FAILED':
      return 'red';
    case 'SYNCING':
    case 'PROCESSING':
    case 'PENDING':
      return 'amber';
    case 'CONFLICT':
      return 'orange';
    case 'LOCAL ONLY':
      return 'slate';
    case 'SYNC ALLOWED':
      return 'cyan';
    default:
      return 'slate';
  }
}
