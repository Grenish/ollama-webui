import { NextResponse } from "next/server"

const API_BASE_URL = "http://localhost:11434"

export async function GET() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tags`)
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Ollama API Error: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`Ollama API Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json()

        // Verify the actual response structure from Ollama
        console.log("Ollama API Response:", data)

        // Correct response handling based on Ollama's actual API structure
        const models = (data.models || []).map((model: any) => model.name);
        return NextResponse.json({ models })
    } catch (error) {
        console.error("Error fetching models:", error)
        return NextResponse.json(
            {
                models: [],
                error: error instanceof Error ? error.message : "Failed to fetch models"
            },
            { status: 500 }
        )
    }
}