const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapedProduct {
  name: string;
  url: string;
  brand: string;
  description: string;
  ingredientsOverview: string;
  keyIngredients: string[];
  otherIngredients: string[];
  skinThrough: {
    name: string;
    whatItDoes: string;
    irritancy: string;
    comedogenicity: string;
    idRating: string;
  }[];
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
          onlyMainContent: true,
          waitFor: 2000,
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
  // Extract brand from URL
  const urlParts = url.split('/products/')[1]?.split('-') || [];
  const brandGuess = urlParts[0] || 'Unknown';

  // Extract product name from metadata or markdown
  const name = metadata?.title?.replace(' | INCIDecoder', '').replace(' Ingredients Decoded', '') || 
               markdown.split('\n')[0]?.replace(/^#\s*/, '') || 
               'Unknown Product';

  // Extract description - usually the first paragraph after the title
  const descriptionMatch = markdown.match(/(?:^|\n)([A-Z][^#\n]*(?:\n(?![#\*\-])[^\n]+)*)/);
  const description = descriptionMatch?.[1]?.trim() || '';

  // Extract ingredients overview section
  const overviewMatch = markdown.match(/(?:Ingredients Overview|Key Ingredients Overview|About the ingredients)([\s\S]*?)(?=##|Key Ingredients|$)/i);
  const ingredientsOverview = overviewMatch?.[1]?.trim() || '';

  // Extract key ingredients - look for highlighted/featured ingredients
  const keyIngredientsSection = markdown.match(/(?:Key Ingredients|Featured Ingredients|Star Ingredients)([\s\S]*?)(?=##|Other Ingredients|Full Ingredients|$)/i);
  const keyIngredients: string[] = [];
  if (keyIngredientsSection) {
    const matches = keyIngredientsSection[1].match(/\*\*([^*]+)\*\*|(?:^|\n)-\s*([^\n]+)/g);
    matches?.forEach(m => {
      const clean = m.replace(/\*\*/g, '').replace(/^-\s*/, '').trim();
      if (clean && clean.length > 2) keyIngredients.push(clean);
    });
  }

  // Extract other ingredients
  const otherIngredientsSection = markdown.match(/(?:Other Ingredients|Full Ingredients List|All Ingredients)([\s\S]*?)(?=##|$)/i);
  const otherIngredients: string[] = [];
  if (otherIngredientsSection) {
    const items = otherIngredientsSection[1].split(/[,\n]/);
    items.forEach(item => {
      const clean = item.replace(/\*\*/g, '').replace(/^-\s*/, '').trim();
      if (clean && clean.length > 2 && !keyIngredients.includes(clean)) {
        otherIngredients.push(clean);
      }
    });
  }

  // Extract skin through data - ingredient details table
  const skinThrough: ScrapedProduct['skinThrough'] = [];
  
  // Look for ingredient table patterns in markdown
  const tableMatch = markdown.match(/\|.*Ingredient.*\|[\s\S]*?\n\|[-:\s|]+\n([\s\S]*?)(?=\n\n|\n##|$)/i);
  if (tableMatch) {
    const rows = tableMatch[1].split('\n').filter(r => r.includes('|'));
    rows.forEach(row => {
      const cells = row.split('|').filter(c => c.trim());
      if (cells.length >= 2) {
        skinThrough.push({
          name: cells[0]?.trim() || '',
          whatItDoes: cells[1]?.trim() || '',
          irritancy: cells[2]?.trim() || '-',
          comedogenicity: cells[3]?.trim() || '-',
          idRating: cells[4]?.trim() || '-',
        });
      }
    });
  }

  // If no table found, try to extract from list format
  if (skinThrough.length === 0) {
    const ingredientListMatch = markdown.match(/(?:Ingredient Analysis|Ingredient Details)([\s\S]*?)(?=##|$)/i);
    if (ingredientListMatch) {
      const items = ingredientListMatch[1].match(/\*\*([^*]+)\*\*[:\s-]+([^\n]+)/g);
      items?.forEach(item => {
        const match = item.match(/\*\*([^*]+)\*\*[:\s-]+(.+)/);
        if (match) {
          skinThrough.push({
            name: match[1].trim(),
            whatItDoes: match[2].trim(),
            irritancy: '-',
            comedogenicity: '-',
            idRating: '-',
          });
        }
      });
    }
  }

  return {
    name,
    url,
    brand: brandGuess.replace(/\b\w/g, l => l.toUpperCase()),
    description,
    ingredientsOverview,
    keyIngredients: keyIngredients.slice(0, 10),
    otherIngredients: otherIngredients.slice(0, 50),
    skinThrough: skinThrough.slice(0, 30),
  };
}
