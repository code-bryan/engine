import { useState } from "react";

// Project tag registry manager (Window ▸ Tags): search, add, and delete tags in
// the catalog the app persists across worlds. Deleting cascades to entities in
// the open world (handled by the host action); registering persists immediately.
export type TagsDrawerProps = {
  tags: string[];
  onRegisterTag: (tag: string) => void;
  onDeleteTag: (tag: string) => void;
};

export function TagsDrawer({ tags, onRegisterTag, onDeleteTag }: TagsDrawerProps) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();
  const filtered = tags.filter((tag) => tag.toLowerCase().includes(query.trim().toLowerCase()));
  const addDraft = () => {
    if (!trimmed || tags.includes(trimmed)) return;
    onRegisterTag(trimmed);
    setDraft("");
  };

  return (
    <div className="space-y-3 text-xs">
      <input
        className="engine-input w-full px-2 py-1 rounded"
        placeholder="search tags…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="flex gap-2">
        <input
          className="engine-input flex-1 px-2 py-1 rounded"
          placeholder="new tag…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") addDraft(); }}
        />
        <button
          className="px-3 py-1 bg-[#0070e0] hover:bg-[#0a80f0] text-white rounded transition-colors disabled:opacity-40 disabled:hover:bg-[#0070e0]"
          onClick={addDraft}
          disabled={!trimmed || tags.includes(trimmed)}
        >
          Add
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-[#666] py-2">{tags.length === 0 ? "no tags yet" : "no matches"}</div>
      ) : (
        <ul className="border border-[#303030] rounded overflow-hidden divide-y divide-[#303030]">
          {filtered.map((tag) => (
            <li key={tag} className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1a]">
              <span className="text-[#ccc] flex items-center gap-2"><i className="ph ph-tag text-[#888]" />{tag}</span>
              <button
                className="text-[#888] hover:text-[#f87171] transition-colors"
                title="Delete tag (removes it from every entity in the open world)"
                onClick={() => onDeleteTag(tag)}
                aria-label={`Delete tag ${tag}`}
              >
                <i className="ph ph-trash" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="text-[10px] text-[#666]">Deleting a tag removes it from every entity in the open world — ⌘S to save.</div>
    </div>
  );
}
