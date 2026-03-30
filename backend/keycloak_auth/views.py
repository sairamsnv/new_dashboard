"""
Keycloak Authentication Views for Django REST Framework.
Exposes stateless JSON endpoints consumed by the React frontend.

Endpoints
---------
POST /auth/login/              – username+password → tokens
POST /auth/register/           – create new Keycloak user
POST /auth/logout/             – (client-side token removal; optional server logout)
POST /auth/token/refresh/      – exchange refresh_token → new access_token
GET  /auth/me/                 – return info about the currently authenticated user
POST /auth/resend-verification/ – resend email verification
POST /auth/forgot-password/    – send password reset email
"""

import json
from django.views import View
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .keycloak_utils import (
    authenticate_keycloak_user,
    create_keycloak_user,
    refresh_keycloak_token,
    send_verification_email,
    send_password_reset_email,
    validate_keycloak_token,
)
from .keycloak_config import get_keycloak_config


def _json_body(request) -> dict:
    """Parse JSON body; return empty dict on failure."""
    try:
        return json.loads(request.body)
    except Exception:
        return {}


@method_decorator(csrf_exempt, name="dispatch")
class LoginView(View):
    """POST /auth/login/ – authenticate and return tokens."""

    def post(self, request):
        data = _json_body(request)
        username_or_email = (data.get("username") or data.get("email") or "").strip()
        password = (data.get("password") or "").strip()

        if not username_or_email or not password:
            return JsonResponse({"success": False, "error": "Username and password are required."}, status=400)

        success, info = authenticate_keycloak_user(username_or_email, password)

        if not success:
            return JsonResponse(
                {"success": False, "error": info.get("error_description", "Invalid credentials.")},
                status=401,
            )

        return JsonResponse(
            {
                "success": True,
                "user": {
                    "sub": info.get("sub"),
                    "username": info.get("preferred_username") or info.get("sub"),
                    "email": info.get("email"),
                    "firstName": info.get("given_name", ""),
                    "lastName": info.get("family_name", ""),
                    "roles": info.get("roles", []),
                    "emailVerified": info.get("email_verified", False),
                },
                "tokens": {
                    "accessToken": info.get("accessToken"),
                    "refreshToken": info.get("refreshToken"),
                    "idToken": info.get("idToken"),
                    "expiresIn": info.get("expiresIn", 300),
                },
            }
        )


@method_decorator(csrf_exempt, name="dispatch")
class RegisterView(View):
    """POST /auth/register/ – create a new Keycloak user."""

    def post(self, request):
        data = _json_body(request)
        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip()
        password = (data.get("password") or "").strip()
        confirm_password = (data.get("confirmPassword") or data.get("confirm_password") or "").strip()
        first_name = (data.get("firstName") or data.get("first_name") or "").strip()
        last_name = (data.get("lastName") or data.get("last_name") or "").strip()
        role = (data.get("role") or "client").strip()

        if not username or not email or not password:
            return JsonResponse({"success": False, "error": "Username, email, and password are required."}, status=400)

        if password != confirm_password:
            return JsonResponse({"success": False, "error": "Passwords do not match."}, status=400)

        if len(password) < 6:
            return JsonResponse({"success": False, "error": "Password must be at least 6 characters."}, status=400)

        success, message = create_keycloak_user(username, email, password, first_name, last_name, role)

        if success:
            return JsonResponse({"success": True, "message": message}, status=201)
        return JsonResponse({"success": False, "error": message}, status=400)


@method_decorator(csrf_exempt, name="dispatch")
class LogoutView(View):
    """
    POST /auth/logout/ – optional server-side Keycloak session invalidation.
    The React frontend should also clear localStorage/sessionStorage tokens.
    """

    def post(self, request):
        data = _json_body(request)
        refresh_token = (data.get("refreshToken") or "").strip()

        if refresh_token:
            cfg = get_keycloak_config()
            try:
                import requests as _req
                logout_url = (
                    f"{cfg.keycloak_base}/realms/{cfg.realm}/protocol/openid-connect/logout"
                )
                _req.post(
                    logout_url,
                    data={
                        "client_id": cfg.oauth_app_client_id,
                        "client_secret": cfg.oauth_app_client_secret,
                        "refresh_token": refresh_token,
                    },
                    timeout=10,
                )
            except Exception as exc:
                print(f"[WARN] Server-side logout failed: {exc}")

        return JsonResponse({"success": True, "message": "Logged out."})


@method_decorator(csrf_exempt, name="dispatch")
class TokenRefreshView(View):
    """POST /auth/token/refresh/ – exchange refresh_token for new access_token."""

    def post(self, request):
        data = _json_body(request)
        refresh_token = (data.get("refreshToken") or "").strip()

        if not refresh_token:
            return JsonResponse({"success": False, "error": "refreshToken is required."}, status=400)

        success, result = refresh_keycloak_token(refresh_token)

        if success:
            return JsonResponse({"success": True, **result})
        return JsonResponse({"success": False, "error": result.get("error", "Token refresh failed.")}, status=401)


@method_decorator(csrf_exempt, name="dispatch")
class MeView(View):
    """GET /auth/me/ – return current user info from Bearer token."""

    def get(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return JsonResponse({"success": False, "error": "No token provided."}, status=401)

        token = auth_header[7:]
        is_valid, user_info = validate_keycloak_token(token)

        if not is_valid:
            return JsonResponse({"success": False, "error": "Invalid or expired token."}, status=401)

        return JsonResponse(
            {
                "success": True,
                "user": {
                    "sub": user_info.get("sub"),
                    "username": user_info.get("preferred_username") or user_info.get("sub"),
                    "email": user_info.get("email"),
                    "firstName": user_info.get("given_name", ""),
                    "lastName": user_info.get("family_name", ""),
                    "roles": user_info.get("roles", []),
                    "emailVerified": user_info.get("email_verified", False),
                },
            }
        )


@method_decorator(csrf_exempt, name="dispatch")
class ResendVerificationView(View):
    """POST /auth/resend-verification/ – resend email verification link."""

    def post(self, request):
        data = _json_body(request)
        email = (data.get("email") or "").strip()

        if not email:
            return JsonResponse({"success": False, "error": "Email is required."}, status=400)

        success, message = send_verification_email(email)
        if success:
            return JsonResponse({"success": True, "message": message})
        return JsonResponse({"success": False, "error": message}, status=400)


@method_decorator(csrf_exempt, name="dispatch")
class ForgotPasswordView(View):
    """POST /auth/forgot-password/ – send password reset link."""

    def post(self, request):
        data = _json_body(request)
        email = (data.get("email") or "").strip()

        if not email:
            return JsonResponse({"success": False, "error": "Email is required."}, status=400)

        success, message = send_password_reset_email(email)
        if success:
            return JsonResponse({"success": True, "message": message})
        return JsonResponse({"success": False, "error": message}, status=400)


@method_decorator(csrf_exempt, name="dispatch")
class AuthStatusView(View):
    """GET /auth/status/ – lightweight health check for auth service."""

    def get(self, request):
        cfg = get_keycloak_config()
        return JsonResponse(
            {
                "keycloakConfigured": bool(cfg.oauth_app_client_id and cfg.keycloak_base),
                "realm": cfg.realm,
                "clientId": cfg.oauth_app_client_id,
            }
        )
