export function getOwnPropertyDescriptorHandler(target, prop) {
	const realDescriptor = Reflect.getOwnPropertyDescriptor(target, prop);

	return realDescriptor;
}

export const Object_keys = Object.keys;
export const Object_values = Object.values;
export const Object_getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

export const Reflect_get = Reflect.get;
export const Reflect_ownKeys = Reflect.ownKeys;
export const Reflect_has = Reflect.has;
export const Reflect_apply = Reflect.apply;

export const Global_Number = Number;
export const Global_isNaN = isNaN;

const array_length_desc = Object_getOwnPropertyDescriptor(
	Array.prototype,
	"length"
).get;
export const Array_length = (array: Array<any>) => {
	Reflect_apply(array_length_desc, array, []);
};

// safe to be in here - ArraySpeciesCreate() will construct the array from the original realm
const array_filter_func = Array.prototype.filter;
export function Array_filter<T>(array: Array<T>, func: (arg: T) => boolean) {
	return Reflect_apply(array_filter_func, array, [func]);
}

const string_startsWith_func = String.prototype.startsWith;
export function String_startsWith(str: string, search: string) {
	return Reflect_apply(string_startsWith_func, str, [search]);
}
