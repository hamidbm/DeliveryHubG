import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TaxonomyCategory, TaxonomyDocumentType } from '../types';

interface DocumentTypePickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  docTypes: TaxonomyDocumentType[];
  categories?: TaxonomyCategory[];
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

const normalize = (value?: string) => (value || '').toLowerCase();

export const DocumentTypePicker: React.FC<DocumentTypePickerProps> = ({
  value,
  onChange,
  docTypes,
  categories = [],
  label = 'Document Type',
  required = false,
  placeholder = 'Search document types...',
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = useMemo(
    () => docTypes.find((t) => String(t._id || t.id) === String(value)),
    [docTypes, value]
  );

  const categoryMap = useMemo(() => {
    const map = new Map<string, TaxonomyCategory>();
    categories.forEach((cat) => {
      if (cat._id) map.set(String(cat._id), cat);
    });
    return map;
  }, [categories]);

  const filteredTypes = useMemo(() => {
    const active = docTypes.filter((t) => t.isActive !== false);
    const q = normalize(query);
    if (!q) return active;
    return active.filter((t) => {
      const name = normalize(t.name);
      const key = normalize(t.key);
      return name.includes(q) || key.includes(q);
    });
  }, [docTypes, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, TaxonomyDocumentType[]>();
    filteredTypes.forEach((t) => {
      const catKey = t.categoryId || 'uncategorized';
      if (!groups.has(catKey)) groups.set(catKey, []);
      groups.get(catKey)!.push(t);
    });
    const sortedCategories = Array.from(groups.keys()).sort((a, b) => {
      const catA = categoryMap.get(a);
      const catB = categoryMap.get(b);
      const orderA = catA?.sortOrder ?? 9999;
      const orderB = catB?.sortOrder ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      const nameA = catA?.name || (a === 'uncategorized' ? 'Uncategorized' : a);
      const nameB = catB?.name || (b === 'uncategorized' ? 'Uncategorized' : b);
      return nameA.localeCompare(nameB);
    });
    return sortedCategories.map((catId) => {
      const items = (groups.get(catId) || []).sort((a, b) => {
        const orderA = a.sortOrder ?? 9999;
        const orderB = b.sortOrder ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });
      return {
        id: catId,
        name: categoryMap.get(catId)?.name || (catId === 'uncategorized' ? 'Uncategorized' : catId),
        items
      };
    });
  }, [filteredTypes, categoryMap]);

  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);
  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    flatItems.forEach((item, idx) => {
      map.set(String(item._id || item.id), idx);
    });
    return map;
  }, [flatItems]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, grouped.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: TaxonomyDocumentType) => {
    onChange(String(item._id || item.id));
    setIsOpen(false);
    setQuery('');
  };

  const displayValue = isOpen ? query : selected?.name || '';

  return (
    <div className={`space-y-2 ${className}`} ref={containerRef}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {label} {required && <span>(required)</span>}
      </label>
      <div className="relative">
        <input
          value={displayValue}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            if (!isOpen) setIsOpen(true);
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (!isOpen) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const item = flatItems[activeIndex];
              if (item) handleSelect(item);
            } else if (e.key === 'Escape') {
              setIsOpen(false);
              setQuery('');
            }
          }}
          placeholder={placeholder}
          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 pr-10 text-xs font-bold text-slate-700"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery('');
              setIsOpen(true);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
            aria-label="Clear document type"
          >
            <i className="fas fa-times text-[10px]"></i>
          </button>
        )}
        {isOpen && (
          <div className="absolute z-20 mt-2 w-full max-h-72 overflow-auto rounded-2xl border border-slate-100 bg-white shadow-xl">
            {flatItems.length === 0 && (
              <div className="px-4 py-3 text-xs text-slate-400">No document types found.</div>
            )}
            {flatItems.length > 0 && (
              <div className="py-2">
                {grouped.map((group) => {
                  return (
                    <div key={group.id} className="pb-2">
                      <div className="px-4 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {group.name}
                      </div>
                      {group.items.map((item) => {
                        const absoluteIndex = indexById.get(String(item._id || item.id)) ?? 0;
                        const isActive = absoluteIndex === activeIndex;
                        return (
                          <button
                            key={item._id || item.id}
                            type="button"
                            onMouseEnter={() => setActiveIndex(absoluteIndex)}
                            onClick={() => handleSelect(item)}
                            className={`w-full text-left px-4 py-2 text-xs font-bold transition-all ${
                              isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentTypePicker;
