import { trpc } from "@/lib/trpc/client"

/**
 * Hook for updating whiteboard.yml in a chat's virtual filesystem
 * Used when user drags/drops items on the whiteboard
 */
export function useUpdateWhiteboard(chatId: string) {
  const utils = trpc.useUtils()

  const mutation = trpc.chat.updateWhiteboard.useMutation({
    onSuccess: () => {
      utils.chat.getById.invalidate(chatId)
    },
  })

  return {
    updateWhiteboard: (content: string) => {
      mutation.mutate({ chatId, content })
    },
    isUpdating: mutation.isPending,
  }
}
