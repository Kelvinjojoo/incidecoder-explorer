const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SkinThroughItem {
  name: string;
  whatItDoes: string;
  irritancy: string;
  comedogenicity: string;
  idRating: string;
}

interface ScrapedProduct {
  name: string;
  url: string;
  brand: string;
  description: string;
  ingredientsOverview: string;
  ingredientsOverviewCount: number;
  skinThrough: SkinThroughItem[];
  skinThroughIngredientNames: string[];
  skinThroughCount: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, url, brandUrl, limit } = await req.json();
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Action: ${action}, URL: ${url || brandUrl}`);

    // Action: Get all brands from INCIDecoder
    if (action === 'get-brands') {
      console.log('Fetching all brands from INCIDecoder...');
      
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://incidecoder.com/brands',
          formats: ['html', 'links'],
          onlyMainContent: true,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Firecrawl API error:', data);
        return new Response(
          JSON.stringify({ success: false, error: data.error || 'Failed to fetch brands' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract brand links from the response
      const links = data.data?.links || [];
      const brandLinks = links.filter((link: string) => 
        link.includes('/brands/') && !link.endsWith('/brands') && !link.includes('?')
      );

      console.log(`Found ${brandLinks.length} brands`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          brands: brandLinks.map((link: string) => ({
            url: link,
            name: link.split('/brands/')[1]?.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Unknown'
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Get products from a brand
    if (action === 'get-brand-products') {
      if (!brandUrl) {
        return new Response(
          JSON.stringify({ success: false, error: 'Brand URL is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Fetching products for brand: ${brandUrl}`);
      
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: brandUrl,
          formats: ['html', 'links'],
          onlyMainContent: true,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Firecrawl API error:', data);
        return new Response(
          JSON.stringify({ success: false, error: data.error || 'Failed to fetch products' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const links = data.data?.links || [];
      const productLinks = links.filter((link: string) => 
        link.includes('/products/') && !link.includes('?')
      );

      const uniqueProducts = [...new Set(productLinks)] as string[];
      const limitedProducts = limit ? uniqueProducts.slice(0, limit) : uniqueProducts;

      console.log(`Found ${uniqueProducts.length} products, returning ${limitedProducts.length}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          products: limitedProducts.map((link) => ({
            url: link,
            name: link.split('/products/')[1]?.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Unknown'
          })),
          total: uniqueProducts.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Scrape a single product page
    if (action === 'scrape-product') {
      if (!url) {
        return new Response(
          JSON.stringify({ success: false, error: 'Product URL is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Scraping product: ${url}`);
      
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          formats: ['markdown', 'html'],
          onlyMainContent: false, // Get full page for better parsing
          waitFor: 3000, // Wait longer for dynamic content
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Firecrawl API error:', data);
        return new Response(
          JSON.stringify({ success: false, error: data.error || 'Failed to scrape product' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const markdown = data.data?.markdown || '';
      const html = data.data?.html || '';
      const metadata = data.data?.metadata || {};

      // Parse product data from markdown/HTML
      const product = parseProductData(markdown, html, metadata, url);

      console.log(`Successfully scraped product: ${product.name}`);
      
      return new Response(
        JSON.stringify({ success: true, product }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Map all product URLs from INCIDecoder
    if (action === 'map-all-products') {
      console.log('Mapping all product URLs from INCIDecoder...');
      
      const response = await fetch('https://api.firecrawl.dev/v1/map', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://incidecoder.com',
          search: 'products',
          limit: limit || 5000,
          includeSubdomains: false,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Firecrawl API error:', data);
        return new Response(
          JSON.stringify({ success: false, error: data.error || 'Failed to map products' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const links = data.links || [];
      const productLinks = links.filter((link: string) => 
        link.includes('/products/') && !link.includes('?')
      );

      console.log(`Mapped ${productLinks.length} product URLs`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          products: productLinks,
          total: productLinks.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in incidecoder-scraper:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseProductData(markdown: string, html: string, metadata: any, url: string): ScrapedProduct {
  // Extract brand from HTML - look for product-brand-title span with link inside
  let brand = 'Unknown';
  
  // Primary: Extract from product-brand-title span (e.g., <span id="product-brand-title"><a href="/brands/de-latex">De Latex</a></span>)
  const brandTitleMatch = html.match(/<span[^>]*id="product-brand-title"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/span>/i);
  if (brandTitleMatch) {
    brand = brandTitleMatch[1].trim();
  } else {
    // Fallback: Try any link to /brands/
    const htmlBrandMatch = html.match(/<a[^>]*href="\/brands\/[^"]*"[^>]*>([^<]+)<\/a>/i);
    if (htmlBrandMatch) {
      brand = htmlBrandMatch[1].trim();
    }
  }

  // Extract product name from metadata or HTML
  let name = metadata?.title?.replace(' ingredients (Explained)', '').replace(' | INCIDecoder', '').trim() || '';
  
  // Also try to get product title from HTML for better accuracy
  if (!name) {
    const productTitleMatch = html.match(/<span[^>]*id="product-title"[^>]*>([^<]+)<\/span>/i);
    if (productTitleMatch) {
      name = `${brand} ${productTitleMatch[1].trim()}`;
    } else {
      const headingMatch = markdown.match(/^#\s*(.+?)$/m);
      name = headingMatch?.[1]?.trim() || 'Unknown Product';
    }
  }

  // Extract description from product-details span
  let description = '';
  const productDetailsMatch = html.match(/<span[^>]*id="product-details"[^>]*>([^<]*)<\/span>/i);
  if (productDetailsMatch) {
    description = productDetailsMatch[1].trim().replace(/^["'\s]+|["'\s]+$/g, '');
  } else {
    // Fallback: Try italic text or em tag
    const htmlDescMatch = html.match(/<em>([^<]+)<\/em>/i);
    if (htmlDescMatch) {
      description = htmlDescMatch[1].trim();
    }
  }

  // Extract ingredients overview as a list of ingredient names (avoid "more/less" artifacts)
  let ingredientsOverview = '';
  let ingredientsOverviewList: string[] = [];

  const overviewMatch = markdown.match(
    /Ingredients overview\s*\n+([^#]+?)(?=\n\s*(?:Read more|Save to list|Highlights|##))/is
  );

  if (overviewMatch) {
    const overviewRaw = overviewMatch[1]
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Prefer extracting from ingredient links: [Water](https://incidecoder.com/ingredients/water)
    const linkMatches = [...overviewRaw.matchAll(/\[([^\]]+)\]\((?:https?:\/\/)?(?:www\.)?incidecoder\.com\/ingredients\/[^)]+\)\)/gi)];

    if (linkMatches.length > 0) {
      ingredientsOverviewList = linkMatches
        .map((m) => m[1].trim())
        .filter((s) => s.length > 0 && !/^(more|less)$/i.test(s));
    } else {
      // Fallback: strip links and remove "more/less" even when glued to the next word (e.g. "moreAcrylates")
      const cleaned = overviewRaw
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\\?\[|\\?\]/g, '')
        .replace(/more(?=[A-Za-z0-9])/gi, '')
        .replace(/\bless\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      ingredientsOverviewList = cleaned
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }

  ingredientsOverview = ingredientsOverviewList.join(', ');
  const ingredientsOverviewCount = ingredientsOverviewList.length;

  // Extract Skim Through / Skin Through table from HTML (more reliable)
  const skinThrough: SkinThroughItem[] = [];

  // Parse from HTML table - the table has class "ingredtable"
  const tableMatch = html.match(/<table[^>]*class="[^"]*ingredtable[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (tableMatch) {
    const tableHtml = tableMatch[1];
    const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

    for (const rowMatch of rowMatches) {
      const rowHtml = rowMatch[1];

      // Skip header rows
      if (/<th/i.test(rowHtml) || /ingredient\s*name/i.test(rowHtml)) continue;

      const tdMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      if (tdMatches.length === 0) continue;

      const cells = tdMatches.map((m) => htmlCellToText(m[1]));

      const ingredientName = cells[0] || '-';
      const whatItDoes = cells[1] || '-';

      let irrComText = cells[2] || '-';
      let idRating = cells[3] || '-';

      // Some rows can come back with only 3 cells; decide whether the 3rd is ID-Rating or irr/com.
      if (cells.length === 3) {
        if (looksLikeRating(cells[2])) {
          irrComText = '-';
          idRating = cells[2];
        } else {
          irrComText = cells[2];
          idRating = '-';
        }
      }

      const { irritancy, comedogenicity } = parseIrrCom(irrComText);

      skinThrough.push({
        name: ingredientName,
        whatItDoes,
        irritancy,
        comedogenicity,
        idRating: normalizeIdRating(idRating),
      });
    }
  }

  // Fallback: Try to parse from markdown if HTML parsing didn't work
  if (skinThrough.length === 0) {
    const skimSection = markdown.match(
      /Skim through\s*\n+([\s\S]*?)(?=\n\s*##|\n\s*---|\n\s*\*\*[A-Z]|$)/i
    );

    if (skimSection) {
      const tableText = skimSection[1];
      const tableRows = tableText.split('\n').filter((row) => row.includes('|'));

      let dataStarted = false;
      for (const row of tableRows) {
        if (row.match(/^\|[-:\s|]+\|$/)) {
          dataStarted = true;
          continue;
        }

        if (!dataStarted && row.toLowerCase().includes('ingredient')) {
          continue;
        }

        // Keep empty cells to preserve column positions
        const parts = row.split('|').slice(1, -1).map((c) => c.trim());
        if (parts.length < 1) continue;

        const nameCell = cleanMarkdownLinks(parts[0] || '-');
        const whatCell = cleanMarkdownLinks(parts[1] || '-');
        const irrComCell = cleanMarkdownLinks(parts[2] || '-');
        const idCell = cleanMarkdownLinks(parts[3] || '-');

        if (nameCell && nameCell !== '-') {
          const { irritancy, comedogenicity } = parseIrrCom(irrComCell);
          skinThrough.push({
            name: nameCell,
            whatItDoes: whatCell,
            irritancy,
            comedogenicity,
            idRating: normalizeIdRating(idCell),
          });
        }
      }
    }
  }

  // Ensure we include any Ingredients overview items even if the table row has no details
  const normalizedSkinNames = new Set(skinThrough.map((i) => normalizeIngredientName(i.name)));
  for (const ing of ingredientsOverviewList) {
    const norm = normalizeIngredientName(ing);
    if (!norm || normalizedSkinNames.has(norm)) continue;

    skinThrough.push({
      name: ing,
      whatItDoes: '-',
      irritancy: '-',
      comedogenicity: '-',
      idRating: '-',
    });
    normalizedSkinNames.add(norm);
  }

  // Extract ingredient names from skinThrough for comparison
  const skinThroughIngredientNames = skinThrough.map((item) => item.name);
  const skinThroughCount = skinThroughIngredientNames.length;

  return {
    name,
    url,
    brand,
    description,
    ingredientsOverview,
    ingredientsOverviewCount,
    skinThrough,
    skinThroughIngredientNames,
    skinThroughCount,
  };
}

// Helper function to clean markdown links: [Text](url) -> Text
function cleanMarkdownLinks(text: string): string {
  let t = (text ?? '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/\\?\[|\\?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  t = t
    .replace(/\s*,\s*/g, ', ')
    .replace(/(?:,\s*){2,}/g, ', ')
    .replace(/,\s*$/g, '');

  return t || '-';
}

function htmlCellToText(cellHtml: string): string {
  let t = (cellHtml ?? '')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  t = t
    .replace(/\s*,\s*/g, ', ')
    .replace(/(?:,\s*){2,}/g, ', ')
    .replace(/,\s*$/g, '');

  return t || '-';
}

function parseIrrCom(text: string): { irritancy: string; comedogenicity: string } {
  const t = (text ?? '').trim();
  if (!t || t === '-') return { irritancy: '-', comedogenicity: '-' };

  const nums = t.match(/\d+/g);
  if (nums && nums.length >= 2) {
    return { irritancy: nums[0] ?? '-', comedogenicity: nums[1] ?? '-' };
  }
  if (nums && nums.length === 1) {
    return { irritancy: nums[0] ?? '-', comedogenicity: '-' };
  }

  return { irritancy: '-', comedogenicity: '-' };
}

function looksLikeRating(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t || t === '-') return false;
  const lower = t.toLowerCase();
  return ['superstar', 'goodie', 'average', 'badie'].includes(lower);
}

function normalizeIdRating(text: string): string {
  const t = (text ?? '').trim();
  if (!t || t === '-') return '-';

  const lower = t.toLowerCase();
  if (['superstar', 'goodie', 'average', 'badie'].includes(lower)) {
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  return t;
}

function normalizeIngredientName(text: string): string {
  return (text ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
