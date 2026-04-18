# Product Naming Placeholder

The product name is not finalized. Every file that would normally embed the
product name uses a temporary value so we can find-and-replace globally once
a name is picked.

## Placeholders in this repo (all temporary)

| Placeholder token | Temporary value used now |
|---|---|
| `{{PRODUCT_NAME}}` | `RealEstaite` |
| `{{PRODUCT_NAME_KEBAB}}` | `realestaite` |
| `{{PRODUCT_SHORT_NAME}}` | `realestaite` |
| `{{PRODUCT_DOMAIN}}` | `realestaite.co` |

## How to finalize the name

Once the final name is picked, replace every occurrence of the temporary
values. Do a case-sensitive replace to avoid wrecking variable names.

```bash
# From repo root, after picking a new name (example: "Occupant")
LC_ALL=C find . -type f \
  \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" -o -name "*.json" \
     -o -name "*.prisma" -o -name "*.mjs" -o -name "*.js" \
     -o -name "*.env*" -o -name "*.yml" -o -name "*.yaml" \) \
  -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./.git/*" \
  -not -path "./prd/*" \
  -exec sed -i '' \
    -e 's/RealEstaite/Occupant/g' \
    -e 's/realestaite\.dev/occupant.com/g' \
    -e 's/realestaite/occupant/g' \
    {} +
```

After replacement, verify:

- `grep -r "RealEstaite" .` returns no hits outside `prd/` and this file
- `grep -r "realestaite" .` returns no hits outside `prd/` and this file
- `package.json` `name` matches the new kebab form
- `.env.example` brand constants match the new name + domain
- `lib/brand.ts` constants match
- `prisma/seed.ts` agency org name matches

The `prd/` folder is intentionally left alone so the PRD stays faithful to
the original placeholder markers.
