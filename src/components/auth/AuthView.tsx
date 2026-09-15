// ──────────────────────────────────────────────────────────────
// AuthView — Extension Authentication UI matching Frontend Design
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, User, ArrowRight, ArrowLeft, Eye, EyeOff,
  KeyRound, CheckCircle, RefreshCw, LogOut, Check, Sparkles
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { getStorage } from '@/lib/storage';
import { useTheme } from '@/hooks/useTheme';
import { D, L } from '@/theme/tokens';

type AuthMode = 'signin' | 'signup' | 'forgot-email' | 'forgot-otp' | 'forgot-reset' | 'forgot-success';
const OTP_LENGTH = 6;

export const AuthView: React.FC = () => {
  const { isDark } = useTheme();
  const {
    user,
    isAuthenticated,
    loading,
    error,
    clearError,
    login,
    register,
    loginWithGoogle,
    sendPasswordResetOtp,
    verifyPasswordResetOtp,
    resetPassword,
    logout,
  } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Forgot password states
  const [fpOtp, setFpOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [fpResetToken, setFpResetToken] = useState('');
  const [fpNewPass, setFpNewPass] = useState('');
  const [fpConfirmPass, setFpConfirmPass] = useState('');
  const [fpShowPass, setFpShowPass] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpResendAvailable, setOtpResendAvailable] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setFormError(error);
  }, [error]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startOtpTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setOtpTimer(600); // 10 minutes
    setOtpResendAvailable(false);
    timerRef.current = setInterval(() => {
      setOtpTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setOtpResendAvailable(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── Form Handlers ──────────────────────────────────────────

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
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
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
      setFormError('Please enter your account email address.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await sendPasswordResetOtp(email.trim());
      startOtpTimer();
      setMode('forgot-otp');
      setTimeout(() => otpInputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to send OTP code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setFormError(null);
    setSubmitting(true);
    setFpOtp(Array(OTP_LENGTH).fill(''));
    try {
      await sendPasswordResetOtp(email.trim());
      startOtpTimer();
      setTimeout(() => otpInputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...fpOtp];
    next[index] = digit;
    setFpOtp(next);
    if (digit && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !fpOtp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (pasted.length > 0) {
      e.preventDefault();
      const next = Array(OTP_LENGTH).fill('');
      pasted.split('').forEach((ch, i) => { next[i] = ch; });
      setFpOtp(next);
      const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
      otpInputRefs.current[focusIdx]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpStr = fpOtp.join('');
    if (otpStr.length < OTP_LENGTH) {
      setFormError('Please enter all 6 digits.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const token = await verifyPasswordResetOtp(email.trim(), otpStr);
      setFpResetToken(token);
      setMode('forgot-reset');
    } catch (err) {
      setFormError('Invalid or expired verification code.');
      setFpOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => otpInputRefs.current[0]?.focus(), 50);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpNewPass || fpNewPass.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }
    if (fpNewPass !== fpConfirmPass) {
      setFormError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await resetPassword(fpResetToken, fpNewPass);
      setMode('forgot-success');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignInClick = async () => {
    // Open configured web app auth page in new tab for Google OAuth login (AURE-02)
    try {
      const settings = await getStorage('settings');
      const endpoint = (settings?.advanced as any)?.apiEndpoint;
      let authUrl = 'http://localhost:3000/auth';
      if (endpoint) {
        try {
          const parsed = new URL(endpoint);
          if (parsed.protocol === 'https:') {
            authUrl = `${parsed.origin}/auth`;
          }
        } catch {}
      }
      chrome.tabs.create({ url: authUrl });
    } catch {
      chrome.tabs.create({ url: 'http://localhost:3000/auth' });
    }
  };

  // ── Authenticated User Profile View ───────────────────────

  if (isAuthenticated && user) {
    const initials = (user.display_name || user.email).slice(0, 2).toUpperCase();

    return (
      <div
        className="w-full max-w-md mx-auto rounded-2xl shadow-lg overflow-hidden transition-colors"
        style={{
          background: isDark ? D.surface : '#FFFFFF',
          border: `1px solid ${isDark ? D.border : 'rgba(226, 232, 240, 0.8)'}`,
          color: isDark ? D.textPrimary : '#0F172A',
        }}
      >
        {/* Top gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400" />
        <div className="p-6 space-y-6">
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
                <h3 className="text-base font-bold" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>
                  {user.display_name || 'AURE User'}
                </h3>
                <span
                  className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded-full"
                  style={{
                    background: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F3E8FF',
                    color: isDark ? '#C084FC' : '#7E22CE',
                    border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(216, 180, 254, 0.6)'}`,
                  }}
                >
                  {user.plan || 'Pro'}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: isDark ? D.textSecondary : '#64748B' }}>{user.email}</p>
            </div>
          </div>

          <div className="space-y-2.5 pt-3" style={{ borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9'}` }}>
            <div
              className="flex justify-between items-center text-xs py-2 px-3 rounded-xl"
              style={{
                background: isDark ? D.surface2 : '#F8FAFC',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9'}`,
              }}
            >
              <span style={{ color: isDark ? D.textSecondary : '#64748B' }} className="font-medium">Account ID</span>
              <span className="font-mono font-semibold" style={{ color: isDark ? D.textPrimary : '#334155' }}>{user.id.slice(0, 8)}...</span>
            </div>
            <div
              className="flex justify-between items-center text-xs py-2 px-3 rounded-xl"
              style={{
                background: isDark ? D.surface2 : '#F8FAFC',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9'}`,
              }}
            >
              <span style={{ color: isDark ? D.textSecondary : '#64748B' }} className="font-medium">Session Status</span>
              <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Session Active
              </span>
            </div>
          </div>

          {!confirmSignOut ? (
            <button
              onClick={() => setConfirmSignOut(true)}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-full text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/70 transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200 space-y-3 text-center">
              <p className="text-xs font-bold text-rose-900">Are you sure you want to sign out?</p>
              <p className="text-[11px] text-rose-700">You will need to sign in again to sync prompts across extension views.</p>
              <div className="flex gap-2 justify-center pt-1">
                <button
                  onClick={() => setConfirmSignOut(false)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => logout()}
                  disabled={loading}
                  className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/25 transition-all flex items-center gap-1.5"
                >
                  <LogOut size={13} />
                  Yes, Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Auth Views (Sign In, Sign Up, Forgot Password) ────────

  return (
    <div
      className="w-full max-w-md mx-auto rounded-2xl shadow-xl overflow-hidden font-sans transition-colors"
      style={{
        background: isDark ? D.surface : '#FFFFFF',
        border: `1px solid ${isDark ? D.border : 'rgba(226, 232, 240, 0.8)'}`,
        color: isDark ? D.textPrimary : '#0F172A',
      }}
    >
      {/* Top subtle gradient accent bar matching frontend */}
      <div className="h-1.5 w-full bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400" />

      <div className="p-6 sm:p-7 space-y-6">
        {/* Title & Subtitle */}
        <div className="text-center">
          <h2
            className="text-xl font-bold tracking-tight mb-1"
            style={{ color: isDark ? D.textPrimary : '#0F172A' }}
          >
            {mode === 'signin' && 'Welcome back'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'forgot-email' && 'Forgot Password?'}
            {mode === 'forgot-otp' && 'Check your inbox'}
            {mode === 'forgot-reset' && 'Set new password'}
            {mode === 'forgot-success' && 'Password Reset!'}
          </h2>
          <p className="text-xs font-medium" style={{ color: isDark ? D.textSecondary : '#64748B' }}>
            {mode === 'signin' && 'Sign in to continue to AURE'}
            {mode === 'signup' && 'Register your AURE developer profile'}
            {mode === 'forgot-email' && 'Enter your email to receive a 6-digit reset code'}
            {mode === 'forgot-otp' && `Enter the 6-digit code sent to ${email}`}
            {mode === 'forgot-reset' && 'Choose a strong password (at least 8 characters)'}
            {mode === 'forgot-success' && 'Your password has been updated successfully'}
          </p>
        </div>

        {/* Tab Buttons (Sign In / Create Account) */}
        {(mode === 'signin' || mode === 'signup') && (
          <div style={{ display: 'flex', borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.09)' : '#ECE9FF'}` }}>
            <button
              type="button"
              onClick={() => { setMode('signin'); setFormError(null); clearError(); }}
              style={{
                flex: 1,
                paddingBottom: 12,
                fontSize: 13,
                textAlign: 'center',
                background: 'transparent',
                border: 'none',
                borderBottom: mode === 'signin' ? '2px solid #8B5CF6' : '2px solid transparent',
                color: mode === 'signin' ? (isDark ? D.textPrimary : '#0F172A') : (isDark ? D.textMuted : '#94A3B8'),
                fontWeight: mode === 'signin' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setFormError(null); clearError(); }}
              style={{
                flex: 1,
                paddingBottom: 12,
                fontSize: 13,
                textAlign: 'center',
                background: 'transparent',
                border: 'none',
                borderBottom: mode === 'signup' ? '2px solid #8B5CF6' : '2px solid transparent',
                color: mode === 'signup' ? (isDark ? D.textPrimary : '#0F172A') : (isDark ? D.textMuted : '#94A3B8'),
                fontWeight: mode === 'signup' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error Alert Box */}
        {formError && (
          <div
            className="p-3 rounded-xl text-xs font-medium flex items-center gap-2"
            style={{
              background: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
              border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.25)' : '#FECACA'}`,
              color: isDark ? '#F87171' : '#DC2626',
            }}
          >
            <span>⚠️</span>
            <span className="flex-1">{formError}</span>
          </div>
        )}

        {/* ── Sign In Form ──────────────────────────────────── */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label style={{ color: isDark ? D.textPrimary : '#0F172A' }} className="block text-xs font-semibold mb-1.5 ml-1">Email address</label>
              <div className="relative flex items-center">
                <Mail size={16} style={{ position: 'absolute', left: 14, color: isDark ? D.textMuted : '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingLeft: 40,
                    paddingRight: 14,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: 13,
                    background: isDark ? D.surface2 : '#FFFFFF',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'}`,
                    borderRadius: 12,
                    color: isDark ? D.textPrimary : '#0F172A',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label style={{ color: isDark ? D.textPrimary : '#0F172A' }} className="text-xs font-semibold">Password</label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot-email'); setFormError(null); }}
                  style={{ color: isDark ? '#A78BFA' : '#7C3AED', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                  className="text-[11px] font-bold hover:underline transition-colors"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative flex items-center">
                <Lock size={16} style={{ position: 'absolute', left: 14, color: isDark ? D.textMuted : '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingLeft: 40,
                    paddingRight: 40,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: 13,
                    background: isDark ? D.surface2 : '#FFFFFF',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'}`,
                    borderRadius: 12,
                    color: isDark ? D.textPrimary : '#0F172A',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 14, color: isDark ? D.textMuted : '#94A3B8', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                  className="hover:opacity-80 transition-opacity"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* High-contrast Pill Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                background: isDark ? D.ctaBg : '#111827',
                color: isDark ? D.ctaText : '#FFFFFF',
                boxShadow: isDark ? D.ctaShadow : '0 4px 14px rgba(0, 0, 0, 0.12)',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
                opacity: submitting ? 0.75 : 1,
              }}
            >
              {submitting ? 'Signing In...' : 'Sign In'}
              <ArrowRight size={15} />
            </button>

            {/* OAuth Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ background: isDark ? 'rgba(255, 255, 255, 0.09)' : '#E2E8F0' }} />
              <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: isDark ? D.textMuted : '#94A3B8' }}>OR CONTINUE WITH</span>
              <div className="flex-1 h-px" style={{ background: isDark ? 'rgba(255, 255, 255, 0.09)' : '#E2E8F0' }} />
            </div>

            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignInClick}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 600,
                background: isDark ? D.surface2 : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'}`,
                color: isDark ? D.textPrimary : '#1E293B',
                boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.4)' : '0 1px 2px rgba(17, 24, 39, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.221 36 24 36c-6.627 0-12-5.373-12-12S17.373 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.278 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917Z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.278 4 24 4c-7.682 0-14.346 4.337-17.694 10.691Z"/>
                <path fill="#4CAF50" d="M24 44c5.18 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.143 35.091 26.715 36 24 36c-5.2 0-9.62-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44Z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.05 12.05 0 0 1-4.084 5.571h.003l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917Z"/>
              </svg>
              Sign in with Google
            </button>

            {/* Footer Prompt */}
            <div
              style={{
                paddingTop: 14,
                borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.09)' : '#F1F5F9'}`,
                color: isDark ? D.textSecondary : '#64748B',
              }}
              className="text-center text-xs"
            >
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setFormError(null); }}
                style={{
                  fontWeight: 700,
                  color: isDark ? '#A78BFA' : '#7C3AED',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
                className="hover:underline transition-colors"
              >
                Get Started
              </button>
            </div>
          </form>
        )}

        {/* ── Sign Up Form ──────────────────────────────────── */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label style={{ color: isDark ? D.textPrimary : '#0F172A' }} className="block text-xs font-semibold mb-1.5 ml-1">Full Name</label>
              <div className="relative flex items-center">
                <User size={16} style={{ position: 'absolute', left: 14, color: isDark ? D.textMuted : '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingLeft: 40,
                    paddingRight: 14,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: 13,
                    background: isDark ? D.surface2 : '#FFFFFF',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'}`,
                    borderRadius: 12,
                    color: isDark ? D.textPrimary : '#0F172A',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label style={{ color: isDark ? D.textPrimary : '#0F172A' }} className="block text-xs font-semibold mb-1.5 ml-1">Email address</label>
              <div className="relative flex items-center">
                <Mail size={16} style={{ position: 'absolute', left: 14, color: isDark ? D.textMuted : '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingLeft: 40,
                    paddingRight: 14,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: 13,
                    background: isDark ? D.surface2 : '#FFFFFF',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'}`,
                    borderRadius: 12,
                    color: isDark ? D.textPrimary : '#0F172A',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label style={{ color: isDark ? D.textPrimary : '#0F172A' }} className="block text-xs font-semibold mb-1.5 ml-1">Password</label>
              <div className="relative flex items-center">
                <Lock size={16} style={{ position: 'absolute', left: 14, color: isDark ? D.textMuted : '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingLeft: 40,
                    paddingRight: 40,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: 13,
                    background: isDark ? D.surface2 : '#FFFFFF',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'}`,
                    borderRadius: 12,
                    color: isDark ? D.textPrimary : '#0F172A',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 14, color: isDark ? D.textMuted : '#94A3B8', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                  className="hover:opacity-80 transition-opacity"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ color: isDark ? D.textPrimary : '#0F172A' }} className="block text-xs font-semibold mb-1.5 ml-1">Confirm Password</label>
              <div className="relative flex items-center">
                <Lock size={16} style={{ position: 'absolute', left: 14, color: isDark ? D.textMuted : '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingLeft: 40,
                    paddingRight: 14,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: 13,
                    background: isDark ? D.surface2 : '#FFFFFF',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'}`,
                    borderRadius: 12,
                    color: isDark ? D.textPrimary : '#0F172A',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            {/* High-contrast Pill Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                background: isDark ? D.ctaBg : '#111827',
                color: isDark ? D.ctaText : '#FFFFFF',
                boxShadow: isDark ? D.ctaShadow : '0 4px 14px rgba(0, 0, 0, 0.12)',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
                opacity: submitting ? 0.75 : 1,
              }}
            >
              {submitting ? 'Creating Account...' : 'Create Account'}
              <ArrowRight size={15} />
            </button>

            {/* Footer Prompt */}
            <div
              style={{
                paddingTop: 14,
                borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.09)' : '#F1F5F9'}`,
                color: isDark ? D.textSecondary : '#64748B',
              }}
              className="text-center text-xs"
            >
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setFormError(null); }}
                style={{
                  fontWeight: 700,
                  color: isDark ? '#A78BFA' : '#7C3AED',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
                className="hover:underline transition-colors"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* ── Forgot Password: Email Step ────────────────────── */}
        {mode === 'forgot-email' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <button
              type="button"
              onClick={() => { setMode('signin'); setFormError(null); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: isDark ? D.textSecondary : '#64748B',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                marginBottom: 6,
              }}
              className="hover:opacity-80 transition-opacity"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </button>

            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
              style={{
                background: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F3E8FF',
                border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.3)' : '#DDD6FE'}`,
                color: isDark ? '#C084FC' : '#7C3AED',
              }}
            >
              <KeyRound size={22} />
            </div>

            <div>
              <label style={{ color: isDark ? D.textPrimary : '#0F172A' }} className="block text-xs font-semibold mb-1.5 ml-1">Email address</label>
              <div className="relative flex items-center">
                <Mail size={16} style={{ position: 'absolute', left: 14, color: isDark ? D.textMuted : '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingLeft: 40,
                    paddingRight: 14,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: 13,
                    background: isDark ? D.surface2 : '#FFFFFF',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'}`,
                    borderRadius: 12,
                    color: isDark ? D.textPrimary : '#0F172A',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                background: isDark ? D.ctaBg : '#111827',
                color: isDark ? D.ctaText : '#FFFFFF',
                boxShadow: isDark ? D.ctaShadow : '0 4px 14px rgba(0, 0, 0, 0.12)',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
                opacity: submitting ? 0.75 : 1,
              }}
            >
              {submitting ? 'Sending Code...' : 'Send Reset Code'}
              <ArrowRight size={15} />
            </button>
          </form>
        )}

        {/* ── Forgot Password: 6-Digit OTP Step ──────────────── */}
        {mode === 'forgot-otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <button
              type="button"
              onClick={() => { setMode('forgot-email'); setFormError(null); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: isDark ? D.textSecondary : '#64748B',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                marginBottom: 6,
              }}
              className="hover:opacity-80 transition-opacity"
            >
              <ArrowLeft size={14} /> Change email
            </button>

            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
              style={{
                background: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F3E8FF',
                border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.3)' : '#DDD6FE'}`,
                color: isDark ? '#C084FC' : '#7C3AED',
              }}
            >
              <Mail size={22} />
            </div>

            {/* 6 Individual OTP Boxes */}
            <div className="flex gap-2 justify-center py-2">
              {fpOtp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { otpInputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  disabled={submitting}
                  style={{
                    width: 40,
                    height: 48,
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    borderRadius: 12,
                    background: digit
                      ? (isDark ? 'rgba(139, 92, 246, 0.2)' : '#F3E8FF')
                      : (isDark ? D.surface2 : '#F8FAFC'),
                    border: `1px solid ${digit ? '#8B5CF6' : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0')}`,
                    color: isDark ? D.textPrimary : '#0F172A',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                />
              ))}
            </div>

            <div className="text-center text-xs" style={{ color: isDark ? D.textSecondary : '#64748B' }}>
              {otpTimer > 0 ? (
                <>Code expires in <span className="font-bold" style={{ color: isDark ? '#A78BFA' : '#7C3AED' }}>{formatTimer(otpTimer)}</span></>
              ) : (
                <span className="text-rose-500 font-semibold">Code expired</span>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || fpOtp.join('').length < OTP_LENGTH}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                background: isDark ? D.ctaBg : '#111827',
                color: isDark ? D.ctaText : '#FFFFFF',
                boxShadow: isDark ? D.ctaShadow : '0 4px 14px rgba(0, 0, 0, 0.12)',
                border: 'none',
                cursor: (submitting || fpOtp.join('').length < OTP_LENGTH) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
                opacity: (submitting || fpOtp.join('').length < OTP_LENGTH) ? 0.6 : 1,
              }}
            >
              {submitting ? 'Verifying...' : 'Verify Code'}
              <ArrowRight size={15} />
            </button>

            <div className="text-center pt-2">
              {otpResendAvailable ? (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={submitting}
                  style={{
                    color: isDark ? '#A78BFA' : '#7C3AED',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline transition-colors"
                >
                  <RefreshCw size={13} /> Resend code
                </button>
              ) : (
                <span className="text-[11px]" style={{ color: isDark ? D.textMuted : '#94A3B8' }}>Resend code available when timer expires</span>
              )}
            </div>
          </form>
        )}

        {/* ── Forgot Password: Reset Password Step ───────────── */}
        {mode === 'forgot-reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label style={{ color: isDark ? D.textPrimary : '#0F172A' }} className="block text-xs font-semibold mb-1.5 ml-1">New Password</label>
              <div className="relative flex items-center">
                <Lock size={16} style={{ position: 'absolute', left: 14, color: isDark ? D.textMuted : '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type={fpShowPass ? 'text' : 'password'}
                  value={fpNewPass}
                  onChange={(e) => setFpNewPass(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingLeft: 40,
                    paddingRight: 40,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: 13,
                    background: isDark ? D.surface2 : '#FFFFFF',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'}`,
                    borderRadius: 12,
                    color: isDark ? D.textPrimary : '#0F172A',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setFpShowPass(!fpShowPass)}
                  style={{ position: 'absolute', right: 14, color: isDark ? D.textMuted : '#94A3B8', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                  className="hover:opacity-80 transition-opacity"
                >
                  {fpShowPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ color: isDark ? D.textPrimary : '#0F172A' }} className="block text-xs font-semibold mb-1.5 ml-1">Confirm Password</label>
              <div className="relative flex items-center">
                <Lock size={16} style={{ position: 'absolute', left: 14, color: isDark ? D.textMuted : '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type="password"
                  value={fpConfirmPass}
                  onChange={(e) => setFpConfirmPass(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingLeft: 40,
                    paddingRight: 14,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: 13,
                    background: isDark ? D.surface2 : '#FFFFFF',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'}`,
                    borderRadius: 12,
                    color: isDark ? D.textPrimary : '#0F172A',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  required
                  disabled={submitting}
                />
              </div>
              {fpConfirmPass.length > 0 && (
                <p className={`text-[11px] mt-1 ml-1 font-semibold ${fpNewPass === fpConfirmPass ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {fpNewPass === fpConfirmPass ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                background: isDark ? D.ctaBg : '#111827',
                color: isDark ? D.ctaText : '#FFFFFF',
                boxShadow: isDark ? D.ctaShadow : '0 4px 14px rgba(0, 0, 0, 0.12)',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
                opacity: submitting ? 0.75 : 1,
              }}
            >
              {submitting ? 'Resetting Password...' : 'Reset Password'}
              <ArrowRight size={15} />
            </button>
          </form>
        )}

        {/* ── Forgot Password: Success Step ──────────────────── */}
        {mode === 'forgot-success' && (
          <div className="text-center py-4 space-y-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{
                background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0'}`,
                color: '#10B981',
              }}
            >
              <CheckCircle size={32} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: isDark ? D.textPrimary : '#0F172A' }}>Password Reset Complete!</h3>
              <p className="text-xs mt-1" style={{ color: isDark ? D.textSecondary : '#64748B' }}>Your password has been updated. You can now sign in with your new password.</p>
            </div>
            <button
              type="button"
              onClick={() => { setMode('signin'); setFormError(null); }}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                background: isDark ? D.ctaBg : '#111827',
                color: isDark ? D.ctaText : '#FFFFFF',
                boxShadow: isDark ? D.ctaShadow : '0 4px 14px rgba(0, 0, 0, 0.12)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
              }}
            >
              Back to Sign In
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
