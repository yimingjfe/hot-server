const compose = require('koa-compose');

class MiddlewareManager{
  constructor(){
    this.middlewares = [];
  }
  use(middleware){
    this.middlewares.push(middleware);
  }
  getMiddlewaresFn(next){
    return compose(this.middlewares, next);
  }
}

module.exports = MiddlewareManager;