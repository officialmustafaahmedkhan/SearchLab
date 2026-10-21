export type AlgorithmCategory =
  | 'ai-search'
  | 'graph'
  | 'sorting'
  | 'tree'
  | 'searching';

export type VisualizationTarget =
  | 'graph'
  | 'sorting'
  | 'tree'
  | 'hash-table'
  | 'array-search';

export interface AlgorithmDefinition {
  id: string;
  name: string;
  category: AlgorithmCategory;
  target: VisualizationTarget;
  timeComplexity: {
    best: string;
    average: string;
    worst: string;
  };
  spaceComplexity: string;
  shortDescription: string;
  detailedExplanation: string;
  pseudocode: string;
  defaultInput: any;
  defaultPythonCode: string;
  defaultJavaCode: string;
  examplePresets?: { name: string; input: any }[];
  isHeuristicRequired?: boolean;
}
