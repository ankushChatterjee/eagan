import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

/**
 * Copy button component that appears on code blocks
 */
const CopyButton: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };
  
  return (
    <button 
      className="copy-button" 
      onClick={handleCopy}
      aria-label="Copy code to clipboard"
    >
      {copied ? (
        <span>Copied!</span>
      ) : (
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="copy-icon"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      )}
    </button>
  );
};

/**
 * MarkdownRender component
 * A drop-in replacement for ReactMarkdown that also renders LaTeX math expressions
 * and provides syntax highlighting for code blocks
 */
const MarkdownRender: React.FC<React.ComponentProps<typeof ReactMarkdown>> = (props) => {
  return (
    <>
      <style>
        {`
          /* Enhanced styling for math elements */
          .markdown-math-container {
            font-family: var(--font-round, system-ui);
          }
          
          .markdown-math-container .math {
            font-size: 1.05em;
          }
          
          /* Inline math styles */
          .markdown-math-container .katex {
            padding: 0 0.15em;
            color: #F2EEC8; /* Match the theme highlight color */
            font-family: 'KaTeX_Math', 'Times New Roman', serif;
            letter-spacing: 0.02em;
            transition: all 0.2s ease;
          }
          
          /* Display/block math styles */
          .markdown-math-container .math-display {
            padding: 1.5rem 1rem;
            margin: 1.5rem 0;
            overflow-x: auto;
            background-color: rgba(242, 238, 200, 0.05); /* Very subtle cream background */
            border-radius: 6px;
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
            display: flex;
            justify-content: center;
            border-left: 3px solid #F2EEC8; /* Match theme border */
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          /* Add hover effect for block math */
          .markdown-math-container .math-display:hover {
            background-color: rgba(242, 238, 200, 0.08);
            box-shadow: 0 10px 30px rgba(242, 238, 200, 0.1);
            transform: translateY(-2px) scale(1.01);
          }
          
          /* Ensure good contrast for math symbols */
          .markdown-math-container .katex-mathml {
            font-weight: 500;
          }
          
          /* Additional styling for specific KaTeX elements */
          .markdown-math-container .katex-display {
            margin: 0;
          }
          
          .markdown-math-container .katex-display > .katex {
            padding: 0;
            display: flex;
            justify-content: center;
            max-width: 100%;
          }
          
          /* Handle overflow for long equations */
          .markdown-math-container .katex-display > .katex > .katex-html {
            overflow-x: auto;
            overflow-y: hidden;
            padding: 0.5em 0;
            max-width: 100%;
          }
          
          /* Ensure better spacing */
          .markdown-math-container p .katex {
            margin: 0 0.1em;
          }
          
          /* Add some nice styling to equation numbers if present */
          .markdown-math-container .katex .eqn-num {
            position: relative;
            float: right;
            padding-right: 5px;
            color: #F2EEC8;
            opacity: 0.7;
            font-size: 0.9em;
          }
          
          /* Apply glass effect to specific elements */
          .markdown-math-container .glass-effect {
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
          
          /* Style for math formulas with hover glow effect */
          .markdown-math-container .math:hover .katex {
            text-shadow: 0 0 8px rgba(242, 238, 200, 0.4);
          }
          
          /* Add highlight effect to certain math symbols */
          .markdown-math-container .katex-html .mrel,
          .markdown-math-container .katex-html .mbin {
            color: rgba(242, 238, 200, 0.9);
          }
          
          /* Prevent equation overflow */
          .markdown-math-container .math-display::-webkit-scrollbar {
            height: 4px;
          }
          
          .markdown-math-container .math-display::-webkit-scrollbar-track {
            background: rgba(242, 238, 200, 0.05);
            border-radius: 10px;
          }
          
          .markdown-math-container .math-display::-webkit-scrollbar-thumb {
            background: rgba(242, 238, 200, 0.2);
            border-radius: 10px;
          }
          
          .markdown-math-container .math-display::-webkit-scrollbar-thumb:hover {
            background: rgba(242, 238, 200, 0.3);
          }

          /* Code block styling with syntax highlighting but no text background */
          .markdown-math-container pre {
            margin: 1.5rem 0;
            padding: 0;
            overflow: hidden;
            border-radius: 6px;
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            border-left: 3px solid #F2EEC8;
            position: relative; /* For positioning the language indicator */
          }
          
          .markdown-math-container pre:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 30px rgba(0, 0, 0, 0.3);
          }
          
          .markdown-math-container pre > div {
            margin: 0 !important;
            border-radius: 6px !important;
            overflow: auto;
            background: transparent !important; /* Remove background from syntax highlighter */
            padding: 1rem !important;
          }

          /* Override syntax highlighter background */
          .markdown-math-container pre .react-syntax-highlighter-line-number {
            background: transparent !important;
          }
          
          /* Style for inline code to match theme */
          .markdown-math-container :not(pre) > code {
            color: #F2EEC8 !important;
            background-color: transparent !important;
            border-radius: 4px;
            padding: 0.2em 0.4em;
            font-size: 0.9em;
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
          }

          /* Language label styling */
          .code-language-label {
            position: absolute;
            top: 0;
            right: 0;
            padding: 0.3em 0.8em;
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 0.75em;
            border-bottom-left-radius: 6px;
            color: rgba(242, 238, 200, 0.9);
            background-color: rgba(30, 31, 28, 0.75);
            border-left: 1px solid rgba(242, 238, 200, 0.2);
            border-bottom: 1px solid rgba(242, 238, 200, 0.2);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            letter-spacing: 0.05em;
            text-transform: uppercase;
            opacity: 0.85;
            z-index: 10;
            transition: all 0.2s ease;
          }

          .markdown-math-container pre:hover .code-language-label {
            opacity: 1;
            background-color: rgba(30, 31, 28, 0.85);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }
          
          /* Copy button styling */
          .copy-button {
            position: absolute;
            bottom: 8px;
            right: 8px;
            border: none;
            background-color: rgba(242, 238, 200, 0.15);
            color: rgba(242, 238, 200, 0.9);
            border-radius: 4px;
            padding: 6px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            cursor: pointer;
            opacity: 0;
            transform: translateY(5px);
            transition: all 0.2s ease-out;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            border: 1px solid rgba(242, 238, 200, 0.1);
            z-index: 10;
          }
          
          .markdown-math-container pre:hover .copy-button {
            opacity: 1;
            transform: translateY(0);
          }
          
          .copy-button:hover {
            background-color: rgba(242, 238, 200, 0.25);
            color: #F2EEC8;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }
          
          .copy-button:active {
            transform: scale(0.95);
            background-color: rgba(242, 238, 200, 0.3);
          }
          
          /* When copied */
          .copy-button span {
            display: inline-block;
            min-width: 40px;
            text-align: center;
          }

          /* Copy icon styling */
          .copy-icon {
            width: 16px;
            height: 16px;
            stroke: currentColor;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            fill: none;
          }
        `}
      </style>
      <div className="markdown-math-container prose prose-invert max-w-none 
                      prose-p:text-lg prose-p:leading-relaxed
                      prose-strong:text-[#F2EEC8] prose-strong:font-semibold
                      prose-a:text-[#F2EEC8] prose-a:no-underline hover:prose-a:underline
                      prose-headings:text-[#F2EEC8] prose-headings:font-display
                      prose-code:text-[#F2EEC8] prose-code:bg-transparent prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md
                      prose-blockquote:border-l-[#F2EEC8] prose-blockquote:bg-[#F2EEC8]/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1
                      prose-em:text-[#F2EEC8]/90
                      selection:bg-[#F2EEC8]/20 
                      selection:text-[#F2EEC8]">
        <ReactMarkdown
          {...props}
          remarkPlugins={[remarkGfm, [remarkMath, { singleDollar: true }]]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
          components={{
            code({ className, children, ...rest }) {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : '';
              const isInline = !match;
              
              // Capitalize language name for display
              const formatLanguageName = (lang: string) => {
                if (!lang) return '';
                
                // Map of language codes to display names
                const languageMap: Record<string, string> = {
                  js: 'JavaScript',
                  ts: 'TypeScript',
                  py: 'Python',
                  md: 'Markdown',
                  yml: 'YAML',
                  yaml: 'YAML',
                  sh: 'Shell',
                  bash: 'Shell',
                  jsx: 'JSX',
                  tsx: 'TSX',
                  html: 'HTML',
                  css: 'CSS',
                  cpp: 'C++',
                  rb: 'Ruby',
                  sql: 'SQL',
                  json: 'JSON',
                  toml: 'TOML',
                  ini: 'INI',
                  java: 'Java',
                  kotlin: 'Kotlin',
                  swift: 'Swift',
                  go: 'Go',
                  rust: 'Rust',
                  php: 'PHP'
                };
                
                const normalizedLang = lang.toLowerCase();
                return languageMap[normalizedLang] || lang.charAt(0).toUpperCase() + lang.slice(1);
              };
              
              const displayLanguage = formatLanguageName(language);
              const codeContent = String(children).replace(/\n$/, '');
              
              return isInline ? (
                <code className={className} {...rest}>
                  {children}
                </code>
              ) : (
                <div style={{ position: 'relative' }}>
                  {displayLanguage && <div className="code-language-label">{displayLanguage}</div>}
                  <CopyButton code={codeContent} />
                  <Prism
                    style={{
                      ...oneDark,
                      'pre[class*="language-"]': {
                        ...oneDark['pre[class*="language-"]'],
                        backgroundColor: 'transparent',
                        margin: 0,
                      },
                      'code[class*="language-"]': {
                        ...oneDark['code[class*="language-"]'],
                        backgroundColor: 'transparent',
                      }
                    }}
                    language={language}
                    PreTag="div"
                    children={codeContent}
                  />
                </div>
              );
            }
          }}
        />
      </div>
    </>
  );
};

export default MarkdownRender;
