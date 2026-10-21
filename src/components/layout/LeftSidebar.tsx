import React, { useState } from 'react';
import { ALGORITHM_CATALOG } from '../../algorithms/catalog';
import { AlgorithmDefinition, AlgorithmCategory } from '../../types/algorithms';
import { Search, Compass, Network, ArrowUpDown, GitFork, ListFilter, Sliders } from 'lucide-react';

interface LeftSidebarProps {
  currentAlgorithm: AlgorithmDefinition;
  onSelectAlgorithm: (algo: AlgorithmDefinition) => void;
  onSelectPreset: (presetInput: any) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  currentAlgorithm,
  onSelectAlgorithm,
  onSelectPreset,
  isCollapsed,
  onToggleCollapse: _onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AlgorithmCategory | 'all'>('all');

  const categories: { id: AlgorithmCategory | 'all'; label: string; icon: any }[] = [
    { id: 'all', label: 'All Algorithms', icon: ListFilter },
    { id: 'ai-search', label: 'AI Search', icon: Compass },
    { id: 'graph', label: 'Graph Algorithms', icon: Network },
    { id: 'sorting', label: 'Sorting', icon: ArrowUpDown },
    { id: 'tree', label: 'Trees', icon: GitFork },
    { id: 'searching', label: 'Searching & Hash', icon: Search },
  ];

  const filteredAlgorithms = ALGORITHM_CATALOG.filter((algo) => {
    const matchesCategory =
      selectedCategory === 'all' || algo.category === selectedCategory;
    const matchesQuery =
      algo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      algo.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <aside className={`left-sidebar ${isCollapsed ? 'is-collapsed' : ''}`}>
      {/* Search & Filter Header */}
      <div className="sidebar-header">
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search algorithms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category Pills */}
        <div className="category-pills">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                className={`category-pill ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <Icon size={12} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Algorithm List */}
      <div className="algorithms-list">
        {filteredAlgorithms.map((algo) => {
          const isSelected = currentAlgorithm.id === algo.id;
          return (
            <div
              key={algo.id}
              className={`algo-list-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectAlgorithm(algo)}
            >
              <div className="algo-item-top">
                <span className="algo-item-title">{algo.name}</span>
                <span className={`category-tag tag-${algo.category}`}>
                  {algo.category}
                </span>
              </div>
              <p className="algo-item-desc">{algo.shortDescription}</p>
              <div className="algo-item-meta">
                <span className="meta-complexity">Avg: {algo.timeComplexity.average}</span>
                <span className="meta-space">Space: {algo.spaceComplexity}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Presets Section for currently active algorithm */}
      {currentAlgorithm.examplePresets && currentAlgorithm.examplePresets.length > 0 && (
        <div className="presets-footer">
          <div className="presets-title">
            <Sliders size={13} />
            <span>Input Presets</span>
          </div>
          <div className="presets-buttons">
            {currentAlgorithm.examplePresets.map((preset, idx) => (
              <button
                key={idx}
                className="btn btn-xs btn-subtle preset-btn"
                onClick={() => onSelectPreset(preset.input)}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
