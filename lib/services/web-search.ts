export interface WebSearchConfig {
  apiKey: string;
  maxResults: number;
  timeout: number;
  cacheDuration: number;
}

export interface WebSearchSource {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface WebSearchResult {
  content: string;
  sources: WebSearchSource[];
  answer?: string;
}

interface SearchCache {
  query: string;
  result: WebSearchResult;
  timestamp: number;
}

export class WebSearchService {
  private apiKey: string;
  private searchCache: Map<string, SearchCache> = new Map();
  private config: WebSearchConfig;

  constructor(config: WebSearchConfig) {
    this.config = config;
    this.apiKey = config.apiKey;
    if (!this.apiKey) {
      throw new Error("Tavily API key is required for web search");
    }
  }

  private getCacheKey(query: string): string {
    return query.toLowerCase().trim();
  }

  private getCachedResult(query: string): WebSearchResult | null {
    const key = this.getCacheKey(query);
    const cached = this.searchCache.get(key);

    if (
      cached &&
      Date.now() - cached.timestamp < this.config.cacheDuration
    ) {
      console.log("📋 Using cached web search result");
      return cached.result;
    }

    return null;
  }

  private setCachedResult(query: string, result: WebSearchResult): void {
    const key = this.getCacheKey(query);
    this.searchCache.set(key, {
      query: key,
      result,
      timestamp: Date.now(),
    });
  }

  async search(query: string, retryCount = 0): Promise<WebSearchResult> {
    // Check cache first
    const cached = this.getCachedResult(query);
    if (cached) return cached;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout,
      );

      const payload = {
        api_key: this.apiKey,
        query,
        search_depth: "advanced",
        max_results: this.config.maxResults,
        include_answer: true,
        include_raw_content: false,
        include_domains: [],
        exclude_domains: [],
      };

      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");

        // Handle rate limiting
        if (res.status === 429) {
          console.log("⏳ Rate limited, waiting before retry...");
          await new Promise((resolve) => setTimeout(resolve, 5000));
          if (retryCount < 2) {
            return this.search(query, retryCount + 1);
          }
        }

        throw new Error(
          `Web search failed: ${res.status} ${res.statusText}. ${errorText}`,
        );
      }

      const data = await res.json().catch(() => null);
      if (!data) {
        throw new Error("No results from web search");
      }

      const result = this.parseTavilyResponse(data);

      // Cache successful result
      this.setCachedResult(query, result);

      return result;
    } catch (error: any) {
      if (error.name === "AbortError") {
        if (retryCount < 1) {
          console.log("⏱️ Search timed out, retrying...");
          return this.search(query, retryCount + 1);
        }
        throw new Error("Web search timed out. Please try again.");
      }
      throw error;
    }
  }

  private parseTavilyResponse(data: any): WebSearchResult {
    const sources: WebSearchSource[] = [];
    let answer: string | undefined;

    // Extract AI-generated answer
    if (
      data.answer &&
      typeof data.answer === "string" &&
      data.answer.trim().length > 0
    ) {
      answer = data.answer.trim();
    }

    // Extract detailed results
    if (Array.isArray(data.results) && data.results.length > 0) {
      const results = data.results.slice(0, this.config.maxResults);

      for (const r of results) {
        sources.push({
          title: r.title || "Untitled",
          url: r.url || "",
          content: (r.content || r.snippet || "").slice(0, 500),
          score: r.score ? Number((r.score * 100).toFixed(0)) : undefined,
        });
      }
    }

    // Build formatted content
    const contentParts: string[] = [];

    if (answer) {
      contentParts.push(`**Summary:** ${answer}`);
    }

    if (sources.length > 0) {
      contentParts.push("\n**Sources:**");
      sources.forEach((source, idx) => {
        const scoreText = source.score
          ? ` (relevance: ${source.score}%)`
          : "";
        contentParts.push(
          `[${idx + 1}] ${source.title}${scoreText}\n   ${source.url}\n   ${source.content}`,
        );
      });
    }

    const content =
      contentParts.length > 0
        ? contentParts.join("\n\n")
        : "No relevant web results found.";

    return { content, sources, answer };
  }
}
