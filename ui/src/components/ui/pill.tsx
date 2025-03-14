import { cn } from "@/lib/utils";
import { ReactNode, CSSProperties } from "react";

interface PillProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

export function Pill({ children, className, onClick, style }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-full text-sm font-display",
        "bg-white/[0.03] hover:bg-white/[0.06]",
        "text-white/80 hover:text-[#F2EEC8]",
        "border border-[#F2EEC8]/20 hover:border-[#F2EEC8]/40",
        "transition-all duration-300",
        "hover:scale-105 hover:shadow-[0_0_15px_rgba(242,238,200,0.2)]",
        className
      )}
      style={style}
    >
      {children}
    </button>
  );
}