import { ScramjetClient } from "@client/client";
import { UNSAFE_GLOBALS } from "./wrap";
import { config } from "@/shared";
import { SCRAMJETCLIENT } from "@/symbols";

const inc = Array.prototype.includes;
const array_includes = (arr: any[], val: any) => inc.call(arr, val);

export default function (client: ScramjetClient, self: Self) {
	const makeFakeDescriptor = (obj: any, prop: string | symbol) => {
		const desc = client.natives.call(
			"Reflect.getOwnPropertyDescriptor",
			null,
			obj,
			prop
		);
		if (desc.get) {
			client.RawProxy(desc, "get", {
				apply(getctx) {
					getctx.return(client.wrapfn(getctx.call()));
				},
			});
		}
		if (desc.set && prop == "location") {
			client.RawProxy(desc, "set", {
				apply(setctx) {
					client.url = setctx.args[0];
					setctx.return(undefined);
				},
			});
		}
		if (desc.value) {
			desc.value = client.wrapfn(desc.value);
		}

		return desc;
	};

	// Reflect.apply - should be safe
	// Reflect.construct - should be safe
	// We do need to worry about it overwriting our prototypes here though
	client.Proxy("Reflect.defineProperty", {
		apply(ctx) {
			const prop = ctx.args[1];
			if (typeof prop === "string") {
				for (const global of Object.values(config.globals)) {
					if (prop === global) {
						ctx.return(false);
					}
				}
			}
		},
	});
	// Reflect.deleteProperty functions like the delete operator so it's fine
	// Obviously just wrap the prop here
	client.Proxy(["Reflect.get", "Reflect.set"], {
		apply(ctx) {
			if (array_includes(UNSAFE_GLOBALS, ctx.args[1])) {
				ctx.args[1] = config.globals.wrappropertybase + ctx.args[1];
			}
		},
	});
	client.Proxy(
		["Reflect.getOwnPropertyDescriptor", "Object.getOwnPropertyDescriptor"],
		{
			apply(ctx) {
				if (ctx.args[1] == SCRAMJETCLIENT) {
					return ctx.return(undefined);
				}
				if (array_includes(UNSAFE_GLOBALS, ctx.args[1])) {
					return ctx.return(makeFakeDescriptor(ctx.args[0], ctx.args[1]));
				}
			},
		}
	);
	// Reflect.getPrototypeOf - just __proto__ so it's fine
	// Reflect.has -
	// Reflect.isExtensible -
	// Reflect.ownKeys - not great but it doesn't really need to be wrapped
	// Reflect.setPrototypeOf - i think this is fine

	client.Proxy("Object.getOwnPropertyDescriptors", {
		apply(ctx) {
			const descriptors = ctx.call();
			for (const prop of Reflect.ownKeys(descriptors)) {
				if (prop == SCRAMJETCLIENT) {
					delete descriptors[prop];
					continue;
				}
				if (array_includes(UNSAFE_GLOBALS, prop)) {
					descriptors[prop] = makeFakeDescriptor(ctx.args[0], prop);
				}
			}
		},
	});
	// Object.keys / Object.getOwnProptyNames / Object.GetOwnPropertySymbols leak keys but that's fine
	// This still needs to be wrapped, it's simple though
	client.Proxy("Object.values", {
		apply(ctx) {
			const values = ctx.call();
			ctx.return(values.map((v: any) => client.wrapfn(v)));
		},
	});
	client.Proxy("Object.entries", {
		apply(ctx) {
			const entries = ctx.call();
			ctx.return(entries.map((e: any) => [e[0], client.wrapfn(e[1])]));
		},
	});
	client.Proxy("Object.assign", {
		apply(ctx) {
			const [target, ...sources] = ctx.args;
			for (const source of sources) {
				const ownkeys = client.natives.call("Reflect.ownKeys", null, source);
				for (const key of ownkeys) {
					const val = source[key];

					if (array_includes(UNSAFE_GLOBALS, key)) {
						target[key] = client.wrapfn(val);
					} else if (key === "location" && target === self) {
						// TODO: boxify
						client.url = val;
					} else {
						target[key] = val;
					}
				}
			}
			ctx.return(target);
		},
	});
}
