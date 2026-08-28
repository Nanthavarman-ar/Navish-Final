import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { useApp } from '../../contexts/AppContext';
import { useApi, apiCall } from '../../hooks/useApi';
import { showToast } from '../utils/toast';
import {
  Search,
  Filter,
  Grid,
  List,
  Eye,
  Edit,
  Trash2,
  Users,
  Download,
  Calendar,
  FileType,
  HardDrive,
  LogOut
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';

export function ModelsPage() {
  const navigate = useNavigate();
  const { setSelectedModel } = useApp();

  const navigateToUpload = () => navigate('/admin/upload');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  // Fetch models from backend
  const { data: modelsResponse, loading, error, refetch } = useApi<{ models: any[] }>('/models');
  const [models, setModels] = useState<any[]>([]);

  // Real data only - this used to fall back to hardcoded sample models ("Modern
  // Conference Table" etc) on any fetch error, including a transient blip (cold Edge
  // Function start, a momentary 401 during token refresh). That made a real upload
  // look like it had vanished: the admin would navigate away and back, hit one flaky
  // fetch, and see 6 fake models with no sign their actual upload ever existed, with
  // only a toast that auto-dismisses in a few seconds as the only clue. Now `models`
  // only ever reflects what the server actually returned, and a failed fetch shows an
  // explicit retry state below instead of silently substituting fake data.
  React.useEffect(() => {
    if (modelsResponse?.models) {
      setModels(modelsResponse.models);
    }
  }, [modelsResponse]);

  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         model.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         model.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (selectedFilter === 'all') return matchesSearch;
    if (selectedFilter === 'assigned') return matchesSearch && model.assignedClients.length > 0;
    if (selectedFilter === 'unassigned') return matchesSearch && model.assignedClients.length === 0;
    
    return matchesSearch;
  });

  const handleViewModel = async (model: any) => {
    try {
      await apiCall(`/models/${model.id}/view`, { method: 'POST' });
    } catch { /* ignore */ }
    // BabylonWorkspace reads selectedModel.modelUrl, but the /models API returns the
    // file location as signedUrl - without this mapping modelUrl is undefined, so the
    // workspace opens with nothing to load and silently falls back to its empty
    // placeholder ground+box instead of the actual uploaded model. Same fix already
    // applied in AppLayout.tsx/ClientDashboard.tsx for their own model-open paths.
    setSelectedModel({
      ...model,
      modelUrl: model?.modelUrl || model?.signedUrl || model?.url || model?.fileUrl || null,
    });
    navigate('/workspace');
  };

  const handleSelectModel = (modelId: string | number) => {
    const idStr = modelId.toString();
    setSelectedModels(prev => 
      prev.includes(idStr) 
        ? prev.filter(id => id !== idStr)
        : [...prev, idStr]
    );
  };

  const handleDeleteModel = async (modelId: string | number) => {
    const model = models.find(m => m.id.toString() === modelId.toString());
    if (!confirm(`Delete "${model?.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await apiCall(`/models/${modelId}`, { method: 'DELETE' });
      refetch();
      showToast.success(`"${model?.name}" deleted`);
    } catch (error) {
      // Previously fell back to removing the row from local state only, which showed
      // the delete as "successful" in the UI while the model still existed on the
      // server - it would silently reappear on the next refetch with no indication
      // anything had gone wrong. Report the real failure instead.
      console.error('Failed to delete model:', error);
      showToast.error(`Failed to delete "${model?.name}"`, 'The model still exists on the server - please try again');
    }
  };

  const handleEditModel = (modelId: string | number) => {
    const model = models.find(m => m.id.toString() === modelId.toString());
    const newName = prompt('Enter new model name:', model?.name);
    if (newName && newName.trim()) {
      setModels(prev => prev.map(m => 
        m.id.toString() === modelId.toString() 
          ? { ...m, name: newName.trim() }
          : m
      ));
      console.log('Model renamed successfully');
    }
  };

  const [assignDialog, setAssignDialog] = useState<{ open: boolean; modelId: string | number | null; searchTerm: string; selectedClients: string[] }>({ open: false, modelId: null, searchTerm: '', selectedClients: [] });

  const [availableClients, setAvailableClients] = useState<Array<{ id: string; name: string; email: string; company: string }>>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  const handleAssignModel = (modelId: string | number) => {
    setAssignDialog({ open: true, modelId, searchTerm: '', selectedClients: [] });
    setIsLoadingClients(true);
    apiCall('/clients')
      .then((data) => {
        setAvailableClients((data.clients || []).map((c: any) => ({
          id: c.username, // /assign-model identifies clients by username, not their UUID
          name: c.name || c.username,
          email: c.email || '',
          company: c.company || ''
        })));
      })
      .catch((error) => {
        console.error('Failed to load clients for assignment:', error);
        showToast.error('Could not load client list');
      })
      .finally(() => setIsLoadingClients(false));
  };

  const confirmAssignment = async () => {
    const { modelId, selectedClients } = assignDialog;
    if (!modelId) return;
    const model = models.find(m => m.id.toString() === modelId.toString());
    // Assignment is a full replace of the client list for this model (matching what
    // the backend does), so merge with whoever was already assigned rather than
    // only ever adding - otherwise there'd be no way to remove access via this dialog.
    const newClients = [...new Set([...(model?.assignedClients || []), ...selectedClients])];
    try {
      await apiCall('/assign-model', {
        method: 'POST',
        body: JSON.stringify({ modelId, clientUsernames: newClients }),
      });
      setModels(prev => prev.map(m =>
        m.id.toString() === modelId.toString() ? { ...m, assignedClients: newClients } : m
      ));
      showToast.success(`Model assigned to ${selectedClients.length} user${selectedClients.length !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Failed to save model assignment:', error);
      showToast.error('Failed to update client access');
    }
    setAssignDialog({ open: false, modelId: null, searchTerm: '', selectedClients: [] });
  };

  const filteredClients = availableClients.filter(client =>
    client.name.toLowerCase().includes(assignDialog.searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(assignDialog.searchTerm.toLowerCase()) ||
    client.company.toLowerCase().includes(assignDialog.searchTerm.toLowerCase())
  );

  const handleDownloadModel = (modelId: string | number) => {
    const model = models.find(m => m.id.toString() === modelId.toString());
    if (model?.modelUrl) {
      const link = document.createElement('a');
      link.href = model.modelUrl;
      link.download = `${model.name || 'model'}.glb`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      // Previously built an <a> with href="#" and never clicked it - a no-op that
      // looked like a working download button. Say so instead of doing nothing.
      showToast.error('Download unavailable', `"${model?.name || 'This model'}" has no file URL on record`);
    }
  };

  const handleBulkAssign = () => {
    const clientCount = selectedModels.length;
    selectedModels.forEach(modelId => handleAssignModel(modelId));
    setSelectedModels([]);
    console.log(`${clientCount} models assigned to users`);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedModels.length} selected models? This cannot be undone.`)) return;

    const idsToDelete = [...selectedModels];
    setSelectedModels([]);

    const results = await Promise.allSettled(
      idsToDelete.map((modelId) => apiCall(`/models/${modelId}`, { method: 'DELETE' }))
    );
    const failed = results.filter((r) => r.status === 'rejected').length;

    setModels(prev => prev.filter(m => !idsToDelete.includes(m.id.toString())));

    if (failed > 0) {
      showToast.warning(`Deleted ${idsToDelete.length - failed} of ${idsToDelete.length} models`, `${failed} failed to delete on the server`);
    } else {
      showToast.success(`${idsToDelete.length} model${idsToDelete.length !== 1 ? 's' : ''} deleted`);
    }
    refetch();
  };

  const handleBulkExport = () => {
    // Bulk export has no real implementation yet (previously just a console.log) -
    // say so rather than clearing the selection as if it had done something.
    showToast.error('Bulk export not available yet', 'Download models individually for now');
  };

  const bulkActions = [
    { label: 'Assign to Users', action: handleBulkAssign },
    { label: 'Delete Selected', action: handleBulkDelete, dangerous: true },
    { label: 'Export Selected', action: handleBulkExport }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading models...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && models.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center max-w-md">
            <p className="text-white text-lg mb-2">Couldn't load your models</p>
            <p className="text-gray-400 text-sm mb-4">{error || 'The server request failed.'}</p>
            <Button onClick={() => refetch()} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400">
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold text-white">Models Management</h2>
          <p className="text-gray-400">Manage your 3D model library</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={navigateToUpload}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400"
          >
            Upload New Model
          </Button>
          <Button
            onClick={() => navigate('/login')}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-red-500/25 transform hover:scale-105 transition-all duration-300"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Back to Login
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
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
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
            aria-label="Filter models"
          >
            <option value="all">All Models</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
          
          <div className="flex border border-slate-600 rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-none"
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedModels.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-white">
              {selectedModels.length} model{selectedModels.length > 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              {bulkActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={action.action}
                  className={action.dangerous ? 'border-red-400 text-red-400 hover:bg-red-400 hover:text-white' : ''}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Models Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredModels.map((model) => (
            <Card key={model.id} className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 transition-all duration-300 group">
              <div className="aspect-video relative overflow-hidden rounded-t-lg">
                <input
                  type="checkbox"
                  checked={selectedModels.includes(model.id.toString())}
                  onChange={() => handleSelectModel(model.id)}
                  className="absolute top-2 left-2 z-10 w-4 h-4"
                  aria-label="Select model"
                />
                <ImageWithFallback
                  src={model.thumbnail || `https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300&h=200&fit=crop`}
                  alt={model.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Button
                    onClick={() => handleViewModel(model)}
                    size="sm"
                    className="bg-cyan-500 hover:bg-cyan-400"
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={() => handleEditModel(model.id)}
                    size="sm"
                    variant="outline"
                    className="border-white text-white hover:bg-white hover:text-black"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={() => handleDeleteModel(model.id)}
                    size="sm"
                    variant="outline"
                    className="border-red-400 text-red-400 hover:bg-red-400 hover:text-white"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
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
                    {model.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs border-slate-600 text-gray-400">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(model.uploadDate).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      {model.size}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <button
                      onClick={() => handleAssignModel(model.id)}
                      className="flex items-center gap-1 text-purple-400 hover:text-purple-300 underline-offset-2 hover:underline transition-colors"
                      title="Manage which clients can access this model"
                    >
                      <Users className="w-3 h-3" />
                      {model.assignedClients.length} user{model.assignedClients.length !== 1 ? 's' : ''}
                    </button>
                    <span className="text-gray-500">{model.views} views</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredModels.map((model) => (
            <Card key={model.id} className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(model.id.toString())}
                    onChange={() => handleSelectModel(model.id)}
                    className="w-4 h-4"
                    aria-label="Select model"
                  />
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <ImageWithFallback
                      src={model.thumbnail || `https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300&h=200&fit=crop`}
                      alt={model.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium mb-1">{model.name}</h3>
                    <p className="text-gray-400 text-sm mb-2 line-clamp-1">{model.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(model.uploadDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {model.size}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileType className="w-3 h-3" />
                        {model.format}
                      </span>
                      <button
                        onClick={() => handleAssignModel(model.id)}
                        className="flex items-center gap-1 text-purple-400 hover:text-purple-300 underline-offset-2 hover:underline transition-colors"
                        title="Manage which clients can access this model"
                      >
                        <Users className="w-3 h-3" />
                        {model.assignedClients.length} users
                      </button>
                      <span>{model.views} views</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleViewModel(model)}
                      size="sm"
                      className="bg-cyan-500 hover:bg-cyan-400"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      onClick={() => handleEditModel(model.id)}
                      size="sm"
                      variant="outline"
                      className="border-slate-600"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleAssignModel(model.id)}
                      size="sm"
                      variant="outline"
                      className="border-green-400 text-green-400 hover:bg-green-400 hover:text-white"
                    >
                      <Users className="w-4 h-4 mr-1" />
                      Assign
                    </Button>
                    <Button
                      onClick={() => handleDownloadModel(model.id)}
                      size="sm"
                      variant="outline"
                      className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-white"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-400 text-red-400 hover:bg-red-400 hover:text-white"
                      onClick={() => handleDeleteModel(model.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredModels.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">No models found</div>
          <p className="text-gray-500">Try adjusting your search terms or filters</p>
        </div>
      )}

      {/* Assign to Users Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={(open) => setAssignDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="bg-slate-800 border-slate-700/80 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Model to Users</DialogTitle>
            <DialogDescription>
              Search and select users to assign this model to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* User Search */}
            <div>
              <Label htmlFor="clientSearch">Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="clientSearch"
                  placeholder="Search by name, email, or company..."
                  value={assignDialog.searchTerm}
                  onChange={(e) => setAssignDialog(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="pl-10 bg-slate-700 border-slate-600"
                />
              </div>
            </div>
            
            {/* User List */}
            <div className="max-h-60 overflow-y-auto space-y-2">
              {isLoadingClients && (
                <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full" />
                  Loading clients...
                </div>
              )}
              {!isLoadingClients && filteredClients.map((client) => {
                const currentModel = models.find(m => m.id.toString() === assignDialog.modelId?.toString());
                const isAlreadyAssigned = currentModel?.assignedClients.includes(client.id);
                const isSelected = assignDialog.selectedClients.includes(client.id);
                
                return (
                  <div key={client.id} className="flex items-center space-x-3 p-2 bg-slate-700/30 rounded">
                    <input
                      type="checkbox"
                      id={`client-${client.id}`}
                      checked={isSelected}
                      disabled={isAlreadyAssigned}
                      onChange={(e) => {
                        const selected = assignDialog.selectedClients;
                        setAssignDialog(prev => ({
                          ...prev,
                          selectedClients: e.target.checked 
                            ? [...selected, client.id]
                            : selected.filter(id => id !== client.id)
                        }));
                      }}
                      className="rounded border-slate-600"
                    />
                    <label htmlFor={`client-${client.id}`} className="flex-1 cursor-pointer">
                      <div className="text-white font-medium">{client.name}</div>
                      <div className="text-sm text-gray-400">{client.email}</div>
                      <div className="text-xs text-gray-500">{client.company}</div>
                    </label>
                    {isAlreadyAssigned && (
                      <span className="text-xs text-green-400 bg-green-400/20 px-2 py-1 rounded">
                        Assigned
                      </span>
                    )}
                  </div>
                );
              })}
              
              {!isLoadingClients && filteredClients.length === 0 && (
                <div className="text-center py-4 text-gray-400">
                  No users found matching your search
                </div>
              )}
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button 
                onClick={confirmAssignment}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={assignDialog.selectedClients.length === 0}
              >
                Assign to {assignDialog.selectedClients.length} User{assignDialog.selectedClients.length !== 1 ? 's' : ''}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setAssignDialog({ open: false, modelId: null, searchTerm: '', selectedClients: [] })}
                className="border-slate-600"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}