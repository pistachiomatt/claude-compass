"use client"

import { AnimatedMarkdown } from "flowtoken"
import "flowtoken/dist/styles.css"
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog"

interface MindDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string
}

export function MindDialog({ open, onOpenChange, content }: MindDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto font-serif">
        <DialogHeader></DialogHeader>
        <div className="aui-md">
          <AnimatedMarkdown content={content} animation={null} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
