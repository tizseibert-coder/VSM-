-- Testvorrichtung: die fremde Rechtelogik, fahrbar gemacht.
--
-- **Keine Migration.** Diese Datei gehoert nicht in `migrations/` und wird nie
-- gegen die Produktion ausgefuehrt. Sie laeuft nur im Rechte-Test
-- (`rechte-pruefen.sh`), und zwar *nach* den Migrationen.
--
-- Warum es sie zusaetzlich zu `fremde_voraussetzungen.sql` gibt
-- ─────────────────────────────────────────────────────────────
-- Jene Datei bildet `has_org_role()` bewusst nur als Huelse nach: Sie prueft
-- die Mitgliedschaft, nicht die Rangfolge, und `auth.uid()` liefert dort immer
-- NULL. Fuer den Schema-Test genuegt das — geprueft wird dort, dass die
-- Objekte entstehen, nicht was sie erlauben.
--
-- Fuer eine Pruefung der Policies genuegt es nicht. Mit einer Huelse, die
-- jedem Mitglied alles erlaubt, sieht eine Schreib-Policy mit 'viewer' genauso
-- aus wie eine mit 'editor' — und genau diese Verwechslung ist der Fehler, den
-- die Autorisierungsschicht riskiert: acht Tabellen, dasselbe Muster, von Hand
-- ausgeschrieben. Ein einziges falsch kopiertes Wort haette zur Folge, dass
-- ein Betrachter fremde Wertstroeme ueberschreiben darf, und nichts in der
-- Anwendung wuerde es melden.
--
-- Deshalb ersetzt diese Datei beide Huelsen durch fahrbare Fassungen.
--
-- Die Grenze dieses Tests — bitte lesen, bevor man ihm glaubt
-- ──────────────────────────────────────────────────────────
-- Die echte `has_org_role()` liegt in den Prisma-Migrationen von LeanPulse
-- Industrial (supabase/README.md, "Die Aufteilung"). Was hier steht, ist aus
-- ihrem Gebrauch abgeleitet, nicht ihre Quelle. Der Test sagt also:
--
--   "Gegeben eine Rangfolge viewer < editor < admin, haengen die Policies
--    *dieses* Repositories die richtige Mindestrolle an die richtige
--    Operation."
--
-- Er sagt nicht, dass die Rangfolge drueben so aussieht. Wer sie dort aendert,
-- muss sie hier mitaendern — sonst prueft der Test weiter eine Annahme, die
-- nicht mehr gilt. Das ist dieselbe Gefahr wie am 16.08., nur andersherum.

-- ═══════════════════════════════════════════
-- 1) auth.uid()
-- ═══════════════════════════════════════════
-- Wortgleich zu der Fassung, die Supabase anlegt: PostgREST legt den
-- sub-Anspruch des JWT in `request.jwt.claim.sub` bzw. in das JSON unter
-- `request.jwt.claims`. Der Test setzt denselben Schalter und ist damit naeher
-- an der Produktion als eine eigens erfundene Variable.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- ═══════════════════════════════════════════
-- 2) has_org_role()
-- ═══════════════════════════════════════════
-- CREATE OR REPLACE statt DROP + CREATE, und mit genau den Parameternamen aus
-- `fremde_voraussetzungen.sql`: An der Funktion haengen zu diesem Zeitpunkt
-- bereits die Policies der Autorisierungsschicht. `DROP ... CASCADE` wuerde
-- sie mitnehmen — der Test wuerde dann eine Datenbank ohne Policies pruefen
-- und triumphierend nichts finden.
--
-- (Produktiv heissen die Parameter `org_id` und `min_role`, letzterer mit
-- Vorgabewert — siehe src/types/database.ts. Fuer den Test ist das ohne
-- Belang, weil alle Aufrufe in den Policies stellungsbezogen sind.)
CREATE OR REPLACE FUNCTION public.has_org_role(p_org_id uuid, p_min_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = p_org_id
      AND m.user_id = auth.uid()
      AND CASE m.role
            WHEN 'viewer' THEN 1
            WHEN 'editor' THEN 2
            WHEN 'admin'  THEN 3
            WHEN 'owner'  THEN 3
            ELSE 0
          END
          >=
          CASE p_min_role
            WHEN 'viewer' THEN 1
            WHEN 'editor' THEN 2
            WHEN 'admin'  THEN 3
            WHEN 'owner'  THEN 3
            ELSE 99
          END
  );
$$;

-- Eine unbekannte Rolle ergibt 0 und damit immer `false`; eine unbekannte
-- Mindestrolle ergibt 99 und damit ebenfalls `false`. Beides bewusst: Wer eine
-- Rolle einfuehrt, ohne sie hier einzutragen, bekommt eine gesperrte
-- Anwendung. Das faellt auf. Der umgekehrte Fehler faellt nicht auf.

-- ═══════════════════════════════════════════
-- 3) Die Rechte, die Supabase vergibt
-- ═══════════════════════════════════════════
-- RLS greift erst, wenn ueberhaupt ein Tischrecht da ist, und sie greift nicht
-- gegen den Eigentuemer der Tabelle. Der Test muss also als `authenticated`
-- laufen, und diese Rolle braucht dieselben GRANTs, die Supabase in einem
-- echten Projekt per `ALTER DEFAULT PRIVILEGES` vergibt. In `migrations/`
-- steht dazu nichts, und das ist richtig so — die Rechte gehoeren der
-- Plattform, nicht dem Produkt.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
