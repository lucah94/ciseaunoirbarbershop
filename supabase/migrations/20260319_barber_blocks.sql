-- Table pour bloquer des dates spécifiques par barbière (congé, maladie, etc.)
CREATE TABLE IF NOT EXISTS barber_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  barber TEXT NOT NULL,        -- 'melynda' ou 'diodis'
  date DATE NOT NULL,
  reason TEXT,                 -- ex: "Congé", "Maladie", "Formation"
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(barber, date)
);

ALTER TABLE barber_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on barber_blocks"
  ON barber_blocks
  USING (true)
  WITH CHECK (true);
