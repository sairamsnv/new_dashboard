"""
Strawberry GraphQL schema — dashboard_meta datasets & inspect (parallel to REST).
Resolvers are sync; DB access uses the existing Django ORM (same as REST views).
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

import strawberry
from strawberry.exceptions import GraphQLError

from dashboard_meta.models import Dataset
from dashboard_meta.services.column_profiler import profile_dataset


@strawberry.type
class GqlColumn:
    col_name: str
    pg_type: str
    dtype: str
    null_rate: float
    cardinality: Optional[int]
    is_dimension: bool
    suggested_widget: str


@strawberry.type
class GqlDatasetSummary:
    slug: str
    name: str
    schema_name: str
    table_name: str
    profiled_at: Optional[str]


@strawberry.type
class GqlDatasetInspect:
    slug: str
    name: str
    schema_name: str
    table_name: str
    suggested_widget_type: str
    profiled_at: Optional[str]
    columns: list[GqlColumn]


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


@strawberry.type
class Query:
    @strawberry.field(description="Health check for the GraphQL endpoint.")
    def graphql_health(self) -> str:
        return "ok"

    @strawberry.field(description="Active registered datasets (same as GET /api/schema/datasets/).")
    def schema_datasets(self) -> list[GqlDatasetSummary]:
        qs = Dataset.objects.filter(is_active=True).order_by("name")
        return [
            GqlDatasetSummary(
                slug=d.slug,
                name=d.name,
                schema_name=d.schema_name,
                table_name=d.table_name,
                profiled_at=_iso(d.profiled_at),
            )
            for d in qs
        ]

    @strawberry.field(
        description="Dataset + column metadata; profiles on first load or when refresh=true "
        "(same as GET /api/schema/inspect/?dataset=…)."
    )
    def dataset_inspect(self, slug: str, refresh: bool = False) -> Optional[GqlDatasetInspect]:
        try:
            ds = Dataset.objects.get(slug=slug, is_active=True)
        except Dataset.DoesNotExist:
            return None

        if refresh or not ds.profiled_at:
            try:
                profile_dataset(ds)
            except ValueError as e:
                raise GraphQLError(str(e)) from e
            ds.refresh_from_db()

        cols: list[GqlColumn] = []
        for c in ds.columns.all().order_by("col_name"):
            cols.append(
                GqlColumn(
                    col_name=c.col_name,
                    pg_type=c.pg_type,
                    dtype=c.dtype,
                    null_rate=c.null_rate,
                    cardinality=c.cardinality,
                    is_dimension=c.is_dimension,
                    suggested_widget=c.suggested_widget or "",
                )
            )

        return GqlDatasetInspect(
            slug=ds.slug,
            name=ds.name,
            schema_name=ds.schema_name,
            table_name=ds.table_name,
            suggested_widget_type=ds.suggested_widget_type or "",
            profiled_at=_iso(ds.profiled_at),
            columns=cols,
        )


schema = strawberry.Schema(query=Query)
