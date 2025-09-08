import { rewriteCss, unrewriteCss } from "@rewriters/css";
import {
	Array_includes,
	Object_getOwnPropertyNames,
	Reflect_apply,
	Reflect_get,
	Reflect_set,
	ScramjetClient,
} from "@client/index";

export default function (client: ScramjetClient) {
	const CSSStyleDeclaration_keys = Object_getOwnPropertyNames(
		CSSStyleDeclaration.prototype
	);

	client.Proxy("CSSStyleDeclaration.prototype.setProperty", {
		apply(ctx) {
			if (!ctx.args[1]) return;
			ctx.args[1] = rewriteCss(ctx.args[1], client.meta);
		},
	});

	client.Proxy("CSSStyleDeclaration.prototype.getPropertyValue", {
		apply(ctx) {
			const v = ctx.call();
			if (!v) return v;
			ctx.return(unrewriteCss(v));
		},
	});

	client.Trap("CSSStyleDeclaration.prototype.cssText", {
		set(ctx, value: string) {
			ctx.set(rewriteCss(value, client.meta));
		},
		get(ctx) {
			return unrewriteCss(ctx.get());
		},
	});

	client.Proxy("CSSStyleSheet.prototype.insertRule", {
		apply(ctx) {
			ctx.args[0] = rewriteCss(ctx.args[0], client.meta);
		},
	});

	client.Proxy("CSSStyleSheet.prototype.replace", {
		apply(ctx) {
			ctx.args[0] = rewriteCss(ctx.args[0], client.meta);
		},
	});

	client.Proxy("CSSStyleSheet.prototype.replaceSync", {
		apply(ctx) {
			ctx.args[0] = rewriteCss(ctx.args[0], client.meta);
		},
	});

	client.Trap("CSSRule.prototype.cssText", {
		set(ctx, value: string) {
			ctx.set(rewriteCss(value, client.meta));
		},
		get(ctx) {
			return unrewriteCss(ctx.get());
		},
	});

	client.Proxy("CSSStyleValue.parse", {
		apply(ctx) {
			if (!ctx.args[1]) return;
			ctx.args[1] = rewriteCss(ctx.args[1], client.meta);
		},
	});

	client.Trap("HTMLElement.prototype.style", {
		get(ctx) {
			// unfortunate and dumb hack. we have to trap every property of this
			// since the prototype chain is fucked

			const style = ctx.get() as CSSStyleDeclaration;

			return client.natives.construct("Proxy", style, {
				get(target, prop) {
					const value = Reflect_get(target, prop);

					if (typeof value === "function") {
						return client.natives.construct("Proxy", value, {
							apply(target, that, args) {
								return Reflect_apply(target, style, args);
							},
						} as ProxyHandler<any>);
					}

					if (Array_includes(CSSStyleDeclaration_keys, prop)) return value;
					if (!value) return value;

					return unrewriteCss(value);
				},
				set(target, prop, value) {
					if (prop == "cssText" || value == "" || typeof value !== "string") {
						return Reflect_set(target, prop, value);
					}

					return Reflect_set(target, prop, rewriteCss(value, client.meta));
				},
			} as ProxyHandler<CSSStyleDeclaration>);
		},
		set(ctx, value: string) {
			// this will actually run the trap for cssText. don't rewrite it here
			ctx.set(value);
		},
	});
}
