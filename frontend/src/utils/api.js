const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Authenticated fetch wrapper.
 * Sends session token as Bearer header AND includes cookies.
 * Accepts either a path ("/api/events") or full URL.
 */
export function apiFetch(url, options = {}) {
  const token = localStorage.getItem("photosync_session_token");
  const headers = { ...options.headers };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const fullUrl = url.startsWith("http") ? url : `${BACKEND_URL}${url}`;
  return fetch(fullUrl, {
    ...options,
    headers,
    credentials: "include",
  });
}

export { BACKEND_URL };
