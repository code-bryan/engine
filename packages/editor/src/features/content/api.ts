export async function fetchContentFile(path: string): Promise<unknown | null> {
  const response = await fetch(`/api/content/file?path=${encodeURIComponent(path)}`);
  if (!response.ok) return null;
  return await response.json();
}

export async function saveContentJson(path: string, value: unknown): Promise<void> {
  await fetch(`/api/content/file?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value, null, 2),
  });
}
