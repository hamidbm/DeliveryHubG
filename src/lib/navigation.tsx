'use client';

import React, { createContext, useContext } from 'react';

type NavigationContextValue = {
  push: (url: string) => void;
  searchParams: URLSearchParams;
  currentPath: string;
  pathname: string;
};

export const NavigationContext = createContext<NavigationContextValue>({
  push: () => {},
  searchParams: new URLSearchParams(),
  currentPath: '/',
  pathname: '/',
});

export function useRouter() {
  const ctx = useContext(NavigationContext);
  return {
    push: ctx.push,
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
  };
}

export function useSearchParams() {
  return useContext(NavigationContext).searchParams;
}

export function usePathname() {
  return useContext(NavigationContext).pathname;
}
