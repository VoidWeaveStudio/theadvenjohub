-- Custom SQL migration file, put your code below! --

DO $$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE "games"
  SET "title" = 'TANJO World', "updated_at" = now()
  WHERE "slug" = 'tanjo-shooter';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'Expected to update exactly 1 game row (slug=tanjo-shooter), but affected % rows', affected_rows;
  END IF;
END $$;
