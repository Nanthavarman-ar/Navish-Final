import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  Users,
  UserPlus,
  Settings,
  MessageSquare,
  Activity,
  Crown,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface User {
  id: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
  avatar?: string;
}

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  timestamp: Date;
  type: 'create' | 'update' | 'delete' | 'consume' | 'system';
}

interface CollaborationPanelProps {
  isActive: boolean;
  onClose: () => void;
  currentUser: User;
  onUserRoleChange?: (userId: string, newRole: User['role']) => void;
}

const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  isActive,
  onClose,
  currentUser,
  onUserRoleChange
}) => {
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<User['role']>('viewer');

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (isActive && !socketRef.current) {
      initializeSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isActive]);

  const initializeSocket = () => {
    try {
      setConnectionStatus('connecting');

      socketRef.current = io(process.env.REACT_APP_WS_URL || 'ws://localhost:3001', {
        transports: ['websocket', 'polling'],
        timeout: 5000,
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        setIsConnected(true);
        setConnectionStatus('connected');

        // Join collaboration room
        socket.emit('join-collaboration', {
          userId: currentUser.id,
          userName: currentUser.name,
          role: currentUser.role
        });
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnectionStatus('disconnected');
        attemptReconnect();
      });

      socket.on('collaboration-users', (users: User[]) => {
        setConnectedUsers(users);
      });

      socket.on('user-joined', (user: User) => {
        setConnectedUsers(prev => {
          const existing = prev.find(u => u.id === user.id);
          if (existing) {
            return prev.map(u => u.id === user.id ? { ...u, status: 'online' as const } : u);
          }
          return [...prev, user];
        });

        addActivityLog({
          id: `activity_${Date.now()}`,
          userId: user.id,
          userName: user.name,
          action: 'joined',
          target: 'collaboration',
          timestamp: new Date(),
          type: 'system'
        });
      });

      socket.on('user-left', (userId: string) => {
        setConnectedUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, status: 'offline' as const } : u
        ));

        const user = connectedUsers.find(u => u.id === userId);
        if (user) {
          addActivityLog({
            id: `activity_${Date.now()}`,
            userId,
            userName: user.name,
            action: 'left',
            target: 'collaboration',
            timestamp: new Date(),
            type: 'system'
          });
        }
      });

      socket.on('food-item-activity', (activity: Omit<ActivityLog, 'id'>) => {
        addActivityLog({
          ...activity,
          id: `activity_${Date.now()}`
        });
      });

      socket.on('user-role-changed', (data: { userId: string, newRole: User['role'], changedBy: string }) => {
        setConnectedUsers(prev => prev.map(u =>
          u.id === data.userId ? { ...u, role: data.newRole } : u
        ));

        addActivityLog({
          id: `activity_${Date.now()}`,
          userId: data.changedBy,
          userName: 'System',
          action: `changed ${data.userId} role to ${data.newRole}`,
          target: 'user permissions',
          timestamp: new Date(),
          type: 'system'
        });
      });

    } catch (error) {
      console.error('Failed to initialize socket:', error);
      setConnectionStatus('disconnected');
    }
  };

  const attemptReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isConnected) {
        initializeSocket();
      }
    }, 5000);
  };

  const addActivityLog = (activity: ActivityLog) => {
    setActivityLog(prev => [activity, ...prev.slice(0, 99)]); // Keep last 100 activities
  };

  const handleInviteUser = () => {
    if (!inviteEmail.trim() || !socketRef.current) return;

    socketRef.current.emit('invite-user', {
      email: inviteEmail,
      role: selectedRole,
      invitedBy: currentUser.name
    });

    setInviteEmail('');

    addActivityLog({
      id: `activity_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      action: `invited ${inviteEmail} as ${selectedRole}`,
      target: 'user invitation',
      timestamp: new Date(),
      type: 'system'
    });
  };

  const handleRoleChange = (userId: string, newRole: User['role']) => {
    if (!socketRef.current || currentUser.role !== 'admin') return;

    socketRef.current.emit('change-user-role', {
      userId,
      newRole,
      changedBy: currentUser.id
    });

    if (onUserRoleChange) {
      onUserRoleChange(userId, newRole);
    }
  };

  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'admin': return <Crown className="w-4 h-4" />;
      case 'editor': return <Settings className="w-4 h-4" />;
      case 'viewer': return <Shield className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getActivityIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'create': return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'update': return <Settings className="w-4 h-4 text-blue-500" />;
      case 'delete': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'consume': return <CheckCircle className="w-4 h-4 text-orange-500" />;
      case 'system': return <Activity className="w-4 h-4 text-gray-500" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="w-6 h-6 text-blue-500" />
              Collaboration Panel
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? 'default' : 'destructive'} className="flex items-center gap-1">
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {connectionStatus}
              </Badge>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <AlertCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Connection Status */}
          <Alert>
            <Wifi className="h-4 w-4" />
            <AlertDescription>
              <strong>Real-time Collaboration:</strong> {isConnected
                ? 'Connected to collaboration server. Changes will sync automatically.'
                : 'Connecting to collaboration server...'
              }
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Connected Users */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Connected Users</h3>
                <Badge variant="outline">{connectedUsers.length} users</Badge>
              </div>

              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {connectedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(user.status)} rounded-full border-2 border-white`}></div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{user.name}</span>
                            {getRoleIcon(user.role)}
                          </div>
                          <div className="text-xs text-slate-500 capitalize">
                            {user.status} • {user.role}
                          </div>
                        </div>
                      </div>

                      {currentUser.role === 'admin' && user.id !== currentUser.id && (
                        <Select
                          value={user.role}
                          onValueChange={(newRole: User['role']) => handleRoleChange(user.id, newRole)}
                        >
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}

                  {connectedUsers.length === 0 && (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No users connected yet.</p>
                      <p className="text-sm">Share your collaboration link to invite others.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Activity Log */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Activity Log</h3>
                <Badge variant="outline">{activityLog.length} activities</Badge>
              </div>

              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {activityLog.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="mt-0.5">
                        {getActivityIcon(activity.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{activity.userName}</span>
                          <span className="text-xs text-slate-500">
                            {activity.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {activity.action} {activity.target}
                        </p>
                      </div>
                    </div>
                  ))}

                  {activityLog.length === 0 && (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No recent activity.</p>
                      <p className="text-sm">Activity will appear here when users make changes.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Invite Users */}
          {currentUser.role === 'admin' && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Invite Users</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={selectedRole} onValueChange={(value: User['role']) => setSelectedRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button onClick={handleInviteUser} className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Send Invite
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Collaboration Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {connectedUsers.length}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Active Users</div>
            </div>

            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Activity className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {activityLog.length}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">Total Activities</div>
            </div>

            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {connectedUsers.filter(u => u.status === 'online').length}
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400">Online Now</div>
            </div>

            <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <Clock className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {Math.floor((Date.now() - (connectedUsers[0]?.lastSeen?.getTime() || Date.now())) / 1000 / 60)}m
              </div>
              <div className="text-sm text-orange-600 dark:text-orange-400">Session Time</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CollaborationPanel;
