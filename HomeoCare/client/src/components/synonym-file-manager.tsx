
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Download, AlertCircle, CheckCircle } from "lucide-react";

export function SynonymFileManager() {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [jsonContent, setJsonContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<"file" | "text">("file");
  const queryClient = useQueryClient();

  const uploadSynonymsMutation = useMutation({
    mutationFn: async (synonymData: any) => {
      const response = await fetch("/api/admin/synonyms/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ synonyms: synonymData }),
      });
      if (!response.ok) throw new Error("Failed to upload synonyms");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      setUploadFile(null);
      setJsonContent("");
      setShowPreview(false);
    },
  });

  const downloadCurrentSynonymsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/synonyms/export");
      if (!response.ok) throw new Error("Failed to export synonyms");
      return response.json();
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "current_synonyms.json";
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/json") {
      setUploadFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          setJsonContent(JSON.stringify(parsed, null, 2));
          setShowPreview(true);
        } catch (error) {
          alert("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    } else {
      alert("Please select a valid JSON file");
    }
  };

  const handleTextInput = () => {
    try {
      const parsed = JSON.parse(jsonContent);
      setShowPreview(true);
    } catch (error) {
      alert("Invalid JSON format");
    }
  };

  const handleUploadSynonyms = () => {
    try {
      const synonymData = JSON.parse(jsonContent);
      uploadSynonymsMutation.mutate(synonymData);
    } catch (error) {
      alert("Invalid JSON format");
    }
  };

  const previewData = showPreview ? JSON.parse(jsonContent) : null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Synonym File Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Upload a new synonym file to override existing synonyms. This will update all keywords with the new synonym mappings.
          </AlertDescription>
        </Alert>

        {/* Download Current Synonyms */}
        <div className="space-y-2">
          <Label>Export Current Synonyms</Label>
          <Button
            onClick={() => downloadCurrentSynonymsMutation.mutate()}
            disabled={downloadCurrentSynonymsMutation.isPending}
            variant="outline"
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Current Synonym File
          </Button>
        </div>

        {/* Upload Method Selection */}
        <div className="space-y-3">
          <Label>Upload Method</Label>
          <div className="flex gap-4">
            <Button
              variant={uploadMethod === "file" ? "default" : "outline"}
              onClick={() => setUploadMethod("file")}
            >
              Upload File
            </Button>
            <Button
              variant={uploadMethod === "text" ? "default" : "outline"}
              onClick={() => setUploadMethod("text")}
            >
              Paste JSON
            </Button>
          </div>
        </div>

        {/* File Upload */}
        {uploadMethod === "file" && (
          <div className="space-y-2">
            <Label htmlFor="synonym-file">Select Synonym JSON File</Label>
            <Input
              id="synonym-file"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {/* Text Input */}
        {uploadMethod === "text" && (
          <div className="space-y-2">
            <Label htmlFor="synonym-json">Paste JSON Content</Label>
            <Textarea
              id="synonym-json"
              value={jsonContent}
              onChange={(e) => setJsonContent(e.target.value)}
              placeholder='{"headache": ["pain in head", "migraine"], ...}'
              rows={8}
            />
            <Button onClick={handleTextInput} variant="outline">
              Preview JSON
            </Button>
          </div>
        )}

        {/* Preview */}
        {showPreview && previewData && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Preview - Found {Object.keys(previewData).length} symptom categories:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto">
                {Object.entries(previewData).map(([symptom, synonyms]) => (
                  <div key={symptom} className="text-sm">
                    <strong>{symptom}:</strong>
                    <ul className="ml-4 text-muted-foreground">
                      {(synonyms as string[]).map((synonym, idx) => (
                        <li key={idx}>• {synonym}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleUploadSynonyms}
                disabled={uploadSynonymsMutation.isPending}
                className="flex-1"
              >
                {uploadSynonymsMutation.isPending ? (
                  "Updating Synonyms..."
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Apply Synonym Updates
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreview(false);
                  setJsonContent("");
                  setUploadFile(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {uploadSynonymsMutation.isSuccess && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Synonyms have been successfully updated! Keywords now include the new synonym mappings.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
