ALTER TABLE events ADD COLUMN occurrence_status TEXT NOT NULL DEFAULT 'scheduled' CHECK(occurrence_status IN ('scheduled','canceled'));
ALTER TABLE events ADD COLUMN change_note TEXT CHECK(change_note IS NULL OR length(change_note) <= 2000);
ALTER TABLE events ADD COLUMN pending_registration_url TEXT CHECK(pending_registration_url IS NULL OR pending_registration_url LIKE 'https://%');
ALTER TABLE events ADD COLUMN pending_registration_details TEXT;
ALTER TABLE events ADD COLUMN source_key TEXT;
ALTER TABLE events ADD COLUMN identity_key TEXT;
CREATE UNIQUE INDEX events_unique_active_source ON events(source_key) WHERE status != 'archived' AND source_key IS NOT NULL;
CREATE UNIQUE INDEX events_unique_active_identity ON events(identity_key) WHERE status != 'archived' AND identity_key IS NOT NULL;
CREATE INDEX events_occurrence_start ON events(occurrence_status,status,starts_at);
CREATE TABLE admin_audit (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  happened_at INTEGER NOT NULL
);
CREATE INDEX admin_audit_time ON admin_audit(happened_at DESC);
