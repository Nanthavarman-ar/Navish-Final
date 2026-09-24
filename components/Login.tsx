import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, projectId } from '../supabase/client';
import { Input } from './ui/input';
import { PasswordInput } from './ui/password-input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { SiteShell } from './site/SiteShell';
import { LabelCard, SiteImage } from './site/brand';
import { loginImage } from './site/content';

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

export function Login() {
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

  // Accepts either an email or a plain username. A plain username is looked
  // up server-side (against Supabase user metadata) to find its email, since
  // Supabase Auth itself only signs in by email.
  const resolveLoginEmail = async (identifierOverride?: string): Promise<string | null> => {
    const identifier = identifierOverride ?? (email.trim() || username.trim());
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    // Read the identifier/password straight from the submitted form rather than
    // trusting the email/username/password React state - some browsers' autofill
    // or password-manager extensions set an input's value directly without firing
    // the native "input" event React's onChange listens for, which silently
    // leaves that state empty even though the field visibly shows a filled-in
    // value. That desync is what made Login do nothing at all on some devices:
    // hasIdentifier (derived from the same stale state) stayed false, the submit
    // button stayed disabled, and clicking a disabled button fires no event at
    // all - reported as "click pannalum edhuvum aagala" (only reproduced on a
    // different device/browser, exactly where autofill behavior would differ).
    const formData = new FormData(e.currentTarget);
    const identifier = String(formData.get('email') || '').trim() || String(formData.get('username') || '').trim();
    const submittedPassword = String(formData.get('password') || '');
    if (!identifier) {
      setError('Please enter your email or username.');
      return;
    }
    const loginEmail = await resolveLoginEmail(identifier);
    if (!loginEmail) {
      setError('Unable to sign in. Please check your credentials.');
      return;
    }
    // No role picker here: the account's real role (from Supabase user
    // metadata, verified server-side) decides where to go, never the user's
    // choice on this form.
    const role = await login(loginEmail, submittedPassword);
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
    <SiteShell page="login" footer={false}>
      <section className="nv-split">
        <div className="nv-media nv-split__media" data-nv-clip>
          <SiteImage src={loginImage} alt="Navish workspace" eager />
          <LabelCard title="Navish workspace" sub="Your projects in 3D and VR" />
        </div>
        <div className="nv-split__panel nv-split__panel--center">
          <div>
            <p className="nv-eyebrow" style={{ marginBottom: '1rem' }}>
              Client studio
            </p>
            <h1 className="nv-caps" data-nv-lines="now">
              Login to Navish
            </h1>
          </div>
          <p className="nv-p">Enter your credentials to access the workspace.</p>

          <form onSubmit={handleSubmit} className="nv-form">
            <div className="nv-field">
              <label htmlFor="username">Username</label>
              <Input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="nv-input"
                placeholder="client1, admin, etc."
              />
            </div>
            <div className="nv-field">
              <label htmlFor="email">Email</label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="nv-input"
                placeholder="user@example.com"
              />
            </div>
            <div className="nv-field">
              <div className="nv-field__head">
                <label htmlFor="password">Password</label>
                <div className="nv-textbtn-row">
                  <button type="button" onClick={() => setForgotOpen(true)} className="nv-textbtn">
                    Forgot password?
                  </button>
                  <button type="button" onClick={() => setChangeOpen(true)} className="nv-textbtn">
                    Change password
                  </button>
                </div>
              </div>
              <PasswordInput
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="nv-input"
              />
            </div>
            <button type="submit" className="nv-btn nv-btn--red nv-btn--block" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            {error && (
              <p className="nv-msg nv-msg--err" style={{ textAlign: 'center' }}>{error}</p>
            )}
          </form>
          <div className="nv-textbtn-row" style={{ alignItems: 'baseline' }}>
            <span className="nv-p" style={{ fontSize: '0.875rem' }}>Sign in with your registered account.</span>
            <button
              type="button"
              onClick={() => {
                resetCreateForm();
                setCreateOpen(true);
              }}
              className="nv-textbtn"
            >
              Create a new user account
            </button>
          </div>
        </div>
      </section>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="nv-dialog" data-lenis-prevent>
          <DialogHeader>
            <DialogTitle>Forgot Password</DialogTitle>
            <DialogDescription>
              Enter your email and we&apos;ll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          {forgotSent ? (
            <p className="nv-msg nv-msg--ok" style={{ padding: '1rem 0' }}>
              If an account exists for {forgotEmail || 'that email'}, a password reset link has been sent.
            </p>
          ) : (
            <form onSubmit={handleForgotSubmit} className="nv-form">
              <div className="nv-field">
                <Label htmlFor="forgot-email" className="nv-eyebrow">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className="nv-input"
                  placeholder="user@example.com"
                />
              </div>
              <DialogFooter>
                <button type="button" className="nv-btn nv-btn--ghost" onClick={() => setForgotOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="nv-btn nv-btn--red">
                  Send reset link
                </button>
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
        <DialogContent className="nv-dialog" data-lenis-prevent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your email, current password, and new password.
            </DialogDescription>
          </DialogHeader>
          {changeSuccess ? (
            <p className="nv-msg nv-msg--ok" style={{ padding: '1rem 0' }}>Password changed successfully. You can now log in with your new password.</p>
          ) : (
            <form onSubmit={handleChangeSubmit} className="nv-form">
              <div className="nv-field">
                <Label htmlFor="change-email" className="nv-eyebrow">Email</Label>
                <Input
                  id="change-email"
                  type="email"
                  value={changeEmail}
                  onChange={(e) => setChangeEmail(e.target.value)}
                  required
                  className="nv-input"
                  placeholder="user@example.com"
                />
              </div>
              <div className="nv-field">
                <Label htmlFor="current-password" className="nv-eyebrow">Current Password</Label>
                <PasswordInput
                  id="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="nv-input"
                />
              </div>
              <div className="nv-field">
                <Label htmlFor="new-password" className="nv-eyebrow">New Password</Label>
                <PasswordInput
                  id="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="nv-input"
                />
              </div>
              <div className="nv-field">
                <Label htmlFor="confirm-password" className="nv-eyebrow">Confirm New Password</Label>
                <PasswordInput
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="nv-input"
                />
              </div>
              {changeError && <p className="nv-msg nv-msg--err">{changeError}</p>}
              <DialogFooter>
                <button type="button" className="nv-btn nv-btn--ghost" onClick={() => setChangeOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="nv-btn nv-btn--red" disabled={changeLoading}>
                  {changeLoading ? 'Changing...' : 'Change Password'}
                </button>
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
        <DialogContent className="nv-dialog" data-lenis-prevent>
          <DialogHeader>
            <DialogTitle>Create User Account</DialogTitle>
            <DialogDescription>
              Create a new client account for login and model uploads.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="nv-form">
            <div className="nv-field">
              <Label htmlFor="create-name" className="nv-eyebrow">Name</Label>
              <Input
                id="create-name"
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="nv-input"
                placeholder="Demo User"
              />
            </div>
            <div className="nv-field">
              <Label htmlFor="create-username" className="nv-eyebrow">Username</Label>
              <Input
                id="create-username"
                type="text"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                required
                className="nv-input"
                placeholder="demo"
              />
            </div>
            <div className="nv-field">
              <Label htmlFor="create-email" className="nv-eyebrow">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
                className="nv-input"
                placeholder="demo@navishstudio.com"
              />
            </div>
            <div className="nv-field">
              <Label htmlFor="create-password" className="nv-eyebrow">Password</Label>
              <PasswordInput
                id="create-password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                required
                className="nv-input"
                placeholder="Enter password"
              />
            </div>
            {createError && <p className="nv-msg nv-msg--err">{createError}</p>}
            {createSuccess && <p className="nv-msg nv-msg--ok">{createSuccess}</p>}
            <DialogFooter>
              <button type="button" className="nv-btn nv-btn--ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
              <button type="submit" className="nv-btn nv-btn--red" disabled={createLoading}>
                {createLoading ? 'Creating...' : 'Create Account'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SiteShell>
  );
}
