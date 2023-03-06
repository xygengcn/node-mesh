interface BaseErrorOptions {code:number,message:string,cause:any,name?:string,stack?:unknown}

/**
 * 基础错误
 */
export default class BaseError extends Error {
    // 错误代码
    public code!: number | string;

 

    // 构造函数
    constructor(code:  number|BaseErrorOptions, message?:string) {
        super(message);
        if(typeof code ==="object"){
            Object.assign(this,code)
        }else{
            this.code =code
        }
    }
}
