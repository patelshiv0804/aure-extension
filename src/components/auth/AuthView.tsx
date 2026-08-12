// ──────────────────────────────────────────────────────────────
// AuthView — Complete Authentication UI (Sign In, Sign Up, Forgot Pass, Profile)
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { RoleIcon } from '../common/RoleIcon';

type AuthMode = 'signin' | 'signup' | 'forgot';

export const AuthView: React.FC = () => {
  const {
    user,
    isAuthenticated,
    loading,
    error,
    clearError,
    login,
    register,
    sendPasswordResetOtp,
    verifyPasswordResetOtp,
    resetPassword,
    logout,
  } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Forgot password steps
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'reset' | 'success'>('email');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    setFormError(error);
  }, [error]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setFormError('Please enter both email and password.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await login(email, password);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !fullName.trim()) {
      setFormError('Please fill out all fields.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await register(email, password, fullName);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFormError('Please enter your account email.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await sendPasswordResetOtp(email);
      setForgotStep('otp');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) {
      setFormError('Please enter the verification code.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const token = await verifyPasswordResetOtp(email, otp);
      setResetToken(token);
      setForgotStep('reset');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await resetPassword(resetToken, newPassword);
      setForgotStep('success');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  // If already logged in, show authenticated Profile View
  if (isAuthenticated && user) {
    const initials = (user.display_name || user.email)
      .slice(0, 2)
      .toUpperCase();

    return (
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-primary-500/20">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="User Avatar" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              initials
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {user.display_name || 'PromptIQ User'}
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-primary-50 text-primary-600 border border-primary-200/60 rounded-full">
                {user.plan || 'Pro'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex justify-between items-center text-xs py-2 px-3 rounded-lg bg-slate-50">
            <span className="text-slate-500 font-medium">Account ID</span>
            <span className="font-mono text-slate-700">{user.id.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between items-center text-xs py-2 px-3 rounded-lg bg-slate-50">
            <span className="text-slate-500 font-medium">Session Status</span>
            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              HTTP Cookie Session Active
            </span>
          </div>
        </div>

        {!confirmSignOut ? (
          <button
            onClick={() => setConfirmSignOut(true)}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 border border-rose-200/60 transition-colors flex items-center justify-center gap-2"
          >
            <RoleIcon name="LogOut" size={14} />
            Sign Out
          </button>
        ) : (
          <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200/80 space-y-2.5 text-center">
            <p className="text-xs font-bold text-rose-900">Are you sure you want to sign out?</p>
            <p className="text-[11px] text-rose-700">You will need to sign in again to access prompt history.</p>
            <div className="flex gap-2 justify-center pt-1">
              <button
                onClick={() => setConfirmSignOut(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => logout()}
                disabled={loading}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all flex items-center gap-1.5"
              >
                <RoleIcon name="LogOut" size={13} />
                Yes, Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 rounded-2xl bg-white border border-slate-200/80 shadow-md">
      {/* Header Tabs */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setMode('signin');
              setFormError(null);
              clearError();
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === 'signin'
                ? 'bg-primary-500 text-white shadow-sm shadow-primary-500/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setMode('signup');
              setFormError(null);
              clearError();
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-primary-500 text-white shadow-sm shadow-primary-500/30'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            Create Account
          </button>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">HTTP Cookie Auth</span>
      </div>

      {formError && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium flex items-center gap-2">
          <span>⚠️</span>
          <span>{formError}</span>
        </div>
      )}

      {/* ── Sign In ────────────────────────── */}
      {mode === 'signin' && (
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition-all font-medium"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setForgotStep('email');
                  setFormError(null);
                }}
                className="text-[11px] text-primary-600 hover:underline font-medium"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition-all font-medium pr-8"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                {showPassword ? '👁️' : '🔒'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-primary-500 hover:bg-primary-600 active:scale-[0.99] shadow-md shadow-primary-500/25 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      )}

      {/* ── Sign Up ────────────────────────── */}
      {mode === 'signup' && (
        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Kartik Jaju"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition-all font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition-all font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-primary-500 focus:bg-white transition-all font-medium pr-8"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                {showPassword ? '👁️' : '🔒'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-primary-500 hover:bg-primary-600 active:scale-[0.99] shadow-md shadow-primary-500/25 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? 'Creating Account...' : 'Create Free Account'}
          </button>
        </form>
      )}

      {/* ── Forgot Password ────────────────── */}
      {mode === 'forgot' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900">Reset Password</h4>
            <button
              onClick={() => setMode('signin')}
              className="text-[11px] text-slate-400 hover:text-slate-600"
            >
              Back to Sign In
            </button>
          </div>

          {forgotStep === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-3">
              <p className="text-[11px] text-slate-500">
                Enter your email address to receive a verification code.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-primary-500 focus:bg-white"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 px-4 rounded-xl text-xs font-bold text-white bg-primary-500 hover:bg-primary-600"
              >
                {submitting ? 'Sending Code...' : 'Send Verification Code'}
              </button>
            </form>
          )}

          {forgotStep === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <p className="text-[11px] text-slate-500">
                Enter the verification code sent to <strong className="text-slate-700">{email}</strong>.
              </p>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-primary-500 font-mono tracking-widest text-center"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 px-4 rounded-xl text-xs font-bold text-white bg-primary-500 hover:bg-primary-600"
              >
                {submitting ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>
          )}

          {forgotStep === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-3">
              <p className="text-[11px] text-slate-500">Enter a new password for your account.</p>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-primary-500"
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-primary-500"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 px-4 rounded-xl text-xs font-bold text-white bg-primary-500 hover:bg-primary-600"
              >
                {submitting ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          {forgotStep === 'success' && (
            <div className="text-center py-4 space-y-3">
              <div className="text-3xl">🎉</div>
              <p className="text-xs font-bold text-slate-800">Password Reset Successfully</p>
              <button
                onClick={() => setMode('signin')}
                className="px-4 py-2 text-xs font-bold text-white bg-primary-500 rounded-xl"
              >
                Sign In Now
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
