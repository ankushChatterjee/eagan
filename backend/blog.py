from scrape import scrape_url
from litellm import completion
from datetime import datetime
import re
from search import search_sync
from prompts import blog_breakdown_prompt, blog_plan_prompt, blog_write_prompt
from blog.reflection_search import ReflectionSearch


# lite_llm = "gemini/gemini-2.0-flash-lite"
# thinking_llm = "gemini/gemini-2.0-flash-thinking-exp-01-21"
lite_llm = "groq/qwen-qwq-32b"
thinking_llm = "groq/qwen-qwq-32b"
gemini_thinking_llm = "gemini/gemini-2.0-flash-thinking-exp-01-21"
openai_thinking_llm = "openai/o1-mini"
anthropic_thinking_llm = "anthropic/claude-3-5-sonnet-20241022"
deepseek_thinking_llm = "groq/deepseek-r1-distill-qwen-32b"


def process_llm_response(response_text: str) -> str:
    """Process LLM response to extract and print think tags, then return cleaned response"""
    # Find all think tag contents
    think_pattern = r'<think>(.*?)</think>'
    think_matches = re.findall(think_pattern, response_text, re.DOTALL)
    
    # Print thinking process if found
    # for i, thought in enumerate(think_matches):
        # print(f"\n================================================\nThinking process {i + 1}:\n{thought.strip()}\n================================================\n")
    
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

    response_text = response.choices[0].message.content
    return process_llm_response(response_text)

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
    )
    
    response_text = response.choices[0].message.content
    return process_llm_response(response_text)

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
    search = search_sync(topic, [term])
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

if __name__ == "__main__":
    import asyncio
    
    async def main():
        topic = "Nationalsm in Tagore's works"
        
        terms = initial_breakdown(topic)
        preliminary_search = await search_sync(topic, terms)
        
        # Check if search was successful
        if preliminary_search.get('status') == 'ERROR':
            return
            
        knowledge_base = preliminary_search.get('summary', '')
        
        current_date = datetime.now().isoformat()
        reflection_search = ReflectionSearch(thinking_llm)

        preliminary_search_results = preliminary_search.get('search_results', [])
        
        search_results = convert_search_to_text(preliminary_search_results)
        reflection = reflection_search.start_reflection(topic, knowledge_base, search_results, current_date)

        i = 0
        while i < 4:
            if reflection is None:
                break
            response_summary = ""
            response_search_results = ""
            for tool in reflection:
                if tool['tool'] == "web_search":
                    for term in tool['parameters']:
                        search = await search_sync(topic, [term])
                        response_summary += "\n\n" + term + "\n" + search['summary']

                    response_search_results += convert_search_to_text(search['search_results'])
                if tool['tool'] == "scrape":
                    sub_topic = tool['parameters'][0]
                    scrape_links = tool['parameters'][1:]
                    for link in scrape_links:
                        scrape = await scrape_url(link, sub_topic)
                        if scrape['success']:
                            response_summary += "\n\n" + sub_topic + "\n" + scrape['summary']
                        else:
                            print("scrape failed: ", scrape['error'])
            reflection_input = f"""
            <summary>
            {response_summary}
            </summary>
            <search_results>
            {response_search_results}
            </search_results>
            """
            reflection = reflection_search.send(reflection_input)
            knowledge_base += "\n\n" + response_summary
            i += 1

        blog_plan = process_llm_response(plan_blog(topic, knowledge_base))
        blog_content = process_llm_response(write_blog(topic, knowledge_base, blog_plan))

        print("blog content: ", blog_content)
    
    # Run the async main function
    asyncio.run(main())