import { useCallback, useEffect, useState } from "react";
export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  key: string,
  refresh = false,
): Resource<T> {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    if (!refresh) return;
    let last = 0;
    const update = () => {
      if (document.visibilityState === "hidden" || Date.now() - last < 1000)
        return;
      last = Date.now();
      setAttempt((n) => n + 1);
    };
    const visible = () => {
      if (document.visibilityState === "visible") update();
    };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(update, 60000);
    return () => {
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", visible);
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, loading: true, error: null });
    Promise.resolve()
      .then(() => load(controller.signal))
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            data: null,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "The request could not be completed.",
          });
      });
    return () => controller.abort();
    // key captures request inputs; load is intentionally not an unstable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return { ...state, retry };
}
