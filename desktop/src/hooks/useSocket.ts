import { useEffect, useEffectEvent } from 'react';

import { socketClient } from '../api/socket';
import type { SocketEvent } from '../api/types';

export function useSocket(onMessage: (message: SocketEvent) => void) {
  const handleMessage = useEffectEvent(onMessage);

  useEffect(() => {
    return socketClient.addListener((message) => {
      handleMessage(message);
    });
  }, [handleMessage]);

  return socketClient;
}
