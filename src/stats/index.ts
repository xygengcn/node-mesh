/**
 * 数据统计
 */
export default class Stats {
    /**
     * 循环定时器
     */
    private interval: NodeJS.Timer;

    /**
     * 结果
     */
    private _data: number[] = [];

    /**
     * 计数
     */
    private counter: number = 0;

    constructor(time: number) {
        // 创建定时器
        this.interval = setInterval(() => {
            const data = this.counter;
            this.counter = 0;
            this._data.push(data);
        }, time);
    }

    /**
     * 记录
     */
    public record() {
        this.counter++;
    }

    /**
     * 停止
     */
    public stop() {
        clearInterval(this.interval);
        this.interval = null;
    }

    /**
     * 结果
     * @returns
     */
    public result() {
        const total = this._data.reduce((sum, item) => sum + item, 0);
        return {
            total,
            data: this._data
        };
    }
}
