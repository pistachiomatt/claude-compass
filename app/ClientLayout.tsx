"use client"

import "@/styles/global.css"
import { trpc } from "@/lib/trpc/client"
import { TooltipProvider } from "@/components/ui/tooltip"
import { FC } from "react"

type Props = {
  children: React.ReactNode
}

const _PageLayout: FC<Props> = ({ children }) => {
  return <TooltipProvider>{children}</TooltipProvider>
}

export const PageLayout = trpc.withTRPC(_PageLayout) as React.FC<Props>
