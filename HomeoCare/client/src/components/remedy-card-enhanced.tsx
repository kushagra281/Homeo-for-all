import { AlertTriangle, Clock, MapPin, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Remedy } from "@shared/schema";

interface RemedyCardEnhancedProps {
  remedy: Remedy;
  score?: number;
  confidence?: number;
  matchingSymptoms?: string[];
  showFilters?: boolean;
}

export default function RemedyCardEnhanced({ 
  remedy, 
  score, 
  confidence, 
  matchingSymptoms,
  showFilters = true 
}: RemedyCardEnhancedProps) {
  const isNotSafeForChildren = !remedy.age_groups?.includes("child");
  const isMaleSpecific = remedy.genders?.length === 1 && remedy.genders[0] === "male";
  const isFemaleSpecific = remedy.genders?.length === 1 && remedy.genders[0] === "female";
  const isAcute = remedy.keywords?.some(k => 
    ["acute", "sudden", "rapid", "immediate", "emergency"].includes(k.toLowerCase())
  );
  const isChronic = remedy.keywords?.some(k => 
    ["chronic", "constitutional", "long-term", "persistent"].includes(k.toLowerCase())
  );

  return (
    <Card className="p-6 hover:shadow-md transition-shadow border-l-4 border-l-primary/20">
      <div className="space-y-4">
        {/* Header with title and indicators */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-semibold text-neutral-900">{remedy.name}</h3>
              
              {/* Safety and Gender Indicators */}
              <div className="flex items-center gap-2">
                {/* Red flag for child-inappropriate remedies */}
                {isNotSafeForChildren && (
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center justify-center w-6 h-6 bg-red-100 rounded-full">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>⚠️ Not recommended for children</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Male sign */}
                {isMaleSpecific && (
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full">
                        <span className="text-blue-600 font-bold text-sm">♂</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>♂️ Male-specific remedy</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Female sign */}
                {isFemaleSpecific && (
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center justify-center w-6 h-6 bg-pink-100 rounded-full">
                        <span className="text-pink-600 font-bold text-sm">♀</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>♀️ Female-specific remedy</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-neutral-600 mb-3">
              <span className="font-medium">{remedy.condition}</span>
              <Badge variant="outline" className="text-xs">
                {remedy.category}
              </Badge>
            </div>
          </div>
          
          {/* Score display */}
          {score !== undefined && (
            <div className="text-right min-w-20">
              <div className="flex items-center gap-1 mb-1">
                <Star className="w-4 h-4 text-amber-500" />
                <span className="text-2xl font-bold text-primary">{score}%</span>
              </div>
              {confidence !== undefined && (
                <div className="text-xs text-neutral-500">
                  {confidence}% confidence
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-neutral-700 leading-relaxed">{remedy.description}</p>

        {/* Symptoms */}
        <div>
          <h4 className="text-sm font-medium text-neutral-900 mb-2">Key Symptoms:</h4>
          <div className="flex flex-wrap gap-2">
            {remedy.symptoms.map((symptom, index) => (
              <Badge 
                key={index} 
                variant={matchingSymptoms?.includes(symptom) ? "default" : "secondary"}
                className="text-xs"
              >
                {symptom}
              </Badge>
            ))}
          </div>
        </div>

        {/* Matching symptoms if provided */}
        {matchingSymptoms && matchingSymptoms.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-neutral-900 mb-2">Matching Your Symptoms:</h4>
            <div className="flex flex-wrap gap-2">
              {matchingSymptoms.map((symptom, index) => (
                <Badge key={index} className="text-xs bg-green-100 text-green-800">
                  {symptom}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Filter indicators */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-xs">
              <div className="flex items-center gap-1 text-neutral-500 mb-1">
                <MapPin className="w-3 h-3" />
                <span>Age Groups</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {remedy.age_groups?.map(age => (
                  <Badge key={age} variant="outline" className="text-xs">
                    {age}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="text-xs">
              <div className="flex items-center gap-1 text-neutral-500 mb-1">
                <span>👤</span>
                <span>Gender</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {remedy.genders?.filter(g => g !== "any").map(gender => (
                  <Badge key={gender} variant="outline" className="text-xs">
                    {gender === "male" ? "♂️ Male" : "♀️ Female"}
                  </Badge>
                ))}
                {remedy.genders?.includes("any") && !isMaleSpecific && !isFemaleSpecific && (
                  <Badge variant="outline" className="text-xs">All</Badge>
                )}
              </div>
            </div>
            
            <div className="text-xs">
              <div className="flex items-center gap-1 text-neutral-500 mb-1">
                <Clock className="w-3 h-3" />
                <span>Type</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {isAcute && (
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                    Acute
                  </Badge>
                )}
                {isChronic && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    Chronic
                  </Badge>
                )}
                {!isAcute && !isChronic && (
                  <Badge variant="outline" className="text-xs">
                    General
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="text-xs">
              <div className="flex items-center gap-1 text-neutral-500 mb-1">
                <span>💊</span>
                <span>Potencies</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {remedy.potencies?.slice(0, 3).map(potency => (
                  <Badge key={potency} variant="outline" className="text-xs">
                    {potency}
                  </Badge>
                ))}
                {remedy.potencies && remedy.potencies.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{remedy.potencies.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modalities if available */}
        {remedy.modalities && (remedy.modalities.better.length > 0 || remedy.modalities.worse.length > 0) && (
          <div className="bg-neutral-50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-neutral-900 mb-2">Modalities:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {remedy.modalities.better.length > 0 && (
                <div>
                  <span className="text-green-700 font-medium">Better from: </span>
                  <span className="text-neutral-600">{remedy.modalities.better.join(", ")}</span>
                </div>
              )}
              {remedy.modalities.worse.length > 0 && (
                <div>
                  <span className="text-red-700 font-medium">Worse from: </span>
                  <span className="text-neutral-600">{remedy.modalities.worse.join(", ")}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dosage */}
        <div className="bg-primary/5 rounded-lg p-3">
          <h4 className="text-sm font-medium text-neutral-900 mb-1">Recommended Dosage:</h4>
          <p className="text-sm text-neutral-700">{remedy.dosage}</p>
        </div>
      </div>
    </Card>
  );
}
