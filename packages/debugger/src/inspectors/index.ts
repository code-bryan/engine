import type { Entity } from "@engine/ecs-core";
import { transforms, type TransformScale } from "@engine/renderer";
import type {
  DebugEditorField,
  DebugInspectorComponent,
  DebugStoreInspectorOptions,
  DebuggerWorld,
  RuntimeDebuggerOptions,
} from "../shared/types";

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
): DebugInspectorComponent<TWorld>[] {
  return [
    {
      id: "entity",
      title: "Entity",
      fields(world, entity) {
        return [
          { label: "Id", value: `#${entity}`, selectEntity: entity },
          { label: "Name", value: getEntityTitle?.(world, entity) ?? entityTitle(world, entity) },
          { label: "Tags", value: world.tags.list(entity).join(", ") || "-" },
        ];
      },
    },
    {
      id: "transform",
      title: "Transform",
      fields(world, entity) {
        const transform = transforms.get(entity);
        if (!transform) return [];
        const scale = normalizeScale(transform.scale);
        return [
          { label: "X", value: formatNumber(transform.x), editable: true, editKey: "x" },
          { label: "Y", value: formatNumber(transform.y), editable: true, editKey: "y" },
          { label: "Scale X", value: formatNumber(scale.x), editable: true, editKey: "scaleX" },
          { label: "Scale Y", value: formatNumber(scale.y), editable: true, editKey: "scaleY" },
          { label: "Rot", value: formatNumber(transform.rotation), editable: true, editKey: "rotation" },
        ];
      },
      set(world, entity, key, rawValue) {
        const next = Number(rawValue);
        if (Number.isNaN(next)) return;

        const transform = transforms.get(entity);
        if (!transform) return;

        if (key === "x") transform.x = next;
        if (key === "y") transform.y = next;
        if (key === "rotation") transform.rotation = next;
        if (key === "scaleX" || key === "scaleY") {
          const scale = normalizeScale(transform.scale);
          if (key === "scaleX") scale.x = next;
          if (key === "scaleY") scale.y = next;
          transform.scale = scale;
        }
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

  const runtimeFields = [{ label: "Details", value: options.getRuntimeDetails?.(world, state.selectedEntity) ?? defaultRuntimeDetails(world, state.selectedEntity) }];
  const runtimeVisible = runtimeFields.filter((field) => !query || "runtime".includes(query) || field.label.toLowerCase().includes(query));
  if (!query || runtimeVisible.length > 0) {
    cards.push({
      id: "runtime",
      title: "Runtime",
      collapsed: false,
      fields: runtimeVisible.map((field) => ({ ...field, componentId: "runtime", entity: state.selectedEntity! })),
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

function normalizeScale(scale?: TransformScale) {
  if (scale === undefined) return { x: 1, y: 1 };
  return typeof scale === "number" ? { x: scale, y: scale } : scale;
}

function defaultRuntimeDetails(world: DebuggerWorld, entity: Entity) {
  const transform = transforms.get(entity);
  return [
    `entity=${entity}`,
    `tags=${world.tags.list(entity).join(",") || "-"}`,
    `x=${formatNumber(transform?.x)}`,
    `y=${formatNumber(transform?.y)}`,
  ].join(" | ");
}
