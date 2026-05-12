import { BookOpenText, FileUp, FolderTree, History, Route, Settings, ShieldCheck } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAnalysisStore } from '../store/analysis.js';

interface NavItemDefinition {
  label: string;
  to: string;
  icon: JSX.Element;
}

const uploadNavItem = { label: 'Upload', icon: <FileUp size={18} aria-hidden="true" /> };
const mapNavItem = { label: 'Policy Map', icon: <FolderTree size={18} aria-hidden="true" /> };
const detailNavItem = { label: 'Policy Detail', icon: <Route size={18} aria-hidden="true" /> };

const secondaryNavItems: NavItemDefinition[] = [
  { label: 'History', to: '/stub/history', icon: <History size={18} aria-hidden="true" /> },
  { label: 'Settings', to: '/stub/settings', icon: <Settings size={18} aria-hidden="true" /> },
  {
    label: 'Documentation',
    to: '/stub/documentation',
    icon: <BookOpenText size={18} aria-hidden="true" />,
  },
];

function navClassName(isActive: boolean): string {
  return `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`;
}

export function Sidebar(): JSX.Element {
  const result = useAnalysisStore((state) => state.result);
  const location = useLocation();
  const firstChainId = result?.chains[0]?.id;
  const detailPath = location.pathname.startsWith('/detail/')
    ? location.pathname
    : firstChainId
      ? `/detail/${firstChainId}`
      : '';

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark" aria-hidden="true">
          <ShieldCheck size={18} />
        </div>
        <div className="sidebar__brand-text">B2C Policy Visualizer</div>
      </div>

      <nav aria-label="Primary navigation" className="sidebar__nav-group">
        <NavLink to="/" className={({ isActive }) => navClassName(isActive)} end>
          {uploadNavItem.icon}
          <span>{uploadNavItem.label}</span>
        </NavLink>

        <NavLink to="/map" className={({ isActive }) => navClassName(isActive)}>
          {mapNavItem.icon}
          <span>{mapNavItem.label}</span>
        </NavLink>

        {detailPath ? (
          <NavLink to={detailPath} className={({ isActive }) => navClassName(isActive)}>
            {detailNavItem.icon}
            <span>{detailNavItem.label}</span>
          </NavLink>
        ) : (
          <button
            type="button"
            className="sidebar__nav-disabled"
            aria-disabled="true"
            title="Run an analysis first to enable Policy Detail."
          >
            {detailNavItem.icon}
            <span>{detailNavItem.label}</span>
          </button>
        )}
      </nav>

      <nav aria-label="Secondary navigation" className="sidebar__nav-group">
        {secondaryNavItems.map((item) => (
          <NavLink key={item.label} to={item.to} className={({ isActive }) => navClassName(isActive)}>
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
