from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from search import stream_search_with_history
from fastapi.responses import StreamingResponse, JSONResponse
from geo import get_country_from_request
from db import Database
from dotenv import load_dotenv
import logging
from datetime import datetime
from blogger import stream_blog_generation

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
async def create_session(request: Request):
    try:
        body = await request.json()
        chat_title = body.get("chat_title")
        query = body.get("query")
        session = database.create_chat_session("anonymous", chat_title, query)
        return JSONResponse({
            "status": "success",
            "chat_id": session['chat_id'],
            "chat_title": session['chat_title'],
            "created_at": session['created_at'].isoformat()
        })
    except Exception as e:
        logging.error(f"Error creating chat session: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to create chat session"}
        )

@app.post("/create-pending-chat")
async def create_pending_chat(request: Request):
    try:
        body = await request.json()
        chat_id = body.get("chat_id")
        query = body.get("query")
        if not chat_id or not query:
            return JSONResponse(
                status_code=400,
                content={"error": "chat_id and query are required"}
            )
        pending_chat = database.create_pending_chat(chat_id, query)
        return JSONResponse({
            "status": "success",
            "chat_id": pending_chat['chat_id'],
            "query": pending_chat['query'],
            "created_at": pending_chat['created_at'].isoformat()
        })
    except Exception as e:
        logging.error(f"Error creating pending chat: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to create pending chat"}
        )

@app.get("/list-chats")
async def list_chats():
    try:
        user_id = "anonymous"
        chats = database.get_user_chats(user_id)
        # Convert datetime objects to strings
        for chat in chats:
            chat['created_at'] = chat['created_at'].isoformat()
            chat['updated_at'] = chat['updated_at'].isoformat()
        return JSONResponse({
            "status": "success",
            "chats": chats
        })
    except Exception as e:
        logging.error(f"Error listing chats for user {user_id}: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to list chats"}
        )

@app.get("/chat-details/{chat_id}")
async def get_chat_details(chat_id: str):
    try:
        chat_details = database.get_chat_details(chat_id)
        pending_query = database.get_pending_chat(chat_id)
        if not chat_details and not pending_query:
            return JSONResponse(
                status_code=404,
                content={"error": "Chat not found"}
            )
        return JSONResponse({
            "status": "success",
            "chat_details": chat_details,
            "pending_query": pending_query
        })
    except Exception as e:
        logging.error(f"Error fetching chat details for chat_id {chat_id}: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to fetch chat details"}
        )

@app.post("/create-pending-blog")
async def create_pending_blog(request: Request):
    try:
        body = await request.json()
        blog_topic = body.get("blog_topic")
        user_id = body.get("user_id", "anonymous")
        
        if not blog_topic:
            return JSONResponse(
                status_code=400,
                content={"error": "blog_topic is required"}
            )
            
        # Create a new blog session
        blog_session = database.create_blog_session(user_id, blog_topic)
        
        return JSONResponse({
            "status": "success",
            "blog_id": blog_session['blog_id'],
            "blog_topic": blog_session['blog_topic'],
            "created_at": blog_session['created_at'].isoformat()
        })
    except Exception as e:
        logging.error(f"Error creating pending blog: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to create pending blog: {str(e)}"}
        )

@app.get("/list-blogs")
async def list_blogs(user_id: str = "anonymous"):
    try:
        blogs = database.get_user_blogs(user_id)
        # Convert datetime objects to strings
        for blog in blogs:
            blog['created_at'] = blog['created_at'].isoformat()
            blog['updated_at'] = blog['updated_at'].isoformat()
        return JSONResponse({
            "status": "success",
            "blogs": blogs
        })
    except Exception as e:
        logging.error(f"Error listing blogs for user {user_id}: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to list blogs"}
        )

@app.get("/blog-details/{blog_id}")
async def get_blog_details(blog_id: str):
    try:
        blog_details = database.get_blog_details(blog_id)
        if not blog_details:
            return JSONResponse(
                status_code=404,
                content={"error": "Blog not found"}
            )
        
        # Convert datetime objects to strings
        if blog_details.get('created_at'):
            blog_details['created_at'] = blog_details['created_at'].isoformat()
        if blog_details.get('updated_at'):
            blog_details['updated_at'] = blog_details['updated_at'].isoformat()
            
        # Convert datetime objects in search terms
        for term in blog_details.get('search_terms', []):
            if term.get('created_at'):
                term['created_at'] = term['created_at'].isoformat()
                
        return JSONResponse({
            "status": "success",
            "blog_details": blog_details
        })
    except Exception as e:
        logging.error(f"Error fetching blog details for blog_id {blog_id}: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to fetch blog details: {str(e)}"}
        )

@app.get("/stream-search-with-history")
async def stream_search_with_history_endpoint(
    request: Request,
    chat_id: str = None, 
    user_id: str = "anonymous"
):
    if chat_id is None:
        return {"error": "No chat ID provided"}
    country = get_country_from_request(request)
    return StreamingResponse(
        stream_search_with_history(
            chat_id=chat_id, 
            user_id=user_id,
            db=database,
            country=country
        ), 
        media_type="text/event-stream"
    )

@app.get("/stream-blog-generation")
async def stream_blog_generation_endpoint(
    request: Request,
    blog_id: str
):
    if not blog_id:
        return {"error": "No blog_id provided"}
    
    return StreamingResponse(
        stream_blog_generation(blog_id),
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
