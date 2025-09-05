export const API_URL: string = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000';

export const apiFetch = (path: string, init?: RequestInit) => {
	const url = path.startsWith('http') ? path : `${API_URL}${path}`;
	return fetch(url, init);
};


