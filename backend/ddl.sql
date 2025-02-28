-- Chat sessions table to store ongoing conversations
CREATE TABLE chat_sessions (
    chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_title VARCHAR(2000) NOT NULL,  -- Added chat_title field
    user_id VARCHAR(50) NOT NULL,  -- Added user_id field
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages to store queries and responses
CREATE TABLE chat_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES chat_sessions(chat_id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    user_query VARCHAR(2000) NOT NULL,
    ai_response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create additional index for user_id lookups
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);

-- Search results table to store all search results
CREATE TABLE search_results (
    result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES chat_sessions(chat_id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_messages(message_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    is_source_local BOOLEAN DEFAULT false,
    is_source_both BOOLEAN DEFAULT false,
    description TEXT,
    page_age TEXT,
    language TEXT,
    family_friendly BOOLEAN DEFAULT true,
    type TEXT,
    subtype TEXT,
    is_live BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Profile information for search results
CREATE TABLE result_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID REFERENCES search_results(result_id) ON DELETE CASCADE,
    name TEXT,
    url TEXT,
    long_name TEXT,
    img TEXT
);

-- Meta URL information for search results
CREATE TABLE result_meta_urls (
    meta_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID REFERENCES search_results(result_id) ON DELETE CASCADE,
    scheme TEXT,
    netloc TEXT,
    hostname TEXT,
    favicon TEXT,
    path TEXT
);

-- Thumbnails for search results
CREATE TABLE result_thumbnails (
    thumbnail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID REFERENCES search_results(result_id) ON DELETE CASCADE,
    src TEXT,
    original TEXT,
    is_logo BOOLEAN DEFAULT false
);

-- Create indexes for better query performance
CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_search_results_chat_id ON search_results(chat_id);
CREATE INDEX idx_search_results_message_id ON search_results(message_id);
CREATE INDEX idx_result_profiles_result_id ON result_profiles(result_id);
CREATE INDEX idx_result_meta_urls_result_id ON result_meta_urls(result_id);
CREATE INDEX idx_result_thumbnails_result_id ON result_thumbnails(result_id);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();