export {};

declare global {
    interface Promise<T> {
        forEach<U>(this: Promise<U[]>, loop: (element: U) => void): Promise<void>;
        flat<U>(this: Promise<U[][]>): Promise<U[]>;
        map<U, V>(this: Promise<U[]>, mapping: (element: U) => V): Promise<V[]>;
        filter<U>(this: Promise<U[]>, predicate: (element: U) => boolean): Promise<U[]>;
    }

    interface PromiseConstructor {
        Delay(milliseconds: number): Timeout;
        MakeReady(): Promise<void>;
        MakeReady<T>(value: T): Promise<T>;
    }
}

export class Timeout extends Promise<void> {
    public constructor(milliseconds: number) {
        super((resolve, reject) => {
            this.timeout = setTimeout(resolve, milliseconds);
            this.rejectFunction = reject;
        });
    }

    public cancel(): void {
        clearTimeout(this.timeout);
        this.rejectFunction("Timeout cancelled");
    }

    private rejectFunction: (reason?: any) => void;
    private timeout: NodeJS.Timeout;
}

export async function when(condition: Promise<boolean>) {
    return condition.then((value) => {
        return new Promise((resolve, reject) => {
            if (value)
                resolve();
            else
                reject();
        });
    });
}

Promise.prototype.forEach = async function(loop) {
    return this.then((arr) => {
        arr.forEach(loop);
    });
};

Promise.prototype.flat = async function() {
    return this.then((arr) => {
        return arr.flat();
    });
}

Promise.prototype.map = async function(mapping) {
    return this.then((arr) => {
        return arr.map(mapping);
    });
}

Promise.prototype.filter = async function(predicate) {
    return this.then((arr) => {
        return arr.filter(predicate);
    });
}

Promise.Delay = function(milliseconds) {
    return new Timeout(milliseconds);
}

Promise.MakeReady = function<T>(value?: T) {
    return new Promise<T>((resolve) => {
        resolve(value);
    });
}