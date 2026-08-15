import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { PasswordInput } from './ui/password-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { ArrowLeft, Shield } from 'lucide-react';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const role = await login(email, password, 'admin');
    if (role === 'admin') {
      navigate('/admin/clients');
    } else {
      setError('Unable to sign in. Verify your email and password, or this account is not an administrator.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/?page=home')}
              className="text-gray-400 hover:text-white transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <CardTitle className="text-white text-center">Admin Login</CardTitle>
          <CardDescription className="text-gray-400 text-center">
            Access the administrative dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-white">Admin Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-white">Password</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="Enter admin password"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Logging in...
                </div>
              ) : (
                'Access Admin Panel'
              )}
            </Button>
            {error && (
              <p className="text-sm text-red-400 text-center mt-2">{error}</p>
            )}
          </form>
          <div className="mt-4 text-sm text-gray-400 text-center">
            <p>Use your administrator account credentials.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
