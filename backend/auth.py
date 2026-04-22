from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi import HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
import urllib.parse
import secrets
import requests
import psycopg2
from jose import jwt
from datetime import datetime, timedelta, timezone

from db_bootstrap import bootstrap_schema

load_dotenv()


app = FastAPI()


@app.on_event("startup")
def _startup():
    bootstrap_schema()

# FRONTEND_URL accepts a single origin or a comma-separated list, so the same
# backend can serve local dev (http://localhost:3000), a Vercel preview URL,
# and the production Vercel URL without redeploying.
_frontend_env = os.getenv("FRONTEND_URL", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _frontend_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pending_state = set()

# Redirect to Github
@app.get("/auth/github/login")
async def redirect_link_to_github():
    query_params = {
        'client_id': os.getenv('GITHUB_CLIENT_ID'),
        'redirect_uri': os.getenv('GITHUB_REDIRECT_URI'),
        'scope': 'user repo',
        'state': secrets.token_urlsafe(16)
    }

    encoded_string = urllib.parse.urlencode(query=query_params)
    url = "https://github.com/login/oauth/authorize?" + encoded_string

    pending_state.add(query_params['state'])

    return RedirectResponse(url=url, status_code=302)


# Callback
@app.get("/auth/github/callback")
async def callback(code: str, state: str):
    if state not in pending_state:
        raise HTTPException(status_code=400, detail="Invalid state")
    
    pending_state.remove(state)
    
    # Exchange code for access token
    response = requests.post(
        url="https://github.com/login/oauth/access_token",
        data={
            "client_id": os.getenv('GITHUB_CLIENT_ID'),
            "client_secret": os.getenv('GITHUB_CLIENT_SECRET'),
            "code": code
        },
        headers={"Accept": "application/json"}
    )
    
    token_data = response.json()
    access_token = token_data.get("access_token")

    if not access_token:
        raise HTTPException(status_code=400, detail="Failed to get access token")

    # Fetch user data from GitHub
    user_response = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    
    user_data = user_response.json()
    github_id = str(user_data.get("id"))
    username = user_data.get("login")
    avatar_url = user_data.get("avatar_url")

    # Upsert user into DB so ingestion and other queries can reference them
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO users (github_id, username, avatar_url, github_access_token)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (github_id)
        DO UPDATE SET username = EXCLUDED.username,
                      avatar_url = EXCLUDED.avatar_url,
                      github_access_token = EXCLUDED.github_access_token,
                      last_login = NOW();
        """,
        (github_id, username, avatar_url, access_token),
    )
    conn.commit()
    cursor.close()
    conn.close()

    # Create JWT token
    payload = {
        "sub": username,
        "avatar_url": avatar_url,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    
    jwt_token = jwt.encode(payload, os.getenv("SECRET_KEY"), algorithm="HS256")

    # Redirect back to frontend with token. When FRONTEND_URL contains a list,
    # the first entry is treated as the canonical SPA URL for OAuth redirects.
    frontend_url = ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "http://localhost:3000"
    return RedirectResponse(url=f"{frontend_url}?token={jwt_token}", status_code=302)


# Helper function
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials

    try:
        decode_payload = jwt.decode(token, key=os.getenv("SECRET_KEY"), algorithms=["HS256"])
        return decode_payload['sub']
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.get("/me")
def protected_route(user_id: str = Depends(get_current_user)):
    return {"user_id": user_id}

import routes