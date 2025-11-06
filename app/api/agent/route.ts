import { NextResponse } from "next/server";
import { OllamaService } from "@/lib/services/ollama";
import { RAGService } from "@/lib/services/rag";
import { WebSearchService } from "@/lib/services/web-search";
import { AIAgent } from "@/lib/services/agent";
import { readFileSync } from "fs";
import { join } from "path";

type AgentRequestBody = {
  query: string;
  stream?: boolean;
  webSearchOnly?: boolean;
  model?: string;
};

const CONFIG = {
  OLLAMA: {
    GENERATE_MODEL: process.env.OLLAMA_GENERATE_MODEL || "granite4:1b-h",
    DECISION_MODEL: process.env.OLLAMA_DECISION_MODEL || "granite4:1b-h",
    EMBEDDING_MODEL:
      process.env.OLLAMA_EMBEDDING_MODEL || "embeddinggemma:300m",
  },
  CHROMA: {
    HOST: process.env.CHROMA_HOST || "localhost",
    PORT: parseInt(process.env.CHROMA_PORT || "8000"),
    SSL: process.env.CHROMA_SSL === "true",
    COLLECTION_NAME: process.env.CHROMA_COLLECTION || "local_docs",
  },
  RAG: {
    TOP_K_RESULTS: parseInt(process.env.RAG_TOP_K || "5"),
    MIN_SIMILARITY_SCORE: parseFloat(process.env.RAG_MIN_SIMILARITY || "0.3"),
  },
  WEB_SEARCH: {
    MAX_RESULTS: parseInt(process.env.WEB_SEARCH_MAX_RESULTS || "5"),
    TIMEOUT: parseInt(process.env.WEB_SEARCH_TIMEOUT || "20000"),
    CACHE_DURATION: parseInt(process.env.WEB_SEARCH_CACHE || "300000"),
  },
};

// Singleton services
let agentInstance: AIAgent | null = null;
let initError: Error | null = null;

async function getAgent(): Promise<AIAgent> {
  if (initError) throw initError;
  if (agentInstance) return agentInstance;

  try {
    const ollama = new OllamaService();

    const rag = new RAGService(ollama, {
      chromaHost: CONFIG.CHROMA.HOST,
      chromaPort: CONFIG.CHROMA.PORT,
      chromaSsl: CONFIG.CHROMA.SSL,
      collectionName: CONFIG.CHROMA.COLLECTION_NAME,
      topKResults: CONFIG.RAG.TOP_K_RESULTS,
      embeddingModel: CONFIG.OLLAMA.EMBEDDING_MODEL,
      minSimilarityScore: CONFIG.RAG.MIN_SIMILARITY_SCORE,
    });

    await rag.initialize();

    // Auto-load data from data.json if collection is empty
    const count = await rag.getCollectionCount();
    if (count === 0) {
      console.log(
        "📝 RAG collection is empty, attempting to load data.json...",
      );
      try {
        const dataPath = join(process.cwd(), "public", "data.json");
        const fileContent = readFileSync(dataPath, "utf-8");
        const documents = JSON.parse(fileContent);

        if (Array.isArray(documents) && documents.length > 0) {
          console.log(
            `📚 Indexing ${documents.length} documents from data.json...`,
          );
          const metadatas = documents.map((doc, index) => ({
            source: "data.json",
            type: "knowledge_base",
            index,
            added: new Date().toISOString(),
          }));

          await rag.addDocuments(documents, metadatas);
          console.log(`✅ Loaded ${documents.length} documents from data.json`);
        }
      } catch (error: any) {
        console.warn("⚠️ Could not auto-load data.json:", error.message);
        console.warn(
          "⚠️ RAG will work but with empty collection. Add documents via /api/agent/documents",
        );
      }
    } else {
      console.log(`✅ RAG collection has ${count} documents`);
    }

    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (!tavilyApiKey) {
      console.warn("⚠️ TAVILY_API_KEY not set. Web search will be disabled.");
    }

    const webSearch = new WebSearchService({
      apiKey: tavilyApiKey || "",
      maxResults: CONFIG.WEB_SEARCH.MAX_RESULTS,
      timeout: CONFIG.WEB_SEARCH.TIMEOUT,
      cacheDuration: CONFIG.WEB_SEARCH.CACHE_DURATION,
    });

    agentInstance = new AIAgent(ollama, rag, webSearch, {
      decisionModel: CONFIG.OLLAMA.DECISION_MODEL,
      generateModel: CONFIG.OLLAMA.GENERATE_MODEL,
    });

    console.log("✅ AI Agent initialized successfully");
    return agentInstance;
  } catch (error: any) {
    initError = error;
    console.error("❌ Failed to initialize AI Agent:", error.message);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const body: AgentRequestBody = await req.json();

    if (!body.query || typeof body.query !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'query' field" },
        { status: 400 },
      );
    }

    // Use user-provided model or fall back to config
    const generateModel = body.model || CONFIG.OLLAMA.GENERATE_MODEL;

    const agent = await getAgent();

    // Non-streaming response
    if (!body.stream) {
      if (body.webSearchOnly) {
        // Direct web search
        const webResult = await agent["webSearch"].search(body.query);
        return NextResponse.json({
          answer: webResult.content,
          tool: "WebSearch",
          webResult,
          sources: webResult.sources.map((s) => ({
            type: "web",
            title: s.title,
            url: s.url,
            content: s.content,
            score: s.score,
          })),
        });
      }
      const result = await agent.answer(body.query);
      return NextResponse.json(result);
    }

    // Streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Progress callback function
          const progressCallback = (status: string, details?: string[]) => {
            controller.enqueue(
              encoder.encode(
                `event: progress\ndata: ${JSON.stringify({ status, details })}\n\n`,
              ),
            );
          };

          // Handle web search only mode
          if (body.webSearchOnly) {
            controller.enqueue(
              encoder.encode(
                `event: tool\ndata: ${JSON.stringify({ tool: "WebSearch" })}\n\n`,
              ),
            );

            progressCallback("Searching the web", [
              "Initializing web search",
              "Querying Tavily API for latest results",
            ]);

            const webResult = await agent["webSearch"].search(body.query);

            progressCallback("Web search complete", [
              `Retrieved ${webResult.sources.length} sources from the web`,
              "Processing search results",
            ]);

            // Send sources
            const sources = webResult.sources.map((s) => ({
              type: "web",
              title: s.title,
              url: s.url,
              content: s.content,
              score: s.score,
            }));

            controller.enqueue(
              encoder.encode(
                `event: sources\ndata: ${JSON.stringify({ sources })}\n\n`,
              ),
            );

            progressCallback("Generating AI response", [
              "Analyzing web search results",
              "Crafting comprehensive answer",
            ]);

            // Format web results through LLM for better output
            const answerPrompt = `You are a helpful AI assistant. Provide a comprehensive answer based on the web search results below.

**INSTRUCTIONS:**
- Answer the user's question directly and thoroughly
- Use ONLY information from the provided web search results
- Structure your response with clear paragraphs
- Be concise but complete
- Use proper Markdown formatting (headings, lists, bold, etc.)
- Maintain a professional, friendly tone

**WEB SEARCH RESULTS:**
${webResult.content}

**USER QUESTION:**
${body.query}

**YOUR ANSWER:**`;

            progressCallback("Generating response", [
              "Analyzing search results",
              "Formulating comprehensive answer",
            ]);

            // Use streaming generation for better UX
            let fullAnswer = "";
            await agent["ollama"].generateStream(
              generateModel,
              answerPrompt,
              {
                onToken: (token: string) => {
                  fullAnswer += token;
                  controller.enqueue(
                    encoder.encode(
                      `event: message\ndata: ${JSON.stringify({ content: token })}\n\n`,
                    ),
                  );
                },
                onComplete: () => {
                  console.log("Web search answer generation complete");
                },
                onError: (error: Error) => {
                  console.error("Generation error:", error);
                },
              },
              0.7,
            );

            controller.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify({ done: true })}\n\n`,
              ),
            );
            controller.close();
            return;
          }

          // Send progress: Deciding tool
          progressCallback("Analyzing your query", [
            "Understanding your question",
            "Selecting best search strategy",
          ]);

          const tool = await agent.decideTool(body.query);

          // Send tool selection event
          controller.enqueue(
            encoder.encode(
              `event: tool\ndata: ${JSON.stringify({ tool })}\n\n`,
            ),
          );

          // Send immediate progress update after tool selection
          progressCallback(
            `Using ${tool === "Both" ? "RAG + Web Search" : tool}`,
            ["Preparing to fetch information"],
          );

          // Get the answer with progress updates
          const result = await agent.answer(
            body.query,
            progressCallback,
            generateModel,
          );

          // Send sources event
          if (result.sources.length > 0) {
            controller.enqueue(
              encoder.encode(
                `event: sources\ndata: ${JSON.stringify({ sources: result.sources })}\n\n`,
              ),
            );
          }

          progressCallback("Generating response", [
            "Processing retrieved information",
            "Crafting comprehensive answer",
          ]);

          // Stream the answer character by character for smoother display
          const answer = result.answer;
          const chunkSize = 3; // Characters per chunk for smoother streaming

          for (let i = 0; i < answer.length; i += chunkSize) {
            const chunk = answer.slice(i, i + chunkSize);
            controller.enqueue(
              encoder.encode(
                `event: message\ndata: ${JSON.stringify({ content: chunk })}\n\n`,
              ),
            );
            // Small delay for smoother streaming effect
            await new Promise((resolve) => setTimeout(resolve, 15));
          }

          // Send completion event
          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({ done: true })}\n\n`,
            ),
          );

          controller.close();
        } catch (error: any) {
          console.error("Agent streaming error:", error);
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Agent API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const agent = await getAgent();
    const count = await agent["rag"].getCollectionCount();

    return NextResponse.json({
      status: "ready",
      config: {
        generateModel: CONFIG.OLLAMA.GENERATE_MODEL,
        decisionModel: CONFIG.OLLAMA.DECISION_MODEL,
        embeddingModel: CONFIG.OLLAMA.EMBEDDING_MODEL,
        ragDocuments: count,
        webSearchEnabled: !!process.env.TAVILY_API_KEY,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        error: error.message,
      },
      { status: 500 },
    );
  }
}
