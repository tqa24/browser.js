import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 8899;

// Paths
const workspaceRoot = path.resolve(__dirname, "../../"); // repo root
const scramjetDist = path.resolve(workspaceRoot, "dist"); // built scramjet assets
const harnessDir = path.resolve(workspaceRoot, "mcp2/src/harness"); // serve source harness

// Express app to serve MCP endpoint + static harness and Scramjet assets
const app = express();
app.use(express.json({ limit: "1mb" }));

// Serve Scramjet bundles under /scram/*
app.use(
	"/scram",
	express.static(scramjetDist, {
		index: false,
		fallthrough: true,
		redirect: false,
	})
);

// Serve wasm at top-level path expected by config
app.get("/scramjet.wasm.wasm", (_req: Request, res: Response) => {
	res.type("application/wasm");
	res.sendFile(path.join(scramjetDist, "scramjet.wasm.wasm"));
});

// Serve harness HTML/JS
app.use("/", express.static(harnessDir, { extensions: ["html"] }));
app.get("/harness", (_req: Request, res: Response) =>
	res.sendFile(path.join(harnessDir, "index.html"))
);

// Playwright runner: load harness, pipe console/pageerror, run user code through Scramjet rewrite/eval
async function runInPlaywright(
	code: string
): Promise<{ output: string[]; errors: string[]; rewrittenJs: string }> {
	const output: string[] = [];
	const errors: string[] = [];
	let rewrittenJs = "";

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	const page = await context.newPage();

	page.on("console", (msg) => {
		try {
			output.push(msg.text());
		} catch {
			// ignore
		}
	});
	page.on("pageerror", (err) => {
		try {
			errors.push((err as any)?.stack || (err as any)?.message || String(err));
		} catch {
			// ignore
		}
	});

	try {
		await page.goto(`http://127.0.0.1:${PORT}/harness`, {
			waitUntil: "load",
			timeout: 10000,
		});
		await page.waitForFunction('typeof window.runCode === "function"', null, {
			timeout: 3000,
		});

		const runPromise = page.evaluate((userCode) => {
			// @ts-ignore - run inside browser
			return (window as any).runCode(userCode);
		}, code);

		// 3000 ms timeout as approved
		await Promise.race([
			runPromise,
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("run timeout")), 3000)
			),
		]);

		// Small settle delay to flush console logs
		await page.waitForTimeout(100);

		// Retrieve last rewritten JS from harness
		try {
			rewrittenJs = await page.evaluate(() =>
				(window as any).getLastRewritten
					? (window as any).getLastRewritten()
					: ""
			);
		} catch {
			// ignore retrieval errors
		}
	} catch (e: any) {
		errors.push(e?.stack || e?.message || String(e));
	} finally {
		await page.close().catch(() => {});
		await context.close().catch(() => {});
		await browser.close().catch(() => {});
	}

	return { output, errors, rewrittenJs };
}

// Build a stateless MCP server per request
function getServer() {
	const server = new McpServer({
		name: "scramjet-run",
		version: "0.1.0",
	});

	server.registerTool(
		"run_js",
		{
			title: "Run JS in Scramjet sandbox",
			description:
				"Rewrites and executes provided JavaScript in a Scramjet sandboxed iframe via headless Chromium. Returns console output and errors.",
			inputSchema: { code: z.string() },
		},
		async ({ code }: { code: string }) => {
			const result = await runInPlaywright(code);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(result),
					},
				],
			};
		}
	);

	return server;
}

// MCP HTTP endpoint (stateless)
app.post("/mcp", async (req: Request, res: Response) => {
	let server: McpServer | undefined;
	let transport: StreamableHTTPServerTransport | undefined;

	try {
		server = getServer();
		transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});

		res.on("close", () => {
			try {
				transport?.close?.();
				// @ts-ignore optional depending on sdk version
				server?.disconnect?.();
			} catch {
				// ignore
			}
		});

		await server.connect(transport);
		await transport.handleRequest(req as any, res as any, req.body);
	} catch (error: any) {
		if (!res.headersSent) {
			res.status(500).json({
				jsonrpc: "2.0",
				error: {
					code: -32603,
					message: "Internal server error: " + (error?.message || "Unknown"),
				},
				id: null,
			});
		}
		try {
			transport?.close?.();
		} catch {
			// ignore
		}
	}
});

// Optional: block GET/DELETE on /mcp in stateless mode
app.get("/mcp", (_req: Request, res: Response) =>
	res.status(405).json({
		jsonrpc: "2.0",
		error: { code: -32000, message: "Method not allowed in stateless mode" },
		id: null,
	})
);
app.delete("/mcp", (_req: Request, res: Response) =>
	res.status(405).json({
		jsonrpc: "2.0",
		error: { code: -32000, message: "Method not allowed in stateless mode" },
		id: null,
	})
);

// Start server
app.listen(PORT, () => {
	console.log(
		`scramjet-run MCP HTTP server listening on http://127.0.0.1:${PORT}`
	);
});
