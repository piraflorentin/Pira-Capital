"""Shared Supabase REST helpers (service-role key, stdlib only)."""
import json, os, urllib.request, urllib.parse

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


def _req(method, path, body=None, query=""):
    url = URL + path + query
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "apikey": KEY, "Authorization": "Bearer " + KEY,
        "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"})
    with urllib.request.urlopen(req, timeout=40) as r:
        txt = r.read().decode()
        return json.loads(txt) if txt else None


def rest_get(table, select="*", filters=""):
    q = f"?select={urllib.parse.quote(select)}"
    if filters:
        q += "&" + filters
    return _req("GET", f"/rest/v1/{table}", query=q) or []


def rest_post(table, row):
    return _req("POST", f"/rest/v1/{table}", body=row)


def admin_users():
    users, page = [], 1
    while True:
        batch = _req("GET", "/auth/v1/admin/users", query=f"?page={page}&per_page=100") or {}
        us = batch.get("users", batch if isinstance(batch, list) else [])
        if not us:
            break
        users += us
        if len(us) < 100:
            break
        page += 1
    return users
