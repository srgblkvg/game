import { useState, useEffect, useCallback } from 'react';

interface CrudOptions<T> {
  fetchAll: () => Promise<T[]>;
  createItem: (item: Partial<T>) => Promise<any>;
  updateItem: (id: number, item: Partial<T>) => Promise<any>;
  deleteItem: (id: number) => Promise<any>;
  defaultItem: Partial<T>;
}

interface CrudState<T> {
  items: T[];
  editing: T | null;
  newItem: Partial<T>;
  message: string;
  loading: boolean;
}

export function useCrud<T extends { id: number }>({ fetchAll, createItem, updateItem, deleteItem, defaultItem }: CrudOptions<T>) {
  const [state, setState] = useState<CrudState<T>>({
    items: [],
    editing: null,
    newItem: { ...defaultItem },
    message: '',
    loading: true,
  });

  const load = useCallback(async () => {
    try {
      const items = await fetchAll();
      setState(s => ({ ...s, items, loading: false }));
    } catch (e: any) {
      setState(s => ({ ...s, message: e.message, loading: false }));
    }
  }, [fetchAll]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async () => {
    try {
      await createItem(state.newItem);
      setState(s => ({ ...s, message: 'Создано', newItem: { ...defaultItem } }));
      await load();
    } catch (e: any) {
      setState(s => ({ ...s, message: e.message }));
    }
  }, [state.newItem, createItem, load, defaultItem]);

  const update = useCallback(async () => {
    if (!state.editing) return;
    try {
      await updateItem(state.editing.id, state.editing);
      setState(s => ({ ...s, message: 'Обновлено', editing: null }));
      await load();
    } catch (e: any) {
      setState(s => ({ ...s, message: e.message }));
    }
  }, [state.editing, updateItem, load]);

  const remove = useCallback(async (id: number) => {
    if (!confirm('Удалить?')) return;
    try {
      await deleteItem(id);
      await load();
    } catch (e: any) {
      setState(s => ({ ...s, message: e.message }));
    }
  }, [deleteItem, load]);

  const startEdit = useCallback((item: T) => {
    setState(s => ({ ...s, editing: item }));
  }, []);

  const cancelEdit = useCallback(() => {
    setState(s => ({ ...s, editing: null }));
  }, []);

  const setNewItem = useCallback((updater: Partial<T> | ((prev: Partial<T>) => Partial<T>)) => {
    setState(s => ({
      ...s,
      newItem: typeof updater === 'function' ? updater(s.newItem) : { ...s.newItem, ...updater },
    }));
  }, []);

  const setEditing = useCallback((updater: Partial<T> | ((prev: T) => T)) => {
    setState(s => {
      if (!s.editing) return s;
      return {
        ...s,
        editing: typeof updater === 'function' ? updater(s.editing) : { ...s.editing, ...updater },
      };
    });
  }, []);

  const clearMessage = useCallback(() => {
    setState(s => ({ ...s, message: '' }));
  }, []);

  return {
    ...state,
    load, create, update, remove,
    startEdit, cancelEdit, setNewItem, setEditing, clearMessage,
  };
}
