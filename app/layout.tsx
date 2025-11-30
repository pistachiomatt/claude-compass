import type { Metadata } from "next"
import { PageLayout } from "./ClientLayout"
import { workSans, sourceCodePro, anthropicSerif } from "@/lib/fonts"

export const metadata: Metadata = {
  title: "Compass",
  description: "Chat + Whiteboard",
}

type Props = {
  children: React.ReactNode
}

export default function RootLayout({ children }: Props) {
  return (
    <html
      lang="en"
      className={`${workSans.variable} ${sourceCodePro.variable} ${anthropicSerif.variable}`}
    >
      <body className="font-sans tracking-tight-sans">
        <PageLayout>{children}</PageLayout>
      </body>
    </html>
  )
}
