import { createServer } from "http";
import {
	handleFetch,
	CookieStore,
	loadCodecs,
	setConfig,
	ScramjetHeaders,
	ScramjetClient,
	ScramjetController,
	config,
} from "@mercuryworkshop/scramjet/bundled";
import { createBareServer } from "@nebula-services/bare-server-node";

import setGlobalVars from "indexeddbshim";
import { readFileSync } from "fs";
global.window = global;
window.location = { origin: "https://some.com" };
setGlobalVars();

const cookieStore = new CookieStore();

const _config = {
	wisp: "ws://localhost:1337/",
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
		wasm: "/scram/scramjet.wasm.wasm",
		wasmJs: "/scram/scramjet.wasm.wasm.js",
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
		sourcemaps: true,
		destructureRewrites: false,
		interceptDownloads: false,
		allowInvalidJs: false,
		allowFailedIntercepts: false,
		antiAntiDebugger: false,
	},
	siteFlags: {},
	codec: {
		encode: `(url) => {
      if (!url) return url;
      return encodeURIComponent(url);
    }`,
		decode: `(url) => {
      if (!url) return url;
      return decodeURIComponent(url);
    }`,
	},
};

setConfig(_config);

console.log(config);

loadCodecs();

window.WorkerLocation = class Location {};
let client = new ScramjetClient(window);
// window.navigator = {
// 	serivceWorker: {
// 		controller: {
// 			postMessage() {},
// 		},
// 	},
// };
let controller = new ScramjetController(_config);

// controller.modifyConfig(config);
controller.openIDB();

const bare = createBareServer("/bare/", {
	logErrors: true,
	blockLocal: false,
});

const wasmData = readFileSync("../dist/scramjet.wasm.wasm");
const allData = readFileSync("../dist/scramjet.all.js");

const wasmBase64 = wasmData.toString("base64");
let wasmJsPayload = "";
wasmJsPayload +=
	"if ('document' in self && document.currentScript) { document.currentScript.remove(); }\n";
wasmJsPayload += `self.WASM = '${wasmBase64}';`;

const server = createServer(async (req, res) => {
	try {
		if (bare.shouldRoute(req)) {
			bare.routeRequest(req, res);
			return;
		}

		const url = new URL(req.url, `http://${req.headers.host}`);

		if (url.pathname === _config.files.wasm) {
			res.writeHead(200, {
				"Content-Type": "application/javascript",
				"Content-Length": Buffer.byteLength(wasmJsPayload),
			});
			res.end(wasmJsPayload);
			return;
		}

		if (url.pathname === _config.files.all) {
			res.writeHead(200, { "Content-Type": "application/javascript" });
			res.end(allData);
			return;
		}

		const initHeaders = new ScramjetHeaders();
		for (const [key, value] of Object.entries(req.headers)) {
			if (value) {
				initHeaders.set(key, value);
			}
		}

		if (url.pathname.startsWith(_config.prefix)) {
			const data = {
				rawUrl: url,
				rawClientUrl: undefined,
				initialHeaders: initHeaders,
				method: req.method,
				body: null,
				cookieStore: cookieStore,
				destination: req.headers["sec-fetch-dest"],
			};

			if (req.method === "POST" || req.method === "PUT") {
				const buffers = [];
				for await (const chunk of req) {
					buffers.push(chunk);
				}
				data.body = Buffer.concat(buffers);
			}

			const fetchResponse = await handleFetch.call(
				{ dispatchEvent() {} },
				data,
				_config,
				{
					async fetch(url, options) {
						let fetchres = await fetch(url, options);
						let rawHeaders = {};
						fetchres.headers.forEach((value, key) => {
							rawHeaders[key] = value;
						});
						rawHeaders["set-cookie"] = fetchres.headers.getSetCookie();
						fetchres.rawHeaders = rawHeaders;
						return fetchres;
					},
				},
				new URL(`http://${req.headers.host}${_config.prefix}`)
			);

			delete fetchResponse.headers["transfer-encoding"];
			delete fetchResponse.headers["content-encoding"];
			delete fetchResponse.headers["content-length"];
			res.writeHead(
				fetchResponse.status,
				fetchResponse.statusText,
				fetchResponse.headers
			);
			if (fetchResponse.body) {
				if (fetchResponse.body instanceof ReadableStream) {
					// Stream the response instead of concatenating chunks
					const reader = fetchResponse.body.getReader();

					// Process the readable stream properly
					const processStream = async () => {
						try {
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								// Write each chunk directly to the response
								res.write(Buffer.from(value));
							}
							res.end();
						} catch (error) {
							console.error("Error streaming response:", error);
							res.end();
						}
					};

					processStream();
				} else if (fetchResponse.body instanceof ArrayBuffer) {
					res.end(Buffer.from(fetchResponse.body));
				} else if (typeof fetchResponse.body === "string") {
					res.end(fetchResponse.body);
				} else {
					res.end(String(fetchResponse.body));
				}
			} else {
				res.end();
			}
			return;
		}

		res.writeHead(200, { "Content-Type": "text/plain" });
		res.end("Scramjet HTTP Server is running");
	} catch (error) {
		console.log("what");
		console.error("Error processing request:", error);
		res.writeHead(500, { "Content-Type": "text/plain" });
		res.end("Internal Server Errorr");
	}
});

server.on("upgrade", (req, socket, head) => {
	if (bare.shouldRoute(req)) {
		bare.routeUpgrade(req, socket, head);
	} else {
		socket.end();
	}
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
	console.log(`Scramjet HTTP server running on port ${PORT}`);
	console.log(`Bare server running on http://localhost:${PORT}/bare/`);
	console.log(
		`Scramjet proxy available at http://localhost:${PORT}${_config.prefix}{url}`
	);
});
