import Image from 'next/image';

interface BrowserFrameProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  onClick?: () => void;
}

export default function BrowserFrame({ src, alt, className = '', priority = false, onClick }: BrowserFrameProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      title={onClick ? "Cliquer pour agrandir" : undefined}
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg motion-reduce:hover:translate-y-0' : ''
      } ${className}`}
    >
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-rose-300" />
        <span className="size-2.5 rounded-full bg-amber-300" />
        <span className="size-2.5 rounded-full bg-emerald-300" />
        <span className="ml-3 truncate rounded-md bg-white px-3 py-1 text-[11px] text-slate-400 ring-1 ring-slate-200">
          octostock.app
        </span>
      </div>
      <div className="relative aspect-[1910/1079] w-full bg-slate-50">
        <Image src={src} alt={alt} fill priority={priority} className="object-cover object-top" sizes="(max-width: 768px) 100vw, 90vw" />
      </div>
    </div>
  );
}
