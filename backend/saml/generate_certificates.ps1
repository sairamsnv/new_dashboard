# PowerShell script to generate SAML Service Provider Certificate and Key
# Run this script in PowerShell: .\generate_certificates.ps1

Write-Host "Generating SAML Service Provider certificate and key..." -ForegroundColor Green

# Check if OpenSSL is available
$opensslPath = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $opensslPath) {
    Write-Host "ERROR: OpenSSL is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install OpenSSL or use WSL/Git Bash to run generate_certificates.sh" -ForegroundColor Yellow
    exit 1
}

# Generate private key (2048 bits)
Write-Host "Generating private key..." -ForegroundColor Cyan
openssl genrsa -out sp.key 2048

# Generate self-signed certificate (valid for 365 days)
Write-Host "Generating certificate..." -ForegroundColor Cyan
openssl req -new -x509 -key sp.key -out sp.crt -days 365 `
    -subj "/CN=rare.netscoretech.com/O=RARE WMS/C=US/ST=State/L=City"

Write-Host "`nCertificate and key generated successfully!" -ForegroundColor Green
Write-Host "Files created:" -ForegroundColor Yellow
Write-Host "  - sp.key (private key - KEEP SECURE!)" -ForegroundColor White
Write-Host "  - sp.crt (certificate - upload to NetSuite)" -ForegroundColor White
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Upload sp.crt to NetSuite SAML configuration" -ForegroundColor White
Write-Host "2. Download NetSuite metadata.xml and save as netsuite_metadata.xml" -ForegroundColor White
Write-Host "3. Update Django settings if needed" -ForegroundColor White

