import '../../src/util/iterable';

describe('Extensions on iterables', () => {
    test('Difference of empty arrays is empty array', () => {
        let array: any[] = [];
        let otherArray: any[] = [];
        let result = array.difference(otherArray, (lhs, rhs) => {
            return lhs == rhs;
        });

        expect(result.length).toBe(0);
    });

    test('Difference of empty lhs array is empty array', () => {
        let array: any[] = [];
        let otherArray = [1,2,3];
        let result = array.difference(otherArray, (lhs, rhs) => {
            return lhs == rhs;
        });

        expect(result.length).toBe(0);
    });

    test('Difference of empty rhs array is lhs array', () => {
        let array = [1,2,3];
        let otherArray: number[] = [];
        let result = array.difference(otherArray, (lhs, rhs) => {
            return lhs == rhs;
        });

        expect(result.length).toBe(3);
        for (let i = 1; i < 4; ++i) {
            expect(result[i]).toBe(array[i]);
        }
    });

    test('Difference of no intersection is lhs array', () => {
        let array = [1,2,3];
        let otherArray = [4,5,6];
        let result = array.difference(otherArray, (lhs, rhs) => {
            return lhs == rhs;
        });

        expect(result.length).toBe(3);
        for (let i = 1; i < 4; ++i) {
            expect(result[i]).toBe(array[i]);
        }
    });

    test('Difference of two arrays is the elements of the lhs minus the intersection', () => {
        let array = [1,2,3];
        let otherArray = [2,3,4];
        let result = array.difference(otherArray, (lhs, rhs) => {
            return lhs == rhs;
        });

        expect(result.length).toBe(1);
        expect(result[0]).toBe(1);
    });
});