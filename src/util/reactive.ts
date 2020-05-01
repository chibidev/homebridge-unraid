import { EventEmitter } from "events";

export function observed(target: any, key: string) {
    const storagePropertyName = "_" + key;
    Object.defineProperty(target, storagePropertyName, {
        writable: true
    });

    const accessor = function(this: any) {
        return this[storagePropertyName];
    }

    const mutator = function(this: any, value: any) {
        this[storagePropertyName] = value;
        this.emit("update", this);
    }

    delete target[key];
    Object.defineProperty(target, key, {
        get: accessor,
        set: mutator
    });
}

interface ArrayEvents<T> {
    new: T;
    delete: T;
}

// export class ReadOnlyArray<T> {
// }

export class ObservableArray<T> extends Array<T> {
    public constructor() {
        super();
        this.emitter = new EventEmitter();
    }

    public pop(): T | undefined {
        const result = super.pop();

        if (result !== undefined)
            this.emit("delete", result);

        return result;
    }

    public push(...items: T[]): number {
        const result = super.push(...items);

        items.forEach((item) => {
            this.emit("new", item);
        });

        return result;
    }

    public remove(item: T): void {
        const index = super.indexOf(item);
        if (! (index < 0))
            super.splice(index, 1);

        this.emit("delete", item);
    }

    public on<K extends keyof ArrayEvents<T>>(name: K, listener: (value: ArrayEvents<T>[K], ...params: any[]) => void): this {
        this.emitter.on(name, listener);
        return this;
    }

    public clear() {
        this.forEach((element) => {
            this.emit("delete", element);
        });
        this.length = 0;
    }

    protected emit<K extends keyof ArrayEvents<T>>(name: K, value: ArrayEvents<T>[K], ...params: any[]): boolean {
        return this.emitter.emit(name, value, ...params);
    }

    private emitter: EventEmitter;
}

// export class DerivedObservableArray<T> extends ReadOnlyArray<T> {
//     public constructor<U>(array: ObservableArray<U>, map: (item: U) => T) {
//         super();
//         array.on("new", (value) => {
//         });
//         array.on("delete", (value) => {
//         });
//     }

//     public on<K extends keyof ArrayEvents<T>>(name: K, listener: (value: ArrayEvents<T>[K], ...params: any[]) => void): this {
//         this.emitter.on(name, listener);
//         return this;
//     }

//     protected emit<K extends keyof ArrayEvents<T>>(name: K, value: ArrayEvents<T>[K], ...params: any[]): boolean {
//         return this.emitter.emit(name, value, ...params);
//     }

//     private emitter: EventEmitter;
// }