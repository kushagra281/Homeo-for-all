
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Search, Percent } from "lucide-react";
import type { Keyword, Remedy } from "@shared/schema";

interface AdvancedSearchProps {
  onResults: (results: Array<Remedy & { matchScore: number }>) => void;
}

export function AdvancedSearch({ onResults }: AdvancedSearchProps) {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [modalityFilter, setModalityFilter] = useState("");
  const queryClient = useQueryClient();

  const { data: keywords = [] } = useQuery<Keyword[]>({
    queryKey: ["/api/keywords"],
  });

  const searchMutation = useMutation({
    mutationFn: async (data: { symptoms: string[]; filters: any }) => {
      const response = await fetch("/api/remedies/search-advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    onSuccess: (results) => {
      onResults(results);
    },
  });

  const handleSymptomToggle = (symptom: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleAddCustomSymptom = () => {
    if (customSymptom.trim() && !selectedSymptoms.includes(customSymptom.trim())) {
      setSelectedSymptoms(prev => [...prev, customSymptom.trim()]);
      setCustomSymptom("");
    }
  };

  const handleSearch = () => {
    if (selectedSymptoms.length === 0) return;
    
    const filters: any = {};
    if (ageFilter) filters.age = ageFilter;
    if (genderFilter) filters.gender = genderFilter;
    if (modalityFilter) filters.modality = modalityFilter;

    searchMutation.mutate({
      symptoms: selectedSymptoms,
      filters
    });
  };

  const handleClearFilters = () => {
    setSelectedSymptoms([]);
    setAgeFilter("");
    setGenderFilter("");
    setModalityFilter("");
    setCustomSymptom("");
    onResults([]);
  };

  return (
    <Card className="p-6 mb-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Advanced Symptom Search</h3>
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            Clear All
          </Button>
        </div>

        {/* Selected Symptoms */}
        {selectedSymptoms.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Selected Symptoms:</Label>
            <div className="flex flex-wrap gap-2">
              {selectedSymptoms.map(symptom => (
                <Badge key={symptom} variant="secondary" className="gap-1 py-1 px-3">
                  <span>{symptom}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-primary/20 rounded-full"
                    onClick={() => handleSymptomToggle(symptom)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Custom Symptom Input */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Add Custom Symptom:</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Type any symptom..."
              value={customSymptom}
              onChange={(e) => setCustomSymptom(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCustomSymptom()}
            />
            <Button type="button" onClick={handleAddCustomSymptom}>
              Add
            </Button>
          </div>
        </div>

        {/* Predefined Keywords */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Common Symptoms:</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {keywords.slice(0, 18).map(keyword => (
              <Button
                key={keyword.id}
                variant="outline"
                size="sm"
                className={`justify-center transition-colors text-xs ${
                  selectedSymptoms.includes(keyword.name)
                    ? "bg-primary/10 border-primary text-primary"
                    : "hover:bg-muted hover:border-primary/50"
                }`}
                onClick={() => handleSymptomToggle(keyword.name)}
              >
                {keyword.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Age Group:</Label>
            <Select value={ageFilter} onValueChange={setAgeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Any age" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any age</SelectItem>
                <SelectItem value="children">Children</SelectItem>
                <SelectItem value="adults">Adults</SelectItem>
                <SelectItem value="elderly">Elderly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Gender:</Label>
            <Select value={genderFilter} onValueChange={setGenderFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Any gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any gender</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Modality:</Label>
            <Select value={modalityFilter} onValueChange={setModalityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Any modality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any modality</SelectItem>
                <SelectItem value="physical">Physical</SelectItem>
                <SelectItem value="emotional">Emotional</SelectItem>
                <SelectItem value="weather">Weather-related</SelectItem>
                <SelectItem value="trauma">Trauma-related</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Button */}
        <Button 
          className="w-full" 
          onClick={handleSearch}
          disabled={selectedSymptoms.length === 0 || searchMutation.isPending}
        >
          <Search className="h-4 w-4 mr-2" />
          {searchMutation.isPending ? "Searching..." : `Find Matching Remedies (${selectedSymptoms.length} symptoms)`}
        </Button>
      </div>
    </Card>
  );
}
