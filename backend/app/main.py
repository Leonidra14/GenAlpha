# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.auth import router as auth_router

from database.database import engine, Base
from routers import classes as classes_router
from routers.topics import router as topics_router
from routers.enrollments import router as enrollments_router
from routers import note_generation as note_generation_router




# import modelů kvůli registraci v Base
from models.users import User  # noqa
from models.classes import Class  # noqa
from models.enrollments import Enrollment  # noqa
from models.topics import Topic  # noqa
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



# router pro třídy
app.include_router(classes_router.router, prefix="/classes", tags=["classes"])
# router pro autentizaci
app.include_router(auth_router)
# router pro témata
app.include_router(topics_router)
# router pro zápisy studentů do tříd
app.include_router(enrollments_router, prefix="/classes", tags=["enrollments"])
# router pro generování poznámek
app.include_router(note_generation_router.router, tags=["note_generation"])



