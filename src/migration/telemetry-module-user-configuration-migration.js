import appRootPath from 'app-root-path';
import path from 'path';
import BaseMigration from './base-migration.js';
import { NODE_ENVIRONMENTS } from '../constants/constants.js';

class TelemetryModuleUserConfigurationMigration extends BaseMigration {
    async executeMigration() {
        if (
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.DEVELOPMENT &&
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.TEST
        )
            return;

        const oldConfig = this.config;

        // sholud this be checked?
        if ('telemetry' in oldConfig.modules) {
            return;
        }

        let newTelemetryConfig;

        if ('telemetry' in oldConfig) {
            const oldConfigTelemetry = oldConfig.telemetry;
            newTelemetryConfig = {
                enabled: oldConfigTelemetry.enabled,
                implementation: {
                    'telemetry-service': {
                        enabled: oldConfigTelemetry.enabled,
                        package: './telemetry/implementation/telemetry-service.js',
                        config: {
                            enabled: oldConfigTelemetry.enabled,
                            sendTelemetryData: oldConfigTelemetry.sendTelemetryData,
                            signalingServerUrl: oldConfigTelemetry.signalingServerUrl,
                        },
                    },
                },
            };
        } else {
            newTelemetryConfig = {
                enabled: false,
                implementation: {
                    'telemetry-service': {
                        enabled: false,
                        package: './telemetry/implementation/telemetry-service.js',
                        config: {
                            enabled: false,
                            sendTelemetryData: false,
                            signalingServerUrl: null,
                        },
                    },
                },
            };
        }
        delete this.config.telemetry;
        this.config.modules.telemetry = newTelemetryConfig;

        const configurationFolderPath = path.join(appRootPath.path);
        await this.fileService.writeContentsToFile(
            configurationFolderPath,
            this.config.configFilename,
            JSON.stringify(this.config, null, 4),
        );
    }
}

export default TelemetryModuleUserConfigurationMigration;
