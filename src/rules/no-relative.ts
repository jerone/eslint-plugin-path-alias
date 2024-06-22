import { Rule } from "eslint";
import { dirname, resolve, basename } from "node:path";
import nanomatch from "nanomatch";
import { getAliasMap } from "../utils/get-alias-map";
import { docsUrl } from "../utils/docs-url";
import { getIn } from "../utils/get-in";

export const noRelative = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Ensure imports use path aliases whenever possible vs. relative paths",
      url: docsUrl("no-relative"),
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          exceptions: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      shouldUseAlias: "Import should use path alias instead of relative path",
    },
  },
  create(context) {
    const exceptions = getIn(context, "options.0.exceptions");
    const filePath = context.filename || context.getFilename();
    const aliasMap = getAliasMap(context);

    return {
      ImportExpression(node) {
        if (node.source.type !== "Literal") return;
        if (typeof node.source.value !== "string") return;

        const raw = node.source.raw;
        const importPath = node.source.value;

        if (!/^(\.?\.\/)/.test(importPath)) {
          return;
        }

        const resolved = resolve(dirname(filePath), importPath);
        const excepted = matchExceptions(resolved, exceptions);
        const alias = matchToAlias(resolved, aliasMap);

        if (alias && !excepted) {
          context.report({
            node,
            messageId: "shouldUseAlias",
            data: { alias },
            fix(fixer) {
              const path = aliasMap[alias];
              const aliased = resolved.replace(path, alias);
              const fixed = raw.replace(importPath, aliased);
              return fixer.replaceText(node.source, fixed);
            },
          });
        }
      },
      ImportDeclaration(node) {
        if (typeof node.source.value !== "string") return;

        const importPath = node.source.value;

        if (!/^(\.?\.\/)/.test(importPath)) {
          return;
        }

        const resolved = resolve(dirname(filePath), importPath);
        const excepted = matchExceptions(resolved, exceptions);
        const alias = matchToAlias(resolved, aliasMap);

        if (alias && !excepted) {
          context.report({
            node,
            messageId: "shouldUseAlias",
            data: { alias },
            fix(fixer) {
              const raw = node.source.raw;
              const path = aliasMap[alias];
              const aliased = resolved.replace(path, alias);
              const fixed = raw.replace(importPath, aliased);
              return fixer.replaceText(node.source, fixed);
            },
          });
        }
      },
    };
  },
} satisfies Rule.RuleModule;

function matchToAlias(path, aliasMap) {
  return Object.keys(aliasMap).find((alias) => {
    const aliasPath = aliasMap[alias];
    return path.indexOf(aliasPath) === 0;
  });
}

function matchExceptions(path, exceptions) {
  if (!exceptions) return false;
  const filename = basename(path);
  const matches = nanomatch(filename, exceptions);
  return matches.includes(filename);
}