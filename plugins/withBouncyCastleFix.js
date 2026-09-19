// plugins/withBouncyCastleFix.js
//
// @dylankenneally/react-native-ssh-sftp pinea org.bouncycastle:bcprov-jdk15on:1.70,
// que choca (mismas clases, JAR distinto) con bcprov-jdk15to18:1.78.1 que expo-updates
// ya trae transitivamente vía bcutil-jdk15to18 — el build de Android falla con
// "Duplicate class org.bouncycastle...". Excluimos la versión vieja del build de la
// app y dejamos la nueva, que es compatible.
const { withAppBuildGradle } = require("expo/config-plugins");

const EXCLUSION_BLOCK = `
configurations.all {
    exclude group: 'org.bouncycastle', module: 'bcprov-jdk15on'
}
`;

// jsch (dependencia de @dylankenneally/react-native-ssh-sftp) y jspecify
// empaquetan el mismo META-INF/versions/9/OSGI-INF/MANIFEST.MF — con
// cualquiera de los dos alcanza, así que solo evitamos el choque.
const PACKAGING_BLOCK = `
    packagingOptions {
        exclude 'META-INF/versions/9/OSGI-INF/MANIFEST.MF'
    }
`;

module.exports = function withBouncyCastleFix(config) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("bcprov-jdk15on")) {
      config.modResults.contents = config.modResults.contents.replace(
        "dependencies {",
        `${EXCLUSION_BLOCK}\ndependencies {`
      );
    }
    if (!config.modResults.contents.includes("OSGI-INF/MANIFEST.MF")) {
      config.modResults.contents = config.modResults.contents.replace(
        /android\s*{/,
        (match) => `${match}\n${PACKAGING_BLOCK}`
      );
    }
    return config;
  });
};
