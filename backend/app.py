from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from search import search, stream_search
from fastapi.responses import StreamingResponse

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/search")
async def search_endpoint(query: str = None):
    if query is None:
        return {"error": "No search query provided"}
    
    try:
        result = search(query)
        return result
    except Exception as e:
        return {"error": f"Search failed: {str(e)}"}

@app.get("/stream-search")
async def stream_search_endpoint(query: str = None):
    if query is None:
        return {"error": "No search query provided"}
    return StreamingResponse(stream_search(query), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
