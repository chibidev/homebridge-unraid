interface StringIndexable {
    [key: string]: any;
}

export class MappedObject {
    public constructor(obj: any) {
        this._object = obj;
    }

    public to<ClassType extends new () => InstanceType<ClassType>>(classType: ClassType) {
        let instance = new classType() as StringIndexable;
        for (let property in this._object) {
            instance[property] = this._object[property];
        }

        return instance as InstanceType<ClassType>;
    }

    public assignTo<T>(other: T): T {
        let indexableOther = other as StringIndexable;
        for (let property in this._object)
            indexableOther[property] = this._object[property];

        return other;
    }

    private _object: any;
}

export function map(obj: any) {
    return new MappedObject(obj);
}