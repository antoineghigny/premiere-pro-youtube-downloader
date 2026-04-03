import { useCallback, useEffect, useState } from 'react';

import { getSettings, saveSettings } from '../api/client';
import { DEFAULT_DESKTOP_SETTINGS, type DesktopSettings } from '../api/types';

export function useSettings() {
  const [settings, setSettings] = useState<DesktopSettings>(DEFAULT_DESKTOP_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const nextSettings = await getSettings();
        if (isMounted) {
          setSettings(nextSettings);
        }
      } catch (error) {
        console.error('[YT2PP] Could not load settings:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistSettings = useCallback(async (nextSettings: DesktopSettings) => {
    const savedSettings = await saveSettings(nextSettings);
    setSettings(savedSettings);
    return savedSettings;
  }, []);

  return {
    settings,
    setSettings,
    persistSettings,
    loading,
  };
}
