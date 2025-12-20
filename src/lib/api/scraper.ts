import { supabase } from '@/integrations/supabase/client';

export interface Brand {
  name: string;
  url: string;
}

export interface ProductLink {
  name: string;
  url: string;
}

export interface SkinThroughItem {
  name: string;
  whatItDoes: string;
  irritancy: string;
  comedogenicity: string;
  idRating: string;
}

export interface ScrapedProduct {
  name: string;
  url: string;
  brand: string;
  description: string;
  ingredientsOverview: string;
  keyIngredients: string[];
  otherIngredients: string[];
  skinThrough: SkinThroughItem[];
}

type ScraperResponse<T = unknown> = {
  success: boolean;
  error?: string;
} & T;

export const scraperApi = {
  async getBrands(): Promise<ScraperResponse<{ brands?: Brand[] }>> {
    const { data, error } = await supabase.functions.invoke('incidecoder-scraper', {
      body: { action: 'get-brands' },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  async getBrandProducts(brandUrl: string, limit?: number): Promise<ScraperResponse<{ products?: ProductLink[]; total?: number }>> {
    const { data, error } = await supabase.functions.invoke('incidecoder-scraper', {
      body: { action: 'get-brand-products', brandUrl, limit },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  async scrapeProduct(url: string): Promise<ScraperResponse<{ product?: ScrapedProduct }>> {
    const { data, error } = await supabase.functions.invoke('incidecoder-scraper', {
      body: { action: 'scrape-product', url },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  async mapAllProducts(limit?: number): Promise<ScraperResponse<{ products?: string[]; total?: number }>> {
    const { data, error } = await supabase.functions.invoke('incidecoder-scraper', {
      body: { action: 'map-all-products', limit },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },
};
