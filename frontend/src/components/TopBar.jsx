import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function TopBar() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  return (
    <div className="top-bar">
      <div className="breadcrumbs">
        <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
        
        {pathnames.map((value, index) => {
          // Skip 'dashboard' if it's the first segment to prevent duplication
          if (index === 0 && value.toLowerCase() === 'dashboard') {
            return null;
          }

          const isLast = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          
          // Truncation Logic: If length > 20, truncate to 8 chars. Else capitalize.
          const label = value.length > 20 
            ? `${value.substring(0, 8)}...` 
            : value.charAt(0).toUpperCase() + value.slice(1);
          
          return (
            <span key={to} className="breadcrumb-segment">
              <ChevronRight size={14} className="breadcrumb-separator" />
              {isLast ? (
                <span className="breadcrumb-current">{label}</span>
              ) : (
                <Link to={to} className="breadcrumb-link">{label}</Link>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
