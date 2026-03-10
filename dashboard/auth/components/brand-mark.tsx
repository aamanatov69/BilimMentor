type BrandMarkProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ compact = false, className = "" }: BrandMarkProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <div
        className={
          compact
            ? "flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 text-sm font-extrabold tracking-wide text-white shadow-lg shadow-slate-300/60"
            : "flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-base font-extrabold tracking-wide text-white shadow-lg shadow-slate-300/70"
        }
        aria-hidden="true"
      >
        BM
      </div>
      <div className="text-left">
        <p
          className={
            compact
              ? "bg-gradient-to-r from-slate-900 via-slate-700 to-blue-700 bg-clip-text text-base font-bold leading-none tracking-tight text-transparent"
              : "bg-gradient-to-r from-slate-900 via-slate-700 to-blue-700 bg-clip-text text-2xl font-bold leading-none tracking-tight text-transparent"
          }
        >
          BilimMentor
        </p>
        {!compact ? (
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Learning Platform
          </p>
        ) : null}
      </div>
    </div>
  );
}
