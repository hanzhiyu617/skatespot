CREATE TABLE rating_snapshots (
  spot_id TEXT PRIMARY KEY REFERENCES spots(id) ON DELETE CASCADE,
  total DOUBLE PRECISION NOT NULL CHECK (total >= 0),
  count INTEGER NOT NULL CHECK (count >= 0)
);
