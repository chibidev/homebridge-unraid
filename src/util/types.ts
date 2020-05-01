export type NonConstMethod<T> = {};

export type Const<T> = {
    readonly [P in keyof T]: ThisParameterType<T[P]> extends Const<T> ? T[P] : T[P] extends Function ? NonConstMethod<T[P]> : Const<T[P]>;
}