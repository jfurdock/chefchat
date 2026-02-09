type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeRecipeDataChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyRecipeDataChanged(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('Recipe data listener failed:', error);
    }
  });
}
