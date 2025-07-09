import { type NextRequest, NextResponse } from "next/server"

const API_BASE_URL = "http://localhost:11434"

export async function POST(request: NextRequest) {
    const { model, prompt, chatHistory } = await request.json()

    const messages = [
        ...chatHistory,
        {
            role: 'user',
            content: prompt,
        },
    ]

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ model, messages, stream: false }),
        })

        if (!response.ok) {
            throw new Error("Failed to generate response")
        }

        const data = await response.json()
        return NextResponse.json({ response: data.message.content })
    } catch (error) {
        console.error("Error generating response:", error)
        return NextResponse.json({ error: "Failed to generate response" }, { status: 500 })
    }
}

