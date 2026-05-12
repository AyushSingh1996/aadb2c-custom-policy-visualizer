import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.js';
import { PolicyDetailScreen } from './routes/PolicyDetailScreen.js';
import { PolicyMapScreen } from './routes/PolicyMapScreen.js';
import { PlaceholderScreen } from './routes/PlaceholderScreen.js';
import { UploadScreen } from './routes/UploadScreen.js';

function AppLayout(): JSX.Element {
  return (
    <div className="app-shell">
      <div className="desktop-required">
        <div className="desktop-required__panel">
          <h1>This tool requires a desktop browser at 1280 px or wider.</h1>
          <p>Resize your browser window or reopen the app on a larger display.</p>
        </div>
      </div>

      <div className="app-shell__frame">
        <Sidebar />
        <main className="app-shell__content" aria-live="polite">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true,
      }}
    >
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<UploadScreen />} />
          <Route path="/map" element={<PolicyMapScreen />} />
          <Route path="/detail/:chainId" element={<PolicyDetailScreen />} />
          <Route path="/stub/:stubId" element={<PlaceholderScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
