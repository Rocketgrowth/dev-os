-- =============================================================================
-- ContractIQ Supabase Schema
-- =============================================================================
-- Run this entire file in the Supabase SQL Editor on a fresh project.
-- All tables, indexes, RLS policies, triggers, and storage setup included.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------

-- Enable UUID generation (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 2. Custom Types (Enums)
-- -----------------------------------------------------------------------------

-- Contract type enum
CREATE TYPE contract_type AS ENUM ('nda', 'msa');

-- Contract processing status enum
CREATE TYPE contract_status AS ENUM ('pending', 'processing', 'completed', 'error');

-- Chat message role enum
CREATE TYPE chat_role AS ENUM ('user', 'assistant');

-- -----------------------------------------------------------------------------
-- 3. Tables
-- -----------------------------------------------------------------------------

-- Contracts table
-- Stores uploaded contracts with extracted text
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type contract_type NOT NULL,
    status contract_status NOT NULL DEFAULT 'pending',
    contract_text TEXT,
    file_path TEXT,
    page_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Key terms table
-- Stores extracted key terms for each contract
CREATE TABLE key_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    term_name TEXT NOT NULL,
    value TEXT,
    page_number INTEGER,
    confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    source_sentence TEXT,
    is_manual BOOLEAN NOT NULL DEFAULT false,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    original_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Custom key terms table
-- Stores user-defined terms to extract (before processing)
CREATE TABLE custom_key_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    term_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat sessions table
-- Stores chat sessions per contract
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat messages table
-- Stores individual chat messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role chat_role NOT NULL,
    content TEXT NOT NULL,
    page_citation INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User feedback table
-- Stores user feedback on contract analyses
CREATE TABLE user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating IN (-1, 1)),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. Indexes
-- -----------------------------------------------------------------------------

-- Contracts indexes
CREATE INDEX idx_contracts_user_id ON contracts(user_id);
CREATE INDEX idx_contracts_created_at ON contracts(created_at DESC);
CREATE INDEX idx_contracts_status ON contracts(status);

-- Key terms indexes
CREATE INDEX idx_key_terms_contract_id ON key_terms(contract_id);

-- Custom key terms indexes
CREATE INDEX idx_custom_key_terms_contract_id ON custom_key_terms(contract_id);

-- Chat sessions indexes
CREATE INDEX idx_chat_sessions_contract_id ON chat_sessions(contract_id);

-- Chat messages indexes
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at ASC);

-- User feedback indexes
CREATE INDEX idx_user_feedback_contract_id ON user_feedback(contract_id);
CREATE INDEX idx_user_feedback_user_id ON user_feedback(user_id);

-- -----------------------------------------------------------------------------
-- 5. Updated_at Triggers
-- -----------------------------------------------------------------------------

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for contracts table
CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 6. Row Level Security (RLS)
-- -----------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_key_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Contracts policies
CREATE POLICY "Users can view their own contracts"
    ON contracts FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own contracts"
    ON contracts FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own contracts"
    ON contracts FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own contracts"
    ON contracts FOR DELETE
    USING (user_id = auth.uid());

-- Key terms policies
CREATE POLICY "Users can view key terms for their own contracts"
    ON key_terms FOR SELECT
    USING (
        contract_id IN (
            SELECT id FROM contracts WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert key terms for their own contracts"
    ON key_terms FOR INSERT
    WITH CHECK (
        contract_id IN (
            SELECT id FROM contracts WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update key terms for their own contracts"
    ON key_terms FOR UPDATE
    USING (
        contract_id IN (
            SELECT id FROM contracts WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        contract_id IN (
            SELECT id FROM contracts WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete key terms for their own contracts"
    ON key_terms FOR DELETE
    USING (
        contract_id IN (
            SELECT id FROM contracts WHERE user_id = auth.uid()
        )
    );

-- Custom key terms policies
CREATE POLICY "Users can view custom terms for their own contracts"
    ON custom_key_terms FOR SELECT
    USING (
        contract_id IN (
            SELECT id FROM contracts WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert custom terms for their own contracts"
    ON custom_key_terms FOR INSERT
    WITH CHECK (
        contract_id IN (
            SELECT id FROM contracts WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete custom terms for their own contracts"
    ON custom_key_terms FOR DELETE
    USING (
        contract_id IN (
            SELECT id FROM contracts WHERE user_id = auth.uid()
        )
    );

-- Chat sessions policies
CREATE POLICY "Users can view chat sessions for their own contracts"
    ON chat_sessions FOR SELECT
    USING (
        contract_id IN (
            SELECT id FROM contracts WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert chat sessions for their own contracts"
    ON chat_sessions FOR INSERT
    WITH CHECK (
        contract_id IN (
            SELECT id FROM contracts WHERE user_id = auth.uid()
        )
    );

-- Chat messages policies
CREATE POLICY "Users can view chat messages for their own sessions"
    ON chat_messages FOR SELECT
    USING (
        session_id IN (
            SELECT cs.id FROM chat_sessions cs
            JOIN contracts c ON cs.contract_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert chat messages for their own sessions"
    ON chat_messages FOR INSERT
    WITH CHECK (
        session_id IN (
            SELECT cs.id FROM chat_sessions cs
            JOIN contracts c ON cs.contract_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );

-- User feedback policies
CREATE POLICY "Users can view their own feedback"
    ON user_feedback FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own feedback"
    ON user_feedback FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 7. Storage Bucket and Policies
-- -----------------------------------------------------------------------------

-- Create the contracts storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'contracts',
    'contracts',
    false,
    10485760, -- 10 MB
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for contracts bucket

-- Users can upload files to their own folder
CREATE POLICY "Users can upload their own contracts"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'contracts' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can view/download their own files
CREATE POLICY "Users can view their own contracts"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'contracts' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own files
CREATE POLICY "Users can delete their own contracts"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'contracts' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- -----------------------------------------------------------------------------
-- 8. Service Role Policies (for API routes)
-- -----------------------------------------------------------------------------

-- These policies allow the service role to perform operations
-- The service role bypasses RLS by default, but we add explicit policies
-- for documentation purposes and in case RLS is enforced on service role

CREATE POLICY "Service role can manage all contracts"
    ON contracts FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all key terms"
    ON key_terms FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all custom key terms"
    ON custom_key_terms FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all chat sessions"
    ON chat_sessions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all chat messages"
    ON chat_messages FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all feedback"
    ON user_feedback FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------------------------------------------------------
-- End of Schema
-- -----------------------------------------------------------------------------
