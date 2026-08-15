import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, projectId } from '../../supabase/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Search,
  Filter,
  Download,
  Calendar,
  User,
  FileText,
  Shield,
  Upload,
  Trash2,
  Eye,
  Edit,
  Key,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  LogOut
} from 'lucide-react';

// Mock audit log data
const mockAuditLogs = [
  {
    id: 1,
    timestamp: '2025-01-07 14:30:25',
    user: 'admin',
    action: 'MODEL_UPLOADED',
    target: 'Modern Conference Table.glb',
    details: 'Uploaded new 3D model with auto-optimization enabled',
    severity: 'info',
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome/120.0.0.0'
  },
  {
    id: 2,
    timestamp: '2025-01-07 14:25:12',
    user: 'admin',
    action: 'CLIENT_ASSIGNED',
    target: 'client1 → Executive Office Chair',
    details: 'Assigned model access to user account',
    severity: 'info',
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome/120.0.0.0'
  },
  {
    id: 3,
    timestamp: '2025-01-07 13:45:33',
    user: 'client1',
    action: 'MODEL_VIEWED',
    target: 'Reception Desk Setup.glb',
    details: 'Opened model in Babylon.js workspace',
    severity: 'info',
    ipAddress: '203.0.113.45',
    userAgent: 'Firefox/121.0'
  },
  {
    id: 4,
    timestamp: '2025-01-07 12:20:18',
    user: 'admin',
    action: 'CLIENT_CREATED',
    target: 'client3',
    details: 'Created new user account with initial credentials',
    severity: 'success',
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome/120.0.0.0'
  },
  {
    id: 5,
    timestamp: '2025-01-07 11:15:44',
    user: 'admin',
    action: 'MODEL_DELETED',
    target: 'Old Prototype.fbx',
    details: 'Permanently deleted model and all associated files',
    severity: 'warning',
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome/120.0.0.0'
  },
  {
    id: 6,
    timestamp: '2025-01-07 10:30:12',
    user: 'system',
    action: 'BACKUP_COMPLETED',
    target: 'Database backup',
    details: 'Automated daily backup completed successfully',
    severity: 'success',
    ipAddress: 'localhost',
    userAgent: 'System/1.0'
  },
  {
    id: 7,
    timestamp: '2025-01-07 09:45:28',
    user: 'client2',
    action: 'LOGIN_SUCCESS',
    target: 'User Dashboard',
    details: 'Successful authentication and dashboard access',
    severity: 'info',
    ipAddress: '198.51.100.23',
    userAgent: 'Safari/17.2'
  },
  {
    id: 8,
    timestamp: '2025-01-07 08:22:15',
    user: 'unknown',
    action: 'LOGIN_FAILED',
    target: 'Admin Login',
    details: 'Failed login attempt with invalid credentials',
    severity: 'error',
    ipAddress: '203.0.113.100',
    userAgent: 'curl/8.0.1'
  },
  {
    id: 9,
    timestamp: '2025-01-06 18:30:45',
    user: 'admin',
    action: 'SETTINGS_UPDATED',
    target: 'System Configuration',
    details: 'Updated file upload size limits and compression settings',
    severity: 'info',
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome/120.0.0.0'
  },
  {
    id: 10,
    timestamp: '2025-01-06 16:15:33',
    user: 'admin',
    action: 'PASSWORD_CHANGED',
    target: 'client1',
    details: 'Reset user password via admin panel',
    severity: 'warning',
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome/120.0.0.0'
  }
];

const actionTypes = [
  'ALL_ACTIONS',
  'MODEL_UPLOADED',
  'MODEL_VIEWED',
  'MODEL_DELETED',
  'CLIENT_CREATED',
  'CLIENT_ASSIGNED',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'SETTINGS_UPDATED',
  'PASSWORD_CHANGED',
  'BACKUP_COMPLETED'
];

const severityLevels = ['all', 'info', 'success', 'warning', 'error'];

export function AuditLogsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL_ACTIONS');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [auditLogs, setAuditLogs] = useState<typeof mockAuditLogs>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [usingSampleData, setUsingSampleData] = useState(false);

  useEffect(() => {
    const loadAuditLogs = async () => {
      setIsLoadingLogs(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken) throw new Error('Not signed in');

        const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;
        const response = await fetch(`${functionsBaseUrl}/api/admin/audit-logs`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error(`Failed to load audit logs (${response.status})`);

        const data = await response.json();
        const rawLogs: any[] = data.logs || [];
        const normalized = rawLogs.map((entry, i) => ({
          id: i + 1,
          timestamp: entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '',
          user: entry.username || entry.user_id || 'unknown',
          action: entry.action || 'UNKNOWN_ACTION',
          target: entry.target || '',
          details: entry.details || '',
          severity: entry.severity || 'info',
          ipAddress: entry.ip_address || '',
          userAgent: entry.user_agent || ''
        }));
        setAuditLogs(normalized);
        setUsingSampleData(false);
      } catch (error) {
        console.error('Failed to load audit logs, showing sample data:', error);
        setAuditLogs(mockAuditLogs);
        setUsingSampleData(true);
      } finally {
        setIsLoadingLogs(false);
      }
    };
    loadAuditLogs();
  }, []);

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.user.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = selectedAction === 'ALL_ACTIONS' || log.action === selectedAction;
    const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;
    const matchesUser = selectedUser === 'all' || log.user === selectedUser;
    
    return matchesSearch && matchesAction && matchesSeverity && matchesUser;
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'MODEL_UPLOADED':
        return <Upload className="w-4 h-4" />;
      case 'MODEL_VIEWED':
        return <Eye className="w-4 h-4" />;
      case 'MODEL_DELETED':
        return <Trash2 className="w-4 h-4" />;
      case 'CLIENT_CREATED':
      case 'CLIENT_ASSIGNED':
        return <User className="w-4 h-4" />;
      case 'LOGIN_SUCCESS':
      case 'LOGIN_FAILED':
        return <Shield className="w-4 h-4" />;
      case 'SETTINGS_UPDATED':
        return <Settings className="w-4 h-4" />;
      case 'PASSWORD_CHANGED':
        return <Key className="w-4 h-4" />;
      case 'BACKUP_COMPLETED':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'success':
        return <CheckCircle className="w-3 h-3" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3" />;
      case 'error':
        return <AlertTriangle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const exportLogs = () => {
    console.log('Exporting audit logs...');
    // Here you would implement actual export functionality
  };

  const uniqueUsers = [...new Set(auditLogs.map(log => log.user))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold text-white">Audit Logs</h2>
          <p className="text-gray-400">Monitor all system activities and user actions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={exportLogs}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Logs
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

      {/* Filters */}
      <Card className="bg-slate-800/50 border-slate-700/80">
        <CardHeader>
          <CardTitle className="text-white">Filters</CardTitle>
          <CardDescription className="text-gray-400">
            Filter audit logs by action, user, severity, and time range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder-gray-400"
                />
              </div>
            </div>
            
            <div>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700/80">
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="User" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700/80">
                  <SelectItem value="all">All Users</SelectItem>
                  {uniqueUsers.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700/80">
                  {severityLevels.map((severity) => (
                    <SelectItem key={severity} value={severity}>
                      {severity === 'all' ? 'All Levels' : severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700/80">
                  <SelectItem value="1d">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Events</p>
                <p className="font-technical text-2xl font-bold text-white">{filteredLogs.length}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-slate-700/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Errors</p>
                <p className="font-technical text-2xl font-bold text-white">
                  {filteredLogs.filter(log => log.severity === 'error').length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-slate-700/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Warnings</p>
                <p className="font-technical text-2xl font-bold text-white">
                  {filteredLogs.filter(log => log.severity === 'warning').length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-slate-700/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Users</p>
                <p className="font-technical text-2xl font-bold text-white">{uniqueUsers.length}</p>
              </div>
              <User className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card className="bg-slate-800/50 border-slate-700/80">
        <CardHeader>
          <CardTitle className="text-white">Activity Log</CardTitle>
          <CardDescription className="text-gray-400">
            Detailed system and user activity records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usingSampleData && !isLoadingLogs && (
            <div className="mb-4 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs text-yellow-200">
              Couldn't reach the live audit log - showing sample data for reference.
            </div>
          )}
          {isLoadingLogs ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <div className="animate-spin w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full" />
              Loading audit logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <div className="text-gray-400 text-lg mb-2">No logs found</div>
              <p className="text-gray-500">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${getSeverityColor(log.severity)}`}>
                    {getActionIcon(log.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-white font-medium">
                        {log.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </h4>
                      <Badge 
                        variant="outline" 
                        className={`text-xs border-${log.severity === 'error' ? 'red' : log.severity === 'warning' ? 'yellow' : log.severity === 'success' ? 'green' : 'blue'}-400`}
                      >
                        <span className="flex items-center gap-1">
                          {getSeverityIcon(log.severity)}
                          {log.severity}
                        </span>
                      </Badge>
                      <Badge variant="outline" className="text-xs border-slate-600">
                        {log.user}
                      </Badge>
                    </div>
                    
                    <p className="text-gray-300 mb-2">{log.details}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {log.timestamp}
                      </span>
                      <span>Target: {log.target}</span>
                      <span>IP: {log.ipAddress}</span>
                      <span className="truncate max-w-[150px]">{log.userAgent}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}