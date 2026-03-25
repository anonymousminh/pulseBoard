from fastapi import FastAPI
from fastapi.responses import RedirectResponse
import os
from dotenv import load_dotenv
import urllib.parse
import secrets

load_dotenv()


app = FastAPI()

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

    return RedirectResponse(url=url, status_code=302)

