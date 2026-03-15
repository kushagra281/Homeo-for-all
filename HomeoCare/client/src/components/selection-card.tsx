import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SelectionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  tags: string[];
  category: string;
  colorScheme: "primary" | "secondary";
}

export default function SelectionCard({ 
  title, 
  description, 
  icon, 
  tags, 
  category, 
  colorScheme 
}: SelectionCardProps) {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    if (category === "symptom-analysis") {
      setLocation("/symptom-analysis");
    } else if (category === "potency-guide") {
      setLocation("/potency-guide");
    } else {
      setLocation(`/remedies/${category}`);
    }
  };

  const colorClasses = {
    primary: {
      iconBg: "bg-gradient-to-br from-primary/10 to-primary/20",
      iconColor: "text-primary",
      hoverBorder: "hover:border-primary/20",
      tagBg: "bg-primary/10",
      tagColor: "text-primary"
    },
    secondary: {
      iconBg: "bg-gradient-to-br from-secondary/10 to-secondary/20",
      iconColor: "text-secondary",
      hoverBorder: "hover:border-secondary/20",
      tagBg: "bg-secondary/10",
      tagColor: "text-secondary"
    }
  };

  const colors = colorClasses[colorScheme];

  return (
    <Card 
      className={`group cursor-pointer bg-white rounded-2xl shadow-lg hover:shadow-xl border-2 border-transparent ${colors.hoverBorder} transition-all duration-300 p-8 text-center hover:-translate-y-1`}
      onClick={handleClick}
    >
      <div className={`w-20 h-20 ${colors.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform`}>
        <span className={colors.iconColor}>{icon}</span>
      </div>
      <h3 className="text-2xl font-semibold text-neutral-900 mb-3">{title}</h3>
      <p className="text-neutral-600 mb-4 leading-relaxed">{description}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {tags.map((tag) => (
          <Badge 
            key={tag} 
            variant="secondary" 
            className={`${colors.tagBg} ${colors.tagColor} hover:${colors.tagBg}`}
          >
            {tag}
          </Badge>
        ))}
      </div>
    </Card>
  );
}
