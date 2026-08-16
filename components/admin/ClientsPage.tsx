import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { supabase, projectId } from '../../supabase/client';
import { apiCall } from '../../hooks/useApi';
import { showToast } from '../utils/toast';
import {
  Search,
  UserPlus,
  Eye,
  Edit,
  Trash2,
  Key,
  UserX,
  Calendar,
  Box,
  Mail,
  Phone,
  MapPin,
  LogOut
} from 'lucide-react';

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

interface Client {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  location: string;
  createdDate: string;
  assignedModels: number;
  lastActive: string;
  status: 'active' | 'inactive';
}

interface NewClientForm {
  name: string;
  username: string;
  email: string;
  phone: string;
  company: string;
  location: string;
  password: string;
}

interface FormErrors {
  [key: string]: string;
}

interface AssignableModel {
  id: string;
  name: string;
  assignedClients: string[];
}

export function ClientsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [assignModelsDialog, setAssignModelsDialog] = useState<{ open: boolean; clientUsername: string; clientName: string; searchTerm: string; selectedModelIds: string[] }>({ open: false, clientUsername: '', clientName: '', searchTerm: '', selectedModelIds: [] });
  const [availableModels, setAvailableModels] = useState<AssignableModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [newClient, setNewClient] = useState<NewClientForm>({
    name: '',
    username: '',
    email: '',
    phone: '',
    company: '',
    location: '',
    password: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const loadClients = React.useCallback(async () => {
    setIsLoadingClients(true);
    setClientsError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Authentication required');

      const response = await fetch(`${functionsBaseUrl}/clients`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!response.ok) throw new Error(`Failed to load clients (${response.status})`);

      const data = await response.json();
      const rawClients: any[] = data.clients || [];
      const normalized: Client[] = rawClients.map((u) => ({
        id: u.id,
        username: u.username || '',
        name: u.name || u.username || 'Unnamed',
        email: u.email || '',
        phone: u.phone || '',
        company: u.company || '',
        location: u.location || '',
        createdDate: u.createdDate || u.created_at || '',
        // Backend stores assignedModels as an array of model IDs; the UI shows a count.
        assignedModels: Array.isArray(u.assignedModels) ? u.assignedModels.length : (u.assignedModels || 0),
        lastActive: u.lastActive || u.createdDate || '',
        status: u.status === 'inactive' ? 'inactive' : 'active'
      }));
      setClients(normalized);
    } catch (error) {
      // This used to fall back to hardcoded sample clients ("John Smith" etc) on any
      // fetch error, including a transient blip - identical to the same anti-pattern in
      // ModelsPage.tsx, and just as misleading: a real admin's user list would silently
      // vanish behind 4 fake accounts with only an auto-dismissing toast as a clue. Now
      // the real (possibly empty, on first failure) list stays and an explicit
      // error+retry state renders below instead.
      console.error('Failed to load clients from backend:', error);
      setClientsError(error instanceof Error ? error.message : 'Failed to load clients');
    } finally {
      setIsLoadingClients(false);
    }
  }, []);

  React.useEffect(() => {
    loadClients();
  }, [loadClients]);
  
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAvailableModels = availableModels.filter(model =>
    model.name.toLowerCase().includes(assignModelsDialog.searchTerm.toLowerCase())
  );

  const validateForm = () => {
    const newErrors: FormErrors = {};
    
    if (!newClient.name.trim()) newErrors.name = 'Name is required';
    if (!newClient.username.trim()) newErrors.username = 'Username is required';
    if (!newClient.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email.trim())) {
      // Previously only checked "non-empty" - a malformed address (e.g. a stray comma
      // instead of a dot, like "name@gmail,com") passed this form fine and only failed
      // later at the Supabase signup call with an opaque backend error, making it look
      // like the form itself couldn't accept a Gmail address at all.
      newErrors.email = 'Enter a valid email address (e.g. name@example.com)';
    }
    if (!newClient.password || newClient.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    
    // Check if username already exists
    if (clients.some(c => c.username === newClient.username)) {
      (newErrors as any).username = 'Username already exists';
    }
    
    // Check if email already exists
    if (clients.some(c => c.email === newClient.email)) {
      (newErrors as any).email = 'Email already exists';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddClient = async () => {
    if (!validateForm()) {
      showToast.error('Please fix the form errors');
      return;
    }

    setIsCreating(true);
    
    try {
      // Create user in Supabase
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${functionsBaseUrl}/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            name: newClient.name,
            username: newClient.username,
            email: newClient.email,
            password: newClient.password,
            role: 'client',
            phone: newClient.phone,
            company: newClient.company,
            location: newClient.location
          })
        }
      );

      if (response.ok) {
        // Re-fetch from the backend so the new client shows up with its real ID and
        // fields, rather than fabricating a local record with a fake id that would
        // never match the real one for later delete/status actions.
        await loadClients();

        showToast.success(`User ${newClient.name} created successfully!`);
        setIsAddClientOpen(false);
        resetForm();
      } else {
        const error = await response.text();
        showToast.error(`Failed to create user: ${error}`);
      }
    } catch (error) {
      console.error('Error creating client:', error);
      showToast.error('Failed to create user. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setNewClient({
      name: '',
      username: '',
      email: '',
      phone: '',
      company: '',
      location: '',
      password: ''
    });
    setErrors({});
  };

  const handleDeleteClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client?.assignedModels && client.assignedModels > 0) {
      showToast.error('Cannot delete user with assigned models');
      return;
    }
    if (confirm(`Delete user ${client?.name}? This cannot be undone.`)) {
      setClients(prev => prev.filter(c => c.id !== clientId));
      showToast.success('User deleted successfully');
    }
  };

  const handleToggleStatus = (clientId: string) => {
    setClients(prev => prev.map(c => 
      c.id === clientId 
        ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' }
        : c
    ));
    const client = clients.find(c => c.id === clientId);
    const newStatus = client?.status === 'active' ? 'inactive' : 'active';
    showToast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
  };

  // Was entirely fake: picked a random 1-3 count, bumped the client's local
  // assignedModels number, and showed a success toast - no backend call at all, so
  // nothing was ever actually assigned and the "assignment" vanished on next reload.
  // Now opens a real dialog backed by /models and /assign-model, the same endpoint
  // ModelsPage.tsx's (working) assign dialog uses.
  const handleAssignModels = (client: Client) => {
    setAssignModelsDialog({ open: true, clientUsername: client.username, clientName: client.name, searchTerm: '', selectedModelIds: [] });
    setIsLoadingModels(true);
    apiCall('/models')
      .then((data) => {
        const modelsList: AssignableModel[] = (data.models || []).map((m: any) => ({
          id: String(m.id),
          name: m.name || 'Untitled model',
          assignedClients: Array.isArray(m.assignedClients) ? m.assignedClients : []
        }));
        setAvailableModels(modelsList);
        setAssignModelsDialog(prev => ({
          ...prev,
          selectedModelIds: modelsList.filter(m => m.assignedClients.includes(client.username)).map(m => m.id)
        }));
      })
      .catch((error) => {
        console.error('Failed to load models for assignment:', error);
        showToast.error('Could not load model list');
      })
      .finally(() => setIsLoadingModels(false));
  };

  const toggleModelAssignment = (modelId: string) => {
    setAssignModelsDialog(prev => ({
      ...prev,
      selectedModelIds: prev.selectedModelIds.includes(modelId)
        ? prev.selectedModelIds.filter(id => id !== modelId)
        : [...prev.selectedModelIds, modelId]
    }));
  };

  const confirmModelAssignment = async () => {
    const { clientUsername, clientName, selectedModelIds } = assignModelsDialog;
    if (!clientUsername) return;
    try {
      // /assign-model replaces a model's *entire* assignedClients list, so only touch
      // models whose checked state actually changed, merging this client in/out of
      // whichever other clients that model already had.
      const changed = availableModels.filter(model =>
        selectedModelIds.includes(model.id) !== model.assignedClients.includes(clientUsername)
      );
      await Promise.all(changed.map(model => {
        const nowAssigned = selectedModelIds.includes(model.id);
        const newAssignedClients = nowAssigned
          ? [...model.assignedClients, clientUsername]
          : model.assignedClients.filter(u => u !== clientUsername);
        return apiCall('/assign-model', {
          method: 'POST',
          body: JSON.stringify({ modelId: model.id, clientUsernames: newAssignedClients }),
        });
      }));
      showToast.success(`Updated model access for ${clientName}`);
      await loadClients();
    } catch (error) {
      console.error('Failed to update model assignments:', error);
      showToast.error('Failed to update model access');
    }
    setAssignModelsDialog({ open: false, clientUsername: '', clientName: '', searchTerm: '', selectedModelIds: [] });
  };

  const handleChangePassword = (clientId: string) => {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (newPassword && newPassword.length >= 6) {
      showToast.success('Password updated successfully');
    } else if (newPassword) {
      showToast.error('Password must be at least 6 characters');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold text-white">User Management</h2>
          <p className="text-gray-400">Manage user accounts and permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400">
              <UserPlus className="w-4 h-4 mr-2" />
              Add New User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700/80 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with access credentials
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={newClient.name}
                    onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                    className={`bg-slate-700 border-slate-600 ${(errors as any).name ? 'border-red-500' : ''}`}
                  />
                  {(errors as any).name && <p className="text-red-400 text-xs mt-1">{(errors as any).name}</p>}
                </div>
                <div>
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={newClient.username}
                    onChange={(e) => setNewClient({...newClient, username: e.target.value})}
                    className={`bg-slate-700 border-slate-600 ${(errors as any).username ? 'border-red-500' : ''}`}
                  />
                  {(errors as any).username && <p className="text-red-400 text-xs mt-1">{(errors as any).username}</p>}
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                  className={`bg-slate-700 border-slate-600 ${(errors as any).email ? 'border-red-500' : ''}`}
                />
                {(errors as any).email && <p className="text-red-400 text-xs mt-1">{(errors as any).email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={newClient.company}
                    onChange={(e) => setNewClient({...newClient, company: e.target.value})}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={newClient.location}
                  onChange={(e) => setNewClient({...newClient, location: e.target.value})}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div>
                <Label htmlFor="password">Initial Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newClient.password}
                  onChange={(e) => setNewClient({...newClient, password: e.target.value})}
                  className={`bg-slate-700 border-slate-600 ${(errors as any).password ? 'border-red-500' : ''}`}
                  placeholder="Minimum 6 characters"
                />
                {(errors as any).password && <p className="text-red-400 text-xs mt-1">{(errors as any).password}</p>}
              </div>
              {Object.keys(errors).length > 0 && (
                <Alert className="border-red-500/50 bg-red-500/10">
                  <AlertDescription className="text-red-400">
                    Please fix the errors above before creating the user.
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleAddClient}
                  disabled={isCreating}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create User'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsAddClientOpen(false);
                    resetForm();
                  }}
                  className="border-slate-600"
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
          </Dialog>
          <Button
            onClick={() => navigate('/login')}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-red-500/25 transform hover:scale-105 transition-all duration-300"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Back to Login
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-600 text-white placeholder-gray-400"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Users</p>
                <p className="font-technical text-2xl font-bold text-white">{clients.length}</p>
              </div>
              <div className="text-cyan-400">
                <UserPlus className="w-8 h-8" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-slate-700/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Users</p>
                <p className="font-technical text-2xl font-bold text-white">
                  {clients.filter(c => c.status === 'active').length}
                </p>
              </div>
              <div className="text-green-400">
                <Eye className="w-8 h-8" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-slate-700/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Avg Models/User</p>
                <p className="font-technical text-2xl font-bold text-white">
                  {clients.length > 0 ? Math.round(clients.reduce((acc, c) => acc + c.assignedModels, 0) / clients.length) : 0}
                </p>
              </div>
              <div className="text-purple-400">
                <Box className="w-8 h-8" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-slate-700/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">New This Month</p>
                <p className="font-technical text-2xl font-bold text-white">2</p>
              </div>
              <div className="text-blue-400">
                <Calendar className="w-8 h-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="bg-slate-800/50 border-slate-700/80">
        <CardHeader>
          <CardTitle className="text-white">User Accounts</CardTitle>
          <CardDescription className="text-gray-400">
            Manage user access and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoadingClients && (
              <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full" />
                Loading clients...
              </div>
            )}
            {!isLoadingClients && filteredClients.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-lg">
                      {client.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-white font-medium">{client.name}</h3>
                      <Badge 
                        variant={client.status === 'active' ? 'default' : 'secondary'}
                        className={client.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}
                      >
                        {client.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {client.email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {client.phone}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {client.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Box className="w-3 h-3" />
                        {client.assignedModels} models
                      </div>
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500">
                      Created: {new Date(client.createdDate).toLocaleDateString()} • 
                      Last active: {new Date(client.lastActive).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAssignModels(client)}
                    className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-white"
                  >
                    <Box className="w-4 h-4 mr-1" />
                    Assign
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleChangePassword(client.id)}
                    className="border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black"
                  >
                    <Key className="w-4 h-4 mr-1" />
                    Password
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleStatus(client.id)}
                    className={client.status === 'active' 
                      ? 'border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-white'
                      : 'border-green-400 text-green-400 hover:bg-green-400 hover:text-white'
                    }
                  >
                    {client.status === 'active' ? <UserX className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteClient(client.id)}
                    className="border-red-400 text-red-400 hover:bg-red-400 hover:text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {!isLoadingClients && clientsError && clients.length === 0 && (
            <div className="text-center py-8">
              <div className="text-white text-lg mb-2">Couldn't load users</div>
              <p className="text-gray-500 text-sm mb-4">{clientsError}</p>
              <Button onClick={() => loadClients()} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400">
                Retry
              </Button>
            </div>
          )}
          {!isLoadingClients && !clientsError && filteredClients.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-lg mb-2">No users found</div>
              <p className="text-gray-500">Try adjusting your search terms</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignModelsDialog.open} onOpenChange={(open) => setAssignModelsDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="bg-slate-800 border-slate-700/80 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Models to {assignModelsDialog.clientName}</DialogTitle>
            <DialogDescription>
              Search and select which models this user can access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="modelSearch">Search Models</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="modelSearch"
                  placeholder="Search by model name..."
                  value={assignModelsDialog.searchTerm}
                  onChange={(e) => setAssignModelsDialog(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="pl-10 bg-slate-700 border-slate-600"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {isLoadingModels && (
                <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full" />
                  Loading models...
                </div>
              )}
              {!isLoadingModels && filteredAvailableModels.map((model) => {
                const isSelected = assignModelsDialog.selectedModelIds.includes(model.id);
                return (
                  <div key={model.id} className="flex items-center space-x-3 p-2 bg-slate-700/30 rounded">
                    <input
                      type="checkbox"
                      id={`assign-model-${model.id}`}
                      checked={isSelected}
                      onChange={() => toggleModelAssignment(model.id)}
                      className="rounded border-slate-600"
                    />
                    <label htmlFor={`assign-model-${model.id}`} className="flex-1 cursor-pointer text-white font-medium">
                      {model.name}
                    </label>
                  </div>
                );
              })}
              {!isLoadingModels && filteredAvailableModels.length === 0 && (
                <div className="text-center py-4 text-gray-400">
                  No models found matching your search
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={confirmModelAssignment}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Save Access ({assignModelsDialog.selectedModelIds.length} model{assignModelsDialog.selectedModelIds.length !== 1 ? 's' : ''})
              </Button>
              <Button
                variant="outline"
                onClick={() => setAssignModelsDialog({ open: false, clientUsername: '', clientName: '', searchTerm: '', selectedModelIds: [] })}
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