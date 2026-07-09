import type { ContentTreeNode } from "../../shared/types";

export function renderContentIcon(kind: ContentTreeNode["kind"]) {
  switch (kind) {
    case "folder":
      return <i className="ph-fill ph-folder" />;
    case "world":
      return <i className="ph-fill ph-globe-hemisphere-west" />;
    case "component":
      return <i className="ph-fill ph-puzzle-piece" />;
    case "prefab":
      return <i className="ph-fill ph-cube" />;
    case "graph":
      return <i className="ph-fill ph-graph" />;
    case "file":
      return <i className="ph-fill ph-file-code" />;
  }
}

export function contentTypeBarColor(kind: ContentTreeNode["kind"]) {
  switch (kind) {
    case "folder":
      return "bg-[#666]";
    case "world":
      return "bg-orange-500";
    case "component":
      return "bg-purple-500";
    case "prefab":
      return "bg-cyan-500";
    case "graph":
      return "bg-green-500";
    case "file":
      return "bg-blue-500";
  }
}
