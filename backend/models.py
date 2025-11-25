from sqlalchemy import Column, Integer, String, Text
from database import Base

class Song(Base):
    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)
    artist = Column(String, index=True)
    title = Column(String, index=True)
    lyrics = Column(Text)
    song_description = Column(Text, nullable=True)
    album_art_url = Column(String, nullable=True)
    release_year = Column(Integer, nullable=True) # New field for trend analysis
    genres = Column(String, nullable=True)       # New field for trend analysis
