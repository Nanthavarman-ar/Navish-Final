import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from './home/Header';
import { HeroSection } from './home/HeroSection';
import { FeaturesSection } from './home/FeaturesSection';
import { Footer } from './home/Footer';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
// Lazy-loaded: only rendered inside the on-demand workspace preview modal, but a static
// import here would pull the full Babylon.js engine (~1.25MB gzip) into every landing
// page load regardless of whether the modal is ever opened.
const BabylonWorkspace = React.lazy(() => import('./BabylonWorkspace'));
import { Users, Box, Settings, LogOut, Maximize2, Smartphone, Move, MousePointer, Monitor, Tablet, Square } from 'lucide-react';

export function Home() {
  const { setCurrentPage } = useApp();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 50, y: 50 });
  const [modalSize, setModalSize] = useState({ width: 375, height: 667 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 375, height: 667 });
  const [resizeDirection, setResizeDirection] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Size adjustment functions
  const setSizePreset = (width: number, height: number) => {
    const maxWidth = window.innerWidth - modalPosition.x;
    const maxHeight = window.innerHeight - modalPosition.y;
    const newWidth = Math.min(width, maxWidth);
    const newHeight = Math.min(height, maxHeight);
    setModalSize({ width: newWidth, height: newHeight });
  };

  // Keyboard shortcuts for size adjustment
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (workspaceModalOpen) {
        switch (e.key) {
          case '1':
            setSizePreset(375, 667); // Mobile
            break;
          case '2':
            setSizePreset(768, 1024); // Tablet
            break;
          case '3':
            setSizePreset(1200, 800); // Desktop
            break;
          case '4':
            setSizePreset(1920, 1080); // Full HD
            break;
          case '0':
            setSizePreset(375, 667); // Reset to mobile
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [workspaceModalOpen, modalPosition]);

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - modalPosition.x,
      y: e.clientY - modalPosition.y
    });
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Keep modal within viewport bounds
      const maxX = window.innerWidth - 375;
      const maxY = window.innerHeight - 667;

      setModalPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Resize functionality
  const handleResizeMouseDown = (e: React.MouseEvent, direction: string) => {
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: modalSize.width,
      height: modalSize.height
    });
    e.preventDefault();
    e.stopPropagation();
  };

  const handleResizeMouseMove = (e: MouseEvent) => {
    if (isResizing && resizeDirection) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;

      // Minimum size constraints
      const minWidth = 300;
      const minHeight = 400;
      const maxWidth = window.innerWidth - modalPosition.x;
      const maxHeight = window.innerHeight - modalPosition.y;

      switch (resizeDirection) {
        case 'se': // Southeast corner
          newWidth = Math.max(minWidth, Math.min(resizeStart.width + deltaX, maxWidth));
          newHeight = Math.max(minHeight, Math.min(resizeStart.height + deltaY, maxHeight));
          break;
        case 's': // South edge
          newHeight = Math.max(minHeight, Math.min(resizeStart.height + deltaY, maxHeight));
          break;
        case 'e': // East edge
          newWidth = Math.max(minWidth, Math.min(resizeStart.width + deltaX, maxWidth));
          break;
        case 'sw': // Southwest corner
          newWidth = Math.max(minWidth, Math.min(resizeStart.width - deltaX, maxWidth));
          newHeight = Math.max(minHeight, Math.min(resizeStart.height + deltaY, maxHeight));
          break;
        case 'w': // West edge
          newWidth = Math.max(minWidth, Math.min(resizeStart.width - deltaX, maxWidth));
          break;
        case 'ne': // Northeast corner
          newWidth = Math.max(minWidth, Math.min(resizeStart.width + deltaX, maxWidth));
          newHeight = Math.max(minHeight, Math.min(resizeStart.height - deltaY, maxHeight));
          break;
        case 'n': // North edge
          newHeight = Math.max(minHeight, Math.min(resizeStart.height - deltaY, maxHeight));
          break;
        case 'nw': // Northwest corner
          newWidth = Math.max(minWidth, Math.min(resizeStart.width - deltaX, maxWidth));
          newHeight = Math.max(minHeight, Math.min(resizeStart.height - deltaY, maxHeight));
          break;
      }

      setModalSize({ width: newWidth, height: newHeight });
    }
  };

  const handleResizeMouseUp = () => {
    setIsResizing(false);
    setResizeDirection('');
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = 'auto';
      };
    }
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMouseMove);
      document.addEventListener('mouseup', handleResizeMouseUp);
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
        document.body.style.userSelect = 'auto';
      };
    }
  }, [isResizing, resizeDirection, resizeStart]);

  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />
      <FeaturesSection />

      {/* Admin Dashboard Section - Only for admin users */}
      {user && user.role === 'admin' && (
        <section className="py-16 bg-slate-900">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-8 text-white">Admin Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <Card className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    User Management
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Manage user accounts and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => navigate('/admin/clients')}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400"
                  >
                    Manage Users
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Box className="w-5 h-5 text-cyan-400" />
                    Models Library
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Manage 3D model library and assignments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => navigate('/admin/models')}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400"
                  >
                    Manage Models
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-cyan-400" />
                    System Settings
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Configure system settings and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => navigate('/admin/settings')}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400"
                  >
                    System Settings
                  </Button>
                </CardContent>
              </Card>


            </div>

            <div className="text-center mt-8">
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button
                  onClick={() => setWorkspaceModalOpen(true)}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white px-6 py-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  3D Workspace →
                </Button>
                <Button
                  onClick={logout}
                  variant="outline"
                  className="border-red-400 text-red-400 hover:bg-red-400 hover:text-white"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}





      {/* Quick 3D Workspace Preview Section */}
      {user && (
      <section className="py-16 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Quick 3D Workspace Preview</h2>
            <p className="text-lg text-gray-600 mb-8">
              Experience our advanced 3D workspace with drag, resize, and scroll functionality
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Dialog open={workspaceModalOpen} onOpenChange={setWorkspaceModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    <Maximize2 className="w-5 h-5 mr-2" />
                    Open Quick Preview
                  </Button>
                </DialogTrigger>
                <DialogContent
                  ref={modalRef}
                  className={`p-0 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  style={{
                    position: 'fixed',
                    left: `${modalPosition.x}px`,
                    top: `${modalPosition.y}px`,
                    width: `${modalSize.width}px`,
                    height: `${modalSize.height}px`,
                    transform: 'none',
                    backgroundColor: '#1f2937',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                  }}
                  onMouseDown={handleMouseDown}
                >
                  <DialogHeader className="p-6 pb-4 bg-slate-800 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                      <DialogTitle className="text-lg font-bold text-white">
                        3D Preview
                      </DialogTitle>
                      <div className="flex items-center gap-2">
                        <MousePointer className="w-4 h-4 text-gray-400" />
                        <Move className="w-4 h-4 text-gray-400" />

                        {/* Size Controls */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSizePreset(375, 667)}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                            title="Mobile Size (1)"
                          >
                            <Smartphone className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSizePreset(768, 1024)}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                            title="Tablet Size (2)"
                          >
                            <Tablet className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSizePreset(1200, 800)}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                            title="Desktop Size (3)"
                          >
                            <Monitor className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSizePreset(1920, 1080)}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                            title="Full HD Size (4)"
                          >
                            <Square className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Size Indicator */}
                        <div className="text-xs text-gray-400 px-2 py-1 bg-slate-700 rounded">
                          {modalSize.width}×{modalSize.height}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setWorkspaceModalOpen(false);
                          }}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="flex-1 p-0 bg-slate-900 overflow-auto w-full h-full scrollbar-thin scrollbar-track-slate-700 scrollbar-thumb-slate-500">
                    <div className="w-full h-full min-h-[600px]">
                      <Suspense fallback={
                        <div className="w-full h-full min-h-[600px] flex items-center justify-center">
                          <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
                        </div>
                      }>
                        <BabylonWorkspace
                          workspaceId="naviz-studio-main"
                          isAdmin={user?.role === 'admin'}
                          layoutMode="compact"
                          performanceMode="medium"
                          enablePhysics={false}
                          enableXR={true}
                          enableSpatialAudio={false}
                          renderingQuality="high"
                        />
                      </Suspense>
                    </div>
                  </div>

                  {/* Resize Handles */}
                  {/* Corner handles */}
                  <div
                    className="absolute -bottom-1 -right-1 w-4 h-4 cursor-se-resize bg-slate-600 hover:bg-slate-500"
                    onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
                  />
                  <div
                    className="absolute -bottom-1 -left-1 w-4 h-4 cursor-sw-resize bg-slate-600 hover:bg-slate-500"
                    onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
                  />
                  <div
                    className="absolute -top-1 -right-1 w-4 h-4 cursor-ne-resize bg-slate-600 hover:bg-slate-500"
                    onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
                  />
                  <div
                    className="absolute -top-1 -left-1 w-4 h-4 cursor-nw-resize bg-slate-600 hover:bg-slate-500"
                    onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
                  />

                  {/* Edge handles */}
                  <div
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-8 h-2 cursor-n-resize bg-slate-600 hover:bg-slate-500"
                    onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
                  />
                  <div
                    className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-8 h-2 cursor-s-resize bg-slate-600 hover:bg-slate-500"
                    onMouseDown={(e) => handleResizeMouseDown(e, 's')}
                  />
                  <div
                    className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-8 cursor-w-resize bg-slate-600 hover:bg-slate-500"
                    onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
                  />
                  <div
                    className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 w-2 h-8 cursor-e-resize bg-slate-600 hover:bg-slate-500"
                    onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
                  />
                </DialogContent>
              </Dialog>
            </div>


          </div>
        </div>
      </section>
      )}

      
      <Footer />
    </div>
  );
}
