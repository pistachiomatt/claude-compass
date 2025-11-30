import { Work_Sans, Source_Code_Pro } from "next/font/google"
import localFont from "next/font/local"

/**
 * Work Sans - Primary sans-serif font
 * Used for body text, UI elements, and general content
 */
export const workSans = Work_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-work-sans",
})

/**
 * Source Code Pro - Monospace font
 * Used for code blocks, inline code, and technical content
 */
export const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-code-pro",
})

/**
 * Anthropic Serif - Display/heading font
 * Used for Claude's text responses (signature look)
 */
export const anthropicSerif = localFont({
  src: [
    {
      path: "../public/fonts/anthropic-serif.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/anthropic-serif.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/anthropic-serif-italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--font-anthropic-serif",
})
