send-tuition-receipt (deployed 20 Nov 2026, verify JWT off, needs CRON_SECRET header).
Emails the PDF attached to a tuition receipt (tuition_receipt_files) to the family's linked parents.
Call from the SQL editor:
  select net.http_post(url := 'https://dduneischfnehmkfnuik.supabase.co/functions/v1/send-tuition-receipt',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', '<CRON_SECRET>'),
    body := jsonb_build_object('receipt_id', '<receipt uuid>'));
