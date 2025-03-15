import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * MarkdownRender component
 * A drop-in replacement for ReactMarkdown that also renders LaTeX math expressions
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
        `}
      </style>
      <div className="markdown-math-container prose prose-invert max-w-none 
                      prose-p:text-lg prose-p:leading-relaxed
                      prose-strong:text-[#F2EEC8] prose-strong:font-semibold
                      prose-a:text-[#F2EEC8] prose-a:no-underline hover:prose-a:underline
                      prose-headings:text-[#F2EEC8] prose-headings:font-display
                      prose-code:text-[#F2EEC8] prose-code:bg-[#F2EEC8]/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md
                      prose-blockquote:border-l-[#F2EEC8] prose-blockquote:bg-[#F2EEC8]/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1
                      prose-em:text-[#F2EEC8]/90
                      selection:bg-[#F2EEC8]/20 
                      selection:text-[#F2EEC8]">
        <ReactMarkdown
          {...props}
          remarkPlugins={[remarkGfm, [remarkMath, { singleDollar: true }]]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        />
      </div>
    </>
  );
};

export default MarkdownRender;
