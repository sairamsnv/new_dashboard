from django.urls import path
from .views import (
    LoginView,
    RegisterView,
    LogoutView,
    TokenRefreshView,
    MeView,
    ResendVerificationView,
    ForgotPasswordView,
    AuthStatusView,
)

app_name = "keycloak_auth"

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/resend-verification/", ResendVerificationView.as_view(), name="resend-verification"),
    path("auth/forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("auth/status/", AuthStatusView.as_view(), name="status"),
]
