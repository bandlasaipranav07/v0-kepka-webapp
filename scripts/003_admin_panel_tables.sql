-- Create admin_users table for admin access control
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_level TEXT NOT NULL CHECK (admin_level IN ('super_admin', 'admin', 'moderator')),
  permissions JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(user_id)
);

-- Create system_metrics table for monitoring
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(20, 8) NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram')),
  tags JSONB DEFAULT '{}'::JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create platform_settings table for system configuration
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  setting_type TEXT NOT NULL CHECK (setting_type IN ('string', 'number', 'boolean', 'object', 'array')),
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Create token_reports table for flagged tokens
CREATE TABLE IF NOT EXISTS public.token_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES public.tokens(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('spam', 'scam', 'inappropriate', 'copyright', 'other')),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
  admin_notes TEXT,
  resolved_by UUID REFERENCES public.admin_users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for admin tables
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_users (only super admins can manage)
CREATE POLICY "Super admins can manage admin users" ON public.admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() AND au.admin_level = 'super_admin' AND au.is_active = TRUE
    )
  );

-- RLS Policies for system_metrics (admins can view)
CREATE POLICY "Admins can view system metrics" ON public.system_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() AND au.is_active = TRUE
    )
  );

-- RLS Policies for platform_settings
CREATE POLICY "Admins can manage platform settings" ON public.platform_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() AND au.admin_level IN ('super_admin', 'admin') AND au.is_active = TRUE
    )
  );

CREATE POLICY "Users can view public settings" ON public.platform_settings
  FOR SELECT USING (is_public = TRUE);

-- RLS Policies for token_reports
CREATE POLICY "Users can create token reports" ON public.token_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" ON public.token_reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can manage all reports" ON public.token_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() AND au.is_active = TRUE
    )
  );

-- Insert default platform settings
INSERT INTO public.platform_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES 
  ('max_daily_gasless_transactions', '10', 'number', 'Maximum gasless transactions per user per day', TRUE),
  ('min_token_creation_fee', '2000000', 'number', 'Minimum fee for token creation in lovelace', TRUE),
  ('platform_fee_percentage', '0.5', 'number', 'Platform fee percentage for transactions', TRUE),
  ('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode', FALSE),
  ('supported_wallets', '["nami", "eternl", "flint", "lace", "yoroi"]', 'array', 'List of supported wallet types', TRUE)
ON CONFLICT (setting_key) DO NOTHING;

-- Create function to record system metrics
CREATE OR REPLACE FUNCTION public.record_metric(
  p_metric_name TEXT,
  p_metric_value DECIMAL,
  p_metric_type TEXT DEFAULT 'counter',
  p_tags JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  metric_id UUID;
BEGIN
  INSERT INTO public.system_metrics (metric_name, metric_value, metric_type, tags)
  VALUES (p_metric_name, p_metric_value, p_metric_type, p_tags)
  RETURNING id INTO metric_id;
  
  RETURN metric_id;
END;
$$;

-- Create function to get platform statistics
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_tokens', (SELECT COUNT(*) FROM public.tokens),
    'total_transactions', (SELECT COUNT(*) FROM public.transactions),
    'total_gasless_transactions', (SELECT COUNT(*) FROM public.gasless_transactions),
    'active_multi_sig_wallets', (SELECT COUNT(*) FROM public.multi_sig_wallets WHERE is_active = TRUE),
    'pending_reports', (SELECT COUNT(*) FROM public.token_reports WHERE status = 'pending'),
    'total_volume_ada', (
      SELECT COALESCE(SUM(gas_fee_ada), 0) 
      FROM public.gasless_transactions 
      WHERE status = 'executed'
    )
  ) INTO stats;
  
  RETURN stats;
END;
$$;
