import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { lyrics, artist, title } = await request.json();

    if (!lyrics || !artist || !title) {
      return NextResponse.json({ error: 'Artist, title, and lyrics are required' }, { status: 400 });
    }

    // Forward the request to the Python FastAPI backend
    const pythonBackendUrl = 'http://127.0.0.1:8000/analyze/similar-lyrics';
    const response = await fetch(pythonBackendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lyrics, artist, title }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.message || 'Failed to get similar lyrics from backend' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in Next.js API route for similar lyrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
