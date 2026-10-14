let accessToken: string | null = null;
let refreshFlight: Promise<void> | null = null;
let generation = 0;
const subscriptionListeners = new Set<() => void>();
export function onSubscriptionRequired(listener: () => void) { subscriptionListeners.add(listener); return () => { subscriptionListeners.delete(listener); }; }
export class ApiError extends Error {
    constructor(message: string, public status: number, public code?: string) { super(message); }
}
export function setToken(token: string | null) { generation++; accessToken = token; }
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`/api/v1${path}`, {
            ...init, credentials: "same-origin", cache: "no-store",
            headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers },
        });
    }
    catch {
        throw new ApiError("Tidak dapat terhubung. Periksa koneksi dan server backend.", 0);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
        if (res.status === 403 && ["SUBSCRIPTION_REQUIRED", "SUBSCRIPTION_EXPIRED", "SUBSCRIPTION_NOT_STARTED"].includes(body?.code)) subscriptionListeners.forEach(listener => listener());
        throw new ApiError(body?.message ?? "Server tidak dapat memproses permintaan. Silakan coba lagi.", res.status, body?.code);
    }
    return body.data as T;
}
export async function refresh() {
    if (!refreshFlight) {
        const current = generation;
        refreshFlight = request<{
            accessToken: string;
        }>("/auth/refresh", { method: "POST" })
            .then(data => { if (generation === current)
            accessToken = data.accessToken; })
            .finally(() => { refreshFlight = null; });
    }
    return refreshFlight;
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    try {
        return await request<T>(path, init);
    }
    catch (error) {
        if (error instanceof ApiError && error.status === 401 && !path.startsWith("/auth/")) {
            await refresh();
            return request<T>(path, init);
        }
        throw error;
    }
}
export const post = <T>(path: string, data?: unknown) => api<T>(path, { method: "POST", ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
export const money = (value: string | number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
