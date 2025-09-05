import { flagEnabled } from "@/shared";
import {
	Array_includes,
	Array_isArray,
	Object_keys,
	Object_toString,
	Reflect_apply,
	ScramjetClient,
} from "@client/index";

export const enabled = (client: ScramjetClient) =>
	flagEnabled("antiAntiDebugger", client.meta.base);
export default function (client: ScramjetClient, self: Self) {
	client.Proxy("console.clear", {
		apply(ctx) {
			ctx.return(undefined);
		},
	});

	for (const method of [
		"log",
		"info",
		"error",
		"trace",
		"warn",
		"debug",
		"dir",
		"dirxml",
		"table",
	]) {
		const func = self.console[method];
		const proxy = client.natives.construct("Proxy", func, {
			apply(target, thisarg, argarray) {
				const isSafe = (obj: any) => {
					if (typeof obj === "object") {
						if (obj === null) return true;
						if (Array_isArray(obj)) {
							for (const item of obj) {
								// we need to recurse arrays but not objects for some reason
								if (!isSafe(item)) return false;
							}
						} else {
							// note that this tag can be faked by setting Symbol.toStringTag
							// but you can't fake a Date/RegExp to *not* show up as such
							const tag = Object_toString(obj);
							if (
								tag === "[object Date]" &&
								!client.box.date_toStrings.has(obj.toString)
							) {
								return false;
							} else if (
								tag === "[object RegExp]" &&
								!client.box.regexp_toStrings.has(obj.toString)
							) {
								return false;
							}
							// we don't actually need to walk the object prototypes
						}
					} else if (typeof obj === "function") {
						// overwritten toString on function
						if (!client.box.function_toStrings.has(obj.toString)) {
							return false;
						}
					}

					return true;
				};

				if (!isSafe(argarray)) {
					dbg.warn("Blocked potential devtools detection attempt");

					return;
				}

				// https://github.com/theajack/disable-devtool/blob/master/src/utils/util.ts#L153
				// not concerned about correctness for this one it's only this library that does this
				if (
					argarray.length === 1 &&
					Array_isArray(argarray[0]) &&
					argarray[0].length === 50 &&
					Object_keys(argarray[0][0]).length == 500
				) {
					return;
				}

				return Reflect_apply(func, thisarg, argarray);
			},
		} as ProxyHandler<typeof console.log>);

		client.RawTrap(self.console, method, {
			set(_ctx, v) {
				// sometimes instead of actually fixing the code sites just noop the global console.log
				console.warn(`ignored attempt to overwrite console.${method}`, v);
			},
			get(_ctx) {
				return proxy;
			},
		});
	}
}
