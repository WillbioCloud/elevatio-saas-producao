import React from 'react';

type WithClassName = {
  className?: string;
  children?: React.ReactNode;
};

export const Pagination = ({ className, children }: WithClassName) => (
  <nav className={className} aria-label="pagination">{children}</nav>
);

export const PaginationContent = ({ className, children }: WithClassName) => (
  <ul className={`flex items-center gap-1 ${className ?? ''}`}>{children}</ul>
);

export const PaginationItem = ({ className, children }: WithClassName) => (
  <li className={className}>{children}</li>
);

type LinkProps = {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
};

export const PaginationLink = ({ className, children, onClick, isActive }: LinkProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={isActive ? 'page' : undefined}
    className={`inline-flex items-center justify-center text-sm ${className ?? ''}`}
  >
    {children}
  </button>
);

export const PaginationPrevious = ({ className, onClick }: { className?: string; onClick?: () => void; 'aria-label'?: string }) => (
  <button type="button" onClick={onClick} className={`inline-flex h-9 items-center rounded-full px-3 text-sm ${className ?? ''}`}>
    Anterior
  </button>
);

export const PaginationNext = ({ className, onClick }: { className?: string; onClick?: () => void; 'aria-label'?: string }) => (
  <button type="button" onClick={onClick} className={`inline-flex h-9 items-center rounded-full px-3 text-sm ${className ?? ''}`}>
    Próximo
  </button>
);