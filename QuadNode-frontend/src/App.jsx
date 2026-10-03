import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConnectionProvider } from './context/ConnectionContext';
import { ThemeProvider } from './context/ThemeContext';
import AppShell from './components/layout/AppShell';
import Landing from './pages/Landing';
import Overview from './pages/Overview';
import Assistant from './pages/Assistant';
import Memory from './pages/Memory';
import SearchPage from './pages/Search';
import Documents from './pages/Documents';
import Synchronization from './pages/Synchronization';
import Conflicts from './pages/Conflicts';
import Timeline from './pages/Timeline';
import Devices from './pages/Devices';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ThemeProvider>
    <ConnectionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<AppShell />}>
            <Route path="dashboard" element={<Overview />} />
            <Route path="assistant" element={<Assistant />} />
            <Route path="memory" element={<Memory />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="documents" element={<Documents />} />
            <Route path="sync" element={<Synchronization />} />
            <Route path="conflicts" element={<Conflicts />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="devices" element={<Devices />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConnectionProvider>
    </ThemeProvider>
  );
}
