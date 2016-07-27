const rw = require("readwrite");

const error = (msg, line) => {
    console.log(`${line}: Error: ${msg}`);
    process.exit();
}

class Stack extends Array {
    pop(){
        if(this.length === 0) return 0;
        else return super.pop();
    }
}

class Tape {
    constructor(args){
        let [size, min, max, def] = (args || [Infinity, -Infinity, Infinity, 0])
        this.tape = {0: 0};
        this.pointer = 0;
        this.size = size;
        this.min = min;
        this.max = max;
        this.def = def;
    }
    
    set(value){
        while(value < this.min)
            value += this.max + 1;
        
        while(value > this.max)
            value -= this.max + 1;
        
        this.tape[this.pointer] = value;
    }
    
    get(){
        if(typeof this.tape[this.pointer] === "undefined"){
            this.tape[this.pointer] = this.def;
        }
        if(this.pointer > this.max){
            error(`${this.pointer} is out of bounds`, "-")
        }
        return this.tape[this.pointer];
    }
    
}

class Statement {
    constructor(key, effect){
        this.key = key;
        this.effect = effect;
    }
    
    static add(...a){
        this.members.set(a[0], new Statement(...a));
        return this;
    }
}
Statement.members = new Map();

const UNDEFINED = Symbol("undefined");

Statement.add("number",  (mem, params) => Number(params[0]))
         .add("numlist", (mem, params) => params.map(Number))
         .add("string",  (mem, params) => {
             let str = params.join(" ");
             for(let i = 0; i < str.length; i++){
                 if(str[i] === "\\"){
                     i++;
                     continue;
                 }
                 if(str[i] === ";"){
                     str = str.slice(0, i);
                     break;
                 }
             }
             return str;
         })
         .add("regex",   (mem, params) => {
             let flags = params.shift();
             return new RegExp(mem.exec(params), flags);
         })
         .add("empty",   (mem, params) => {
             let type = params.shift();
             return type === "number" ? 0 : type === "string" ? "" : [];
         })
         .add("space",   (mem, params) => " ")
         .add("tab",     (mem, params) => "\t")
         .add("newline", (mem, params) => "\n")
         .add("print",   (mem, params) => {
             let k = mem.exec(params);
             rw.logln(k);
             return k;
         })
         .add("write",   (mem, params) => rw.write(params.shift(), mem.exec(params)))
         .add("read",    (mem, params) => rw.read(params[0]))
         .add("init",    (mem, params) => mem.stacks[params[0]] = new Stack())
         .add("put",     (mem, params) => {
             let k = mem.exec(params);
             rw.log(k.toString());
             return k;
         })
         .add("push",    (mem, params) => {
             let name = params.shift()
             let value = mem.exec(params);
             mem.stacks[name].push(value)
             return value;
         })
         .add("pop",     (mem, params) => mem.stacks[params[0]].pop())
         .add("stack",   (mem, params) => mem.stacks[params[0]])
         .add("func",    (mem, params) => mem.funcs[params.join(" ")])
         .add("label",   (mem, params) => 0)
         .add("eval",    (mem, params) => {
             return {
                 exec: (mem, nextParams) =>
                    mem.exec(params.concat(nextParams || []))
             };
         })
         .add("exec",    (mem, params) => {
             let [nextP, f] = params.join(" ").split(/\s*--\s*/).map(e => e.split(" "));
             return mem.exec(f).exec(mem, ...nextP);
         })
         .add("set",     (mem, params) => {
             let key = params.shift();
             let value = mem.exec(params);
             mem.object[key] = value;
             return value;
         })
         .add("get",     (mem, params) => mem.object[params[0]])
         .add("goto",    (mem, params) => !mem.labels.has(params[0]) ? error(`"${params[0]}" is not a valid label.`, mem.index) : mem.jump(mem.labels.get(params[0])))
         .add("rem",     (mem, params) => UNDEFINED)
         .add("arg",     (mem, params) => {
             if(params[0] === "all" || !params.length)
                 return mem.args;
             
             let value = mem.exec(params);
             // console.log("SDFSDF", value, mem.args);
             return mem.args[value];
         })
         .add("on",      (mem, params) => {
             let event = params.shift();
             let func = mem.exec(params);
             mem.listen(event, func);
         })
         .add("cast",    (mem, params) => {
             let type = params.shift();
             return mem.casts.get(type)(mem.exec(params));
         })
         // .add("call",   (mem, params) => {
             // let subroutine = params.shift();
             // let modified = eacal({
                 // code: [["goto", subroutine], ...mem.lines],
                 // sub: 1 + (mem.sub || 0),
                 // args: params
             // });
             // Object.assign(mem, modified);
             // delete mem.ret;
             // mem.sub--;
             // return modified.ret;
         // })
         // .add("yield",  (mem, params) => {
             // if(mem.sub){
                 // let value = params.length ? mem.exec(params) : UNDEFINED;
                 // mem.running = false;
                 // mem.ret = value;
             // } else {
                 // error("yield called outside of call");
             // }
         // })
         .add("exit",    (mem, params) => {
             mem.running = false;
         })
         .add("if",      (mem, params) => {
             let value = mem.exec(params);
             if(!value){
                 mem.index++;
             }
         })
         .add("curry",   (mem, params) => {
             return {
                 exec: (mem, ...toExec) => {
                     return mem.exec(params.concat(toExec));
                 }
             };
         })
         .add("define",  (mem, params) => {
             let newCommand = params.shift();
             let func = mem.exec(params);
             Statement.add(newCommand, (mem, params) => {
                 return func.exec(mem, ...params);
             });
         })
         .add("alias",   (mem, params) => {
             let alias = params.shift();
             let orig = params.shift();
             Statement.members.set(alias, Statement.members.get(orig));
         })
         .add("adef",    (mem, params) => {
             mem.defBody.push(params);
         })
         .add("defun",   (mem, params) => {
             // TODO
             mem.defBody = [];
         })
         .add("strap",   (mem, params) => params.length ? mem.string += mem.exec(params) : mem.string)
         .add("strcl",   (mem, params) => mem.string = "")
         .add("v",       (mem, params) => console.log("eacal is currently running."))
         .add(";",       (mem, params) => UNDEFINED)    // comment
         .add("initape", (mem, params) => mem.tapes[params.shift()] = new Tape(mem.exec(params)))
         .add("tape",    (mem, params) => mem.tapes[params.shift()])
         .add("setape",  (mem, params) => {
             let tapeName = params.shift();
             return mem.tapes[tapeName].set(mem.exec(params));
         })
         .add("getape",  (mem, params) => {
             let tapeName = params.shift();
             return mem.tapes[tapeName].get();
         })
         .add("setptr",     (mem, params) => {
             let tapeName = params.shift();
             return mem.tapes[tapeName].pointer = mem.exec(params);
         })
         .add("getptr",     (mem, params) => {
             let tapeName = params.shift();
             return mem.tapes[tapeName].pointer;
         });

const parse = (code) => {
    return code.split(/\r?\n/g).map(e => e.trimLeft().split(" "));
}

class StackOp {
    constructor(arity, func){
        this.arity = arity;
        this.func = func;
    }
    
    exec(memory, stack){
        return this.func(...memory.stacks[stack].splice(-this.arity));
    }
}

const eacal = (info) => {
    let code = info.code;
    let args = info.args;
    let lines;
    if(info.sub){
        lines = code;
    } else {
        if(code.length === 0) error("program must not be empty.", 0);
        lines = parse(code);
    }
    
    let memory = {
        object: {},
        sub: !!info.sub,
        defBody: [],
        string: "",
        args: args,
        callStack: new Stack(),
        stacks: {
            func: new Stack()
        },
        tapes: {},
        funcs: {
            "add": new StackOp(2, (a, b) => a + b),
            "inc": new StackOp(1, (a) => 1 + a),
            "dec": new StackOp(1, (a) => a - 1),
            "pow": new StackOp(2, (a, b) => Math.pow(a, b)),
            "mul": new StackOp(2, (a, b) => a * b),
            "div": new StackOp(2, (a, b) => a / b),
            "sub": new StackOp(2, (a, b) => a - b),
            "replace": new StackOp(3, (str, reg, repl) => str.replace(reg, repl)),
            "less": new StackOp(2, (a, b) => a < b),
            "more": new StackOp(2, (a, b) => a > b),
            "same": new StackOp(2, (a, b) => a == b),
            "repeat": new StackOp(2, (a, b) => a.repeat(b)),
            "slice": new StackOp(2, (a, x, y) => a.slice(x, y)),
            "charat": new StackOp(1, (s) => s.charCodeAt()),
            "tochar": new StackOp(1, (s) => String.fromCharCode(s))
        },
        eventQueue: [],
        enqueue: (f) => memory.eventQueue.push(f),
        dequeue: () => memory.eventQueue.shift()(),
        events: {},
        listen: (event, f) => {
            memory.events[event] = memory.events[event] || [];
            memory.events[event].push(f);
        },
        trigger: (event, ...data) => {
            if(!memory.events[event]) return;
            memory.events[event].forEach(listener => {
                listener.exec(memory, data);
            });
        },
        lines: lines,
        labels: new Map(),
        jump: (index) => {
            memory.index = index - 1;
            memory.enqueue(() => memory.trigger("jump", index));
        },
        exec: (parsed) => {
            let [cmd, ...params] = parsed;
            if(!Statement.members.has(cmd)){
                error(`"${cmd}" is not a valid command.`, memory.index);
                process.exit();
            }
            
            let command = Statement.members.get(cmd);
            let ret = command.effect(memory, params);
            memory.trigger(cmd, ret);
            return ret;
        },
        casts: new Map([
            ["string", value => value.toString()],
            ["number", value => Number(value)],
            ["regex",  value => RegExp(value)],
        ]),
        running: true
    };
    
    // preprocess labels
    for(let i = 0; i < lines.length; i++){
        let line = lines[i];
        if(line[0] === "label"){
            memory.labels.set(line[1], i);
        }
    }
    
    
    for(memory.index = 0;
        memory.index < memory.lines.length
            && memory.running;
        memory.index++){
        while(memory.eventQueue.length)
            memory.dequeue();
            
        let line = memory.lines[memory.index];
        if(/^\s*$/.test(line.join(""))) continue;
        
        memory.exec(line);
    }
    
    memory.trigger("end");
    
    return memory;
}

module.exports = exports.default = eacal;