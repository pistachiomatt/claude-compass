"use client"

import { useRouter } from "next/navigation"
import { Compass, FlaskConical, Plus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc/client"

export function ChatHeader() {
  const router = useRouter()

  const { mutate: createChat, isPending } = trpc.chat.create.useMutation({
    onSuccess: chat => {
      router.push(`/chats/${chat.id}`)
    },
  })

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-2">
        <Compass className="w-6 h-6 text-foreground" />
        <span className="font-semibold text-lg">Compass</span>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" disabled>
          <FlaskConical className="w-4 h-4 mr-2" />
          Research
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => createChat()}
          disabled={isPending}
          className="h-8 w-8"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">U</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
