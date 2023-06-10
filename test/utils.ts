/**
 * 多次done
 * @param time
 * @param expression
 * @param done
 */

export function doneTimes(time: number, done: () => void) {
    return (expression?: boolean) => {
        if (expression ?? true) {
            time--;
        }
        if (time === 0) {
            done();
            time = null;
        }
    };
}
