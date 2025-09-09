# Discipline — Pinboard Todo (Vite + React)

This is a single-file React app (Vite) — a Pinterest-like task board named **Discipline**.
Features:
- Date-based tasks shown as pins/cards
- Built-in themes and theme editor (save custom themes)
- Favorites (star), archive, delete
- Calendar view and selection
- Animated theme transitions
- Confetti + victory sound on task completion
- Stores tasks and themes in `localStorage`

## Quick start (locally)
```bash
npm install
npm run dev    # open http://localhost:5173
```

## Build for production
```bash
npm run build
npm run preview
```

## Deploy to Netlify
1. Ensure `public/_redirects` exists (already included) with `/* /index.html 200`.
2. Push this repository to GitHub.
3. In Netlify: New site → Import from Git → select repo.
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy.

## Notes
- The project uses Tailwind via CDN for quick styling. For production, consider installing Tailwind properly and building the CSS.
- Some browsers require user interaction to play audio (victory melody).
