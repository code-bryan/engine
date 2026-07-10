import type { Entity } from "@engine/ecs-core";
import { sprites, transforms } from "@engine/renderer";
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
    // Attached iff the store holds a value — so a non-editable component (0 fields)
    // still renders its header, but a component the entity lacks stays hidden.
    present: (_world, entity) => options.store.has(entity),
    remove: (_world, entity) => { options.store.delete(entity); },
    set(world, entity, key, next) {
      const value = options.store.get(entity);
      if (value === undefined || !options.set) return;
      options.set(value, key, next, world, entity);
    },
  };
}

export function createBuiltinInspectorComponents<TWorld extends DebuggerWorld>(
  getEntityPrefab?: (world: TWorld, entity: Entity) => string | undefined,
): DebugInspectorComponent<TWorld>[] {
  return [
    {
      id: "entity",
      title: "Entity",
      fields(world, entity) {
        const prefab = getEntityPrefab?.(world, entity);
        // Name + Tags are edited in the dedicated Details header controls, so the
        // card only surfaces the immutable Id and the prefab link.
        return [
          { label: "Id", value: `#${entity}`, selectEntity: entity },
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
              { label: "X", value: formatScalar(transform.position.x), editKey: "x" },
              { label: "Y", value: formatScalar(transform.position.y), editKey: "y" },
            ],
          },
          {
            label: "Scale",
            value: "",
            editable: true,
            axes: [
              { label: "X", value: formatScalar(effectiveSize(entity, transform.size.x, "width")), editKey: "sizeX" },
              { label: "Y", value: formatScalar(effectiveSize(entity, transform.size.y, "height")), editKey: "sizeY" },
            ],
          },
          {
            label: "Rotation",
            value: "",
            editable: true,
            axes: [
              { label: "°", value: formatScalar(transform.rotation * (180 / Math.PI)), editKey: "rotation" },
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
        // Size is a dimension — never negative from the inspector. (Mirroring is
        // handled by the facing system, which re-applies the size.x sign each frame.)
        if (key === "sizeX") transform.size.x = Math.max(0, next);
        if (key === "sizeY") transform.size.y = Math.max(0, next);
      },
    },
    {
      id: "physics",
      title: "Physics",
      fields(world, entity) {
        const cfg = world.physics.getBodyConfig(entity);
        if (!cfg) return [];
        return [
          { label: "Body Type", value: cfg.kind, editable: true, editKey: "bodyType", options: ["dynamic", "kinematic", "static"] },
          { label: "Collision", value: cfg.isTrigger ? "Trigger" : "Collider", editable: true, editKey: "collision", options: ["Collider", "Trigger"] },
          {
            label: "Size",
            value: "",
            editable: true,
            axes: [
              { label: "W", value: formatNumber(cfg.width), editKey: "width" },
              { label: "H", value: formatNumber(cfg.height), editKey: "height" },
            ],
          },
          { label: "Mass", value: formatNumber(cfg.mass), editable: true, editKey: "mass" },
          { label: "Friction", value: formatNumber(cfg.friction), editable: true, editKey: "friction" },
          { label: "Bounciness", value: formatNumber(cfg.restitution), editable: true, editKey: "restitution" },
          { label: "Damping", value: formatNumber(cfg.frictionAir), editable: true, editKey: "frictionAir" },
        ];
      },
      remove(world, entity) {
        world.physics.removeBody(entity);
      },
      set(world, entity, key, rawValue) {
        const cfg = world.physics.getBodyConfig(entity);
        const transform = transforms.get(entity);
        if (!cfg || !transform) return;

        const next = { ...cfg };
        if (key === "bodyType") {
          if (rawValue === "dynamic" || rawValue === "kinematic" || rawValue === "static") next.kind = rawValue;
        } else if (key === "collision") {
          next.isTrigger = rawValue === "Trigger";
        } else {
          const value = Number(rawValue);
          if (Number.isNaN(value)) return;
          const clamped = Math.max(0, value);
          if (key === "width") next.width = clamped;
          else if (key === "height") next.height = clamped;
          else if (key === "mass") next.mass = clamped;
          else if (key === "friction") next.friction = clamped;
          else if (key === "restitution") next.restitution = clamped;
          else if (key === "frictionAir") next.frictionAir = clamped;
        }

        world.physics.setBody(entity, {
          x: transform.position.x,
          y: transform.position.y,
          width: next.width || transform.size.x || 16,
          height: next.height || transform.size.y || 16,
          kind: next.kind,
          isTrigger: next.isTrigger,
          mass: next.mass,
          friction: next.friction,
          restitution: next.restitution,
          frictionAir: next.frictionAir,
        });
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
    hasFields: boolean;
    removable: boolean;
  }> = [];

  for (const component of components) {
    const fields = component.fields(world, state.selectedEntity);
    // Show the card if the component is attached (present), even with no editable
    // fields — Unity-style empty header. Absent components are skipped.
    const present = component.present ? component.present(world, state.selectedEntity) : fields.length > 0;
    if (!present) continue;
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
      hasFields: fields.length > 0,
      removable: !!component.remove,
    });
  }

  return cards;
}

function formatNumber(value?: number) {
  return value === undefined ? "-" : value.toFixed(2);
}

// Editable numeric fields: show whole numbers as plain integers (no ".00") and trim
// float noise / trailing zeros (92.690000001 → "92.69", 100 → "100", 1.05 → "1.05").
function formatScalar(value: number) {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value * 1000) / 1000);
}

// Effective size shown in the Size field: the explicit size when set (nonzero),
// otherwise the sprite's native texture size (what "auto" renders), else 0.
function effectiveSize(entity: Entity, size: number, dim: "width" | "height") {
  if (size !== 0) return size;
  const texture = sprites.get(entity)?.sprite.texture;
  return texture ? texture[dim] : 0;
}
