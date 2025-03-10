import asyncio
from typing import Dict, Any, Optional
from crawl4ai import AsyncWebCrawler, BrowserConfig
from litellm import completion

async def scrape_url(url: str, query: str, scraper_model: str = "gemini/gemini-2.0-flash-lite") -> Dict[Any, Any]:
    try:
        # Initialize the web crawler with browser configuration
        browser_conf = BrowserConfig(
            browser_type="chrome",
            headless=True
        )
        
        # Use async context manager pattern for proper browser initialization
        async with AsyncWebCrawler(config=browser_conf) as web_crawler:
            # Crawl the URL
            result = await web_crawler.arun(url=url)
            
            if not result or not result.markdown:
                return {
                    "success": False,
                    "error": "Failed to extract content from the URL"
                }

            # Construct the prompt for summarization
            prompt = f"""Based on the following content, {query}
            
            Please provide a clear yet detailed summary in markdown format.
            Focus only on relevant information that answers the query.
            Do not include any other text. Use the markdown formatting of the original content.

            DO NOT INVENT ANYTHING. ONLY USE THE CONTENT PROVIDED.

            Content:
            {result.markdown}
            """
            # Get summary from LLM
            response = completion(
                model=scraper_model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that provides clear, accurate summaries in markdown format."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=4100
            )

            return {
                "success": True,
                "url": url,
                "query": query,
                "summary": response.choices[0].message.content
            }
            
    except Exception as e:
        return {
            "success": False,
            "url": url,
            "error": str(e)
        }
            
# Example usage
if __name__ == "__main__":
    async def main():
        url = "https://jax-ml.github.io/scaling-book/transformers/"
        query = "How to calculate FLOPS?"
        result = await scrape_url(url, query)
        print(result["summary"])
    
    asyncio.run(main())
