import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

export interface GalleryAuthClient {
  getSession(): Promise<Session | null>;
  onSessionChange(callback: (session: Session | null) => void): () => void;
  signIn(email: string, password: string): Promise<{ error: string | null }>;
  signUp(email: string, password: string, nickname: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
}

export function createGalleryAuthClient(supabaseUrl: string | null, publishableKey: string | null): GalleryAuthClient | null {
  if (!supabaseUrl || !publishableKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, publishableKey);
  return new SupabaseGalleryAuthClient(supabase);
}

class SupabaseGalleryAuthClient implements GalleryAuthClient {
  constructor(private readonly supabase: SupabaseClient) {}

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) {
      return null;
    }
    return data.session;
  }

  onSessionChange(callback: (session: Session | null) => void): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async signUp(email: string, password: string, nickname: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nickname: nickname.trim(),
        },
      },
    });
    return { error: error?.message ?? null };
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }
}
