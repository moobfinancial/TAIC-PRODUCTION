-- Migration: Create Conversation Threads System
-- This migration creates tables for persistent conversation storage
-- Supports both anonymous users and registered users with account linking

-- Create conversation_threads table
CREATE TABLE IF NOT EXISTS conversation_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id VARCHAR(255) UNIQUE NOT NULL, -- External thread ID used by frontend
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for anonymous users
    guest_session_id VARCHAR(255), -- For anonymous users before account linking
    conversation_type VARCHAR(50) NOT NULL DEFAULT 'pioneer_ama' CHECK (conversation_type IN ('pioneer_ama', 'shopping_assistant', 'general')),
    title VARCHAR(255), -- Auto-generated from first message
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    metadata JSONB DEFAULT '{}', -- Store additional context (canvas_state, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE -- For anonymous conversations
);

-- Create conversation_messages table
CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    message_order INTEGER NOT NULL, -- Order within the conversation
    metadata JSONB DEFAULT '{}', -- Store actions, canvas_state, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_threads_thread_id ON conversation_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_user_id ON conversation_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_guest_session_id ON conversation_threads(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_created_at ON conversation_threads(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_expires_at ON conversation_threads(expires_at);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_thread_id ON conversation_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_order ON conversation_messages(thread_id, message_order);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_threads_updated_at
    BEFORE UPDATE ON conversation_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_updated_at();

-- Create function to link anonymous conversations to user accounts
CREATE OR REPLACE FUNCTION link_guest_conversations_to_user(
    p_guest_session_id VARCHAR(255),
    p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
    linked_count INTEGER;
BEGIN
    UPDATE conversation_threads
    SET user_id = p_user_id,
        guest_session_id = NULL,
        expires_at = NULL -- Remove expiration for linked conversations
    WHERE guest_session_id = p_guest_session_id
    AND user_id IS NULL;

    GET DIAGNOSTICS linked_count = ROW_COUNT;
    RETURN linked_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up expired anonymous conversations
CREATE OR REPLACE FUNCTION cleanup_expired_conversations() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM conversation_threads
    WHERE expires_at IS NOT NULL
    AND expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Record migration
INSERT INTO migrations (name) VALUES ('20250703000000_create_conversation_threads')
ON CONFLICT (name) DO NOTHING;