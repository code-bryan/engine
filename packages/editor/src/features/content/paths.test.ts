import { test, expect } from "bun:test";
import { joinContentPath, parentContentPath, breadcrumbPaths, findContentFolder } from "./paths";
import type { ContentTreeNode } from "../../shared/types";

test("joinContentPath joins and trims", () => {
  expect(joinContentPath("worlds", "level1")).toBe("worlds/level1");
  expect(joinContentPath("", "level1")).toBe("level1");
  expect(joinContentPath("worlds", "/sub/")).toBe("worlds/sub");
  expect(joinContentPath("worlds", "  ")).toBe("worlds");
});

test("parentContentPath drops the last segment", () => {
  expect(parentContentPath("a/b/c")).toBe("a/b");
  expect(parentContentPath("a")).toBe("");
  expect(parentContentPath(undefined)).toBe("");
});

test("breadcrumbPaths builds cumulative crumbs starting at Content", () => {
  expect(breadcrumbPaths("a/b")).toEqual([
    { label: "Content", path: "" },
    { label: "a", path: "a" },
    { label: "b", path: "a/b" },
  ]);
});

test("findContentFolder returns a synthetic root for empty path", () => {
  const tree: ContentTreeNode[] = [{ name: "worlds", path: "worlds", kind: "folder", children: [] }];
  expect(findContentFolder(tree, "")?.path).toBe("");
  expect(findContentFolder(tree, "")?.children).toBe(tree);
});

test("findContentFolder locates a nested folder", () => {
  const tree: ContentTreeNode[] = [
    { name: "worlds", path: "worlds", kind: "folder", children: [
      { name: "sub", path: "worlds/sub", kind: "folder", children: [] },
    ] },
  ];
  expect(findContentFolder(tree, "worlds/sub")?.name).toBe("sub");
  expect(findContentFolder(tree, "missing")).toBeUndefined();
});
