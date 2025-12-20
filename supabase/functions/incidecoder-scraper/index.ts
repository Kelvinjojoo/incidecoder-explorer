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
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Extract Key Ingredients with categories
  const keyIngredients: KeyIngredientCategory[] = [];
  const keySection = markdown.match(/Key Ingredients\s*\n+([\s\S]*?)(?=\n\s*(?:Show all ingredients|Other Ingredients|##|$))/i);
  
  if (keySection) {
    const keyText = keySection[1];
    // Parse lines that have category pattern: **[Category](link):** or [Category](link):
    // Format: [Skin-identical ingredient](url): [Glycerol](url)
    const lines = keyText.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      // Match pattern: [Category](url): ingredients
      const categoryMatch = line.match(/\[([^\]]+)\]\([^)]+\)\s*:\s*(.+)/);
      if (categoryMatch) {
        const category = categoryMatch[1].trim();
        const ingredientsStr = categoryMatch[2].trim();
        // Extract ingredient names from markdown links
        const ingredients = extractIngredientNames(ingredientsStr);
        if (ingredients.length > 0) {
          keyIngredients.push({ category, ingredients });
        }
      } else {
        // Try bold format: **Category:** ingredients
        const boldMatch = line.match(/\*\*([^*:]+):\*\*\s*(.+)/);
        if (boldMatch) {
          const category = boldMatch[1].trim();
          const ingredients = extractIngredientNames(boldMatch[2].trim());
          if (ingredients.length > 0) {
            keyIngredients.push({ category, ingredients });
          }
        }
      }
    }
  }

  // Extract Other Ingredients with categories
  const otherIngredients: OtherIngredientCategory[] = [];
  const otherSection = markdown.match(/Other Ingredients\s*\n+([\s\S]*?)(?=\n\s*(?:Skim through|Skim Through|##|$))/i);
  
  if (otherSection) {
    const otherText = otherSection[1];
    const lines = otherText.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      // Match pattern: [Category](url): ingredients
      const categoryMatch = line.match(/\[([^\]]+)\]\([^)]+\)\s*:\s*(.+)/);
      if (categoryMatch) {
        const category = categoryMatch[1].trim();
        const ingredientsStr = categoryMatch[2].trim();
        const ingredients = extractIngredientNames(ingredientsStr);
        if (ingredients.length > 0) {
          otherIngredients.push({ category, ingredients });
        }
      } else {
        // Try bold format: **Category:** ingredients
        const boldMatch = line.match(/\*\*([^*:]+):\*\*\s*(.+)/);
        if (boldMatch) {
          const category = boldMatch[1].trim();
          const ingredients = extractIngredientNames(boldMatch[2].trim());
          if (ingredients.length > 0) {
            otherIngredients.push({ category, ingredients });
          }
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
          name: cleanMarkdownLinks(cells[0] || ''),
          whatItDoes: cleanMarkdownLinks(cells[1] || ''),
          irritancy: cleanMarkdownLinks(cells[2] || '-'),
          comedogenicity: cleanMarkdownLinks(cells[3] || '-'),
          idRating: cleanMarkdownLinks(cells[4] || '-'),
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
          .map(m => m[1].replace(/<[^>]+>/g, '').replace(/<br\s*\/?>/gi, ', ').trim());
        
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

// Helper function to extract ingredient names from a string with markdown links
function extractIngredientNames(text: string): string[] {
  // Extract names from markdown links [Name](url) and plain text
  const names: string[] = [];
  
  // First extract all [Name](url) patterns
  const linkMatches = text.matchAll(/\[([^\]]+)\]\([^)]+\)/g);
  for (const match of linkMatches) {
    const name = match[1].trim();
    if (name && !name.toLowerCase().includes('more') && name.length > 1) {
      names.push(name);
    }
  }
  
  // If no links found, split by comma and clean
  if (names.length === 0) {
    const parts = text.split(/,\s*/);
    for (const part of parts) {
      const cleaned = part.replace(/\[([^\]]+)\][^,]*/g, '$1').trim();
      if (cleaned && cleaned.length > 1) {
        names.push(cleaned);
      }
    }
  }
  
  return names;
}

// Helper function to clean markdown links: [Text](url) -> Text
function cleanMarkdownLinks(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/\\?\[|\\?\]/g, '')
    .trim();
}
