CREATE TABLE categories (
  id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 80),
  name TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK(length(name) BETWEEN 1 AND 80)
);
CREATE TABLE organizers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
  url TEXT CHECK(url IS NULL OR url LIKE 'https://%')
);
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 180),
  description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 10000),
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  organizer_id TEXT NOT NULL REFERENCES organizers(id) ON DELETE RESTRICT,
  starts_at INTEGER NOT NULL CHECK(starts_at > 0),
  ends_at INTEGER NOT NULL CHECK(ends_at > starts_at),
  timezone TEXT NOT NULL DEFAULT 'America/Chicago' CHECK(timezone = 'America/Chicago'),
  location TEXT NOT NULL CHECK(length(location) BETWEEN 1 AND 300),
  source_name TEXT NOT NULL,
  source_url TEXT CHECK(source_url IS NULL OR source_url LIKE 'https://%'),
  fictional INTEGER NOT NULL DEFAULT 0 CHECK(fictional IN (0,1)),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK(verification_status IN ('unverified','verified')),
  last_verified_at INTEGER,
  verification_evidence TEXT,
  newcomer_status TEXT NOT NULL DEFAULT 'unknown' CHECK(newcomer_status IN ('confirmed','unconfirmed','unknown')),
  newcomer_details TEXT,
  newcomer_evidence TEXT,
  registration_url TEXT CHECK(registration_url IS NULL OR registration_url LIKE 'https://%'),
  registration_details TEXT,
  registration_verified_at INTEGER,
  what_to_expect TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(fictional = 0 OR verification_status = 'unverified'),
  CHECK(verification_status != 'verified' OR (source_url IS NOT NULL AND last_verified_at IS NOT NULL AND verification_evidence IS NOT NULL AND length(trim(verification_evidence)) > 0)),
  CHECK(status != 'published' OR fictional = 1 OR verification_status = 'verified'),
  CHECK(newcomer_status != 'confirmed' OR (newcomer_details IS NOT NULL AND newcomer_evidence IS NOT NULL AND length(trim(newcomer_details)) > 0 AND length(trim(newcomer_evidence)) > 0)),
  CHECK(registration_url IS NULL OR (fictional = 0 AND verification_status = 'verified' AND registration_verified_at IS NOT NULL AND registration_details IS NOT NULL))
);
CREATE TABLE event_interests (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  PRIMARY KEY(event_id, category_id)
);
CREATE INDEX events_status_start ON events(status, starts_at, id);
CREATE INDEX events_status_end ON events(status, ends_at);
CREATE INDEX events_category_start ON events(category_id, starts_at);
CREATE INDEX events_organizer ON events(organizer_id);
CREATE INDEX event_interests_category ON event_interests(category_id, event_id);
INSERT INTO categories(id,name) VALUES
 ('technology','Technology'),('career','Career & networking'),('social','Social events'),
 ('sports','Fitness & sports'),('entrepreneurship','Entrepreneurship'),('arts','Arts & culture'),
 ('gaming','Gaming'),('volunteering','Volunteering'),('academics','Academics'),('wellness','Wellness');
