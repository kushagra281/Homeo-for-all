import Header from "@/components/header";
import SelectionCard from "@/components/selection-card";
import SearchSection from "../components/search-section";
import { Brain, Heart, Eye, Ear, Stethoscope, Activity, Zap, Users } from "lucide-react";
import { BODY_SYSTEMS } from "@shared/schema";

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">Homeopathic Remedy Finder</h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Search by keyword or explore by body system for personalized homeopathic guidance and natural remedies.
          </p>
        </div>

        <SearchSection />

        <div className="text-center mb-8 mt-16">
          <h3 className="text-2xl font-bold text-neutral-900 mb-4">Advanced Diagnostic Tools</h3>
          <p className="text-neutral-600 max-w-xl mx-auto">
            Use our AI-powered tools for precise remedy selection and personalized dosing guidance.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <SelectionCard
            title="Symptom Analysis"
            description="AI-powered remedy scoring based on your specific symptoms with percentage-based matching"
            icon={<Activity className="text-2xl" />}
            tags={["AI Scoring", "Percentage Match", "Filters"]}
            category="symptom-analysis"
            colorScheme="primary"
          />
          
          <SelectionCard
            title="Potency Guide"
            description="Interactive dosing guide with personalized potency and frequency recommendations"
            icon={<Users className="text-2xl" />}
            tags={["Dosing", "Potency", "Safety"]}
            category="potency-guide"
            colorScheme="secondary"
          />
        </div>

        <div className="text-center mb-8 mt-16">
          <h3 className="text-2xl font-bold text-neutral-900 mb-4">Browse by Body System</h3>
          <p className="text-neutral-600 max-w-xl mx-auto">
            Explore remedies organized by different body systems and conditions.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <SelectionCard
            title="Mind"
            description="Mental, emotional conditions, anxiety, stress, depression"
            icon={<Brain className="text-2xl" />}
            tags={["Anxiety", "Stress", "Depression"]}
            category="mind"
            colorScheme="primary"
          />
          
          <SelectionCard
            title="Head"
            description="Headaches, migraines, tension, dizziness"
            icon={<Heart className="text-2xl" />}
            tags={["Headaches", "Migraines", "Dizziness"]}
            category="head"
            colorScheme="secondary"
          />

          <SelectionCard
            title="Eyes"
            description="Eye conditions, vision problems, inflammation"
            icon={<Eye className="text-2xl" />}
            tags={["Vision", "Inflammation", "Irritation"]}
            category="eyes"
            colorScheme="primary"
          />

          <SelectionCard
            title="Ears"
            description="Hearing issues, ear infections, tinnitus"
            icon={<Ear className="text-2xl" />}
            tags={["Hearing", "Infections", "Tinnitus"]}
            category="ears"
            colorScheme="secondary"
          />

          <SelectionCard
            title="Respiratory System"
            description="Chest, lungs, breathing, cough conditions"
            icon={<Stethoscope className="text-2xl" />}
            tags={["Breathing", "Cough", "Chest"]}
            category="respiratory system (chest)"
            colorScheme="primary"
          />

          <SelectionCard
            title="Nervous System"
            description="Nerve conditions, neurological symptoms"
            icon={<Zap className="text-2xl" />}
            tags={["Nerves", "Neurological", "Tingling"]}
            category="nervous system"
            colorScheme="secondary"
          />
        </div>

        <div className="text-center mb-8">
          <h4 className="text-xl font-semibold text-neutral-900 mb-4">All Body Systems Available</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-4xl mx-auto">
            {BODY_SYSTEMS.map((system) => (
              <div
                key={system}
                className="bg-white rounded-lg p-3 shadow-sm border border-neutral-200 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => window.location.href = `/remedies/${system.toLowerCase()}`}
              >
                <span className="text-sm text-neutral-700 font-medium">{system}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-neutral-200 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-neutral-500 mb-4 flex items-center justify-center gap-2">
              <span className="text-amber-500">⚠️</span>
              This app provides educational information only. Always consult healthcare professionals for medical advice.
            </p>
            <div className="flex justify-center space-x-6 text-sm text-neutral-400">
              <a href="#" className="hover:text-neutral-600">Privacy Policy</a>
              <a href="#" className="hover:text-neutral-600">Terms of Service</a>
              <a href="#" className="hover:text-neutral-600">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
