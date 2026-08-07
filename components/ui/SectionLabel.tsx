type SectionLabelProps = {
  number: string;
  kicker: string;
};

/** Announces the section's number/label as it enters — the one piece
 * of the reference's visual language this phase adopts directly. */
export function SectionLabel({ number, kicker }: SectionLabelProps) {
  return (
    <div className="mb-8 flex items-center gap-4 rtl:flex-row-reverse">
      <span className="font-en text-sm tabular-nums tracking-wideish text-accent">
        {number}
      </span>
      <span className="h-px w-12 bg-ink-line" />
      <span className="text-sm uppercase tracking-wideish text-paper-dim">
        {kicker}
      </span>
    </div>
  );
}
