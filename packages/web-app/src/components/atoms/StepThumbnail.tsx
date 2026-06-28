import { useState } from "react";
import { ImageOff, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface StepThumbnailProps {
  src: string | null;
  alt: string;
  label?: string;
}

export function StepThumbnail({ src, alt, label }: StepThumbnailProps) {
  const [open, setOpen] = useState(false);

  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-md border bg-muted text-muted-foreground">
        <ImageOff className="size-5" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full overflow-hidden rounded-md border transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Preview ${alt}`}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="aspect-video w-full object-cover object-top"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl gap-2 p-2 [&>button:last-child]:hidden">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className={label ? "px-1 text-sm font-semibold" : "sr-only"}>
              {label ?? alt}
            </DialogTitle>
            <DialogClose className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-3.5" />
              Close
              <kbd className="rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                Esc
              </kbd>
            </DialogClose>
          </div>
          <img src={src} alt={alt} className="max-h-[80vh] w-full rounded-sm object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}
