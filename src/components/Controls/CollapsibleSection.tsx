import { useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  badge?: string | number;
  defaultCollapsed?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  badge,
  defaultCollapsed = false,
  children,
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between py-1.5 text-left group"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${
              collapsed ? '' : 'rotate-90'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide group-hover:text-gray-300">
            {title}
          </span>
          {badge !== undefined && (
            <span className="text-[10px] text-gray-500">
              ({badge})
            </span>
          )}
        </div>
      </button>
      {!collapsed && (
        <div className="pl-5 pb-1">
          {children}
        </div>
      )}
    </div>
  );
}
