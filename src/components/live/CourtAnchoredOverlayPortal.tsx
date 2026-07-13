import React, { useLayoutEffect, useState } from 'react';

interface CourtAnchoredOverlayPortalProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  children: React.ReactNode;
}

function readAnchorRect(anchor: HTMLElement | null): DOMRect | null {
  if (!anchor) return null;
  return anchor.getBoundingClientRect();
}

/** Court-bounded fixed overlay; must mount inside `.live-entry-root` for theme tokens. */
export function CourtAnchoredOverlayPortal({
  anchorRef,
  open,
  children,
}: CourtAnchoredOverlayPortalProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }

    const anchor = anchorRef.current;
    if (!anchor) return;

    const update = () => {
      setRect(readAnchorRect(anchorRef.current));
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  if (!open || !rect) return null;

  return (
    <div
      className="pointer-events-auto"
      style={{
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        zIndex: 100,
      }}
    >
      {children}
    </div>
  );
}
