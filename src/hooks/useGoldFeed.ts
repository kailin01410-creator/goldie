import { useState, useEffect, useRef } from 'react';
import { GoldTick } from '../types';

export function useGoldFeed(intervalMs = 1200) {
  const [tick, setTick] = useState<GoldTick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;

    async function pull() {
      try {
        abortRef.current?.abort();

        const controller = new AbortController();
        abortRef.current = controller;

        const res = await fetch('/api/gold-signal', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as GoldTick;

        if (alive) {
          setTick(data);
          setError(null);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError' && alive) {
          setError(err?.message ?? 'Feed error');
        }
      }
    }

    pull();
    const id = setInterval(pull, intervalMs);

    return () => {
      alive = false;
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [intervalMs]);

  return { tick, error };
}
