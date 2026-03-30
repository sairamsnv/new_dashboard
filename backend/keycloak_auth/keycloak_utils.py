"""
Keycloak Authentication Utilities
Adapted from medha_project's keycloak_auth.py for Django / DRF (no Flask sessions).
All session-like state is handled via JWT tokens in the frontend.
"""

import json
import time
import requests
from typing import Optional, Tuple

from .keycloak_config import get_keycloak_config


# ---------------------------------------------------------------------------
# Admin helpers
# ---------------------------------------------------------------------------

def get_keycloak_admin_token() -> Optional[str]:
    """Obtain a short-lived admin token from the Keycloak master realm."""
    cfg = get_keycloak_config()
    try:
        token_url = f"{cfg.keycloak_base}/realms/master/protocol/openid-connect/token"
        resp = requests.post(
            token_url,
            data={
                "grant_type": "password",
                "client_id": "admin-cli",
                "username": cfg.keycloak_admin_username,
                "password": cfg.keycloak_admin_password,
            },
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()["access_token"]
        print(f"[ERROR] get_keycloak_admin_token: {resp.status_code} – {resp.text[:200]}")
        return None
    except Exception as exc:
        print(f"[ERROR] get_keycloak_admin_token exception: {exc}")
        return None


def _get_client_uuid(keycloak_base: str, realm: str, admin_token: str, client_id: str) -> Optional[str]:
    """Return the internal UUID of a Keycloak client (not the clientId string)."""
    try:
        url = f"{keycloak_base}/admin/realms/{realm}/clients"
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            for c in resp.json():
                if c.get("clientId") == client_id:
                    return c["id"]
        return None
    except Exception as exc:
        print(f"[ERROR] _get_client_uuid: {exc}")
        return None


# ---------------------------------------------------------------------------
# User creation
# ---------------------------------------------------------------------------

def create_keycloak_user(
    username: str,
    email: str,
    password: str,
    first_name: str = "",
    last_name: str = "",
    role: str = "client",
) -> Tuple[bool, str]:
    """Create a user in Keycloak via the Admin REST API. Returns (success, message)."""
    cfg = get_keycloak_config()
    try:
        admin_token = get_keycloak_admin_token()
        if not admin_token:
            return False, "Could not connect to Keycloak admin. Check credentials."

        headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

        email_local = email.strip().split("@")[0] if email.strip() else ""
        _first = (first_name or "").strip() or email_local or username or "-"
        _last = (last_name or "").strip() or username or _first or "-"

        user_data = {
            "username": username,
            "email": email,
            "emailVerified": False,
            "enabled": True,
            "firstName": _first,
            "lastName": _last,
            "requiredActions": [],
            "credentials": [{"type": "password", "value": password, "temporary": False}],
        }

        create_url = f"{cfg.keycloak_base}/admin/realms/{cfg.realm}/users"
        create_resp = requests.post(create_url, headers=headers, json=user_data, timeout=10)

        if create_resp.status_code == 409:
            return False, "Username or email already exists. Please choose a different one."

        if create_resp.status_code not in (200, 201):
            return False, f"Failed to create user ({create_resp.status_code}): {create_resp.text[:300]}"

        # Resolve user ID from Location header or search
        user_id: Optional[str] = None
        loc = create_resp.headers.get("Location", "")
        if loc:
            user_id = loc.rstrip("/").split("/")[-1]

        if not user_id:
            time.sleep(0.5)
            search = requests.get(
                create_url, headers=headers, params={"email": email, "exact": "true"}, timeout=10
            )
            if search.status_code == 200 and search.json():
                user_id = search.json()[0]["id"]

        # Assign role
        if user_id:
            _assign_role(user_id, role, cfg.keycloak_base, cfg.realm, admin_token)

        # Send verification email
        time.sleep(1)
        ok, msg = send_verification_email(email)
        if ok:
            return True, (
                f"Account created! A verification email has been sent to {email}. "
                "Please verify before logging in."
            )
        return True, (
            "Account created! Verification email could not be sent – "
            "use 'Resend Verification Email' on the login page."
        )

    except Exception as exc:
        print(f"[ERROR] create_keycloak_user: {exc}")
        return False, f"Unexpected error: {exc}"


def _assign_role(user_id: str, role_name: str, keycloak_base: str, realm: str, admin_token: str) -> bool:
    """Assign a realm or client role to a user. Best-effort (won't fail registration)."""
    if role_name not in ("client", "agent", "admin", "super_admin"):
        role_name = "client"

    headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

    # Try client role first
    client_uuid = _get_client_uuid(keycloak_base, realm, admin_token, get_keycloak_config().oauth_app_client_id)
    if client_uuid:
        role_url = f"{keycloak_base}/admin/realms/{realm}/clients/{client_uuid}/roles/{role_name}"
        role_resp = requests.get(role_url, headers=headers, timeout=10)
        if role_resp.status_code == 200:
            assign_url = f"{keycloak_base}/admin/realms/{realm}/users/{user_id}/role-mappings/clients/{client_uuid}"
            r = requests.post(assign_url, headers=headers, json=[role_resp.json()], timeout=10)
            if r.status_code in (200, 204):
                return True

    # Try realm role
    role_url = f"{keycloak_base}/admin/realms/{realm}/roles/{role_name}"
    role_resp = requests.get(role_url, headers=headers, timeout=10)
    if role_resp.status_code == 200:
        assign_url = f"{keycloak_base}/admin/realms/{realm}/users/{user_id}/role-mappings/realm"
        r = requests.post(assign_url, headers=headers, json=[role_resp.json()], timeout=10)
        return r.status_code in (200, 204)

    return False


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

def authenticate_keycloak_user(username_or_email: str, password: str) -> Tuple[bool, dict]:
    """
    Authenticate via Keycloak Resource Owner Password Credentials Grant.
    Supports both username and email login.
    Returns (success, user_info_dict_or_error_dict).
    """
    cfg = get_keycloak_config()
    try:
        token_url = f"{cfg.keycloak_base}/realms/{cfg.realm}/protocol/openid-connect/token"

        # Resolve email → username
        login_username = username_or_email
        if "@" in username_or_email:
            try:
                admin_token = get_keycloak_admin_token()
                if admin_token:
                    headers = {"Authorization": f"Bearer {admin_token}"}
                    search_url = f"{cfg.keycloak_base}/admin/realms/{cfg.realm}/users"
                    sr = requests.get(
                        search_url, headers=headers,
                        params={"email": username_or_email, "exact": "true"}, timeout=10,
                    )
                    if sr.status_code == 200 and sr.json():
                        login_username = sr.json()[0].get("username", username_or_email)
            except Exception as e:
                print(f"[DEBUG] email→username resolution failed: {e}")

        auth_data = {
            "grant_type": "password",
            "client_id": cfg.oauth_app_client_id,
            "client_secret": cfg.oauth_app_client_secret,
            "username": login_username,
            "password": password,
            "scope": "openid email profile",
        }

        # Retry logic for transient connection errors
        response = None
        for attempt in range(3):
            try:
                response = requests.post(token_url, data=auth_data, timeout=30)
                break
            except (requests.ConnectionError, requests.Timeout) as exc:
                if attempt == 2:
                    raise
                print(f"[WARN] Keycloak attempt {attempt + 1}/3 failed: {exc}, retrying…")
                time.sleep(2)

        if response is None or response.status_code != 200:
            try:
                err = response.json() if response else {}
            except Exception:
                err = {}
            return False, {"error_description": err.get("error_description", "Invalid credentials.")}

        token_data = response.json()
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token", "")
        id_token = token_data.get("id_token", "")
        expires_in = token_data.get("expires_in", 300)

        # Decode roles from JWT (no signature verification needed here – Keycloak already validated)
        client_roles: list = []
        realm_roles: list = []
        try:
            import base64
            payload_b64 = access_token.split(".")[1]
            payload_b64 += "=" * (-len(payload_b64) % 4)
            decoded = json.loads(base64.urlsafe_b64decode(payload_b64))
            client_roles = decoded.get("resource_access", {}).get(cfg.oauth_app_client_id, {}).get("roles", [])
            realm_roles = decoded.get("realm_access", {}).get("roles", [])
        except Exception as e:
            print(f"[DEBUG] JWT role decoding failed: {e}")

        # Get user info from /userinfo
        userinfo_url = f"{cfg.keycloak_base}/realms/{cfg.realm}/protocol/openid-connect/userinfo"
        ui_resp = requests.get(userinfo_url, headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
        user_info = ui_resp.json() if ui_resp.status_code == 200 else {}

        all_roles = list(set(client_roles + realm_roles))

        # If still no roles, fetch from Admin API
        if not all_roles:
            user_sub = user_info.get("sub") or token_data.get("sub")
            if user_sub:
                all_roles = _fetch_roles_admin(user_sub, cfg.keycloak_base, cfg.realm)

        user_info.update({
            "roles": all_roles,
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "idToken": id_token,
            "expiresIn": expires_in,
        })
        return True, user_info

    except Exception as exc:
        print(f"[ERROR] authenticate_keycloak_user: {exc}")
        import traceback
        traceback.print_exc()
        return False, {"error_description": "Authentication service error."}


def _fetch_roles_admin(user_id: str, keycloak_base: str, realm: str) -> list:
    """Fetch role mappings for a user via Admin API (fallback when token has no roles)."""
    cfg = get_keycloak_config()
    try:
        admin_token = get_keycloak_admin_token()
        if not admin_token:
            return []
        headers = {"Authorization": f"Bearer {admin_token}"}
        roles: list = []

        # Client roles
        client_uuid = _get_client_uuid(keycloak_base, realm, admin_token, cfg.oauth_app_client_id)
        if client_uuid:
            r = requests.get(
                f"{keycloak_base}/admin/realms/{realm}/users/{user_id}/role-mappings/clients/{client_uuid}",
                headers=headers, timeout=10,
            )
            if r.status_code == 200:
                roles += [x["name"] for x in r.json()]

        # Realm roles
        r = requests.get(
            f"{keycloak_base}/admin/realms/{realm}/users/{user_id}/role-mappings/realm",
            headers=headers, timeout=10,
        )
        if r.status_code == 200:
            roles += [x["name"] for x in r.json()]

        return list(set(roles))
    except Exception as exc:
        print(f"[ERROR] _fetch_roles_admin: {exc}")
        return []


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

def refresh_keycloak_token(refresh_token: str) -> Tuple[bool, dict]:
    """Exchange a refresh token for a new access token. Returns (success, token_dict)."""
    cfg = get_keycloak_config()
    try:
        token_url = f"{cfg.keycloak_base}/realms/{cfg.realm}/protocol/openid-connect/token"
        resp = requests.post(
            token_url,
            data={
                "grant_type": "refresh_token",
                "client_id": cfg.oauth_app_client_id,
                "client_secret": cfg.oauth_app_client_secret,
                "refresh_token": refresh_token,
            },
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            return True, {
                "accessToken": data.get("access_token", ""),
                "refreshToken": data.get("refresh_token", refresh_token),
                "idToken": data.get("id_token", ""),
                "expiresIn": data.get("expires_in", 300),
            }
        return False, {"error": "Token refresh failed", "detail": resp.text[:200]}
    except Exception as exc:
        return False, {"error": str(exc)}


# ---------------------------------------------------------------------------
# Email helpers
# ---------------------------------------------------------------------------

def send_verification_email(email: str) -> Tuple[bool, str]:
    """Trigger Keycloak's VERIFY_EMAIL action-email for the given email address."""
    cfg = get_keycloak_config()
    try:
        admin_token = get_keycloak_admin_token()
        if not admin_token:
            return False, "Could not get admin token"

        headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

        search_url = f"{cfg.keycloak_base}/admin/realms/{cfg.realm}/users"
        sr = requests.get(search_url, headers=headers, params={"email": email, "exact": "true"}, timeout=10)

        if sr.status_code != 200 or not sr.json():
            return False, "User not found"

        user_id = sr.json()[0]["id"]
        verify_url = f"{cfg.keycloak_base}/admin/realms/{cfg.realm}/users/{user_id}/execute-actions-email"
        vr = requests.put(verify_url, headers=headers, json=["VERIFY_EMAIL"], timeout=30)

        if vr.status_code in (200, 204):
            return True, "Verification email sent"
        return False, f"Keycloak error: {vr.text[:200]}"
    except Exception as exc:
        return False, str(exc)


def send_password_reset_email(email: str) -> Tuple[bool, str]:
    """Trigger Keycloak's UPDATE_PASSWORD action-email for the given email address."""
    cfg = get_keycloak_config()
    try:
        admin_token = get_keycloak_admin_token()
        if not admin_token:
            return False, "Could not get admin token"

        headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

        search_url = f"{cfg.keycloak_base}/admin/realms/{cfg.realm}/users"
        sr = requests.get(search_url, headers=headers, params={"email": email, "exact": "true"}, timeout=10)

        if sr.status_code != 200 or not sr.json():
            return False, "No user found with that email"

        user_id = sr.json()[0]["id"]
        reset_url = f"{cfg.keycloak_base}/admin/realms/{cfg.realm}/users/{user_id}/execute-actions-email"
        rr = requests.put(reset_url, headers=headers, json=["UPDATE_PASSWORD"], timeout=30)

        if rr.status_code in (200, 204):
            return True, "Password reset email sent. Check your inbox."
        return False, f"Failed: {rr.text[:200]}"
    except Exception as exc:
        return False, str(exc)


# ---------------------------------------------------------------------------
# JWT token validation (for protecting Django API endpoints)
# ---------------------------------------------------------------------------

def validate_keycloak_token(access_token: str) -> Tuple[bool, dict]:
    """
    Validate a Keycloak JWT access token.
    Uses the /userinfo endpoint as a lightweight introspection call.
    Returns (is_valid, user_info_dict).
    """
    cfg = get_keycloak_config()
    try:
        userinfo_url = f"{cfg.keycloak_base}/realms/{cfg.realm}/protocol/openid-connect/userinfo"
        resp = requests.get(userinfo_url, headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
        if resp.status_code == 200:
            info = resp.json()
            # Decode roles
            try:
                import base64 as _b64
                payload_b64 = access_token.split(".")[1]
                payload_b64 += "=" * (-len(payload_b64) % 4)
                decoded = json.loads(_b64.urlsafe_b64decode(payload_b64))
                client_roles = decoded.get("resource_access", {}).get(cfg.oauth_app_client_id, {}).get("roles", [])
                realm_roles = decoded.get("realm_access", {}).get("roles", [])
                info["roles"] = list(set(client_roles + realm_roles))
            except Exception:
                info.setdefault("roles", [])
            return True, info
        return False, {}
    except Exception as exc:
        print(f"[ERROR] validate_keycloak_token: {exc}")
        return False, {}
