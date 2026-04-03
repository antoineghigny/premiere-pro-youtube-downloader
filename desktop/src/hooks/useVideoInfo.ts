import { useEffect, useState } from 'react';

import { getVideoInfo } from '../api/client';
import type { VideoInfo } from '../api/types';
import { isLikelyRemoteUrl } from '../utils/validation';

export function useVideoInfo(videoUrl: string) {
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const normalizedUrl = videoUrl.trim();
    if (!normalizedUrl || !isLikelyRemoteUrl(normalizedUrl)) {
      setInfo(null);
      setError('');
      setLoading(false);
      return;
    }

    let isMounted = true;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError('');
        try {
          const nextInfo = await getVideoInfo(normalizedUrl);
          if (isMounted) {
            setInfo(nextInfo);
          }
        } catch (requestError) {
          if (isMounted) {
            setInfo(null);
            setError(requestError instanceof Error ? requestError.message : 'Could not fetch video info');
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      })();
    }, 350);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [videoUrl]);

  return {
    info,
    loading,
    error,
  };
}
