type TentacleFieldProps = {
  className?: string;
  /** "dark" = utilisé sur un fond encre (#211A44) ; "light" = sur un fond clair. */
  variant?: 'light' | 'dark';
};

/**
 * Décor d'arrière-plan en forme de tentacules d'encre : trois traits
 * organiques flous, dérivant lentement, dans les teintes de la marque
 * (violet, cyan, magenta). Purement décoratif (aria-hidden), toujours
 * positionné derrière le contenu par l'appelant.
 */
export default function TentacleField({ className = '', variant = 'light' }: TentacleFieldProps) {
  const opacity = variant === 'dark' ? 0.4 : 0.14;

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <svg
        className="tentacle-drift-1 absolute -top-1/4 -left-1/3 h-[140%] w-[140%]"
        viewBox="0 0 800 800"
        fill="none"
      >
        <defs>
          <linearGradient id="tentacle-violet" x1="0" y1="0" x2="800" y2="800" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8a72c9" />
            <stop offset="100%" stopColor="#211a44" />
          </linearGradient>
        </defs>
        <path
          d="M90,660 C190,510 60,430 190,330 C310,230 230,150 350,70 C410,30 470,15 530,45"
          stroke="url(#tentacle-violet)"
          strokeWidth="90"
          strokeLinecap="round"
          opacity={opacity}
          style={{ filter: 'blur(48px)' }}
        />
      </svg>

      <svg
        className="tentacle-drift-2 absolute -right-1/3 -bottom-1/4 h-[130%] w-[130%]"
        viewBox="0 0 800 800"
        fill="none"
      >
        <defs>
          <linearGradient id="tentacle-teal" x1="800" y1="0" x2="0" y2="800" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#45c9bc" />
            <stop offset="100%" stopColor="#211a44" />
          </linearGradient>
        </defs>
        <path
          d="M730,130 C610,230 710,330 590,410 C470,490 550,590 430,670 C370,710 310,720 260,700"
          stroke="url(#tentacle-teal)"
          strokeWidth="80"
          strokeLinecap="round"
          opacity={opacity}
          style={{ filter: 'blur(48px)' }}
        />
      </svg>

      <svg
        className="tentacle-drift-3 absolute top-1/4 left-1/4 h-full w-full"
        viewBox="0 0 800 800"
        fill="none"
      >
        <defs>
          <linearGradient id="tentacle-magenta" x1="0" y1="800" x2="800" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e264c4" />
            <stop offset="100%" stopColor="#4f3aa0" />
          </linearGradient>
        </defs>
        <path
          d="M110,410 C230,350 270,470 390,430 C510,390 530,490 650,470"
          stroke="url(#tentacle-magenta)"
          strokeWidth="60"
          strokeLinecap="round"
          opacity={opacity * 0.7}
          style={{ filter: 'blur(40px)' }}
        />
      </svg>
    </div>
  );
}
