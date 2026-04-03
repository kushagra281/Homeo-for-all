=== CHANGES NEEDED IN remedy-scorer.tsx ===

1. Add import at top (with other imports):
   import { getHealthProfile } from "@/lib/supabase";

2. Add state variable (inside component, with other useState declarations):
   const [healthProfile, setHealthProfile] = useState<Record<string, any> | null>(null);

3. Add useEffect to fetch profile on mount (after existing useEffect):
   useEffect(() => {
     getHealthProfile().then(profile => {
       if (profile) setHealthProfile(profile);
     }).catch(() => {}); // silent fail if not logged in
   }, []);

4. Update submitToAI function — add healthProfile to the fetch body:
   FIND:
     scoreMutation.mutate({ symptoms: allSymptoms, filters: cleanFilters });
   REPLACE WITH:
     scoreMutation.mutate({ symptoms: allSymptoms, filters: cleanFilters, healthProfile });

5. Update scoreMutation mutationFn — add healthProfile to body:
   FIND:
     body: JSON.stringify(data),
   REPLACE WITH:
     body: JSON.stringify({ symptoms: data.symptoms, filters: data.filters, healthProfile: data.healthProfile }),

6. Update scoreMutation type — add healthProfile to the data parameter:
   FIND:
     mutationFn: async (data: { symptoms: string[]; filters: any }) => {
   REPLACE WITH:
     mutationFn: async (data: { symptoms: string[]; filters: any; healthProfile?: Record<string, any> | null }) => {

7. In RESULTS section, add ai_insight display below the description paragraph:
   FIND:
     <p className="text-sm text-gray-600 mb-3">{result.remedy.description}</p>
   ADD AFTER:
     {result.ai_insight && (
       <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mb-3">
         <p className="text-xs text-purple-700">
           <span className="font-semibold">🤖 AI insight:</span> {result.ai_insight}
         </p>
       </div>
     )}

8. If healthProfile has data, show a personalized badge in the results header:
   FIND (in results section, after the h2):
     <p className="text-neutral-500 text-sm">
       Best {topResults.length} matches{activeCategory ? ` for ${activeCategory}` : ""}
     </p>
   REPLACE WITH:
     <p className="text-neutral-500 text-sm">
       Best {topResults.length} matches{activeCategory ? ` for ${activeCategory}` : ""}
     </p>
     {healthProfile && (healthProfile.age || healthProfile.gender || healthProfile.chronic_conditions) && (
       <div className="flex flex-wrap gap-1 mt-1">
         <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
           👤 Personalized for your profile
         </span>
         {healthProfile.chronic_conditions && (
           <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">
             ⚕️ {healthProfile.chronic_conditions}
           </span>
         )}
       </div>
     )}
