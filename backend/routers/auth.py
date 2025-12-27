from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.database import get_db
from app.schemas.auth import RegisterIn, LoginIn, TokenOut, MeOut
from app.core.security import hash_password, verify_password, create_access_token
from app.core.settings import settings
from app.deps.auth import get_current_user

from models.users import User 

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    email = payload.email.lower()

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=email,
        hashed_password=hash_password(payload.password), 
        role="teacher",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        data={"sub": str(user.id), "role": user.role},
        secret_key=settings.JWT_SECRET,
        expires_minutes=settings.JWT_ACCESS_EXPIRES_MINUTES,
        algorithm=settings.JWT_ALGORITHM,
    )
    return TokenOut(access_token=token)

@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    email = payload.email.lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(
        data={"sub": str(user.id), "role": user.role},
        secret_key=settings.JWT_SECRET,
        expires_minutes=settings.JWT_ACCESS_EXPIRES_MINUTES,
        algorithm=settings.JWT_ALGORITHM,
    )
    return TokenOut(access_token=token)

@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return MeOut(id=user.id, name=user.name, email=user.email, role=user.role)
