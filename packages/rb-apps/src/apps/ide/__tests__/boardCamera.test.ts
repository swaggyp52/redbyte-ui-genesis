import { describe, expect, it } from 'vitest';
import {
  BASYS3_BOARD_FRAME,
  boardCameraDensity,
  computeBoardViewBox,
  fitBoardCameraToBounds,
  isDefaultBoardCamera,
  panBoardCamera,
  zoomBoardCamera,
} from '../boardCamera';
import { DEFAULT_BOARD_CAMERA } from '../workspacePreferences';

/** P2.5H Wave Two — the Board camera is pure geometry over the native frame. */
describe('boardCamera', () => {
  it('renders the native frame for the default camera', () => {
    expect(computeBoardViewBox(DEFAULT_BOARD_CAMERA)).toBe('0 -48 620 308');
    expect(isDefaultBoardCamera(DEFAULT_BOARD_CAMERA)).toBe(true);
  });

  it('zooms about the frame centre and clamps', () => {
    const zoomed = zoomBoardCamera(DEFAULT_BOARD_CAMERA, 2);
    expect(zoomed.zoom).toBe(2);
    expect(computeBoardViewBox(zoomed)).toBe('155 29 310 154');
    expect(zoomBoardCamera(zoomed, 100).zoom).toBe(4);
    expect(zoomBoardCamera(zoomed, 0.001).zoom).toBe(0.5);
  });

  it('pans in board units of the current zoom and keeps the frame in view', () => {
    const panned = panBoardCamera({ zoom: 2, x: 0, y: 0 }, 100, -40);
    expect(panned).toEqual({ zoom: 2, x: 50, y: -20 });
    expect(panBoardCamera(DEFAULT_BOARD_CAMERA, 100000, 100000)).toEqual({ zoom: 1, x: 310, y: 154 });
  });

  it('fits bounds at about a third of the frame, never below the native zoom', () => {
    const fit = fitBoardCameraToBounds({ x: 500, y: 200, width: 20, height: 20 });
    expect(fit.zoom).toBe(4);
    expect(fit.x).toBe(510 - (BASYS3_BOARD_FRAME.x + BASYS3_BOARD_FRAME.width / 2));
    expect(fit.y).toBe(210 - (BASYS3_BOARD_FRAME.y + BASYS3_BOARD_FRAME.height / 2));
    expect(fitBoardCameraToBounds({ x: 0, y: -48, width: 620, height: 308 }).zoom).toBe(1);
  });

  it('drops resource labels below the density threshold', () => {
    expect(boardCameraDensity({ zoom: 0.6, x: 0, y: 0 })).toBe('compact');
    expect(boardCameraDensity(DEFAULT_BOARD_CAMERA)).toBe('normal');
  });
});
