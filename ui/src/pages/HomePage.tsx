import { Button } from "@/components/ui/button"
import { LightbulbIcon, ChevronUpIcon, BookOpenIcon, ChevronRightIcon, MessageSquareIcon, ClockIcon, FileTextIcon, CheckCircleIcon, LoaderIcon, PencilIcon } from "lucide-react"
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { cn } from "@/lib/utils"

interface Chat {
  chat_id: string
  chat_title: string
  created_at: string
}

interface Blog {
  blog_id: string
  blog_topic: string
  created_at: string
  status?: string
  updated_at: string
}

export default function HomePage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<"browse" | "blog">("browse")
  const [chats, setChats] = useState<Chat[]>([])
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [chatsLoading, setChatsLoading] = useState(true)
  const [blogsLoading, setBlogsLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [showAllChats, setShowAllChats] = useState(false)
  const [showAllBlogs, setShowAllBlogs] = useState(false)
  const [activeTab, setActiveTab] = useState<"explorations" | "blogs">("explorations")

  const createChatSession = async (chatTitle: string) => {
    try {
      const response = await fetch('http://localhost:8000/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ chat_title: chatTitle })
      })
      const data = await response.json()
      return data.chat_id
    } catch (error) {
      console.error('Failed to create chat session:', error)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setIsLoading(true)
      try {
        if (mode === "browse") {
          const chatId = await createChatSession(searchQuery)
          navigate(`/search?chat_id=${chatId}`)
        } else {
          // Create pending blog
          const response = await fetch('http://localhost:8000/create-pending-blog', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ blog_topic: searchQuery })
          })
          const data = await response.json()
          navigate(`/blog?blog_id=${data.blog_id}`)
        }
      } catch (error) {
        console.error(`${mode === "browse" ? "Search" : "Blog generation"} failed:`, error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const fetchChats = async () => {
    try {
      const response = await fetch('http://localhost:8000/list-chats')
      const data = await response.json()
      setChats(data.chats)
    } catch (error) {
      console.error('Failed to fetch chats:', error)
    } finally {
      setChatsLoading(false)
    }
  }

  const fetchBlogs = async () => {
    try {
      const response = await fetch('http://localhost:8000/list-blogs')
      const data = await response.json()
      setBlogs(data.blogs)
    } catch (error) {
      console.error('Failed to fetch blogs:', error)
    } finally {
      setBlogsLoading(false)
    }
  }

  useEffect(() => {
    fetchChats()
    fetchBlogs()
  }, [])

  useEffect(() => {
    setShowAllChats(false)
    setShowAllBlogs(false)
  }, [showHistory])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (searchQuery.trim()) {
          handleSubmit(e as unknown as React.FormEvent)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchQuery])

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }
    return new Date(dateString).toLocaleDateString(undefined, options)
  }

  const handleCloseHistory = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowHistory(false)
    }
  }

  const handleChatClick = (chatId: string) => {
    navigate(`/search?chat_id=${chatId}`)
  }

  const handleBlogClick = (blogId: string) => {
    navigate(`/blog?blog_id=${blogId}`)
  }

  const getStatusIcon = (blog: Blog) => {
    // Determine blog status based on available information
    // This is a simple heuristic - you might want to use actual status field from API
    const status = blog.status || 'pending';
    
    switch(status.toLowerCase()) {
      case 'blog_done':
      case 'completed':
        return <CheckCircleIcon className="w-4 h-4 text-[#9AE6B4]" />;
      case 'in_progress':
        return <LoaderIcon className="w-4 h-4 text-[#F2EEC8] animate-spin" />;
      case 'pending':
      default:
        return <PencilIcon className="w-4 h-4 text-[#F2EEC8]/70" />;
    }
  }

  const getStatusText = (blog: Blog) => {
    const status = blog.status || 'pending';
    
    switch(status.toLowerCase()) {
      case 'blog_done':
      case 'completed':
        return "Completed";
      case 'in_progress':
        return "Writing...";
      case 'pending':
      default:
        return "Pending";
    }
  }

  const getBlogStatusClass = (blog: Blog) => {
    const status = blog.status || 'pending';
    
    switch(status.toLowerCase()) {
      case 'blog_done':
      case 'completed':
        return "bg-gradient-to-r from-[#9AE6B4]/20 to-[#9AE6B4]/5 border-[#9AE6B4]/40";
      case 'in_progress':
        return "bg-gradient-to-r from-[#F2EEC8]/20 to-[#F2EEC8]/5 border-[#F2EEC8]/40 animate-pulse";
      case 'pending':
      default:
        return "bg-gradient-to-r from-[#F2EEC8]/10 to-transparent border-[#F2EEC8]/20";
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#1E1F1C] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background SVG */}
      <img
        src="/src/assets/background.svg"
        className="absolute inset-0 w-full h-full opacity-85 pointer-events-none object-cover"
        alt=""
      />

      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#F2EEC8]/5 to-transparent pointer-events-none" />

      <div className="w-full max-w-3xl mx-auto text-center space-y-16 relative">
        {/* Logo and Title */}
        <div>
          <div className="flex items-center justify-center">
            <h1 className="text-7xl font-bold tracking-tight text-slate-50 font-serif glow blur-[0.6px]">
              Eagan
            </h1>
          </div>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit}>
          <div className="max-w-4xl mx-auto relative group blur-[0.35px]">
            <div className="relative">
              <textarea
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="What would you like to explore?"
                rows={3}
                className="w-full bg-[#19191A]/80 backdrop-blur-sm border-2 border-[#F2EEC8]/20 text-white placeholder:text-white/50 rounded-2xl px-6 py-5 text-lg font-round 
                  shadow-[0_0_0_1px_rgba(242,238,200,0.05)] 
                  focus-visible:outline-none 
                  focus-visible:shadow-[0_0_30px_rgba(242,238,200,0.15)] 
                  focus-visible:border-[#F2EEC8]/40
                  transition-all duration-300 ease-in-out
                  resize-none
                  hover:border-[#F2EEC8]/30
                  hover:shadow-[0_0_15px_rgba(242,238,200,0.1)]
                  placeholder:opacity-50
                  placeholder:transition-opacity
                  placeholder:duration-300
                  focus:placeholder:opacity-70"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="lg"
                className="absolute bottom-5 right-5 h-12 px-8 bg-[#F2EEC8] hover:bg-[#ededd4] text-[#1E1F1C] 
                  rounded-xl transition-all duration-300 hover:scale-105 
                  hover:shadow-[0_0_21px_rgba(242,238,200,0.4)] 
                  group border border-[#F2EEC8]/30
                  before:absolute before:inset-0 before:rounded-xl
                  before:bg-gradient-to-r before:from-[#F2EEC8]/20 before:via-transparent before:to-transparent
                  before:animate-shimmer before:bg-[length:200%_100%]"
                disabled={isLoading}
              >
                {mode === "browse" ? (
                  <LightbulbIcon className={`w-5 h-5 mr-2.5 transition-transform group-hover:scale-110 group-hover:rotate-12 ${isLoading ? 'animate-spin' : ''}`} />
                ) : (
                  <BookOpenIcon className={`w-5 h-5 mr-2.5 transition-transform group-hover:scale-110 ${isLoading ? 'animate-spin' : ''}`} />
                )}
                <span className="font-round text-lg font-medium">
                  {isLoading ? 'Loading...' : mode === "browse" ? 'Browse' : 'Write Blog'}
                </span>
              </Button>
            </div>
          </div>
        </form>

        {/* Mode Selector - Moved here below search box */}
        <div className="flex justify-center items-center">
          <div className="inline-flex rounded-full border-2 border-[#F2EEC8]/20 backdrop-blur-sm relative
                        before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-r 
                        before:from-[#F2EEC8]/5 before:via-[#F2EEC8]/10 before:to-[#F2EEC8]/5
                        before:opacity-70 before:z-[-1] hover:before:opacity-100
                        transition-all duration-300 group/selector
                        hover:border-[#F2EEC8]/30 hover:shadow-[0_0_20px_rgba(242,238,200,0.15)]">
            <div className="absolute inset-0 bg-[#F2EEC8]/5 rounded-full opacity-0 group-hover/selector:opacity-100 transition-opacity duration-300"></div>
            
            {/* Selection Indicator */}
            <div 
              className={`absolute top-0 bottom-0 rounded-full bg-[#F2EEC8] transition-all duration-200 ease-in-out z-0 ${
                mode === "browse" ? "left-0 right-[50%]" : "left-[50%] right-0"
              }`}
              style={{
                boxShadow: "0 0 20px rgba(242, 238, 200, 0.3)",
              }}
            ></div>
            
            <button
              className={`relative z-10 px-6 py-2.5 rounded-full transition-all duration-200 flex items-center justify-center gap-2 w-[140px] ${
                mode === "browse" 
                  ? "text-[#1E1F1C]" 
                  : "text-[#F2EEC8] hover:text-white"
              }`}
              onClick={() => setMode("browse")}
              aria-pressed={mode === "browse"}
            >
              <span className="flex items-center justify-center">
                <LightbulbIcon className={`w-[18px] h-[18px] transition-all duration-200 ${
                  mode === "browse" 
                    ? "text-[#1E1F1C] scale-100" 
                    : "text-[#F2EEC8] scale-90"
                }`} />
              </span>
              <span className={`text-sm font-medium tracking-wide`}>Browse</span>
            </button>
            
            <button
              className={`relative z-10 px-6 py-2.5 rounded-full transition-all duration-200 flex items-center justify-center gap-2 w-[140px] ${
                mode === "blog" 
                  ? "text-[#1E1F1C]" 
                  : "text-[#F2EEC8] hover:text-white"
              }`}
              onClick={() => setMode("blog")}
              aria-pressed={mode === "blog"}
            >
              <span className="flex items-center justify-center">
                <BookOpenIcon className={`w-[18px] h-[18px] transition-all duration-200 ${
                  mode === "blog" 
                    ? "text-[#1E1F1C] scale-100" 
                    : "text-[#F2EEC8] scale-90"
                }`} />
              </span>
              <span className={`text-sm font-medium tracking-wide`}>Blog</span>
            </button>
          </div>
        </div>

        {/* History Button */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 font-serif blur-[0.3px] z-50">
          <Button
            variant="ghost"
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "text-[#F2EEC8] flex items-center gap-2 z-50 text-md duration-300 transition-all",
              showHistory && "bg-[#F2EEC8]/10"
            )}
            disabled={chatsLoading && blogsLoading}
          >
            <BookOpenIcon className="w-5 h-5" />
            Library
            <ChevronUpIcon className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''} ${showHistory ? 'shadow-[0_0_31px_rgba(242,238,200,0.15)]' : ''}`} />
          </Button>
        </div>

        {/* Semi-Circular Glow */}
        {showHistory && (
          <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-96 h-96">
            <div className="w-full h-full bg-[#F2EEC8] translate-y-1/2 opacity-100 blur-[150px] rounded-full shadow-[0_0_1px_rgba(242,238,200,0.15)]"></div>
          </div>
        )}
      </div>

      {/* Library Modal */}
      {showHistory && (
        <div 
          className="fixed inset-0 w-[100vw] h-[100vh] m-0 mx-0 my-0 p-0 bg-black/30 backdrop-blur-[2px] flex items-end justify-center z-30" 
          onClick={handleCloseHistory}
        >
          <div className="w-full max-w-2xl mx-auto relative mb-16 max-h-[80vh] overflow-y-auto hide-scrollbar px-6" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-5 font-round">
              {/* Tab Selector */}
              <div className="flex items-center justify-center mb-4 relative">
                <div className="inline-flex rounded-full border-2 border-[#F2EEC8]/20 backdrop-blur-sm relative
                  before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-r 
                  before:from-[#F2EEC8]/5 before:via-[#F2EEC8]/10 before:to-[#F2EEC8]/5
                  before:opacity-70 before:z-[-1] hover:before:opacity-100
                  transition-all duration-300 group/selector
                  hover:border-[#F2EEC8]/30 hover:shadow-[0_0_20px_rgba(242,238,200,0.15)]">
                  <div className="absolute inset-0 bg-[#F2EEC8]/5 rounded-full opacity-0 group-hover/selector:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Tab Selection Indicator */}
                  <div 
                    className={`absolute top-0 bottom-0 rounded-full bg-[#F2EEC8] transition-all duration-200 ease-in-out z-0 ${
                      activeTab === "explorations" ? "left-0 right-[50%]" : "left-[50%] right-0"
                    }`}
                    style={{
                      boxShadow: "0 0 20px rgba(242, 238, 200, 0.3)",
                    }}
                  ></div>
                  
                  <button
                    className={`relative z-10 px-6 py-2.5 rounded-full transition-all duration-200 flex items-center justify-center gap-2 w-[160px] ${
                      activeTab === "explorations" 
                        ? "text-[#1E1F1C]" 
                        : "text-[#F2EEC8] hover:text-white"
                    }`}
                    onClick={() => setActiveTab("explorations")}
                    aria-pressed={activeTab === "explorations"}
                  >
                    <span className="flex items-center justify-center">
                      <MessageSquareIcon className={`w-[18px] h-[18px] transition-all duration-200 ${
                        activeTab === "explorations" 
                          ? "text-[#1E1F1C] scale-100" 
                          : "text-[#F2EEC8] scale-90"
                      }`} />
                    </span>
                    <span className={`text-sm font-medium tracking-wide`}>Explorations</span>
                  </button>
                  
                  <button
                    className={`relative z-10 px-6 py-2.5 rounded-full transition-all duration-200 flex items-center justify-center gap-2 w-[160px] ${
                      activeTab === "blogs" 
                        ? "text-[#1E1F1C]" 
                        : "text-[#F2EEC8] hover:text-white"
                    }`}
                    onClick={() => setActiveTab("blogs")}
                    aria-pressed={activeTab === "blogs"}
                  >
                    <span className="flex items-center justify-center">
                      <BookOpenIcon className={`w-[18px] h-[18px] transition-all duration-200 ${
                        activeTab === "blogs" 
                          ? "text-[#1E1F1C] scale-100" 
                          : "text-[#F2EEC8] scale-90"
                      }`} />
                    </span>
                    <span className={`text-sm font-medium tracking-wide`}>Blogs</span>
                  </button>
                </div>
              </div>

              {/* Tab Content Counter */}
              <div className="flex items-center justify-end mb-2 h-5">
                <span className="text-[#F2EEC8] text-sm tracking-wide min-w-[120px] text-right">
                  {activeTab === "explorations" 
                    ? `${chats.length} explorations collected` 
                    : `${blogs.length} blogs created`}
                </span>
              </div>

              {/* Tab Content Container - Fixed height to prevent layout shift */}
              <div className="relative min-h-[700px]">
                {/* Explorations Tab Content */}
                <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === "explorations" ? "opacity-100 z-10" : "opacity-0 -z-10"}`}>
                  {chatsLoading ? (
                    <div className="space-y-6">
                      {[...Array(3)].map((_, index) => (
                        <div 
                          key={index} 
                          className="animate-pulse flex space-x-4 p-4 rounded-xl backdrop-blur-sm bg-[#121211]/90"
                          style={{
                            transform: `translateY(${index * 5}px)`,
                            opacity: 1 - (index * 0.02)
                          }}
                        >
                          <div className="rounded-full bg-[#F2EEC8]/40 h-10 w-10"></div>
                          <div className="flex-1 space-y-3">
                            <div className="h-4 bg-[#F2EEC8]/40 rounded-full w-3/4"></div>
                            <div className="h-3 bg-[#F2EEC8]/30 rounded-full w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chats.slice(0, showAllChats ? chats.length : 7).map((chat, index) => (
                        <div
                          key={chat.chat_id}
                          onClick={() => handleChatClick(chat.chat_id)}
                          className={cn(
                            "group flex items-center gap-4 p-4 cursor-pointer rounded-xl",
                            "backdrop-blur-[3px]",
                            "bg-[#121211]/90 hover:bg-[#1a1a19]/90",
                            "border border-[#F2EEC8]/10 hover:border-[#F2EEC8]/30",
                            "transition-all duration-300",
                            "hover:shadow-[0_0_25px_rgba(242,238,200,0.15)]",
                            "hover:-translate-y-0.5"
                          )}
                          style={{
                            transform: `translateY(${index * 2}px)`,
                            opacity: 1,
                            animation: index < 7 ? `floatIn 0.4s ${(Math.min(7, chats.length) - index) * 0.03}s both` : 'none'
                          }}
                        >
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#F2EEC8]/[0.3] flex items-center justify-center group-hover:bg-[#F2EEC8]/[0.4] transition-colors duration-300">
                            <MessageSquareIcon className="w-5 h-5 text-[#F2EEC8] group-hover:text-[#F2EEC8]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[#F2EEC8] font-medium truncate group-hover:text-[#F2EEC8]">
                              {chat.chat_title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1.5">
                              <ClockIcon className="w-3 h-3 text-[#F2EEC8]/90" />
                              <p className="text-sm text-[#F2EEC8]/90 font-light tracking-wide">{formatDate(chat.created_at)}</p>
                            </div>
                          </div>
                          <ChevronRightIcon className="w-4 h-4 text-[#F2EEC8]/80 group-hover:text-[#F2EEC8] group-hover:translate-x-0.5 transition-all duration-300" />
                        </div>
                      ))}

                      {chats.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <MessageSquareIcon className="w-14 h-14 text-[#F2EEC8]/30 mb-4" />
                          <p className="text-[#F2EEC8]/70 text-sm max-w-xs">
                            No explorations yet. Start a search to begin your first exploration!
                          </p>
                        </div>
                      )}

                      {!showAllChats && chats.length > 7 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAllChats(true);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-6
                            text-[#F2EEC8]/90 hover:text-[#F2EEC8]
                            transition-all duration-300 group"
                        >
                          <span className="text-sm font-light tracking-wide">
                            Reveal {chats.length - 7} more
                          </span>
                          <ChevronRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-300" />
                        </button>
                      )}

                      {showAllChats && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAllChats(false);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-6
                            text-[#F2EEC8]/90 hover:text-[#F2EEC8]
                            transition-all duration-300 group"
                        >
                          <span className="text-sm font-light tracking-wide">Show less</span>
                          <ChevronUpIcon className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Blogs Tab Content */}
                <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === "blogs" ? "opacity-100 z-10" : "opacity-0 -z-10"}`}>
                  {blogsLoading ? (
                    <div className="space-y-6">
                      {[...Array(3)].map((_, index) => (
                        <div 
                          key={index} 
                          className="animate-pulse flex space-x-4 p-4 rounded-xl backdrop-blur-sm bg-[#121211]/90"
                          style={{
                            transform: `translateY(${index * 5}px)`,
                            opacity: 1 - (index * 0.02)
                          }}
                        >
                          <div className="rounded-full bg-[#F2EEC8]/40 h-10 w-10"></div>
                          <div className="flex-1 space-y-3">
                            <div className="h-4 bg-[#F2EEC8]/40 rounded-full w-3/4"></div>
                            <div className="h-3 bg-[#F2EEC8]/30 rounded-full w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {blogs.slice(0, showAllBlogs ? blogs.length : 7).map((blog, index) => (
                        <div
                          key={blog.blog_id}
                          onClick={() => handleBlogClick(blog.blog_id)}
                          className={cn(
                            "group flex items-center gap-4 p-4 cursor-pointer rounded-xl",
                            "backdrop-blur-[3px]",
                            "bg-[#121211]/90 hover:bg-[#1a1a19]/90",
                            "border border-[#F2EEC8]/10 hover:border-[#F2EEC8]/30",
                            "transition-all duration-300",
                            "hover:shadow-[0_0_25px_rgba(242,238,200,0.15)]",
                            "hover:-translate-y-0.5",
                            "overflow-hidden relative"
                          )}
                          style={{
                            transform: `translateY(${index * 2}px)`,
                            opacity: 1,
                            animation: index < 7 ? `floatIn 0.4s ${(Math.min(7, blogs.length) - index) * 0.03}s both` : 'none'
                          }}
                        >
                          {/* Status indicator band */}
                          <div className={`absolute top-0 left-0 h-full w-1 ${getBlogStatusClass(blog)}`}></div>
                          
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#F2EEC8]/[0.3] flex items-center justify-center group-hover:bg-[#F2EEC8]/[0.4] transition-colors duration-300">
                            <FileTextIcon className="w-5 h-5 text-[#F2EEC8] group-hover:text-[#F2EEC8]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[#F2EEC8] font-medium truncate group-hover:text-[#F2EEC8]">
                              {blog.blog_topic}
                            </h3>
                            <div className="flex items-center gap-3 mt-1.5">
                              <div className="flex items-center gap-1.5">
                                <ClockIcon className="w-3 h-3 text-[#F2EEC8]/90" />
                                <p className="text-sm text-[#F2EEC8]/90 font-light tracking-wide">{formatDate(blog.created_at)}</p>
                              </div>
                              
                              {/* New creative status indicator */}
                              {blog.status?.toLowerCase() === 'completed' || blog.status?.toLowerCase() === 'blog_done' ? (
                                <div className="relative flex items-center">
                                  <div className="flex items-center px-2 py-0.5 rounded-md border border-[#9AE6B4]/30 bg-[#9AE6B4]/5">
                                    <CheckCircleIcon className="w-3.5 h-3.5 text-[#9AE6B4] mr-1.5" />
                                    <span className="text-xs font-medium text-[#9AE6B4]">Completed</span>
                                  </div>
                                </div>
                              ) : blog.status?.toLowerCase() === 'in_progress' ? (
                                <div className="relative flex items-center">
                                  <div className="flex items-center px-2 py-0.5 rounded-md border border-[#F2EEC8]/30 bg-[#F2EEC8]/5">
                                    <LoaderIcon className="w-3.5 h-3.5 text-[#F2EEC8] animate-spin mr-1.5" />
                                    <span className="text-xs font-medium text-[#F2EEC8]">Writing...</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative flex items-center">
                                  <div className="flex items-center px-2 py-0.5 rounded-md border border-[#F2EEC8]/20 bg-[#F2EEC8]/5">
                                    <PencilIcon className="w-3.5 h-3.5 text-[#F2EEC8]/70 mr-1.5" />
                                    <span className="text-xs font-medium text-[#F2EEC8]/70">Pending</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <ChevronRightIcon className="w-4 h-4 text-[#F2EEC8]/80 group-hover:text-[#F2EEC8] group-hover:translate-x-0.5 transition-all duration-300" />
                        </div>
                      ))}

                      {blogs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <BookOpenIcon className="w-14 h-14 text-[#F2EEC8]/30 mb-4" />
                          <p className="text-[#F2EEC8]/70 text-sm max-w-xs">
                            No blogs created yet. Try the "Blog" mode to write your first blog!
                          </p>
                        </div>
                      )}

                      {!showAllBlogs && blogs.length > 7 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAllBlogs(true);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-6
                            text-[#F2EEC8]/90 hover:text-[#F2EEC8]
                            transition-all duration-300 group"
                        >
                          <span className="text-sm font-light tracking-wide">
                            Reveal {blogs.length - 7} more
                          </span>
                          <ChevronRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-300" />
                        </button>
                      )}

                      {showAllBlogs && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAllBlogs(false);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-6
                            text-[#F2EEC8]/90 hover:text-[#F2EEC8]
                            transition-all duration-300 group"
                        >
                          <span className="text-sm font-light tracking-wide">Show less</span>
                          <ChevronUpIcon className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}