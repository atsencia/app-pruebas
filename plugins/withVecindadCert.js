// plugins/withVecindadCert.js
//
// El nuevo backend de prod (https://vecindad.sencia.com.co:9000) usa un
// certificado TLS emitido por una CA propia ("Sencia Vecindad CA"), no por
// una CA pública. Android rechaza ese certificado por defecto (TrustManager
// del sistema no lo reconoce) y toda petición fetch/XHR falla con
// "Network request failed" aunque el servidor esté perfecto — Postman lo
// esconde porque tiene un toggle para desactivar la verificación SSL, pero
// una app compilada no tiene ese lujo.
//
// Este plugin agrega un Network Security Config que confía en ese
// certificado SOLO para el dominio vecindad.sencia.com.co (no afecta la
// verificación TLS normal del resto de la app). El cert vive en
// certs/vecindad_ca.pem — si el servidor rota su certificado, hay que
// reemplazar ese archivo por el nuevo.
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const CERT_SOURCE = path.join(__dirname, "..", "certs", "vecindad_ca.pem");

const DOMAIN_CONFIG = `    <domain-config>
        <domain includeSubdomains="false">vecindad.sencia.com.co</domain>
        <trust-anchors>
            <certificates src="@raw/vecindad_ca"/>
            <certificates src="system"/>
        </trust-anchors>
    </domain-config>`;

// Release: sin base-config → cleartext queda bloqueado por default (seguro).
const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
${DOMAIN_CONFIG}
</network-security-config>
`;

// Debug: agrega cleartextTrafficPermitted=true — si no, este archivo pisa el
// android:usesCleartextTraffic="true" que Expo pone en
// android/app/src/debug/AndroidManifest.xml para hablar con Metro por HTTP
// plano, y la app se queda en loop de "Unable to load script".
const NETWORK_SECURITY_CONFIG_DEBUG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true"/>
${DOMAIN_CONFIG}
</network-security-config>
`;

function writeConfig(resPath, xmlContent) {
  const rawDir = path.join(resPath, "raw");
  const xmlDir = path.join(resPath, "xml");
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(xmlDir, { recursive: true });

  fs.copyFileSync(CERT_SOURCE, path.join(rawDir, "vecindad_ca.pem"));
  fs.writeFileSync(path.join(xmlDir, "network_security_config.xml"), xmlContent);
}

module.exports = function withVecindadCert(config) {
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.platformProjectRoot;
      writeConfig(path.join(root, "app/src/main/res"), NETWORK_SECURITY_CONFIG_XML);
      writeConfig(path.join(root, "app/src/debug/res"), NETWORK_SECURITY_CONFIG_DEBUG_XML);
      return config;
    },
  ]);

  config = withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    return config;
  });

  return config;
};
