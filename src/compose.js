/**
 * combineReducers 是用来整合 createStore 所需的 reducers
 * 那 compose 就是用来整合 createStore 所需的 enhancers
 * 
 * 往往的使用场景就是我们需要为 store 添加一个中间件和一个 dev-tool 的时候需要 compass
 * 因为 createStore 的 enhancers 只接收一个☝️ function
 * compose 的效果就是将多个 function 变成一个☝️ function
 * 
 * 但实际上没有太多 redux 的内容在里面，把它视为一个🔧工具函数也是可以的
 * 比如借用这个思路来结合 HOC 来实现许多复杂的操作，不局限于此时此地
 * 
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */

export default function compose(...funcs) {
  // 将所有传入的 function 利用结构语法放入到 funcs
  // 如果压根就没有或者只有一个，就直接返回
  if (funcs.length === 0) {
    return arg => arg
  }

  if (funcs.length === 1) {
    return funcs[0]
  }

  // args 是最终形成后传入的参数
  // 大体过程可以简单描述一下：
  // 假设有三个增强函数 funcs: [one, two, three]
  // 然后实际调用的效果为 three(two(one(args)))
  // one(args) 返回 oneResult
  // two(oneResult) 返回 twoResult
  // three(twoResult) 返回 finalResult
  return funcs.reduce((a, b) => (...args) => a(b(...args)))
}
