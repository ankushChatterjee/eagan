from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from search import stream_search
from fastapi.responses import StreamingResponse, JSONResponse
from geo import get_country_from_request
from db import Database
from dotenv import load_dotenv
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

# Load environment variables from .env file
load_dotenv()

# Initialize the database
database = Database()

@app.post("/create-session")
async def create_session():
    try:
        session = database.create_chat_session("anonymous")
        return JSONResponse({
            "status": "success",
            "chat_id": session['chat_id'],
            "created_at": session['created_at'].isoformat()
        })
    except Exception as e:
        logging.error(f"Error creating chat session: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to create chat session"}
        )

@app.get("/stream-search")
async def stream_search_endpoint(
    request: Request, 
    query: str = None, 
    chat_id: str = None, 
    user_id: str = "anonymous"
):
    if query is None:
        return {"error": "No search query provided"}
    
    if not chat_id:
        # Create a new chat session if none provided
        session = database.create_chat_session(user_id)
        chat_id = session['chat_id']
        
    country = get_country_from_request(request)
    return StreamingResponse(
        stream_search(
            query=query, 
            country=country, 
            chat_id=chat_id, 
            user_id=user_id,
            db=database
        ), 
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
