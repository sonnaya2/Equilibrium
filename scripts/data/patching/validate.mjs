// What a patch operation is allowed to say, in one place.
//
// Validation never touches the parsed operation: it returns a frozen validated
// copy with defaults applied and identifiers normalized, and the handlers in
// operations.mjs read only that copy. Anything the database has to answer —
// whether an entity exists, whether a source is already cited — belongs to the
// handler, not here.
import { normalizeRegion, scalar, slugify } from "../utilities.mjs";

// Canonical column names. A patch writes the database directly, so these are
// the database's own field names rather than any historical record spelling.
const ENTITY_FIELDS = new Set([
  "name",
  "entity_type",
  "short_description",
  "detailed_description",
  "verified_at",
  "status",
  "sort_key",
]);
const SOURCE_FIELDS = new Set([
  "url",
  "page_title",
  "publisher",
  "source_family",
  "verified_at",
  "retrieved_at",
  "source_role",
  "content_hash",
]);
const REGION_RELATIONS = new Set(["primary", "required", "optional", "hint", "excluded", "global"]);

// Every operation, the keys it accepts and the keys it requires. `op` is always
// accepted, and `reason` is accepted everywhere as an annotation — `remove` is
// the one operation that requires it.
const SCHEMA = new Map([
  ["upsert", { keys: ["entity", "set"], required: ["entity", "set"] }],
  ["upsert-source", { keys: ["source", "set"], required: ["source", "set"] }],
  ["link-region", { keys: ["entity", "region", "relation", "order", "group"], required: ["entity", "region"] }],
  ["unlink-region", { keys: ["entity", "region", "relation", "order", "group"], required: ["entity", "region"] }],
  ["link-source", { keys: ["entity", "source", "role", "order"], required: ["entity", "source"] }],
  ["unlink-source", { keys: ["entity", "source", "role", "order"], required: ["entity", "source"] }],
  ["relate", { keys: ["entity", "target", "relation", "order"], required: ["entity", "target", "relation"] }],
  ["unrelate", { keys: ["entity", "target", "relation"], required: ["entity", "target", "relation"] }],
  ["remove", { keys: ["entity", "reason"], required: ["entity", "reason"] }],
  ["set-record", { keys: ["file", "path", "body", "reason"], required: ["file", "path", "body"] }],
  [
    "add-requirement",
    { keys: ["entity", "description", "kind", "skill", "level", "target"], required: ["entity", "description"] },
  ],
  ["remove-requirement", { keys: ["entity", "description", "kind"], required: ["entity", "description"] }],
  ["add-effect", { keys: ["entity", "description", "key", "value"], required: ["entity", "description"] }],
  ["remove-effect", { keys: ["entity", "description", "key"], required: ["entity", "description"] }],
  ["add-tag", { keys: ["entity", "tag", "label"], required: ["entity", "tag"] }],
  ["remove-tag", { keys: ["entity", "tag"], required: ["entity", "tag"] }],
]);

const fail = (context, message) => {
  throw new Error(`${context}: ${message}`);
};

function identifier(operation, key, context) {
  const value = scalar(operation[key]).trim();
  if (!value) fail(context, `${key} is required`);
  return value;
}

function order(operation, context) {
  const value = operation.order ?? 0;
  if (!Number.isInteger(value) || value < 0) fail(context, `order must be a non-negative integer`);
  return value;
}

// Assignments are copied key by key out of an allowlist, so nothing downstream
// interpolates a key the caller chose into SQL.
function assignments(operation, allowed, context) {
  const { set } = operation;
  if (!set || typeof set !== "object" || Array.isArray(set)) fail(context, "set must be an object of scalar fields");
  const unknown = Object.keys(set).filter((key) => !allowed.has(key));
  if (unknown.length) fail(context, `unsupported set fields: ${unknown.join(", ")}`);
  const copy = {};
  for (const key of Object.keys(set).sort()) {
    const value = set[key];
    if (value != null && typeof value === "object") {
      fail(context, `set.${key} must be a scalar; arrays and objects need a narrow operation`);
    }
    copy[key] = value ?? null;
  }
  if (!Object.keys(copy).length) fail(context, "set cannot be empty");
  return copy;
}

function httpUrl(value, context) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(context, `source URL is not a URL: ${value}`);
  }
  if (!/^https?:$/.test(parsed.protocol)) fail(context, "source URL must use HTTP or HTTPS");
  return parsed.href;
}

// Per-operation shaping. Each returns only the fields its handler reads.
const SHAPE = {
  upsert: (operation, context) => ({
    entity: identifier(operation, "entity", context),
    set: assignments(operation, ENTITY_FIELDS, context),
  }),
  "upsert-source": (operation, context) => {
    const set = assignments(operation, SOURCE_FIELDS, context);
    if (set.url != null) set.url = httpUrl(set.url, context);
    return { source: identifier(operation, "source", context), set };
  },
  region: (operation, context) => {
    const region = normalizeRegion(operation.region);
    if (!region) fail(context, `unknown region: ${scalar(operation.region) || "(empty)"}`);
    const relation = scalar(operation.relation, "required");
    if (!REGION_RELATIONS.has(relation)) fail(context, `invalid region relation: ${relation}`);
    return {
      entity: identifier(operation, "entity", context),
      region,
      // A global link is global whatever relation the patch named.
      relation: region === "global" ? "global" : relation,
      order: order(operation, context),
      group: scalar(operation.group),
    };
  },
  source: (operation, context) => ({
    entity: identifier(operation, "entity", context),
    source: identifier(operation, "source", context),
    role: scalar(operation.role, "verification"),
    order: order(operation, context),
  }),
  relate: (operation, context) => ({
    entity: identifier(operation, "entity", context),
    target: identifier(operation, "target", context),
    predicate: identifier(operation, "relation", context),
    order: order(operation, context),
  }),
  remove: (operation, context) => ({
    entity: identifier(operation, "entity", context),
    reason: identifier(operation, "reason", context),
  }),
  // Documents are rebuilt as skeleton + source records, so revealing something
  // new in one - a relic tier, a task band - means writing the record itself.
  // Every other operation edits an entity, which no document is assembled from.
  "set-record": (operation, context) => {
    const file = identifier(operation, "file", context);
    if (!file.startsWith("data/") || file.includes("..")) {
      fail(context, `record file must sit under data/: ${file}`);
    }
    const path = identifier(operation, "path", context);
    if (!path.startsWith("$.")) fail(context, `record path must be a JSON path: ${path}`);
    if (operation.body == null || typeof operation.body !== "object") {
      fail(context, "set-record body must be an object");
    }
    return { file, path, body: operation.body, reason: scalar(operation.reason) };
  },
  // A requirement is keyed by (entity, kind, description), so those three are
  // the whole identity — the ordinal is the database's, and the handler picks it.
  requirement: (operation, context) => {
    const level = operation.level ?? null;
    if (level !== null && (!Number.isInteger(level) || level < 0 || level > 200)) {
      fail(context, "level must be an integer between 0 and 200");
    }
    return {
      entity: identifier(operation, "entity", context),
      description: identifier(operation, "description", context),
      kind: scalar(operation.kind, "text"),
      skill: operation.skill == null ? null : scalar(operation.skill),
      level,
      target: operation.target == null ? null : identifier(operation, "target", context),
    };
  },
  effect: (operation, context) => ({
    entity: identifier(operation, "entity", context),
    description: identifier(operation, "description", context),
    key: scalar(operation.key, "effect"),
    value: scalar(operation.value),
  }),
  tag: (operation, context) => {
    const tag = slugify(identifier(operation, "tag", context));
    return { entity: identifier(operation, "entity", context), tag, label: scalar(operation.label, tag) };
  },
};

const SHAPE_OF = new Map([
  ["upsert", SHAPE.upsert],
  ["upsert-source", SHAPE["upsert-source"]],
  ["link-region", SHAPE.region],
  ["unlink-region", SHAPE.region],
  ["link-source", SHAPE.source],
  ["unlink-source", SHAPE.source],
  ["relate", SHAPE.relate],
  ["unrelate", SHAPE.relate],
  ["remove", SHAPE.remove],
  ["set-record", SHAPE["set-record"]],
  ["add-requirement", SHAPE.requirement],
  ["remove-requirement", SHAPE.requirement],
  ["add-effect", SHAPE.effect],
  ["remove-effect", SHAPE.effect],
  ["add-tag", SHAPE.tag],
  ["remove-tag", SHAPE.tag],
]);

export function validateOperation(operation, context) {
  if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
    fail(context, "operation must be an object");
  }
  const op = scalar(operation.op);
  const schema = SCHEMA.get(op);
  if (!schema) fail(context, `unsupported operation: ${op || "(missing)"}`);
  const allowed = new Set([...schema.keys, "op", "reason"]);
  const unknown = Object.keys(operation).filter((key) => !allowed.has(key));
  if (unknown.length) fail(context, `unsupported fields for ${op}: ${unknown.join(", ")}`);
  const missing = schema.required.filter((key) => operation[key] == null);
  if (missing.length) fail(context, `${op} requires ${missing.join(", ")}`);
  return Object.freeze({ op, ...SHAPE_OF.get(op)(operation, context) });
}
