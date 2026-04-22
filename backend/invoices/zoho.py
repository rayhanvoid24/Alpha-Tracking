import requests
from django.conf import settings

# Zoho OAuth URLs
ZOHO_AUTH_URL = 'https://accounts.zoho.com.au/oauth/v2/auth'
ZOHO_TOKEN_URL = 'https://accounts.zoho.com.au/oauth/v2/token'
ZOHO_INVOICES_URL = 'https://www.zohoapis.com.au/books/v3/invoices'

# Step 1 — Generate the URL that redirects the user/to Zoho's login page to grant access
def get_zoho_auth_url():
    params = {
        'scope': 'ZohoBooks.invoices.READ',
        'client_id': settings.ZOHO_CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': 'http://localhost:8000/api/zoho/callback/',
        'access_type': 'offline',
    }
     # Build the URL with parameters
    param_string = '&'.join([f'{k}={v}' for k, v in params.items()])
    return f'{ZOHO_AUTH_URL}?{param_string}'
# Step 2 — Exchange the code Zoho sends back  for access and refresh tokens
def exchange_code_for_tokens(code):
    response = requests.post(ZOHO_TOKEN_URL, data={
        'code': code,
        'client_id': settings.ZOHO_CLIENT_ID,
        'client_secret': settings.ZOHO_CLIENT_SECRET,
        'redirect_uri': 'http://localhost:8000/api/zoho/callback/',
        'grant_type': 'authorization_code',
    })
    return response.json()
# Step 3 — Use the access token to fetch invoices from Zoho Books
def fetch_zoho_invoices(access_token, organization_id):
    
    headers = {
        'Authorization': f'Zoho-oauthtoken {access_token}',
    }
    params = {
        'organization_id': organization_id,
        #fectch all the invoices from when zoho was first utilised
        'date_start': '2026-03-15',
        'sort_column': 'date',
        'sort_order': 'D' ## sorting order is set to decending
    }
    response = requests.get(ZOHO_INVOICES_URL, headers=headers, params=params)
    
    return response.json()
# Step 4 — Use the refresh token to get a new access token when the old one expires
def refresh_zoho_token(refresh_token):
    response = requests.post(ZOHO_TOKEN_URL, data={
        'refresh_token': refresh_token,
        'client_id': settings.ZOHO_CLIENT_ID,
        'client_secret': settings.ZOHO_CLIENT_SECRET,
        'grant_type': 'refresh_token',
    })
    return response.json()