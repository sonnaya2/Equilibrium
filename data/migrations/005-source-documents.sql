-- Each seed document's shape with its records removed, so the compatibility
-- documents under public/data/v2/documents/ can be rebuilt from the database
-- alone. Export used to reopen data/seed-v1.json.gz for this, which tied every
-- frontend artifact to the legacy seed no matter what built the rows.
--
-- A skeleton is the document with every top-level array record replaced by
-- null. Export writes each source_records row back over its own record_path and
-- record paths sort parent-before-child, so a nested record lands inside the
-- parent body that was just restored.

CREATE TABLE source_documents (
  path TEXT PRIMARY KEY REFERENCES source_files(path) ON DELETE CASCADE,
  skeleton_json TEXT NOT NULL CHECK (json_valid(skeleton_json))
) STRICT;
