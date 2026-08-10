export function importanceClassName(level) {
  if (level === "大") return "tag-importance-high";
  if (level === "小") return "tag-importance-low";
  return "tag-importance-mid";
}
