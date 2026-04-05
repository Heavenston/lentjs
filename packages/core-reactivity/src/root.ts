type Root = {
  parent: Root | null,
  cleanupCallbacks: (() => void)[],
};

let currentRoot: Root | null = null;

export function createRoot<T>(cb: (cleanup: () => void) => T): T {
  const parent = currentRoot;
  const root: Root = {
    parent,
    cleanupCallbacks: [],
  };
  currentRoot = root;
  try {
    return cb(() => {
      root.cleanupCallbacks.forEach(cb => cb());
    });
  }
  catch(e) {
    throw e;
  }
  finally {
    currentRoot = parent;
  }
}

export function onCleanup(cb: () => void) {
  if (currentRoot === null) {
    throw new Error("Can only call onCleanup within a root");
  }
  currentRoot.cleanupCallbacks.push(cb);
}
