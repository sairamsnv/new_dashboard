from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from dashboard_meta.models import Dataset, SavedWidget
from dashboard_meta.serializers import (
    DataQuerySerializer,
    DatasetRegisterSerializer,
    DatasetSerializer,
    SavedWidgetSerializer,
)
from dashboard_meta.services.column_profiler import profile_dataset, table_exists
from dashboard_meta.services.query_runner import run_aggregate, run_select


@api_view(["GET", "POST"])
def schema_inspect(request):
    """
    GET  /api/schema/inspect/?dataset=<slug>&refresh=1
    POST /api/schema/inspect/  — register a table and run the profiler
    """
    if request.method == "GET":
        slug = request.GET.get("dataset") or request.GET.get("slug")
        if not slug:
            return Response(
                {"detail": "Query param `dataset` (slug) is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ds = get_object_or_404(Dataset, slug=slug, is_active=True)
        refresh = request.GET.get("refresh") in ("1", "true", "yes")
        if refresh or not ds.profiled_at:
            try:
                profile_dataset(ds)
            except ValueError as e:
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        ds.refresh_from_db()
        return Response(DatasetSerializer(ds).data)

    ser = DatasetRegisterSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    if Dataset.objects.filter(
        schema_name=data["schema_name"], table_name=data["table_name"]
    ).exists():
        return Response(
            {"detail": "A dataset for this schema/table already exists."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not table_exists(data["schema_name"], data["table_name"]):
        return Response(
            {"detail": "Table not found in information_schema."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ds = Dataset.objects.create(
        slug=data["slug"],
        name=data["name"],
        schema_name=data["schema_name"],
        table_name=data["table_name"],
        owner=data.get("owner") or "",
        default_filters=data.get("default_filters") or {},
    )
    try:
        profile_dataset(ds)
    except ValueError as e:
        ds.delete()
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    ds.refresh_from_db()
    return Response(DatasetSerializer(ds).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def data_query(request):
    """POST /api/data/query/ — safe SELECT using whitelisted columns."""
    ser = DataQuerySerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    body = ser.validated_data
    ds = get_object_or_404(Dataset, slug=body["dataset"], is_active=True)
    if not ds.profiled_at:
        return Response(
            {"detail": "Dataset not profiled yet. Call GET /api/schema/inspect/ first."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        cols, rows = run_select(
            ds,
            columns=body.get("columns"),
            filters=body.get("filters") or [],
            limit=body["limit"],
            order_by=body.get("order_by") or None,
        )
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            "dataset": ds.slug,
            "columns": cols,
            "rows": [list(r) for r in rows],
            "row_count": len(rows),
        }
    )


@api_view(["GET"])
def dataset_list(request):
    """GET /api/schema/datasets/ — all registered datasets for builder dropdowns."""
    qs = Dataset.objects.filter(is_active=True).order_by("name")
    data = [
        {
            "slug": d.slug,
            "name": d.name,
            "schema_name": d.schema_name,
            "table_name": d.table_name,
            "profiled_at": d.profiled_at.isoformat() if d.profiled_at else None,
        }
        for d in qs
    ]
    return Response(data)


@api_view(["GET"])
def data_aggregate(request):
    """
    GET /api/data/aggregate/?dataset=<slug>&op=count|count_distinct|sum|avg&column=<optional>
    Returns a single number for dynamic KPI cards (column must exist in ColumnMeta).
    """
    slug = request.GET.get("dataset") or request.GET.get("slug")
    op = (request.GET.get("op") or "count").lower()
    column = request.GET.get("column") or None
    if column == "":
        column = None

    if not slug:
        return Response(
            {"detail": "Query param `dataset` (slug) is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ds = get_object_or_404(Dataset, slug=slug, is_active=True)
    if not ds.profiled_at:
        return Response(
            {"detail": "Dataset not profiled yet. Call GET /api/schema/inspect/ first."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        value = run_aggregate(ds, op, column)
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            "dataset": ds.slug,
            "op": op,
            "column": column,
            "value": value,
        }
    )


@api_view(["GET", "POST"])
def widgets_api(request):
    """GET list / POST create saved widget configs."""
    if request.method == "GET":
        qs = SavedWidget.objects.all()[:200]
        return Response(SavedWidgetSerializer(qs, many=True).data)

    ser = SavedWidgetSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ser.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
def widget_detail(request, pk: int):
    obj = get_object_or_404(SavedWidget, pk=pk)
    if request.method == "GET":
        return Response(SavedWidgetSerializer(obj).data)
    if request.method == "DELETE":
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    ser = SavedWidgetSerializer(obj, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ser.data)
