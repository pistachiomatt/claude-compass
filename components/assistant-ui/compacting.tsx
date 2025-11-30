"use client";

import { type FC } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Compacting indicator shown when the SDK is summarizing conversation context.
 * Uses the same muted styling as the Reasoning component.
 */
export const Compacting: FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        "aui-compacting-root mb-4 flex items-center gap-2 py-2 font-sans text-muted-foreground text-sm",
        className,
      )}
      role="status"
      aria-label="Summarizing conversation"
    >
      <Spinner className="size-4 shrink-0" />
      <span className="aui-compacting-label">Summarizing conversation...</span>
    </div>
  );
};
