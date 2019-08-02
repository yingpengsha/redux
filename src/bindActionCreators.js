function bindActionCreator(actionCreator, dispatch) {
  // 返回一个将两者绑定的函数，顺便把到时候的运行上下文和参数传给creator
  return function() {
    return dispatch(actionCreator.apply(this, arguments))
  }
}

/**
 * Turns an object whose values are action creators, into an object with the
 * same keys, but with every function wrapped into a `dispatch` call so they
 * may be invoked directly. This is just a convenience method, as you can call
 * `store.dispatch(MyActionCreators.doSomething())` yourself just fine.
 *
 * For convenience, you can also pass an action creator as the first argument,
 * and get a dispatch wrapped function in return.
 *
 * @param {Function|Object} actionCreators An object whose values are action
 * creator functions. One handy way to obtain it is to use ES6 `import * as`
 * syntax. You may also pass a single function.
 *
 * @param {Function} dispatch The `dispatch` function available on your Redux
 * store.
 *
 * @returns {Function|Object} The object mimicking the original object, but with
 * every action creator wrapped into the `dispatch` call. If you passed a
 * function as `actionCreators`, the return value will also be a single
 * function.
 */
export default function bindActionCreators(actionCreators, dispatch) {
  // actionCreators 一个 action creator，或者一个 value 是 action creator 的对象。
  // dispatch 一个由 Store 实例提供的 dispatch 函数

  // 如果是函数，则说明传进来的只有一个 creator,直接返回将两者绑定的函数
  if (typeof actionCreators === 'function') {
    return bindActionCreator(actionCreators, dispatch)
  }

  // 如果传进来的 actionCreators 不是函数，也不是对象，或者干脆为空则直接抛出错误
  if (typeof actionCreators !== 'object' || actionCreators === null) {
    throw new Error(
      `bindActionCreators expected an object or a function, instead received ${
        actionCreators === null ? 'null' : typeof actionCreators
      }. ` +
        `Did you write "import ActionCreators from" instead of "import * as ActionCreators from"?`
    )
  }

  // 既然传进来的是一个 value 是 action creator 的对象，那就遍历一边，把里面每个 creator 覆盖为新的绑定过的 creator
  const boundActionCreators = {}
  for (const key in actionCreators) {
    const actionCreator = actionCreators[key]
    if (typeof actionCreator === 'function') {
      boundActionCreators[key] = bindActionCreator(actionCreator, dispatch)
    }
  }

  // 返回新的 action creator 组成的对象
  return boundActionCreators
}

// actionCreators 示例

function addTodo(text) {
  return {
    type: 'ADD_TODO',
    text
  }
}

function removeTodo(id) {
  return {
    type: 'REMOVE_TODO',
    id
  }
}
