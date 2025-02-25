import { Button } from "@/components/ui/button"
import { LightbulbIcon } from "lucide-react"
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react';

export default function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (searchQuery.trim()) {
          handleSearch(e as unknown as React.FormEvent);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  return (
    <div className="min-h-screen w-full bg-[#1E1F1C] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background SVG */}
      <img
        src="/src/assets/background.svg"
        className="absolute inset-0 w-full h-full opacity-70 pointer-events-none object-cover"
        alt=""
      />

      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#F2EEC8]/5 to-transparent pointer-events-none" />

      <div className="w-full max-w-3xl mx-auto text-center space-y-16 relative">
        {/* Logo and Title */}
        <div>
          <div className="flex items-center justify-center">
            <h1 className="text-7xl font-bold tracking-tight text-slate-50 font-serif">
              Eagan
            </h1>
          </div>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch}>
          <div className="max-w-2xl mx-auto relative group">
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
              />
              <div className="absolute inset-0 rounded-2xl bg-[#F2EEC8]/5 blur-xl opacity-50 -z-10" />
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
              >
                <LightbulbIcon className="w-5 h-5 mr-2.5 transition-transform group-hover:scale-110 group-hover:rotate-12" />
                <span className="font-round text-lg font-medium">Browse</span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}