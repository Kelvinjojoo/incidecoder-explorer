import { Card } from '@/components/ui/card';
import { Package, Sparkles, FlaskConical } from 'lucide-react';
import type { ScrapedProduct } from '@/lib/api/scraper';

interface StatsCardsProps {
  products: ScrapedProduct[];
}

export function StatsCards({ products }: StatsCardsProps) {
  const totalProducts = products.length;
  const uniqueBrands = new Set(products.map((p) => p.brand)).size;
  const totalIngredients = products.reduce((sum, p) => sum + p.skinThroughCount, 0);

  const stats = [
    {
      label: 'Products Scraped',
      value: totalProducts.toLocaleString(),
      icon: Package,
      color: 'text-primary',
    },
    {
      label: 'Unique Brands',
      value: uniqueBrands.toLocaleString(),
      icon: Sparkles,
      color: 'text-accent',
    },
    {
      label: 'Total Ingredients',
      value: totalIngredients.toLocaleString(),
      icon: FlaskConical,
      color: 'text-success',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat, i) => (
        <Card
          key={stat.label}
          className="p-4 bg-card/80 backdrop-blur-sm border-border/50 shadow-sm animate-slide-up"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold font-mono mt-1">{stat.value}</p>
            </div>
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
          </div>
        </Card>
      ))}
    </div>
  );
}
