export function compose(fns: Function[]): Function {
    let f : Function = identity;

    fns.forEach((fn) => {
        f = (x: any) => {
            return fn(f(x));
        };
    })
    return f;
}

export function identity<T>(x: T): T {
    return x;
}