const assert = require('assert');
const MiddlewareManager = require('../src/MiddlewareManager');

const wait = (ms) => new Promise((resolve, reject) => {
  setTimeout(resolve, ms || 0);
})

describe('MiddlewareManager', () => {
  it('中间件的执行顺序正确', async() => {
    const manager = new MiddlewareManager()
    const context = {
      str: ''
    }
    function middleware1(context, next){
      context.str += '1' 
      next();
      context.str += '3' 
    }
    function middleware2(context, next){
      context.str += '2' 
      return context;
    }
    manager.use(middleware1);
    manager.use(middleware2);
    const fn = manager.getMiddlewaresFn();
    fn(context)
    assert(context.str === '123', "中间件的执行顺序不正确")
  })
})