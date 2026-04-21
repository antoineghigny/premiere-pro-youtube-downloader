import { useEffect } from 'react';

import { socketClient } from '../api/socket';
import type { SocketEvent } from '../api/types';
import { useEvent } from './useEvent';

export function useSocket(onMessage: (message: SocketEvent) => void) {
  const handleMessage = useEvent(onMessage);

  useEffect(() => {
    return socketClient.addListener((message) => {
      handleMessage(message);
    });
  }, [handleMessage]);

  return socketClient;
}
