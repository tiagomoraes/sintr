-- F8: Therapy no longer asks whether a session moved (DECISIONS 111). A single session on another day is
-- prepared on the day from Reports. The column stays, because migrations are additive; it is emptied so no
-- stored date goes on moving a report that nobody can see or change any more.
UPDATE "therapy_settings" SET "next_session_at" = NULL WHERE "next_session_at" IS NOT NULL;
