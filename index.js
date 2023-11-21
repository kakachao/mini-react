/**
 * 创建一个元素对象
 * @param {string} type - 元素类型
 * @param {object} props - 元素属性
 * @param {...*} children - 子元素
 * @returns {object} - 元素对象
 */
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  }
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

function createDom(fiber) {
  // 根据fiber的类型创建对应的DOM元素
  const dom =
    fiber.type == "TEXT_ELEMENT"
      ? document.createTextNode("") // 如果fiber的类型是"TEXT_ELEMENT"，则创建一个空的文本节点
      : document.createElement(fiber.type) // 否则，根据fiber的类型创建一个元素节点

  // 更新DOM元素的内容和属性
  updateDom(dom, {}, fiber.props)

  return dom
}

const isEvent = key => key.startsWith("on")
const isProperty = key =>
  key !== "children" && !isEvent(key)
const isNew = (prev, next) => key =>
  prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)
// 更新DOM
function updateDom(dom, prevProps, nextProps) {
  // 移除旧的或已更改的事件监听器
  Object.keys(prevProps)
    .filter(isEvent) // 筛选出属性名以"on"开头的事件监听器
    .filter(
      key =>
        !(key in nextProps) || // 如果nextProps中不存在该事件监听器
        isNew(prevProps, nextProps)(key) // 或者该事件监听器是新的
    )
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2) // 获取事件类型
      dom.removeEventListener(
        eventType,
        prevProps[name] // 移除事件监听器
      )
    })

  // 移除旧的属性
  Object.keys(prevProps)
    .filter(isProperty) // 筛选出属性
    .filter(isGone(prevProps, nextProps)) // 筛选出已移除的属性
    .forEach(name => {
      dom[name] = "" // 将属性设为空字符串
    })

  // 设置新的或更改的属性
  Object.keys(nextProps)
    .filter(isProperty) // 筛选出属性
    .filter(isNew(prevProps, nextProps)) // 筛选出新的属性
    .forEach(name => {
      dom[name] = nextProps[name] // 设置属性值为nextProps的属性值
    })

  // 添加事件监听器
  Object.keys(nextProps)
    .filter(isEvent) // 筛选出属性名以"on"开头的事件监听器
    .filter(isNew(prevProps, nextProps)) // 筛选出新的事件监听器
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2) // 获取事件类型
      dom.addEventListener(
        eventType,
        nextProps[name] // 添加事件监听器
      )
    })
}

/**
 * 提交根节点
 */
function commitRoot() {
  // 对每个删除的节点执行提交工作
  deletions.forEach(commitWork)
  // 提交子节点的工作
  commitWork(wipRoot.child)
  // 用于存上一次commit的fiber tree的root
  currentRoot = wipRoot
  // 清空待提交的根节点
  wipRoot = null
}
/**
 * 由于函数式组件没有dom，所以在commitWork中也需要做相应更改，首先需要沿fiber tree向上寻找到一个有dom的fiber，将函数式组件中children的dom添加进去
 * @param {*} fiber 
 * @returns 
 */
function commitWork(fiber) {
  if (!fiber) { // 如果fiber为空，则返回
    return
  }
  // 循环直到找到有dom属性的父fiber 将函数式组件中children的fiber的dom添加到其中
  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  if (
    fiber.effectTag === "PLACEMENT" && // 如果fiber的effectTag为"PLACEMENT"且fiber的dom不为空
    fiber.dom != null
  ) {
    domParent.appendChild(fiber.dom) // 将fiber的dom添加到domParent中
  } else if (
    fiber.effectTag === "UPDATE" && // 如果fiber的effectTag为"UPDATE"且fiber的dom不为空
    fiber.dom != null
  ) {
    updateDom(
      fiber.dom, // 更新fiber的dom
      fiber.alternate.props, // fiber的替代属性
      fiber.props // fiber的属性
    )
  } else if (fiber.effectTag === "DELETION") { // 如果fiber的effectTag为"DELETION"
    commitDeletion(fiber, domParent) // 执行删除操作
  }

  commitWork(fiber.child) // 递归执行commitWork函数处理fiber的子节点
  commitWork(fiber.sibling) // 递归执行commitWork函数处理fiber的兄弟节点
}

function commitDeletion(fiber, domParent) {
  // 如果fiber存在dom节点
  if (fiber.dom) {
    // 从domParent中移除dom节点
    domParent.removeChild(fiber.dom)
  } else {
    // 递归调用commitDeletion函数，处理fiber的子节点
    commitDeletion(fiber.child, domParent)
  }
}

/**
 * 渲染函数，用于将元素渲染到指定的容器中
 *
 * @param {HTMLElement} element - 要渲染的元素
 * @param {HTMLElement} container - 渲染的目标容器
 */
function render(element, container) {
  /**
   * wipRoot 为当前正在渲染的根节点对象
   * dom 属性表示节点对应的DOM元素
   * props 属性表示节点的属性
   * children 属性表示节点的子节点
   * alternate 属性表示节点的上一个根节点
   */
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot, //每一棵fiber tree都有一个属性指向上次commit的fiber tree root
  }
  deletions = []
  nextUnitOfWork = wipRoot

}
//记录下一个待处理的UI单元操作
let nextUnitOfWork = null
//上一次构建的fiber tree root
let currentRoot = null
//work in progress root 保存当前正在构建的树的根节点
let wipRoot = null
//用于存储需要删除的node    
let deletions = null

function workLoop(deadline) {
  // 定义一个布尔变量，用于指示是否需要进行UI更新
  let shouldYield = false
  // 循环执行未完成的UI单元操作，直到所有UI单元操作完成或者达到帧率限制
  while (nextUnitOfWork && !shouldYield) {
    // 执行下一个UI单元操作，并返回下一个待处理的UI单元操作
    nextUnitOfWork = performUnitOfWork(
      nextUnitOfWork
    )
    // 检查是否达到帧率限制
    shouldYield = deadline.timeRemaining() < 1
  }
  //基于上一步的实现，我们每个unit中都会添加一个新的node到DOM中，但是在我们构建并渲染完整棵树前，
  //每次unit结束浏览器主线程都可能会打断渲染，这样用户可能看到不完整的UI。为解决这个问题，我们希望整棵DOM树都构建完成再提交渲染。
  // 整棵树都渲染完成则commit
  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  // 请求下一次空闲时段回调函数的执行，并执行workLoop函数
  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function performUnitOfWork(fiber) {
  // 判断是否是函数组件
  const isFunctionComponent = fiber.type instanceof Function
  // 函数组件更新
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    // 非函数组件更新
    updateHostComponent(fiber)
  }
  //寻找下一个进入work unit的fiber:child-->sibling-->uncle
  // 若fiber有子fiber，则返回子fiber
  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  // 遍历找到下一个fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      // 若nextFiber有兄弟fiber，则返回兄弟fiber
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

let wipFiber = null
let hookIndex = null

/**
 * 更新函数组件 对函数式组件，则通过执行该函数，获得解析成原生元素组成的组件，再像对待普通元素一样reconcileChildren
 * @param {Object} fiber - 组件的 Fiber 对象
 */
function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }

  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => {
    hook.state = action(hook.state)
  })

  //每次setState，都设置一个新的wipRoot作为下一个work unit，workLoop就可以进入新的渲染
  //也就是说这样写每次setState都会触发渲染，在updateQueue里注册任务
  //但是react真正的实现中有batchUpdate机制，也就是合并更新，在同一个事务（？）中的setState会进行state合并
  //React 18后，所有的setState都会是异步的也就是都会合并更新？？autoUpdate
  const setState = action => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot
    // 初始化删除操作数组
    deletions = []
  }

  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state, setState]
}

/**
 * 更新主机组件
 * 
 * @param {Object} fiber - 组件的 Fiber 对象
 */
function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
}

// 根据当前fiber的children elements对比old fiber执行新增，更新和删除的操作
function reconcileChildren(wipFiber, elements) {
  // 初始化索引和旧fiber
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  // 初始化前一个兄弟节点
  let prevSibling = null

  // 循环直到元素数组遍历完或旧fiber遍历完
  while (index < elements.length || oldFiber != null) {
    // 获取当前元素和新的fiber
    const element = elements[index]
    let newFiber = null

    // 如果旧fiber和当前元素类型相同
    const sameType =
      oldFiber &&
      element &&
      element.type == oldFiber.type

    // 如果类型相同
    if (sameType) {
      // 创建新的fiber，类型和dom与旧fiber相同，属性更新为当前fiber的props,parent指向当前fiber，alternate指向旧fiber
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }
    // 如果类型不同
    if (element && !sameType) {
      // 创建新的fiber
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }
    // 如果类型不同
    if (oldFiber && !sameType) {
      // 将旧fiber的effectTag标记为DELETION，并将其添加到deletions数组中
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    // 将旧fiber指向下一个兄弟节点 按层比较
    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    // 将新的fiber与前一个兄弟节点连接
    if (index === 0) {
      wipFiber.child = newFiber
    } else if (element) {
      prevSibling.sibling = newFiber
    }

    // 更新前一个兄弟节点为当前fiber
    prevSibling = newFiber
    index++
  }
}

const MyReact = {
  createElement,
  render,
  useState,
}

/** @jsx MyReact.createElement */
function Counter() {
  const [state, setState] = MyReact.useState(1)
  return (
    <h1 onClick={() => setState(c => c + 1)}>
      Count: {state}
    </h1>
  )
}
const element = <Counter />
// const element = MyReact.createElement("h1", null, "Hello world")
const container = document.getElementById("root")
MyReact.render(element, container)