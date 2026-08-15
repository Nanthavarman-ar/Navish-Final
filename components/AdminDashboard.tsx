import React, { useState, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Users,
  Box,
  FileText,
  Settings,
  Upload,
  LogOut,
  Home,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Lazy load heavy components for better performance
const ClientsPage = lazy(() => import('./admin/ClientsPage').then(module => ({ default: module.ClientsPage })));
const ModelsPage = lazy(() => import('./admin/ModelsPage').then(module => ({ default: module.ModelsPage })));
const AuditLogsPage = lazy(() => import('./admin/AuditLogsPage').then(module => ({ default: module.AuditLogsPage })));
const SettingsPage = lazy(() => import('./admin/SettingsPage').then(module => ({ default: module.SettingsPage })));
const UploadPage = lazy(() => import('./admin/UploadPage').then(module => ({ default: module.UploadPage })));

type AdminView = 'clients' | 'models' | 'audit' | 'settings' | 'upload';

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentView, setCurrentView] = useState<AdminView>('clients');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Determine current view from URL
  React.useEffect(() => {
    const path = location.pathname.split('/admin/')[1];
    if (path && ['clients', 'models', 'audit', 'settings', 'upload'].includes(path)) {
      setCurrentView(path as AdminView);
    }
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
    { id: 'clients' as AdminView, label: 'User Management', icon: Users, description: 'Manage user accounts' },
    { id: 'models' as AdminView, label: 'Models Library', icon: Box, description: 'Manage 3D models' },
    { id: 'upload' as AdminView, label: 'Upload Models', icon: Upload, description: 'Upload new models' },
    { id: 'audit' as AdminView, label: 'Audit Logs', icon: FileText, description: 'View system logs' },
    { id: 'settings' as AdminView, label: 'Settings', icon: Settings, description: 'System settings' }
  ];

  const renderCurrentView = () => {
    switch (currentView) {
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
        return <ClientsPage />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <div className={`bg-slate-800 border-r border-slate-700 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-white font-bold text-lg">Admin Panel</h1>
                <p className="text-gray-400 text-sm">NAVIZ Studio</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-gray-400 hover:text-white"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <Button
                key={item.id}
                variant={isActive ? 'default' : 'ghost'}
                className={`w-full justify-start ${isActive ? 'bg-cyan-600 hover:bg-cyan-700' : 'text-gray-400 hover:text-white hover:bg-slate-700'}`}
                onClick={() => handleViewChange(item.id)}
              >
                <Icon className="w-4 h-4 mr-3" />
                {!sidebarCollapsed && (
                  <div className="text-left">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs opacity-75">{item.description}</div>
                  </div>
                )}
              </Button>
            );
          })}
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <Button
            variant="outline"
            className="w-full border-slate-600 text-gray-400 hover:text-white hover:bg-slate-700"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {!sidebarCollapsed && 'Logout'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700/80 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/home')}
                className="text-gray-400 hover:text-white"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
              <div>
                <h2 className="text-white text-xl font-semibold">
                  {menuItems.find(item => item.id === currentView)?.label}
                </h2>
                <p className="text-gray-400 text-sm">
                  {menuItems.find(item => item.id === currentView)?.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Badge variant="outline" className="border-cyan-400 text-cyan-400">
                {user?.role === 'client' ? 'User' : user?.role?.toUpperCase()}
              </Badge>
              <div className="text-right">
                <p className="text-white font-medium">{user?.name}</p>
                <p className="text-gray-400 text-sm">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
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
