import { config, flagEnabled } from "@/shared";
import { unrewriteUrl } from "@rewriters/url";
import {
	Array_find,
	Array_findIndex,
	Array_join,
	Array_splice,
	ScramjetClient,
	String_endsWith,
	String_includes,
	String_split,
} from "@client/index";

export const enabled = (client: ScramjetClient) =>
	flagEnabled("cleanErrors", client.url);

export default function (client: ScramjetClient, _self: Self) {
	// v8 only. all we need to do is clean the scramjet urls from stack traces
	const closure = (error, stack) => {
		let newstack = error.stack;

		for (let i = 0; i < stack.length; i++) {
			const url = stack[i].getFileName();

			try {
				if (String_endsWith(url, config.files.all)) {
					// strip stack frames including scramjet handlers from the trace
					const lines = String_split(newstack, "\n");
					const line = Array_findIndex(lines, (l) => String_includes(l, url));
					Array_splice(lines, line, 1);
					newstack = Array_join(lines, "\n");
					continue;
				}
			} catch {}

			try {
				newstack = newstack.replaceAll(url, unrewriteUrl(url));
			} catch {}
		}

		return newstack;
	};
	client.Trap("Error.prepareStackTrace", {
		get(_ctx) {
			// this is a funny js quirk. the getter is ran every time you type something in console
			return closure;
		},
		set(_value) {
			// just ignore it if a site tries setting their own. not much we can really do
		},
	});
}
