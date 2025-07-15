
"use client";

import { useState, useEffect } from 'react';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
const AUTH_KEY = 'icevision-remote-auth-key';

export function useAuth() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const password = localStorage.getItem(AUTH_KEY);
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        const data = await res.json();
        
        if (data.authenticated) {
            setAuthStatus('authenticated');
        } else {
            localStorage.removeItem(AUTH_KEY);
            setAuthStatus('unauthenticated');
        }
      } catch (e) {
        console.error("Auth check failed", e);
        setAuthStatus('unauthenticated');
      }
    };

    checkAuth();
  }, []);

  return { authStatus };
}
