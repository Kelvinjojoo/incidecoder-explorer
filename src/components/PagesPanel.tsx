import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ChevronDown, ChevronRight, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface PageBrand {
  name: string;
  url: string;
  isScraped: boolean;
  productCount?: number;
}

export interface PageData {
  offset: number;
  brands: PageBrand[];
  isComplete: boolean;
  isCurrentlyProcessing: boolean;
  products: any[];
}

interface PagesPanelProps {
  pages: PageData[];
  onExportPage: (offset: number) => void;
}

export function PagesPanel({ pages, onExportPage }: PagesPanelProps) {
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set());

  const togglePage = (offset: number) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      if (next.has(offset)) {
        next.delete(offset);
      } else {
        next.add(offset);
      }
      return next;
    });
  };

  if (pages.length === 0) {
    return (
      <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50">
        <p className="text-muted-foreground text-center">No pages loaded yet. Start scraping to see pages.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-card/80 backdrop-blur-sm border-border/50 max-h-[600px] overflow-y-auto">
      <h3 className="font-semibold text-lg mb-4">Pages / Offsets</h3>
      <div className="space-y-2">
        {pages.map((page) => {
          const isExpanded = expandedPages.has(page.offset);
          const scrapedCount = page.brands.filter(b => b.isScraped).length;
          const totalBrands = page.brands.length;
          
          return (
            <div key={page.offset} className="border border-border/50 rounded-lg overflow-hidden">
              {/* Page Header */}
              <div 
                className={cn(
                  "flex items-center justify-between p-3 cursor-pointer transition-colors",
                  page.isComplete ? "bg-emerald-500/10" : page.isCurrentlyProcessing ? "bg-primary/10" : "bg-muted/30",
                  "hover:bg-muted/50"
                )}
                onClick={() => togglePage(page.offset)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-mono font-medium">Page {page.offset + 1}</span>
                  <span className="text-muted-foreground text-sm">(offset={page.offset})</span>
                  
                  {page.isCurrentlyProcessing && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary ml-2" />
                  )}
                  {page.isComplete && (
                    <Check className="h-4 w-4 text-emerald-500 ml-2" />
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="font-mono">
                    {scrapedCount}/{totalBrands} brands
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    {page.products.length} products
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page.products.length === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportPage(page.offset);
                    }}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                </div>
              </div>
              
              {/* Expanded Brand List */}
              {isExpanded && (
                <div className="p-3 bg-background/50 border-t border-border/30">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {page.brands.map((brand, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "px-2 py-1 rounded text-xs truncate transition-colors",
                          brand.isScraped 
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                            : "bg-muted/50 text-muted-foreground border border-border/30"
                        )}
                        title={brand.name}
                      >
                        {brand.isScraped && <Check className="inline h-3 w-3 mr-1" />}
                        {brand.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
