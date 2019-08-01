import compose from './compose'

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */
export default function applyMiddleware(...middlewares) {
    // applyMiddleware 执行后会返回一个 enhancer
    // 然后这个 enhancer 会返回一个 dispatch 覆盖原先的 dispatch
    // createStore 就是旧的 createStore 函数
    return createStore => (...args) => {
        // args 在实际场景中就是 createStore 时传入的 reducer[, preloadedState]
        // 当代码进入此处，其实就是进入了一个 enhancer
        const store = createStore(...args)

        // 此处的 dispatch 定义只是暂时的，目的是告诉使用者: "正在初始化呢，别🐒急着dispatch!"
        // 相关 Issues: https://github.com/reduxjs/redux/issues/1240 很精彩
        let dispatch = () => {
            throw new Error(
                'Dispatching while constructing your middleware is not allowed. ' +
                'Other middleware would not be applied to this dispatch.'
            )
        }

        const middlewareAPI = {
            getState: store.getState,
            dispatch: (...args) => dispatch(...args)
        }
        const chain = middlewares.map(middleware => middleware(middlewareAPI))

        
        dispatch = compose(...chain)(store.dispatch)
        // 太妙了✋
        // 
        // 1⃣️ dispatch 的不简单覆盖
        // 上方的 dispatch 覆盖了上上方的报错专用的 dispatch
        // 同时利用闭包的属性，覆盖了传到 middleware 里面的 middlewareAPI.dispatch 里的 dispatch
        // 这样就能保证在最后的 dispatch 生成之前 dispatch 是报错专用的，生成之后是正常中间件生成用的 
        // 
        // 2⃣️ 怎么让 action 在中间件之间传递，最后到 store.dispatch 手上
        // 假设我们有两个中间件 saga, thunk
        // 他们都有会生成一个类似 dispatch 的函数，假设为 createSagaDispatch, createThunkDispatch
        // 然后 compose(createSagaDispatch, createThunkDispatch)(store.dispatch)
        // 等于 createThunkDispatch(createSagaDispatch(store.dispatch))
        // 效果 createSagaDispatch(store.dispatch) --> sagaDispatch
        //     createThunkDispatch(sagaDispatch) --> thunkDispatch
        // 最后将 thunkDispatch 暴露给用户
        // 执行顺序则是反方向运行回调的函数

        // 下方的代码意味着暴露给用户的 dispatch 将会被中间件覆盖，而真正的 dispatch 给最里层的中间件用
        return {
            ...store,
            dispatch
        }
    }
}

/*
redux-thunk 源码

附加参数是在定义中间件时传入的
function createThunkMiddleware(extraArgument) {

    此处的 {dispatch, getState} 就是上方的 middlewareAPI
    而 next 则是 store.dispatch 或者是下一个中间件
    action 则是正常使用 redux 使用时传入的 action

    return ({ dispatch, getState }) => next => action => {

        如果是函数则返回函数执行后的结果（传入下方三个参数方便使用，可以对照 thunk 文档）
        if (typeof action === 'function') {
            return action(dispatch, getState, extraArgument);
        }
        
        反之用 store.dispatch 调用 action
        return next(action);
    };
}
  
const thunk = createThunkMiddleware();
thunk.withExtraArgument = createThunkMiddleware;

export default thunk;

*/