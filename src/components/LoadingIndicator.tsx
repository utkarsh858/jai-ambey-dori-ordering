"use client";

import { useEffect, useState } from "react";
import "./LoadingIndicator.css";

export function LoadingIndicator() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleLoadingStart = () => {
      setIsVisible(true);
    };

    const handleLoadingEnd = () => {
      timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, 500);
    };

    window.addEventListener("__LOADING_START", handleLoadingStart);
    window.addEventListener("__LOADING_END", handleLoadingEnd);

    return () => {
      window.removeEventListener("__LOADING_START", handleLoadingStart);
      window.removeEventListener("__LOADING_END", handleLoadingEnd);
      clearTimeout(timeoutId);
    };
  }, []);

  return isVisible ? <div className="loading-indicator" /> : null;
}

export function withLoadingIndicator<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    window.dispatchEvent(new Event("__LOADING_START"));
    try {
      return await fn(...args);
    } finally {
      window.dispatchEvent(new Event("__LOADING_END"));
    }
  };
}
