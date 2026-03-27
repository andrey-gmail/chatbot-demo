'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MAX_ANONYMOUS_QUESTIONS } from '@/lib/constants';

const ANON_KEY = 'anon_session';

export interface AnonymousSession {
  id: string;
  questionCount: number;
}

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__ls_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Hook for managing anonymous sessions.
 * Tracks question count in localStorage with in-memory fallback.
 * Sets a cookie so API routes can identify the anonymous session.
 */
export function useAnonymous() {
  const hasLocalStorage = useRef(isLocalStorageAvailable());
  const inMemorySession = useRef<AnonymousSession | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(0);

  const getSession = useCallback((): AnonymousSession => {
    // First, try to read from localStorage
    if (hasLocalStorage.current) {
      try {
        const raw = localStorage.getItem(ANON_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as AnonymousSession;
          if (parsed.id && typeof parsed.questionCount === 'number') {
            return parsed;
          }
        }
      } catch {
        // Corrupted data — fall through
      }
    }

    // If no localStorage session, try to read the existing cookie
    // (set by middleware) so we use the same ID
    let existingCookieId: string | undefined;
    try {
      const match = document.cookie.match(/(?:^|;\s*)anonymous_session=([^;]*)/);
      if (match?.[1]) {
        existingCookieId = match[1];
      }
    } catch {
      // Ignore cookie read errors
    }

    const session: AnonymousSession = {
      id: existingCookieId || generateId(),
      questionCount: 0,
    };

    if (hasLocalStorage.current) {
      try {
        localStorage.setItem(ANON_KEY, JSON.stringify(session));
      } catch {
        inMemorySession.current = session;
      }
    } else {
      inMemorySession.current = session;
    }

    return session;
  }, []);

  const syncCookie = useCallback((session: AnonymousSession) => {
    // Set cookie so API routes can read the anonymous session ID
    document.cookie = `anonymous_session=${session.id}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  }, []);

  // Initialize state and cookie on mount
  useEffect(() => {
    const session = getSession();
    setQuestionCount(session.questionCount);
    syncCookie(session);
  }, [getSession, syncCookie]);

  const incrementCount = useCallback((): number => {
    const session = getSession();
    session.questionCount += 1;

    if (hasLocalStorage.current) {
      try {
        localStorage.setItem(ANON_KEY, JSON.stringify(session));
      } catch {
        // Storage full — continue with in-memory
        inMemorySession.current = session;
      }
    } else {
      inMemorySession.current = session;
    }

    setQuestionCount(session.questionCount);
    return session.questionCount;
  }, [getSession]);

  const canAsk = useCallback((): boolean => {
    const session = getSession();
    return session.questionCount < MAX_ANONYMOUS_QUESTIONS;
  }, [getSession]);

  const clearSession = useCallback(() => {
    if (hasLocalStorage.current) {
      try {
        localStorage.removeItem(ANON_KEY);
      } catch {
        // Ignore
      }
    }
    inMemorySession.current = null;
    // Clear the cookie
    document.cookie = 'anonymous_session=; path=/; max-age=0; SameSite=Lax';
    setQuestionCount(0);
  }, []);

  return {
    getSession,
    incrementCount,
    canAsk,
    clearSession,
    questionCount,
    maxQuestions: MAX_ANONYMOUS_QUESTIONS,
  };
}
