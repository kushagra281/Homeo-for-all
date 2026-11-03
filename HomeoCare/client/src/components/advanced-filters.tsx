import { useState } from "react";
import { Filter, RotateCcw, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export interface FilterState {
  age_group: string;
  gender: string;
  condition_type: string;
  potency?: string;
}

interface AdvancedFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  onSearch: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const DURATIONS = [
  "1-3 days", "1-3 weeks", "1-3 months",
  "4-8 months", "8-12 months", "More than 1 year"
]

// Age and gender are not asked here: they come from the patient profile.
export default function AdvancedFilters({ onFiltersChange, onSearch, isLoading = false, disabled = false }: AdvancedFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({ age_group: "", gender: "", condition_type: "" })

  const handleChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const reset = () => {
    const empty = { age_group: "", gender: "", condition_type: "" }
    setFilters(empty)
    onFiltersChange(empty)
  }

  const activeCount = Object.values(filters).filter(v => v !== "").length

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={17} className="text-green-600" />
          <h3 className="font-semibold text-gray-800">Advanced Filters</h3>
          {activeCount > 0 && <Badge variant="secondary" className="text-xs">{activeCount} active</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={reset} disabled={activeCount === 0}>
          <RotateCcw size={13} className="mr-1" /> Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Duration */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">⏱️ Duration of Disease</Label>
          <Select value={filters.condition_type} onValueChange={v => handleChange("condition_type", v)}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="How long?" /></SelectTrigger>
            <SelectContent>
              {DURATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">
          {activeCount > 0 ? "Duration added — helps narrow down" : "Next: a few questions about your case"}
        </span>
        <Button onClick={onSearch} disabled={isLoading || disabled} className="bg-green-600 hover:bg-green-700 text-sm">
          {isLoading
            ? <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Searching...</span>
            : <span className="flex items-center gap-2"><Search size={14} /> Apply & Search</span>}
        </Button>
      </div>

      {activeCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(filters).map(([k, v]) => {
            if (!v) return null
            const labels: Record<string, string> = { condition_type: "Duration" }
            return <Badge key={k} variant="outline" className="text-xs">{labels[k]}: {v}</Badge>
          })}
        </div>
      )}
    </Card>
  )
}
