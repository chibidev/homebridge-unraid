export {};

interface ArrayCompareResult<T> {
    new: T[];
    deleted: T[];
    intersection: T[];
}

declare global {
    interface Array<T> {
        difference<U>(toArray: U[], predicate: (lhs: T, rhs: U) => boolean): T[];
        compare(toArray: T[], predicate: (lhs: T, rhs: T) => boolean): ArrayCompareResult<T>;
    }
}

// Don't use Array.prototype.difference = function()... Something in HomeBridge breaks if the function is enumerable.

Object.defineProperty(Array.prototype, "difference", {
    value: function<T, U>(this: Array<T>, toArray: U[], predicate: (lhs: T, rhs: U) => boolean): T[] {
        const result = this.filter((t) => {
            const findFunction = predicate.bind(null, t);
            const found = toArray.find(findFunction) != undefined;

            return !found;
        });

        return result;
    }
});

Object.defineProperty(Array.prototype, "compare", {
    value: function<T>(this: Array<T>, toArray: T[], predicate: (lhs: T, rhs: T) => boolean): ArrayCompareResult<T> {
        const result = {
            new: this.filter(t => {
                for (let e of toArray) {
                    if (predicate(t, e))
                        return false;
                }
                return true;
            }),
            deleted: toArray.filter(t => {
                for (let e of this) {
                    if (predicate(t, e))
                        return false;
                }
                return true;
            }),
            intersection: this.filter(t => {
                for (let e of toArray) {
                    if (predicate(t, e))
                        return true;
                }
                return false;
            })
        }

        return result;
    }
});