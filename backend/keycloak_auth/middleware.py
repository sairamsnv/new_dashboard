"""
Keycloak JWT Authentication Middleware for Django.

Reads the Authorization: Bearer <token> header on every request,
validates it against Keycloak's /userinfo endpoint, and attaches
`request.keycloak_user` (dict) on success.

API routes under /api/ return 401 JSON on invalid tokens.
Non-API routes are allowed through so the React SPA can load freely.
"""

from django.http import JsonResponse
from .keycloak_utils import validate_keycloak_token

# Paths that are always accessible without authentication
_PUBLIC_PATHS = (
    "/auth/",
    "/admin/",
    "/static/",
    "/assets/",
    "/media/",
    "/favicon.ico",
    "/robots.txt",
    "/graphql/",
)

# When True, all /api/* paths require a valid Keycloak token.
# Set KEYCLOAK_ENFORCE_API_AUTH = True in Django settings to enable.
import os
_ENFORCE = os.getenv("KEYCLOAK_ENFORCE_API_AUTH", "false").lower() in ("1", "true", "yes")


class KeycloakAuthMiddleware:
    """
    Optional middleware that validates Bearer tokens and populates
    `request.keycloak_user`.  Does NOT block requests by default –
    just decorates the request object for views that need it.
    Set KEYCLOAK_ENFORCE_API_AUTH=true to block unauthenticated /api/ calls.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.keycloak_user = None

        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            is_valid, user_info = validate_keycloak_token(token)
            if is_valid:
                request.keycloak_user = user_info
            elif _ENFORCE and request.path.startswith("/api/") and not self._is_public(request.path):
                return JsonResponse(
                    {"error": "Unauthorized", "detail": "Invalid or expired token."},
                    status=401,
                )
        elif _ENFORCE and request.path.startswith("/api/") and not self._is_public(request.path):
            return JsonResponse(
                {"error": "Unauthorized", "detail": "Authentication required."},
                status=401,
            )

        return self.get_response(request)

    @staticmethod
    def _is_public(path: str) -> bool:
        return any(path.startswith(p) for p in _PUBLIC_PATHS)
