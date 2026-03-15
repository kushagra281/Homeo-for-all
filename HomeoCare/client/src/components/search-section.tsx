import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import RemedyCard from "./remedy-card";
import type { Remedy } from "@shared/schema";

export default function SearchSection() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const { data: searchResults, isLoading, error } = useQuery<Remedy[]>({
    queryKey: ["/api/remedies/search", activeSearch],
    enabled: activeSearch.length >= 2,
  });

  const handleSearch = () => {
    if (searchTerm.trim().length >= 2) {
      setActiveSearch(searchTerm.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    setActiveSearch("");
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-neutral-900 mb-2">Search Remedies</h3>
        <p className="text-neutral-600">
          Enter symptoms, conditions, or remedy names to find the right homeopathic solution
        </p>
      </div>

      <div className="flex gap-3 max-w-lg mx-auto mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="e.g., headache, anxiety, Belladonna..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-10 pr-4 py-3 text-lg"
          />
        </div>
        <Button 
          onClick={handleSearch}
          disabled={searchTerm.trim().length < 2}
          className="px-6 py-3"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
        </Button>
      </div>

      {activeSearch && (
        <div className="border-t border-neutral-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-neutral-900">
              Search Results for "{activeSearch}"
            </h4>
            <Button variant="ghost" onClick={clearSearch} className="text-neutral-500">
              Clear Search
            </Button>
          </div>

          {isLoading && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-neutral-600">Searching remedies...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">Failed to search remedies. Please try again.</p>
              <Button onClick={handleSearch}>Retry Search</Button>
            </div>
          )}

          {searchResults && (
            <>
              {searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-neutral-600 mb-4">
                    No remedies found for "{activeSearch}". Try different keywords or browse by body system below.
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {searchResults.map((remedy) => (
                    <RemedyCard key={remedy.id} remedy={remedy} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
