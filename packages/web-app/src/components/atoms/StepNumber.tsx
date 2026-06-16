export function StepNumber({ index }: { index: number }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
      {index}
    </span>
  );
}
