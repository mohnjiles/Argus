import type { CameraAngle } from '../../types';

// Smart spatial layout - arrange cameras based on their actual physical positions
export function createSpatialLayout(cams: CameraAngle[]): { camera: CameraAngle; row: number; col: number }[] {
    const layout: { camera: CameraAngle; row: number; col: number }[] = [];

    // Define camera positions in a logical grid
    // Top row: left pillar | front | right pillar (more forward-facing)
    // Bottom row: right repeater | back | left repeater (mirrored to match side view)
    const positions: Record<CameraAngle, { row: number; col: number }> = {
        'left_pillar': { row: 0, col: 0 },
        'front': { row: 0, col: 1 },
        'right_pillar': { row: 0, col: 2 },
        'left_repeater': { row: 1, col: 0 },
        'back': { row: 1, col: 1 },
        'right_repeater': { row: 1, col: 2 },
    };

    // Get positions for selected cameras
    for (const cam of cams) {
        layout.push({ camera: cam, ...positions[cam] });
    }

    return layout;
}

export function compactLayout(layout: { camera: CameraAngle; row: number; col: number }[]): { rows: number; cols: number; items: { camera: CameraAngle; row: number; col: number }[] } {
    // Compact the grid - remove empty columns/rows
    const usedCols = [...new Set(layout.map(p => p.col))].sort((a, b) => a - b);
    const usedRows = [...new Set(layout.map(p => p.row))].sort((a, b) => a - b);

    // Remap to contiguous grid (e.g., if using cols 0 and 2, remap to 0 and 1)
    const colMap = new Map(usedCols.map((col, idx) => [col, idx]));
    const rowMap = new Map(usedRows.map((row, idx) => [row, idx]));

    const compacted = layout.map(item => ({
        ...item,
        col: colMap.get(item.col)!,
        row: rowMap.get(item.row)!,
    }));

    let cols = usedCols.length;
    let rows = usedRows.length;

    // Special case: for 2 cameras, arrange side-by-side instead of stacked
    if (compacted.length === 2) {
        return {
            rows: 1,
            cols: 2,
            items: compacted.map((item, idx) => ({
                ...item,
                row: 0,
                col: idx,
            }))
        };
    }

    return { rows, cols, items: compacted };
}
