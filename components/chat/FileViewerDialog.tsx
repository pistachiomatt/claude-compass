"use client"

import { AnimatedMarkdown } from "flowtoken"
import "flowtoken/dist/styles.css"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface FileViewerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
  content: string
}

export function FileViewerDialog({ open, onOpenChange, fileName, content }: FileViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto font-serif">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-normal text-muted-foreground">
            {fileName}
          </DialogTitle>
        </DialogHeader>
        <div className="aui-md">
          <AnimatedMarkdown content={content} animation={null} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
