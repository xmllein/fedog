var fs = require('fs')
var path = require('path')
var crypto = require('crypto')
var fn = require('../fn')
var jade = require('jade')
var conf = global.conf
var colors = require('colors')

var fromDir = conf.root
var toDir = conf.cacheC

//依赖表
var dtable = {}
//解析正则
var reg = /(?:include|extends)\s+(.*?)\s*$/gm

function isJade(f){
    return ['.jade'].indexOf(path.extname(f)) != -1
}

//插入依赖表
function idtable(df, f){
    if (!(df in dtable)){
        dtable[df] = [f]
    }
    else {
        if (dtable[df].indexOf(f) == -1){
            dtable[df].push(f)
        }
    }
}

function scanF(f){
    var body = fn.getBody(f)

    var dfs = [], v
    while ( null != (v = reg.exec(body)) ){
        var df = path.join(path.dirname(f), v[1])
        if (path.extname(df) == ''){
            df = `${df}.jade`
        }

        idtable(df.replace(fromDir, ''), f)
        dfs.push(df)
    }

    dfs.forEach(_=>{
        scanF(_)
    })
}

function isTplJade(f){
    return f.slice(-9) == '.tpl.jade'
}

function compileJade(f){
    if (!fs.existsSync(f)){
        return
    }

    //忽略下划线打头的
    var basef = path.basename(f)

    if ( isJade(f) && (basef[0] != '_' ||  isTplJade(f))){
        console.log(`compile: ${f.replace(fromDir, '')}`)

        try{
            var body = jade.compileFile(f, {pretty:true})({FEDOG:conf.release.env})
            var f2

            if (isTplJade(f)){
                f2 = path.join(conf.cacheTSC, f.replace(fromDir, '').slice(0, -5))
            }
            else {
                f2 = path.join(toDir, f.replace(fromDir, '').slice(0, -4)+'html')
            }

            fn.createF(f2, body)
            scanF(f)
        }
        catch (ex){
            console.error(colors.red(ex))
        }
    }
}

function compile(){
    fn.walk(fromDir, f => {
        compileJade(f)
    })
}

function watch(){
    fs.watch(fromDir, {recursive:true}, (event, f) => {
        if (!isJade(f)){
            return false
        }

        f = path.join(fromDir, f)

        //如果被依赖文件
        if (path.basename(f)[0] == '_' && !isTplJade(f)){
            var rf = f.replace(fromDir, '')
            if (rf in dtable){
                dtable[rf].forEach(_=>{
                    compileJade(_)
                })
            }
        }
        else {
            compileJade(f)
        }
    })
}

exports.compile = compile
exports.watch = watch
