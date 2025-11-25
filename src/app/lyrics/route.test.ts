import { GET } from './route';
import { NextResponse } from 'next/server';

describe('Lyrics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mocking URL and URLSearchParams for Next.js API routes
    Object.defineProperty(global, 'URL', {
      writable: true,
      value: jest.fn().mockImplementation((url) => ({
        searchParams: new URLSearchParams(url.split('?')[1] || ''),
        toString: () => url,
      })),
    });
  });

  it('should return lyrics for a valid artist and song title', async () => {
    const mockLyrics = { lyrics: 'Test lyrics here' };
    
    // Mock global.fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockLyrics),
      } as Response)
    );

    const request = new Request('http://localhost/api/lyrics?artist=testArtist&songTitle=testSong');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ artist: 'testArtist', songTitle: 'testSong', lyrics: mockLyrics.lyrics });
    expect(global.fetch).toHaveBeenCalledWith('https://api.lyrics.ovh/v1/testArtist/testSong');
  });

  it('should return 400 if artist is missing', async () => {
    const request = new Request('http://localhost/api/lyrics?songTitle=testSong');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Artist and song title are required' });
  });

  it('should return 400 if songTitle is missing', async () => {
    const request = new Request('http://localhost/api/lyrics?artist=testArtist');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Artist and song title are required' });
  });

  it('should return 404 if lyrics are not found by external API', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'No lyrics found' }),
      } as Response)
    );

    const request = new Request('http://localhost/api/lyrics?artist=nonexistentArtist&songTitle=nonexistentSong');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'No lyrics found' });
  });

  it('should return 500 if external API call fails', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

    const request = new Request('http://localhost/api/lyrics?artist=testArtist&songTitle=testSong');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to fetch lyrics' });
  });
});
