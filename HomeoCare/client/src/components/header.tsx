import { Link } from "wouter";
import { Heart, HeartPulse, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/">
            <div className="flex items-center space-x-2 cursor-pointer">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <HeartPulse className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">HomeoWell</h1>
                <p className="text-xs text-muted-foreground">Comprehensive Homeopathic Guide</p>
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/categories" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Categories
            </Link>
            <Link href="/medicine" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Medicine
            </Link>
            <Link href="/modalities" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Modalities
            </Link>
            <Link href="/dictionary" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Dictionary
            </Link>
            <Link href="/community" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Community
            </Link>
            <button className="flex items-center space-x-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <Heart className="h-4 w-4" />
              <span>Favorites</span>
            </button>
          </nav>

          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </header>
  );
}