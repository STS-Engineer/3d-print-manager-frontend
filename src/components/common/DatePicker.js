import React, { useState, useRef, useEffect } from 'react';

/**
 * Styled DatePicker — wraps native input[type=date] with a calendar icon
 * and a clean, consistent appearance across all browsers.
 * Falls back to native browser picker on click.
 */
export const DatePicker = ({
  value,
  onChange,
  placeholder = 'Select date',
  min,
  max,
  disabled = false,
  style = {},
  className = '',
}) => {
  const inputRef = useRef(null);

  const handleIconClick = () => {
    if (disabled) return;
    try {
      inputRef.current?.showPicker?.();
    } catch (_) {
      inputRef.current?.click();
    }
  };

  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '';

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', ...style }}>
      {/* Visible styled input */}
      <div
        onClick={handleIconClick}
        style={{
          flex: 1, padding: '0.6rem 2.5rem 0.6rem 0.85rem',
          background: disabled ? 'var(--bg-primary)' : 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius)',
          fontSize: '0.85rem', color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          minHeight: 38,
        }}
      >
        {displayValue || placeholder}
      </div>
      {/* Calendar icon */}
      <span
        onClick={handleIconClick}
        style={{
          position: 'absolute', right: 10, cursor: disabled ? 'not-allowed' : 'pointer',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
        }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </span>
      {/* Hidden native date input */}
      <input
        ref={inputRef}
        type="date"
        value={value || ''}
        min={min}
        max={max}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        style={{
          position: 'absolute', inset: 0, opacity: 0,
          width: '100%', height: '100%',
          cursor: disabled ? 'not-allowed' : 'pointer',
          pointerEvents: 'none', // clicks handled by visible div
        }}
        tabIndex={-1}
      />
    </div>
  );
};

/**
 * DateTimePicker — same but for datetime-local inputs
 */
export const DateTimePicker = ({
  value,
  onChange,
  placeholder = 'Select date & time',
  disabled = false,
  style = {},
}) => {
  const inputRef = useRef(null);

  const handleClick = () => {
    if (disabled) return;
    try {
      inputRef.current?.showPicker?.();
    } catch (_) {
      inputRef.current?.click();
    }
  };

  const displayValue = value
    ? new Date(value).toLocaleString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', ...style }}>
      <div
        onClick={handleClick}
        style={{
          flex: 1, padding: '0.6rem 2.5rem 0.6rem 0.85rem',
          background: disabled ? 'var(--bg-primary)' : 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius)',
          fontSize: '0.85rem', color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          minHeight: 38,
        }}
      >
        {displayValue || placeholder}
      </div>
      <span onClick={handleClick} style={{ position: 'absolute', right: 10, cursor: 'pointer', color: 'var(--text-muted)' }}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </span>
      <input
        ref={inputRef}
        type="datetime-local"
        value={value || ''}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        onClick={handleClick}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          opacity: 0, cursor: 'pointer',
        }}
      />
    </div>
  );
};

export default DatePicker;