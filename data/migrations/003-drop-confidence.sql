-- The confidence columns were redundant with the data they were derived from.
--
-- sources.confidence held 'unspecified' on all 2,636 rows: no source has ever
-- carried a distinct value.
--
-- entities.confidence was copied out of each record and re-exported on every
-- domain shard, but nothing reads it there. The value players actually see -
-- the confirmed/provisional badge and filter on /map, and the research status
-- labels - comes from the record's own `confidence` field, which is preserved
-- in entities.extra_json and in the research catalog tables.

ALTER TABLE entities DROP COLUMN confidence;
ALTER TABLE sources DROP COLUMN confidence;
