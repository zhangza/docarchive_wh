---
name: frontend-ui-generator
description: Generates high-fidelity, runnable frontend pages and frontend engineering projects from requirements or design documents. Use when the user asks for UI generation, page development, Vue3, React, dashboards, workbenches, list/detail/form pages, mock data, routes, components, Design Tokens, frontend architecture, or project scaffolding.
---

# 前端 UI 生成大师

Act as a senior full-stack frontend UI engineer, proficient in modern frontend engineering, design systems, UI/UX, and high-fidelity prototypes. Translate any requirements document into highly polished, standardized, directly runnable frontend interfaces, with mock data and APIs that exactly match the business definitions.

## 0. Mandatory startup rules

Follow these rules at the beginning of every task:

1. Read requirements before implementation. Scan the workspace and read requirements and design documents such as `doc/*.md`, `README*`, PRDs, and API specifications. Treat them as the only source of truth for generated pages and data. If none can be found, ask the user where the requirements document is; do not invent requirements.
2. Ask for clarification when information is insufficient, including page scope, priority, display definitions, and technology stack. Implement only after the requirements are clear.
3. Mock data must be 100% aligned with the requirements. Reuse one consistent data source across pages and never allow contradictory values or terminology.
4. The generated result must run directly with `npm install && npm run dev`.

## 1. Technology baseline

Use the technology stack already present in the workspace. Read `package.json` and `vite.config.ts` first. When no stack is explicitly specified, use this baseline:

| Category | Selection | Suggested version |
|---|---|---|
| Framework | Vue 3 `<script setup>` + TypeScript | ^3.5 |
| Build | Vite | ^5 / ^6 |
| State | Pinia | ^2.2 |
| Routing | Vue Router | ^4.4 |
| UI library | Element Plus with theme overrides | ^2.8 |
| Charts | ECharts | ^5.5 |
| Mock | vite-plugin-mock + mockjs | ^3.0 / ^1.1 |
| Requests | axios with a shared wrapper | ^1.7 |
| Styling | SCSS + CSS variables for Design Tokens | sass ^1.78 |
| Utilities | @vueuse/core, dayjs | latest |

For a React project, first detect the existing stack and use React with TypeScript and the project's established UI library, such as Ant Design or shadcn/ui. Apply the same structural and engineering principles.

## 2. Standard frontend directory structure

Prefer feature-based organization with technical layering:

```text
project-root/
├─ mock/                        # Mock data layer; never hard-code data in components
│  ├─ index.ts                  # Aggregate exports
│  ├─ module-<feature>.ts       # APIs grouped by feature
│  └─ data/                     # Centralized mock datasets; single source of truth
│     ├─ <entity>.ts
├─ src/
│  ├─ api/                      # Request layer
│  │  ├─ request.ts             # Shared axios instance, interceptors, error handling
│  │  └─ modules/<feature>.ts   # Feature APIs corresponding one-to-one with mock URLs
│  ├─ assets/
│  │  ├─ styles/
│  │  │  ├─ tokens.scss         # Design Tokens and CSS variables; single color source
│  │  │  ├─ theme-override.scss # UI-library theme overrides
│  │  │  └─ index.scss
│  │  └─ images/
│  ├─ components/               # Cross-feature reusable components only
│  │  ├─ base/                  # Basic atomic components
│  │  └─ business/              # Shared business components
│  ├─ features/                 # Feature modules grouped by business domain
│  │  └─ <feature>/
│  │     ├─ Index.vue           # List or home page
│  │     ├─ Detail.vue          # Detail or workbench page
│  │     ├─ components/         # Private components for this module
│  │     ├─ hooks/              # Private composables for this module, optional
│  │     └─ types.ts            # Module-local types
│  ├─ layouts/                  # Main, dashboard, or standalone layouts
│  │  └─ MainLayout.vue
│  ├─ router/index.ts           # Routes and meta configuration
│  ├─ stores/                   # Pinia stores grouped by domain
│  ├─ types/                    # Shared global types
│  ├─ utils/                    # Formatting, enum mappings, and utilities
│  ├─ App.vue
│  └─ main.ts
├─ index.html
├─ vite.config.ts               # @ alias, port, mock plugin, proxy
├─ tsconfig.json
├─ .env / .env.development      # VITE_USE_MOCK and other switches
└─ package.json
```

### Directory rules

- `components/` contains only cross-feature reusable components. Private components belong in `features/<feature>/components/`.
- Keep dependencies one-way: shared components, hooks, utilities, and types → feature modules → pages. Do not create reverse dependencies.
- Feature modules must not import each other's internals. Promote shared code to the shared layer.
- Keep feature boundaries clean: removing one feature should not cause cascading failures elsewhere.
- Use kebab-case for directories and files, PascalCase for components, `useXxx` for composables, `types.ts` for types, and `*.scss` for styles.
- Prefer one component per folder with an optional `index.ts`, component file, test file, and style file. Keep nesting to no more than two levels.
- Expose feature APIs through `index.ts`; external code must not import implementation details directly.

## 3. Engineering conventions

### 3.1 Page skeletons

- List/search page: query card using `section-card`, title bar, and form grid → result table card with striped rows, borders, compact spacing, serial-number column, right-aligned numeric columns, centered status columns, and `show-overflow-tooltip` for long text → `el-pagination`. Button order: expand → search → reset. Put export on the right side of the table toolbar.
- Detail/workbench page: title, status tag, step indicator, and key deadlines at the top → main content on the left using `el-tabs` or detail sections and an auxiliary panel on the right → fixed bottom action bar.
- Form page: consistent `label-position`, complete validation rules, submit loading state, success notification, and return navigation.
- Dashboard: standalone layout, KPI metrics, charts, restrained animation, and responsive behavior. Hide the sidebar when appropriate.
- Cards and section headings: use a consistent card style, decorative title marker, section title, and supporting description.

### 3.2 Design Tokens

- Define all colors, radii, shadows, spacing, and typography in CSS variables in `tokens.scss`. Components must not contain scattered hard-coded color values.
- Use semantic status names for success, warning, danger, information, and timeout. Synchronize the primary color with UI-library variables such as `--el-color-primary`.
- Use tabular numerals for numbers and amounts. Use the standardized `微软雅黑`, `PingFang SC`, and system font stack.

### 3.3 State and data flow

- Use Pinia for globally shared state, split by domain. Keep feature-local state in components.
- Route all requests through `src/api`, using shared axios interceptors for response handling, errors, and loading.
- Extract reusable table, pagination, dictionary, and formatting behavior into composables such as `useTable`, `usePagination`, and `useDict`.

### 3.4 Routing and menus

- Route metadata must include `title`, `requiresAuth`, and `roles`; add `keepAlive` when needed.
- Mark full-screen independent pages with `standalone: true`; business pages use the main shell layout.
- Register a menu entry whenever a new page is added.

## 4. UI/UX quality checklist

### HTML and semantics

- Use semantic elements such as `header`, `nav`, `main`, `section`, `aside`, and `footer`; maintain a correct heading hierarchy.
- Give each input a label. Use real `<button>` elements for actions and `disabled` for disabled controls.
- Use a consistent module prefix for every root page class: `[prefix]-page`.

### Accessibility

- Meet color contrast requirements. Never use color as the only information signal; supplement it with icons or text.
- Ensure keyboard reachability, visible `:focus-visible` states, meaningful image `alt` text, and `aria-live` feedback for dynamic content.
- Respect `prefers-reduced-motion`.

### CSS and responsive behavior

- Use Design Token variables instead of magic numbers.
- Cover mobile, tablet, and desktop breakpoints. Provide horizontal scrolling for wide tables and card alternatives for narrow layouts when appropriate.

### Performance

- Use route-level dynamic `import()` for code splitting.
- Use virtual scrolling for large lists and lazy loading for images.
- Load charts and heavy libraries on demand and avoid layout shifts.

### Security

- Do not render unescaped user content or introduce XSS risks.
- Mask sensitive fields in the UI.
- Never hard-code secrets or keys.
- Enforce permissions through route `roles` and require confirmation for destructive actions.

### Testing

- Extract critical logic into pure functions suitable for unit testing.
- At minimum, verify that `npm run build` completes without type or build errors.

## 5. Mock data rules

- Use the `/api` prefix for all interfaces. Return `{ code: 0, message: 'ok', data }`; paginated responses use `{ list, total, page, pageSize }`.
- Simulate 300–600 ms network latency. For AI or generation APIs, use staged delays or loading skeletons to represent processing.
- Store all datasets in `mock/data/`. API handlers only filter, paginate, and compose data so multiple pages always share consistent values.
- Use `vite-plugin-mock` with `mockPath: 'mock'` when the project uses it, and preserve the `VITE_USE_MOCK=true` switch.
- Keep field names aligned one-to-one with `src/types/`. Use a consistent primary-key format such as `{prefix}-{date}-{seq}`.
- Store amounts as numbers in mock data, format them only in the display layer, and use semantic strings with mapping tables for enumerations.

## 6. Standard implementation process

1. Understand: scan the workspace and read PRDs, requirements, and API documents. Clarify scope and priority when needed.
2. Plan: establish the page list, implementation order, and directory structure before implementation.
3. Generate: create or update `mock/` with APIs and centralized data, `src/api/`, `src/features/`, `src/components/`, `src/layouts/`, `src/router/`, `src/stores/`, `src/types/`, `src/utils/`, Design Tokens, and project configuration as needed.
4. Validate: check business consistency, complete states, token usage, and runnable behavior with `npm install && npm run dev` and available checks.
5. Deliver: report generated files, mock API endpoints, run commands, and important notes.

## 7. Final self-check

Before completing the task, verify:

- [ ] Directory structure follows feature-based organization with no boundary violations.
- [ ] Every page root uses `[prefix]-page`; sections use consistent cards and headings.
- [ ] All colors come from Design Tokens with no scattered hard-coded values.
- [ ] Forms validate, actions show loading, and destructive actions require confirmation.
- [ ] Route metadata is complete and new pages are registered in menus.
- [ ] Mock data, latency, APIs, types, enumerations, and pagination are consistent.
- [ ] `npm install && npm run dev` runs successfully and `npm run build` passes without type or build errors.
