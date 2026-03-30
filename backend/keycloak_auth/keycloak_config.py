"""
Keycloak Authentication Configuration
Adapted from medha_project's keycloak_auth_config.py for Django DRF.

Priority order (same as medha_project):
  1. keycloak_auth/config/config.json   ← drop your credentials here
  2. Django KEYCLOAK setting (settings.py)
  3. Environment variables
"""

import os
import json
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path


# Path to the local config.json sitting next to this file
_CONFIG_JSON = Path(__file__).resolve().parent / "config" / "config.json"


@dataclass
class KeycloakConfig:
    oauth_app_client_id: str = field(default="")
    oauth_app_client_secret: str = field(default="")
    oauth_provider_discovery_url: str = field(default="")
    keycloak_admin_username: str = field(default="admin")
    keycloak_admin_password: str = field(default="admin")
    # Computed convenience fields
    realm: str = field(default="")
    keycloak_base: str = field(default="")

    def __post_init__(self):
        if self.oauth_provider_discovery_url and not self.realm:
            try:
                parts = self.oauth_provider_discovery_url.split("/realms/")
                self.keycloak_base = parts[0]
                self.realm = parts[1].split("/")[0]
            except (IndexError, AttributeError):
                pass

    @classmethod
    def from_json(cls, path: Path) -> "KeycloakConfig":
        """Load from config.json (same format as medha_project)."""
        with open(path, "r") as f:
            data = json.load(f)

        discovery_url = data.get("oauthProviderDiscoveryUrl", "")

        # Allow KEYCLOAK_SERVER_URL env-var to override the host in discovery URL
        # (useful when Keycloak is 'keycloak' inside Docker but 'localhost' outside)
        server_url_override = os.getenv("KEYCLOAK_SERVER_URL")
        if server_url_override and "/realms/" in discovery_url:
            realm = discovery_url.split("/realms/")[1].split("/")[0]
            discovery_url = f"{server_url_override.rstrip('/')}/realms/{realm}/.well-known/openid-configuration"

        return cls(
            oauth_app_client_id=data.get("oauthAppClientId", os.getenv("KEYCLOAK_CLIENT_ID", "analytics-dashboard")),
            oauth_app_client_secret=data.get("oauthAppClientSecret", os.getenv("KEYCLOAK_CLIENT_SECRET", "")),
            oauth_provider_discovery_url=discovery_url,
            keycloak_admin_username=data.get("keycloakAdminUsername", os.getenv("KEYCLOAK_ADMIN_USERNAME", "admin")),
            keycloak_admin_password=data.get("keycloakAdminPassword", os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")),
        )

    @classmethod
    def from_django_settings(cls) -> "KeycloakConfig":
        """Load from Django KEYCLOAK setting block."""
        try:
            from django.conf import settings
            kc = getattr(settings, "KEYCLOAK", {})
            if not kc:
                return None  # type: ignore[return-value]
            server_url = kc.get("SERVER_URL", os.getenv("KEYCLOAK_SERVER_URL", "http://localhost:8080"))
            realm = kc.get("REALM", os.getenv("KEYCLOAK_REALM", "master"))
            discovery_url = kc.get(
                "DISCOVERY_URL",
                os.getenv("KEYCLOAK_DISCOVERY_URL", f"{server_url}/realms/{realm}/.well-known/openid-configuration"),
            )
            return cls(
                oauth_app_client_id=kc.get("CLIENT_ID", os.getenv("KEYCLOAK_CLIENT_ID", "analytics-dashboard")),
                oauth_app_client_secret=kc.get("CLIENT_SECRET", os.getenv("KEYCLOAK_CLIENT_SECRET", "")),
                oauth_provider_discovery_url=discovery_url,
                keycloak_admin_username=kc.get("ADMIN_USERNAME", os.getenv("KEYCLOAK_ADMIN_USERNAME", "admin")),
                keycloak_admin_password=kc.get("ADMIN_PASSWORD", os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")),
            )
        except Exception:
            return None  # type: ignore[return-value]

    @classmethod
    def from_env(cls) -> "KeycloakConfig":
        """Fallback: load purely from environment variables."""
        server_url = os.getenv("KEYCLOAK_SERVER_URL", "http://localhost:8080")
        realm = os.getenv("KEYCLOAK_REALM", "master")
        discovery_url = os.getenv(
            "KEYCLOAK_DISCOVERY_URL",
            f"{server_url}/realms/{realm}/.well-known/openid-configuration",
        )
        return cls(
            oauth_app_client_id=os.getenv("KEYCLOAK_CLIENT_ID", "analytics-dashboard"),
            oauth_app_client_secret=os.getenv("KEYCLOAK_CLIENT_SECRET", ""),
            oauth_provider_discovery_url=discovery_url,
            keycloak_admin_username=os.getenv("KEYCLOAK_ADMIN_USERNAME", "admin"),
            keycloak_admin_password=os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin"),
        )


_keycloak_config: Optional[KeycloakConfig] = None


def get_keycloak_config() -> KeycloakConfig:
    """
    Singleton config loader.  Priority (same as medha_project):
      1. keycloak_auth/config/config.json
      2. Django settings.KEYCLOAK dict
      3. Environment variables
    """
    global _keycloak_config
    if _keycloak_config is not None:
        return _keycloak_config

    # ── 1. config.json ──────────────────────────────────────────────────────
    if _CONFIG_JSON.exists():
        try:
            _keycloak_config = KeycloakConfig.from_json(_CONFIG_JSON)
            print(f"[Keycloak] Config loaded from {_CONFIG_JSON}")
            return _keycloak_config
        except Exception as exc:
            print(f"[Keycloak] WARNING: could not load {_CONFIG_JSON}: {exc}")

    # ── 2. Django settings ───────────────────────────────────────────────────
    cfg = KeycloakConfig.from_django_settings()
    if cfg is not None:
        _keycloak_config = cfg
        print("[Keycloak] Config loaded from Django settings")
        return _keycloak_config

    # ── 3. Environment variables ─────────────────────────────────────────────
    _keycloak_config = KeycloakConfig.from_env()
    print("[Keycloak] Config loaded from environment variables")
    return _keycloak_config


def reset_keycloak_config():
    """Force reload on next call (useful in tests or after config change)."""
    global _keycloak_config
    _keycloak_config = None
