DELETE FROM "BestOfScore" WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "entryId", factor ORDER BY id) as rn
    FROM "BestOfScore"
  ) sub WHERE rn > 1
);
