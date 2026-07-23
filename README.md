# KEMOS

KEMOS is a Windows 11-inspired game desktop that runs entirely in the browser. It includes a desktop shell, draggable/resizable windows, a Start menu, search, settings, offline support, local saves, and built-in apps and games.

## Features

1. Windows-style desktop and taskbar
2. Boot and sign-in screens
3. Google OAuth entry point
4. GitHub OAuth entry point
5. Guest mode
6. Start menu with pinned apps
7. Global app and web search
8. Desktop shortcuts
9. Draggable windows
10. Resizable windows
11. Minimize, maximize, and close controls
12. Left/right edge snapping
13. Running-app taskbar indicators
14. Recent apps
15. Widgets panel
16. Quick settings
17. Notification center and calendar
18. Desktop context menu
19. Light and dark themes
20. Accent color selection
21. Multiple wallpapers
22. Centered or left taskbar alignment
23. Local notes and virtual files
24. Saved game high scores
25. Keyboard shortcuts
26. Focus timer
27. Installable PWA
28. Offline asset cache
29. Responsive mobile layout
30. Local data reset

## Apps

- Game Hub with Snake, Pong, and Tic-Tac-Toe
- Browser/search launcher
- Notes
- Calculator
- Paint
- File Explorer
- Media Player
- Clock and Focus sessions
- Settings
- Terminal
- Store
- Welcome

## Authentication setup

Guest mode works immediately and saves data locally. Real Google and GitHub login uses Supabase Auth:

1. Create a Supabase project.
2. In **Authentication → Providers**, enable Google and GitHub and add each provider's client ID and secret.
3. Add the deployed KEMOS URL to Supabase's redirect URL allowlist.
4. Put the public Supabase project URL and anon key in `auth-config.js`.

Do not commit provider client secrets. The Supabase anon key is intended for client-side use when Row Level Security is configured correctly.

## Deploy with GitHub Pages

In the repository settings, open **Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`, then save.

## Local preview

Service workers require HTTP rather than opening the file directly:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.
