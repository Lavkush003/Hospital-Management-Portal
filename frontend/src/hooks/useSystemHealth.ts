import { useCallback, useEffect, useState } from 'react';
import { fetchSystemHealth } from '@/services/health.service';
import type { HealthResponse } from '@/types/health';

export type SystemHealthState =
  | { status: 'loading' }
  | { status: 'online'; data: HealthResponse; checkedAt: string }
  | { status: 'offline'; message: string; checkedAt: string };

async function requestSystemHealth(signal?: AbortSignal): Promise<SystemHealthState> {
  try {
    const data = await fetchSystemHealth(signal);

    return {
      status: 'online',
      data,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'offline',
      message: error instanceof Error ? error.message : 'The API could not be reached',
      checkedAt: new Date().toISOString(),
    };
  }
}

export function useSystemHealth(): {
  state: SystemHealthState;
  refresh: () => void;
} {
  const [state, setState] = useState<SystemHealthState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    void requestSystemHealth(controller.signal).then((nextState) => {
      if (!controller.signal.aborted) {
        setState(nextState);
      }
    });

    return () => {
      controller.abort();
    };
  }, []);

  const refresh = useCallback((): void => {
    setState({ status: 'loading' });

    void requestSystemHealth().then((nextState) => {
      setState(nextState);
    });
  }, []);

  return { state, refresh };
}
