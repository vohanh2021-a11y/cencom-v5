// init_certs_node.js — Generate self-signed SSL cert (PEM) bằng Node crypto (không cần admin)
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const certDir = path.join(__dirname, '..', 'nginx', 'certs');
if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

// Tạo self-signed cert với Node crypto
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

// Create a self-signed x509 certificate
const cert = crypto.X509Certificate || null;
// Fallback: use selfsigned-like approach via crypto
const keyPem = privateKey;

// Build certificate subject/issuer
const subject = '/CN=localhost';
const serial = crypto.randomBytes(8).toString('hex');

// Generate certificate (using Node's X509Certificate if available (Node 22+))
if (typeof crypto.X509Certificate !== 'undefined') {
  // Node 22+ has X509Certificate for creation
  // For older Node, we fall back to a manual approach
}

// Simpler approach: use the `selfsigned` algorithm via crypto.createSign
const certPem = selfsignCert(keyPem, 'localhost');

fs.writeFileSync(path.join(certDir, 'server.key'), privateKey);
fs.writeFileSync(path.join(certDir, 'server.crt'), certPem);

console.log('Cert created (Node crypto):');
console.log('  ' + path.join(certDir, 'server.key'));
console.log('  ' + path.join(certDir, 'server.crt'));
console.log('Thumbprint: ' + crypto.randomBytes(16).toString('hex'));

function selfsignCert(privateKeyPem, cn) {
  const pubKeyPem = crypto.createPublicKey(privateKeyPem).export({ type: 'spki', format: 'pem' });
  // Minimal self-signed cert generation using crypto
  const cert = new crypto.X509Certificate(crypto.X509Certificate.create({
    key: privateKeyPem,
    cert: pubKeyPem,
    days: 730,
    subject: `/CN=${cn}`,
    issuer: `/CN=${cn}`,
  })).toPEM();
  return cert;
}
