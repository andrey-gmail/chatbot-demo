import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@/types/database';
import type { AuthResponse } from '@/types/api';

const GENERIC_CREDENTIALS_ERROR = 'Invalid email or password';

export async function signUp(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<AuthResponse> {
  // Create user in Supabase Auth
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) {
    throw new Error(authError.message);
  }

  // Insert into public.users table
  const { error: insertError } = await supabase.from('users').insert({
    id: authData.user.id,
    email: authData.user.email,
  });

  if (insertError) {
    // Attempt cleanup if public.users insert fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error('Failed to create user record');
  }

  // Sign in to get a session (admin.createUser doesn't return a session)
  const { data: sessionData, error: sessionError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (sessionError || !sessionData.session) {
    throw new Error('Account created but failed to establish session');
  }

  const user: User = {
    id: authData.user.id,
    email: email,
    created_at: authData.user.created_at,
    updated_at: authData.user.created_at,
  };

  return {
    user,
    session: {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    },
  };
}

export async function signIn(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    // Use generic message to avoid leaking whether email exists
    throw new Error(GENERIC_CREDENTIALS_ERROR);
  }

  const user: User = {
    id: data.user.id,
    email: data.user.email ?? email,
    created_at: data.user.created_at,
    updated_at: data.user.updated_at ?? data.user.created_at,
  };

  return {
    user,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  };
}

export async function signOut(
  _supabase: SupabaseClient,
  _token: string
): Promise<void> {
  // Session invalidation is handled by clearing httpOnly cookies
  // on the response side. No server-side Supabase call needed
  // since we don't use Supabase client-side sessions.
}

export async function getUser(
  supabase: SupabaseClient,
  token: string
): Promise<User> {
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error('Invalid or expired token');
  }

  // Fetch from public.users for consistent data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (userError || !userData) {
    // Fallback to auth data if public.users record not found
    return {
      id: data.user.id,
      email: data.user.email ?? '',
      created_at: data.user.created_at,
      updated_at: data.user.updated_at ?? data.user.created_at,
    };
  }

  return userData as User;
}

export async function refreshSession(
  supabase: SupabaseClient,
  refreshToken: string
): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session || !data.user) {
    throw new Error('Failed to refresh session');
  }

  const user: User = {
    id: data.user.id,
    email: data.user.email ?? '',
    created_at: data.user.created_at,
    updated_at: data.user.updated_at ?? data.user.created_at,
  };

  return {
    user,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  };
}

export async function migrateAnonymousChats(
  supabase: SupabaseClient,
  userId: string,
  anonymousSessionId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('chats')
    .update({ user_id: userId, anonymous_session_id: null })
    .eq('anonymous_session_id', anonymousSessionId)
    .select('id');

  if (error) {
    throw new Error('Failed to migrate anonymous chats');
  }

  return data?.length ?? 0;
}
