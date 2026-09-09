import { lazy } from 'react';

/** Previews del ensamblador. Se bajan recién al abrir "Vista previa". */
export const Preview = lazy(() => import('./Preview.tsx').then((m) => ({ default: m.Preview })));
export const PreviewMines = lazy(() => import('./PreviewMines.tsx').then((m) => ({ default: m.PreviewMines })));
export const PreviewRuleta = lazy(() => import('./PreviewRuleta.tsx').then((m) => ({ default: m.PreviewRuleta })));
export const PreviewRuletaBotones = lazy(() => import('./PreviewRuletaBotones.tsx').then((m) => ({ default: m.PreviewRuletaBotones })));
export const PreviewCrash = lazy(() => import('./PreviewCrash.tsx').then((m) => ({ default: m.PreviewCrash })));
export const PreviewPlinko = lazy(() => import('./PreviewPlinko.tsx').then((m) => ({ default: m.PreviewPlinko })));
export const PreviewRaspadita = lazy(() => import('./PreviewRaspadita.tsx').then((m) => ({ default: m.PreviewRaspadita })));
export const PreviewLimbo = lazy(() => import('./Limbo.tsx').then((m) => ({ default: m.PreviewLimbo })));
export const PreviewDice = lazy(() => import('./Dice.tsx').then((m) => ({ default: m.PreviewDice })));
export const PreviewKeno = lazy(() => import('./Keno.tsx').then((m) => ({ default: m.PreviewKeno })));
export const PreviewSieteUd = lazy(() => import('./SieteUd.tsx').then((m) => ({ default: m.PreviewSieteUd })));
export const PreviewTorre = lazy(() => import('./Torre.tsx').then((m) => ({ default: m.PreviewTorre })));
