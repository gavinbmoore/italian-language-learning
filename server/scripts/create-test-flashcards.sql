-- Create test flashcards for immediate review
-- This inserts some Italian vocabulary words as flashcards with review dates set to now

INSERT INTO app.vocabulary (
  id, user_id, word, word_original, 
  translation, example_sentence,
  frequency_rank, difficulty_level,
  times_encountered, times_understood, is_known,
  last_encountered, created_at,
  is_flashcard, ease_factor, interval_days, repetitions, next_review_date
) VALUES
  (
    'demo-user-123-ciao-' || extract(epoch from now())::text,
    'demo-user-123',
    'ciao',
    'ciao',
    'hello / goodbye',
    'Ciao! Come stai oggi?',
    99999,
    'A1',
    1, 0, false,
    now(), now(),
    true, 2.5, 0, 0, now()
  ),
  (
    'demo-user-123-grazie-' || extract(epoch from now())::text,
    'demo-user-123',
    'grazie',
    'grazie',
    'thank you',
    'Grazie mille per il tuo aiuto!',
    99999,
    'A1',
    1, 0, false,
    now(), now(),
    true, 2.5, 0, 0, now()
  ),
  (
    'demo-user-123-bello-' || extract(epoch from now())::text,
    'demo-user-123',
    'bello',
    'bello',
    'beautiful',
    'Che bel giorno oggi!',
    99999,
    'A1',
    1, 0, false,
    now(), now(),
    true, 2.5, 0, 0, now()
  ),
  (
    'demo-user-123-mangiare-' || extract(epoch from now())::text,
    'demo-user-123',
    'mangiare',
    'mangiare',
    'to eat',
    'Mi piace mangiare la pizza.',
    99999,
    'A1',
    1, 0, false,
    now(), now(),
    true, 2.5, 0, 0, now()
  ),
  (
    'demo-user-123-casa-' || extract(epoch from now())::text,
    'demo-user-123',
    'casa',
    'casa',
    'house / home',
    'Vado a casa dopo il lavoro.',
    99999,
    'A1',
    1, 0, false,
    now(), now(),
    true, 2.5, 0, 0, now()
  )
ON CONFLICT (id) DO NOTHING;

