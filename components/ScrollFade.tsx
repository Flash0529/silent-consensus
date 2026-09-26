export function ScrollFade({ height = 100 }: { height?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-10"
      style={{ height, background: "linear-gradient(#FFFFFF 64%, rgba(255,255,255,0))" }}
    />
  );
}

/** Floating header row that sits over the scroll fade. */
export function FloatingHeader({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScrollFade />
      <div className="absolute inset-x-4 top-5 z-20 flex items-center gap-2">{children}</div>
    </>
  );
}
