type PublicEmailAddressProps = {
  className?: string;
  email: string;
};

export function PublicEmailAddress({
  className,
  email,
}: PublicEmailAddressProps) {
  return <span className={className}>{email}</span>;
}
