const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KeyIngredientCategory {
  category: string;
  ingredients: string[];
}

interface OtherIngredientCategory {
  category: string;
  ingredients: string[];
}

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
  keyIngredients: KeyIngredientCategory[];
  otherIngredients: OtherIngredientCategory[];
  skinThrough: SkinThroughItem[];
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
  // Extract brand from page content - usually in the first lines
  // Pattern: Brand name appears before product name, often as a link or header
  let brand = 'Unknown';
  
  // Try to find brand from markdown - usually appears at the top
  // Format: "[Brand Name](/brands/brand-name)" or just "Brand Name" before product title
  const brandLinkMatch = markdown.match(/\[([^\]]+)\]\(\/brands\/[^)]+\)/);
  if (brandLinkMatch) {
    brand = brandLinkMatch[1].trim();
  } else {
    // Try from HTML - look for brand link
    const htmlBrandMatch = html.match(/<a[^>]*href="\/brands\/[^"]*"[^>]*>([^<]+)<\/a>/i);
    if (htmlBrandMatch) {
      brand = htmlBrandMatch[1].trim();
    } else {
      // Fallback: extract from URL
      const urlParts = url.split('/products/')[1]?.split('-') || [];
      brand = urlParts[0]?.replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
    }
  }

  // Extract product name from metadata or markdown
  let name = metadata?.title?.replace(' ingredients (Explained)', '').replace(' | INCIDecoder', '').trim() || '';
  
  // If name starts with brand, that's fine - keep the full name
  if (!name) {
    // Try to get from first heading in markdown
    const headingMatch = markdown.match(/^#\s*(.+?)$/m);
    name = headingMatch?.[1]?.trim() || 'Unknown Product';
  }

  // Extract description - the italic text after the product name
  let description = '';
  const descMatch = markdown.match(/\*([^*]+(?:sensitive skin|cleansing|moisturiz|hydrat|skin)[^*]*)\*/i);
  if (descMatch) {
    description = descMatch[1].trim();
  } else {
    // Try to find description from HTML
    const htmlDescMatch = html.match(/<em>([^<]+)<\/em>/i);
    if (htmlDescMatch) {
      description = htmlDescMatch[1].trim();
    }
  }

  // Extract ingredients overview - the full comma-separated list
  let ingredientsOverview = '';
  const overviewMatch = markdown.match(/Ingredients overview\s*\n+([^#]+?)(?=\n\s*(?:Read more|Save to list|Highlights|Key Ingredients|##))/is);
  if (overviewMatch) {
    ingredientsOverview = overviewMatch[1].trim()
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Extract Key Ingredients with categories
  const keyIngredients: KeyIngredientCategory[] = [];
  const keySection = markdown.match(/Key Ingredients\s*\n+([\s\S]*?)(?=\n\s*(?:Show all ingredients|Other Ingredients|##|$))/i);
  
  if (keySection) {
    const keyText = keySection[1];
    // Parse categories like "Skin-identical ingredient:", "Soothing:", etc.
    const categoryMatches = keyText.matchAll(/\*\*([^*:]+):\*\*\s*([^\n*]+(?:\n(?!\*\*)[^\n*]+)*)/g);
    
    for (const match of categoryMatches) {
      const category = match[1].trim();
      const ingredientsStr = match[2].trim();
      // Split by comma and clean up
      const ingredients = ingredientsStr
        .split(/,\s*/)
        .map(i => i.replace(/\[([^\]]+)\][^,]*/g, '$1').trim())
        .filter(i => i.length > 0);
      
      if (ingredients.length > 0) {
        keyIngredients.push({ category, ingredients });
      }
    }
    
    // Also try non-bold format
    if (keyIngredients.length === 0) {
      const altMatches = keyText.matchAll(/([A-Za-z-]+(?:\s+[a-z]+)?)\s*:\s*([^\n]+)/g);
      for (const match of altMatches) {
        const category = match[1].trim();
        const ingredientsStr = match[2].trim();
        const ingredients = ingredientsStr
          .split(/,\s*/)
          .map(i => i.replace(/\[([^\]]+)\][^,]*/g, '$1').trim())
          .filter(i => i.length > 0);
        
        if (ingredients.length > 0) {
          keyIngredients.push({ category, ingredients });
        }
      }
    }
  }

  // Extract Other Ingredients with categories
  const otherIngredients: OtherIngredientCategory[] = [];
  const otherSection = markdown.match(/Other Ingredients\s*\n+([\s\S]*?)(?=\n\s*(?:Skim through|Skim Through|##|$))/i);
  
  if (otherSection) {
    const otherText = otherSection[1];
    // Parse categories
    const categoryMatches = otherText.matchAll(/\*\*([^*:]+):\*\*\s*([^\n*]+(?:\n(?!\*\*)[^\n*]+)*)/g);
    
    for (const match of categoryMatches) {
      const category = match[1].trim();
      const ingredientsStr = match[2].trim();
      const ingredients = ingredientsStr
        .split(/,\s*/)
        .map(i => i.replace(/\[([^\]]+)\][^,]*/g, '$1').trim())
        .filter(i => i.length > 0);
      
      if (ingredients.length > 0) {
        otherIngredients.push({ category, ingredients });
      }
    }
    
    // Also try non-bold format
    if (otherIngredients.length === 0) {
      const altMatches = otherText.matchAll(/([A-Za-z/]+(?:\s+[a-z]+)?)\s*:\s*([^\n]+)/g);
      for (const match of altMatches) {
        const category = match[1].trim();
        const ingredientsStr = match[2].trim();
        const ingredients = ingredientsStr
          .split(/,\s*/)
          .map(i => i.replace(/\[([^\]]+)\][^,]*/g, '$1').trim())
          .filter(i => i.length > 0);
        
        if (ingredients.length > 0) {
          otherIngredients.push({ category, ingredients });
        }
      }
    }
  }

  // Extract Skim Through / Skin Through table
  const skinThrough: SkinThroughItem[] = [];
  
  // Look for the Skim through section with table
  const skimSection = markdown.match(/Skim through\s*\n+([\s\S]*?)(?=\n\s*(?:\[more\]|##|$))/i);
  
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
        skinThrough.push({
          name: cells[0] || '',
          whatItDoes: cells[1] || '',
          irritancy: cells[2] || '-',
          comedogenicity: cells[3] || '-',
          idRating: cells[4] || '-',
        });
      }
    }
  }
  
  // Alternative: Try to parse from HTML table if markdown parsing didn't work
  if (skinThrough.length === 0) {
    const tableMatch = html.match(/<table[^>]*class="[^"]*ingredtable[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
    if (tableMatch) {
      const tableHtml = tableMatch[1];
      const rowMatches = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      
      for (const rowMatch of rowMatches) {
        const rowHtml = rowMatch[1];
        const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
          .map(m => m[1].replace(/<[^>]+>/g, '').trim());
        
        // Skip header row
        if (cells[0]?.toLowerCase().includes('ingredient name')) continue;
        
        if (cells.length >= 2) {
          skinThrough.push({
            name: cells[0] || '',
            whatItDoes: cells[1] || '',
            irritancy: cells[2] || '-',
            comedogenicity: cells[3] || '-', 
            idRating: cells[4] || '-',
          });
        }
      }
    }
  }
  
  // If still no skim through data, try to extract from ingredient list in markdown
  if (skinThrough.length === 0) {
    // Try to find ingredient entries with what-it-does info
    const ingredientMatches = markdown.matchAll(/\[([^\]]+)\]\([^)]+\)\s*([a-z/,\s]+)(?:\s*(\d+,\s*\d+))?\s*(\w+)?/gi);
    
    for (const match of ingredientMatches) {
      const name = match[1].trim();
      const whatItDoes = match[2].trim();
      const irrCom = match[3]?.trim() || '-';
      const rating = match[4]?.trim() || '-';
      
      if (name && whatItDoes && !name.toLowerCase().includes('more')) {
        const [irr, com] = irrCom.split(',').map(s => s.trim());
        skinThrough.push({
          name,
          whatItDoes,
          irritancy: irr || '-',
          comedogenicity: com || '-',
          idRating: rating,
        });
      }
    }
  }

  return {
    name,
    url,
    brand,
    description,
    ingredientsOverview,
    keyIngredients,
    otherIngredients,
    skinThrough,
  };
}
