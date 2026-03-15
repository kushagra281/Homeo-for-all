import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Brain, Heart, Book, Users, Stethoscope } from "lucide-react";
import Header from "@/components/header";
import RemedyCard from "@/components/remedy-card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import type { Remedy } from "@shared/schema";

export default function Remedies() {
  const { category } = useParams();
  const [, setLocation] = useLocation();

  const { data: remedies, isLoading, error } = useQuery<Remedy[]>({
    queryKey: ["/api/remedies", category],
  });

  if (!category) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Header />
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <p className="text-lg text-neutral-600">Invalid category selected.</p>
          <Button onClick={() => setLocation("/")} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Generate category data dynamically for any body system
  const formatCategoryTitle = (cat: string) => {
    return cat.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const getCategoryIcon = (cat: string) => {
    const lowerCat = cat.toLowerCase();
    if (lowerCat.includes('mind') || lowerCat.includes('psychological')) return <Brain className="text-2xl" />;
    if (lowerCat.includes('head')) return <Brain className="text-2xl" />;
    if (lowerCat.includes('eye')) return <Users className="text-2xl" />;
    if (lowerCat.includes('heart') || lowerCat.includes('circulatory')) return <Heart className="text-2xl" />;
    if (lowerCat.includes('respiratory') || lowerCat.includes('chest')) return <Stethoscope className="text-2xl" />;
    return <Book className="text-2xl" />;
  };

  const currentCategory = {
    title: formatCategoryTitle(category),
    subtitle: `Natural remedies for ${category.toLowerCase()}-related conditions`,
    description: `Explore homeopathic solutions for ${category.toLowerCase()} conditions. These gentle remedies work with your body's natural healing processes.`,
    icon: getCategoryIcon(category),
    iconColor: "text-primary",
    iconBg: "bg-gradient-to-br from-primary/10 to-primary/20",
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="flex items-center space-x-2 text-neutral-600 hover:text-neutral-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to selection</span>
        </Button>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${currentCategory.iconBg}`}>
              <span className={currentCategory.iconColor}>{currentCategory.icon}</span>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-neutral-900">{currentCategory.title}</h2>
              <p className="text-lg text-neutral-600">{currentCategory.subtitle}</p>
            </div>
          </div>
          <p className="text-neutral-700 leading-relaxed">{currentCategory.description}</p>
        </div>

        {isLoading && (
          <div className="grid md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
                <div className="h-6 bg-neutral-200 rounded mb-4"></div>
                <div className="h-4 bg-neutral-200 rounded mb-2"></div>
                <div className="h-4 bg-neutral-200 rounded mb-4"></div>
                <div className="h-20 bg-neutral-200 rounded"></div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <p className="text-red-600 mb-4">Failed to load remedies. Please try again.</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        )}

        {remedies && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {remedies.map((remedy) => (
              <RemedyCard key={remedy.id} remedy={remedy} />
            ))}
          </div>
        )}

        <div className="bg-gradient-to-r from-accent/5 to-primary/5 rounded-2xl p-8 mt-8">
          <h3 className="text-xl font-semibold text-neutral-900 mb-4">Additional Resources</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <Book className="text-accent mb-2" />
              <h4 className="font-medium text-neutral-900">Learning Hub</h4>
              <p className="text-sm text-neutral-600">Comprehensive guides and articles</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <Users className="text-accent mb-2" />
              <h4 className="font-medium text-neutral-900">Community</h4>
              <p className="text-sm text-neutral-600">Connect with other users</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <Stethoscope className="text-accent mb-2" />
              <h4 className="font-medium text-neutral-900">Find Practitioners</h4>
              <p className="text-sm text-neutral-600">Locate certified homeopaths</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
