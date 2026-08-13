import { cn } from "@/lib/utils";

/**
 * Archival folio label that opens each registry section — mono, uppercase,
 * wide tracking. The numbered-file metaphor is the homepage's narrative
 * spine: every section reads as a document in the opportunities registry,
 * not as another block of a listing portal.
 */
export function FolioLabel({
  index,
  title,
  className,
  light = false,
}: {
  /** Zero-padded file number, e.g. "01". */
  index: string;
  /** Document title, e.g. "Registro semanal". */
  title: string;
  className?: string;
  /** Use on dark (ink) sections. */
  light?: boolean;
}) {
  return (
    <p
      className={cn(
        "font-mono text-xs font-medium uppercase tracking-[0.28em]",
        light ? "text-white/70" : "text-muted-foreground",
        className,
      )}
    >
      Folio · {index} — {title}
    </p>
  );
}
