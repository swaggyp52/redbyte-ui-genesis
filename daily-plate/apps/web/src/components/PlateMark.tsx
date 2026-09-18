/** Original plate motif: a rim, a plate, and a fork tine. Decorative only. */
export function PlateMark({ size = 56, title }: { size?: number; title?: string }) {
  return (
    <svg className="plate-mark" width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : 'presentation'} aria-label={title} aria-hidden={title ? undefined : true}>
      <circle cx="32" cy="32" r="30" fill="#F4EFE3" />
      <circle cx="32" cy="32" r="24" fill="#FFFFFF" stroke="#176A5B" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="15" fill="none" stroke="#D9AA4B" strokeWidth="2" strokeDasharray="4 5" />
      <path d="M26 24c0 6 2 8 6 8s6-2 6-8" fill="none" stroke="#D67B5D" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 32v10" stroke="#176A5B" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
