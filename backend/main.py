from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import numpy as np
import spacy

import models
from database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

try:
    nlp = spacy.load("en_core_web_md")
except OSError:
    print("SpaCy model 'en_core_web_md' not found. Please run 'python -m spacy download en_core_web_md'")
    nlp = None

class SongCreate(BaseModel):
    artist: str
    title: str
    lyrics: str
    album_art_url: str | None = None
    song_description: str | None = None
    release_year: int | None = None
    genres: str | None = None

class Song(SongCreate):
    id: int
    class Config:
        from_attributes = True

# --- Database Dependency ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Lyric analysis backend is running."}

@app.post("/songs/", response_model=Song)
def create_song(song: SongCreate, db: Session = Depends(get_db)):
    db_song = db.query(models.Song).filter(models.Song.artist == song.artist, models.Song.title == song.title).first()
    if db_song:
        # If song exists, update its metadata if new data is provided
        if song.release_year and db_song.release_year is None:
            db_song.release_year = song.release_year
        if song.genres and db_song.genres is None:
            db_song.genres = song.genres
        if song.song_description and db_song.song_description is None:
            db_song.song_description = song.song_description
        db.commit()
        db.refresh(db_song)
        return db_song
    
    db_song = models.Song(**song.dict())
    db.add(db_song)
    db.commit()
    db.refresh(db_song)
    return db_song

class AnalyzeLyricsRequest(BaseModel):
    artist: str
    title: str
    lyrics: str

@app.post("/analyze/similar-lyrics")
def find_similar_lyrics(request: AnalyzeLyricsRequest, db: Session = Depends(get_db)):
    if not nlp:
        raise HTTPException(status_code=500, detail="SpaCy model not loaded.")
    all_songs = db.query(models.Song).all()
    if len(all_songs) < 2:
        return {"message": "Corpus is too small for comparison."}
    doc_input_song = nlp(request.lyrics)
    similar_songs = []
    for song_in_db in all_songs:
        if song_in_db.artist.lower() == request.artist.lower() and song_in_db.title.lower() == request.title.lower():
            continue
        doc_db_song = nlp(song_in_db.lyrics)
        similarity_score = doc_input_song.similarity(doc_db_song)
        if similarity_score > 0.85:
            similar_songs.append({"artist": song_in_db.artist, "title": song_in_db.title, "album_art_url": song_in_db.album_art_url, "score": round(similarity_score, 2)})
    similar_songs.sort(key=lambda x: x['score'], reverse=True)
    if not similar_songs:
        return {"message": "No semantically similar songs found."}
    return {"message": "Successfully found semantically similar songs.", "similar_songs": similar_songs[:3]}

class AnalyzeMeaningRequest(BaseModel):
    description: str

@app.post("/analyze/similar-meaning")
def find_similar_meaning(request: AnalyzeMeaningRequest, db: Session = Depends(get_db)):
    if not nlp or not request.description:
        raise HTTPException(status_code=400, detail="Description not provided.")
    all_songs_with_meaning = db.query(models.Song).filter(models.Song.song_description.isnot(None)).all()
    if len(all_songs_with_meaning) < 2:
        return {"message": "Corpus of songs with descriptions is too small."}
    doc_input_description = nlp(request.description)
    similar_songs = []
    for song_in_db in all_songs_with_meaning:
        if not song_in_db.song_description or doc_input_description.text == song_in_db.song_description:
            continue
        doc_db_description = nlp(song_in_db.song_description)
        similarity_score = doc_input_description.similarity(doc_db_description)
        if similarity_score > 0.8:
            similar_songs.append({"artist": song_in_db.artist, "title": song_in_db.title, "album_art_url": song_in_db.album_art_url, "score": round(similarity_score, 2)})
    similar_songs.sort(key=lambda x: x['score'], reverse=True)
    if not similar_songs:
        return {"message": "No songs with similar meaning found."}
    return {"message": "Successfully found songs with similar meaning.", "similar_songs": similar_songs[:3]}
