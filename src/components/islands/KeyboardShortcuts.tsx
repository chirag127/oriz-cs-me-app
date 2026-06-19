import { useEffect } from 'react';
import { useAIChatStore } from '../../store/useAIChatStore';

/**
 * Global keyboard shortcuts.
 *
 *   ⌘K / Ctrl+K  → toggle the command palette (#command-palette)
 *   ⌘J / Ctrl+J  → toggle the AI chat (zustand store)
 *
 * Mounts once via `client:load` in Layout.astro. Skips when focus is in
 * an input, textarea, or contenteditable element so typing the literal
 * letter still works in form fields.
 */

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

function togglePalette() {
  const el = document.getElementById('command-palette');
  if (!el) return;
  const wasHidden = el.classList.contains('hidden');
  el.classList.toggle('hidden');
  if (wasHidden) {
    // Now visible — focus the search input for instant typing.
    const input = el.querySelector<HTMLInputElement>('#command-input');
    input?.focus();
    input?.select();
  }
}

export default function KeyboardShortcuts() {
  const toggleChat = useAIChatStore((s) => s.toggleChat);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Allow ⌘K inside the palette's own input so users can press it to
      // close. Block all other modifier-K hits when typing in form fields.
      const inEditable = isEditableTarget(e.target);
      const inPaletteInput =
        e.target instanceof HTMLElement && e.target.id === 'command-input';

      const key = e.key.toLowerCase();

      if (key === 'k') {
        if (inEditable && !inPaletteInput) return;
        e.preventDefault();
        togglePalette();
        return;
      }

      if (key === 'j') {
        if (inEditable) return;
        e.preventDefault();
        toggleChat();
      }
    };

    // Esc closes the command palette (chat has its own Esc handler).
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const palette = document.getElementById('command-palette');
      if (palette && !palette.classList.contains('hidden')) {
        palette.classList.add('hidden');
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keydown', onEsc);
    };
  }, [toggleChat]);

  // Also wire the existing #cmd-palette-btn click target so it still works
  // for users who prefer the mouse. Astro's component already exists; we
  // just bind the click to our toggle.
  useEffect(() => {
    const btn = document.getElementById('cmd-palette-btn');
    if (!btn) return;
    const onClick = () => togglePalette();
    btn.addEventListener('click', onClick);
    return () => btn.removeEventListener('click', onClick);
  }, []);

  return null;
}
