export const INTERESTS = [
  "Technology",
  "Career & networking",
  "Social events",
  "Fitness & sports",
  "Entrepreneurship",
  "Arts & culture",
  "Gaming",
  "Volunteering",
  "Academics",
  "Wellness",
] as const;
export type Interest = string;
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];
export const PERIODS = ["Morning", "Afternoon", "Evening"] as const;
export type Period = (typeof PERIODS)[number];
export interface Preferences {
  interests: string[];
  days: Day[];
  periods: Period[];
  anyTime: boolean;
  noSchedulePreference: boolean;
}
export interface Category {
  id: string;
  name: string;
}
export interface Organizer {
  id: string;
  name: string;
  url: string | null;
}
export type EventStatus = "draft" | "published" | "archived";
export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  categories: string[];
  startsAt: string;
  endsAt: string;
  timeZone: "America/Chicago";
  location: string;
  organizer: string;
  organizerId?: string;
  source: { name: string; url: string | null; verified: boolean };
  fictional: boolean;
  newcomer?: { friendly: boolean; details: string; evidence: string };
  newcomerStatus?: "confirmed" | "unconfirmed" | "unknown";
  registration?: { url: string; details: string; lastVerifiedAt: string };
  verificationStatus?: "verified" | "unverified";
  lastVerifiedAt?: string | null;
  status?: EventStatus;
  occurrenceStatus?: "scheduled" | "canceled";
  changeNote?: string | null;
  updatedAt?: string;
  reviewRequired?: boolean;
  whatToExpect?: string;
}
export type DateFilter = "all" | "today" | "week" | "next-week";
export interface EventFilters {
  query: string;
  categories: string[];
  date: DateFilter;
  availability: boolean;
  sort: "soonest" | "latest";
}
export interface Recommendation {
  event: CampusEvent;
  score: number;
  reason: string;
}
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface EventPage {
  data: CampusEvent[];
  meta: PageMeta;
}
export interface EventQuery {
  q?: string;
  category?: string[];
  from?: string;
  to?: string;
  day?: Day[];
  period?: Period[];
  anyTime?: boolean;
  date?: DateFilter;
  page?: number;
  pageSize?: number;
  sort?: "soonest" | "latest";
}
export interface EventRepository {
  query(query: EventQuery, signal?: AbortSignal): Promise<EventPage>;
  get(id: string, signal?: AbortSignal): Promise<CampusEvent | null>;
  recommendations(
    preferences: Preferences,
    signal?: AbortSignal,
  ): Promise<Recommendation[]>;
  categories(signal?: AbortSignal): Promise<Category[]>;
}
