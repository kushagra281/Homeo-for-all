import { Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Remedy } from "@shared/schema";

interface RemedyCardProps {
  remedy: Remedy;
  isFavorite?: boolean;
  onToggleFavorite?: (remedyId: string) => void;
}

export function RemedyCard({ remedy, isFavorite = false, onToggleFavorite }: RemedyCardProps) {
  return (
    <Card className="p-6 hover:border-primary hover:shadow-lg transition-all duration-300 group animate-slide-up">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
            {remedy.name}
          </h4>
          <p className="text-sm text-muted-foreground">{remedy.description.slice(0, 60)}...</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleFavorite?.(remedy.id)}
          className={isFavorite ? "text-red-500 hover:text-red-600" : "text-gray-400 hover:text-red-500"}
        >
          <Heart className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} />
        </Button>
      </div>
      
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Key Symptoms
          </p>
          <div className="flex flex-wrap gap-1">
            {remedy.keySymptoms.slice(0, 3).map((symptom, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {symptom}
              </Badge>
            ))}
          </div>
        </div>
        
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Categories
          </p>
          <div className="flex flex-wrap gap-1">
            {remedy.categories.slice(0, 2).map((category, index) => (
              <Badge key={index} className="text-xs capitalize">
                {category}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      
      <Button className="w-full mt-4" variant="outline">
        View Details
      </Button>
    </Card>
  );
}
