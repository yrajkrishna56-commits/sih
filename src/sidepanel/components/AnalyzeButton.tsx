/**
 * AnalyzeButton — triggers page analysis on click.
 */

import React from 'react';

interface AnalyzeButtonProps {
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export function AnalyzeButton({ onAnalyze, isAnalyzing }: AnalyzeButtonProps): React.ReactElement {
  return (
    <button
      className="analyze-button"
      onClick={onAnalyze}
      disabled={isAnalyzing}
    >
      {isAnalyzing ? (
        <>
          <span className="spinner" /> Analyzing...
        </>
      ) : (
        <>🔍 Analyze Current Page</>
      )}
    </button>
  );
}
