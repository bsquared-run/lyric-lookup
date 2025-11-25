import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { lyrics, artist, title, album_art_url, song_description, release_year, genres } = await request.json();

    if (!lyrics || !artist || !title) {
      return NextResponse.json({ error: 'Artist, title, and lyrics are required' }, { status: 400 });
    }

    // Forward the request to the Python FastAPI backend's /songs/ endpoint
    const pythonBackendUrl = 'http://127.0.0.1:8000/songs/';
    const response = await fetch(pythonBackendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lyrics, artist, title, album_art_url, song_description, release_year, genres }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error from Python backend while saving song:", errorData);
      return NextResponse.json({ error: 'Failed to save song to backend corpus' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ message: "Song saved to corpus successfully", data });

  } catch (error) {
    console.error('Error in Next.js API route for saving songs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
