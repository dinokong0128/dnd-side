"""
JWT auth dependency — verifies Supabase-issued JWTs.
Uses the service-role client to call auth.get_user(token) which validates
the JWT against Supabase's key without us needing the JWT secret.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from config import supabase_client

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=True)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """Return the authenticated user's UUID or raise 401.

    Wraps auth.get_user() in a try/except because supabase-py raises
    AuthApiError (not HTTPException) for invalid/expired tokens, which
    would otherwise propagate as an unhandled 500 from Starlette.
    """
    try:
        response = supabase_client.auth.get_user(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not response or not response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return response.user.id
