/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */

const randomString = () =>
  Math.random()
    .toString(36)
    .substring(7)
    .split('')
    .join('.')

// 生成两个初始化用的的 actionTypes
// 之所以使用随机码放在后面，是为了防止和开发者自身定义的 actionType 一样而发生不可预知的结果
// 而第三个生成的 actionType 是一次性使用的随机 actionType，即插即用，for one night 🍷
const ActionTypes = {
  INIT: `@@redux/INIT${randomString()}`,
  REPLACE: `@@redux/REPLACE${randomString()}`,
  PROBE_UNKNOWN_ACTION: () => `@@redux/PROBE_UNKNOWN_ACTION${randomString()}`
}

export default ActionTypes
