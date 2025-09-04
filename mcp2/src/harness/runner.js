import {
	setConfig,
	ScramjetClient,
	rewriteJs,
} from "/scram/scramjet.bundle.js";

// runner.js - loads Scramjet, sets up a hidden iframe sandbox, proxies console, and exposes runCode(js)

const statusEl = document.getElementById("status");
function setStatus(msg) {
	if (statusEl) statusEl.textContent = String(msg);
}

(async () => {
	setStatus("Loading Scramjet...");

	// Configure Scramjet similar to sandbox_demo/src/main.js
	setConfig({
		wisp: "ws://localhost",
		prefix: "/scramjet/",
		globals: {
			wrapfn: "$scramjet$wrap",
			wrappropertybase: "$scramjet__",
			wrappropertyfn: "$scramjet$prop",
			cleanrestfn: "$scramjet$clean",
			importfn: "$scramjet$import",
			rewritefn: "$scramjet$rewrite",
			metafn: "$scramjet$meta",
			setrealmfn: "$scramjet$setrealm",
			pushsourcemapfn: "$scramjet$pushsourcemap",
			trysetfn: "$scramjet$tryset",
			templocid: "$scramjet$temploc",
			tempunusedid: "$scramjet$tempunused",
		},
		files: {
			wasm: "/scramjet.wasm.wasm",
			all: "/scram/scramjet.all.js",
			sync: "/scram/scramjet.sync.js",
		},
		flags: {
			serviceworkers: false,
			syncxhr: false,
			strictRewrites: true,
			rewriterLogs: false,
			captureErrors: true,
			cleanErrors: false,
			scramitize: false,
			sourcemaps: false,
			destructureRewrites: true,
			interceptDownloads: false,
			allowInvalidJs: false,
			allowFailedIntercepts: false,
		},
		siteFlags: {},
		codec: {
			encode: (url) => (url ? encodeURIComponent(url) : url),
			decode: (url) => (url ? decodeURIComponent(url) : url),
		},
	});

	// Hidden iframe as the sandbox realm
	const ifr = document.createElement("iframe");
	ifr.style.display = "none";
	document.body.appendChild(ifr);

	const cl = new ScramjetClient(ifr.contentWindow);

	// Match demo: set base/origin/url to example.com
	Object.defineProperty(cl.meta, "base", {
		get() {
			return new URL("https://example.com/");
		},
	});
	Object.defineProperty(cl.meta, "origin", {
		get() {
			return new URL("https://example.com/");
		},
	});
	const urlGetter = Object.getOwnPropertyDescriptor(
		Object.getPrototypeOf(cl),
		"url"
	);
	Object.defineProperty(cl, "url", {
		get() {
			return new URL("https://example.com/");
		},
		set: urlGetter?.set,
	});

	// Hook Scramjet
	cl.hook();

	// Proxy sandbox console.* to page console so Playwright can capture
	cl.Proxy(["console.log", "console.warn", "console.info", "console.debug"], {
		apply(ctx) {
			try {
				console.log(...ctx.args);
			} catch (_) {}
		},
	});
	cl.Proxy("console.error", {
		apply(ctx) {
			try {
				console.error(...ctx.args);
			} catch (_) {}
		},
	});

	// Expose a function the server will call to run user JS through the rewriter and eval it in the iframe
	window.runCode = async function runCode(js) {
		try {
			setStatus("Rewriting and executing...");
			let rewrittenAny = rewriteJs(js, "https://example.com", {
				url: new URL("https://example.com"),
				base: new URL("https://example.com"),
			});
			// normalize to string if wasm path returns bytes
			let rewritten =
				typeof rewrittenAny === "string"
					? rewrittenAny
					: new TextDecoder().decode(rewrittenAny);

			// expose last rewritten JS for Playwright to fetch
			window.__scramjetLastRewritten = rewritten;
			window.getLastRewritten = () => window.__scramjetLastRewritten;

			// Execute inside the sandboxed iframe
			ifr.contentWindow.eval(rewritten);
		} catch (e) {
			console.error(e?.stack || String(e));
		} finally {
			setStatus("Idle");
		}
		return true;
	};

	setStatus("Ready");
})().catch((e) => {
	console.error("Harness init error:", e?.stack || String(e));
	setStatus("Failed to initialize");
});
