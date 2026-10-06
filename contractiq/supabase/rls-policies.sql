-- =============================================================================
-- ContractIQ Security: Row Level Security Policies & Rate Limiting
-- =============================================================================
-- Run this in the Supabase SQL Editor to set up security controls.
-- This file is idempotent - safe to run multiple times.
-- =============================================================================


-- =============================================================================
-- SECTION 1: Rate Limit Events Table
-- =============================================================================
-- Used by the Supabase-based rate limiter. All access is via service role.

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient lookups by user, action, and time window
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
  ON rate_limit_events (user_id, action, created_at DESC);

-- Enable RLS but with NO user-facing policies
-- Only service role can read/write this table
ALTER TABLE rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Cleanup policy: Supabase pg_cron can call this daily
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-rate-limits', '0 3 * * *', $$
--   DELETE FROM rate_limit_events WHERE created_at < now() - interval '24 hours'
-- $$);


-- =============================================================================
-- SECTION 2: Contracts Table RLS
-- =============================================================================

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own contracts
DROP POLICY IF EXISTS "Users can view own contracts" ON contracts;
CREATE POLICY "Users can view own contracts"
  ON contracts FOR SELECT
  USING (user_id = auth.uid());

-- Users can only insert contracts for themselves
DROP POLICY IF EXISTS "Users can insert own contracts" ON contracts;
CREATE POLICY "Users can insert own contracts"
  ON contracts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can only update their own contracts
DROP POLICY IF EXISTS "Users can update own contracts" ON contracts;
CREATE POLICY "Users can update own contracts"
  ON contracts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can only delete their own contracts
DROP POLICY IF EXISTS "Users can delete own contracts" ON contracts;
CREATE POLICY "Users can delete own contracts"
  ON contracts FOR DELETE
  USING (user_id = auth.uid());


-- =============================================================================
-- SECTION 3: Key Terms Table RLS
-- =============================================================================

ALTER TABLE key_terms ENABLE ROW LEVEL SECURITY;

-- Users can view key terms for their contracts
DROP POLICY IF EXISTS "Users can view own key_terms" ON key_terms;
CREATE POLICY "Users can view own key_terms"
  ON key_terms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = key_terms.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

-- Users can insert key terms for their contracts
DROP POLICY IF EXISTS "Users can insert own key_terms" ON key_terms;
CREATE POLICY "Users can insert own key_terms"
  ON key_terms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = key_terms.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

-- Users can update key terms for their contracts
DROP POLICY IF EXISTS "Users can update own key_terms" ON key_terms;
CREATE POLICY "Users can update own key_terms"
  ON key_terms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = key_terms.contract_id
      AND contracts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = key_terms.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

-- Users can delete key terms for their contracts
DROP POLICY IF EXISTS "Users can delete own key_terms" ON key_terms;
CREATE POLICY "Users can delete own key_terms"
  ON key_terms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = key_terms.contract_id
      AND contracts.user_id = auth.uid()
    )
  );


-- =============================================================================
-- SECTION 4: Custom Key Terms Table RLS
-- =============================================================================

ALTER TABLE custom_key_terms ENABLE ROW LEVEL SECURITY;

-- Users can view custom terms for their contracts
DROP POLICY IF EXISTS "Users can view own custom_key_terms" ON custom_key_terms;
CREATE POLICY "Users can view own custom_key_terms"
  ON custom_key_terms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = custom_key_terms.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

-- Users can insert custom terms for their contracts
DROP POLICY IF EXISTS "Users can insert own custom_key_terms" ON custom_key_terms;
CREATE POLICY "Users can insert own custom_key_terms"
  ON custom_key_terms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = custom_key_terms.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

-- Users can delete custom terms for their contracts
DROP POLICY IF EXISTS "Users can delete own custom_key_terms" ON custom_key_terms;
CREATE POLICY "Users can delete own custom_key_terms"
  ON custom_key_terms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = custom_key_terms.contract_id
      AND contracts.user_id = auth.uid()
    )
  );


-- =============================================================================
-- SECTION 5: Chat Sessions Table RLS
-- =============================================================================

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view chat sessions for their contracts
DROP POLICY IF EXISTS "Users can view own chat_sessions" ON chat_sessions;
CREATE POLICY "Users can view own chat_sessions"
  ON chat_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = chat_sessions.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

-- Users can insert chat sessions for their contracts
DROP POLICY IF EXISTS "Users can insert own chat_sessions" ON chat_sessions;
CREATE POLICY "Users can insert own chat_sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = chat_sessions.contract_id
      AND contracts.user_id = auth.uid()
    )
  );


-- =============================================================================
-- SECTION 6: Chat Messages Table RLS
-- =============================================================================

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages in their chat sessions
DROP POLICY IF EXISTS "Users can view own chat_messages" ON chat_messages;
CREATE POLICY "Users can view own chat_messages"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      JOIN contracts ON contracts.id = chat_sessions.contract_id
      WHERE chat_sessions.id = chat_messages.session_id
      AND contracts.user_id = auth.uid()
    )
  );

-- Users can insert messages in their chat sessions
DROP POLICY IF EXISTS "Users can insert own chat_messages" ON chat_messages;
CREATE POLICY "Users can insert own chat_messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions
      JOIN contracts ON contracts.id = chat_sessions.contract_id
      WHERE chat_sessions.id = chat_messages.session_id
      AND contracts.user_id = auth.uid()
    )
  );


-- =============================================================================
-- SECTION 7: User Feedback Table RLS
-- =============================================================================

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON user_feedback;
CREATE POLICY "Users can view own feedback"
  ON user_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = user_feedback.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

-- Users can submit feedback for their contracts
DROP POLICY IF EXISTS "Users can insert own feedback" ON user_feedback;
CREATE POLICY "Users can insert own feedback"
  ON user_feedback FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = user_feedback.contract_id
      AND contracts.user_id = auth.uid()
    )
  );


-- =============================================================================
-- SECTION 8: Storage Bucket Policies
-- =============================================================================
-- Note: Storage policies are managed via Supabase Dashboard or via API.
-- The contracts bucket should be private with signed URL access only.

-- These are informational comments for manual setup:
-- 1. Create a private bucket named "contracts"
-- 2. Enable RLS on the bucket
-- 3. Add policy: Users can upload to their own folder (user_id/*)
-- 4. Add policy: Users can read from their own folder
-- 5. Signed URLs expire after 1 hour

-- Example storage policy (run in Supabase Dashboard > Storage > Policies):
/*
-- Allow users to upload to their own folder
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to read their own files
CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
*/


-- =============================================================================
-- SECTION 9: Security Verification Queries
-- =============================================================================
-- Run these to verify RLS is enabled on all tables

SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'contracts',
  'key_terms',
  'custom_key_terms',
  'chat_sessions',
  'chat_messages',
  'user_feedback',
  'rate_limit_events'
);

-- List all RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
