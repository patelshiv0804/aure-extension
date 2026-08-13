// ──────────────────────────────────────────────────────────────
// Auth Store — Zustand + HTTP Cookie & chrome.storage.local
// ──────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { apiRequest, ApiError } from '@/api/client';
import { getAuthCookie, setAuthCookie, removeAuthCookie } from '@/lib/cookies';
import { getStorage, setStorage, removeStorage, UserProfile } from '@/lib/storage';
import { historyCache, enhanceCache } from '@/lib/cache';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  sendPasswordResetOtp: (email: string) => Promise<void>;
  verifyPasswordResetOtp: (email: string, otp: string) => Promise<string>;
  resetPassword: (resetToken: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  loadAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
  error: null,

  clearError: () => set({ error: null }),

  loadAuth: async () => {
    set({ loading: true });
    try {
      // 1. Try to read token from HTTP Cookie or chrome.storage.local
      const cookieToken = await getAuthCookie();
      const storageToken = (await getStorage('promptiq_token')) || (await getStorage('apiToken'));
      const token = cookieToken || storageToken || null;
      const cachedProfile = await getStorage('userProfile');

      // If no token or cached profile is present, user is not signed in
      if (!token && !cachedProfile) {
        set({ user: null, token: null, isAuthenticated: false });
        return;
      }

      // Pre-set authenticated status from cached profile/token immediately for instant UI render
      set({ token, user: cachedProfile || null, isAuthenticated: !!cachedProfile });

      // 2. Validate cookie session with backend GET /profile/me
      try {
        const profile = await apiRequest<UserProfile>({
          method: 'GET',
          path: '/profile/me',
        });
        const activeCookie = (await getAuthCookie()) || token;
        set({ user: profile, token: activeCookie, isAuthenticated: true });
        await setStorage('userProfile', profile);
        if (profile.email) await setStorage('currentUserEmail', profile.email);
        if (activeCookie) {
          await setStorage('promptiq_token', activeCookie);
          await setStorage('apiToken', activeCookie);
        }
      } catch (err) {
        // ONLY wipe session if API explicitly returns 401 Unauthorized
        if (err instanceof ApiError && err.status === 401) {
          await removeAuthCookie();
          await removeStorage('userProfile');
          await removeStorage('currentUserEmail');
          await removeStorage('promptiq_token');
          await removeStorage('apiToken');
          set({ user: null, token: null, isAuthenticated: false });
        } else if (cachedProfile) {
          // Retain authenticated status with cached profile if network error or content script cross-origin fetch restriction
          set({ user: cachedProfile, token: token || null, isAuthenticated: true });
        }
      }
    } catch (err) {
      const cachedProfile = await getStorage('userProfile');
      if (cachedProfile) {
        set({ user: cachedProfile, isAuthenticated: true });
      } else {
        set({ user: null, token: null, isAuthenticated: false });
      }
    } finally {
      set({ loading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await apiRequest<{ access_token?: string }>({
        method: 'POST',
        path: '/auth/login',
        body: formData,
      });

      // Retrieve HTTP cookie set automatically by backend response
      const cookieToken = await getAuthCookie();
      const accessToken = response.access_token || cookieToken || '';

      if (accessToken) {
        await setAuthCookie(accessToken);
        await setStorage('promptiq_token', accessToken);
        await setStorage('apiToken', accessToken);
        set({ token: accessToken });
      }

      // Fetch user profile using HTTP cookie credentials
      const profile = await apiRequest<UserProfile>({
        method: 'GET',
        path: '/profile/me',
      });

      await setStorage('userProfile', profile);
      if (profile.email) await setStorage('currentUserEmail', profile.email);
      set({ user: profile, isAuthenticated: true, error: null });

      // Clear cached history/enhancements so user sees fresh data
      historyCache.clear();
      enhanceCache.clear();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ error: message, isAuthenticated: false });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  register: async (email: string, password: string, fullName: string) => {
    set({ loading: true, error: null });
    try {
      await apiRequest({
        method: 'POST',
        path: '/auth/register',
        body: {
          email,
          password,
          display_name: fullName || null,
        },
      });

      // Auto login after registration to set HTTP cookie session
      await get().login(email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  loginWithGoogle: async (idToken: string) => {
    set({ loading: true, error: null });
    try {
      const response = await apiRequest<{ access_token?: string }>({
        method: 'POST',
        path: '/auth/google',
        body: { id_token: idToken },
      });

      const cookieToken = await getAuthCookie();
      const accessToken = response.access_token || cookieToken || '';

      if (accessToken) {
        await setAuthCookie(accessToken);
        await setStorage('promptiq_token', accessToken);
        await setStorage('apiToken', accessToken);
        set({ token: accessToken });
      }

      const profile = await apiRequest<UserProfile>({
        method: 'GET',
        path: '/profile/me',
      });

      await setStorage('userProfile', profile);
      if (profile.email) await setStorage('currentUserEmail', profile.email);
      set({ user: profile, isAuthenticated: true, error: null });

      historyCache.clear();
      enhanceCache.clear();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google authentication failed';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  sendPasswordResetOtp: async (email: string) => {
    await apiRequest({
      method: 'POST',
      path: '/auth/forgot-password',
      body: { email },
    });
  },

  verifyPasswordResetOtp: async (email: string, otp: string): Promise<string> => {
    const response = await apiRequest<{ reset_token: string }>({
      method: 'POST',
      path: '/auth/verify-reset-otp',
      body: { email, otp },
    });
    return response.reset_token;
  },

  resetPassword: async (resetToken: string, newPassword: string) => {
    await apiRequest({
      method: 'POST',
      path: '/auth/reset-password',
      body: {
        reset_token: resetToken,
        new_password: newPassword,
      },
    });
  },

  logout: async () => {
    set({ loading: true });
    try {
      await apiRequest({
        method: 'POST',
        path: '/auth/logout',
      });
    } catch (err) {
      console.warn('[AURE] Logout API failed:', err);
    } finally {
      await removeAuthCookie();
      await removeStorage('userProfile');
      await removeStorage('currentUserEmail');
      await removeStorage('promptiq_token');
      await removeStorage('apiToken');
      historyCache.clear();
      enhanceCache.clear();
      set({ user: null, token: null, isAuthenticated: false, loading: false, error: null });
    }
  },
}));

// Listen for storage changes across extension views (SidePanel, Options, Popup, Content Scripts)
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (
        changes['userProfile'] ||
        changes['promptiq_token'] ||
        changes['apiToken'] ||
        changes['currentUserEmail']
      ) {
        useAuthStore.getState().loadAuth();
      }
    }
  });
}
