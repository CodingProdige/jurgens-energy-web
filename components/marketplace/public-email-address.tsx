type PublicEmailAddressProps = {
  className?: string;
  email: string;
};

export function PublicEmailAddress({
  className,
  email,
}: PublicEmailAddressProps) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{
        __html: `<!--email_off-->${escapeHtml(email)}<!--/email_off-->`,
      }}
    />
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
