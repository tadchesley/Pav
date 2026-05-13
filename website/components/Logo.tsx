export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { text: 'text-xl', dot: 'w-1.5 h-1.5' },
    md: { text: 'text-2xl', dot: 'w-2 h-2' },
    lg: { text: 'text-5xl md:text-7xl', dot: 'w-3 h-3 md:w-4 md:h-4' },
  };
  const s = sizes[size];
  return (
    <div className="inline-flex items-baseline gap-1">
      <span className={`${s.text} font-bold tracking-tight gradient-text`}>Pav</span>
      <span className={`${s.dot} rounded-full bg-bull heartbeat shrink-0`} />
    </div>
  );
}
