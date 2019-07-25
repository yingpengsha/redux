# Redux 源码阅读

## 目录结构

```
src
├─ applyMiddleware.js
├─ bindActionCreators.js
├─ combineReducers.js
├─ compose.js
├─ createStore.js
├─ index.js
└─ utils
       ├─ actionTypes.js
       ├─ isPlainObject.js
       └─ warning.js
```

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