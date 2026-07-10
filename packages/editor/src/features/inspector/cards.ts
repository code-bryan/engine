import type { Entity } from "@engine/ecs-core";
import { transforms } from "@engine/renderer";
import type {
  DebugEditorField,
  DebugInspectorComponent,
  DebugStoreInspectorOptions,
  DebuggerWorld,
  RuntimeDebuggerOptions,
} from "../../shared/types";

export function createStoreInspector<TValue, TWorld extends DebuggerWorld = DebuggerWorld>(
  options: DebugStoreInspectorOptions<TValue, TWorld>,
): DebugInspectorComponent<TWorld> {
  return {
    id: options.id,
    title: options.title,
    fields(world, entity) {
      const value = options.store.get(entity);
      if (value === undefined) return [];
      return options.fields(value, world, entity);
    },
    set(world, entity, key, next) {
      const value = options.store.get(entity);
      if (value === undefined || !options.set) return;
      options.set(value, key, next, world, entity);
    },
  };
}

export function createBuiltinInspectorComponents<TWorld extends DebuggerWorld>(
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
  getEntityPrefab?: (world: TWorld, entity: Entity) => string | undefined,
): DebugInspectorComponent<TWorld>[] {
  return [
    {
      id: "entity",
      title: "Entity",
      fields(world, entity) {
        const prefab = getEntityPrefab?.(world, entity);
        return [
          { label: "Id", value: `#${entity}`, selectEntity: entity },
          { label: "Name", value: getEntityTitle?.(world, entity) ?? entityTitle(world, entity) },
          { label: "Tags", value: world.tags.list(entity).join(", ") || "-" },
          ...(prefab ? [{ label: "Prefab", value: prefab }] : []),
        ];
      },
    },
    {
      id: "transform",
      title: "Transform",
      fields(world, entity) {
        const transform = transforms.get(entity);
        if (!transform) return [];
        return [
          {
            label: "Position",
            value: "",
            editable: true,
            axes: [
              { label: "X", value: formatNumber(transform.position.x), editKey: "x" },
              { label: "Y", value: formatNumber(transform.position.y), editKey: "y" },
            ],
          },
          {
            label: "Scale",
            value: "",
            editable: true,
            axes: [
              { label: "X", value: formatNumber(transform.scale.x), editKey: "scaleX" },
              { label: "Y", value: formatNumber(transform.scale.y), editKey: "scaleY" },
            ],
          },
          {
            label: "Rotation",
            value: "",
            editable: true,
            axes: [
              { label: "°", value: formatNumber(transform.rotation * (180 / Math.PI)), editKey: "rotation" },
            ],
          },
        ];
      },
      set(world, entity, key, rawValue) {
        const next = Number(rawValue);
        if (Number.isNaN(next)) return;

        const transform = transforms.get(entity);
        if (!transform) return;

        if (key === "x") transform.position.x = next;
        if (key === "y") transform.position.y = next;
        if (key === "rotation") transform.rotation = next * (Math.PI / 180);
        if (key === "scaleX") transform.scale.x = next;
        if (key === "scaleY") transform.scale.y = next;
      },
    },
    {
      id: "physics",
      title: "Physics",
      fields(world, entity) {
        const body = world.physics.getDebugBodies().find((item) => item.entity === entity);
        if (!body) return [];
        return [
          { label: "Kind", value: body.kind },
          { label: "Bounds", value: `${formatNumber(body.width)} x ${formatNumber(body.height)}` },
          { label: "Colliding", value: body.isColliding ? "yes" : "no" },
        ];
      },
    },
  ];
}

export function applyInspectorEdit<TWorld extends DebuggerWorld>(
  world: TWorld,
  components: Map<string, DebugInspectorComponent<TWorld>>,
  entity: Entity,
  componentId: string,
  key: string,
  rawValue: string,
) {
  components.get(componentId)?.set?.(world, entity, key, rawValue);
}

export function buildInspectorCards<TWorld extends DebuggerWorld>(
  world: TWorld,
  state: { selectedEntity?: Entity; inspectorQuery: string; collapsedComponents: Set<string> },
  components: DebugInspectorComponent<TWorld>[],
  options: RuntimeDebuggerOptions<TWorld>,
) {
  if (state.selectedEntity === undefined) return [];

  const query = state.inspectorQuery.trim().toLowerCase();
  const cards: Array<{
    id: string;
    title: string;
    collapsed: boolean;
    fields: Array<DebugEditorField & { componentId: string; entity: Entity }>;
  }> = [];

  for (const component of components) {
    const fields = component.fields(world, state.selectedEntity);
    if (fields.length === 0) continue;
    const collapsed = state.collapsedComponents.has(component.id);
    const visible = collapsed ? fields : fields.filter((field) =>
      !query || component.title.toLowerCase().includes(query) || field.label.toLowerCase().includes(query)
    );
    if (!collapsed && query && visible.length === 0) continue;
    cards.push({
      id: component.id,
      title: component.title,
      collapsed,
      fields: collapsed ? [] : visible.map((field) => ({ ...field, componentId: component.id, entity: state.selectedEntity! })),
    });
  }

  return cards;
}

function entityTitle<TWorld extends DebuggerWorld>(world: TWorld, entity: Entity) {
  const firstTag = world.tags.list(entity)[0] ?? "entity";
  return `${firstTag}_${entity}`;
}

function formatNumber(value?: number) {
  return value === undefined ? "-" : value.toFixed(2);
}
