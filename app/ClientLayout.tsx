"use client"

import { trpc } from "@/lib/trpc/client"
import { FC } from "react"

type Props = {
  children: React.ReactNode
}

const _PageLayout: FC<Props> = ({ children }) => {
  return <>{children}</>
}

export const PageLayout = trpc.withTRPC(_PageLayout) as React.FC<Props>