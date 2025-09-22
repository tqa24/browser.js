import { rewriteHtml } from "@rewriters/html";
import { ScramjetClient, String_replace } from "@client/index";

export default function (client: ScramjetClient, _self: Self) {
	const tostring = String;
	client.Proxy(
		["Document.prototype.querySelector", "Document.prototype.querySelectorAll"],
		{
			apply(ctx) {
				// you can do querySelector("a[href='http://example.com']")
				// which won't work when we rewrite the url
				// so we need to rewrite the selector here
				ctx.args[0] = String_replace(
					tostring(ctx.args[0]),
					/((?:^|\s)\b\w+\[(?:src|href|data-href))[\^]?(=['"]?(?:https?[:])?\/\/)/,
					"$1*$2"
				);
			},
		}
	);

	client.Proxy("Document.prototype.write", {
		apply(ctx) {
			if (ctx.args[0])
				try {
					ctx.args[0] = rewriteHtml(
						ctx.args[0],
						client.cookieStore,
						client.meta,
						false
					);
				} catch {}
		},
	});

	client.Trap("Document.prototype.referrer", {
		get() {
			return client.url.toString();
		},
	});

	client.Proxy("Document.prototype.writeln", {
		apply(ctx) {
			if (ctx.args[0])
				try {
					ctx.args[0] = rewriteHtml(
						ctx.args[0],
						client.cookieStore,
						client.meta,
						false
					);
				} catch {}
		},
	});

	client.Proxy("Document.prototype.parseHTMLUnsafe", {
		apply(ctx) {
			if (ctx.args[0])
				try {
					ctx.args[0] = rewriteHtml(
						ctx.args[0],
						client.cookieStore,
						client.meta,
						false
					);
				} catch {}
		},
	});
}
