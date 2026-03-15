import { Leaf, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-neutral-200">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
              <Leaf className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">HomeoWell</h1>
              <p className="text-sm text-neutral-500">Natural Healing Guide</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-neutral-700">
            <UserCircle className="text-xl" />
          </Button>
        </div>
      </div>
    </header>
  );
}
