import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { USE_MOCK } from '../api/client';
import { syncService } from '../api/services';

const ConnectionContext = createContext(null);

export const CONNECTION = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  SYNCING: 'SYNCING',
};

function formatAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s} seconds ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}

export function ConnectionProvider({ children }) {
  // CLOUD connection state (what judges see): ONLINE / OFFLINE / SYNCING.
  const [status, setStatus] = useState(CONNECTION.ONLINE);
  // EDGE backend reachability (localhost FastAPI): true / false / null (unknown).
  const [edgeAvailable, setEdgeAvailable] = useState(null);
  // True when the user pressed "Simulate Cloud Offline" — edge stays available.
  const [cloudSimulatedOffline, setCloudSimulatedOffline] = useState(false);
  const [backend, setBackend] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => new Date(Date.now() - 2 * 60 * 1000));
  const [lastSyncLabel, setLastSyncLabel] = useState('2 minutes ago');
  const [syncProgress, setSyncProgress] = useState(0);
  const [pendingCount, setPendingCount] = useState(7);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setLastSyncLabel(formatAgo(lastSyncedAt)), 10000);
    return () => clearInterval(id);
  }, [lastSyncedAt]);

  /** Poll real GET /status. Returns payload or null. Never throws. */
  const refreshStatus = useCallback(async () => {
    if (USE_MOCK || cloudSimulatedOffline) return null;
    try {
      const data = await syncService.status();
      setBackend(data);
      setEdgeAvailable(true);
      if (typeof data?.pending_sync === 'number') setPendingCount(data.pending_sync);
      setStatus((s) => (s === CONNECTION.SYNCING ? s : CONNECTION.ONLINE));
      return data;
    } catch {
      setEdgeAvailable(false);
      setStatus(CONNECTION.OFFLINE);
      return null;
    }
  }, [cloudSimulatedOffline]);

  // Periodic poll while online + not simulating.
  useEffect(() => {
    if (USE_MOCK || cloudSimulatedOffline) return;
    refreshStatus();
    const id = setInterval(refreshStatus, 10000);
    return () => clearInterval(id);
  }, [refreshStatus, cloudSimulatedOffline]);

  /** "Simulate Cloud Offline": cloud goes OFFLINE, edge stays AVAILABLE. */
  const simulateOffline = useCallback(() => {
    setCloudSimulatedOffline(true);
    setStatus(CONNECTION.OFFLINE);
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSyncing(false);
    setSyncProgress(0);
    // Edge backend on localhost is unaffected — keep it marked available
    // so Assistant/ingest keep working during the demo.
    setEdgeAvailable((v) => (v === null ? true : v));
  }, []);

  const restoreConnection = useCallback(() => {
    setCloudSimulatedOffline(false);
    setStatus(CONNECTION.ONLINE);
  }, []);

  // Refetch once simulation is lifted.
  useEffect(() => {
    if (!cloudSimulatedOffline && !USE_MOCK) refreshStatus();
  }, [cloudSimulatedOffline, refreshStatus]);

  const fakeSyncTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSyncProgress((p) => {
        const next = p + Math.random() * 18 + 6;
        if (next >= 100) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setIsSyncing(false);
          setStatus(CONNECTION.ONLINE);
          setLastSyncedAt(new Date());
          setLastSyncLabel('just now');
          setPendingCount(0);
          return 100;
        }
        return next;
      });
    }, 450);
  }, []);

  /**
   * "Sync Now" — real POST /sync unless simulating cloud-offline
   * (then it queues) or mock mode (fake timer).
   */
  const simulateSync = useCallback(async () => {
    if (isSyncing) return { queued: true };
    if (cloudSimulatedOffline) return { queued: true, reason: 'cloud-offline' };
    if (USE_MOCK) {
      if (status === CONNECTION.OFFLINE) setStatus(CONNECTION.ONLINE);
      setStatus(CONNECTION.SYNCING);
      setIsSyncing(true);
      setSyncProgress(0);
      fakeSyncTimer();
      return { ok: true, demo: true };
    }
    setStatus(CONNECTION.SYNCING);
    setIsSyncing(true);
    setSyncProgress(25);
    setSyncResult(null);
    try {
      const res = await syncService.trigger();
      setSyncProgress(90);
      const fresh = await refreshStatus();
      setSyncProgress(100);
      setIsSyncing(false);
      setStatus(CONNECTION.ONLINE);
      setLastSyncedAt(new Date());
      setLastSyncLabel('just now');
      if (typeof fresh?.pending_sync === 'number') setPendingCount(fresh.pending_sync);
      else if (typeof res?.synced_count === 'number') {
        setPendingCount((c) => Math.max(0, c - res.synced_count));
      }
      setSyncResult(res);
      return res;
    } catch (e) {
      setIsSyncing(false);
      setSyncProgress(0);
      setEdgeAvailable(false);
      setStatus(CONNECTION.OFFLINE);
      return { ok: false, error: e?.message || 'sync failed' };
    }
  }, [isSyncing, cloudSimulatedOffline, status, fakeSyncTimer, refreshStatus]);

  const markDirty = useCallback(() => {
    setPendingCount((c) => c + 1);
  }, []);

  const value = useMemo(
    () => ({
      status,
      isOnline: status === CONNECTION.ONLINE,
      isOffline: status === CONNECTION.OFFLINE,
      isSyncing: status === CONNECTION.SYNCING || isSyncing,
      // Edge vs cloud distinction for the demo story.
      edgeAvailable, // true | false | null
      edgeOnline: edgeAvailable !== false,
      cloudSimulatedOffline,
      backend, // raw GET /status payload (or null)
      syncResult,
      lastSyncedAt,
      lastSyncLabel,
      syncProgress,
      pendingCount,
      setPendingCount,
      simulateOffline,
      restoreConnection,
      simulateSync,
      refreshStatus,
      markDirty,
      setStatus,
    }),
    [status, edgeAvailable, cloudSimulatedOffline, backend, syncResult, lastSyncedAt, lastSyncLabel, syncProgress, pendingCount, isSyncing, simulateOffline, restoreConnection, simulateSync, refreshStatus, markDirty]
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnection must be used within ConnectionProvider');
  return ctx;
}
