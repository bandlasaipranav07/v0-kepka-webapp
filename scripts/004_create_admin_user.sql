-- Create a default admin user (replace with actual user ID)
-- This would typically be done through a secure admin interface
INSERT INTO public.admin_users (user_id, admin_level, permissions)
SELECT 
  id,
  'super_admin',
  '["user_management", "token_management", "system_settings", "analytics", "reports"]'::JSONB
FROM public.profiles 
WHERE email = 'admin@kepka.app'  -- Replace with actual admin email
ON CONFLICT (user_id) DO NOTHING;

-- Record initial system metrics
SELECT public.record_metric('platform_launch', 1, 'counter', '{"version": "1.0.0"}'::JSONB);
SELECT public.record_metric('initial_setup', 1, 'counter', '{"timestamp": "2025-01-21"}'::JSONB);
