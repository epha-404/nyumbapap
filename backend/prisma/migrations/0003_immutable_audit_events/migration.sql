CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are immutable';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF to_regclass('public.audit_events') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events;
    CREATE TRIGGER audit_events_immutable
      BEFORE UPDATE OR DELETE ON audit_events
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
    REVOKE UPDATE, DELETE ON audit_events FROM PUBLIC;
  END IF;
END;
$$;
