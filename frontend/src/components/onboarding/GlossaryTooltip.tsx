import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export const GLOSSARY: Record<string, { full: string; definition: string }> = {
  RTO: {
    full: 'Recovery Time Objective',
    definition: 'Max acceptable time from failure detection to service restoration',
  },
  RPO: {
    full: 'Recovery Point Objective',
    definition: 'Max acceptable data loss measured in events or time',
  },
  DLQ: {
    full: 'Dead-Letter Queue',
    definition: 'A holding queue for messages that repeatedly fail processing',
  },
  ESM: {
    full: 'Event Source Mapping',
    definition: 'The AWS bridge that feeds SQS messages to Lambda functions',
  },
  SQS: {
    full: 'Simple Queue Service',
    definition: 'AWS managed message queue that buffers events between services',
  },
  DynamoDB: {
    full: 'DynamoDB',
    definition: 'AWS managed NoSQL database for storing event data',
  },
  'Active-Passive': {
    full: 'Active-Passive Failover',
    definition: 'DR pattern where one region handles traffic while the other waits on standby',
  },
  CNAME: {
    full: 'Canonical Name Record',
    definition: 'A DNS record that aliases one domain name to another',
  },
  Failover: {
    full: 'DNS Failover',
    definition: 'Automatic switching of traffic from a failed region to a healthy one',
  },
  Concurrency: {
    full: 'Lambda Concurrency',
    definition: 'Number of simultaneous function executions allocated to a Lambda',
  },
  'Global Tables': {
    full: 'DynamoDB Global Tables',
    definition: 'Multi-region, multi-active database replication across AWS regions',
  },
  'Route 53': {
    full: 'Amazon Route 53',
    definition: 'AWS managed DNS service with health-check-based routing',
  },
  rWU: {
    full: 'Replicated Write Unit',
    definition: 'DynamoDB Global Table write capacity unit for cross-region replication',
  },
  p95: {
    full: '95th Percentile',
    definition: 'The latency below which 95% of requests complete',
  },
  EventBridge: {
    full: 'Amazon EventBridge',
    definition: 'AWS serverless event bus for routing events between services',
  },
};

export interface GlossaryProps {
  term: string;
  children: React.ReactNode;
}

/**
 * Glossary component that wraps technical terms with hoverable definitions.
 */
export const Glossary: React.FC<GlossaryProps> = ({ term, children }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Exact match first, fallback to case-insensitive lookup
  const entry = GLOSSARY[term] || GLOSSARY[Object.keys(GLOSSARY).find((k) => k.toLowerCase() === term.toLowerCase()) ?? ''];

  if (!entry) {
    return <>{children}</>;
  }

  return (
    <span
      className="relative inline-flex items-center cursor-help group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="border-b border-dotted border-slate-400 dark:border-slate-600">
        {children}
      </span>
      <HelpCircle size={10} className="ml-0.5 text-slate-400 dark:text-slate-500 inline-block shrink-0" aria-hidden="true" />
      {isHovered && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none text-left"
        >
          <span className="block font-bold text-white mb-0.5">{entry.full}</span>
          <span className="block text-slate-200 dark:text-slate-200 leading-normal">{entry.definition}</span>
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-900 dark:bg-slate-700"
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  );
};

export const GlossaryTooltip = Glossary;
export default Glossary;
