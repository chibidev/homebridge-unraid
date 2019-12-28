export function difference<T, U>(lhs: T[], rhs: U[], predicate: (t: T, u: U) => boolean): T[] {
    const result = lhs.filter((t) => {
        const findFunction = predicate.bind(null, t);
        const found = rhs.find(findFunction) != undefined;

        return !found;
    });

    return result;
}