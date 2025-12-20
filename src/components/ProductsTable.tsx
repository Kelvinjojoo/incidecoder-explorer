import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ExternalLink, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import type { ScrapedProduct } from '@/lib/api/scraper';

interface ProductsTableProps {
  products: ScrapedProduct[];
}

export function ProductsTable({ products }: ProductsTableProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<ScrapedProduct | null>(null);
  const perPage = 20;

  const filtered = products.filter((p) => {
    const searchLower = search.toLowerCase();
    
    return (
      p.name.toLowerCase().includes(searchLower) ||
      p.brand.toLowerCase().includes(searchLower) ||
      p.ingredientsOverview.toLowerCase().includes(searchLower) ||
      p.skinThroughIngredientNames.some((i) => i.toLowerCase().includes(searchLower))
    );
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-md overflow-hidden">
        {/* Search Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products, brands, or ingredients..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 bg-background/50"
            />
          </div>
          <Badge variant="secondary" className="font-mono">
            {filtered.length.toLocaleString()} products
          </Badge>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="font-semibold">Product</TableHead>
                <TableHead className="font-semibold">Brand</TableHead>
                <TableHead className="font-semibold text-center">Overview Count</TableHead>
                <TableHead className="font-semibold text-center">Skim Through</TableHead>
                <TableHead className="font-semibold w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    {products.length === 0
                      ? 'No products scraped yet. Click "Start Scraping" to begin.'
                      : 'No products match your search.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((product, idx) => (
                  <TableRow
                    key={product.url + idx}
                    className="border-border/30 hover:bg-muted/30 transition-colors animate-slide-up"
                    style={{ animationDelay: `${idx * 20}ms` }}
                  >
                    <TableCell className="font-medium max-w-[250px]">
                      <div className="truncate" title={product.name}>
                        {product.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {product.brand}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {product.ingredientsOverviewCount}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {product.skinThroughCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setSelectedProduct(product)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          asChild
                        >
                          <a href={product.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border/50 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Product Detail Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(85vh-100px)] pr-4">
            {selectedProduct && (
              <div className="space-y-6">
                <div>
                  <Badge>{selectedProduct.brand}</Badge>
                  <a
                    href={selectedProduct.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View on INCIDecoder <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {selectedProduct.description && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">
                      Description
                    </h4>
                    <p className="text-sm">{selectedProduct.description}</p>
                  </div>
                )}

                {selectedProduct.ingredientsOverview && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">
                      Ingredients Overview ({selectedProduct.ingredientsOverviewCount} ingredients)
                    </h4>
                    <p className="text-sm font-mono text-muted-foreground">{selectedProduct.ingredientsOverview}</p>
                  </div>
                )}

                {selectedProduct.skinThroughIngredientNames.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">
                      Skim Through Ingredient Names ({selectedProduct.skinThroughCount} ingredients)
                    </h4>
                    <p className="text-sm font-mono text-muted-foreground">
                      {selectedProduct.skinThroughIngredientNames.join(', ')}
                    </p>
                  </div>
                )}

                {selectedProduct.skinThrough.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">
                      Skim Through Analysis
                    </h4>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs">Ingredient</TableHead>
                            <TableHead className="text-xs">What It Does</TableHead>
                            <TableHead className="text-xs text-center">IRR.</TableHead>
                            <TableHead className="text-xs text-center">COM.</TableHead>
                            <TableHead className="text-xs text-center">ID Rating</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedProduct.skinThrough.map((item, i) => (
                            <TableRow key={i} className="text-sm">
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-muted-foreground">{item.whatItDoes}</TableCell>
                              <TableCell className="text-center font-mono">{item.irritancy}</TableCell>
                              <TableCell className="text-center font-mono">{item.comedogenicity}</TableCell>
                              <TableCell className="text-center font-mono">{item.idRating}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
