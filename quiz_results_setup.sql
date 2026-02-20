-- ============================================
-- Setup Tabel Quiz Results untuk Monitoring
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query

-- 1. Buat tabel quiz_results
CREATE TABLE IF NOT EXISTS public.quiz_results (
  id BIGSERIAL PRIMARY KEY,
  quiz_id BIGINT NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL DEFAULT 'Anonymous',
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  percentage INTEGER NOT NULL,
  answers JSONB NOT NULL,
  is_passed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Buat index untuk performa yang lebih baik
CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz_id ON public.quiz_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_participant_name ON public.quiz_results(participant_name);
CREATE INDEX IF NOT EXISTS idx_quiz_results_completed_at ON public.quiz_results(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_results_is_passed ON public.quiz_results(is_passed);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

-- 4. Buat policy untuk allow semua operasi (untuk development)
-- PERHATIKAN: Untuk production, buat policy yang lebih ketat!
CREATE POLICY "Allow all operations for quiz_results" 
ON public.quiz_results
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Verifikasi tabel sudah dibuat
-- Setelah menjalankan query di atas, cek di Table Editor
-- Tabel 'quiz_results' seharusnya sudah muncul

