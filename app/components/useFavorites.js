"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "nova_tv_favorites";

function readFavorites() {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeFavorites(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

/**
 * Manages favorite channel IDs in localStorage.
 * Syncs across tabs via the `storage` event.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState(new Set());

  // Hydrate from localStorage on mount
  useEffect(() => {
    setFavorites(readFavorites());

    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setFavorites(readFavorites());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleFavorite = useCallback((channelId) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      writeFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (channelId) => favorites.has(channelId),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
}
