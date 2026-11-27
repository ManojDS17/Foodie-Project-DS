import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-surface-card border-t border-border-subtle py-3.5 px-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-foreground-muted gap-2 mt-auto">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-status-running-dot" />
        <span>Telemetry Gateway Active</span>
        <span className="text-border-subtle">|</span>
        <span>Connected to AWS IoT Core (ap-southeast-2)</span>
      </div>

      <div>
        © 2026 PowerTech Energy Pty Ltd. All rights reserved. Commercial in Confidence.
      </div>
    </footer>
  );
};
