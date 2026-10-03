import { fetchAPI, BASE_URL } from './client';

export const syncService = {
  status: () => fetchAPI('/status'),
  trigger: () => fetchAPI('/sync/push', { method: 'POST' }),
  setNetwork: (online) => fetchAPI('/network', { method: 'POST', body: JSON.stringify({ online }) })
};

export const chatService = {
  send: (query) => fetchAPI('/chat', { method: 'POST', body: JSON.stringify({ query, k: 3 }) })
};

export const memoryService = {
  list: (limit = 100) => fetchAPI(`/memories?limit=${limit}`),
  create: (data) => fetchAPI('/ingest', { method: 'POST', body: JSON.stringify(data) }),
  activity: (limit = 50) => fetchAPI(`/activity?limit=${limit}`),
  upload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: formData });
    if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  }
};

export const searchService = {
  query: (q) => fetchAPI('/search', { method: 'POST', body: JSON.stringify({ query: q, k: 10 }) })
};

export const conflictService = {
  list: () => fetchAPI('/conflicts'),
  resolve: (id, strategy) => fetchAPI(`/conflicts/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ strategy })
  })
};