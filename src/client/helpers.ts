export function getOwnPropertyDescriptorHandler(target, prop) {
	const realDescriptor = Reflect.getOwnPropertyDescriptor(target, prop);

	return realDescriptor;
}

export const Object_keys = Object.keys;
export const Object_values = Object.values;
export const Object_getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

const object_toString_func = Object.prototype.toString;
export const Object_toString = (obj: any): string => {
	return Reflect_apply(object_toString_func, obj, []);
};

export const Reflect_get = Reflect.get;
export const Reflect_set = Reflect.set;
export const Reflect_ownKeys = Reflect.ownKeys;
export const Reflect_has = Reflect.has;
export const Reflect_apply = Reflect.apply;

export const Global_Number = Number;
export const Global_isNaN = isNaN;

export const Array_isArray = Array.isArray;

// safe to be in here - ArraySpeciesCreate() will construct the array from the original realm
const array_filter_func = Array.prototype.filter;
export function Array_filter<T>(
	array: Array<T>,
	func: (arg: T) => boolean
): Array<T> {
	return Reflect_apply(array_filter_func, array, [func]);
}

const array_includes_func = Array.prototype.includes;
export function Array_includes<T>(array: Array<T>, item: T): boolean {
	return Reflect_apply(array_includes_func, array, [item]);
}

const array_indexOf_func = Array.prototype.indexOf;
export function Array_indexOf<T>(array: Array<T>, item: T): number {
	return Reflect_apply(array_indexOf_func, array, [item]);
}

const array_push_func = Array.prototype.push;
export function Array_push<T>(array: Array<T>, ...items: T[]) {
	return Reflect_apply(array_push_func, array, items);
}

const array_splice_func = Array.prototype.splice;
export function Array_splice<T>(
	array: Array<T>,
	start: number,
	deleteCount?: number,
	...items: T[]
): T[] {
	return Reflect_apply(array_splice_func, array, [
		start,
		deleteCount,
		...items,
	]);
}

const array_join_func = Array.prototype.join;
export function Array_join<T>(array: Array<T>, separator?: string): string {
	return Reflect_apply(array_join_func, array, [separator]);
}

const array_find_func = Array.prototype.find;
export function Array_find<T>(
	array: Array<T>,
	func: (arg: T) => boolean
): T | undefined {
	return Reflect_apply(array_find_func, array, [func]);
}

const array_findIndex_func = Array.prototype.findIndex;
export function Array_findIndex<T>(
	array: Array<T>,
	func: (arg: T) => boolean
): number {
	return Reflect_apply(array_findIndex_func, array, [func]);
}

const string_slice_func = String.prototype.slice;
export function String_slice(str: string, start: number, end?: number): string {
	return Reflect_apply(string_slice_func, str, [start, end]);
}

const string_startsWith_func = String.prototype.startsWith;
export function String_startsWith(str: string, search: string): boolean {
	return Reflect_apply(string_startsWith_func, str, [search]);
}

const string_endsWith_func = String.prototype.endsWith;
export function String_endsWith(str: string, search: string): boolean {
	return Reflect_apply(string_endsWith_func, str, [search]);
}

const string_replace_func = String.prototype.replace;
export function String_replace(
	str: string,
	searchValue: string | RegExp,
	replaceValue: string
): string {
	return Reflect_apply(string_replace_func, str, [searchValue, replaceValue]);
}

const string_split_func = String.prototype.split;
export function String_split(
	str: string,
	separator: string | RegExp,
	limit?: number
): string[] {
	return Reflect_apply(string_split_func, str, [separator, limit]);
}

const string_includes_func = String.prototype.includes;
export function String_includes(str: string, search: string) {
	return Reflect_apply(string_includes_func, str, [search]);
}
