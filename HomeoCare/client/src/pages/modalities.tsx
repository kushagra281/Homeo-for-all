import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Settings, ThermometerSun, Cloud, Clock, Utensils } from "lucide-react";
import { Link } from "wouter";
import type { Remedy } from "@shared/schema";

interface ModalitySection {
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  modalities: {
    name: string;
    type: "better" | "worse";
    description: string;
    remedies: string[];
  }[];
}

export default function ModalitiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModality, setSelectedModality] = useState<string>("");

  const { data: remedies = [] } = useQuery<Remedy[]>({
    queryKey: ["/api/remedies"],
  });

  // Extract modalities from remedies data
  const modalitySections: ModalitySection[] = [
    {
      title: "Temperature & Weather",
      icon: ThermometerSun,
      color: "orange",
      modalities: [
        {
          name: "Heat",
          type: "worse",
          description: "Symptoms become worse in hot weather or from heat applications",
          remedies: ["Apis Mellifica", "Pulsatilla", "Bryonia Alba"]
        },
        {
          name: "Cold",
          type: "worse", 
          description: "Symptoms worsen in cold weather or from cold applications",
          remedies: ["Arsenicum Album", "Nux Vomica", "Rhus Toxicodendron"]
        },
        {
          name: "Warmth",
          type: "better",
          description: "Symptoms improve with warmth or warm applications",
          remedies: ["Arsenicum Album", "Bryonia Alba", "Nux Vomica"]
        },
        {
          name: "Open Air",
          type: "better",
          description: "Symptoms improve in fresh, open air",
          remedies: ["Pulsatilla", "Aconitum Napellus", "Apis Mellifica"]
        }
      ]
    },
    {
      title: "Time & Periodicity",
      icon: Clock,
      color: "blue",
      modalities: [
        {
          name: "Morning",
          type: "worse",
          description: "Symptoms are worst in the morning hours",
          remedies: ["Bryonia Alba", "Nux Vomica"]
        },
        {
          name: "Evening",
          type: "worse",
          description: "Symptoms worsen in the evening",
          remedies: ["Pulsatilla", "Aconitum Napellus"]
        },
        {
          name: "Night",
          type: "worse",
          description: "Symptoms are worst at night",
          remedies: ["Aconitum Napellus", "Arsenicum Album"]
        }
      ]
    },
    {
      title: "Movement & Position",
      icon: Settings,
      color: "green",
      modalities: [
        {
          name: "Motion",
          type: "better",
          description: "Symptoms improve with gentle movement",
          remedies: ["Rhus Toxicodendron", "Pulsatilla"]
        },
        {
          name: "Rest",
          type: "better",
          description: "Symptoms improve with rest and lying still",
          remedies: ["Bryonia Alba", "Belladonna", "Arnica Montana"]
        },
        {
          name: "Movement",
          type: "worse",
          description: "Any movement makes symptoms worse",
          remedies: ["Bryonia Alba", "Belladonna"]
        },
        {
          name: "First Motion",
          type: "worse",
          description: "Initial movement after rest worsens symptoms",
          remedies: ["Rhus Toxicodendron"]
        }
      ]
    },
    {
      title: "Food & Eating",
      icon: Utensils,
      color: "purple",
      modalities: [
        {
          name: "Rich Foods",
          type: "worse",
          description: "Symptoms worsen after eating rich, fatty foods",
          remedies: ["Pulsatilla", "Nux Vomica"]
        },
        {
          name: "Spicy Foods", 
          type: "worse",
          description: "Hot, spicy foods aggravate symptoms",
          remedies: ["Nux Vomica"]
        },
        {
          name: "Coffee",
          type: "worse",
          description: "Coffee and stimulants worsen symptoms",
          remedies: ["Ignatia Amara", "Nux Vomica"]
        }
      ]
    }
  ];

  const colorClasses = {
    orange: "bg-orange-100 text-orange-600 border-orange-200",
    blue: "bg-blue-100 text-blue-600 border-blue-200", 
    green: "bg-green-100 text-green-600 border-green-200",
    purple: "bg-purple-100 text-purple-600 border-purple-200"
  };

  const filteredSections = modalitySections.map(section => ({
    ...section,
    modalities: section.modalities.filter(modality =>
      modality.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      modality.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      modality.remedies.some(remedy => 
        remedy.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
  })).filter(section => section.modalities.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4 flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Button>
          </Link>
          
          <div className="flex items-center space-x-3 mb-4">
            <div className="h-12 w-12 bg-blue-500 rounded-xl flex items-center justify-center">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">MODALITIES</h1>
              <p className="text-lg text-muted-foreground">Conditions that make symptoms better or worse</p>
            </div>
          </div>
          
          <p className="text-muted-foreground max-w-3xl">
            Modalities are the conditions that modify symptoms - making them better or worse. 
            Understanding modalities is crucial for selecting the right homeopathic remedy, 
            as they help differentiate between similar remedies.
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
                  <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search modalities, conditions, or remedies..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
          />

        {/* Modalities Sections */}
        <div className="space-y-8">
          {filteredSections.map((section, sectionIndex) => (
            <div key={section.title} className="animate-slide-up" style={{ animationDelay: `${sectionIndex * 0.1}s` }}>
              <div className="flex items-center space-x-3 mb-6">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorClasses[section.color as keyof typeof colorClasses]}`}>
                  <section.icon className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">{section.title}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {section.modalities.map((modality, index) => (
                  <Card 
                    key={modality.name}
                    className="p-6 hover:border-primary hover:shadow-lg transition-all duration-300 cursor-pointer"
                    onClick={() => setSelectedModality(selectedModality === modality.name ? "" : modality.name)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-foreground">{modality.name}</h3>
                        <Badge 
                          variant={modality.type === "better" ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {modality.type === "better" ? "Better" : "Worse"}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-4">
                      {modality.description}
                    </p>
                    
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Key Remedies
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {modality.remedies.slice(0, 3).map((remedy, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {remedy}
                          </Badge>
                        ))}
                        {modality.remedies.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{modality.remedies.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {selectedModality === modality.name && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex flex-wrap gap-2">
                          {modality.remedies.map((remedy, i) => (
                            <Link key={i} href={`/remedies?search=${remedy}`}>
                              <Badge className="cursor-pointer hover:bg-primary/80">
                                {remedy}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        {filteredSections.length === 0 && (
          <div className="text-center py-12">
            <div className="h-24 w-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No modalities found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search criteria.
            </p>
            <Button
              variant="outline"
              onClick={() => setSearchQuery("")}
            >
              Clear Search
            </Button>
          </div>
        )}

        {/* Educational Note */}
        <Card className="mt-12 p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="h-8 w-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Settings className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Understanding Modalities</h3>
              <p className="text-sm text-blue-800">
                Modalities are one of the most important aspects of homeopathic remedy selection. 
                They represent the specific conditions that make a person's symptoms better or worse. 
                For example, if your headache improves with cold applications but worsens with movement, 
                these modalities help narrow down the most suitable remedy. Always consider modalities 
                alongside other symptoms when selecting a remedy.
              </p>
            </div>
          </div>
        </Card>
            </div>
          </main>
    </div>    
  );
}
