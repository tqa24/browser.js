import { ScramjetClient } from "./client";
import { SourceMaps } from "./shared/sourcemaps";

export class SingletonBox {
	clients: ScramjetClient[] = [];
	globals: Map<Self, ScramjetClient> = new Map();
	documents: Map<Document, ScramjetClient> = new Map();
	locations: Map<Location, ScramjetClient> = new Map();

	sourcemaps: SourceMaps = {};

	function_toStrings: Map<Function["toString"], ScramjetClient> = new Map();
	regexp_toStrings: Map<RegExp["toString"], ScramjetClient> = new Map();
	date_toStrings: Map<Date["toString"], ScramjetClient> = new Map();

	constructor(public ownerclient: ScramjetClient) {}

	registerClient(client: ScramjetClient, global: Self) {
		this.clients.push(client);
		this.globals.set(global, client);
		this.documents.set(global.document, client);
		this.locations.set(global.location, client);

		this.function_toStrings.set(global.Function.prototype.toString, client);
		this.regexp_toStrings.set(global.RegExp.prototype.toString, client);
		this.date_toStrings.set(global.Date.prototype.toString, client);
	}
}
