import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTodos } from '../hooks/useTodos';

// Mock localStorage for jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useTodos', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('initializes with no todos', () => {
    const { result } = renderHook(() => useTodos());
    expect(result.current.filtered).toEqual([]);
    expect(result.current.remaining).toBe(0);
  });

  it('adds a todo', () => {
    const { result } = renderHook(() => useTodos());
    act(() => result.current.addTodo('Buy milk'));
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].text).toBe('Buy milk');
    expect(result.current.filtered[0].completed).toBe(false);
  });

  it('does not add empty or whitespace-only todos', () => {
    const { result } = renderHook(() => useTodos());
    act(() => result.current.addTodo('  '));
    expect(result.current.filtered).toHaveLength(0);
    act(() => result.current.addTodo(''));
    expect(result.current.filtered).toHaveLength(0);
  });

  it('toggles a todo', () => {
    const { result } = renderHook(() => useTodos());
    act(() => result.current.addTodo('Walk dog'));
    const id = result.current.filtered[0].id;
    act(() => result.current.toggleTodo(id));
    expect(result.current.filtered[0].completed).toBe(true);
    act(() => result.current.toggleTodo(id));
    expect(result.current.filtered[0].completed).toBe(false);
  });

  it('deletes a todo', () => {
    const { result } = renderHook(() => useTodos());
    act(() => result.current.addTodo('One'));
    act(() => result.current.addTodo('Two'));
    // Prepending means 'Two' is first, delete it so 'One' remains
    const idTwo = result.current.todos.find((t) => t.text === 'Two')!.id;
    act(() => result.current.deleteTodo(idTwo));
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].text).toBe('One');
  });

  it('filters by active', () => {
    const { result } = renderHook(() => useTodos());
    act(() => result.current.addTodo('Active'));
    act(() => result.current.addTodo('Done'));
    const idDone = result.current.todos.find((t) => t.text === 'Done')!.id;
    act(() => result.current.toggleTodo(idDone));
    act(() => result.current.setFilter('active'));
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].text).toBe('Active');
  });

  it('filters by completed', () => {
    const { result } = renderHook(() => useTodos());
    act(() => result.current.addTodo('Active'));
    act(() => result.current.addTodo('Done'));
    const idDone = result.current.todos.find((t) => t.text === 'Done')!.id;
    act(() => result.current.toggleTodo(idDone));
    act(() => result.current.setFilter('completed'));
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].text).toBe('Done');
  });

  it('clears completed todos', () => {
    const { result } = renderHook(() => useTodos());
    act(() => result.current.addTodo('A'));
    act(() => result.current.addTodo('B'));
    // 'B' is prepended (first), toggle it then clear so only 'A' remains
    const idB = result.current.todos.find((t) => t.text === 'B')!.id;
    act(() => result.current.toggleTodo(idB));
    act(() => result.current.clearCompleted());
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].text).toBe('A');
    expect(result.current.remaining).toBe(1);
  });

  it('computes remaining count correctly', () => {
    const { result } = renderHook(() => useTodos());
    act(() => result.current.addTodo('A'));
    act(() => result.current.addTodo('B'));
    act(() => result.current.addTodo('C'));
    expect(result.current.remaining).toBe(3);
    act(() => result.current.toggleTodo(result.current.filtered[0].id));
    expect(result.current.remaining).toBe(2);
    act(() => result.current.toggleTodo(result.current.filtered[1].id));
    expect(result.current.remaining).toBe(1);
  });
});
