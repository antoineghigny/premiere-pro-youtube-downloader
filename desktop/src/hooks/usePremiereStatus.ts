import { useEffect, useState } from 'react';

import { getPremiereStatus } from '../api/client';

export function usePremiereStatus() {
  const [running, setRunning] = useState(false);
  const [cepRegistered, setCepRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      try {
        const response = await getPremiereStatus();
        if (isMounted) {
          setRunning(Boolean(response.running));
          setCepRegistered(Boolean(response.cepRegistered));
        }
      } catch {
        if (isMounted) {
          setRunning(false);
          setCepRegistered(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 4000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return {
    running,
    cepRegistered,
    loading,
  };
}
