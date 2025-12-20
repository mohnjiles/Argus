declare module 'react-draggable' {
    import * as React from 'react';

    export interface DraggableBounds {
        left?: number;
        right?: number;
        top?: number;
        bottom?: number;
    }

    export interface DraggableProps {
        allowAnyClick?: boolean;
        axis?: 'both' | 'x' | 'y' | 'none';
        bounds?: DraggableBounds | string | false;
        cancel?: string;
        children?: React.ReactNode;
        defaultClassName?: string;
        defaultClassNameDragging?: string;
        defaultClassNameDragged?: string;
        defaultPosition?: { x: number, y: number };
        disabled?: boolean;
        grid?: [number, number];
        handle?: string;
        nodeRef?: React.RefObject<HTMLElement>;
        offsetParent?: HTMLElement;
        onMouseDown?: (e: MouseEvent) => void;
        onStart?: (e: any, data: any) => void | false;
        onDrag?: (e: any, data: any) => void | false;
        onStop?: (e: any, data: any) => void | false;
        position?: { x: number, y: number };
        positionOffset?: { x: number | string, y: number | string };
        scale?: number;
    }

    export default class Draggable extends React.Component<DraggableProps, any> { }
}
