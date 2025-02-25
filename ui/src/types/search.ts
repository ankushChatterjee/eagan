export interface SearchResponse {
  query: string;
  search_results: SearchResult[];
  summary: string;
  suggestions: string[];
}

export interface SearchResult {
  title: string;
  url: string;
  is_source_local: boolean;
  is_source_both: boolean;
  description: string;
  page_age: string;
  profile: {
    name: string;
    url: string;
    long_name: string;
    img: string;
  };
  language: string;
  family_friendly: boolean;
  type: string;
  subtype: string;
  is_live: boolean;
  meta_url: {
    scheme: string;
    netloc: string;
    hostname: string;
    favicon: string;
    path: string;
  };
  thumbnail?: {
    src: string;
    original: string;
    logo: boolean;
  };
  age?: string;
}