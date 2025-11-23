# database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
load_dotenv()


# Nastavení připojení k PostgreSQL databázi (název DB: GenAlpha)
DATABASE_URL =  os.getenv("DB_URL")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Deklarativní základna pro ORM modely
Base = declarative_base()

# Dependency pro získání DB session (používá se v routách FastAPI)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
