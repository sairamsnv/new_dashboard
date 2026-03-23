/**
 * Smart API URL detection for local development vs production
 */
export const getApiBaseUrl = (): string => {
  // 1. Check for environment variable first (highest priority)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 2. Check if running locally
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '0.0.0.0') {
    return 'http://127.0.0.1:8000';
  }
  
  // 3. Production - use the specific production URL
  if (window.location.hostname.includes('rare.netscoretech.com') || 
      window.location.hostname.includes('testdr-68f74b9b66be.herokuapp.com')) {
    return 'https://rare.netscoretech.com';
  }
  
  // 4. Fallback to same domain
  return window.location.origin;
};

/**
 * Get full API URL for a specific endpoint
 */
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${baseUrl}/${cleanEndpoint}`;
};

/**
 * Debug function to log API configuration
 */
export const logApiConfig = (endpoint: string = '') => {
  const baseUrl = getApiBaseUrl();
  const fullUrl = endpoint ? getApiUrl(endpoint) : baseUrl;
  
  console.log('🔧 API Configuration:');
  console.log('  Environment:', import.meta.env.MODE);
  console.log('  Hostname:', window.location.hostname);
  console.log('  Base URL:', baseUrl);
  if (endpoint) {
    console.log('  Full URL:', fullUrl);
  }
};
