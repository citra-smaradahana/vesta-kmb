ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS quiz_type TEXT;

ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS time_limit INTEGER;

ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS minimum_score INTEGER DEFAULT 70;

UPDATE public.quizzes 
SET training_title = 'BAIM'
WHERE training_title IS DISTINCT FROM 'BAIM'
   OR training_title IS NULL;

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for quizzes" ON public.quizzes;

CREATE POLICY "Allow all operations for quizzes" 
ON public.quizzes
FOR ALL
USING (true)
WITH CHECK (true);

