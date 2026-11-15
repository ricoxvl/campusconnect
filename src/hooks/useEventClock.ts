import { useEffect, useState } from "react";
import type { CampusEvent } from "../types";
export function useEventClock(events: CampusEvent[]): number {
  const [now, setNow] = useState(Date.now());
  const times = events
    .flatMap((event) => [Date.parse(event.startsAt), Date.parse(event.endsAt)])
    .sort((a, b) => a - b)
    .join(",");
  useEffect(() => {
    const current = Date.now();
    const next = times
      .split(",")
      .map(Number)
      .find((time) => time >= current);
    const delay =
      next === undefined
        ? 60000
        : Math.min(60000, Math.max(1, next - current + 1));
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [times, now]);
  return now;
}
