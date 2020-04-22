export function compose(fns: Function[]): Function {
    return (x: any) => {
        return fns.reduceRight((previousResult, currentFunction) => currentFunction(previousResult), x);
    };
}

export function identity<T>(x: T): T {
    return x;
}