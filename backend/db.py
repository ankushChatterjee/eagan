import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
import os
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(level=logging.ERROR, format='%(asctime)s - %(levelname)s - %(message)s')

load_dotenv()

class Database:
    def __init__(self):
        self.conn = psycopg2.connect(
            dbname=os.getenv('DB_NAME', 'postgres'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'postgres'),
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432')
        )
        self.conn.autocommit = True

    def get_cursor(self):
        return self.conn.cursor(cursor_factory=RealDictCursor)

    def create_chat_session(self, user_id: str, chat_title: str, query: str) -> dict:
        """Create a new chat session with a title and add the query to pending chats"""
        with self.get_cursor() as cur:
            cur.execute("""
                INSERT INTO chat_sessions (user_id, chat_title)
                VALUES (%s, %s)
                RETURNING chat_id, user_id, chat_title, created_at, updated_at
            """, (user_id, chat_title))
            session = cur.fetchone()
            self.create_pending_chat(session['chat_id'], chat_title)
            return session

    def create_chat_message(self, chat_id: str, user_id: str, user_query: str, ai_response: str) -> dict:
        """Create a new chat message with both user query and AI response"""
        with self.get_cursor() as cur:
            cur.execute("""
                INSERT INTO chat_messages (chat_id, user_id, user_query, ai_response)
                VALUES (%s, %s, %s, %s)
                RETURNING message_id, chat_id, created_at
            """, (chat_id, user_id, user_query, ai_response))
            return cur.fetchone()

    def store_search_results(self, chat_id: str, message_id: str, results: List[Dict[str, Any]]) -> List[str]:
        """Store search results and their related data"""
        result_ids = []
        with self.get_cursor() as cur:
            for result in results:
                # Insert main search result
                cur.execute("""
                    INSERT INTO search_results (
                        chat_id, message_id, title, url, is_source_local, 
                        is_source_both, description, page_age, language, 
                        family_friendly, type, subtype, is_live
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING result_id
                """, (
                    chat_id, message_id, result.get('title'), result.get('url'),
                    result.get('is_source_local', False), result.get('is_source_both', False),
                    result.get('description'), result.get('page_age'),
                    result.get('language'), result.get('family_friendly', True),
                    result.get('type'), result.get('subtype'),
                    result.get('is_live', False)
                ))
                result_id = cur.fetchone()['result_id']
                result_ids.append(result_id)

                # Store profile if exists
                if profile := result.get('profile'):
                    cur.execute("""
                        INSERT INTO result_profiles (result_id, name, url, long_name, img)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (result_id, profile.get('name'), profile.get('url'),
                          profile.get('long_name'), profile.get('img')))

                # Store meta_url if exists
                if meta_url := result.get('meta_url'):
                    cur.execute("""
                        INSERT INTO result_meta_urls (
                            result_id, scheme, netloc, hostname, favicon, path
                        )
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (result_id, meta_url.get('scheme'), meta_url.get('netloc'),
                          meta_url.get('hostname'), meta_url.get('favicon'),
                          meta_url.get('path')))

                # Store thumbnail if exists
                if thumbnail := result.get('thumbnail'):
                    cur.execute("""
                        INSERT INTO result_thumbnails (
                            result_id, src, original, is_logo
                        )
                        VALUES (%s, %s, %s, %s)
                    """, (result_id, thumbnail.get('src'), thumbnail.get('original'),
                          thumbnail.get('logo', False)))

        return result_ids

    def get_chat_history(self, chat_id: str) -> List[dict]:
        """Get all messages for a chat session"""
        try:
            logging.info(f"Fetching chat history for chat_id: {chat_id}")
            with self.get_cursor() as cur:
                cur.execute("""
                    SELECT message_id, user_query, ai_response, created_at
                    FROM chat_messages
                    WHERE chat_id = %s
                    ORDER BY created_at ASC
                """, (chat_id,))
                results = cur.fetchall()
                logging.info(f"Fetched {len(results)} messages for chat_id: {chat_id}")
                return results
        except Exception as e:
            logging.error(f"Error fetching chat history for chat_id {chat_id}: {e}")
            return []

    def get_latest_chat_message(self, chat_id: str) -> dict:
        """Get the most recent message from a chat session"""
        with self.get_cursor() as cur:
            cur.execute("""
                SELECT message_id, user_query, ai_response, created_at
                FROM chat_messages
                WHERE chat_id = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (chat_id,))
            return cur.fetchone()

    def get_user_chats(self, user_id: str) -> List[dict]:
        """Get all chat sessions for a user"""
        with self.get_cursor() as cur:
            cur.execute("""
                SELECT chat_id, created_at, updated_at, chat_title
                FROM chat_sessions
                WHERE user_id = %s
                ORDER BY updated_at DESC
            """, (user_id,))
            return cur.fetchall()

    def get_chat_details(self, chat_id: str) -> List[dict]:
        """Get all details for a chat session using a single join query"""
        try:
            with self.get_cursor() as cur:
                cur.execute("""
                    SELECT 
                        cm.message_id, cm.user_query, cm.ai_response, cm.created_at,
                        sr.title, sr.url, sr.description, sr.page_age, sr.language, 
                        sr.family_friendly, sr.type, sr.subtype, sr.is_live,
                        rmu.scheme, rmu.netloc, rmu.hostname, rmu.favicon, rmu.path,
                        rt.src AS thumbnail_src, rt.original AS thumbnail_original, rt.is_logo AS thumbnail_is_logo
                    FROM chat_messages cm
                    LEFT JOIN search_results sr ON cm.message_id = sr.message_id
                    LEFT JOIN result_meta_urls rmu ON sr.result_id = rmu.result_id
                    LEFT JOIN result_thumbnails rt ON sr.result_id = rt.result_id
                    WHERE cm.chat_id = %s
                    ORDER BY cm.created_at ASC
                """, (chat_id,))
                results = cur.fetchall()

                # Group search results by message_id
                messages = {}
                for row in results:
                    message_id = row['message_id']
                    if message_id not in messages:
                        messages[message_id] = {
                            'message_id': message_id,
                            'user_query': row['user_query'],
                            'summary': row['ai_response'],
                            'created_at': row['created_at'].isoformat(),
                            'search_results': []
                        }
                    if row['title']:
                        search_result = {
                            'title': row['title'],
                            'url': row['url'],
                            'description': row['description'],
                            'page_age': row['page_age'],
                            'language': row['language'],
                            'family_friendly': row['family_friendly'],
                            'type': row['type'],
                            'subtype': row['subtype'],
                            'is_live': row['is_live'],
                            'meta_url': {
                                'scheme': row['scheme'],
                                'netloc': row['netloc'],
                                'hostname': row['hostname'],
                                'favicon': row['favicon'],
                                'path': row['path']
                            },
                            'thumbnail': {
                                'src': row['thumbnail_src'],
                                'original': row['thumbnail_original'],
                                'is_logo': row['thumbnail_is_logo']
                            }
                        }
                        messages[message_id]['search_results'].append(search_result)
                return list(messages.values())
        except Exception as e:
            logging.error(f"Error fetching chat details for chat_id {chat_id}: {e}")
            return []

    def create_pending_chat(self, chat_id: str, query: str) -> dict:
        """Create a new pending chat or update if it already exists"""
        with self.get_cursor() as cur:
            cur.execute("""
                INSERT INTO pending_chats (chat_id, query)
                VALUES (%s, %s)
                ON CONFLICT (chat_id) DO UPDATE
                SET query = EXCLUDED.query
                RETURNING chat_id, query, created_at
            """, (chat_id, query))
            return cur.fetchone()

    def update_pending_chat(self, chat_id: str, query: str) -> dict:
        """Update an existing pending chat"""
        with self.get_cursor() as cur:
            cur.execute("""
                UPDATE pending_chats
                SET query = %s
                WHERE chat_id = %s
                RETURNING chat_id, query, created_at
            """, (query, chat_id))
            return cur.fetchone()

    def delete_pending_chat(self, chat_id: str) -> None:
        """Delete a pending chat"""
        with self.get_cursor() as cur:
            cur.execute("""
                DELETE FROM pending_chats
                WHERE chat_id = %s
            """, (chat_id,))

    def get_pending_chat(self, chat_id: str) -> Optional[dict]:
        """Get the pending query for a chat session"""
        with self.get_cursor() as cur:
            cur.execute("""
                SELECT query
                FROM pending_chats
                WHERE chat_id = %s
            """, (chat_id,))
            return cur.fetchone()

    def create_blog_session(self, user_id: str, blog_topic: str) -> dict:
        """Create a new blog session and return its details"""
        with self.get_cursor() as cur:
            cur.execute("""
                INSERT INTO blog_sessions (user_id, blog_topic)
                VALUES (%s, %s)
                RETURNING blog_id, user_id, blog_topic, status, created_at
            """, (user_id, blog_topic))
            session = cur.fetchone()
            self.create_pending_blog(session['blog_id'], blog_topic)
            return session

    def update_blog_status(self, blog_id: str, status: str, blog_content: str = None) -> dict:
        """Update blog session status and content"""
        with self.get_cursor() as cur:
            if blog_content:
                cur.execute("""
                    UPDATE blog_sessions
                    SET status = %s, blog_content = %s
                    WHERE blog_id = %s
                    RETURNING blog_id, status, blog_content, updated_at
                """, (status, blog_content, blog_id))
            else:
                cur.execute("""
                    UPDATE blog_sessions
                    SET status = %s
                    WHERE blog_id = %s
                    RETURNING blog_id, status, updated_at
                """, (status, blog_id))
            return cur.fetchone()

    def add_blog_search_terms(self, blog_id: str, search_terms: List[str]) -> List[dict]:
        """Add multiple search terms for a blog session"""
        with self.get_cursor() as cur:
            values = [(blog_id, term) for term in search_terms]
            execute_values(cur, """
                INSERT INTO blog_search_terms (blog_id, search_term)
                VALUES %s
                RETURNING term_id, search_term, created_at
            """, values)
            return cur.fetchall()

    def store_blog_search_results(self, blog_id: str, results: List[Dict[str, Any]], term_id: str = None) -> List[str]:
        """Store search results for blog search terms
        
        If term_id is None, assumes each result in results contains its own term_id
        Otherwise, assigns the same term_id to all results
        """
        result_ids = []
        with self.get_cursor() as cur:
            if term_id is not None:
                # Original functionality - all results belong to the same term
                values = [(
                    blog_id,
                    term_id,
                    result['title'],
                    result['url'],
                    result.get('description'),
                    result.get('page_age'),
                    result.get('summary', '')
                ) for result in results]
            else:
                # Batch processing - each result has its own term_id
                values = [(
                    blog_id,
                    result['term_id'],
                    result['title'],
                    result['url'],
                    result.get('description'),
                    result.get('page_age'),
                    result.get('summary', '')
                ) for result in results]
            
            execute_values(cur, """
                INSERT INTO blog_search_results 
                (blog_id, term_id, title, url, description, page_age, summary)
                VALUES %s
                RETURNING result_id
            """, values)
            
            result_ids = [row['result_id'] for row in cur.fetchall()]
        return result_ids

    def update_generation_state(self, blog_id: str, stage: str, iteration: int = 0,
                              is_completed: bool = False, event_type: str = None,
                              event_data: dict = None) -> dict:
        """Update or create blog generation state"""
        with self.get_cursor() as cur:
            # First check if a state exists for this blog_id
            cur.execute("""
                SELECT state_id FROM blog_generation_state
                WHERE blog_id = %s
            """, (blog_id,))
            
            state_exists = cur.fetchone()
            
            if state_exists:
                # Update existing record
                cur.execute("""
                    UPDATE blog_generation_state
                    SET current_stage = %s,
                        iteration = %s,
                        is_completed = %s,
                        last_event_type = %s,
                        last_event_data = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE blog_id = %s
                    RETURNING state_id, current_stage, iteration, is_completed, updated_at
                """, (stage, iteration, is_completed, event_type,
                      json.dumps(event_data) if event_data else None, blog_id))
            else:
                # Insert new record
                cur.execute("""
                    INSERT INTO blog_generation_state 
                    (blog_id, current_stage, iteration, is_completed, last_event_type, last_event_data)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING state_id, current_stage, iteration, is_completed, updated_at
                """, (blog_id, stage, iteration, is_completed, event_type, 
                      json.dumps(event_data) if event_data else None))
            
            return cur.fetchone()

    def get_blog_details(self, blog_id: str) -> dict:
        """Get comprehensive blog details including search terms and results"""
        with self.get_cursor() as cur:
            # Get blog and generation state in a single query
            cur.execute("""
                SELECT 
                    bs.blog_id, bs.blog_topic, bs.status, bs.blog_content, 
                    bs.created_at, bs.updated_at,
                    bgs.current_stage, bgs.iteration, bgs.is_completed, 
                    bgs.last_event_type, bgs.last_event_data
                FROM blog_sessions bs
                LEFT JOIN blog_generation_state bgs ON bs.blog_id = bgs.blog_id
                WHERE bs.blog_id = %s
            """, (blog_id,))
            blog = cur.fetchone()
            
            if not blog:
                return None
            
            # Extract generation state from the main query into a nested object
            blog['generation_state'] = {
                'current_stage': blog.pop('current_stage', None),
                'iteration': blog.pop('iteration', None),
                'is_completed': blog.pop('is_completed', None),
                'last_event_type': blog.pop('last_event_type', None),
                'last_event_data': blog.pop('last_event_data', None)
            }
            
            # Get search terms and results in a single query
            cur.execute("""
                SELECT 
                    bst.term_id, bst.search_term, bst.created_at,
                    bsr.result_id, bsr.title, bsr.url, bsr.description, bsr.summary
                FROM blog_search_terms bst
                LEFT JOIN blog_search_results bsr ON bst.term_id = bsr.term_id
                WHERE bst.blog_id = %s
                ORDER BY bst.created_at ASC, bsr.created_at ASC
            """, (blog_id,))
            
            search_data = cur.fetchall()
            
            # Organize search terms and results
            terms = {}
            results = []
            
            for row in search_data:
                term_id = row['term_id']
                
                # Add term if not already added
                if term_id not in terms:
                    terms[term_id] = {
                        'term_id': term_id,
                        'search_term': row['search_term'],
                        'created_at': row['created_at']
                    }
                
                # Add result if it exists
                if row['result_id']:
                    results.append({
                        'result_id': row['result_id'],
                        'term_id': term_id,
                        'title': row['title'],
                        'url': row['url'],
                        'description': row['description'],
                        'summary': row['summary']
                    })
            
            blog['search_terms'] = list(terms.values())
            blog['search_results'] = results
            
            return blog

    def create_pending_blog(self, blog_id: str, topic: str) -> dict:
        """Create a new pending blog or update if it already exists"""
        with self.get_cursor() as cur:
            cur.execute("""
                INSERT INTO pending_blogs (blog_id, topic)
                VALUES (%s, %s)
                ON CONFLICT (blog_id) DO UPDATE
                SET topic = EXCLUDED.topic
                RETURNING blog_id, topic, current_stage, created_at
            """, (blog_id, topic))
            return cur.fetchone()

    def delete_pending_blog(self, blog_id: str) -> None:
        """Delete a pending blog"""
        with self.get_cursor() as cur:
            cur.execute("""
                DELETE FROM pending_blogs
                WHERE blog_id = %s
            """, (blog_id,))

    def get_user_blogs(self, user_id: str) -> List[dict]:
        """Get all blog sessions for a user"""
        with self.get_cursor() as cur:
            cur.execute("""
                SELECT blog_id, blog_topic, status, created_at, updated_at
                FROM blog_sessions
                WHERE user_id = %s
                ORDER BY updated_at DESC
            """, (user_id,))
            return cur.fetchall()

    def get_pending_blog_by_id(self, blog_id: str) -> Optional[dict]:
        """Get pending blog by blog_id
        
        Returns the blog session with additional pending info if it exists
        """
        with self.get_cursor() as cur:
            cur.execute("""
                SELECT bs.blog_id, bs.user_id, bs.blog_topic, bs.status, bs.blog_content,
                       bs.created_at, bs.updated_at, pb.current_stage
                FROM blog_sessions bs
                JOIN pending_blogs pb ON bs.blog_id = pb.blog_id
                WHERE bs.blog_id = %s
            """, (blog_id,))
            
            return cur.fetchone()

    def get_pending_blog(self, user_id: str, topic: str = None) -> Optional[dict]:
        """DEPRECATED: Use get_pending_blog_by_id instead.
        
        Get pending blog for a user, optionally filtered by topic
        """
        with self.get_cursor() as cur:
            if topic:
                # Search by both user and topic
                cur.execute("""
                    SELECT bs.blog_id, bs.user_id, bs.blog_topic, bs.status, bs.blog_content,
                           bs.created_at, bs.updated_at, pb.current_stage
                    FROM blog_sessions bs
                    JOIN pending_blogs pb ON bs.blog_id = pb.blog_id
                    WHERE bs.user_id = %s AND bs.blog_topic = %s
                    LIMIT 1
                """, (user_id, topic))
            else:
                # Search by user only
                cur.execute("""
                    SELECT bs.blog_id, bs.user_id, bs.blog_topic, bs.status, bs.blog_content,
                           bs.created_at, bs.updated_at, pb.current_stage
                    FROM blog_sessions bs
                    JOIN pending_blogs pb ON bs.blog_id = pb.blog_id
                    WHERE bs.user_id = %s
                    ORDER BY bs.updated_at DESC
                    LIMIT 1
                """, (user_id,))
            
            return cur.fetchone()

    def get_blog_state(self, blog_id: str) -> Optional[dict]:
        """Get the current generation state for a blog"""
        with self.get_cursor() as cur:
            cur.execute("""
                SELECT current_stage, iteration, is_completed, last_event_type, last_event_data
                FROM blog_generation_state
                WHERE blog_id = %s
            """, (blog_id,))
            return cur.fetchone()

    def close(self):
        """Close the database connection"""
        self.conn.close()

# Create a singleton instance
db = Database()