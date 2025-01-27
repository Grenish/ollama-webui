import { type NextRequest, NextResponse } from "next/server"

const API_BASE_URL = "http://localhost:11434"

export async function POST(request: NextRequest) {
    const { model, prompt } = await request.json()

    try {
        const response = await fetch(`${API_BASE_URL}/api/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ model, prompt }),
        })

        if (!response.ok) {
            throw new Error("Failed to generate response")
        }

        const data = await response.json()
        return NextResponse.json({ response: data.response })
    } catch (error) {
        console.error("Error generating response:", error)
        return NextResponse.json({ error: "Failed to generate response" }, { status: 500 })
    }
}

