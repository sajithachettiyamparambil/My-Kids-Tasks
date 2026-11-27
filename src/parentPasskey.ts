import { supabase } from './supabase';

export const PARENT_PASSKEY_KEYS = {
  email: 'kids-parent-passkey-email',
  pending: 'kids-parent-passkey-setup-pending',
  ready: 'kids-parent-passkey-registered',
};

export const parentPasskey = {
  sendSetupLink(email: string) {
    return supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: false,
      },
    });
  },

  getSession() {
    return supabase.auth.getSession();
  },

  register() {
    return supabase.auth.registerPasskey();
  },

  signIn() {
    return supabase.auth.signInWithPasskey();
  },

  signOut() {
    return supabase.auth.signOut();
  },
};