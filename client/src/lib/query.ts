import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry client errors (validation, 403, 404); retry network/server errors once.
      retry: (count, err) =>
        !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
