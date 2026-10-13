import { useState, useRef, useEffect, Children } from 'react';

/**
 * CustomSelect - A theme-matching dropdown component styled with the purple landing page design system.
 * Works as a drop-in replacement for <select> supporting both `options` array and `<option>` children.
 */
export default function CustomSelect({
  value,
  onChange,
  children,
  options,
  placeholder,
  className = '',
  disabled = false,
  name,
  id,
  title,
  'aria-label': ariaLabel,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse options from either `options` prop or `<option>` children
  const parsedOptions = [];
  if (options && Array.isArray(options)) {
    options.forEach((opt) => {
      if (Array.isArray(opt)) {
        parsedOptions.push({ value: opt[0], label: opt[1] });
      } else if (typeof opt === 'object' && opt !== null) {
        parsedOptions.push({
          value: opt.value !== undefined ? opt.value : opt.key,
          label: opt.label !== undefined ? opt.label : opt.title || opt.name || opt.value,
        });
      } else {
        parsedOptions.push({ value: opt, label: String(opt) });
      }
    });
  } else if (children) {
    const extract = (elements) => {
      Children.forEach(elements, (child) => {
        if (!child) return;
        if (child.type === 'option') {
          parsedOptions.push({
            value: child.props.value !== undefined ? child.props.value : child.props.children,
            label: child.props.children,
            disabled: child.props.disabled,
          });
        } else if (child.props?.children) {
          extract(child.props.children);
        }
      });
    };
    extract(children);
  }

  // Find currently selected option
  const currentOption = parsedOptions.find(
    (opt) => String(opt.value ?? '') === String(value ?? '')
  );

  const displayLabel = currentOption
    ? currentOption.label
    : placeholder || (parsedOptions[0]?.label ?? '');

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (val) => {
    if (disabled) return;
    setIsOpen(false);
    if (onChange) {
      onChange({
        target: { value: val, name },
        currentTarget: { value: val, name },
        preventDefault: () => {},
        stopPropagation: () => {},
      });
    }
  };

  // Extract width classes (e.g. w-40, w-56, max-w-xs) to put on container
  const widthMatches = className.match(/\b(w-\S+|max-w-\S+)\b/g) || [];
  const widthCls = widthMatches.join(' ');
  const buttonCls = className
    .split(' ')
    .filter((c) => !widthMatches.includes(c))
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${widthCls || 'w-full'}`}
    >
      <button
        type="button"
        id={id}
        title={title}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`${buttonCls} w-full flex items-center justify-between gap-2.5 text-left cursor-pointer transition-all duration-200 ${
          isOpen
            ? 'border-[#6355d8] ring-2 ring-[#6355d8]/20 bg-[#faf8ff]'
            : 'hover:border-[#a855f7] hover:bg-[#faf8ff]/60'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="truncate block font-medium text-[#1e1b4b]">
          {displayLabel}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-[#6355d8] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-full w-max max-w-sm rounded-2xl border border-[#f0eaff] bg-white p-1.5 shadow-xl shadow-purple-900/15 backdrop-blur-md max-h-64 overflow-y-auto">
          {parsedOptions.length === 0 ? (
            <div className="px-3.5 py-2 text-xs text-slate-400">No options available</div>
          ) : (
            parsedOptions.map((opt, idx) => {
              const isSelected = String(opt.value ?? '') === String(value ?? '');
              return (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-left transition-all ${
                    isSelected
                      ? 'bg-[#ede9fe] text-[#6355d8] font-bold shadow-xs'
                      : 'text-[#1e1b4b] font-medium hover:bg-[#faf8ff] hover:text-[#6355d8]'
                  } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <svg
                      className="h-4 w-4 shrink-0 text-[#6355d8]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
