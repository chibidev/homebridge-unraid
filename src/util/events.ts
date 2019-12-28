import { EventEmitter } from "events";

export class TypedEventEmitter<T> {
    public constructor() {
        this.emitter = new EventEmitter();
    }
    public on<K extends keyof T>(name: K, listener: (value: T[K], ...params: any[]) => void): this {
        this.emitter.on(name.toString(), listener);
        return this;
    }

    protected emit<K extends keyof T>(name: K, value: T[K], ...params: any[]): boolean {
        return this.emitter.emit.call(this.emitter, name.toString(), value, ...params);
    }

    private emitter: EventEmitter;
}