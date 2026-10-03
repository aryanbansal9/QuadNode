import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { USE_MOCK } from '../api/client';
import { syncService } from '../api/services';

const ConnectionContext = createContext(null);

export const CONNECTION = { ONLINE: 'ONLINE', OFFLINE: 'OFFLINE', SYNCING: 'SYNCING' };

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
  const [status, setStatus] = useState(CONNECTION.ONLINE);
  const [edgeAvailable, setEdgeAvailable] = useState(null);
  const [cloudSimulatedOffline, setCloudSimulatedOffline] = useState(false);
  const [backend, setBackend] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => new Date(Date.now() - 2 * 60 * 1000));
  const [lastSyncLabel, setLastSyncLabel] = useState('2 minutes ago');
  const [syncProgress, setSyncProgress] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setLastSyncLabel(formatAgo(lastSyncedAt)), 10000);
    return () => clearInterval(id);
  }, [lastSyncedAt]);

  const refreshStatus = useCallback(async () => {
    if (USE_MOCK) return null;
    try {
      const data = await syncService.status();
      setBackend(data);
      setEdgeAvailable(true);
      
      // MAP EXACT FASTAPI SCHEMA: backend.edge.PENDING
      if (data?.edge?.PENDING !== undefined) setPendingCount(data.edge.PENDING);
      
      // Respect the actual backend online state
      setCloudSimulatedOffline(data.forced_offline);
      setStatus(data.online ? CONNECTION.ONLINE : CONNECTION.OFFLINE);
      
      return data;
    } catch {
      setEdgeAvailable(false);
      setStatus(CONNECTION.OFFLINE);
      return null;
    }
  }, []);

  useEffect(() => {
    if (USE_MOCK) return;
    refreshStatus();
    const id = setInterval(refreshStatus, 10000);
    return () => clearInterval(id);
  }, [refreshStatus]);

  const simulateOffline = useCallback(async () => {
    try {
      await syncService.setNetwork(false); // Tell FastAPI to drop network
      setCloudSimulatedOffline(true);
      setStatus(CONNECTION.OFFLINE);
      setIsSyncing(false);
      setSyncProgress(0);
    } catch (e) {
      console.error("Failed to disconnect backend", e);
    }
  }, []);

  const restoreConnection = useCallback(async () => {
    try {
      await syncService.setNetwork(true); // Tell FastAPI to reconnect
      setCloudSimulatedOffline(false);
      setStatus(CONNECTION.ONLINE);
      refreshStatus();
    } catch (e) {
      console.error("Failed to reconnect backend", e);
    }
  }, [refreshStatus]);

  const simulateSync = useCallback(async () => {
    if (isSyncing || cloudSimulatedOffline || USE_MOCK) return;
    setStatus(CONNECTION.SYNCING);
    setIsSyncing(true);
    setSyncProgress(25);
    try {
      const res = await syncService.trigger(); // Trigger actual cloud push
      setSyncProgress(90);
      await refreshStatus();
      setSyncProgress(100);
      setIsSyncing(false);
      setStatus(CONNECTION.ONLINE);
      setLastSyncedAt(new Date());
      setLastSyncLabel('just now');
      setSyncResult(res);
      return res;
    } catch (e) {
      setIsSyncing(false);
      setSyncProgress(0);
      return { ok: false, error: e?.message };
    }
  }, [isSyncing, cloudSimulatedOffline, refreshStatus]);

  const markDirty = useCallback(() => setPendingCount((c) => c + 1), []);

  const value = useMemo(() => ({
    status, isOnline: status === CONNECTION.ONLINE, isOffline: status === CONNECTION.OFFLINE,
    isSyncing, edgeAvailable, edgeOnline: edgeAvailable !== false, cloudSimulatedOffline,
    backend, syncResult, lastSyncedAt, lastSyncLabel, syncProgress, pendingCount,
    setPendingCount, simulateOffline, restoreConnection, simulateSync, refreshStatus, markDirty, setStatus
  }), [status, isSyncing, edgeAvailable, cloudSimulatedOffline, backend, syncResult, lastSyncedAt, lastSyncLabel, syncProgress, pendingCount, simulateOffline, restoreConnection, simulateSync, refreshStatus, markDirty]);

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnection must be used within ConnectionProvider');
  return ctx;
}