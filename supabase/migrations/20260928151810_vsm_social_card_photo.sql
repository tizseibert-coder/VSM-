-- Foto-Hintergrund fuer die Kacheln des Social-Media-Agenten (2026-09-29)
--
-- Statt der einfarbigen Kachel bekommt jeder Beitrag ein echtes,
-- themenpassendes Foto als Hintergrund (ueber OpenAIs Bildmodell, siehe
-- src/lib/social/photo.ts). Erzeugt wird hoechstens einmal je Beitrag; das
-- Ergebnis landet hier und wird von dort wiederverwendet. Ohne
-- OPENAI_API_KEY bleibt die Spalte leer und die Kachel einfarbig — das
-- ist kein Fehlerfall, sondern der Handbetrieb dieses Merkmals.
--
-- Idempotent (`ADD COLUMN IF NOT EXISTS`).

ALTER TABLE public.vsm_social_posts
  ADD COLUMN IF NOT EXISTS card_photo_base64 text;

COMMENT ON COLUMN public.vsm_social_posts.card_photo_base64 IS
  'Das erzeugte Hintergrundfoto der Kachel (JPEG, base64), einmal je Beitrag erzeugt und wiederverwendet. NULL heisst: kein Foto konfiguriert oder noch nicht erzeugt — die Kachel bleibt dann einfarbig.';
