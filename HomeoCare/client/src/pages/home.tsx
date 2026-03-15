import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  User, Eye, Ear, Wind, Smile, Circle, Droplets, Heart, 
  Bone, Stethoscope, ScanFace, Thermometer, Brain, Settings,
  Pill, ArrowRight, Plus, Filter
} from "lucide-react";
import { Header } from "@/components/header";
import { SearchBar } from "@/components/search-bar";
import { KeywordSelector } from "@/components/keyword-selector";
import { CategoryCard } from "@/components/category-card";
import { RemedyCard } from "@/components/remedy-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category, Remedy, Keyword } from "@shared/schema";

const iconMap = {
  user: User,
  eye: Eye,
  ear: Ear,
  wind: Wind,
  smile: Smile,
  circle: Circle,
  droplets: Droplets,
  heart: Heart,
  bone: Bone,
  lungs: Stethoscope,
  "scan-face": ScanFace,
  thermometer: Thermometer,
  brain: Brain,
  settings: Settings,
};

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("alphabetical");

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: featuredRemedies = [], isLoading: remediesLoading } = useQuery<Remedy[]>({
    queryKey: ["/api/remedies/featured"],
  });

  const { data: keywords = [] } = useQuery<Keyword[]>({
    queryKey: ["/api/keywords"],
  });

  const handleKeywordToggle = (keyword: string) => {
    setSelectedKeywords(prev => 
      prev.includes(keyword) 
        ? prev.filter(k => k !== keyword)
        : [...prev, keyword]
    );
  };

  const handleFindRemedies = () => {
    // Navigate to remedies page with selected keywords
    window.location.href = `/remedies?keywords=${selectedKeywords.join(',')}`;
  };

  const sortedCategories = [...categories].sort((a, b) => {
    if (sortBy === "alphabetical") return a.displayName.localeCompare(b.displayName);
    if (sortBy === "popular") return (b.remedyCount || 0) - (a.remedyCount || 0);
    return 0;
  });

  const visibleCategories = sortedCategories.filter(cat => cat.name !== "modalities").slice(0, 8);

  if (categoriesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/3 mx-auto"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-48 bg-muted rounded-2xl"></div>
              <div className="h-48 bg-muted rounded-2xl"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded-xl"></div>
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
        {/* Hero Section */}
        <section className="text-center mb-12 animate-fade-in">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Find Your Perfect Homeopathic Remedy
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Discover natural healing solutions with our comprehensive database of 260+ homeopathic remedies 
            organized across 22+ anatomical categories and systems.
          </p>

          <SearchBar 
            value={searchQuery}
            onChange={setSearchQuery}
          />

          <KeywordSelector
            keywords={keywords}
            selectedKeywords={selectedKeywords}
            onKeywordToggle={handleKeywordToggle}
            onFindRemedies={handleFindRemedies}
          />
        </section>

        {/* Featured Sections - MEDICINE and MODALITIES */}
        <section className="mb-12">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Medicine Section */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 p-8 border-primary/20 animate-slide-up">
              <div className="flex items-center space-x-3 mb-6">
                <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center">
                  <Pill className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-primary">MEDICINE</h3>
                  <p className="text-primary/80">Browse by remedy name</p>
                </div>
              </div>
              <p className="text-primary/90 mb-6">
                Explore our comprehensive database of 260+ homeopathic medicines with detailed information about 
                each remedy, including symptoms, potencies, and usage guidelines.
              </p>
              <Link href="/medicine">
                <Button className="flex items-center space-x-2">
                  <span>Browse All Medicines</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </Card>

            {/* Modalities Section */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 border-blue-200 animate-slide-up">
              <div className="flex items-center space-x-3 mb-6">
                <div className="h-12 w-12 bg-blue-500 rounded-xl flex items-center justify-center">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-blue-700">MODALITIES</h3>
                  <p className="text-blue-600">Conditions & triggers</p>
                </div>
              </div>
              <p className="text-blue-700 mb-6">
                Understand how symptoms change with different conditions, times, weather, and activities. 
                Find remedies based on what makes symptoms better or worse.
              </p>
              <Link href="/modalities">
                <Button className="bg-blue-500 hover:bg-blue-600 flex items-center space-x-2">
                  <span>Explore Modalities</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </Card>
          </div>
        </section>

        {/* Category Grid */}
        <section className="mb-12">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-bold text-foreground">Browse by Body System</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-muted-foreground">Sort by:</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alphabetical">Alphabetical</SelectItem>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visibleCategories.map((category, index) => (
              <div
                key={category.id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CategoryCard
                  category={category}
                  icon={iconMap[category.icon as keyof typeof iconMap] || Circle}
                />
              </div>
            ))}

            {/* Show More Button */}
            <Link href="/categories">
              <Card className="group bg-muted/50 p-6 hover:border-primary hover:bg-muted transition-all duration-300 cursor-pointer animate-slide-up">
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="h-12 w-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-gray-300 transition-colors">
                      <Plus className="h-6 w-6 text-gray-600" />
                    </div>
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      View All Categories
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">+{categories.length - 8} more categories</p>
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        </section>

        {/* Featured Remedies */}
        <section className="mb-12">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-bold text-foreground">Featured Remedies</h3>
            <Link href="/remedies">
              <Button variant="ghost" className="text-primary hover:text-primary/80 font-medium flex items-center space-x-1">
                <span>View all remedies</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {remediesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 bg-muted rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredRemedies.slice(0, 3).map((remedy, index) => (
                <div
                  key={remedy.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <RemedyCard remedy={remedy} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick Stats */}
        <section className="bg-card p-8 rounded-2xl border border-border mb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">260+</div>
              <div className="text-sm text-muted-foreground">Homeopathic Remedies</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">22</div>
              <div className="text-sm text-muted-foreground">Body System Categories</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">140+</div>
              <div className="text-sm text-muted-foreground">Symptoms Covered</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">100%</div>
              <div className="text-sm text-muted-foreground">Offline Access</div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <Heart className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">HomeoWell</h3>
                </div>
              </div>
              <p className="text-muted-foreground mb-4 max-w-md">
                Your comprehensive guide to homeopathic remedies. Natural healing solutions 
                for the whole family, backed by traditional knowledge and modern accessibility.
              </p>
              <p className="text-sm text-muted-foreground">
                Perfect for babies, children, and adults. Always consult with a qualified 
                homeopathic practitioner for serious conditions.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/categories">All Categories</Link></li>
                <li><Link href="/remedies">Popular Remedies</Link></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Symptom Finder</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Emergency Guide</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">User Guide</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Safety Information</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 HomeoWell. All rights reserved. For educational purposes only.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}