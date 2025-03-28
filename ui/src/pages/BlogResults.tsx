import { useQuery } from '@tanstack/react-query';
import { Loader2, BookOpenIcon, SearchIcon, AlertTriangleIcon, Menu, ChevronUp, Clock, BookMarked, FileText, ChevronRight, Bookmark, List, ListFilter, Share2, Eye } from "lucide-react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import MarkdownRender from '@/components/MarkdownRender';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypePrism from 'rehype-prism-plus';
// @ts-ignore
import { EventSourcePolyfill } from "event-source-polyfill";
import { useState, useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ThinkingBox from "@/components/ThinkingBox";

// Custom shimmer animation styles
const customStyles = `
  @keyframes enhanced-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @keyframes particle-float {
    0%, 100% { transform: translate(0, 0); opacity: 0; }
    50% { transform: translate(var(--tx), var(--ty)); opacity: 0.8; }
  }
  
  .enhanced-shimmer {
    background: linear-gradient(90deg, rgba(242, 238, 200, 0.4) 0%, rgba(242, 238, 200, 1) 50%, rgba(242, 238, 200, 0.4) 100%);
    background-size: 200% 100%;
    animation: enhanced-shimmer 3s ease-in-out infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: inline-block;
  }

  .particle {
    position: absolute;
    width: 4px;
    height: 4px;
    background: rgba(242, 238, 200, 0.5);
    border-radius: 50%;
    pointer-events: none;
    animation: particle-float 4s infinite;
  }

  .particle:nth-child(1) { --tx: -20px; --ty: -40px; }
  .particle:nth-child(2) { --tx: 30px; --ty: -30px; animation-delay: 0.5s; }
  .particle:nth-child(3) { --tx: -30px; --ty: 40px; animation-delay: 1s; }
  .particle:nth-child(4) { --tx: 40px; --ty: 20px; animation-delay: 1.5s; }
  .particle:nth-child(5) { --tx: -40px; --ty: -20px; animation-delay: 2s; }

  .noise-texture {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0.035;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 1;
  }

  .thinking-inactive-overlay {
    position: absolute;
    inset: 0;
    background: rgba(30, 31, 28, 0.85);
    backdrop-filter: blur(2px);
    z-index: 20;
    opacity: 0;
    transition: opacity 0.5s ease-in-out;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: inherit;
    overflow: hidden;
    padding: 2rem;
  }

  .thinking-inactive-overlay.active {
    opacity: 1;
  }

  .thinking-inactive-overlay .label {
    color: rgba(242, 238, 200, 0.3);
    font-size: 0.9rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-weight: 500;
    z-index: 10;
    text-align: center;
    line-height: 1.5;
  }

  .thinking-inactive-overlay .background-svg img {
    transform: scale(1.1);
    transition: transform 0.5s ease-in-out;
  }

  .thinking-inactive-overlay.active .background-svg img {
    transform: scale(1);
  }

  .glass-effect {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    background: linear-gradient(180deg, rgba(42, 43, 40, 0.85) 0%, rgba(30, 31, 28, 0.85) 100%);
    border: 1px solid rgba(242, 238, 200, 0.15);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  }

  .glass-effect-subtle {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(30, 31, 28, 0.92);
    border-top: 1px solid rgba(242, 238, 200, 0.08);
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
    height: 70px;
    display: flex;
    align-items: center;
  }

  .blog-container {
    max-width: 860px;
    margin: 0 auto;
    line-height: 1.8;
    font-size: 1.125rem;
  }

  .thinking-container {
    position: relative;
    overflow: hidden;
    max-height: 400px;
    border-radius: 16px;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(242, 238, 200, 0.1);
    display: flex;
    flex-direction: column;
  }

  .thinking-content {
    overflow-y: auto;
    flex-grow: 1;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .thinking-content::-webkit-scrollbar {
    display: none;
  }

  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .blog-typography {
    font-feature-settings: "liga" 1, "ss01" 1, "ss02" 1, "ss03" 1;
    font-variant-ligatures: contextual;
  }

  .blog-typography h1 {
    font-size: 2.5rem;
    line-height: 1.2;
    margin-bottom: 1.5rem;
    background: linear-gradient(to right, rgba(242, 238, 200, 1), rgba(242, 238, 200, 0.8));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .blog-typography h2 {
    font-size: 2rem;
    margin-top: 2.5rem;
    margin-bottom: 1.25rem;
    color: rgba(242, 238, 200, 0.95);
  }

  .blog-typography h3, 
  .blog-typography h4, 
  .blog-typography h5, 
  .blog-typography h6 {
    color: rgba(242, 238, 200, 0.9);
  }

  .blog-typography p {
    margin-bottom: 1.5rem;
    color: rgba(255, 255, 255, 0.9);
  }

  .blog-typography a {
    color: rgba(242, 238, 200, 0.9);
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .blog-typography a:hover {
    color: rgba(242, 238, 200, 1);
    text-decoration: underline;
  }

  .blog-typography strong {
    color: rgba(255, 255, 255, 0.95);
    font-weight: 600;
  }

  .blog-typography em {
    color: rgba(255, 255, 255, 0.85);
  }

  .blog-typography blockquote {
    margin: 2rem 0;
    padding: 1.5rem 2rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-left: 4px solid rgba(242, 238, 200, 0.3);
    font-style: italic;
    color: rgba(255, 255, 255, 0.85);
  }

  .blog-typography code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9em;
    color: rgba(242, 238, 200, 0.9);
    background: rgba(242, 238, 200, 0.1);
  }

  .blog-typography pre {
    margin: 2rem 0;
    padding: 1.5rem;
    border-radius: 8px;
    background: rgba(30, 31, 28, 0.6) !important;
    border: 1px solid rgba(242, 238, 200, 0.1);
    overflow-x: auto;
  }

  .blog-typography pre code {
    background: none;
    color: rgba(255, 255, 255, 0.9);
  }

  .blog-typography ul,
  .blog-typography ol {
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 1.5rem;
  }

  .blog-typography li {
    margin-bottom: 0.5rem;
  }

  .animate-float-in {
    animation: floatIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  }

  @keyframes floatIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .skeleton {
    background: rgba(242, 238, 200, 0.1);
    border-radius: 0.5rem;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
    position: relative;
    overflow: hidden;
  }

  @keyframes skeleton-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.8; }
  }

  .keyword-pill {
    transition: all 0.2s ease-out;
  }
  
  .keyword-pill:hover {
    background: rgba(242, 238, 200, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .scroll-indicator-left {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 40px;
    background: linear-gradient(to right, rgba(30, 31, 28, 0.9), rgba(30, 31, 28, 0));
    z-index: 20;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .scroll-indicator-right {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 40px;
    background: linear-gradient(to left, rgba(30, 31, 28, 0.9), rgba(30, 31, 28, 0));
    z-index: 20;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .keywords-scroll-container {
    position: relative;
  }

  .keywords-scroll-container.can-scroll-left .scroll-indicator-left {
    opacity: 1;
  }

  .keywords-scroll-container.can-scroll-right .scroll-indicator-right {
    opacity: 1;
  }

  .keyword-new {
    animation: slide-in-left 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }

  .keyword-existing {
    animation: slide-right 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  @keyframes slide-in-left {
    0% { transform: translateX(-100%); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }

  @keyframes slide-right {
    0% { transform: translateX(0); }
    50% { transform: translateX(8px); }
    100% { transform: translateX(0); }
  }

  .reading-progress-indicator {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, rgba(242, 238, 200, 0.8), rgba(242, 238, 200, 0.4));
    z-index: 60;
    transition: width 0.3s ease-out;
  }

  .toc-section-active {
    color: rgba(242, 238, 200, 1) !important;
    font-weight: 500;
    transform: translateX(4px);
  }

  .toc-section-indicator {
    position: absolute;
    left: 0;
    width: 3px;
    background: rgba(242, 238, 200, 0.6);
    border-radius: 0 3px 3px 0;
    transition: all 0.3s ease;
  }

  .toc-pill {
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
    border-radius: 6px;
  }

  .toc-pill:hover {
    background: rgba(242, 238, 200, 0.08);
  }

  .toc-pill.active {
    background: rgba(242, 238, 200, 0.1);
    color: rgba(242, 238, 200, 1);
    font-weight: 500;
  }

  .reading-position-bar {
    position: fixed;
    top: 30%;
    right: 16px;
    width: 5px;
    height: 40%;
    background: rgba(242, 238, 200, 0.1);
    border-radius: 3px;
    z-index: 40;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .reading-position-bar.visible {
    opacity: 1;
  }
  
  .reading-position-indicator {
    position: absolute;
    width: 100%;
    background: rgba(242, 238, 200, 0.6);
    border-radius: 3px;
    transition: top 0.3s ease-out;
  }
  
  .focus-mode {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    z-index: 30;
    pointer-events: none;
    transition: opacity 0.8s ease;
  }
  
  .focus-paragraph {
    position: relative;
    z-index: 31 !important;
    transition: all 0.6s ease-out !important;
  }
  
  .focus-gradient {
    position: absolute;
    inset: -100px;
    background: radial-gradient(ellipse at center, rgba(30, 31, 28, 0) 0%, rgba(0, 0, 0, 0.65) 70%);
    z-index: 30;
    pointer-events: none;
    mix-blend-mode: multiply;
    transition: opacity 0.6s ease;
  }
`;

// Types for the blog generation state
type BlogGenerationState = {
  status: string;
  searchTerms: string[];
  searchResults: number;
  thinkingContent: string[];
  searchActivity: { message: string }[];
  scrapeActivity: { message: string }[];
  reflectionProgress: { iteration: number; max_iterations: number } | null;
  blogContent: string[];
  error: string | null;
  isComplete: boolean;
  inProgress: boolean;
  completeBlog: {
    topic: string;
    blog_plan: string;
    blog_content: string;
  } | null;
};

// Fix for EventSource type issues
const createEventSource = (url: string, options: any) => new EventSourcePolyfill(url, options);

function BlogResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const blog_id = searchParams.get('blog_id');
  
  const thinkingRef = useRef<HTMLDivElement>(null);
  const blogContentRef = useRef<HTMLDivElement>(null);

  // Reading progress state
  const [readingProgress, setReadingProgress] = useState(0);
  const [estimatedReadTime, setEstimatedReadTime] = useState(0);
  const [showTableOfContents, setShowTableOfContents] = useState(false);
  const [headings, setHeadings] = useState<{id: string, text: string, level: number}[]>([]);

  // State for streaming blog generation
  const [blogState, setBlogState] = useState<BlogGenerationState>({
    status: 'Starting blog generation...',
    searchTerms: [],
    searchResults: 0,
    thinkingContent: [],
    searchActivity: [],
    scrapeActivity: [],
    reflectionProgress: null,
    blogContent: [],
    error: null,
    isComplete: false,
    inProgress: false,
    completeBlog: null
  });

  // Track search results activities
  const [searchResultsActivities, setSearchResultsActivities] = useState<{count: number, timestamp: number}[]>([]);

  // Control when to auto-scroll the thinking content
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  // Track if thinking is active
  const [isThinkingActive, setIsThinkingActive] = useState(false);
  // Track if search activities are being updated
  const [searchActivitiesUpdating, setSearchActivitiesUpdating] = useState(false);
  // Track if scrape activities are being updated
  const [scrapeActivitiesUpdating, setScrapeActivitiesUpdating] = useState(false);
  // Track if search results are being updated
  const [searchResultsUpdating, setSearchResultsUpdating] = useState(false);

  // Ref for keywords container
  const keywordsContainerRef = useRef<HTMLDivElement>(null);
  // State to track scroll indicators
  const [keywordsScrollState, setKeywordsScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false
  });

  // Track previous search terms to detect new ones
  const prevSearchTermsRef = useRef<string[]>([]);
  // Track which terms are new for animations
  const [newTerms, setNewTerms] = useState<Set<string>>(new Set());
  // Track when to trigger the slide animation for existing terms
  const [shouldSlideExisting, setShouldSlideExisting] = useState(false);

  // Current section state for TOC
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  // Track scroll direction
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('down');
  const lastScrollY = useRef(0);
  // Track reading position bar visibility
  const [showReadingBar, setShowReadingBar] = useState(false);
  // Focus mode state
  const [focusMode, setFocusMode] = useState(false);
  const [focusParagraph, setFocusParagraph] = useState<HTMLElement | null>(null);

  // Auto-scroll thinking container when new content is added
  useEffect(() => {
    if (shouldAutoScroll && thinkingRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        const scrollableContent = thinkingRef.current?.querySelector('.thinking-content');
        if (scrollableContent) {
          scrollableContent.scrollTop = scrollableContent.scrollHeight;
          
          // Force another scroll after a slightly longer delay to ensure it catches any late renders
          setTimeout(() => {
            if (scrollableContent) {
              scrollableContent.scrollTop = scrollableContent.scrollHeight;
            }
          }, 300);
        }
      }, 100);
    }
  }, [blogState.thinkingContent, shouldAutoScroll]);

  // Set thinking active state when new thinking content arrives
  useEffect(() => {
    if (blogState.thinkingContent.length > 0) {
      setIsThinkingActive(true);
      // Set a timer to fade out the thinking box after a period of inactivity
      const timer = setTimeout(() => {
        setIsThinkingActive(false);
      }, 5000); // 5 seconds of inactivity before fading
      
      return () => clearTimeout(timer);
    }
  }, [blogState.thinkingContent]);

  // Update scroll indicators when keywords change
  useEffect(() => {
    const updateScrollIndicators = () => {
      if (keywordsContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = keywordsContainerRef.current;
        setKeywordsScrollState({
          canScrollLeft: scrollLeft > 0,
          canScrollRight: scrollLeft < scrollWidth - clientWidth - 5 // 5px buffer
        });
      }
    };

    // Initial check
    updateScrollIndicators();

    // Add scroll event listener
    const container = keywordsContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollIndicators);
      // Also check on window resize
      window.addEventListener('resize', updateScrollIndicators);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', updateScrollIndicators);
      }
      window.removeEventListener('resize', updateScrollIndicators);
    };
  }, [blogState.searchTerms]);

  // Detect new search terms and trigger animations
  useEffect(() => {
    const validSearchTerms = blogState.searchTerms.filter(term => term !== "NO_GAPS_FOUND");
    const prevTerms = prevSearchTermsRef.current;
    
    // Find new terms that weren't in the previous list
    const justAddedTerms = validSearchTerms.filter(term => !prevTerms.includes(term));
    
    if (justAddedTerms.length > 0) {
      // Add new terms to the tracking set
      setNewTerms(new Set([...justAddedTerms]));
      
      // Trigger slide animation for existing terms
      if (prevTerms.length > 0) {
        setShouldSlideExisting(true);
        // Reset the slide animation after it completes
        setTimeout(() => {
          setShouldSlideExisting(false);
        }, 500); // Match the animation duration
      }
    }
    
    // Update the ref with current terms for next comparison
    prevSearchTermsRef.current = validSearchTerms;
    
    // Clear the "new" status after animation completes
    if (newTerms.size > 0) {
      const clearNewTermsTimer = setTimeout(() => {
        setNewTerms(new Set());
      }, 1000); // Slightly longer than the animation
      
      return () => clearTimeout(clearNewTermsTimer);
    }
  }, [blogState.searchTerms]);

  // Function to scroll keywords container
  const scrollKeywords = (direction: 'left' | 'right') => {
    if (keywordsContainerRef.current) {
      const container = keywordsContainerRef.current;
      const scrollAmount = container.clientWidth * 0.75; // Scroll 75% of container width
      
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Track reading progress on scroll
  useEffect(() => {
    if (!blogState.blogContent.length && !blogState.completeBlog) return;

    let scrollTimer: NodeJS.Timeout;
    let paragraphObserver: IntersectionObserver | null = null;

    const calculateReadingProgress = () => {
      if (!blogContentRef.current) return;
      
      const contentHeight = blogContentRef.current.scrollHeight;
      const currentPosition = window.scrollY;
      const viewportHeight = window.innerHeight;
      const documentHeight = Math.max(
        contentHeight,
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      
      // Calculate how far down the page the user has scrolled
      const scrolled = currentPosition / (documentHeight - viewportHeight) * 100;
      setReadingProgress(Math.min(scrolled, 100));

      // Determine scroll direction
      if (currentPosition > lastScrollY.current) {
        setScrollDirection('down');
      } else if (currentPosition < lastScrollY.current) {
        setScrollDirection('up');
      }
      lastScrollY.current = currentPosition;

      // Show reading position bar while actively scrolling
      setShowReadingBar(true);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        setShowReadingBar(false);
      }, 2000);
    };

    // Calculate estimated reading time based on word count (average reading speed: 250 words/minute)
    const calculateReadingTime = () => {
      if (!blogState.blogContent.length && !blogState.completeBlog) return;
      
      const content = blogState.completeBlog 
        ? blogState.completeBlog.blog_content 
        : blogState.blogContent.join('');
      
      const wordCount = content.trim().split(/\s+/).length;
      const readingTime = Math.ceil(wordCount / 250);
      setEstimatedReadTime(readingTime);
    };

    // Extract headings for table of contents and detect current section
    const extractHeadings = () => {
      if (!blogContentRef.current) return;
      
      const headingElements = blogContentRef.current.querySelectorAll('h1, h2, h3');
      const headingsData = Array.from(headingElements).map(heading => {
        // Create IDs for headings if they don't exist
        if (!heading.id) {
          heading.id = heading.textContent?.toLowerCase().replace(/\s+/g, '-') || '';
        }
        
        return {
          id: heading.id,
          text: heading.textContent || '',
          level: parseInt(heading.tagName.charAt(1)),
          element: heading as HTMLElement,
        };
      });
      
      setHeadings(headingsData);

      // Set up intersection observer for headings to track current section
      const options = {
        rootMargin: '-100px 0px -80% 0px',
        threshold: 0
      };

      const callback: IntersectionObserverCallback = (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setCurrentSection(entry.target.id);
          }
        });
      };

      const observer = new IntersectionObserver(callback, options);
      headingElements.forEach(heading => observer.observe(heading));

      // Setup observer for paragraphs when focus mode is active
      if (focusMode && blogContentRef.current) {
        // Select all content elements, not just paragraphs
        const contentElements = blogContentRef.current.querySelectorAll('p, ul, ol, li, table, tr, td, th, blockquote, pre, code');
        
        // Clear any existing focus-paragraph classes
        contentElements.forEach(p => {
          p.classList.remove('focus-paragraph');
        });
        
        const paragraphCallback: IntersectionObserverCallback = (entries) => {
          entries.forEach(entry => {
            const element = entry.target as HTMLElement;
            
            if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
              // Add class to the focused paragraph with a smoother transition
              setTimeout(() => {
                element.classList.add('focus-paragraph');
                setFocusParagraph(element);
              }, 50);
            }
          });
        };

        paragraphObserver = new IntersectionObserver(paragraphCallback, {
          rootMargin: '-40% 0px -40% 0px',
          threshold: [0.6, 0.7, 0.8]
        });
        
        // Using the observer after creation - guard against null
        contentElements.forEach(p => {
          if (paragraphObserver) {
            paragraphObserver.observe(p);
          }
        });
      } else if (!focusMode && blogContentRef.current) {
        // Explicitly clean up when focus mode is off
        const allElements = blogContentRef.current.querySelectorAll('p, ul, ol, li, table, tr, td, th, blockquote, pre, code');
        allElements.forEach(p => p.classList.remove('focus-paragraph'));
        setFocusParagraph(null);
      }

      return () => {
        observer.disconnect();
        if (paragraphObserver) paragraphObserver.disconnect();
      };
    };

    // Calculate reading time once content is loaded
    calculateReadingTime();
    
    // Extract headings for table of contents with a delay to ensure content is rendered
    const headingsTimer = setTimeout(extractHeadings, 1000);
    
    // Add scroll event listener for reading progress
    window.addEventListener('scroll', calculateReadingProgress);
    calculateReadingProgress(); // Initial calculation
    
    return () => {
      window.removeEventListener('scroll', calculateReadingProgress);
      clearTimeout(scrollTimer);
      clearTimeout(headingsTimer);
      
      // Clean up focus paragraph classes
      if (blogContentRef.current) {
        const paragraphs = blogContentRef.current.querySelectorAll('p');
        paragraphs.forEach(p => p.classList.remove('focus-paragraph'));
      }
    };
  }, [blogState.blogContent, blogState.completeBlog, focusMode]);

  // Also update the focus mode effect to consider completeBlog
  useEffect(() => {
    // Only run this effect when focusMode changes or when the content is available
    if (!blogContentRef.current || (!blogState.blogContent.length && !blogState.completeBlog)) return;
    
    // Get all content elements, not just paragraphs
    const contentElements = blogContentRef.current.querySelectorAll('p, ul, ol, li, table, tr, td, th, blockquote, pre, code');
    
    if (focusMode) {
      // Add subtle visual enhancement to paragraphs during focus mode
      contentElements.forEach(p => {
        const element = p as HTMLElement;
        element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        element.style.opacity = '0.6';
        element.style.position = 'relative';
      });
      
      // Set styles for the currently focused paragraph (if any)
      if (focusParagraph) {
        focusParagraph.style.opacity = '1';
        focusParagraph.style.transform = 'scale(1.005)';
        focusParagraph.style.textShadow = '0 0 1px rgba(255, 255, 255, 0.1)';
      }
    } else {
      // Reset all element styles when focus mode is off
      contentElements.forEach(p => {
        const element = p as HTMLElement;
        element.style.opacity = '1';
        element.style.transform = 'none';
        element.style.textShadow = 'none';
        element.style.transition = 'none';
        element.style.position = 'static';
      });
    }
    
    // Cleanup function
    return () => {
      contentElements.forEach(p => {
        const element = p as HTMLElement;
        element.style.opacity = '1';
        element.style.transform = 'none';
        element.style.textShadow = 'none';
        element.style.transition = 'none';
        element.style.position = 'static';
      });
    };
  }, [focusMode, focusParagraph, blogState.blogContent, blogState.completeBlog]);

  // Toggle table of contents visibility
  const toggleTableOfContents = () => {
    setShowTableOfContents(prev => !prev);
  };

  // Scroll to heading when clicking on table of contents item
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 100, // Adjust for any fixed headers
        behavior: 'smooth'
      });
      setShowTableOfContents(false);
    }
  };

  // Toggle focus mode
  const toggleFocusMode = () => {
    setFocusMode(prev => {
      // When turning off focus mode, remove focus-paragraph class from all elements
      if (prev && blogContentRef.current) {
        const allElements = blogContentRef.current.querySelectorAll('p, ul, ol, li, table, tr, td, th, blockquote, pre, code');
        allElements.forEach(p => p.classList.remove('focus-paragraph'));
        setFocusParagraph(null);
      }
      return !prev;
    });
  };

  // Fetch blog generation stream and handle events
  const {
    data: blogData,
    isLoading,
    error,
    isFetching
  } = useQuery({
    queryKey: ['blogGeneration', blog_id],
    queryFn: ({ queryKey }) => {
      if (!queryKey[1]) throw new Error('No blog_id provided');
      
      return new Promise((resolve, reject) => {
        const eventSource = createEventSource(
          `http://localhost:8000/stream-blog-generation?blog_id=${queryKey[1] as string}`,
          {
            headers: { 'Accept': 'text/event-stream' },
            heartbeatTimeout: 300000, // 5 minutes
          }
        );

        eventSource.addEventListener('status', (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          setBlogState(prev => ({ ...prev, status: data.message }));
        });

        eventSource.addEventListener('breakdown', (e: MessageEvent) => {
          const terms = JSON.parse(e.data);
          // Indicate that search terms are being updated
          setBlogState(prev => ({ ...prev, searchTerms: terms }));
          // Reset the updating state after a short delay
        });

        eventSource.addEventListener('search_results', (e: MessageEvent) => {
          const count = JSON.parse(e.data);
          setBlogState(prev => ({ ...prev, searchResults: count }));
          
          // Add a new search results activity item
          setSearchResultsActivities(prev => [
            ...prev, 
            { count, timestamp: Date.now() }
          ]);
          
          // Indicate that search results are being updated
          setSearchResultsUpdating(true);
          // Reset the updating state after a short delay
          setTimeout(() => setSearchResultsUpdating(false), 1500);
        });

        eventSource.addEventListener('thinking_part', (e: MessageEvent) => {
          const thought = JSON.parse(e.data);
          setBlogState(prev => ({
            ...prev,
            thinkingContent: [...prev.thinkingContent, thought.thought]
          }));
          // Reset the thinking active state when new thinking content arrives
          setIsThinkingActive(true);
          
          // Force scroll after state update
          setTimeout(() => {
            const scrollableContent = thinkingRef.current?.querySelector('.thinking-content');
            if (scrollableContent) {
              scrollableContent.scrollTop = scrollableContent.scrollHeight;
            }
          }, 50);
        });

        eventSource.addEventListener('search_start', (e: MessageEvent) => {
          const searchInfo = JSON.parse(e.data);
          // Indicate that search activities are being updated
          setSearchActivitiesUpdating(true);
          setBlogState(prev => ({
            ...prev,
            // Add new search terms at the beginning instead of the end
            searchTerms: [...new Set([...searchInfo.map((item: { message: string }) => item.message), ...prev.searchTerms])]
          }));
          // Reset the updating state after a short delay
          setTimeout(() => setSearchActivitiesUpdating(false), 1000);
        });

        eventSource.addEventListener('scrape_start', (e: MessageEvent) => {
          const scrapeInfo = JSON.parse(e.data);
          // Indicate that scrape activities are being updated
          setScrapeActivitiesUpdating(true);
          setBlogState(prev => ({
            ...prev,
            // Append new scrape activities instead of replacing
            scrapeActivity: [...prev.scrapeActivity, ...scrapeInfo]
          }));
          // Reset the updating state after a short delay
          setTimeout(() => setScrapeActivitiesUpdating(false), 1000);
        });

        eventSource.addEventListener('reflection_progress', (e: MessageEvent) => {
          const progress = JSON.parse(e.data);
          setBlogState(prev => ({
            ...prev,
            reflectionProgress: progress
          }));
        });

        eventSource.addEventListener('blog_part', (e: MessageEvent) => {
          const blogPart = JSON.parse(e.data);
          setBlogState(prev => ({
            ...prev,
            blogContent: [...prev.blogContent, blogPart.content]
          }));
        });

        eventSource.addEventListener('complete', (e: MessageEvent) => {
          const completeData = JSON.parse(e.data);
          console.log(completeData);
          setBlogState(prev => ({
            ...prev,
            isComplete: true,
            inProgress: false,
            completeBlog: completeData
          }));
          eventSource.close();
          resolve(completeData);
        });

        eventSource.addEventListener('in_progress', (e: MessageEvent) => {
          const progressData = JSON.parse(e.data);
          setBlogState(prev => ({
            ...prev,
            status: progressData.status,
            isComplete: false,
            inProgress: true
          }));
          eventSource.close();
          resolve(progressData);
        });

        eventSource.addEventListener('error', (e: MessageEvent) => {
          const errorData = e.data ? JSON.parse(e.data) : { error: 'Unknown error occurred' };
          setBlogState(prev => ({
            ...prev,
            error: errorData.error || 'Unknown error occurred'
          }));
          eventSource.close();
          reject(new Error(errorData.error || 'Unknown error occurred'));
        });
      });
    },
    enabled: !!blog_id,
    retry: false,
  });

  const renderResearchPhase = () => {
    const { 
      searchTerms, 
      scrapeActivity, 
      thinkingContent, 
    } = blogState;

    // Create placeholder items for consistent layout
    const activityPlaceholders = Array(5).fill(null);
    // Create keyword placeholders
    const keywordPlaceholders = Array(8).fill(null);

    // Filter valid search terms
    const validSearchTerms = searchTerms.filter(term => term !== "NO_GAPS_FOUND");

    // Sort terms to put new ones at the beginning
    const sortedTerms = [...validSearchTerms].sort((a, b) => {
      if (newTerms.has(a) && !newTerms.has(b)) return -1;
      if (!newTerms.has(a) && newTerms.has(b)) return 1;
      return 0;
    });

    return (
      <div className="space-y-4 mx-auto blog-container animate-fade-in">
        <div className="flex flex-col items-center justify-center py-8 space-y-6">
          <div className="flex flex-col items-center space-y-6 relative">
            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="particle"></div>
              <div className="particle"></div>
              <div className="particle"></div>
              <div className="particle"></div>
              <div className="particle"></div>
            </div>
            
            <div className="flex items-center gap-4 float-animation">
              <span className="text-5xl font-display tracking-tight font-bold enhanced-shimmer">
                Researching
              </span>
            </div>
            
            {/* Redesigned Research Keywords - Fixed height container with horizontal scrolling */}
            <div className="w-full max-w-3xl">
              <div className="glass-effect rounded-xl p-4 relative overflow-hidden">
                {/* Noise texture overlay */}
                <div className="noise-texture"></div>
                
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <h3 className="text-lg font-medium text-[#F2EEC8]/90">Research Keywords</h3>
                  
                  {/* Keyword navigation controls - only show when we have keywords */}
                  {validSearchTerms.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => scrollKeywords('left')}
                        className={cn(
                          "p-1.5 rounded-full bg-[#F2EEC8]/5 border border-[#F2EEC8]/10 transition-all duration-300",
                          keywordsScrollState.canScrollLeft 
                            ? "opacity-100 hover:bg-[#F2EEC8]/10" 
                            : "opacity-40 cursor-not-allowed"
                        )}
                        disabled={!keywordsScrollState.canScrollLeft}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F2EEC8]/80">
                          <path d="m15 18-6-6 6-6"/>
                        </svg>
                      </button>
                      <button 
                        onClick={() => scrollKeywords('right')}
                        className={cn(
                          "p-1.5 rounded-full bg-[#F2EEC8]/5 border border-[#F2EEC8]/10 transition-all duration-300",
                          keywordsScrollState.canScrollRight 
                            ? "opacity-100 hover:bg-[#F2EEC8]/10" 
                            : "opacity-40 cursor-not-allowed"
                        )}
                        disabled={!keywordsScrollState.canScrollRight}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#F2EEC8]/80">
                          <path d="m9 18 6-6-6-6"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Scrollable keywords container with scroll indicators */}
                <div className={cn(
                  "keywords-scroll-container relative",
                  keywordsScrollState.canScrollLeft && "can-scroll-left",
                  keywordsScrollState.canScrollRight && "can-scroll-right"
                )}>
                  {/* Scroll indicators */}
                  <div className="scroll-indicator-left"></div>
                  <div className="scroll-indicator-right"></div>
                  
                  {/* Actual scrollable container */}
                  <div 
                    ref={keywordsContainerRef}
                    className="overflow-x-auto hide-scrollbar py-1 relative z-10"
                    style={{ scrollbarWidth: 'none' }}
                  >
                    <div className="flex flex-nowrap gap-2 pb-2">
                      {validSearchTerms.length > 0 ? (
                        // Real keywords - sorted to put new ones first
                        sortedTerms.map((term, i) => (
                          <div 
                            key={`term-${term}-${i}`}
                            className={cn(
                              "keyword-pill transition-all duration-300 flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3",
                              "bg-[#F2EEC8]/10 text-[#F2EEC8] rounded-full backdrop-blur-sm",
                              "border border-[#F2EEC8]/20 relative overflow-hidden",
                              "transform-gpu",
                              newTerms.has(term) ? "keyword-new" : shouldSlideExisting ? "keyword-existing" : ""
                            )}
                          >
                            {/* Subtle noise in each pill */}
                            <div className="noise-texture opacity-10"></div>
                            <SearchIcon className="w-3 h-3 text-[#F2EEC8]/70 relative z-10" />
                            <span className="text-xs font-medium relative z-10 whitespace-nowrap">{term}</span>
                          </div>
                        ))
                      ) : (
                        // Skeleton placeholders
                        keywordPlaceholders.map((_, i) => (
                          <div 
                            key={`keyword-skeleton-${i}`}
                            className="skeleton h-7 w-24 rounded-full flex-shrink-0"
                          ></div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Side by side layout for thinking box and activities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-20">
          {/* AI Thinking Container - Always render a container with fixed height */}
          <div className="relative h-[400px]">
            {thinkingContent.length > 0 ? (
              <>
                <div ref={thinkingRef} className="h-full">
                  <ThinkingBox
                    thoughts={thinkingContent}
                    title="Thinking Out Loud"
                    className={cn(
                      "animate-float-in transition-all duration-500 h-full relative overflow-hidden",
                      isThinkingActive ? "opacity-100 transform-none" : "opacity-90 translate-y-0"
                    )}
                    isActive={isThinkingActive}
                    maxHeight={400}
                  />
                </div>
                {/* Custom inactive overlay with background SVG */}
                <div className={cn(
                  "thinking-inactive-overlay",
                  !isThinkingActive && "active"
                )}>
                  <div className="background-svg absolute inset-0">
                    <img
                      src="/src/assets/background.svg"
                      className="w-full h-full object-cover opacity-85 pointer-events-none"
                      alt=""
                    />
                  </div>
                  <div className="label relative z-10">Will think again after reading</div>
                </div>
                {/* Noise texture overlay */}
                <div className="noise-texture opacity-10 pointer-events-none absolute inset-0 z-0"></div>
              </>
            ) : (
              <div className="glass-effect rounded-xl h-full w-full relative overflow-hidden">
                <div className="noise-texture"></div>
                <div className="p-5 border-b border-[#F2EEC8]/10 relative z-10">
                  <div className="skeleton w-48 h-6 mb-1"></div>
                </div>
                <div className="p-5 h-[330px] relative z-10">
                  <div className="space-y-4">
                    <div className="skeleton w-full h-4"></div>
                    <div className="skeleton w-5/6 h-4"></div>
                    <div className="skeleton w-4/6 h-4"></div>
                    <div className="skeleton w-full h-4"></div>
                    <div className="skeleton w-3/4 h-4"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search and Scrape Activities - Fixed height */}
          <div className="glass-effect rounded-xl overflow-hidden h-[400px] relative">
            {/* Noise texture overlay */}
            <div className="noise-texture"></div>
            <div className="p-5 border-b border-[#F2EEC8]/10 relative z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-[#F2EEC8]/90">Research Activity</h3>
                
                {/* Reading pages indicator - Clean and simple design */}
                <div className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-md transition-all duration-300",
                  "bg-[#1E1F1C] border border-[#F2EEC8]/15 relative overflow-hidden",
                  searchResultsUpdating && "border-[#F2EEC8]/25"
                )}>
                  <div className="noise-texture opacity-5"></div>
                  <BookOpenIcon className="w-4 h-4 text-[#F2EEC8]/70 flex-shrink-0 relative z-10" />
                  <span className={cn(
                    "text-sm font-medium relative z-10",
                    searchResultsUpdating ? "text-[#F2EEC8] animate-pulse" : "text-[#F2EEC8]/80"
                  )}>
                    Reading {blogState.searchResults > 0 ? blogState.searchResults.toLocaleString() : "..."} pages
                  </span>
                </div>
              </div>
            </div>
            
            {/* Fixed height container to prevent layout shifts */}
            <div className="p-5 h-[350px] overflow-y-auto hide-scrollbar relative z-10">
              {/* Scrape Activities with Skeletons */}
              <div className="space-y-2">
                {/* Remove search results activities from here */}
                
                {scrapeActivity.length > 0 ? (
                  // Real activities
                  scrapeActivity.slice(0, 10).map((activity, i) => (
                    <div 
                      key={`scrape-${i}`}
                      className={cn(
                        "animate-float-in flex items-center gap-3 py-2 px-4 h-[46px]",
                        "bg-[#F2EEC8]/5 text-[#F2EEC8]/90 rounded-lg",
                        "border border-[#F2EEC8]/10 backdrop-blur-sm",
                        "transition-all duration-300 transform-gpu relative overflow-hidden",
                        scrapeActivitiesUpdating && i < 3 && "animate-glow"
                      )}
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      {/* Subtle noise in each activity item */}
                      <div className="noise-texture opacity-10"></div>
                      <img 
                        src={`https://www.google.com/s2/favicons?domain=${new URL(activity.message).hostname}`} 
                        alt="favicon" 
                        className="w-4 h-4 flex-shrink-0 relative z-10" 
                        onError={(e) => {
                          e.currentTarget.onerror = null; // Prevents looping
                          e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="feather feather-book-open"><path d="M2 7v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7"/><path d="M12 5v14M2 7h20"/></svg>';
                        }}
                      />
                      <span className="text-sm truncate relative z-10">Studying {activity.message}</span>
                    </div>
                  ))
                ) : (
                  // Skeleton placeholders when no activities yet
                  activityPlaceholders.map((_, i) => (
                    <div 
                      key={`skeleton-${i}`}
                      className="flex items-center gap-3 py-2 px-4 h-[46px] rounded-lg border border-[#F2EEC8]/10 overflow-hidden"
                    >
                      <div className="skeleton w-4 h-4 rounded-full flex-shrink-0"></div>
                      <div className="skeleton w-full h-4"></div>
                    </div>
                  ))
                )}
                
                {/* Show remaining count only if we have more than the displayed scrape activities */}
                {scrapeActivity.length > 10 && (
                  <div className="text-center text-xs text-[#F2EEC8]/60 mt-2">
                    +{scrapeActivity.length - 10} more sources
                  </div>
                )}
                
                {/* Fill remaining space with empty placeholders if we have fewer than 5 activities */}
                {scrapeActivity.length > 0 && scrapeActivity.length < 5 && 
                  activityPlaceholders.slice(0, 5 - scrapeActivity.length).map((_, i) => (
                    <div 
                      key={`filler-${i}`}
                      className="flex items-center gap-3 py-2 px-4 h-[46px] rounded-lg border border-[#F2EEC8]/10 opacity-30 overflow-hidden"
                    >
                      <div className="skeleton w-4 h-4 rounded-full flex-shrink-0"></div>
                      <div className="skeleton w-full h-4"></div>
                    </div>
                  ))
                }
              </div>
            </div>
            
            <div className="p-5 border-t border-[#F2EEC8]/10 relative z-10">
              <div className="h-4"></div> {/* Empty space to maintain layout */}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBlogContent = () => {
    const displayBlogContent = blogState.isComplete && blogState.completeBlog
      ? blogState.completeBlog.blog_content
      : blogState.blogContent.join('');

    return (
      <div className="mx-auto blog-container animate-fade-in pb-32" ref={blogContentRef}>
        {/* Top reading progress indicator */}
        <div 
          className="reading-progress-indicator" 
          style={{ width: `${readingProgress}%` }}
        ></div>

        {/* Focus mode overlay - with improved subtle styling */}
        {focusMode && (
          <div 
            className="focus-mode" 
            style={{ 
              opacity: focusParagraph ? 0.65 : 0,
              transition: 'opacity 0.8s ease'
            }}
          />
        )}

        {/* Reading position bar - visible while scrolling */}
        <div className={cn("reading-position-bar", showReadingBar && "visible")}>
          <div 
            className="reading-position-indicator" 
            style={{ 
              top: `${readingProgress}%`,
              height: '40px'
            }}
          ></div>
        </div>

        {/* Table of Contents Overlay - Only visible when toggled */}
        {showTableOfContents && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowTableOfContents(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowTableOfContents(false)}></div>
            <div 
              className="glass-effect rounded-xl max-w-md w-full z-10 overflow-hidden animate-float-in"
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: "70vh" }}
            >
              <div className="noise-texture opacity-5"></div>
              <div className="p-4 border-b border-[#F2EEC8]/10 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#F2EEC8]/90" />
                  <h3 className="text-base font-medium text-[#F2EEC8]/90">Contents</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[#F2EEC8]/70 hover:text-[#F2EEC8] hover:bg-[#F2EEC8]/10 h-8 w-8 p-0"
                  onClick={() => setShowTableOfContents(false)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 overflow-y-auto hide-scrollbar relative z-10" style={{ maxHeight: "calc(70vh - 120px)" }}>
                {headings.length > 0 ? (
                  <ul className="space-y-1 relative">
                    {headings.map((heading, index) => (
                      <li 
                        key={index}
                        className={cn(
                          "toc-pill py-1.5 px-3 transition-all duration-200 relative cursor-pointer",
                          heading.id === currentSection ? "active" : "",
                          heading.level === 1 ? "my-1" : "",
                          heading.level === 2 ? "pl-7" : "",
                          heading.level === 3 ? "pl-10" : ""
                        )}
                        onClick={() => scrollToHeading(heading.id)}
                      >
                        <div className="flex items-center">
                          {heading.level === 1 && (
                            <Bookmark className="w-3.5 h-3.5 mr-2 flex-shrink-0 text-[#F2EEC8]/60" />
                          )}
                          {heading.level === 2 && (
                            <ChevronRight className="w-3 h-3 mr-1.5 flex-shrink-0 text-[#F2EEC8]/50" />
                          )}
                          <span 
                            className={cn(
                              "transition-colors duration-200 text-sm",
                              heading.level === 1 ? "text-[#F2EEC8]/90" : "",
                              heading.level === 2 ? "text-[#F2EEC8]/80" : "",
                              heading.level === 3 ? "text-[#F2EEC8]/70 text-xs" : "",
                              heading.id === currentSection ? "text-[#F2EEC8]" : ""
                            )}
                          >
                            {heading.text}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-5 text-[#F2EEC8]/60 flex flex-col items-center gap-3">
                    <List className="w-10 h-10 text-[#F2EEC8]/30" />
                    <p className="text-sm">No headers found in content</p>
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-[#F2EEC8]/10 bg-[#1A1B18]/50 relative z-10">
                <div className="text-xs text-[#F2EEC8]/50 text-center">
                  Click any heading to navigate to that section
                </div>
              </div>
            </div>
          </div>
        )}

        <div 
          className={cn(
            "prose blog-typography font-round prose-invert max-w-none",
            "prose-p:text-lg prose-p:leading-relaxed",
            "prose-strong:text-white/95 prose-strong:font-semibold",
            "prose-a:text-[#F2EEC8] prose-a:no-underline hover:prose-a:underline",
            "prose-headings:text-[#F2EEC8] prose-headings:font-display",
            "prose-code:text-[#F2EEC8] prose-code:bg-[#F2EEC8]/10 prose-code:px-2 prose-code:py-0.5 prose-code:rounded-md",
            "prose-blockquote:border-l-[#F2EEC8] prose-blockquote:bg-white/5 prose-blockquote:rounded-lg prose-blockquote:py-2",
            "prose-em:text-white/85",
            "selection:bg-[#F2EEC8]/20",
            "selection:text-white",
            focusMode && "focus-reading-mode"
          )}
        >
          <MarkdownRender
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSanitize, rehypePrism]}
          >
            {displayBlogContent}
          </MarkdownRender> 
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#1E1F1C] text-white relative overflow-x-hidden">
      <style>{customStyles}</style>
      
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#1E1F1C] via-[#1E1F1C] to-[#161714] pointer-events-none"></div>
      
      <div className="container mx-auto px-4 py-16 relative mb-16">
        {/* Error State */}
        {blogState.error && (
          <div className="max-w-2xl mx-auto my-12 p-8 glass-effect rounded-2xl">
            <div className="flex items-center gap-4 text-red-400 mb-6">
              <AlertTriangleIcon className="w-8 h-8" />
              <h3 className="text-2xl font-display">Error Occurred</h3>
            </div>
            <p className="text-white/80 text-lg">
              {blogState.error}
            </p>
            <Button 
              onClick={() => navigate('/')} 
              className="mt-8 bg-[#F2EEC8] text-[#1E1F1C] hover:bg-[#F2EEC8]/90
                       px-6 py-3 rounded-full font-medium transition-all duration-300
                       hover:shadow-lg hover:shadow-[#F2EEC8]/10 hover:scale-105
                       active:scale-95"
            >
              Return Home
            </Button>
          </div>
        )}

        {/* In Progress State - Blog is being written */}
        {!blogState.error && blogState.inProgress && (
          <div className="max-w-2xl mx-auto my-12 p-8 glass-effect rounded-2xl text-center">
            <div className="flex flex-col items-center justify-center gap-6">
              <Loader2 className="w-16 h-16 text-[#F2EEC8]/80 animate-spin" />
              <h3 className="text-3xl font-display font-semibold text-[#F2EEC8]">Blog is being written</h3>
              <p className="text-white/80 text-lg">
                Your blog is currently in progress. Status: {blogState.status}
              </p>
              <Button 
                onClick={() => navigate('/')} 
                className="mt-4 bg-[#F2EEC8]/10 text-[#F2EEC8] hover:bg-[#F2EEC8]/20
                         px-6 py-3 rounded-full font-medium transition-all duration-300
                         border border-[#F2EEC8]/30"
              >
                Return Home
              </Button>
            </div>
          </div>
        )}

        {/* Loading State - Research Phase */}
        {isFetching && !blogState.error && !blogState.inProgress && !blogState.isComplete && !blogState.blogContent.length && renderResearchPhase()}

        {/* Blog Content */}
        {(blogState.blogContent.length > 0 || (blogState.isComplete && blogState.completeBlog)) && !blogState.inProgress && (
          <>
            <div className="pb-8 mb-12 border-b border-[#F2EEC8]/10">
              <div className="flex items-center gap-4 text-[#F2EEC8]/70 text-sm animate-fade-in-up flex-wrap">
                <BookOpenIcon className="w-5 h-5" />
                <span className="font-medium">Generated blog based on comprehensive research</span>
                <span className="text-[#F2EEC8]/30">•</span>
                <span>{new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
                
                {/* Estimated read time added near the top */}
                <span className="text-[#F2EEC8]/30">•</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#F2EEC8]/70" />
                  <span>{estimatedReadTime} min read</span>
                </div>
              </div>
            </div>

            {/* Render the blog content */}
            {renderBlogContent()}
          </>
        )}
      </div>

      {/* Fixed bottom bar with home link */}
      <div className="fixed bottom-0 left-0 right-0 glass-effect-subtle z-50">
        {/* Noise texture overlay */}
        <div className="noise-texture opacity-5"></div>
        <div className="container mx-auto h-full">
          {/* Show different bottom bar content based on whether blog content is showing */}
          {(blogState.blogContent.length > 0 || (blogState.isComplete && blogState.completeBlog)) && !blogState.inProgress ? (
            <div className="flex items-center justify-between px-6 h-full">
              <div className="flex items-center gap-6">
                <div
                  onClick={() => navigate('/')}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <h2 className="text-2xl font-bold tracking-tight text-[#F2EEC8]/80 font-serif group-hover:text-[#F2EEC8] transition-all duration-300">
                    Eagan
                  </h2>
                </div>
                <div className="h-6 w-px bg-[#F2EEC8]/10"></div>
                
                {/* Read time remaining */}
                <div className="flex items-center gap-2 text-[#F2EEC8]/70">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm whitespace-nowrap">
                    {Math.ceil(estimatedReadTime * (1 - readingProgress / 100))} min left
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Focus mode toggle - updated for better visual feedback */}
                <Button
                  onClick={toggleFocusMode}
                  className={cn(
                    "bg-white/5 hover:bg-white/10 text-white/80 hover:text-white",
                    "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                    "border border-white/10 hover:border-white/20 relative overflow-hidden group",
                    focusMode ? "bg-[#F2EEC8]/10 border-[#F2EEC8]/20 text-[#F2EEC8]" : ""
                  )}
                >
                  <div className="noise-texture opacity-10 group-hover:opacity-20 transition-opacity"></div>
                  <div className="flex items-center gap-2 relative z-10">
                    <Eye className="w-4 h-4" />
                    <span>{focusMode ? "Reading" : "Focus"}</span>
                  </div>
                </Button>

                {/* Table of Contents toggle */}
                <Button
                  onClick={toggleTableOfContents}
                  className="bg-white/5 hover:bg-white/10 text-white/80 hover:text-white
                           px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                           border border-white/10 hover:border-white/20 relative overflow-hidden group"
                >
                  <div className="noise-texture opacity-10 group-hover:opacity-20 transition-opacity"></div>
                  <div className="flex items-center gap-2 relative z-10">
                    <ListFilter className="w-4 h-4" />
                    <span>Contents</span>
                  </div>
                </Button>
                
                {/* Back to top button */}
                <Button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="bg-white/5 hover:bg-white/10 text-white/80 hover:text-white
                           px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                           border border-white/10 hover:border-white/20 relative overflow-hidden group"
                >
                  <div className="noise-texture opacity-10 group-hover:opacity-20 transition-opacity"></div>
                  <div className="flex items-center gap-2 relative z-10">
                    <ChevronUp className="w-4 h-4" />
                    <span>Top</span>
                  </div>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-6 h-full">
              <div
                onClick={() => navigate('/')}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <h2 className="text-2xl font-bold tracking-tight text-[#F2EEC8]/80 font-serif group-hover:text-[#F2EEC8] transition-all duration-300">
                  Eagan
                </h2>
              </div>

              {/* Research progress moved to bottom bar */}
              {isFetching && !blogState.error && (
                <div className="flex items-center gap-4 max-w-md">
                  {blogState.reflectionProgress && (
                    <>
                      <div className="flex-1 relative overflow-hidden rounded-full">
                        <div className="noise-texture opacity-10"></div>
                        <div className="research-progress h-2 relative z-10">
                          <div 
                            className="research-progress-bar" 
                            style={{ 
                              width: `${(blogState.reflectionProgress.iteration / blogState.reflectionProgress.max_iterations) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-[#F2EEC8]/80 whitespace-nowrap">
                        {blogState.reflectionProgress.iteration} of {blogState.reflectionProgress.max_iterations}
                      </span>
                    </>
                  )}
                  <div className="flex items-center gap-2 text-[#F2EEC8]/80 px-3 py-1.5 rounded-full bg-[#F2EEC8]/5 backdrop-blur-sm border border-[#F2EEC8]/10 relative overflow-hidden">
                    <div className="noise-texture opacity-10"></div>
                    <Loader2 className="w-3 h-3 animate-spin relative z-10" />
                    <span className="text-xs font-medium relative z-10">{blogState.status}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BlogResults;
