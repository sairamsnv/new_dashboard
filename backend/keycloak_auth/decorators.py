"""
Decorators for Keycloak-protected Django/DRF views.
"""

import functools
from django.http import JsonResponse


def keycloak_login_required(func=None, *, roles=None):
    """
    Decorator that requires a valid Keycloak token on the request.
    Uses `request.keycloak_user` set by KeycloakAuthMiddleware.

    Usage:
        @keycloak_login_required
        def my_view(request): ...

        @keycloak_login_required(roles=["admin"])
        def admin_view(request): ...
    """
    def decorator(view_func):
        @functools.wraps(view_func)
        def wrapper(request, *args, **kwargs):
            user = getattr(request, "keycloak_user", None)
            if not user:
                return JsonResponse(
                    {"error": "Unauthorized", "detail": "Authentication required."},
                    status=401,
                )
            if roles:
                user_roles = [r.lower() for r in user.get("roles", [])]
                for required in roles:
                    rl = required.lower()
                    if rl == "admin":
                        if "admin" not in user_roles and "super_admin" not in user_roles:
                            return JsonResponse(
                                {"error": "Forbidden", "detail": "Insufficient permissions."},
                                status=403,
                            )
                    elif rl not in user_roles:
                        return JsonResponse(
                            {"error": "Forbidden", "detail": "Insufficient permissions."},
                            status=403,
                        )
            return view_func(request, *args, **kwargs)
        return wrapper

    if func is not None:
        return decorator(func)
    return decorator
