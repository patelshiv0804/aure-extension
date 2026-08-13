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

type AuthMode = 'signin' | 'signup' | 'forgot-email' | 'forgot-otp' | 'forgot-reset' | 'forgot-success';
const OTP_LENGTH = 6;

export const AuthView: React.FC = () => {
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

  const handleGoogleSignInClick = () => {
    // Open web app auth page in new tab for Google OAuth login
    chrome.tabs.create({ url: 'http://localhost:3000/auth' });
  };

  // ── Authenticated User Profile View ───────────────────────

  if (isAuthenticated && user) {
    const initials = (user.display_name || user.email).slice(0, 2).toUpperCase();

    return (
      <div className="w-full max-w-md mx-auto rounded-2xl bg-white border border-slate-200/80 shadow-lg overflow-hidden">
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
                <h3 className="text-base font-bold text-slate-900">
                  {user.display_name || 'PromptIQ User'}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-purple-50 text-purple-700 border border-purple-200/60 rounded-full">
                  {user.plan || 'Pro'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
            </div>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center text-xs py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-medium">Account ID</span>
              <span className="font-mono text-slate-700 font-semibold">{user.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between items-center text-xs py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
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
    <div className="w-full max-w-md mx-auto rounded-2xl bg-white border border-slate-200/80 shadow-xl overflow-hidden font-sans">
      {/* Top subtle gradient accent bar matching frontend */}
      <div className="h-1.5 w-full bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400" />

      <div className="p-6 sm:p-7 space-y-6">
        {/* Title & Subtitle */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-1">
            {mode === 'signin' && 'Welcome back'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'forgot-email' && 'Forgot Password?'}
            {mode === 'forgot-otp' && 'Check your inbox'}
            {mode === 'forgot-reset' && 'Set new password'}
            {mode === 'forgot-success' && 'Password Reset!'}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {mode === 'signin' && 'Sign in to continue to PromptIQ'}
            {mode === 'signup' && 'Register your PromptIQ developer profile'}
            {mode === 'forgot-email' && 'Enter your email to receive a 6-digit reset code'}
            {mode === 'forgot-otp' && `Enter the 6-digit code sent to ${email}`}
            {mode === 'forgot-reset' && 'Choose a strong password (at least 8 characters)'}
            {mode === 'forgot-success' && 'Your password has been updated successfully'}
          </p>
        </div>

        {/* Tab Buttons (Sign In / Create Account) */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="flex border-b border-slate-100">
            <button
              type="button"
              onClick={() => { setMode('signin'); setFormError(null); clearError(); }}
              className={`flex-1 pb-3 text-xs text-center transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'border-b-2 border-purple-600 text-slate-900 font-bold'
                  : 'text-slate-400 font-medium hover:text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setFormError(null); clearError(); }}
              className={`flex-1 pb-3 text-xs text-center transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'border-b-2 border-purple-600 text-slate-900 font-bold'
                  : 'text-slate-400 font-medium hover:text-slate-600'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error Alert Box */}
        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium flex items-center gap-2">
            <span>⚠️</span>
            <span className="flex-1">{formError}</span>
          </div>
        )}

        {/* ── Sign In Form ──────────────────────────────────── */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1.5 ml-1">Email address</label>
              <div className="relative flex items-center">
                <Mail size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium placeholder:text-slate-400"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="text-xs font-semibold text-slate-900">Password</label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot-email'); setFormError(null); }}
                  className="text-[11px] font-bold text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium placeholder:text-slate-400"
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Dark Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-full text-xs font-semibold text-white bg-[#111827] hover:bg-slate-800 active:scale-[0.99] shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing In...' : 'Sign In'}
              <ArrowRight size={15} />
            </button>

            {/* OAuth Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-200/80" />
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">OR CONTINUE WITH</span>
              <div className="flex-1 h-px bg-slate-200/80" />
            </div>

            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignInClick}
              className="w-full py-2.5 px-4 rounded-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2.5 shadow-xs cursor-pointer"
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
            <div className="pt-3 border-t border-slate-100 text-center text-xs text-slate-600">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setFormError(null); }}
                className="font-bold text-slate-900 hover:text-purple-600 transition-colors"
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
              <label className="block text-xs font-semibold text-slate-900 mb-1.5 ml-1">Full Name</label>
              <div className="relative flex items-center">
                <User size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium placeholder:text-slate-400"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1.5 ml-1">Email address</label>
              <div className="relative flex items-center">
                <Mail size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium placeholder:text-slate-400"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1.5 ml-1">Password</label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium placeholder:text-slate-400"
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1.5 ml-1">Confirm Password</label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium placeholder:text-slate-400"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Dark Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-full text-xs font-semibold text-white bg-[#111827] hover:bg-slate-800 active:scale-[0.99] shadow-md shadow-slate-900/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating Account...' : 'Create Account'}
              <ArrowRight size={15} />
            </button>

            {/* Footer Prompt */}
            <div className="pt-3 border-t border-slate-100 text-center text-xs text-slate-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setFormError(null); }}
                className="font-bold text-slate-900 hover:text-purple-600 transition-colors"
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-purple-600 transition-colors mb-1"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </button>

            <div className="w-12 h-12 rounded-full bg-purple-50 border border-purple-200/60 flex items-center justify-center mx-auto text-purple-600">
              <KeyRound size={22} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1.5 ml-1">Email address</label>
              <div className="relative flex items-center">
                <Mail size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium placeholder:text-slate-400"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-full text-xs font-semibold text-white bg-[#111827] hover:bg-slate-800 active:scale-[0.99] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-purple-600 transition-colors mb-1"
            >
              <ArrowLeft size={14} /> Change email
            </button>

            <div className="w-12 h-12 rounded-full bg-purple-50 border border-purple-200/60 flex items-center justify-center mx-auto text-purple-600">
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
                  className={`w-10 h-12 text-center text-lg font-bold font-mono rounded-xl border transition-all outline-none ${
                    digit
                      ? 'border-purple-500 bg-purple-50/50 text-slate-900 shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 text-slate-900 focus:border-purple-500 focus:bg-white'
                  }`}
                />
              ))}
            </div>

            <div className="text-center text-xs text-slate-500">
              {otpTimer > 0 ? (
                <>Code expires in <span className="font-bold text-purple-600">{formatTimer(otpTimer)}</span></>
              ) : (
                <span className="text-rose-500 font-semibold">Code expired</span>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || fpOtp.join('').length < OTP_LENGTH}
              className="w-full py-3 px-4 rounded-full text-xs font-semibold text-white bg-[#111827] hover:bg-slate-800 active:scale-[0.99] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 transition-colors"
                >
                  <RefreshCw size={13} /> Resend code
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">Resend code available when timer expires</span>
              )}
            </div>
          </form>
        )}

        {/* ── Forgot Password: Reset Password Step ───────────── */}
        {mode === 'forgot-reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1.5 ml-1">New Password</label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  type={fpShowPass ? 'text' : 'password'}
                  value={fpNewPass}
                  onChange={(e) => setFpNewPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium"
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setFpShowPass(!fpShowPass)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {fpShowPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1.5 ml-1">Confirm Password</label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="password"
                  value={fpConfirmPass}
                  onChange={(e) => setFpConfirmPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium"
                  required
                  disabled={submitting}
                />
              </div>
              {fpConfirmPass.length > 0 && (
                <p className={`text-[11px] mt-1 ml-1 font-semibold ${fpNewPass === fpConfirmPass ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fpNewPass === fpConfirmPass ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-full text-xs font-semibold text-white bg-[#111827] hover:bg-slate-800 active:scale-[0.99] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {submitting ? 'Resetting Password...' : 'Reset Password'}
              <ArrowRight size={15} />
            </button>
          </form>
        )}

        {/* ── Forgot Password: Success Step ──────────────────── */}
        {mode === 'forgot-success' && (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle size={32} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Password Reset Complete!</h3>
              <p className="text-xs text-slate-500 mt-1">Your password has been updated. You can now sign in with your new password.</p>
            </div>
            <button
              type="button"
              onClick={() => { setMode('signin'); setFormError(null); }}
              className="w-full py-3 px-4 rounded-full text-xs font-semibold text-white bg-[#111827] hover:bg-slate-800 active:scale-[0.99] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
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
