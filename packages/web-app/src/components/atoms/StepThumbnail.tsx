import { ImageOff } from "lucide-react";

interface StepThumbnailProps {
  src: string | null;
  alt: string;
}

export function StepThumbnail({ src, alt }: StepThumbnailProps) {
  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-md border bg-muted text-muted-foreground">
        <ImageOff className="size-6" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="aspect-video w-full rounded-md border object-cover object-top"
    />
  );
}
