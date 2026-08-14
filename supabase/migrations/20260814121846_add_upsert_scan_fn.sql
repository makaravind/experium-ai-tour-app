-- Initial upsert_scan RPC (issue #29)

CREATE OR REPLACE FUNCTION public.upsert_scan(
  p_user_id uuid,
  p_qr_code_id uuid,
  p_listened boolean,
  p_listen_duration_sec integer,
  p_device_info jsonb
) RETURNS void LANGUAGE sql AS $function$
  INSERT INTO scans (user_id, qr_code_id, listened, discovered, listen_duration_sec, device_info)
  VALUES (p_user_id, p_qr_code_id, p_listened, true, p_listen_duration_sec, p_device_info)
  ON CONFLICT (user_id, qr_code_id) DO UPDATE SET
    listened            = scans.listened OR EXCLUDED.listened,
    listen_duration_sec = EXCLUDED.listen_duration_sec,
    device_info         = EXCLUDED.device_info,
    updated_at          = now();
$function$;
