const path = require('path')
const parser = require('@babel/parser')
const t = require('@babel/types')
const traverse = require('@babel/traverse')
const generate = require('@babel/generator').default
const fs = require('fs')
const ejs = require('ejs')
const { SyncHook } = require('tapable')

/**
 * @babel/parse 解析源码转换成AST
 * @babel/traverse 遍历AST
 * @babel/types
 * @babel/generate
 */
module.exports = class Compiler{
  constructor (config) {
    this.config = config

    // 入口文件
    this.entryId;
    // 所有模块依赖
    this.modules = {}
    this.entry = config.entry
    // 工作路径
    this.root = process.cwd()

    this.hooks = {
      entryOption: new SyncHook(),
      compiler: new SyncHook(),
      afterCompile: new SyncHook(),
      afterPlugins: new SyncHook(),
      run: new SyncHook(),
      emit: new SyncHook(),
      done: new SyncHook()
    }

    let plugins = this.config.plugins
    if (Array.isArray(plugins)) {
      plugins.forEach(plugin => {
        plugin.apply(this)
      })
    }
    this.hooks.afterPlugins.call()
  }
  getSource(modulePath) {
    

    let rules = this.config.module.rules
    let len = rules.length
    let source = fs.readFileSync(modulePath, 'utf8')
    for(let i=0;i<len;i++) {
      let rule = rules[i]
      let { test, use } = rule
      let len2 = use.length - 1
      if(test.test(modulePath)) {
        
        function normalizeLoader () {
          let loader = require(use[len2--])
          source = loader(source)
          if (len2 >= 0) {
            normalizeLoader()
          }
        }
        normalizeLoader()
      }
    }
    console.log(source)
    return source
  }
  parse(source, parentPath) {
    const ast = parser.parse(source)
    let dependencies = []
    traverse.default(ast, {
      CallExpression(p) {
        let node = p.node
        if (node.callee.name === 'require') {
          node.callee.name = '__webpack_require__'
          let moduleName = node.arguments[0].value
          moduleName = moduleName + (path.extname(moduleName)?'':'.js')
          moduleName = './' + path.join(parentPath, moduleName)
          dependencies.push(moduleName)
          node.arguments = [t.stringLiteral(moduleName)]
        }
        // const calleePath = p.get("callee")
        // if (calleePath.matchesPattern("console", true)) {
        //   p.remove()
        // }
      }
    })

    let sourceCode = generate(ast).code
    return {
      sourceCode,
      dependencies
    }
    // console.log(233,ast)
  }
  buildModule (modulePath, isEntry) {
    const source = this.getSource(modulePath)
    console.log(source)
    let moduleName = './'+ path.relative(this.root, modulePath)
    if(isEntry) {
      this.entryId = moduleName
    }
    const {sourceCode, dependencies} = this.parse(source, path.dirname(moduleName))
    this.modules[moduleName] = sourceCode
    dependencies.forEach(dep => {
      this.buildModule(path.join(this.root, dep), false)
    })
  }
  emitFile () {
    let main = path.join(this.config.output.path, this.config.output.filename)
    let templateStr = this.getSource(path.join(__dirname, './main.ejs'))

    let code = ejs.render(templateStr, {entryId: this.entryId, modules:this.modules})
    this.assets = {}
    this.assets[main] = code
    fs.writeFileSync(main, code)
  }
  run () {
    this.hooks.run.call()
    // 执行并且保存模块的依赖关系
    this.hooks.compiler.call()
    this.buildModule(path.resolve(this.root, this.entry), true)
    this.hooks.afterCompile.call()
    console.log(this.modules)
    // 打包后的文件
    this.emitFile()
    this.hooks.emit.call()
    this.hooks.done.call()
  }
}