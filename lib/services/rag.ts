import { ChromaClient, Collection } from "chromadb";
import { OllamaService } from "./ollama";

export interface RAGConfig {
  chromaHost: string;
  chromaPort: number;
  chromaSsl: boolean;
  collectionName: string;
  topKResults: number;
  embeddingModel: string;
  minSimilarityScore: number;
}

export interface RAGSearchResult {
  content: string;
  sources: Array<{
    document: string;
    metadata?: any;
    score?: number;
  }>;
}

export class RAGService {
  private collection?: Collection;
  private embedCache = new Map<string, number[]>();
  private chroma: ChromaClient;
  private ollama: OllamaService;
  private config: RAGConfig;

  constructor(ollama: OllamaService, config: RAGConfig) {
    this.ollama = ollama;
    this.config = config;
    const protocol = config.chromaSsl ? "https" : "http";
    this.chroma = new ChromaClient({
      path: `${protocol}://${config.chromaHost}:${config.chromaPort}`,
    });
  }

  private async getCachedEmbedding(text: string): Promise<number[]> {
    const cacheKey = text.slice(0, 100);
    const cached = this.embedCache.get(cacheKey);
    if (cached) return cached;

    const embedding = await this.ollama.embed(text, this.config.embeddingModel);
    this.embedCache.set(cacheKey, embedding);
    return embedding;
  }

  async initialize(): Promise<void> {
    try {
      this.collection = await this.chroma.getCollection({
        name: this.config.collectionName,
      });
      const count = await this.collection.count();
      console.log(`📦 RAG Collection has ${count} documents`);
    } catch {
      // Collection doesn't exist
      this.collection = await this.chroma.createCollection({
        name: this.config.collectionName,
      });
      console.log(
        `📦 Created new RAG collection: ${this.config.collectionName}`,
      );
    }
  }

  async addDocuments(
    documents: string[],
    metadatas?: Record<string, any>[],
  ): Promise<void> {
    if (!this.collection) throw new Error("RAG not initialized");

    const embeddings = await Promise.all(
      documents.map((doc) => this.getCachedEmbedding(doc)),
    );

    const ids = documents.map((_, idx) => `doc-${Date.now()}-${idx}`);

    await this.collection.add({
      ids,
      embeddings,
      documents,
      metadatas: metadatas || documents.map(() => ({})),
    });

    console.log(`✅ Added ${documents.length} documents to RAG`);
  }

  async search(query: string): Promise<RAGSearchResult> {
    if (!this.collection) {
      throw new Error("RAG not initialized");
    }

    const queryEmb = await this.getCachedEmbedding(query);

    const results = await this.collection.query({
      queryEmbeddings: [queryEmb],
      nResults: this.config.topKResults,
    });

    const documents = results.documents?.flat().filter(Boolean) || [];
    const distances = results.distances?.flat() || [];
    const metadatas = results.metadatas?.flat() || [];

    // Filter by similarity score
    const sources = documents
      .map((doc, idx) => ({
        document: doc as string,
        metadata: metadatas[idx] || {},
        score:
          distances[idx] !== undefined && distances[idx] !== null
            ? 1 - distances[idx]
            : undefined,
      }))
      .filter((item) => {
        if (item.score === undefined) return true;
        return item.score >= this.config.minSimilarityScore;
      });

    if (sources.length === 0) {
      return {
        content: "No relevant documents found in local knowledge base.",
        sources: [],
      };
    }

    const content = sources
      .map((s, idx) => `[${idx + 1}] ${s.document}`)
      .join("\n\n---\n\n");

    return { content, sources };
  }

  async getCollectionCount(): Promise<number> {
    if (!this.collection) return 0;
    return await this.collection.count();
  }
}
