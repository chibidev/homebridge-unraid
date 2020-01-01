import * as Util from '../../src/util/promise';

function makePromise<T>(value: T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        resolve(value);
    });
}

// No need to write exhaustive tests - these are
// just wrappers over the built-in functions. I
// don't want to test them, I expect them to do
// what they should.

// Look for use-cases in the source and test those.

describe('flat operating on promises', () => {
    test('Flattening empty array should produce empty array', async () => {
        let value = makePromise([] as any[][]);
        let result = await Util.flat(value);

        expect(result.length).toBe(0);
    });

    test('Single value produces single element array', async () => {
        let value = makePromise([[1]]);
        let result = await Util.flat(value);

        expect(result.length).toBe(1);
        expect(result[0]).toBe(1);
    });

    test('Same dimension elements should produce single dimension with all elements', async () => {
        let value = makePromise([[0, 1, 2], [3, 4, 5]]);
        let result = await Util.flat(value);
        expect(result.length).toBe(6);
        for (let i = 0; i < 6; ++i) {
            expect(result[i]).toBe(i);
        }
    });

    test('Different length arrays are correctly concatenated', async () => {
        let value = makePromise([[0,1], [2,3,4,5], [6,7,8]]);
        let result = await Util.flat(value);
        expect(result.length).toBe(9);
        for (let i = 0; i < 9; ++i) {
            expect(result[i]).toBe(i);
        }
    });
});

describe('map operating on promises', () => {
    test('Mapping empty array should produce empty array', async () => {
        let value = makePromise([]);
        let result = await Util.map(value, () => {
            return 1;
        });

        expect(result.length).toBe(0);
    });

    test('Single element array should produce single element array with appropriate value', async () => {
        let value = makePromise([1]);
        let result = await Util.map(value, (value) => {
            return value.toString();
        });

        expect(result.length).toBe(1);
        expect(result[0]).toBe("1");
    });
});