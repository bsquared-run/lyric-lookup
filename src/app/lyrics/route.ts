import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const songTitle = searchParams.get('songTitle');

  if (!artist || !songTitle) {
    return NextResponse.json({ error: 'Artist and song title are required' }, { status: 400 });
  }

  try {
    // --- Step 1: Use Genius Search API to find the correct song path ---
    const searchQuery = `${artist} ${songTitle}`;
    const searchUrl = `https://genius.com/api/search/multi?per_page=5&q=${encodeURIComponent(searchQuery)}`;
    
    console.log(`Searching Genius for: ${searchQuery}`);
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    const songHit = searchData.response.sections.find((section: any) => section.type === 'song');
    if (!songHit || songHit.hits.length === 0) {
      return NextResponse.json({ error: 'Song not found on Genius.' }, { status: 404 });
    }

    const topHit = songHit.hits[0].result;
    const geniusUrl = topHit.url;
    console.log(`Found top hit: ${topHit.full_title}. Fetching from: ${geniusUrl}`);

    // --- Step 2: Scrape the correct page using the found URL ---
    const response = await fetch(geniusUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Genius returned a non-OK status: ${response.status}`);
      return NextResponse.json({ error: 'Lyrics not found on Genius.' }, { status: 404 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // --- Data Extraction ---
    const albumArtUrl = topHit.song_art_image_thumbnail_url || $('meta[property="og:image"]').attr('content') || null;
    
    let songDescription: string | null = null;
    $('div[class*="SongDescription__Content-sc-"]').each((i, el) => {
        songDescription = $(el).text().trim();
    });

    // --- Extract Release Year ---
    let releaseYear: number | null = null;
    const releaseDateText = $('meta[property="og:date"]').attr('content') || $('.SongHeaderdesktop__ReleaseDate-sc-').text();
    if (releaseDateText) {
        const yearMatch = releaseDateText.match(/\d{4}/);
        if (yearMatch) {
            releaseYear = parseInt(yearMatch[0], 10);
        }
    }

    // --- Extract Genres (simplified for now, Genius doesn't always have a clear single field) ---
    let genres: string | null = null;
    // Genius doesn't have a standardized 'genre' field easily accessible via scraping.
    // It's usually within tags or annotations. We'll try to find common tag patterns.
    const genreTags = $('a.Tag-sc-').filter((i, el) => {
        const text = $(el).text().toLowerCase();
        return text.includes('genre') || text.includes('style');
    });

    if (genreTags.length > 0) {
        genres = genreTags.map((i, el) => $(el).text().replace(/genre:|style:/i, '').trim()).get().join(', ');
    }


    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${topHit.artist_names} ${topHit.title}`)}`;

    const lyricsContainer = $('div[data-lyrics-container]');
    if (!lyricsContainer.length) {
      console.error('Could not find the lyrics container div on the Genius page.');
      return NextResponse.json({ error: 'Could not parse lyrics from the page.' }, { status: 500 });
    }

    // --- Aggressive Cleanup ---
    lyricsContainer.find('.Header-sc-1j28bne-0').remove();
    lyricsContainer.find('h1').remove();
    lyricsContainer.find('div.ContributorList-sc-1t8a6z2-0').remove();
    lyricsContainer.find('div[data-lyrics-container] > div:first-child').each((i, el) => {
      const text = $(el).text();
      if (text.includes('Contributors') || text.includes('Translations') || text.includes('LyricsAccording to') || text.includes('Read More')) {
        $(el).remove();
      }
    });
    lyricsContainer.find('div:empty').remove();
    // --- End Aggressive Cleanup ---

    lyricsContainer.find('br').replaceWith('\n');
    const lyrics = lyricsContainer.text().trim();

    if (!lyrics) {
      return NextResponse.json({ error: 'Lyrics not found for this song.' }, { status: 404 });
    }

    return NextResponse.json({ artist: topHit.artist_names, title: topHit.title, lyrics, albumArtUrl, songDescription, youtubeUrl, releaseYear, genres });

  } catch (error) {
    console.error('Error fetching or parsing lyrics from Genius:', error);
    if (error instanceof Error && 'cause' in error) {
      const cause = (error as any).cause;
      if (cause && cause.code) {
        return NextResponse.json({ error: `Network error: ${cause.code}. Could not reach Genius.` }, { status: 502 });
      }
    }
    return NextResponse.json({ error: 'An unexpected error occurred while fetching lyrics.' }, { status: 500 });
  }
}