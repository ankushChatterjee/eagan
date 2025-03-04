import { useQuery } from '@tanstack/react-query'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchIcon, Loader2, LoaderPinwheel, ChevronRightIcon, ChevronLeftIcon } from "lucide-react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pill } from "@/components/ui/pill";
import { SearchResponse } from '@/types/search';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
// @ts-ignore
import { EventSourcePolyfill } from "event-source-polyfill";
import { useState, useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import rehypePrism from 'rehype-prism-plus';

// Custom shimmer animation styles
const customShimmerStyles = `
  @keyframes enhanced-shimmer {
    0% {
      background-position: -200% 0;
      text-shadow: 0 0 10px rgba(242, 238, 200, 0);
    }
    50% {
      text-shadow: 0 0 15px rgba(242, 238, 200, 0.5);
    }
    100% {
      background-position: 200% 0;
      text-shadow: 0 0 20px rgba(242, 238, 200, 0);
    }
  }
  
  .enhanced-shimmer {
    background: linear-gradient(
      90deg, 
      rgba(242, 238, 200, 0.4) 0%, 
      rgba(242, 238, 200, 1) 25%, 
      rgba(242, 238, 200, 1) 50%, 
      rgba(242, 238, 200, 0.4) 75%
    );
    background-size: 200% 100%;
    animation: enhanced-shimmer 3s ease-in-out infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-fill-color: transparent;
    display: inline-block;
    filter: drop-shadow(0 0 10px rgba(242, 238, 200, 0.1));
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  .float-animation {
    animation: float 3s ease-in-out infinite;
  }

  .glass-effect {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: linear-gradient(
      180deg,
      rgba(42, 43, 40, 0.8) 0%,
      rgba(30, 31, 28, 0.8) 100%
    );
    border: 1px solid rgba(242, 238, 200, 0.1);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  }

  .glass-effect-subtle {
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    background: rgba(30, 31, 28, 0.85);
    border-top: 1px solid rgba(242, 238, 200, 0.05);
  }

  .search-bar-shadow {
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
  }

  .source-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: center center;
    z-index: 1;
  }

  .source-card:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 10px 30px rgba(242, 238, 200, 0.1);
    z-index: 2;
  }

  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const chatId = searchParams.get('chat_id');
  const inputRef = useRef<HTMLInputElement>(null);

  // Streaming state
  const [streamStatus, setStreamStatus] = useState<{
    queries?: string[];
    resultsCount?: number;
    chatHistory?: any[];
    pendingQuery?: boolean;
  }>({
    chatHistory: [],
    pendingQuery: false
  });
  const [streamingSummary, setStreamingSummary] = useState("");
  const [streamedSearchResults, setStreamedSearchResults] = useState<SearchResponse['search_results']>([]);

  // UI state
  const [showAllSources, setShowAllSources] = useState(false);
  const [currentChatIndex, setCurrentChatIndex] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Add state for tracking loaded images
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  // Function to handle successful image loads
  const handleImageLoad = (src: string) => {
    setLoadedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(src);
      return newSet;
    });
  };

  // Function to handle image load errors
  const handleImageError = (src: string) => {
    setLoadedImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(src);
      return newSet;
    });
  };

  // Fetch chat history and perform search
  const {
    data: searchResult,
    isLoading: isSearchLoading,
    refetch: refetchSearch
  } = useQuery<SearchResponse>({
    queryKey: ['searchWithHistory', chatId, query],
    queryFn: ({ queryKey }) => {
      setStreamingSummary('');
      setStreamedSearchResults([]);

      return new Promise<SearchResponse>((resolve, reject) => {
        const eventSource = new EventSourcePolyfill(
          `http://localhost:8000/stream-search-with-history?chat_id=${queryKey[1] || ''}&q=${encodeURIComponent(queryKey[2] || '')}` as string,
          {
            headers: { 'Accept': 'text/event-stream' },
            heartbeatTimeout: 60000,
          }
        );

        let currentData: Partial<SearchResponse> = {
          query: query || '',
          search_results: [],
          summary: '',
          suggestions: []
        };

        eventSource.addEventListener('chatHistory', (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          if (data.chatHistory) {
            setStreamStatus(prev => ({
              ...prev,
              chatHistory: data.chatHistory,
              pendingQuery: data.pending_query
            }));
            setCurrentChatIndex(data.chatHistory.length - 1);
          }
          if (data.pending_query) {
            setStreamStatus(prev => ({ ...prev, pendingQuery: true }));
            setStreamingSummary('');
            setStreamedSearchResults([]);
          }
        });

        eventSource.addEventListener('breakdown', (e: MessageEvent) => {
          const queries = JSON.parse(e.data);
          setStreamStatus(prev => ({ ...prev, queries }));
        });

        eventSource.addEventListener('search_results', (e: MessageEvent) => {
          const results = JSON.parse(e.data);
          currentData.search_results = results;
          setStreamStatus(prev => ({ ...prev, resultsCount: results.length }));
          setStreamedSearchResults(results);
        });

        eventSource.addEventListener('summary_part', (e: MessageEvent) => {
          const part = JSON.parse(e.data);
          setStreamingSummary(prev => prev + part);
        });

        eventSource.addEventListener('complete', (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          currentData.summary = data.summary;
          currentData.suggestions = data.suggestions;
          eventSource.close();

          if (data.status === 'SEARCH_DONE') {
            setStreamStatus(prev => {
              const updatedHistory = [...(prev.chatHistory || [])];
              const existingIndex = updatedHistory.findIndex(
                chat => chat.query === currentData.query
              );

              if (existingIndex >= 0) {
                updatedHistory[existingIndex] = { ...currentData };
              } else {
                updatedHistory.push({ ...currentData });
              }

              return {
                ...prev,
                chatHistory: updatedHistory,
                pendingQuery: false
              };
            });
            setCurrentChatIndex(prev => {
              return streamStatus.chatHistory ? streamStatus.chatHistory.length : 0;
            });
          }

          resolve(currentData as SearchResponse);
        });

        eventSource.addEventListener('error', (e: MessageEvent) => {
          eventSource.close();
          setStreamStatus(prev => ({ ...prev, pendingQuery: false }));
          reject(new Error('Stream error'));
        });
      });
    },
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });

  // Handle input value and trigger search on mount if query exists
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = query || '';
      if (query && !isSearchLoading) {
        refetchSearch();
      }
    }
  }, [query, refetchSearch]);

  const handleSearch = async (searchQuery: string) => {
    if (searchQuery.trim()) {
      try {
        await fetch('http://localhost:8000/create-pending-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ chat_id: chatId, query: searchQuery })
        });
        setStreamStatus(prev => ({ ...prev, queries: [], pendingQuery: true, resultsCount: undefined }));
        setStreamingSummary('');
        setStreamedSearchResults([]);
      } catch (error) {
        console.error('Failed to create pending chat:', error);
      }
      refetchSearch();
    }
  };

  const handlePreviousChat = () => {
    if (currentChatIndex > 0) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentChatIndex(prev => prev - 1);
        setIsTransitioning(false);
      }, 150);
    }
  };

  const handleNextChat = () => {
    if (currentChatIndex < (streamStatus.chatHistory?.length || 0) - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentChatIndex(prev => prev + 1);
        setIsTransitioning(false);
      }, 150);
    }
  };

  const currentChat = streamStatus.chatHistory?.[currentChatIndex];
  const isStreaming = streamStatus.pendingQuery || isSearchLoading;

  const displaySearchResults = isStreaming
    ? streamedSearchResults
    : currentChat?.search_results || [];
  const displaySummary = isStreaming
    ? streamingSummary
    : currentChat?.summary || "Enter a search query to get started";

  return (
    <div className="min-h-screen bg-[#1E1F1C] text-white relative overflow-x-hidden">
      <style>{customShimmerStyles}</style>
      <div className="container mx-auto px-4 py-8 pb-32">
        <div className={`pb-6 mb-6 ${isTransitioning ? 'transition-opacity duration-300 opacity-50' : 'opacity-100'}`}>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-display text-[#F2EEC8]/60 uppercase tracking-wider">Sources</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-[#F2EEC8]/10 to-transparent"></div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-3 hide-scrollbar -mx-4 px-4 pt-2">
            {isStreaming && !displaySearchResults.length ? (
              <>
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="flex-none animate-fade-in" style={{ animationDelay: `${index * 80}ms` }}>
                    <div className="flex items-center gap-3 w-56 px-5 py-3.5 rounded-lg glass-effect">
                      <Skeleton className="w-5 h-5 rounded-sm bg-white/[0.03]" />
                      <div className="flex-1 space-y-2.5">
                        <Skeleton className="h-4 w-36 bg-white/[0.03]" />
                        <Skeleton className="h-3 w-28 bg-white/[0.03]" />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {displaySearchResults
                  .slice(0, showAllSources ? undefined : 5)
                  .map((result: any, index: number) => (
                    <a
                      key={index}
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-none glass-effect
                      px-5 py-3.5 rounded-lg
                      hover:border-[#F2EEC8]/30 
                      hover:shadow-[0_0_40px_rgba(242,238,200,0.08)]
                      relative overflow-visible group
                      transition-all duration-300
                      hover:-translate-y-1 hover:scale-[1.02]
                      hover:z-10"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <div className="flex items-center gap-4 w-56">
                        <div className="w-5 h-5 rounded-sm bg-white/[0.05] p-0.5 flex items-center justify-center
                          ring-1 ring-white/10 group-hover:ring-[#F2EEC8]/30 transition-all">
                          <img
                            src={result.meta_url.favicon}
                            alt=""
                            className="w-full h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/90 text-sm leading-relaxed font-display truncate
                          group-hover:text-[#F2EEC8] transition-colors">
                            {result.title}
                          </p>
                          <p className="text-white/40 text-xs truncate mt-1.5 font-mono">
                            {new URL(result.url).hostname}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))}
                {!showAllSources && displaySearchResults.length > 5 && (
                  <button
                    onClick={() => setShowAllSources(true)}
                    className="flex-none source-card glass-effect
                      flex items-center gap-4 px-5 py-3.5 rounded-lg
                      text-white/70 hover:text-[#F2EEC8] group min-w-fit"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-2">
                        {displaySearchResults
                          .slice(5, 8)
                          .map((result: any, index: number) => (
                            <div
                              key={index}
                              className="w-5 h-5 bg-white/[0.05] p-0.5 
                                flex items-center justify-center rounded-sm
                                ring-1 ring-white/10 transition-all
                                group-hover:translate-x-[2px]"
                              style={{ transitionDelay: `${index * 50}ms` }}
                            >
                              <img
                                src={result.meta_url.favicon}
                                alt=""
                                className="w-full h-full object-contain opacity-70 
                                  group-hover:opacity-100 transition-opacity"
                              />
                            </div>
                          ))}
                      </div>
                      <span className="text-sm font-display whitespace-nowrap">
                        See all {displaySearchResults.length} sources
                      </span>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div className="lg:col-span-1">
            <div className={`rounded-xl p-6 glass-effect ${isTransitioning ? 'transition-opacity duration-300 opacity-50' : 'opacity-100'}`}>
              {isStreaming && !streamingSummary ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-8">
                  <div className="flex flex-col items-center space-y-8">
                    <div className="flex items-center gap-4 float-animation">
                      <span className="text-5xl font-display tracking-tight font-bold enhanced-shimmer">
                        Browsing the web
                      </span>
                    </div>
                    {streamStatus.queries && (
                      <div className="flex flex-col items-center space-y-6 w-full max-w-2xl">
                        <div className="flex flex-wrap gap-2.5 justify-center">
                          {streamStatus.queries.map((q: string, i: number) => (
                            <Pill
                              key={i}
                              className={cn(
                                "animate-slide-up transition-all duration-500 flex items-center gap-2.5 py-2 px-4 text-lg",
                                !streamStatus.resultsCount && "animate-glow"
                              )}
                              style={{ animationDelay: `${i * 150}ms` }}
                            >
                              <SearchIcon className="w-6 h-6 text-[#F2EEC8]" />
                              <span className="text-sm">{q}</span>
                            </Pill>
                          ))}
                        </div>
                      </div>
                    )}
                    {streamStatus.resultsCount && streamStatus.resultsCount > 0 && (
                      <div className="animate-fade-in-up text-center mt-4">
                        <span className="text-3xl font-display tracking-tight font-bold enhanced-shimmer">
                          Reading {streamStatus.resultsCount} search results...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="prose font-round prose-invert max-w-none
                                prose-p:text-lg prose-p:leading-relaxed
                                prose-strong:text-[#F2EEC8] prose-strong:font-semibold
                                prose-a:text-[#F2EEC8] prose-a:no-underline hover:prose-a:underline
                                prose-headings:text-[#F2EEC8] prose-headings:font-display
                                prose-code:text-[#F2EEC8] prose-code:bg-[#F2EEC8]/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md
                                prose-blockquote:border-l-[#F2EEC8] prose-blockquote:bg-[#F2EEC8]/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1
                                prose-em:text-[#F2EEC8]/90
                                selection:bg-[#F2EEC8]/20 
                                selection:text-[#F2EEC8]
                                animate-fade-in">
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeSanitize, rehypePrism]}
                    >
                      {displaySummary}
                    </Markdown>
                  </div>
                  {searchResult?.suggestions && currentChatIndex === (streamStatus.chatHistory?.length || 0) - 1 && (
                    <div className="flex flex-wrap gap-2.5 mt-8 animate-fade-in-up">
                      {(searchResult as any).suggestions.map((suggestion: string, index: number) => (
                        <Pill
                          key={index}
                          onClick={() => handleSearch(suggestion)}
                          className="py-2 px-4 hover:scale-105 transition-transform cursor-pointer"
                        >
                          {suggestion}
                        </Pill>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className={`sticky top-6 ${isTransitioning ? 'transition-opacity duration-300 opacity-50' : 'opacity-100'}`}>
              <div className="columns-2 gap-3 space-y-3">
                {isStreaming && !displaySearchResults.length ? (
                  <>
                    {[...Array(4)].map((_, index) => (
                      <div key={index} className="animate-fade-in break-inside-avoid" style={{ animationDelay: `${index * 100}ms` }}>
                        <Skeleton className="bg-white/[0.03] w-full h-32 rounded-lg" />
                      </div>
                    ))}
                  </>
                ) : (
                  displaySearchResults
                    .filter((result: any) => result.thumbnail && !result.thumbnail.logo)
                    .map((result: any, index: number) => (
                      <a
                        key={index}
                        href={result.thumbnail!.src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "block group relative animate-fade-in-down mb-3 break-inside-avoid",
                          !loadedImages.has(result.thumbnail!.src) && "hidden"
                        )}
                      >
                        <div className="overflow-hidden rounded-lg">
                          <img
                            src={result.thumbnail!.src}
                            alt={result.title}
                            onLoad={() => handleImageLoad(result.thumbnail!.src)}
                            onError={() => handleImageError(result.thumbnail!.src)}
                            className="w-full transform transition-all duration-500
                              group-hover:scale-110 
                              group-hover:shadow-[0_0_30px_rgba(242,238,200,0.2)]"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </a>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 glass-effect-subtle py-3">
        <div className="container mx-auto px-4 relative">
          <div
            onClick={() => navigate('/')}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-3 cursor-pointer group"
          >
            <h2 className="text-xl font-bold tracking-tight text-[#F2EEC8]/80 font-serif group-hover:text-[#F2EEC8] transition-colors">
              Eagan
            </h2>
          </div>

          <div className="flex gap-3 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                type="text"
                defaultValue={query || ''}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(e.currentTarget.value);
                  }
                }}
                placeholder="Dive deep on this topic"
                className="h-10 glass-effect text-white placeholder:text-white/30 rounded-full px-5 text-sm font-display
                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F2EEC8]/20 focus-visible:border-[#F2EEC8]/20
                transition-all duration-300"
              />
            </div>
            <Button
              onClick={() => {
                if (inputRef.current) {
                  handleSearch(inputRef.current.value);
                }
              }}
              disabled={isSearchLoading}
              className="h-10 w-10 bg-[#F2EEC8]/90 hover:bg-[#F2EEC8] text-[#1E1F1C] rounded-full transition-all duration-300 
                hover:scale-105 hover:shadow-[0_0_20px_rgba(242,238,200,0.3)] 
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                group flex items-center justify-center p-2"
            >
              {isSearchLoading || isStreaming ? (
                <Loader2 className="w-10 h-10 animate-spin" />
              ) : (
                <SearchIcon className="transition-transform group-hover:scale-110" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {(streamStatus.chatHistory?.length || 0) > 1 && (
        <div className="fixed bottom-20 right-6 flex flex-col gap-2 items-center">
          <div className="text-[#F2EEC8]/80 font-display mb-2 glass-effect px-3 py-1 rounded-full text-sm">
            {currentChatIndex + 1}/{streamStatus.chatHistory?.length}
          </div>
          <Button
            onClick={handlePreviousChat}
            disabled={currentChatIndex === 0 || isSearchLoading}
            className="h-12 w-12 glass-effect text-white/60 hover:text-[#F2EEC8] rounded-full 
              transition-all duration-300 hover:scale-105
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              group flex items-center justify-center"
          >
            <ChevronLeftIcon className="w-10 h-10 transition-transform group-hover:-translate-x-0.5" />
          </Button>
          <Button
            onClick={handleNextChat}
            disabled={currentChatIndex === (streamStatus.chatHistory?.length || 0) - 1 || isSearchLoading}
            className="h-12 w-12 glass-effect text-white/60 hover:text-[#F2EEC8] rounded-full 
              transition-all duration-300 hover:scale-105
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              group flex items-center justify-center"
          >
            <ChevronRightIcon className="w-10 h-10 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default SearchResults;