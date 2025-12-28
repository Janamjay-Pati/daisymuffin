import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      'https://sxqfecnxbpnitbuyyuov.supabase.co',
      'sb_publishable_weO-WfYKkZqLY1QYjoTayQ_hIsoenYJ'
    );
  }

  get client() {
    return this.supabase;
  }

  // Listen to auth changes
  onAuthChange(callback: (user: any) => void) {
    this.supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
  }

  async getSession() {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.user ?? null;
  }

  async signInWithGoogle() {
    const redirectUrl =
      window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://daisymuffin.vercel.app';

    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl }
    });

    if (error) console.error('Google login error:', error);
  }

  async logout(): Promise<void> {
    await this.client.auth.signOut();
  }

  async isUserAllowed(): Promise<boolean> {
    const { data, error } = await this.client
      .from('allowed_users')
      .select('email')
      .limit(1)
      .maybeSingle();

    return !!data;
  }
}