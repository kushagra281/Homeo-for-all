import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Remedy } from "@shared/schema";

interface RemedyCardProps {
  remedy: Remedy;
}

export default function RemedyCard({ remedy }: RemedyCardProps) {
  return (
    <Card className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <h4 className="text-xl font-semibold text-neutral-900">{remedy.name}</h4>
        <Badge variant="secondary" className="bg-accent/10 text-accent">
          {remedy.condition}
        </Badge>
      </div>
      
      <p className="text-neutral-700 mb-4 leading-relaxed">{remedy.description}</p>
      
      <div className="mb-4">
        <p className="text-sm font-medium text-neutral-900 mb-2">Recommended Dosage:</p>
        <div className="text-sm text-neutral-600 bg-neutral-50 rounded-lg p-3">
          {remedy.dosage}
        </div>
      </div>
      
      <div>
        <p className="text-sm font-medium text-neutral-900 mb-2">Key Symptoms:</p>
        <div className="flex flex-wrap gap-2">
          {remedy.symptoms.map((symptom) => (
            <Badge 
              key={symptom} 
              variant="outline" 
              className="bg-neutral-100 text-neutral-700 text-xs border-neutral-200"
            >
              {symptom}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  );
}
