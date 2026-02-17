"use client";
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

function getSessionId() {
  try {
    const key = 'tracking_session_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = (globalThis.crypto && (globalThis.crypto as any).randomUUID ? (globalThis.crypto as any).randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(key, id);
    }
    return id;
  } catch (e) {
    return undefined;
  }
}

export function sendEvent(event_type: string, extra: Record<string, any> = {}) {
  const session_id = getSessionId();
  const payload = {
    event_type,
    session_id,
    path: window.location.pathname,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent,
    ...extra,
  };
  // fire-and-forget
  fetch('/api/track', { method: 'POST', body: JSON.stringify(payload), headers: { 'content-type': 'application/json' } }).catch(() => {});
}

export default function useTracking() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    // send page_view on initial load and on pathname change
    if (!pathname) return;
    // on navigation
    if (first.current) {
      // initial load
      sendEvent('page_view');
      first.current = false;
      return;
    }
    sendEvent('page_view');
  }, [pathname]);
}

// convenience helpers
export function trackQuoteStarted() { sendEvent('quote_started'); }
export function trackCheckoutStarted() { sendEvent('checkout_started'); }
export function trackQuoteSubmitted(details: Record<string, any> = {}) { sendEvent('quote_submitted', details); }
