# GenAlpha

Webová aplikace pro podporu výuky s generováním studijních materiálů a kvízů pomocí AI.

## Tech stack
- **Frontend:** React + Vite
- **Backend:** FastAPI (Python)
- **Databáze:** PostgreSQL (přes SQLAlchemy)
- **AI integrace:** OpenAI API

## Struktura projektu
- `frontend/` - klientská aplikace
- `backend/` - API, business logika, modely

## Rychlý start

### 1) Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Backend běží na `http://127.0.0.1:8000`.

### 2) Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend běží na `http://localhost:5173`.


## Poznámky k prostředí
- V backendu je potřeba nastavit připojení k PostgreSQL a OpenAI API klíč (typicky přes `.env`).
- CORS je v developmentu připravený pro Vite (`localhost:5173`).