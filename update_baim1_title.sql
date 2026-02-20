-- ============================================
-- Update BAIM 1 menjadi BAIM 1 INTRODUCTION TO EXPLOSIVE
-- ============================================
-- Jalankan query ini di Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard
-- Menu: SQL Editor > New query

-- Update quiz_title untuk BAIM 1
UPDATE public.quizzes 
SET quiz_title = 'BAIM 1 INTRODUCTION TO EXPLOSIVE'
WHERE quiz_title = 'BAIM 1'
   OR quiz_title LIKE 'BAIM 1%';

-- Verifikasi update
SELECT id, training_title, quiz_title, quiz_type, created_at
FROM public.quizzes
WHERE quiz_title LIKE 'BAIM 1%'
ORDER BY quiz_type;

