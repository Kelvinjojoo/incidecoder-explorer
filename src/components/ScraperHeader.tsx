import { Database, Beaker } from 'lucide-react';

export function ScraperHeader() {
  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg gradient-primary shadow-glow">
            <Beaker className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold font-display tracking-tight">
              INCIDecoder Scraper
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Extract product & ingredient data
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
