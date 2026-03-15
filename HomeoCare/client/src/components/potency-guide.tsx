import { useState } from "react";
import { Info, Clock, Users, AlertTriangle, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { POTENCIES, AGE_GROUPS } from "@shared/schema";

interface PotencyGuideProps {
  selectedRemedy?: string;
  onClose?: () => void;
}

interface DoseRecommendation {
  potency: string;
  frequency: string;
  duration: string;
  notes: string;
  suitability: string[];
}

export default function PotencyGuide({ selectedRemedy, onClose }: PotencyGuideProps) {
  const [selectedPotency, setSelectedPotency] = useState("30C");
  const [ageGroup, setAgeGroup] = useState("adult");
  const [conditionType, setConditionType] = useState("acute");
  const [showCustomDose, setShowCustomDose] = useState(false);

  const potencyInfo = {
    "6C": {
      name: "6C (Low Potency)",
      description: "Gentle, frequent dosing for physical symptoms",
      uses: ["Physical symptoms", "Chronic conditions", "Sensitive individuals", "Children"],
      frequency: "3-4 times daily",
      duration: "Several weeks",
      color: "bg-green-100 text-green-800"
    },
    "12C": {
      name: "12C (Low-Medium Potency)", 
      description: "Balanced potency for mixed symptoms",
      uses: ["General symptoms", "Mild to moderate conditions", "Regular maintenance"],
      frequency: "2-3 times daily",
      duration: "2-4 weeks",
      color: "bg-blue-100 text-blue-800"
    },
    "30C": {
      name: "30C (Medium Potency)",
      description: "Most commonly used potency, good for acute conditions",
      uses: ["Acute symptoms", "First aid", "Mental-emotional symptoms", "Most conditions"],
      frequency: "1-3 times daily",
      duration: "1-2 weeks",
      color: "bg-purple-100 text-purple-800"
    },
    "200C": {
      name: "200C (High Potency)",
      description: "Strong, deep-acting for constitutional treatment",
      uses: ["Constitutional treatment", "Deep chronic conditions", "Strong mental symptoms"],
      frequency: "Once daily or less",
      duration: "Weeks to months",
      color: "bg-orange-100 text-orange-800"
    },
    "1M": {
      name: "1M (Very High Potency)",
      description: "Constitutional prescribing by professionals",
      uses: ["Constitutional treatment", "Very chronic conditions", "Professional use"],
      frequency: "Weekly or less frequent",
      duration: "Months",
      color: "bg-red-100 text-red-800"
    },
    "10M": {
      name: "10M (Ultra High Potency)",
      description: "Professional constitutional prescribing only",
      uses: ["Deep constitutional work", "Professional prescribers only"],
      frequency: "Monthly or less",
      duration: "Months to years",
      color: "bg-gray-100 text-gray-800"
    }
  };

  const getDoseRecommendation = (): DoseRecommendation => {
    const potency = potencyInfo[selectedPotency as keyof typeof potencyInfo];
    
    let frequency = potency.frequency;
    let duration = potency.duration;
    let notes = "";
    
    // Adjust for age group
    if (ageGroup === "child") {
      frequency = frequency.replace(/\d+/g, (match) => Math.max(1, parseInt(match) - 1).toString());
      notes += "Reduced frequency for children. ";
    } else if (ageGroup === "senior") {
      notes += "Monitor response carefully in seniors. ";
    }
    
    // Adjust for condition type
    if (conditionType === "acute") {
      if (selectedPotency === "6C" || selectedPotency === "12C") {
        frequency = "Every 15-30 minutes initially, then reduce as improvement occurs";
        duration = "Few days to 1 week";
      } else if (selectedPotency === "30C") {
        frequency = "Every 30 minutes to 2 hours initially, then reduce";
        duration = "Few days";
      }
      notes += "For acute conditions, reduce frequency as symptoms improve. ";
    } else if (conditionType === "chronic") {
      frequency = "Once daily or less frequent";
      duration = "Weeks to months";
      notes += "For chronic conditions, wait for complete response before repeating. ";
    }
    
    return {
      potency: selectedPotency,
      frequency,
      duration,
      notes,
      suitability: potency.uses
    };
  };

  const recommendation = getDoseRecommendation();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Potency Guide & Dose Selector</h2>
            <p className="text-neutral-600">
              {selectedRemedy ? `Dosing guide for ${selectedRemedy}` : "Interactive homeopathic dosing guide"}
            </p>
          </div>
          {onClose && (
            <Button variant="outline" onClick={onClose}>Close</Button>
          )}
        </div>

        <Tabs defaultValue="guide" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="guide">Potency Guide</TabsTrigger>
            <TabsTrigger value="selector">Dose Selector</TabsTrigger>
            <TabsTrigger value="safety">Safety & Tips</TabsTrigger>
          </TabsList>

          <TabsContent value="guide" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(potencyInfo).map(([potency, info]) => (
                <Card 
                  key={potency} 
                  className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedPotency === potency ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedPotency(potency)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className={info.color}>{potency}</Badge>
                      {selectedPotency === potency && <CheckCircle className="w-4 h-4 text-primary" />}
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-sm">{info.name}</h4>
                      <p className="text-xs text-neutral-600 mt-1">{info.description}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3" />
                        <span>{info.frequency}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Users className="w-3 h-3" />
                        <span>{info.duration}</span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium mb-1">Best for:</p>
                      <div className="flex flex-wrap gap-1">
                        {info.uses.slice(0, 2).map((use) => (
                          <Badge key={use} variant="outline" className="text-xs">
                            {use}
                          </Badge>
                        ))}
                        {info.uses.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{info.uses.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="selector" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="age-selector">Age Group</Label>
                <Select value={ageGroup} onValueChange={setAgeGroup}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_GROUPS.map(age => (
                      <SelectItem key={age} value={age}>
                        {age.charAt(0).toUpperCase() + age.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="condition-selector">Condition Type</Label>
                <Select value={conditionType} onValueChange={setConditionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acute">Acute (Recent onset)</SelectItem>
                    <SelectItem value="chronic">Chronic (Long-term)</SelectItem>
                    <SelectItem value="constitutional">Constitutional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="potency-selector">Potency</Label>
                <Select value={selectedPotency} onValueChange={setSelectedPotency}>
                  <SelectTrigger>
                    <SelectValue />
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

            <Card className="p-6 bg-gradient-to-r from-primary/5 to-secondary/5">
              <h3 className="text-lg font-semibold mb-4">Personalized Dose Recommendation</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Recommended Potency</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={potencyInfo[selectedPotency as keyof typeof potencyInfo].color}>
                        {recommendation.potency}
                      </Badge>
                      <span className="text-lg font-semibold">
                        {potencyInfo[selectedPotency as keyof typeof potencyInfo].name}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Frequency</Label>
                    <p className="text-sm mt-1">{recommendation.frequency}</p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Duration</Label>
                    <p className="text-sm mt-1">{recommendation.duration}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Administration</Label>
                    <p className="text-sm mt-1">
                      3 pellets under tongue, let dissolve completely. 
                      Avoid eating/drinking 15 minutes before and after.
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Special Notes</Label>
                    <p className="text-sm mt-1">{recommendation.notes || "Follow standard dosing guidelines."}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <Label className="text-sm font-medium">This potency is suitable for:</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {recommendation.suitability.map((use) => (
                    <Badge key={use} variant="secondary" className="text-xs">
                      {use}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="safety" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold">Do's</h4>
                </div>
                <ul className="space-y-2 text-sm">
                  <li>• Store remedies away from strong odors</li>
                  <li>• Take on empty stomach when possible</li>
                  <li>• Let pellets dissolve under tongue</li>
                  <li>• Stop when symptoms improve</li>
                  <li>• Keep a symptom diary</li>
                  <li>• Consult a professional for chronic conditions</li>
                </ul>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h4 className="font-semibold">Don'ts</h4>
                </div>
                <ul className="space-y-2 text-sm">
                  <li>• Don't touch pellets with hands</li>
                  <li>• Don't use mint products nearby</li>
                  <li>• Don't repeat if improvement occurs</li>
                  <li>• Don't use multiple remedies simultaneously</li>
                  <li>• Don't exceed recommended potencies</li>
                  <li>• Don't ignore worsening symptoms</li>
                </ul>
              </Card>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> This guide is for educational purposes only. 
                For serious conditions, chronic illnesses, or if you're unsure about dosing, 
                always consult with a qualified homeopathic practitioner or healthcare provider.
              </AlertDescription>
            </Alert>

            <Card className="p-4">
              <h4 className="font-semibold mb-3">When to Seek Professional Help</h4>
              <ul className="space-y-1 text-sm">
                <li>• Symptoms persist or worsen after 3-7 days</li>
                <li>• You're dealing with serious or emergency conditions</li>
                <li>• You need constitutional treatment</li>
                <li>• You're unsure about remedy selection</li>
                <li>• You want to use high potencies (200C+)</li>
                <li>• You're pregnant, nursing, or treating infants</li>
              </ul>
            </Card>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
