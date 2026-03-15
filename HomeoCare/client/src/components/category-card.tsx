import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import type { Category } from "@shared/schema";

interface CategoryCardProps {
  category: Category;
  icon: LucideIcon;
}

const colorClasses = {
  red: "bg-red-100 group-hover:bg-red-200 text-red-600",
  blue: "bg-blue-100 group-hover:bg-blue-200 text-blue-600",
  purple: "bg-purple-100 group-hover:bg-purple-200 text-purple-600",
  green: "bg-green-100 group-hover:bg-green-200 text-green-600",
  orange: "bg-orange-100 group-hover:bg-orange-200 text-orange-600",
  pink: "bg-pink-100 group-hover:bg-pink-200 text-pink-600",
  indigo: "bg-indigo-100 group-hover:bg-indigo-200 text-indigo-600",
  yellow: "bg-yellow-100 group-hover:bg-yellow-200 text-yellow-600",
  teal: "bg-teal-100 group-hover:bg-teal-200 text-teal-600",
  cyan: "bg-cyan-100 group-hover:bg-cyan-200 text-cyan-600",
  violet: "bg-violet-100 group-hover:bg-violet-200 text-violet-600",
  lime: "bg-lime-100 group-hover:bg-lime-200 text-lime-600",
  gray: "bg-gray-100 group-hover:bg-gray-200 text-gray-600",
};

const badgeColorClasses = {
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  green: "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-700",
  pink: "bg-pink-100 text-pink-700",
  indigo: "bg-indigo-100 text-indigo-700",
  yellow: "bg-yellow-100 text-yellow-700",
  teal: "bg-teal-100 text-teal-700",
  cyan: "bg-cyan-100 text-cyan-700",
  violet: "bg-violet-100 text-violet-700",
  lime: "bg-lime-100 text-lime-700",
  gray: "bg-gray-100 text-gray-700",
};

export function CategoryCard({ category, icon: Icon }: CategoryCardProps) {
  const iconColorClass = colorClasses[category.color as keyof typeof colorClasses] || colorClasses.blue;
  const badgeColorClass = badgeColorClasses[category.color as keyof typeof badgeColorClasses] || badgeColorClasses.blue;

  return (
    <Link href={`/category/${category.name}`}>
      <Card className="group p-6 hover:border-primary hover:shadow-lg transition-all duration-300 cursor-pointer animate-slide-up">
        <div className="flex items-start space-x-4">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${iconColorClass}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {category.displayName}
            </h4>
            <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
            <span className={`inline-block mt-3 text-xs px-2 py-1 rounded-full ${badgeColorClass}`}>
              {category.remedyCount} remedies
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
