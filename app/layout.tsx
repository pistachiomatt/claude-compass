import type { Metadata } from "next"
import { PageLayout } from "./ClientLayout"

export const metadata: Metadata = {
  title: "Compass",
  description: "Chat + Whiteboard",
}

type Props = {
  children: React.ReactNode
}

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en">
      <body>
        <PageLayout>{children}</PageLayout>
      </body>
    </html>
  )
}