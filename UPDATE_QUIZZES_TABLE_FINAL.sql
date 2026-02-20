-- ============================================
-- UPDATE LENGKAP TABEL QUIZZES
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query
-- Copy seluruh script ini dan paste, lalu klik Run

-- 1. Tambahkan kolom questions_to_display (jika belum ada)
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS questions_to_display INTEGER;

-- 2. Pastikan semua kolom yang diperlukan sudah ada
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS quiz_type TEXT;

ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS time_limit INTEGER;

ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS minimum_score INTEGER DEFAULT 70;

-- 3. Update training_title menjadi 'BAIM' jika belum
UPDATE public.quizzes 
SET training_title = 'BAIM'
WHERE training_title IS DISTINCT FROM 'BAIM'
   OR training_title IS NULL;

-- 4. Buat index untuk performa yang lebih baik
CREATE INDEX IF NOT EXISTS idx_quizzes_training_title ON public.quizzes(training_title);
CREATE INDEX IF NOT EXISTS idx_quizzes_quiz_title ON public.quizzes(quiz_title);
CREATE INDEX IF NOT EXISTS idx_quizzes_quiz_type ON public.quizzes(quiz_type);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON public.quizzes(created_at DESC);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- 6. Buat/Update policy untuk allow semua operasi (untuk development)
DROP POLICY IF EXISTS "Allow all operations for quizzes" ON public.quizzes;
CREATE POLICY "Allow all operations for quizzes" 
ON public.quizzes
FOR ALL
USING (true)
WITH CHECK (true);

-- 7. Tambahkan komentar untuk dokumentasi
COMMENT ON COLUMN public.quizzes.questions_to_display IS 'Jumlah soal yang akan ditampilkan saat quiz dikerjakan. Jika NULL atau 0, semua soal dari bank soal akan ditampilkan.';
COMMENT ON COLUMN public.quizzes.quiz_type IS 'Tipe quiz: Pre Test atau Post Test';
COMMENT ON COLUMN public.quizzes.time_limit IS 'Batas waktu quiz dalam menit';
COMMENT ON COLUMN public.quizzes.minimum_score IS 'Nilai minimum yang harus dicapai untuk lulus (0-100)';

-- Catatan:
-- - questions_to_display: NULL atau 0 = tampilkan semua soal
-- - questions_to_display > 0 = tampilkan hanya jumlah tersebut (diacak dari bank soal)
-- - Nilai tidak boleh melebihi jumlah total soal di bank soal


