import { useRef } from "react";
import { useDrag } from "@use-gesture/react";

// Drag-to-dismiss for bottom sheets: bind the returned ref+bind to a drag zone
// (the grabber area). The sheet closes the moment a downward drag crosses the
// threshold or a fast flick is detected — no reliance on end events. Anything
// less springs back; upward overdrag rubber-bands.
export function useDragDismiss(onClose) {
  const ref = useRef(null);
  const consumed = useRef(false);
  const bind = useDrag(({ down, first, movement: [, my], velocity: [, vy], direction: [, dy] }) => {
    const el = ref.current;
    if (!el) return;
    if (first) consumed.current = false;
    if (down) {
      if (consumed.current) return;
      const target = my > 0 ? my : my * 0.18;
      el.style.transition = "none";
      el.style.transform = `translateY(${Math.max(target, 0)}px)`;
      el.style.opacity = String(1 - Math.min(0.5, target / 700));
      if (my > 110 || (vy > 1.4 && dy > 0 && my > 55)) {
        consumed.current = true;
        try { navigator.vibrate?.(8); } catch { /* unsupported */ }
        el.style.transition = "transform .25s cubic-bezier(.2,.9,.3,1), opacity .2s ease";
        el.style.transform = "translateY(130%)";
        el.style.opacity = "0";
        setTimeout(onClose, 210);
      }
    } else if (!consumed.current) {
      el.style.transition = "transform .28s cubic-bezier(.2,.9,.3,1), opacity .22s ease";
      el.style.transform = "translateY(0)";
      el.style.opacity = "1";
    }
  }, { axis: "y", filterTaps: true });
  return { ref, bind };
}
