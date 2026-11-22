import { useEffect } from 'react';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = title;
    }
  }, [title]);
}
