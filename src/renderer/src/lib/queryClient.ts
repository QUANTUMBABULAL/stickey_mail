import { QueryClient } from '@tanstack/react-query'

export const queryKeys = {
  mailSnapshot: ['mail', 'snapshot'] as const,
  appInfo: ['app', 'info'] as const
}

/**
 * The main process pushes every change over IPC, so queries never need to poll
 * or refetch on focus — they are seeded once and then kept fresh by events.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
        retryDelay: 800
      },
      mutations: {
        retry: 0
      }
    }
  })
}
