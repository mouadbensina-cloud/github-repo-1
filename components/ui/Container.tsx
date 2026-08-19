import type { ReactNode } from "react";

/**
 * The 1200px content column. Figma insets every home-page section by 120px
 * inside the 1440 frame, so the max-width carries the 20px gutters on top of
 * the 1200 — that way the content box is exactly 1200 on wide screens and the
 * gutters simply absorb the difference on narrow ones.
 */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1240px] px-5 ${className}`}>
      {children}
    </div>
  );
}
