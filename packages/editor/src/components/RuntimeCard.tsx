export type RuntimeCardProps = { title: string; fields: Array<{ label: string; value: string }> };

export function RuntimeCard(props: { title: string; fields: Array<{ label: string; value: string }> }) {
  return (
    <div className="bg-[#111111] border border-[#303030] rounded p-2 space-y-1">
      <div className="text-white font-medium mb-1">{props.title}</div>
      {props.fields.map((field, index) => (
        <div className="flex items-center justify-between gap-2" key={`${field.label}-${index}`}>
          <span className="text-[#888]">{field.label}</span>
          <strong className="text-[#ccc] font-mono text-[11px] truncate">{field.value}</strong>
        </div>
      ))}
    </div>
  );
}
