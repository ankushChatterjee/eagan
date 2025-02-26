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

    def create_chat_session(self, user_id: str) -> dict:
        """Create a new chat session"""
        with self.get_cursor() as cur:
            cur.execute("""
                INSERT INTO chat_sessions (user_id)
                VALUES (%s)
                RETURNING chat_id, user_id, created_at, updated_at
            """, (user_id,))
            return cur.fetchone()

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
                SELECT chat_id, created_at, updated_at
                FROM chat_sessions
                WHERE user_id = %s
                ORDER BY updated_at DESC
            """, (user_id,))
            return cur.fetchall()

    def close(self):
        """Close the database connection"""
        self.conn.close()

# Create a singleton instance
db = Database()