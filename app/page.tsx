"use client"

import { useCreateChat } from "@/hooks/useCreateChat"

export default function HomePage() {
  const { isPending } = useCreateChat()

  return (
    <div>
      <p>{isPending ? "Creating chat..." : "Redirecting..."}</p>
    </div>
  )
}
