import cloneDeep = require("lodash.clonedeep");
import merge = require("lodash.merge");
import { compose } from "../util/functional";

export type Version = number;
export type VersionFunction = (config: Config) => Version;

export interface Config {
}

export interface Traits<T> {
    defaultConfig: T;
    versionFunction: VersionFunction;
    currentVersionIdentifier: Version;
    migrationSequence: Function[];
}

function createMigrationFunction<T>(versionFunction: VersionFunction, currentVersionIdentifier: Version, migrationSequence: Function[]) {
    return (config: Config) => {
        let version = versionFunction(config)
        if (version == currentVersionIdentifier)
            return config as T;

        const seq = migrationSequence.slice(0, migrationSequence.length - version);
        let migrationFunction = compose(seq);
        let newConfig = migrationFunction(config) as T;

        return newConfig;
    };
}

export function initialize<T>(config: Config | null, traits: Traits<T>): T {
    if (!config)
        return traits.defaultConfig;
    
    const migrate = createMigrationFunction<T>(traits.versionFunction, traits.currentVersionIdentifier, traits.migrationSequence);
    const migratedConfig = cloneDeep(migrate(config));
    const initialConfig = cloneDeep(traits.defaultConfig);
    const result = merge({}, initialConfig, migratedConfig) as T;

    return result;
}

export function nextVersion(previousVersionIdentifier: Version): Version {
    return previousVersionIdentifier + 1;
}

export const InitialVersionIdentifier = 0;