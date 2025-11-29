import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { useEffect, useRef } from "react"

export function useCreateChat() {
  const router = useRouter()
  const hasCreated = useRef(false)

  const { mutate: createChat, isPending } = trpc.chat.create.useMutation({
    onSuccess: chat => {
      router.push(`/chats/${chat.id}`)
    },
  })

  useEffect(() => {
    if (!hasCreated.current) {
      hasCreated.current = true
      createChat()
    }
  }, [createChat])

  return { isPending }
}
