import React from 'react';

export interface AwsIconProps {
  className?: string;
  size?: number;
}

/**
 * 1. API Gateway: Bold HTTP API Gateway with arch and node endpoints.
 */
export const ApiGatewayIcon: React.FC<AwsIconProps> = ({ className = '', size = 30 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    shapeRendering="geometricPrecision"
  >
    <rect width="32" height="32" rx="7" fill="#8B5CF6" fillOpacity="0.15" />
    <path
      d="M7 23V11C7 9.89543 7.89543 9 9 9H23C24.1046 9 25 9.89543 25 11V23"
      stroke="#8B5CF6"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M12 23V15C12 14.4477 12.4477 14 13 14H19C19.5523 14 20 14.4477 20 15V23"
      stroke="#8B5CF6"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <circle cx="16" cy="10" r="2" fill="#7C3AED" />
    <circle cx="9" cy="18" r="1.5" fill="#7C3AED" />
    <circle cx="23" cy="18" r="1.5" fill="#7C3AED" />
    <line x1="7" y1="23" x2="25" y2="23" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/**
 * 2. EventBridge: Central event bus hub with radiating event pulses.
 */
export const EventBridgeIcon: React.FC<AwsIconProps> = ({ className = '', size = 30 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    shapeRendering="geometricPrecision"
  >
    <rect width="32" height="32" rx="7" fill="#EC4899" fillOpacity="0.15" />
    <circle cx="16" cy="16" r="3.5" fill="#EC4899" />
    <path
      d="M10.5 10.5C7.5 13.5 7.5 18.5 10.5 21.5"
      stroke="#EC4899"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M21.5 10.5C24.5 13.5 24.5 18.5 21.5 21.5"
      stroke="#EC4899"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M6 6C1.5 11.5 1.5 20.5 6 26"
      stroke="#DB2777"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="2 3"
    />
    <path
      d="M26 6C30.5 11.5 30.5 20.5 26 26"
      stroke="#DB2777"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="2 3"
    />
  </svg>
);

/**
 * 3. SQS: Message Queue with stacked message envelopes.
 */
export const SqsIcon: React.FC<AwsIconProps> = ({ className = '', size = 30 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    shapeRendering="geometricPrecision"
  >
    <rect width="32" height="32" rx="7" fill="#6366F1" fillOpacity="0.15" />
    <rect x="6" y="8" width="20" height="14" rx="3" stroke="#6366F1" strokeWidth="2.2" />
    <path
      d="M6 11L16 17.5L26 11"
      stroke="#6366F1"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="9" y="24" width="14" height="2" rx="1" fill="#4F46E5" />
    <rect x="11" y="27" width="10" height="1.5" rx="0.75" fill="#4338CA" />
  </svg>
);

/**
 * 4. Lambda: Iconic bold Greek Lambda 'λ' compute symbol.
 */
export const LambdaIcon: React.FC<AwsIconProps> = ({ className = '', size = 30 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    shapeRendering="geometricPrecision"
  >
    <rect width="32" height="32" rx="7" fill="#F59E0B" fillOpacity="0.18" />
    <path
      d="M10 24L14.8 14.5M14.8 14.5L18.5 7H22M14.8 14.5L22 24"
      stroke="#D97706"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="24" r="1.5" fill="#B45309" />
    <circle cx="22" cy="24" r="1.5" fill="#B45309" />
  </svg>
);

/**
 * 5. DynamoDB: High-performance NoSQL database cylinder stack.
 */
export const DynamoDbIcon: React.FC<AwsIconProps> = ({ className = '', size = 30 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    shapeRendering="geometricPrecision"
  >
    <rect width="32" height="32" rx="7" fill="#3B82F6" fillOpacity="0.15" />
    <ellipse cx="16" cy="9.5" rx="9" ry="3.5" stroke="#3B82F6" strokeWidth="2.2" fill="#3B82F6" fillOpacity="0.25" />
    <path d="M7 9.5V15.5C7 17.433 11.0294 19 16 19C20.9706 19 25 17.433 25 15.5V9.5" stroke="#2563EB" strokeWidth="2.2" />
    <path d="M7 15.5V21.5C7 23.433 11.0294 25 16 25C20.9706 25 25 23.433 25 21.5V15.5" stroke="#1D4ED8" strokeWidth="2.2" />
    <line x1="16" y1="13" x2="16" y2="19" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="19" x2="16" y2="25" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * 6. Route 53: Global DNS compass & traffic router.
 */
export const Route53Icon: React.FC<AwsIconProps> = ({ className = '', size = 30 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    shapeRendering="geometricPrecision"
  >
    <rect width="32" height="32" rx="7" fill="#14B8A6" fillOpacity="0.15" />
    <circle cx="16" cy="16" r="10" stroke="#0D9488" strokeWidth="2.2" />
    <path d="M16 6V9.5M16 22.5V26M6 16H9.5M22.5 16H26" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" />
    <polygon points="16,9 19,16 16,14 13,16" fill="#0F766E" />
    <polygon points="16,23 13,16 16,18 19,16" fill="#14B8A6" />
    <circle cx="16" cy="16" r="2" fill="#0F766E" />
  </svg>
);

/**
 * 7. DynamoDB Global Tables: Dual-region active-active synchronized database.
 */
export const DynamoDbGlobalIcon: React.FC<AwsIconProps> = ({ className = '', size = 30 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    shapeRendering="geometricPrecision"
  >
    <rect width="32" height="32" rx="7" fill="#06B6D4" fillOpacity="0.15" />
    {/* Left Cylinder */}
    <ellipse cx="11" cy="11" rx="5" ry="2.2" stroke="#0891B2" strokeWidth="1.8" fill="#0891B2" fillOpacity="0.25" />
    <path d="M6 11V18C6 19.2 8.2 20.2 11 20.2C13.8 20.2 16 19.2 16 18V11" stroke="#0891B2" strokeWidth="1.8" />
    {/* Right Cylinder */}
    <ellipse cx="21" cy="14" rx="5" ry="2.2" stroke="#06B6D4" strokeWidth="1.8" fill="#06B6D4" fillOpacity="0.25" />
    <path d="M16 14V21C16 22.2 18.2 23.2 21 23.2C23.8 23.2 26 22.2 26 21V14" stroke="#06B6D4" strokeWidth="1.8" />
    {/* Cross-Region Sync Arrows */}
    <path d="M11 7C14 5.5 18 5.5 21 9" stroke="#0E7490" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 2" />
    <path d="M21 26C18 27.5 14 27.5 11 24" stroke="#0E7490" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 2" />
  </svg>
);

