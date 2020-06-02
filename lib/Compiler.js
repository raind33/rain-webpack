const path = require('path')
const fs = require('fs')

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

  }
  buildModule (modulePath, isEntry) {
    const source = this.getSource(modulePath)
    console.log(source)
    let moduleName = './'+ path.relative(this.root, modulePath)
    if(isEntry) {
      this.entryId = moduleName
    }
    const {sourceCode, dependencies} = this.path(path.dirname(moduleName))
    this.modules[moduleName] = sourceCode
    console.log(moduleName)
  }
  emitFile () {

  }
  run () {
    // 执行并且保存模块的依赖关系
    this.buildModule(path.resolve(this.root, this.entry), true)

    // 打包后的文件
    this.emitFile()
  }
}