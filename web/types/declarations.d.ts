// Broad module declarations reduced — keep only packages that cause hard missing-module errors
declare module '@supabase/supabase-js' {
	export function createClient(url: string, key: string): any;
	export const createClient: any;
	const _default: any;
	export default _default;
}
declare module 'stripe' { const x: any; export default x }
