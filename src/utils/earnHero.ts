const HERO_BASE = 'https://res.cloudinary.com/da6oeat7m/image/upload';
const HERO_ASSET = 'v1792429490/Neon_Fintech_Network_Over_City_Lights_yyxesi.png';
/** Approved Mystery Earn hero artwork (1672×941). Phones get a right-side crop that keeps the phone and service icons. */
export const earnHeroImage = {
  desktop: [960, 1280, 1672].map(width => `${HERO_BASE}/f_auto,q_auto,c_scale,w_${width}/${HERO_ASSET} ${width}w`).join(', '),
  mobile: [480, 720, 960].map(width => `${HERO_BASE}/c_crop,g_east,w_0.62/f_auto,q_auto,c_scale,w_${width}/${HERO_ASSET} ${width}w`).join(', '),
  fallback: `${HERO_BASE}/f_auto,q_auto,c_scale,w_1280/${HERO_ASSET}`,
};
