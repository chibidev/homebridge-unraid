export {};

declare global {
    interface Promise<T> {
        forEach<U>(this: Promise<U[]>, loop: (element: U) => void): Promise<void>;
        flat<U>(this: Promise<U[][]>): Promise<U[]>;
        map<U, V>(this: Promise<U[]>, mapping: (element: U) => V): Promise<V[]>;
    }
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