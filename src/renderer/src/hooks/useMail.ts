import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MailSnapshot } from '@shared/types'
import { api } from '@/lib/bridge'
import { queryKeys } from '@/lib/queryClient'

const PLACEHOLDER: MailSnapshot = {
  status: 'loading',
  email: null,
  unreadCount: 0,
  lastUpdatedAt: null,
  error: null,
  isFetching: true,
  account: null
}

export interface UseMailResult {
  snapshot: MailSnapshot
  isLoading: boolean
  refresh: () => void
  markRead: (messageId: string) => void
  openMessage: (messageId: string) => void
  openInbox: () => void
  isRefreshing: boolean
  isMarkingRead: boolean
}

/**
 * React Query mirrors the main process' mail snapshot. The query itself only
 * ever runs once — every later change arrives through the `mail:updated`
 * broadcast and is written straight into the cache.
 */
export function useMail(): UseMailResult {
  const queryClient = useQueryClient()

  const { data, isPending } = useQuery({
    queryKey: queryKeys.mailSnapshot,
    queryFn: () => api.mail.getSnapshot()
  })

  useEffect(() => {
    return api.mail.onUpdate((snapshot) => {
      queryClient.setQueryData(queryKeys.mailSnapshot, snapshot)
    })
  }, [queryClient])

  const refreshMutation = useMutation({
    mutationFn: () => api.mail.refresh(),
    onSuccess: (snapshot) => queryClient.setQueryData(queryKeys.mailSnapshot, snapshot)
  })

  const markReadMutation = useMutation({
    mutationFn: (messageId: string) => api.mail.markRead(messageId),
    onSuccess: (snapshot) => queryClient.setQueryData(queryKeys.mailSnapshot, snapshot)
  })

  return {
    snapshot: data ?? PLACEHOLDER,
    isLoading: isPending,
    isRefreshing: refreshMutation.isPending,
    isMarkingRead: markReadMutation.isPending,
    refresh: () => refreshMutation.mutate(),
    markRead: (messageId: string) => markReadMutation.mutate(messageId),
    openMessage: (messageId: string) => {
      void api.mail.openMessage(messageId)
    },
    openInbox: () => {
      void api.mail.openInbox()
    }
  }
}
