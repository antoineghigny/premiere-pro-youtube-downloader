import { useEffect, useState } from 'react';

import { getPremiereStatus } from '../api/client';
import type { PremiereStatusResponse } from '../api/types';

export function usePremiereStatus() {
  const [status, setStatus] = useState<PremiereStatusResponse>({
    running: false,
    cepRegistered: false,
    projectOpen: false,
    projectSaved: false,
    projectName: undefined,
    projectPath: undefined,
    projectFolder: undefined,
    canImport: false,
    reason: 'Premiere is not running',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      try {
        const response = await getPremiereStatus();
        if (isMounted) {
          setStatus(response);
        }
      } catch {
        if (isMounted) {
          setStatus({
            running: false,
            cepRegistered: false,
            projectOpen: false,
            projectSaved: false,
            projectName: undefined,
            projectPath: undefined,
            projectFolder: undefined,
            canImport: false,
            reason: 'Premiere is not running',
          });
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
    ...status,
    loading,
  };
}
