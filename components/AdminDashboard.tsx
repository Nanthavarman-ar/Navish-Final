import React, { useState, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  LayoutDashboard,
  Users,
  Box,
  FileText,
  Settings,
  Upload,
  LogOut,
  Home,
  ChevronLeft,
  ChevronRight,
  Inbox
} from 'lucide-react';

// Lazy load heavy components for better performance
const OverviewPage = lazy(() => import('./admin/OverviewPage').then(module => ({ default: module.OverviewPage })));
const ClientsPage = lazy(() => import('./admin/ClientsPage').then(module => ({ default: module.ClientsPage })));
const ModelsPage = lazy(() => import('./admin/ModelsPage').then(module => ({ default: module.ModelsPage })));
const AuditLogsPage = lazy(() => import('./admin/AuditLogsPage').then(module => ({ default: module.AuditLogsPage })));
const SettingsPage = lazy(() => import('./admin/SettingsPage').then(module => ({ default: module.SettingsPage })));
const EnquiriesPage = lazy(() => import('./admin/EnquiriesPage').then(module => ({ default: module.EnquiriesPage })));
const UploadPage = lazy(() => import('./admin/UploadPage').then(module => ({ default: module.UploadPage })));

type AdminView = 'overview' | 'enquiries' | 'clients' | 'models' | 'audit' | 'settings' | 'upload';
const KNOWN_VIEWS: AdminView[] = ['overview', 'enquiries', 'clients', 'models', 'audit', 'settings', 'upload'];

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentView, setCurrentView] = useState<AdminView>('overview');
  // Starts collapsed (icons only) on phones/tablets - the full 256px sidebar left a
  // 390px-wide screen with barely any room for the actual page.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );

  // Determine current view from URL. Any admin sub-path that isn't one of the specific
  // views below (e.g. the bare /admin or /admin/dashboard AppLayout's page-state router
  // can land on) falls through to the Overview - previously that silently left
  // currentView at whatever it last was instead of showing a real landing page, which is
  // why admin login used to drop straight into the Clients list with no overview at all.
  React.useEffect(() => {
    const path = location.pathname.split('/admin/')[1];
    setCurrentView(path && KNOWN_VIEWS.includes(path as AdminView) ? (path as AdminView) : 'overview');
  }, [location.pathname]);

  const handleViewChange = (view: AdminView) => {
    setCurrentView(view);
    navigate(`/admin/${view}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/home');
  };

  const menuItems = [
    { id: 'overview' as AdminView, label: 'Overview', icon: LayoutDashboard, description: 'Platform stats at a glance' },
    { id: 'enquiries' as AdminView, label: 'Enquiries', icon: Inbox, description: 'Contact form messages' },
    { id: 'clients' as AdminView, label: 'User Management', icon: Users, description: 'Manage user accounts' },
    { id: 'models' as AdminView, label: 'Models Library', icon: Box, description: 'Manage 3D models' },
    { id: 'upload' as AdminView, label: 'Upload Models', icon: Upload, description: 'Upload new models' },
    { id: 'audit' as AdminView, label: 'Audit Logs', icon: FileText, description: 'View system logs' },
    { id: 'settings' as AdminView, label: 'Settings', icon: Settings, description: 'System settings' }
  ];

  const renderCurrentView = () => {
    switch (currentView) {
      case 'overview':
        return <OverviewPage />;
      case 'enquiries':
        return <EnquiriesPage />;
      case 'clients':
        return <ClientsPage />;
      case 'models':
        return <ModelsPage />;
      case 'upload':
        return <UploadPage />;
      case 'audit':
        return <AuditLogsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="h-screen bg-slate-900 flex relative overflow-hidden">
      <div className="ambient-glow" aria-hidden><span className="ambient-glow-blob" /></div>
      {/* Sidebar - relative z-10 so it stacks above the ambient-glow layer */}
      <div className={`relative z-10 shrink-0 flex flex-col bg-slate-800 border-r border-slate-700 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-white font-bold text-lg">Admin Panel</h1>
                <p className="text-gray-400 text-sm">Navish Studio</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-gray-400 hover:text-white"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!sidebarCollapsed}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <nav className="p-2 space-y-2 overflow-y-auto" aria-label="Admin">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <Button
                key={item.id}
                variant={isActive ? 'default' : 'ghost'}
                className={`w-full justify-start ${isActive ? 'bg-cyan-600 hover:bg-cyan-700' : 'text-gray-400 hover:text-white hover:bg-slate-700'}`}
                onClick={() => handleViewChange(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                aria-label={sidebarCollapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && (
                  <div className="text-left">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs opacity-75">{item.description}</div>
                  </div>
                )}
              </Button>
            );
          })}
        </nav>

        {/* In normal flow (mt-auto) rather than absolute - it used to sit on top of the
            last menu items on short screens. */}
        <div className="mt-auto p-2 pb-4">
          <Button
            variant="outline"
            className="w-full border-slate-600 text-gray-400 hover:text-white hover:bg-slate-700"
            onClick={handleLogout}
            title={sidebarCollapsed ? 'Logout' : undefined}
            aria-label="Logout"
          >
            <LogOut className={`w-4 h-4 ${sidebarCollapsed ? '' : 'mr-2'}`} />
            {!sidebarCollapsed && 'Logout'}
          </Button>
        </div>
      </div>

      {/* Main Content - relative z-10 so it stacks above the ambient-glow layer */}
      <div className="relative z-10 flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700/80 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-gray-400 hover:text-white"
                aria-label="Back to home"
              >
                <Home className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Back to Home</span>
              </Button>
              <div>
                <h2 className="text-white text-xl font-semibold">
                  {menuItems.find(item => item.id === currentView)?.label}
                </h2>
                <p className="text-gray-400 text-sm hidden sm:block">
                  {menuItems.find(item => item.id === currentView)?.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Badge variant="outline" className="border-cyan-400 text-cyan-400">
                {user?.role === 'client' ? 'User' : user?.role?.toUpperCase()}
              </Badge>
              <div className="text-right hidden md:block">
                <p className="text-white font-medium">{user?.name}</p>
                <p className="text-gray-400 text-sm">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-400">Loading...</p>
              </div>
            </div>
          }>
            {renderCurrentView()}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
