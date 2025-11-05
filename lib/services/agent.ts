import { OllamaService } from "./ollama";
import { RAGService, RAGSearchResult } from "./rag";
import { WebSearchService, WebSearchResult } from "./web-search";

export type Tool = "RAG" | "WebSearch" | "Both";

export interface AgentConfig {
  decisionModel: string;
  generateModel: string;
}

export interface AgentAnswer {
  answer: string;
  tool: Tool;
  ragResult?: RAGSearchResult;
  webResult?: WebSearchResult;
  sources: Array<{
    type: "rag" | "web";
    title?: string;
    url?: string;
    content: string;
    score?: number;
  }>;
}

export class AIAgent {
  private decisionCache = new Map<string, Tool>();
  private ollama: OllamaService;
  private rag: RAGService;
  private webSearch: WebSearchService;
  private config: AgentConfig;

  constructor(
    ollama: OllamaService,
    rag: RAGService,
    webSearch: WebSearchService,
    config: AgentConfig,
  ) {
    this.ollama = ollama;
    this.rag = rag;
    this.webSearch = webSearch;
    this.config = config;
  }

  async decideTool(query: string): Promise<Tool> {
    // Check cache
    const cached = this.decisionCache.get(query.toLowerCase());
    if (cached) return cached;

    const decisionPrompt = `You are an expert tool selector AI. Analyze the question carefully and choose the most appropriate tool.

AVAILABLE TOOLS:
1. "RAG" - Local Knowledge Base
   Use for questions about:
   - Specific known entities: Authrix, AI Cookbook, FuelDev, Grenish Rai, Detoxify
   - Technical documentation, tutorials, guides
   - Historical or archived information
   - Internal system knowledge
   - Previously stored facts and data

2. "WebSearch" - Live Internet Search
   Use for questions about:
   - Current events, news, recent happenings
   - Dates/years mentioned (2023, 2024, 2025, etc.)
   - Real-time information (weather, stocks, prices)
   - Latest updates, versions, releases
   - General world knowledge not in local database
   - Questions with temporal words: "latest", "current", "today", "recently", "now", "trending"
   - Comparisons with external products/services
   - Facts about people, places, or things not in local knowledge

3. "Both" - Combined Search
   Use when:
   - Question requires both local context AND current information
   - Comparing internal knowledge with external updates
   - Need comprehensive answer from multiple sources

DECISION RULES:
- If question mentions specific years or dates → prefer "WebSearch"
- If question asks for "latest" or "current" → prefer "WebSearch"
- If question is about known local entities → prefer "RAG"
- If unclear or needs broad coverage → use "Both"

IMPORTANT: Respond with ONLY a valid JSON object, nothing else.
Format: {"tool": "RAG"} or {"tool": "WebSearch"} or {"tool": "Both"}

Question: ${query}

Analyze the question and respond with JSON:`;

    try {
      const decision = await this.ollama.generate(
        this.config.decisionModel,
        decisionPrompt,
        0.1, // Low temperature for consistent decisions
      );

      // Extract JSON from response
      const jsonMatch = decision.match(/\{[^}]*"tool"[^}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (["RAG", "WebSearch", "Both"].includes(parsed.tool)) {
          this.decisionCache.set(query.toLowerCase(), parsed.tool);
          return parsed.tool;
        }
      }
    } catch (e) {
      console.warn("⚠️ Tool decision via LLM failed, using heuristics");
    }

    // Heuristic fallback
    const tool = this.advancedHeuristicDecision(query);
    this.decisionCache.set(query.toLowerCase(), tool);
    return tool;
  }

  private advancedHeuristicDecision(query: string): Tool {
    const lower = query.toLowerCase();

    const webSearchIndicators = {
      strong: [
        "latest",
        "current",
        "today",
        "yesterday",
        "tomorrow",
        "breaking",
        "trending",
        "live",
        "real-time",
        "now",
        "recent",
        "update",
      ],
      medium: [
        "news",
        "2023",
        "2024",
        "2025",
        "2026",
        "price",
        "weather",
        "stock",
        "market",
      ],
      weak: ["compare", "versus", "vs", "difference", "best", "top"],
    };

    const ragIndicators = {
      strong: [
        "authrix",
        "fueldev",
        "grenish",
        "detoxify",
        "ai cookbook",
        "our system",
        "our documentation",
        "internal",
      ],
      medium: [
        "documentation",
        "guide",
        "tutorial",
        "api",
        "configuration",
        "setup",
        "installation",
      ],
      weak: ["explain", "describe", "what is", "how to", "define"],
    };

    let webScore = 0;
    let ragScore = 0;

    webScore +=
      webSearchIndicators.strong.filter((k) => lower.includes(k)).length * 3;
    ragScore +=
      ragIndicators.strong.filter((k) => lower.includes(k)).length * 3;

    webScore +=
      webSearchIndicators.medium.filter((k) => lower.includes(k)).length * 2;
    ragScore +=
      ragIndicators.medium.filter((k) => lower.includes(k)).length * 2;

    webScore += webSearchIndicators.weak.filter((k) =>
      lower.includes(k),
    ).length;
    ragScore += ragIndicators.weak.filter((k) => lower.includes(k)).length;

    if (/\b20\d{2}\b/.test(lower)) {
      webScore += 4;
    }

    if (
      /^(what|who|when|where|why|how)\s+(is|are|was|were|has|have)\s+(the\s+)?(latest|current|recent)/.test(
        lower,
      )
    ) {
      webScore += 3;
    }

    if (webScore > 0 && ragScore > 0 && Math.abs(webScore - ragScore) < 3) {
      return "Both";
    }

    if (webScore > ragScore) {
      return "WebSearch";
    }

    if (ragScore > webScore) {
      return "RAG";
    }

    return "RAG";
  }

  async answer(
    query: string,
    progressCallback?: (status: string, details?: string[]) => void,
  ): Promise<AgentAnswer> {
    const tool = await this.decideTool(query);
    console.log(`🧠 Selected Tool: ${tool}`);

    let context = "";
    let contextSource = "";
    let ragResult: RAGSearchResult | undefined;
    let webResult: WebSearchResult | undefined;
    const sources: AgentAnswer["sources"] = [];

    if (tool === "Both") {
      console.log("🔄 Fetching from both sources...");
      progressCallback?.("Fetching from multiple sources", [
        "Searching local knowledge base",
        "Searching the web",
      ]);

      const [ragRes, webRes] = await Promise.allSettled([
        (async () => {
          progressCallback?.("Searching local knowledge base", [
            "Converting query to embeddings",
            "Querying vector database",
          ]);
          const result = await this.rag.search(query);
          progressCallback?.("Local search complete", [
            `Retrieved ${result.sources.length} relevant documents`,
          ]);
          return result;
        })(),
        (async () => {
          progressCallback?.("Searching the web", [
            "Initializing Tavily search",
            "Fetching latest information",
          ]);
          const result = await this.webSearch.search(query);
          progressCallback?.("Web search complete", [
            `Retrieved ${result.sources.length} web sources`,
          ]);
          return result;
        })(),
      ]);

      if (ragRes.status === "fulfilled") {
        ragResult = ragRes.value;
        ragResult.sources.forEach((s) => {
          sources.push({
            type: "rag",
            content: s.document,
            score: s.score,
          });
        });
      }

      if (webRes.status === "fulfilled") {
        webResult = webRes.value;
        webResult.sources.forEach((s) => {
          sources.push({
            type: "web",
            title: s.title,
            url: s.url,
            content: s.content,
            score: s.score,
          });
        });
      }

      const ragContent =
        ragRes.status === "fulfilled"
          ? ragRes.value.content
          : "RAG search failed.";
      const webContent =
        webRes.status === "fulfilled"
          ? webRes.value.content
          : "Web search failed.";

      context = `**Local Knowledge Base:**\n${ragContent}\n\n**Web Search Results:**\n${webContent}`;
      contextSource = "both local knowledge and web search";
    } else if (tool === "RAG") {
      progressCallback?.("Searching local knowledge base", [
        "Converting query to embeddings",
        "Querying vector database",
      ]);
      ragResult = await this.rag.search(query);
      progressCallback?.("Local search complete", [
        `Retrieved ${ragResult.sources.length} relevant documents`,
        "Preparing context for AI",
      ]);
      context = ragResult.content;
      contextSource = "local knowledge base";
      ragResult.sources.forEach((s) => {
        sources.push({
          type: "rag",
          content: s.document,
          score: s.score,
        });
      });
    } else {
      progressCallback?.("Searching the web", [
        "Initializing web search",
        "Querying Tavily API",
      ]);
      webResult = await this.webSearch.search(query);
      progressCallback?.("Web search complete", [
        `Retrieved ${webResult.sources.length} sources from the web`,
        "Extracting relevant information",
      ]);
      context = webResult.content;
      contextSource = "web search";
      webResult.sources.forEach((s) => {
        sources.push({
          type: "web",
          title: s.title,
          url: s.url,
          content: s.content,
          score: s.score,
        });
      });
    }

    progressCallback?.("Generating AI response", [
      "Analyzing context from " + contextSource,
      "Crafting comprehensive answer",
    ]);

    const answerPrompt = `You are an intelligent, helpful AI assistant. Your task is to provide accurate, comprehensive answers based on the provided context.

CONTEXT SOURCE: ${contextSource}

INSTRUCTIONS:
1. Answer the user's question directly and thoroughly
2. Use ONLY information from the provided context
3. If context is insufficient, acknowledge this honestly
4. Structure your response with clear paragraphs
5. Be concise but complete
6. Cite sources when they're provided in the context
7. If multiple sources conflict, mention the discrepancy
8. Maintain a professional, friendly tone

CONTEXT:
${context}

USER QUESTION:
${query}

COMPREHENSIVE ANSWER:`;

    const answer = await this.ollama.generate(
      this.config.generateModel,
      answerPrompt,
      0.7,
    );

    return {
      answer: this.postProcessAnswer(answer, tool),
      tool,
      ragResult,
      webResult,
      sources,
    };
  }

  private postProcessAnswer(answer: string, tool: Tool): string {
    answer = answer
      .replace(/^(COMPREHENSIVE ANSWER:|RESPONSE:|ANSWER:)/i, "")
      .trim();

    return answer;
  }
}
