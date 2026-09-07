import { memo } from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';

/**
 * Custom React Flow edge component for showing animated data flow.
 */
export const AnimatedEdge = memo(({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const status = (data?.status as string) || 'healthy';
  
  let strokeColor = '#10b981'; // emerald-500
  if (status === 'degraded') strokeColor = '#f59e0b'; // amber-500
  if (status === 'failed') strokeColor = '#e11d48'; // rose-500

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{ 
          ...style,
          stroke: strokeColor,
          strokeWidth: 3,
          strokeDasharray: '5,5',
          animation: 'dashdraw 1s linear infinite'
        }} 
      />
      
      <style>
        {`
          @keyframes dashdraw {
            from { stroke-dashoffset: 10; }
            to { stroke-dashoffset: 0; }
          }
        `}
      </style>

      {data?.events !== undefined && (
        <foreignObject
          width={40}
          height={20}
          x={labelX - 20}
          y={labelY - 10}
          className="overflow-visible"
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div className="flex items-center justify-center w-full h-full">
            <span className="bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-slate-700 dark:border-slate-300">
              {data.events as number}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
});

AnimatedEdge.displayName = 'AnimatedEdge';
