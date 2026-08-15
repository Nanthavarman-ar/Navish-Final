import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, projectId } from '../../supabase/client';
import { showToast } from '../utils/toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import {
  Settings,
  User,
  Shield,
  Bell,
  Palette,
  Database,
  Zap,
  Download,
  Upload,
  Globe,
  Lock,
  Eye,
  Save,
  LogOut,
  CreditCard
} from 'lucide-react';

export function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    // Profile
    adminName: 'Administrator',
    adminEmail: 'admin@naviz.com',
    
    // Security
    twoFactorEnabled: true,
    sessionTimeout: '4',
    passwordExpiry: '90',
    
    // System
    autoOptimization: true,
    compressionLevel: 'high',
    maxFileSize: '100',
    allowedFormats: ['glb', 'gltf', 'fbx', 'obj'],
    
    // Notifications
    emailNotifications: true,
    uploadNotifications: true,
    errorNotifications: true,
    clientActivityNotifications: false,
    
    // Appearance
    theme: 'dark',
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    
    // Storage
    storageUsed: '2.4',
    storageLimit: '10',
    autoCleanup: true,
    cleanupDays: '30'
  });

  const [isSaving, setIsSaving] = useState(false);
  const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const response = await fetch(`${functionsBaseUrl}/api/admin/settings`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
      } catch (error) {
        console.error('Failed to load saved settings:', error);
      }
    };
    loadSettings();
  }, []);

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        showToast.error('Not signed in', 'Please sign in again to save settings');
        return;
      }
      const response = await fetch(`${functionsBaseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
      }
      showToast.success('Settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast.error('Failed to save settings', 'Please try again');
    } finally {
      setIsSaving(false);
    }
  };

  const compressionOptions = [
    { value: 'low', label: 'Low (faster upload)' },
    { value: 'medium', label: 'Medium (balanced)' },
    { value: 'high', label: 'High (smaller files)' }
  ];

  const formatOptions = ['glb', 'gltf', 'fbx', 'obj', 'dae', '3ds', 'ply'];

  const toggleFormat = (format: string) => {
    const current = settings.allowedFormats;
    const updated = current.includes(format)
      ? current.filter(f => f !== format)
      : [...current, format];
    handleSettingChange('allowedFormats', updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold text-white">System Settings</h2>
          <p className="text-gray-400">Configure platform preferences and security</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:opacity-60"
          >
            {isSaving ? (
              <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isSaving ? 'Saving...' : 'Save Changes'}
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

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7 bg-slate-800/50">
          <TabsTrigger value="profile" className="data-[state=active]:bg-cyan-500">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-cyan-500">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="system" className="data-[state=active]:bg-cyan-500">
            <Settings className="w-4 h-4 mr-2" />
            System
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-cyan-500">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="data-[state=active]:bg-cyan-500">
            <Palette className="w-4 h-4 mr-2" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="storage" className="data-[state=active]:bg-cyan-500">
            <Database className="w-4 h-4 mr-2" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="payment" className="data-[state=active]:bg-cyan-500">
            <CreditCard className="w-4 h-4 mr-2" />
            Payment
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile">
          <Card className="bg-slate-800/50 border-slate-700/80">
            <CardHeader>
              <CardTitle className="text-white">Profile Information</CardTitle>
              <CardDescription className="text-gray-400">
                Update your account details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="adminName" className="text-white">Admin Name</Label>
                  <Input
                    id="adminName"
                    value={settings.adminName}
                    onChange={(e) => handleSettingChange('adminName', e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="adminEmail" className="text-white">Email Address</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={settings.adminEmail}
                    onChange={(e) => handleSettingChange('adminEmail', e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
              </div>
              
              <div>
                <h4 className="text-white font-medium mb-3">Profile Picture</h4>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full flex items-center justify-center">
                    <span className="text-black font-bold text-2xl">A</span>
                  </div>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="border-slate-600">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload New
                    </Button>
                    <p className="text-xs text-gray-400">JPG, PNG or GIF. Max 2MB.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <div className="grid gap-6">
            <Card className="bg-slate-800/50 border-slate-700/80">
              <CardHeader>
                <CardTitle className="text-white">Authentication & Access</CardTitle>
                <CardDescription className="text-gray-400">
                  Configure security settings and access controls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Two-Factor Authentication</Label>
                    <p className="text-sm text-gray-400">Add an extra layer of security</p>
                  </div>
                  <Switch
                    checked={settings.twoFactorEnabled}
                    onCheckedChange={(checked) => handleSettingChange('twoFactorEnabled', checked)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="sessionTimeout" className="text-white">Session Timeout (hours)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      value={settings.sessionTimeout}
                      onChange={(e) => handleSettingChange('sessionTimeout', e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="passwordExpiry" className="text-white">Password Expiry (days)</Label>
                    <Input
                      id="passwordExpiry"
                      type="number"
                      value={settings.passwordExpiry}
                      onChange={(e) => handleSettingChange('passwordExpiry', e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Button variant="outline" className="border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black">
                    <Lock className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                  <Button variant="outline" className="border-red-400 text-red-400 hover:bg-red-400 hover:text-white">
                    <Eye className="w-4 h-4 mr-2" />
                    View Active Sessions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system">
          <div className="grid gap-6">
            <Card className="bg-slate-800/50 border-slate-700/80">
              <CardHeader>
                <CardTitle className="text-white">Model Processing</CardTitle>
                <CardDescription className="text-gray-400">
                  Configure how 3D models are processed and optimized
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Auto-Optimization</Label>
                    <p className="text-sm text-gray-400">Automatically optimize uploaded models</p>
                  </div>
                  <Switch
                    checked={settings.autoOptimization}
                    onCheckedChange={(checked) => handleSettingChange('autoOptimization', checked)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-white">Compression Level</Label>
                    <Select
                      value={settings.compressionLevel}
                      onValueChange={(value) => handleSettingChange('compressionLevel', value)}
                    >
                      <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700/80">
                        {compressionOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="maxFileSize" className="text-white">Max File Size (MB)</Label>
                    <Input
                      id="maxFileSize"
                      type="number"
                      value={settings.maxFileSize}
                      onChange={(e) => handleSettingChange('maxFileSize', e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-white">Allowed File Formats</Label>
                  <p className="text-sm text-gray-400 mb-3">Select which file formats users can upload</p>
                  <div className="flex flex-wrap gap-2">
                    {formatOptions.map((format) => (
                      <Badge
                        key={format}
                        variant={settings.allowedFormats.includes(format) ? 'default' : 'outline'}
                        className={`cursor-pointer transition-colors ${
                          settings.allowedFormats.includes(format)
                            ? 'bg-cyan-500 text-white'
                            : 'border-slate-600 text-gray-400 hover:border-cyan-400'
                        }`}
                        onClick={() => toggleFormat(format)}
                      >
                        .{format}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card className="bg-slate-800/50 border-slate-700/80">
            <CardHeader>
              <CardTitle className="text-white">Notification Preferences</CardTitle>
              <CardDescription className="text-gray-400">
                Choose what notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Email Notifications</Label>
                    <p className="text-sm text-gray-400">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Upload Notifications</Label>
                    <p className="text-sm text-gray-400">Notify when files are uploaded</p>
                  </div>
                  <Switch
                    checked={settings.uploadNotifications}
                    onCheckedChange={(checked) => handleSettingChange('uploadNotifications', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Error Notifications</Label>
                    <p className="text-sm text-gray-400">Notify about system errors</p>
                  </div>
                  <Switch
                    checked={settings.errorNotifications}
                    onCheckedChange={(checked) => handleSettingChange('errorNotifications', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">User Activity</Label>
                    <p className="text-sm text-gray-400">Notify about user actions</p>
                  </div>
                  <Switch
                    checked={settings.clientActivityNotifications}
                    onCheckedChange={(checked) => handleSettingChange('clientActivityNotifications', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance">
          <Card className="bg-slate-800/50 border-slate-700/80">
            <CardHeader>
              <CardTitle className="text-white">Interface Preferences</CardTitle>
              <CardDescription className="text-gray-400">
                Customize the look and feel of the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <Label className="text-white">Theme</Label>
                  <Select
                    value={settings.theme}
                    onValueChange={(value) => handleSettingChange('theme', value)}
                  >
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700/80">
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="auto">Auto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-white">Language</Label>
                  <Select
                    value={settings.language}
                    onValueChange={(value) => handleSettingChange('language', value)}
                  >
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700/80">
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ta">Tamil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-white">Date Format</Label>
                  <Select
                    value={settings.dateFormat}
                    onValueChange={(value) => handleSettingChange('dateFormat', value)}
                  >
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700/80">
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage */}
        <TabsContent value="storage">
          <div className="grid gap-6">
            <Card className="bg-slate-800/50 border-slate-700/80">
              <CardHeader>
                <CardTitle className="text-white">Storage Management</CardTitle>
                <CardDescription className="text-gray-400">
                  Monitor and manage storage usage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-white">Storage Usage</Label>
                    <span className="text-white">
                      {settings.storageUsed} GB / {settings.storageLimit} GB
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all duration-300"
                      style={{
                        '--progress-width': `${(parseFloat(settings.storageUsed) / parseFloat(settings.storageLimit)) * 100}%`,
                        width: 'var(--progress-width)'
                      } as React.CSSProperties}
                    ></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Auto Cleanup</Label>
                    <p className="text-sm text-gray-400">Automatically remove old temporary files</p>
                  </div>
                  <Switch
                    checked={settings.autoCleanup}
                    onCheckedChange={(checked) => handleSettingChange('autoCleanup', checked)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="cleanupDays" className="text-white">Cleanup Interval (days)</Label>
                  <Input
                    id="cleanupDays"
                    type="number"
                    value={settings.cleanupDays}
                    onChange={(e) => handleSettingChange('cleanupDays', e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white max-w-xs"
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button variant="outline" className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Export Data
                  </Button>
                  <Button variant="outline" className="border-red-400 text-red-400 hover:bg-red-400 hover:text-white">
                    <Zap className="w-4 h-4 mr-2" />
                    Clean Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payment Options */}
        <TabsContent value="payment">
          <Card className="bg-slate-800/50 border-slate-700/80">
            <CardHeader>
              <CardTitle className="text-white">Payment & Plans</CardTitle>
              <CardDescription className="text-gray-400">
                Configure user subscription plans: Silver, Gold, Platinum (hourly, daily, monthly, unlimited)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Secure Payment Gateway</h4>
                  <p className="text-sm text-gray-400">Integrate Stripe or PayPal for safe, encrypted payments</p>
                </div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Recommended: Stripe</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {(['silver', 'gold', 'platinum'] as const).map((tier) => (
                  <div key={tier} className="p-4 rounded-lg border border-slate-600 bg-slate-700/30">
                    <h5 className="text-white font-medium capitalize mb-2">{tier}</h5>
                    <p className="text-xs text-gray-400 mb-2">Hourly · Daily · Monthly · Unlimited</p>
                    <p className="text-sm text-gray-400">Configure prices and upload limits per duration in backend.</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Lock className="w-4 h-4" />
                <span>Login is secured via Supabase Auth. Add 2FA in Security tab for extra safety.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}