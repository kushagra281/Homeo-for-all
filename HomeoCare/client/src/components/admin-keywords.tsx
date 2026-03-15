
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save, X, Plus } from "lucide-react";
import { SynonymFileManager } from "./synonym-file-manager";
import type { Keyword } from "@shared/schema";

export function AdminKeywords() {
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null);
  const [editingSynonyms, setEditingSynonyms] = useState<string[]>([]);
  const [newSynonym, setNewSynonym] = useState("");
  const queryClient = useQueryClient();

  const { data: keywords = [] } = useQuery<Keyword[]>({
    queryKey: ["/api/keywords"],
  });

  const updateSynonymsMutation = useMutation({
    mutationFn: async ({ keywordId, synonyms }: { keywordId: string; synonyms: string[] }) => {
      const response = await fetch(`/api/keywords/${keywordId}/synonyms`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ synonyms }),
      });
      if (!response.ok) throw new Error("Failed to update synonyms");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      setEditingKeyword(null);
      setEditingSynonyms([]);
    },
  });

  const handleEditKeyword = (keyword: Keyword) => {
    setEditingKeyword(keyword.id);
    setEditingSynonyms([...keyword.synonyms]);
  };

  const handleSaveSynonyms = (keywordId: string) => {
    updateSynonymsMutation.mutate({
      keywordId,
      synonyms: editingSynonyms,
    });
  };

  const handleAddSynonym = () => {
    if (newSynonym.trim() && !editingSynonyms.includes(newSynonym.trim())) {
      setEditingSynonyms(prev => [...prev, newSynonym.trim()]);
      setNewSynonym("");
    }
  };

  const handleRemoveSynonym = (synonym: string) => {
    setEditingSynonyms(prev => prev.filter(s => s !== synonym));
  };

  const handleCancelEdit = () => {
    setEditingKeyword(null);
    setEditingSynonyms([]);
    setNewSynonym("");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Keyword Synonym Management</h2>
      <p className="text-muted-foreground">
        Manage synonyms for keywords to improve search accuracy and matching.
      </p>

      <SynonymFileManager />

      <div className="grid gap-4">
        {keywords.map(keyword => (
          <Card key={keyword.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{keyword.name}</h3>
                  <p className="text-sm text-muted-foreground">Category: {keyword.category}</p>
                </div>
                {editingKeyword !== keyword.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditKeyword(keyword)}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>

              {editingKeyword === keyword.id ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Synonyms:</Label>
                    <div className="flex flex-wrap gap-2">
                      {editingSynonyms.map(synonym => (
                        <Badge key={synonym} variant="secondary" className="gap-1">
                          <span>{synonym}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 hover:bg-destructive/20 rounded-full"
                            onClick={() => handleRemoveSynonym(synonym)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Add new synonym..."
                      value={newSynonym}
                      onChange={(e) => setNewSynonym(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSynonym()}
                    />
                    <Button type="button" onClick={handleAddSynonym}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSaveSynonyms(keyword.id)}
                      disabled={updateSynonymsMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Current Synonyms:</Label>
                  <div className="flex flex-wrap gap-2">
                    {keyword.synonyms.length > 0 ? (
                      keyword.synonyms.map(synonym => (
                        <Badge key={synonym} variant="outline">
                          {synonym}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No synonyms defined</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
