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
      // Phase 1: Get all brands
      setProgress({ current: 0, total: 0, phase: 'Fetching brands...' });
      addLog('info', 'Fetching all brands from INCIDecoder...');

      const brandsResult = await scraperApi.getBrands();
      if (!brandsResult.success || !brandsResult.brands) {
        throw new Error(brandsResult.error || 'Failed to fetch brands');
      }

      const brands = brandsResult.brands;
      addLog('success', `Found ${brands.length} brands`);

      // Phase 2: Get products from each brand
      setProgress({ current: 0, total: brands.length, phase: 'Discovering products...' });
      
      const allProductUrls: ProductLink[] = [];
      
      for (let i = 0; i < brands.length; i++) {
        await waitWhilePaused();
        if (abortRef.current) break;

        const brand = brands[i];
        setProgress({ current: i + 1, total: brands.length, phase: `Scanning brand: ${brand.name}` });
        addLog('info', `Scanning ${brand.name}...`);

        try {
          const productsResult = await scraperApi.getBrandProducts(brand.url);
          if (productsResult.success && productsResult.products) {
            allProductUrls.push(...productsResult.products);
            addLog('success', `Found ${productsResult.products.length} products from ${brand.name}`);
          }
        } catch (err) {
          addLog('warning', `Failed to scan ${brand.name}`);
        }

        // Rate limiting
        await sleep(500);
      }

      if (abortRef.current) {
        addLog('warning', 'Scraping aborted');
        setIsRunning(false);
        return;
      }

      // Deduplicate and limit products
      const uniqueUrls = [...new Map(allProductUrls.map(p => [p.url, p])).values()];
      const productsToScrape = limit ? uniqueUrls.slice(0, limit) : uniqueUrls;

      addLog('info', `Total unique products: ${uniqueUrls.length}. Scraping: ${productsToScrape.length}`);

      // Phase 3: Scrape each product
      setProgress({ current: 0, total: productsToScrape.length, phase: 'Scraping products...' });

      for (let i = 0; i < productsToScrape.length; i++) {
        await waitWhilePaused();
        if (abortRef.current) break;

        const product = productsToScrape[i];
        setProgress({ current: i + 1, total: productsToScrape.length, phase: `Scraping: ${product.name}` });

        try {
          const result = await scraperApi.scrapeProduct(product.url);
          if (result.success && result.product) {
            setProducts((prev) => [...prev, result.product!]);
            addLog('success', `Scraped: ${result.product.name} (Brand: ${result.product.brand})`);
          } else {
            addLog('warning', `Failed to scrape: ${product.name}`);
          }
        } catch (err) {
          addLog('error', `Error scraping ${product.name}: ${err}`);
        }

        // Rate limiting - be respectful
        await sleep(1000);
      }

      if (abortRef.current) {
        addLog('warning', 'Scraping aborted');
      } else {
        addLog('success', 'Scraping completed!');
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
