import { cloneElement, isValidElement, useId } from 'react';

/** Label + control + hint/error. Pass the input as the child; id and aria attributes are wired automatically. */
export default function FormField({ label, error, hint, required, children, className = "", badge, htmlFor }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const isControl = isValidElement(children) && ['input', 'select', 'textarea'].includes(children.type);
  const control = isControl
    ? cloneElement(children, {
      id: children.props.id || id,
      'aria-invalid': error ? 'true' : undefined,
      'aria-describedby': describedBy,
      className: `${children.props.className || 'input'} ${error ? 'input-error' : ''}`,
    })
    : children;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor || (isControl ? children.props.id || id : undefined)} className="label flex items-center gap-1.5">
          {label}
          {required && <span className="text-danger" aria-hidden>*</span>}
          {badge}
        </label>
      )}
      {control}
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-xs text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
