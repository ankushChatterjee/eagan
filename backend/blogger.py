from scrape import scrape_url
from litellm import completion
from datetime import datetime
import re
import json
from search import search_sync
from prompts import blog_breakdown_prompt, blog_plan_prompt, blog_write_prompt
from blog.reflection_search import ReflectionSearch
import asyncio

lite_llm = "groq/qwen-qwq-32b"
thinking_llm = "groq/deepseek-r1-distill-llama-70b"
gemini_thinking_llm = "gemini/gemini-2.0-flash-thinking-exp-01-21"

SEARCH_ITERATIONS = 2

def process_llm_response(response_text: str) -> str:
    """Process LLM response to extract and print think tags, then return cleaned response"""
    # Find all think tag contents
    think_pattern = r'<think>(.*?)</think>'
    
    # Remove think tags and their content
    cleaned_response = re.sub(think_pattern, '', response_text, flags=re.DOTALL)
    return cleaned_response.strip()

def initial_breakdown(topic: str = None):
    if topic is None:
        return {"error": "No topic provided"}

    current_date = datetime.now().isoformat()
    formatted_prompt = blog_breakdown_prompt.substitute(topic=topic, current_date=current_date)
    
    response = completion(
        model=lite_llm,
        messages=[
            {
                "role": "user",
                "content": formatted_prompt
            }
        ],
    )
    
    # Process response and extract search terms
    response_text = response.choices[0].message.content
    cleaned_response = process_llm_response(response_text)
    search_terms = cleaned_response.split('\n')
    return search_terms


def plan_blog(topic: str = None, context: str = None):
    if topic is None or context is None:
        return {"error": "No topic or context provided"}

    formatted_prompt = blog_plan_prompt.substitute(topic=topic, context=context)

    response = completion(
        model=thinking_llm,
        messages=[
            {
                "role": "user",
                "content": formatted_prompt
            }
        ],
        max_tokens=20192,
        temperature=0.7,
        top_p=0.95,
    )

    response_content = response.choices[0].message.content
    if response_content is None:
        return {"error": "No plan found"}
    return response_content

def write_blog(topic: str = None, context: str = None, plan: str = None):
    current_date = datetime.now().isoformat()
    formatted_prompt = blog_write_prompt.substitute(topic=topic, context=context, current_date=current_date, plan=plan)

    response = completion(
        model=gemini_thinking_llm,
        messages=[
            {
                "role": "user",
                "content": formatted_prompt
            }
        ],
        max_tokens=65192,
        temperature=0.7,
        top_p=0.95,
        stream=True  # Enable streaming
    )
    
    for chunk in response:
        if chunk.choices[0].delta.content:
            content = chunk.choices[0].delta.content
            yield content
        else:
            yield ""

def convert_search_to_text(results: list = None):
    if results is None:
        return {"error": "No search results provided"}
    
    formatted_text = "Search Results Overview:\n\n"
    
    # First, add the search result summaries
    for idx, result in enumerate(results, 1):
        formatted_text += f"[{idx}] Title: {result.get('title', 'No title')}\n"
        formatted_text += f"Link: {result.get('url', 'No link')}\n"
        formatted_text += f"Published: {result.get('page_age', 'Date not available')}\n"
        formatted_text += f"Description: {result.get('description', 'No description')}\n"
        
        formatted_text += "\n"    
    return formatted_text.strip()

async def search_term(topic: str, term: str) -> tuple[str, str]:
    """Perform search for a single term and return the term and its summary"""
    search = await search_sync(term)
    if search.get("status") == "ERROR":
        return term, ""  # Return empty summary on error
    return term, search.get('summary', '')

async def search_terms(topic: str, terms: list[str]) -> str:
    """Search terms sequentially and accumulate results"""
    if not terms:
        return ""
    
    results = []
    # Process each term sequentially
    for term in terms:
        if term != "NO_GAPS_FOUND":
            term_result = await search_term(topic, term)
            results.append(term_result)
    
    # Combine results maintaining order
    return "\n\n".join([f"{term}\n{summary}" for term, summary in results])

async def stream_blog_generation(topic: str = None, user_id: str = None, country: str = "US"):
    if topic is None:
        yield f"event: error\ndata: {json.dumps({'error': 'No topic provided'})}\n\n"
        return

    try:
        # Step 1: Initial breakdown
        yield f"event: status\ndata: {json.dumps({'message': 'Breaking down topic into search terms...'})}\n\n"
        terms = initial_breakdown(topic)
        yield f"event: breakdown\ndata: {json.dumps(terms)}\n\n"

        # Step 2: Initial search - now concurrent
        yield f"event: status\ndata: {json.dumps({'message': 'Performing initial search...'})}\n\n"
        
        # Filter out any "NO_GAPS_FOUND" terms
        filtered_terms = [term for term in terms if term != "NO_GAPS_FOUND"]
        
        # Prepare search tasks for concurrent execution
        inform_data = [{"message": f"{term}"} for term in filtered_terms]
        yield f"event: search_start\ndata: {json.dumps(inform_data)}\n\n"
        
        # Create search tasks for each term and run them concurrently
        search_tasks = [search_sync(term) for term in filtered_terms]
        search_results = await asyncio.gather(*search_tasks)
        
        # Combine results from all searches
        knowledge_base = ""
        all_search_results = []
        
        for term, search in zip(filtered_terms, search_results):
            if search.get('status') == 'ERROR':
                yield f"event: warning\ndata: {json.dumps({'message': f'Search failed for term: {term}'})}\n\n"
                continue
                
            knowledge_base += "\n\n" + term + "\n" + search.get('summary', '')
            all_search_results.extend(search.get('search_results', []))
        
        # Check if we have any successful search results
        if not knowledge_base.strip():
            yield f"event: error\ndata: {json.dumps({'error': 'All searches failed'})}\n\n"
            return
            
        yield f"event: search_results\ndata: {json.dumps(all_search_results)}\n\n"
        
        # Step 3: Reflection and additional research
        current_date = datetime.now().isoformat()
        reflection_search = ReflectionSearch(thinking_llm)
        search_results_text = convert_search_to_text(all_search_results)
        
        yield f"event: status\ndata: {json.dumps({'message': 'Starting to research and reflect'})}\n\n"
        
        # Initial reflection
        reflection = None
        async for response in reflection_search.start_reflection(topic, knowledge_base, search_results_text, current_date):
            if response["type"] == "thinking":
                yield f"event: thinking_part\ndata: {json.dumps({'thought': response['content']})}\n\n"
            elif response["type"] == "reflection":
                reflection = response["content"]
            elif response["type"] == "error":
                yield f"event: error\ndata: {json.dumps({'error': response['content']})}\n\n"
                return
        yield f"event: status\ndata: {json.dumps({'message': 'Prelimnary research completed, moving ahead'})}\n\n"
        # Perform up to 4 iterations of research
        for i in range(SEARCH_ITERATIONS):
            if not reflection:
                break
                
            response_summary = ""
            response_search_results = ""
            
            # Process tools from reflection
            for tool in reflection:
                if tool['tool'] == "web_search":
                    # Prepare all search tasks
                    yield f"event: status\ndata: {json.dumps({'message': 'Searching the web for more information'})}\n\n"
                    inform_data = [{"message": f"{term}"} for term in tool['parameters']]
                    yield f"event: search_start\ndata: {json.dumps(inform_data)}\n\n"
                    
                    search_tasks = [search_sync(term) for term in tool['parameters']]
                    search_results = await asyncio.gather(*search_tasks)
                    
                    # Process results
                    for term, search in zip(tool['parameters'], search_results):
                        response_summary += "\n\n" + term + "\n" + search['summary']
                        response_search_results += convert_search_to_text(search['search_results'])
                        yield f"event: search_results\ndata: {json.dumps(len(search['search_results']))}\n\n"
                
                if tool['tool'] == "scrape":
                    yield f"event: status\ndata: {json.dumps({'message': 'Reading web pages'})}\n\n"
                    sub_topic = tool['parameters'][0]
                    scrape_links = tool['parameters'][1:]
                    # Scrape all links concurrently
                    inform_data = [{"message": f"{link}"} for link in scrape_links]
                    yield f"event: scrape_start\ndata: {json.dumps(inform_data)}\n\n"
                    scrape_tasks = [scrape_url(link, sub_topic) for link in scrape_links]
                    scrape_results = await asyncio.gather(*scrape_tasks)
                    
                    # Process results
                    for link, scrape in zip(scrape_links, scrape_results):
                        if scrape['success']:
                            response_summary += "\n\n" + sub_topic + "\n" + scrape['summary']
                        else:
                            yield f"event: warning\ndata: {json.dumps({'message': f'Failed to scrape {link}: {scrape["error"]}'})}\n\n"

            # Send research results back for reflection
            reflection_input = f"""
            <summary>
            {response_summary}
            </summary>
            <search_results>
            {response_search_results}
            </search_results>
            """
            
            # Get next reflection
            reflection = None
            async for response in reflection_search.send(reflection_input):
                if response["type"] == "thinking":
                    yield f"event: thinking_part\ndata: {json.dumps({'thought': response['content']})}\n\n"
                elif response["type"] == "reflection":
                    reflection = response["content"]
                elif response["type"] == "error":
                    yield f"event: error\ndata: {json.dumps({'error': response['content']})}\n\n"
                    break
                
            knowledge_base += "\n\n" + response_summary
            yield f"event: reflection_progress\ndata: {json.dumps({'iteration': i+1, 'max_iterations': 4})}\n\n"

        # Step 4: Generate blog plan
        yield f"event: status\ndata: {json.dumps({'message': 'Planning blog'})}\n\n"
        blog_plan = process_llm_response(plan_blog(topic, knowledge_base))

        # Step 5: Write blog content with streaming
        yield f"event: blog_start\ndata: {json.dumps({'message': 'Writing blog content...'})}\n\n"
        
        # Accumulate blog content while streaming
        full_blog_content = ""
        for blog_part in write_blog(topic, knowledge_base, blog_plan):
            full_blog_content += blog_part
            yield f"event: blog_part\ndata: {json.dumps({'content': blog_part})}\n\n"
        
        complete_data = {
            "topic": topic,
            "blog_plan": blog_plan,
            "blog_content": full_blog_content,
            "status": "BLOG_DONE"
        }
        yield f"event: complete\ndata: {json.dumps(complete_data)}\n\n"
        
    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

if __name__ == "__main__":
    async def main():
        topic = "Greatness of Virat Kohli"
        async for event in stream_blog_generation(topic):
            print(event)
    # Run the async main function
    asyncio.run(main())
