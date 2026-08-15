import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import { ChevronLeft } from 'lucide-react';

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

export function Login() {
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
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
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
      setError('Unable to sign in. Please check your credentials.');
      return;
    }
    // No role picker here: the account's real role (from Supabase user
    // metadata, verified server-side) decides where to go, never the user's
    // choice on this form.
    const role = await login(loginEmail, password);
    if (role === 'admin') {
      navigate('/admin/clients');
    } else if (role === 'client') {
      navigate('/client/models');
    } else {
      setError('Unable to sign in. Please check your credentials.');
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.auth.resetPasswordForEmail(forgotEmail);
    setForgotSent(true);
  };

  const handleChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('For security, use "Forgot password?" to reset your password by email.');
  };

  const resetCreateForm = () => {
    setCreateName('');
    setCreateUsername('');
    setCreateEmail('');
    setCreatePassword('');
    setCreateError(null);
    setCreateSuccess(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreateLoading(true);
    try {
      const response = await fetch(
        `${functionsBaseUrl}/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: createName.trim() || createUsername.trim(),
            username: createUsername.trim(),
            email: createEmail.trim(),
            password: createPassword,
            role: 'client',
          }),
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Signup failed with status ${response.status}`);
      }

      setCreateSuccess('Account created. You can now sign in.');
      setEmail(createEmail.trim());
      setUsername(createUsername.trim());
      setPassword(createPassword);
    } catch (createErr) {
      setCreateError(createErr instanceof Error ? createErr.message : 'Failed to create account');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <Link
        to="/"
        className="fixed top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors z-10"
      >
        <ChevronLeft className="w-5 h-5" />
        Back to Home
      </Link>
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-center">Login to NAVIZ</CardTitle>
          <CardDescription className="text-gray-400 text-center">
            Enter your credentials to access the workspace
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
                placeholder="client1, admin, etc."
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
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => setChangeOpen(true)}
                    className="text-cyan-400 hover:text-cyan-300"
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
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-cyan-600 hover:bg-cyan-700"
              disabled={loading || !hasIdentifier}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
            {error && (
              <p className="text-center text-sm text-red-400 mt-2">{error}</p>
            )}
          </form>
          <div className="mt-4 text-sm text-gray-400 space-y-2">
            <p>Sign in with your registered account.</p>
            <button
              type="button"
              onClick={() => {
                resetCreateForm();
                setCreateOpen(true);
              }}
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Create a new user account
            </button>
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
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">
                  Send reset link
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changeOpen} onOpenChange={(open) => { setChangeOpen(open); if (!open) setChangeError(null); setChangeSuccess(false); }}>
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
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">
                  Change Password
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Account Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Create User Account</DialogTitle>
            <DialogDescription className="text-gray-400">
              Create a new client account for login and model uploads.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <Label htmlFor="create-name" className="text-white">Name</Label>
              <Input
                id="create-name"
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="Demo User"
              />
            </div>
            <div>
              <Label htmlFor="create-username" className="text-white">Username</Label>
              <Input
                id="create-username"
                type="text"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="demo"
              />
            </div>
            <div>
              <Label htmlFor="create-email" className="text-white">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="demo@navishstudio.com"
              />
            </div>
            <div>
              <Label htmlFor="create-password" className="text-white">Password</Label>
              <PasswordInput
                id="create-password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="Enter password"
              />
            </div>
            {createError && <p className="text-sm text-red-400">{createError}</p>}
            {createSuccess && <p className="text-sm text-green-400">{createSuccess}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" disabled={createLoading}>
                {createLoading ? 'Creating...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
