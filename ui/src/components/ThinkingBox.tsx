import React, { useEffect, useRef } from 'react';
import { cn } from "@/lib/utils";

interface ThinkingBoxProps {
  thoughts: string[];
  title?: string;
  className?: string;
  maxHeight?: number;
  isActive?: boolean;
}

const ThinkingBox: React.FC<ThinkingBoxProps> = ({
  thoughts,
  title = "AI Thinking Process",
  className,
  maxHeight = 400,
  isActive = true
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when new thoughts are added
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [thoughts]);

  return (
    <div 
      className={cn(
        "glass-effect rounded-xl overflow-hidden thinking-container transition-all duration-500",
        isActive ? "border-[#F2EEC8]/10" : "border-[#F2EEC8]/5",
        className
      )}
      style={{ maxHeight: `${maxHeight}px` }}
    >
      <div className="p-4 border-b border-[#F2EEC8]/10 relative z-10">
        <h3 className={cn(
          "text-xl font-display transition-colors duration-300",
          isActive ? "text-[#F2EEC8]" : "text-[#F2EEC8]/70"
        )}>
          {title}
          {!isActive && <span className="text-sm ml-2 opacity-70">(inactive)</span>}
        </h3>
      </div>
      
      <div 
        ref={contentRef} 
        className="thinking-content p-4 overflow-y-auto hide-scrollbar"
        style={{ maxHeight: `calc(${maxHeight}px - 60px)` }}
      >
        {thoughts.map((thought, index) => (
          <div 
            key={index} 
            className={cn(
              "mb-4 text-sm font-mono leading-relaxed transition-colors duration-300",
              isActive ? "text-white/80" : "text-white/60"
            )}
          >
            {thought.split('\n').map((line, i) => (
              <p 
                key={i} 
                className="text-fade-in mb-2" 
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {line}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThinkingBox; 