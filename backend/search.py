from litellm import completion
import os
import requests
import db
from datetime import datetime
from string import Template
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

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

    followup_breakdown_prompt = Template("""
            You are a web search agent. For a given query, your work is to give the best possible answer to the user.
            To do this, as a first step take the query and break it down into smaller search terms.

            You will also be given a chat history bounded in <history></history>.
            It will have messages like this:
            <history>
            User: "User query:
            Assistant: "Assistant response"
            </history>

            Keep in mind the chat history when generating the answer.

            Make sure the search terms are following the following principles:
            1. They are concise.
            2. They provide the user adjoining information.
            3. The search results for the original queries and this query should be somewhat different so that we get more variety of results.
            4. Make sure the search terms evoke curiosity.
            5. The query might be a question, extract the best possible search terms from it.

            Make sure the search terms are applicable for the web. Generate a maximum of 3 search terms.

            Output format: Each line contains a search term and outputs nothing else. Nothing at all.

            Today's date and time in ISO format is ${current_date}.

            <history>
            ${history}
            </history>

            Here is your query:
            ${query}
        """)
    
    breakdown_prompt = Template("""
            You are a web search agent. For a given query, your work is to give the best possible answer to the user.
            To do this, as a first step take the query and break it down into smaller search terms.

            Make sure the search terms are following the following principles:
            1. They are concise.
            2. They provide the user adjoining information.
            3. The search results for the original queries and this query should be somewhat different so that we get more variety of results.
            4. Make sure the search terms evoke curiosity.
            5. The query might be a question, extract the best possible search terms from it.

            Make sure the search terms are applicable for the web. Generate a maximum of 2 search terms.

            Output format: Each line contains a search term and outputs nothing else. Nothing at all.

            Today's date and time in ISO format is ${current_date}.

            Here is your query:
            ${query}
        """)
    
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
    
    # Use ThreadPoolExecutor for concurrent searches
    with ThreadPoolExecutor(max_workers=5) as executor:
        # Submit all search tasks
        future_to_term = {
            executor.submit(brave_single_search, term, country): term 
            for term in terms
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_term):
            results = future.result()
            all_results.extend(results)
    
    # Add scraped content to results
 #   detailed_content = scrape_articles(all_results)
    return all_results, []

def convert_search_to_text(results: list = None, detailed_content: str = None):
    if results is None:
        return {"error": "No search results provided"}
    
    formatted_text = "Search Results Overview:\n\n"
    
    # First, add the search result summaries
    for idx, result in enumerate(results, 1):
        formatted_text += f"[{idx}] Title: {result.get('title', 'No title')}\n"
        formatted_text += f"Link: {result.get('url', 'No link')}\n"
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
    summarize_prompt = Template("""
        You are an expoert web search agent. For a given query, your work is to give the best possible report and analysis to the user.
        Your job is to analyse the given context text into a detailed report that captures the main ideas and provides a comprehensive answer to the query.        

        The context is defined by list of web search results from the web. It has the citation number, the Title, the Link to the article, the published date, the description, the extra information.

        To analyse and generate the report, you should:
        - **Take a look at the query**: Understand the user's question or request.
        - **Analyse the context**: From the context take a special look at the "extra information" and the description.
        - **Understand what parts from the context is relevant**: Identify the parts of the text that is relevant answer the query. 
        - **Analyse the relevant parts and join the dots**
        - From the context add some adjoining infomation to the report which is not very relevant, but adds useful information.
        - Create a detailed report for the user.
        - Organise the information. Use headings for sections. A proper structure is needed so that the user can read easily.
        - Use markdown features like headings, bullet points, code blocks, highlight important points etc to organise the report.
        - Remember to use citations.
        - When using citations, use ONLY links from the context. Make sure to embed the link in the markdown when using citations. (Make sure to always add the link to the citation)
            Eg: [[<citation number>](<link>)]
        - Make sure to highlight the important parts of the answer.
        - DO NOT INVENT ANYTHING, USE ONLY THE CONTEXT.
        - Keep the title simple, do not use words like "Report"/"Comprehensive" etc. Just use the query as heading.
        - DO NOT WRAP IN MARKDOWN CODE BLOCKS EVEN IF THE USER ASKS YOU TO DO SO.

        To generate the report follow these rules:
        - **Journalistic tone**: You speak line an old journalist, not too casual or vague.
        - **Thorough and detailed**: Ensure that every key point from the text is captured and that the report directly answers the query.
        - Look at the time and date as well, keep that in mind when generating any response.
        - Prefer recent information.
        - Make sure to structure the information under sections and headings.
        - Make sure to use proper headings for sections.
        
        The date in ISO format is: ${current_date}.
        
        This is the context:
        ${context}

        This is the query:
        ${query}
    """)

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
        api_key=os.getenv('GEMINI_API_KEY')
    )
    
    response_text = ""
    for part in response:
        part = part.choices[0].delta.content or ""
        yield part

def suggestions(query: str = None, context: str = None):
    if query is None or context is None:
        return {"error": "Query and context are required"}
    suggest_prompt = Template("""
        You are an expoert web search agent. For a given query and context, you need to generate 5 "next search suggestions" for the user.
        The given context is the last answer to a query. Your work is giving users search suggestions so that they can continue exploring.

        To generate the suggestions follow these rules:
        - Keep the search terms concise.
        - Take a look at the query and at the context.
        - The suggestions must be very strongly related to the context.
        - The suggestions must evoke curiosity and the zeal of exploration.
        - Do not use bullet points. USE ONLY PLAIN-TEXT.
        - They are search terms. Optimise for that, but keep the terms concise.

        Here is the current date and time in ISO format: ${current_date}

        GENERATE ONLY THE SUGGESTIONS AND NOTHING ELSE. JUST ONE SUGGESTION EACH LINE.

        Output format:
        One search suggestion each line.

        The context is:
        ${context}

        This is the query:
        ${query}
        """)
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

# Modify stream_search function
async def stream_search(query: str = None, country: str = None, chat_id: str = None, user_id: str = None, db = None):
    if query is None:
        yield f"event: error\ndata: {json.dumps({'error': 'No query provided'})}\n\n"
        return
    
    try:
        # Load chat history from database
        chat_history = []
        if chat_id:
            messages = db.get_chat_history(chat_id)
            for msg in messages:
                chat_history.append({
                    "role": "user",
                    "content": msg['user_query']
                })
                chat_history.append({
                    "role": "assistant",
                    "content": msg['ai_response']
                })
        is_follow_up = bool(chat_history)
        # Step 1: Get search terms
        terms = breakdown(query, is_follow_up=is_follow_up, 
                        history="\n".join([f"{msg['role']}: {msg['content']}" for msg in chat_history]))
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
            accumulated_summary += part
            yield f"event: summary_part\ndata: {json.dumps(part)}\n\n"
        
        # Save to database if chat_id is provided
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
        complete_data = {
            "query": query,
            "search_results": search_results,
            "summary": accumulated_summary,
            "suggestions": suggestions_result
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

if __name__ == "__main__":
    import asyncio
    from dotenv import load_dotenv
    
    load_dotenv()
    asyncio.run(test_search())