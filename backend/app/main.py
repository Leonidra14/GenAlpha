# app/main.py
"""FastAPI entrypoint: create tables, apply DB patches, register routers."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.auth import router as auth_router

from database.database import engine, Base, ensure_quiz_attempts_bonus_columns, ensure_users_login_key_and_email_nullable
from routers import classes as classes_router
from routers.topics import router as topics_router
from routers.enrollments import router as enrollments_router
from routers import note_generation as note_generation_router
from routers import topic_notes as topic_notes_router
from routers import quiz as quiz_router

from models.users import User  
from models.classes import Class  
from models.enrollments import Enrollment  
from models.topics import Topic  
from models.enrollments import Enrollment  
from models.topic_progress import TopicProgress
from models.quiz_attempts import QuizAttempt

# Import all models so they attach to Base.metadata before create_all().
Base.metadata.create_all(bind=engine)
ensure_quiz_attempts_bonus_columns()
ensure_users_login_key_and_email_nullable()

app = FastAPI()

# Local Vite dev server; production web is usually same-origin behind a proxy.
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

# API surface: 
app.include_router(classes_router.router, prefix="/classes", tags=["classes"])
app.include_router(auth_router)
app.include_router(topics_router)
app.include_router(enrollments_router, prefix="/classes", tags=["enrollments"])
app.include_router(note_generation_router.router, tags=["note_generation"])
app.include_router(topic_notes_router.router, tags=["topic-notes"])
app.include_router(quiz_router.router, tags=["quiz"])





