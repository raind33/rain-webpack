const path = require('path')
const parser = require('@babel/parser')
const t = require('@babel/types')
const traverse = require('@babel/traverse')
const generate = require('@babel/generator').default
const fs = require('fs')
const ejs = require('ejs')

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
  }
  getSource(modulePath) {
    return fs.readFileSync(modulePath, 'utf8')
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
    // 执行并且保存模块的依赖关系
    this.buildModule(path.resolve(this.root, this.entry), true)
    console.log(this.modules)
    // 打包后的文件
    this.emitFile()
  }
}