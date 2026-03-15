import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { RemedyCard } from "@/components/remedy-card";
import { SearchBar } from "@/components/search-bar";
import { AdvancedSearch } from "@/components/advanced-search";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Filter, Pill, Percent, Search as SearchIcon } from "lucide-react";
import { Link } from "wouter";
import type { Remedy } from "@shared/schema";

export default function MedicinePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [filterBy, setFilterBy] = useState("all");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedResults, setAdvancedResults] = useState<Array<Remedy & { matchScore: number }>>([]);

  const { data: remedies = [], isLoading } = useQuery<Remedy[]>({
    queryKey: ["/api/remedies"],
  });

  const handleAdvancedResults = (results: Array<Remedy & { matchScore: number }>) => {
    setAdvancedResults(results);
  };

  const filteredRemedies = showAdvancedSearch && advancedResults.length > 0 
    ? advancedResults 
    : remedies.filter(remedy => {
        const matchesSearch = remedy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          remedy.keySymptoms.some(symptom => 
            symptom.toLowerCase().includes(searchQuery.toLowerCase())
          ) ||
          remedy.description.toLowerCase().includes(searchQuery.toLowerCase());

        if (filterBy === "all") return matchesSearch;
        if (filterBy === "popular") return matchesSearch && remedy.isPopular;
        if (filterBy === "constitutional") return matchesSearch && remedy.constitution;
        
        return matchesSearch;
      });

  const sortedRemedies = [...filteredRemedies].sort((a, b) => {
    if (sortBy === "relevance" && 'matchScore' in a && 'matchScore' in b) {
      return (b as any).matchScore - (a as any).matchScore;
    }
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "popular") return (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0);
    if (sortBy === "categories") return a.categories.length - b.categories.length;
    return 0;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-12 bg-muted rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-64 bg-muted rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4 flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Button>
          </Link>
          
          <div className="flex items-center space-x-3 mb-4">
            <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center">
              <Pill className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">All Medicines</h1>
              <p className="text-lg text-muted-foreground">Browse our comprehensive remedy database</p>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            {filteredRemedies.length} of {remedies.length} remedies
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Button
                variant={showAdvancedSearch ? "default" : "outline"}
                onClick={() => {
                  setShowAdvancedSearch(!showAdvancedSearch);
                  if (showAdvancedSearch) {
                    setAdvancedResults([]);
                  }
                }}
                className="flex items-center space-x-2"
              >
                <SearchIcon className="h-4 w-4" />
                <span>Advanced Search</span>
              </Button>
              {advancedResults.length > 0 && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <Percent className="h-3 w-3" />
                  <span>Showing scored results</span>
                </Badge>
              )}
            </div>
          </div>

          {showAdvancedSearch ? (
            <AdvancedSearch onResults={handleAdvancedResults} />
          ) : (
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search medicines by name, symptoms, or description..."
            />
          )}
          
          <div className="flex flex-wrap gap-4 justify-between items-center">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-muted-foreground">Sort by:</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name A-Z</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="categories">Most Categories</SelectItem>
                    {advancedResults.length > 0 && (
                      <SelectItem value="relevance">Best Match</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-muted-foreground">Filter:</label>
                <Select value={filterBy} onValueChange={setFilterBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Remedies</SelectItem>
                    <SelectItem value="popular">Popular Only</SelectItem>
                    <SelectItem value="constitutional">Constitutional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button variant="outline" className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span>Advanced Filter</span>
            </Button>
          </div>
        </div>

        {/* Remedies Grid */}
        {sortedRemedies.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-24 w-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Pill className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No medicines found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search criteria or filters.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setFilterBy("all");
              }}
            >
              Clear All Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedRemedies.map((remedy, index) => (
              <div
                key={remedy.id}
                className="animate-slide-up relative"
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                {'matchScore' in remedy && (
                  <Badge 
                    className="absolute top-2 right-2 z-10 bg-primary text-white"
                    variant="default"
                  >
                    <Percent className="h-3 w-3 mr-1" />
                    {(remedy as any).matchScore}%
                  </Badge>
                )}
                <RemedyCard remedy={remedy} />
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {sortedRemedies.length > 0 && sortedRemedies.length >= 20 && (
          <div className="text-center mt-12">
            <Button variant="outline" size="lg">
              Load More Remedies
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
