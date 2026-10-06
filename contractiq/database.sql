-- =============================================================================
-- ContractIQ Database Schema
-- =============================================================================
-- Production-ready database schema for ContractIQ application
-- Compatible with Supabase (PostgreSQL 15+)
--
-- Instructions:
-- 1. Create a new Supabase project at https://supabase.com
-- 2. Go to SQL Editor in your Supabase dashboard
-- 3. Paste and run this entire file
-- 4. Copy your project URL and anon key to .env.local
--
-- This schema includes:
-- - Custom enum types
-- - All application tables with proper constraints
-- - Optimized indexes for common queries
-- - Row Level Security (RLS) policies
-- - Automatic timestamp triggers
-- - Storage bucket configuration
-- - Service role policies for API access
-- =============================================================================


-- =============================================================================
-- SECTION 1: Extensions
-- =============================================================================
-- Enable required PostgreSQL extensions

-- UUID generation (usually pre-enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Full-text search (for future search functionality)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- =============================================================================
-- SECTION 2: Custom Types (Enums)
-- =============================================================================
-- Define application-specific enum types for type safety

-- Contract type: NDA (Non-Disclosure Agreement) or MSA (Master Service Agreement)
DO $$ BEGIN
    CREATE TYPE contract_type AS ENUM ('nda', 'msa');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Contract processing status
DO $$ BEGIN
    CREATE TYPE contract_status AS ENUM ('pending', 'processing', 'completed', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Chat message role
DO $$ BEGIN
    CREATE TYPE chat_role AS ENUM ('user', 'assistant');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- =============================================================================
-- SECTION 3: Tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: contracts
-- Description: Stores uploaded contracts with metadata and extracted text
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contracts (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign key to auth.users (Supabase Auth)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Contract metadata
    name TEXT NOT NULL CHECK (char_length(name) <= 255),
    type contract_type NOT NULL,
    status contract_status NOT NULL DEFAULT 'pending',

    -- Extracted content
    contract_text TEXT,

    -- Storage reference (path in Supabase Storage)
    file_path TEXT,

    -- Document metadata
    page_count INTEGER CHECK (page_count > 0 AND page_count <= 100),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add table comment
COMMENT ON TABLE contracts IS 'Stores uploaded contract documents with extracted text and metadata';
COMMENT ON COLUMN contracts.file_path IS 'Path to PDF file in Supabase Storage (format: user_id/contract_id/filename.pdf)';
COMMENT ON COLUMN contracts.contract_text IS 'Full extracted text from PDF for AI processing';


-- -----------------------------------------------------------------------------
-- Table: key_terms
-- Description: Stores AI-extracted key terms for each contract
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS key_terms (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign key to contracts
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

    -- Term data
    term_name TEXT NOT NULL CHECK (char_length(term_name) <= 100),
    value TEXT,

    -- Source reference
    page_number INTEGER CHECK (page_number > 0),
    source_sentence TEXT,

    -- AI confidence (0.00 to 1.00)
    confidence_score NUMERIC(3,2) DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),

    -- Edit tracking
    is_manual BOOLEAN NOT NULL DEFAULT false,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    original_value TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add table comment
COMMENT ON TABLE key_terms IS 'Stores extracted key terms from contracts with confidence scores';
COMMENT ON COLUMN key_terms.confidence_score IS 'AI confidence score from 0.00 (low) to 1.00 (high)';
COMMENT ON COLUMN key_terms.is_manual IS 'True if this is a user-defined custom term';
COMMENT ON COLUMN key_terms.original_value IS 'Original AI-extracted value before user edits';


-- -----------------------------------------------------------------------------
-- Table: custom_key_terms
-- Description: Stores user-defined terms to extract (before processing)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_key_terms (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign key to contracts
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

    -- Term name to extract
    term_name TEXT NOT NULL CHECK (char_length(term_name) <= 100),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure unique term names per contract
    UNIQUE(contract_id, term_name)
);

COMMENT ON TABLE custom_key_terms IS 'User-defined terms to extract during contract processing';


-- -----------------------------------------------------------------------------
-- Table: chat_sessions
-- Description: Stores chat sessions per contract (one session per contract)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign key to contracts
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One chat session per contract
    UNIQUE(contract_id)
);

COMMENT ON TABLE chat_sessions IS 'Chat sessions for contract Q&A (one per contract)';


-- -----------------------------------------------------------------------------
-- Table: chat_messages
-- Description: Stores individual chat messages within sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign key to chat_sessions
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,

    -- Message data
    role chat_role NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) <= 10000),

    -- Page citation (if assistant references a specific page)
    page_citation INTEGER CHECK (page_citation > 0),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE chat_messages IS 'Individual messages in chat sessions';
COMMENT ON COLUMN chat_messages.page_citation IS 'Page number referenced by assistant in response';


-- -----------------------------------------------------------------------------
-- Table: user_feedback
-- Description: Stores user feedback on contract analyses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_feedback (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

    -- Feedback data
    rating INTEGER NOT NULL CHECK (rating IN (-1, 1)),
    comment TEXT CHECK (char_length(comment) <= 1000),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One feedback per user per contract
    UNIQUE(user_id, contract_id)
);

COMMENT ON TABLE user_feedback IS 'User feedback on contract analysis quality';
COMMENT ON COLUMN user_feedback.rating IS 'Thumbs up (1) or thumbs down (-1)';


-- =============================================================================
-- SECTION 4: Indexes
-- =============================================================================
-- Optimized indexes for common query patterns

-- Contracts indexes
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_user_created ON contracts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(type);

-- Key terms indexes
CREATE INDEX IF NOT EXISTS idx_key_terms_contract_id ON key_terms(contract_id);
CREATE INDEX IF NOT EXISTS idx_key_terms_confidence ON key_terms(contract_id, confidence_score DESC);

-- Custom key terms indexes
CREATE INDEX IF NOT EXISTS idx_custom_key_terms_contract_id ON custom_key_terms(contract_id);

-- Chat sessions indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_contract_id ON chat_sessions(contract_id);

-- Chat messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at ASC);

-- User feedback indexes
CREATE INDEX IF NOT EXISTS idx_user_feedback_contract_id ON user_feedback(contract_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);


-- =============================================================================
-- SECTION 5: Functions & Triggers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Function: update_updated_at_column
-- Description: Automatically updates the updated_at timestamp on row update
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for contracts table
DROP TRIGGER IF EXISTS update_contracts_updated_at ON contracts;
CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- -----------------------------------------------------------------------------
-- Function: get_contract_stats
-- Description: Returns contract statistics for a user
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_contract_stats(p_user_id UUID)
RETURNS TABLE (
    total BIGINT,
    nda_count BIGINT,
    msa_count BIGINT,
    pending_count BIGINT,
    completed_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total,
        COUNT(*) FILTER (WHERE type = 'nda')::BIGINT as nda_count,
        COUNT(*) FILTER (WHERE type = 'msa')::BIGINT as msa_count,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_count,
        COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_count
    FROM contracts
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- SECTION 6: Row Level Security (RLS)
-- =============================================================================
-- Enable RLS and define access policies for multi-tenant security

-- Enable RLS on all tables
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_key_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Contracts Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own contracts" ON contracts;
CREATE POLICY "Users can view their own contracts"
    ON contracts FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own contracts" ON contracts;
CREATE POLICY "Users can insert their own contracts"
    ON contracts FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own contracts" ON contracts;
CREATE POLICY "Users can update their own contracts"
    ON contracts FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own contracts" ON contracts;
CREATE POLICY "Users can delete their own contracts"
    ON contracts FOR DELETE
    USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Key Terms Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view key terms for their contracts" ON key_terms;
CREATE POLICY "Users can view key terms for their contracts"
    ON key_terms FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM contracts
            WHERE contracts.id = key_terms.contract_id
            AND contracts.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert key terms for their contracts" ON key_terms;
CREATE POLICY "Users can insert key terms for their contracts"
    ON key_terms FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM contracts
            WHERE contracts.id = key_terms.contract_id
            AND contracts.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update key terms for their contracts" ON key_terms;
CREATE POLICY "Users can update key terms for their contracts"
    ON key_terms FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM contracts
            WHERE contracts.id = key_terms.contract_id
            AND contracts.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete key terms for their contracts" ON key_terms;
CREATE POLICY "Users can delete key terms for their contracts"
    ON key_terms FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM contracts
            WHERE contracts.id = key_terms.contract_id
            AND contracts.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- Custom Key Terms Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view custom terms for their contracts" ON custom_key_terms;
CREATE POLICY "Users can view custom terms for their contracts"
    ON custom_key_terms FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM contracts
            WHERE contracts.id = custom_key_terms.contract_id
            AND contracts.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert custom terms for their contracts" ON custom_key_terms;
CREATE POLICY "Users can insert custom terms for their contracts"
    ON custom_key_terms FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM contracts
            WHERE contracts.id = custom_key_terms.contract_id
            AND contracts.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete custom terms for their contracts" ON custom_key_terms;
CREATE POLICY "Users can delete custom terms for their contracts"
    ON custom_key_terms FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM contracts
            WHERE contracts.id = custom_key_terms.contract_id
            AND contracts.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- Chat Sessions Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view chat sessions for their contracts" ON chat_sessions;
CREATE POLICY "Users can view chat sessions for their contracts"
    ON chat_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM contracts
            WHERE contracts.id = chat_sessions.contract_id
            AND contracts.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert chat sessions for their contracts" ON chat_sessions;
CREATE POLICY "Users can insert chat sessions for their contracts"
    ON chat_sessions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM contracts
            WHERE contracts.id = chat_sessions.contract_id
            AND contracts.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- Chat Messages Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view chat messages for their sessions" ON chat_messages;
CREATE POLICY "Users can view chat messages for their sessions"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions cs
            JOIN contracts c ON cs.contract_id = c.id
            WHERE cs.id = chat_messages.session_id
            AND c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert chat messages for their sessions" ON chat_messages;
CREATE POLICY "Users can insert chat messages for their sessions"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions cs
            JOIN contracts c ON cs.contract_id = c.id
            WHERE cs.id = chat_messages.session_id
            AND c.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- User Feedback Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own feedback" ON user_feedback;
CREATE POLICY "Users can view their own feedback"
    ON user_feedback FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own feedback" ON user_feedback;
CREATE POLICY "Users can insert their own feedback"
    ON user_feedback FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own feedback" ON user_feedback;
CREATE POLICY "Users can update their own feedback"
    ON user_feedback FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- =============================================================================
-- SECTION 7: Storage Configuration
-- =============================================================================
-- Configure Supabase Storage bucket for contract PDFs

-- Create the contracts storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'contracts',
    'contracts',
    false,                          -- Private bucket
    10485760,                       -- 10 MB file size limit
    ARRAY['application/pdf']        -- Only PDF files allowed
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Storage Policies
-- -----------------------------------------------------------------------------

-- Users can upload files to their own folder (user_id/contract_id/filename.pdf)
DROP POLICY IF EXISTS "Users can upload their own contract files" ON storage.objects;
CREATE POLICY "Users can upload their own contract files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'contracts' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can view/download their own files
DROP POLICY IF EXISTS "Users can view their own contract files" ON storage.objects;
CREATE POLICY "Users can view their own contract files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'contracts' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can update their own files
DROP POLICY IF EXISTS "Users can update their own contract files" ON storage.objects;
CREATE POLICY "Users can update their own contract files"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'contracts' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own files
DROP POLICY IF EXISTS "Users can delete their own contract files" ON storage.objects;
CREATE POLICY "Users can delete their own contract files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'contracts' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );


-- =============================================================================
-- SECTION 8: Service Role Policies (for API routes)
-- =============================================================================
-- These policies allow the service role to bypass RLS when needed
-- The service role key should only be used in server-side code

DROP POLICY IF EXISTS "Service role has full access to contracts" ON contracts;
CREATE POLICY "Service role has full access to contracts"
    ON contracts FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role has full access to key_terms" ON key_terms;
CREATE POLICY "Service role has full access to key_terms"
    ON key_terms FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role has full access to custom_key_terms" ON custom_key_terms;
CREATE POLICY "Service role has full access to custom_key_terms"
    ON custom_key_terms FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role has full access to chat_sessions" ON chat_sessions;
CREATE POLICY "Service role has full access to chat_sessions"
    ON chat_sessions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role has full access to chat_messages" ON chat_messages;
CREATE POLICY "Service role has full access to chat_messages"
    ON chat_messages FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role has full access to user_feedback" ON user_feedback;
CREATE POLICY "Service role has full access to user_feedback"
    ON user_feedback FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');


-- =============================================================================
-- SECTION 9: Grants (Optional - for custom roles)
-- =============================================================================
-- Grant necessary permissions to authenticated users

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION get_contract_stats(UUID) TO authenticated;


-- =============================================================================
-- End of Schema
-- =============================================================================
--
-- Post-Setup Checklist:
-- [ ] Enable Email Auth in Supabase Dashboard > Authentication > Providers
-- [ ] Configure Site URL and Redirect URLs in Authentication > URL Configuration
-- [ ] Copy NEXT_PUBLIC_SUPABASE_URL to .env.local
-- [ ] Copy NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local
-- [ ] Copy SUPABASE_SERVICE_ROLE_KEY to .env.local (keep this secret!)
-- [ ] Add OpenAI API key to .env.local
-- =============================================================================
