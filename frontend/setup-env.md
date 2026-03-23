# Environment Setup for Production

## For Production Build

Create a `.env.production` file in the frontend directory with:

```
VITE_API_BASE_URL=https://rare.netscoretech.com/
```

## For Local Development

Create a `.env` file in the frontend directory with:

```
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Build Commands

### Production Build
```bash
cd frontend
npm run build
# or
yarn build
```

### Development
```bash
cd frontend
npm run dev
# or
yarn dev
```

## Environment Variable Priority

The API configuration will use environment variables in this order:
1. `VITE_API_BASE_URL` (from .env files)
2. Localhost detection (for development)
3. Production domain detection (for rare.netscoretech.com)
4. Fallback to window.location.origin

## Verification

After building, check the browser console for API configuration logs:
- Look for "🔧 API Configuration:" messages
- Verify the correct base URL is being used
