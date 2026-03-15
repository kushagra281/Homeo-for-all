import { useState } from "react";
import { Filter, RotateCcw, Search, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AGE_GROUPS, GENDERS, SYMPTOM_LOCATIONS, CONDITION_TYPES, POTENCIES } from "@shared/schema";

interface AdvancedFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  onSearch: () => void;
  isLoading?: boolean;
  showWarnings?: boolean;
}

export interface FilterState {
  age_group: string;
  gender: string; 
  symptom_location: string;
  condition_type: string;
  potency: string;
}

export default function AdvancedFilters({ 
  onFiltersChange, 
  onSearch, 
  isLoading = false,
  showWarnings = true 
}: AdvancedFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    age_group: "",
    gender: "",
    symptom_location: "",
    condition_type: "",
    potency: ""
  });

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const resetFilters = () => {
    const emptyFilters: FilterState = {
      age_group: "",
      gender: "",
      symptom_location: "",
      condition_type: "",
      potency: ""
    };
    setFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => value !== "").length;
  };

  const hasChildFilter = filters.age_group === "child";
  const hasGenderFilter = filters.gender && filters.gender !== "any";

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Advanced Filters</h3>
          {getActiveFilterCount() > 0 && (
            <Badge variant="secondary" className="ml-2">
              {getActiveFilterCount()} active
            </Badge>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={resetFilters}
          disabled={getActiveFilterCount() === 0}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Filter Warning Messages */}
      {showWarnings && (
        <div className="space-y-3 mb-6">
          {hasChildFilter && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Child Safety:</strong> Remedies with red flags (🚩) are not recommended for children. 
                Always consult a qualified practitioner for pediatric cases.
              </AlertDescription>
            </Alert>
          )}
          
          {hasGenderFilter && (
            <Alert className="border-blue-200 bg-blue-50">
              <div className="flex items-center gap-2">
                <span className={filters.gender === "male" ? "text-blue-600" : "text-pink-600"}>
                  {filters.gender === "male" ? "♂" : "♀"}
                </span>
                <AlertDescription className="text-blue-800">
                  <strong>Gender-Specific:</strong> Showing remedies for {filters.gender} patients. 
                  Look for {filters.gender === "male" ? "♂️" : "♀️"} symbols on remedy cards.
                </AlertDescription>
              </div>
            </Alert>
          )}
        </div>
      )}

      {/* Filter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Age Group Filter */}
        <div className="space-y-2">
          <Label htmlFor="age-filter" className="flex items-center gap-2">
            <span>👶</span>
            <span>Age Group</span>
            {hasChildFilter && (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
          </Label>
          <Select 
            value={filters.age_group} 
            onValueChange={(value) => handleFilterChange("age_group", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any age" />
            </SelectTrigger>
            <SelectContent>
              {AGE_GROUPS.map(age => (
                <SelectItem key={age} value={age}>
                  <div className="flex items-center gap-2">
                    <span>{age.charAt(0).toUpperCase() + age.slice(1)}</span>
                    {age === "child" && (
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasChildFilter && (
            <p className="text-xs text-amber-600">
              🚩 Watch for red flag warnings on remedies
            </p>
          )}
        </div>

        {/* Gender Filter */}
        <div className="space-y-2">
          <Label htmlFor="gender-filter" className="flex items-center gap-2">
            <span>👤</span>
            <span>Gender</span>
            {hasGenderFilter && (
              <span className={filters.gender === "male" ? "text-blue-500" : "text-pink-500"}>
                {filters.gender === "male" ? "♂" : "♀"}
              </span>
            )}
          </Label>
          <Select 
            value={filters.gender} 
            onValueChange={(value) => handleFilterChange("gender", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any gender" />
            </SelectTrigger>
            <SelectContent>
              {GENDERS.filter(g => g !== "any").map(gender => (
                <SelectItem key={gender} value={gender}>
                  <div className="flex items-center gap-2">
                    <span className={gender === "male" ? "text-blue-500" : "text-pink-500"}>
                      {gender === "male" ? "♂" : "♀"}
                    </span>
                    <span>{gender.charAt(0).toUpperCase() + gender.slice(1)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasGenderFilter && (
            <p className="text-xs text-neutral-600">
              {filters.gender === "male" ? "♂️" : "♀️"} Look for gender symbols on remedies
            </p>
          )}
        </div>

        {/* Symptom Location Filter */}
        <div className="space-y-2">
          <Label htmlFor="location-filter" className="flex items-center gap-2">
            <span>📍</span>
            <span>Symptom Location</span>
          </Label>
          <Select 
            value={filters.symptom_location} 
            onValueChange={(value) => handleFilterChange("symptom_location", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any location" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {SYMPTOM_LOCATIONS.map(location => (
                <SelectItem key={location} value={location}>
                  {location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Condition Type Filter */}
        <div className="space-y-2">
          <Label htmlFor="condition-filter" className="flex items-center gap-2">
            <span>⏱️</span>
            <span>Condition Type</span>
          </Label>
          <Select 
            value={filters.condition_type} 
            onValueChange={(value) => handleFilterChange("condition_type", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any type" />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_TYPES.map(type => (
                <SelectItem key={type} value={type}>
                  <div className="flex items-center gap-2">
                    <span className={type === "acute" ? "text-orange-600" : "text-blue-600"}>
                      {type === "acute" ? "🔥" : "🔄"}
                    </span>
                    <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filters.condition_type && (
            <p className="text-xs text-neutral-600">
              {filters.condition_type === "acute" 
                ? "🔥 Sudden onset, recent symptoms" 
                : "🔄 Long-term, recurring symptoms"
              }
            </p>
          )}
        </div>

        {/* Potency Filter */}
        <div className="space-y-2">
          <Label htmlFor="potency-filter" className="flex items-center gap-2">
            <span>💊</span>
            <span>Preferred Potency</span>
          </Label>
          <Select 
            value={filters.potency} 
            onValueChange={(value) => handleFilterChange("potency", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any potency" />
            </SelectTrigger>
            <SelectContent>
              {POTENCIES.map(potency => (
                <SelectItem key={potency} value={potency}>
                  {potency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-neutral-600">
          {getActiveFilterCount() > 0 ? (
            `${getActiveFilterCount()} filter${getActiveFilterCount() > 1 ? 's' : ''} applied`
          ) : (
            "No filters applied - showing all remedies"
          )}
        </div>
        
        <Button 
          onClick={onSearch} 
          disabled={isLoading}
          className="min-w-32"
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Searching...
            </div>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Apply Filters
            </>
          )}
        </Button>
      </div>

      {/* Filter Summary */}
      {getActiveFilterCount() > 0 && (
        <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Active Filters:</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => {
              if (!value) return null;
              return (
                <Badge key={key} variant="outline" className="text-xs">
                  {key.replace('_', ' ')}: {value}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
