export function HushMascot({ size = 36, label }: { size?: number; label?: string }) {
  const stroke = size < 40 ? 8 : size < 80 ? 6.5 : 5.5;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="shrink-0"
    >
      <path
        d="M60 12c26.5 0 48 18.8 48 42s-21.5 42-48 42c-5.9 0-11.6-.9-16.8-2.6L22 104l5.6-18.2C18.1 78.1 12 66.7 12 54 12 30.8 33.5 12 60 12z"
        fill="#5B3DF5"
      />
      <path d="M40 55c3.4 4.8 11.6 4.8 15 0" fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" />
      <path d="M65 55c3.4 4.8 11.6 4.8 15 0" fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}
