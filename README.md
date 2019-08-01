# Redux 源码阅读

## 目录结构

```
src
├─ applyMiddleware.js       // 将中间件函数封装成一个 enhancer
├─ bindActionCreators.js    // 
├─ combineReducers.js       // 组合多个 reducers 生成一个 reducer
├─ compose.js               // 组合多个 enhancers 生成一个 enhancer
├─ createStore.js           // 接收 reducer [, preloadedState] [, enhancer] 生成一个 store
├─ index.js
└─ utils
       ├─ actionTypes.js    // 生成 redux 库自身所需的 actionType
       ├─ isPlainObject.js  // 判断一个变量是否是普通对象
       └─ warning.js        // 用于抛出错误的工具函数
```
## compose

```javascript
/**
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

> 但实际上没有太多 redux 的内容在里面，把它视为一个🔧工具函数也是可以的
> 比如借用这个思路来结合 HOC 来实现许多复杂的操作，不局限于此时此地

1. 将传入的 enhancers 存储到数组 funcs 中
2. 如果传入的 enhancer 实际个数是1个或者干脆没有，就直接返回，进行处理
3. 利用 reduce 函数遍历一边 funcs 数组，每次将前一个函数的运行结果返回到后面一个函数的参数中
4. 大体过程可以简单描述一下：
   - 假设有三个增强函数 funcs: [one, two, three]
   - 然后实际调用的效果为 three(two(one(args)))
   - one(args) 返回 oneResult
   - two(oneResult) 返回 twoResult
   - three(twoResult) 返回 finalResult

## combineReducers

```javascript
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
  const reducerKeys = Object.keys(reducers)
  const finalReducers = {}
  for (let i = 0; i < reducerKeys.length; i++) {
    const key = reducerKeys[i]

    if (process.env.NODE_ENV !== 'production') {
      if (typeof reducers[key] === 'undefined') {
        warning(`No reducer provided for key "${key}"`)
      }
    }

    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key]
    }
  }
  const finalReducerKeys = Object.keys(finalReducers)

  // This is used to make sure we don't warn about the same
  // keys multiple times.
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



## actionTypes

```javascript
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
/**
 * @param {any} obj The object to inspect.
 * @returns {boolean} True if the argument appears to be a plain object.
 */
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