// ──────────────────────────────────────────────────────────────
// Auth Store — Zustand + JWT Bearer & chrome.storage.local
// ──────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { apiRequest, ApiError } from '@/api/client';
import { getStorage, setStorage, removeStorage, UserProfile } from '@/lib/storage';
import { getAuthCookie, setAuthCookie, removeAuthCookie } from '@/lib/cookies';
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
      const storedToken = (await getStorage('promptiq_token')) || (await getStorage('apiToken'));
      const cookieToken = await getAuthCookie();
      const token = (storedToken && storedToken.trim()) || (cookieToken && cookieToken.trim()) || null;
      const cachedProfile = await getStorage('userProfile');

      // Pre-set cached identity for instant UI render while backend session is validated
      if (token && cachedProfile) {
        set({ token, user: cachedProfile, isAuthenticated: true });
      } else if (cachedProfile) {
        set({ token: null, user: cachedProfile, isAuthenticated: true });
      } else {
        set({ token: null, user: null, isAuthenticated: false });
      }

      // If we have a token or cookie, validate with GET /profile/me
      if (token) {
        try {
          const profile = await apiRequest<UserProfile>({
            method: 'GET',
            path: '/profile/me',
          });
          set({ user: profile, token, isAuthenticated: true, error: null });
          await setStorage('userProfile', profile);
          if (profile.email) await setStorage('currentUserEmail', profile.email);
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            await removeStorage('userProfile');
            await removeStorage('currentUserEmail');
            await removeStorage('promptiq_token');
            await removeStorage('apiToken');
            await removeAuthCookie();
            set({ user: null, token: null, isAuthenticated: false });
          } else if (cachedProfile) {
            // Retain authenticated status with cached profile if network error or temporary disruption
            set({ user: cachedProfile, token, isAuthenticated: true });
          }
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
      formData.append('username', email.trim());
      formData.append('password', password);

      const response = await apiRequest<{ access_token?: string; token_type?: string; user_id?: string }>({
        method: 'POST',
        path: '/auth/login',
        body: formData,
      });

      if (!response?.access_token) {
        throw new Error('Invalid response from authentication server');
      }

      const accessToken = response.access_token;
      await setStorage('promptiq_token', accessToken);
      await setStorage('apiToken', accessToken);
      await setAuthCookie(accessToken);
      set({ token: accessToken });

      // Fetch user profile using bearer token
      const profile = await apiRequest<UserProfile>({
        method: 'GET',
        path: '/profile/me',
      });

      await setStorage('userProfile', profile);
      if (profile.email) await setStorage('currentUserEmail', profile.email);
      set({ user: profile, token: accessToken, isAuthenticated: true, error: null });

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
          email: email.trim(),
          password,
          display_name: fullName.trim() || null,
        },
      });

      // Auto login after registration
      await get().login(email.trim(), password);
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
      const response = await apiRequest<{ access_token?: string; token_type?: string; user_id?: string }>({
        method: 'POST',
        path: '/auth/google',
        body: { id_token: idToken },
      });

      if (!response?.access_token) {
        throw new Error('Invalid response from Google authentication');
      }

      const accessToken = response.access_token;
      await setStorage('promptiq_token', accessToken);
      await setStorage('apiToken', accessToken);
      await setAuthCookie(accessToken);
      set({ token: accessToken });

      const profile = await apiRequest<UserProfile>({
        method: 'GET',
        path: '/profile/me',
      });

      await setStorage('userProfile', profile);
      if (profile.email) await setStorage('currentUserEmail', profile.email);
      set({ user: profile, token: accessToken, isAuthenticated: true, error: null });

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
      body: { email: email.trim() },
    });
  },

  verifyPasswordResetOtp: async (email: string, otp: string): Promise<string> => {
    const response = await apiRequest<{ reset_token: string }>({
      method: 'POST',
      path: '/auth/verify-reset-otp',
      body: { email: email.trim(), otp: otp.trim() },
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
      // Backend auth is stateless JWT, ignore if /auth/logout endpoint returns 404/405
    } finally {
      await removeStorage('userProfile');
      await removeStorage('currentUserEmail');
      await removeStorage('promptiq_token');
      await removeStorage('apiToken');
      await removeAuthCookie();
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
        changes['currentUserEmail'] ||
        changes['promptiq_token'] ||
        changes['apiToken']
      ) {
        useAuthStore.getState().loadAuth();
      }
    }
  });
}
