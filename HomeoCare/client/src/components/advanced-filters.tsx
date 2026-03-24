import { useState } from "react";
import { Filter, RotateCcw, Search, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface AdvancedFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  onSearch: () => void;
  isLoading?: boolean;
}

export interface FilterState {
  age_group: string;
  gender: string;
  condition_type: string;
  potency: string;
}

const AGE_GROUPS = [
  "0-6", "7-13", "14-20", "21-26", "27-32",
  "33-38", "39-44", "45-50", "51-56", "57-62",
  "63-68", "69-74", "75-80", "80 above"
]

const GENDERS = [
  { value: "Male", icon: "♂️" },
  { value: "Female", icon: "♀️" },
  { value: "Other", icon: "⚧️" },
]

const DISEASE_DURATIONS = [
  "1-3 days",
  "1-3 weeks",
  "1-3 months",
  "4-8 months",
  "8-12 months",
  "More than 1 year",
]

const POTENCIES = ["6C", "30C", "200C", "1M"]

export default function AdvancedFilters({
  onFiltersChange,
  onSearch,
  isLoading = false,
}: AdvancedFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    age_group: "",
    gender: "",
    condition_type: "",
    potency: "",
  });

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const resetFilters = () => {
    const empty: FilterState = { age_group: "", gender: "", condition_type: "", potency: "" };
    setFilters(empty);
    onFiltersChange(empty);
  };

  const activeCount = Object.values(filters).filter(v => v !== "").length;
  const isChild = filters.age_group === "0-6" || filters.age_group === "7-13";

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold">Advanced Filters</h3>
          {activeCount > 0 && (
            <Badge variant="secondary">{activeCount} active</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={resetFilters} disabled={activeCount === 0}>
          <RotateCcw className="w-4 h-4 mr-1" /> Reset
        </Button>
      </div>

      {isChild && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>Child Safety:</strong> Always consult a qualified homeopath for pediatric cases.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

        {/* Age Group */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <span>👶</span> Age Group
          </Label>
          <Select value={filters.age_group} onValueChange={v => handleFilterChange("age_group", v)}>
            <SelectTrigger><SelectValue placeholder="Select age group" /></SelectTrigger>
            <SelectContent>
              {AGE_GROUPS.map(age => (
                <SelectItem key={age} value={age}>{age} years</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <span>👤</span> Gender
          </Label>
          <Select value={filters.gender} onValueChange={v => handleFilterChange("gender", v)}>
            <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
            <SelectContent>
              {GENDERS.map(g => (
                <SelectItem key={g.value} value={g.value}>
                  <span className="flex items-center gap-2">{g.icon} {g.value}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Duration of Disease */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <span>⏱️</span> Duration of Disease
          </Label>
          <Select value={filters.condition_type} onValueChange={v => handleFilterChange("condition_type", v)}>
            <SelectTrigger><SelectValue placeholder="How long?" /></SelectTrigger>
            <SelectContent>
              {DISEASE_DURATIONS.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filters.condition_type && (
            <p className="text-xs text-green-600">Duration helps AI find more specific remedies</p>
          )}
        </div>

        {/* Potency */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <span>💊</span> Preferred Potency
          </Label>
          <Select value={filters.potency} onValueChange={v => handleFilterChange("potency", v)}>
            <SelectTrigger><SelectValue placeholder="Any potency" /></SelectTrigger>
            <SelectContent>
              {POTENCIES.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="my-5" />

      <div className="flex justify-between items-center">
        <span className="text-sm text-neutral-500">
          {activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? "s" : ""} applied` : "No filters applied"}
        </span>
        <Button
          onClick={onSearch}
          disabled={isLoading}
          className="min-w-32 bg-green-600 hover:bg-green-700"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Searching...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Search className="w-4 h-4" /> Apply & Search
            </span>
          )}
        </Button>
      </div>

      {activeCount > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(filters).map(([key, value]) => {
            if (!value) return null;
            const labels: Record<string, string> = {
              age_group: "Age", gender: "Gender",
              condition_type: "Duration", potency: "Potency"
            };
            return (
              <Badge key={key} variant="outline" className="text-xs">
                {labels[key]}: {value}
              </Badge>
            );
          })}
        </div>
      )}
    </Card>
  );
}
