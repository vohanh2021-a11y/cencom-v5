param()
# === init_certs_win.ps1 — Tạo self-signed SSL cert cho on-premise bằng PowerShell ===
# Dùng cho nginx HTTPS localhost
$certDir = "E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\Onpremise\nginx\certs"
if (!(Test-Path $certDir)) { New-Item -ItemType Directory -Path $certDir -Force | Out-Null }

# Tạo self-signed cert (trust store cho localhost)
$cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "Cert:\LocalMachine\My" -KeyUsage DigitalSignature,KeyEncipherment,DataEncipherment -FriendlyName "cencomOS-onpremise-local" -NotAfter (Get-Date).AddYears(2)

# Export cert + private key sang PFX
$securePass = ConvertTo-SecureString -String "cencom_cert_pass_2026" -AsPlainText -Force
$certPathPfx = Join-Path $certDir "server.pfx"
Export-PfxCertificate -Cert "Cert:\LocalMachine\My\$($cert.Thumbprint)" -FilePath $certPathPfx -Password $securePass | Out-Null

# Export PEM (cert only) cho nginx
$certPathPem = Join-Path $certDir "server.crt"
Export-Certificate -Cert $cert -FilePath $certPathPem | Out-Null

Write-Host "Cert created:"
Write-Host "  $certPathPfx (PFX)"
Write-Host "  $certPathPem (cert PEM)"
Write-Host "Thumbprint: $($cert.Thumbprint)"
Write-Host ""
Write-Host "Đẻ bơm cert vơi nginx config:"
Write-Host "  ssl_certificate     /etc/nginx/certs/server.crt;"
Write-Host "  ssl_certificate_key /etc/nginx/certs/server.pfx;"
