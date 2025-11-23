# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.database import engine, Base
from routers import classes as classes_router

# import modelů kvůli registraci v Base
from models.users import User  # noqa
from models.classes import Class  # noqa
from models.enrollments import Enrollment  # noqa

# vytvoření tabulek
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS – aby se frontend (http://localhost:5173) mohl připojit
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return "ok"


# router pro třídy
app.include_router(classes_router.router)
