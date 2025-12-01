import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { useEffect, useRef } from "react"

interface UseCreateChatOptions {
  autoCreate?: boolean
}

export function useCreateChat({ autoCreate = false }: UseCreateChatOptions = {}) {
  const router = useRouter()
  const hasCreated = useRef(false)

  const { mutate: createChat, isPending } = trpc.chat.create.useMutation({
    onSuccess: chat => {
      router.push(`/chats/${chat.id}`)
    },
  })

  useEffect(() => {
    if (autoCreate && !hasCreated.current) {
      hasCreated.current = true
      createChat()
    }
  }, [autoCreate, createChat])

  return { createChat, isPending }
}
