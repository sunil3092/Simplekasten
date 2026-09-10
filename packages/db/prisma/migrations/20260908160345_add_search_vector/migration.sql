-- AlterTable
-- Generated column, not a plain one: title matches outrank content matches
-- (weight A vs B) so the quick switcher's search naturally surfaces the note
-- you meant by title first, without a separate title-only code path.
ALTER TABLE "notes" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("content", '')), 'B')
  ) STORED;

CREATE INDEX "notes_search_vector_idx" ON "notes" USING GIN ("searchVector");
