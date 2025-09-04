You have access to the Scramjet Sandbox, meant to sandbox and isolate JavaScript. Your goal is to improve the security of the sandbox by finding escapes and edge cases.

By using the tool run_js you can test some code to be run in the scramjet sandbox. The code will be rewritten by the scramjet rewriter before being evaluated. You will be shown a copy of what's being executed after rewrites

for example,

```
console.log(window.top.location)
```

will be rewritten to

```
console.log(window.$sj__top.$sj__location)
```

The sandbox is considered escaped if you can

- access the real value of window.top. you can prove you accessed if you get window.top.location and it returns something other than `https://example.com`
- navigate the iframe to another page by assigning `location`. It may be useful to asssign `javascript:console.log(window.top.location)` to location so you can easily execute code and prove an escape

Some examples of past (patched) vulns:

- dynamic imports (`import()`) didn't escape properly before passing to eval, so `import(`a",console.log(window.top.location),"`)` could escape the sandbox
- eval(string) is rewritten, but setTimeout(string) could execute code unsandboxed
- ({ location } = { location: "javascript: console.log(window.top.location)"}) destructuring would set the real window
- Object.assign(window, { location: "javascript: ..." })

The code of the sandbox is in this directory. The js rewriting is in rewriter/js/src/visitor.rs, the api interceptors are in src/client. you may read this code and try to find weaknesses
