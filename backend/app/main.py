from fastapi import FastAPI
from pydantic import BaseModel
import openai
import os
import sqlite3
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# Načtení .env souboru a API klíče OpenAI
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# Povolení CORS (všechny domény pro účely vývoje; v produkci omezit na potřebné)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializace databáze SQLite a vytvoření tabulky (pokud ještě neexistuje)
db_path = "notes.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute(
    """CREATE TABLE IF NOT EXISTS notes (
           id INTEGER PRIMARY KEY,
           mode TEXT,
           original TEXT,
           user_notes TEXT,
           ai_notes TEXT
       )"""
)
conn.commit()
conn.close()

# Datové modely požadavků (Body) pomocí Pydantic
class GenerateRequest(BaseModel):
    text: str  # původní text, ze kterého se budou generovat poznámky

class CorrectRequest(BaseModel):
    original: str  # původní text pro porovnání
    notes: str     # poznámky studenta k úpravě

@app.post("/generate")
def generate_notes(request: GenerateRequest):
    original_text = request.text
    # Připravit prompt pro OpenAI model – vygenerování odrážkových poznámek
    prompt = (
        "Shrň následující text do přehledných odrážek pro studijní účely:\n" 
        + original_text
    )
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=1000  # limit tokenů pro dostatečně dlouhé poznámky
    )
    ai_notes = response["choices"][0]["message"]["content"].strip()

    # Uložit vygenerované poznámky do databáze
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO notes(mode, original, user_notes, ai_notes) VALUES (?, ?, ?, ?)",
        ("generated", original_text, None, ai_notes)
    )
    conn.commit()
    conn.close()

    # Vrátit výsledek jako JSON
    return {"notes": ai_notes}

@app.post("/correct")
def correct_notes(request: CorrectRequest):
    original_text = request.original
    user_notes = request.notes
    # Připravit zprávy pro OpenAI – úprava poznámek na základě původního textu
    system_msg = {
        "role": "system", 
        "content": "Jsi asistent pro kontrolu a úpravu studentských poznámek."
    }
    user_msg = {
        "role": "user",
        "content": (
            f"Původní text:\n{original_text}\n\n"
            f"Poznámky studenta:\n{user_notes}\n\n"
            "Uprav výše uvedené poznámky tak, aby byly kompletní, věcně správné a dobře formulované. "
            "Výsledek vrať opět jako seznam odrážek."
        )
    }
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[system_msg, user_msg],
        temperature=0.3,
        max_tokens=1000
    )
    corrected_notes = response["choices"][0]["message"]["content"].strip()

    # Uložit upravené poznámky do databáze
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO notes(mode, original, user_notes, ai_notes) VALUES (?, ?, ?, ?)",
        ("corrected", original_text, user_notes, corrected_notes)
    )
    conn.commit()
    conn.close()

    # Vrátit výsledek jako JSON
    return {"corrected_notes": corrected_notes}

# Spuštění aplikace při lokálním běhu (pokud nenasazujeme přes Uvicorn/Gunicorn)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
