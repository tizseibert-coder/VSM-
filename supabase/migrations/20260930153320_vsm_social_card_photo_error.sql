-- Diagnose-Spalte fuer die Foto-Erzeugung (2026-09-30)
--
-- Schlaegt generatePhoto() fehl, landete der Grund bisher nur im
-- Server-Log von Vercel -- fuer die Fehlersuche von aussen unsichtbar.
-- Diese Spalte macht den letzten Fehler in der Datenbank nachlesbar.
ALTER TABLE public.vsm_social_posts
  ADD COLUMN IF NOT EXISTS card_photo_error text;

COMMENT ON COLUMN public.vsm_social_posts.card_photo_error IS
  'Die letzte Fehlermeldung der Foto-Erzeugung (OpenAI), falls sie gescheitert ist. NULL, sobald ein Foto erfolgreich erzeugt wurde.';
