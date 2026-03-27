'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { queryKeys } from '@/lib/query-keys';
import type { User } from '@/types/database';
import type { ApiError } from '@/types/api';

interface AuthMeResponse {
  user: User;
}

async function fetchMe(): Promise<User> {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Not authenticated');
  }
  const data: AuthMeResponse = await res.json();
  return data.user;
}

async function loginFn(payload: { email: string; password: string }): Promise<User> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw new Error(err.error.message);
  }
  const data: AuthMeResponse = await res.json();
  return data.user;
}

async function signupFn(payload: { email: string; password: string }): Promise<User> {
  // Read anonymous session ID from localStorage to migrate chats on signup
  let anonymousSessionId: string | undefined;
  try {
    const raw = localStorage.getItem('anon_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) {
        anonymousSessionId = parsed.id;
      }
    }
  } catch {
    // Ignore localStorage errors
  }

  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ...payload, anonymousSessionId }),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw new Error(err.error.message);
  }
  const data: AuthMeResponse = await res.json();

  // Clear anonymous session from localStorage after successful signup
  try {
    localStorage.removeItem('anon_session');
  } catch {
    // Ignore
  }

  return data.user;
}

async function logoutFn(): Promise<void> {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw new Error(err.error.message);
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: loginFn,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.me, user);
      router.push('/');
    },
  });

  const signupMutation = useMutation({
    mutationFn: signupFn,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.me, user);
      router.push('/');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutFn,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.auth.me, null);
      queryClient.clear();
      router.push('/login');
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    error,
    login: loginMutation,
    signup: signupMutation,
    logout: logoutMutation,
  };
}
