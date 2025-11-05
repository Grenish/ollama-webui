import { NextResponse } from "next/server";
import { OllamaService } from "@/lib/services/ollama";
import { RAGService } from "@/lib/services/rag";
import { readFileSync } from "fs";
import { join } from "path";

const CONFIG = {
  OLLAMA: {
    EMBEDDING_MODEL: "embeddinggemma:300m",
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
};

let ragInstance: RAGService | null = null;

async function getRagService(): Promise<RAGService> {
  if (ragInstance) return ragInstance;

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
    console.log("📝 RAG collection is empty, attempting to load data.json...");
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
        "⚠️ RAG will work but with empty collection. Add documents via POST /api/agent/documents",
      );
    }
  } else {
    console.log(`✅ RAG collection has ${count} documents`);
  }

  ragInstance = rag;
  return rag;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.documents || !Array.isArray(body.documents)) {
      return NextResponse.json(
        { error: "Missing or invalid 'documents' array" },
        { status: 400 },
      );
    }

    const { documents, metadatas } = body;

    if (metadatas && !Array.isArray(metadatas)) {
      return NextResponse.json(
        { error: "'metadatas' must be an array if provided" },
        { status: 400 },
      );
    }

    if (metadatas && metadatas.length !== documents.length) {
      return NextResponse.json(
        { error: "metadatas length must match documents length" },
        { status: 400 },
      );
    }

    const rag = await getRagService();
    await rag.addDocuments(documents, metadatas);

    const count = await rag.getCollectionCount();

    return NextResponse.json({
      success: true,
      added: documents.length,
      totalDocuments: count,
    });
  } catch (error: any) {
    console.error("Error adding documents:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add documents" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const rag = await getRagService();
    const count = await rag.getCollectionCount();

    return NextResponse.json({
      collection: CONFIG.CHROMA.COLLECTION_NAME,
      documents: count,
      config: {
        host: CONFIG.CHROMA.HOST,
        port: CONFIG.CHROMA.PORT,
        embeddingModel: CONFIG.OLLAMA.EMBEDDING_MODEL,
      },
    });
  } catch (error: any) {
    console.error("Error getting collection info:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get collection info" },
      { status: 500 },
    );
  }
}
