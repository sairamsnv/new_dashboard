#!/bin/bash
set -e

echo "==> Waiting for database to be reachable..."
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rare_wms.settings')
django.setup()
import time, psycopg2
from django.conf import settings
db = settings.DATABASES['default']
for attempt in range(1, 31):
    try:
        conn = psycopg2.connect(
            host=db.get('HOST'), port=db.get('PORT') or 5432,
            dbname=db.get('NAME'), user=db.get('USER'), password=db.get('PASSWORD'),
            connect_timeout=3,
        )
        conn.close()
        print(f'  Database ready (attempt {attempt})')
        break
    except Exception as e:
        print(f'  [{attempt}/30] DB not ready yet: {e}')
    time.sleep(2)
else:
    print('WARNING: Could not reach database after 60s — continuing anyway')
"

echo "==> Running Django migrations..."
python manage.py migrate --noinput 2>&1 || echo "WARNING: migrate failed (DB may be unreachable) — continuing"

echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear -v 0 2>&1 || true

echo "==> Starting: $@"
exec "$@"
