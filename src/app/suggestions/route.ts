import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = searchParams.get('term');

  if (!term) {
    return NextResponse.json({ error: 'Search term is required' }, { status: 400 });
  }

  try {
    // Using the iTunes Search API for suggestions. It's free and doesn't require a key.
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=10`;
    const response = await fetch(itunesUrl);

    if (!response.ok) {
      throw new Error('Failed to fetch suggestions from iTunes API');
    }

    const data = await response.json();

    const seen = new Set();
    
    const suggestions = data.results
      .map((result: any) => ({
        artistName: result.artistName,
        trackName: result.trackName,
        artworkUrl: result.artworkUrl100,
      }))
      .filter((suggestion: any) => {
        const lowerCaseTrack = suggestion.trackName.toLowerCase();
        
        // Definitive filter based on logged raw data
        if (
          lowerCaseTrack.includes('(live') ||
          lowerCaseTrack.includes('live at') ||
          lowerCaseTrack.includes('live from') ||
          lowerCaseTrack.includes('acoustic') ||
          lowerCaseTrack.includes('remix') ||
          lowerCaseTrack.includes('instrumental') ||
          lowerCaseTrack.includes('demo') ||
          lowerCaseTrack.includes('remaster') // This will catch "(2023 Remaster)", "(Remastered)", etc.
        ) {
          return false;
        }

        // Filter out duplicate artist/track name combinations
        const uniqueKey = `${suggestion.artistName}|${suggestion.trackName}`.toLowerCase();
        if (seen.has(uniqueKey)) {
          return false;
        } else {
          seen.add(uniqueKey);
          return true;
        }
      });

    return NextResponse.json(suggestions.slice(0, 5));

  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions.' }, { status: 500 });
  }
}
