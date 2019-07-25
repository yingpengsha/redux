/**
 * 判断传入的变量是不是简单对象
 *
 * @param {any} obj The object to inspect. 一个任何类型的变量
 * @returns {boolean} True if the argument appears to be a plain object. 返回这个变量是不是简单对象
 */
export default function isPlainObject(obj) {
  // 初步过滤，使用 typeof 保证变量属于 typeof 中的 Object
  // typeof 中不止普通对象是 Object，还有 null 和 DOM 等
  if (typeof obj !== 'object' || obj === null) return false

  // 利用 while 循环和 Object.getPrototypeOf() 方法得到 Object.prototype
  let proto = obj
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto)
  }

  // 如果变量的原型是 Object.prototype 则说明是普通对象
  return Object.getPrototypeOf(obj) === proto
}
