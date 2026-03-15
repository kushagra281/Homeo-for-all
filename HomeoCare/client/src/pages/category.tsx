import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { RemedyCard } from "@/components/remedy-card";
import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Filter } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import type { Remedy, Category } from "@shared/schema";

export default function CategoryPage() {
  const { category: categoryName } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const { data: category, isLoading: categoryLoading } = useQuery<Category>({
    queryKey: ["/api/categories", categoryName],
  });

  const { data: remedies = [], isLoading: remediesLoading } = useQuery<Remedy[]>({
    queryKey: ["/api/remedies", categoryName],
    queryFn: async () => {
      const response = await fetch(`/api/remedies?category=${categoryName}`);
      if (!response.ok) throw new Error('Failed to fetch remedies');
      return response.json();
    },
  });

  const filteredRemedies = remedies.filter(remedy =>
    remedy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    remedy.keySymptoms.some(symptom => 
      symptom.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const sortedRemedies = [...filteredRemedies].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "popular") return (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0);
    return 0;
  });

  if (categoryLoading || remediesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-12 bg-muted rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-muted rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Category Not Found</h1>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb and Header */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4 flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Button>
          </Link>
          
          <h1 className="text-3xl font-bold text-foreground mb-2">{category.displayName}</h1>
          <p className="text-lg text-muted-foreground mb-4">{category.description}</p>
          <p className="text-sm text-muted-foreground">
            {filteredRemedies.length} of {remedies.length} remedies
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={`Search ${category.displayName.toLowerCase()} remedies...`}
          />
          
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-muted-foreground">Sort by:</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Remedies Grid */}
        {sortedRemedies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">
              No remedies found matching your search.
            </p>
            <Button
              variant="outline"
              onClick={() => setSearchQuery("")}
              className="mt-4"
            >
              Clear Search
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedRemedies.map((remedy, index) => (
              <div
                key={remedy.id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <RemedyCard remedy={remedy} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
