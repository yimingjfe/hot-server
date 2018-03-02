exports.throttle = (func, time) => {
  if(typeof func !== 'function') throw TypeError('need a function')
  return function(...args){
    clearTimeout(func.timeId);
    func.timeId = setTimeout(() => {
      func.apply(null, args)
    }, time)
  }
}