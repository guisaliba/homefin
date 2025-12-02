import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
// cookies is an async function, headers might be generated dynamically

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const createClient = (cookieStore: ReturnType<typeof cookies>) => {
	// cookieStore isn't the cookies itself but a Promise that resolves to it
	return createServerClient(supabaseUrl!, supabaseKey!, {
		cookies: {
			async getAll() {
				return (await cookieStore).getAll(); // reads sb-access-token and sb-refresh-token
			},
			setAll(cookiesToSet) {
				try {
					cookiesToSet.forEach(async ({ name, value, options }) =>
						(await cookieStore).set(name, value, options)
					);
				} catch {
					// The `setAll` method was called from a Server Component.
					// This can be ignored if you have middleware refreshing
					// user sessions.
					// In an HTTP response, Headers (including Set-Cookie)
					// must be sent before the Body (the HTML/JSON content).
					// The middleware can set cookies because the response
					// hasn't started streaming yet.
				}
			},
		},
	});
};
