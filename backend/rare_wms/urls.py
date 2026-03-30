"""
URL configuration for rare_wms project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path,include
from django.conf import settings
from django.conf.urls.static import static
from strawberry.django.views import GraphQLView

from rare_wms.graphql_schema import schema as graphql_schema


# Order matters: /graphql/ and /api/schema/* must be registered BEFORE the dashboard SPA
# catch-all (dashboard.urls), which otherwise matches almost every path and serves React.
urlpatterns = [
    path('', include('dr_dashboard.urls')),       # DR dashboard URLs first
    path('graphql/', GraphQLView.as_view(schema=graphql_schema)),
    path('', include('keycloak_auth.urls')),      # Keycloak auth endpoints (/auth/*)
    path('', include('dashboard_meta.urls')),     # Schema inspect / data query / saved widgets
    path('', include('data_ingestion.urls')),     # File upload + DB connect
    path('', include('ai_engine.urls')),          # AI insights / NL query / widget builder
    path('', include('dashboard.urls')),          # Main dashboard + SPA fallback (last)
    path('admin/', admin.site.urls),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
