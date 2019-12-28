export async function map<T, U>(promise: Promise<T[]>, generator: (element: T) => U) : Promise<U[]> {
    return wrapForPromise<T[], U[]>(Array.prototype.map, promise, generator);
}

export async function flat<T>(promise: Promise<T[][]>) : Promise<T[]> {
    return wrapForPromise<T[][], T[]>(Array.prototype.flat, promise);
}

async function wrapForPromise<T, U>(func: (...args: any[]) => U, promise: Promise<T>, ...params: any[]) {
    const result = promise.then((value) => {
        return func.call(value, ...params);
    });
    return result;
}