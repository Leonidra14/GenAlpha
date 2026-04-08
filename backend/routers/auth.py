from fastapi import APIRouter, Depends, HTTPException, Request, status, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import secrets 
import jwt 

from database.database import get_db
from app.schemas.auth import RegisterIn, LoginIn, TokenOut, MeOut
from app.core.security import hash_password, verify_password, create_access_token
from app.core.settings import settings
from app.deps.auth import get_current_user
from models.users import User, RefreshToken 

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, token_value: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token_value,
        httponly=True,
        secure=False,  # local - false, production - true
        samesite="lax",
        path="/",
        max_age=settings.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60,
    )


def _unauthorized_with_cleared_cookie(detail: str) -> JSONResponse:
    resp = JSONResponse(status_code=401, content={"detail": detail})
    resp.delete_cookie("refresh_token", path="/")
    return resp

@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    email = payload.email.lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Neplatné údaje")

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role},
        secret_key=settings.JWT_SECRET,
        expires_minutes=settings.JWT_ACCESS_EXPIRES_MINUTES
    )

    rf_token_str = secrets.token_urlsafe(64)
    expire_date = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRES_DAYS)

    db_rf_token = RefreshToken(
        token=rf_token_str,
        user_id=user.id,
        expires_at=expire_date
    )
    db.add(db_rf_token)
    db.commit() 

    _set_refresh_cookie(response, rf_token_str)

    return TokenOut(access_token=access_token)

@router.post("/refresh", response_model=TokenOut)
def refresh_access_token(request: Request, response: Response, db: Session = Depends(get_db)):
    rf_token_str = request.cookies.get("refresh_token")
    if not rf_token_str:
        return _unauthorized_with_cleared_cookie("Chybí refresh token")

    db_token = db.query(RefreshToken).filter(RefreshToken.token == rf_token_str).first()
    
    if not db_token:
        return _unauthorized_with_cleared_cookie("Neplatný refresh token")
    
    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.delete(db_token)
        db.commit()
        return _unauthorized_with_cleared_cookie("Refresh token vypršel")

    user = db_token.user

    # Rotate refresh token on every successful refresh.
    new_rf_token_str = secrets.token_urlsafe(64)
    db_token.token = new_rf_token_str
    db_token.expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRES_DAYS)
    db.commit()
    
    new_access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role},
        secret_key=settings.JWT_SECRET,
        expires_minutes=settings.JWT_ACCESS_EXPIRES_MINUTES
    )
    _set_refresh_cookie(response, new_rf_token_str)

    return TokenOut(access_token=new_access_token)

@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    rf_token_str = request.cookies.get("refresh_token")
    if rf_token_str:
        db.query(RefreshToken).filter(RefreshToken.token == rf_token_str).delete()
        db.commit()
    
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}