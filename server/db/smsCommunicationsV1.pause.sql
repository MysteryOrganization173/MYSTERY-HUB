-- MANUAL incident/rollback operation, separately authorized. Keep all evidence and idempotency records.
BEGIN;
DO $$ BEGIN IF to_regclass('mysteryhub_sms.settings') IS NOT NULL THEN
 UPDATE mysteryhub_sms.settings SET paused=true,auto_enabled=false,revision=revision+1;
 UPDATE mysteryhub_sms.messages SET state='cancelled',error_code='OPERATOR_PAUSE' WHERE state='queued';
END IF; END $$;
DROP TRIGGER IF EXISTS sms_guest_event ON public.orders;
COMMIT;
-- Do not drop private SMS tables, retry uncertain submissions or rewrite order/payment status.
