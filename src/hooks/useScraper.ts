import { useState, useCallback, useRef } from 'react';
import { scraperApi, type ScrapedProduct, type Brand, type ProductLink } from '@/lib/api/scraper';
import type { LogEntry } from '@/components/LogPanel';
import type { PageData, PageBrand } from '@/components/PagesPanel';

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
  const [pages, setPages] = useState<PageData[]>([]);

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

  const startScraping = useCallback(async (startOffset: number, endOffset: number, productLimit?: number) => {
    setIsRunning(true);
    setIsPaused(false);
    pauseRef.current = false;
    abortRef.current = false;
    setProducts([]);
    setLogs([]);
    setPages([]);

    addLog('info', `Starting INCIDecoder scraper for offsets ${startOffset} to ${endOffset}...`);

    try {
      // Phase 1: Fetch all brand pages in the range
      const pageDataList: PageData[] = [];
      
      for (let offset = startOffset; offset <= endOffset; offset++) {
        await waitWhilePaused();
        if (abortRef.current) break;

        setProgress({ 
          current: offset - startOffset + 1, 
          total: endOffset - startOffset + 1, 
          phase: `Fetching brand page ${offset + 1} (offset=${offset})...` 
        });
        addLog('info', `Fetching brand page (offset=${offset})...`);

        const brandsResult = await scraperApi.getBrandsPage(offset);
        
        if (!brandsResult.success) {
          addLog('warning', `Failed to fetch page offset=${offset}: ${brandsResult.error}`);
          continue;
        }

        const pageBrands = brandsResult.brands || [];
        
        if (pageBrands.length === 0) {
          addLog('info', `No brands found on offset=${offset}. Skipping.`);
          continue;
        }

        const pageData: PageData = {
          offset,
          brands: pageBrands.map(b => ({ 
            name: b.name, 
            url: b.url, 
            isScraped: false,
            productCount: 0
          })),
          isComplete: false,
          isCurrentlyProcessing: false,
          products: [],
        };

        pageDataList.push(pageData);
        setPages([...pageDataList]);
        addLog('success', `Offset ${offset}: Found ${pageBrands.length} brands`);
        
        await sleep(300);
      }

      if (abortRef.current) {
        addLog('warning', 'Scraping aborted during page fetching');
        setIsRunning(false);
        return;
      }

      addLog('success', `Loaded ${pageDataList.length} pages with brands`);

      // Phase 2: Process each page - get products and scrape them
      for (let pageIdx = 0; pageIdx < pageDataList.length; pageIdx++) {
        if (abortRef.current) break;

        const currentPage = pageDataList[pageIdx];
        
        // Mark page as currently processing
        pageDataList[pageIdx] = { ...currentPage, isCurrentlyProcessing: true };
        setPages([...pageDataList]);

        addLog('info', `Processing page offset=${currentPage.offset} (${currentPage.brands.length} brands)...`);

        const pageProducts: ScrapedProduct[] = [];

        // Process each brand on this page
        for (let brandIdx = 0; brandIdx < currentPage.brands.length; brandIdx++) {
          await waitWhilePaused();
          if (abortRef.current) break;

          const brand = currentPage.brands[brandIdx];
          
          setProgress({
            current: brandIdx + 1,
            total: currentPage.brands.length,
            phase: `Page ${currentPage.offset + 1}: Scanning brand "${brand.name}" (${brandIdx + 1}/${currentPage.brands.length})`
          });

          addLog('info', `[Page ${currentPage.offset + 1}] Scanning brand "${brand.name}"...`);

          try {
            // Get products for this brand
            const productsResult = await scraperApi.getBrandProducts(brand.url);
            
            if (!productsResult.success || !productsResult.products) {
              addLog('warning', `[Page ${currentPage.offset + 1}] No products for "${brand.name}"`);
              // Mark brand as scraped (attempted)
              currentPage.brands[brandIdx].isScraped = true;
              setPages([...pageDataList]);
              continue;
            }

            const brandProducts = productsResult.products;
            const productsToScrape = productLimit 
              ? brandProducts.slice(0, Math.max(1, Math.floor(productLimit / currentPage.brands.length)))
              : brandProducts;

            addLog('success', `[Page ${currentPage.offset + 1}] "${brand.name}" has ${brandProducts.length} products, scraping ${productsToScrape.length}`);

            // Scrape each product from this brand
            for (let prodIdx = 0; prodIdx < productsToScrape.length; prodIdx++) {
              await waitWhilePaused();
              if (abortRef.current) break;

              const productLink = productsToScrape[prodIdx];

              try {
                const result = await scraperApi.scrapeProduct(productLink.url);
                if (result.success && result.product) {
                  pageProducts.push(result.product);
                  setProducts(prev => [...prev, result.product!]);
                  
                  // Update page products
                  currentPage.products = [...pageProducts];
                  setPages([...pageDataList]);

                  addLog('success', `[Page ${currentPage.offset + 1}] Scraped: "${result.product.name}"`);
                }
              } catch (err) {
                addLog('error', `[Page ${currentPage.offset + 1}] Error scraping "${productLink.name}": ${err}`);
              }

              await sleep(800);
            }

            // Mark brand as scraped
            currentPage.brands[brandIdx].isScraped = true;
            currentPage.brands[brandIdx].productCount = productsToScrape.length;
            setPages([...pageDataList]);

          } catch (err) {
            addLog('error', `[Page ${currentPage.offset + 1}] Error processing "${brand.name}": ${err}`);
          }

          await sleep(300);
        }

        // Mark page as complete
        pageDataList[pageIdx] = {
          ...currentPage,
          isCurrentlyProcessing: false,
          isComplete: true,
          products: pageProducts,
        };
        setPages([...pageDataList]);

        addLog('success', `Page offset=${currentPage.offset} completed! ${pageProducts.length} products scraped.`);
      }

      if (abortRef.current) {
        addLog('warning', 'Scraping aborted');
      } else {
        const totalProducts = pageDataList.reduce((sum, p) => sum + p.products.length, 0);
        addLog('success', `Scraping completed! Total: ${totalProducts} products from ${pageDataList.length} pages`);
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
    setPages([]);
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

  const exportPageToJson = useCallback((offset: number) => {
    const page = pages.find(p => p.offset === offset);
    if (!page || page.products.length === 0) return;

    const data = JSON.stringify(page.products, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incidecoder-offset-${offset}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('success', `Exported ${page.products.length} products from page offset=${offset} to JSON`);
  }, [pages, addLog]);

  return {
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
  };
}
