from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from search import search, stream_search
from fastapi.responses import StreamingResponse
from geo import get_country_from_request
import logging

app = FastAPI()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    filename="app.log"  # Logs will be written to app.log
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/stream-search")
async def stream_search_endpoint(request: Request, query: str = None):
    if query is None:
        return {"error": "No search query provided"}
        
    country = get_country_from_request(request)
    return StreamingResponse(stream_search(query, country), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
