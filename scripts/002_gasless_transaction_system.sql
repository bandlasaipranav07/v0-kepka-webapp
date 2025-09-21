-- Create gasless_transactions table for sponsored transactions
CREATE TABLE IF NOT EXISTS public.gasless_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  sponsor_address TEXT NOT NULL,
  gas_fee_ada BIGINT NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sponsored', 'executed', 'failed')),
  signature_hash TEXT,
  nonce BIGINT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create multi_sig_wallets table for enhanced security
CREATE TABLE IF NOT EXISTS public.multi_sig_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_name TEXT NOT NULL,
  required_signatures INTEGER NOT NULL DEFAULT 2,
  total_signers INTEGER NOT NULL DEFAULT 3,
  wallet_address TEXT NOT NULL UNIQUE,
  script_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wallet_signers table for multi-sig participants
CREATE TABLE IF NOT EXISTS public.wallet_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  multi_sig_wallet_id UUID REFERENCES public.multi_sig_wallets(id) ON DELETE CASCADE,
  signer_address TEXT NOT NULL,
  signer_name TEXT,
  public_key TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(multi_sig_wallet_id, signer_address)
);

-- Create transaction_signatures table for tracking signatures
CREATE TABLE IF NOT EXISTS public.transaction_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  signer_address TEXT NOT NULL,
  signature TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(transaction_id, signer_address)
);

-- Create security_policies table for enhanced security rules
CREATE TABLE IF NOT EXISTS public.security_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  policy_name TEXT NOT NULL,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('rate_limit', 'amount_limit', 'time_lock', 'whitelist')),
  policy_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_logs table for security tracking
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for new tables
ALTER TABLE public.gasless_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multi_sig_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gasless_transactions
CREATE POLICY "Users can view their own gasless transactions" ON public.gasless_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own gasless transactions" ON public.gasless_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for multi_sig_wallets
CREATE POLICY "Users can view their own multi-sig wallets" ON public.multi_sig_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own multi-sig wallets" ON public.multi_sig_wallets
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for wallet_signers
CREATE POLICY "Users can view signers of their wallets" ON public.wallet_signers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.multi_sig_wallets 
      WHERE id = multi_sig_wallet_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage signers of their wallets" ON public.wallet_signers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.multi_sig_wallets 
      WHERE id = multi_sig_wallet_id AND user_id = auth.uid()
    )
  );

-- RLS Policies for transaction_signatures
CREATE POLICY "Users can view signatures for their transactions" ON public.transaction_signatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.transactions 
      WHERE id = transaction_id AND user_id = auth.uid()
    )
  );

-- RLS Policies for security_policies
CREATE POLICY "Users can manage their own security policies" ON public.security_policies
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for audit_logs
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Create function to generate nonce for gasless transactions
CREATE OR REPLACE FUNCTION public.generate_transaction_nonce(user_uuid UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_nonce BIGINT;
BEGIN
  SELECT COALESCE(MAX(nonce), 0) + 1 
  INTO next_nonce 
  FROM public.gasless_transactions 
  WHERE user_id = user_uuid;
  
  RETURN next_nonce;
END;
$$;

-- Create function to validate security policies
CREATE OR REPLACE FUNCTION public.validate_security_policies(
  user_uuid UUID,
  transaction_amount BIGINT,
  transaction_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  policy RECORD;
  rate_limit_config JSONB;
  amount_limit_config JSONB;
  recent_count INTEGER;
BEGIN
  -- Check all active security policies for the user
  FOR policy IN 
    SELECT * FROM public.security_policies 
    WHERE user_id = user_uuid AND is_active = TRUE
  LOOP
    CASE policy.policy_type
      WHEN 'rate_limit' THEN
        rate_limit_config := policy.policy_config;
        SELECT COUNT(*) INTO recent_count
        FROM public.transactions
        WHERE user_id = user_uuid 
          AND created_at > NOW() - INTERVAL '1 hour' * (rate_limit_config->>'hours')::INTEGER;
        
        IF recent_count >= (rate_limit_config->>'max_transactions')::INTEGER THEN
          RETURN FALSE;
        END IF;
        
      WHEN 'amount_limit' THEN
        amount_limit_config := policy.policy_config;
        IF transaction_amount > (amount_limit_config->>'max_amount')::BIGINT THEN
          RETURN FALSE;
        END IF;
        
      -- Add more policy types as needed
    END CASE;
  END LOOP;
  
  RETURN TRUE;
END;
$$;

-- Insert default security policies
INSERT INTO public.security_policies (user_id, policy_name, policy_type, policy_config)
SELECT 
  id,
  'Default Rate Limit',
  'rate_limit',
  '{"hours": 1, "max_transactions": 10}'::JSONB
FROM public.profiles
ON CONFLICT DO NOTHING;
