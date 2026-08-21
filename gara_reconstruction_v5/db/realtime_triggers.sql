-- realtime_triggers.sql — PostgreSQL LISTEN/NOTIFY triggers for realtime
-- Chạy 1 lần sau khi migrate schema (Giai đoạn 1)
-- Tables: activity_log, vattu, sc, sc_vattu, nhap_xuat

-- ============ FUNCTION CHUNG ============
CREATE OR REPLACE FUNCTION notify_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(TG_TABLE_NAME || '_changes', json_build_object(
    'operation', TG_OP,
    'table', TG_TABLE_NAME,
    'old', row_to_json(OLD),
    'new', row_to_json(NEW)
  )::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============ TRIGGERS CHO 5 BẢNG ============
-- activity_log
DROP TRIGGER IF EXISTS activity_log_changes ON activity_log;
CREATE TRIGGER activity_log_changes
AFTER INSERT OR UPDATE OR DELETE ON activity_log
FOR EACH ROW EXECUTE FUNCTION notify_change();

-- vattu
DROP TRIGGER IF EXISTS vattu_changes ON vattu;
CREATE TRIGGER vattu_changes
AFTER INSERT OR UPDATE OR DELETE ON vattu
FOR EACH ROW EXECUTE FUNCTION notify_change();

-- sc
DROP TRIGGER IF EXISTS sc_changes ON sc;
CREATE TRIGGER sc_changes
AFTER INSERT OR UPDATE OR DELETE ON sc
FOR EACH ROW EXECUTE FUNCTION notify_change();

-- sc_vattu
DROP TRIGGER IF EXISTS sc_vattu_changes ON sc_vattu;
CREATE TRIGGER sc_vattu_changes
AFTER INSERT OR UPDATE OR DELETE ON sc_vattu
FOR EACH ROW EXECUTE FUNCTION notify_change();

-- nhap_xuat
DROP TRIGGER IF EXISTS nhap_xuat_changes ON nhap_xuat;
CREATE TRIGGER nhap_xuat_changes
AFTER INSERT OR UPDATE OR DELETE ON nhap_xuat
FOR EACH ROW EXECUTE FUNCTION notify_change();

-- ============ VERIFY ============
-- Test: INSERT INTO vattu (id, ten, don_vi, ton, gia) VALUES ('VT-TEST01', 'Test', 'cái', 10, 50000);
-- → pg_notify 'vattu_changes' với payload JSON