import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { description } = await request.json();

    if (!description) {
      return NextResponse.json({ error: 'Song description is required' }, { status: 400 });
    }

    // Forward the request to the Python FastAPI backend
    const pythonBackendUrl = 'http://127.0.0.1:8000/analyze/similar-meaning';
    const response = await fetch(pythonBackendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.detail || 'Failed to get similar meaning from backend' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in Next.js API route for similar meaning:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
