import {
	Array_filter,
	Array_length,
	Object_keys,
	Reflect_apply,
	Reflect_get,
	Reflect_has,
	Reflect_ownKeys,
	ScramjetClient,
	String_startsWith,
} from "@client/index";

export default function (client: ScramjetClient, _self: typeof window) {
	const namedNodeMapProps = Object.getOwnPropertyNames(NamedNodeMap.prototype);

	const Global_isNaN = isNaN;
	const Global_Number = Number;

	client.Trap("Element.prototype.attributes", {
		get(ctx) {
			const map = ctx.get() as NamedNodeMap;
			const proxy = client.natives.construct("Proxy", map, {
				get(target, prop, _receiver) {
					const value = Reflect_get(target, prop);

					if (prop === "length") {
						return Array_length(Object_keys(proxy));
					}

					if (prop === "getNamedItem") {
						return (name: string) => proxy[name];
					}
					if (prop === "getNamedItemNS") {
						return (namespace: string, name: string) =>
							proxy[`${namespace}:${name}`];
					}

					if (prop in namedNodeMapProps && typeof value === "function") {
						return new Proxy(value, {
							apply(target, that, args) {
								if (that === proxy) {
									return Reflect_apply(target, map, args);
								}

								return Reflect_apply(target, that, args);
							},
						});
					}

					if (
						(typeof prop === "string" || typeof prop === "number") &&
						!Global_isNaN(Global_Number(prop))
					) {
						const position = Object_keys(proxy)[prop];

						return map[position];
					}

					if (!client.natives.call("NamedNodeMap.prototype.has", target, prop))
						return undefined;

					return value;
				},
				ownKeys(target) {
					const keys = Reflect_ownKeys(target);

					return Array_filter(keys, (key) => this.has(target, key));
				},
				has(target, prop) {
					if (typeof prop === "symbol") return Reflect_has(target, prop);
					if (String_startsWith(prop, "scramjet-attr-")) return false;
					if (
						map[prop]?.name &&
						String_startsWith(map[prop].name, "scramjet-attr-")
					)
						return false;

					return Reflect_has(target, prop);
				},
			} as ProxyHandler<NamedNodeMap>);

			return proxy;
		},
	});

	client.Trap(["Attr.prototype.value", "Attr.prototype.nodeValue"], {
		get(ctx) {
			const ownerElement = client.descriptors.get(
				"Attr.prototype.ownerElement",
				ctx.this
			);
			if (ownerElement) {
				// specifically use the proxied version here
				// TODO less jank
				return ownerElement.getAttribute(ctx.this.name);
			}

			return ctx.get();
		},
		set(ctx, value) {
			const ownerElement = client.descriptors.get(
				"Attr.prototype.ownerElement",
				ctx.this
			);
			if (ownerElement) {
				return ownerElement.setAttribute(ctx.this.name, value);
			}

			return ctx.set(value);
		},
	});
}
