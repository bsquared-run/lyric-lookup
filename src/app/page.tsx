"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from 'next/image';

// --- Custom Hook for Debouncing ---
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

// --- Type Definitions ---
interface Suggestion {
  artistName: string;
  trackName: string;
  artworkUrl: string;
}
interface SimilarSong {
  artist: string;
  title: string;
  album_art_url: string;
  score: number;
}
interface AnalysisResult {
  message: string;
  similar_songs?: SimilarSong[];
}
type ActiveTab = 'similar-lyrics' | 'similar-meaning' | 'decade-trends' | 'genre-trends' | null;


export default function Home() {
  // Main search state
  const [artist, setArtist] = useState("");
  const [songTitle, setSongTitle] = useState("");

  // Search results state
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [albumArtUrl, setAlbumArtUrl] = useState<string | null>(null);
  const [songDescription, setSongDescription] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggestions state
  const [artistSuggestions, setArtistSuggestions] = useState<Suggestion[]>([]);
  const [songSuggestions, setSongSuggestions] = useState<Suggestion[]>([]);
  const [artistQuery, setArtistQuery] = useState("");
  const [songQuery, setSongQuery] = useState("");
  const [isArtistFocused, setIsArtistFocused] = useState(false);
  const [isSongFocused, setIsSongFocused] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  const debouncedArtistQuery = useDebounce(artistQuery, 300);
  const debouncedSongQuery = useDebounce(songQuery, 300);

  const artistInputRef = useRef<HTMLDivElement>(null);
  const songInputRef = useRef<HTMLDivElement>(null);

  // Deeper Analysis Tabs state
  const [activeTab, setActiveTab] = useState<ActiveTab>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);


  // --- Effect for fetching suggestions ---
  useEffect(() => {
    const fetchSuggestions = async (query: string, setter: React.Dispatch<React.SetStateAction<Suggestion[]>>, artistContext: string = "") => {
      let searchTerm = query;
      if (artistContext && query) {
        searchTerm = `${artistContext} ${query}`;
      } else if (!query) {
        setter([]);
        return;
      }
      
      if (searchTerm.length < 2) {
        setter([]);
        return;
      }

      setLoadingSuggestions(true);
      try {
        const response = await fetch(`/suggestions?term=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        if (response.ok) setter(data);
        else setter([]);
      } catch (e) {
        setter([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    if (isArtistFocused) fetchSuggestions(debouncedArtistQuery, setArtistSuggestions);
    if (isSongFocused) fetchSuggestions(debouncedSongQuery, setSongSuggestions, artist);
  }, [debouncedArtistQuery, debouncedSongQuery, artist, isArtistFocused, isSongFocused]);

  // --- Effect to handle clicks outside ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (artistInputRef.current && !artistInputRef.current.contains(event.target as Node)) setIsArtistFocused(false);
      if (songInputRef.current && !songInputRef.current.contains(event.target as Node)) setIsSongFocused(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Main Search Handler ---
  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setLyrics(null);
    setAlbumArtUrl(null);
    setSongDescription(null);
    setYoutubeUrl(null);
    setActiveTab(null);
    setIsArtistFocused(false);
    setIsSongFocused(false);

    if (!artist || !songTitle) {
      setError("Please enter both artist and song title.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/lyrics?artist=${encodeURIComponent(artist)}&songTitle=${encodeURIComponent(songTitle)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fetch lyrics.");
      } else {
        setArtist(data.artist); // Update with corrected artist name from Genius
        setSongTitle(data.title); // Update with corrected title
        setLyrics(data.lyrics);
        setAlbumArtUrl(data.albumArtUrl);
        setSongDescription(data.songDescription);
        setYoutubeUrl(data.youtubeUrl);

        fetch('/api/save-song', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist: data.artist, title: data.title, lyrics: data.lyrics, album_art_url: data.albumArtUrl }),
        }).catch(err => console.error("Failed to save song to corpus:", err));
      }
    } catch (err) {
      console.error("Error fetching lyrics:", err);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // --- Suggestion Click Handler ---
  const handleSuggestionClick = (suggestion: Suggestion) => {
    setArtist(suggestion.artistName);
    setSongTitle(suggestion.trackName);
    setArtistQuery(suggestion.artistName);
    setSongQuery(suggestion.trackName);
    setArtistSuggestions([]);
    setSongSuggestions([]);
    setIsArtistFocused(false);
    setIsSongFocused(false);
  }

  // --- Analysis Tab Click Handler ---
  const handleTabClick = async (tab: ActiveTab) => {
    if ((tab === 'similar-lyrics' && !lyrics) || (tab === 'similar-meaning' && !songDescription)) {
      setAnalysisError("Please search for a song with the required data first.");
      setActiveTab(null);
      return;
    }
    setActiveTab(tab);
    setAnalysisError(null);
    setAnalysisResults(null);
    setLoadingAnalysis(true);

    let url = '';
    let body: any = {};

    if (tab === 'similar-lyrics') {
      url = '/api/similar-lyrics';
      body = { lyrics, artist, title: songTitle };
    } else if (tab === 'similar-meaning') {
      url = '/api/similar-meaning';
      body = { description: songDescription };
    }
    // Add logic for other tabs later

    if (url) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok) setAnalysisError(data.error || "Failed to get analysis.");
        else setAnalysisResults(data);
      } catch (err) {
        setAnalysisError("An unexpected error occurred during analysis.");
      } finally {
        setLoadingAnalysis(false);
      }
    } else {
      setLoadingAnalysis(false); // If tab is not implemented yet
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold">Lyric Lookup</h1>
          <p className="text-gray-400 mt-2">Find lyrics, meanings, and more.</p>
        </header>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-grow" ref={artistInputRef}>
            <input type="text" placeholder="Enter artist name" className="w-full rounded-md bg-gray-800 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700" value={artistQuery} onChange={(e) => { setArtistQuery(e.target.value); setArtist(e.target.value); }} onFocus={() => setIsArtistFocused(true)} disabled={loading} />
            {isArtistFocused && artistSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-gray-800 border border-gray-700 rounded-b-lg mt-1 max-h-60 overflow-y-auto">
                {artistSuggestions.map((s, i) => (
                  <li key={i} onClick={() => handleSuggestionClick(s)} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-700 cursor-pointer">
                    <Image src={s.artworkUrl} alt="artwork" width={40} height={40} className="rounded" />
                    <div><p className="font-semibold text-white">{s.trackName}</p><p className="text-sm text-gray-400">{s.artistName}</p></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="relative flex-grow" ref={songInputRef}>
            <input type="text" placeholder="Enter song title" className="w-full rounded-md bg-gray-800 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700" value={songQuery} onChange={(e) => { setSongQuery(e.target.value); setSongTitle(e.target.value); }} onFocus={() => setIsSongFocused(true)} disabled={loading} />
            {isSongFocused && songSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-gray-800 border border-gray-700 rounded-b-lg mt-1 max-h-60 overflow-y-auto">
                {songSuggestions.map((s, i) => (
                  <li key={i} onClick={() => handleSuggestionClick(s)} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-700 cursor-pointer">
                    <Image src={s.artworkUrl} alt="artwork" width={40} height={40} className="rounded" />
                    <div><p className="font-semibold text-white">{s.trackName}</p><p className="text-sm text-gray-400">{s.artistName}</p></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="w-full sm:w-auto rounded-md bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors" onClick={handleSearch} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {error && <div className="text-center bg-red-900/50 border border-red-700 p-4 rounded-lg"><p className="font-semibold">Error</p><p className="text-red-300">{error}</p></div>}
        {loading && !lyrics && <div className="text-center text-gray-400"><p>Loading content...</p></div>}
        
        {lyrics && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              <div className="md:col-span-1 space-y-6">
                {albumArtUrl && youtubeUrl && (
                  <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="block bg-gray-800 p-4 rounded-lg shadow-lg hover:ring-2 hover:ring-blue-500 transition-all">
                    <Image src={albumArtUrl} alt={`Album art for ${songTitle}`} width={500} height={500} className="rounded-md object-cover w-full h-auto"/>
                    <p className="text-center text-sm text-gray-400 mt-3">Click to listen on YouTube</p>
                  </a>
                )}
                {songDescription && <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h2 className="text-2xl font-bold mb-3">About the Song</h2><p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">{songDescription}</p></div>}
              </div>
              <div className="md:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg"><h2 className="text-3xl font-bold mb-4">Lyrics</h2><div className="whitespace-pre-wrap text-base sm:text-lg leading-loose max-h-[70vh] overflow-y-auto pr-2">{lyrics}</div></div>
            </div>
            
            <div className="mt-12">
              <h2 className="text-3xl font-bold text-center mb-6">Deeper Analysis</h2>
              <div className="flex flex-wrap justify-center gap-4">
                <button className={`px-6 py-3 rounded-lg font-semibold transition-colors ${activeTab === 'similar-lyrics' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'} ${!lyrics ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => handleTabClick('similar-lyrics')} disabled={!lyrics}>Similar Lyrics</button>
                <button className={`px-6 py-3 rounded-lg font-semibold transition-colors ${activeTab === 'similar-meaning' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'} ${!songDescription ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => handleTabClick('similar-meaning')} disabled={!songDescription}>Similar Meaning</button>
                <button className={`px-6 py-3 rounded-lg font-semibold transition-colors ${!lyrics ? 'opacity-50 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`} disabled>Decade Trends</button>
                <button className={`px-6 py-3 rounded-lg font-semibold transition-colors ${!lyrics ? 'opacity-50 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`} disabled>Genre Trends</button>
              </div>

              <div className="mt-6 bg-gray-800 p-6 rounded-lg shadow-lg min-h-[200px] flex items-center justify-center">
                {analysisError && <p className="text-red-400">{analysisError}</p>}
                {loadingAnalysis && <p className="text-gray-400">Loading analysis...</p>}
                {!activeTab && !loadingAnalysis && !analysisError && <p className="text-gray-500">Select a tab to see deeper analysis.</p>}
                
                {analysisResults && (
                  <div className="w-full">
                    <h3 className="text-xl font-bold mb-4 text-center">{analysisResults.message}</h3>
                    {analysisResults.similar_songs && analysisResults.similar_songs.length > 0 ? (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {analysisResults.similar_songs.map((song, i) => (
                          <li key={i} className="bg-gray-700 p-3 rounded-lg text-center flex flex-col items-center gap-2">
                            <Image src={song.album_art_url} alt={`Album for ${song.title}`} width={80} height={80} className="rounded-md" />
                            <span className="font-semibold">{song.title}</span>
                            <span className="text-sm text-gray-400">{song.artist}</span>
                            <span className="text-xs bg-blue-600/50 text-blue-200 px-2 py-1 rounded-full">Similarity: {song.score}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400 text-center">{analysisResults.message.includes("Corpus is too small") ? "Please search for a few more different songs to build the comparison database." : (analysisResults.message || "No results found.")}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}