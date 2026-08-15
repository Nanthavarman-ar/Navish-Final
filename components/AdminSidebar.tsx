import React from 'react';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { 
  LayoutDashboard, 
  Box, 
  Users, 
  Upload, 
  Settings, 
  FileText,
  LogOut,
  Menu,
  X,
  TestTube
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'models', label: 'Models', icon: Box },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
  { id: 'test-buttons', label: 'Button Tests', icon: TestTube },
];

export function Sidebar({ currentView, setCurrentView, isOpen, setIsOpen }: SidebarProps) {
  return (
    <>
      {/* Mobile Toggle */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-slate-800 border-slate-700"
        size="sm"
      >
        {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </Button>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 h-full bg-slate-800/50 backdrop-blur-sm border-r border-slate-700 transition-all duration-300 z-40",
          isOpen ? "w-64" : "w-16"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-lg">N</span>
            </div>
            {isOpen && (
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                NAVIZ
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <Button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 h-12 transition-all duration-200",
                  isActive 
                    ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400" 
                    : "text-gray-400 hover:text-white hover:bg-slate-700/50",
                  !isOpen && "justify-center"
                )}
              >
                <Icon className="w-5 h-5" />
                {isOpen && <span>{item.label}</span>}
              </Button>
            );
          })}
        </nav>

        {/* Bottom Action */}
        <div className="absolute bottom-4 left-4 right-4">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 h-12 text-red-400 hover:text-white hover:bg-red-500/20",
              !isOpen && "justify-center"
            )}
          >
            <LogOut className="w-5 h-5" />
            {isOpen && <span>Logout</span>}
          </Button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}