import { useState } from 'react';
import { ScraperHeader } from '@/components/ScraperHeader';
import { ScraperControls } from '@/components/ScraperControls';
import { StatsCards } from '@/components/StatsCards';
import { ProductsTable } from '@/components/ProductsTable';
import { LogPanel } from '@/components/LogPanel';
import { PagesPanel } from '@/components/PagesPanel';
import { useScraper } from '@/hooks/useScraper';

const Index = () => {
  const [productLimit, setProductLimit] = useState('');
  const [startOffset, setStartOffset] = useState('0');
  const [endOffset, setEndOffset] = useState('5');
  
  const {
    products,
    isRunning,
    isPaused,
    progress,
    logs,
    pages,
    startScraping,
    pauseScraping,
    resetScraping,
    exportToJson,
    exportPageToJson,
  } = useScraper();

  const handleStart = () => {
    const start = parseInt(startOffset, 10) || 0;
    const end = parseInt(endOffset, 10) || 5;
    const limit = productLimit ? parseInt(productLimit, 10) : undefined;
    startScraping(start, end, limit);
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
          startOffset={startOffset}
          onStartOffsetChange={setStartOffset}
          endOffset={endOffset}
          onEndOffsetChange={setEndOffset}
          onStart={handleStart}
          onPause={pauseScraping}
          onReset={resetScraping}
          onExport={exportToJson}
          hasData={products.length > 0}
          progress={progress}
        />

        {/* Stats */}
        <StatsCards products={products} />

        {/* Pages Panel */}
        <PagesPanel pages={pages} onExportPage={exportPageToJson} />

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
