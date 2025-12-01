"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { Compass, BookOpenText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc/client"

interface DualAvatarProps {
  onClick?: () => void
}

function DualAvatar({ onClick }: DualAvatarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex items-center cursor-pointer hover:opacity-80 transition-opacity"
    >
      {/* Matt's avatar - left side */}
      <div className="h-8 w-8 rounded-full overflow-hidden">
        <Image
          src="/matt-profile.jpg"
          alt="Matt"
          width={32}
          height={32}
          className="h-full w-full object-cover"
        />
      </div>
      {/* Claude's avatar - right side, no gap */}
      <div className="h-8 w-8 rounded-full overflow-hidden -ml-0">
        <Image
          src="/claude-logo.webp"
          alt="Claude"
          width={32}
          height={32}
          className="h-full w-full object-cover"
        />
      </div>
      {/* Ampersand connector circle in foreground */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-foreground border border-border flex items-center justify-center">
        <span className="text-xs font-medium text-background">&</span>
      </div>
    </button>
  )
}

interface ChatHeaderProps {
  onAvatarClick?: () => void
}

export function ChatHeader({ onAvatarClick }: ChatHeaderProps) {
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
        <span className="font-semibold text-lg tracking-tight">Compass</span>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => createChat()}
          disabled={isPending}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          New chat
        </Button>
        <Button variant="outline" size="sm">
          <BookOpenText className="w-4 h-4" />
          Research
        </Button>
        <DualAvatar onClick={onAvatarClick} />
      </div>
    </header>
  )
}
