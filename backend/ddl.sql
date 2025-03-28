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

-- Table to store pending chat queries
CREATE TABLE pending_chats (
    chat_id UUID PRIMARY KEY REFERENCES chat_sessions(chat_id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

-- Blog sessions table to store ongoing blog generation
CREATE TABLE blog_sessions (
    blog_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blog_topic VARCHAR(2000) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, ERROR
    blog_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blog search terms from the initial breakdown
CREATE TABLE blog_search_terms (
    term_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blog_id UUID REFERENCES blog_sessions(blog_id) ON DELETE CASCADE,
    search_term VARCHAR(2000) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blog search results
CREATE TABLE blog_search_results (
    result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blog_id UUID REFERENCES blog_sessions(blog_id) ON DELETE CASCADE,
    term_id UUID REFERENCES blog_search_terms(term_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    page_age TEXT,
    summary TEXT, -- Summary of the search result content
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table to store blog generation progress for resumption
CREATE TABLE blog_generation_state (
    state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blog_id UUID REFERENCES blog_sessions(blog_id) ON DELETE CASCADE,
    current_stage VARCHAR(50) NOT NULL, -- BREAKDOWN, SEARCH, REFLECTION, PLAN, WRITE
    iteration INT DEFAULT 0, -- Current iteration for multi-step stages
    is_completed BOOLEAN DEFAULT false,
    last_event_type VARCHAR(50), -- Last event type sent to client
    last_event_data JSONB, -- Last event data sent to client
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table to store pending blog generation requests
CREATE TABLE pending_blogs (
    blog_id UUID PRIMARY KEY REFERENCES blog_sessions(blog_id) ON DELETE CASCADE,
    topic VARCHAR(2000) NOT NULL,
    current_stage VARCHAR(50) DEFAULT 'BREAKDOWN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_blog_sessions_user_id ON blog_sessions(user_id);
CREATE INDEX idx_blog_sessions_status ON blog_sessions(status);
CREATE INDEX idx_blog_search_terms_blog_id ON blog_search_terms(blog_id);
CREATE INDEX idx_blog_search_results_blog_id ON blog_search_results(blog_id);
CREATE INDEX idx_blog_search_results_term_id ON blog_search_results(term_id);
CREATE INDEX idx_blog_generation_state_blog_id ON blog_generation_state(blog_id);

-- Triggers to auto-update updated_at for blog tables
CREATE TRIGGER update_blog_sessions_updated_at
    BEFORE UPDATE ON blog_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_generation_state_updated_at
    BEFORE UPDATE ON blog_generation_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();