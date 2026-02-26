'use client';

let patched = false;

export const ensureSafeStylesheetAccess = () => {
  if (patched) return;
  if (typeof CSSStyleSheet === 'undefined') return;
  const proto = CSSStyleSheet.prototype as any;
  const desc = Object.getOwnPropertyDescriptor(proto, 'cssRules');
  if (!desc || typeof desc.get !== 'function') return;
  const originalGet = desc.get;
  Object.defineProperty(proto, 'cssRules', {
    get() {
      try {
        return originalGet.call(this);
      } catch {
        return [];
      }
    }
  });
  patched = true;
};
