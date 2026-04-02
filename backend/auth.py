from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi import HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from dotenv import load_dotenv
import urllib.parse
import secrets
import requests
import psycopg2
from jose import jwt, JWTError, ExpiredSignatureError
from datetime import datetime, timedelta



load_dotenv()


app = FastAPI()

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

    # Construct the full URL
    url = "https://github.com/login/oauth/authorize?" + encoded_string

    pending_state.add(query_params['state'])

    return RedirectResponse(url=url, status_code=302)


# Callback
@app.get("/auth/github/callback")
async def callback(code: str, state: str):
    # Check if state is in the pending_state
    if state not in pending_state:
        raise HTTPException(status_code=400, detail="Invalid state")
    else:
        pending_state.remove(state) # Remove so it cannot be reuse
        response = requests.post(url="https://github.com/login/oauth/access_token", 
                                 data= {
                                     "client_id": os.getenv('GITHUB_CLIENT_ID'),
                                     "client_secret": os.getenv('GITHUB_CLIENT_SECRET'),
                                     "code": code
                                 }, headers={"Accept": "application/json"})
        token_data = response.json()
        access_token = token_data.get("access_token")

        # Check if the access token is None -> raise exception
        if access_token is None:
            raise HTTPException(status_code=502, detail="There is no access token")
        
        # Use the access token to call the GitHub API and get user's info
        get_info = requests.get(url="https://api.github.com/user", headers={"Authorization": f"Bearer {access_token}"})

        # Extract the data
        user_data = get_info.json()
        github_id = str(user_data['id'])
        username = user_data['login']
        avatar_url = user_data['avatar_url']
        email = user_data.get('email')

        # Connect to the PostgreSQL
        conn = psycopg2.connect(os.getenv("DATABASE_URL"))
        cursor = conn.cursor()

        # Insert into the database
        try:
            cursor.execute(
                "INSERT INTO users (github_id, username, avatar_url, email) " \
                "VALUES (%s, %s, %s, %s) " \
                "ON CONFLICT (github_id) DO UPDATE SET " \
                "username = EXCLUDED.username, " \
                "avatar_url = EXCLUDED.avatar_url, " \
                "last_login = NOW() " \
                "RETURNING id;", (github_id, username, avatar_url, email))
            user_id = cursor.fetchone()[0]
            conn.commit()

            # Issue a JWT
            payload = {
                "sub": str(user_id),
                "exp": datetime.utcnow() + timedelta(days=7)
            }

            token = jwt.encode(payload, os.getenv("SECRET_KEY"), algorithm="HS256")
        finally:
            cursor.close()
            conn.close()
        
        frontend_url = os.getenv("FRONTEND_URL")
        return RedirectResponse(url=f"{frontend_url}?token={token}", status_code=302)


# Helper function
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials

    # Decode and verify the token
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