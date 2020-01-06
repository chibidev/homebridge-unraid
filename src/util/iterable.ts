export {};

declare global {
    interface Array<T> {
        difference<U>(toArray: U[], predicate: (lhs: T, rhs: U) => boolean): T[];
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