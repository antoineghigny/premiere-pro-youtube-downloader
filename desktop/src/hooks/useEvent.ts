import { useCallback, useInsertionEffect, useRef } from 'react';

/**
 * A stable version of the experimental useEffectEvent.
 * It allows you to create a function that has access to the latest state/props
 * without needing to be included in dependency arrays.
 */
export function useEvent<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef<T>(fn);

  useInsertionEffect(() => {
    ref.current = fn;
  }, [fn]);

  return useCallback((...args: any[]) => {
    const latestFn = ref.current;
    return latestFn(...args);
  }, []) as T;
}
