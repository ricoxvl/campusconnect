import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  CampusEvent,
  Category,
  EventRepository,
  Preferences,
} from "../types";
import { useResource } from "../hooks/useResource";
import { eventRepository } from "../services/eventRepository";
import {
  parsePreferences,
  parseSaved,
  readStorage,
  STORAGE_KEYS,
  toggleSaved,
  writeStorage,
} from "../lib/storage";

interface AppState {
  preferences: Preferences;
  setPreferences: (p: Preferences) => void;
  saved: string[];
  toggleSave: (id: string) => void;
  events: CampusEvent[];
  repository: EventRepository;
  remember: (events: CampusEvent[]) => void;
  forget: (id: string) => void;
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  refreshCategories: () => void;
  storageUnavailable: boolean;
  announcement: string;
}
const AppContext = createContext<AppState | null>(null);
export function AppProvider({
  children,
  repository = eventRepository,
}: {
  children: ReactNode;
  repository?: EventRepository;
}) {
  const [preferences, setPreferences] = useState(() =>
    parsePreferences(readStorage(STORAGE_KEYS.preferences)),
  );
  const [saved, setSaved] = useState(() =>
    parseSaved(readStorage(STORAGE_KEYS.saved)),
  );
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const categoryResource = useResource(
    (signal) => repository.categories(signal),
    "categories",
  );
  const remember = useCallback(
    (incoming: CampusEvent[]) =>
      setEvents((previous) => {
        const byId = new Map(previous.map((event) => [event.id, event]));
        for (const event of incoming) byId.set(event.id, event);
        return [...byId.values()];
      }),
    [],
  );
  const forget = useCallback(
    (id: string) =>
      setEvents((current) => current.filter((event) => event.id !== id)),
    [],
  );
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!writeStorage(STORAGE_KEYS.preferences, preferences))
      setStorageUnavailable(true);
  }, [preferences]);
  useEffect(() => {
    if (!writeStorage(STORAGE_KEYS.saved, saved)) setStorageUnavailable(true);
  }, [saved]);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.storageArea && e.storageArea !== localStorage) return;
      if (e.key === null || e.key === STORAGE_KEYS.preferences)
        setPreferences(parsePreferences(e.key === null ? null : e.newValue));
      if (e.key === null || e.key === STORAGE_KEYS.saved)
        setSaved(parseSaved(e.key === null ? null : e.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const toggleSave = useCallback(
    (id: string) => {
      const event = events.find((e) => e.id === id);
      setAnnouncement(
        `${event?.title ?? "Event"} ${saved.includes(id) ? "removed from" : "saved to"} My Campus Plan.`,
      );
      setSaved((previous) => toggleSaved(previous, id));
    },
    [events, saved],
  );
  return (
    <AppContext.Provider
      value={{
        preferences,
        setPreferences,
        saved,
        toggleSave,
        events,
        repository,
        remember,
        forget,
        categories: categoryResource.data ?? [],
        categoriesLoading: categoryResource.loading,
        categoriesError: categoryResource.error,
        refreshCategories: categoryResource.retry,
        storageUnavailable,
        announcement,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const app = useContext(AppContext);
  if (!app) throw new Error("useApp requires AppProvider");
  return app;
}
