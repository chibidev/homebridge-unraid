import * as Util from '../../src/util/events';

// No need for heavy tests as this is essentially
// a wrapper.

interface Events {
    ItHappened: string;
}

class Emitter extends Util.TypedEventEmitter<Events> {
    public emitForwarder<K extends keyof Events>(name: K, value: Events[K], ...params: any[]): boolean {
        return this.emit(name, value, ...params);
    }
}

describe('Typed Event Emitter', () => {
    test('Subscriber should be called exactly once', () => {
        let emitter = new Emitter();

        let called = 0;
        emitter.on("ItHappened", (value) => {
            ++called;
        });
        emitter.emitForwarder("ItHappened", "");

        expect(called).toBe(1);
    });

    test('Value should be passed to subscriber', () => {
        let emitter = new Emitter();

        let called = false;
        emitter.on("ItHappened", (value) => {
            called = true;
            expect(value).toBe("stringValue");
        });
        emitter.emitForwarder("ItHappened", "stringValue");

        expect(called).toBe(true);
    });

    test('All values should be passed to subscriber', () => {
        let emitter = new Emitter();

        let called = false;
        emitter.on("ItHappened", (stringValue, numberValue, nullValue) => {
            called = true;
            expect(stringValue).toBe("stringValue");
            expect(numberValue).toBe(1);
            expect(nullValue).toBe(null);
        });
        emitter.emitForwarder("ItHappened", "stringValue", 1, null);

        expect(called).toBe(true);
    });
});