from fastapi import FastAPI

from database import engine, Base
from routers import classes as classes_router

# Import model classes to register them with SQLAlchemy Base
from models.users import User
from models.classes import Class
from models.enrollments import Enrollment
from models.assignments import Assignment
from models.results import Result
from models.activities import Activity

# Vytvoření DB tabulek (pokud ještě neexistují) - pro vývojové účely
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Zahrnutí routeru pro třídy (učitelský přehled tříd)
app.include_router(classes_router.router)

# Poznámka: Aplikaci spustíte pomocí příkazu uvicorn, např.:
# uvicorn main:app --reload
