import { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '../components/common/Card';
import { SyncBadge } from '../components/common/Badge';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import ProgressBar from '../components/common/ProgressBar';
import { useConnection } from '../context/ConnectionContext';
import { memoryService } from '../api/services';

const stages = ['Upload', 'Processing', 'Embedded', 'Stored'];

export default function Documents() {
  const { isOffline, markDirty, refreshStatus } = useConnection();
  const [docs, setDocs] = useState([]); 
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(null);
  const fileInputRef = useRef(null);

  // Processes a single file
  const handleFileUpload = async (file) => {
    const docId = `DOC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const newDoc = {
      id: docId, name: file.name, chunks: 0, status: 'Processing',
      privacy: 'SCANNING', added: new Date().toISOString(), 
      syncStatus: 'PENDING', size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    };
    
    // Add to UI immediately
    setDocs((prev) => [newDoc, ...prev]);
    setUploading({ id: docId, stage: 0 });

    try {
      setUploading({ id: docId, stage: 1 });
      const res = await memoryService.upload(file);
      setUploading({ id: docId, stage: 2 });
      
      setTimeout(() => {
        setUploading(null);
        setDocs((prevDocs) => prevDocs.map((x) => (x.id === docId ? { 
          ...x, 
          chunks: res.chunks || 1, 
          status: 'Indexed',
          privacy: res.local_only > 0 ? 'LOCAL ONLY' : 'SYNC ALLOWED',
          syncStatus: res.local_only > 0 ? 'LOCAL ONLY' : 'PENDING'
        } : x)));
        markDirty();
        refreshStatus();
      }, 800);
      
    } catch (err) {
      console.error(`Upload failed for ${file.name}`, err);
      setUploading(null);
      setDocs((prevDocs) => prevDocs.map((x) => (x.id === docId ? { ...x, status: 'Failed', privacy: 'ERROR' } : x)));
    }
  };

  // Loop through multiple selected or dropped files
  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => handleFileUpload(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Local ingestion pipeline"
        title="Documents"
        subtitle={isOffline ? 'Local ingestion continues while offline. Sync queues automatically.' : 'Ingest → chunk → embed locally → store in Qdrant Edge.'}
        actions={
          <>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".pdf,.txt" 
              multiple // Allows selecting multiple files in the dialog
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = null; // Resets input so you can upload the exact same file again
              }} 
            />
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud size={14} /> Upload document
            </Button>
          </>
        }
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        className={`card-enter flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-all duration-200 ${drag ? 'scale-[1.005] border-blue-500/60 bg-blue-500/5 dark:border-cyan-400/60 dark:bg-cyan-500/5' : 'border-slate-300 bg-white dark:border-white/15 dark:bg-white/[0.02]'}`}
      >
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${drag ? 'bg-blue-500/15 text-blue-600 dark:bg-cyan-500/15 dark:text-cyan-300' : 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500'}`}>
          <UploadCloud size={22} />
        </span>
        <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">Drag & drop files here, or <button className="cursor-pointer text-blue-600 underline underline-offset-2 dark:text-cyan-300" onClick={() => fileInputRef.current?.click()}>browse</button></p>
        <p className="mt-1 font-mono text-[11px] tracking-wider text-slate-400 uppercase dark:text-slate-500">PDF · TXT — embedded locally with Nomic</p>
        {uploading && (
          <div className="mt-5 w-full max-w-md">
            <div className="mb-2 flex justify-between font-mono text-[11px] text-slate-400 dark:text-slate-400">
              {stages.map((s, i) => (
                <span key={s} className={i <= uploading.stage ? 'font-semibold text-blue-600 dark:text-cyan-300' : ''}>{s}{i <= uploading.stage ? ' ✓' : ''}</span>
              ))}
            </div>
            <ProgressBar value={((uploading.stage + 1) / stages.length) * 100} />
          </div>
        )}
      </div>

      <Card className="card-enter stagger-2 mt-4 overflow-hidden">
        <CardHeader title="Session Document Queue" subtitle={`${docs.length} files processed in this session`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 font-mono text-[10px] tracking-widest text-slate-400 uppercase dark:border-white/10 dark:text-slate-500">
                <th className="px-4 py-2.5">Document</th>
                <th className="px-4 py-2.5">Chunks</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Privacy</th>
                <th className="px-4 py-2.5">Added</th>
                <th className="px-4 py-2.5">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {docs.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-xs text-slate-400">No documents uploaded this session.</td>
                </tr>
              )}
              {docs.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-cyan-500/10 dark:text-cyan-300">
                        <FileText size={14} />
                      </span>
                      <div><p className="font-medium text-slate-800 dark:text-slate-200">{d.name}</p><p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{d.id} · {d.size || 'N/A'}</p></div>
                    </div>
                  </td>
                  <td className="tnum px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300">{d.chunks}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      {d.status === 'Processing' ? <Loader2 size={13} className="animate-spin text-amber-500" /> : d.status === 'Failed' ? <span className="text-red-500">Failed</span> : <CheckCircle2 size={13} className="text-emerald-500" />}
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><Badge tone={d.privacy === 'LOCAL ONLY' ? 'red' : d.privacy === 'ERROR' ? 'slate' : 'cyan'}>{d.privacy}</Badge></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400 dark:text-slate-500">{new Date(d.added).toLocaleTimeString()}</td>
                  <td className="px-4 py-2.5"><SyncBadge status={d.syncStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}