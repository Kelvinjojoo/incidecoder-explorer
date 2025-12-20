import { useState, useCallback, useRef } from 'react';
import { scraperApi, type ScrapedProduct, type Brand, type ProductLink } from '@/lib/api/scraper';
import type { LogEntry } from '@/components/LogPanel';

interface Progress {
  current: number;
  total: number;
  phase: string;
}

export function useScraper() {
  const [products, setProducts] = useState<ScrapedProduct[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 0, phase: 'Idle' });
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const pauseRef = useRef(false);
  const abortRef = useRef(false);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    const log: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      message,
    };
    setLogs((prev) => [...prev.slice(-500), log]);
  }, []);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitWhilePaused = async () => {
    while (pauseRef.current && !abortRef.current) {
      await sleep(200);
    }
  };

  const startScraping = useCallback(async (limit?: number) => {
    setIsRunning(true);
    setIsPaused(false);
    pauseRef.current = false;
    abortRef.current = false;
    setProducts([]);
    setLogs([]);

    addLog('info', 'Starting INCIDecoder scraper...');

    try {
      // Phase 1: Get all brands from all pages
      setProgress({ current: 0, total: 0, phase: 'Fetching brand pages...' });
      addLog('info', 'Fetching all brands from INCIDecoder (all pages)...');

      const allBrands: Brand[] = [];
      let pageOffset = 0;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore && !abortRef.current) {
        await waitWhilePaused();
        if (abortRef.current) break;

        pageCount++;
        setProgress({ current: pageCount, total: 0, phase: `Fetching brand page ${pageCount} (offset=${pageOffset})...` });
        addLog('info', `Fetching brand page ${pageCount} (offset=${pageOffset})...`);

        const brandsResult = await scraperApi.getBrandsPage(pageOffset);
        
        if (!brandsResult.success) {
          addLog('warning', `Failed to fetch page ${pageCount}: ${brandsResult.error}`);
          break;
        }

        const pageBrands = brandsResult.brands || [];
        
        if (pageBrands.length === 0) {
          addLog('info', `No more brands found on page ${pageCount}. Total pages: ${pageCount - 1}`);
          hasMore = false;
        } else {
          allBrands.push(...pageBrands);
          addLog('success', `Page ${pageCount}: Found ${pageBrands.length} brands (Total: ${allBrands.length})`);
          pageOffset++;
          
          // Rate limiting between page fetches
          await sleep(500);
        }
      }

      if (abortRef.current) {
        addLog('warning', 'Scraping aborted during brand fetching');
        setIsRunning(false);
        return;
      }

      // Deduplicate brands by URL
      const uniqueBrands = [...new Map(allBrands.map(b => [b.url, b])).values()];
      addLog('success', `Total unique brands found: ${uniqueBrands.length} from ${pageCount - 1} pages`);

      // Phase 2: Get products from each brand
      setProgress({ current: 0, total: uniqueBrands.length, phase: 'Discovering products...' });
      addLog('info', `Starting to scan ${uniqueBrands.length} brands for products...`);
      
      const allProductUrls: ProductLink[] = [];
      const pendingBrands = [...uniqueBrands];
      
      for (let i = 0; i < uniqueBrands.length; i++) {
        await waitWhilePaused();
        if (abortRef.current) break;

        const brand = uniqueBrands[i];
        const remaining = pendingBrands.length - 1;
        setProgress({ 
          current: i + 1, 
          total: uniqueBrands.length, 
          phase: `Scanning brand ${i + 1}/${uniqueBrands.length}: ${brand.name}` 
        });
        addLog('info', `[${i + 1}/${uniqueBrands.length}] Scanning "${brand.name}" (${remaining} brands remaining)...`);

        try {
          const productsResult = await scraperApi.getBrandProducts(brand.url);
          if (productsResult.success && productsResult.products) {
            allProductUrls.push(...productsResult.products);
            addLog('success', `[${i + 1}/${uniqueBrands.length}] Found ${productsResult.products.length} products from "${brand.name}"`);
          } else {
            addLog('warning', `[${i + 1}/${uniqueBrands.length}] No products found for "${brand.name}"`);
          }
        } catch (err) {
          addLog('warning', `[${i + 1}/${uniqueBrands.length}] Failed to scan "${brand.name}": ${err}`);
        }

        pendingBrands.shift();

        // Rate limiting
        await sleep(500);
      }

      if (abortRef.current) {
        addLog('warning', 'Scraping aborted during product discovery');
        setIsRunning(false);
        return;
      }

      // Deduplicate and limit products
      const uniqueUrls = [...new Map(allProductUrls.map(p => [p.url, p])).values()];
      const productsToScrape = limit ? uniqueUrls.slice(0, limit) : uniqueUrls;

      addLog('info', `Total unique products discovered: ${uniqueUrls.length}. Will scrape: ${productsToScrape.length}`);

      // Phase 3: Scrape each product
      setProgress({ current: 0, total: productsToScrape.length, phase: 'Scraping products...' });

      for (let i = 0; i < productsToScrape.length; i++) {
        await waitWhilePaused();
        if (abortRef.current) break;

        const product = productsToScrape[i];
        const remaining = productsToScrape.length - i - 1;
        setProgress({ 
          current: i + 1, 
          total: productsToScrape.length, 
          phase: `Scraping product ${i + 1}/${productsToScrape.length}: ${product.name}` 
        });

        try {
          const result = await scraperApi.scrapeProduct(product.url);
          if (result.success && result.product) {
            setProducts((prev) => [...prev, result.product!]);
            addLog('success', `[${i + 1}/${productsToScrape.length}] Scraped: "${result.product.name}" (Brand: ${result.product.brand}) - ${remaining} products remaining`);
          } else {
            addLog('warning', `[${i + 1}/${productsToScrape.length}] Failed to scrape: "${product.name}"`);
          }
        } catch (err) {
          addLog('error', `[${i + 1}/${productsToScrape.length}] Error scraping "${product.name}": ${err}`);
        }

        // Rate limiting - be respectful
        await sleep(1000);
      }

      if (abortRef.current) {
        addLog('warning', 'Scraping aborted');
      } else {
        addLog('success', `Scraping completed! Total products scraped: ${productsToScrape.length}`);
      }

    } catch (error) {
      addLog('error', `Scraping failed: ${error}`);
    } finally {
      setIsRunning(false);
      setProgress((prev) => ({ ...prev, phase: 'Completed' }));
    }
  }, [addLog]);

  const pauseScraping = useCallback(() => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(pauseRef.current);
    addLog('info', pauseRef.current ? 'Scraping paused' : 'Scraping resumed');
  }, [addLog]);

  const resetScraping = useCallback(() => {
    abortRef.current = true;
    pauseRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    setProducts([]);
    setProgress({ current: 0, total: 0, phase: 'Idle' });
    setLogs([]);
  }, []);

  const exportToJson = useCallback(() => {
    const data = JSON.stringify(products, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incidecoder-products-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('success', `Exported ${products.length} products to JSON`);
  }, [products, addLog]);

  return {
    products,
    isRunning,
    isPaused,
    progress,
    logs,
    startScraping,
    pauseScraping,
    resetScraping,
    exportToJson,
  };
}
