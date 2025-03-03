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
import { EventSourcePolyfill } from "event-source-polyfill";
import { useState, useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import rehypePrism from 'rehype-prism-plus';
import { set } from 'react-hook-form';

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
          `http://localhost:8000/stream-search-with-history?chat_id=${queryKey[1] || ''}&q=${encodeURIComponent(queryKey[2] || '')}`,
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
    cacheTime: 0,
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

  // Reset streaming states when changing chat index
  // useEffect(() => {
  //   if (streamStatus.chatHistory && streamStatus.chatHistory[currentChatIndex]) {
  //     const currentChat = streamStatus.chatHistory[currentChatIndex];
  //     // setStreamingSummary(currentChat.summary || '');
  //     // setStreamedSearchResults(currentChat.search_results || []);
  //   }
  // }, [currentChatIndex, streamStatus.chatHistory]);

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
        setStreamStatus(prev => ({ ...prev, queries: [] }));
        setStreamStatus(prev => ({ ...prev, pendingQuery: true }));
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
    <div className="min-h-screen bg-[#1E1F1C] text-white relative">
      <div className="container mx-auto px-2 py-4 pb-24">
        <div className={`pb-4 mb-4 ${isTransitioning ? 'transition-opacity duration-300 opacity-50' : 'opacity-100'}`}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-display text-white/60">Sources</h3>
            <div className="h-px flex-1 bg-white/5"></div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {isStreaming && !displaySearchResults.length ? (
              <>
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="flex-none animate-fade-in" style={{ animationDelay: `${index * 80}ms` }}>
                    <div className="flex items-center gap-3 w-48 px-4 py-2.5 rounded-md bg-[#2A2B28] border border-white/5">
                      <Skeleton className="w-4 h-4 rounded-sm bg-white/[0.03]" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32 bg-white/[0.03]" />
                        <Skeleton className="h-3 w-24 bg-white/[0.03]" />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {displaySearchResults
                  .slice(0, showAllSources ? undefined : 5)
                  .map((result, index) => (
                    <a
                      key={index}
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-none group animate-fade-in bg-[#2A2B28]/80 hover:bg-[#32332F]/80
                      px-4 py-2.5 rounded-md border border-white/5 transition-all duration-300
                      hover:border-[#F2EEC8]/30 
                      hover:shadow-[0_0_40px_rgba(242,238,200,0.08)]
                      before:absolute before:inset-0 before:rounded-md
                      before:bg-gradient-to-b before:from-[#F2EEC8]/10 before:to-transparent
                      before:opacity-0 before:transition-opacity hover:before:opacity-100
                      after:absolute after:inset-0 after:rounded-md
                      after:bg-[#F2EEC8]/5 after:blur-xl after:opacity-0
                      after:transition-opacity hover:after:opacity-100
                      relative backdrop-blur-md overflow-hidden"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <div className="flex items-center gap-3 w-48">
                        <div className="w-4 h-4 rounded-sm bg-white/[0.03] p-0.5 flex items-center justify-center">
                          <img
                            src={result.meta_url.favicon}
                            alt=""
                            className="w-full h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 text-sm leading-relaxed font-display truncate
                          group-hover:text-[#F2EEC8] transition-colors">
                            {result.title}
                          </p>
                          <p className="text-white/40 text-xs truncate mt-0.5">
                            {new URL(result.url).hostname}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))}
                {!showAllSources && displaySearchResults.length > 5 && (
                  <button
                    onClick={() => setShowAllSources(true)}
                    className="flex-none flex items-center gap-4 px-4 py-2.5 rounded-md 
                      bg-[#2A2B28] hover:bg-[#32332F] border border-white/5
                      transition-all duration-300 hover:border-[#F2EEC8]/20
                      text-white/60 hover:text-[#F2EEC8] group animate-fade-in min-w-fit"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-1.5 mr-1">
                        {displaySearchResults
                          .slice(5, 8)
                          .map((result, index) => (
                            <div
                              key={index}
                              className="w-4 h-4 bg-white/[0.03] p-0.5 
                                flex items-center justify-center
                                transition-all duration-300"
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
                    <ChevronRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
                {showAllSources && (
                  <button
                    onClick={() => setShowAllSources(false)}
                    className="flex-none flex items-center gap-2 px-4 py-2.5 rounded-md 
                      bg-[#2A2B28] hover:bg-[#32332F] border border-white/5
                      transition-all duration-300 hover:border-[#F2EEC8]/20
                      text-white/60 hover:text-[#F2EEC8] group animate-fade-in"
                  >
                    <span className="text-sm font-display whitespace-nowrap">
                      Show less
                    </span>
                    <ChevronRightIcon className="w-4 h-4 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <div className="lg:col-span-1">
            <div className={`rounded-lg p-4 backdrop-blur-sm border border-white/5 ${isTransitioning ? 'transition-opacity duration-300 opacity-50' : 'opacity-100'}`}>
              {isStreaming && !streamingSummary ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <div className="flex flex-col items-center space-y-6">
                    <div className="flex items-center gap-3">
                      <LoaderPinwheel className="w-6 h-6 text-[#F2EEC8] animate-spin" />
                      <h2 className="text-2xl font-display tracking-tight text-[#F2EEC8]/90">
                        Browsing the web
                      </h2>
                    </div>
                    {streamStatus.queries && (
                      <div className="flex flex-col items-center space-y-4 w-full max-w-xl">
                        <div className="flex flex-wrap gap-2 justify-center">
                          {streamStatus.queries.map((q, i) => (
                            <Pill
                              key={i}
                              className={cn(
                                "animate-slide-up transition-all duration-500 flex items-center gap-2",
                                !streamStatus.resultsCount && "animate-glow"
                              )}
                              style={{ animationDelay: `${i * 150}ms` }}
                            >
                              <SearchIcon className="w-4 h-4 text-[#F2EEC8]/70" />
                              <span className="text-sm">{q}</span>
                            </Pill>
                          ))}
                        </div>
                      </div>
                    )}
                    {streamStatus.resultsCount && (
                      <div className="animate-fade-in-up text-center">
                        <p className="text-xl font-display text-[#F2EEC8]/90">
                          Reading {streamStatus.resultsCount} search results...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="prose font-round prose-invert 
                                prose-strong:text-[#F2EEC8] 
                                prose-a:text-[#F2EEC8] 
                                prose-headings:text-[#F2EEC8]
                                prose-code:text-[#F2EEC8]
                                prose-blockquote:border-l-[#F2EEC8]
                                prose-em:text-[#F2EEC8]/80
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
                    <div className="flex flex-wrap gap-2 mt-6 fade-in-up">
                      {searchResult.suggestions.map((suggestion, index) => (
                        <Pill
                          key={index}
                          onClick={() => handleSearch(suggestion)}
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
            <div className={`sticky top-4 ${isTransitioning ? 'transition-opacity duration-300 opacity-50' : 'opacity-100'}`}>
              <div className="columns-2 gap-2 space-y-2">
                {isStreaming && !displaySearchResults.length ? (
                  <>
                    {[...Array(4)].map((_, index) => (
                      <div key={index} className="animate-fade-in break-inside-avoid" style={{ animationDelay: `${index * 100}ms` }}>
                        <Skeleton className="bg-slate-700 w-full h-28 rounded-lg" />
                      </div>
                    ))}
                  </>
                ) : (
                  displaySearchResults
                    .filter(result => result.thumbnail && !result.thumbnail.logo)
                    .map((result, index) => (
                      <a
                        key={index}
                        href={result.thumbnail!.src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group relative animate-fade-in-down mb-2 break-inside-avoid"
                      >
                        <img
                          src={result.thumbnail!.src}
                          alt={result.title}
                          className="w-full rounded-lg border border-[#F2EEC8]/10 
                            transition-all duration-300 
                            group-hover:border-[#F2EEC8]/30 
                            group-hover:scale-[1.02] 
                            group-hover:shadow-[0_0_20px_rgba(242,238,200,0.15)]
                            group-hover:z-10"
                        />
                      </a>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#1E1F1C]/90 backdrop-blur-sm border-t border-white/5 p-3">
        <div className="container mx-auto px-2 relative">
          <div
            onClick={() => navigate('/')}
            className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <h2 className="text-xl font-bold tracking-tight text-white font-serif">
              Eagan
            </h2>
          </div>

          <div className="flex gap-2 max-w-3xl mx-auto">
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
                className="h-10 bg-white/[0.03] border border-white/10 text-white placeholder:text-white/40 rounded-full px-4 text-sm font-display focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F2EEC8]/20 focus-visible:border-[#F2EEC8]/20"
              />
            </div>
            <Button
              onClick={() => {
                if (inputRef.current) {
                  handleSearch(inputRef.current.value);
                }
              }}
              disabled={isSearchLoading}
              className="h-10 px-4 bg-[#F2EEC8] hover:bg-white text-[#1E1F1C] rounded-full transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(242,238,200,0.3)] group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearchLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <SearchIcon className="w-5 h-5 transition-transform group-hover:scale-110" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {(streamStatus.chatHistory?.length || 0) > 1 && (
        <div className="fixed bottom-20 right-4 flex flex-col gap-2 items-center">
          <div className="text-white font-round mb-2">
            {currentChatIndex + 1}/{streamStatus.chatHistory?.length}
          </div>
          <Button
            onClick={handlePreviousChat}
            disabled={currentChatIndex === 0 || isSearchLoading}
            className="h-12 w-12 bg-[#2A2B28] hover:bg-[#32332F] text-white/60 hover:text-white rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="w-6 h-6 font-bold" />
          </Button>
          <Button
            onClick={handleNextChat}
            disabled={currentChatIndex === (streamStatus.chatHistory?.length || 0) - 1 || isSearchLoading}
            className="h-12 w-12 bg-[#2A2B28] hover:bg-[#32332F] text-white/60 hover:text-white rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRightIcon className="w-6 h-6 font-bold" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default SearchResults;