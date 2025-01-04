import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        const { messages, model } = await req.json();
        console.log('Received request:', { model, messageCount: messages.length });

        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                prompt: messages[messages.length - 1].content,
                stream: true,
            }),
        });

        if (!response.ok) {
            console.error('Ollama API error:', response.status, await response.text());
            return NextResponse.json({ error: 'Ollama API error' }, { status: response.status });
        }

        // Set up Server-Sent Events
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const reader = response.body?.getReader();
                if (!reader) {
                    console.error('No reader available');
                    controller.close();
                    return;
                }

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const text = new TextDecoder().decode(value);
                        const lines = text.split('\n').filter(line => line.trim() !== '');
                        for (const line of lines) {
                            const json = JSON.parse(line);
                            if (json.response) {
                                controller.enqueue(encoder.encode(`data: ${json.response}\n\n`));
                            }
                        }
                    }
                } catch (error) {
                    console.error('Stream reading error:', error);
                    controller.error(error);
                } finally {
                    reader.releaseLock();
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Unexpected error occurred' }, { status: 500 });
    }
}