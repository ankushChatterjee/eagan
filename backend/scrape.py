def scrape_single_article(article, idx):
    url = article.get('url')
    if not url:
        return None
        
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove unwanted elements
        for tag in soup(['script', 'style', 'nav', 'footer', 'iframe']):
            tag.decompose()
        
        # Extract main content
        content = ""
        main_content = soup.find('main') or soup.find('article') or soup.find('body')
        if main_content:
            paragraphs = main_content.find_all('p')
            content = '\n'.join(p.get_text().strip() for p in paragraphs if len(p.get_text().strip()) > 50)
            
            # Skip if content is too short
            if len(content) < 1000:
                return None
        
        return {
            'idx': idx,
            'content': f"Article {idx}:\nTitle: {article.get('title', 'No title')}\nURL: {url}\nContent:\n{content[:2000]}...\n\n"
        }
        
    except Exception as e:
        return None

def scrape_articles(results: list) -> str:
    if len(results) < 2:
        return "Not enough results to scrape"
    
    selected_articles = results[:sample_size]
    scraped_content = "Detailed information from selected articles:\n\n"
    
    # Use ThreadPoolExecutor for concurrent scraping
    with ThreadPoolExecutor(max_workers=5) as executor:
        # Submit all scraping tasks
        future_to_article = {
            executor.submit(scrape_single_article, article, idx): idx 
            for idx, article in enumerate(selected_articles, 1)
        }
        
        # Collect results as they complete
        scraped_pieces = []
        for future in as_completed(future_to_article):
            result = future.result()
            if result:
                scraped_pieces.append(result)
    
    # Sort results by original index and combine
    scraped_pieces.sort(key=lambda x: x['idx'])
    scraped_content += ''.join(piece['content'] for piece in scraped_pieces)
    
    return scraped_content