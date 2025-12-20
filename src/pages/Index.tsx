import { useState } from 'react';
import { ScraperHeader } from '@/components/ScraperHeader';
import { ScraperControls } from '@/components/ScraperControls';
import { StatsCards } from '@/components/StatsCards';
import { ProductsTable } from '@/components/ProductsTable';
import { LogPanel } from '@/components/LogPanel';
import { useScraper } from '@/hooks/useScraper';

const Index = () => {
  const [productLimit, setProductLimit] = useState('');
  const {
    products,
    isRunning,
    isPaused,
    progress,
    logs,
    startScraping,
    pauseScraping,
    resetScraping,
    exportToJson,
  } = useScraper();

  const handleStart = () => {
    const limit = productLimit ? parseInt(productLimit, 10) : undefined;
    startScraping(limit);
  };

  return (
    <div className="min-h-screen bg-background gradient-surface">
      {/* Background glow effect */}
      <div className="fixed inset-0 gradient-glow pointer-events-none" />

      <ScraperHeader />

      <main className="container mx-auto px-4 py-8 space-y-6 relative">
        {/* Controls */}
        <ScraperControls
          isRunning={isRunning}
          isPaused={isPaused}
          productLimit={productLimit}
          onProductLimitChange={setProductLimit}
          onStart={handleStart}
          onPause={pauseScraping}
          onReset={resetScraping}
          onExport={exportToJson}
          hasData={products.length > 0}
          progress={progress}
        />

        {/* Stats */}
        <StatsCards products={products} />

        {/* Main content grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Products Table - takes 2 cols */}
          <div className="lg:col-span-2">
            <ProductsTable products={products} />
          </div>

          {/* Log Panel */}
          <div className="lg:col-span-1">
            <LogPanel logs={logs} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
