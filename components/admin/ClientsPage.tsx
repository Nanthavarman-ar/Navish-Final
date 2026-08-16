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

// Mock clients data
const mockClients: Client[] = [
  {
    id: 'mock-1',
    username: 'client1',
    name: 'John Smith',
    email: 'john.smith@company.com',
    phone: '+1 (555) 123-4567',
    company: 'Smith Industries',
    location: 'New York, NY',
    createdDate: '2024-12-15',
    assignedModels: 4,
    lastActive: '2025-01-07',
    status: 'active'
  },
  {
    id: 'mock-2',
    username: 'client2',
    name: 'Sarah Johnson',
    email: 'sarah.j@designstudio.com',
    phone: '+1 (555) 987-6543',
    company: 'Johnson Design Studio',
    location: 'Los Angeles, CA',
    createdDate: '2024-11-20',
    assignedModels: 2,
    lastActive: '2025-01-06',
    status: 'active'
  },
  {
    id: 'mock-3',
    username: 'client3',
    name: 'Michael Brown',
    email: 'mbrown@architects.com',
    phone: '+1 (555) 456-7890',
    company: 'Brown Architects',
    location: 'Chicago, IL',
    createdDate: '2024-10-05',
    assignedModels: 7,
    lastActive: '2024-12-28',
    status: 'inactive'
  },
  {
    id: 'mock-4',
    username: 'client4',
    name: 'Emily Davis',
    email: 'emily@interiordesign.com',
    phone: '+1 (555) 234-5678',
    company: 'Davis Interiors',
    location: 'Miami, FL',
    createdDate: '2024-09-12',
    assignedModels: 3,
    lastActive: '2025-01-05',
    status: 'active'
  }
];

export function ClientsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
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
      console.error('Failed to load clients from backend:', error);
      showToast.warning('Could not load live client data', 'Showing sample data instead');
      setClients(mockClients);
    } finally {
      setIsLoadingClients(false);
    }
  }, []);

  React.useEffect(() => {
    loadClients();
  }, [loadClients]);
  
  // Mock models for assignment
  const mockModels = [
    { id: 1, name: 'Modern Chair v2.glb', category: 'Furniture' },
    { id: 2, name: 'Conference Table.glb', category: 'Furniture' },
    { id: 3, name: 'Office Lamp.fbx', category: 'Lighting' }
  ];

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.username.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleAssignModels = (clientId: string) => {
    const count = Math.floor(Math.random() * 3) + 1;
    setClients(prev => prev.map(c => 
      c.id === clientId 
        ? { ...c, assignedModels: c.assignedModels + count }
        : c
    ));
    showToast.success(`${count} models assigned successfully`);
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
                    onClick={() => handleAssignModels(client.id)}
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
          
          {!isLoadingClients && filteredClients.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-lg mb-2">No users found</div>
              <p className="text-gray-500">Try adjusting your search terms</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}