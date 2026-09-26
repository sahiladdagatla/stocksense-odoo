import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStore } from '@/lib/api';

const SOCKET_URL = (import.meta.env.VITE_API_URL as string | undefined) || undefined;

/**
 * Subscribes to server push events and refreshes cached data. Any validated operation or
 * adjustment (`stock:updated`) or document change (`operation:changed`) invalidates queries,
 * so every open screen shows current stock without a manual reload.
 */
export function useLiveUpdates(enabled: boolean) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = tokenStore.get();
    if (!enabled || !token) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    const refresh = () =>
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('stock:updated', refresh);
    socket.on('operation:changed', refresh);
    return () => {
      socket.close();
      setConnected(false);
    };
  }, [enabled, queryClient]);

  return connected;
}
