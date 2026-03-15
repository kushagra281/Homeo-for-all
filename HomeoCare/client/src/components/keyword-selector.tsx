import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Keyword } from "@shared/schema";

interface KeywordSelectorProps {
  keywords: Keyword[];
  selectedKeywords: string[];
  onKeywordToggle: (keyword: string) => void;
  onFindRemedies: () => void;
}

export function KeywordSelector({ 
  keywords, 
  selectedKeywords, 
  onKeywordToggle, 
  onFindRemedies 
}: KeywordSelectorProps) {
  return (
    <div className="max-w-4xl mx-auto mb-8">
      <h3 className="text-lg font-semibold mb-4">Select Multiple Symptoms for Intelligent Matching</h3>
      <Card className="p-6">
        {selectedKeywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedKeywords.map(keyword => (
              <Badge key={keyword} className="gap-1 py-1 px-3">
                <span>{keyword}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-primary/20 rounded-full"
                  onClick={() => onKeywordToggle(keyword)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {keywords.map(keyword => (
            <Button
              key={keyword.id}
              variant="outline"
              size="sm"
              className={`justify-center transition-colors ${
                selectedKeywords.includes(keyword.name)
                  ? "bg-primary/10 border-primary text-primary"
                  : "hover:bg-muted hover:border-primary/50"
              }`}
              onClick={() => onKeywordToggle(keyword.name)}
            >
              {keyword.name}
            </Button>
          ))}
        </div>
        
        {selectedKeywords.length > 0 && (
          <Button 
            className="mt-4" 
            onClick={onFindRemedies}
          >
            Find Matching Remedies
          </Button>
        )}
      </Card>
    </div>
  );
}
