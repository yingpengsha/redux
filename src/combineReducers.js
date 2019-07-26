import ActionTypes from './utils/actionTypes'
import warning from './utils/warning'
import isPlainObject from './utils/isPlainObject'

/**
 * 当获取到 undefined 时进行报错
 *
 * @param {*} key
 * @param {*} action
 * @returns
 */
function getUndefinedStateErrorMessage(key, action) {
  // 提取 actionType
  const actionType = action && action.type
  // 组成报错信息
  const actionDescription =
    (actionType && `action "${String(actionType)}"`) || 'an action'
  // 返回，然后抛出
  return (
    `Given ${actionDescription}, reducer "${key}" returned undefined. ` +
    `To ignore an action, you must explicitly return the previous state. ` +
    `If you want this reducer to hold no value, you can return null instead of undefined.`
  )
}

/**
 * 当在非生产环境时调用 reducer 时便会触发这个函数
 *
 * @param {*} inputState // 当前的 state
 * @param {*} reducers // reducer 集合
 * @param {*} action // 调用的 action
 * @param {*} unexpectedKeyCache // 报错缓存
 * @returns // 报错信息
 */ 
function getUnexpectedStateShapeWarningMessage(
  inputState,
  reducers,
  action,
  unexpectedKeyCache
) {
  // 取出 reducers 里的 key 值，存入数组
  const reducerKeys = Object.keys(reducers)
  // 如果 actionType 与 redux 自身保留的 ActionType.INIT 一致了说明正在初始化，反之正在调用 reducer
  const argumentName =
    action && action.type === ActionTypes.INIT
      ? 'preloadedState argument passed to createStore'
      : 'previous state received by the reducer'

  // 如果 reducers 数量为 0，则直接返回报错信息。
  if (reducerKeys.length === 0) {
    return (
      'Store does not have a valid reducer. Make sure the argument passed ' +
      'to combineReducers is an object whose values are reducers.'
    )
  }

  // 如果传入的 State 不是普通对象，则返回相应的报错信息，让其返回正确的 state
  if (!isPlainObject(inputState)) {
    return (
      `The ${argumentName} has unexpected type of "` +
      {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
      `". Expected argument to be an object with the following ` +
      `keys: "${reducerKeys.join('", "')}"`
    )
  }

  // 存储已经 reducers 里没有的，但是 state 里有的属性
  const unexpectedKeys = Object.keys(inputState).filter(
    key => !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key]
  )

  // 给刚添加的键添加值
  unexpectedKeys.forEach(key => {
    unexpectedKeyCache[key] = true
  })

  // 如果 actionType 时重制 reducer 用的，则直接跳出
  if (action && action.type === ActionTypes.REPLACE) return

  // 如果有 reducers 里没有的，但是 state 里有的属性，则返回相应的报错。
  if (unexpectedKeys.length > 0) {
    return (
      `Unexpected ${unexpectedKeys.length > 1 ? 'keys' : 'key'} ` +
      `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
      `Expected to find one of the known reducer keys instead: ` +
      `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
    )
  }
}

/**
 * 检测 reducers 中的 reducer 是否合法
 * 检测方式是判断他们初始化后返回的值是否为 undefined
 * 
 * @param {*} reducers
 */
function assertReducerShape(reducers) {
  // 遍历 reducers，本质上跟 for … in … 没什么区别
  Object.keys(reducers).forEach(key => {
    const reducer = reducers[key]

    // 将每一个单独的 reducer 进行初始化
    const initialState = reducer(undefined, { type: ActionTypes.INIT })

    // 如果初始化的结果是 undefined，则抛出错误
    if (typeof initialState === 'undefined') {
      throw new Error(
        `Reducer "${key}" returned undefined during initialization. ` +
          `If the state passed to the reducer is undefined, you must ` +
          `explicitly return the initial state. The initial state may ` +
          `not be undefined. If you don't want to set a value for this reducer, ` +
          `you can use null instead of undefined.`
      )
    }

    // 再使用随机的 actionType 来初始化校验一下
    // 疑惑🤔 明明 ActionTypes.INIT 其实也是随机的，不太可能会和开发者自定义的 actionType 一致为什么还要这么做呢
    // 双重保险？从报错信息中我们可以知道，报错信息会提示开发者不要有和 ActionTypes.INIT 一致 actionType
    if (
      typeof reducer(undefined, {
        type: ActionTypes.PROBE_UNKNOWN_ACTION()
      }) === 'undefined'
    ) {
      throw new Error(
        `Reducer "${key}" returned undefined when probed with a random type. ` +
          `Don't try to handle ${ActionTypes.INIT} or other actions in "redux/*" ` +
          `namespace. They are considered private. Instead, you must return the ` +
          `current state for any unknown actions, unless it is undefined, ` +
          `in which case you must return the initial state, regardless of the ` +
          `action type. The initial state may not be undefined, but can be null.`
      )
    }
  })
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */
export default function combineReducers(reducers) {
  // 将所有 reducers 的 key 值组成一个数组，详情请看 Object.keys()
  const reducerKeys = Object.keys(reducers)
  // 一个新的 reducers，用于存放各种过滤后合法的 reducers 集合
  const finalReducers = {}
  // 遍历 reducer 的 key 值
  for (let i = 0; i < reducerKeys.length; i++) {
    const key = reducerKeys[i]

    // 如果是非生产环境，发现传入的 reducer 中有🈳️的，则抛出 warning
    if (process.env.NODE_ENV !== 'production') {
      if (typeof reducers[key] === 'undefined') {
        warning(`No reducer provided for key "${key}"`)
      }
    }

    // 如果是函数则导入新的 reducers 中
    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key]
    }
  }

  // 上述过程只是初步过滤了一下传进来为空的 reducer。

  // 将所有合法 reducers 的 key 值排成一个数组
  const finalReducerKeys = Object.keys(finalReducers)

  // This is used to make sure we don't warn about the same
  // keys multiple times.
  // unexpectedKeyCache 包含所有 state 中有但是 reducers 中没有的属性。
  let unexpectedKeyCache
  if (process.env.NODE_ENV !== 'production') {
    unexpectedKeyCache = {}
  }

  // 存放 reducer 不合法的报错
  let shapeAssertionError
  // 去遍历初始化每一个 reducer，如果初始化结果为 undefined，则说明不合法
  // 不合法归不合法，但不会在此时抛出错误，而是在 createStore 第一次使用组合起来的 reducer 的时候抛出错误
  try {
    assertReducerShape(finalReducers)
  } catch (e) {
    shapeAssertionError = e
  }

  // 最终组合起来的 reducer
  return function combination(state = {}, action) {
    // 在使用时抛出此前校验时的错误
    if (shapeAssertionError) {
      throw shapeAssertionError
    }

    // 如果是不是生产环境
    // 则去校验一系列错误，进行报错
    if (process.env.NODE_ENV !== 'production') {
      const warningMessage = getUnexpectedStateShapeWarningMessage(
        state,
        finalReducers,
        action,
        unexpectedKeyCache
      )
      if (warningMessage) {
        warning(warningMessage)
      }
    }

    // 是否发生了变化
    let hasChanged = false
    // 存储新的 State
    const nextState = {}
    // 遍历 Reducers
    for (let i = 0; i < finalReducerKeys.length; i++) {
      // 当前 key 值
      const key = finalReducerKeys[i]
      // 当前 reducer
      const reducer = finalReducers[key]
      // 当前 redcuer 对应的 state
      const previousStateForKey = state[key]
      // 无差别对所有 reducer 进行 dispatch
      const nextStateForKey = reducer(previousStateForKey, action)
      // 如果 reducer 之后的值为 undefined，则校验获取报错信息，抛出。
      if (typeof nextStateForKey === 'undefined') {
        const errorMessage = getUndefinedStateErrorMessage(key, action)
        throw new Error(errorMessage)
      }
      // 存放新的 state
      nextState[key] = nextStateForKey
      // 如果 state 发生了变化则标记
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey
    }
    // 如果发生的变化则返回新的 state，反之返回旧的
    return hasChanged ? nextState : state
  }
}
