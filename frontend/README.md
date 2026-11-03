# ProjectX Frontend

The Next.js 16 (React 19, Tailwind CSS v4) user interface and web application for **ProjectX (Capture. Understand. Handover.)**.

For full platform architecture, setup guides, and system documentation, please refer to the primary repository [README.md](file:///home/aniketbhil/ProjectX/README.md).

---

## Getting Started

### 1. Prerequisites
- Node.js 20+
- npm (or pnpm / bun)
- ProjectX Backend running at `http://localhost:8000` (or configured via `PROJECTX_API_BASE_URL`)

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### 4. Build for Production
```bash
npm run build
npm run start
```

### 5. Linting
```bash
npm run lint
```

---

## Architecture & Feature Modules

The frontend is structured into domain features located under `src/features/`:

- `sources`: Multi-format drag-and-drop file upload dialogs and GitHub repository connection wizards.
- `knowledge`: Knowledge item explorer with status filters, confidence tags, and evidence drawer.
- `search`: Grounded Contextual Q&A interface with verifiable inline citation pills and source previews.
- `graph`: Interactive dependency graph canvas with cycle detection and blocked paths.
- `risks`: Project risk analytics matrix, SPOK (Single Point of Knowledge) indicators, and mitigation trackers.
- `tasks`: Interactive task boards with blocking dependencies.
- `timeline`: Chronological milestone and key decision timeline view.
- `handover`: Handover Studio for generating 10-section continuation plans, side-by-side diffing, reviewer sign-offs, and PDF/Word/Markdown exports.
- `activity`: Cryptographic immutable audit feed.
- `settings`: Project configuration and team member RBAC management.

---

## License

Licensed under the [MIT License](file:///home/aniketbhil/ProjectX/LICENSE).
