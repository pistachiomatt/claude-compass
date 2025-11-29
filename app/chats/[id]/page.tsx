"use client"

import { useParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const { data: chat, isLoading } = trpc.chat.getById.useQuery(id)

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!chat) {
    return <div>Chat not found</div>
  }

  return (
    <div>
      <h1>Chat: {chat.id}</h1>
      <p>Name: {chat.name}</p>
      <p>Created: {chat.createdAt.toLocaleString()}</p>
    </div>
  )
}
