import React, { useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useApi, apiCall } from '../hooks/useApi';
import {
  Search,
  Grid,
  List,
  Eye,
  LogOut,
  Calendar
} from 'lucide-react';

// Lazy load heavy components
const ImageWithFallback = lazy(() => import('./figma/ImageWithFallback').then(module => ({ default: module.ImageWithFallback })));

export function ClientDashboard() {
  const { user, logout } = useAuth();
  const { refreshSubscription } = useSubscription();
  const navigate = useNavigate();
  const { setSelectedModel } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const getModelUrl = (model: any): string | null =>
    model?.modelUrl ||
    model?.signedUrl ||
    model?.url ||
    model?.fileUrl ||
    null;

  const getModelThumbnail = (model: any): string =>
    model?.thumbnail ||
    model?.preview ||
    ''; // ImageWithFallback shows a neutral placeholder (was an unrelated stock photo).

  const formatFileSize = (model: any): string => {
    if (typeof model?.fileSize === 'number') {
      return `${(model.fileSize / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (typeof model?.size === 'string' && model.size.trim()) {
      return model.size;
    }
    return 'N/A';
  };

  // Fetch models from backend
  const { data: modelsResponse, loading, error, refetch } = useApi<{ models: any[] }>('/models', [user?.id]);
  const models = modelsResponse?.models || [];

  React.useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  const filteredModels = models.filter((model: any) =>
    (model.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (model.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (Array.isArray(model.tags) && model.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  );
  const myUploadedModels = filteredModels.filter((model: any) => model.uploadedBy === user?.id);
  const accessibleModels = filteredModels.filter((model: any) => model.uploadedBy !== user?.id);

  const handleOpenWorkspace = async (model: any) => {
    const modelUrl = getModelUrl(model);
    try {
      await apiCall(`/models/${model.id}/view`, { method: 'POST' });
    } catch { /* ignore */ }
    setSelectedModel({
      ...model,
      modelUrl,
    });
    navigate('/workspace');
  };

  const renderModelsSection = (title: string, sectionModels: any[], emptyMessage: string) => {
    if (sectionModels.length === 0) {
      return (
        <section>
        <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-8 text-center">
            <p className="text-gray-400">{emptyMessage}</p>
          </CardContent>
        </Card>
        </section>
      );
    }

    return (
      <>
        <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sectionModels.map((model) => (
              // The whole card opens the model (it showed a pointer cursor but only the
              // small hover button actually did anything); Enter/Space work too.
              <Card
                key={model.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${model.name || 'model'} in the workspace`}
                onClick={() => handleOpenWorkspace(model)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleOpenWorkspace(model);
                  }
                }}
                className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 focus-visible:outline-2 focus-visible:outline-purple-400 transition-all duration-300 group cursor-pointer"
              >
                <div className="aspect-video relative overflow-hidden rounded-t-lg">
                  <Suspense fallback={
                    <div className="w-full h-full bg-slate-700 animate-pulse flex items-center justify-center">
                      <div className="text-gray-400">Loading...</div>
                    </div>
                  }>
                    <ImageWithFallback
                      src={getModelThumbnail(model)}
                      alt={model.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </Suspense>
                  <div className="hover-reveal absolute inset-0 bg-linear-to-t from-black/60 to-transparent pointer-events-none" />
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleOpenWorkspace(model); }}
                    tabIndex={-1}
                    className="hover-reveal absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400"
                    size="sm"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Open in Workspace
                  </Button>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-lg">{model.name}</CardTitle>
                  <CardDescription className="text-gray-400 text-sm line-clamp-2">
                    {model.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(model.tags) ? model.tags : []).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs border-slate-600 text-gray-400">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {model.uploadDate ? new Date(model.uploadDate).toLocaleDateString() : 'Unknown date'}
                      </span>
                      <span>{formatFileSize(model)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {sectionModels.map((model) => (
              <Card key={model.id} className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                      <Suspense fallback={
                        <div className="w-full h-full bg-slate-700 animate-pulse flex items-center justify-center">
                          <div className="text-gray-400 text-xs">Loading...</div>
                        </div>
                      }>
                        <ImageWithFallback
                          src={getModelThumbnail(model)}
                          alt={model.name}
                          className="w-full h-full object-cover"
                        />
                      </Suspense>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium mb-1">{model.name}</h3>
                      <p className="text-gray-400 text-sm mb-2 line-clamp-1">{model.description}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(Array.isArray(model.tags) ? model.tags : []).map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs border-slate-600 text-gray-400">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {model.uploadDate ? new Date(model.uploadDate).toLocaleDateString() : 'Unknown date'}
                        </span>
                        <span>{formatFileSize(model)}</span>
                        <span>{model.format}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleOpenWorkspace(model)}
                        className="bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400"
                        size="sm"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Open
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading your models...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">Couldn't load your models</p>
          <p className="text-gray-400 mb-6">{error}</p>
          {/* There used to be no way out of this screen short of reloading the page. */}
          <div className="flex gap-3 justify-center">
            <Button onClick={() => refetch()} className="bg-purple-600 hover:bg-purple-700">Try again</Button>
            <Button variant="outline" onClick={logout} className="border-slate-600">Log out</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 relative">
      {/* fixed (not absolute) so the blobs track the viewport instead of the full
          scrollable page height - this page's content can grow well past 100vh
          (many models), and an absolute inset-0 box anchored to that full height
          pushed most of the glow off past the fold, leaving only a sliver visible
          in a corner regardless of scroll position. */}
      <div className="ambient-glow" style={{ position: 'fixed' }} aria-hidden><span className="ambient-glow-blob" /></div>
      {/* Header - relative z-10 so it stacks above the ambient-glow layer */}
      <header className="relative z-10 bg-slate-800/50 backdrop-blur-xs border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">My Models</h1>
            <p className="text-gray-400">Welcome back{user?.name && !user.name.includes('@') ? `, ${user.name}` : ''}</p>
          </div>
          <div className="flex items-center gap-4">
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
      </header>

      {/* Main Content - relative z-10 so it stacks above the ambient-glow layer */}
      <main className="relative z-10 p-6">
        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search models..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-800/50 border-slate-600 text-white placeholder-gray-400"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex border border-slate-600 rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  aria-pressed={viewMode === 'grid'}
                  className="rounded-none"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  aria-pressed={viewMode === 'list'}
                  className="rounded-none"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Clients can't upload (uploads go through the admin), so an always-empty
              "My Uploaded Models" section only contradicted the upload page. Shown
              only for accounts that do have their own uploads. */}
          {myUploadedModels.length > 0 && renderModelsSection(
            'My Uploaded Models',
            myUploadedModels,
            'No uploaded models match your search.'
          )}
          {renderModelsSection(
            'Assigned / Shared With Me',
            accessibleModels,
            searchTerm ? 'No models match your search.' : 'No models have been shared with you yet. Your project team will add them here.'
          )}
        </div>
      </main>
    </div>
  );
}