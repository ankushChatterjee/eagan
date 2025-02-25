import {
  useQuery,
} from '@tanstack/react-query'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchIcon, Loader2, LoaderPinwheel, ChevronRightIcon } from "lucide-react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pill } from "@/components/ui/pill";
import { SearchResponse } from '@/types/search';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
// @ts-ignore
import { EventSourcePolyfill } from "event-source-polyfill";
import { useState } from 'react';
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import rehypePrism from 'rehype-prism-plus';

function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');

  const [streamStatus, setStreamStatus] = useState<{
    queries?: string[];
    resultsCount?: number;
  }>({});

  const [streamingSummary, setStreamingSummary] = useState("");
  const [streamedSearchResults, setStreamedSearchResults] = useState<SearchResponse['search_results']>([]);
  const [showAllSources, setShowAllSources] = useState(false);

  const [searchPhase, setSearchPhase] = useState(true);

  const {
    data: results,
    isLoading
  }: {
    data: SearchResponse | undefined;
    isLoading: boolean;
  } = useQuery({
    queryKey: ['search', query],
    queryFn: ({ queryKey }) => {
      return new Promise((resolve, reject) => {
        const eventSource = new EventSourcePolyfill(
          `http://localhost:8000/stream-search?query=${encodeURIComponent(queryKey[1] || '')}`,
          {
            headers: { 'Accept': 'text/event-stream' },
            heartbeatTimeout: 60000,
          }
        );

        let currentData: Partial<SearchResponse> = {
          query: queryKey[1] || '',
          search_results: [],
          summary: '',
          suggestions: []
        };

        eventSource.addEventListener('breakdown', (e: MessageEvent) => {
          const queries = JSON.parse(e.data);
          setStreamStatus(prev => ({ ...prev, queries }));
        });

        eventSource.addEventListener('search_results', (e: MessageEvent) => {
          const results = JSON.parse(e.data);
          currentData.search_results = results;
          setStreamStatus(prev => ({ ...prev, resultsCount: results.length }));
          if (results.length > 0) {
            setStreamedSearchResults(results);
          }
        });

        eventSource.addEventListener('summary_part', (e: MessageEvent) => {
          const part = JSON.parse(e.data);
          setStreamingSummary(prev => prev + part);
          setSearchPhase(false);
        });

        eventSource.addEventListener('complete', (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          currentData.summary = data.summary;
          currentData.suggestions = data.suggestions;
          eventSource.close();
          setStreamStatus(_ => ({ queries: undefined, resultsCount: undefined }));
          setSearchPhase(false);
          resolve(currentData as SearchResponse);
        });

        eventSource.addEventListener('error', (e: MessageEvent) => {
          eventSource.close();
          reject(new Error('Stream error'));
        });
      });
    },
    enabled: !!query,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Update the Markdown component to use streaming summary when available
  <Markdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeRaw, rehypeSanitize]}
  >
    {streamingSummary || results?.summary || "Enter a search query to get started"}
  </Markdown>

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      setStreamingSummary('');
      setStreamedSearchResults([]);
      setSearchPhase(true);
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#1E1F1C] text-white relative">
      <div className="container mx-auto px-2 py-4 pb-24">
        {/* Sources Strip */}
        <div className="pb-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-display text-white/60">Sources</h3>
            <div className="h-px flex-1 bg-white/5"></div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {!streamedSearchResults.length ? (
              // Skeleton loading state for sources
              <>
                {[...Array(5)].map((_, index) => (
                  <div
                    key={index}
                    className="flex-none animate-fade-in"
                    style={{
                      animationDelay: `${index * 80}ms`,
                    }}
                  >
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
              // Existing sources list
              <>
                {(results?.search_results || streamedSearchResults)
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
                      style={{
                        animationDelay: `${index * 80}ms`,
                      }}
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

                {!showAllSources && (results?.search_results || streamedSearchResults)?.length > 5 && (
                  <button
                    onClick={() => setShowAllSources(true)}
                    className="flex-none flex items-center gap-4 px-4 py-2.5 rounded-md 
                      bg-[#2A2B28] hover:bg-[#32332F] border border-white/5
                      transition-all duration-300 hover:border-[#F2EEC8]/20
                      text-white/60 hover:text-[#F2EEC8] group animate-fade-in min-w-fit"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-1.5 mr-1">
                        {(results?.search_results || streamedSearchResults)
                          ?.slice(5, 8)
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
                        See all {(results?.search_results || streamedSearchResults)?.length} sources
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* AI Summary */}
          <div className="lg:col-span-1">
            <div className="rounded-lg p-4 backdrop-blur-sm border border-white/5">
              {searchPhase ? (
                // Replace the loading section with:
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
                              style={{
                                animationDelay: `${i * 150}ms`,
                              }}
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
                      {results?.summary || streamingSummary || "Enter a search query to get started"}
                    </Markdown>
                  </div>
                  {results && (
                    <div className="flex flex-wrap gap-2 mt-6 fade-in-up">
                      {results.suggestions.map((suggestion, index) => (
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

          {/* Image Gallery Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-4">
              <div className="columns-2 gap-2 space-y-2">
                {streamedSearchResults.length == 0 ? (
                  // Skeleton loading state
                  <>
                    {[...Array(4)].map((_, index) => (
                      <div
                        key={index}
                        className="animate-fade-in break-inside-avoid"
                        style={{
                          animationDelay: `${index * 100}ms`,
                        }}
                      >
                        <Skeleton className="bg-slate-700 w-full h-28 rounded-lg" />
                      </div>
                    ))}
                  </>
                ) : (
                  // Masonry Image Gallery
                  (results?.search_results || streamedSearchResults)
                    .filter(result => result.thumbnail && !result.thumbnail.logo)
                    .map((result, index) => (
                      <a
                        key={index}
                        href={result.thumbnail!.src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group relative animate-fade-in-down mb-2 break-inside-avoid"
                        style={{
                          animationDelay: `${index * 100}ms`,
                        }}
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

      {/* Fixed Search Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1E1F1C]/90 backdrop-blur-sm border-t border-white/5 p-3">
        <div className="container mx-auto px-2 relative">
          {/* Logo */}
          <div
            onClick={() => navigate('/')}
            className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <h2 className="text-xl font-bold tracking-tight text-white font-serif">
              Eagan
            </h2>
          </div>

          {/* Search Bar */}
          <div className="flex gap-2 max-w-3xl mx-auto">
            <div className="relative flex-1">
              <Input
                type="text"
                defaultValue={query || ''}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(e.currentTarget.value);
                  }
                }}
                placeholder="Ask a follow-up question..."
                className="h-10 bg-white/[0.03] border border-white/10 text-white placeholder:text-white/40 rounded-full px-4 text-sm font-display focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F2EEC8]/20 focus-visible:border-[#F2EEC8]/20"
              />
            </div>
            <Button
              onClick={() => {
                const input = document.querySelector('input') as HTMLInputElement;
                handleSearch(input?.value || '');
              }}
              disabled={isLoading}
              className="h-10 px-4 bg-[#F2EEC8] hover:bg-white text-[#1E1F1C] rounded-full transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(242,238,200,0.3)] group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <SearchIcon className="w-5 h-5 transition-transform group-hover:scale-110" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchResults;