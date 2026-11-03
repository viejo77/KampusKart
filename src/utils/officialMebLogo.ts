/**
 * High-definition vector SVG representation of the official T.C. Millî Eğitim Bakanlığı emblem.
 * Designed at 600x600 px with crisp vector paths for infinite scaling and razor-sharp printing at 300-600 DPI.
 */
export function getOfficialMebLogoSvgDataUrl(
  primaryColor: string = '#b91c1c',
  accentColor: string = '#d97706'
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <linearGradient id="mebGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <linearGradient id="mebRed" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${primaryColor}"/>
      <stop offset="100%" stop-color="#7f1d1d"/>
    </linearGradient>
    <filter id="mebDropShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Crisp White Outer Base Plate -->
  <circle cx="300" cy="300" r="290" fill="#ffffff" stroke="#f1f5f9" stroke-width="2"/>

  <!-- Outer Golden Embellished Ring -->
  <circle cx="300" cy="300" r="282" fill="none" stroke="url(#mebGold)" stroke-width="8"/>
  <circle cx="300" cy="300" r="270" fill="none" stroke="#fef08a" stroke-width="2" stroke-dasharray="4,4"/>

  <!-- Primary Colored Circular Crest -->
  <circle cx="300" cy="300" r="264" fill="url(#mebRed)"/>

  <!-- Inner Gold Trim Ring -->
  <circle cx="300" cy="300" r="256" fill="none" stroke="url(#mebGold)" stroke-width="4"/>

  <!-- 16 Historical Turkish Republic Stars Ring -->
  <g fill="url(#mebGold)">
    ${Array.from({ length: 16 }, (_, i) => {
      const angle = (i * 360) / 16;
      return `<g transform="rotate(${angle} 300 300)">
        <polygon points="300,56 303,66 313,66 305,72 308,82 300,76 292,82 295,72 287,66 297,66" />
      </g>`;
    }).join('\n    ')}
  </g>

  <!-- Inner White Disc for Maximum Contrast -->
  <circle cx="300" cy="300" r="215" fill="#ffffff" filter="url(#mebDropShadow)"/>
  <circle cx="300" cy="300" r="215" fill="none" stroke="url(#mebGold)" stroke-width="5"/>

  <!-- Crescent and Star (Hilal ve Yıldız) at the top of the emblem -->
  <g fill="${primaryColor}">
    <!-- Crescent Moon -->
    <path d="M 300 135 A 46 46 0 1 0 342 195 A 37 37 0 1 1 300 135 Z"/>
    <!-- Five-pointed Star -->
    <polygon points="340,165 344,175 355,175 347,181 350,191 341,185 332,191 335,181 327,175 338,175"/>
  </g>

  <!-- Official Torch of Enlightenment (Meşale) -->
  <g>
    <!-- Golden Flame -->
    <path d="M 300 210 C 315 235 328 250 322 272 C 316 288 300 295 300 295 C 300 295 284 288 278 272 C 272 250 285 235 300 210 Z" fill="url(#mebGold)"/>
    <!-- Inner Flame Core -->
    <path d="M 300 230 C 308 245 314 256 310 270 C 306 280 300 285 300 285 C 300 285 294 280 290 270 C 286 256 292 245 300 230 Z" fill="#ef4444"/>
    <!-- Torch Bowl & Handle -->
    <path d="M 284 292 L 316 292 L 310 320 L 290 320 Z" fill="${primaryColor}" stroke="url(#mebGold)" stroke-width="3"/>
    <rect x="294" y="320" width="12" height="70" rx="3" fill="url(#mebGold)"/>
    <ellipse cx="300" cy="392" rx="10" ry="5" fill="url(#mebGold)"/>
  </g>

  <!-- Open Book of Knowledge (Açık İlim Kitabı) -->
  <g fill="${primaryColor}" stroke="#ffffff" stroke-width="3">
    <!-- Left Pages Stack -->
    <path d="M 300 375 C 265 358 220 358 190 365 C 185 366 182 370 182 376 L 182 445 C 220 435 265 435 300 450 Z" />
    <!-- Right Pages Stack -->
    <path d="M 300 375 C 335 358 380 358 410 365 C 415 366 418 370 418 376 L 418 445 C 380 435 335 435 300 450 Z" />
    <!-- Page Folds -->
    <path d="M 200 440 C 235 430 270 430 300 446" fill="none" stroke="url(#mebGold)" stroke-width="3"/>
    <path d="M 400 440 C 365 430 330 430 300 446" fill="none" stroke="url(#mebGold)" stroke-width="3"/>
  </g>

  <!-- Ribbon & Laurel Branches at bottom -->
  <g fill="none" stroke="url(#mebGold)" stroke-width="4" stroke-linecap="round">
    <path d="M 175 420 C 190 470 240 495 300 495 C 360 495 410 470 425 420"/>
  </g>

  <!-- Official Foundation Year Badge -->
  <rect x="265" y="475" width="70" height="26" rx="6" fill="${primaryColor}" stroke="url(#mebGold)" stroke-width="2"/>
  <text x="300" y="493" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="14" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="1">1920</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
