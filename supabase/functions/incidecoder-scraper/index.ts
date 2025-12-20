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

  // Extract ingredients overview and clean up - remove markdown links, keep only ingredient names
  let ingredientsOverview = '';
  const overviewMatch = markdown.match(/Ingredients overview\s*\n+([^#]+?)(?=\n\s*(?:Read more|Save to list|Highlights|Key Ingredients|##))/is);
  if (overviewMatch) {
    ingredientsOverview = overviewMatch[1].trim()
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      // Remove markdown links: [Text](url) -> Text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove any remaining brackets or escaped brackets
      .replace(/\\?\[|\\?\]/g, '')
      // Remove "more" and "less" artifacts
      .replace(/\bmore\b/gi, '')
      .replace(/\bless\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Count ingredients in overview (split by comma)
  const ingredientsOverviewList = ingredientsOverview
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
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
      const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(m => {
          // Extract text content, handling links and br tags
          let text = m[1];
          // Extract link text
          text = text.replace(/<a[^>]*>([^<]*)<\/a>/g, '$1');
          // Replace br tags with comma
          text = text.replace(/<br\s*\/?>/gi, ', ');
          // Remove all other HTML tags
          text = text.replace(/<[^>]+>/g, '');
          // Clean up whitespace
          text = text.replace(/\s+/g, ' ').trim();
          return text || '-';
        });
      
      // Skip header row
      if (cells[0]?.toLowerCase().includes('ingredient name')) continue;
      if (cells.length < 2) continue;
      
      // Table columns: Ingredient name | what-it-does | irr., com. | ID-Rating
      // Note: irr., com. is a SINGLE column with both values
      const ingredientName = cells[0] || '-';
      const whatItDoes = cells[1] || '-';
      const irrCom = cells[2] || '-';
      const idRating = cells[3] || '-';
      
      // Parse irr., com. column - it contains "0, 0" or just a single value or "-"
      let irritancy = '-';
      let comedogenicity = '-';
      
      if (irrCom && irrCom !== '-') {
        const parts = irrCom.split(',').map(s => s.trim());
        if (parts.length >= 2) {
          irritancy = parts[0] || '-';
          comedogenicity = parts[1] || '-';
        } else {
          irritancy = parts[0] || '-';
        }
      }
      
      skinThrough.push({
        name: ingredientName,
        whatItDoes: whatItDoes,
        irritancy: irritancy,
        comedogenicity: comedogenicity,
        idRating: idRating,
      });
    }
  }
  
  // Fallback: Try to parse from markdown if HTML parsing didn't work
  if (skinThrough.length === 0) {
    // Look for the full Skim through section (not stopping at [more])
    const skimSection = markdown.match(/Skim through\s*\n+([\s\S]*?)(?=\n\s*##|\n\s*---|\n\s*\*\*[A-Z]|$)/i);
    
    if (skimSection) {
      const tableText = skimSection[1];
      
      // Try to parse markdown table
      const tableRows = tableText.split('\n').filter(row => row.includes('|'));
      
      // Skip header rows
      let dataStarted = false;
      for (const row of tableRows) {
        // Skip separator row
        if (row.match(/^\|[-:\s|]+\|$/)) {
          dataStarted = true;
          continue;
        }
        
        if (!dataStarted && row.toLowerCase().includes('ingredient')) {
          continue; // Skip header
        }
        
        const cells = row.split('|').map(c => c.trim()).filter(c => c);
        
        if (cells.length >= 2) {
          const irrCom = cleanMarkdownLinks(cells[2] || '-');
          let irritancy = '-';
          let comedogenicity = '-';
          
          if (irrCom && irrCom !== '-') {
            const parts = irrCom.split(',').map(s => s.trim());
            if (parts.length >= 2) {
              irritancy = parts[0] || '-';
              comedogenicity = parts[1] || '-';
            } else {
              irritancy = parts[0] || '-';
            }
          }
          
          skinThrough.push({
            name: cleanMarkdownLinks(cells[0] || ''),
            whatItDoes: cleanMarkdownLinks(cells[1] || ''),
            irritancy: irritancy,
            comedogenicity: comedogenicity,
            idRating: cleanMarkdownLinks(cells[3] || '-'),
          });
        }
      }
    }
  }

  // Extract ingredient names from skinThrough for comparison
  const skinThroughIngredientNames = skinThrough.map(item => item.name);
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
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/\\?\[|\\?\]/g, '')
    .trim();
}
