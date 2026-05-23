import Image from 'next/image';

interface Props {
  className?: string;
  size?: number;
}

export function NotionIcon({ className, size = 28 }: Props) {
  return (
    <Image
      src="/notion-svgrepo-com.svg"
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden
      priority
    />
  );
}
