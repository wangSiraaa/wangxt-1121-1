import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarPlus, FlaskConical, Package, ChevronLeft, ChevronRight, Droplets } from 'lucide-react';
import { useStore } from '@/store';

const navItems = [
  { key: 'dashboard', path: '/', label: '工作台', icon: LayoutDashboard },
  { key: 'schedule', path: '/schedule', label: '排班预约', icon: CalendarPlus },
  { key: 'screening', path: '/screening', label: '筛查检验', icon: FlaskConical },
  { key: 'inventory', path: '/inventory', label: '库存发放', icon: Package },
];

const pageTitles: Record<string, string> = {
  dashboard: '工作台',
  schedule: '排班预约',
  screening: '筛查检验',
  inventory: '库存发放',
};

const roles = ['招募人员', '检验人员', '发血岗'];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar, activePage, setActivePage, userRole, setUserRole } = useStore();

  const currentKey = navItems.find((n) => n.path === location.pathname)?.key || 'dashboard';

  return (
    <div className="flex h-screen bg-stone-100 font-sans">
      <aside
        className={`flex flex-col bg-white border-r border-stone-200 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className={`flex items-center h-16 border-b border-stone-100 ${sidebarCollapsed ? 'justify-center' : 'px-5'}`}>
          <Droplets className="w-7 h-7 text-blood-700 flex-shrink-0" />
          {!sidebarCollapsed && (
            <span className="ml-2 font-serif font-bold text-blood-800 text-lg whitespace-nowrap">
              血小板供应
            </span>
          )}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActivePage(item.key);
                  navigate(item.path);
                }}
                className={`sidebar-item w-full ${isActive ? 'active' : ''} ${
                  sidebarCollapsed ? 'justify-center px-0' : ''
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center h-10 border-t border-stone-100 text-stone-400 hover:text-blood-700 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-stone-200">
          <h1 className="font-serif font-bold text-xl text-stone-800">
            {pageTitles[currentKey] || '工作台'}
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-500">当前角色</span>
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              className="form-input w-auto py-1.5 text-sm"
            >
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
