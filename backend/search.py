from litellm import completion
import os
import requests
import re
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from prompts import followup_breakdown_prompt, breakdown_prompt, summarize_prompt, suggest_prompt
import atexit
from dotenv import load_dotenv

load_dotenv()
# Create a shared ThreadPoolExecutor for web searches
# Using max_workers=5 as that was the original setting
web_search_executor = ThreadPoolExecutor(max_workers=5, thread_name_prefix="web_search")

# Ensure proper cleanup on application shutdown
def cleanup_threadpool():
    web_search_executor.shutdown(wait=True)

atexit.register(cleanup_threadpool)

lite_llm_model = "gemini/gemini-2.0-flash-lite"
llm_model = "gemini/gemini-2.0-flash"
sample_size = 10
brave_search_size = 5


def brave_search(query: str, country: str) -> dict:
    headers = {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': os.getenv('BRAVE_API_KEY_BASE_AI')
    }
    response = requests.get(
        'https://api.search.brave.com/res/v1/web/search',
        params={'q': query, 'count': brave_search_size, 'country': country},
        headers=headers
    )
    return response.json()


def breakdown(query: str = None, is_follow_up: bool = False, history: str = None):
    if query is None:
        return {"error": "No search query provided"}

    current_date = datetime.now().isoformat()
    formatted_prompt = ""
    if is_follow_up:
        formatted_prompt = followup_breakdown_prompt.substitute(
            current_date=current_date,
            history=history,
            query=query
        )
    else:
        formatted_prompt = breakdown_prompt.substitute(
            current_date=current_date,
            query=query
        )
        
    response = completion(
        model=lite_llm_model,
        messages=[
            {
                "role": "user",
                "content": formatted_prompt
            }
        ],
        api_key=os.getenv('GEMINI_API_KEY')
    )
    
    # Extract search terms and add original query
    search_terms = response.choices[0].message.content.strip().split('\n')
    if not is_follow_up:
        search_terms.insert(0, query)
    
    return search_terms

# Modify web_search to include scraped content
def brave_single_search(term, country):
    try:
        results = brave_search(term, country)
        if 'web' in results and 'results' in results['web']:
            return results['web']['results']
        return []
    except Exception as e:
        return []

def web_search(terms: list = None, country: str = None):
    if terms is None:
        return {"error": "No search terms provided"}
    
    all_results = []
    
    # Use the shared ThreadPoolExecutor instead of creating a new one
    future_to_term = {
        web_search_executor.submit(brave_single_search, term, country): term 
        for term in terms
    }
    
    # Collect results as they complete
    for future in as_completed(future_to_term):
        results = future.result()
        all_results.extend(results)
    
    return all_results, []

def convert_search_to_text(results: list = None, detailed_content: str = None):
    if results is None:
        return {"error": "No search results provided"}
    
    formatted_text = "Search Results Overview:\n\n"
    
    # First, add the search result summaries
    for idx, result in enumerate(results, 1):
        formatted_text += f"[{idx}] Title: {result.get('title', 'No title')}\n"
        formatted_text += f"Citation Link: {result.get('url', 'No link')}\n"
        formatted_text += f"Published: {result.get('page_age', 'Date not available')}\n"
        formatted_text += f"Description: {result.get('description', 'No description')}\n"
        
        # Add extra snippets if available
        if result.get('extra_snippets'):
            formatted_text += "Extra Information:\n"
            for snippet in result['extra_snippets']:
                formatted_text += f"- {snippet}\n"
        formatted_text += "\n"    
    return formatted_text.strip()

async def summarize_search_results(query: str = None, context: str = None, chat_history: list = None):
    if query is None or context is None:
        yield ""
        return
    current_date = datetime.now().isoformat()
    formatted_prompt = summarize_prompt.substitute(
        current_date=current_date,
        context=context,
        query=query
    )

    messages = []
    
    if chat_history and len(chat_history) > 0:
        messages.extend(chat_history)

    messages.append({
        "role": "user",
        "content": formatted_prompt
    })
    
    response = completion(
        model=llm_model,
        messages=messages,
        max_tokens=50049,
        temperature=0.6,
        stream=True,
        api_key=os.getenv('GEMINI_API_KEY'),
    )
    
    for part in response:
        part = part.choices[0].delta.content or ""
        yield part

def suggestions(query: str = None, context: str = None):
    if query is None or context is None:
        return {"error": "Query and context are required"}
    formatted_prompt = suggest_prompt.substitute(
        context=context,
        query=query,
        current_date=datetime.now().isoformat()
    )
    response = completion(
        model=lite_llm_model,
        messages=[
            {
                "role": "user",
                "content": formatted_prompt
            }
        ],
        api_key=os.getenv('GEMINI_API_KEY')
    )
    suggestions = response.choices[0].message.content.strip().split('\n')
    return suggestions

def deduplicate_results(results: list) -> list:
    """Remove duplicate search results based on URL"""
    seen_urls = set()
    unique_results = []
    
    for result in results:
        url = result.get('url')
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique_results.append(result)
    
    return unique_results

def fix_citations(text: str, search_results: list) -> str:
    if not isinstance(text, str) or not isinstance(search_results, list):
        raise ValueError("Invalid input: text must be string and search_results must be list")
    
    # Pattern for plain citations [number] and [number, number]
    plain_citation_pattern = re.compile(r'\[(\d+(?:,\s*\d+)*)\](?!\()')
    # Pattern for already formatted citations [number](link)
    formatted_citation_pattern = re.compile(r'\[\d+\]\([^)]+\)')
    
    matches = plain_citation_pattern.findall(text)
    
    # Process each unique plain citation
    for match in set(matches):
        start_pos = 0
        while (start_pos := text.find(f"[{match}]", start_pos)) != -1:
            # Check if this occurrence is part of an already formatted citation
            substring = text[start_pos:]
            if not formatted_citation_pattern.match(substring):
                try:
                    citation_numbers = [int(num.strip()) for num in match.split(',')]
                    citation_texts = []
                    for citation_number in citation_numbers:
                        if 1 <= citation_number <= len(search_results):
                            result = search_results[citation_number - 1]
                            link = result.get('url', '')
                            if link.strip():
                                formatted_citation = f'[{citation_number}]({link})'
                                citation_texts.append(formatted_citation)
                            else:
                                citation_texts.append(f"")
                        else:
                            citation_texts.append(f"[{citation_number}]")
                    citation_text = ', '.join(citation_texts)
                    # Replace only this specific instance
                    text = text[:start_pos] + citation_text + text[start_pos + len(f"[{match}]"):]
                    start_pos += len(citation_text)
                except (ValueError, IndexError):
                    text = text[:start_pos] + "" + text[start_pos + len(f"[{match}]"):]
                    start_pos += 1
            else:
                # Skip this occurrence since it's already formatted
                start_pos += len(f"[{match}]")
    
    return text

async def stream_search_with_history(chat_id: str = None, user_id: str = None, db = None, country: str = "US"):
    if chat_id is None:
        yield f"event: error\ndata: {json.dumps({'error': 'No chat ID provided'})}\n\n"
        return
    
    try:
        # Fetch chat details from database
        chat_details = db.get_chat_details(chat_id)
        yield f"event: chatHistory\ndata: {json.dumps(chat_details)}\n\n"
        
        # Check for pending queries
        pending_query = db.get_pending_chat(chat_id)
        pending_info = {
            "chatHistory": chat_details,
            "pending_query": bool(pending_query)
        }
        yield f"event: chatHistory\ndata: {json.dumps(pending_info)}\n\n"
        if not pending_query:
            complete_data = {
                "status": "NO_PENDING"
            }
            yield f"event: complete\ndata: {json.dumps(complete_data)}\n\n"
            return
        
        query = pending_query['query']
        country = pending_query.get('country', 'US')
        
        is_follow_up = bool(chat_details)

        chat_history = []
        for msg in chat_details:
            chat_history.append({
                "role": "user",
                "content": msg['user_query']
            })
            chat_history.append({
                "role": "assistant",
                "content": msg['summary']
            })
        
        # Step 1: Get search terms
        history = "No History, just use the query."
        if is_follow_up:
            history = "\n".join([f"{msg['role']}: {msg['content']}" for msg in chat_history])

        terms = breakdown(query, is_follow_up=is_follow_up, 
                        history=history)
        yield f"event: breakdown\ndata: {json.dumps(terms)}\n\n"
        
        # Step 2: Perform web search and get results
        search_results, detailed_content = web_search(terms, country)
        search_results = deduplicate_results(search_results)
        yield f"event: search_results\ndata: {json.dumps(search_results)}\n\n"
        
        # Step 3: Convert to text and prepare for analysis
        context = convert_search_to_text(search_results, detailed_content)
        
        # Stream summary parts as they arrive
        accumulated_summary = ""
        async for part in summarize_search_results(query, context, chat_history):
            fixed_part = fix_citations(part, search_results)
            accumulated_summary += fixed_part
            yield f"event: summary_part\ndata: {json.dumps(fixed_part)}\n\n"
        
        # Save to database if chat_id is provided

        accumulated_summary = fix_citations(accumulated_summary, search_results)

        if chat_id and user_id:
            # Save user query and AI response together
            message = db.create_chat_message(
                chat_id=chat_id,
                user_id=user_id,
                user_query=query,
                ai_response=accumulated_summary
            )
            
            # Store search results
            db.store_search_results(chat_id, message['message_id'], search_results)
        
        # Get suggestions and complete the response
        suggestions_result = ""
        if is_follow_up:
            suggestions_result = suggestions(terms[0], accumulated_summary)
        else:
            suggestions_result = suggestions(query, accumulated_summary)
        
        # Delete pending search for the chat_id
        if chat_id:
            db.delete_pending_chat(chat_id)
        
        complete_data = {
            "query": query,
            "search_results": search_results,
            "summary": accumulated_summary,
            "suggestions": suggestions_result,
            "status": "SEARCH_DONE"
        }
        yield f"event: complete\ndata: {json.dumps(complete_data)}\n\n"
        
    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

async def test_search():
    # Mock chat history as message objects
    mock_history = [
        {
            "role": "user",
            "content": "President of USA?"
        },
        {
            "role": "assistant",
            "content": "Donald Trump, he is a great guy."
        }
    ]
    
    test_query = "Where is he from?"
    country = "US"
    
    # Get search terms and perform search
    terms = breakdown(test_query, is_follow_up=True, 
                     history="\n".join([f"{msg['role']}: {msg['content']}" for msg in mock_history]))
    
    # Perform web search
    search_results, detailed_content = web_search(terms, country)
    search_results = deduplicate_results(search_results)
    
    # Convert to text format
    context = convert_search_to_text(search_results, detailed_content)
    
    # Test summarize_search_results with chat history
    summary = ""
    async for part in summarize_search_results(test_query, context, mock_history):
        summary += part

async def search_sync(query: str, country: str = "US", chat_history: list = None):
    try:
        # Perform web search and get results
       # breakdown_terms = breakdown(query, is_follow_up=False, history=None)
        search_results, detailed_content = web_search([query], country)
        search_results = deduplicate_results(search_results)
        
        # Convert to text and prepare for analysis
        context = convert_search_to_text(search_results, detailed_content)
        
        summary = ""
        async for part in summarize_search_results(query, context, chat_history):
            summary += part
            
        # Fix citations in the summary
        summary = fix_citations(summary, search_results)
        
        # Get suggestions
        suggestions_result = suggestions(query, summary)
        
        return {
            "query": query,
            "search_results": search_results,
            "summary": summary,
            "suggestions": suggestions_result,
            "status": "SEARCH_DONE"
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "status": "ERROR"
        }

# if __name__ == "__main__":
#     import asyncio
#     from dotenv import load_dotenv
    
#     load_dotenv()
#     asyncio.run(test_search())