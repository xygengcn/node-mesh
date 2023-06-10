export class MapArray<T extends object> {
    /**
     * 数组
     */
    private _array: T[] = [];

    /**
     * 索引
     */
    private _map: Map<T[keyof T], T> = new Map();

    /**
     * 索引
     */
    private primaryKey: keyof T;

    /**
     * 初始化
     * @param primaryKey
     * @param items
     */
    constructor(primaryKey: keyof T, ...items: T[]) {
        this.primaryKey = primaryKey;
        if (typeof this.primaryKey !== 'string' || !this.primaryKey.trim()) {
            throw TypeError('primaryKey is error');
        }
        this.push(...items);
    }

    /**
     * 迭代器
     * @returns
     */
    public [Symbol.iterator](): IterableIterator<T> {
        let index = 0;
        const iterator: IterableIterator<T> = {
            next: (): IteratorResult<T> => {
                if (index < this._array.length) {
                    const value = this._array[index];
                    index++;
                    return { value, done: false };
                } else {
                    return { value: undefined as any, done: true };
                }
            },
            [Symbol.iterator]: function (): IterableIterator<T> {
                throw new Error('Function not implemented.');
            }
        };
        return iterator;
    }

    public push(...items: T[]) {
        items.forEach((item) => {
            if (item[this.primaryKey]) {
                this.definePrimaryKeyUnWriteable(item);
                this._map.set(item[this.primaryKey], item);
                this._array.push(item);
            }
        });
        return this._array.length;
    }

    public pop(): T | undefined {
        return this._array.pop();
    }

    /**
     * for循环
     */
    public forEach(callbackfn: (value: T, index: number, array: T[]) => void): void {
        for (let i = 0; i < this._array.length; i++) {
            callbackfn(this._array[i], i, this._array);
        }
    }

    /**
     *
     * @param callbackfn
     */
    public map<U>(callbackfn: (value: T, index: number, array: T[]) => U): U[] {
        return this._array.map(callbackfn, this._array);
    }

    /**
     * 保证primary不被修改
     * @param item
     */
    private definePrimaryKeyUnWriteable(item: T) {
        Object.defineProperty(item, this.primaryKey, {
            writable: false,
            value: item[this.primaryKey]
        });
    }
}
