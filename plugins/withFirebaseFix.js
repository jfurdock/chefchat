/**
 * Expo config plugin to fix the "non-modular header inside framework module"
 * build error caused by React Native Firebase with iOS frameworks.
 *
 * This injects settings into the existing Podfile post_install hook to:
 * - allow non-modular includes inside framework modules
 * - disable the specific non-modular warning
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withFirebaseFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (!podfile.includes('$RNFirebaseAsStaticFramework = true')) {
        podfile = podfile.replace(
          /prepare_react_native_project!\n/,
          "prepare_react_native_project!\n\n# Required by react-native-firebase when iOS frameworks are enabled.\n$RNFirebaseAsStaticFramework = true\n"
        );
      }

      const hasAllowNonModular = podfile.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES');
      const hasRnfbModuleOverride = podfile.includes("target.name.start_with?('RNFB')");

      if (!hasAllowNonModular || !hasRnfbModuleOverride) {
        const insertion = `    # Fix for React Native Firebase non-modular header errors when using frameworks.\n    installer.pods_project.targets.each do |target|\n      target.build_configurations.each do |config|\n        config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'\n        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'\n\n        # RNFirebase modules can miscompile under framework modules with Xcode 16+.\n        if target.name.start_with?('RNFB')\n          config.build_settings['CLANG_ENABLE_MODULES'] = 'NO'\n          config.build_settings['DEFINES_MODULE'] = 'NO'\n        end\n      end\n    end\n`;

        if (podfile.includes('post_install do |installer|')) {
          podfile = podfile.replace(/post_install do \|installer\|\n/, `post_install do |installer|\n${insertion}`);
        }
      }

      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
}

module.exports = withFirebaseFix;
