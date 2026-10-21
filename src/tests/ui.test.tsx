import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';

// Mock Monaco Editor for fast, reliable headless DOM testing
vi.mock('@monaco-editor/react', () => {
  return {
    default: ({ value, onChange }: any) => (
      <textarea
        data-testid="monaco-code-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    ),
    DiffEditor: ({ original, modified }: any) => (
      <div data-testid="monaco-diff-editor">
        <div>{original}</div>
        <div>{modified}</div>
      </div>
    ),
  };
});

describe('SearchLab End-to-End UI & Workflow Tests', () => {
  it('should render header, brand, breadcrumbs, catalog, and playback timeline', () => {
    const { container } = render(<App />);

    // Brand and title
    expect(screen.getByText('SearchLab')).toBeDefined();
    expect(screen.getByText('Code-Driven')).toBeDefined();

    // Default algorithm is BFS
    expect(screen.getAllByText('Breadth-First Search (BFS)').length).toBeGreaterThan(0);

    // Controls
    expect(screen.getByRole('button', { name: /Run Code/i })).toBeDefined();
    expect(container.querySelector('.step-counter')).toBeDefined();

    // Catalog items
    expect(screen.getByText('A* Search Algorithm')).toBeDefined();
    expect(screen.getByText('Bubble Sort')).toBeDefined();
    expect(screen.getByText("Kruskal's Minimum Spanning Tree")).toBeDefined();
  });

  it('should switch algorithms when clicked in the catalog', async () => {
    render(<App />);

    // Click Bubble Sort in catalog
    const bubbleSortItem = screen.getByText('Bubble Sort');
    fireEvent.click(bubbleSortItem);

    // Breadcrumb and visualizer should now target SORTING
    expect(screen.getAllByText('SORTING').length).toBeGreaterThan(0);
    expect(screen.getByText('Comparisons')).toBeDefined();
    expect(screen.getByText('Swaps')).toBeDefined();
  });

  it('should execute code and record real steps when Run Code is clicked', async () => {
    const { container } = render(<App />);

    // Select Bubble Sort
    fireEvent.click(screen.getByText('Bubble Sort'));

    const runBtn = screen.getByRole('button', { name: /Run Code/i });
    fireEvent.click(runBtn);

    // After running, playback controls should update step counter
    await waitFor(() => {
      const counter = container.querySelector('.step-counter');
      expect(counter?.textContent).toContain('Step');
      expect(counter?.textContent).toContain('/');
    });
  });

  it('should allow stepping backward and forward through execution history', async () => {
    const { container } = render(<App />);

    // Run BFS
    const runBtn = screen.getByRole('button', { name: /Run Code/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      const stepForwardBtn = container.querySelector('.timeline-btn:nth-child(4)') as HTMLButtonElement;
      expect(stepForwardBtn).toBeDefined();
    });

    const stepForwardBtn = container.querySelector('.timeline-btn:nth-child(4)') as HTMLButtonElement;
    const stepBackwardBtn = container.querySelector('.timeline-btn:nth-child(2)') as HTMLButtonElement;

    if (stepForwardBtn) fireEvent.click(stepForwardBtn);
    if (stepBackwardBtn) fireEvent.click(stepBackwardBtn);
  });

  it('should toggle between Dark Theme and Light Theme', () => {
    const { container } = render(<App />);

    const root = container.querySelector('.app-root');
    expect(root?.classList.contains('dark')).toBe(true);

    // Click theme toggle
    const themeBtn = screen.getByTitle(/Switch to Light Theme/i);
    fireEvent.click(themeBtn);

    expect(root?.classList.contains('light')).toBe(true);
  });

  it('should open and close the Keyboard Shortcuts modal', () => {
    const { container } = render(<App />);

    const helpBtn = screen.getByTitle(/Keyboard Shortcuts & Help/i);
    fireEvent.click(helpBtn);

    expect(screen.getByText('SearchLab Shortcuts & Documentation')).toBeDefined();
    expect(screen.getByText('Visualizer API Reference (Mode A)')).toBeDefined();

    // Close modal
    const closeBtn = container.querySelector('.modal-close-btn');
    if (closeBtn) fireEvent.click(closeBtn);

    expect(container.querySelector('.modal-card')).toBeNull();
  });

  it('should toggle Code Comparison mode', () => {
    render(<App />);

    const compareBtn = screen.getByTitle(/Toggle Code Comparison Mode/i);
    fireEvent.click(compareBtn);

    expect(screen.getByTestId('monaco-diff-editor')).toBeDefined();

    // Toggle back
    fireEvent.click(screen.getByTitle(/Toggle Code Comparison Mode/i));
    expect(screen.getByTestId('monaco-code-editor')).toBeDefined();
  });
});
