import { HushMascot } from "@/components/HushMascot";

// A Galaxy Ultra–style handset built as a CSS 3D box, so the hero can lay it flat, tumble it and
// stand it up (the "hardware" in the midnight-gallery style). Flat titanium frame, flat display
// with a punch-hole camera, a violet glass back (Hush's own colourway) with the Ultra's column of
// separate lens rings. Rotate the parent with preserve-3d; this component draws all six faces.

/** Screen content is authored at this width and scaled to fit the display. */
export const SCREEN_DESIGN_W = 300;

const TITANIUM = "linear-gradient(145deg, #dcdce1 0%, #8e8e93 22%, #f2f2f5 44%, #6e6e73 68%, #c2c2c7 100%)";
const SIDE_X = "linear-gradient(90deg, #4a4a4f 0%, #b9b9be 26%, #f2f2f5 50%, #9a9a9f 74%, #444449 100%)";
const BACK_GLASS = "linear-gradient(158deg, #6152c6 0%, #3f31a0 26%, #2a1f72 58%, #1f1757 82%, #2b2177 100%)";

function Lens({ size }: { size: number }) {
  return (
    <span
      className="absolute block rounded-full"
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        padding: size * 0.085,
        background:
          "conic-gradient(from 210deg, #5d5d62, #ececf0 12%, #8e8e93 26%, #3a3a3c 46%, #d1d1d6 64%, #6e6e73 82%, #5d5d62)",
        boxShadow: "0 1px 1px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.18)",
      }}
    >
      <span
        className="relative block h-full w-full overflow-hidden rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 50%, #221c55 0 16%, #0b0a18 34%, #030306 62%, #16161e 100%)",
          boxShadow: `inset 0 0 0 ${Math.max(1, size * 0.05)}px #0d0d10`,
        }}
      >
        <span
          className="absolute rounded-full"
          style={{
            left: "26%",
            top: "22%",
            width: "20%",
            height: "20%",
            background: "radial-gradient(circle, rgba(190,180,255,.95), rgba(120,100,255,0) 70%)",
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            right: "18%",
            bottom: "20%",
            width: "34%",
            height: "34%",
            background: "radial-gradient(circle, rgba(91,61,245,.55), rgba(91,61,245,0) 70%)",
          }}
        />
      </span>
    </span>
  );
}

function Dot({ size, color }: { size: number; color: string }) {
  return (
    <span
      className="absolute block rounded-full"
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, background: color }}
    />
  );
}

export function GalaxyPhone({ w, screen }: { w: number; screen?: React.ReactNode }) {
  const h = Math.round(w * 2.05);
  const d = Math.max(8, Math.round(w * 0.1)); // thickness
  const r = Math.round(w * 0.06); // Ultra: nearly square corners
  const frame = Math.max(2, w * 0.009);
  const bezel = Math.max(3, w * 0.022);
  const innerW = w - 2 * (frame + bezel);
  const innerH = h - 2 * (frame + bezel);
  const k = innerW / SCREEN_DESIGN_W;
  const lensD = w * 0.205;

  const face: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: w,
    height: h,
    borderRadius: r,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };
  // Side walls that follow the exact rounded-rectangle outline of the display and the back glass
  // (four straight runs plus short segments around each corner arc), so body, front and back share
  // one silhouette and nothing overhangs.
  type Wall = { x: number; y: number; theta: number; len: number };
  const walls: Wall[] = [
    { x: w / 2, y: 0, theta: 0, len: h - 2 * r },
    { x: 0, y: h / 2, theta: 90, len: w - 2 * r },
    { x: -w / 2, y: 0, theta: 180, len: h - 2 * r },
    { x: 0, y: -h / 2, theta: 270, len: w - 2 * r },
  ];
  const K = 5;
  for (const c of [
    { cx: w / 2 - r, cy: -h / 2 + r, from: -90 },
    { cx: w / 2 - r, cy: h / 2 - r, from: 0 },
    { cx: -w / 2 + r, cy: h / 2 - r, from: 90 },
    { cx: -w / 2 + r, cy: -h / 2 + r, from: 180 },
  ]) {
    for (let i = 0; i < K; i++) {
      const t = c.from + ((i + 0.5) * 90) / K;
      const rad = (t * Math.PI) / 180;
      walls.push({
        x: c.cx + r * Math.cos(rad),
        y: c.cy + r * Math.sin(rad),
        theta: t,
        len: 2 * r * Math.sin(Math.PI / 4 / K) + 0.9,
      });
    }
  }
  /** A thin slab standing on the outline at (x, y), facing outward along theta. */
  const wall = (x: number, y: number, theta: number, width: number, len: number): React.CSSProperties => ({
    position: "absolute",
    width,
    height: len,
    left: (w - width) / 2,
    top: (h - len) / 2,
    transform: `translate(${x}px, ${y}px) rotateZ(${theta}deg) rotateY(90deg)`,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  });

  return (
    <div style={{ width: w, height: h, position: "relative", transformStyle: "preserve-3d" }}>
      {/* Front: flat display */}
      <div style={{ ...face, transform: `translateZ(${d / 2}px)`, background: TITANIUM, padding: frame }}>
        <div className="h-full w-full bg-[#050505]" style={{ borderRadius: r - frame, padding: bezel }}>
          <div
            className="theme-dark relative h-full w-full overflow-hidden bg-black text-porcelain"
            style={{ borderRadius: Math.max(4, r - frame - bezel) }}
          >
            <div
              style={{
                width: SCREEN_DESIGN_W,
                height: innerH / k,
                transform: `scale(${k})`,
                transformOrigin: "0 0",
                position: "absolute",
                left: 0,
                top: 0,
              }}
            >
              {screen}
            </div>
            {/* punch-hole camera */}
            <span
              className="absolute left-1/2 block -translate-x-1/2 rounded-full bg-[#0a0a0a] shadow-[inset_0_0_0_1.5px_#1f1f23]"
              style={{ top: w * 0.03, width: w * 0.036, height: w * 0.036 }}
            />
            {/* glass reflection */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(118deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,0) 32%)" }}
            />
          </div>
        </div>
      </div>

      {/* Back: violet glass, Ultra camera column */}
      <div
        style={{
          ...face,
          transform: `rotateY(180deg) translateZ(${d / 2}px)`,
          background: BACK_GLASS,
          boxShadow: `inset 0 0 0 ${frame + 1}px #a1a1a6, inset 0 0 0 ${frame + 2}px rgba(0,0,0,.35)`,
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(122deg, rgba(255,255,255,0) 22%, rgba(255,255,255,.2) 36%, rgba(255,255,255,0) 50%), linear-gradient(0deg, rgba(0,0,0,.25), rgba(0,0,0,0) 40%)",
          }}
        />
        <div className="absolute inset-0">
          {[0.2, 0.44, 0.68].map((y) => (
            <span key={y} className="absolute" style={{ left: w * 0.2, top: w * y }}>
              <Lens size={lensD} />
            </span>
          ))}
          <span className="absolute" style={{ left: w * 0.45, top: w * 0.56 }}>
            <Lens size={w * 0.15} />
          </span>
          <span className="absolute" style={{ left: w * 0.45, top: w * 0.2 }}>
            <Dot size={w * 0.055} color="radial-gradient(circle, #fff8e1 0 30%, #d9c89a 55%, #6d6552 100%)" />
          </span>
          <span className="absolute" style={{ left: w * 0.45, top: w * 0.32 }}>
            <Dot size={w * 0.045} color="radial-gradient(circle, #3a3a44 0 35%, #0d0d10 100%)" />
          </span>
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 opacity-30" style={{ top: h * 0.8 }}>
          <HushMascot size={Math.round(w * 0.17)} color="#ffffff" />
        </span>
      </div>

      {/* Titanium walls, lit from the upper left */}
      {walls.map((wl, i) => {
        const facing = Math.cos(((wl.theta - 225) * Math.PI) / 180);
        const a = (0.32 * (1 - facing)) / 2;
        return (
          <div
            key={i}
            style={{
              ...wall(wl.x, wl.y, wl.theta, d, wl.len),
              background: `linear-gradient(rgba(0,0,0,${a.toFixed(3)}), rgba(0,0,0,${a.toFixed(3)})), ${SIDE_X}`,
            }}
          />
        );
      })}
      {/* Volume rocker + power key on the right edge */}
      {[
        { y: -h / 2 + h * 0.205, len: h * 0.13 },
        { y: -h / 2 + h * 0.35, len: h * 0.06 },
      ].map((b) => (
        <div
          key={b.y}
          style={{
            ...wall(w / 2 + 0.9, b.y, 0, d * 0.46, b.len),
            borderRadius: 999,
            background: "linear-gradient(90deg, #8e8e93, #f2f2f5 50%, #8e8e93)",
            boxShadow: "0 0 0 1px rgba(0,0,0,.3)",
          }}
        />
      ))}
      {/* Bottom edge: S Pen, USB-C, speaker */}
      <div style={{ ...wall(0, h / 2 + 0.9, 90, d, w * 0.72) }}>
        <span
          className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1b1b1e]"
          style={{ width: d * 0.34, height: w * 0.12 }}
        />
        <span
          className="absolute left-1/2 block -translate-x-1/2 rounded-full bg-[#2a2a2e]"
          style={{ top: w * 0.02, width: d * 0.3, height: w * 0.09 }}
        />
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute left-1/2 block -translate-x-1/2 rounded-full bg-[#1b1b1e]"
            style={{ bottom: w * (0.03 + i * 0.035), width: d * 0.16, height: d * 0.16 }}
          />
        ))}
      </div>
    </div>
  );
}
