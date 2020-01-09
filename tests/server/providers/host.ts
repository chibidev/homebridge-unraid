import { HostAccessoryProvider } from "../../../src/server/providers/host";
import { CommandExecutor } from "../../../src/server/commands";
import { Config } from "../../../src/server/models/config";

class MockExecutor implements CommandExecutor {
    run = jest.fn();
}

import ping = require("ping");
import { PlatformAccessories } from "../../../src/server/provider";
jest.mock("ping");

describe("Host Accessory Provider", () => {
    test("Inaccessible, unconfigured server publishes no accessory and runs nothing", async () => {
        let config = {
        } as Config.HostConfig;

        ping.promise.probe = jest.fn().mockImplementationOnce((ip) => {
            return new Promise((resolve, reject) => {
                resolve({
                    alive: false
                } as ping.PingResponse);
            });
        });

        let mockExecutor = new MockExecutor();
        let provider = new HostAccessoryProvider(mockExecutor, config);

        let accessories = await provider.accessories();
        expect(accessories.length).toBe(0);
        expect(mockExecutor.run.mock.calls.length).toBe(0);
    });

    test("Inaccessible, configured server publishes switched off (same) accessory and runs nothing", async () => {
        let config = {
            mac: "awesomemac",
            ip: "awesomeip"
        } as Config.HostConfig;

        ping.promise.probe = jest.fn().mockImplementationOnce((ip) => {
            expect(ip).toBe("awesomeip");
            return new Promise((resolve, reject) => {
                resolve({
                    alive: false
                } as ping.PingResponse);
            });
        });

        let cachedAccessory = new PlatformAccessories.Switch("awesomemachine");

        let mockExecutor = new MockExecutor();
        let provider = new HostAccessoryProvider(mockExecutor, config);
        provider.configureAccessory(cachedAccessory);

        let accessories = await provider.accessories();
        expect(accessories.length).toBe(1);
        expect(accessories[0]).toBe(cachedAccessory);
        expect(accessories[0].displayName).toBe("awesomemachine");
        expect(mockExecutor.run.mock.calls.length).toBe(0);
    });

    test("Accessible, unconfigured server publishes new accessory", async () => {
        let config = {
            mac: "awesomemac",
            ip: "awesomeip"
        } as Config.HostConfig;

        ping.promise.probe = jest.fn().mockImplementationOnce((ip) => {
            expect(ip).toBe("awesomeip");
            return new Promise((resolve, reject) => {
                resolve({
                    alive: true
                } as ping.PingResponse);
            });
        });

        let mockExecutor = new MockExecutor();
        let provider = new HostAccessoryProvider(mockExecutor, config);

        mockExecutor.run.mockImplementationOnce((command) => {
            return new Promise((resolve, reject) => {
                resolve("awesomemachine");
            });
        });

        let accessories = await provider.accessories();
        expect(accessories.length).toBe(1);
        expect(accessories[0].displayName).toBe("awesomemachine");
    });

    test("Accessible, configured server publishes same accessory", async () => {
        let config = {
            mac: "awesomemac",
            ip: "awesomeip"
        } as Config.HostConfig;

        ping.promise.probe = jest.fn().mockImplementationOnce((ip) => {
            expect(ip).toBe("awesomeip");
            return new Promise((resolve, reject) => {
                resolve({
                    alive: true
                } as ping.PingResponse);
            });
        });

        let cachedAccessory = new PlatformAccessories.Switch("awesomemachine");

        let mockExecutor = new MockExecutor();
        let provider = new HostAccessoryProvider(mockExecutor, config);
        provider.configureAccessory(cachedAccessory);

        mockExecutor.run.mockImplementationOnce((command) => {
            return new Promise((resolve, reject) => {
                resolve("awesomemachine");
            });
        });

        let accessories = await provider.accessories();
        expect(accessories.length).toBe(1);
        expect(accessories[0].displayName).toBe("awesomemachine");
        expect(accessories[0]).toBe(cachedAccessory);
    });

    test("Accessible, configured server with different name publishes new accessory", async () => {
        let config = {
            mac: "awesomemac",
            ip: "awesomeip"
        } as Config.HostConfig;

        ping.promise.probe = jest.fn().mockImplementationOnce((ip) => {
            expect(ip).toBe("awesomeip");
            return new Promise((resolve, reject) => {
                resolve({
                    alive: true
                } as ping.PingResponse);
            });
        });

        let cachedAccessory = new PlatformAccessories.Switch("awesomemachine");

        let mockExecutor = new MockExecutor();
        let provider = new HostAccessoryProvider(mockExecutor, config);
        provider.configureAccessory(cachedAccessory);

        mockExecutor.run.mockImplementationOnce((command) => {
            return new Promise((resolve, reject) => {
                resolve("newawesomemachine");
            });
        });

        let accessories = await provider.accessories();
        expect(accessories.length).toBe(1);
        expect(accessories[0].displayName).toBe("newawesomemachine");
        expect(accessories[0]).not.toBe(cachedAccessory);
    });

    test("New accessory removes the other from cache", async () => {
        // cannot access cache at the moment, needs refactor
    });
});