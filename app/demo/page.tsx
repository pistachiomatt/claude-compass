"use client"

import { DemoChatContainer } from "@/components/demo/DemoChatContainer"

export default function DemoPage() {
  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-medium">Demo page</h1>
          <p className="text-xs text-muted-foreground">Manual stream control</p>
        </div>
      </header>

      <DemoChatContainer />
    </div>
  )
}
