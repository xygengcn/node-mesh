export default class ArraySet<T> extends Set<T> {
    /**
     * 变数组
     * @returns
     */
    public toArray(): T[] {
        return Array.from(this);
    }
}
