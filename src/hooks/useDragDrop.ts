import { useState, useCallback } from 'react';

interface DragDropOptions {
    onOpenFolder: (handle: FileSystemDirectoryHandle) => void;
}

export function useDragDrop({ onOpenFolder }: DragDropOptions) {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Prevent flickering when dragging over child elements
        if (e.currentTarget.contains(e.relatedTarget as Node)) {
            return;
        }
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const items = Array.from(e.dataTransfer.items);
        for (const item of items) {
            if (item.kind === 'file') {
                try {
                    // Verify it's a directory
                    const handle = await (item as any).getAsFileSystemHandle() as FileSystemHandle;
                    if (handle && handle.kind === 'directory') {
                        onOpenFolder(handle as FileSystemDirectoryHandle);
                        break; // Only open the first folder found
                    }
                } catch (error) {
                    console.error('Error handling dropped item:', error);
                }
            }
        }
    }, [onOpenFolder]);

    return {
        isDragging,
        dragHandlers: {
            onDragOver: handleDragOver,
            onDragLeave: handleDragLeave,
            onDrop: handleDrop,
        }
    };
}
