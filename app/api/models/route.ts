import { NextResponse } from "next/server";

type OllamaTag = {
  name: string;
  size?: string | number;
  modified_at?: string;
  [k: string]: unknown;
};

type ModelsResponse = {
  models: {
    id: string;
    name: string;
    size?: string | number;
    modifiedAt?: string;
    raw?: OllamaTag;
  }[];
};

const DEFAULT_OLLAMA = "http://localhost:11434";

function getBaseUrl(): string {
  const url = process.env.OLLAMA_URL || DEFAULT_OLLAMA;
  return url.replace(/\/+$/, "");
}

export async function GET() {
  const baseURL = getBaseUrl();
  const url = `${baseURL}/api/tags`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        // If using Ollama Cloud, include Authorization header
        // Authorization: `Bearer ${process.env.OLLAMA_API_KEY ?? ""}`,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Failed to fetch models from Ollama: ${res.status} ${res.statusText}`,
          details: text,
        },
        { status: 502 },
      );
    }

    const data = (await res.json().catch(() => ({}))) as
      | { models?: OllamaTag[] }
      | any;
    const models = Array.isArray(data?.models)
      ? data.models.map((m: OllamaTag) => ({
          id: m.name,
          name: m.name,
          size: m.size,
          modifiedAt: m.modified_at,
          raw: m,
        }))
      : [];

    const payload: ModelsResponse = { models };
    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
