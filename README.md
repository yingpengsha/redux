# Redux 源码阅读

## 目录结构

```
src
├─ applyMiddleware.js       // 组合多个 middleware 生成一个 enhancer
├─ bindActionCreators.js    // 一个提供给使用者的工具函数，绑定 dispatch 和 actionCreator
├─ combineReducers.js       // 组合多个 reducer 生成一个 reducer
├─ compose.js               // 组合多个 enhancer 生成一个 enhancer (一个将一堆函数首尾相连的🔧工具函数)
├─ createStore.js           // 接收 reducer[, preloadedState][, enhancer] 生成一个 store
├─ index.js
└─ utils
       ├─ actionTypes.js    // 生成 redux 库自身所需的 actionType
       ├─ isPlainObject.js  // 判断一个变量是否是普通对象
       └─ warning.js        // 用于抛出错误的工具函数
```
## createStore
```javascript
import $$observable from 'symbol-observable'

import ActionTypes from './utils/actionTypes'
import isPlainObject from './utils/isPlainObject'

export default function createStore(reducer, preloadedState, enhancer) {
  
  // ...各种参数校验

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.')
    }
    return enhancer(createStore)(reducer, preloadedState)
  }

  // ...参数校验

  let currentReducer = reducer
  let currentState = preloadedState
  let currentListeners = []
  let nextListeners = currentListeners
  let isDispatching = false

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice()
    }
  }

  function getState() {
    // ...如果正在 dispatch，抛错

    return currentState
  }

  function subscribe(listener) {
    // ...参数校验，时机检查

    let isSubscribed = true

    ensureCanMutateNextListeners()
    nextListeners.push(listener)

    return function unsubscribe() {
      if (!isSubscribed) {
        return
      }

      // ...如果正在 dispatch，抛错

      isSubscribed = false

      ensureCanMutateNextListeners()
      const index = nextListeners.indexOf(listener)
      nextListeners.splice(index, 1)
      currentListeners = null
    }
  }

  function dispatch(action) {
    // ...各种参数校验，时机检查

    try {
      isDispatching = true
      currentState = currentReducer(currentState, action)
    } finally {
      isDispatching = false
    }

    const listeners = (currentListeners = nextListeners)
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i]
      listener()
    }

    return action
  }

  function replaceReducer(nextReducer) {

    // ...参数校验

    currentReducer = nextReducer

    dispatch({ type: ActionTypes.REPLACE })
  }

  function observable() {
    const outerSubscribe = subscribe
    return {
      subscribe(observer) {
        // ...参数校验

        function observeState() {
          if (observer.next) {
            observer.next(getState())
          }
        }

        observeState()
        const unsubscribe = outerSubscribe(observeState)
        return { unsubscribe }
      },

      [$$observable]() {
        return this
      }
    }
  }

  dispatch({ type: ActionTypes.INIT })

  return {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable
  }
}
```
1. 如果有 enhancer 增强函数则，调用增强后的 createStore 初始化
2. 利用闭包的原理，保存各类变量的状态
3. 定义各类函数暴露给用户使用
4. 初始化

### getState()

用于返回 state

1. 因为闭包，所以能准确的返回先前保留的 state

### subscribe

用于添加监听函数

1. 对先前的监听函数集合进行浅拷贝备份
2. 然后将新的监听函数填充进去
3. 返回一个取消监听的函数
   1. 浅拷贝备份
   2. 将监听事件从集合中剔除

### dispatch

分发 action

1. 将 action 分发到当前的 reducer 中（真正的改值在 reducer 中）
2. 遍历监听函数，并执行
3. 返回传入的 action (并无太多实际意义)

### replaceReducer

重置覆盖 reducer

1. 覆盖当前 reducer
2. 重新初始化状态

### observable

observable 这个函数不是暴露给使用者的，而是提供给其他观察者模式/响应式库的 API
具体可看 https://github.com/tc39/proposal-observable

## applyMiddleware

```javascript
import compose from './compose'
export default function applyMiddleware(...middlewares) {
  return createStore => (...args) => {
    const store = createStore(...args)
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

    return {
      ...store,
      dispatch
    }
  }
}
```

来结合一下 redux-thunk 的源码看一下

```javascript
function createThunkMiddleware(extraArgument) {
  return ({ dispatch, getState }) => next => action => {
    if (typeof action === 'function') {
      return action(dispatch, getState, extraArgument);
    }

    return next(action);
  };
}

const thunk = createThunkMiddleware();
thunk.withExtraArgument = createThunkMiddleware;

export default thunk;
```

#### 组合多个 middleware 生成一个 enhancer，中间件会替换 dispatch 给用户使用，而真正的 dispatch 则在中间件的末尾等待最后的处理。

1. applyMiddleware 执行后会返回一个 enhancer
2. 然后这个 enhancer 会返回一个 dispatch 覆盖原先的 dispatch
3. createStore 就是最初始的 createStore 函数
4. 定义的 dispatch 定义只是暂时的，最后会被中间件覆盖，目的是告诉中间件: v"正在初始化呢，别🐒急着dispatch!" <br>
   相关 Issues: https://github.com/reduxjs/redux/issues/1240 很精彩
5. 然后传递 getState，dispatch 给中间件使用
6. 倒数第二行覆盖 dispatch 是整个库里最精彩的地方 <br>
   1⃣️ dispatch 的不简单覆盖
   - 上方的 dispatch 覆盖了上上方的报错专用的 dispatch
   - 同时利用闭包的属性，覆盖了传到 middleware 里面的 middlewareAPI.dispatch 里的 dispatch
   - 这样就能保证在最后的 dispatch 生成之前 dispatch 是报错专用的，生成之后是正常中间件生成用的 
  
   2⃣️ 怎么让 action 在中间件之间传递，最后传递到 store.dispatch 手上
   - 假设我们有两个中间件 saga, thunk
   - 他们都有会生成一个类似 dispatch 的函数，假设为 createSagaDispatch, createThunkDispatch
   - 然后 compose(createSagaDispatch, createThunkDispatch)(store.dispatch)
   - 等于 createThunkDispatch(createSagaDispatch(store.dispatch))
   - 效果 createSagaDispatch(store.dispatch) --> sagaDispatch <br>
        createThunkDispatch(sagaDispatch) --> thunkDispatch
   - 最后将 thunkDispatch 暴露给使用者
   - 执行顺序则是反方向运行回调的函数
7. 最后返回意味着暴露给用户的 dispatch 将会被中间件覆盖，而真正的 dispatch 给最里层的中间件用

## compose

```javascript
export default function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg
  }

  if (funcs.length === 1) {
    return funcs[0]
  }

  return funcs.reduce((a, b) => (...args) => a(b(...args)))
}
```
#### compass 的作用就是整合多个 enhancer 函数

> 但实际上没有太多 redux 的内容在里面，但他是中间件模式的核心函数，把它视为一个🔧工具函数也是可以的 <br/>
> 比如借用这个思路来结合 HOC 来实现许多复杂的操作，不局限于此时此地，

1. 将传入的 函数 存储到数组 funcs 中
2. 如果传入的 函数 实际个数是1个或者干脆没有，就直接返回，进行处理
3. 利用 reduce 函数遍历一边 funcs 数组，每次将前一个函数的运行结果返回到后面一个函数的参数中
4. 大体过程可以简单描述一下：
   - 假设有三个增强函数 funcs: [one, two, three]
   - 然后实际调用的效果为 three(two(one(args)))
   - one(args) 返回 oneResult
   - two(oneResult) 返回 twoResult
   - three(twoResult) 返回 finalResult

## combineReducers

```javascript
export default function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers)
  const finalReducers = {}
  
  // ...数据过滤及相关报错，最后 finalReducers 为有效的 reducers 集合

  let unexpectedKeyCache
  if (process.env.NODE_ENV !== 'production') {
    unexpectedKeyCache = {}
  }

  let shapeAssertionError
  try {
    assertReducerShape(finalReducers)
  } catch (e) {
    shapeAssertionError = e
  }

  return function combination(state = {}, action) {
    if (shapeAssertionError) {
      throw shapeAssertionError
    }

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

    let hasChanged = false
    const nextState = {}
    for (let i = 0; i < finalReducerKeys.length; i++) {
      const key = finalReducerKeys[i]
      const reducer = finalReducers[key]
      const previousStateForKey = state[key]
      const nextStateForKey = reducer(previousStateForKey, action)
      if (typeof nextStateForKey === 'undefined') {
        const errorMessage = getUndefinedStateErrorMessage(key, action)
        throw new Error(errorMessage)
      }
      nextState[key] = nextStateForKey
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey
    }
    return hasChanged ? nextState : state
  }
}
```

#### combineReducers 会在对传入的 reducers 进行一系列合法校验过滤后，返回一个大的 reducer 以供使用

1. 如果在非生产环境发现传入的 reducers 有为空的则抛出错误。
2. 将不为空的 reducers 整合到新的集合 finalReducers。
3. 如果在非生产环境会对传入的 reducers 尝试性初始化一次，如果发现初始化后返回的 state 是 undefined 则保存错误，在下面第一次调用 combination（返回的 reducer 函数） 时抛出。
4. 返回一个大的 reducer（combination）。
5. 当调用了 combination，一般就是 dispatch，createStore 的时候，在非生产环境会先进行合法性校验，如果发现有不合法的地方，抛出错误。
6. 然后把传入的 action 传入到每一个子 reducer 里运行，得到新的 state，然后将每个子 state tree 整合起来返回。

## bindActionCreators
```javascript
function bindActionCreator(actionCreator, dispatch) {
  return function() {
    return dispatch(actionCreator.apply(this, arguments))
  }
}

export default function bindActionCreators(actionCreators, dispatch) {
  // ...参数校验

  const boundActionCreators = {}
  for (const key in actionCreators) {
    const actionCreator = actionCreators[key]
    if (typeof actionCreator === 'function') {
      boundActionCreators[key] = bindActionCreator(actionCreator, dispatch)
    }
  }
  return boundActionCreators
}
```

#### 一个提供给使用者的工具函数，用于将 dispatch 和 actionCreate 绑定，返回新的函数以供使用

1. actionCreators 一个 action creator，或者一个 value 是 action creator 的对象。
2. dispatch 一个由 Store 实例提供的 dispatch 函数
3. 如果 actionCreators 是函数，则说明传进来的只有一个 creator,直接返回将两者绑定的函数
4. 如果传进来的 actionCreators 不是函数，也不是对象，或者干脆为空则直接抛出错误
5. 既然传进来的是一个 value 是 action creator 的对象，那就遍历一边，把里面每个 creator 覆盖为新的绑定过的 creator

## actionTypes

```javascript
const randomString = () =>
  Math.random()
    .toString(36)
    .substring(7)
    .split('')
    .join('.')

const ActionTypes = {
  INIT: `@@redux/INIT${randomString()}`,
  REPLACE: `@@redux/REPLACE${randomString()}`,
  PROBE_UNKNOWN_ACTION: () => `@@redux/PROBE_UNKNOWN_ACTION${randomString()}`
}

export default ActionTypes
```

#### 生成三个 Redux 库自身使用的 actionType

1. 前两个 actionType 是用于初始化用的，第三个是一次性使用的 actionType，每次调用都是独一无二的 action
2. 之所以加上随机码，是为了防止和使用者自己定义的 actionType 一致而发生冲突。

## isPlainObject

```javascript
export default function isPlainObject(obj) {
  if (typeof obj !== 'object' || obj === null) return false

  let proto = obj
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto)
  }

  return Object.getPrototypeOf(obj) === proto
}
```

#### 目的是判断一个变量是否为**普通对象**

> redux 中的普通对象是指用 { }、new Object() 创建的对象。

1. 初步过滤，使用 `typeof` 保证变量属于 `typeof` 中的 `Object`，`typeof` 中不止普通对象是 `Object`，还有 `null` 和 `DOM` 等。
2. 利用 `while` 循环和 `Object.getPrototypeOf()` 方法得到 `Object.prototype`。
3. 如果变量的原型是 `Object.prototype` 则说明是普通对象。

#### 疑惑

**1. 为什么不用 `Object.prototype.toString` 去直接判断变量的类型。**

如下表所示：他们的判断结果

---| Redux | Object.prototype.toString
---|--- |---
`__proto__`: `null` | ❌ |✅
`__proto__`: { `__proto__`: `null`} | ✅ |✅
`__proto__`: { `__proto__`: `null`, `constructor`: `Object` } | ✅ |✅
`[Symbol.toStringTag]`: `''` | ✅ |❌
Object.freeze({`[Symbol.toStringTag]`: `''`}) | ✅ |❌
`__proto__`: `null`, `[Symbol.toStringTag]`: `''` | ❌ |❌
Object.freeze({`__proto__`: `null`, `[Symbol.toStringTag]`: `''`}) | ❌ |❌
`new class{}` | ❌ |✅


**2. 为什么不直接拿 `Obejct.prototype` 去和原型比较，而要去原型链取 `Object.prototype`。**

不同执行环境下的原型会不一致，不同执行环境是指如“同域 iframe”、“node 的 vm”、“stage2 的 Realm”等情况。在这种情况下的 `Object.prototype` 是不一致的，自然是怎么比较都比较都是 `false` 的，所以我们需要往变量的原型链上找到 `Object.prototype`。

#### 参考

- [typeof 知识点](https://yingpengsha.github.io/2019/05/27/JS%E7%9A%84%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B%E3%80%81%E7%B1%BB%E5%9E%8B%E5%88%A4%E6%96%AD%E3%80%81%E7%B1%BB%E5%9E%8B%E8%BD%AC%E6%8D%A2/#typeof)
- [Object.getPrototypeOf() 知识点](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/GetPrototypeOf)
- [为什么redux不使用Object.prototype.toString判断Plain Object?](https://www.zhihu.com/question/287632207)
- [Symbol.toStringTag](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toStringTag)
- [Redux源码中的编程技巧(二)之isPlainObject函数的实现](https://blog.csdn.net/juhaotian/article/details/79509053)
- [isPlainObject 的不同实现](https://yanni4night.github.io/js/2018/02/06/is-plainobject.html)

## warning

简单的抛出错误的工具函数，抛出两个类型的错误
1. `console.error(error)`
2. `throw new Error(error)`