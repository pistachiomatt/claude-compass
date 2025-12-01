"use client"

import { Button } from "@/components/ui/button"
import { useCreateChat } from "@/hooks/useCreateChat"

export default function HomePage() {
  const { createChat, isPending } = useCreateChat()

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Video Section */}
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="relative w-full max-w-8xl aspect-video">
          <div className="absolute inset-0 rounded-lg shadow-[inset_0_0_5px_5px_black] pointer-events-none z-10" />
          <iframe
            className="w-full h-full rounded-lg"
            src="https://www.youtube.com/embed/0DbGOMTIZns?rel=0&modestbranding=1"
            title="YouTube video"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>

      {/* Sticky Footer */}
      <footer className="sticky bottom-0 bg-black border-t border-zinc-900 p-4">
        <div className="flex justify-end gap-3">
          <Button
            onClick={() => createChat()}
            disabled={isPending}
            className="bg-zinc-700 text-white hover:bg-zinc-600"
          >
            {isPending ? "Creating..." : "Try Compass yourself!"}
          </Button>
          <Button asChild className="bg-white text-black hover:bg-zinc-200">
            <a href="mailto:pistachiomatt@gmail.com">Hire Matt ;)</a>
          </Button>
        </div>
      </footer>
    </div>
  )
}
