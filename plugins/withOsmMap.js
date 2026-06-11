const { withMainApplication } = require("expo/config-plugins");

module.exports = function withOsmMap(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes("OsmMapPackage")) {
      contents = contents.replace(
        "addAll(PackageList(this).packages)",
        "addAll(PackageList(this).packages)\n        add(OsmMapPackage())"
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};