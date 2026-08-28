import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, projectId } from '../supabase/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { PasswordInput } from './ui/password-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { ArrowLeft, User } from 'lucide-react';

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

export function ClientLogin() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [changeEmail, setChangeEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState(false);
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const hasIdentifier = Boolean(email.trim() || username.trim());

  // Accepts either an email or a plain username. A plain username is looked
  // up server-side (against Supabase user metadata) to find its email, since
  // Supabase Auth itself only signs in by email.
  const resolveLoginEmail = async (): Promise<string | null> => {
    const identifier = (email.trim() || username.trim());
    if (!identifier) return null;
    if (identifier.includes('@')) return identifier;

    try {
      const response = await fetch(`${functionsBaseUrl}/resolve-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      if (!response.ok) return null;
      const data = await response.json().catch(() => ({}));
      return data?.email || null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const loginEmail = await resolveLoginEmail();
    if (!loginEmail) {
      setError('Unable to sign in. Verify your credentials.');
      return;
    }
    const role = await login(loginEmail, password, 'client');
    if (role === 'client') {
      navigate('/client/models');
    } else {
      setError('Unable to sign in. Verify your credentials.');
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.auth.resetPasswordForEmail(forgotEmail);
    setForgotSent(true);
  };

  // Re-authenticates with the current password first (the only client-side way to
  // confirm it's actually correct before changing it) and only then calls
  // updateUser - previously this dialog collected all four fields and then always
  // rejected the submission with a fixed error telling you to use Forgot Password
  // instead, so nothing here ever worked.
  const handleChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError(null);
    if (newPassword !== confirmPassword) {
      setChangeError('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setChangeError('New password must be at least 6 characters.');
      return;
    }
    setChangeLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: changeEmail,
        password: currentPassword,
      });
      if (signInError) {
        setChangeError('Current email or password is incorrect.');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setChangeError(updateError.message || 'Failed to change password.');
        return;
      }
      setChangeSuccess(true);
    } catch {
      setChangeError('Something went wrong. Please try again.');
    } finally {
      setChangeLoading(false);
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
            <User className="w-8 h-8 text-purple-400" />
          </div>
          <CardTitle className="text-white text-center">User Login</CardTitle>
          <CardDescription className="text-gray-400 text-center">
            Access your 3D model workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-white">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="Your display name (optional)"
              />
            </div>
            <div>
              <Label htmlFor="username" className="text-white">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="client1, client2, etc."
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-white">Password</Label>
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => setChangeOpen(true)}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    Change password
                  </button>
                </div>
              </div>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="Enter password"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              disabled={loading || !hasIdentifier}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Logging in...
                </div>
              ) : (
                'Access Workspace'
              )}
            </Button>
            {error && (
              <p className="text-sm text-red-400 text-center mt-2">{error}</p>
            )}
          </form>
          <div className="mt-4 text-sm text-gray-400 text-center">
            <p>Use your registered user credentials.</p>
          </div>
        </CardContent>
      </Card>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Forgot Password</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter your email and we&apos;ll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          {forgotSent ? (
            <p className="text-green-400 py-4">
              If an account exists for {forgotEmail || 'that email'}, a password reset link has been sent.
            </p>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <Label htmlFor="forgot-email" className="text-white">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="user@example.com"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                  Send reset link
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog
        open={changeOpen}
        onOpenChange={(open) => {
          setChangeOpen(open);
          if (!open) {
            setChangeError(null);
            setChangeSuccess(false);
            setChangeEmail('');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
          }
        }}
      >
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter your email, current password, and new password.
            </DialogDescription>
          </DialogHeader>
          {changeSuccess ? (
            <p className="text-green-400 py-4">Password changed successfully. You can now log in with your new password.</p>
          ) : (
            <form onSubmit={handleChangeSubmit} className="space-y-4">
              <div>
                <Label htmlFor="change-email" className="text-white">Email</Label>
                <Input
                  id="change-email"
                  type="email"
                  value={changeEmail}
                  onChange={(e) => setChangeEmail(e.target.value)}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label htmlFor="current-password" className="text-white">Current Password</Label>
                <PasswordInput
                  id="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="new-password" className="text-white">New Password</Label>
                <PasswordInput
                  id="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password" className="text-white">Confirm New Password</Label>
                <PasswordInput
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              {changeError && <p className="text-sm text-red-400">{changeError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setChangeOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700" disabled={changeLoading}>
                  {changeLoading ? 'Changing...' : 'Change Password'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
