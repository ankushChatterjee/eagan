import { Button } from "@/components/ui/button"
import { LightbulbIcon, ChevronUpIcon, BookOpenIcon } from "lucide-react"
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

export default function HomePage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [chats, setChats] = useState([])
  const [chatsLoading, setChatsLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setIsLoading(true)
      try {
        const chatId = await createChatSession(searchQuery)
        navigate(`/search?q=${encodeURIComponent(searchQuery)}&chat_id=${chatId}`)
      } catch (error) {
        console.error('Search failed:', error)
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

  useEffect(() => {
    fetchChats()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (searchQuery.trim()) {
          handleSearch(e as unknown as React.FormEvent)
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
        <form onSubmit={handleSearch}>
          <div className="max-w-2xl mx-auto relative group blur-[0.35px]">
            <div className="relative">
              <textarea
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="What would you like to explore?"
                rows={3}
                className="w-full bg-[#19191A] border-2 border-[#F2EEC8]/20 text-white placeholder:text-white/50 rounded-2xl px-6 py-5 text-lg font-round 
                  shadow-[0_0_0_1px_rgba(242,238,200,0.05)] 
                  focus-visible:outline-none 
                  focus-visible:shadow-[0_0_20px_rgba(242,238,200,0.2)] 
                  focus-visible:border-[#F2EEC8]/40
                  transition-shadow duration-300
                  resize-none"
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
                <LightbulbIcon className={`w-5 h-5 mr-2.5 transition-transform group-hover:scale-110 group-hover:rotate-12 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="font-round text-lg font-medium">
                  {isLoading ? 'Loading...' : 'Browse'}
                </span>
              </Button>
            </div>
          </div>
        </form>

        {/* History Modal */}
        {showHistory && (
          <div className="fixed inset-0 bg-black backdrop-blur-sm bg-opacity-50 flex items-end justify-center z-30" onClick={handleCloseHistory}>
            <div className="rounded-lg p-6 w-full max-w-2xl mx-auto relative mb-16 max-h-[70vh] overflow-y-auto hide-scrollbar">
              {chatsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="animate-pulse flex space-x-4">
                      <div className="rounded-full bg-gray-700 h-10 w-10"></div>
                      <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-700 rounded"></div>
                          <div className="h-4 bg-gray-700 rounded w-5/6"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 font-round relative">
                  {chats.slice(0, 5).map((chat, index) => (
                    <div
                      key={chat.chat_id}
                      onClick={() => handleChatClick(chat.chat_id)}
                      className="flex items-center justify-between p-3 cursor-pointer bg-[#0b0b0a] 
                                 rounded-sm border border-[#2b2a20] transition-all duration-300 hover:shadow-[0_0_31px_rgba(242,238,200,0.15)]
                                  hover:border-[#F2EEC8]/30 
                                  before:absolute before:inset-0 before:rounded-md
                                  before:bg-gradient-to-b before:from-[#F2EEC8]/10 before:to-transparent
                                  before:opacity-0 before:transition-opacity hover:before:opacity-100
                                  after:absolute after:inset-0 after:rounded-md
                                  after:bg-[#F2EEC8]/5 after:blur-xl after:opacity-0
                                  after:transition-opacity hover:after:opacity-100"
                      style={{
                        animation: `bounceIn 0.6s ${(chats.length - index) * 0.02}s both`
                      }}
                    >
                      <div className="flex-1 text-left">
                        <strong className="font-semibold text-[#f2f0e0] overflow-ellipsis">{chat.chat_title}</strong>
                        <p className="text-sm text-gray-400">{formatDate(chat.created_at)}</p>
                      </div>
                    </div>
                  ))}
                  {chats.length > 5 && (
                    <div className="space-y-2 font-round">
                      {chats.slice(5).map((chat, index) => (
                        <div
                          key={chat.chat_id}
                          onClick={() => handleChatClick(chat.chat_id)}
                          className="flex items-center justify-between p-3 cursor-pointer bg-[#0b0b0a] 
                                     rounded-sm border border-[#2b2a20] transition-all duration-300 hover:shadow-[0_0_31px_rgba(242,238,200,0.15)]
                                      hover:border-[#F2EEC8]/30 
                                      before:absolute before:inset-0 before:rounded-md
                                      before:bg-gradient-to-b before:from-[#F2EEC8]/10 before:to-transparent
                                      before:opacity-0 before:transition-opacity hover:before:opacity-100
                                      after:absolute after:inset-0 after:rounded-md
                                      after:bg-[#F2EEC8]/5 after:blur-xl after:opacity-0
                                      after:transition-opacity hover:after:opacity-100"
                          style={{
                            animation: `bounceIn 0.6s ${(chats.length - index) * 0.02}s both`
                          }}
                        >
                          <div className="flex-1 text-left">
                            <strong className="font-semibold text-[#f2f0e0] overflow-ellipsis">{chat.chat_title}</strong>
                            <p className="text-sm text-gray-400">{formatDate(chat.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#1E1F1C] to-transparent pointer-events-none"></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Button */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 font-serif blur-[0.3px] z-50">
          <Button
            variant="ghost"
            onClick={() => setShowHistory(!showHistory)}
            className="text-[#F2EEC8] flex items-center gap-2 z-50 text-md duration-300 transition-all"
          >
            <BookOpenIcon className="w-5 h-5" />
            Library
            <ChevronUpIcon className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''} ${showHistory ? 'shadow-[0_0_31px_rgba(242,238,200,0.15)]' : ''}`} />
          </Button>
        </div>

        {/* Semi-Circular Glow */}
        {showHistory && (
          <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-96 h-96">
            <div className="w-full h-full bg-[#F2EEC8] translate-y-1/2 opacity-100 blur-[80px] rounded-full shadow-[0_0_1px_rgba(242,238,200,0.15)"></div>
          </div>
        )}
      </div>
    </div>
  )
}