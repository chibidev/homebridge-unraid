import cloneDeep = require("lodash.clonedeep");
import merge = require("lodash.merge");
import { compose } from "../util/functional";

export interface Config {
}

export interface Traits<T> {
    defaultConfig: T;
    versionFunction: (config: Config) => number;
    currentVersionNumber: number;
    migrationSequence: Function[];
}

function createMigrationFunction<T>(versionFunction: (config: Config) => number, currentVersionNumber: number, migrationSequence: Function[]) {
    return (config: Config) => {
        let version = versionFunction(config)
        if (version == currentVersionNumber)
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
    
    const migrate = createMigrationFunction<T>(traits.versionFunction, traits.currentVersionNumber, traits.migrationSequence);
    const migratedConfig = cloneDeep(migrate(config));
    const initialConfig = cloneDeep(traits.defaultConfig);
    const result = merge({}, initialConfig, migratedConfig) as T;

    return result;
}

export function nextVersion(previousVersionNumber: number): number {
    return previousVersionNumber + 1;
}

export const InitialVersionNumber = 0;