import appRootPath from 'app-root-path';
import path from 'path';
import BaseMigration from './base-migration.js';

class TelemetryModuleUserConfigurationMigration extends BaseMigration {
    async executeMigration() {
        const configurationFolderPath = path.join(appRootPath.path, '..');
        const configurationFilePath = path.join(
            configurationFolderPath,
            this.config.configFilename,
        );

        const userConfiguration = await this.fileService.readFile(configurationFilePath, true);

        let newTelemetryConfig;

        if ('telemetry' in userConfiguration) {
            const oldConfigTelemetry = userConfiguration.telemetry;
            newTelemetryConfig = {
                enabled: oldConfigTelemetry.enabled,
                implementation: {
                    'ot-telemetry': {
                        enabled: oldConfigTelemetry.enabled,
                        package: './telemetry/implementation/ot-telemetry.js',
                        config: {
                            sendTelemetryData: oldConfigTelemetry.sendTelemetryData,
                            signalingServerUrl: oldConfigTelemetry.signalingServerUrl,
                        },
                    },
                },
            };

            delete userConfiguration.telemetry;
            userConfiguration.modules.telemetry = newTelemetryConfig;

            await this.fileService.writeContentsToFile(
                configurationFolderPath,
                this.config.configFilename,
                JSON.stringify(userConfiguration, null, 4),
            );
        }
    }
}

export default TelemetryModuleUserConfigurationMigration;
