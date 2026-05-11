'use client';

import { useState, FormEvent } from 'react';
import { useTodos } from './hooks/useTodos';
import TodoItem from './components/TodoItem';

export default function Home() {
  const {
    filtered,
    filter,
    setFilter,
    addTodo,
    toggleTodo,
    deleteTodo,
    clearCompleted,
    remaining,
    completedCount,
  } = useTodos();

  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    addTodo(input);
    setInput('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center py-16 px-4">
      <div className="w-full max-w-xl">
        <h1 className="text-4xl font-bold text-slate-800 text-center mb-8">Todos</h1>

        <form onSubmit={handleSubmit} className="mb-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full px-5 py-3 rounded-lg border border-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-slate-800 placeholder:text-slate-400"
          />
        </form>

        <div className="flex gap-2 mb-4 justify-center">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                filter === f
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            {filter === 'completed'
              ? 'No completed todos yet.'
              : filter === 'active'
              ? 'No active todos. Great job!'
              : 'No todos yet. Add one above!'}
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
              />
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between mt-6 text-sm text-slate-500">
          <span>
            {remaining} {remaining === 1 ? 'item' : 'items'} left
          </span>
          {completedCount > 0 && (
            <button
              onClick={clearCompleted}
              className="text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
            >
              Clear completed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
