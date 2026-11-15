import type {
  CampusEvent,
  Category,
  EventPage,
  EventQuery,
  EventRepository,
  Preferences,
  Recommendation,
} from "../types";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId: string | null = null,
  ) {
    super(message);
  }
}
export const API_BASE = import.meta.env?.VITE_API_BASE ?? "/api/v1";
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "The server returned an invalid response. Please try again.",
    );
  }
  if (!response.ok) {
    const error = body as {
      error?: { message?: string; details?: { message: string }[] };
    };
    throw new ApiError(
      response.status,
      [
        error.error?.message,
        ...(error.error?.details?.map((d) => d.message) ?? []),
      ]
        .filter(Boolean)
        .join(" ") || "The request could not be completed.",
      response.headers.get("X-Request-Id"),
    );
  }
  return body as T;
}
export const eventRepository: EventRepository = {
  async query(query: EventQuery, signal) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) {
        for (const item of Array.isArray(value) ? value : [value])
          params.append(key, String(item));
      }
    return apiRequest<EventPage>(`/events?${params}`, { signal });
  },
  async get(id, signal) {
    try {
      return (
        await apiRequest<{ data: CampusEvent }>(
          `/events/${encodeURIComponent(id)}`,
          { signal },
        )
      ).data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  async categories(signal) {
    return (await apiRequest<{ data: Category[] }>("/categories", { signal }))
      .data;
  },
  async recommendations(preferences: Preferences, signal) {
    return (
      await apiRequest<{ data: Recommendation[] }>("/recommendations", {
        method: "POST",
        body: JSON.stringify(preferences),
        signal,
      })
    ).data;
  },
};
